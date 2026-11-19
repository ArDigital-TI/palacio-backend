# 01: Repo propio para el backend

**What to build:** El backend sale de `palacio-android` a un repo nuevo, `palacio-backend`, con todo el historial de `firebase/`. Desde ahí se levantan los emuladores, se corren los tests y se despliega a `dev`, igual que hoy. `palacio-android` queda como cliente: su README apunta al repo nuevo.

**Blocked by:** —

**Status:** done

Necesita el OK del usuario para crear `ArDigital-TI/Palacio_Backend` en GitHub (`gh repo create`, privado) y hacer push.

- [x] `git subtree split --prefix=firebase` desde `palacio-android`. La rama resultante es `main` del repo nuevo, en `D:\_DESARROLLO\palacio\palacio-backend`, con el historial de `firebase/` y su contenido en la raíz.
- [x] En el repo nuevo funcionan `npm install`, `npm run emulators`, `npm run seed` y `npm test`, y quedan verdes.
- [x] `firebase use` sigue apuntando a `dev`: el alias de `.firebaserc` viaja con el split. Si no, se vuelve a crear.
- [x] El repo nuevo tiene:
  - `CONTEXT.md` (movido desde Android, ahora es la fuente);
  - `docs/adr/` con el ADR de custom claims (hoy 0002 en Android) y un ADR nuevo, «El backend y la consola del operador viven en un repo propio»;
  - `docs/agents/` y `CLAUDE.md` con la misma convención de tickets;
  - un `.gitignore` que incluye `.scratch/handoffs/`.
- [x] Esta carpeta (`.scratch/operator-console/`) se mueve al repo nuevo.
- [x] En `palacio-android`:
  - se borra `firebase/`;
  - `CONTEXT.md` queda como un enlace al del backend;
  - el ADR 0002 queda como un enlace al del backend (el 0001 se queda);
  - el README y los enlaces a `firebase/README.md` apuntan al repo nuevo;
  - el ticket 09 de `firebase-backend` y su spec quedan como están (son historia).
- [x] La app de Android sigue compilando en sus tres variantes (`assembleDemoDebug`, `assembleLocalDebug`, `assembleDevDebug`).

Spec: [spec.md](../spec.md)

## Comments

**2026-11-18 · hecho.** El backend salió con `git subtree split --prefix=firebase`: `main` de este repo conserva los 11 commits de `firebase/`, y `.firebaserc` trae el alias `dev`. `npm install`, `npm --prefix functions install` y `npm test` (38/38) pasan acá. `npm run emulators` y `npm run seed` no se probaron por separado: `npm test` levanta los mismos emuladores con el mismo `firebase.json`.

- Acá: `CONTEXT.md` (con Operador, Consola y Acceso de operador), ADR 0001 nuevo (repo propio) y ADR 0002 (custom claims, conserva su número), `docs/agents/`, `CLAUDE.md`, esta carpeta y `.scratch/handoffs/` en el `.gitignore`. El README y la spec enlazan a `ArDigital-TI/Palacio_Android` lo que quedó allá (ADR 0001 de Android, propuesta del MVP, prototipo).
- En `palacio-android` (commit `95537f2`): sin `firebase/`; `CONTEXT.md` y el ADR 0002 son enlaces a este repo; el README y los comentarios de `FirebaseRepositories.kt` y `app/build.gradle.kts` apuntan a `palacio-backend`. Compilan `assembleDemoDebug`, `assembleLocalDebug` y `assembleDevDebug`.
- Falta, con el OK del usuario: crear `ArDigital-TI/Palacio_Backend` (privado) y hacer push. Hasta entonces, los enlaces del README de Android al backend no resuelven.
