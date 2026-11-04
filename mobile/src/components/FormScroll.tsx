import { KeyboardAvoidingView, Platform, ScrollView, type ScrollViewProps, StyleSheet } from 'react-native';

/**
 * ScrollView de los formularios: mantiene el campo activo a la vista cuando aparece el teclado.
 * En iOS lo hace el propio ScrollView, también dentro de los modales, donde KeyboardAvoidingView
 * calcula mal la altura. En Android la ventana no se redimensiona, por eso se agrega el espacio.
 */
export function FormScroll({ children, ...props }: ScrollViewProps) {
  const scroll = (
    <ScrollView
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      {...props}
    >
      {children}
    </ScrollView>
  );
  if (Platform.OS !== 'android') return scroll;
  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      {scroll}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
