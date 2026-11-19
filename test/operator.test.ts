// El operador activa a un titular: `holdersWithoutAccount` y `activateHolder`, con sus errores de dominio.
// Casos portados de `AccountRulesTest` y `FakeRepositoriesTest`. Al final, dar y quitar el acceso de operador por script.

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { promisify } from "node:util";
import { adminAuth, adminDb, newUser, yearsAgo } from "./helpers.ts";

/** Un asociado nuevo, con id propio para no chocar con otros tests. */
async function affiliate(fields: { holderId?: string | null; birthDate?: string; email?: string } = {}) {
  const id = `t-${randomUUID()}`;
  await adminDb.doc(`affiliates/${id}`).set({
    firstName: "Prueba", lastName: id, dni: "1", number: "FP-0", plan: "family",
    birthDate: yearsAgo(40), holderId: null, phone: "", email: "", ...fields,
  });
  return id;
}

/** Una persona con su cuenta pendiente de titular; devuelve también su código de activación. */
async function pendingHolder() {
  const user = await newUser();
  await user.call("registerAccount");
  await user.call("chooseRole", { role: "holder" });
  return { user, code: (await user.account())?.activationCode as string };
}

const operator = () => newUser({ operator: true });
const activate = async (op: Awaited<ReturnType<typeof operator>>, affiliateId: string, code: string) =>
  (await op.call("activateHolder", { affiliateId, code })).data;

test("activateHolder deja la cuenta activa, vinculada y con sus claims", async () => {
  const [op, { user, code }] = await Promise.all([operator(), pendingHolder()]);
  const holderId = await affiliate({ email: user.email });

  assert.deepEqual(await activate(op, holderId, ` ${code} `), { error: null });

  const account = await user.account();
  assert.equal(account?.status, "active");
  assert.equal(account?.affiliateId, holderId);
  assert.equal(account?.role, "holder");
  const claims = await user.tokenClaims();
  assert.deepEqual([claims.affiliateId, claims.holderId, claims.role], [holderId, holderId, "holder"]);
});

test("activateHolder registra qué operador activó la cuenta y cuándo", async () => {
  const [op, { user, code }] = await Promise.all([operator(), pendingHolder()]);
  const holderId = await affiliate({ email: user.email });
  const before = Date.now();

  assert.deepEqual(await activate(op, holderId, code), { error: null });

  const account = await user.account();
  assert.equal(account?.activatedBy, op.uid);
  assert.ok(account?.activatedAt >= before && account?.activatedAt <= Date.now(), `activatedAt: ${account?.activatedAt}`);
});

test("activateHolder solo activa si el correo de la cuenta es el del padrón", async () => {
  const [op, { user, code }] = await Promise.all([operator(), pendingHolder()]);
  const [matching, other, withoutEmail] = await Promise.all([
    affiliate({ email: ` ${user.email.toUpperCase()} ` }), affiliate({ email: "otra.persona@correo.com" }), affiliate({ email: "" }),
  ]);

  for (const holderId of [other, withoutEmail]) {
    assert.deepEqual(await activate(op, holderId, code), { error: "INVALID_CODE", reason: "EMAIL_MISMATCH" });
  }
  assert.equal((await user.account())?.status, "pending");

  assert.deepEqual(await activate(op, matching, code), { error: null });
  assert.equal((await user.account())?.affiliateId, matching);
});

