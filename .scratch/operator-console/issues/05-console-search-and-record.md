# 05: Consola del operador: búsqueda en el padrón y ficha del asociado

**What to build:** Lo que pide el MVP para la consola: el operador busca a un asociado por DNI o apellido, abre su ficha con el estado de su grupo familiar y, si es un titular sin cuenta, lo activa desde ahí con el código.

**Blocked by:** 04

**Status:** done

Triado con el usuario el 2026-11-19 (sin validar todavía con un operador de la sede):

- **Datos de la ficha, los mínimos:** del titular, nombre, DNI, número de asociado y plan; de cada miembro, nombre, DNI, edad y estado. Sin teléfono, correo ni fecha de nacimiento: la consola muestra lo menos posible de datos personales.
- **La lista del primer corte se queda**, debajo del buscador, como cola de pendientes.
- **Apellido sin mayúsculas ni acentos:** cada asociado lleva `lastNameKey` (el apellido en minúsculas y sin diacríticos) y la búsqueda es un rango sobre ese campo. Lo escribe la semilla; la carga del padrón de la Fundación también va a tener que escribirlo.
- **Un adherente o un miembro a cargo abre la ficha de su titular**, con el grupo familiar completo y la persona buscada resaltada.

- [x] Function de búsqueda, solo para el operador:
  - por DNI exacto (se ignoran puntos y espacios) o por prefijo de apellido sobre `lastNameKey`;
  - devuelve una lista corta, con nombre, DNI, número de asociado y si es titular;
  - lleva los índices que haga falta.
- [x] Function de ficha, solo para el operador: el titular del asociado y su grupo familiar. Cada miembro trae su estado (a cargo, sin cuenta, pendiente de aceptación, cuenta activa), con el mismo criterio que `memberStatus` de la app de Android.
- [x] La semilla escribe `lastNameKey`, también en `seed:dev`.
- [x] En la consola, un buscador arriba de la lista lleva a la ficha, y la ficha tiene el campo de código y el botón **Activar** si el titular no tiene cuenta.
- [x] Tests contra el emulador: búsqueda por DNI y por apellido (sin acentos ni mayúsculas), ficha con cada estado y desde un miembro, y `permission-denied` sin el claim.

Spec: [spec.md](../spec.md)

## Comments

- Functions: `searchAffiliates` y `affiliateRecord`. No hacen falta índices compuestos: igualdad sobre `dni`, rango y `orderBy` sobre el solo campo `lastNameKey`, igualdad sobre `holderId` e `in` sobre `affiliateId` usan los índices automáticos de un campo.
- La búsqueda devuelve hasta 20 resultados; la consola avisa cuando llega al tope.
- Diferencia con `memberStatus` de Android: la app toma la primera cuenta del asociado; la Function, si hay varias (revocadas incluidas), prefiere la activa y después la pendiente de aceptación.
- La normalización del apellido está en `searchKey` (Functions) y copiada en `scripts/seed.ts`; la carga del padrón de la Fundación tiene que escribir la misma clave.
- Activar desde la lista no actualiza una ficha abierta (se ve al volver a abrirla); activar desde la ficha sí vuelve a pedir la lista.
- 2026-11-19: recorrido en el emulador: «araoz» encuentra a la familia Aráoz; Valentina abre la ficha de Marcelo, resaltada y «A cargo»; Rosa por «17.844.390», código equivocado da «Código inválido…», el correcto deja «Cuenta activa» y la saca de la lista.
