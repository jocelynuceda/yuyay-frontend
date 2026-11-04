# Sesión e integración móvil

Desde mobile, usar Node 24 y la API habitual con Java 26 y PostgreSQL.

    npm ci
    npm start
    npm test
    npm run typecheck
    npm run lint
    npx expo-doctor

Metro reenvía /api al backend localhost:8080. BACKEND_PORT elige otro puerto.
EXPO_PUBLIC_API_URL permite usar una API explícita. En un celular, localhost identifica
al celular. El fallback nativo usa el host de Metro para llegar al backend de la computadora.

## Recuperación

El access vive en memoria. El refresh se guarda en SecureStore en iOS/Android y en el
almacenamiento local existente en Expo web. Su clave distingue la URL de la API.
La clave antigua se migra al completar una renovación correcta. Si pertenecía a otra API,
se necesita iniciar sesión en el entorno elegido.

La renovación tiene timeout de 15 s. Red, timeout y 5xx conservan la sesión guardada y muestran
reintento. Los datos privados vuelven a mostrarse tras recuperar sesión con la API.
Sólo un 401 de refresh invalida las credenciales locales. Login/registro no disparan refresh.

Las llamadas concurrentes comparten renovación. Un 401 tardío del access anterior reintenta
con el access actualizado. Las escrituras se ordenan y la generación de sesión impide que
una respuesta pendiente reactive una sesión cerrada o sustituya una cuenta más reciente.
Si falla borrar credenciales, se muestra reintento específico de cierre.

## Contratos y pruebas

Registros y avisos aceptan Page con content/number/size/totalElements/totalPages y el array
completo del despliegue anterior. Las pantallas existentes calculan contadores y categorías
sobre todos los registros. Se leen todas las páginas de 100 elementos.

Un fallo posterior rechaza la carga completa. Cambios de contrato, falta de progreso o más
de 1000 páginas producen error explícito. Así se evita truncar silenciosamente o cargar sin
límite. Las recargas conservan datos previos sólo para la misma identidad de consulta.

El formulario refleja el límite BCrypt de 72 bytes UTF-8. Los símbolos pueden alcanzarlo
con menos caracteres. Las contraseñas se transmiten exactamente como se escriben.

Las regresiones cubren red/servidor, refresh inválido, concurrencia, respuestas tardías,
relanzamiento, fallos de almacenamiento, logout y ambos contratos de listas.
Mobile checks ejecuta npm ci, tests, TypeScript y lint en PR y pushes a main para mobile.
El CI backend se ejecuta en su propio repositorio.

Se validó Expo web en Chrome. Autocompletado y comportamiento nativo de SecureStore,
teclado e iPhone requieren una comprobación con Expo Go en dispositivo físico.

La validación local final pasó 17 tests, TypeScript, lint y los 20 checks de Expo Doctor.
Expo install alineó cinco paquetes con SDK 58. La dependencia transitiva de tooling Zod se
actualizó a 4.6.7 dentro del rango permitido por ESLint para resolver la advertencia alta.
npm audit sigue indicando 18 advertencias moderadas que requieren revisión por separado.

El recorrido visual confirmó registro, reapertura de sesión, recuperación tras 503,
logout/login con la misma contraseña y creación de persona. El recorrido visual de una
colección de 101 registros queda pendiente de comprobación manual. La regresión de servicios
cubre 101 elementos tanto con Page como con array.
