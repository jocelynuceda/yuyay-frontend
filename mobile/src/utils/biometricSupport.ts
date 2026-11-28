/**
 * Qué desbloqueo biométrico ofrece este celular y cómo nombrarlo. Lógica pura: el servicio le pasa lo que
 * responde el sistema, así se puede probar sin un teléfono.
 */
export type BiometricKind = 'face' | 'fingerprint';

export type BiometricSupport =
  | { status: 'unsupported' }
  /** iPhone con Face ID dentro de Expo Go: Expo Go no tiene el permiso de Face ID de Yuyay, solo la app instalada. */
  | { status: 'needs-app'; label: string; kind: BiometricKind }
  | { status: 'not-enrolled'; label: string; kind: BiometricKind }
  /** Android: hay huella o rostro registrado, pero el sistema lo considera de seguridad débil. */
  | { status: 'weak'; label: string; kind: BiometricKind }
  | { status: 'available'; label: string; kind: BiometricKind };

export interface BiometricFacts {
  platform: string;
  hasHardware: boolean;
  face: boolean;
  fingerprint: boolean;
  /** Hay huella o rostro registrado con seguridad fuerte y el almacenamiento protegido se puede usar. */
  strong: boolean;
  /** Hay alguna huella o rostro registrado, aunque sea de seguridad débil. */
  enrolled?: boolean;
  expoGo: boolean;
}

export function describeBiometrics(facts: BiometricFacts): BiometricSupport {
  if (facts.platform === 'web' || !facts.hasHardware) return { status: 'unsupported' };
  const ios = facts.platform === 'ios';
  // En iPhone hay Face ID o Touch ID; en Android se prefiere la huella, que es la biometría fuerte habitual
  const kind: BiometricKind = ios ? (facts.face ? 'face' : 'fingerprint') : facts.fingerprint || !facts.face ? 'fingerprint' : 'face';
  const label = ios ? (kind === 'face' ? 'Face ID' : 'Touch ID') : kind === 'face' ? 'tu rostro' : 'tu huella';
  if (ios && kind === 'face' && facts.expoGo) return { status: 'needs-app', label, kind };
  if (facts.strong) return { status: 'available', label, kind };
  return !ios && facts.enrolled ? { status: 'weak', label, kind } : { status: 'not-enrolled', label, kind };
}

/** Texto bajo el interruptor «Desbloquear con …». */
export function biometricHint(support: BiometricSupport, enabled: boolean): string {
  if (support.status === 'unsupported') return 'Este teléfono ya no ofrece desbloqueo biométrico.';
  if (support.status === 'needs-app') {
    return 'En Expo Go el iPhone no deja usar Face ID. Funciona en la app de Yuyay instalada en el celular.';
  }
  if (support.status === 'weak' && !enabled) {
    return 'Tu teléfono tiene huella o rostro registrado, pero Android no lo considera seguro para proteger tus datos de salud, así que esta opción no está disponible.';
  }
  if (support.status === 'available' || enabled) {
    return `Al abrir Yuyay o volver después de un minuto se pedirá ${support.label}. No reemplaza tu contraseña: si cierras sesión, se desactiva.`;
  }
  return support.kind === 'face'
    ? `Tu teléfono tiene ${support.label === 'Face ID' ? 'Face ID' : 'reconocimiento facial'}, pero no está configurado. Configúralo en los ajustes del teléfono para activar esta opción.`
    : 'Tu teléfono tiene sensor de huella, pero no hay ninguna huella registrada. Regístrala en los ajustes del teléfono para activar esta opción.';
}

/** Título del interruptor: la biometría desbloquea la sesión abierta, no inicia sesión. */
export function biometricToggleTitle(support: BiometricSupport): string {
  return `Pedir ${support.status === 'unsupported' ? 'biometría' : support.label} al abrir Yuyay`;
}

/** Nombre de la biometría para avisos, o un genérico si el teléfono ya no la ofrece. */
export const biometricName = (support: BiometricSupport) => (support.status === 'unsupported' ? 'la biometría' : support.label);

/** Aviso al cerrar sesión con la biometría activada: cerrar sesión la desactiva y hay que volver a entrar con la cuenta. */
export function biometricLogoutMessage(support: BiometricSupport): string {
  return `Se desactivará el desbloqueo con ${biometricName(support)} en este celular. Para volver a entrar necesitarás tu cuenta (correo y contraseña o Google).`;
}
