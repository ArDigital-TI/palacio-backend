// Tests contra el emulador, desde el lado de la app: llaman a las Functions y leen y escriben Firestore
// como un usuario dado. Uso: `npm test` (levanta los emuladores, corre los tests y los apaga).

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { doc, setDoc } from "firebase/firestore";
import { assertDenied, newUser } from "./helpers.ts";

test("registerAccount crea la cuenta pendiente con un código de activación", async () => {
  const user = await newUser();
  await user.call("registerAccount");

  const account = await user.account();
  assert.equal(account?.status, "pending");
  assert.equal(account?.email, user.email);
  assert.equal(account?.role, undefined);
  assert.match(account?.activationCode, /^\d{4}$/);
});

test("registerAccount es idempotente: no modifica una cuenta existente", async () => {
  const user = await newUser();
  await user.call("registerAccount");
  const first = await user.account();
  await user.call("chooseRole", { role: "holder" });

  await user.call("registerAccount");

  assert.deepEqual(await user.account(), { ...first, role: "holder" });
});

test("una cuenta lee su propio documento y no el de otra", async () => {
  const [me, other] = await Promise.all([newUser(), newUser()]);
  await Promise.all([me.call("registerAccount"), other.call("registerAccount")]);

  assert.ok(await me.account());
  await assertDenied(me.account(other.uid));
});

test("el cliente no puede escribir accounts", async () => {
  const user = await newUser();
  await user.call("registerAccount");

  await assertDenied(setDoc(doc(user.db, "accounts", user.uid), { status: "active" }, { merge: true }));
  await assertDenied(setDoc(doc(user.db, "accounts", randomUUID()), { status: "active" }));
});

test("chooseRole del adherente genera un token de vinculación de 60 segundos; refreshLinkToken lo renueva", async () => {
  const user = await newUser();
  await user.call("registerAccount");

  await user.call("chooseRole", { role: "adherent" });
  const chosen = await user.account();
  assert.equal(chosen?.role, "adherent");
  assert.match(chosen?.linkToken, /^[A-Z2-9]{10}$/);
  assert.ok(Math.abs(chosen?.linkTokenExpiresAt - (Date.now() + 60_000)) < 5_000);

  await user.call("refreshLinkToken");
  assert.notEqual((await user.account())?.linkToken, chosen?.linkToken);
});

test("chooseRole rechaza un rol desconocido", async () => {
  const user = await newUser();
  await user.call("registerAccount");

  await assert.rejects(user.call("chooseRole", { role: "operator" }), { code: "functions/invalid-argument" });
});
