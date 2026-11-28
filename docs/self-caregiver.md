# Perfil propio y red de cuidado

## Cambios
El backend crea el perfil propio y la relación PRINCIPAL activa durante el registro por correo y Google. Web y Mobile muestran exclusivamente GET /care-subjects; no insertan filas artificiales.

En Mobile solo el vacío de Personas a tu cuidado usa showIcon=false. Conserva textos, botón y estilo, con padding vertical 22. Otros vacíos y estrellas decorativas se mantienen. Carga, error y lista vacía son estados distintos. El cambio de sesión solicita la red nueva y descarta respuestas anteriores.

## Compatibilidad y privacidad
Requiere feat/default-self-principal-caregiver del backend. No cambian contratos ni endpoints. Las cuentas anteriores no reciben perfiles por coincidencia de nombre; su lista vacía sigue siendo válida. Web conserva su diseño.

Una entrega solo puede sustituir un perfil automático sin uso. Con información o actividad se responde 409 para revisión manual, sin borrar el historial.

## Pruebas
Los tests de EmptyState renderizan el componente real con adaptadores nativos exclusivos de pruebas. Cubren ausencia de estrella y contenedor, padding, textos/acción y conservación de otras decoraciones.
PeopleRoute prueba el perfil devuelto por la API, contador, apertura, acción Agregar persona, error/vacío y aislamiento entre cuentas.
El helper de integración HTTP comprueba el perfil PRINCIPAL y su identificador estable después de iniciar sesión.

## Verificación manual
Registrar una cuenta ficticia, comprobar contador y perfil, abrirlo, agregar un familiar y cambiar de cuenta. Con una cuenta antigua cuya lista esté vacía, comprobar textos y botón sin estrella en el vacío de Home.
Google real y dispositivos Android/iOS requieren comprobación manual aparte.

## Resultados ejecutados (28/11/2026)
- Web: npm ci respetó el lockfile; npm test: 344/344; npm run lint y npm run build: correctos.
- Mobile: npm test: 150/150; npm run typecheck y npm run lint: correctos.
- Expo export: Android, iOS y web generados correctamente en una carpeta temporal.
- Integración: npm run test:integration contra backend local H2: correcta. Incluye registro/perfil propio, entrega, roles, historial, resumen, conflictos y respuesta perdida.
- No se dispone de adb/emulador en este entorno; no se generaron capturas de un dispositivo nativo ni se verificó Google real.

## Archivos del cambio
- mobile/src/components/EmptyState.tsx
- mobile/src/screens/HomeScreen.tsx
- mobile/src/hooks/useSubjectAccess.ts
- mobile/src/utils/careNetworkState.ts
- mobile/tests/client.test.ts
- mobile/tests/peopleEmptyState.test.ts
- mobile/tests/support/native-empty-state.mjs
- web/src/pages/people/PeopleGrid.tsx
- web/tests/profile-claim.test.tsx
- web/tests/self-care-network.test.tsx
- web/tests/integration/support/auth.ts
- docs/self-caregiver.md

## Revisión final focalizada
Se incorporó origin/main 22066aa mediante integración local. El backend de referencia incluye c0cd5ce: el perfil debe copiar la fecha del DNI recibida en el registro, sin inventarla. El helper HTTP verifica esa igualdad.
Web oculta el vacío anterior durante una recarga o un error y conserva su mensaje de incompatibilidad 409. Mobile conserva ese mensaje sin reintentar ni cerrar la sesión; actualmente el canje de entrega tiene interfaz en Web, no una pantalla nativa equivalente.
Tras la integración pasaron 32 pruebas web y 23 móviles seleccionadas, lint, tipos móviles, build web y la integración HTTP local. No se repitieron las suites completas.
