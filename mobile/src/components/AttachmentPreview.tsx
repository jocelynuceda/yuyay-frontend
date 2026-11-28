import { useState } from 'react';
import { ActivityIndicator, Image, type ImageErrorEvent, Text, View } from 'react-native';
import { safeMessage, useAttachmentSource } from '../hooks/useAttachmentSource';
import { fonts, makeStyles, radius, useTheme } from '../theme';

/** Muestra la foto guardada para compararla con el texto leído. */
export function AttachmentPreview({ subjectId, attachmentId }: { subjectId: number; attachmentId: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { source, origin, failed, fallbackToToken } = useAttachmentSource(subjectId, attachmentId, true, { preferSigned: true });
  const [broken, setBroken] = useState(false);

  function onImageError(e: ImageErrorEvent) {
    console.warn('[AttachmentPreview]', origin ?? 'api', safeMessage(e.nativeEvent?.error));
    // Con el enlace firmado se reintenta una sola vez por la vía con token antes de rendirse
    if (origin === 's3') fallbackToToken();
    else setBroken(true);
  }
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
          onError={onImageError}
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
