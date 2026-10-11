import { authStorage as AsyncStorage } from '@/lib/privateStorage';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { isDueOnDate, localDateKey, scheduleTime } from '@/domain/schedule';
import type { TodayItem } from '@/services/pulse';

export type CalendarConnection = {
  calendarId: string;
  calendarName: string;
  includeNames: boolean;
  events: Record<string, string>;
};

export type WritableCalendar = { id: string; title: string };

async function storageKey() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw error ?? new Error('Sign in before connecting a calendar.');
  return `pulse:calendar:v1:${data.user.id}`;
}

export async function readCalendarConnection(): Promise<CalendarConnection | null> {
  const raw = await AsyncStorage.getItem(await storageKey());
  if (!raw) return null;
  let parsed: CalendarConnection;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!parsed || typeof parsed.calendarId !== 'string' || !parsed.events || typeof parsed.events !== 'object') return null;
  return parsed;
}

async function persist(connection: CalendarConnection | null) {
  const key = await storageKey();
  if (!connection) await AsyncStorage.removeItem(key);
  else await AsyncStorage.setItem(key, JSON.stringify(connection));
}

async function calendarApi() {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') throw new Error('Calendar linking is available on iOS and Android only.');
  // Keep older development clients functional until the native Expo Calendar rebuild is installed.
  try {
    return await import('expo-calendar/legacy');
  } catch {
    throw new Error('Calendar needs a new Pulse development build with Expo Calendar installed. Rebuild and reinstall the app to enable syncing.');
  }
}

export async function requestWritableCalendars(): Promise<WritableCalendar[]> {
  const Calendar = await calendarApi();
  const permission = await Calendar.requestCalendarPermissionsAsync();
  if (!permission.granted) throw new Error('Calendar permission was not granted. You can change access in device Settings.');
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  return calendars.filter((calendar) => calendar.allowsModifications).map((calendar) => ({
    id: calendar.id,
    title: calendar.title
  }));
}

export async function connectCalendar(calendar: WritableCalendar): Promise<CalendarConnection> {
  const current = await readCalendarConnection();
  if (current && current.calendarId !== calendar.id) throw new Error('Disconnect the current calendar before selecting another.');
  const next: CalendarConnection = current ?? { calendarId: calendar.id, calendarName: calendar.title, includeNames: false, events: {} };
  await persist(next);
  return next;
}

export async function setCalendarTitlePrivacy(includeNames: boolean) {
  const connection = await readCalendarConnection();
  if (!connection) throw new Error('Connect a calendar first.');
  connection.includeNames = includeNames;
  await persist(connection);
  return connection;
}

export type CalendarPreviewEntry = {
  key: string;
  itemId: string;
  name: string;
  startDate: Date;
  endDate: Date;
};

export function buildCalendarPreview(items: TodayItem[], protocols: Array<{ id: string; status: string; starts_on: string | null; ends_on: string | null }>, days = 90, now = new Date()): CalendarPreviewEntry[] {
  const protocolById = new Map(protocols.map((p) => [p.id, p]));
  const result: CalendarPreviewEntry[] = [];
  // Open-ended schedules use a rolling horizon; dated protocols include their final day.
  const rollingDays = Math.min(730, Math.max(1, days));
  let maxDays = rollingDays;
  for (const protocol of protocols) {
    if (protocol.status !== 'active' || !protocol.ends_on) continue;
    if (!items.some((item) => item.protocol_id === protocol.id && item.active !== false && !item.archived_at)) continue;
    const [year = 0, month = 0, day = 0] = protocol.ends_on.split('-').map(Number);
    const end = new Date(year, month - 1, day, 12);
    if (!Number.isFinite(end.getTime())) continue;
    const difference = (Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) -
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000 + 1;
    maxDays = Math.max(maxDays, Math.min(730, Math.round(difference)));
  }
  for (let offset = 0; offset < maxDays; offset++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
    date.setDate(date.getDate() + offset);
    const day = localDateKey(date);
    for (const item of items) {
      if (item.active === false || item.archived_at) continue;
      const protocol = protocolById.get(item.protocol_id);
      if (!protocol || protocol.status !== 'active') continue;
      if ((protocol.starts_on && day < protocol.starts_on) || (protocol.ends_on && day > protocol.ends_on)) continue;
      if (!isDueOnDate(item.schedule, date)) continue;
      const time = scheduleTime(item.schedule, date);
      if (!time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) continue;
      const [hour = 0, minute = 0] = time.split(':').map(Number);
      const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute);
      const endDate = new Date(startDate.getTime() + 15 * 60 * 1000);
      result.push({ key: `${item.id}:${day}`, itemId: item.id, name: item.name, startDate, endDate });
    }
  }
  return result;
}

export async function syncCalendarEvents(preview: CalendarPreviewEntry[]) {
  const Calendar = await calendarApi();
  const connection = await readCalendarConnection();
  if (!connection) throw new Error('Connect a calendar first.');
  const permission = await Calendar.getCalendarPermissionsAsync();
  if (!permission.granted) throw new Error('Calendar permission was revoked. Reconnect it from Settings.');

  const writableCalendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  if (!writableCalendars.some((calendar) => calendar.id === connection.calendarId && calendar.allowsModifications)) {
    throw new Error('The selected calendar is no longer writable. Check your calendar account and permissions before syncing.');
  }
  const previewKeys = new Set<string>();
  for (const entry of preview) {
    if (previewKeys.has(entry.key)) throw new Error('Duplicate scheduled event detected; no calendar changes were made.');
    previewKeys.add(entry.key);
    if (!Number.isFinite(entry.startDate.getTime()) || !Number.isFinite(entry.endDate.getTime()) || entry.endDate <= entry.startDate) {
      throw new Error('Invalid scheduled time; no calendar changes were made.');
    }
  }

  // Each mapping is stored immediately after successful creation to make retries idempotent.
  const wanted = new Set(preview.map((event) => event.key));
  let added = 0;
  let updated = 0;
  let removed = 0;
  for (const event of preview) {
    const title = connection.includeNames ? `Pulse · ${event.name}` : 'Pulse · Scheduled check-in';
    const details = { title, startDate: event.startDate, endDate: event.endDate, notes: 'Scheduled in Science By Hugs Pulse.' };
    const existingId = connection.events[event.key];
    if (existingId) {
      // Never create another event when a known ID fails to update; that would risk duplicates.
      await Calendar.updateEventAsync(existingId, details);
      updated += 1;
    } else {
      const id = await Calendar.createEventAsync(connection.calendarId, details);
      connection.events[event.key] = id;
      await persist(connection);
      added += 1;
    }
  }
  for (const [key, id] of Object.entries(connection.events)) {
    if (wanted.has(key)) continue;
    await Calendar.deleteEventAsync(id);
    delete connection.events[key];
    await persist(connection);
    removed += 1;
  }
  return { added, updated, removed };
}

export async function disconnectCalendar(removeEvents: boolean) {
  const connection = await readCalendarConnection();
  if (!connection) return 0;
  const count = Object.keys(connection.events).length;
  if (removeEvents && count) {
    const Calendar = await calendarApi();
    const permission = await Calendar.getCalendarPermissionsAsync();
    if (!permission.granted) throw new Error('Calendar access is required to remove synchronized events.');
    for (const [key, id] of Object.entries(connection.events)) {
      await Calendar.deleteEventAsync(id);
      delete connection.events[key];
      await persist(connection);
    }
  }
  await persist(null);
  return count;
}
