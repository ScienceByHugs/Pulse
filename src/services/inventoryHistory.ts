import { supabase } from '@/lib/supabase';
import { inventoryHistoryEvents } from '@/domain/inventoryHistory';
export async function listInventoryHistory(itemId: string) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user)
    throw authError ?? new Error('Sign in before opening stock history.');
  const { data: containers, error } = await supabase
    .from('inventory_containers')
    .select('id,total_amount,unit,created_at')
    .eq('user_id', user.id)
    .eq('protocol_item_id', itemId)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  if (!containers?.length) return [];
  const ids = containers.map((c) => c.id);
  const batches = Array.from({ length: Math.ceil(ids.length / 50) }, (_, i) =>
    ids.slice(i * 50, (i + 1) * 50),
  );
  const results = await Promise.all(
    batches.map(async (batch) => {
      const [adjustments, logs] = await Promise.all([
        supabase
          .from('inventory_adjustments')
          .select(
            'id,inventory_container_id,old_remaining_amount,new_remaining_amount,reason,created_at',
          )
          .eq('user_id', user.id)
          .in('inventory_container_id', batch)
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('dose_logs')
          .select('id,inventory_container_id,amount,unit,status,logged_at')
          .eq('user_id', user.id)
          .in('inventory_container_id', batch)
          .order('logged_at', { ascending: false })
          .limit(500),
      ]);
      if (adjustments.error) throw adjustments.error;
      if (logs.error) throw logs.error;
      return { adjustments: adjustments.data ?? [], logs: logs.data ?? [] };
    }),
  );
  return inventoryHistoryEvents(
    containers,
    results.flatMap((r) => r.adjustments),
    results.flatMap((r) => r.logs),
  ).slice(0, 100);
}
