import { supabase } from '@/lib/supabase';
import { localDateKey, validateTrackedSchedule } from '@/domain/schedule';
import { enqueueQuickLog, readOutbox, removeQuickLog, type QuickLogPayload } from '@/lib/outbox';

export type InventorySummary = {
  id: string;
  remaining_amount: number;
  total_amount: number;
  unit: string;
  low_threshold: number;
  is_active: boolean;
};

export type TodayItem = {
  id: string;
  protocol_id: string;
  created_at?: string;
  active?: boolean;
  archived_at?: string | null;
  starts_on?: string | null;
  ends_on?: string | null;
  name: string;
  category: string | null;
  route: string;
  dose_amount: number;
  dose_unit: string;
  schedule: Record<string, unknown>;
  site_rotation_enabled: boolean;
  inventory_containers?: InventorySummary[];
};

export type TimelineEntry = {
  id: string;
  protocol_item_id?: string;
  amount: number;
  unit: string;
  route: string | null;
  site: string | null;
  status: string;
  logged_at: string;
  protocol_items?: { name: string } | null;
};

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw error ?? new Error('No authenticated user');
  return data.user.id;
}

export async function listProtocols() {
  const { data, error } = await supabase
    .from('protocols')
    .select('id,name,status,starts_on,ends_on,created_at')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function updateProtocolStatus(protocolId: string, status: 'active' | 'paused' | 'archived') {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('protocols')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', protocolId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Protocol not found or you do not have permission to change it.');
}

function validCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year = 0, month = 0, day = 0] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export async function updateProtocolDetails(protocolId: string, name: string, startsOn: string | null, endsOn: string | null) {
  const userId = await currentUserId();
  const cleanName = name.trim();
  if (!cleanName || cleanName.length > 100) throw new Error('Use a protocol name of 1–100 characters.');
  if (startsOn && !validCalendarDate(startsOn)) throw new Error('Start date must be a real date in YYYY-MM-DD format.');
  if (endsOn && !validCalendarDate(endsOn)) throw new Error('End date must be a real date in YYYY-MM-DD format.');
  if (startsOn && endsOn && endsOn < startsOn) throw new Error('End date cannot be before the start date.');
  const { data, error } = await supabase.from('protocols')
    .update({ name: cleanName, starts_on: startsOn, ends_on: endsOn, updated_at: new Date().toISOString() })
    .eq('id', protocolId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Protocol not found or you do not have permission to update it.');
}

export async function setProtocolItemActive(itemId: string, active: boolean) {
  const userId = await currentUserId();
  const { error } = await supabase.from('protocol_items')
    .update({ active })
    .eq('id', itemId)
    .eq('user_id', userId)
    .is('archived_at', null);
  if (error) throw error;
}

export async function setProtocolItemArchived(itemId: string, archived: boolean) {
  const userId = await currentUserId();
  const { data, error } = await supabase.from('protocol_items')
    .update({ archived_at: archived ? new Date().toISOString() : null, active: false })
    .eq('id', itemId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Substance not found or you do not have permission to archive it.');
}

export async function updateProtocolItemDetails(itemId: string, name: string, category: string, doseAmount: number, doseUnit: string, route: string) {
  const userId = await currentUserId();
  const cleaned = name.trim();
  if (!cleaned || cleaned.length > 100) throw new Error('Enter a substance name up to 100 characters.');
  if (!Number.isFinite(doseAmount) || doseAmount <= 0) throw new Error('Enter a positive dose amount.');
  if (!doseUnit.trim() || doseUnit.trim().length > 30) throw new Error('Enter a valid dose unit.');
  if (!['subcutaneous', 'intramuscular', 'oral', 'topical', 'other'].includes(route)) throw new Error('Choose a valid route.');
  const { data, error } = await supabase.from('protocol_items')
    .update({ name: cleaned, category: category.trim() || null, dose_amount: doseAmount, dose_unit: doseUnit.trim(), route })
    .eq('id', itemId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Substance was not updated. Check your permissions and try again.');
}

export async function updateProtocolItemSchedule(itemId: string, schedule: Record<string, unknown>) {
  const userId = await currentUserId();
  const validated = validateTrackedSchedule(schedule);
  const { data, error } = await supabase.from('protocol_items')
    .update({ schedule: validated })
    .eq('id', itemId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Substance not found or you do not have permission to update it.');
}

export async function createProtocol(name: string) {
  const userId = await currentUserId();
  const cleanName = name.trim();
  if (!cleanName || cleanName.length > 100) throw new Error('Use a protocol name of 1–100 characters.');
  const { data, error } = await supabase
    .from('protocols')
    .insert({ user_id: userId, name: cleanName })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function listProtocolItems(protocolId?: string) {
  let query = supabase
    .from('protocol_items')
    .select('id,protocol_id,name,category,route,form,dose_amount,dose_unit,schedule,active,archived_at,site_rotation_enabled,created_at,inventory_containers(id,remaining_amount,total_amount,unit,low_threshold,is_active)')
    .order('created_at', { ascending: false });

  if (protocolId) query = query.eq('protocol_id', protocolId);

  const { data, error } = await query;
  if (error) throw error;
  return data as TodayItem[];
}

export async function listTodayItems() {
  const { data, error } = await supabase
    .from('protocol_items')
    .select('id,protocol_id,created_at,name,category,route,dose_amount,dose_unit,schedule,site_rotation_enabled,inventory_containers(id,remaining_amount,total_amount,unit,low_threshold,is_active),protocols!inner(status,starts_on,ends_on)')
    .eq('active', true)
    .is('archived_at', null)
    .eq('protocols.status', 'active')
    .order('created_at', { ascending: true });

  if (error) throw error;
  const today = localDateKey();
  const current = (data ?? []).filter((row) => {
    const protocol = row.protocols as unknown as { starts_on: string | null; ends_on: string | null };
    return (!protocol.starts_on || today >= protocol.starts_on) &&
      (!protocol.ends_on || today <= protocol.ends_on);
  });
  return current.map(row => {
    const protocol = row.protocols as unknown as { starts_on: string | null; ends_on: string | null };
    return { ...row, starts_on: protocol.starts_on, ends_on: protocol.ends_on };
  }) as unknown as TodayItem[];
}

type CreateItemInput = {
  protocolId: string;
  name: string;
  category?: string;
  route: 'subcutaneous' | 'intramuscular' | 'oral' | 'topical' | 'other';
  doseAmount: number;
  doseUnit: string;
  schedule: Record<string, unknown>;
  inventoryAmount?: number;
  lowThreshold?: number;
};

export async function createProtocolItem(input: CreateItemInput) {
  const userId = await currentUserId();
  const { data: item, error } = await supabase
    .from('protocol_items')
    .insert({
      user_id: userId,
      protocol_id: input.protocolId,
      name: input.name.trim(),
      category: input.category?.trim() || null,
      route: input.route,
      dose_amount: input.doseAmount,
      dose_unit: input.doseUnit.trim(),
      schedule: input.schedule,
      site_rotation_enabled: input.route === 'subcutaneous' || input.route === 'intramuscular'
    })
    .select()
    .single();

  if (error) throw error;

  if (input.inventoryAmount && input.inventoryAmount > 0) {
    const { error: inventoryError } = await supabase.from('inventory_containers').insert({
      user_id: userId,
      protocol_item_id: item.id,
      total_amount: input.inventoryAmount,
      remaining_amount: input.inventoryAmount,
      unit: input.doseUnit.trim(),
      low_threshold: Math.max(input.lowThreshold ?? input.doseAmount * 3, 0),
      is_active: true
    });
    if (inventoryError) throw inventoryError;
  }

  return item;
}

function clientEventId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    const next = char === 'x' ? value : (value & 0x3) | 0x8;
    return next.toString(16);
  });
}

async function sendQuickLog(payload: QuickLogPayload) {
  return supabase.rpc('log_dose_and_decrement', {
    p_protocol_item_id: payload.protocolItemId,
    p_amount: payload.amount,
    p_unit: payload.unit,
    p_route: payload.route ?? null,
    p_site: payload.site ?? null,
    p_inventory_container_id: payload.inventoryContainerId ?? null,
    p_scheduled_for: payload.scheduledFor ?? null,
    p_client_event_id: payload.clientEventId
  });
}

function isNetworkError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /network|fetch|offline|connection/i.test(message);
}

export function selectInventoryContainer(item: TodayItem): InventorySummary | null {
  const containers = item.inventory_containers ?? [];
  if (containers.length === 0) return null;
  const eligible = containers
    .filter((container) =>
      container.is_active &&
      container.unit === item.dose_unit &&
      Number.isFinite(Number(container.remaining_amount)) &&
      Number(container.remaining_amount) >= item.dose_amount
    )
    .sort((a, b) =>
      Number(a.remaining_amount) - Number(b.remaining_amount) || a.id.localeCompare(b.id)
    );
  return eligible[0] ?? null;
}

export async function quickLog(item: TodayItem, site?: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sign in before logging.');
  const userId = session.user.id;
  const activeInventory = selectInventoryContainer(item);
  if ((item.inventory_containers?.length ?? 0) > 0 && !activeInventory) {
    throw new Error('No active container has enough matching-unit stock. Update your Supply Reservoir before logging.');
  }
  const payload: QuickLogPayload = {
    protocolItemId: item.id,
    amount: item.dose_amount,
    unit: item.dose_unit,
    route: item.route,
    site: site ?? null,
    inventoryContainerId: activeInventory?.id ?? null,
    scheduledFor: null,
    clientEventId: clientEventId()
  };

  try {
    const { data, error } = await sendQuickLog(payload);
    if (error) throw error;
    return { data, queued: false };
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    await enqueueQuickLog(userId, payload);
    return { data: null, queued: true };
  }
}

export async function flushQuickLogOutbox() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return 0;
  const userId = session.user.id;
  const queued = await readOutbox(userId);
  let flushed = 0;

  for (const payload of queued) {
    const { data: { session: current } } = await supabase.auth.getSession();
    if (current?.user.id !== userId) break;
    try {
      const { error } = await sendQuickLog(payload);
      if (error) {
        // Keep a rejected entry for a future retry, but continue attempting
        // later entries so one malformed/stale record cannot block the queue.
        continue;
      }
      await removeQuickLog(userId, payload.clientEventId);
      flushed += 1;
    } catch (error) {
      // A thrown network failure means the connection is unavailable; stop
      // here and leave the remaining queue untouched.
      if (isNetworkError(error)) break;
      continue;
    }
  }

  return flushed;
}

