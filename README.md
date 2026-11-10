# Yuyay — Frontend web y móvil

Yuyay significa «recordar» en quechua. Es un registro de salud compartido entre cuidadores: toda la familia sabe qué
toma la persona a su cuidado, qué cambió y quién lo anotó, y puede compartir un resumen con el médico.

Este repositorio contiene la **aplicación web (React)** y la **aplicación móvil (React Native con Expo)**. El backend
(Spring Boot) está en [jocelynuceda/dbp-yuyay](https://github.com/jocelynuceda/dbp-yuyay).

**Curso:** CS2031 · Desarrollo Basado en Plataformas · UTEC · Laboratorio 11 · Grupo 3

| Integrante | Código |
| --- | --- |
| Caceres Sanchez, Matias Andres | 202510370 |
| Huapaya Núñez, Luis Felipe Augusto | 202220394 |
| Paredes Rodriguez, Nayra Kamila | 202510441 |
| Puicon Arapa, Valentina Yamile | 202510090 |
| Uceda Tang, Jocelyn Avril | 202510545 |

## Enlaces públicos

| Recurso | URL |
| --- | --- |
| Aplicación web (Vercel) | https://yuyay-web.vercel.app |
| Aplicación móvil Android (APK en Expo) | https://expo.dev/accounts/aprilwu-mobile/projects/yuyay-mobile/builds/7a700b4a-244c-4dfc-8243-5d059e5cd585 |
| API (AWS EC2 + RDS, HTTPS) | https://api.34-193-16-240.sslip.io |
| Documentación Swagger | https://api.34-193-16-240.sslip.io/swagger-ui.html |
| Estado de salud de la API | https://api.34-193-16-240.sslip.io/actuator/health |
| Repositorio del backend | https://github.com/jocelynuceda/dbp-yuyay |

**Cuentas de demo:** `ana@demo.yuyay` (cuidadora principal) y `bruno@demo.yuyay` (cuidador). La contraseña se entrega
en el informe; no se publica porque la API está en internet.

> La API corre en AWS Academy y solo responde mientras el laboratorio está encendido. Si el enlace de salud no
> responde, el laboratorio está apagado.

**Instalar la app Android:** abrir el enlace del APK en un celular Android (o escanear su QR desde una computadora),
descargarlo y permitir la instalación de apps de fuentes desconocidas si el sistema lo pide.

## Funcionalidades

**Web y móvil**

- Registro e inicio de sesión con JWT, renovación automática de sesión y recuperación de contraseña por código.
- Personas a cargo con su perfil clínico: medicación, alergias, condiciones, vacunas, episodios y exámenes.
- Historial de versiones de cada registro: quién lo creó o cambió y cuándo.
- Citas médicas con fecha y hora, y próxima cita en el inicio.
- Cuidadores: invitar por correo, aceptar invitaciones y quitar acceso.
- Accesos temporales (delegaciones) por categoría con enlace de un solo uso.
- Resumen para el médico (handoff) con enlace público temporal.
- Documentos adjuntos con lectura de texto (OCR) y sugerencias de campos.
- Avisos con filtro de no leídos, y registro de accesos de cada persona.
- Modo oscuro.

**Solo móvil**

- Cámara y galería para fotografiar recetas y documentos (`expo-image-picker`).
- Micrófono para notas de voz (`expo-audio`).
- GPS para clínicas y hospitales cercanos (`expo-location`) con la API de OpenStreetMap (Nominatim).
- Agregar una cita al calendario, aviso sin conexión y selector de apariencia (sistema, claro u oscuro).

## Tecnologías

| | Web | Móvil |
| --- | --- | --- |
| Framework | React 19, Vite, TypeScript | React Native 0.88, Expo SDK 58, TypeScript |
| Navegación | React Router 7 (rutas protegidas y carga diferida) | React Navigation 7 (stack y tabs) |
| Estilos | Tailwind CSS 4 | React Native Paper y tema propio claro/oscuro |
| Formularios | React Hook Form + Zod | Validación propia |
| API | Axios con interceptores, renovación de token, reintentos y AbortController | Axios con interceptores, reintentos y SecureStore |
| Despliegue | Vercel | EAS Build (APK) |

## Estructura

```
web/
  src/
    components/   UI reutilizable (ui/) y marco de la app (layout/)
    contexts/     Sesión, tema, avisos y toasts
    hooks/        useAuth, useFetch, usePagination, useDebounce…
    pages/        Una carpeta por sección (auth, people, entries, care, documents…)
    routes/       Rutas centralizadas, PrivateRoute y carga diferida
    services/     Cliente HTTP (http.ts) y un módulo por recurso de la API (api/)
    schemas/      Validaciones con Zod
    types/ utils/
  tests/          Pruebas con node:test y jsdom

mobile/
  src/
    components/   Componentes reutilizables (tarjetas, formularios, decoración)
    contexts/     Sesión
    hooks/        useFetch, useVoiceRecorder, useRefreshOnFocus…
    navigation/   Stacks y tabs
    screens/      Una pantalla por archivo
    services/     Cliente HTTP, API y adjuntos
    theme/        Paletas, tema claro/oscuro y makeStyles
    types/ utils/
  tests/          Pruebas con node:test
```

## Correr en local

Requisitos: Node.js 24 (la versión de GitHub Actions) y el backend corriendo (ver su README) o la URL de la API desplegada.

### Web

```bash
cd web
npm install
npm run dev
```

Abre http://localhost:5173. Por defecto usa el backend local (`web/.env.development`). Para usar otro backend, crea
`web/.env.local` con:

```
VITE_API_URL=https://api.34-193-16-240.sslip.io
```

La URL va sin `/api/v1`; el cliente lo agrega.

### Móvil

```bash
cd mobile
npm install
npx expo start
```

Escanea el QR con Expo Go. Para usar la API desplegada, crea `mobile/.env` con:

```
EXPO_PUBLIC_API_URL=https://api.34-193-16-240.sslip.io
```

Si se deja vacía, en desarrollo la API pasa por el proxy de Metro hacia `localhost:8080`. Con `npx expo start --tunnel`
funciona aunque el celular esté en otra red.

## Pruebas y verificación

```bash
cd web && npm test && npm run lint && npm run build
cd mobile && npm test && npm run typecheck && npm run lint
```

GitHub Actions corre estas mismas verificaciones en cada pull request (`.github/workflows`).

## Despliegue

- **Web:** Vercel publica la carpeta `web/` de este repositorio. La variable `VITE_API_URL` está definida en el
  proyecto de Vercel y `web/vercel.json` redirige todas las rutas a `index.html`. El dominio de Vercel está en
  `CORS_ALLOWED_ORIGINS` del backend.
- **Móvil:** el APK se genera en EAS con el perfil `preview` de `mobile/eas.json`, que ya trae `EXPO_PUBLIC_API_URL`:

  ```bash
  cd mobile
  npx eas-cli@latest build -p android --profile preview
  ```

  Si cambia la URL de la API o el código de la app, hay que actualizar `eas.json` y volver a generar el APK.
