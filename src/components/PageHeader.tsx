import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, type } from '@/theme';

export function PageHeader({ title, description }: { title: string; description: string }) {
  return <View style={styles.header}>
    <Text accessibilityRole="header" style={styles.title}>{title}</Text>
    <Text style={styles.description}>{description}</Text>
  </View>;
}
const styles=StyleSheet.create({
  header:{gap:8,marginTop:spacing.sm,marginBottom:spacing.lg},
  title:{color:colors.text,fontSize:type.title,fontWeight:'700',letterSpacing:-.6},
  description:{color:colors.muted,fontSize:type.body,lineHeight:22}
});
