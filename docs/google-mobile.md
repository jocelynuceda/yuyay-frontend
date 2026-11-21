# Google en la app móvil

La app usa `@react-native-google-signin/google-signin`. Google entrega un ID token y la app lo envía a
`POST /api/v1/auth/google`, igual que la web. Si la cuenta es nueva (428 con código de términos), la app
muestra el documento de `GET /api/v1/auth/terms`, pide la aceptación y reintenta con
`acceptedTermsVersion`. El resto de la sesión (refresh, logout) no cambia.

Después de obtener el token la app cierra la sesión de Google en el teléfono: la sesión de Yuyay no
depende de ella y la próxima vez se vuelve a elegir la cuenta.

## Cuándo aparece el botón

Solo en un **APK compilado con la dependencia nativa** y con `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
configurado. En Expo Go, en la web de Expo o sin ese valor, el botón no se muestra y el acceso con
correo sigue igual. Una OTA enviada a un APK anterior tampoco lo muestra ni rompe la app.

## Configuración

1. **Google Cloud › Credenciales**
   - Cliente **Web**: es el mismo de `VITE_GOOGLE_CLIENT_ID` (web) y `GOOGLE_CLIENT_IDS` (backend). La app
     lo usa como `webClientId` y Google firma el ID token para esa audiencia.
   - Cliente **Android**: paquete `com.yuyay.mobile` y la huella **SHA-1** del certificado con que EAS
     firma el APK. Se obtiene con `eas credentials` (plataforma Android, perfil `preview`). Este cliente
     no se escribe en el código: Google lo reconoce por el paquete y la firma.
2. **Variable de compilación**: agregar `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` al `env` de los perfiles
   `preview` y `production` de `mobile/eas.json` (o como variable de entorno de EAS). Para desarrollo
   local, en `mobile/.env`.
3. **Compilar un APK nuevo** (`eas build -p android --profile preview`). Una OTA no basta porque se
   agregó código nativo.

## iOS

Pendiente. Requiere un cliente iOS en Google Cloud y pasar su `iosUrlScheme` al plugin en `app.json`.
Mientras tanto, en iOS el acceso es con correo o desde la web.

## Comprobación en un teléfono

Con el APK instalado: alta con una cuenta de Google nueva (aparecen los términos, cancelar no crea la
cuenta, aceptar entra), reingreso con la misma cuenta (entra sin términos), cancelar el selector de
Google, correo que ya tiene contraseña (mensaje del backend), cierre de sesión y nuevo ingreso.
