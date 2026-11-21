# Términos de la cuenta

Web y móvil solicitan el documento vigente en `GET /api/v1/auth/terms`. El servidor entrega `version` y `text`. Así ambos clientes muestran el mismo documento aprobado sin mantener copias independientes. La versión inicial es 1.0 del 20 de noviembre de 2026.

El registro por correo exige una aceptación explícita. Envía `termsAccepted: true` y `termsVersion` con la versión que se mostró. Ante un 400 con `TERMS_ACCEPTANCE_REQUIRED` o `TERMS_VERSION_OUTDATED`, el registro conserva sus campos, limpia la aceptación y vuelve a abrir el documento vigente. Cerrar el modal devuelve el foco a «Leer los términos de uso y el aviso de privacidad». El mismo enlace está en el perfil de la cuenta para consultar el documento.

La declaración asociada a un perfil de cuidado usa otro flujo y tiene su propia versión.

## Integración con Google

En web, este cambio integra el modal con `GoogleSignIn` del [PR #56](https://github.com/jocelynuceda/yuyay-frontend/pull/56). Se abre para crear una cuenta tanto desde Iniciar sesión como desde Crear cuenta. La casilla empieza desmarcada. Si cierras el modal o cancelas, el flujo termina sin enviar la aceptación. Una cuenta vinculada entra con su ID token.

El flujo móvil de #50 puede reutilizar `useAccountTerms` y `AccountTerms`. Renderiza `<AccountTerms terms={terms} requireAcceptance />` al crear una cuenta y continúa cuando `terms.acceptance` tenga valor.

1. Envía `{ idToken }` a `POST /api/v1/auth/google`.
2. Si el backend responde 428 con `currentVersion` y el código `TERMS_ACCEPTANCE_REQUIRED` o `TERMS_VERSION_OUTDATED`, el cliente llama a `terms.review()` para mostrar el documento obtenido de nuevo desde `GET /api/v1/auth/terms`. Utiliza `needsTermsReview(error, 428)`. El código se expone como `response.data.code` en web y `ApiError.code` en móvil. Una versión enviada con un tipo JSON inválido devuelve 400.
3. Si la persona acepta, envía `{ idToken, acceptedTermsVersion: terms.acceptance.termsVersion }` con un ID token vigente. Si cancela, conserva el formulario y termina el intento.
4. Una respuesta correcta de Google usa el formato de sesión de Yuyay. El flujo web conserva los mensajes del backend para conflictos de correo y muestra un mensaje para credenciales inválidas o Google no disponible.

La web usa `VITE_GOOGLE_CLIENT_ID` y el cliente Android usa el ID web como `webClientId`. La configuración nativa de Android e iOS corresponde a #50. El módulo nativo de ese flujo requiere un APK compilado con un runtime compatible.

## Comprobación

Con el backend #67 disponible, abre y cierra el modal desde el registro y desde el perfil. Comprueba lectura completa, versión, foco de regreso y campos conservados. En el registro, confirma que la casilla empieza desmarcada y que no se envía la solicitud antes de marcarla. Simula un cambio de versión entre lectura y envío. Revisa la nueva versión, vuelve a aceptar y verifica el nuevo cuerpo de la solicitud.

En web prueba con una cuenta de Google vinculada y con otra que aún no tenga cuenta en Yuyay. Comprueba cierre, cancelación, aceptación y recuperación al cambiar la versión. En Android comprueba el botón Atrás. En Android e iOS comprueba el regreso de foco con TalkBack y VoiceOver, respectivamente.
