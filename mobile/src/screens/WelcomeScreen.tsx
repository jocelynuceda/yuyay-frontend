import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge } from '../components/Badge';
import { Dashes, Scallops, Wave } from '../components/Decor';
import { Logo } from '../components/Logo';
import { FadeIn, PressableScale } from '../components/Motion';
import { Sparkle } from '../components/Sparkle';
import { fonts, makeStyles, radius, useTheme, type Colors } from '../theme';
import type { AuthStackParamList } from '../types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

type IconName = keyof typeof Ionicons.glyphMap;

/** Las tres "bolas" apiladas de la portada: lo que guarda Yuyay de una persona. */
const scoopsFor = (colors: Colors): { icon: IconName; bg: string; fg: string }[] => [
  { icon: 'medkit', bg: colors.accent, fg: colors.onAccent },
  { icon: 'heart', bg: colors.soft, fg: colors.softText },
  { icon: 'calendar', bg: colors.primary, fg: colors.white },
];

const featuresFor = (colors: Colors): { icon: IconName; title: string; text: string; bg: string; fg: string; tilt: string }[] => [
  { icon: 'time', title: 'Historial que no se borra', text: 'Cada cambio queda con autor y fecha.', bg: colors.accent, fg: colors.onAccent, tilt: '-6deg' },
  { icon: 'people', title: 'Toda la familia al tanto', text: 'Invita a otros cuidadores por correo.', bg: colors.primary, fg: colors.white, tilt: '3deg' },
  { icon: 'link', title: 'Listo para la consulta', text: 'Comparte un resumen con el médico.', bg: colors.soft, fg: colors.softText, tilt: '-3deg' },
];

