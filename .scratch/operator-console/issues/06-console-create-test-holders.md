# 06: Consola del operador: alta de titulares de prueba

**What to build:** Mientras no hay conexión con el sistema de la Fundación, el operador da de alta en el padrón titulares inventados desde la consola, para completar las pruebas en `dev` con cuentas reales. Es temporal: cuando llegue el padrón real, se quita.

**Blocked by:** 05

**Status:** done

Pedido por el usuario el 2026-11-19. Va contra «Cargar o editar el padrón: lo hace el sistema de la Fundación» (Out of Scope del spec): es una excepción temporal, solo para pruebas.

- [x] Function `createHolder`, solo para el operador:
  - recibe nombre, apellido, DNI (7 u 8 dígitos), fecha de nacimiento (`YYYY-MM-DD`, mayor de 18) y plan (`family` o `comprehensive`);
  - genera el número de asociado `FP-PRUEBA-<DNI>` y deja teléfono y correo vacíos;
  - escribe `lastNameKey`, y `createdBy` y `createdAt` para encontrar y borrar estos titulares más adelante;
  - con un DNI que ya está en el padrón responde `already-exists`; con datos inválidos, `invalid-argument`.
- [x] En la consola, un formulario «Alta de titular de prueba» que avisa que es temporal. Al dar de alta, el titular aparece en la lista de titulares sin cuenta.
- [x] Tests contra el emulador: el alta aparece en `holdersWithoutAccount` y en la búsqueda, DNI repetido, datos inválidos y `permission-denied` sin el claim.

Spec: [spec.md](../spec.md)

## Comments

- Para encontrar estas altas cuando llegue el padrón real: `affiliates` con `createdBy` (o número `FP-PRUEBA-…`).
- La fecha se valida de verdad: «1980-13-01» y «1980-02-31» dan `invalid-argument` (el primero daba 500 antes del test).
- En la consola, el DNI acepta puntos al tipear y los quita; sin `maxLength`, que cortaba «40.111.222» a 6 dígitos.
- 2026-11-19: recorrido en el emulador: alta de «Ernesto Ñúñez», DNI «40.111.222» → aparece en la lista y «nunez» lo encuentra con `FP-PRUEBA-40111222`; el DNI de Rosa da «Ese DNI ya está en el padrón.». Desplegado y probado en `dev` con el ticket 07.
