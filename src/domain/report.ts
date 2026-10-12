import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { entryName, recordDay } from './occurrences';
import type { TimelineEntry } from '@/services/pulse';
import type { CheckIn } from '@/services/checkins';
export type ReportOptions = {
  start: string;
  end: string;
  includeLogs: boolean;
  includeCheckIns: boolean;
  includeNotes: boolean;
  itemId?: string;
  protocolId?: string;
  status?: string;
  search?: string;
};
export function filterReportLogs(
  logs: TimelineEntry[],
  options: ReportOptions,
) {
  const search = (options.search ?? '').trim().toLowerCase();
  return logs.filter((log) => {
    const day = recordDay(log);
    return (
      day >= options.start &&
      day <= options.end &&
      ['completed', 'skipped', 'missed'].includes(log.status) &&
      (!options.itemId || log.protocol_item_id === options.itemId) &&
      (!options.protocolId ||
        log.snapshot?.protocolId === options.protocolId) &&
      (!options.status || log.status === options.status) &&
      (!search ||
        `${entryName(log)} ${log.snapshot?.protocolName ?? ''}`
          .toLowerCase()
          .includes(search))
    );
  });
}
export async function buildReportPDF(
  logs: TimelineEntry[],
  checkins: CheckIn[],
  options: ReportOptions,
  fontBytes?: Uint8Array,
  boldBytes?: Uint8Array,
) {
  const doc = await PDFDocument.create();
  doc.setTitle('Pulse tracking report');
  doc.setCreator('Pulse by Science By Hugs');
  doc.registerFontkit(fontkit);
  const font = fontBytes
    ? await doc.embedFont(fontBytes, { subset: true })
    : await doc.embedFont(StandardFonts.Helvetica);
  const bold = boldBytes
    ? await doc.embedFont(boldBytes, { subset: true })
    : fontBytes
      ? font
      : await doc.embedFont(StandardFonts.HelveticaBold);
  const supported = new Set(font.getCharacterSet());
  let replaced = false;
  const safe = (text: string) =>
    Array.from(text)
      .map((ch) => {
        if (ch === '\n' || ch === '\r') return ' ';
        if (!supported.has(ch.codePointAt(0)!)) {
          replaced = true;
          return '?';
        }
        return ch;
      })
      .join('');
  let page: PDFPage;
  let y = 0;
  const margin = 44,
    width = 524;
  function newPage() {
    page = doc.addPage([612, 792]);
    y = 726;
    page.drawText('pulse', {
      x: margin,
      y,
      font: bold,
      size: 26,
      color: rgb(0.03, 0.09, 0.16),
    });
    page.drawCircle({
      x: margin + bold.widthOfTextAtSize('pulse', 26) + 5,
      y: y + 2,
      size: 3,
      color: rgb(0.1, 0.6, 0.8),
    });
    y -= 27;
    page.drawText(
      `${options.start} to ${options.end}  |  Personal tracking report`,
      { x: margin, y, font: bold, size: 10, color: rgb(0.3, 0.36, 0.4) },
    );
    y -= 29;
  }
  function line(
    text: string,
    size = 10,
    color = rgb(0.12, 0.16, 0.2),
    useFont: PDFFont = font,
  ) {
    const clean = safe(text);
    let current = '';
    for (const word of clean.split(/\s+/)) {
      if (!word) continue;
      if (
        current &&
        useFont.widthOfTextAtSize(current + ' ' + word, size) > width
      ) {
        draw(current);
        current = '';
      }
      if (useFont.widthOfTextAtSize(word, size) > width) {
        for (const ch of word) {
          if (useFont.widthOfTextAtSize(current + ch, size) > width) {
            draw(current);
            current = '';
          }
          current += ch;
        }
      } else current += `${current ? ' ' : ''}${word}`;
    }
    if (current) draw(current);
    function draw(value: string) {
      if (y < 60) newPage();
      page.drawText(value, { x: margin, y, font: useFont, size, color });
      y -= size * 1.5;
    }
  }
  function heading(text: string) {
    if (y < 115) newPage();
    y -= 10;
    line(text, 14, rgb(0.03, 0.09, 0.16), bold);
    y -= 5;
  }
  newPage();
  const selected = filterReportLogs(logs, options);
  const selectedChecks = checkins.filter(
    (c) => c.local_date >= options.start && c.local_date <= options.end,
  );
  line('Created ' + new Date().toLocaleString());
  line(
    'Included: ' +
      [
        options.includeLogs ? 'logs' : null,
        options.includeCheckIns ? 'check-ins' : null,
        options.includeNotes ? 'notes' : null,
      ]
        .filter(Boolean)
        .join(', '),
  );
  line(
    'Personal observations and entered records. Trends do not establish cause and effect.',
  );
  if (options.includeLogs) {
    heading('Tracking history');
    line(
      `${selected.filter((l) => l.status === 'completed').length} completed | ${selected.filter((l) => l.status === 'skipped').length} skipped | ${selected.length} total entries`,
    );
    y -= 8;
    if (!selected.length) line('No matching logs in this date range.');
    for (const log of selected) {
      if (y < 110) newPage();
      line(`${recordDay(log)}  |  ${entryName(log)}`, 11);
      line(
        `${log.amount} ${log.unit}  |  ${log.status}  |  ${new Intl.DateTimeFormat(undefined, { timeZone: log.time_zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(log.logged_at))}${log.time_zone ? ' (' + log.time_zone + ')' : ''}`,
        9,
      );
      if (log.snapshot?.protocolName)
        line('Protocol: ' + String(log.snapshot.protocolName), 9);
      if (log.site) line('Site: ' + log.site, 9);
      if (options.includeNotes && log.notes) line('Note: ' + log.notes, 9);
      if (!log.snapshot || log.snapshot.historicalDetailsUnavailable)
        line(
          'Older entry: original schedule/name details were not recorded.',
          9,
          rgb(0.45, 0.35, 0.15),
        );
      y -= 9;
    }
  }
  if (options.includeCheckIns) {
    heading('Daily observations');
    if (!selectedChecks.length) line('No check-ins in this date range.');
    for (const check of selectedChecks) {
      line(check.local_date, 11);
      line(
        [
          check.sleep !== null ? `Sleep: ${check.sleep} hours` : null,
          check.energy !== null ? `Energy: ${check.energy}/5` : null,
          check.mood !== null ? `Mood: ${check.mood}/5` : null,
        ]
          .filter(Boolean)
          .join(' | ') || 'No ratings entered.',
        9,
      );
      if (options.includeNotes && check.notes) line('Note: ' + check.notes, 9);
      y -= 9;
    }
  }
  if (replaced) {
    heading('Character note');
    line(
      'Characters unavailable in the report font are represented by a question mark. Original text remains in Pulse.',
    );
  }
  const pages = doc.getPages();
  pages.forEach((p, index) => {
    p.drawLine({
      start: { x: 44, y: 42 },
      end: { x: 568, y: 42 },
      thickness: 0.5,
      color: rgb(0.8, 0.83, 0.85),
    });
    p.drawText(`Pulse by SBH  |  ${index + 1} / ${pages.length}`, {
      x: 44,
      y: 27,
      size: 8,
      font: bold,
      color: rgb(0.4, 0.45, 0.48),
    });
  });
  return doc.save();
}
