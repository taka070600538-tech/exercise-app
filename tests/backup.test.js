import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBackupPayload, validateBackupData } from '../js/backup.js';

test('buildBackupPayload: version/exportedAt/recordsを持つ', () => {
  const now = new Date('2026-08-10T09:00:00');
  const records = [{ date: '2026-08-10', memo: 'a' }];
  assert.deepEqual(buildBackupPayload(records, now), {
    version: 1, exportedAt: now.toISOString(), records,
  });
});

test('validateBackupData: 正常データはそのまま返す', () => {
  const data = { version: 1, exportedAt: 'x', records: [] };
  assert.equal(validateBackupData(data), data);
});

test('validateBackupData: version違い・records欠落はthrow', () => {
  assert.throws(() => validateBackupData(null));
  assert.throws(() => validateBackupData({ version: 2, records: [] }));
  assert.throws(() => validateBackupData({ version: 1, records: 'x' }));
});
