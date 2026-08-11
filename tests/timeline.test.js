import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTimelineRows } from '../js/timeline.js';
import { buildRecord } from '../js/record.js';

test('buildTimelineRows: 日付降順に並び、値は文字列化される', () => {
  const r1 = buildRecord('2026-08-09', { situps: '30', pushups1: '10', pushups2: '12' });
  const r2 = buildRecord('2026-08-10', { distanceKm: '3.2' });
  const rows = buildTimelineRows([r1, r2], '2026-08-10');
  assert.equal(rows[0].date, '2026-08-10');
  assert.equal(rows[1].date, '2026-08-09');
  assert.equal(rows[1].situps, '30');
  assert.equal(rows[1].pushupTotal, '22');
  assert.equal(rows[0].distanceKm, '3.2');
});

test('buildTimelineRows: 未入力は「—」', () => {
  const rows = buildTimelineRows([buildRecord('2026-08-10', { situps: '1' })], '2026-08-10');
  assert.equal(rows[0].backExtensions, '—');
  assert.equal(rows[0].pushupTotal, '—'); // 3セット全て未入力なら合計も「—」
  assert.equal(rows[0].memo, '—');
});

test('buildTimelineRows: メモは12文字で省略', () => {
  const rows = buildTimelineRows([buildRecord('2026-08-10', { memo: 'あいうえおかきくけこさしすせそ' })], '2026-08-10');
  assert.equal(rows[0].memo, 'あいうえおかきくけこさし…');
});

test('buildTimelineRows: 記録がない日は日付だけの空欄行として表示される', () => {
  const r1 = buildRecord('2026-08-08', { situps: '5' });
  const r2 = buildRecord('2026-08-10', { situps: '7' });
  const rows = buildTimelineRows([r1, r2], '2026-08-11');
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((r) => r.date), ['2026-08-11', '2026-08-10', '2026-08-09', '2026-08-08']);
  assert.equal(rows[0].situps, '');
  assert.equal(rows[0].pushupTotal, '');
  assert.equal(rows[2].situps, '');
  assert.equal(rows[2].pushupTotal, '');
  assert.equal(rows[1].situps, '7');
  assert.equal(rows[3].situps, '5');
});
