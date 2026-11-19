# 03: La ficha muestra el correo del padrón del titular

**What to build:** `affiliateRecord` devuelve el correo que el padrón tiene para el titular, y la ficha lo muestra en la línea del titular («Correo del padrón: …»). Así, cuando la consola dice que el correo no coincide, el operador puede leérselo al titular. Ver [ADR 0003](../../../docs/adr/0003-record-shows-padron-email.md).

**Blocked by:** 02

**Status:** done

- [x] `affiliateRecord` agrega `email` al titular, en minúsculas y sin espacios, igual que lo compara `activateHolder`. Los miembros no lo traen y nadie trae el teléfono.
- [x] Test contra el emulador en `test/`: la ficha trae el `email` del titular y ningún miembro tiene `email`.
- [x] La ficha lo muestra en monoespaciada, debajo de DNI, N.º y plan. Si el padrón no tiene correo, muestra «Sin correo en el padrón».
- [x] Nota en el ticket 05 de `operator-console`: este ticket revierte su decisión de no mostrar el correo.
- [x] Recorrido en el emulador activando a Rosa con el código de la cuenta pendiente de Silvia (`silvi.medina81@gmail.com`), como en el ticket 07 de `operator-console`: el error de correo y el correo del padrón se ven a la vez.

Spec: [spec.md](../spec.md)

## Comments

- 2026-11-19: hecho. `normalizedEmail` (Functions) es la única normalización del correo: la usan `activateHolder`, `affiliateRecord` y `createHolder`. Recorrido en el emulador: Rosa (17.844.390) con el código de la cuenta pendiente de Silvia muestra el aviso de correo y, a la izquierda, «Correo del padrón: rosa.quispe@correo.com»; a 375 px y en oscuro, sin desborde. Suite completa contra el emulador: 53 de 53.
