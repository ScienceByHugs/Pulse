import { useEffect, useState, useRef } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/providers/AuthProvider';
import {
  getSubstancePhoto,
  saveSubstancePhoto,
  removeSubstancePhoto,
} from '@/services/substancePhoto';
import { colors, radius, typography } from '@/theme';

type Props = {
  category?: string | null;
  route?: string | null;
  inactive?: boolean;
  name?: string;
  itemId?: string;
  vialQuantity?: string;
};
export function SubstanceArtwork({
  category,
  route,
  inactive = false,
  name = '',
  itemId,
  vialQuantity,
}: Props) {
  const { session } = useAuth();
  const uid = session?.user.id;
  const currentPhotoOwner = useRef('');
  currentPhotoOwner.current = `${uid ?? ''}:${itemId ?? ''}`;
  const [photo, setPhoto] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setPhoto(null);
    setOpen(false);
    if (uid && itemId)
      void getSubstancePhoto(uid, itemId)
        .then((value) => {
          if (active) setPhoto(value);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [uid, itemId]);
  const injectable = route === 'subcutaneous' || route === 'intramuscular';
  async function choosePhoto() {
    if (!uid || !itemId || busy) return;
    const owner = `${uid}:${itemId}`;
    setBusy(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        exif: false,
        quality: 1,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;
      if (currentPhotoOwner.current !== owner) return;
      const next = await saveSubstancePhoto(uid, itemId, asset.uri);
      if (currentPhotoOwner.current === owner) setPhoto(next);
    } catch (error) {
      Alert.alert(
        'Could not save photo',
        error instanceof Error ? error.message : 'Try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
    if (!uid || !itemId || busy) return;
    const owner = `${uid}:${itemId}`;
    setBusy(true);
    try {
      await removeSubstancePhoto(uid, itemId);
      if (currentPhotoOwner.current === owner) setPhoto(null);
    } catch {
      Alert.alert('Could not remove photo', 'Please try again.');
    } finally {
      setBusy(false);
    }
  }
  function artwork(large = false) {
    return (
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.frame,
          large && styles.large,
          inactive && styles.inactive,
        ]}
      >
        {photo ? (
          <Image
            source={{ uri: photo }}
            resizeMode="cover"
            style={styles.image}
          />
        ) : injectable ? (
          <>
            <Image
              source={require('../../assets/substances/vial-green-template.png')}
              resizeMode="cover"
              style={styles.image}
            />
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[styles.name, large && styles.nameLarge]}
            >
              {name.toUpperCase()}
            </Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[styles.quantity, large && styles.quantityLarge]}
            >
              {vialQuantity ?? '—'}
            </Text>
          </>
        ) : (
          <Text style={styles.mark}>
            {category?.slice(0, 1).toUpperCase() ?? '•'}
          </Text>
        )}
      </View>
    );
  }
  return (
    <>
      <Pressable
        disabled={!itemId}
        accessibilityRole="button"
        accessibilityLabel={`View artwork or choose a photo for ${name || 'substance'}`}
        onPress={() => setOpen(true)}
      >
        {artwork()}
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!busy) setOpen(false);
        }}
      >
        <View style={styles.scrim}>
          <View style={styles.sheet}>
            <Pressable
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Close substance artwork"
              style={styles.close}
              onPress={() => setOpen(false)}
            >
              <Text style={styles.link}>Close ✕</Text>
            </Pressable>
            <Text style={styles.title}>{name}</Text>
            {artwork(true)}
            <Text style={styles.body}>
              {photo
                ? 'Your photo · stored on this device only. It is not uploaded or synced to other devices.'
                : 'Illustrative artwork. Name and container quantity reflect your entries, not a verified product label.'}
            </Text>
            <Pressable
              disabled={busy}
              accessibilityRole="button"
              style={styles.button}
              onPress={() => void choosePhoto()}
            >
              <Text style={styles.link}>
                {busy
                  ? 'Working…'
                  : photo
                    ? 'Change my photo'
                    : 'Upload my own photo'}
              </Text>
            </Pressable>
            {photo && (
              <Pressable
                disabled={busy}
                accessibilityRole="button"
                style={styles.button}
                onPress={() => void reset()}
              >
                <Text style={styles.link}>Use illustrative artwork</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  frame: {
    width: 90,
    height: 90,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#102F43',
  },
  large: { width: 260, height: 260, alignSelf: 'center' },
  image: { width: '100%', height: '100%' },
  name: {
    position: 'absolute',
    top: '49%',
    left: '35%',
    width: '30%',
    fontSize: 4,
    color: '#070F1E',
    fontWeight: '900',
    textAlign: 'center',
  },
  quantity: {
    position: 'absolute',
    top: '58%',
    left: '38%',
    width: '24%',
    fontSize: 4,
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
  },
  nameLarge: { fontSize: 11 },
  quantityLarge: { fontSize: 12 },
  mark: { color: colors.accent, fontSize: 34, fontWeight: '800' },
  inactive: { opacity: 0.55 },
  scrim: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,.85)',
  },
  sheet: {
    padding: 20,
    gap: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.panel,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  title: { ...typography.sectionTitle, color: colors.text },
  body: { ...typography.body, color: colors.muted },
  link: { ...typography.button, color: colors.accent },
  close: { minHeight: 44, alignSelf: 'flex-end', justifyContent: 'center' },
  button: { minHeight: 48, justifyContent: 'center' },
});
