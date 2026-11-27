import { usePreventRemove } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import { FormCard, formStyles, SubmitButton, TextArea } from '../components/FormKit';
import { FormField } from '../components/FormField';
import { FormScroll } from '../components/FormScroll';
import { LoadingView } from '../components/LoadingView';
import { StatusMessage } from '../components/StatusMessage';
import { prepareConsultation, confirmConsultation } from '../services/api';
import { ApiError } from '../services/http';
import { fonts, makeStyles } from '../theme';
import type { HomeStackParamList } from '../types';
import { categoryMeta, fallbackCategory } from '../utils/categories';
import { formatDate } from '../utils/format';
import { createSummaryReview } from '../utils/summaryReview';
import { newSummaryRequestId } from '../utils/summaryRequestId';

type Props = NativeStackScreenProps<HomeStackParamList, 'NewHandoff'>;

export function ConsultationSummaryScreen({ route, navigation }: Props) {
  const { subjectId, consultationId, isPrincipal } = route.params;
  const styles = useStyles();
  const [navigationMessage, setNavigationMessage] = useState<string | null>(null);
  const model = useMemo(() => createSummaryReview({
    prepare: async () => {
      const data = await prepareConsultation(subjectId, consultationId!);
      if (data.careSubjectId !== subjectId) throw new ApiError(404, 'La cita no pertenece a esta persona.');
      return data;
    },
    confirm: (body) => confirmConsultation(subjectId, consultationId!, body),
    newId: newSummaryRequestId,
    status: (error) => error instanceof ApiError ? error.status : undefined,
    errorMessage: (error) => {
      if (!(error instanceof ApiError)) return 'No pudimos completar la solicitud.';
      if (error.status === 403) return 'No tienes autorización para esta cita.';
      if (error.status === 404) return 'La cita ya no existe.';
      return [error.message, ...Object.values(error.fieldErrors)].join(' ');
    },
  }), [consultationId, subjectId]);
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot);
  useEffect(() => {
    void model.load();
    return model.dispose;
  }, [model]);
  const busy = state.phase === 'saving';
  const uncertain = state.phase === 'uncertain';
  usePreventRemove(busy || uncertain, () => setNavigationMessage('Comprueba el resultado con el mismo guardado antes de salir.'));
  const editing = state.phase === 'editing';

  if (state.phase === 'loading') return <LoadingView />;

  if (state.phase === 'saved' && state.saved) {
    return (
      <FormScroll contentContainerStyle={formStyles.container}>
        <StatusMessage tone="info" message="Resumen guardado. Puedes consultarlo y compartirlo cuando quieras." />
        <FormCard title="Resumen guardado">
          <Text style={styles.title}>{state.saved.reason}</Text>
          <Text style={styles.text}>{state.saved.questions || 'Sin preguntas.'}</Text>
          {state.saved.items.map((item) => <VersionContent key={item.healthEntryId} version={item} />)}
        </FormCard>
        <SubmitButton label="Abrir resumen guardado" onPress={() => navigation.replace('HandoffView', { subjectId, handoffId: state.saved!.id, isPrincipal })} />
      </FormScroll>
    );
  }

  return (
    <FormScroll contentContainerStyle={formStyles.container}>
      <StatusMessage message={state.message} />
      {(busy || uncertain) && <StatusMessage message={navigationMessage} />}
      {state.preparation && (
        <>
          <FormCard title={editing ? 'Motivo y preguntas' : 'Revisión final'}>
            {editing ? (
              <>
                <FormField label="Motivo" value={state.reason} maxLength={10000} onChangeText={(reason) => model.edit({ reason })} />
                <TextArea accessibilityLabel="Preguntas para el médico" placeholder="Preguntas para el médico (opcional)"
                  maxLength={10000} value={state.questions} onChangeText={(questions) => model.edit({ questions })} />
              </>
            ) : (
              <>
                <Text style={styles.title}>{state.reason}</Text>
                <Text style={styles.text}>{state.questions || 'Sin preguntas.'}</Text>
              </>
            )}
          </FormCard>
          {state.preparation.categories.length === 0 && <Text style={styles.text}>No hay registros vigentes. Puedes guardar el motivo y las preguntas.</Text>}
          {state.preparation.categories.map((group) => (
            <FormCard key={group.categoryCode} title={(categoryMeta[group.categoryCode] ?? fallbackCategory).plural}>
              {group.entries.filter((entry) => editing || state.selected.includes(entry.entryId)).map((entry) => (
                <View key={entry.entryId} style={styles.entry}>
                  {editing && (
                    <Pressable accessibilityRole="checkbox" accessibilityLabel={`Incluir ${entry.version.title}`}
                      accessibilityState={{ checked: state.selected.includes(entry.entryId) }}
                      onPress={() => model.edit({ selected: state.selected.includes(entry.entryId)
                        ? state.selected.filter((id) => id !== entry.entryId) : [...state.selected, entry.entryId] })}>
                      <Text style={styles.action}>{state.selected.includes(entry.entryId) ? '☑' : '☐'} Incluir {entry.version.title}</Text>
                    </Pressable>
                  )}
                  <VersionContent version={entry.version} />
                </View>
              ))}
            </FormCard>
          ))}
          <Text style={styles.text}>{state.selected.length} registros seleccionados.</Text>
        </>
      )}
      {editing && <SubmitButton label="Revisar resumen" onPress={model.review} />}
      {state.phase === 'review' && <Button onPress={model.back}>Modificar</Button>}
      {(state.phase === 'review' || uncertain || busy) && (
        <SubmitButton label={uncertain ? 'Reintentar el mismo guardado' : 'Validar y guardar'} loading={busy} onPress={() => void model.save()} />
      )}
      {state.phase === 'error' && <SubmitButton label="Reintentar preparación" onPress={() => void model.load()} />}
      <Button disabled={busy || uncertain} onPress={() => { if (model.cancel()) navigation.goBack(); }}>Cancelar</Button>
    </FormScroll>
  );
}

function VersionContent({ version }: { version: {
  title: string; details: string | null; dose: string | null; frequency: string | null;
  occurredOn: string | null; confidenceLevel: 'CONFIRMED' | 'UNCERTAIN'; notes: string | null;
} }) {
  const styles = useStyles();
  return (
    <View style={styles.entry}>
      <Text style={styles.title}>{version.title}</Text>
      <Text style={styles.text}>{version.confidenceLevel === 'CONFIRMED' ? 'Confirmado' : 'Por confirmar'}</Text>
      {version.occurredOn && <Text style={styles.text}>{formatDate(version.occurredOn)}</Text>}
      {[version.details, version.dose, version.frequency, version.notes].filter(Boolean).map((text, index) => (
        <Text key={index} style={styles.text}>{text}</Text>
      ))}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  entry: { gap: 6, paddingVertical: 8 },
  title: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  text: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.ink },
  action: { fontFamily: fonts.semibold, fontSize: 15, color: colors.primary, paddingVertical: 10 },
}));
