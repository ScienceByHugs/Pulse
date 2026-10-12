import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/theme';

export function SheetHeader({ label, onClose, disabled = false }: { label: string; onClose: () => void; disabled?: boolean }) {
  return <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`Close ${label}`} disabled={disabled} onPress={onClose} style={[styles.close,disabled && styles.disabled]}>
      <Text style={styles.closeText}>Close</Text>
    </Pressable>
  </View>;
}
const styles=StyleSheet.create({
  row:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:8},
  label:{color:colors.muted,fontSize:13,fontWeight:'600',flexShrink:1},
  close:{minHeight:44,minWidth:72,paddingHorizontal:14,justifyContent:'center',alignItems:'center',backgroundColor:colors.panel2,borderRadius:radius.md},
  closeText:{color:colors.text,fontSize:14,fontWeight:'600'},disabled:{opacity:.5}
});
