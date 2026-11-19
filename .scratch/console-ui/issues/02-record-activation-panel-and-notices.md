# 02: Ficha en dos columnas, con el panel de activación y los avisos

**What to build:** La ficha pasa a tener dos columnas: el grupo familiar a la izquierda y el panel **Activación** a la derecha. Los errores de activación aparecen como un aviso con «Entendido», que cierra el aviso, borra el código y deja el cursor en el campo. Después de activar desde la ficha, aparece un aviso de éxito con «Atender a otro».

**Blocked by:** 01

**Status:** done

- [x] Ficha en dos columnas. En pantallas angostas, una sola.
  - A la izquierda: el nombre, la línea del titular y la tabla del grupo familiar.
  - A la derecha, el panel «Activación». Si el titular no tiene cuenta, el campo del código (grande) y Activar. Si la tiene, su estado.
- [x] `ActivationForm`: el error se muestra como un aviso (ícono, texto y botón «Entendido»).
  - El aviso tiene el foco al aparecer.
  - Mientras está abierto, el campo y Activar quedan deshabilitados.
  - «Entendido» cierra el aviso, borra el código y pone el foco en el campo.
  - Vale para todos los errores de activación (los de dominio, el de correo y el inesperado), en la ficha y en la lista de Titulares sin cuenta.
- [x] Al activar desde la ficha, aparece el aviso «Cuenta activada · <nombre> ya puede usar la app.» con «Atender a otro». Ese botón cierra la ficha, vacía el buscador y los resultados, y pone el foco en el buscador.
- [x] En la lista de Titulares sin cuenta, el éxito sigue siendo una línea.
- [x] Recorrido en el emulador: código equivocado, «Entendido», el código correcto y «Atender a otro».

Spec: [spec.md](../spec.md) · Referencia visual: rama `prototype/console-ui`, `?variant=A`.

## Comments

- 2026-11-19: hecho. Recorrido en el emulador, en claro, en oscuro y a 375 px. En la ficha de Rosa: con el código de la cuenta de Silvia aparece el aviso de correo; con «Entendido» se borra el código y el cursor vuelve al campo; con su propio código aparece «Cuenta activada», y «Atender a otro» deja el buscador vacío y con el cursor. En la lista, el aviso de error funciona igual. Si el titular ya tiene cuenta, el panel dice «El titular ya tiene cuenta: <estado>».
