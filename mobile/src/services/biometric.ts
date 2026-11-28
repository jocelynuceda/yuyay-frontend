import { isRunningInExpoGo } from 'expo';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { describeBiometrics, type BiometricSupport } from '../utils/biometricSupport';

export type { BiometricKind, BiometricSupport } from '../utils/biometricSupport';

/**
 * Comprueba si este teléfono puede proteger la sesión con biometría. No basta con tener sensor: tiene que haber
 * una huella o un rostro registrado con seguridad fuerte (en Android, el desbloqueo facial básico no sirve).
 */
export async function getBiometricSupport(): Promise<BiometricSupport> {
  if (Platform.OS === 'web') return { status: 'unsupported' };
  try {
    const [hasHardware, level, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.getEnrolledLevelAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    return describeBiometrics({
      platform: Platform.OS,
      hasHardware,
      face: types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION),
      fingerprint: types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT),
      strong: level >= LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG && SecureStore.canUseBiometricAuthentication(),
      enrolled: level >= LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK,
      expoGo: isRunningInExpoGo(),
    });
  } catch {
    return { status: 'unsupported' };
  }
}

/** Clave guardada con la protección biométrica del sistema (Keychain en iOS, Keystore en Android). */
export function biometricKeyStore(name: string) {
  const options: SecureStore.SecureStoreOptions = {
    requireAuthentication: true,
    authenticationPrompt: 'Desbloquear Yuyay',
  };
  return {
    read: () => SecureStore.getItemAsync(name, options),
    async write(value: string) {
      // En Android guardar ya pide la huella. En iOS se lee de vuelta para que la persona confirme con Face ID o Touch ID.
      await SecureStore.setItemAsync(name, value, options);
      if (Platform.OS === 'ios' && (await SecureStore.getItemAsync(name, options)) !== value) {
        throw new Error('No pudimos confirmar la biometría.');
      }
    },
    remove: () => SecureStore.deleteItemAsync(name, options),
  };
}
