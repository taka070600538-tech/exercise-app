export const WEATHER_OPTIONS = ['晴れ', '曇り', '雨', '雪'];

export function emptyRecord(date) {
  return {
    date,
    strength: { situps: null, backExtensions: null, squats: null, gripReps: null, pushups: [null, null, null] },
    jogging: { startTime: null, weather: null, distanceKm: null, durationMin: null },
    gripStrength: { leftKg: null, rightKg: null },
    memo: '',
  };
}

export function toNumberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function buildRecord(date, values, now = new Date()) {
  return {
    date,
    strength: {
      situps: toNumberOrNull(values.situps),
      backExtensions: toNumberOrNull(values.backExtensions),
      squats: toNumberOrNull(values.squats),
      gripReps: toNumberOrNull(values.gripReps),
      pushups: [toNumberOrNull(values.pushups1), toNumberOrNull(values.pushups2), toNumberOrNull(values.pushups3)],
    },
    jogging: {
      startTime: values.startTime || null,
      weather: WEATHER_OPTIONS.includes(values.weather) ? values.weather : null,
      distanceKm: toNumberOrNull(values.distanceKm),
      durationMin: toNumberOrNull(values.durationMin),
    },
    gripStrength: { leftKg: toNumberOrNull(values.leftKg), rightKg: toNumberOrNull(values.rightKg) },
    memo: values.memo || '',
    updatedAt: now.toISOString(),
  };
}

export function pushupTotal(pushups) {
  return pushups.reduce((sum, v) => sum + (v ?? 0), 0);
}

export function isEmptyRecord(record) {
  const s = record.strength;
  const j = record.jogging;
  const g = record.gripStrength;
  const fields = [s.situps, s.backExtensions, s.squats, s.gripReps, ...s.pushups,
    j.startTime, j.weather, j.distanceKm, j.durationMin, g.leftKg, g.rightKg];
  return fields.every((v) => v === null) && record.memo === '';
}
