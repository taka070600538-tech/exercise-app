# タブ化・時系列表・日記転記 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 運動管理アプリを3タブ構成(記録/時系列/設定)にし、時系列テーブルを追加、コピー機能を削除、PC側で日記への自動転記を行う。

**Architecture:** アプリ側はカロリー計算アプリと同じ`.view`+下部ナビ方式でタブ切替。時系列は純関数`buildTimelineRows`で行データ化してテーブル描画。PC側はNode製`tools/transcribe-diary.mjs`がbackup.jsonから日記ファイルへマーカー囲みセクションを冪等に書き込み、既存のAppDataGitPullタスクのps1から呼ぶ。

**Tech Stack:** vanilla JS(ESModules)、IndexedDB、node:test、PowerShell(タスクスケジューラ)

## Global Constraints

- マーカーは `<!-- exercise-app:start -->` / `<!-- exercise-app:end -->`
- 日記フォルダ: `D:\Obsidian Vault for Claude Code\01_日記`、ファイル名はゼロ埋め `YYYY-MM-DD.md`
- backup.json: `D:\Obsidian Vault for Claude Code\Git\app-data\exercise-app\backup.json`
- 未入力セル・未入力項目は表示しない/「—」
- manifestに `"scope": "./"`, `"id": "./"` を追加
- コミット末尾: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: 時系列の行データ純ロジック

**Files:**
- Create: `js/timeline.js`, `tests/timeline.test.js`

**Interfaces:**
- Consumes: `pushupTotal(pushups)` (js/record.js)
- Produces: `buildTimelineRows(records): Row[]`(日付降順)、`Row = { date, situps, backExtensions, squats, gripReps, pushupTotal, distanceKm, durationMin, weather, leftKg, rightKg, memo }`(全てstring、未入力は'—')。`renderTimeline(container, db)`(Task 2で使用)

- [ ] **Step 1: 失敗するテスト** — `tests/timeline.test.js`

```js
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
```

- [ ] **Step 2: 失敗確認**(`node --test` → ERR_MODULE_NOT_FOUND)
- [ ] **Step 3: `js/timeline.js` 実装**

