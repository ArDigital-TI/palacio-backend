// Cloud Functions invocables: la fuente de verdad de las reglas de negocio (ver la spec de firebase-backend).
// Cada una actúa sobre la cuenta de quien la llama: `accounts/{uid}`.

import { initializeApp } from "firebase-admin/app";
import { getFirestore, type Transaction } from "firebase-admin/firestore";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { randomInt } from "node:crypto";

initializeApp();
const db = getFirestore();

// Iguales que en la app: `LINK_TTL_MS` (AccountRules.kt) y el alfabeto de `FakeStore`.
const LINK_TTL_MS = 60_000;
const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TOKEN_LENGTH = 10;

function uidOf(request: CallableRequest): string {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Hace falta iniciar sesión.");
  return uid;
}

function freshLinkToken() {
  const linkToken = Array.from({ length: TOKEN_LENGTH }, () => TOKEN_ALPHABET[randomInt(TOKEN_ALPHABET.length)]).join("");
  return { linkToken, linkTokenExpiresAt: Date.now() + LINK_TTL_MS };
}

/** Código de activación de 4 dígitos que no usa ninguna otra cuenta. */
async function unusedActivationCode(tx: Transaction): Promise<string> {
  for (;;) {
    const code = String(randomInt(1000, 10000));
    const taken = await tx.get(db.collection("accounts").where("activationCode", "==", code).limit(1));
    if (taken.empty) return code;
  }
}

/** Primer ingreso: crea la cuenta pendiente, sin rol, con un código de activación. Si ya existe, no la toca. */
export const registerAccount = onCall(async (request) => {
  const uid = uidOf(request);
  const ref = db.doc(`accounts/${uid}`);
  await db.runTransaction(async (tx) => {
    if ((await tx.get(ref)).exists) return;
    tx.create(ref, {
      email: request.auth?.token.email ?? "",
      status: "pending",
      activationCode: await unusedActivationCode(tx),
    });
  });
});

/** Fija el rol de la cuenta pendiente. El adherente recibe además su token de vinculación. */
export const chooseRole = onCall<{ role?: unknown }>(async (request) => {
  const uid = uidOf(request);
  const role = request.data?.role;
  if (role !== "holder" && role !== "adherent") throw new HttpsError("invalid-argument", "Rol desconocido.");
  const ref = db.doc(`accounts/${uid}`);
  await db.runTransaction(async (tx) => {
    if ((await tx.get(ref)).get("status") !== "pending") return;
    tx.update(ref, role === "adherent" ? { role, ...freshLinkToken() } : { role });
  });
});

/** Renueva el token de vinculación de un adherente pendiente. */
export const refreshLinkToken = onCall(async (request) => {
  const ref = db.doc(`accounts/${uidOf(request)}`);
  await db.runTransaction(async (tx) => {
    const account = await tx.get(ref);
    if (account.get("status") !== "pending" || account.get("role") !== "adherent") return;
    tx.update(ref, freshLinkToken());
  });
});
