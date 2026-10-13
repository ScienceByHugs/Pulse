import { withCreation, stableCreationValue } from '@/lib/creationRequests';
import { randomUUID } from 'expo-crypto';
import {
  deviceTimeZone,
  zonedDateKey,
  type OccurrenceFields,
} from '@/domain/occurrences';
import { preferredContainer } from '@/domain/inventory';
import { isNetworkError } from '@/domain/network';
import { supabase } from '@/lib/supabase';
import { localDateKey, validateTrackedSchedule } from '@/domain/schedule';
import {
  enqueueQuickLog,
  readOutbox,
  removeQuickLog,
  updateQuickLog,
  type QuickLogPayload,
} from '@/lib/outbox';

export type InventorySummary = {
  id: string;
  remaining_amount: number;
  total_amount: number;
  unit: string;
  low_threshold: number;
  is_active: boolean;
  opened_at?: string | null;
  expires_at?: string | null;
  user_use_by_at?: string | null;
  lot_number?: string | null;
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
  revision: number;
  client_event_id?: string | null;
  occurrence_key?: string | null;
  local_date?: string | null;
  time_zone?: string | null;
  scheduled_for?: string | null;
  snapshot?: Record<string, unknown> | null;
  pending?: boolean;
  notes?: string | null;
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

export async function updateProtocolStatus(
  protocolId: string,
  status: 'active' | 'paused' | 'archived',
) {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('protocols')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', protocolId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data)
    throw new Error(
      'Protocol not found or you do not have permission to change it.',
    );
}

function validCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year = 0, month = 0, day = 0] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export async function updateProtocolDetails(
  protocolId: string,
  name: string,
  startsOn: string | null,
  endsOn: string | null,
) {
  const userId = await currentUserId();
  const cleanName = name.trim();
  if (!cleanName || cleanName.length > 100)
    throw new Error('Use a protocol name of 1–100 characters.');
  if (startsOn && !validCalendarDate(startsOn))
    throw new Error('Start date must be a real date in YYYY-MM-DD format.');
  if (endsOn && !validCalendarDate(endsOn))
    throw new Error('End date must be a real date in YYYY-MM-DD format.');
  if (startsOn && endsOn && endsOn < startsOn)
    throw new Error('End date cannot be before the start date.');
  const { data, error } = await supabase
    .from('protocols')
    .update({
      name: cleanName,
      starts_on: startsOn,
      ends_on: endsOn,
      updated_at: new Date().toISOString(),
    })
    .eq('id', protocolId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data)
    throw new Error(
      'Protocol not found or you do not have permission to update it.',
    );
}

export async function setProtocolItemActive(itemId: string, active: boolean) {
  const userId = await currentUserId();
  const { error } = await supabase
    .from('protocol_items')
    .update({ active })
    .eq('id', itemId)
    .eq('user_id', userId)
    .is('archived_at', null);
  if (error) throw error;
}

export async function setProtocolItemArchived(
  itemId: string,
  archived: boolean,
) {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('protocol_items')
    .update({
      archived_at: archived ? new Date().toISOString() : null,
      active: false,
    })
    .eq('id', itemId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data)
    throw new Error(
      'Substance not found or you do not have permission to archive it.',
    );
}

export async function updateProtocolItemDetails(
  itemId: string,
  name: string,
  category: string,
  doseAmount: number,
  doseUnit: string,
  route: string,
) {
  const userId = await currentUserId();
  const cleaned = name.trim();
  if (!cleaned || cleaned.length > 100)
    throw new Error('Enter a substance name up to 100 characters.');
  if (!Number.isFinite(doseAmount) || doseAmount <= 0)
    throw new Error('Enter a positive dose amount.');
  if (!doseUnit.trim() || doseUnit.trim().length > 30)
    throw new Error('Enter a valid dose unit.');
  if (
    !['subcutaneous', 'intramuscular', 'oral', 'topical', 'other'].includes(
      route,
    )
  )
    throw new Error('Choose a valid route.');
  const { data, error } = await supabase
    .from('protocol_items')
    .update({
      name: cleaned,
      category: category.trim() || null,
      dose_amount: doseAmount,
      dose_unit: doseUnit.trim(),
      route,
    })
    .eq('id', itemId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data)
    throw new Error(
      'Substance was not updated. Check your permissions and try again.',
    );
}

