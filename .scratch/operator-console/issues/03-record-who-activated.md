# 03: Registrar qué operador activó cada cuenta

**What to build:** Cuando un operador activa a un titular, la cuenta guarda quién lo hizo y cuándo, para poder responder un reclamo.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `activateHolder` escribe `activatedBy` (uid del operador) y `activatedAt` (milisegundos epoch) en la misma transacción que deja la cuenta activa.
- [ ] Las reglas de seguridad no exponen esos campos a nadie que no los vea hoy: la cuenta ya es legible solo por su dueño, así que alcanza con verificarlo.
- [ ] Test contra el emulador: después de una activación correcta, la cuenta tiene `activatedBy` igual al uid del operador y un `activatedAt` reciente.
- [ ] La app de Android no cambia: ignora los campos que no conoce.

Spec: [spec.md](../spec.md)
