// Turnos: franjas, reserva en transacción, cancelación y lectura. Casos portados de `ScheduleRulesTest` y de los
// turnos de `FakeRepositoriesTest`.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { collection, doc, getDocs, query, setDoc, where } from "firebase/firestore";
import { adminAuth, adminDb, assertDenied, family } from "./helpers.ts";

type Slot = { time: string; at: number; free: boolean };
type Family = Awaited<ReturnType<typeof family>>;
type User = Family["holderUser"];

/** Un lunes lejano: todas las franjas están en el futuro. */
const MONDAY = "2030-01-07";

/** Un profesional y un estudio de laboratorio nuevos, para que las reservas de un test no ocupen las de otro. */
async function resources() {
  const professional = `p-${randomUUID()}`, study = `e-${randomUUID()}`;
  await Promise.all([
    adminDb.doc(`professionals/${professional}`).set({ name: "Dra. Prueba", specialty: "Clínica médica", telemedicine: true }),
    adminDb.doc(`studies/${study}`).set({ kind: "lab", name: "Hemograma", siteIds: ["central"], preparation: "", equipment: "", group: "test", detail: "" }),
  ]);
  return { professional, study };
}

const slots = async (user: User, kind: string, resourceId: string, siteId = "", date = MONDAY) =>
  (await user.call("availableSlots", { kind, resourceId, siteId, date })).data as Slot[];
const freeSlots = async (user: User, resourceId: string) => (await slots(user, "medical", resourceId)).filter((s) => s.free);
const book = async (user: User, fields: object) => (await user.call("book", { kind: "medical", mode: "in_person", ...fields })).data;
const errorOf = (result: unknown) => (result as { error: string | null }).error;

test("availableSlots: franjas de 20 minutos y el patrón fijo de la app", async () => {
  const f = await family();

  const medical = await slots(f.holderUser, "medical", "p1");
  assert.equal(medical.length, 15);
  assert.deepEqual([medical[0].time, medical[14].time], ["08:00", "12:40"]);
  assert.equal(medical[1].at - medical[0].at, 20 * 60_000);
  assert.equal(new Date(medical[0].at).toISOString(), "2030-01-07T11:00:00.000Z"); // 08:00 en Argentina
  // Calculado con el mismo FNV-1a que `fnv1a` de la app: las dos implementaciones ocupan las mismas franjas.
  assert.deepEqual(medical.filter((s) => !s.free).map((s) => s.time), ["09:20", "10:00", "10:40", "12:20"]);

  const lab = await slots(f.holderUser, "lab", "e1", "central");
  assert.deepEqual(lab.map((s) => s.time), ["07:00", "07:20", "07:40", "08:00", "08:20", "08:40", "09:00", "09:20", "09:40"]);
  assert.deepEqual(lab.filter((s) => !s.free).map((s) => s.time), ["07:20", "09:00", "09:40"]);

  assert.ok((await slots(f.holderUser, "medical", "p1", "", "2020-01-06")).every((s) => !s.free));
});

test("book respeta el id de la app y ocupa la franja; la segunda reserva recibe SLOT_TAKEN", async () => {
  const [f, r] = await Promise.all([family(), resources()]);
  const [slot] = await freeSlots(f.holderUser, r.professional);
  const id = randomUUID();

  assert.deepEqual(await book(f.holderUser, { id, affiliateId: f.holder, resourceId: r.professional, at: slot.at }), { error: null });

  const saved = (await adminDb.doc(`appointments/${id}`).get()).data();
  assert.equal(saved?.status, "confirmed");
  assert.equal(saved?.bookedByAccountId, f.holderUser.uid);
  assert.equal((await slots(f.holderUser, "medical", r.professional)).find((s) => s.at === slot.at)?.free, false);
  const second = await book(f.adherentUser, { id: randomUUID(), affiliateId: f.adherent, resourceId: r.professional, at: slot.at });
  assert.equal(errorOf(second), "SLOT_TAKEN");
});

test("dos reservas simultáneas del mismo horario: solo una lo consigue", async () => {
  const [f, r] = await Promise.all([family(), resources()]);
  const [slot] = await freeSlots(f.holderUser, r.professional);

  const results = await Promise.all([
    book(f.holderUser, { id: randomUUID(), affiliateId: f.holder, resourceId: r.professional, at: slot.at }),
    book(f.adherentUser, { id: randomUUID(), affiliateId: f.adherent, resourceId: r.professional, at: slot.at }),
  ]);

  assert.deepEqual(results.map(errorOf).sort(), ["SLOT_TAKEN", null]);
  const booked = await adminDb.collection("appointments").where("resourceId", "==", r.professional).get();
  assert.equal(booked.size, 1);
});

