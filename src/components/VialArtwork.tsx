import { Image, StyleSheet, Text, View } from 'react-native';

type Props = {
  name: string;
  quantity?: string;
  size: number;
};

// Label slots follow the 384 × 384 source image. Scale the image and its
// text together so thumbnail and detail views have identical alignment.
export function VialArtwork({ name, quantity, size }: Props) {
  const scale = size / 384;
  const labelName = name.trim().toUpperCase();
  const longestWord = Math.max(1, ...labelName.split(/\s+/).map(word => word.length));
  // Reserve room for wide bold capitals so long words stay on one line.
  // Native font fitting is a final safeguard rather than the layout strategy.
  const nameFontSize = Math.max(7, Math.min(
    14,
    112 / (longestWord * 0.8),
    224 / (Math.max(1, labelName.length) * 0.8),
  ));
  function slot(left: number, top: number, width: number, height: number) {
    return {
      left: left * scale,
      top: top * scale,
      width: width * scale,
      height: height * scale,
    };
  }
  return (
    <View style={{ width: size, height: size }}>
      <Image
        source={require('../../assets/substances/vial-green-template.png')}
        resizeMode="contain"
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.slot, slot(136, 169, 112, 13)]}>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.text, { fontSize: 7 * scale, lineHeight: 9 * scale }]}
        >
          SCIENCE BY HUGS
        </Text>
      </View>
      <View style={[styles.slot, slot(136, 185, 112, 30)]}>
        <Text
          allowFontScaling={false}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          style={[styles.text, styles.name, {
            fontSize: nameFontSize * scale,
            lineHeight: 15 * scale,
          }]}
        >
          {labelName}
        </Text>
      </View>
      <View style={[styles.slot, slot(148, 219, 88, 19)]}>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          style={[styles.text, styles.quantity, {
            fontSize: 13 * scale,
            lineHeight: 15 * scale,
          }]}
        >
          {quantity?.trim() || '—'}
        </Text>
      </View>
      <View style={[styles.slot, slot(136, 256, 112, 13)]}>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.text, { fontSize: 6 * scale, lineHeight: 8 * scale }]}
        >
          FOR RESEARCH USE ONLY
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  text: {
    width: '100%',
    color: '#070F1E',
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
  },
  name: { fontWeight: '900' },
  quantity: { color: '#FFFFFF' },
});
