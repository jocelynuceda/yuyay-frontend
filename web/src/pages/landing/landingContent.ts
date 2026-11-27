/**
 * Textos de la landing. Solo describen lo que la app ya hace; los ejemplos usan datos ficticios y
 * las cifras citan su fuente oficial.
 */
import type { IconName } from '../../components/ui/Icon'

export const LANDING_NAV = [
  { id: 'que-es', label: 'Qué es Yuyay' },
  { id: 'como-funciona', label: 'Cómo funciona' },
  { id: 'funcionalidades', label: 'Funcionalidades' },
  { id: 'privacidad', label: 'Privacidad' },
  { id: 'nosotros', label: 'Nosotros' },
] as const

/** Ilustraciones en public/landing, con su tamaño real para reservar el espacio antes de cargar. */
export const art = {
  abueloHija: { src: '/landing/abuelo-hija.webp', width: 758, height: 576 },
  escena: { src: '/landing/escena-consulta.webp', width: 1350, height: 763 },
} as const

/** Lo que pasa hoy sin Yuyay: la información existe, pero cada pedazo está en un lugar distinto. */
export const SCATTERED = [
  { icon: 'mail', text: 'La receta, en el chat de un hermano' },
  { icon: 'file', text: 'El último examen, en una carpeta de la casa' },
  { icon: 'pencil', text: 'La dosis nueva, en la memoria de quien fue a la cita' },
] as const satisfies readonly { icon: IconName; text: string }[]

export const STEPS = [
  {
    image: { src: '/landing/paso-capturar.webp', width: 609, height: 399 },
    title: 'Capturar',
    text: 'Registra medicamentos, alergias, vacunas y exámenes, o digitaliza tus recetas con una fotografía.',
  },
  {
    image: { src: '/landing/paso-coordinar.webp', width: 610, height: 398 },
    title: 'Coordinar',
    text: 'Invita a tus familiares y cuidadores para organizar la información de salud en conjunto.',
  },
  {
    image: { src: '/landing/paso-compartir.webp', width: 610, height: 398 },
    title: 'Compartir',
    text: 'Selecciona qué información compartir con tu médico o familiares y durante cuánto tiempo.',
  },
] as const

export const FEATURES: readonly {
  icon: IconName
  title: string
  text: string
  example?: readonly string[]
}[] = [
  { icon: 'home', title: 'La información de salud en un solo lugar', text: 'Reúne medicación, alergias, vacunas y exámenes en el perfil de cada persona.', example: ['Medicación registrada', 'Alergias confirmadas'] },
  { icon: 'users', title: 'Cuidado compartido', text: 'Invita a las personas que te ayudan a cuidar y consulta los cambios que hicieron.' },
  { icon: 'history', title: 'Historial de cambios', text: 'Revisa quién creó o actualizó un registro y consulta sus versiones anteriores.' },
  { icon: 'camera', title: 'Digitalización de recetas', text: 'Yuyay lee el texto de una foto. Revisa, corrige y confirma los datos antes de guardarlos.', example: ['Receta fotografiada', 'Datos listos para revisar'] },
  { icon: 'calendar', title: 'Citas y recordatorios', text: 'Consulta la agenda y activa recordatorios en el móvil.' },
  { icon: 'file', title: 'Resumen para el médico', text: 'Reúne los registros relevantes y comparte el resumen con un enlace temporal.' },
]

