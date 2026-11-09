import { Fraunces_500Medium, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LoadingView } from './src/components/LoadingView';
import { OfflineBanner } from './src/components/OfflineBanner';
import { AuthProvider } from './src/contexts/AuthContext';
import { linking, RootNavigator } from './src/navigation/RootNavigator';
import { ThemeProvider, useTheme, useThemePreference } from './src/theme';

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
    Fraunces_500Medium,
    Fraunces_600SemiBold,
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
            <NavigationContainer theme={theme.navigationTheme} linking={linking}>
              <RootNavigator />
            </NavigationContainer>
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
