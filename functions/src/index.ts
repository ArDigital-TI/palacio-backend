// Cloud Functions invocables: la fuente de verdad de las reglas de negocio (ver la spec de firebase-backend).
// Cada una actúa sobre la cuenta de quien la llama: `accounts/{uid}`.

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
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

/** Los mismos nombres que `DomainError` de la app; se agregan a medida que se portan las reglas. */
type DomainError = "INVALID_CODE" | "IS_DEPENDENT" | "IS_ADHERENT" | "ALREADY_ACTIVE";

/** Respuesta de las Functions con reglas de negocio: éxito (`error: null`) o un error de dominio. */
type Result = { error: DomainError | null };
const ok: Result = { error: null };
const fail = (error: DomainError): Result => ({ error });

function requireOperator(request: CallableRequest) {
  if (request.auth?.token.operator !== true) throw new HttpsError("permission-denied", "Solo para el operador.");
}

/** Edad cumplida hoy; `birthDate` es `YYYY-MM-DD`. Igual que `ageOn` de la app. */
function age(birthDate: string, today = new Date()): number {
  const [year, month, day] = birthDate.split("-").map(Number);
  const beforeBirthday = today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day);
  return today.getFullYear() - year - (beforeBirthday ? 1 : 0);
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

/** Titulares (sin titular propio) que todavía no tienen cuenta activa ni pendiente de aceptar. Solo el operador. */
export const holdersWithoutAccount = onCall(async (request) => {
  requireOperator(request);
  const [holders, linked] = await Promise.all([
    db.collection("affiliates").where("holderId", "==", null).get(),
    db.collection("accounts").where("status", "in", ["active", "awaiting_acceptance"]).get(),
  ]);
  const linkedIds = new Set(linked.docs.map((d) => d.get("affiliateId")));
  return holders.docs.filter((d) => !linkedIds.has(d.id)).map((d) => ({ id: d.id, ...d.data() }));
});

/**
 * El operador activa a un titular con el código de activación de su cuenta pendiente: la cuenta queda activa,
 * vinculada al asociado y con sus claims. Mismas reglas y errores que `activateHolder` de la app.
 */
export const activateHolder = onCall<{ affiliateId?: unknown; code?: unknown }>(async (request) => {
  requireOperator(request);
  const affiliateId = String(request.data?.affiliateId ?? "");
  const code = String(request.data?.code ?? "").trim();
  if (!affiliateId || !code) return fail("INVALID_CODE");

  const activated = await db.runTransaction(async (tx): Promise<Result & { uid?: string }> => {
    const accounts = db.collection("accounts");
    const affiliate = await tx.get(db.doc(`affiliates/${affiliateId}`));
    if (!affiliate.exists) return fail("INVALID_CODE");
    const holderId = affiliate.get("holderId");
    if (holderId != null && age(affiliate.get("birthDate")) < 18) return fail("IS_DEPENDENT");
    if (holderId != null) return fail("IS_ADHERENT");
    const active = await tx.get(accounts.where("affiliateId", "==", affiliateId).where("status", "==", "active").limit(1));
    if (!active.empty) return fail("ALREADY_ACTIVE");
    const pending = await tx.get(
      accounts.where("status", "==", "pending").where("role", "==", "holder").where("activationCode", "==", code).limit(1),
    );
    if (pending.empty) return fail("INVALID_CODE");

    const account = pending.docs[0];
    tx.update(account.ref, { affiliateId, status: "active" });
    return { ...ok, uid: account.id };
  });
  if (activated.error) return fail(activated.error);

  // Los claims van después de confirmar la cuenta, así solo los recibe la cuenta que quedó activa.
  // La app ve el cambio de estado antes y actualiza el token hasta que los claims coinciden.
  // ponytail: si este paso falla, la cuenta queda activa sin claims; reintentar devuelve ALREADY_ACTIVE.
  await getAuth().setCustomUserClaims(activated.uid!, { affiliateId, holderId: affiliateId, role: "holder" });
  return ok;
});
