import { StyleSheet, View } from 'react-native';
import { colors } from '@/theme';

// Static, intentionally restrained sky: no images, animation or per-render randomness.
const stars = [
  [7, 4, 2], [26, 8, 1], [76, 5, 2], [90, 12, 1],
  [14, 23, 1], [55, 19, 2], [84, 30, 1], [33, 39, 1],
  [5, 52, 1], [68, 48, 2], [93, 58, 1], [22, 68, 2],
  [79, 77, 1], [41, 84, 1], [11, 93, 1], [94, 96, 2]
] as const;

export function OrbitalBackground() {
  return (
    <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      <View style={styles.halo} />
      <View style={styles.arc} />
      {stars.map(([x, y, size], index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            left: `${x}%`,
            top: `${y}%`,
            width: size,
            height: size,
            borderRadius: size,
            backgroundColor: colors.accent,
            opacity: size === 2 ? 0.10 : 0.06
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  halo: {
    position: 'absolute',
    top: -190,
    right: -135,
    width: 440,
    height: 440,
    borderRadius: 220,
    backgroundColor: '#122640',
    opacity: 0.125
  },
  arc: {
    position: 'absolute',
    top: -168,
    right: -150,
    width: 465,
    height: 465,
    borderRadius: 235,
    borderWidth: 1,
    borderColor: '#36516C',
    opacity: 0.12
  }
});
