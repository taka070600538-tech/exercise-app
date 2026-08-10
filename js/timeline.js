import { pushupTotal } from './record.js';
import { getAllRecords } from './db.js';

function cell(v) {
  return v === null || v === undefined || v === '' ? '—' : String(v);
}

export function buildTimelineRows(records) {
  return [...records]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((r) => ({
      date: r.date,
      situps: cell(r.strength.situps),
      backExtensions: cell(r.strength.backExtensions),
      squats: cell(r.strength.squats),
      gripReps: cell(r.strength.gripReps),
      pushupTotal: r.strength.pushups.every((v) => v === null) ? '—' : String(pushupTotal(r.strength.pushups)),
      distanceKm: cell(r.jogging.distanceKm),
      durationMin: cell(r.jogging.durationMin),
      weather: cell(r.jogging.weather),
      leftKg: cell(r.gripStrength.leftKg),
      rightKg: cell(r.gripStrength.rightKg),
      memo: r.memo ? (r.memo.length > 12 ? r.memo.slice(0, 12) + '…' : r.memo) : '—',
    }));
}

const HEADERS = ['日付', '腹筋', '背筋', 'スクワット', 'グリップ', '腕立て計',
  'km', '分', '天気', '左kg', '右kg', 'メモ'];
const KEYS = ['date', 'situps', 'backExtensions', 'squats', 'gripReps', 'pushupTotal',
  'distanceKm', 'durationMin', 'weather', 'leftKg', 'rightKg', 'memo'];

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
  const rows = buildTimelineRows(records);
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
