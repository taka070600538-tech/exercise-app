import test from 'node:test';
import assert from 'node:assert/strict';
import { formatRecordSection, upsertSection } from '../tools/transcribe-diary.mjs';

const record = {
  date: '2026-08-10',
  strength: { situps: 30, backExtensions: 20, squats: 20, gripReps: 50, pushups: [10, 12, 8] },
  jogging: { startTime: '06:30', weather: '晴れ', distanceKm: 3.2, durationMin: 25 },
  gripStrength: { leftKg: 42.5, rightKg: 45 },
  memo: '調子よし',
};

test('formatRecordSection: 全項目入りのセクションを生成する', () => {
  assert.equal(formatRecordSection(record), [
    '## 運動記録',
    '',
    '- 筋トレ: 腹筋30回 / 背筋20回 / スクワット20回 / グリップ50回 / 腕立て10+12+8=30回',
    '- ジョギング: 06:30出発 ☀️晴れ 3.2km 25分',
    '- 握力: 左42.5kg / 右45kg',
    '- メモ: 調子よし',
  ].join('\n'));
});

test('formatRecordSection: 未入力の項目・行は出さない', () => {
  const r = { ...record, strength: { situps: 30, backExtensions: null, squats: null, gripReps: null, pushups: [null, null, null] },
    jogging: { startTime: null, weather: null, distanceKm: null, durationMin: null },
    gripStrength: { leftKg: null, rightKg: null }, memo: '' };
  assert.equal(formatRecordSection(r), ['## 運動記録', '', '- 筋トレ: 腹筋30回'].join('\n'));
});

test('upsertSection: マーカーが無ければ末尾に追記する', () => {
  const out = upsertSection('日記本文\n', 'SEC');
  assert.ok(out.endsWith('<!-- exercise-app:start -->\nSEC\n<!-- exercise-app:end -->\n'));
  assert.ok(out.startsWith('日記本文'));
});

test('upsertSection: 既存マーカーの中身だけ置換する', () => {
  const before = '前文\n<!-- exercise-app:start -->\n古い\n<!-- exercise-app:end -->\n後文\n';
  const out = upsertSection(before, '新しい');
  assert.ok(out.includes('新しい'));
  assert.ok(!out.includes('古い'));
  assert.ok(out.includes('前文') && out.includes('後文'));
});

test('upsertSection: 空文字列(新規ファイル)はセクションのみになる', () => {
  const out = upsertSection('', 'SEC');
  assert.equal(out, '<!-- exercise-app:start -->\nSEC\n<!-- exercise-app:end -->\n');
});

test('upsertSection: CRLFの日記ではCRLFで書く', () => {
  const before = '前文\r\n';
  const out = upsertSection(before, 'A\nB');
  assert.ok(out.includes('<!-- exercise-app:start -->\r\nA\r\nB\r\n<!-- exercise-app:end -->\r\n'));
});
