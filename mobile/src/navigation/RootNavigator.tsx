import { View } from 'react-native';
import { Button } from 'react-native-paper';
import { LoadingView } from '../components/LoadingView';
import { StatusMessage } from '../components/StatusMessage';
import { useAuth } from '../hooks/useAuth';
import { AuthStackNavigator } from './AuthStackNavigator';
import { TabNavigator } from './TabNavigator';

export function RootNavigator() {
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
