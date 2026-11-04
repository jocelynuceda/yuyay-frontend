const dateFormatter = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });

/** Las fechas LocalDate ("2024-05-01") se leen en hora local para no correrse un día. */
function parse(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
}

/** Fecha de hoy en hora local como AAAA-MM-DD (toISOString usaría UTC y podría ser mañana). */
export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const formatDate = (value?: string | null) => (value ? dateFormatter.format(parse(value)) : '—');

const dateTimeFormatter = new Intl.DateTimeFormat('es-PE', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/** Fecha y hora, para saber cuándo pasó algo exactamente. */
export const formatDateTime = (value?: string | null) => (value ? dateTimeFormatter.format(parse(value)) : '—');

const timeFormatter = new Intl.DateTimeFormat('es-PE', { hour: 'numeric', minute: '2-digit' });

/** Hora guardada ("15:30:00") como la lee una persona. */
export function formatTime(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return timeFormatter.format(new Date(2000, 0, 1, hour, minute));
}

/** Clave para ordenar citas: por fecha y, dentro del día, por hora. */
export const appointmentOrder = (c: { date: string; time: string | null }) => `${c.date} ${c.time ?? ''}`;

export function ageFrom(birthDate?: string | null) {
  if (!birthDate) return null;
  const birth = parse(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (beforeBirthday) age--;
  return age;
}

export function timeAgo(value: string) {
  const minutes = Math.round((Date.now() - parse(value).getTime()) / 60000);
  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'ayer' : `hace ${days} días`;
}

export const careRoleLabel = { PRINCIPAL: 'Principal', CAREGIVER: 'Cuidador/a' } as const;

export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

/** Hasta dos iniciales del nombre, para los avatares. */
export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
