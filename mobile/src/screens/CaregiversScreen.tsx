import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { SubmitButton } from '../components/FormKit';
import { IconButton, ListItem } from '../components/ListItem';
import { LoadingView } from '../components/LoadingView';
import { StatusMessage } from '../components/StatusMessage';
import { useAuth } from '../hooks/useAuth';
import { useConfirmedAction } from '../hooks/useConfirmedAction';
import { useFetch } from '../hooks/useFetch';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { getCareRelationships, removeCaregiver } from '../services/api';
import { fonts, makeStyles, useTheme } from '../theme';
import type { CareRelationship, HomeStackParamList } from '../types';
import { careRoleLabel, initialsOf } from '../utils/format';

type Props = NativeStackScreenProps<HomeStackParamList, 'Caregivers'>;

const statusBadge = {
  ACTIVE: { label: 'Activo', tone: 'accent' },
  PENDING: { label: 'Pendiente', tone: 'amber' },
  REVOKED: { label: 'Quitado', tone: 'soft' },
} as const;

export function CaregiversScreen({ route, navigation }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { subjectId, isPrincipal } = route.params;
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const runAction = useConfirmedAction(setError);
  const relationships = useFetch(() => getCareRelationships(subjectId), [subjectId]);
  useRefreshOnFocus(relationships.reload);

  if (relationships.loading && !relationships.data) return <LoadingView />;

  // Los quitados van al final
  const list = [...(relationships.data ?? [])].sort(
    (a, b) => Number(a.status === 'REVOKED') - Number(b.status === 'REVOKED'),
  );

  const handleRemove = (rel: CareRelationship) =>
    runAction({
      confirm: ['Quitar cuidador', `${rel.user.name} ya no podrá ver ni editar la información de ${rel.careSubjectName}.`, 'Quitar'],
      action: () => removeCaregiver(subjectId, rel.id),
      success: `${rel.user.name} ya no es cuidador.`,
      fallback: 'No pudimos quitar al cuidador.',
      onDone: relationships.reload,
    });

  return (
    <ScrollView
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={relationships.refreshing}
          onRefresh={relationships.refresh}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.intro}>
        Las personas que cuidan contigo. El principal puede invitar y quitar cuidadores; los demás solo ven la lista.
      </Text>

      <StatusMessage message={error ?? relationships.error} />

      {list.length === 0 ? (
        <EmptyState title="Aún no hay cuidadores" />
      ) : (
        list.map((rel) => {
          const badge = statusBadge[rel.status];
          const isMe = rel.user.id === user?.id;
          const canRemove = isPrincipal && !isMe && rel.status !== 'REVOKED';
          return (
            <ListItem
              key={rel.id}
              initials={initialsOf(rel.user.name)}
              title={isMe ? `${rel.user.name} (tú)` : rel.user.name}
              subtitle={[careRoleLabel[rel.role], rel.relationshipLabel, rel.user.email].filter(Boolean).join(' · ')}
              dimmed={rel.status === 'REVOKED'}
              right={
                <View style={styles.right}>
                  <Badge label={badge.label} tone={badge.tone} />
                  {canRemove ? (
                    <IconButton
                      icon="person-remove-outline"
                      label={`Quitar a ${rel.user.name}`}
                      color={colors.danger}
                      onPress={() => handleRemove(rel)}
                    />
                  ) : null}
                </View>
              }
            />
          );
        })
      )}

      {isPrincipal ? (
        <SubmitButton
          label="Invitar cuidador"
          icon="account-plus-outline"
          onPress={() => navigation.navigate('InviteCaregiver', { subjectId })}
        />
      ) : null}
    </ScrollView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  list: { padding: 20, gap: 12, paddingBottom: 40 },
  intro: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
}));
