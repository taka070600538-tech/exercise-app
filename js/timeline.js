import { pushupTotal } from './record.js';
import { getAllRecords } from './db.js';
import { shiftDate, formatDate } from './dateUtils.js';

function cell(v) {
  return v === null || v === undefined || v === '' ? '—' : String(v);
}

function emptyRow(date) {
  return {
    date,
    situps: '',
    backExtensions: '',
    squats: '',
    gripReps: '',
    pushupTotal: '',
    distanceKm: '',
    durationMin: '',
    leftKg: '',
    rightKg: '',
    memo: '',
  };
}

export function buildTimelineRows(records, today) {
  const rowsByDate = new Map(
    records.map((r) => [r.date, {
      date: r.date,
      situps: cell(r.strength.situps),
      backExtensions: cell(r.strength.backExtensions),
      squats: cell(r.strength.squats),
      gripReps: cell(r.strength.gripReps),
      pushupTotal: r.strength.pushups.every((v) => v === null) ? '—' : String(pushupTotal(r.strength.pushups)),
      distanceKm: cell(r.jogging.distanceKm),
      durationMin: cell(r.jogging.durationMin),
      leftKg: cell(r.gripStrength.leftKg),
      rightKg: cell(r.gripStrength.rightKg),
      memo: r.memo ? (r.memo.length > 12 ? r.memo.slice(0, 12) + '…' : r.memo) : '—',
    }]),
  );

  if (records.length === 0) return [];

  const recordDates = records.map((r) => r.date);
  const oldest = recordDates.reduce((a, b) => (a < b ? a : b));
  const latest = recordDates.reduce((a, b) => (a > b ? a : b));
  const newest = latest > today ? latest : today;

  const rows = [];
  for (let d = newest; d >= oldest; d = shiftDate(d, -1)) {
    rows.push(rowsByDate.get(d) || emptyRow(d));
  }
  return rows;
}

const HEADERS = ['日付', '腹筋', '背筋', 'スクワット', 'グリップ', '腕立て計',
  'km', '分', '左kg', '右kg', 'メモ'];
const KEYS = ['date', 'situps', 'backExtensions', 'squats', 'gripReps', 'pushupTotal',
  'distanceKm', 'durationMin', 'leftKg', 'rightKg', 'memo'];

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export async function renderTimeline(container, db) {
  let records;
  try {
    records = await getAllRecords(db);
  } catch {
    container.innerHTML = '<p class="timeline-empty">記録を読み込めませんでした。</p>';
    return;
  }
  if (records.length === 0) {
    container.innerHTML = '<p class="timeline-empty">まだ記録がありません。</p>';
    return;
  }
  const rows = buildTimelineRows(records, formatDate(new Date()));
  container.innerHTML = `
    <div class="timeline-scroll">
      <table class="timeline-table">
        <thead><tr>${HEADERS.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((row) =>
          `<tr>${KEYS.map((k) => `<td>${escapeHtml(row[k])}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}
