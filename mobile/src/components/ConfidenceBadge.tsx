import type { ConfidenceLevel } from '../types';
import { Badge } from './Badge';

/** Etiqueta de confianza de un registro: confirmado por el cuidador o aún por confirmar. */
export function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  return (
    <Badge
      label={level === 'CONFIRMED' ? 'Confirmado' : 'Por confirmar'}
      tone={level === 'CONFIRMED' ? 'accent' : 'amber'}
    />
  );
}
