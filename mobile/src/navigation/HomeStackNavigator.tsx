import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { EditEntryScreen } from '../screens/EditEntryScreen';
import { EntryHistoryScreen } from '../screens/EntryHistoryScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { NewEntryScreen } from '../screens/NewEntryScreen';
import { NewSubjectScreen } from '../screens/NewSubjectScreen';
import { SubjectDetailScreen } from '../screens/SubjectDetailScreen';
import { colors, fonts } from '../theme';
import type { HomeStackParamList } from '../types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontFamily: fonts.display, fontSize: 18 },
        contentStyle: { backgroundColor: colors.surface },
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        // El Inicio dibuja su propia cabecera con saludo y accesos rápidos
        options={{ title: 'Inicio', headerShown: false }}
      />
      <Stack.Screen
        name="SubjectDetail"
        component={SubjectDetailScreen}
        options={({ route }) => ({ title: route.params.name })}
      />
      <Stack.Screen
        name="NewSubject"
        component={NewSubjectScreen}
        options={{ title: 'Nueva persona', presentation: 'modal' }}
      />
      <Stack.Screen
        name="NewEntry"
        component={NewEntryScreen}
        options={{ title: 'Nuevo registro', presentation: 'modal' }}
      />
      <Stack.Screen name="EntryHistory" component={EntryHistoryScreen} options={{ title: 'Registro' }} />
      <Stack.Screen
        name="EditEntry"
        component={EditEntryScreen}
        options={{ title: 'Editar registro', presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
