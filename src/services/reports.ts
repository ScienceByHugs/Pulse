import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { encode, decode } from 'base64-arraybuffer';
import { randomUUID } from 'expo-crypto';
import { supabase } from '@/lib/supabase';
import { buildReportPDF, type ReportOptions } from '@/domain/report';
import { listCheckIns } from './checkins';
import type { TimelineEntry } from './pulse';
export async function shareTrackingReport(options: ReportOptions) {
  if (!options.includeLogs && !options.includeCheckIns)
    throw new Error('Choose logs or check-ins to include.');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(options.start) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(options.end) ||
    options.end < options.start
  )
    throw new Error('Choose a valid date range.');
  const {
    data: { session: owner },
  } = await supabase.auth.getSession();
  if (!owner?.user.email_confirmed_at)
    throw new Error('Sign in to create a report.');
  const ownerId = owner.user.id;
  const logs: TimelineEntry[] = [];
  if (options.includeLogs)
    for (let from = 0; ; from += 500) {
      // Query by record day as well as timestamp to include travel/backdated entries correctly.
      const { data, error } = await supabase
        .from('dose_logs')
        .select(
          'id,protocol_item_id,amount,unit,route,site,status,logged_at,notes,revision,local_date,time_zone,occurrence_key,snapshot,protocol_items(name)',
        )
        .eq('user_id', ownerId)
        .neq('status', 'voided')
        .or(
          `and(local_date.gte.${options.start},local_date.lte.${options.end}),and(local_date.is.null,logged_at.gte.${new Date(options.start + 'T00:00:00').toISOString()},logged_at.lt.${new Date(new Date(options.end + 'T00:00:00').setDate(new Date(options.end + 'T00:00:00').getDate() + 1)).toISOString()})`,
        )
        .order('logged_at', { ascending: true })
        .order('id')
        .range(from, from + 499);
      if (error) throw error;
      logs.push(...(data as unknown as TimelineEntry[]));
      if (data.length < 500) break;
      if (logs.length >= 2000)
        throw new Error(
          'This report is too large. Choose a shorter range with fewer than 2,000 logs.',
        );
    }
  const checks = options.includeCheckIns
    ? await listCheckIns(options.start, options.end, ownerId)
    : [];
  const asset = Asset.fromModule(
    require('../../assets/fonts/NotoSans-Regular.ttf'),
  );
  await asset.downloadAsync();
  let fontBytes: Uint8Array;
  if (Platform.OS === 'web')
    fontBytes = new Uint8Array(await (await fetch(asset.uri)).arrayBuffer());
  else
    fontBytes = new Uint8Array(
      decode(
        await FileSystem.readAsStringAsync(asset.localUri ?? asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        }),
      ),
    );
  const boldAsset = Asset.fromModule(
    require('../../assets/fonts/NotoSans-Bold.ttf'),
  );
  await boldAsset.downloadAsync();
  const boldBytes =
    Platform.OS === 'web'
      ? new Uint8Array(await (await fetch(boldAsset.uri)).arrayBuffer())
      : new Uint8Array(
          decode(
            await FileSystem.readAsStringAsync(
              boldAsset.localUri ?? boldAsset.uri,
              { encoding: FileSystem.EncodingType.Base64 },
            ),
          ),
        );
  const bytes = await buildReportPDF(
    logs,
    checks,
    options,
    fontBytes,
    boldBytes,
  );
  const {
    data: { session: current },
  } = await supabase.auth.getSession();
  if (current?.user.id !== ownerId)
    throw new Error('Your account changed. Create the report again.');
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(
      new Blob([bytes as BlobPart], { type: 'application/pdf' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `Pulse-${options.start}-${options.end}.pdf`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return;
  }
  if (!(await Sharing.isAvailableAsync()))
    throw new Error('Sharing is unavailable on this device.');
  const path = FileSystem.cacheDirectory + `pulse-report-${randomUUID()}.pdf`;
  await FileSystem.writeAsStringAsync(
    path,
    encode(bytes.buffer as ArrayBuffer),
    { encoding: FileSystem.EncodingType.Base64 },
  );
  try {
    await Sharing.shareAsync(path, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: 'Share your Pulse report',
    });
  } finally {
    await FileSystem.deleteAsync(path, { idempotent: true });
  }
}
