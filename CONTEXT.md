# Asociados de la Fundación Palacio

App con la que los asociados de la Fundación piden asistencia, sacan turnos médicos y de estudios y muestran su credencial. El acceso se habilita en persona, en la sede, a partir del padrón de la Fundación.

## Personas

**Asociado**:
Persona registrada en el padrón de la Fundación, tenga o no cuenta en la app.
_Avoid_: afiliado (solo como nombre en el código), usuario, socio

**Titular**:
Asociado que contrató el plan y encabeza el grupo familiar.
_Avoid_: dueño, cliente

**Adherente**:
Asociado mayor de 18 años del grupo familiar de un titular, con cuenta propia.

**Miembro a cargo**:
Asociado menor de 18 años del grupo familiar. No tiene cuenta propia: lo gestiona el titular.
_Avoid_: menor, dependiente

**Operador**:
Empleado del área de Adhesiones de la Fundación que activa las cuentas de los titulares. No tiene cuenta: trabaja desde la consola del operador.
_Avoid_: admin, back-office

**Consola del operador**:
Herramienta web interna con la que el operador activa las cuentas de los titulares. Es aparte de la app de los asociados.
_Avoid_: back-office, panel de admin

**Acceso de operador**:
Permiso para usar la consola del operador. Lo otorga un administrador del sistema; nadie lo pide desde la consola.

## Acceso

**Cuenta**:
Identidad de una persona en la app, vinculada a un asociado una vez habilitada. Es distinta del asociado: puede existir antes de saber quién es.
_Avoid_: usuario, perfil

**Cuenta pendiente**:
Cuenta recién creada en el primer ingreso, todavía sin asociado vinculado.

**Código de activación**:
Código de 4 dígitos de una cuenta pendiente que el titular le dicta al operador para que la active.

**Token de vinculación**:
Credencial de duración limitada que el adherente le muestra a su titular (como QR o enlace) para que lo valide.
_Avoid_: código QR, invitación

**Validación**:
Paso en que el titular reconoce a un adherente leyendo su token de vinculación. Después, el adherente acepta y su cuenta queda activa.

**Revocación**:
Paso en que el titular le quita el acceso a un adherente.
