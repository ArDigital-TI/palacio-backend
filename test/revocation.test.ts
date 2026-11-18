// Revocación de un adherente: el titular le saca el acceso y el adherente deja de leer en ese momento.
// Casos portados de `revokeAdherent` en `AccountRulesTest` y `FakeRepositoriesTest`.

import assert from "node:assert/strict";
import { test } from "node:test";
import { doc, getDoc } from "firebase/firestore";
import { adminAuth, assertDenied, family } from "./helpers.ts";

test("revocar a un adherente propio: la cuenta vuelve a pendiente y el adherente deja de leer en el momento", async () => {
  const f = await family();
  assert.ok((await getDoc(doc(f.adherentUser.db, "affiliates", f.adherent))).exists());

  assert.deepEqual((await f.holderUser.call("revoke", { memberId: f.adherent })).data, { error: null });

  const revoked = await f.adherentUser.account();
  assert.equal(revoked?.status, "pending");
  assert.equal(revoked?.affiliateId, null);
  assert.equal(revoked?.validatedBy, null);
  assert.deepEqual([revoked?.revokedBy, revoked?.revokedByName], [f.holder, "Prueba Familia"]);
  assert.ok(revoked?.revokedAt <= Date.now());
  assert.match(revoked?.linkToken, /^[A-Z2-9]{10}$/);
  // Sin claims y con los tokens revocados. El emulador de Auth igual deja actualizar el token (producción no: el SDK
  // cierra la sesión); con el token actualizado ya no lee lo que leía.
  assert.deepEqual((await adminAuth.getUser(f.adherentUser.uid)).customClaims ?? {}, {});
  assert.equal((await f.adherentUser.tokenClaims()).affiliateId, undefined);
  await assertDenied(getDoc(doc(f.adherentUser.db, "affiliates", f.adherent)));
});

test("nadie revoca a alguien de otra familia, ni a un miembro sin cuenta vinculada", async () => {
  const [f, other] = await Promise.all([family(), family()]);

  assert.deepEqual((await other.holderUser.call("revoke", { memberId: f.adherent })).data, { error: "CANNOT_REVOKE" });
  assert.deepEqual((await f.adherentUser.call("revoke", { memberId: f.adherent })).data, { error: "CANNOT_REVOKE" });
  assert.deepEqual((await f.holderUser.call("revoke", { memberId: f.dependent })).data, { error: "CANNOT_REVOKE" });
  assert.deepEqual((await f.holderUser.call("revoke", { memberId: "no-existe" })).data, { error: "CANNOT_REVOKE" });
  assert.equal((await f.adherentUser.account())?.status, "active");
});

test("revocar dos veces da CANNOT_REVOKE la segunda", async () => {
  const f = await family();
  await f.holderUser.call("revoke", { memberId: f.adherent });
  assert.deepEqual((await f.holderUser.call("revoke", { memberId: f.adherent })).data, { error: "CANNOT_REVOKE" });
});