export async function updateProtocolItemSchedule(
  itemId: string,
  schedule: Record<string, unknown>,
) {
  const userId = await currentUserId();
  const validated = validateTrackedSchedule(schedule);
  const { data, error } = await supabase
    .from('protocol_items')
    .update({ schedule: validated })
    .eq('id', itemId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data)
    throw new Error(
      'Substance not found or you do not have permission to update it.',
    );
}

async function insertCreation(
  table: string,
  userId: string,
  id: string,
  body: Record<string, unknown>,
  mutable: string[] = [],
) {
  const { data, error } = await supabase
    .from(table)
    .insert({ ...body, user_id: userId, id })
    .select()
    .single();
  if (!error) return data;
  if (error.code !== '23505' && !isNetworkError(error)) throw error;
  const existing = await supabase
    .from(table)
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (existing.error || !existing.data) throw error;
  if (
    Object.entries(body).some(
      ([key, value]) =>
        !mutable.includes(key) &&
        stableCreationValue(existing.data[key]) !== stableCreationValue(value),
    )
  )
    throw new Error(
      'This earlier creation has changed. Refresh your records before creating another one.',
    );
  return existing.data;
}
export async function createProtocol(name: string) {
  const userId = await currentUserId();
  const body = { name: name.trim(), status: 'active' };
  if (!body.name || body.name.length > 100)
    throw new Error('Enter a protocol name of 1–100 characters.');
  return withCreation(userId, 'protocol', body, (request) =>
    insertCreation('protocols', userId, request.id, body, ['status']),
  );
}

export async function listProtocolItems(protocolId?: string) {
  let query = supabase
    .from('protocol_items')
    .select(
      'id,protocol_id,name,category,route,form,dose_amount,dose_unit,schedule,active,archived_at,site_rotation_enabled,created_at,inventory_containers(id,remaining_amount,total_amount,unit,low_threshold,is_active,opened_at,expires_at,user_use_by_at,lot_number)',
    )
    .order('created_at', { ascending: false });

  if (protocolId) query = query.eq('protocol_id', protocolId);

  const { data, error } = await query;
  if (error) throw error;
  return data as TodayItem[];
}

