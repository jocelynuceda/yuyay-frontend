import { Fraunces_500Medium, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LoadingView } from './src/components/LoadingView';
import { AuthProvider } from './src/contexts/AuthContext';
import { linking, RootNavigator } from './src/navigation/RootNavigator';
import { colors, paperTheme } from './src/theme';

const navigationTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: colors.primary, background: colors.surface, text: colors.ink },
};

export default function App() {
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
      <PaperProvider theme={paperTheme}>
        {fontsLoaded ? (
          <AuthProvider>
            <NavigationContainer theme={navigationTheme} linking={linking}>
              <RootNavigator />
            </NavigationContainer>
          </AuthProvider>
        ) : (
          <LoadingView label="" />
        )}
        <StatusBar style="dark" />
      </PaperProvider>
    </SafeAreaProvider>
  );
}