test("activateHolder devuelve los errores de dominio", async () => {
  const [op, minor, adherent, { user, code }] = await Promise.all([operator(), affiliate(), affiliate(), pendingHolder()]);
  const holder = await affiliate({ email: user.email });
  await adminDb.doc(`affiliates/${minor}`).update({ holderId: holder, birthDate: yearsAgo(10) });
  await adminDb.doc(`affiliates/${adherent}`).update({ holderId: holder, birthDate: yearsAgo(30) });

  assert.deepEqual(await activate(op, holder, "0000"), { error: "INVALID_CODE" });
  assert.deepEqual(await activate(op, holder, "  "), { error: "INVALID_CODE" });
  assert.deepEqual(await activate(op, "no-existe", code), { error: "INVALID_CODE" });
  assert.deepEqual(await activate(op, minor, code), { error: "IS_DEPENDENT" });
  assert.deepEqual(await activate(op, adherent, code), { error: "IS_ADHERENT" });

  assert.deepEqual(await activate(op, holder, code), { error: null });
  const other = await pendingHolder();
  assert.deepEqual(await activate(op, holder, other.code), { error: "ALREADY_ACTIVE" });
  assert.equal((await other.user.account())?.status, "pending");
  assert.equal((await other.user.tokenClaims()).affiliateId, undefined);
});

test("holdersWithoutAccount lista al titular hasta que se activa", async () => {
  const [op, adherentId, { user, code }] = await Promise.all([operator(), affiliate(), pendingHolder()]);
  const holderId = await affiliate({ email: user.email });
  await adminDb.doc(`affiliates/${adherentId}`).update({ holderId });
  const listed = async () => ((await op.call("holdersWithoutAccount")).data as { id: string }[]).map((a) => a.id);

  const before = await listed();
  assert.ok(before.includes(holderId));
  assert.ok(!before.includes(adherentId));

  await activate(op, holderId, code);
  assert.ok(!(await listed()).includes(holderId));
});

test("sin el claim de operador, las Functions del operador se rechazan", async () => {
  const { user, code } = await pendingHolder();
  const holderId = await affiliate();

  await assert.rejects(user.call("activateHolder", { affiliateId: holderId, code }), { code: "functions/permission-denied" });
  await assert.rejects(user.call("holdersWithoutAccount"), { code: "functions/permission-denied" });
  assert.equal((await user.account())?.status, "pending");
});

test("dos activaciones simultáneas con el mismo código: gana una y los claims son los de la cuenta", async () => {
  const [opA, opB, { user, code }] = await Promise.all([operator(), operator(), pendingHolder()]);
  const [holderA, holderB] = await Promise.all([affiliate({ email: user.email }), affiliate({ email: user.email })]);

  const results = await Promise.all([activate(opA, holderA, code), activate(opB, holderB, code)]);

  assert.deepEqual(results.map((r) => (r as { error: string | null }).error).sort(), ["INVALID_CODE", null]);
  const linked = (await user.account())?.affiliateId;
  assert.ok(linked === holderA || linked === holderB);
  assert.equal((await user.tokenClaims()).affiliateId, linked);
});

/** Corre `scripts/operator-access.ts` contra el emulador (`emulators:exec` define FIREBASE_AUTH_EMULATOR_HOST). */
const operatorAccess = (command: "grant" | "revoke", email: string) =>
  promisify(execFile)(process.execPath, ["scripts/operator-access.ts", command, email]);

test("grant-operator da el acceso conservando los otros claims; revoke-operator lo quita en el momento", async () => {
  const user = await newUser({ role: "holder" });

  await operatorAccess("grant", user.email);
  assert.deepEqual((await adminAuth.getUser(user.uid)).customClaims, { role: "holder", operator: true });
  await user.tokenClaims();
  await user.call("holdersWithoutAccount");

  await operatorAccess("revoke", user.email);
  assert.deepEqual((await adminAuth.getUser(user.uid)).customClaims, { role: "holder" });
  // El emulador deja actualizar el token aunque esté revocado (producción no); el token nuevo ya no trae `operator`.
  assert.equal((await user.tokenClaims()).operator, undefined);
  await assert.rejects(user.call("activateHolder", { affiliateId: "x", code: "1" }), { code: "functions/permission-denied" });
});

test("grant-operator con un correo que no está en Auth termina con error", async () => {
  await assert.rejects(operatorAccess("grant", `${randomUUID()}@test.palacio`), /tiene que entrar una vez a la consola/);
});
