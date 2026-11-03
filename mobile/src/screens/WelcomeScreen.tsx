import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuroraBackground } from '../components/AuroraBackground';
import { Badge } from '../components/Badge';
import { Logo } from '../components/Logo';
import { Sparkle } from '../components/Sparkle';
import { colors, fonts, radius, shadow } from '../theme';
import type { AuthStackParamList } from '../types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

const features = [
  { icon: 'time-outline', title: 'Historial que no se borra', text: 'Cada cambio queda con autor y fecha.' },
  { icon: 'people-outline', title: 'Toda la familia, al tanto', text: 'Invita a otros cuidadores por correo.' },
  { icon: 'link-outline', title: 'Listo para la consulta', text: 'Comparte un resumen con el médico.' },
] as const;

/** Vista previa ilustrativa (no son datos reales). */
function PreviewCard() {
  const items = [
    { title: 'Metformina 850 mg', meta: 'Cada 12 h · por Lucía', ok: true, bg: colors.accentTint },
    { title: 'Alergia a penicilina', meta: 'Versión 2 · por Diego', ok: true, bg: colors.soft },
    { title: 'Hipertensión', meta: 'Desde 2019 · por Ana', ok: false, bg: colors.soft },
  ];
  return (
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
          <View style={[styles.previewIcon, { backgroundColor: item.bg }]}>
            <Sparkle size={14} />
          </View>
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
  );
}

export function WelcomeScreen({ navigation }: Props) {
  return (
    <AuroraBackground>
      <SafeAreaView style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Logo />

          <View style={styles.hero}>
            <View style={styles.pill}>
              <Sparkle size={12} color={colors.accent} />
              <Text style={styles.pillText}>Yuyay significa «recordar» en quechua</Text>
            </View>
            <Text style={styles.title}>El cuidado,</Text>
            <Text style={[styles.title, styles.titleAccent]}>compartido.</Text>
            <Text style={styles.subtitle}>
              Un solo lugar para la salud de quien cuidas. Toda la familia sabe qué toma, qué cambió y
              quién lo anotó.
            </Text>
          </View>

          <PreviewCard />

          <View style={styles.features}>
            {features.map((f) => (
              <View key={f.title} style={styles.feature}>
                <View style={styles.featureIcon}>
                  <Ionicons name={f.icon} size={20} color={colors.primary} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureText}>{f.text}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.actions}>
            <Button
              mode="contained"
              onPress={() => navigation.navigate('Register')}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
              icon="arrow-right"
            >
              Empieza gratis
            </Button>
            <Button
              mode="outlined"
              onPress={() => navigation.navigate('Login')}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
              style={styles.outlined}
            >
              Ya tengo cuenta
            </Button>
          </View>
        </ScrollView>
      </SafeAreaView>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 32 },
  hero: { marginTop: 28 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 18,
  },
  pillText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.primary },
  title: { fontFamily: fonts.display, fontSize: 46, lineHeight: 50, color: colors.ink },
  titleAccent: { color: colors.primary },
  subtitle: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.muted, marginTop: 14 },
  preview: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 16,
    marginTop: 28,
    gap: 10,
    ...shadow,
  },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  previewAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewInitial: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
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
  previewIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  previewTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  features: { marginTop: 28, gap: 12 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  featureText: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  actions: { marginTop: 32, gap: 12 },
  buttonContent: { height: 52, flexDirection: 'row-reverse' },
  buttonLabel: { fontFamily: fonts.semibold, fontSize: 16 },
  outlined: { backgroundColor: colors.white, borderColor: colors.line },
});
