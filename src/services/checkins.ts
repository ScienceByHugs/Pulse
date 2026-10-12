import { supabase } from '@/lib/supabase';
import { localDateKey } from '@/domain/schedule';
export type CheckIn = {
  id: string;
  local_date: string;
  sleep: number | null;
  energy: number | null;
  mood: number | null;
  notes: string | null;
};
export async function listCheckIns(
  start?: string,
  end?: string,
  ownerId?: string,
) {
  const result: CheckIn[] = [];
  for (let from = 0; ; from += 500) {
    let query = supabase
      .from('daily_checkins')
      .select('id,local_date,sleep,energy,mood,notes')
      .order('local_date', { ascending: false })
      .order('id')
      .range(from, from + 499);
    if (ownerId) query = query.eq('user_id', ownerId);
    if (start) query = query.gte('local_date', start);
    if (end) query = query.lte('local_date', end);
    const { data, error } = await query;
    if (error) throw error;
    result.push(...(data as CheckIn[]));
    if (data.length < 500) return result;
  }
}
export async function saveCheckIn(input: Omit<CheckIn, 'id'>) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user?.email_confirmed_at)
    throw new Error('Connect and sign in to save a check-in.');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.local_date) ||
    input.local_date > localDateKey()
  )
    throw new Error('Choose a date no later than today.');
  if (
    input.sleep !== null &&
    (!Number.isFinite(input.sleep) || input.sleep < 0 || input.sleep > 24)
  )
    throw new Error('Sleep must be between 0 and 24 hours.');
  for (const score of [input.energy, input.mood])
    if (score !== null && (!Number.isInteger(score) || score < 1 || score > 5))
      throw new Error('Choose a score from 1 to 5.');
  if ((input.notes?.length ?? 0) > 2000)
    throw new Error('Keep notes within 2,000 characters.');
  const { error: saveError } = await supabase
    .from('daily_checkins')
    .upsert(
      { ...input, user_id: user.id, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,local_date' },
    );
  if (saveError) throw saveError;
}
export async function deleteCheckIn(id: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in first.');
  const { error } = await supabase
    .from('daily_checkins')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) throw error;
}
