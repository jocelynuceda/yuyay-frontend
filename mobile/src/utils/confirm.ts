import { Alert, Platform, Share } from 'react-native';

/** Pide confirmación antes de una acción destructiva. En la web Alert no tiene botones, se usa confirm(). */
export function confirmAction(title: string, message: string, confirmLabel = 'Confirmar'): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm?.(`${title}\n\n${message}`) ?? false);
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

/** Abre la hoja de compartir del sistema; en la web, si no hay navigator.share, copia el texto. */
export async function shareText(message: string): Promise<'shared' | 'copied' | 'failed'> {
  if (Platform.OS === 'web' && !globalThis.navigator?.share) {
    try {
      await globalThis.navigator.clipboard.writeText(message);
      return 'copied';
    } catch {
      return 'failed';
    }
  }
  try {
    await Share.share({ message });
    return 'shared';
  } catch {
    return 'failed';
  }
}
