import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { FloatingTabBar } from '../components/FloatingTabBar';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { fonts, useTheme } from '../theme';
import type { TabNavigatorParamList } from '../types';
import { HomeStackNavigator } from './HomeStackNavigator';

const Tab = createBottomTabNavigator<TabNavigatorParamList>();

export function TabNavigator() {
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShadowVisible: false,
        headerTitleAlign: 'left',
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
        sceneStyle: { backgroundColor: colors.surface },
      }}
    >
      <Tab.Screen name="HomeTab" component={HomeStackNavigator} options={{ title: 'Inicio', headerShown: false }} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Avisos' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Mi perfil' }} />
    </Tab.Navigator>
  );
}
