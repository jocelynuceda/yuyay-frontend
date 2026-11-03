import { LoadingView } from '../components/LoadingView';
import { useAuth } from '../hooks/useAuth';
import { AuthStackNavigator } from './AuthStackNavigator';
import { TabNavigator } from './TabNavigator';

/** Sin sesión: login y registro (con acceso a la bienvenida). Con sesión: la app con pestañas. */
export function RootNavigator() {
  const { status } = useAuth();
  if (status === 'loading') return <LoadingView label="Abriendo Yuyay…" />;
  return status === 'authenticated' ? <TabNavigator /> : <AuthStackNavigator />;
}
