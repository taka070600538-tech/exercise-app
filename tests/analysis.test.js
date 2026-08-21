import test from 'node:test';
import assert from 'node:assert/strict';
import { computeAnalysis, formatAnalysis, loadPeriod, DEFAULT_PERIOD } from '../js/analysis.js';
import { buildRecord } from '../js/record.js';

test('computeAnalysis: 期間境界(today含む直近days日)', () => {
  const today = '2026-08-21';
  const records = [
    buildRecord('2026-08-15', { distanceKm: '1' }), // 境界内(7日前を含む)
    buildRecord('2026-08-14', { distanceKm: '1' }), // 境界外
    buildRecord('2026-08-22', { distanceKm: '1' }), // 未来日は含まない
  ];
  const result = computeAnalysis(records, today, 7);
  assert.equal(result.jogging.activeDays, 1);
});

test('computeAnalysis: ジョギング日数はdistanceKmの記入で数え、durationMinだけの日は数えない', () => {
  const today = '2026-08-21';
  const records = [
    buildRecord('2026-08-20', { distanceKm: '2' }),
    buildRecord('2026-08-19', { durationMin: '30' }),
  ];
  const result = computeAnalysis(records, today, 7);
  assert.equal(result.jogging.activeDays, 1);
});

test('computeAnalysis: 筋トレ日数はpushupsのいずれか1セットでも記入があれば数え、situpsだけの日は数えない', () => {
  const today = '2026-08-21';
  const records = [
    buildRecord('2026-08-20', { pushups1: '10' }),
    buildRecord('2026-08-19', { situps: '20' }),
  ];
  const result = computeAnalysis(records, today, 7);
  assert.equal(result.strength.activeDays, 1);
});

test('computeAnalysis: frequency = activeDays/days, intensity = total/activeDays(小数1桁丸め)', () => {
  const today = '2026-08-21';
  const records = [
    buildRecord('2026-08-20', { distanceKm: '3' }),
    buildRecord('2026-08-19', { distanceKm: '4' }),
  ];
  const result = computeAnalysis(records, today, 10);
  assert.equal(result.jogging.activeDays, 2);
  assert.equal(result.jogging.frequency, 0.2);
  assert.equal(result.jogging.totalKm, 7);
  assert.equal(result.jogging.intensity, 3.5);
});

test('computeAnalysis: activeDaysが0のときintensityはnull', () => {
  const today = '2026-08-21';
  const result = computeAnalysis([], today, 7);
  assert.equal(result.jogging.activeDays, 0);
  assert.equal(result.jogging.intensity, null);
  assert.equal(result.strength.activeDays, 0);
  assert.equal(result.strength.intensity, null);
});

test('computeAnalysis: totalKmの小数誤差(0.1+0.2など)が丸められる', () => {
  const today = '2026-08-21';
  const records = [
    buildRecord('2026-08-20', { distanceKm: '0.1' }),
    buildRecord('2026-08-19', { distanceKm: '0.2' }),
  ];
  const result = computeAnalysis(records, today, 7);
  assert.equal(result.jogging.totalKm, 0.3);
});

test('computeAnalysis: jogging/strength.pushupsが欠けた古い形式のレコードでも例外にならない', () => {
  const today = '2026-08-21';
  const legacyRecord = { date: '2026-08-20', strength: { situps: 5 }, memo: '' };
  assert.doesNotThrow(() => computeAnalysis([legacyRecord], today, 7));
  const result = computeAnalysis([legacyRecord], today, 7);
  assert.equal(result.jogging.activeDays, 0);
  assert.equal(result.strength.activeDays, 0);
});

test('formatAnalysis: 各種文字列', () => {
  const today = '2026-08-21';
  const records = [
    buildRecord('2026-08-20', { distanceKm: '3' }),
    buildRecord('2026-08-19', { distanceKm: '4' }),
  ];
  const result = computeAnalysis(records, today, 30);
  const fmt = formatAnalysis(result);
  assert.equal(fmt.jogging.frequencyText, '2日 / 30日 (7%)');
  assert.equal(fmt.jogging.intensityText, '3.5 km/日');
  assert.equal(fmt.jogging.totalText, '合計 7 km');
});

test('formatAnalysis: activeDaysが0のとき intensityText は「—」', () => {
  const today = '2026-08-21';
  const result = computeAnalysis([], today, 30);
  const fmt = formatAnalysis(result);
  assert.equal(fmt.jogging.intensityText, '—');
  assert.equal(fmt.strength.intensityText, '—');
});

test('loadPeriod: localStorage未定義でDEFAULT_PERIODを返す', () => {
  assert.equal(loadPeriod(), DEFAULT_PERIOD);
});
