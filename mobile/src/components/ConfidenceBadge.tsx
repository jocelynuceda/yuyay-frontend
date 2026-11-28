import type { ConfidenceLevel } from '../types';
import { Badge } from './Badge';

/** Texto de confianza de un registro: confirmado por el cuidador o aún por confirmar. */
export function confidenceLabel(level: ConfidenceLevel) {
  return level === 'CONFIRMED' ? 'Confirmado' : 'Por confirmar';
}

/** Etiqueta de confianza de un registro: confirmado por el cuidador o aún por confirmar. */
export function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  return (
    <Badge
      label={confidenceLabel(level)}
      tone={level === 'CONFIRMED' ? 'accent' : 'amber'}
    />
  );
}
