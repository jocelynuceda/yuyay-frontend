import { useState } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { useAttachmentSource } from '../hooks/useAttachmentSource';
import { fonts, makeStyles, radius, useTheme } from '../theme';

/** Muestra la foto guardada para compararla con el texto leído. */
export function AttachmentPreview({ subjectId, attachmentId }: { subjectId: number; attachmentId: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { source, failed } = useAttachmentSource(subjectId, attachmentId, true);
  const [broken, setBroken] = useState(false);
  return (
    <View style={styles.frame}>
      {failed || broken ? <Text style={styles.message}>No pudimos cargar la imagen.</Text> : null}
      {!failed && !broken && !source ? <ActivityIndicator color={colors.primary} /> : null}
      {source && !broken ? (
        <Image
          source={source}
          style={styles.image}
          resizeMode="contain"
          accessibilityLabel="Documento guardado"
          onError={() => setBroken(true)}
        />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  frame: {
    height: 300,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  message: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
}));
