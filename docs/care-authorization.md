# Declaraciones de autorización por perfil

Al agregar una persona, el usuario elige perfil propio, ficticio o de otra persona. El formulario toma el texto y la versión de `GET /api/v1/care-subjects/authorization-policy`. Para un tercero se muestra la pregunta y tres opciones de selección única. La declaración afirmativa se confirma en una casilla independiente. Si el usuario elige la opción pendiente, el formulario conserva los datos localmente y permite volver. Ninguna petición crea un perfil pendiente o habilita el uso de sus datos.

## Crear el perfil

El formulario envía los campos básicos, `requestId` y `declaration: { type, textVersion, confirmed: true }` a `POST /api/v1/care-subjects`. Se valida el alcance de la opción del catálogo antes de permitir el envío. El backend guarda el texto y el alcance registrados para esa versión.

Si se pierde la respuesta o hay un error de servidor, «Comprobar guardado» repite el cuerpo y el identificador anteriores. Mientras se comprueba, el formulario conserva los campos e impide editarlos. Tras un rechazo confirmado, un cuerpo idéntico conserva la clave y un cambio requiere otra clave. Ante un 409 se vuelve a consultar el catálogo y se pide confirmación otra vez. Si el usuario decide salir cuando el resultado es incierto, el aviso le pide revisar la lista de personas antes de repetir la creación. La solicitud pendiente se conserva mientras el formulario siga abierto.

## Consultar el estado

El perfil consulta `GET /api/v1/care-subjects/{id}/authorization-declarations` para el cuidador principal. Muestra el tipo, el alcance y la versión que registró el backend cuando hay historial. Una respuesta vacía se muestra como «Sin declaración registrada». Un fallo de lectura ofrece reintento. El texto del historial diferencia la declaración de una comprobación de autorización.

Los perfiles previos conservan sus permisos conforme al contrato #69. La creación de perfiles requiere desplegar el cliente actualizado y el backend compatible en una transición coordinada.

## Comprobación

Usa perfiles sintéticos. Prueba perfil propio, ficticio, permiso del titular y representación legal. En el formulario de un tercero, comprueba que elegir cada opción desmarca la anterior y que pasar por «Todavía no tengo autorización o no estoy seguro» oculta la confirmación y conserva el formulario. Observa que no se envía POST.

Simula una respuesta perdida después de guardar y verifica que «Comprobar guardado» conserva cuerpo y clave. Simula una versión desactualizada y comprueba que se mantienen los campos y la opción, con una nueva confirmación y clave para la nueva versión.

Abre un perfil previo y otro creado con declaración con una cuenta principal. Repite como cuidador y verifica que el cliente no solicita el historial. Comprueba navegación Atrás y controles con TalkBack y VoiceOver en los dispositivos de prueba.
