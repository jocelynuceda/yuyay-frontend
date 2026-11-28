import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

/** Texto recortado a `lines` líneas que avisa si realmente quedó cortado en pantalla. */
export function ClampedText({ text, lines = 3, style, renderMore }: {
  text: string;
  lines?: number;
  style?: StyleProp<TextStyle>;
  renderMore: () => ReactNode;
}) {
  // Alturas medidas: la visible (con límite) y la copia completa
  const [shown, setShown] = useState(0);
  const [full, setFull] = useState(0);
  // 1 px de tolerancia por redondeos
  const clipped = full > shown + 1;

  return (
    <View>
      <View style={styles.inner}>
        <Text style={style} numberOfLines={lines} onLayout={(e) => setShown(e.nativeEvent.layout.height)}>
          {text}
        </Text>
        {/* Copia invisible sin límite de líneas: si es más alta que la visible, el texto quedó recortado */}
        <Text
          style={[style, styles.ghost]}
          onLayout={(e) => setFull(e.nativeEvent.layout.height)}
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
        >
          {text}
        </Text>
      </View>
      {clipped ? renderMore() : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inner: { position: 'relative' },
  ghost: { position: 'absolute', top: 0, left: 0, right: 0, opacity: 0 },
});