/** Cifras oficiales del Perú: el número, a quién se refiere y por qué importa para Yuyay. */
export const FACTS = [
  {
    image: { src: '/landing/dato-cronicas.webp', width: 611, height: 280 },
    value: '45,6 %',
    text: 'de los hogares tiene una persona de 60 años o más',
    why: 'Muchas familias se turnan para cuidar a alguien.',
    source: 'INEI · II trim. 2026',
    url: 'https://www.inei.gob.pe/media/MenuRecursivo/boletines/informe_tecnico_adulto_mayor_2026_t2.pdf#page=2',
  },
  {
    image: { src: '/landing/dato-hipertension.webp', width: 600, height: 272 },
    value: '5,5 millones',
    text: 'de personas de 15 años o más viven con hipertensión arterial',
    why: 'Son tratamientos largos, con dosis que cambian y hay que recordar.',
    source: 'MINSA · PP 0018, 2024',
    url: 'https://www.minsa.gob.pe/presupuestales/doc2024/reporte-seguimiento/Reporte_PP_0018_2024_I.pdf#page=4',
  },
  {
    image: { src: '/landing/dato-celular.webp', width: 603, height: 284 },
    value: '90,2 %',
    text: 'de las personas de 6 años o más que usan internet se conecta desde el celular',
    why: 'Por eso Yuyay va contigo en el bolsillo cuando llegas a la consulta.',
    source: 'INEI · ENAHO, II trim. 2026',
    url: 'https://www.inei.gob.pe/media/MenuRecursivo/boletines/boletin-tic-iit2026.pdf#page=15',
  },
] as const

/** Lo que la app ya hace con la privacidad. Sin afirmaciones de cifrado ni certificaciones. */
export const PRIVACY = [
  { icon: 'lock', title: 'Tú decides quién entra', text: 'Puedes invitar cuidadores al perfil y revocar su acceso. Los enlaces que compartes tienen sus propios permisos.' },
  { icon: 'users', title: 'Permisos para la familia', text: 'El cuidador principal puede administrar invitaciones, cuidadores y accesos temporales.' },
  { icon: 'clock', title: 'Enlaces que vencen', text: 'Los accesos para el médico o un familiar duran el tiempo que eliges y dejan de funcionar solos.' },
  { icon: 'eye', title: 'Compartes solo lo necesario', text: 'Eliges qué categorías ve cada acceso: por ejemplo, medicación y alergias, sin el resto.' },
  { icon: 'history', title: 'Historial de cambios', text: 'Cada dato guarda quién lo anotó, cuándo y si está confirmado. Las versiones anteriores se conservan.' },
  { icon: 'shield', title: 'Registro de accesos', text: 'La bitácora muestra quién consultó o cambió la información y cuándo.' },
] as const satisfies readonly { icon: IconName; title: string; text: string }[]

export const FAQ = [
  {
    q: '¿Qué es Yuyay?',
    a: 'Una aplicación web y móvil para organizar la información de salud de tu familia (medicamentos, alergias, vacunas, exámenes y citas) y compartirla con quienes también cuidan.',
  },
  {
    q: '¿Cómo empiezo a usar Yuyay?',
    a: 'Crea una cuenta en la web y agrega tu perfil o el de una persona a quien cuidas.',
  },
  {
    q: '¿Puedo gestionar la información de salud de un familiar?',
    a: 'Sí. Creas un perfil para cada persona que cuidas e indicas con qué autorización lo haces. También puedes tener tu propio perfil.',
  },
  {
    q: '¿El médico necesita instalar la aplicación?',
    a: 'No. Puede abrir el resumen desde el navegador con un enlace temporal. Si el enlace requiere código, se lo das al momento de abrirlo.',
  },
  {
    q: '¿Quién puede acceder a mi información?',
    a: 'Los cuidadores que invitas y las personas a quienes les compartes un enlace, mientras esté vigente. En la bitácora ves quién entró y cuándo.',
  },
  {
    q: '¿Cómo funciona la digitalización de recetas?',
    a: 'Subes una foto o un PDF de una página y Yuyay lee el texto. Nada se guarda solo: revisas cada dato, lo corriges si hace falta y lo confirmas.',
  },
  {
    q: '¿Puedo dejar de compartir mi información?',
    a: 'Sí. Puedes revocar un enlace o un acceso temporal antes de que venza y quitarle el acceso a un cuidador.',
  },
  {
    q: '¿Yuyay reemplaza una consulta médica?',
    a: 'No. Yuyay ordena la información para que llegues preparado. No diagnostica, no sugiere dosis y no sustituye las indicaciones de un profesional de la salud.',
  },
] as const

export const TEAM = [
  'Luis Felipe Augusto Huapaya Núñez',
  'Nayra Kamila Paredes Rodriguez',
  'Valentina Yamile Puicon Arapa',
  'Jocelyn Avril Uceda Tang',
] as const
