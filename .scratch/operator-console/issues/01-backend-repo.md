# 01: Repo propio para el backend

**What to build:** El backend sale de `palacio-android` a un repo nuevo, `palacio-backend`, con todo el historial de `firebase/`. Desde ahí se levantan los emuladores, se corren los tests y se despliega a `dev`, igual que hoy. `palacio-android` queda como cliente: su README apunta al repo nuevo.

**Blocked by:** —

**Status:** ready-for-agent

Necesita el OK del usuario para crear `ArDigital-TI/Palacio_Backend` en GitHub (`gh repo create`, privado) y hacer push.

- [ ] `git subtree split --prefix=firebase` desde `palacio-android`. La rama resultante es `main` del repo nuevo, en `D:\_DESARROLLO\palacio\palacio-backend`, con el historial de `firebase/` y su contenido en la raíz.
- [ ] En el repo nuevo funcionan `npm install`, `npm run emulators`, `npm run seed` y `npm test`, y quedan verdes.
- [ ] `firebase use` sigue apuntando a `dev`: el alias de `.firebaserc` viaja con el split. Si no, se vuelve a crear.
- [ ] El repo nuevo tiene:
  - `CONTEXT.md` (movido desde Android, ahora es la fuente);
  - `docs/adr/` con el ADR de custom claims (hoy 0002 en Android) y un ADR nuevo, «El backend y la consola del operador viven en un repo propio»;
  - `docs/agents/` y `CLAUDE.md` con la misma convención de tickets;
  - un `.gitignore` que incluye `.scratch/handoffs/`.
- [ ] Esta carpeta (`.scratch/operator-console/`) se mueve al repo nuevo.
- [ ] En `palacio-android`:
  - se borra `firebase/`;
  - `CONTEXT.md` queda como un enlace al del backend;
  - el ADR 0002 queda como un enlace al del backend (el 0001 se queda);
  - el README y los enlaces a `firebase/README.md` apuntan al repo nuevo;
  - el ticket 09 de `firebase-backend` y su spec quedan como están (son historia).
- [ ] La app de Android sigue compilando en sus tres variantes (`assembleDemoDebug`, `assembleLocalDebug`, `assembleDevDebug`).

Spec: [spec.md](../spec.md)
