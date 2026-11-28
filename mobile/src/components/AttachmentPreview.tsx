import { ActivityIndicator, Image, type ImageErrorEvent, Text, View } from 'react-native';
import { safeMessage, useAttachmentSource } from '../hooks/useAttachmentSource';
import { fonts, makeStyles, radius, useTheme } from '../theme';

/** Muestra la foto guardada para compararla con el texto leído. */
type Props = { subjectId: number; attachmentId: number };

export function AttachmentPreview(props: Props) {
  return <AttachmentImage key={`${props.subjectId}:${props.attachmentId}`} {...props} />;
}

function AttachmentImage({ subjectId, attachmentId }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { state, onImageError } = useAttachmentSource(subjectId, attachmentId);

  function handleImageError(e: ImageErrorEvent) {
    console.warn('[AttachmentPreview]', state.origin, safeMessage(e.nativeEvent?.error));
    onImageError();
  }
  return (
    <View style={styles.frame}>
      {state.status === 'failed' ? <Text accessibilityRole="alert" style={styles.message}>No pudimos cargar la imagen.</Text> : null}
      {state.status === 'loading' ? <ActivityIndicator color={colors.primary} /> : null}
      {state.status === 'ready' ? (
        <Image
          key={state.origin}
          source={state.source}
          style={styles.image}
          resizeMode="contain"
          accessibilityLabel="Documento guardado"
          onError={handleImageError}
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
