# El acceso se decide con custom claims, no con lecturas en las reglas

Las reglas de seguridad de Firestore deciden qué ve cada cuenta a partir de los custom claims del token: `affiliateId`, `holderId` y `role`. Esos claims los escriben las Functions cuando una cuenta se activa, se acepta o se revoca. Las reglas no hacen `get()` sobre `accounts` en cada acceso.

Descartamos las lecturas dentro de las reglas, que siempre están al día, porque cuestan un acceso extra por operación y vuelven las reglas difíciles de leer y de testear.

## Consecuencias

- Después de que cambia el estado de su cuenta, la app fuerza la actualización del token (`getIdToken(true)`) para tomar los claims nuevos.
- `revoke` también revoca los tokens del adherente (`revokeRefreshTokens`). Si no, el adherente conservaría el acceso hasta que su token venza, hasta una hora después.
- Excepción: los claims no listan a los miembros a cargo, porque dejan de serlo al cumplir 18. La regla que crea una solicitud de asistencia para un miembro a cargo lee ese asociado (`get()` sobre `affiliates`). Es una lectura solo al crear la solicitud, no en cada acceso. El resto de lo que el titular hace por un miembro a cargo (turnos) pasa por Functions.
