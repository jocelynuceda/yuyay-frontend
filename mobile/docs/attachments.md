# Imágenes y documentos

La pantalla **Imágenes y documentos** se abre desde el perfil de una persona. Permite subir imágenes y documentos, consultar su texto OCR, abrir el original mediante un acceso temporal y eliminar archivos. La lectura OCR no crea registros clínicos automáticamente.

## Contrato de la API

Todas las rutas llevan el prefijo `/api/v1/care-subjects/{subjectId}/attachments` y requieren una sesión y una relación de cuidado activa.

| Método y ruta | Contrato usado por el móvil |
| --- | --- |
| `GET /` | Array de metadatos `Attachment`; este listado no está paginado. |
| `POST /` | Multipart con el campo `file`; devuelve `201` y metadatos. JPG, PNG o PDF de una página, máximo 10 MB. |
| `GET /{id}/access` | Devuelve `200 { url, expiresAt }`, acceso HTTPS privado de cinco minutos y `Cache-Control: no-store`. |
| `DELETE /{id}` | `204` al eliminar; `409` si alguna versión clínica referencia el archivo; `502` si falla el almacenamiento, conservando metadatos. |
| `POST /{id}/ocr-retry` | Devuelve `202` y metadatos. Solo se habilita para `ocrStatus: FAILED`; el backend rechaza otros estados con `409`. |

Los estados OCR son `PENDING`, `DONE` y `FAILED`. La pantalla consulta el resultado al actualizar la lista, sin un ciclo continuo de peticiones. Un OCR fallido conserva el archivo y permite abrirlo o reintentar la lectura. La validación final del contenido y de los límites corresponde al backend.

El envío usa `FormData`: en web incorpora el `File` original y en React Native un descriptor `{ uri, name, type }`. Se reemplaza el encabezado JSON predeterminado para que Axios y el transporte generen multipart con su boundary. Los tests comprueban que un reintento tras renovar la sesión conserva el cuerpo.

La URL temporal se solicita al pulsar **Ver archivo** y vive solo en el estado de la vista. Se elimina al cerrar, salir de la pantalla, pasar la aplicación a segundo plano o vencer el acceso. El PDF requiere después **Abrir PDF**, un clic directo que permite abrir el visor también en Safari. No se guardan URLs temporales en almacenamiento local ni se escriben en logs.

## Instalación y comprobaciones

Se conserva Expo SDK 58 y React Navigation. Las dependencias añadidas, resueltas con Expo, son `expo-document-picker ~58.0.4`, `expo-image-picker ~58.0.10` y `expo-image-manipulator ~58.0.16`.

Desde `mobile`:

```powershell
npm ci
npm run typecheck
npm run lint
npm test
npx expo-doctor
npm start
```

Si se necesita resolver de nuevo las dependencias para este SDK:

```powershell
npx expo install expo-document-picker expo-image-picker expo-image-manipulator
```

