import { Ionicons } from '@expo/vector-icons';
import { useRef, useState, type ComponentRef } from 'react';
import { AccessibilityInfo, Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, makeStyles, useTheme } from '../theme';

function focusControl(control: ComponentRef<typeof Pressable> | null) {
  if (!control) return;
  control.focus();
  if (Platform.OS !== 'web') AccessibilityInfo.sendAccessibilityEvent(control, 'focus');
}

export function DownloadPermission({ allowed, onChange, disabled = false }: {
  allowed: boolean;
  onChange: (allowed: boolean) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const trigger = useRef<ComponentRef<typeof Pressable>>(null);
  const closeButton = useRef<ComponentRef<typeof Pressable>>(null);

  function close() {
    setOpen(false);
    if (Platform.OS !== 'ios') requestAnimationFrame(() => focusControl(trigger.current));
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>Permiso de descarga</Text>
      <Pressable ref={trigger} accessibilityRole="checkbox" accessibilityState={{ checked: allowed, disabled }}
        disabled={disabled} style={styles.checkbox} onPress={() => {
          if (allowed) onChange(false);
          else { Keyboard.dismiss(); setOpen(true); }
        }}>
        <Ionicons name={allowed ? 'checkbox-outline' : 'square-outline'} size={24} color={colors.primary} />
        <Text style={styles.choice}>Permitir que el lector descargue este resumen en PDF</Text>
      </Pressable>
      <Text style={styles.hint}>Opcional. Al activarlo, revisa y acepta las condiciones de descarga.</Text>
      <Modal transparent visible={open} onRequestClose={close} onShow={() => focusControl(closeButton.current)} onDismiss={() => focusControl(trigger.current)}>
        <View style={[modal.backdrop, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
          <View style={modal.sheet} accessibilityViewIsModal>
            <View style={modal.heading}>
              <Text accessibilityRole="header" style={modal.title}>Condiciones de descarga</Text>
              <Pressable ref={closeButton} accessibilityRole="button" accessibilityLabel="Cerrar" onPress={close} style={modal.close}>
                <Ionicons name="close" size={24} color="#27243f" />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={modal.body}>
              <Text style={modal.text}>Al autorizar la descarga, permites que quien acceda a este enlace con el código guarde una copia del resumen para su consulta. El PDF incluirá los registros que seleccionaste al preparar el resumen.</Text>
              <Text style={modal.subtitle}>Si compartes datos de otra persona</Text>
              <Text style={modal.text}>Confirma que tienes su autorización para entregar esta copia a quien atenderá la consulta, o que cuentas con facultades legales para hacerlo en su representación.</Text>
              <Text style={modal.subtitle}>Una copia descargada permanece en el dispositivo</Text>
              <Text style={modal.text}>El vencimiento o la revocación del enlace impiden nuevos accesos en Yuyay. Una copia que ya se descargó seguirá en manos del lector.</Text>
              <View style={modal.actions}>
                <Pressable accessibilityRole="button" onPress={close} style={modal.secondary}><Text style={modal.text}>Volver</Text></Pressable>
                <Pressable accessibilityRole="button" onPress={() => { onChange(true); close(); }} style={modal.primary}><Text style={modal.primaryText}>Autorizar descarga</Text></Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  field: { gap: 6 },
  label: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  checkbox: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  choice: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  hint: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
}));

const modal = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, backgroundColor: '#0009' },
  sheet: { width: '100%', maxWidth: 560, maxHeight: '100%', backgroundColor: '#fff', borderRadius: 24, padding: 20, flexShrink: 1 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 21, color: '#27243f' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { gap: 10, paddingBottom: 4 },
  text: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: '#27243f' },
  subtitle: { fontFamily: fonts.semibold, fontSize: 16, color: '#27243f', marginTop: 6 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  secondary: { borderWidth: 1, borderColor: '#d3d2df', borderRadius: 12, minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  primary: { backgroundColor: '#6a64c2', borderRadius: 12, minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  primaryText: { fontFamily: fonts.semibold, fontSize: 15, color: '#fff' },
});
