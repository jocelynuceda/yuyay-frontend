# Revisión del resumen de una cita (#51)

## Recorrido

Web usa /people/:id/consultations/:consultationId/summary desde cada cita.
El flujo móvil abre NewHandoff con consultationId y conserva la creación manual
cuando ese parámetro falta. Ambas plataformas permiten seleccionar registros,
editar motivo y preguntas y revisar todo el contenido antes de validar.

GET /api/v1/consultations/{id}/preparation conserva consultationId,
careSubjectId, reason, preparationToken y categories. Cada entrada conserva
entryId, versionId y el objeto version que se muestra. La selección inicial
incluye todas las propuestas, en el orden del servidor. Se admite una propuesta
o selección vacía.

POST /api/v1/consultations/{id}/preparation/confirm envía requestId UUID,
preparationToken exacto, reason, questions (null si está vacío) y entries
con entryId/versionId. Nunca se reconstruyen versiones desde el listado general.
La creación manual conserva su endpoint anterior.

## Errores y reintentos

400 muestra la validación y permite corregir. 401 sigue la sesión existente.
403/404 ocultan los datos de la preparación y explican el problema.
409 vuelve a consultar la preparación, conserva texto y exclusiones de entradas
que siguen existiendo y exige otra revisión antes de usar la nueva versión.

Red, timeout y respuestas inciertas bloquean las modificaciones del intento.
Reintentar envía exactamente el mismo cuerpo y requestId. En web, el intento permanece en memoria de la sesión autenticada, asociado a
persona y cita. Atrás y los enlaces pueden salir de la vista; al volver, el mismo
modelo recupera el POST pendiente o su resultado. No se vuelve a preparar ni se
genera otra clave. La cuenta cambia de ámbito al cerrar sesión, eliminando los
datos privados anteriores. En móvil se mantiene la protección de navegación existente.

Antes de enviar se escribe únicamente una marca genérica con valor 1 en
localStorage (yuyay.summary-history-check-required). No contiene identidad,
cita, requestId, token, selección ni texto médico. Esta marca sobrevive a recargas,
cierres de pestaña y reinicios del navegador para advertir que debe comprobarse
el historial antes de iniciar una revisión nueva. No permite recuperar el cuerpo
original tras perder la memoria del documento. Si el almacenamiento está
bloqueado, se exige esa comprobación de forma conservadora. El navegador recibe
un aviso beforeunload mientras exista un guardado pendiente; puede ignorarlo
según sus políticas, por lo que la marca y el aviso posterior son necesarios.

Después del guardado se muestra la respuesta HandoffDetail completa.
Web ofrece volver al historial y generar un enlace mediante el formulario
existente. Móvil abre HandoffView para consultar y compartir con el flujo
existente. Ninguna confirmación crea un enlace automáticamente.

## Verificación reproducible

Web ejecuta npm test, npm run lint y npm run build.
Móvil ejecuta npm test, npm run typecheck y npm run lint.
Las pruebas de estado usan el mismo modelo que las pantallas. Las pruebas
web renderizan la vista en JSDOM y simulan la API mediante Axios adapters.
Las pruebas móviles de esta entrega no ejecutan una interfaz nativa.

La comprobación HTTP real está en web/tests/integration/consultation-summary.ts.
Sólo acepta YUYAY_SUMMARY_TEST_URL=http://127.0.0.1:18068.
Desde web, con el backend #68 ya arrancado en una instancia local aislada,
ejecutar en PowerShell:

```powershell
$env:YUYAY_SUMMARY_TEST_URL = 'http://127.0.0.1:18068'
./node_modules/.bin/tsx.cmd --tsconfig tsconfig.test.json --import ./tests/vite-env.mjs tests/integration/consultation-summary.ts
Remove-Item Env:YUYAY_SUMMARY_TEST_URL
```

Crea únicamente datos ficticios en esa instancia. Verifica preparación vacía,
selección con registros, conflicto real de versión, nueva revisión, guardado,
reapertura y contenido público congelado. Para la recuperación idempotente
descarta una respuesta HTTP exitosa en el cliente y repite la misma operación.
Esa pérdida se simula; las peticiones y la persistencia del servidor son reales.

## Prueba manual pendiente

- Web con teclado y tamaños de teléfono/escritorio.
- Android/iOS con la app y el backend #68 accesible desde el dispositivo.
- Volver desde una consulta, excluir registros, editar texto y cancelar.
- Cambiar un registro desde otra sesión entre revisión y guardado.
- Recuperar una escritura incierta con el mismo botón de reintento.
- Reabrir desde el historial, compartir después y comprobar el destinatario.
- Tras una interrupción completa de la app, revisar el historial antes de crear
  otra operación.

Se conserva React Navigation en el móvil existente. No se añaden dependencias
nativas ni se migra el sistema de rutas. El requestId usa UUID v4, con crypto
cuando está disponible y generación aleatoria local en el runtime nativo.


## Coordinación del PR #62

Revisión del 21-nov-2026: #62 continúa abierto, head 1265b51.
No se integra anticipadamente su rama. Sigue pendiente resolver al fusionarlo
en main la zona footer de mobile/src/screens/ConsultationsScreen.tsx.
Debe conservar tanto Preparar resumen como LocalReminderToggle y sus imports.
El PR #64 sigue dependiendo del contrato de backend #80, todavía abierto.

Las nuevas regresiones web usan BrowserRouter, historia de JSDOM y StrictMode.
Cubren respuesta perdida tras un guardado, Atrás, enlaces internos, reapertura,
reintento con clave y cuerpo idénticos, doble clic, recuperación del resultado,
marca de reinicio, cancelación, 409 y pérdida de autorización.
