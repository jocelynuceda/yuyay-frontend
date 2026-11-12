import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { fonts, makeStyles, radius, useTheme } from '../theme';
import { avatarId, avatarOptions, LionAvatar, type AvatarChoice } from './LionAvatar';

/** Hoja inferior para elegir el avatar. "Automático" vuelve al que corresponde por la edad. */
export function AvatarPicker({
  visible,
  title,
  current,
  automatic,
  isCustom,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  current: AvatarChoice;
  automatic: AvatarChoice;
  isCustom: boolean;
  onSelect: (choice: AvatarChoice | null) => void;
  onClose: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const currentId = avatarId(current);

  function pick(choice: AvatarChoice | null) {
    onSelect(choice);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar" />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Cerrar">
            <Ionicons name="close" size={20} color={colors.ink} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.grid}>
          <Option label="Automático" hint="Según la edad" selected={!isCustom} onPress={() => pick(null)}>
            <LionAvatar kind={automatic.kind} variant={automatic.variant} size={64} />
          </Option>
          {avatarOptions.map((o) => (
            <Option key={o.id} label={o.label} selected={isCustom && o.id === currentId} onPress={() => pick(o)}>
              <LionAvatar kind={o.kind} variant={o.variant} size={64} />
            </Option>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

function Option({
  label,
  hint,
  selected,
  onPress,
  children,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.option, selected && styles.optionSelected]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={hint ? `${label}, ${hint}` : label}
    >
      <View style={styles.circle}>{children}</View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {selected ? (
        <View style={styles.check}>
          <Ionicons name="checkmark" size={14} color={colors.white} />
        </View>
      ) : null}
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: 20,
    paddingBottom: 36,
    maxHeight: '75%',
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, marginTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 14 },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  option: {
    width: '31%',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.soft },
  circle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.card,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink, marginTop: 8 },
  hint: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  check: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
