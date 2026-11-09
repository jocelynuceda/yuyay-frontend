import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { fonts, makeStyles, radius, useTheme } from '../theme';
import { Sparkle } from './Sparkle';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.box}>
      <View style={styles.icon}>
        <Sparkle size={24} color={colors.emptyStar} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  box: {
    alignItems: 'center',
    padding: 28,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.line,
    backgroundColor: colors.glass,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: { fontFamily: fonts.display, fontSize: 18, color: colors.ink, textAlign: 'center' },
  description: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  action: { marginTop: 16 },
}));
