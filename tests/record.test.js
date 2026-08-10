import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyRecord, buildRecord, toNumberOrNull, pushupTotal, isEmptyRecord, copyRecordTo } from '../js/record.js';

test('toNumberOrNull: 空・負数・非数はnull、数値文字列は数値', () => {
  assert.equal(toNumberOrNull(''), null);
  assert.equal(toNumberOrNull('abc'), null);
  assert.equal(toNumberOrNull('-1'), null);
  assert.equal(toNumberOrNull('12'), 12);
  assert.equal(toNumberOrNull('3.5'), 3.5);
});

test('buildRecord: フォーム値からレコードを正規化する', () => {
  const now = new Date('2026-08-10T09:00:00');
  const r = buildRecord('2026-08-10', {
    situps: '30', backExtensions: '', squats: '20', gripReps: '50',
    pushups1: '10', pushups2: '12', pushups3: '',
    startTime: '06:30', weather: '晴れ', distanceKm: '3.2', durationMin: '25',
    leftKg: '42.5', rightKg: '45', memo: '調子よし',
  }, now);
  assert.equal(r.date, '2026-08-10');
  assert.deepEqual(r.strength, {
    situps: 30, backExtensions: null, squats: 20, gripReps: 50,
    pushups: [10, 12, null],
  });
  assert.deepEqual(r.jogging, { startTime: '06:30', weather: '晴れ', distanceKm: 3.2, durationMin: 25 });
  assert.deepEqual(r.gripStrength, { leftKg: 42.5, rightKg: 45 });
  assert.equal(r.memo, '調子よし');
  assert.equal(r.updatedAt, now.toISOString());
});

test('buildRecord: 不正な天気はnullにする', () => {
  const r = buildRecord('2026-08-10', { weather: '台風' });
  assert.equal(r.jogging.weather, null);
});

test('pushupTotal: nullは0として合計する', () => {
  assert.equal(pushupTotal([10, 12, null]), 22);
  assert.equal(pushupTotal([null, null, null]), 0);
});

test('isEmptyRecord: 全項目未入力のときだけtrue', () => {
  assert.ok(isEmptyRecord(emptyRecord('2026-08-10')));
  assert.ok(!isEmptyRecord(buildRecord('2026-08-10', { situps: '1' })));
  assert.ok(!isEmptyRecord(buildRecord('2026-08-10', { memo: 'メモだけ' })));
});

test('copyRecordTo: 内容を引き継ぎdate/updatedAtは新しくする', () => {
  const src = buildRecord('2026-08-09', { situps: '30' }, new Date('2026-08-09T08:00:00'));
  const now = new Date('2026-08-10T07:00:00');
  const copied = copyRecordTo(src, '2026-08-10', now);
  assert.equal(copied.date, '2026-08-10');
  assert.equal(copied.strength.situps, 30);
  assert.equal(copied.updatedAt, now.toISOString());
  copied.strength.situps = 99; // ディープコピーであること
  assert.equal(src.strength.situps, 30);
});
