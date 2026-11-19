# La ficha muestra el correo del padrón del titular

`affiliateRecord` devolvía solo los datos mínimos del padrón: nombre, DNI, edad y estado de cada miembro, más el número y el plan del titular. Ahora también devuelve el correo que el padrón tiene para el titular, y la ficha de la consola lo muestra.

El correo es lo que decide si una activación pasa (desde el ticket 07 de `operator-console`, la cuenta de Google del titular tiene que ser la del padrón). Cuando la consola dice que el correo no coincide, el operador necesita leérselo al titular para saber si eligió otra cuenta de Google o si el padrón está mal. Sin el correo en pantalla, solo puede adivinar.

Descartamos mostrar también el teléfono, porque no ayuda a activar a nadie, y mostrar el correo enmascarado, porque el operador tiene que poder compararlo letra por letra con lo que dice el titular.

## Consecuencias

- Solo lo ve quien tiene el acceso de operador: `affiliateRecord` ya exige el claim `operator`.
- El correo de los miembros del grupo familiar no se devuelve; solo el del titular.
