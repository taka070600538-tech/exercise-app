import { pushupTotal } from './record.js';
import { shiftDate, formatDate } from './dateUtils.js';
import { getAllRecords } from './db.js';

export const PERIOD_OPTIONS = [7, 14, 30, 90];
export const DEFAULT_PERIOD = 30;
const STORAGE_KEY = 'exercise-app:analysis-period';

function round1(x) {
  return Math.round(x * 10) / 10;
}

export function computeAnalysis(records, today, days) {
  const start = shiftDate(today, -(days - 1));
  const inRange = records.filter((r) => r.date >= start && r.date <= today);

  let joggingActiveDays = 0;
  let totalKm = 0;
  let strengthActiveDays = 0;
  let totalPushups = 0;

  for (const r of inRange) {
    const distanceKm = r.jogging?.distanceKm;
    if (distanceKm !== null && distanceKm !== undefined) {
      joggingActiveDays += 1;
      totalKm += distanceKm;
    }
    const pushups = r.strength?.pushups;
    if (Array.isArray(pushups) && pushups.some((v) => v !== null && v !== undefined)) {
      strengthActiveDays += 1;
      totalPushups += pushupTotal(pushups);
    }
  }

  return {
    days,
    jogging: {
      activeDays: joggingActiveDays,
      totalKm: round1(totalKm),
      frequency: joggingActiveDays / days,
      intensity: joggingActiveDays === 0 ? null : round1(totalKm / joggingActiveDays),
    },
    strength: {
      activeDays: strengthActiveDays,
      totalPushups,
      frequency: strengthActiveDays / days,
      intensity: strengthActiveDays === 0 ? null : round1(totalPushups / strengthActiveDays),
    },
  };
}

function frequencyText(activeDays, days, frequency) {
  const pct = Math.round(frequency * 100);
  return `${activeDays}日 / ${days}日 (${pct}%)`;
}

export function formatAnalysis(result) {
  const { days, jogging, strength } = result;
  return {
    jogging: {
      frequencyText: frequencyText(jogging.activeDays, days, jogging.frequency),
      intensityText: jogging.activeDays === 0 ? '—' : `${jogging.intensity} km/日`,
      totalText: `合計 ${jogging.totalKm} km`,
    },
    strength: {
      frequencyText: frequencyText(strength.activeDays, days, strength.frequency),
      intensityText: strength.activeDays === 0 ? '—' : `${strength.intensity} 回/日`,
      totalText: `合計 ${strength.totalPushups} 回`,
    },
  };
}

export function loadPeriod() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = Number(raw);
    return PERIOD_OPTIONS.includes(n) ? n : DEFAULT_PERIOD;
  } catch {
    return DEFAULT_PERIOD;
  }
}

export function savePeriod(days) {
  try {
    localStorage.setItem(STORAGE_KEY, String(days));
  } catch {
    // 保存できない環境(プライベートブラウジング等)では黙って無視する
  }
}

function statCard(className, title, unitNote, days, activeDays, frequency, intensity, unit, totalText) {
  const pct = Math.round(frequency * 100);
  const intensityCell = intensity === null
    ? '<dd><strong>—</strong></dd>'
    : `<dd><strong>${intensity}</strong>${unit}</dd>`;
  return `
    <section class="card ${className} analysis-card">
      <h2>${title}<span class="unit-note">${unitNote}</span></h2>
      <dl class="stat-grid">
        <div><dt>日数</dt><dd><strong>${activeDays}</strong>日</dd></div>
        <div><dt>頻度</dt><dd><strong>${pct}</strong>%</dd></div>
        <div><dt>強度</dt>${intensityCell}</div>
      </dl>
      <p class="analysis-foot">${activeDays}日 / ${days}日 ・ ${totalText}</p>
    </section>`;
}

export async function renderAnalysis(container, db, days) {
  let records;
  try {
    records = await getAllRecords(db);
  } catch {
    container.innerHTML = '<p class="analysis-empty">記録を読み込めませんでした。</p>';
    return;
  }
  const result = computeAnalysis(records, formatDate(new Date()), days);
  const fmt = formatAnalysis(result);
  container.innerHTML =
    statCard(
      'card-jogging', 'ジョギング', 'kmの記入がある日',
      days, result.jogging.activeDays, result.jogging.frequency, result.jogging.intensity, 'km/日',
      fmt.jogging.totalText,
    ) +
    statCard(
      'card-strength', '筋トレ', '腕立ての記入がある日',
      days, result.strength.activeDays, result.strength.frequency, result.strength.intensity, '回/日',
      fmt.strength.totalText,
    );
}
