import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { SubmitButton } from '../components/FormKit';
import { IconButton, ListItem } from '../components/ListItem';
import { LoadingView } from '../components/LoadingView';
import { StatusMessage } from '../components/StatusMessage';
import { useFetch } from '../hooks/useFetch';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { getDelegations, revokeDelegation } from '../services/api';
import { ApiError } from '../services/http';
import { colors, fonts } from '../theme';
import type { Delegation, HomeStackParamList } from '../types';
import { categoryMeta } from '../utils/categories';
import { confirmAction } from '../utils/confirm';
import { formatDate, initialsOf } from '../utils/format';

type Props = NativeStackScreenProps<HomeStackParamList, 'Delegations'>;

function delegationState(d: Delegation) {
  if (d.revokedAt) return { label: 'Revocado', tone: 'soft' } as const;
  if (!d.active) return { label: 'Vencido', tone: 'soft' } as const;
  if (d.exchangedAt) return { label: 'En uso', tone: 'accent' } as const;
  return { label: 'Sin abrir', tone: 'amber' } as const;
}

export function DelegationsScreen({ route, navigation }: Props) {
  const { subjectId, isPrincipal } = route.params;
  const [error, setError] = useState<string | null>(null);
  const delegations = useFetch(() => getDelegations(subjectId), [subjectId]);
  useRefreshOnFocus(delegations.reload);

  if (delegations.loading && !delegations.data) return <LoadingView />;

  // Activos primero, luego los más recientes
  const list = [...(delegations.data ?? [])].sort(
    (a, b) => Number(b.active) - Number(a.active) || b.createdAt.localeCompare(a.createdAt),
  );

  async function handleRevoke(d: Delegation) {
    const ok = await confirmAction('Revocar acceso', `${d.granteeName} ya no podrá ver la información.`, 'Revocar');
    if (!ok) return;
    setError(null);
    try {
      await revokeDelegation(d.id);
      delegations.reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No pudimos revocar el acceso.');
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={delegations.refreshing} onRefresh={delegations.refresh} tintColor={colors.primary} />
      }
    >
      <Text style={styles.intro}>
        Da acceso temporal a alguien sin cuenta (una enfermera, un familiar de viaje) solo a lo que elijas.
      </Text>

      {isPrincipal ? (
        <SubmitButton
          label="Nuevo acceso"
          icon="key-plus"
          onPress={() => navigation.navigate('NewDelegation', { subjectId })}
        />
      ) : null}

      <StatusMessage message={error ?? delegations.error} />

      {list.length === 0 ? (
        <EmptyState title="No hay accesos delegados" />
      ) : (
        list.map((d) => {
          const state = delegationState(d);
          const categories = [
            ...d.categoryCodes.map((c) => categoryMeta[c]?.plural ?? c),
            ...(d.includeConsultations ? ['Citas'] : []),
          ].join(', ');
          return (
            <ListItem
              key={d.id}
              initials={initialsOf(d.granteeName)}
              iconBg={colors.accentTint}
              iconFg={colors.accentText}
              title={d.granteeName}
              subtitle={`${categories} · hasta ${formatDate(d.validUntil)}`}
              dimmed={state.tone === 'soft'}
              right={
                <View style={styles.right}>
                  <Badge label={state.label} tone={state.tone} />
                  {isPrincipal && d.active ? (
                    <IconButton
                      icon="close-circle-outline"
                      label={`Revocar acceso de ${d.granteeName}`}
                      color={colors.danger}
                      onPress={() => handleRevoke(d)}
                    />
                  ) : null}
                </View>
              }
            />
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 20, gap: 12, paddingBottom: 40 },
  intro: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
