import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AccessLogDetailScreen } from '../screens/AccessLogDetailScreen';
import { AccessLogScreen } from '../screens/AccessLogScreen';
import { CaregiversScreen } from '../screens/CaregiversScreen';
import { ConsultationChangesScreen } from '../screens/ConsultationChangesScreen';
import { ConsultationsScreen } from '../screens/ConsultationsScreen';
import { DelegationsScreen } from '../screens/DelegationsScreen';
import { DocumentsScreen } from '../screens/DocumentsScreen';
import { EditEntryScreen } from '../screens/EditEntryScreen';
import { EditSubjectScreen } from '../screens/EditSubjectScreen';
import { EntryHistoryScreen } from '../screens/EntryHistoryScreen';
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
import { ReviewOcrScreen } from '../screens/ReviewOcrScreen';
import { VoiceNotesScreen } from '../screens/VoiceNotesScreen';
import { SubjectDetailScreen } from '../screens/SubjectDetailScreen';
import { UpcomingConsultationsScreen } from '../screens/UpcomingConsultationsScreen';
import { fonts, useTheme } from '../theme';
import type { HomeStackParamList } from '../types';
import { ExamsScreen } from '../screens/ExamsScreen';
import { EXAM_CATEGORY } from '../utils/categories';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStackNavigator() {
  const { colors } = useTheme();
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
        name="EditSubject"
        component={EditSubjectScreen}
        options={{ title: 'Editar datos', presentation: 'modal' }}
      />
      <Stack.Screen
        name="NewEntry"
        component={NewEntryScreen}
        options={({ route }) => ({
          title: route.params.categoryCode === EXAM_CATEGORY ? 'Nuevo examen' : 'Nuevo registro',
          presentation: 'modal',
        })}
      />
      <Stack.Screen name="Exams" component={ExamsScreen} options={{ title: 'Exámenes' }} />
      <Stack.Screen name="Consultations" component={ConsultationsScreen} options={{ title: 'Citas' }} />
      <Stack.Screen
        name="NewConsultation"
        component={NewConsultationScreen}
        options={({ route }) => ({
          title: route.params.consultation ? 'Editar cita' : 'Nueva cita',
          presentation: 'modal',
        })}
      />
      <Stack.Screen
        name="ConsultationChanges"
        component={ConsultationChangesScreen}
        options={{ title: 'Cambios desde la cita' }}
      />
      <Stack.Screen
        name="EditEntry"
        component={EditEntryScreen}
        options={{ title: 'Editar registro', presentation: 'modal' }}
      />
      <Stack.Screen name="EntryHistory" component={EntryHistoryScreen} options={{ title: 'Historial' }} />
      <Stack.Screen name="AccessLog" component={AccessLogScreen} options={{ title: 'Bitácora' }} />
      <Stack.Screen name="AccessLogDetail" component={AccessLogDetailScreen} options={{ title: 'Detalle' }} />
      <Stack.Screen name="Documents" component={DocumentsScreen} options={{ title: 'Documentos' }} />
      <Stack.Screen name="ReviewOcr" component={ReviewOcrScreen} options={{ title: 'Revisar documento' }} />
      <Stack.Screen name="VoiceNotes" component={VoiceNotesScreen} options={{ title: 'Notas de voz' }} />
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
