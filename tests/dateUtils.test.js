import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDate, shiftDate } from '../js/dateUtils.js';

test('formatDate: ローカル日付をYYYY-MM-DDにする', () => {
  assert.equal(formatDate(new Date(2026, 7, 10)), '2026-08-10');
  assert.equal(formatDate(new Date(2026, 0, 5)), '2026-01-05');
});

test('shiftDate: 日数を加減算し月跨ぎも正しい', () => {
  assert.equal(shiftDate('2026-08-10', 1), '2026-08-11');
  assert.equal(shiftDate('2026-08-01', -1), '2026-07-31');
  assert.equal(shiftDate('2026-12-31', 1), '2027-01-01');
});
