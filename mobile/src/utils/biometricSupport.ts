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
  | { status: 'available'; label: string; kind: BiometricKind };

export interface BiometricFacts {
  platform: string;
  hasHardware: boolean;
  face: boolean;
  fingerprint: boolean;
  /** Hay huella o rostro registrado con seguridad fuerte y el almacenamiento protegido se puede usar. */
  strong: boolean;
  expoGo: boolean;
}

export function describeBiometrics(facts: BiometricFacts): BiometricSupport {
  if (facts.platform === 'web' || !facts.hasHardware) return { status: 'unsupported' };
  const ios = facts.platform === 'ios';
  // En iPhone hay Face ID o Touch ID; en Android se prefiere la huella, que es la biometría fuerte habitual
  const kind: BiometricKind = ios ? (facts.face ? 'face' : 'fingerprint') : facts.fingerprint || !facts.face ? 'fingerprint' : 'face';
  const label = ios ? (kind === 'face' ? 'Face ID' : 'Touch ID') : kind === 'face' ? 'tu rostro' : 'tu huella';
  if (ios && kind === 'face' && facts.expoGo) return { status: 'needs-app', label, kind };
  return facts.strong ? { status: 'available', label, kind } : { status: 'not-enrolled', label, kind };
}

/** Texto bajo el interruptor «Desbloquear con …». */
export function biometricHint(support: BiometricSupport, enabled: boolean): string {
  if (support.status === 'unsupported') return 'Este teléfono ya no ofrece desbloqueo biométrico.';
  if (support.status === 'needs-app') {
    return 'En Expo Go el iPhone no deja usar Face ID. Funciona en la app de Yuyay instalada en el celular.';
  }
  if (support.status === 'available' || enabled) {
    return `Al abrir Yuyay o volver a la app se pedirá ${support.label}. Se guarda solo en este celular.`;
  }
  return support.kind === 'face'
    ? `Tu teléfono tiene ${support.label === 'Face ID' ? 'Face ID' : 'reconocimiento facial'}, pero no está configurado. Configúralo en los ajustes del teléfono para activar esta opción.`
    : 'Tu teléfono tiene sensor de huella, pero no hay ninguna huella registrada. Regístrala en los ajustes del teléfono para activar esta opción.';
}
