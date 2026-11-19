# 03: Registrar qué operador activó cada cuenta

**What to build:** Cuando un operador activa a un titular, la cuenta guarda quién lo hizo y cuándo, para poder responder un reclamo.

**Blocked by:** 01

**Status:** done

- [x] `activateHolder` escribe `activatedBy` (uid del operador) y `activatedAt` (milisegundos epoch) en la misma transacción que deja la cuenta activa.
- [x] Las reglas de seguridad no exponen esos campos a nadie que no los vea hoy: la cuenta ya es legible solo por su dueño, así que alcanza con verificarlo. Verificado sin cambios en `firestore.rules`: `accounts/{uid}` la lee su dueño o el titular que la validó (`validatedBy`); la cuenta de un titular activado por el operador no tiene `validatedBy`, así que solo la lee su dueño.
- [x] Test contra el emulador: después de una activación correcta, la cuenta tiene `activatedBy` igual al uid del operador y un `activatedAt` reciente.
- [x] La app de Android no cambia: ignora los campos que no conoce.

Spec: [spec.md](../spec.md)
