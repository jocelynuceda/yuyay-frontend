import { Ionicons } from '@expo/vector-icons';
import { useRef, type ComponentRef } from 'react';
import { AccessibilityInfo, Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { useAccountTerms } from '../hooks/useAccountTerms';
import { fonts, makeStyles, radius, useTheme } from '../theme';
import { StatusMessage } from './StatusMessage';

const title = 'Términos de uso y aviso de privacidad';

function focusControl(control: ComponentRef<typeof Pressable> | null) {
  if (!control) return;
  control.focus();
  if (Platform.OS !== 'web') AccessibilityInfo.sendAccessibilityEvent(control, 'focus');
}

export function AccountTerms({
  terms,
  requireAcceptance = false,
  disabled = false,
  validationError,
}: {
  terms: ReturnType<typeof useAccountTerms>;
  requireAcceptance?: boolean;
  disabled?: boolean;
  validationError?: string | null;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const trigger = useRef<ComponentRef<typeof Pressable>>(null);
  const closeControl = useRef<ComponentRef<typeof Pressable>>(null);
  const [heading, ...body] = terms.document?.text.split('\n') ?? [];
  const checked = Boolean(terms.acceptance);
  const checkboxDisabled = disabled || terms.loading || !terms.document || Boolean(terms.error);

  function onClose() {
    terms.close();
    if (Platform.OS !== 'ios') requestAnimationFrame(() => focusControl(trigger.current));
  }

  return (
    <View style={styles.controls}>
      <Pressable
        ref={trigger}
        accessible
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => {
          Keyboard.dismiss();
          terms.show();
        }}
        style={styles.link}
      >
        <Text style={styles.linkText}>Leer los términos de uso y el aviso de privacidad</Text>
      </Pressable>
      {requireAcceptance ? (
        <>
          {!terms.document || terms.error ? <Text style={styles.instructions}>Abre el documento para poder aceptar.</Text> : null}
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked, disabled: checkboxDisabled }}
            disabled={checkboxDisabled}
            onPress={() => terms.setAccepted(!checked)}
            style={[styles.checkbox, checkboxDisabled && styles.disabled]}
          >
            <Ionicons name={checked ? 'checkbox-outline' : 'square-outline'} color={colors.primary} size={22} />
            <Text style={styles.checkboxLabel}>Acepto los términos de uso y el aviso de privacidad de mi cuenta.</Text>
          </Pressable>
          <StatusMessage message={validationError} />
        </>
      ) : null}
      <Modal
        transparent
        visible={terms.open}
        onRequestClose={onClose}
        onShow={() => focusControl(closeControl.current)}
        onDismiss={() => focusControl(trigger.current)}
      >
        <View style={[modalStyles.backdrop, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
          <View style={modalStyles.sheet} accessibilityViewIsModal>
            <View style={modalStyles.header}>
              <Text accessibilityRole="header" style={modalStyles.title}>{heading || title}</Text>
              <Pressable ref={closeControl} accessible accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} style={modalStyles.close}>
                <Ionicons name="close" size={24} color="#000" />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={modalStyles.content}>
              {terms.error ? (
                <>
                  <Text accessibilityRole="alert" style={modalStyles.text}>{terms.error}</Text>
                  <Pressable accessibilityRole="button" onPress={terms.reload} style={modalStyles.retry}>
                    <Text style={modalStyles.retryText}>Volver a cargar el documento</Text>
                  </Pressable>
                </>
              ) : terms.loading || !terms.document ? (
                <Text accessibilityLiveRegion="polite" style={modalStyles.text}>Cargando el documento…</Text>
              ) : (
                <Text selectable style={modalStyles.text}>{body.join('\n').trimStart()}</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  controls: { gap: 6 },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  linkText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary, textDecorationLine: 'underline' },
  instructions: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  checkbox: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  checkboxLabel: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  disabled: { opacity: 0.65 },
}));

const modalStyles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, backgroundColor: '#0009' },
  sheet: { width: '100%', maxWidth: 560, height: '85%', borderRadius: radius.lg, backgroundColor: '#fff', padding: 16 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 19, color: '#000' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: 12, gap: 10 },
  text: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: '#000' },
  retry: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  retryText: { fontFamily: fonts.semibold, color: '#000', textDecorationLine: 'underline' },
});