export async function listTodayItems() {
  const { data, error } = await supabase
    .from('protocol_items')
    .select(
      'id,protocol_id,created_at,name,category,route,dose_amount,dose_unit,schedule,site_rotation_enabled,inventory_containers(id,remaining_amount,total_amount,unit,low_threshold,is_active,opened_at,expires_at,user_use_by_at,lot_number),protocols!inner(status,starts_on,ends_on)',
    )
    .eq('active', true)
    .is('archived_at', null)
    .eq('protocols.status', 'active')
    .order('created_at', { ascending: true });

  if (error) throw error;
  const current = data ?? [];
  return current.map((row) => {
    const protocol = row.protocols as unknown as {
      starts_on: string | null;
      ends_on: string | null;
    };
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
  const body = {
    protocol_id: input.protocolId,
    name: input.name.trim(),
    category: input.category?.trim() || null,
    route: input.route,
    dose_amount: input.doseAmount,
    dose_unit: input.doseUnit.trim(),
    schedule: validateTrackedSchedule(input.schedule),
    site_rotation_enabled:
      input.route === 'subcutaneous' || input.route === 'intramuscular',
  };
  if (
    !body.name ||
    body.name.length > 100 ||
    !Number.isFinite(input.doseAmount) ||
    input.doseAmount <= 0 ||
    !body.dose_unit
  )
    throw new Error('Enter a name, positive amount and unit.');
  const inventory = input.inventoryAmount ?? 0;
  if (!Number.isFinite(inventory) || inventory < 0)
    throw new Error('Container total must be zero or higher.');
  const threshold = Math.max(input.lowThreshold ?? input.doseAmount * 3, 0);
  if (!Number.isFinite(threshold))
    throw new Error('Enter a valid low-stock threshold.');
  return withCreation(
    userId,
    'substance',
    { body, inventory, threshold },
    async (request) => {
      const item = await insertCreation(
        'protocol_items',
        userId,
        request.id,
        body,
      );
      if (inventory > 0)
        await insertCreation(
          'inventory_containers',
          userId,
          request.containerId,
          {
            protocol_item_id: item.id,
            total_amount: inventory,
            remaining_amount: inventory,
            unit: body.dose_unit,
            low_threshold: threshold,
            is_active: true,
          },
          ['remaining_amount', 'is_active'],
        );
      return item;
    },
  );
}

const clientEventId = randomUUID;

async function sendQuickLog(payload: QuickLogPayload) {
  return supabase.rpc('record_tracking_event', {
    p_item_id: payload.protocolItemId,
    p_event_id: payload.clientEventId,
    p_amount: payload.amount,
    p_unit: payload.unit,
    p_route: payload.route ?? null,
    p_site: payload.site ?? null,
    p_container_id: payload.inventoryContainerId ?? null,
    p_logged_at: payload.loggedAt,
    p_scheduled_for: payload.scheduledFor ?? null,
    p_occurrence_key: payload.occurrenceKey ?? null,
    p_local_date: payload.localDate,
    p_time_zone: payload.timeZone,
    p_status: payload.status ?? 'completed',
  });
}
export function selectInventoryContainer(
  item: TodayItem,
): InventorySummary | null {
  return preferredContainer(item);
}
let syncing: Promise<number> | null = null;
export async function flushQuickLogOutbox(retryReviewed = false) {
  if (syncing) return syncing;
  syncing = (async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return 0;
    const userId = session.user.id;
    let flushed = 0;
    for (const payload of await readOutbox(userId)) {
      const {
        data: { session: current },
      } = await supabase.auth.getSession();
      if (current?.user.id !== userId) break;
      if (
        !payload.undoRequested &&
        (!payload.loggedAt || !payload.localDate || !payload.timeZone)
      ) {
        await updateQuickLog(userId, payload.clientEventId, {
          needsReview: true,
          syncError:
            'This older entry needs its original date and time before it can sync.',
        });
        continue;
      }
      if (payload.needsReview && !retryReviewed && !payload.undoRequested)
        continue;
      try {
        if (payload.undoRequested) {
          const { error } = await supabase.rpc('undo_tracking_event', {
            p_event_id: payload.clientEventId,
          });
          if (error) throw error;
          if (await removeQuickLog(userId, payload.clientEventId, true))
            flushed++;
          continue;
        }
        const { data, error } = await sendQuickLog(payload);
        if (error) throw error;
        const latest = (await readOutbox(userId)).find(
          (p) => p.clientEventId === payload.clientEventId,
        );
        let undone = !data || data.status === 'voided';
        if (latest?.undoRequested && !undone) {
          const { error: undoError } = await supabase.rpc(
            'undo_tracking_event',
            { p_event_id: payload.clientEventId },
          );
          if (undoError) throw undoError;
          undone = true;
        }
        if (await removeQuickLog(userId, payload.clientEventId, undone))
          flushed++;
      } catch (error) {
        if (isNetworkError(error)) break;
        await updateQuickLog(userId, payload.clientEventId, {
          needsReview: true,
          syncError:
            (error as { message?: string })?.message ??
            'Review this entry before retrying.',
        });
      }
    }
    return flushed;
  })();
  try {
    return await syncing;
  } finally {
    syncing = null;
  }
}
let logging: Promise<unknown> = Promise.resolve();
export function quickLog(
  item: TodayItem & Partial<OccurrenceFields>,
  site?: string,
  status: 'completed' | 'skipped' = 'completed',
) {
  const work = logging.then(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error('Sign in before logging.');
    const userId = session.user.id;
    const pending = await readOutbox(userId);
    if (
      item.occurrenceKey &&
      pending.some((p) => p.occurrenceKey === item.occurrenceKey)
    )
      throw new Error('This scheduled entry is already pending sync.');
    const adjusted = {
      ...item,
      inventory_containers: item.inventory_containers?.map((c) => ({
        ...c,
        remaining_amount:
          Number(c.remaining_amount) -
          pending
            .filter(
              (p) => p.inventoryContainerId === c.id && p.status !== 'skipped',
            )
            .reduce((sum, p) => sum + p.amount, 0),
      })),
    };
    const stock =
      status === 'completed' ? selectInventoryContainer(adjusted) : null;
    if (
      status === 'completed' &&
      (item.inventory_containers?.length ?? 0) > 0 &&
      !stock
    )
      throw new Error(
        'No usable container has enough matching-unit stock after pending logs. Review Inventory.',
      );
    const loggedAt = new Date().toISOString();
    const zone = item.timeZone ?? deviceTimeZone();
    const payload: QuickLogPayload = {
      protocolItemId: item.id,
      amount: item.dose_amount,
      unit: item.dose_unit,
      route: item.route,
      site: site ?? null,
      inventoryContainerId: stock?.id ?? null,
      scheduledFor: item.scheduledFor ?? null,
      occurrenceKey: item.occurrenceKey ?? null,
      loggedAt,
      localDate: item.dayKey ?? zonedDateKey(new Date(loggedAt), zone),
      timeZone: zone,
      clientEventId: clientEventId(),
      status,
      itemName: item.name,
    };
    // Persist first: interruption after a server commit safely replays the same UUID.
    await enqueueQuickLog(userId, payload);
    try {
      const { data, error } = await sendQuickLog(payload);
      if (error) throw error;
      await removeQuickLog(userId, payload.clientEventId);
      return {
        data: data as TimelineEntry,
        queued: false,
        eventId: payload.clientEventId,
      };
    } catch (error) {
      if (isNetworkError(error))
        return { data: null, queued: true, eventId: payload.clientEventId };
      await updateQuickLog(userId, payload.clientEventId, {
        needsReview: true,
        syncError:
          (error as { message?: string })?.message ?? 'Review this entry.',
      });
      throw error;
    }
  });
  logging = work.catch(() => undefined);
  return work;
}

