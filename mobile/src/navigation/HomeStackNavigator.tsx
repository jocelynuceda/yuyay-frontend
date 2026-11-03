import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CaregiversScreen } from '../screens/CaregiversScreen';
import { ConsultationsScreen } from '../screens/ConsultationsScreen';
import { DelegationsScreen } from '../screens/DelegationsScreen';
import { HandoffsScreen } from '../screens/HandoffsScreen';
import { HandoffViewScreen } from '../screens/HandoffViewScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { InviteCaregiverScreen } from '../screens/InviteCaregiverScreen';
import { NearbyClinicsScreen } from '../screens/NearbyClinicsScreen';
import { NewConsultationScreen } from '../screens/NewConsultationScreen';
import { NewDelegationScreen } from '../screens/NewDelegationScreen';
import { NewEntryScreen } from '../screens/NewEntryScreen';
import { NewHandoffScreen } from '../screens/NewHandoffScreen';
import { NewSubjectScreen } from '../screens/NewSubjectScreen';
import { SubjectDetailScreen } from '../screens/SubjectDetailScreen';
import { UpcomingConsultationsScreen } from '../screens/UpcomingConsultationsScreen';
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
      <Stack.Screen name="Consultations" component={ConsultationsScreen} options={{ title: 'Citas' }} />
      <Stack.Screen
        name="NewConsultation"
        component={NewConsultationScreen}
        options={{ title: 'Nueva cita', presentation: 'modal' }}
      />
      <Stack.Screen
        name="UpcomingConsultations"
        component={UpcomingConsultationsScreen}
        options={{ title: 'Próximas citas' }}
      />
      <Stack.Screen name="Caregivers" component={CaregiversScreen} options={{ title: 'Cuidadores' }} />
      <Stack.Screen
        name="InviteCaregiver"
        component={InviteCaregiverScreen}
        options={{ title: 'Invitar cuidador', presentation: 'modal' }}
      />
      <Stack.Screen name="Handoffs" component={HandoffsScreen} options={{ title: 'Resúmenes' }} />
      <Stack.Screen
        name="NewHandoff"
        component={NewHandoffScreen}
        options={{ title: 'Nuevo resumen', presentation: 'modal' }}
      />
      <Stack.Screen name="HandoffView" component={HandoffViewScreen} options={{ title: 'Resumen' }} />
      <Stack.Screen name="Delegations" component={DelegationsScreen} options={{ title: 'Accesos delegados' }} />
      <Stack.Screen
        name="NewDelegation"
        component={NewDelegationScreen}
        options={{ title: 'Nuevo acceso', presentation: 'modal' }}
      />
      <Stack.Screen name="NearbyClinics" component={NearbyClinicsScreen} options={{ title: 'Clínicas cercanas' }} />
    </Stack.Navigator>
  );
}
