import { getAllRecords, replaceAllRecords } from './db.js';

export function buildBackupPayload(records, now = new Date()) {
  return { version: 1, exportedAt: now.toISOString(), records };
}

export function validateBackupData(data) {
  if (!data || data.version !== 1) throw new Error('バックアップデータの形式が不正です(version)');
  if (!Array.isArray(data.records)) throw new Error('バックアップデータの形式が不正です(records)');
  return data;
}

export async function collectBackup(db) {
  return buildBackupPayload(await getAllRecords(db));
}

export async function restoreBackup(db, data) {
  validateBackupData(data);
  await replaceAllRecords(db, data.records);
}