/** Círculo con borde grueso del color de tarjeta, como una calcomanía. */
function Sticker({ icon, bg, fg, size }: { icon: IconName; bg: string; fg: string; size: number }) {
  const styles = useStyles();
  return (
    <View style={[styles.sticker, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Ionicons name={icon} size={size * 0.38} color={fg} />
    </View>
  );
}

/** Vista previa ilustrativa (no son datos reales). */
function PreviewCard() {
  const styles = useStyles();
  const { colors } = useTheme();
  const items = [
    { title: 'Metformina 850 mg', meta: 'Cada 12 h · por Lucía', ok: true },
    { title: 'Alergia a penicilina', meta: 'Versión 2 · por Diego', ok: true },
    { title: 'Hipertensión', meta: 'Desde 2019 · por Ana', ok: false },
  ];
  return (
    <View style={styles.previewWrap}>
      <Scallops color={colors.card} count={10} height={12} up />
      <View style={styles.preview}>
        <View style={styles.previewHeader}>
          <View style={styles.previewAvatar}>
            <Text style={styles.previewInitial}>R</Text>
          </View>
          <View>
            <Text style={styles.previewName}>Rosa, 78 años</Text>
            <Text style={styles.previewMeta}>Persona a tu cuidado</Text>
          </View>
        </View>
        {items.map((item) => (
          <View key={item.title} style={styles.previewRow}>
            <Sparkle size={14} />
            <View style={styles.flex}>
              <Text style={styles.previewTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.previewMeta}>{item.meta}</Text>
            </View>
            <Badge label={item.ok ? 'Confirmado' : 'Por confirmar'} tone={item.ok ? 'accent' : 'amber'} />
          </View>
        ))}
      </View>
      <Scallops color={colors.card} count={10} height={12} />
    </View>
  );
}

export function WelcomeScreen({ navigation }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const scoops = scoopsFor(colors);
  const features = featuresFor(colors);

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <View style={styles.topRow}>
          <Logo />
          <PressableScale
            onPress={() => navigation.navigate('Login')}
            style={styles.topButton}
            accessibilityRole="button"
            accessibilityLabel="Ya tengo cuenta"
          >
            <Text style={styles.topButtonText}>Entrar</Text>
          </PressableScale>
        </View>
      </SafeAreaView>
      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        <Scallops color={colors.cream} style={styles.topScallops} />

        {/* Portada */}
        <View style={styles.hero}>
          <View style={styles.heroBlob} />
          <View style={styles.heroCircle} />
          <FadeIn>
            <Text style={styles.title}>El cuidado,{'\n'}compartido.</Text>
            <Text style={styles.subtitle}>
              Un solo lugar para la salud de quien cuidas, y un toque de calma para toda la familia.
            </Text>
            <PressableScale
              onPress={() => navigation.navigate('Register')}
              style={styles.cta}
              accessibilityRole="button"
              accessibilityLabel="Empieza gratis"
            >
              <Text style={styles.ctaText}>Empieza gratis</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.onInk} />
            </PressableScale>
          </FadeIn>

          <FadeIn delay={150} style={styles.stackArea}>
            <View style={styles.stack}>
              {scoops.map((s, i) => (
                <View key={s.icon} style={i > 0 && styles.scoopOverlap}>
                  <Sticker icon={s.icon} bg={s.bg} fg={s.fg} size={92 - i * 4} />
                </View>
              ))}
              <View style={styles.cone}>
                <Text style={styles.coneText}>Rosa · 78</Text>
              </View>
            </View>
            <View style={styles.note}>
              <Ionicons name="arrow-undo-outline" size={22} color={colors.ink} style={styles.noteArrow} />
              <Text style={styles.noteText}>¡Todo en{'\n'}un lugar!</Text>
            </View>
          </FadeIn>
        </View>

        {/* Tarjetas inclinadas */}
        <Wave from={colors.surface} to={colors.soft} />
        <View style={styles.cardsSection}>
          <View style={styles.cardsRow}>
            {features.map((f, i) => (
              <View key={f.title} style={[styles.featureSlot, { transform: [{ rotate: f.tilt }] }, i === 1 && styles.featureCardRaised]}>
                <FadeIn delay={200 + i * 100} style={styles.featureCard}>
                  <Sticker icon={f.icon} bg={f.bg} fg={f.fg} size={58} />
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureText}>{f.text}</Text>
                </FadeIn>
              </View>
            ))}
          </View>
        </View>
        <Wave from={colors.soft} to={colors.cream} />

        {/* Idea */}
        <View style={styles.story}>
          <View style={styles.storyBlobA} />
          <View style={styles.storyBlobB} />
          <Text style={styles.eyebrow}>YUYAY SIGNIFICA «RECORDAR»</Text>
          <Text style={styles.storyTitle}>Hecho para no olvidar lo que importa.</Text>
          <Text style={styles.storyText}>
            Qué toma, qué cambió y quién lo anotó. Cada registro guarda su historia para que nadie tenga que
            acordarse de todo.
          </Text>
          <PreviewCard />
        </View>

        {/* Boleto final */}
        <Wave from={colors.cream} to={colors.primary} />
        <View style={styles.final}>
          <View style={styles.finalCircle} />
          <Text style={styles.finalTitle}>Lleva el cuidado{'\n'}contigo</Text>
          <View style={styles.ticketWrap}>
            <Scallops color={colors.card} count={12} height={10} up />
            <View style={styles.ticket}>
              <Text style={styles.ticketTitle}>Únete a Yuyay</Text>
              <Dashes color={colors.line} style={styles.dashes} />
              <Text style={styles.ticketLine}>Gratis para toda la familia</Text>
              <Text style={styles.ticketMeta}>Sin anuncios · Tus datos son tuyos</Text>
              <Dashes color={colors.line} style={styles.dashes} />
              <PressableScale
                onPress={() => navigation.navigate('Register')}
                style={[styles.cta, styles.ticketCta]}
                accessibilityRole="button"
                accessibilityLabel="Crear mi cuenta"
              >
                <Text style={styles.ctaText}>Crear mi cuenta</Text>
                <Ionicons name="arrow-forward" size={18} color={colors.onInk} />
              </PressableScale>
              <PressableScale
                onPress={() => navigation.navigate('Login')}
                style={styles.ticketSecondary}
                accessibilityRole="button"
                accessibilityLabel="Ya tengo cuenta"
              >
                <Text style={styles.ticketSecondaryText}>Ya tengo cuenta</Text>
              </PressableScale>
              <View style={styles.stars}>
                {[0, 1, 2].map((i) => (
                  <Sparkle key={i} size={16} color={colors.muted} />
                ))}
              </View>
            </View>
            <Scallops color={colors.card} count={12} height={10} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles(({ colors, shadow }) => ({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.primary },
  scroll: { backgroundColor: colors.surface, paddingBottom: 0 },
  topBar: { backgroundColor: colors.cream, zIndex: 2 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 6,
  },
  topScallops: { marginTop: -1 },
  topButton: { backgroundColor: colors.ink, borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 9 },
  topButtonText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.onInk },

  hero: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8, overflow: 'hidden' },
  heroBlob: {
    position: 'absolute',
    top: 210,
    right: -90,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: colors.primaryTint,
  },
  heroCircle: {
    position: 'absolute',
    top: 300,
    right: 30,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.soft,
  },
  title: { fontFamily: fonts.display, fontSize: 50, lineHeight: 52, color: colors.ink, letterSpacing: -1 },
  subtitle: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.muted, marginTop: 16, maxWidth: 320 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    paddingHorizontal: 22,
    paddingVertical: 14,
    marginTop: 22,
  },
  ctaText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.onInk },
  stackArea: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', marginTop: 28, gap: 8 },
  stack: { alignItems: 'center', marginLeft: 70 },
  scoopOverlap: { marginTop: -22 },
  sticker: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    borderColor: colors.card,
    ...shadow,
  },
  cone: {
    marginTop: -10,
    width: 76,
    paddingTop: 22,
    paddingBottom: 26,
    borderBottomLeftRadius: 38,
    borderBottomRightRadius: 38,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: colors.amberBg,
    alignItems: 'center',
    zIndex: -1,
  },
  coneText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.amberText },
  note: { width: 80, marginBottom: 40 },
  noteArrow: { transform: [{ rotate: '-20deg' }], marginBottom: 2 },
  noteText: { fontFamily: fonts.displayMedium, fontSize: 15, lineHeight: 18, color: colors.ink, transform: [{ rotate: '-8deg' }] },

  cardsSection: { backgroundColor: colors.soft, paddingHorizontal: 20, paddingVertical: 20 },
  cardsRow: { flexDirection: 'row', justifyContent: 'center' },
  featureSlot: { flex: 1, maxWidth: 140, marginHorizontal: -4 },
  featureCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 18,
    alignItems: 'center',
    gap: 8,
    ...shadow,
  },
  featureCardRaised: { marginTop: -14, zIndex: 1 },
  featureTitle: { fontFamily: fonts.display, fontSize: 15, lineHeight: 18, textAlign: 'center', color: colors.ink },
  featureText: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 15, textAlign: 'center', color: colors.muted },

  story: { backgroundColor: colors.cream, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28, overflow: 'hidden' },
  storyBlobA: { position: 'absolute', top: -10, right: 40, width: 70, height: 60, borderRadius: 30, backgroundColor: colors.accentTint },
  storyBlobB: { position: 'absolute', top: 40, right: -30, width: 120, height: 110, borderRadius: 55, backgroundColor: colors.accentTint },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1, color: colors.accentText },
  storyTitle: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, color: colors.ink, marginTop: 8 },
  storyText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.muted, marginTop: 10 },
  previewWrap: { marginTop: 24, ...shadow, shadowOpacity: shadow.shadowOpacity / 2 },
  preview: { backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 6, gap: 10 },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2 },
  previewAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewInitial: { fontFamily: fonts.display, fontSize: 18, color: colors.softText },
  previewName: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  previewMeta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 10,
  },
  previewTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },

  final: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 56, overflow: 'hidden' },
  finalCircle: {
    position: 'absolute',
    top: -20,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  finalTitle: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, color: colors.white },
  ticketWrap: { marginTop: 24, marginHorizontal: 12, transform: [{ rotate: '2deg' }], ...shadow },
  ticket: { backgroundColor: colors.card, paddingHorizontal: 22, paddingVertical: 10 },
  ticketTitle: { fontFamily: fonts.display, fontSize: 26, color: colors.ink, textAlign: 'center' },
  dashes: { alignSelf: 'stretch', marginVertical: 12 },
  ticketLine: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, textAlign: 'center' },
  ticketMeta: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2, textAlign: 'center' },
  ticketCta: { alignSelf: 'stretch', justifyContent: 'center', marginTop: 4 },
  ticketSecondary: {
    alignSelf: 'stretch',
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.line,
    paddingVertical: 13,
    marginTop: 10,
  },
  ticketSecondaryText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  stars: { flexDirection: 'row', alignSelf: 'center', gap: 8, marginTop: 14, marginBottom: 4 },
}));
