// Vinculación de un adherente: token, validación del titular, aceptación y rechazo. Casos portados de la
// vinculación en `AccountRulesTest` y `FakeRepositoriesTest`.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { collection, getDocs, query, where } from "firebase/firestore";
import { adminDb, family, newUser, yearsAgo } from "./helpers.ts";

const LINK_BASE = "https://palacio.app/v/";
type User = Awaited<ReturnType<typeof newUser>>;

/** Una persona que entró por primera vez y eligió ser adherente: tiene su token de vinculación. */
async function pendingAdherent() {
  const user = await newUser();
  await user.call("registerAccount");
  await user.call("chooseRole", { role: "adherent" });
  return { user, token: (await user.account())?.linkToken as string };
}

/** Un adherente mayor de edad de la familia, sin cuenta: a quien se valida. */
async function memberWithoutAccount(holderId: string) {
  const id = `s-${randomUUID()}`;
  await adminDb.doc(`affiliates/${id}`).set({
    firstName: "Silvia", lastName: "Medina", dni: "28911402", number: "FP-0", plan: "family",
    birthDate: yearsAgo(45), holderId, phone: "", email: "",
  });
  return id;
}

const validate = async (holder: User, memberId: string, tokenOrLink: string) =>
  (await holder.call("validateAdherent", { memberId, tokenOrLink })).data;

test("previewLink muestra al titular el correo de la cuenta detrás de un token o enlace vigente", async () => {
  const [f, { user, token }] = await Promise.all([family(), pendingAdherent()]);

  for (const tokenOrLink of [token, ` ${LINK_BASE}${token} `]) {
    assert.deepEqual((await f.holderUser.call("previewLink", { tokenOrLink })).data, { accountId: user.uid, email: user.email });
  }
  assert.equal((await f.holderUser.call("previewLink", { tokenOrLink: "NOEXISTE" })).data, null);
  await assert.rejects(f.adherentUser.call("previewLink", { tokenOrLink: token }), { code: "functions/permission-denied" });
});

test("validateAdherent devuelve los errores de dominio", async () => {
  const [f, other, { user, token }] = await Promise.all([family(), family(), pendingAdherent()]);
  const member = await memberWithoutAccount(f.holder);

  assert.deepEqual(await validate(f.holderUser, other.adherent, token), { error: "NOT_IN_FAMILY" });
  assert.deepEqual(await validate(f.holderUser, "no-existe", token), { error: "NOT_IN_FAMILY" });
  assert.deepEqual(await validate(f.holderUser, f.dependent, token), { error: "UNDER_18" });
  assert.deepEqual(await validate(f.holderUser, f.adherent, token), { error: "ALREADY_LINKED" });
  assert.deepEqual(await validate(f.holderUser, member, "NOEXISTE"), { error: "LINK_EXPIRED" });

  await adminDb.doc(`accounts/${user.uid}`).update({ linkTokenExpiresAt: Date.now() - 1 });
  assert.deepEqual(await validate(f.holderUser, member, token), { error: "LINK_EXPIRED" });
  assert.equal((await user.account())?.status, "pending");
});

test("validar, aceptar: la cuenta queda activa, con claims, y el titular la ve en su familia", async () => {
  const [f, { user, token }] = await Promise.all([family(), pendingAdherent()]);
  const member = await memberWithoutAccount(f.holder);

  assert.deepEqual(await validate(f.holderUser, member, LINK_BASE + token), { error: null });

  // La cuenta que espera la aceptación tiene lo que muestra su pantalla, sin leer asociados.
  const awaiting = await user.account();
  assert.equal(awaiting?.status, "awaiting_acceptance");
  assert.equal(awaiting?.affiliateId, member);
  assert.equal(awaiting?.validatedBy, f.holder);
  assert.deepEqual([awaiting?.validatedByName, awaiting?.affiliateName, awaiting?.affiliateDni], ["Prueba Familia", "Silvia Medina", "28911402"]);
  assert.equal(awaiting?.linkToken, null);
  assert.deepEqual(await validate(f.holderUser, member, token), { error: "ALREADY_LINKED" });

  await user.call("accept");

  assert.equal((await user.account())?.status, "active");
  const claims = await user.tokenClaims();
  assert.deepEqual([claims.affiliateId, claims.holderId, claims.role], [member, f.holder, "adherent"]);
  assert.equal((await adminDb.doc(`affiliates/${member}`).get()).get("email"), user.email); // no tenía correo
  const familyAccounts = await getDocs(query(collection(f.holderUser.db, "accounts"), where("validatedBy", "==", f.holder)));
  assert.ok(familyAccounts.docs.some((d) => d.id === user.uid));
});

test("rechazar: la cuenta vuelve a pendiente, sin asociado y con un token nuevo", async () => {
  const [f, { user, token }] = await Promise.all([family(), pendingAdherent()]);
  const member = await memberWithoutAccount(f.holder);
  await validate(f.holderUser, member, token);

  await user.call("reject");

  const rejected = await user.account();
  assert.equal(rejected?.status, "pending");
  assert.equal(rejected?.affiliateId, null);
  assert.equal(rejected?.validatedBy, null);
  assert.equal(rejected?.validatedByName, null);
  assert.match(rejected?.linkToken, /^[A-Z2-9]{10}$/);
  assert.notEqual(rejected?.linkToken, token);
  assert.ok(rejected?.linkTokenExpiresAt > Date.now());
  assert.equal((await user.tokenClaims()).affiliateId, undefined);
});

test("aceptar o rechazar sin una validación pendiente no hace nada", async () => {
  const { user, token } = await pendingAdherent();

  await user.call("accept");
  await user.call("reject");

  const account = await user.account();
  assert.equal(account?.status, "pending");
  assert.equal(account?.linkToken, token);
  assert.equal((await user.tokenClaims()).affiliateId, undefined);
});

test("demoPendingLinkToken: un token vigente, solo para el operador", async () => {
  const [{ token }, operator, f] = await Promise.all([pendingAdherent(), newUser({ operator: true }), family()]);

  assert.equal(typeof (await operator.call("demoPendingLinkToken")).data, "string");
  assert.ok(token);
  await assert.rejects(f.holderUser.call("demoPendingLinkToken"), { code: "functions/permission-denied" });
});
