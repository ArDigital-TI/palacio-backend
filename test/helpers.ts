// Ayudas para los tests contra el emulador: usuarios nuevos con su propia instancia del SDK y acceso de administrador.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after } from "node:test";
import { deleteApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { initializeApp as initializeAdmin } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";

// `emulators:exec` define FIRESTORE_EMULATOR_HOST y FIREBASE_AUTH_EMULATOR_HOST: el Admin SDK va al emulador.
initializeAdmin({ projectId: "demo-palacio" });
export const adminDb = getAdminFirestore("palacio-app");
export const adminAuth = getAdminAuth();

/** Un usuario nuevo del emulador, con su propia instancia del SDK. Con `claims`, los recibe antes de iniciar sesión. */
export async function newUser(claims?: object) {
  const app = initializeApp({ projectId: "demo-palacio", apiKey: "fake-api-key" }, randomUUID());
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getFirestore(app, "palacio-app");
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  const functions = getFunctions(app, "southamerica-east1");
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);

  const email = `${randomUUID()}@test.palacio`;
  const { user } = await createUserWithEmailAndPassword(auth, email, "palacio-test");
  if (claims) {
    await adminAuth.setCustomUserClaims(user.uid, claims);
    await user.getIdToken(true);
  }
  const call = (name: string, data?: unknown) => httpsCallable(functions, name)(data);
  const account = async (uid = user.uid) => (await getDoc(doc(db, "accounts", uid))).data();
  const tokenClaims = async () => (await user.getIdTokenResult(true)).claims;
  return { uid: user.uid, email, db, call, account, tokenClaims };
}

// Cierra las conexiones del SDK; si no, el proceso de los tests no termina.
after(() => Promise.all([...getApps().map(deleteApp), adminDb.terminate()]));

export async function assertDenied(promise: Promise<unknown>) {
  await assert.rejects(promise, { code: "permission-denied" });
}

export const yearsAgo = (years: number) => `${new Date().getFullYear() - years}-01-01`;

/** Una familia nueva: titular, adherente con cuenta activa y miembro a cargo. Ids propios por test. */
export async function family() {
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
