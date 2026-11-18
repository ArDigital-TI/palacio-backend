// Cloud Functions invocables: la fuente de verdad de las reglas de negocio (ver la spec de firebase-backend).
// Cada una actúa sobre la cuenta de quien la llama: `accounts/{uid}`.

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Query, type QuerySnapshot, type Transaction } from "firebase-admin/firestore";
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
type DomainError =
  | "INVALID_CODE" | "IS_DEPENDENT" | "IS_ADHERENT" | "ALREADY_ACTIVE" | "SLOT_TAKEN"
  | "NOT_IN_FAMILY" | "UNDER_18" | "ALREADY_LINKED" | "LINK_EXPIRED" | "CANNOT_REVOKE";

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

// --- Turnos ---

// ponytail: zona horaria fija de las sedes (Argentina, UTC-3, sin horario de verano). Si hay sedes en otra zona,
// pasa a ser un dato de la sede.
const ZONE_OFFSET_MS = -3 * 60 * 60_000;
const SLOT_MINUTES = 20;

/** FNV-1a de 32 bits sin signo, igual que `fnv1a` de la app (simula la agenda ya tomada). */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

type Slot = { time: string; at: number; free: boolean };

/**
 * Franjas de 20 minutos del día, como `slotsFor` de la app: laboratorio de 07:00 a 09:40, el resto de 08:00 a 12:40.
 * No está libre una franja pasada, una del patrón fijo ni una de `takenAts` (turnos confirmados del recurso y sede).
 */
