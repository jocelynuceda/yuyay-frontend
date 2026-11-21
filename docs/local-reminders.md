# Recordatorios locales de citas (móvil)

En **Citas → Próximas**, cada cita futura con hora tiene el interruptor **«Avisarme 1 hora antes en
este celular»**. El aviso lo programa el teléfono con `expo-notifications`; no pasa por el servidor y
solo existe en ese celular. La web no tiene esta función.

## Reglas

- **Permiso:** se pide al activar el interruptor. Si se niega, la cita sigue igual y aparece un enlace a
  Ajustes para activar las notificaciones.
- **Cuándo suena:** 1 hora antes, en la hora local del celular. Las citas sin hora o a menos de una hora
  no muestran el interruptor.
- **Texto en la pantalla bloqueada:** «Yuyay · Tienes una cita en 1 hora.», sin nombre ni motivo. Al
  tocarlo se abren las citas de la persona, solo si la sesión abierta es de la misma cuenta.
- **Editar o borrar:** cada vez que se cargan las citas de una persona se comparan con los avisos
  guardados. Si cambió la fecha o la hora se reprograma; si se borró, quedó sin hora o ya pasó, se
  cancela. Nunca hay dos avisos para la misma cita.
- **Cambios desde otro cliente** (otro celular o la web): se aplican la próxima vez que este celular
  carga las citas de esa persona. **Un celular sin conexión puede conservar un aviso antiguo** hasta que
  vuelva a sincronizar.
- **Pérdida de acceso:** al cargar el inicio, se cancelan los avisos de personas que ya no aparecen.
- **Cerrar sesión:** se cancelan todos los avisos de esa cuenta en el celular.

## Relación con el recordatorio del servidor

El servidor (backend #71) avisa **el día anterior a las 18:00** en la app y por correo. El aviso local
suena **1 hora antes**, así que no se repiten en el mismo momento. Quien active ambos recibe los dos.

## Prueba en un teléfono

Necesita un APK compilado con `expo-notifications` (`eas build -p android --profile preview`). En un
Android físico: activar y negar el permiso, recibir el aviso con la pantalla bloqueada, reprogramar y
borrar la cita (también desde la web), cerrar sesión y comprobar que el aviso ya no llega.
