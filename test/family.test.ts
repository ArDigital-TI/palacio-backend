// Reglas de seguridad de la familia, el perfil y el catálogo: cada cuenta lee solo lo que le corresponde
// según sus claims, y solo edita el contacto de su propio asociado.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { adminDb, assertDenied, newUser } from "./helpers.ts";

const yearsAgo = (years: number) => `${new Date().getFullYear() - years}-01-01`;

/** Una familia nueva: titular, adherente con cuenta activa y miembro a cargo. Ids propios por test. */
async function family() {
  const id = (name: string) => `${name}-${randomUUID()}`;
  const holder = id("h"), adherent = id("m"), dependent = id("d");
  const affiliate = (holderId: string | null, age: number) => ({
    firstName: "Prueba", lastName: "Familia", dni: "1", number: "FP-0", plan: "family",
    birthDate: yearsAgo(age), holderId, phone: "381 555-0000", email: "prueba@correo.com",
  });
  await Promise.all([
    adminDb.doc(`affiliates/${holder}`).set(affiliate(null, 50)),
    adminDb.doc(`affiliates/${adherent}`).set(affiliate(holder, 20)),
    adminDb.doc(`affiliates/${dependent}`).set(affiliate(holder, 10)),
  ]);
  const [holderUser, adherentUser] = await Promise.all([
    newUser({ affiliateId: holder, holderId: holder, role: "holder" }),
    newUser({ affiliateId: adherent, holderId: holder, role: "adherent" }),
  ]);
  await adminDb.doc(`accounts/${adherentUser.uid}`).set({
    email: adherentUser.email, status: "active", role: "adherent", affiliateId: adherent, activationCode: "1111", validatedBy: holder,
  });
  return { holder, adherent, dependent, holderUser, adherentUser };
}

type User = Awaited<ReturnType<typeof newUser>>;
const readAffiliate = (user: User, id: string) => getDoc(doc(user.db, "affiliates", id));
const readMembers = (user: User, holderId: string) =>
  getDocs(query(collection(user.db, "affiliates"), where("holderId", "==", holderId)));
const readFamilyAccounts = (user: User, holderId: string) =>
  getDocs(query(collection(user.db, "accounts"), where("validatedBy", "==", holderId)));

test("el titular lee su familia y las cuentas de su familia", async () => {
  const f = await family();

  assert.ok((await readAffiliate(f.holderUser, f.holder)).exists());
  const members = (await readMembers(f.holderUser, f.holder)).docs.map((d) => d.id).sort();
  assert.deepEqual(members, [f.adherent, f.dependent].sort());
  const accounts = (await readFamilyAccounts(f.holderUser, f.holder)).docs.map((d) => d.get("affiliateId"));
  assert.deepEqual(accounts, [f.adherent]);
});

test("un titular no lee otra familia", async () => {
  const [mine, other] = await Promise.all([family(), family()]);

  await assertDenied(readAffiliate(mine.holderUser, other.holder));
  await assertDenied(readAffiliate(mine.holderUser, other.adherent));
  await assertDenied(readMembers(mine.holderUser, other.holder));
  await assertDenied(readFamilyAccounts(mine.holderUser, other.holder));
});

test("un adherente lee solo su propio asociado", async () => {
  const f = await family();

  assert.ok((await readAffiliate(f.adherentUser, f.adherent)).exists());
  await assertDenied(readAffiliate(f.adherentUser, f.holder));
  await assertDenied(readAffiliate(f.adherentUser, f.dependent));
  await assertDenied(readMembers(f.adherentUser, f.holder));
  await assertDenied(readFamilyAccounts(f.adherentUser, f.holder));
});

test("una cuenta sin asociado (pendiente) no lee asociados", async () => {
  const f = await family();
  const pending = await newUser();

  await assertDenied(readAffiliate(pending, f.holder));
});

test("cada uno edita solo el contacto de su propio asociado", async () => {
  const f = await family();
  const contact = { phone: "381 555-1234", email: "nuevo@correo.com" };

  await updateDoc(doc(f.holderUser.db, "affiliates", f.holder), contact);
  assert.equal((await adminDb.doc(`affiliates/${f.holder}`).get()).get("phone"), contact.phone);
  await updateDoc(doc(f.adherentUser.db, "affiliates", f.adherent), contact);

  await assertDenied(updateDoc(doc(f.holderUser.db, "affiliates", f.adherent), contact));
  await assertDenied(updateDoc(doc(f.holderUser.db, "affiliates", f.dependent), contact));
  await assertDenied(updateDoc(doc(f.adherentUser.db, "affiliates", f.holder), contact));
  // Solo el contacto: el resto de los datos se modifican en la sede.
  await assertDenied(updateDoc(doc(f.holderUser.db, "affiliates", f.holder), { dni: "2" }));
  await assertDenied(updateDoc(doc(f.holderUser.db, "affiliates", f.holder), { phone: 381 }));
});

test("el catálogo y la configuración los lee cualquier cuenta con sesión", async () => {
  await Promise.all([
    adminDb.doc("professionals/p-test").set({ name: "Dra. Prueba", specialty: "Clínica médica", telemedicine: true }),
    adminDb.doc("config/app").set({ telemedicineLine: "0800", dispatchLine: "0800" }),
  ]);
  const pending = await newUser();

  for (const name of ["professionals", "studies", "sites"]) await getDocs(collection(pending.db, name));
  assert.ok((await getDoc(doc(pending.db, "config", "app"))).exists());
});