function slotsFor(kind: string, resourceId: string, siteId: string, date: string, takenAts: Set<number>): Slot[] {
  const [from, to] = kind === "lab" ? [7 * 60, 9 * 60 + 40] : [8 * 60, 12 * 60 + 40];
  const midnight = midnightOf(date);
  const slots: Slot[] = [];
  for (let min = from; min <= to; min += SLOT_MINUTES) {
    const time = `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
    const at = midnight + min * 60_000;
    const taken = fnv1a(`${resourceId}${siteId}${date}T${time}`) % 4 === 0 || takenAts.has(at);
    slots.push({ time, at, free: at > Date.now() && !taken });
  }
  return slots;
}

/** Las 00:00 de la fecha `YYYY-MM-DD` en la zona de las sedes, en milisegundos epoch. */
function midnightOf(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day) - ZONE_OFFSET_MS;
}

/** La fecha `YYYY-MM-DD` de un instante, en la zona de las sedes. */
const dateOf = (at: number) => new Date(at + ZONE_OFFSET_MS).toISOString().slice(0, 10);

/** Turnos confirmados del recurso y sede ese día (la sede vacía es la de los turnos médicos, sin sede). */
async function takenAts(read: (q: Query) => Promise<QuerySnapshot>, resourceId: string, siteId: string, date: string) {
  const from = midnightOf(date);
  const booked = await read(
    db.collection("appointments").where("resourceId", "==", resourceId).where("status", "==", "confirmed")
      .where("at", ">=", from).where("at", "<", from + 24 * 60 * 60_000),
  );
  return new Set(booked.docs.filter((d) => (d.get("siteId") ?? "") === siteId).map((d) => d.get("at") as number));
}

/**
 * Lanza `permission-denied` si quien llama no gestiona al asociado: él mismo o, si es titular, un miembro a cargo.
 * Mismo criterio que `managedIds` de la app.
 */
async function assertManages(request: CallableRequest, affiliateId: string) {
  const me = request.auth?.token.affiliateId;
  if (!me) throw new HttpsError("permission-denied", "La cuenta no está activa.");
  if (affiliateId === me) return;
  const member = await db.doc(`affiliates/${affiliateId}`).get();
  const isDependent = member.exists && member.get("holderId") === me && age(member.get("birthDate")) < 18;
  if (request.auth?.token.role !== "holder" || !isDependent) throw new HttpsError("permission-denied", "No gestiona a ese asociado.");
}

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const text = (v: unknown) => (typeof v === "string" ? v : "");

/** Horarios de un recurso, sede y día: solo la hora y si está libre, sin datos de los turnos ajenos. */
export const availableSlots = onCall<{ kind?: unknown; resourceId?: unknown; siteId?: unknown; date?: unknown }>(async (request) => {
  if (!request.auth?.token.affiliateId) throw new HttpsError("permission-denied", "La cuenta no está activa.");
  const { kind, resourceId, siteId, date } = request.data ?? {};
  if (!isDate(date) || !text(resourceId)) throw new HttpsError("invalid-argument", "Faltan el recurso o la fecha.");
  const taken = await takenAts((q) => q.get(), text(resourceId), text(siteId), date);
  return slotsFor(text(kind), text(resourceId), text(siteId), date, taken);
});

/** Dónde está el recurso de cada tipo de turno; los tipos son los de `AppointmentKind` de la app. */
const RESOURCE_COLLECTION: Record<string, string> = { medical: "professionals", lab: "studies", imaging: "studies" };

type BookRequest = {
  id?: unknown; affiliateId?: unknown; kind?: unknown; mode?: unknown;
  resourceId?: unknown; siteId?: unknown; at?: unknown; contactPhone?: unknown;
};

/**
 * Reserva un turno confirmado para quien llama o un miembro a cargo. Verifica la franja y escribe en la misma
 * transacción: de dos reservas del mismo horario, una devuelve `SLOT_TAKEN`. Respeta el id que manda la app.
 */
export const book = onCall<BookRequest>(async (request): Promise<Result> => {
  const d = request.data ?? {};
  const affiliateId = text(d.affiliateId), kind = text(d.kind), resourceId = text(d.resourceId);
  const siteId = kind === "medical" ? "" : text(d.siteId);
  const mode = text(d.mode) || "in_person";
  const at = typeof d.at === "number" ? d.at : NaN;
  if (!RESOURCE_COLLECTION[kind] || !["in_person", "telemedicine"].includes(mode) || !resourceId || !Number.isFinite(at)) {
    throw new HttpsError("invalid-argument", "Turno incompleto.");
  }
  await assertManages(request, affiliateId);
  const resource = await db.doc(`${RESOURCE_COLLECTION[kind]}/${resourceId}`).get();
  if (!resource.exists || (kind !== "medical" && !(resource.get("siteIds") ?? []).includes(siteId))) {
    throw new HttpsError("invalid-argument", "El profesional o el estudio no existe en esa sede.");
  }

  const ref = d.id ? db.doc(`appointments/${text(d.id)}`) : db.collection("appointments").doc();
  return db.runTransaction(async (tx) => {
    const date = dateOf(at);
    const taken = await takenAts((q) => tx.get(q), resourceId, siteId, date);
    const slot = slotsFor(kind, resourceId, siteId, date, taken).find((s) => s.at === at);
    if (!slot?.free) return fail("SLOT_TAKEN");
    if ((await tx.get(ref)).exists) throw new HttpsError("already-exists", "Ya existe un turno con ese id.");
    tx.create(ref, {
      affiliateId, bookedByAccountId: request.auth!.uid, kind, mode, resourceId, siteId: siteId || null, at,
      status: "confirmed", contactPhone: mode === "telemedicine" ? text(d.contactPhone) : null,
    });
    return ok;
  });
});

/** Cancela un turno confirmado propio o de un miembro a cargo, y nada más. */
export const cancel = onCall<{ appointmentId?: unknown }>(async (request) => {
  const id = text(request.data?.appointmentId);
  const appointment = id ? await db.doc(`appointments/${id}`).get() : undefined;
  if (!appointment?.exists) throw new HttpsError("not-found", "El turno no existe.");
  await assertManages(request, appointment.get("affiliateId"));
  if (appointment.get("status") !== "confirmed") throw new HttpsError("failed-precondition", "El turno no está confirmado.");
  await appointment.ref.update({ status: "cancelled" });
});

// --- Vinculación de adherentes ---

/** El token de un enlace (`https://palacio.app/v/<token>`) o el token suelto, como `findByLinkToken` de la app. */
const tokenOf = (tokenOrLink: unknown) => text(tokenOrLink).trim().split("/").pop() ?? "";

/** La cuenta pendiente de adherente detrás del token si sigue vigente. */
async function findByLinkToken(read: (q: Query) => Promise<QuerySnapshot>, tokenOrLink: unknown) {
  const token = tokenOf(tokenOrLink);
  if (!token) return undefined;
  const found = await read(db.collection("accounts").where("linkToken", "==", token).limit(1));
  return found.docs.find((d) =>
    d.get("status") === "pending" && d.get("role") === "adherent" && (d.get("linkTokenExpiresAt") ?? 0) > Date.now());
}

function requireHolder(request: CallableRequest): string {
  const me = request.auth?.token.affiliateId;
  if (request.auth?.token.role !== "holder" || !me) throw new HttpsError("permission-denied", "Solo para el titular.");
  return me;
}

/** La cuenta vinculada al asociado (activa o esperando la aceptación), como `isLinked` de la app. */
const linkedAccountOf = (tx: Transaction, memberId: string) =>
  tx.get(db.collection("accounts").where("affiliateId", "==", memberId).where("status", "in", ["active", "awaiting_acceptance"]).limit(1));

/** La cuenta vuelve a pendiente, sin asociado y con un token nuevo: lo que tienen en común rechazar y revocar. */
const unlinked = () => ({
  affiliateId: null, status: "pending", validatedBy: null,
  validatedByName: null, affiliateName: null, affiliateDni: null, ...freshLinkToken(),
});

const fullName = (affiliate: { get(field: string): unknown }) => `${affiliate.get("firstName")} ${affiliate.get("lastName")}`;

/** El titular ve el correo de la cuenta pendiente detrás de un token o enlace vigente, antes de validarla. */
export const previewLink = onCall<{ tokenOrLink?: unknown }>(async (request) => {
  requireHolder(request);
  const account = await findByLinkToken((q) => q.get(), request.data?.tokenOrLink);
  return account ? { accountId: account.id, email: account.get("email") ?? "" } : null;
});

/**
 * El titular valida a un adherente de su familia con el token de vinculación: la cuenta pasa a esperar la aceptación.
 * Mismas reglas y errores que `validateAdherent` de la app. Copia en la cuenta los datos que muestra la pantalla de
 * aceptación, porque la cuenta todavía no tiene claims para leer asociados.
 */
export const validateAdherent = onCall<{ memberId?: unknown; tokenOrLink?: unknown }>(async (request): Promise<Result> => {
  const holderId = requireHolder(request);
  const memberId = text(request.data?.memberId);
  if (!memberId) return fail("NOT_IN_FAMILY");
  return db.runTransaction(async (tx) => {
    const [member, holder] = await Promise.all([tx.get(db.doc(`affiliates/${memberId}`)), tx.get(db.doc(`affiliates/${holderId}`))]);
    if (!member.exists || member.get("holderId") !== holderId) return fail("NOT_IN_FAMILY");
    if (age(member.get("birthDate")) < 18) return fail("UNDER_18");
    const linked = await linkedAccountOf(tx, memberId);
    if (!linked.empty) return fail("ALREADY_LINKED");
    const account = await findByLinkToken((q) => tx.get(q), request.data?.tokenOrLink);
    if (!account) return fail("LINK_EXPIRED");
    tx.update(account.ref, {
      affiliateId: memberId, status: "awaiting_acceptance", validatedBy: holderId,
      validatedByName: holder.exists ? fullName(holder) : null, affiliateName: fullName(member), affiliateDni: member.get("dni") ?? "",
      linkToken: null, linkTokenExpiresAt: null,
    });
    return ok;
  });
});

/**
 * El adherente acepta: la cuenta queda activa y el correo de la cuenta pasa al asociado si no tenía uno, como
 * `acceptLink` de la app. Los claims van después de confirmar la cuenta (igual que en `activateHolder`).
 */
export const accept = onCall(async (request) => {
  const uid = uidOf(request);
  const ref = db.doc(`accounts/${uid}`);
  const accepted = await db.runTransaction(async (tx) => {
    const account = await tx.get(ref);
    const memberId = account.get("affiliateId");
    if (account.get("status") !== "awaiting_acceptance" || !memberId) return undefined;
    const member = await tx.get(db.doc(`affiliates/${memberId}`));
    if (!member.exists) return undefined;
    tx.update(ref, { status: "active", revokedBy: null, revokedByName: null });
    if (!member.get("email")) tx.update(member.ref, { email: account.get("email") ?? "" });
    return { affiliateId: memberId as string, holderId: account.get("validatedBy") as string };
  });
  if (accepted) await getAuth().setCustomUserClaims(uid, { ...accepted, role: "adherent" });
});

/** El adherente rechaza: la cuenta vuelve a pendiente, sin asociado y con un token nuevo, como `rejectLink` de la app. */
export const reject = onCall(async (request) => {
  const ref = db.doc(`accounts/${uidOf(request)}`);
  await db.runTransaction(async (tx) => {
    if ((await tx.get(ref)).get("status") !== "awaiting_acceptance") return;
    tx.update(ref, unlinked());
  });
});

/**
 * El titular le saca el acceso a un adherente de su familia, vinculado o esperando la aceptación: la cuenta vuelve a
 * pendiente con un token nuevo, como `revokeAdherent` de la app, y guarda quién revocó (con su nombre, porque la cuenta
 * pendiente no lee asociados). Después le saca los claims y revoca sus tokens (ADR 0002).
 */
export const revoke = onCall<{ memberId?: unknown }>(async (request): Promise<Result> => {
  // Sin `requireHolder`: como en la app, quien no es el titular del miembro recibe CANNOT_REVOKE, no un permiso denegado.
  const holderId = request.auth?.token.affiliateId;
  const memberId = text(request.data?.memberId);
  if (!holderId || !memberId) return fail("CANNOT_REVOKE");
  const revoked = await db.runTransaction(async (tx): Promise<Result & { uid?: string }> => {
    const [member, holder] = await Promise.all([tx.get(db.doc(`affiliates/${memberId}`)), tx.get(db.doc(`affiliates/${holderId}`))]);
    const linked = await linkedAccountOf(tx, memberId);
    if (!member.exists || member.get("holderId") !== holderId || linked.empty) return fail("CANNOT_REVOKE");
    const account = linked.docs[0];
    tx.update(account.ref, {
      ...unlinked(), revokedBy: holderId, revokedByName: holder.exists ? fullName(holder) : null, revokedAt: Date.now(),
    });
    return { ...ok, uid: account.id };
  });
  if (revoked.error) return fail(revoked.error);

  // Como en `activateHolder`, los claims cambian después de confirmar la cuenta.
  // ponytail: si este paso falla, la cuenta queda pendiente pero conserva los claims, y reintentar devuelve
  // CANNOT_REVOKE. Si pasa, reintentar los claims de las cuentas pendientes.
  await getAuth().setCustomUserClaims(revoked.uid!, null);
  await getAuth().revokeRefreshTokens(revoked.uid!);
  return ok;
});

/**
 * Solo para el panel de demo: el token vigente de alguna cuenta pendiente de adherente, para simular que el titular
 * lee el QR con la cámara. Como `pendingLinkToken` de la demo en memoria. Solo el operador.
 * ponytail: herramienta de la demo desplegada junto a las demás; sacarla cuando la app lea el QR con la cámara.
 */
export const demoPendingLinkToken = onCall(async (request) => {
  requireOperator(request);
  const pending = await db.collection("accounts").where("status", "==", "pending").where("role", "==", "adherent").get();
  const valid = pending.docs.find((d) => d.get("linkToken") && (d.get("linkTokenExpiresAt") ?? 0) > Date.now());
  return valid?.get("linkToken") ?? null;
});
