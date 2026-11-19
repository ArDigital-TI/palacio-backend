# Backend Firebase

Auth, Firestore y Cloud Functions de la app de los asociados ([palacio-android](https://github.com/ArDigital-TI/Palacio_Android)), para correr en el Emulator Suite (proyecto `demo-palacio`) y en el proyecto real `dev`. Ver el [ADR 0001 de Android](https://github.com/ArDigital-TI/Palacio_Android/blob/main/docs/adr/0001-firebase-emulators-as-local-backend.md) y, por qué es un repo aparte, el [ADR 0001](docs/adr/0001-backend-and-operator-console-in-own-repo.md).

Requiere Node 22 o posterior y Java 21. La primera vez:

```powershell
npm install; npm --prefix functions install; npm --prefix console install
```

| Comando | Qué hace |
|---|---|
| `npm run emulators` | Compila las Functions y levanta los emuladores. Consola en http://localhost:4000. |
| `npm run seed` | Con los emuladores levantados: borra todo y carga los datos de prueba. |
| `npm test` | Levanta emuladores propios, corre los tests de `test/` y los apaga. |
| `npm run console` | Con los emuladores levantados: la consola del operador en http://localhost:5173. |
| `npm run grant-operator -- <correo>` | Con los emuladores levantados: le da el acceso de operador (`operator: true`) al usuario con ese correo, sin tocar sus otros claims. |
| `npm run revoke-operator -- <correo>` | Le quita el acceso de operador y revoca sus tokens: deja de valer en ese momento. |

Los usuarios de prueba son las personas de la demo (Marcelo, Silvia, Facundo y Rosa) y `operador@palacio.test`, todos con la contraseña `palacio-demo`. Además, `operadora.google@palacio.test` es operador y entra con Google, para la consola del operador.

El usuario tiene que existir en Auth: se crea la primera vez que la persona entra a la consola con Google. Si no existe, `grant-operator` termina con error. En el emulador se puede entrar con cualquier correo simulado en el popup de Google y después darle el acceso con `grant-operator`.

## La consola del operador

`console/` es una página web (Vite, React y el SDK web de Firebase) donde el operador de Adhesiones entra con Google y activa a los titulares con su código. Solo entra quien tiene el acceso de operador; el resto ve «Sin acceso de operador». En el emulador, el popup de Google ofrece a `operadora.google@palacio.test`.

La consola también busca en el padrón por DNI o apellido, muestra la ficha del grupo familiar y, mientras el padrón no llega del sistema de la Fundación, da de alta titulares de prueba con su correo y su teléfono.

Un titular se activa solo si el código es válido **y** la cuenta de Google con que entró es la del correo que tiene en el padrón. En el emulador, entre en la app con el mismo correo del titular de la semilla (por ejemplo `rosa.quispe@correo.com`); en `dev`, los titulares de la semilla tienen correos inventados, así que se prueba con titulares dados de alta desde la consola con el correo real.

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
6. Para la consola del operador, registrar una app web y copiar su configuración a `console/.env.dev` (no se sube al repo; el formato está en `console/.env.example`):

   ```powershell
   npx firebase apps:create web consola --project dev
   npx firebase apps:sdkconfig web --project dev
   ```

   En **Authentication → Settings → Authorized domains** tienen que figurar `<proyecto>.web.app` y `<proyecto>.firebaseapp.com`, los dominios de Hosting. Vienen así por defecto.

### Desplegar y cargar los datos de prueba

Desde la raíz de este repo:

```powershell
npx firebase login
npx firebase use --add      # elegir el proyecto y ponerle el alias dev
npm run deploy:dev          # Functions, reglas, índices y la consola (Hosting)
```

La consola queda en `https://<proyecto>.web.app`. El build falla si falta `console/.env.dev`.

La primera vez, `deploy:dev` habilita las APIs que faltan (Cloud Functions, Cloud Build, Artifact Registry) y puede tardar varios minutos.

`npm run seed:dev` carga los asociados, el catálogo, la configuración y los turnos de prueba. No carga cuentas ni usuarios: las cuentas se crean al entrar con Google. Antes hace falta tener credenciales de Google Cloud, de una de estas dos formas:
- con `gcloud auth application-default login`;
- con una clave de cuenta de servicio, poniendo su ruta en `GOOGLE_APPLICATION_CREDENTIALS`.

Con esas mismas credenciales, `npm run grant-operator:dev -- <correo>` y `npm run revoke-operator:dev -- <correo>` dan y quitan el acceso de operador en `dev`. La persona tiene que haber entrado antes una vez a la consola con su cuenta de Google. Si fallan con `Identity Toolkit API has not been used in project …` y el proyecto que nombran no es el de `dev`, las credenciales cargan la cuota a otro proyecto: `gcloud auth application-default set-quota-project <id del proyecto dev>`.

### La app

En el repo de Android:

```powershell
.\gradlew.bat installDevDebug
```

El dispositivo necesita Google Play y una cuenta de Google iniciada. En `dev` no está el panel de demo y el botón de Apple está deshabilitado. Al entrar por primera vez, la app muestra la cuenta pendiente con su código de activación.
