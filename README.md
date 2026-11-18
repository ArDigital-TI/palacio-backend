# Backend Firebase

Auth, Firestore y Cloud Functions de la app, para correr en el Emulator Suite (proyecto `demo-palacio`). Ver [ADR 0001](../docs/adr/0001-firebase-emulators-as-local-backend.md).

Requiere Node 22 o posterior y Java 21. La primera vez:

```powershell
npm install; npm --prefix functions install
```

| Comando | Qué hace |
|---|---|
| `npm run emulators` | Compila las Functions y levanta los emuladores. Consola en http://localhost:4000. |
| `npm run seed` | Con los emuladores levantados: borra todo y carga los datos de prueba. |
| `npm test` | Levanta emuladores propios, corre los tests de `test/` y los apaga. |

Los usuarios de prueba son las personas de la demo (Marcelo, Silvia, Facundo y Rosa) y `operador@palacio.test`, todos con la contraseña `palacio-demo`.

## La app contra el emulador

La variante `local` se conecta sola a `10.0.2.2`, la PC vista desde el emulador de Android. Para un teléfono físico en la misma red, agregue la IP de la PC en `local.properties`:

```properties
palacio.emulatorHost=192.168.0.10
```
