# 04: Consola del operador, primer corte: activar titulares

**What to build:** La consola web del operador, mínima: entrar con Google, ver los titulares sin cuenta y activar a uno con su código de activación. Funciona contra el emulador y desplegada en `dev`. Con esto se destraba `dev`: un titular real entra en la app de Android, el operador lo activa desde la consola y desde ahí se puede recorrer el resto del flujo con cuentas reales.

**Blocked by:** 02

**Status:** ready-for-human

- [x] `console/` con Vite + React + TypeScript y el SDK web de Firebase (Auth y Functions, región `southamerica-east1`).
- [x] `npm run console` la levanta contra el Emulator Suite. Contra `dev`, toma la configuración de `.env.dev`, que no se sube al repo; hay un `.env.example`.
- [x] Entrada con Google (`signInWithPopup`). Sin el claim `operator`: «Sin acceso de operador», con el correo de la cuenta y un botón para salir. La consola nunca llama a `registerAccount`.
- [x] Pantalla principal:
  - la lista de `holdersWithoutAccount`, ordenada por apellido, con nombre y DNI;
  - por titular, un campo para el código de 4 dígitos y el botón **Activar**;
  - si sale bien, «Cuenta activada» y el titular sale de la lista;
  - los errores de dominio, con el mismo texto que en la app de Android.
- [x] Cerrar sesión.
- [x] Usa los tokens de color y tipografía (Nunito) del mockup, en español y para escritorio.
- [ ] Firebase Hosting en `firebase.json`, y `npm run deploy:dev` incluye `hosting`. El dominio de Hosting queda autorizado para Google en Auth (viene así por defecto, pero hay que verificarlo).
- [x] El README del backend documenta cómo correrla y desplegarla.
- [ ] Recorrido manual en el emulador: Rosa entra en la app de Android (`local`) y elige «Soy titular». El operador la activa desde la consola local y la app de Rosa pasa sola a Inicio.
- [ ] Recorrido manual en `dev`:
  - se le da acceso de operador a una cuenta real con `grant-operator:dev`;
  - un titular real entra en `devDebug`;
  - el operador lo activa desde la consola desplegada;
  - el titular ve Inicio.
- [x] Una cuenta de Google sin acceso ve «Sin acceso de operador».

Spec: [spec.md](../spec.md)

## Comments

- Queda lo que necesita a una persona: registrar la app web en `dev` y completar `console/.env.dev` (README, paso 6), desplegar con `npm run deploy:dev`, verificar los dominios autorizados y los dos recorridos manuales con Android. `firebase.json` ya tiene `hosting` y `deploy:dev` lo incluye; el build falla con un mensaje claro si falta `.env.dev`.
- Recorrido de la consola en el emulador (sin la app de Android):
  - el popup de Google ofrece a `operadora.google@palacio.test`, que entra a la lista de titulares ordenada por apellido;
  - un código equivocado muestra el texto de `error_invalid_code` de Android;
  - con el código de una cuenta de titular pendiente aparece «Cuenta activada: Rosa Quispe.» y Rosa sale de la lista;
  - «Salir» vuelve a la entrada;
  - una cuenta de Google sin el claim ve «Sin acceso de operador»; después de `grant-operator`, al recargar, entra.
- El panel del navegador de Claude abre el popup en la misma pestaña, así que ahí la entrada se hizo con la misma credencial de Google del emulador (`signInWithCredential`). En un navegador normal el popup vuelve solo a la consola.
- Nunito sale de los `.ttf` de la app de Android (`console/public/fonts`, con su licencia OFL). El mockup usa Figtree, pero el ticket pide Nunito, que es la de la app.
- La consola no tiene tests automáticos, como dice el spec.
