// Borra los emuladores y carga los datos de prueba: los mismos que `SeedData.kt` de la app
// (asociados, cuentas, catálogo, configuración y turnos), un usuario de Auth por persona de la demo y el operador.
// Uso, con los emuladores levantados: `npm run seed`.
//
// Con `--project <id>` (`npm run seed:dev`) carga en el proyecto real de desarrollo, con las credenciales de
// `gcloud auth application-default login`. Ahí no borra nada ni crea usuarios ni cuentas: las cuentas nacen al entrar
// con Google. Escribe asociados, catálogo, configuración y turnos con los mismos ids, así que repetirlo los reemplaza.

import { readFileSync } from "node:fs";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const projectArg = process.argv.indexOf("--project");
// Acepta un alias de `.firebaserc` (el de desarrollo es `dev`) o el id del proyecto.
const aliases: Record<string, string> = JSON.parse(readFileSync(new URL("../.firebaserc", import.meta.url), "utf8")).projects;
const projectName = projectArg >= 0 ? process.argv[projectArg + 1] : undefined;
const REAL_PROJECT = projectName && (aliases[projectName] ?? projectName);
if (projectArg >= 0 && !REAL_PROJECT) throw new Error("Falta el proyecto después de --project.");
if (REAL_PROJECT === "dev") throw new Error("Falta el alias dev: npx firebase use --add (ver README.md).");
if (REAL_PROJECT?.startsWith("demo-")) throw new Error(`${REAL_PROJECT} es del emulador: use \`npm run seed\`.`);
const PROJECT_ID = REAL_PROJECT ?? "demo-palacio";
const FIRESTORE_HOST = REAL_PROJECT ? "" : (process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080");
const AUTH_HOST = REAL_PROJECT ? "" : (process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099");

/** Contraseña de todos los usuarios del emulador; la misma que `EMULATOR_PASSWORD` en la app. */
const EMULATOR_PASSWORD = "palacio-demo";

// --- Asociados, cuentas, catálogo y configuración (copiados de SeedData.kt) ---

const affiliates: Record<string, object> = {};
function af(
  id: string, firstName: string, lastName: string, dni: string, number: string,
  plan: string, birthDate: string, holderId: string | null, phone: string, email: string,
) {
  // `lastNameKey`: el apellido en minúsculas y sin acentos, para buscar (igual que `searchKey` de las Functions).
  const lastNameKey = lastName.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
  affiliates[id] = { firstName, lastName, lastNameKey, dni, number, plan, birthDate, holderId, phone, email };
}
af("a1", "Marcelo", "Aráoz", "24356871", "FP-104233-00", "family", "1975-03-12", null, "381 555-2143", "marcelo.araoz@correo.com");
af("a2", "Silvia", "Medina", "28911402", "FP-104233-01", "family", "1981-06-02", "a1", "", "");
af("a3", "Facundo", "Aráoz", "47120335", "FP-104233-02", "family", "2007-04-20", "a1", "381 555-9012", "facu.araoz@correo.com");
af("a4", "Valentina", "Aráoz", "49880214", "FP-104233-03", "family", "2009-08-03", "a1", "", "");
af("a5", "Bautista", "Aráoz", "55302117", "FP-104233-04", "family", "2017-01-15", "a1", "", "");
af("a6", "Rosa", "Quispe", "17844390", "FP-208871-00", "comprehensive", "1968-09-22", null, "387 555-4410", "rosa.quispe@correo.com");
af("a7", "Juan Carlos", "Gutiérrez", "20113458", "FP-100912-00", "comprehensive", "1966-11-02", null, "381 555-3301", "jcgutierrez@correo.com");
af("a8", "María Elena", "Choque", "25640981", "FP-101455-00", "family", "1977-02-17", null, "388 555-1290", "mechoque@correo.com");
af("a9", "Lucía", "Figueroa", "33571209", "FP-102330-00", "comprehensive", "1988-05-30", null, "381 555-6672", "lucia.figueroa@correo.com");
af("a10", "Ramón", "Zerpa", "14223876", "FP-099811-00", "comprehensive", "1960-08-08", null, "385 555-0198", "ramon.zerpa@correo.com");
af("a11", "Carmen", "Ruiz", "30458112", "FP-103002-00", "family", "1983-12-11", null, "381 555-8834", "carmen.ruiz@correo.com");
af("a12", "Diego", "Sosa", "36902554", "FP-104981-00", "comprehensive", "1992-03-25", null, "383 555-2207", "diego.sosa@correo.com");
af("a13", "Ana Belén", "Tolaba", "38117640", "FP-105120-00", "family", "1994-07-19", null, "387 555-3349", "ana.tolaba@correo.com");
af("a14", "Héctor", "Vilte", "16775023", "FP-098455-00", "comprehensive", "1963-01-04", null, "388 555-4471", "hector.vilte@correo.com");
af("a15", "Gabriela", "Paz", "31209876", "FP-103670-00", "family", "1985-10-28", null, "381 555-9920", "gabriela.paz@correo.com");
af("a16", "Sergio", "Cruz", "27554310", "FP-101987-00", "comprehensive", "1979-04-14", null, "385 555-6158", "sergio.cruz@correo.com");

const accounts: Record<string, object> = {};
// `validatedBy`: el titular que validó al adherente; con él, el titular lee las cuentas de su familia.
function ac(id: string, affiliateId: string, role: string, email: string, activationCode: string, validatedBy?: string) {
  accounts[id] = { affiliateId, role, email, activationCode, status: "active", ...(validatedBy && { validatedBy }) };
}
ac("c1", "a1", "holder", "marcelo.araoz@correo.com", "4821");
ac("c2", "a3", "adherent", "facu.araoz@gmail.com", "1937", "a1");
ac("c3", "a7", "holder", "jcgutierrez@correo.com", "5502");
ac("c4", "a9", "holder", "lucia.figueroa@correo.com", "7714");
ac("c5", "a12", "holder", "diego.sosa@correo.com", "3068");

const professionals: Record<string, object> = {};
function pro(id: string, name: string, specialty: string, telemedicine: boolean) {
  professionals[id] = { name, specialty, telemedicine };
}
pro("p1", "Dra. Laura Castro", "Clínica médica", true);
pro("p2", "Dr. Martín Arias", "Clínica médica", true);
pro("p3", "Dra. Natalia Ríos", "Pediatría", true);
pro("p4", "Dr. Pablo Saravia", "Pediatría", false);
pro("p5", "Dr. Ernesto Villagra", "Cardiología", false);
pro("p6", "Dra. Cecilia Ovejero", "Cardiología", true);
pro("p7", "Dra. Mariana Lescano", "Ginecología", false);
pro("p8", "Dra. Paula Frías", "Ginecología", false);
pro("p9", "Dr. Gustavo Nieva", "Traumatología", false);
pro("p10", "Dr. Federico Ibarra", "Traumatología", false);
pro("p11", "Dra. Inés Romano", "Dermatología", true);
pro("p12", "Dr. Raúl Medina", "Oftalmología", false);
pro("p13", "Dra. Sofía Cabral", "Oftalmología", false);
pro("p14", "Dr. Andrés Paz", "Otorrinolaringología", false);
pro("p15", "Dra. Julieta Ledesma", "Otorrinolaringología", false);

const bothSites = ["central", "norte"];
const centralOnly = ["central"];
const studies: Record<string, object> = {};
function lab(id: string, name: string, preparation: string, group: string, detail = "") {
  studies[id] = { kind: "lab", name, preparation, siteIds: bothSites, equipment: "", group, detail };
}
function imaging(id: string, name: string, preparation: string, siteIds: string[], equipment: string) {
  studies[id] = { kind: "imaging", name, preparation, siteIds, equipment, group: "", detail: "" };
}
lab("e11", "Perfil chequeo anual", "Ayuno de 12 horas. Traer la primera orina de la mañana en frasco estéril.", "profile", "Hemograma, glucemia, perfil lipídico y orina completa");
lab("e12", "Perfil prequirúrgico", "Ayuno de 8 horas. Informar si toma anticoagulantes.", "profile", "Hemograma, coagulograma, glucemia y grupo sanguíneo");
lab("e1", "Hemograma", "Ayuno de 8 horas.", "test");
lab("e2", "Glucemia", "Ayuno de 8 a 12 horas. Se puede tomar agua.", "test");
lab("e3", "Perfil lipídico", "Ayuno de 12 horas. No consumir alcohol 72 horas antes.", "test");
lab("e4", "Orina completa", "Recolectar la primera orina de la mañana en frasco estéril.", "test");
lab("e5", "TSH", "No requiere ayuno. Informar si toma medicación para la tiroides.", "test");
imaging("e6", "Radiografía de tórax", "No requiere preparación. Retirar objetos metálicos.", bothSites, "Equipo de rayos X digital");
imaging("e7", "Ecografía abdominal", "Ayuno de 6 horas.", bothSites, "Ecógrafo");
imaging("e8", "Mamografía", "No usar desodorante, talco ni cremas el día del estudio. Traer estudios anteriores.", centralOnly, "Mamógrafo digital");
imaging("e9", "Resonancia de rodilla", "Ropa cómoda sin partes metálicas. Retirar objetos metálicos. Informar si tiene marcapasos o implantes.", centralOnly, "Resonador 1,5 T");
imaging("e10", "Tomografía de cerebro con contraste", "Ayuno de 4 horas. Consultar a su médico si debe suspender alguna medicación (por ejemplo, metformina).", centralOnly, "Tomógrafo multicorte");

const sites = { central: { name: "Sede central" }, norte: { name: "Sede Norte" } };
const config = { telemedicineLine: "0800-555-0110", dispatchLine: "0800-555-0107" };

// Turnos de `seedAppointments`: desplazamientos en días respecto de hoy, en la hora de las sedes (Argentina, UTC-3).
// El de telemedicina (t1) queda a 15 minutos de ahora, para que su aviso se vea a cualquier hora.
const ZONE_OFFSET_MS = -3 * 60 * 60_000;
const todayMidnight = (() => {
  const local = new Date(Date.now() + ZONE_OFFSET_MS);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - ZONE_OFFSET_MS;
})();
const at = (days: number, hour: number, minute: number) => todayMidnight + ((days * 24 + hour) * 60 + minute) * 60_000;

const appointments: Record<string, object> = {};
function t(
  id: string, affiliateId: string, kind: string, mode: string, resourceId: string, siteId: string | null,
  when: number, status: string, contactPhone: string | null = null,
) {
  appointments[id] = { affiliateId, bookedByAccountId: "c1", kind, mode, resourceId, siteId, at: when, status, contactPhone };
}
t("t1", "a1", "medical", "telemedicine", "p1", null, Date.now() + 15 * 60_000, "confirmed", "381 555-2143");
t("t2", "a5", "medical", "in_person", "p3", null, at(1, 8, 40), "confirmed");
t("t3", "a1", "imaging", "in_person", "e7", "central", at(1, 9, 20), "confirmed");
t("t4", "a1", "medical", "in_person", "p5", null, at(-35, 11, 0), "done");
t("t5", "a1", "lab", "in_person", "e1", "norte", at(-54, 8, 0), "done");
t("t6", "a4", "medical", "in_person", "p11", null, at(-77, 9, 20), "done");
t("t7", "a1", "medical", "in_person", "p9", null, at(-102, 10, 40), "cancelled");

// --- Usuarios de Auth: uno por persona de la demo (mismo correo que `seedPersonas`) y el operador ---

type SeedUser = { uid?: string; email: string; claims?: object };
const users: SeedUser[] = [
  // Marcelo y Facundo arrancan con su cuenta activa: el uid es el id de su cuenta y ya tienen sus claims.
  { uid: "c1", email: "marcelo.araoz@correo.com", claims: { affiliateId: "a1", holderId: "a1", role: "holder" } },
  { uid: "c2", email: "facu.araoz@gmail.com", claims: { affiliateId: "a3", holderId: "a1", role: "adherent" } },
  // Silvia y Rosa arrancan sin cuenta: la crea `registerAccount` en su primer ingreso.
  { email: "silvi.medina81@gmail.com" },
  { email: "rosa.quispe@correo.com" },
  { email: "operador@palacio.test", claims: { operator: true } },
];

// --- Carga ---

async function clearEmulators() {
  const responses = await Promise.all([
    fetch(`http://${FIRESTORE_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/palacio-app/documents`, { method: "DELETE" }),
    fetch(`http://${AUTH_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: "DELETE" }),
  ]);
  for (const r of responses) if (!r.ok) throw new Error(`No se pudo borrar el emulador: ${r.url} → ${r.status}`);
}

initializeApp({ projectId: PROJECT_ID });
const db = getFirestore("palacio-app");
const auth = getAuth();

if (!REAL_PROJECT) await clearEmulators();

const batch = db.batch();
const collections = REAL_PROJECT
  ? { affiliates, professionals, studies, sites, appointments }
  : { affiliates, accounts, professionals, studies, sites, appointments };
for (const [name, docs] of Object.entries(collections)) {
  for (const [id, data] of Object.entries(docs)) batch.set(db.doc(`${name}/${id}`), data);
}
batch.set(db.doc("config/app"), config);
await batch.commit();

if (REAL_PROJECT) {
  console.log(`Datos de prueba cargados en ${REAL_PROJECT}: ${Object.keys(affiliates).length} asociados, sin cuentas ni usuarios.`);
} else {
  for (const { uid, email, claims } of users) {
    const user = await auth.createUser({ uid, email, password: EMULATOR_PASSWORD, emailVerified: true });
    if (claims) await auth.setCustomUserClaims(user.uid, claims);
  }
  // El operador de la consola, que entra con Google (sin contraseña): `importUsers` es lo único que crea un usuario
  // con proveedor `google.com` desde el Admin SDK.
  const googleOperatorEmail = "operadora.google@palacio.test";
  const { errors } = await auth.importUsers([{
    uid: "operator-google", email: googleOperatorEmail, emailVerified: true, displayName: "Operadora Google", customClaims: { operator: true },
    providerData: [{ uid: googleOperatorEmail, email: googleOperatorEmail, displayName: "Operadora Google", providerId: "google.com" }],
  }]);
  if (errors.length) throw errors[0].error;
  console.log(`Datos de prueba cargados: ${Object.keys(affiliates).length} asociados, ${Object.keys(accounts).length} cuentas, ${users.length + 1} usuarios.`);
}
