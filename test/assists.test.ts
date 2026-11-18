// Solicitudes de asistencia: escritura directa desde la app, acotada por las reglas de seguridad.

import assert from "node:assert/strict";
import { test } from "node:test";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { adminDb, assertDenied, family } from "./helpers.ts";

type User = Awaited<ReturnType<typeof family>>["holderUser"];

/** La solicitud tal como la arma `AssistViewModel.send`. */
const request = (user: User, affiliateId: string, changes: object = {}) => ({
  affiliateId, requestedByAccountId: user.uid, address: "San Martín 123 - Portón verde",
  latitude: -26.83, longitude: -65.2, contactName: "Marcelo", contactPhone: "381 555-2143",
  status: "received", createdAt: Date.now(), ...changes,
});
const send = (user: User, data: object) => addDoc(collection(user.db, "assistRequests"), data);
const mine = (user: User, uid = user.uid) =>
  getDocs(query(collection(user.db, "assistRequests"), where("requestedByAccountId", "==", uid)));

test("se crea una solicitud para uno mismo y, el titular, para un miembro a cargo", async () => {
  const f = await family();

  const own = await send(f.holderUser, request(f.holderUser, f.holder));
  await send(f.holderUser, request(f.holderUser, f.dependent));
  await send(f.adherentUser, request(f.adherentUser, f.adherent, { latitude: null, longitude: null }));

  assert.ok(own.id);
  assert.deepEqual((await mine(f.holderUser)).docs.map((d) => d.get("affiliateId")).sort(), [f.holder, f.dependent].sort());
  assert.equal((await mine(f.adherentUser)).size, 1);
});

test("no se crea para alguien ajeno, con otro solicitante, otro estado inicial o campos de más", async () => {
  const [f, other] = await Promise.all([family(), family()]);

  await assertDenied(send(f.holderUser, request(f.holderUser, f.adherent))); // adherente: tiene su propia cuenta
  await assertDenied(send(f.adherentUser, request(f.adherentUser, f.holder)));
  await assertDenied(send(f.adherentUser, request(f.adherentUser, f.dependent))); // solo el titular gestiona al menor
  await assertDenied(send(f.holderUser, request(f.holderUser, other.holder)));
  await assertDenied(send(f.holderUser, request(f.holderUser, other.dependent)));
  await assertDenied(send(f.holderUser, request(f.holderUser, f.holder, { requestedByAccountId: f.adherentUser.uid })));
  await assertDenied(send(f.holderUser, request(f.holderUser, f.holder, { status: "on_the_way" })));
  await assertDenied(send(f.holderUser, request(f.holderUser, f.holder, { priority: "alta" })));
  await assertDenied(send(f.holderUser, request(f.holderUser, f.holder, { address: 123 })));
  await assertDenied(send(f.holderUser, request(f.holderUser, "no-existe")));
  await assertDenied(send(f.holderUser, request(f.holderUser, f.holder, { createdAt: Date.now() - 60 * 60_000 })));
});

test("un miembro a cargo nacido un 29 de febrero sigue a cargo hasta el 1 de marzo de sus 18", async () => {
  const f = await family();
  // 2016 es bisiesto; en 2034 cumple 18 el 1 de marzo. Hoy tiene menos de 18: es miembro a cargo.
  await adminDb.doc(`affiliates/${f.dependent}`).update({ birthDate: "2016-02-29" });

  await send(f.holderUser, request(f.holderUser, f.dependent));
});

test("nadie lee las solicitudes de otro", async () => {
  const [f, other] = await Promise.all([family(), family()]);
  const own = await send(f.holderUser, request(f.holderUser, f.holder));

  assert.ok((await getDoc(doc(f.holderUser.db, "assistRequests", own.id))).exists());
  await assertDenied(getDoc(doc(f.adherentUser.db, "assistRequests", own.id)));
  await assertDenied(getDoc(doc(other.holderUser.db, "assistRequests", own.id)));
  await assertDenied(mine(other.holderUser, f.holderUser.uid));
  await assertDenied(getDocs(query(collection(f.adherentUser.db, "assistRequests"), where("affiliateId", "==", f.holder))));
});

test("la app no modifica ni borra una solicitud enviada", async () => {
  const f = await family();
  const own = await send(f.holderUser, request(f.holderUser, f.holder));

  await assertDenied(updateDoc(own, { status: "on_the_way" }));
  await assertDenied(deleteDoc(own));
});
