# Spec · Mejoras de la UI de la consola del operador

Status: done

## Problem Statement

La consola del operador funciona, pero se ve escueta. No tiene logo ni identidad, todas las tarjetas pesan igual y todo está apilado en una sola página: el buscador, el alta de titular de prueba y la lista de titulares sin cuenta. En el mostrador, el operador busca al titular que tiene adelante, pero la página le da el mismo lugar a la lista, que con el padrón real va a tener cientos de filas.

Además:
- Cuando el correo de la cuenta no coincide con el del padrón, el operador no tiene el correo del padrón en pantalla para compararlo con el que dice el titular.
- Después de un error, el código equivocado queda cargado en el campo.
- Después de activar, no hay un paso claro para atender al siguiente.

## Solution

La consola pasa a tener dos vistas con pestañas en un encabezado de marca. Es la variante A del prototipo («Encabezado de marca»): rama `prototype/console-ui`, commit `0510863`, y el veredicto está en el commit siguiente.

- **Atención** (`#/`): el buscador, los resultados y la ficha. Es la vista del mostrador.
- **Titulares sin cuenta** (`#/pendientes`): la lista actual y el alta de titular de prueba.

La ficha se divide en dos columnas: el grupo familiar a la izquierda y un panel de **Activación** a la derecha. La ficha muestra también el correo del padrón del titular ([ADR 0003](../../docs/adr/0003-record-shows-padron-email.md)).

Vocabulario: [CONTEXT.md](../../CONTEXT.md) (**Atención**, **Ficha**, **Código de activación**).

## User Stories

1. Como operador, quiero ver la consola con el logo y los colores de Palacio, para que se sienta parte del mismo producto que la app.
2. Como operador, quiero que la vista del mostrador tenga solo lo que uso para atender: buscar, ver la ficha y activar.
3. Como operador, quiero pasar a «Titulares sin cuenta» con una pestaña, y que los botones atrás y adelante del navegador me lleven entre las vistas.
4. Como operador, quiero ver en la ficha el correo del padrón del titular, para leérselo cuando la consola dice que el correo no coincide.
5. Como operador, quiero que un error de activación aparezca como un aviso destacado con un botón «Entendido». Al tocarlo, se cierra el aviso, se borra el código y el cursor queda en el campo, para que el titular vuelva a dictarlo. Mientras el aviso está abierto, Activar está bloqueado.
6. Como operador, quiero que después de activar aparezca un aviso grande de éxito con un botón «Atender a otro», que vacía el buscador y deja el cursor ahí.

## Implementation Decisions

- **Encabezado:** barra con el color de marca (`--accent` en claro, un verde más oscuro en modo oscuro), el isotipo de Palacio sobre fondo blanco, «Palacio · Consola del operador», las dos pestañas, el correo del operador y Salir. El isotipo es `isotipo-palacio-v2.svg` de `palacio/mockup/docs/design/brand/`, la misma versión que usa la app de Android, y se copia a `console/public/`.
- **Vistas:** con el hash de la URL (`#/` y `#/pendientes`) y un listener de `hashchange`, sin agregar un router.
- **Atención:**
  - Una tarjeta «¿A quién atiende?» con el buscador más grande.
  - Los resultados como lista de botones, en vez de tabla.
  - Al abrir una ficha, los resultados se ocultan y queda «← Volver a los resultados».
- **Ficha:** dos columnas.
  - A la izquierda: el nombre, la línea del titular (DNI, N.º, plan), el correo del padrón y la tabla del grupo familiar con la persona buscada resaltada.
  - A la derecha, un panel «Activación». Si el titular no tiene cuenta, muestra el campo del código (grande) y Activar. Si ya la tiene, muestra su estado.
  - En pantallas angostas, una sola columna.
- **Avisos:**
  - El de error y el de éxito, con ícono, reemplazan las líneas `msg-error` y `msg-ok` de la activación.
  - Funcionan igual en la ficha y en la lista de «Titulares sin cuenta», porque las dos usan `ActivationForm`.
  - El mensaje de éxito de la lista puede seguir siendo una línea, porque ahí no hay un siguiente titular que atender.
- **`affiliateRecord`:**
  - Devuelve `holder.email`, el correo del padrón normalizado como lo compara `activateHolder`.
  - No devuelve el correo de los miembros ni el teléfono.
  - Esto revierte lo que decidió el ticket 05 de `operator-console` («Sin teléfono, correo…»).
- **Errores al buscar y al cargar:** siguen como hoy (`msg-error`). El aviso con «Entendido» es solo para la activación.
- El prototipo es la referencia visual (`console/src/prototype/` en la rama). Su código no se copia: se reescribe sobre los componentes actuales.

## Testing Decisions

- **Backend:** el test de `affiliateRecord` en `test/` comprueba que el titular trae `email` y que los miembros no lo traen.
- **Consola:** sin tests automáticos, como hasta ahora. Se verifica recorriéndola contra el emulador: buscar, ver el error con «Entendido», activar y «Atender a otro», las dos pestañas con atrás y adelante, y los modos claro y oscuro.

## Out of Scope

- Rediseñar la vista «Titulares sin cuenta» más allá de mudarla y darle el encabezado nuevo.
- Las variantes B y C del prototipo.
- Un selector manual de tema claro u oscuro: la consola sigue al sistema.
- Paginar o filtrar la lista de titulares sin cuenta.
