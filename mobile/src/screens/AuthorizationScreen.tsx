import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Text } from 'react-native';
import { Button } from 'react-native-paper';
import { AuthorizationPicker } from '../components/AuthorizationPicker';
import { FormCard, SubmitButton } from '../components/FormKit';
import { FormScroll } from '../components/FormScroll';
import { LoadingView } from '../components/LoadingView';
import { StatusMessage } from '../components/StatusMessage';
import { useFetch } from '../hooks/useFetch';
import { useToast } from '../hooks/useToast';
import { declareAuthorization, getAuthorizationPolicy } from '../services/api';
import { ApiError } from '../services/http';
import { fonts, makeStyles } from '../theme';
import type { HomeStackParamList } from '../types';
import { buildDeclaration, emptyAuthorizationChoice, type AuthorizationChoice } from '../utils/authorization';

type Props = NativeStackScreenProps<HomeStackParamList, 'AuthorizationDeclaration'>;

/** Registra o cambia la declaración de un perfil que ya existe. Solo el cuidador principal llega aquí. */
export function AuthorizationScreen({ navigation, route }: Props) {
  const { subjectId, previousDeclarationId } = route.params;
  const styles = useStyles();
  const policy = useFetch(getAuthorizationPolicy);
  const [choice, setChoice] = useState<AuthorizationChoice>(emptyAuthorizationChoice);
  const [choiceError, setChoiceError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  if (!policy.data) {
    if (policy.error) {
      return (
        <FormScroll contentContainerStyle={styles.container}>
          <StatusMessage message={policy.error} />
          <Button mode="text" onPress={policy.reload}>
            Reintentar
          </Button>
        </FormScroll>
      );
    }
    return <LoadingView />;
  }

  async function handleSave() {
    if (!policy.data) return;
    const result = buildDeclaration(policy.data, choice);
    setChoiceError(result.ok ? null : result.error);
    if (!result.ok) return;
    setSaving(true);
    setError(null);
    try {
      await declareAuthorization(subjectId, { ...result.declaration, previousDeclarationId });
      toast('Declaración registrada.');
      navigation.goBack();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No pudimos registrar la declaración.');
      if (e instanceof ApiError && e.status === 409) {
        // El texto o la declaración vigente cambiaron: hay que revisarlo de nuevo desde la ficha
        setChoice((current) => ({ ...current, confirmed: false }));
        policy.reload();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormScroll contentContainerStyle={styles.container}>
      <StatusMessage message={error} />
      <FormCard title="¿Para quién es este perfil?">
        <AuthorizationPicker
          policy={policy.data}
          value={choice}
          onChange={(next) => {
            setChoice(next);
            setChoiceError(null);
          }}
          error={choiceError}
        />
      </FormCard>
      <Text style={styles.hint}>Se guarda con la fecha y el texto que aceptaste. Puedes cambiarla después.</Text>
      <SubmitButton label="Registrar declaración" onPress={handleSave} loading={saving} />
    </FormScroll>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  container: { padding: 20, gap: 14 },
  hint: { fontFamily: fonts.regular, fontSize: 13, color: colors.softText, textAlign: 'center' },
}));
