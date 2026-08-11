import { pushupTotal, toNumberOrNull } from './record.js';

const NUMBER_IDS = ['situps', 'backExtensions', 'squats', 'gripReps',
  'pushups1', 'pushups2', 'pushups3', 'distanceKm', 'durationMin', 'leftKg', 'rightKg'];

export function readFormValues() {
  const values = {};
  for (const id of NUMBER_IDS) values[id] = document.getElementById(id).value;
  values.memo = document.getElementById('memo').value;
  return values;
}

function setValue(id, v) {
  document.getElementById(id).value = v ?? '';
}

export function updatePushupTotalDisplay() {
  const sets = ['pushups1', 'pushups2', 'pushups3']
    .map((id) => toNumberOrNull(document.getElementById(id).value));
  document.getElementById('pushup-total').textContent = String(pushupTotal(sets));
}

export function fillForm(record) {
  const s = record.strength;
  setValue('situps', s.situps);
  setValue('backExtensions', s.backExtensions);
  setValue('squats', s.squats);
  setValue('gripReps', s.gripReps);
  setValue('pushups1', s.pushups[0]);
  setValue('pushups2', s.pushups[1]);
  setValue('pushups3', s.pushups[2]);
  setValue('distanceKm', record.jogging.distanceKm);
  setValue('durationMin', record.jogging.durationMin);
  setValue('leftKg', record.gripStrength.leftKg);
  setValue('rightKg', record.gripStrength.rightKg);
  setValue('memo', record.memo);
  updatePushupTotalDisplay();
}

// フォーム全体のinput/changeを400msデバウンスしてonChangeを呼ぶ。
export function bindFormChange(onChange) {
  let timer = null;
  const handler = () => {
    updatePushupTotalDisplay();
    clearTimeout(timer);
    timer = setTimeout(onChange, 400);
  };
  const form = document.getElementById('record-form');
  form.addEventListener('input', handler);
  form.addEventListener('change', handler);
}