export async function listRecentSites(limit = 100) {
  const { data, error } = await supabase
    .from('dose_logs')
    .select('protocol_item_id,site,logged_at')
    .eq('status', 'completed')
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
      .select(
        'id,protocol_item_id,amount,unit,route,site,status,logged_at,revision,client_event_id,occurrence_key,local_date,time_zone,scheduled_for,snapshot,protocol_items(name)',
      )
      .neq('status', 'voided')
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
    .from('dose_logs')
    .select('id')
    .neq('status', 'voided')
    .order('logged_at', { ascending: false })
    .order('id', { ascending: false })
    .range(maxEntries, maxEntries);
  if (error) throw error;
  truncated = (beyond?.length ?? 0) > 0;
  return { entries: result, truncated };
}

export async function listDoseLogs(limit = 50) {
  const { data, error } = await supabase
    .from('dose_logs')
    .select(
      'id,protocol_item_id,amount,unit,route,site,status,logged_at,revision,client_event_id,occurrence_key,local_date,time_zone,scheduled_for,snapshot,protocol_items(name)',
    )
    .neq('status', 'voided')
    .order('logged_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as unknown as TimelineEntry[];
}

export async function addInventoryContainer(
  itemId: string,
  amount: number,
  unit: string,
  lowThreshold: number,
) {
  const userId = await currentUserId();
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !Number.isFinite(lowThreshold) ||
    lowThreshold < 0
  ) {
    throw new Error(
      'Enter a positive quantity and a nonnegative low-stock threshold.',
    );
  }
  const { data: item, error: itemError } = await supabase
    .from('protocol_items')
    .select('id,dose_unit')
    .eq('id', itemId)
    .eq('user_id', userId)
    .maybeSingle();
  if (itemError) throw itemError;
  if (!item)
    throw new Error('Substance is missing or not owned by this account.');
  if (unit.trim() !== item.dose_unit)
    throw new Error(
      'Container unit must match the substance unit. Convert quantities before adding.',
    );
  const body = {
    protocol_item_id: itemId,
    total_amount: amount,
    remaining_amount: amount,
    unit: unit.trim(),
    low_threshold: lowThreshold,
    is_active: true,
  };
  return withCreation(userId, 'container', body, (request) =>
    insertCreation('inventory_containers', userId, request.id, body, [
      'remaining_amount',
      'is_active',
    ]),
  );
}

