// El operador activa a un titular: `holdersWithoutAccount` y `activateHolder`, con sus errores de dominio.
// Casos portados de `AccountRulesTest` y `FakeRepositoriesTest`.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { adminDb, newUser, yearsAgo } from "./helpers.ts";

/** Un asociado nuevo, con id propio para no chocar con otros tests. */
async function affiliate(fields: { holderId?: string | null; birthDate?: string } = {}) {
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
  const [op, holderId, { user, code }] = await Promise.all([operator(), affiliate(), pendingHolder()]);

  assert.deepEqual(await activate(op, holderId, ` ${code} `), { error: null });

  const account = await user.account();
  assert.equal(account?.status, "active");
  assert.equal(account?.affiliateId, holderId);
  assert.equal(account?.role, "holder");
  const claims = await user.tokenClaims();
  assert.deepEqual([claims.affiliateId, claims.holderId, claims.role], [holderId, holderId, "holder"]);
});

test("activateHolder registra qué operador activó la cuenta y cuándo", async () => {
  const [op, holderId, { user, code }] = await Promise.all([operator(), affiliate(), pendingHolder()]);
  const before = Date.now();

  assert.deepEqual(await activate(op, holderId, code), { error: null });

  const account = await user.account();
  assert.equal(account?.activatedBy, op.uid);
  assert.ok(account?.activatedAt >= before && account?.activatedAt <= Date.now(), `activatedAt: ${account?.activatedAt}`);
});

test("activateHolder devuelve los errores de dominio", async () => {
  const [op, holder, minor, adherent, { code }] = await Promise.all([
    operator(), affiliate(), affiliate(), affiliate(), pendingHolder(),
  ]);
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
  const [op, holderId, adherentId, { code }] = await Promise.all([operator(), affiliate(), affiliate(), pendingHolder()]);
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
  const [opA, opB, holderA, holderB, { user, code }] = await Promise.all([
    operator(), operator(), affiliate(), affiliate(), pendingHolder(),
  ]);

  const results = await Promise.all([activate(opA, holderA, code), activate(opB, holderB, code)]);

  assert.deepEqual(results.map((r) => (r as { error: string | null }).error).sort(), ["INVALID_CODE", null]);
  const linked = (await user.account())?.affiliateId;
  assert.ok(linked === holderA || linked === holderB);
  assert.equal((await user.tokenClaims()).affiliateId, linked);
});