`app.json` incluye los plugins y las descripciones de permisos de cámara y fotos. El permiso de micrófono está deshabilitado. Los cambios de configuración nativa necesitan una nueva compilación de la aplicación instalada; están incluidos los módulos en Expo Go compatible con SDK 58. Referencias: [DocumentPicker](https://docs.expo.dev/versions/v58.0.0/sdk/document-picker/), [ImagePicker](https://docs.expo.dev/versions/v58.0.0/sdk/imagepicker/) e [ImageManipulator](https://docs.expo.dev/versions/v58.0.0/sdk/imagemanipulator/).

## Prueba manual pendiente en iPhone

Usar una persona de prueba y archivos sin información sensible, con el backend actualizado:

1. Abrir **Imágenes y documentos**; seleccionar una imagen y cancelar el selector. La cancelación no debe subir nada. Subir después JPG y PNG; comprobar nombre, tamaño, vista previa y cierre.
2. Elegir una foto HEIC de la biblioteca y tomar una foto nueva. En nativo se exporta una copia JPEG sin recortar, con dimensiones máximas de 4096 píxeles por lado. Comprobar orientación y legibilidad del documento guardado.
3. Denegar la cámara y volver a intentarlo; comprobar el mensaje y la alternativa de elegir una imagen. Con el permiso bloqueado, habilitarlo desde Ajustes y repetir. La selección de fotos usa el selector del sistema y no solicita acceso general a la biblioteca.
4. Elegir un PDF desde Archivos; pulsar **Ver archivo** y **Abrir PDF**. Comprobar el visor, volver a la aplicación y abrir de nuevo. Verificar también PDF en Safari, donde la apertura necesita el segundo clic.
5. Probar archivo vacío, tamaño mayor de 10 MB y formato no admitido. Debe aparecer un error sin indicar éxito. Si una subida pierde la conexión antes de recibir confirmación, actualizar la lista antes de repetir para evitar duplicados.
6. Con OCR pendiente, actualizar hasta recibir `DONE` y revisar **Ver texto extraído** frente al original. Con un archivo en `FAILED`, comprobar **Reintentar lectura**, su estado de carga y la actualización posterior. No deben crearse registros clínicos.
7. Eliminar un archivo sin referencias: confirmar el diálogo y comprobar que desaparece. Repetir con un archivo referenciado: el `409` debe mantener el archivo y mostrar el motivo. Cancelar el diálogo debe conservarlo.
8. Abrir una imagen y enviar la aplicación al fondo; al volver, el acceso debe estar cerrado. Dejar vencer una vista previa y comprobar que se puede solicitar otro acceso. Verificar que una sesión renovada permite subir y que otro usuario sin relación activa recibe un rechazo.

La revisión web en Chrome con API interceptada verificó el boundary y los bytes multipart, carga de imagen, eliminación `409`/`204`, ausencia de URL persistida y ausencia de errores JavaScript. Esos resultados no sustituyen la prueba física de iPhone ni la validación de los nuevos endpoints desplegados.

## Integración y despliegue

Esta integración parte del PR #3 de edición e historial, que ya incluye la recuperación de sesión y la compatibilidad con las páginas de registros y avisos. No incorpora la rama completa `feature/fase-1-mobile`.

Los endpoints nuevos de acceso privado y eliminación requieren integrar y desplegar el cambio correspondiente del backend. Durante esta revisión todavía no estaban desplegados en AWS: que la subida y OCR existentes funcionen allí no demuestra que **Ver archivo** y **Eliminar** estén disponibles. Desplegar el backend antes de dar esas acciones por listas en producción.

Se corrige además el historial del PR #3: el GET de un registro eliminado responde `404`, mientras `/versions` mantiene la auditoría. La pantalla ahora presenta esas versiones con el aviso de eliminación y sin **Editar**. También cubre la carrera en que el GET devuelve un registro activo y la consulta de versiones ya contiene `DELETED`. Los demás errores de acceso y transporte siguen propagándose. La corrección y sus tests están separados en `services/entryHistory.ts`, `screens/EntryHistoryScreen.tsx` y `tests/entryHistory.test.ts`.

## Integración real local comprobada — 4 de noviembre de 2026

Después de la revisión con API interceptada se probó esta misma pantalla contra
el backend actualizado ejecutado en local, PostgreSQL 16 aislado y S3/Textract
reales. Chrome realizó login, creó una persona, subió PNG y PDF, mostró la imagen
real y abrió el PDF con enlace firmado. Se verificó el rechazo 409 al borrar una
evidencia clínica y un borrado 204 de un documento sin referencias; el objeto S3
dejó de ser accesible después del borrado. No se interceptaron respuestas API.

La prueba también confirmó el multipart y CORS reales, ausencia de excepciones
JavaScript y ausencia de URLs firmadas en almacenamiento persistente. El backend
conservó el vínculo de evidencia tras editar y rechazó archivos falsificados o
mayores de 10 MB. Se limpiaron todos los archivos creados por esta prueba.

La URL local se suministró a Metro mediante la variable de entorno del proceso;
no se reemplazó el `.env` habitual que apunta a AWS. Se detuvieron los procesos
temporales al terminar. El despliegue de los endpoints nuevos en EC2 y el checklist
físico de iPhone siguen pendientes; la prueba web no certifica cámara nativa.

