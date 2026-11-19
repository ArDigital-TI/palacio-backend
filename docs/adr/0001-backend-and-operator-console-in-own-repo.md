# El backend y la consola del operador viven en un repo propio

El backend (Functions, reglas e índices de Firestore, semilla y tests) y la consola del operador viven en `palacio-backend`, separados de la app de Android. El backend salió de `palacio-android/firebase/` con su historial (`git subtree split`).

Las Functions, las reglas y la consola cambian juntas: una Function nueva para el operador trae su regla, su test y su pantalla en la consola. Además, el backend va a tener más de un cliente (Android, iOS y la consola), así que no pertenece al repo de ninguno de ellos.

Descartamos un monorepo con todo: mezclaría Gradle, Node y Xcode en un mismo árbol, con herramientas, CI y ritmos de cambio distintos.

## Consecuencias

- Este repo es la fuente del glosario (`CONTEXT.md`) y de las decisiones que tocan el backend (ADR 0002, custom claims). En Android quedan como enlaces.
- El ADR 0001 de Android (los emuladores de Firebase como backend local) se queda allá: es una decisión de cómo la app se conecta en desarrollo.
- Un cambio que toca la app y el backend a la vez son dos commits, uno en cada repo.
