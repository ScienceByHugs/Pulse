import type { PropsWithChildren } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SheetHeader } from './SheetHeader';
import { colors, layout } from '@/theme';
export function FormSheet({
  label,
  onClose,
  busy = false,
  visible = true,
  contentKey,
  children,
}: PropsWithChildren<{
  label: string;
  onClose: () => void;
  busy?: boolean;
  visible?: boolean;
  contentKey?: string | number;
}>) {
  const close = () => {
    if (!busy) {
      Keyboard.dismiss();
      onClose();
    }
  };
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <SheetHeader label={label} onClose={close} disabled={busy} />
        </View>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            key={contentKey}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.page}
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: layout.pageInset,
    paddingVertical: 12,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  page: {
    padding: layout.pageInset,
    paddingBottom: 40,
    gap: 16,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
});
