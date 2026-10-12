import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

/** Shared Pulse signature for onboarding and authentication. */
export function PulseBrand({ compact = false }: { compact?: boolean }) {
  return (
    <View accessibilityLabel="Pulse by Science By Hugs" style={styles.row}>
      <Image source={require('../../assets/brand/pulse-icon.png')} style={compact ? styles.compactIcon : styles.icon} resizeMode="contain" accessibilityIgnoresInvertColors accessible={false} />
      <View style={styles.copy}>
        <Text style={compact ? styles.compactPulse : styles.pulse}>pulse<Text style={styles.dot}>.</Text></Text>
        <Text style={styles.brand}>by Science By Hugs</Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  icon: { width: 42, height: 42, borderRadius: 10 },
  compactIcon: { width: 35, height: 35, borderRadius: 8 },
  copy: { gap: 1 },
  brand: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  pulse: { color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  compactPulse: { color: colors.text, fontSize: 23, fontWeight: '900', letterSpacing: -.7 },
  dot: { color: colors.accent }
});