export async function correctInventoryRemaining(
  containerId: string,
  newAmount: number,
  reason: string,
) {
  if (!Number.isFinite(newAmount) || newAmount < 0)
    throw new Error('Remaining quantity must be zero or higher.');
  const explanation = reason.trim();
  if (explanation.length < 3 || explanation.length > 500)
    throw new Error('Explain the correction in 3–500 characters.');
  const { error } = await supabase.rpc('correct_inventory_remaining', {
    p_container_id: containerId,
    p_new_amount: newAmount,
    p_reason: explanation,
  });
  if (error) throw error;
}

export async function correctDoseLog(
  entry: TimelineEntry,
  changes: {
    amount: number;
    loggedAt: string;
    site: string | null;
    status: 'completed' | 'skipped' | 'voided';
  },
) {
  const { data, error } = await supabase.rpc('correct_dose_log', {
    p_log_id: entry.id,
    p_revision: entry.revision,
    p_amount: changes.amount,
    p_logged_at: changes.loggedAt,
    p_site: changes.site,
    p_status: changes.status,
  });
  if (error) throw error;
  return data as TimelineEntry;
}

export function undoDoseLog(entry: TimelineEntry) {
  return correctDoseLog(entry, {
    amount: entry.amount,
    loggedAt: entry.logged_at,
    site: entry.site,
    status: 'voided',
  });
}

export async function skipDose(item: TodayItem & Partial<OccurrenceFields>) {
  return quickLog(item, undefined, 'skipped');
}

export async function duplicateProtocol(
  sourceId: string,
  name: string,
  start: string,
  end: string | null,
) {
  const { data, error } = await supabase.rpc('duplicate_protocol', {
    p_source_id: sourceId,
    p_name: name.trim(),
    p_start: start,
    p_end: end,
  });
  if (error) throw error;
  return data;
}
export async function updateInventoryDates(
  containerId: string,
  changes: {
    opened_at: string | null;
    expires_at: string | null;
    user_use_by_at: string | null;
    lot_number: string | null;
    is_active: boolean;
  },
) {
  const userId = await currentUserId();
  for (const field of ['opened_at', 'expires_at', 'user_use_by_at'] as const)
    if (changes[field] && !Number.isFinite(new Date(changes[field]).getTime()))
      throw new Error('Choose valid container dates.');
  if (changes.lot_number && changes.lot_number.length > 100)
    throw new Error('Lot number is too long.');
  const { data, error } = await supabase
    .from('inventory_containers')
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq('id', containerId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Container not found.');
}
export type ItemVersion = {
  id: string;
  protocol_item_id: string;
  version_order?: number;
  effective_at: string;
  snapshot: Record<string, unknown>;
};
export async function listItemVersions() {
  const from = new Date();
  from.setDate(from.getDate() - 14);
  from.setHours(0, 0, 0, 0);
  const result: ItemVersion[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase
      .rpc('get_schedule_versions', { p_from: from.toISOString() })
      .range(offset, offset + 499);
    if (error) throw error;
    result.push(...(data as ItemVersion[]));
    if (data.length < 500) return result;
  }
}
