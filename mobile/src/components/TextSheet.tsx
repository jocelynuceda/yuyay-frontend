import { Ionicons } from '@expo/vector-icons';
import { useRef, useState, type ComponentRef } from 'react';
import { AccessibilityInfo, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, makeStyles, radius, useTheme } from '../theme';

function focusControl(control: ComponentRef<typeof Pressable> | null) {
  if (!control) return;
  control.focus();
  if (Platform.OS !== 'web') AccessibilityInfo.sendAccessibilityEvent(control, 'focus');
}

/** Panel inferior para leer un texto largo con su propio desplazamiento. */
export function TextSheet({ title, text, onClose }: { title: string; text: string | null; onClose: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const closeButton = useRef<ComponentRef<typeof Pressable>>(null);
  // Conserva el contenido mientras el panel se cierra con la animación
  const [last, setLast] = useState({ title, text: text ?? '' });
  if (text !== null && (last.title !== title || last.text !== text)) setLast({ title, text });

  return (
    <Modal
      transparent
      visible={text !== null}
      animationType="slide"
      onRequestClose={onClose}
      onShow={() => focusControl(closeButton.current)}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]} accessibilityViewIsModal>
          <View style={styles.handle} accessible={false} importantForAccessibility="no-hide-descendants" />
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">{last.title}</Text>
            <Pressable
              ref={closeButton}
              onPress={onClose}
              hitSlop={4}
              style={styles.close}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
            >
              <Ionicons name="close" size={22} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator>
            <Text selectable style={styles.text}>{last.text}</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '75%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.muted,
    opacity: 0.4,
    alignSelf: 'center',
    marginTop: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 8 },
  title: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 },
  text: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.ink },
}));
