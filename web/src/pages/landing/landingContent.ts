/**
 * Textos de la landing, tomados de la presentación del proyecto. Los ejemplos usan datos ficticios
 * y las cifras citan su fuente oficial.
 */

export const LANDING_NAV = [
  { href: '#que-es', label: 'Qué es' },
  { href: '#que-hace', label: 'Qué hace' },
  { href: '#por-que', label: '¿Por qué Yuyay?' },
  { href: '#equipo', label: 'Quiénes somos' },
] as const

/** Ilustraciones en public/landing, con su tamaño real para reservar el espacio antes de cargar. */
export const art = {
  abueloHija: { src: '/landing/abuelo-hija.webp', width: 758, height: 576 },
  escena: { src: '/landing/escena-consulta.webp', width: 1350, height: 763 },
} as const

/** Cifras oficiales del Perú (tomadas de la presentación): el número, qué significa y por qué importa. */
export const FACTS = [
  {
    image: { src: '/landing/dato-cronicas.webp', width: 611, height: 280 },
    value: '45,6 %',
    text: 'de los hogares tiene una persona de 60 años o más',
    why: 'Muchas familias se turnan para cuidar a alguien.',
    source: 'INEI · II trim. 2026',
  },
  {
    image: { src: '/landing/dato-hipertension.webp', width: 600, height: 272 },
    value: '5,5 millones',
    text: 'de personas de 15 años o más viven con hipertensión arterial',
    why: 'Son tratamientos largos, con dosis que cambian y hay que recordar.',
    source: 'MINSA · PP 0018, 2024 (ENDES 2023)',
  },
  {
    image: { src: '/landing/dato-celular.webp', width: 603, height: 284 },
    value: '90,2 %',
    text: 'de quienes usan internet se conecta desde el celular',
    why: 'Por eso Yuyay va contigo en el bolsillo cuando llegas a la consulta.',
    source: 'INEI · ENAHO, II trim. 2026',
  },
] as const

export const STEPS = [
  {
    image: { src: '/landing/paso-capturar.webp', width: 609, height: 399 },
    title: 'Capturar',
    text: 'Anota medicamentos, alergias, vacunas y exámenes, o toma una foto a la receta y Yuyay la lee por ti.',
  },
  {
    image: { src: '/landing/paso-coordinar.webp', width: 610, height: 398 },
    title: 'Coordinar',
    text: 'Invita a tu familia y vean lo mismo: cada cosa anotada dice quién la anotó y cuándo.',
  },
  {
    image: { src: '/landing/paso-compartir.webp', width: 610, height: 398 },
    title: 'Compartir',
    text: 'Elige qué ve el médico o un familiar, y por cuánto tiempo puede verlo.',
  },
] as const

export const FEATURES = [
  { icon: 'file', title: 'Todo en un solo lugar', text: 'Medicamentos con su dosis, alergias, enfermedades, vacunas y exámenes.' },
  { icon: 'users', title: 'Cuidado en familia', text: 'Invita a otros cuidadores por correo para que todos vean lo mismo.' },
  { icon: 'pencil', title: 'Nada se pierde', text: 'Cada cambio guarda quién lo hizo, cuándo y si el dato ya está confirmado.' },
  { icon: 'search', title: 'Lee tus recetas', text: 'Toma una foto a la receta o al resultado: Yuyay lee el texto y tú confirmas cada dato.' },
  { icon: 'calendar', title: 'Citas y recordatorios', text: 'Anota las consultas y recibe un aviso el día anterior.' },
  { icon: 'check', title: 'Resumen para el médico', text: 'Comparte solo lo necesario con un enlace temporal, y sabrás cuándo lo abrieron.' },
] as const

export const TEAM = [
  'Matias Andres Caceres Sanchez',
  'Luis Felipe Augusto Huapaya Núñez',
  'Nayra Kamila Paredes Rodriguez',
  'Valentina Yamile Puicon Arapa',
  'Jocelyn Avril Uceda Tang',
] as const

