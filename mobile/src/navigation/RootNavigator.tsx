import { getStateFromPath, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { AppState, Platform, View } from 'react-native';
import { Button } from 'react-native-paper';
import { LoadingView } from '../components/LoadingView';
import { StatusMessage } from '../components/StatusMessage';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { listenDoseReminderResponses, syncDoseReminders } from '../services/doseReminders';
import { DelegateScreen } from '../screens/DelegateScreen';
import { fonts, useTheme } from '../theme';
import type { RootStackParamList } from '../types';
import { AuthStackNavigator } from './AuthStackNavigator';
import { TabNavigator } from './TabNavigator';

const Stack = createNativeStackNavigator<RootStackParamList>();

/** El enlace de un acceso delegado se abre en el navegador, con la versión web de la app. */
export const linking: LinkingOptions<RootStackParamList> = {
  enabled: Platform.OS === 'web',
  prefixes: [],
  // Al recargar una pantalla interna de la app en web se vuelve al inicio.
  // /acceso es el enlace antiguo en español (el backend aún lo envía): se trata como /access
  getStateFromPath: (path, options) => {
    const normalized = path.replace(/^(\/?)acceso(?=\/|\?|#|$)/, '$1access');
    return /^\/?access(\/|\?|#|$)/.test(normalized) ? getStateFromPath(normalized, options) : undefined;
  },
  config: {
    initialRouteName: 'Main',
    screens: { Main: '', Delegate: 'access/:token?' },
  },
};

/** Sin sesión: login y registro (con acceso a la bienvenida). Con sesión: la app con pestañas. */
function MainScreen() {
  const { status, recoveryError, retrySession, logout } = useAuth();
  if (status === 'loading') return <LoadingView label="Abriendo Yuyay…" />;
  // El desbloqueo con biometría se muestra encima (BiometricLock)
  if (status === 'locked') return <LoadingView label="" />;
  if (status === 'recoverable' || status === 'logout-failed') return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
      <StatusMessage message={recoveryError ?? 'No pudimos recuperar tu sesión.'} />
      <Button mode="contained" onPress={() => { void retrySession(); }}>
        {status === 'logout-failed' ? 'Reintentar cierre de sesión' : 'Reintentar conexión'}
      </Button>
      {status === 'recoverable' ? <Button onPress={() => { void logout(); }}>Usar otra cuenta</Button> : null}
    </View>
  );
  return status === 'authenticated' ? (
    <>
      <DoseReminderListener />
      <TabNavigator />
    </>
  ) : (
    <AuthStackNavigator />
  );
}

/** El acceso delegado queda fuera de la sesión: quien lo abre normalmente no tiene cuenta. */
export function RootNavigator() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator>
      <Stack.Screen name="Main" component={MainScreen} options={{ title: 'Yuyay', headerShown: false }} />
      <Stack.Screen
        name="Delegate"
        component={DelegateScreen}
        options={{
          title: 'Acceso temporal',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontFamily: fonts.display, fontSize: 18 },
          contentStyle: { backgroundColor: colors.surface },
        }}
      />
    </Stack.Navigator>
  );
}

/** Responde a «Tomada» y «Posponer» de los avisos de tomas mientras hay sesión. */
function DoseReminderListener() {
  const { user } = useAuth();
  const toast = useToast();
  const userId = user?.id;
  useEffect(() => (userId === undefined ? undefined : listenDoseReminderResponses(userId, toast)), [userId, toast]);
  // Al volver a la app se renuevan los avisos de los próximos 14 días
  useEffect(() => {
    if (userId === undefined) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncDoseReminders(userId);
    });
    return () => subscription.remove();
  }, [userId]);
  return null;
}
