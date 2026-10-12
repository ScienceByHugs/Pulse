import { Share } from 'react-native';
import { supabase } from '@/lib/supabase';
import { clearOutbox } from '@/lib/outbox';

async function allRows(table: string, userId: string, order: string) {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase.from(table).select('*').eq('user_id', userId)
      .order(order).range(from, from + 499);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < 500) return rows;
  }
}

export async function exportPulseData() {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw authError ?? new Error('Sign in before exporting.');
  const [
    profile,
    protocols,
    items,
    inventory,
    logs,
    adjustments,
    logRevisions
  ] = await Promise.all([
    allRows('profiles', user.id, 'user_id'),
    allRows('protocols', user.id, 'id'),
    allRows('protocol_items', user.id, 'id'),
    allRows('inventory_containers', user.id, 'id'),
    allRows('dose_logs', user.id, 'id'),
    allRows('inventory_adjustments', user.id, 'id'),
    allRows('dose_log_revisions', user.id, 'id')
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    format: 'pulse-2-export-v1',
    profile,
    protocols,
    protocol_items: items,
    inventory_containers: inventory,
    dose_logs: logs,
    inventory_adjustments: adjustments,
    dose_log_revisions: logRevisions
  };

  const json = JSON.stringify(payload, null, 2);
  await Share.share({
    title: 'Pulse data export',
    message: json
  });

  return payload;
}

export async function deletePulseAccount() {
  const { data: { session } } = await supabase.auth.getSession();
  const { data, error } = await supabase.functions.invoke('delete-account', {
    method: 'POST',
    body: {}
  });

  if (error) throw error;
  if (!data?.deleted) throw new Error('Account deletion was not confirmed by the server');

  try {
    if (session) await clearOutbox(session.user.id);
  } finally {
    await supabase.auth.signOut({ scope: 'local' });
  }
}
