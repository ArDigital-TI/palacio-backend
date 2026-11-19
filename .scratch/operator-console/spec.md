# Spec · Consola del operador

Status: ready-for-agent

> Esta carpeta se escribió en `palacio-android`, antes de que existiera este repo. El ticket 01 la movió acá.

## Problem Statement

El operador de Adhesiones activa las cuentas de los titulares, pero hoy solo existe dentro del panel de demo de la app de Android (variantes `demo` y `local`). En la variante `dev`, que trabaja contra el proyecto real de Firebase con cuentas reales de Google, no hay operador. Por eso ningún titular puede activarse ahí, y sin un titular activo no se puede recorrer con cuentas reales nada de lo que sigue: la vinculación de adherentes, los turnos, la asistencia ni la revocación.

Además, el MVP define al operador como usuario de una consola web interna, aparte de la app ([propuesta, líneas 64, 83 y 99](https://github.com/ArDigital-TI/Palacio_Android/blob/main/docs/mvp/propuesta-mvp-v2.md)). Esa consola no existe.

## Solution

Una **consola del operador** web, en un repo nuevo, `palacio-backend`, que también recibe el backend (`firebase/`, hoy dentro de `palacio-android`). El operador entra con su cuenta de Google. Solo puede usar la consola si tiene **acceso de operador** (el claim `operator`), que otorga un administrador con un script. El operador no tiene cuenta en el sentido del glosario: la consola nunca llama a `registerAccount`.

El primer corte de la consola usa las Functions que ya existen (`holdersWithoutAccount` y `activateHolder`) y destraba `dev`. El segundo agrega lo que pide el MVP: búsqueda en el padrón y ficha del asociado.

Vocabulario: [CONTEXT.md](../../CONTEXT.md) (**Operador**, **Consola del operador**, **Acceso de operador**).

## User Stories

### Administrador

1. Como administrador, quiero dar acceso de operador a una cuenta de Google con un comando, para que un empleado de Adhesiones pueda usar la consola.
2. Como administrador, quiero quitar el acceso de operador con un comando y que deje de valer en ese momento, para dar de baja a un operador sin esperar a que venza su sesión.

### Operador

3. Como operador, quiero entrar a la consola con mi cuenta de Google, sin otra contraseña.
4. Como operador, quiero ver un mensaje claro si mi cuenta no tiene acceso de operador, para saber que tengo que pedirlo.
5. Como operador, quiero ver los titulares que todavía no tienen cuenta, para saber a quién activar.
6. Como operador, quiero activar a un titular con el código de activación que me dicta, para vincular su cuenta con el asociado.
7. Como operador, quiero un error claro si el código no corresponde a ninguna cuenta pendiente o si el asociado ya está activo, es adherente o es miembro a cargo (los mismos errores que hoy).
8. Como operador, quiero buscar a un asociado en el padrón por DNI o apellido, para encontrarlo cuando se presenta en la sede.
9. Como operador, quiero ver la ficha del asociado con el estado de cada miembro de su grupo familiar, para saber qué falta habilitar.
10. Como operador, quiero activar al titular desde su ficha, ingresando el código.
11. Como operador, quiero cerrar sesión.

### Fundación

12. Como Fundación, quiero saber qué operador activó cada cuenta y cuándo, para poder responder un reclamo («me vincularon con otro asociado»).

### Desarrollador

13. Como desarrollador, quiero correr la consola contra el Emulator Suite con un comando, entrando con una cuenta de Google simulada que ya tiene acceso de operador, para desarrollar sin tocar el proyecto real.
14. Como desarrollador, quiero desplegar la consola a `dev` con el mismo comando que despliega las Functions, las reglas y los índices.
15. Como desarrollador, quiero recorrer todo el flujo con cuentas reales en `dev`: el titular entra en la app de Android, el operador lo activa desde la consola y el titular valida a un adherente.
16. Como desarrollador de Android, quiero que el panel de demo siga activando titulares en `demo` y `local`, para mostrar la app sola, sin levantar la consola.

## Implementation Decisions

### Repo

- Repo nuevo `ArDigital-TI/Palacio_Backend`, clonado en `D:\_DESARROLLO\palacio\palacio-backend`, al lado de `palacio-android`.
- Recibe `firebase/` **con su historial** (`git subtree split --prefix=firebase`). Lo que hoy está en `firebase/` (`functions/`, `scripts/`, `test/`, `firebase.json`, reglas e índices) queda en la raíz. La consola va en `console/`.
- `palacio-android` borra `firebase/` y actualiza su README y los enlaces que apuntaban ahí.
- El repo de backend pasa a ser la fuente del glosario (`CONTEXT.md`) y del ADR de custom claims (hoy 0002). En Android, `CONTEXT.md` queda reducido a un enlace a la fuente, y el ADR 0001 (el emulador como backend local de la app) se queda donde está.
- El primer ADR del repo nuevo explica por qué el backend y la consola comparten un repo propio, separado de Android: las Functions, las reglas y la consola cambian juntas, y van a tener más de un cliente (Android, iOS y la consola).

### Acceso de operador

- Scripts en TypeScript, con el mismo estilo que `scripts/seed.ts`:
  - `npm run grant-operator:dev -- <correo>`: busca el usuario de Auth por correo y le pone `operator: true`, conservando los otros claims.
  - `npm run revoke-operator:dev -- <correo>`: le quita `operator` y revoca sus tokens (`revokeRefreshTokens`), igual que `revoke` con los adherentes (ADR de custom claims).
  - Las mismas dos órdenes sin `:dev` apuntan al emulador.
- El usuario tiene que existir: se crea la primera vez que la persona entra a la consola con Google. El script falla con un mensaje claro si no lo encuentra.
- Credenciales para `dev`: las mismas que `seed:dev` (`gcloud auth application-default login` o `GOOGLE_APPLICATION_CREDENTIALS`).

### Registro de la activación

- `activateHolder` guarda en la cuenta `activatedBy` (el uid del operador) y `activatedAt` (milisegundos epoch, como los demás instantes del esquema), en la misma transacción que la activa.
- No hay pantalla para consultarlo en esta etapa.

### Consola

- Vite + React + TypeScript + el SDK web de Firebase (Auth y Functions). No hay servidor propio: las Functions cumplen ese papel.
- Se despliega con Firebase Hosting, desde el mismo `firebase.json`. `npm run deploy:dev` incluye `hosting`.
- Entrada:
  - Con Google (`signInWithPopup`). Al volver, la consola lee el claim `operator` del token.
  - Sin el claim, muestra «Sin acceso de operador» con el correo de la cuenta y un botón para salir.
  - Nunca llama a `registerAccount`.
- Primer corte: una sola pantalla con la lista de titulares sin cuenta (`holdersWithoutAccount`). Cada titular tiene un campo para el código y un botón **Activar** (`activateHolder`). Al activar, la lista se actualiza. Los errores de dominio se muestran con el mismo texto que en la app de Android.
- Segundo corte: búsqueda por DNI o apellido y ficha del asociado con su grupo familiar. Cada miembro aparece con su estado, el mismo que en la app (a cargo, sin cuenta, pendiente de aceptación, cuenta activa). Requiere Functions nuevas, solo para el operador.
- Configuración:
  - Contra el emulador se conecta a `localhost`.
  - Contra `dev` toma los valores del proyecto de variables de entorno de Vite (`.env.dev`, fuera del repo).
- Aspecto:
  - Los tokens de color y tipografía (Nunito) del mockup ([`docs/design/prototype.html`](https://github.com/ArDigital-TI/Palacio_Android/blob/main/docs/design/prototype.html) en Android), sin un sistema de componentes.
  - En español y pensada para escritorio, pero usable en tablet.

### Emulador

- `npm run console` levanta Vite contra el Emulator Suite, que se levanta aparte con `npm run emulators`, como hoy.
- La semilla agrega un usuario operador **con proveedor Google** (por ejemplo `operadora.google@palacio.test`, con `operator: true`), para que el popup de Google del emulador lo ofrezca. Conserva `operador@palacio.test`, con correo y contraseña, porque lo usa el panel de demo de Android en `local`.

### Android

- El panel de demo conserva su sección de operador en `demo` y `local`. En `dev` sigue oculta.
- Fuera del cambio de repo, la app no cambia.

## Testing Decisions

- **Qué es un buen test:** el comportamiento visible desde afuera, igual que en el backend actual.
- **Backend:** tests en TypeScript contra el emulador, en `test/`, con el mismo estilo que los de hoy:
  - `activateHolder` guarda `activatedBy` y `activatedAt`.
  - Las Functions nuevas del segundo corte solo responden al operador y devuelven lo esperado.
  - Quitar el acceso deja a la cuenta sin poder llamar a `activateHolder` una vez actualizado el token.
- **Scripts de acceso:** se prueban a mano contra el emulador y contra `dev` (dar, comprobar que entra, quitar, comprobar que ya no entra).
- **Consola:** sin tests automáticos en esta etapa. Se verifica recorriéndola contra el emulador y contra `dev`. Si después crece la lógica de la UI (la ficha, los estados), se agregan tests de componentes.

## Out of Scope

- Producción: no hay proyecto de producción todavía. La consola existe en el emulador y en `dev`.
- Gestionar operadores desde la consola: dar y quitar acceso es solo por script.
- Restringir la entrada a un dominio de Google Workspace.
- Pantalla de auditoría (quién activó qué): solo se guardan los datos.
- Activar adherentes o revocar desde la consola: eso lo hace el titular desde su app.
- Cargar o editar el padrón: lo hace el sistema de la Fundación.
- La app de iOS.

## Further Notes

- Riesgo del ticket 02: crear con el Admin SDK un usuario del emulador de Auth con proveedor Google (`importUsers` con `providerData`) y que el popup de Google del emulador lo ofrezca. Si no funciona, alcanza con entrar con cualquier correo simulado y darle acceso con `npm run grant-operator -- <correo>`.
- La lista de `holdersWithoutAccount` sale en el orden de los ids de Firestore (ver el ticket 03 de `firebase-backend`). En la consola conviene ordenarla por apellido.
