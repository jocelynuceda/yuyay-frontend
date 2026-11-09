import { getStateFromPath, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform, View } from 'react-native';
import { Button } from 'react-native-paper';
import { LoadingView } from '../components/LoadingView';
import { StatusMessage } from '../components/StatusMessage';
import { useAuth } from '../hooks/useAuth';
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
  // Las demás pantallas reciben objetos como parámetros: al recargar la web se vuelve al inicio
  getStateFromPath: (path, options) => (/^\/?acceso(\/|$)/.test(path) ? getStateFromPath(path, options) : undefined),
  config: {
    initialRouteName: 'Main',
    screens: { Main: '', Delegate: 'acceso/:token?' },
  },
};

/** Sin sesión: login y registro (con acceso a la bienvenida). Con sesión: la app con pestañas. */
function MainScreen() {
  const { status, recoveryError, retrySession, logout } = useAuth();
  if (status === 'loading') return <LoadingView label="Abriendo Yuyay…" />;
  if (status === 'recoverable' || status === 'logout-failed') return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
      <StatusMessage message={recoveryError ?? 'No pudimos recuperar tu sesión.'} />
      <Button mode="contained" onPress={() => { void retrySession(); }}>
        {status === 'logout-failed' ? 'Reintentar cierre de sesión' : 'Reintentar conexión'}
      </Button>
      {status === 'recoverable' ? <Button onPress={() => { void logout(); }}>Usar otra cuenta</Button> : null}
    </View>
  );
  return status === 'authenticated' ? <TabNavigator /> : <AuthStackNavigator />;
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
