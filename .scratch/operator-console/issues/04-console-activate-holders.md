# 04: Consola del operador, primer corte: activar titulares

**What to build:** La consola web del operador, mínima: entrar con Google, ver los titulares sin cuenta y activar a uno con su código de activación. Funciona contra el emulador y desplegada en `dev`. Con esto se destraba `dev`: un titular real entra en la app de Android, el operador lo activa desde la consola y desde ahí se puede recorrer el resto del flujo con cuentas reales.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] `console/` con Vite + React + TypeScript y el SDK web de Firebase (Auth y Functions, región `southamerica-east1`).
- [ ] `npm run console` la levanta contra el Emulator Suite. Contra `dev`, toma la configuración de `.env.dev`, que no se sube al repo; hay un `.env.example`.
- [ ] Entrada con Google (`signInWithPopup`). Sin el claim `operator`: «Sin acceso de operador», con el correo de la cuenta y un botón para salir. La consola nunca llama a `registerAccount`.
- [ ] Pantalla principal:
  - la lista de `holdersWithoutAccount`, ordenada por apellido, con nombre y DNI;
  - por titular, un campo para el código de 4 dígitos y el botón **Activar**;
  - si sale bien, «Cuenta activada» y el titular sale de la lista;
  - los errores de dominio, con el mismo texto que en la app de Android.
- [ ] Cerrar sesión.
- [ ] Usa los tokens de color y tipografía (Nunito) del mockup, en español y para escritorio.
- [ ] Firebase Hosting en `firebase.json`, y `npm run deploy:dev` incluye `hosting`. El dominio de Hosting queda autorizado para Google en Auth (viene así por defecto, pero hay que verificarlo).
- [ ] El README del backend documenta cómo correrla y desplegarla.
- [ ] Recorrido manual en el emulador: Rosa entra en la app de Android (`local`) y elige «Soy titular». El operador la activa desde la consola local y la app de Rosa pasa sola a Inicio.
- [ ] Recorrido manual en `dev`:
  - se le da acceso de operador a una cuenta real con `grant-operator:dev`;
  - un titular real entra en `devDebug`;
  - el operador lo activa desde la consola desplegada;
  - el titular ve Inicio.
- [ ] Una cuenta de Google sin acceso ve «Sin acceso de operador».

Spec: [spec.md](../spec.md)
