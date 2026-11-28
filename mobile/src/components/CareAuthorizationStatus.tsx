import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import { useFetch } from '../hooks/useFetch';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { getCareAuthorizationHistory, registerFirstDeclaration } from '../services/api';
import { useCareAuthorization } from '../hooks/useCareAuthorization';
import { CareAuthorizationFields } from './CareAuthorizationFields';
import { ApiError } from '../services/http';
import { fonts, makeStyles, radius } from '../theme';
import { declarationLabels, scopeLabels } from '../utils/careAuthorization';
import { formatDateTime } from '../utils/format';
import { FormCard } from './FormKit';
import { StatusMessage } from './StatusMessage';

export function CareAuthorizationStatus({ subjectId }: { subjectId: number }) {
  const styles = useStyles();
  const [showHistory, setShowHistory] = useState(false);
  const { data, error, loading, reload } = useFetch(async () => {
    try {
      return await getCareAuthorizationHistory(subjectId);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) return null;
      throw error;
    }
  }, [subjectId]);
  useRefreshOnFocus(reload);

  if (!loading && !error && !data) return null;
  const latest = data?.[0];

  return (
    <FormCard title="Declaración de autorización">
      {loading ? (
        <Text accessibilityLiveRegion="polite" style={styles.meta}>Consultando la declaración…</Text>
      ) : error ? (
        <>
          <StatusMessage message={error} />
          <Button onPress={reload}>Volver a consultar</Button>
        </>
      ) : latest ? (
        <>
          <Text style={styles.label}>Declaración registrada · {declarationLabels[latest.type]}</Text>
          <Text style={styles.meta}>Yuyay registra la declaración sin verificar la autorización.</Text>
          <Button
            icon={showHistory ? 'chevron-up' : 'chevron-down'}
            onPress={() => setShowHistory((value) => !value)}
            accessibilityState={{ expanded: showHistory }}
          >
            {showHistory ? 'Ocultar historial' : 'Ver historial de declaraciones'}
          </Button>
          {showHistory && data?.map((declaration) => (
            <View key={declaration.id} style={styles.entry}>
              <Text style={styles.label}>{declarationLabels[declaration.type]}</Text>
              <Text style={styles.meta}>{scopeLabels[declaration.scope]} · Versión {declaration.textVersion}</Text>
              <Text style={styles.meta}>{formatDateTime(declaration.declaredAt)}</Text>
              <Text style={styles.body}>{declaration.text}</Text>
            </View>
          ))}
        </>
      ) : (
        <FirstDeclaration key={subjectId} subjectId={subjectId} reload={reload} />
      )}
    </FormCard>
  );
}

function FirstDeclaration({ subjectId, reload }: { subjectId: number; reload: () => void }) {
  const styles = useStyles();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const posting = useRef(false);
  const authorization = useCareAuthorization(editing);

  async function save() {
    if (!authorization.declaration || posting.current) return;
    posting.current = true;
    setSaving(true);
    setError('');
    try {
      await registerFirstDeclaration(subjectId, authorization.declaration);
      reload();
    } catch (e) {
      if (e instanceof ApiError && (e.status === 403 || e.status === 409)) reload();
      else setError(e instanceof ApiError ? e.message : 'No pudimos guardar la declaración.');
    } finally {
      posting.current = false;
      setSaving(false);
    }
  }

  return <>
    <Text style={styles.meta}>Sin declaración registrada</Text>
    {editing ? <>
      <CareAuthorizationFields authorization={authorization} disabled={saving} existing />
      <StatusMessage message={error} />
      <Button mode="contained" disabled={!authorization.declaration || saving} onPress={save}>Guardar declaración</Button>
      <Button disabled={saving} onPress={() => { setEditing(false); authorization.confirm(false); setError(''); }}>Cancelar</Button>
    </> : <Button onPress={() => setEditing(true)}>Registrar declaración</Button>}
  </>;
}

const useStyles = makeStyles(({ colors }) => ({
  label: { fontFamily: fonts.semibold, color: colors.ink, fontSize: 14 },
  meta: { fontFamily: fonts.regular, color: colors.muted, fontSize: 13 },
  body: { fontFamily: fonts.regular, color: colors.ink, fontSize: 14 },
  entry: { borderWidth: 1, borderColor: colors.line, padding: 12, borderRadius: radius.md, gap: 4 },
}));
