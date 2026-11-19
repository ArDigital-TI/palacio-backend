// Da o quita el acceso de operador (el claim `operator`) a un usuario de Auth, buscado por correo.
// Uso: `npm run grant-operator -- <correo>` y `npm run revoke-operator -- <correo>` contra el emulador levantado;
// con `:dev` (`--project dev`), contra el proyecto real, con las mismas credenciales que `seed:dev`.
// Quitarlo también revoca los tokens (`revokeRefreshTokens`), como `revoke` con los adherentes (ADR 0002).

import { readFileSync } from "node:fs";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const [command, email] = process.argv.slice(2).filter((arg, i, args) => arg !== "--project" && args[i - 1] !== "--project");
if ((command !== "grant" && command !== "revoke") || !email) throw new Error("Uso: operator-access.ts grant|revoke <correo> [--project dev]");

const projectArg = process.argv.indexOf("--project");
const aliases: Record<string, string> = JSON.parse(readFileSync(new URL("../.firebaserc", import.meta.url), "utf8")).projects;
const projectName = projectArg >= 0 ? process.argv[projectArg + 1] : undefined;
const REAL_PROJECT = projectName && (aliases[projectName] ?? projectName);
if (projectArg >= 0 && !REAL_PROJECT) throw new Error("Falta el proyecto después de --project.");
if (REAL_PROJECT === "dev") throw new Error("Falta el alias dev: npx firebase use --add (ver README.md).");
if (REAL_PROJECT?.startsWith("demo-")) throw new Error(`${REAL_PROJECT} es del emulador: use el comando sin :dev.`);
if (!REAL_PROJECT) process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";

initializeApp({ projectId: REAL_PROJECT ?? "demo-palacio" });
const auth = getAuth();

const user = await auth.getUserByEmail(email).catch((e) => {
  if (e.code !== "auth/user-not-found") throw e;
  console.error(`No hay ningún usuario con el correo ${email}. La persona tiene que entrar una vez a la consola con Google antes de recibir el acceso.`);
  process.exit(1);
});
const { operator: _, ...otherClaims } = user.customClaims ?? {};
if (command === "grant") {
  await auth.setCustomUserClaims(user.uid, { ...otherClaims, operator: true });
  console.log(`${email} ya es operador.`);
} else {
  await auth.setCustomUserClaims(user.uid, otherClaims);
  await auth.revokeRefreshTokens(user.uid);
  console.log(`${email} ya no es operador.`);
}
