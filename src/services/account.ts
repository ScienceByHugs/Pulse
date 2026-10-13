import { clearCreations, pendingCreations } from '@/lib/creationRequests';
import {
  getSubstancePhoto,
  removeSubstancePhoto,
} from '@/services/substancePhoto';
import { privateStorage } from '@/lib/privateStorage';
import { Share } from 'react-native';
import { supabase } from '@/lib/supabase';
import { clearOutbox } from '@/lib/outbox';
import { exportProfilePhoto } from '@/services/profilePhoto';

async function allRows(table: string, userId: string, order: string) {
  const rows: Record<string, unknown>[] = [];
  let after: string | undefined;
  for (;;) {
    // Every caller uses a key unique within this owner. Cursor pagination
    // avoids skipping records when an earlier page changes during export.
    let query = supabase
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .order(order, { ascending: true })
      .limit(500);
    if (after) query = query.gt(order, after);
    const { data, error } = await query;
    if (error) throw error;
    if (data?.some((row) => row.user_id !== userId))
      throw new Error('Could not verify the owner of the exported records.');
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < 500) return rows;
    const cursor = data?.at(-1)?.[order];
    if (typeof cursor !== 'string' || cursor === after)
      throw new Error('Could not continue the account export. Please retry.');
    after = cursor;
  }
}

export async function exportPulseData() {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user)
    throw authError ?? new Error('Sign in before exporting.');
  const [
    profile,
    protocols,
    items,
    inventory,
    logs,
    adjustments,
    logRevisions,
    profilePhoto,
    checkins,
    itemVersions,
    cancellations,
  ] = await Promise.all([
    allRows('profiles', user.id, 'user_id'),
    allRows('protocols', user.id, 'id'),
    allRows('protocol_items', user.id, 'id'),
    allRows('inventory_containers', user.id, 'id'),
    allRows('dose_logs', user.id, 'id'),
    allRows('inventory_adjustments', user.id, 'id'),
    allRows('dose_log_revisions', user.id, 'id'),
    exportProfilePhoto(user.id),
    allRows('daily_checkins', user.id, 'id'),
    allRows('protocol_item_versions', user.id, 'id'),
    allRows('tracking_event_cancellations', user.id, 'event_id'),
  ]);

  const substancePhotos = await Promise.all(
    items.map(async (item) => ({
      protocol_item_id: item.id,
      image: await getSubstancePhoto(user.id, String(item.id)),
    })),
  );
  const payload = {
    device_substance_photos: substancePhotos.filter((photo) => photo.image),
    pending_creation_requests: await pendingCreations(user.id),
    exported_at: new Date().toISOString(),
    format: 'pulse-2-export-v1',
    account_profile: {
      full_name: user.user_metadata?.full_name ?? '',
      contact_phone: user.user_metadata?.contact_phone ?? '',
      eligibility_confirmation:
        user.user_metadata?.eligibility_confirmation ?? null,
      photo: profilePhoto,
    },
    profile,
    protocols,
    protocol_items: items,
    inventory_containers: inventory,
    dose_logs: logs,
    inventory_adjustments: adjustments,
    dose_log_revisions: logRevisions,
    daily_checkins: checkins,
    protocol_item_versions: itemVersions,
    tracking_event_cancellations: cancellations,
  };

  const { data: currentAuth, error: currentAuthError } =
    await supabase.auth.getUser();
  if (currentAuthError) throw currentAuthError;
  if (currentAuth.user?.id !== user.id)
    throw new Error('Your signed-in account changed. Start the export again.');

  const json = JSON.stringify(payload, null, 2);
  await Share.share({
    title: 'Pulse data export',
    message: json,
  });

  return payload;
}

type CleanupFailure = { step: string; error: unknown };

export class AccountDeviceCleanupError extends Error {
  readonly accountDeleted = true;

  constructor(readonly failures: CleanupFailure[]) {
    super(
      'Your Pulse account was deleted, but cleanup on this device was incomplete. Please contact support@sciencebyhugs.com before using another account on this device.',
    );
    this.name = 'AccountDeviceCleanupError';
  }
}

export async function deletePulseAccount() {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError || !session)
    throw sessionError ?? new Error('Sign in before deleting your account.');
  const userId = session.user.id;
  const itemsToClear = await allRows('protocol_items', userId, 'id');
  const { data, error } = await supabase.functions.invoke('delete-account', {
    method: 'POST',
    body: {},
    // Bind the destructive request to the account whose device data we read,
    // even if another sign-in occurs while that read is in progress.
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error) throw error;
  if (!data?.deleted)
    throw new Error('Account deletion was not confirmed by the server');

  const cleanup = [
    ...itemsToClear.map((item) => ({
      step: 'substance photo',
      run: () => removeSubstancePhoto(userId, String(item.id)),
    })),
    { step: 'pending logs', run: () => clearOutbox(userId) },
    { step: 'pending creations', run: () => clearCreations(userId) },
    {
      step: 'Today cache',
      run: () => privateStorage.removeItem(`pulse.today-cache.${userId}`),
    },
  ];
  const results = await Promise.allSettled(
    cleanup.map(({ run }) => Promise.resolve().then(run)),
  );
  const failures: CleanupFailure[] = [];
  results.forEach((result, index) => {
    if (result.status === 'rejected')
      failures.push({ step: cleanup[index]!.step, error: result.reason });
  });

  // Local sign-out must still be attempted after every failed storage removal.
  // Supabase returns some sign-out failures instead of throwing them.
  try {
    const { error: signOutError } = await supabase.auth.signOut({
      scope: 'local',
    });
    if (signOutError) failures.push({ step: 'sign out', error: signOutError });
  } catch (signOutError) {
    failures.push({ step: 'sign out', error: signOutError });
  }
  if (failures.length) throw new AccountDeviceCleanupError(failures);
}
