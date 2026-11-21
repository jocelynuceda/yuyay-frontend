import { Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LoadingView } from './src/components/LoadingView';
import { OfflineBanner } from './src/components/OfflineBanner';
import { ReminderResponseHandler } from './src/components/ReminderResponseHandler';
import { AuthProvider } from './src/contexts/AuthContext';
import { ToastProvider } from './src/contexts/ToastContext';
import { linking, RootNavigator } from './src/navigation/RootNavigator';
import { ThemeProvider, useTheme, useThemePreference } from './src/theme';
import type { RootStackParamList } from './src/types';

const navigationRef = createNavigationContainerRef<RootStackParamList>();

export default function App() {
  return (
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  );
}

function ThemedApp() {
  const theme = useTheme();
  const { ready } = useThemePreference();
  const [fontsLoaded] = useFonts({
    Outfit_600SemiBold,
    Outfit_700Bold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    // Íconos de los campos de Paper y de la navegación, para que no aparezcan vacíos al inicio
    ...MaterialCommunityIcons.font,
    ...Ionicons.font,
  });

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme.paperTheme}>
        {fontsLoaded && ready ? (
          <AuthProvider>
            <ToastProvider>
              <NavigationContainer ref={navigationRef} theme={theme.navigationTheme} linking={linking}>
                <RootNavigator />
              </NavigationContainer>
              <ReminderResponseHandler navigation={navigationRef} />
            </ToastProvider>
          </AuthProvider>
        ) : (
          <LoadingView label="" />
        )}
        <OfflineBanner />
        <StatusBar style={theme.dark ? 'light' : 'dark'} />
      </PaperProvider>
    </SafeAreaProvider>
  );
}
