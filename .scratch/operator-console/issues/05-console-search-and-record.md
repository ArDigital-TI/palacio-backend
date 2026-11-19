# 05: Consola del operador: búsqueda en el padrón y ficha del asociado

**What to build:** Lo que pide el MVP para la consola: el operador busca a un asociado por DNI o apellido, abre su ficha con el estado de su grupo familiar y, si es un titular sin cuenta, lo activa desde ahí con el código.

**Blocked by:** 04

**Status:** needs-triage

Antes de implementar hay que definir qué datos de la ficha necesita ver el operador. Conviene validarlo con un operador de la sede (MVP, «Recorrer el mockup… con operadores de la sede»).

- [ ] Function de búsqueda, solo para el operador:
  - por DNI exacto o por prefijo de apellido;
  - devuelve una lista corta, con nombre, DNI, número de asociado y si es titular;
  - lleva los índices que haga falta.
- [ ] Function de ficha, solo para el operador: el asociado y su grupo familiar. Cada miembro trae su estado (a cargo, sin cuenta, pendiente de aceptación, cuenta activa), con el mismo criterio que la app de Android.
- [ ] En la consola, un buscador lleva a la ficha, y la ficha tiene el campo de código y el botón **Activar** si corresponde.
- [ ] La lista del primer corte (titulares sin cuenta) se conserva o se reemplaza: se decide al triar.
- [ ] Tests contra el emulador: búsqueda por DNI y por apellido, ficha con cada estado, y `permission-denied` sin el claim.

Spec: [spec.md](../spec.md)
