import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AccountTerms } from '../components/AccountTerms';
import { AppearancePicker } from '../components/AppearancePicker';
import { Logo } from '../components/Logo';
import { useAccountTerms } from '../hooks/useAccountTerms';
import { fonts, makeStyles, radius, useTheme } from '../theme';
import type { AuthStackParamList, RootStackParamList } from '../types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;
type IconName = keyof typeof Ionicons.glyphMap;

const features: { label: string; icon: IconName; description: string; example: string }[] = [
  { label: 'Inicio', icon: 'home-outline', description: 'Reúne medicamentos, alergias, vacunas y exámenes en cada perfil.', example: 'Rosa · 3 medicamentos registrados y 1 alergia confirmada' },
  { label: 'Medicación', icon: 'medkit-outline', description: 'Consulta quién actualizó un registro y revisa sus versiones anteriores.', example: 'Medicación · Último cambio registrado por Lucía' },
  { label: 'Recetas', icon: 'camera-outline', description: 'Revisa y confirma los datos que Yuyay lee de una foto de tu receta.', example: 'Receta fotografiada · Datos pendientes de revisión' },
  { label: 'Familia', icon: 'people-outline', description: 'Invita a otros cuidadores para organizar juntos la información de salud.', example: 'Lucía · Cuidadora principal · Una invitación pendiente' },
  { label: 'Citas', icon: 'calendar-outline', description: 'Consulta la agenda y activa recordatorios en el móvil.', example: 'Próxima cita · Control con cardiología' },
  { label: 'Resumen', icon: 'document-text-outline', description: 'Elige qué registros compartir y envía un enlace temporal al médico.', example: 'Resumen para la consulta · Medicación y alergias' },
];

const questions = [
  ['¿Qué es Yuyay?', 'Una aplicación para organizar la información de salud personal y familiar.'],
  ['¿Cómo empiezo?', 'Crea una cuenta y agrega tu perfil o el de una persona a quien cuidas.'],
  ['¿Puedo cuidar a un familiar?', 'Sí. Al crear su perfil indicas con qué autorización lo haces y puedes invitar a otros cuidadores.'],
  ['¿El médico necesita instalar la aplicación?', 'Puede abrir el resumen desde su navegador con un enlace temporal, sin crear una cuenta.'],
  ['¿Quién puede acceder a la información?', 'Los cuidadores que invitas y las personas con un enlace que siga vigente.'],
  ['¿Cómo se digitaliza una receta?', 'Sube una foto y revisa los datos que Yuyay extrajo antes de confirmarlos.'],
  ['¿Puedo dejar de compartir?', 'Puedes revocar enlaces temporales y retirar el acceso de un cuidador.'],
  ['¿Yuyay reemplaza una consulta médica?', 'Yuyay organiza información y no sustituye el diagnóstico, el tratamiento ni las indicaciones médicas.'],
] as const;

function ProductPreview() {
  const styles = useStyles();
  const { colors } = useTheme();
  const [selected, setSelected] = useState(0);
  const feature = features[selected];

  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>Conoce tu nueva memoria de salud.</Text>
      <View style={styles.selector} accessibilityRole="radiogroup" accessibilityLabel="Funciones de Yuyay">
        {features.map(({ label }, index) => (
          <Pressable
            key={label}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected === index }}
            onPress={() => setSelected(index)}
            style={[styles.option, selected === index && styles.optionActive]}
          >
            <Text style={[styles.optionText, selected === index && styles.primaryText]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.card} accessibilityLiveRegion="polite">
        <View style={styles.row}>
          <Ionicons name={feature.icon} size={22} color={colors.primary} />
          <Text style={styles.cardTitle}>{feature.label}</Text>
        </View>
        <Text style={styles.body}>{feature.description}</Text>
        <View style={styles.example}>
          <Text style={styles.caption}>Datos de ejemplo</Text>
          <Text style={styles.cardTitle}>{feature.example}</Text>
        </View>
      </View>
    </View>
  );
}

function Question({ title, answer }: { title: string; answer: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.question}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={styles.questionButton}
      >
        <Text style={styles.questionText}>{title}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.primary} />
      </Pressable>
      {expanded && <Text style={[styles.body, styles.answer]}>{answer}</Text>}
    </View>
  );
}