```js
import { pushupTotal } from './record.js';
import { getAllRecords } from './db.js';

function cell(v) {
  return v === null || v === undefined || v === '' ? '—' : String(v);
}

export function buildTimelineRows(records) {
  return [...records]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((r) => ({
      date: r.date,
      situps: cell(r.strength.situps),
      backExtensions: cell(r.strength.backExtensions),
      squats: cell(r.strength.squats),
      gripReps: cell(r.strength.gripReps),
      pushupTotal: r.strength.pushups.every((v) => v === null) ? '—' : String(pushupTotal(r.strength.pushups)),
      distanceKm: cell(r.jogging.distanceKm),
      durationMin: cell(r.jogging.durationMin),
      weather: cell(r.jogging.weather),
      leftKg: cell(r.gripStrength.leftKg),
      rightKg: cell(r.gripStrength.rightKg),
      memo: r.memo ? (r.memo.length > 12 ? r.memo.slice(0, 12) + '…' : r.memo) : '—',
    }));
}

const HEADERS = ['日付', '腹筋', '背筋', 'スクワット', 'グリップ', '腕立て計',
  'km', '分', '天気', '左kg', '右kg', 'メモ'];
const KEYS = ['date', 'situps', 'backExtensions', 'squats', 'gripReps', 'pushupTotal',
  'distanceKm', 'durationMin', 'weather', 'leftKg', 'rightKg', 'memo'];

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export async function renderTimeline(container, db) {
  let records;
  try {
    records = await getAllRecords(db);
  } catch {
    container.innerHTML = '<p class="timeline-empty">記録を読み込めませんでした。</p>';
    return;
  }
  if (records.length === 0) {
    container.innerHTML = '<p class="timeline-empty">まだ記録がありません。</p>';
    return;
  }
  const rows = buildTimelineRows(records);
  container.innerHTML = `
    <div class="timeline-scroll">
      <table class="timeline-table">
        <thead><tr>${HEADERS.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((row) =>
          `<tr>${KEYS.map((k) => `<td>${escapeHtml(row[k])}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}
```

- [ ] **Step 4: テスト通過を確認してコミット**(`feat: 時系列の行データロジックを追加`)

---

### Task 2: タブUIへの再構成(コピー削除・manifest修正込み)

**Files:**
- Modify: `index.html`, `style.css`, `js/app.js`, `js/record.js`(copyRecordTo削除), `manifest.json`
- Modify: `tests/record.test.js`(copyRecordToテスト削除)

**Interfaces:**
- Consumes: `renderTimeline(container, db)` (Task 1)

- [ ] **Step 1: `index.html` を3タブ構成に変更**
  - ヘッダー内の日付ナビと保存状態はそのまま(記録タブ以外では`hidden`クラスで隠す)
  - `copy-section`(別の日からコピー)を丸ごと削除
  - `<form id="record-form">`を`<section class="view" id="view-record">`で包む
  - 設定カードを`<section class="view hidden" id="view-settings">`へ移動
  - `<section class="view hidden" id="view-timeline"><div id="timeline-container"></div></section>`を追加
  - `<main>`の後に下部ナビ:

```html
<nav class="bottom-nav">
  <button class="nav-btn is-active" data-view="record" type="button">記録</button>
  <button class="nav-btn" data-view="timeline" type="button">時系列</button>
  <button class="nav-btn" data-view="settings" type="button">設定</button>
</nav>
```

- [ ] **Step 2: `js/app.js` を変更**
  - `bindCopyFromDate`と関連import(`copyRecordTo`)を削除
  - タブ切替を追加:

```js
import { renderTimeline } from './timeline.js';

function switchView(viewName) {
  for (const view of document.querySelectorAll('.view')) {
    view.classList.toggle('hidden', view.id !== `view-${viewName}`);
  }
  for (const btn of document.querySelectorAll('.nav-btn')) {
    btn.classList.toggle('is-active', btn.dataset.view === viewName);
  }
  const inRecord = viewName === 'record';
  document.querySelector('.date-nav').classList.toggle('hidden', !inRecord);
  document.getElementById('save-status').classList.toggle('hidden', !inRecord);
}

function bindNav() {
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      switchView(view);
      if (view === 'timeline') renderTimeline(document.getElementById('timeline-container'), state.db);
    });
  });
}
```

  - `init()`で`bindCopyFromDate()`の代わりに`bindNav()`を呼ぶ
- [ ] **Step 3: `js/record.js`から`copyRecordTo`を削除し、`tests/record.test.js`の該当テストとimportも削除**
- [ ] **Step 4: `style.css`に下部ナビとテーブルのスタイルを追加**(bodyに`padding-bottom`、`.bottom-nav`は`position: fixed; bottom: 0`の3等分、`.timeline-scroll { overflow-x: auto; }`、`.timeline-table`はコンパクトな`white-space: nowrap`表)
- [ ] **Step 5: `manifest.json`に`"scope": "./"`と`"id": "./"`を追加**
- [ ] **Step 6: `node --test`全通過確認、ローカルサーバーで3タブ切替・時系列表・コピー欄消滅をブラウザ確認**
- [ ] **Step 7: コミット**(`feat: 3タブ構成にし時系列表を追加、コピー機能を削除`)

---

### Task 3: 日記転記スクリプト

**Files:**
- Create: `tools/transcribe-diary.mjs`, `tests/transcribeDiary.test.js`

**Interfaces:**
- Produces: `formatRecordSection(record): string`(マーカーなし本文)、`upsertSection(content: string, section: string): string`(マーカー付きで置換/追記)。CLI: `node tools/transcribe-diary.mjs [backupPath] [diaryDir]`(省略時は本番パス)

- [ ] **Step 1: 失敗するテスト** — `tests/transcribeDiary.test.js`

```js
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
```

- [ ] **Step 2: 失敗確認**
- [ ] **Step 3: `tools/transcribe-diary.mjs` 実装**

```js
// app-dataのbackup.jsonから、01_日記の該当日ファイルへ運動記録セクションを転記する。
// AppDataGitPullタスク(app-sync/tools/app-data-pull.ps1)がpull後に実行する。
import fs from 'node:fs';
import path from 'node:path';

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

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main();
}
```

- [ ] **Step 4: テスト通過確認、一時フォルダで実データのdry run**(`node tools/transcribe-diary.mjs <本番backup.json> <scratchpadの一時フォルダ>`で出力内容を目視確認)
- [ ] **Step 5: コミット**(`feat: 日記転記スクリプトを追加`)

---

### Task 4: AppDataGitPullタスクの拡張

**Files:**
- Modify: `D:\Obsidian Vault for Claude Code\Git\app-sync\tools\app-data-pull.ps1`(pull成功後にnode実行)

- [ ] **Step 1: ps1にpull後の転記実行を追加**(tryブロック内、pullの後):

```powershell
$transcribe = node "D:\Obsidian Vault for Claude Code\Git\運動管理アプリ\tools\transcribe-diary.mjs" 2>&1 | Out-String
Add-Content -Path $log -Value "[$stamp] 日記転記: $($transcribe.Trim())" -Encoding UTF8
```

- [ ] **Step 2: BOM確認**: 日本語パスを含むため、編集後にBOM付きUTF-8であることをバイト先頭(EF BB BF)で確認。BOMが無ければ
  `$c = Get-Content -Raw -Encoding UTF8 $path; Set-Content -Path $path -Value $c -Encoding UTF8` で付与
- [ ] **Step 3: ps1を手動実行**して、pull-log.txtに転記結果が記録され、01_日記に運動記録セクションが書かれることを確認
- [ ] **Step 4: app-syncリポジトリでコミット・push**(`feat: pull後に運動記録の日記転記を実行`)

---

### Task 5: デプロイと確認

- [ ] **Step 1: exercise-appをpush**し、Pages反映(最大10分のHTTPキャッシュに注意。新しいタブ+`fetch(url, {cache:'reload'})`で確認)
- [ ] **Step 2: 公開URLで確認**: 3タブ切替、時系列表(既存レコード表示)、コピー欄が無いこと、設定タブのバックアップUI
- [ ] **Step 3: ユーザーへ案内**: PWA再インストール手順(ホーム画面から削除→公開URL→「アプリをインストール」)

---

## Self-Review結果

- スペック5要件(タブ化/時系列/コピー削除/日記転記/manifest)すべてタスク1〜5に対応
- 型整合: `renderTimeline(container, db)`はTask 1定義・Task 2使用で一致。`formatRecordSection`/`upsertSection`はテストと実装で一致
- プレースホルダーなし
