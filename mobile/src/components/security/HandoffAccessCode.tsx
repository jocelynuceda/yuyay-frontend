import { useIsFocused } from '@react-navigation/native';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { ActivityIndicator, AppState, Platform, Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import Svg, { Circle } from 'react-native-svg';
import { createHandoffAccessCode } from '../../services/security/handoffAccessCode';
import { getHandoffAccessCode } from '../../services/api';
import { fonts, makeStyles, radius, useTheme } from '../../theme';

/** El código permanece sólo en memoria y se borra cuando el panel deja de estar visible. */
export function HandoffAccessCode({ sessionId }: { sessionId: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const focused = useIsFocused();
  const model = useMemo(() => createHandoffAccessCode((signal) => getHandoffAccessCode(sessionId, signal)), [sessionId]);
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot);

  useEffect(() => {
    const activate = () => model.setActive(focused && AppState.currentState === 'active');
    activate();
    const change = AppState.addEventListener('change', (value) => model.setActive(focused && value === 'active'));
    const blur = Platform.OS === 'android' ? AppState.addEventListener('blur', () => model.setActive(false)) : null;
    const focus = Platform.OS === 'android' ? AppState.addEventListener('focus', activate) : null;
    const timer = setInterval(model.tick, 200);
    return () => { change.remove(); blur?.remove(); focus?.remove(); clearInterval(timer); model.setActive(false); };
  }, [focused, model]);

  const ready = focused && state.phase === 'ready';
  const visible = ready && state.code !== null;
  const circumference = 2 * Math.PI * 22;
  return (
    <View style={styles.panel}>
      <View style={styles.heading}>
        <View style={styles.flex}>
          <Text style={styles.title}>Código de acceso</Text>
          <Text style={styles.help}>Díselo al médico cuando vaya a abrir el enlace. Cambia cada 30 segundos.</Text>
        </View>
        <View style={styles.clock} accessibilityLabel={ready ? `Próximo código en ${state.secondsRemaining} segundos` : 'Código no disponible'}>
          <Svg width={54} height={54} viewBox="0 0 54 54" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Circle cx={27} cy={27} r={22} stroke={colors.line} strokeWidth={4} fill="none" />
            <Circle cx={27} cy={27} r={22} stroke={colors.primary} strokeWidth={4} fill="none"
              strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference * (1 - (ready ? state.progress : 0))}
              rotation={-90} origin="27,27" strokeLinecap="round" />
          </Svg>
          <Text style={styles.seconds}>{ready ? `${state.secondsRemaining}s` : '—'}</Text>
        </View>
      </View>
      {visible ? (
        <View style={styles.digits} accessible accessibilityLabel={`Código de acceso: ${state.code!.split('').join(' ')}`}>
          {state.code!.split('').map((digit, index) => <View key={index} style={styles.digitBox}><Text style={styles.digit}>{digit}</Text></View>)}
        </View>
      ) : ready && state.consumed ? (
        <Text style={styles.help}>Código utilizado. El próximo estará disponible en {state.secondsRemaining} segundos.</Text>
      ) : state.phase === 'loading' || state.phase === 'waiting' ? (
        <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={styles.help}>Actualizando código…</Text></View>
      ) : (
        <Text style={styles.help}>{state.phase === 'error' ? 'No pudimos obtener un código vigente. Puede que el enlace haya vencido o se haya revocado.' : 'El código se mostrará al volver a esta pantalla.'}</Text>
      )}
      <Text style={styles.help}>Comparte el código por separado del enlace.</Text>
      {state.phase === 'error' && <Button onPress={() => void model.reload()} icon="refresh">Reintentar</Button>}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  panel: { backgroundColor: colors.soft, borderRadius: radius.lg, padding: 16, gap: 14 },
  heading: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  flex: { flex: 1, gap: 4 },
  title: { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink },
  help: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.muted },
  clock: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center' },
  seconds: { position: 'absolute', fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  digits: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  digitBox: { flex: 1, maxWidth: 44, minHeight: 54, borderRadius: radius.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  digit: { fontFamily: fonts.display, fontSize: 28, color: colors.ink, fontVariant: ['tabular-nums'] },
  loading: { flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 54 },
}));