export function WelcomeScreen({ navigation }: Props) {
  const styles = useStyles();
  const terms = useAccountTerms();
  const rootNavigation = useNavigation<NavigationProp<RootStackParamList>>();
  const login = () => navigation.navigate('Login');
  const register = () => navigation.navigate('Register');

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <Logo />
        <Pressable accessibilityRole="button" onPress={login} style={styles.topAction}>
          <Text style={styles.optionText}>Iniciar sesión</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.section}>
          <Text style={styles.eyebrow}>Yuyay · «recordar» en quechua</Text>
          <Text accessibilityRole="header" style={styles.title}>La salud de tu familia, en un solo lugar.</Text>
          <Text style={styles.body}>Organiza medicamentos, recetas y citas. Comparte el cuidado con tu familia y llega preparado a cada consulta.</Text>
          <View style={styles.heroActions}>
            <Pressable accessibilityRole="button" onPress={register} style={styles.primary}>
              <Text style={styles.primaryText}>Crear cuenta</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => rootNavigation.navigate('Delegate')} style={styles.topAction}>
              <Text style={styles.optionText}>Tengo un código</Text>
            </Pressable>
          </View>
          <Image
            source={require('../../assets/landing/abuelo-hija.webp')}
            accessible
            accessibilityLabel="Una persona mayor sonríe junto a su hija."
            resizeMode="contain"
            style={styles.heroImage}
          />
        </View>

        <ProductPreview />

        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.heading}>Tu salud. Tus datos. Tú decides.</Text>
          <Text style={styles.body}>Administra quién tiene acceso, elige qué compartir y revoca los enlaces temporales cuando lo necesites.</Text>
          <AccountTerms terms={terms} />
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.heading}>Preguntas frecuentes</Text>
          <Image
            source={require('../../assets/landing/preguntas-frecuentes.webp')}
            resizeMode="contain"
            accessible={false}
            style={styles.faqImage}
          />
          <View style={styles.questions}>
            {questions.map(([title, answer]) => <Question key={title} title={title} answer={answer} />)}
          </View>
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.heading}>Apariencia</Text>
          <AppearancePicker />
        </View>

        <View style={styles.closing}>
          <Text accessibilityRole="header" style={styles.heading}>En tu próxima consulta, recuerda lo que importa.</Text>
          <Pressable accessibilityRole="button" onPress={register} style={styles.primary}>
            <Text style={styles.primaryText}>Crear cuenta</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={login} style={styles.topAction}>
            <Text style={styles.optionText}>Iniciar sesión</Text>
          </Pressable>
          <Text style={styles.caption}>Recordar, juntos · Desarrollo Basado en Plataformas, UTEC</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  topBar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderBottomWidth: 1, borderColor: colors.line, paddingHorizontal: 18, paddingVertical: 6 },
  topAction: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: 48, paddingHorizontal: 12 },
  scroll: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: 18, paddingBottom: 24, gap: 28 },
  section: { gap: 12 },
  eyebrow: { color: colors.accentText, fontFamily: fonts.semibold, fontSize: 14 },
  title: { color: colors.ink, fontFamily: fonts.display, fontSize: 40, lineHeight: 44 },
  heading: { color: colors.ink, fontFamily: fonts.display, fontSize: 28, lineHeight: 32 },
  body: { color: colors.muted, fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  primary: { minHeight: 48, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 10, backgroundColor: colors.ink, borderRadius: radius.pill },
  primaryText: { color: colors.onInk, fontFamily: fonts.semibold, fontSize: 16 },
  heroImage: { width: '100%', aspectRatio: 758 / 576, borderRadius: 24, backgroundColor: colors.soft },
  faqImage: { width: '100%', maxWidth: 480, aspectRatio: 1.5, borderRadius: 20, alignSelf: 'center' },
  selector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  optionActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  optionText: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 15 },
  card: { borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, padding: 16, gap: 10 },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 16, flexShrink: 1 },
  example: { backgroundColor: colors.soft, padding: 12, borderRadius: 14, gap: 4 },
  caption: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13 },
  questions: { borderWidth: 1, borderColor: colors.line, borderRadius: 20, backgroundColor: colors.card, overflow: 'hidden' },
  question: { borderBottomWidth: 1, borderColor: colors.line },
  questionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, padding: 14, gap: 10 },
  questionText: { flex: 1, color: colors.ink, fontFamily: fonts.semibold, fontSize: 16 },
  answer: { paddingHorizontal: 14, paddingBottom: 14 },
  closing: { padding: 18, gap: 8, borderRadius: 24, backgroundColor: colors.soft },
}));
