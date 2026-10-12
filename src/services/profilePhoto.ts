import { decode, encode } from 'base64-arraybuffer';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';

const BUCKET = 'profile-photos';

async function currentUserId() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user?.email_confirmed_at) throw new Error('Sign in to update your photo.');
  return user.id;
}

export async function getProfilePhotoUrl(userId: string) {
  const bucket = supabase.storage.from(BUCKET);
  const { data: files, error } = await bucket.list(userId, { limit: 1, search: 'avatar.jpg' });
  if (error) throw error;
  if (!files?.some(file => file.name === 'avatar.jpg')) return null;
  const { data, error: signingError } = await bucket.createSignedUrl(`${userId}/avatar.jpg`, 300);
  if (signingError) throw signingError;
  return data.signedUrl;
}

export async function uploadProfilePhoto(uri: string, width: number, height: number) {
  const userId = await currentUserId();
  const side = Math.min(width, height);
  if (!Number.isFinite(side) || side <= 0) throw new Error('Choose a different photo.');
  // Re-encode the selected image; only the square thumbnail is sent to Storage.
  const image = await manipulateAsync(uri, [
    { crop: { originX: Math.floor((width - side) / 2), originY: Math.floor((height - side) / 2), width: side, height: side } },
    { resize: { width: 512, height: 512 } }
  ], { format: SaveFormat.JPEG, compress: .8, base64: true });
  if (!image.base64) throw new Error('Could not prepare your photo.');
  const bytes = decode(image.base64);
  if (bytes.byteLength > 2 * 1024 * 1024) throw new Error('Choose a smaller photo.');
  const { error } = await supabase.storage.from(BUCKET).upload(`${userId}/avatar.jpg`, bytes, {
    contentType: 'image/jpeg', cacheControl: '0', upsert: true
  });
  if (error) throw error;
  return getProfilePhotoUrl(userId);
}

export async function removeProfilePhoto() {
  const userId = await currentUserId();
  const { error } = await supabase.storage.from(BUCKET).remove([`${userId}/avatar.jpg`]);
  if (error) throw error;
}

export async function exportProfilePhoto(userId: string) {
  const url = await getProfilePhotoUrl(userId);
  if (!url) return null;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Could not export your profile photo. Please try again.');
  return { content_type: 'image/jpeg', base64: encode(await response.arrayBuffer()) };
}
