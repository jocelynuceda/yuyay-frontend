import { StyleSheet, View } from 'react-native';
import { HelperText, TextInput, type TextInputProps } from 'react-native-paper';
import { colors, fonts, radius } from '../theme';

interface FormFieldProps extends Omit<TextInputProps, 'error'> {
  error?: string;
  hint?: string;
  icon?: string;
}

/** TextInput de Paper con ícono, mensaje de error y texto de ayuda. */
export function FormField({ error, hint, icon, style, ...rest }: FormFieldProps) {
  const message = error || hint;
  return (
    <View>
      <TextInput
        mode="outlined"
        error={!!error}
        left={icon ? <TextInput.Icon icon={icon} color={colors.muted} /> : undefined}
        outlineStyle={styles.outline}
        style={[styles.input, style]}
        contentStyle={styles.content}
        outlineColor={colors.line}
        activeOutlineColor={colors.primary}
        {...rest}
      />
      {message ? (
        <HelperText type={error ? 'error' : 'info'} visible>
          {message}
        </HelperText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { backgroundColor: colors.white },
  outline: { borderRadius: radius.md },
  content: { fontFamily: fonts.regular },
});
