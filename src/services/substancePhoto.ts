import { privateStorage } from '@/lib/privateStorage';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
const key = (userId: string, itemId: string) => `pulse.substance-photo.${userId}.${itemId}`;
export async function getSubstancePhoto(userId: string, itemId: string) {
  return privateStorage.getItem(key(userId, itemId));
}
export async function saveSubstancePhoto(userId: string, itemId: string, uri: string) {
  const image = await manipulateAsync(uri, [{ resize: { width: 256 } }], { format: SaveFormat.JPEG, compress: .65, base64: true });
  if (!image.base64 || image.base64.length > 300000) throw new Error('Choose a smaller photo.');
  const value = `data:image/jpeg;base64,${image.base64}`;
  await privateStorage.setItem(key(userId, itemId), value);
  return value;
}
export async function removeSubstancePhoto(userId: string, itemId: string) {
  await privateStorage.removeItem(key(userId, itemId));
}
