# Backend Firebase

Auth, Firestore y Cloud Functions de la app de los asociados ([palacio-android](https://github.com/ArDigital-TI/Palacio_Android)), para correr en el Emulator Suite (proyecto `demo-palacio`) y en el proyecto real `dev`. Ver el [ADR 0001 de Android](https://github.com/ArDigital-TI/Palacio_Android/blob/main/docs/adr/0001-firebase-emulators-as-local-backend.md) y, por qué es un repo aparte, el [ADR 0001](docs/adr/0001-backend-and-operator-console-in-own-repo.md).

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

La variante `local` se conecta sola a `10.0.2.2`, la PC vista desde el emulador de Android. Para un teléfono físico en la misma red, agregue la IP de la PC en `local.properties` del repo de Android:

```properties
palacio.emulatorHost=192.168.0.10
```

## Proyecto real de desarrollo (variante `dev`)

La variante `dev` entra con una cuenta real de Google contra un proyecto real de Firebase. Las Functions, las reglas y los índices son los mismos que en el emulador. La configuración del proyecto va en `local.properties`, que no se sube al repo.

### Una sola vez, en la consola de Firebase

1. Crear el proyecto (por ejemplo `palacio-dev`) y pasarlo al plan **Blaze**, porque las Functions lo necesitan.
2. **Firestore Database**: crear la base `palacio-app` (el nombre que usan las Functions y la app) en modo producción. Las reglas se despliegan después.
3. **Authentication → Sign-in method**: habilitar **Google**. En la configuración del proveedor, copiar el **ID de cliente web** (Web client ID).
4. **Configuración del proyecto → Tus apps**: agregar una app Android con:
   - paquete `com.fundacionpalacio.asociados.dev`;
   - el **SHA-1** de la firma de debug, que sale de `.\gradlew.bat signingReport` (en la variante `devDebug`).

   Bajar el `google-services.json`. No se agrega al proyecto: solo se usa para leer los valores del paso siguiente.
5. Agregar los valores a `local.properties`, en la raíz del repo de Android:

   ```properties
   palacio.dev.projectId=<project_info.project_id>
   palacio.dev.appId=<client[0].client_info.mobilesdk_app_id>
   palacio.dev.apiKey=<client[0].api_key[0].current_key>
   palacio.dev.webClientId=<el ID de cliente web del paso 3>
   ```

### Desplegar y cargar los datos de prueba

Desde la raíz de este repo:

```powershell
npx firebase login
npx firebase use --add      # elegir el proyecto y ponerle el alias dev
npm run deploy:dev          # Functions, reglas e índices
```

La primera vez, `deploy:dev` habilita las APIs que faltan (Cloud Functions, Cloud Build, Artifact Registry) y puede tardar varios minutos.

`npm run seed:dev` carga los asociados, el catálogo, la configuración y los turnos de prueba. No carga cuentas ni usuarios: las cuentas se crean al entrar con Google. Antes hace falta tener credenciales de Google Cloud, de una de estas dos formas:
- con `gcloud auth application-default login`;
- con una clave de cuenta de servicio, poniendo su ruta en `GOOGLE_APPLICATION_CREDENTIALS`.

### La app

En el repo de Android:

```powershell
.\gradlew.bat installDevDebug
```

El dispositivo necesita Google Play y una cuenta de Google iniciada. En `dev` no está el panel de demo y el botón de Apple está deshabilitado. Al entrar por primera vez, la app muestra la cuenta pendiente con su código de activación.
