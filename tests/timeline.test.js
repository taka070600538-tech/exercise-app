import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTimelineRows } from '../js/timeline.js';
import { buildRecord } from '../js/record.js';

test('buildTimelineRows: 日付降順に並び、値は文字列化される', () => {
  const r1 = buildRecord('2026-08-09', { situps: '30', pushups1: '10', pushups2: '12' });
  const r2 = buildRecord('2026-08-10', { distanceKm: '3.2', weather: '晴れ' });
  const rows = buildTimelineRows([r1, r2]);
  assert.equal(rows[0].date, '2026-08-10');
  assert.equal(rows[1].date, '2026-08-09');
  assert.equal(rows[1].situps, '30');
  assert.equal(rows[1].pushupTotal, '22');
  assert.equal(rows[0].distanceKm, '3.2');
  assert.equal(rows[0].weather, '晴れ');
});

test('buildTimelineRows: 未入力は「—」', () => {
  const rows = buildTimelineRows([buildRecord('2026-08-10', { situps: '1' })]);
  assert.equal(rows[0].backExtensions, '—');
  assert.equal(rows[0].pushupTotal, '—'); // 3セット全て未入力なら合計も「—」
  assert.equal(rows[0].weather, '—');
  assert.equal(rows[0].memo, '—');
});

test('buildTimelineRows: メモは12文字で省略', () => {
  const rows = buildTimelineRows([buildRecord('2026-08-10', { memo: 'あいうえおかきくけこさしすせそ' })]);
  assert.equal(rows[0].memo, 'あいうえおかきくけこさし…');
});
