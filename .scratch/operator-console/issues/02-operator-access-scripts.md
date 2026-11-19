# 02: Dar y quitar el acceso de operador

**What to build:** Un administrador da o quita el acceso de operador a una cuenta de Google con un comando, contra el emulador o contra `dev`. Al quitarlo, el acceso deja de valer en ese momento. La semilla del emulador agrega una cuenta de Google simulada que ya es operador, para la consola.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `npm run grant-operator -- <correo>` y `npm run grant-operator:dev -- <correo>`: buscan el usuario por correo y le ponen `operator: true`, sin tocar los demás claims.
- [ ] `npm run revoke-operator -- <correo>` y `npm run revoke-operator:dev -- <correo>`: le quitan `operator` y revocan sus tokens (`revokeRefreshTokens`).
- [ ] Si el correo no existe en Auth, el script termina con un mensaje claro: la persona tiene que entrar una vez a la consola antes de recibir el acceso.
- [ ] Contra `dev` usa las mismas credenciales que `seed:dev`.
- [ ] La semilla del emulador crea un operador con proveedor Google (por ejemplo `operadora.google@palacio.test`, con `operator: true`) y conserva `operador@palacio.test`, con correo y contraseña, para el panel de demo de Android en `local`.
- [ ] Test contra el emulador: una cuenta a la que se le quitó el acceso, una vez actualizado el token, recibe `permission-denied` de `activateHolder`.
- [ ] El README del backend documenta los comandos.

Riesgo: ver si `importUsers` con `providerData` de `google.com` hace que el popup de Google del emulador ofrezca ese usuario. Si no, se documenta que en el emulador se entra con cualquier correo simulado y se le da acceso con `grant-operator`.

Spec: [spec.md](../spec.md)
