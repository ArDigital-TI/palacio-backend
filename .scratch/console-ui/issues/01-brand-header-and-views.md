# 01: Encabezado de marca y las dos vistas

**What to build:** El esqueleto nuevo de la consola. Un encabezado con el color y el isotipo de Palacio, y dos pestañas: **Atención** (`#/`), con el buscador y la ficha, y **Titulares sin cuenta** (`#/pendientes`), con la lista y el alta de titular de prueba. Los botones atrás y adelante del navegador pasan de una vista a la otra.

**Blocked by:** —

**Status:** done

- [x] `isotipo-palacio-v2.svg` copiado a `console/public/` desde `palacio/mockup/docs/design/brand/`.
- [x] Encabezado como la variante A del prototipo:
  - barra con el color de marca;
  - el isotipo sobre fondo blanco;
  - «Palacio · Consola del operador»;
  - las pestañas;
  - el correo del operador y Salir.
- [x] Vista según `location.hash` y `hashchange`, sin router. Un hash desconocido muestra Atención.
- [x] Atención: tarjeta «¿A quién atiende?» con el buscador más grande, los resultados como lista de botones y la ficha como hasta ahora.
- [x] Titulares sin cuenta: `CreateHolder` y `Holders`, sin cambios de comportamiento.
- [x] Al activar desde la ficha, la lista se vuelve a pedir al ir a su pestaña (hoy lo hace `holdersVersion`).
- [x] Recorrido en el emulador, en claro y en oscuro.

Spec: [spec.md](../spec.md) · Referencia visual: rama `prototype/console-ui`, `?variant=A`.

## Comments

- 2026-11-19: hecho. Atención queda montada (oculta) para no perder la búsqueda ni la ficha al cambiar de pestaña; el alta también. `Holders` se monta al entrar a su pestaña, y así se vuelve a pedir después de activar desde la ficha. A 375 px, la tabla de «Titulares sin cuenta» todavía desborda unos 17 px: queda para cuando se rediseñe esa vista (fuera de alcance).
