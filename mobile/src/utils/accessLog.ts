import type { Ionicons } from '@expo/vector-icons';
import type { AccessAction, AccessLog } from '../types';

export const accessActionMeta: Record<AccessAction, { verb: string; icon: keyof typeof Ionicons.glyphMap }> = {
  VIEW: { verb: 'vio', icon: 'eye-outline' },
  CREATE: { verb: 'creó', icon: 'add-circle-outline' },
  UPDATE: { verb: 'editó', icon: 'create-outline' },
  DELETE: { verb: 'borró', icon: 'trash-outline' },
  OPEN_HANDOFF_LINK: { verb: 'abrió', icon: 'link-outline' },
  EXCHANGE_DELEGATION: { verb: 'abrió', icon: 'key-outline' },
};

const targetLabels: Record<string, string> = {
  HEALTH_ENTRY: 'un registro de salud',
  HANDOFF: 'un resumen',
  CONSULTATION: 'una cita',
  ATTACHMENT: 'un documento',
  DELEGATION: 'un acceso delegado',
};

export const accessTargetLabel = (log: AccessLog) => targetLabels[log.targetType ?? ''] ?? 'información';
