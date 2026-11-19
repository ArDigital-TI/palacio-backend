// Búsqueda en el padrón y ficha del asociado, para la consola del operador: `searchAffiliates` y `affiliateRecord`.

import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import { test } from "node:test";
import { adminDb, newUser, yearsAgo } from "./helpers.ts";

/** Letras al azar: apellidos y DNI propios de cada test, para no chocar con otros. */
const letters = () => Array.from({ length: 8 }, () => "abcdefghijklmnopqrstuvwxyz"[randomInt(26)]).join("");
const dni = () => String(randomInt(10_000_000, 100_000_000));

/** Un asociado nuevo. `lastNameKey` lo escribe quien carga el padrón: el apellido en minúsculas y sin acentos. */
async function affiliate(fields: { lastName: string; lastNameKey: string; dni?: string; holderId?: string | null; age?: number }) {
  const id = `s-${letters()}`;
  const { age = 40, ...rest } = fields;
  await adminDb.doc(`affiliates/${id}`).set({
    firstName: "Prueba", dni: dni(), number: `FP-${id}`, plan: "family", birthDate: yearsAgo(age),
    holderId: null, phone: "381 555-0000", email: "prueba@correo.com", ...rest,
  });
  return id;
}

const operator = () => newUser({ operator: true });
type Hit = { id: string; firstName: string; lastName: string; dni: string; number: string; isHolder: boolean };
const search = async (op: Awaited<ReturnType<typeof operator>>, query: string) =>
  (await op.call("searchAffiliates", { query })).data as Hit[];

test("searchAffiliates encuentra por DNI exacto, aunque lleve puntos", async () => {
  const op = await operator();
  const tag = letters();
  const holderDni = dni();
  const holder = await affiliate({ lastName: `Gómez${tag}`, lastNameKey: `gomez${tag}`, dni: holderDni });

  const dotted = holderDni.replace(/(\d{2})(\d{3})(\d{3})/, "$1.$2.$3");
  for (const query of [holderDni, dotted]) {
    assert.deepEqual(await search(op, query), [
      { id: holder, firstName: "Prueba", lastName: `Gómez${tag}`, dni: holderDni, number: `FP-${holder}`, isHolder: true },
    ]);
  }
  assert.deepEqual(await search(op, holderDni.slice(0, 7)), []);
});

test("searchAffiliates encuentra por el principio del apellido, sin mayúsculas ni acentos", async () => {
  const op = await operator();
  const tag = letters();
  const holder = await affiliate({ lastName: `Núñez${tag}`, lastNameKey: `nunez${tag}` });
  const member = await affiliate({ lastName: `Núñez${tag}`, lastNameKey: `nunez${tag}`, holderId: holder, age: 20 });
  const other = await affiliate({ lastName: `Nuñe${tag}`, lastNameKey: `nune${tag}` });

  const hits = await search(op, `  NÚÑEZ${tag.slice(0, 4).toUpperCase()}`);
  assert.deepEqual(hits.map((h) => [h.id, h.isHolder]).sort(), [[holder, true], [member, false]].sort());
  assert.ok(!(await search(op, `nunez${tag}x`)).length);
  assert.deepEqual((await search(op, `nune${tag}`)).map((h) => h.id), [other]);
});

const record = async (op: Awaited<ReturnType<typeof operator>>, affiliateId: string) =>
  (await op.call("affiliateRecord", { affiliateId })).data;

test("affiliateRecord devuelve al titular y su grupo familiar, cada uno con su estado", async () => {
  const op = await operator();
  const tag = letters();
  const name = { lastName: `Ríos${tag}`, lastNameKey: `rios${tag}` };
  const holder = await affiliate(name);
  const active = await affiliate({ ...name, holderId: holder, age: 30 });
  const awaiting = await affiliate({ ...name, holderId: holder, age: 25 });
  const noAccount = await affiliate({ ...name, holderId: holder, age: 19 });
  const dependent = await affiliate({ ...name, holderId: holder, age: 10 });
  const account = (affiliateId: string, status: string) =>
    adminDb.collection("accounts").add({ affiliateId, status, role: "adherent", email: "", activationCode: "0000", validatedBy: holder });
  await Promise.all([account(active, "active"), account(awaiting, "awaiting_acceptance")]);
  const dnis = Object.fromEntries(
    await Promise.all([holder, active, awaiting, noAccount, dependent].map(async (id) => [id, (await adminDb.doc(`affiliates/${id}`).get()).get("dni")])),
  );
  const member = (id: string, age: number, status: string) =>
    ({ id, firstName: "Prueba", lastName: `Ríos${tag}`, dni: dnis[id], age, status });

  const expected = {
    holder: { ...member(holder, 40, "no_account"), number: `FP-${holder}`, plan: "family" },
    members: [member(active, 30, "active"), member(awaiting, 25, "awaiting_acceptance"), member(noAccount, 19, "no_account"), member(dependent, 10, "dependent")],
  };
  assert.deepEqual(await record(op, holder), expected);
  assert.deepEqual(await record(op, dependent), expected);

  await account(holder, "active");
  assert.equal(((await record(op, active)) as typeof expected).holder.status, "active");
});

test("affiliateRecord de un asociado que no existe da not-found", async () => {
  const op = await operator();
  await assert.rejects(record(op, "no-existe"), { code: "functions/not-found" });
});

test("sin el claim de operador, la búsqueda y la ficha se rechazan", async () => {
  const user = await newUser();
  await assert.rejects(user.call("searchAffiliates", { query: "perez" }), { code: "functions/permission-denied" });
  await assert.rejects(user.call("affiliateRecord", { affiliateId: "a1" }), { code: "functions/permission-denied" });
});

test("searchAffiliates con menos de dos letras no busca", async () => {
  const op = await operator();
  assert.deepEqual(await search(op, "a"), []);
  assert.deepEqual(await search(op, "  "), []);
});