export async function listRecentSites(limit = 100) {
  const { data, error } = await supabase
    .from('dose_logs')
    .select('protocol_item_id,site,logged_at')
    .not('site', 'is', null)
    .order('logged_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  const byItem: Record<string, string[]> = {};
  for (const row of data ?? []) {
    if (!row.site) continue;
    const itemId = row.protocol_item_id;
    if (!itemId) continue;
    const list = byItem[itemId] ?? [];
    list.push(row.site);
    byItem[itemId] = list;
  }
  return byItem;
}

// Export-ready history retrieval: advance over stable pages instead of silently
// dropping all but the first 1,000 events. The safety cap is surfaced in UI.
export async function listTimelineHistory(maxEntries = 10000) {
  const pageSize = 500;
  const result: TimelineEntry[] = [];
  let truncated = false;
  for (let from = 0; from < maxEntries; from += pageSize) {
    const take = Math.min(pageSize, maxEntries - from);
    const { data, error } = await supabase
      .from('dose_logs')
      .select('id,protocol_item_id,amount,unit,route,site,status,logged_at,protocol_items(name)')
      .order('logged_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + take - 1);
    if (error) throw error;
    const batch = (data ?? []) as unknown as TimelineEntry[];
    result.push(...batch);
    if (batch.length < take) return { entries: result, truncated: false };
  }
  // Determine whether the cap is reached with more records remaining.
  const { data: beyond, error } = await supabase
    .from('dose_logs').select('id')
    .order('logged_at', { ascending: false }).order('id', { ascending: false })
    .range(maxEntries, maxEntries);
  if (error) throw error;
  truncated = (beyond?.length ?? 0) > 0;
  return { entries: result, truncated };
}

export async function listDoseLogs(limit = 50) {
  const { data, error } = await supabase
    .from('dose_logs')
    .select('id,protocol_item_id,amount,unit,route,site,status,logged_at,protocol_items(name)')
    .order('logged_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as unknown as TimelineEntry[];
}

export async function addInventoryContainer(itemId: string, amount: number, unit: string, lowThreshold: number) {
  const userId = await currentUserId();
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(lowThreshold) || lowThreshold < 0) {
    throw new Error('Enter a positive quantity and a nonnegative low-stock threshold.');
  }
  const { data: item, error: itemError } = await supabase.from('protocol_items')
    .select('id,dose_unit')
    .eq('id', itemId).eq('user_id', userId).maybeSingle();
  if (itemError) throw itemError;
  if (!item) throw new Error('Substance is missing or not owned by this account.');
  if (unit.trim() !== item.dose_unit) throw new Error('Container unit must match the substance unit. Convert quantities before adding.');
  const { error } = await supabase.from('inventory_containers').insert({
    user_id: userId,
    protocol_item_id: itemId,
    total_amount: amount,
    remaining_amount: amount,
    unit: unit.trim(),
    low_threshold: lowThreshold,
    is_active: true
  });
  if (error) throw error;
}

export async function correctInventoryRemaining(containerId: string, newAmount: number, reason: string) {
  if (!Number.isFinite(newAmount) || newAmount < 0) throw new Error('Remaining quantity must be zero or higher.');
  const explanation = reason.trim();
  if (explanation.length < 3 || explanation.length > 500) throw new Error('Explain the correction in 3–500 characters.');
  const { error } = await supabase.rpc('correct_inventory_remaining', {
    p_container_id: containerId,
    p_new_amount: newAmount,
    p_reason: explanation
  });
  if (error) throw error;
}
