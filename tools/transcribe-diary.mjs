// app-dataのbackup.jsonから、01_日記の該当日ファイルへ運動記録セクションを転記する。
// AppDataGitPullタスク(app-sync/tools/app-data-pull.ps1)がpull後に実行する。
// 使い方: node tools/transcribe-diary.mjs [backupPath] [diaryDir]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const START = '<!-- exercise-app:start -->';
const END = '<!-- exercise-app:end -->';
const DEFAULT_BACKUP = String.raw`D:\Obsidian Vault for Claude Code\Git\app-data\exercise-app\backup.json`;
const DEFAULT_DIARY_DIR = String.raw`D:\Obsidian Vault for Claude Code\01_日記`;

const WEATHER_EMOJI = { '晴れ': '☀️', '曇り': '☁️', '雨': '☔', '雪': '❄️' };

export function formatRecordSection(record) {
  const lines = ['## 運動記録', ''];
  const s = record.strength;
  const strengthParts = [];
  if (s.situps !== null) strengthParts.push(`腹筋${s.situps}回`);
  if (s.backExtensions !== null) strengthParts.push(`背筋${s.backExtensions}回`);
  if (s.squats !== null) strengthParts.push(`スクワット${s.squats}回`);
  if (s.gripReps !== null) strengthParts.push(`グリップ${s.gripReps}回`);
  const sets = s.pushups.filter((v) => v !== null);
  if (sets.length > 0) {
    const total = sets.reduce((a, b) => a + b, 0);
    strengthParts.push(`腕立て${sets.join('+')}=${total}回`);
  }
  if (strengthParts.length > 0) lines.push(`- 筋トレ: ${strengthParts.join(' / ')}`);

  const j = record.jogging;
  const jogParts = [];
  if (j.startTime) jogParts.push(`${j.startTime}出発`);
  if (j.weather) jogParts.push(`${WEATHER_EMOJI[j.weather] ?? ''}${j.weather}`);
  if (j.distanceKm !== null) jogParts.push(`${j.distanceKm}km`);
  if (j.durationMin !== null) jogParts.push(`${j.durationMin}分`);
  if (jogParts.length > 0) lines.push(`- ジョギング: ${jogParts.join(' ')}`);

  const g = record.gripStrength;
  const gripParts = [];
  if (g.leftKg !== null) gripParts.push(`左${g.leftKg}kg`);
  if (g.rightKg !== null) gripParts.push(`右${g.rightKg}kg`);
  if (gripParts.length > 0) lines.push(`- 握力: ${gripParts.join(' / ')}`);

  if (record.memo) lines.push(`- メモ: ${record.memo}`);
  return lines.join('\n');
}

// contentの改行スタイルを保ちながら、マーカー区間を置換(無ければ末尾に追記)する。
// 日記本文の他の部分には一切触れない。
export function upsertSection(content, section) {
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const block = `${START}${eol}${section.replaceAll('\n', eol)}${eol}${END}${eol}`;
  const startIdx = content.indexOf(START);
  const endIdx = content.indexOf(END);
  if (startIdx !== -1 && endIdx !== -1) {
    return content.slice(0, startIdx) + block + content.slice(endIdx + END.length).replace(/^\r?\n/, '');
  }
  if (content === '') return block;
  const sep = content.endsWith(eol) ? eol : eol + eol;
  return content + sep + block;
}

function main() {
  const backupPath = process.argv[2] || DEFAULT_BACKUP;
  const diaryDir = process.argv[3] || DEFAULT_DIARY_DIR;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  } catch (err) {
    console.log(`SKIP: backup.jsonを読めません (${err.message})`);
    return;
  }
  if (!Array.isArray(data.records)) {
    console.log('SKIP: backup.jsonの形式が不正です');
    return;
  }
  let ok = 0;
  for (const record of data.records) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.date)) continue;
    try {
      const file = path.join(diaryDir, `${record.date}.md`);
      const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      fs.writeFileSync(file, upsertSection(existing, formatRecordSection(record)));
      ok++;
    } catch (err) {
      console.log(`ERROR: ${record.date} (${err.message})`);
    }
  }
  console.log(`OK: ${ok}件を転記しました`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