test("book solo para uno mismo o un miembro a cargo; el estudio, en una de sus sedes", async () => {
  const [f, r] = await Promise.all([family(), resources()]);
  const [slot] = await freeSlots(f.holderUser, r.professional);
  const lab = (await slots(f.holderUser, "lab", r.study, "central")).find((s) => s.free)!;

  assert.equal(errorOf(await book(f.holderUser, { affiliateId: f.dependent, resourceId: r.professional, at: slot.at })), null);
  assert.equal(errorOf(await book(f.holderUser, { kind: "lab", affiliateId: f.holder, resourceId: r.study, siteId: "central", at: lab.at })), null);

  const denied = { code: "functions/permission-denied" };
  await assert.rejects(book(f.holderUser, { affiliateId: f.adherent, resourceId: r.professional, at: slot.at }), denied);
  await assert.rejects(book(f.adherentUser, { affiliateId: f.holder, resourceId: r.professional, at: slot.at }), denied);
  await assert.rejects(
    book(f.holderUser, { kind: "lab", affiliateId: f.holder, resourceId: r.study, siteId: "norte", at: lab.at }),
    { code: "functions/invalid-argument" },
  );
});

test("cancel: el propio o el de un miembro a cargo, y nada más; la franja vuelve a quedar libre", async () => {
  const [f, other, r] = await Promise.all([family(), family(), resources()]);
  const [first, second] = await freeSlots(f.holderUser, r.professional);
  const own = randomUUID(), dependents = randomUUID();
  await book(f.holderUser, { id: own, affiliateId: f.holder, resourceId: r.professional, at: first.at });
  await book(f.holderUser, { id: dependents, affiliateId: f.dependent, resourceId: r.professional, at: second.at });

  const denied = { code: "functions/permission-denied" };
  await assert.rejects(other.holderUser.call("cancel", { appointmentId: own }), denied);
  await assert.rejects(f.adherentUser.call("cancel", { appointmentId: dependents }), denied);
  assert.equal((await adminDb.doc(`appointments/${own}`).get()).get("status"), "confirmed");

  await f.holderUser.call("cancel", { appointmentId: own });
  await f.holderUser.call("cancel", { appointmentId: dependents });
  assert.equal((await adminDb.doc(`appointments/${own}`).get()).get("status"), "cancelled");
  assert.equal((await adminDb.doc(`appointments/${dependents}`).get()).get("status"), "cancelled");
  assert.equal((await slots(f.holderUser, "medical", r.professional)).find((s) => s.at === first.at)?.free, true);
  // Uno ya cancelado (o realizado) no se vuelve a cancelar.
  await assert.rejects(f.holderUser.call("cancel", { appointmentId: own }), { code: "functions/failed-precondition" });
});

test("cada uno lee los turnos que reservó: el titular, los suyos y los de sus miembros a cargo", async () => {
  const [f, r] = await Promise.all([family(), resources()]);
  const [a, b, c] = await freeSlots(f.holderUser, r.professional);
  await book(f.holderUser, { affiliateId: f.holder, resourceId: r.professional, at: a.at });
  await book(f.holderUser, { affiliateId: f.dependent, resourceId: r.professional, at: b.at });
  await book(f.adherentUser, { affiliateId: f.adherent, resourceId: r.professional, at: c.at });
  const bookedBy = (user: User) => query(collection(user.db, "appointments"), where("bookedByAccountId", "==", user.uid));

  const holders = (await getDocs(bookedBy(f.holderUser))).docs.map((d) => d.get("affiliateId")).sort();
  assert.deepEqual(holders, [f.holder, f.dependent].sort());
  assert.deepEqual((await getDocs(bookedBy(f.adherentUser))).docs.map((d) => d.get("affiliateId")), [f.adherent]);

  // Nadie lee turnos ajenos: ni el titular los del adherente, ni el adherente los de la familia.
  const byAffiliate = (user: User, id: string) => query(collection(user.db, "appointments"), where("affiliateId", "==", id));
  await assertDenied(getDocs(byAffiliate(f.holderUser, f.adherent)));
  await assertDenied(getDocs(byAffiliate(f.adherentUser, f.holder)));
  await assertDenied(getDocs(query(collection(f.adherentUser.db, "appointments"), where("resourceId", "==", r.professional))));
});

test("una cuenta sin claims (pendiente o revocada) no lee ni sus propios turnos", async () => {
  const [f, r] = await Promise.all([family(), resources()]);
  const [slot] = await freeSlots(f.adherentUser, r.professional);
  await book(f.adherentUser, { affiliateId: f.adherent, resourceId: r.professional, at: slot.at });

  await adminAuth.setCustomUserClaims(f.adherentUser.uid, null);
  await f.adherentUser.tokenClaims(); // token nuevo, sin claims

  await assertDenied(getDocs(query(collection(f.adherentUser.db, "appointments"), where("bookedByAccountId", "==", f.adherentUser.uid))));
});

test("el cliente no puede escribir appointments", async () => {
  const f = await family();

  await assertDenied(setDoc(doc(f.holderUser.db, "appointments", randomUUID()), {
    affiliateId: f.holder, bookedByAccountId: f.holderUser.uid, status: "confirmed", at: 0,
  }));
});
