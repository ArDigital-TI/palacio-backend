# 07: La activación del titular verifica el correo del padrón

**What to build:** Mecanismo de seguridad: el operador activa a un titular solo si el código de activación es válido **y** el correo de la cuenta pendiente (la cuenta de Google con que entró el titular) es el mismo que el padrón tiene para ese titular. Si no coinciden, la consola lo dice, y el operador lo resuelve con el titular: eligió otra cuenta de Google o el padrón tiene otro correo.

**Blocked by:** 06

**Status:** done

Pedido por el usuario el 2026-11-19. Todo titular del padrón tiene correo y teléfono; los miembros del grupo familiar no tienen por qué.

- [x] `activateHolder` compara el correo de la cuenta pendiente con el `email` del asociado, sin distinguir mayúsculas ni espacios. Un titular sin correo en el padrón no se activa.
- [x] Si no coinciden, responde `{ error: "INVALID_CODE", reason: "EMAIL_MISMATCH" }`: la app de Android solo lee `error` (lo convierte con `DomainError.valueOf`), así que no cambia ni se rompe; la consola lee `reason`.
- [x] `createHolder` exige correo (con formato válido) y teléfono, y guarda el correo en minúsculas.
- [x] La consola: el alta pide correo y teléfono, y ante `EMAIL_MISMATCH` muestra «El correo de la cuenta del titular no coincide con el del padrón. Verifique con el titular qué cuenta de Google eligió».
- [x] Tests contra el emulador: activa con el correo igual (aunque cambien las mayúsculas), no activa con otro correo ni sin correo en el padrón (la cuenta sigue pendiente), y el alta sin correo o teléfono da `invalid-argument`.

Spec: [spec.md](../spec.md)

## Comments

- El panel de demo de Android en `local` también pasa por `activateHolder`: para activar a un titular de la semilla hay que entrar con su mismo correo (Rosa: `rosa.quispe@correo.com`). Si no coincide, la app ve `INVALID_CODE`. En `demo` (sin Firebase) no cambia nada.
- En `dev`, los titulares de la semilla tienen correos inventados y ya no se pueden activar con cuentas reales: se prueba con titulares dados de alta desde la consola (ticket 06) con el correo real.
- Los tests de `activateHolder` que ya existían ahora cargan el asociado con el correo de la cuenta pendiente.
- 2026-11-19: recorrido en el emulador: con el código de una cuenta pendiente de Silvia (`silvi.medina81@gmail.com`), activar a Rosa da «El correo de la cuenta del titular no coincide con el del padrón…»; con el código de la cuenta de Rosa (`rosa.quispe@correo.com`), «Cuenta activada: Rosa Quispe.».
- 2026-11-19: desplegado en `dev` junto con el ticket 06. El usuario dio de alta un titular con su correo real desde https://palacio-mobile-a61b7.web.app, lo activó con el código y funcionó correctamente.
