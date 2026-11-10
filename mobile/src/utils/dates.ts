export type DateParts = { day: string; month: string; year: string };

export type DateRules = {
  allowFuture?: boolean;
  maxYearsAhead?: number;
  /** La fecha debe ser anterior a hoy (hoy no vale), como las fechas de nacimiento. */
  strictPast?: boolean;
  /** Fecha mínima permitida, en formato AAAA-MM-DD. */
  notBefore?: string;
};

export const MIN_YEAR = 1900;

export const DAY_ERROR = 'El día va del 1 al 31.';
export const MONTH_ERROR = 'El mes va del 1 al 12.';

export function rangeError({ day, month }: DateParts): string | undefined {
  if (day && (Number(day) < 1 || Number(day) > 31)) return DAY_ERROR;
  if (month && (Number(month) < 1 || Number(month) > 12)) return MONTH_ERROR;
  return undefined;
}

/** Valida las tres partes y devuelve la fecha ISO (AAAA-MM-DD) o el motivo del error. */
export function parseDateParts(
  parts: DateParts,
  { allowFuture = false, maxYearsAhead, notBefore, strictPast, today = new Date() }: DateRules & { today?: Date } = {},
): { iso: string; error?: string } {
  const { day, month, year } = parts;
  if (!day && !month && !year) return { iso: '' };
  const outOfRange = rangeError(parts);
  if (outOfRange) return { iso: '', error: outOfRange };
  if (!day || !month || year.length !== 4) return { iso: '', error: 'Completa día, mes y año.' };
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (y < MIN_YEAR) return { iso: '', error: `El año debe ser ${MIN_YEAR} o posterior.` };
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return { iso: '', error: 'Esa fecha no existe.' };
  }
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (strictPast && date >= startOfToday) return { iso: '', error: 'La fecha debe ser anterior a hoy.' };
  if (!allowFuture) {
    if (date > startOfToday) return { iso: '', error: 'La fecha no puede ser futura.' };
  } else if (maxYearsAhead !== undefined) {
    const limit = today.getFullYear() + maxYearsAhead;
    if (y > limit) return { iso: '', error: `El año debe ser ${limit} o anterior.` };
  }
  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  if (notBefore && iso < notBefore) return { iso: '', error: 'La fecha no puede ser anterior a hoy.' };
  return { iso };
}

/** Error para mostrar mientras se escribe: no avisa de lo que aún está incompleto. */
export function liveDateError(
  parts: DateParts,
  options: DateRules & { today?: Date } = {},
): string | undefined {
  const { day, month, year } = parts;
  const complete = (value: string) => value.length === 2;
  if (complete(day) && (Number(day) < 1 || Number(day) > 31)) return DAY_ERROR;
  if (complete(month) && (Number(month) < 1 || Number(month) > 12)) return MONTH_ERROR;
  if (year.length === 4) return parseDateParts(parts, options).error;
  return undefined;
}

/** Separa una fecha AAAA-MM-DD en las tres casillas de DateField. */
export function datePartsOf(iso: string): DateParts {
  const [year, month, day] = iso.split('-');
  return { day, month, year };
}
