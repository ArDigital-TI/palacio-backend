// Alta de titulares de prueba desde la consola del operador: `createHolder`. Temporal, hasta tener el padrón real.

import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import { test } from "node:test";
import { adminDb, newUser, yearsAgo } from "./helpers.ts";

const operator = () => newUser({ operator: true });
const dni = () => String(randomInt(10_000_000, 100_000_000));
/** Letras al azar: un apellido propio de cada test. */
const randomTag = () => Array.from({ length: 8 }, () => "abcdefghijklmnopqrstuvwxyz"[randomInt(26)]).join("");

const holderData = (fields: object = {}) => ({
  firstName: "Inés", lastName: `Sánchez${randomTag()}`, dni: dni(), birthDate: yearsAgo(40), plan: "family", ...fields,
});

test("createHolder da de alta un titular sin cuenta, que aparece en la lista y en la búsqueda", async () => {
  const op = await operator();
  const data = holderData();
  const before = Date.now();

  const { id } = (await op.call("createHolder", data)).data as { id: string };

  const listed = (await op.call("holdersWithoutAccount")).data as { id: string }[];
  assert.ok(listed.some((h) => h.id === id));
  const hits = (await op.call("searchAffiliates", { query: data.lastName.toLowerCase().replace("á", "a") })).data as { id: string }[];
  assert.deepEqual(hits.map((h) => h.id), [id]);

  const stored = (await adminDb.doc(`affiliates/${id}`).get()).data();
  assert.deepEqual(
    { ...stored, createdAt: undefined },
    {
      firstName: "Inés", lastName: data.lastName, lastNameKey: data.lastName.toLowerCase().replace("á", "a"), dni: data.dni,
      number: `FP-PRUEBA-${data.dni}`, plan: "family", birthDate: data.birthDate, holderId: null, phone: "", email: "",
      createdBy: op.uid, createdAt: undefined,
    },
  );
  assert.ok(stored?.createdAt >= before && stored?.createdAt <= Date.now());
});

test("createHolder con un DNI que ya está en el padrón responde already-exists", async () => {
  const op = await operator();
  const data = holderData();
  await op.call("createHolder", data);

  await assert.rejects(op.call("createHolder", holderData({ dni: data.dni })), { code: "functions/already-exists" });
  const sameDni = await adminDb.collection("affiliates").where("dni", "==", data.dni).get();
  assert.equal(sameDni.size, 1);
});

test("createHolder rechaza datos inválidos", async () => {
  const op = await operator();
  for (const fields of [
    { firstName: " " }, { lastName: "" }, { dni: "123456" }, { dni: "12.345.678" }, { birthDate: "1980-13-01" }, { birthDate: "1980-02-31" },
    { birthDate: "ayer" }, { birthDate: yearsAgo(17) }, { plan: "gold" },
  ]) {
    await assert.rejects(op.call("createHolder", holderData(fields)), { code: "functions/invalid-argument" }, JSON.stringify(fields));
  }
});

test("sin el claim de operador, createHolder se rechaza", async () => {
  const user = await newUser();
  await assert.rejects(user.call("createHolder", holderData()), { code: "functions/permission-denied" });
});
