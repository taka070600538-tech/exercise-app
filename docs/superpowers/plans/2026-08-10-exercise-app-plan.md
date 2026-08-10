# 運動管理アプリ(exercise-app)実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Google AI Studio製「運動管理アプリ」と同一機能の静的PWAを作り、GitHub Pagesで公開、app-sync基盤で1日1回GitHub自動バックアップする。

**Architecture:** ビルド不要の静的PWA(vanilla JS ESModules + IndexedDB)。日付キーの1日1レコードをフォームで編集し、入力の都度デバウンス自動保存。バックアップは共有モジュール `app-sync/v1/sync.js` の動的importで行う(カロリー計算アプリと同一パターン)。

**Tech Stack:** HTML/CSS/vanilla JS(ESModules)、IndexedDB、node:test、GitHub Pages、app-sync共通基盤

## Global Constraints

- リポジトリ名 `exercise-app`(公開)、ローカルは `D:\Obsidian Vault for Claude Code\Git\運動管理アプリ`
- appIdは `exercise-app`、バックアップ先は `app-data/exercise-app/backup.json`
- 共有モジュールURL: `https://taka070600538-tech.github.io/app-sync/v1/sync.js`(sw.jsでキャッシュ禁止)
- 全UI文言は日本語。数値入力は `min="0"`、未入力はnullとして扱う
- テストはnode:test。`node --test tests/` で全テストが通ること
- コミットメッセージ末尾に `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

## File Structure

| ファイル | 責務 |
|---|---|
| `js/dateUtils.js` | 日付文字列の整形・加減算(純関数) |
| `js/record.js` | 1日レコードの生成・正規化・空判定・コピー・腕立て合計(純関数) |
| `js/db.js` | IndexedDB(`records`ストア、keyPath: `date`)のCRUD |
| `js/backup.js` | バックアップペイロードの組み立て/検証/collect/restore |
| `js/form.js` | フォームDOMの読み書き・入力イベントのデバウンス |
| `js/app.js` | 起動・日付ナビ・自動保存・別の日からコピー・sync連携 |
| `index.html` / `style.css` | 1画面フォームUI |
| `manifest.json` / `sw.js` / `icons/` | PWAアセット |
| `tests/*.test.js` | 上記純ロジックとPWAアセット整合性のテスト |

---

### Task 1: プロジェクト土台 + dateUtils

**Files:**
- Create: `package.json`, `.gitignore`, `.claude/launch.json`, `js/dateUtils.js`, `tests/dateUtils.test.js`

**Interfaces:**
- Produces: `formatDate(date: Date): string`(ローカル日付の'YYYY-MM-DD')、`shiftDate(dateStr: string, delta: number): string`

- [ ] **Step 1: 土台ファイルを作成**

`package.json`:
```json
{
  "name": "exercise-app",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "毎日の筋トレ・ジョギング・握力を記録するPWA(app-syncでGitHub自動バックアップ)"
}
```

`.gitignore`:
```
node_modules/
```

`.claude/launch.json`:
```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "exercise-app",
      "runtimeExecutable": "python",
      "runtimeArgs": ["-m", "http.server", "8792"],
      "port": 8792
    }
  ]
}
```

- [ ] **Step 2: 失敗するテストを書く** — `tests/dateUtils.test.js`

```js
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
```

- [ ] **Step 3: `node --test tests/` で失敗を確認**(ERR_MODULE_NOT_FOUND)
- [ ] **Step 4: `js/dateUtils.js` を実装**

```js
export function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 'YYYY-MM-DD'をローカル日付として解釈して日数を加減算する。
export function shiftDate(dateStr, delta) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d + delta);
  return formatDate(date);
}
```

- [ ] **Step 5: テストが通るのを確認してコミット**(`feat: プロジェクト土台とdateUtilsを追加`)

---

### Task 2: record.js(1日レコードの純ロジック)

**Files:**
- Create: `js/record.js`, `tests/record.test.js`

**Interfaces:**
- Produces:
  - `WEATHER_OPTIONS: ['晴れ','曇り','雨','雪']`
  - `emptyRecord(date: string): Record`
  - `buildRecord(date: string, values: object, now?: Date): Record` — valuesはフォーム文字列の連想配列(キー: situps, backExtensions, squats, gripReps, pushups1..3, startTime, weather, distanceKm, durationMin, leftKg, rightKg, memo)
  - `toNumberOrNull(value: string): number|null`(空・負数・非数はnull)
  - `pushupTotal(pushups: (number|null)[]): number`
  - `isEmptyRecord(record: Record): boolean`(memoも含め全て未入力ならtrue)
  - `copyRecordTo(source: Record, targetDate: string, now?: Date): Record`(date/updatedAtは引き継がない)

- [ ] **Step 1: 失敗するテストを書く** — `tests/record.test.js`

```js
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
```

- [ ] **Step 2: 失敗を確認**
- [ ] **Step 3: `js/record.js` を実装**

```js
export const WEATHER_OPTIONS = ['晴れ', '曇り', '雨', '雪'];

export function emptyRecord(date) {
  return {
    date,
    strength: { situps: null, backExtensions: null, squats: null, gripReps: null, pushups: [null, null, null] },
    jogging: { startTime: null, weather: null, distanceKm: null, durationMin: null },
    gripStrength: { leftKg: null, rightKg: null },
    memo: '',
  };
}

export function toNumberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function buildRecord(date, values, now = new Date()) {
  return {
    date,
    strength: {
      situps: toNumberOrNull(values.situps),
      backExtensions: toNumberOrNull(values.backExtensions),
      squats: toNumberOrNull(values.squats),
      gripReps: toNumberOrNull(values.gripReps),
      pushups: [toNumberOrNull(values.pushups1), toNumberOrNull(values.pushups2), toNumberOrNull(values.pushups3)],
    },
    jogging: {
      startTime: values.startTime || null,
      weather: WEATHER_OPTIONS.includes(values.weather) ? values.weather : null,
      distanceKm: toNumberOrNull(values.distanceKm),
      durationMin: toNumberOrNull(values.durationMin),
    },
    gripStrength: { leftKg: toNumberOrNull(values.leftKg), rightKg: toNumberOrNull(values.rightKg) },
    memo: values.memo || '',
    updatedAt: now.toISOString(),
  };
}

export function pushupTotal(pushups) {
  return pushups.reduce((sum, v) => sum + (v ?? 0), 0);
}

export function isEmptyRecord(record) {
  const s = record.strength;
  const j = record.jogging;
  const g = record.gripStrength;
  const fields = [s.situps, s.backExtensions, s.squats, s.gripReps, ...s.pushups,
    j.startTime, j.weather, j.distanceKm, j.durationMin, g.leftKg, g.rightKg];
  return fields.every((v) => v === null) && record.memo === '';
}

export function copyRecordTo(source, targetDate, now = new Date()) {
  const { date: _date, updatedAt: _updatedAt, ...rest } = source;
  return { ...JSON.parse(JSON.stringify(rest)), date: targetDate, updatedAt: now.toISOString() };
}
```

- [ ] **Step 4: テストが通るのを確認してコミット**(`feat: 1日レコードの純ロジックを追加`)

---

### Task 3: backup.js(app-sync連携用のcollect/restore)

**Files:**
- Create: `js/backup.js`, `tests/backup.test.js`
- 依存: Task 4の`db.js`関数を使うが、純ロジック(payload組み立て/検証)はDB非依存でテストする

**Interfaces:**
- Consumes: `getAllRecords(db)`(Task 4)
- Produces:
  - `buildBackupPayload(records: Record[], now?: Date): {version: 1, exportedAt: string, records}`
  - `validateBackupData(data): data`(不正はthrow)
  - `collectBackup(db): Promise<payload>` / `restoreBackup(db, data): Promise<void>`

- [ ] **Step 1: 失敗するテストを書く** — `tests/backup.test.js`

```js
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
```

- [ ] **Step 2: 失敗を確認**
- [ ] **Step 3: `js/backup.js` を実装**

```js
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
```

- [ ] **Step 4: テストが通るのを確認してコミット**(`feat: バックアップのcollect/restoreを追加`)

---

### Task 4: db.js + UI組み立て(index.html / style.css / form.js / app.js)

**Files:**
- Create: `js/db.js`, `js/form.js`, `js/app.js`, `index.html`, `style.css`

**Interfaces:**
- Consumes: Task 1〜3の全関数
- Produces(db.js):
  - `openDB(): Promise<IDBDatabase>`(DB名 `exercise-app-db`、v1、ストア `records` keyPath `date`)
  - `getRecord(db, date): Promise<Record|undefined>`
  - `putRecord(db, record): Promise<void>` / `deleteRecord(db, date): Promise<void>`
  - `getAllRecords(db): Promise<Record[]>` / `replaceAllRecords(db, records): Promise<void>`
- Produces(form.js):
  - `readFormValues(): object`(record.jsのvaluesキーと同名のid属性から読む)
  - `fillForm(record): void`(null→空文字。腕立て合計表示も更新)
  - `bindFormChange(onChange): void`(input/changeを400msデバウンス。腕立て合計は即時更新)

**実装方針(UI):** frontend-designスキルを呼んでから着手する。参考アプリと同じ縦1カラム構成
(ヘッダー日付ナビ → 別の日からコピー → 筋トレ → ジョギング → 握力 → メモ → 設定)。
カロリー計算アプリとは別物とわかる、運動アプリらしい活力ある配色にする。

- [ ] **Step 1: `js/db.js` を実装**(IndexedDBはnodeでテストしない。ブラウザで動作確認)

```js
const DB_NAME = 'exercise-app-db';
const DB_VERSION = 1;

export function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('records')) {
        db.createObjectStore('records', { keyPath: 'date' });
      }
    };
    request.onblocked = () => reject(new Error('他のタブでアプリが開いています。すべて閉じてから再読み込みしてください。'));
    request.onsuccess = (event) => {
      const db = event.target.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = (event) => reject(event.target.error);
  });
}

function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function promisifyTx(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getRecord(db, date) {
  const tx = db.transaction('records', 'readonly');
  return promisifyRequest(tx.objectStore('records').get(date));
}

export async function putRecord(db, record) {
  const tx = db.transaction('records', 'readwrite');
  tx.objectStore('records').put(record);
  return promisifyTx(tx);
}

export async function deleteRecord(db, date) {
  const tx = db.transaction('records', 'readwrite');
  tx.objectStore('records').delete(date);
  return promisifyTx(tx);
}

export async function getAllRecords(db) {
  const tx = db.transaction('records', 'readonly');
  return promisifyRequest(tx.objectStore('records').getAll());
}

export async function replaceAllRecords(db, records) {
  const tx = db.transaction('records', 'readwrite');
  tx.objectStore('records').clear();
  for (const record of records) tx.objectStore('records').put(record);
  return promisifyTx(tx);
}
```

- [ ] **Step 2: `index.html` を実装**(フォームの入力idはrecord.jsのvaluesキーと同名)

主要構造(全文は実装時に完成させる。以下の要素id・構成は確定事項):

```html
<header>
  <h1>運動管理</h1>
  <div class="date-nav">
    <button id="prev-day">◀</button>
    <input type="date" id="current-date">
    <button id="next-day">▶</button>
  </div>
  <span id="save-status" role="status">—</span>
</header>
<main>
  <section id="copy-section">
    <button id="copy-toggle" type="button">別の日からコピー</button>
    <div id="copy-panel" class="hidden">
      <input type="date" id="copy-source-date">
      <button id="copy-run" type="button">コピー実行</button>
    </div>
  </section>
  <section><!-- 基本の筋力トレーニング(回数) -->
    <input type="number" id="situps" min="0">     <!-- 腹筋の回数 -->
    <input type="number" id="backExtensions" min="0"> <!-- 背筋の回数 -->
    <input type="number" id="squats" min="0">     <!-- スクワットの回数 -->
    <input type="number" id="gripReps" min="0">   <!-- ハンドグリップ 回 -->
    <!-- 腕立て伏せ: 合計(自動)表示 span#pushup-total と 1〜3回目 -->
    <input type="number" id="pushups1" min="0">
    <input type="number" id="pushups2" min="0">
    <input type="number" id="pushups3" min="0">
  </section>
  <section><!-- ジョギング -->
    <input type="time" id="startTime">
    <select id="weather">
      <option value="">— 未選択 —</option>
      <option value="晴れ">☀️ 晴れ</option>
      <option value="曇り">☁️ 曇り</option>
      <option value="雨">☔ 雨</option>
      <option value="雪">❄️ 雪</option>
    </select>
    <input type="number" id="distanceKm" min="0" step="0.1">
    <input type="number" id="durationMin" min="0">
  </section>
  <section><!-- ハンドグリップ(握力測定) -->
    <input type="number" id="leftKg" min="0" step="0.1">
    <input type="number" id="rightKg" min="0" step="0.1">
  </section>
  <section><textarea id="memo"></textarea></section>
  <section><!-- 設定 -->
    <div id="sync-settings"></div>
    <button id="copy-app-url" type="button">アプリのURLをコピー</button>
  </section>
</main>
<script type="module" src="js/app.js"></script>
```

- [ ] **Step 3: `js/form.js` を実装**

```js
import { pushupTotal, toNumberOrNull } from './record.js';

const NUMBER_IDS = ['situps', 'backExtensions', 'squats', 'gripReps',
  'pushups1', 'pushups2', 'pushups3', 'distanceKm', 'durationMin', 'leftKg', 'rightKg'];

export function readFormValues() {
  const values = {};
  for (const id of NUMBER_IDS) values[id] = document.getElementById(id).value;
  values.startTime = document.getElementById('startTime').value;
  values.weather = document.getElementById('weather').value;
  values.memo = document.getElementById('memo').value;
  return values;
}

function setValue(id, v) {
  document.getElementById(id).value = v ?? '';
}

export function updatePushupTotalDisplay() {
  const sets = ['pushups1', 'pushups2', 'pushups3']
    .map((id) => toNumberOrNull(document.getElementById(id).value));
  document.getElementById('pushup-total').textContent = String(pushupTotal(sets));
}

export function fillForm(record) {
  const s = record.strength;
  setValue('situps', s.situps); setValue('backExtensions', s.backExtensions);
  setValue('squats', s.squats); setValue('gripReps', s.gripReps);
  setValue('pushups1', s.pushups[0]); setValue('pushups2', s.pushups[1]); setValue('pushups3', s.pushups[2]);
  setValue('startTime', record.jogging.startTime);
  setValue('weather', record.jogging.weather);
  setValue('distanceKm', record.jogging.distanceKm); setValue('durationMin', record.jogging.durationMin);
  setValue('leftKg', record.gripStrength.leftKg); setValue('rightKg', record.gripStrength.rightKg);
  setValue('memo', record.memo);
  updatePushupTotalDisplay();
}

// フォーム全体のinput/changeを400msデバウンスしてonChangeを呼ぶ。
export function bindFormChange(onChange) {
  let timer = null;
  const handler = () => {
    updatePushupTotalDisplay();
    clearTimeout(timer);
    timer = setTimeout(onChange, 400);
  };
  document.getElementById('record-form').addEventListener('input', handler);
  document.getElementById('record-form').addEventListener('change', handler);
}
```

- [ ] **Step 4: `js/app.js` を実装**

```js
import { openDB, getRecord, putRecord, deleteRecord } from './db.js';
import { emptyRecord, buildRecord, isEmptyRecord, copyRecordTo } from './record.js';
import { readFormValues, fillForm, bindFormChange } from './form.js';
import { formatDate, shiftDate } from './dateUtils.js';
import { collectBackup, restoreBackup } from './backup.js';

const state = { db: null, date: formatDate(new Date()) };

function setStatus(text, isError = false) {
  const el = document.getElementById('save-status');
  el.textContent = text;
  el.classList.toggle('is-error', isError);
}

async function loadDate(date) {
  state.date = date;
  document.getElementById('current-date').value = date;
  const record = (await getRecord(state.db, date)) || emptyRecord(date);
  fillForm(record);
  setStatus('保存済み');
}

async function saveCurrentForm() {
  try {
    const record = buildRecord(state.date, readFormValues());
    if (isEmptyRecord(record)) {
      await deleteRecord(state.db, state.date);
    } else {
      await putRecord(state.db, record);
    }
    setStatus('保存済み');
  } catch (err) {
    console.error(err);
    setStatus('保存できませんでした', true);
  }
}

function bindDateNav() {
  document.getElementById('prev-day').addEventListener('click', () => loadDate(shiftDate(state.date, -1)));
  document.getElementById('next-day').addEventListener('click', () => loadDate(shiftDate(state.date, 1)));
  document.getElementById('current-date').addEventListener('change', (e) => {
    if (e.target.value) loadDate(e.target.value);
  });
}

function bindCopyFromDate() {
  document.getElementById('copy-toggle').addEventListener('click', () => {
    document.getElementById('copy-panel').classList.toggle('hidden');
  });
  document.getElementById('copy-run').addEventListener('click', async () => {
    const sourceDate = document.getElementById('copy-source-date').value;
    if (!sourceDate) { alert('コピー元の日付を選んでください。'); return; }
    const source = await getRecord(state.db, sourceDate);
    if (!source) { alert(`${sourceDate}の記録がありません。`); return; }
    const current = buildRecord(state.date, readFormValues());
    if (!isEmptyRecord(current) && !confirm(`${state.date}の入力内容を${sourceDate}の記録で上書きします。よろしいですか?`)) return;
    const copied = copyRecordTo(source, state.date);
    await putRecord(state.db, copied);
    fillForm(copied);
    setStatus('保存済み');
    document.getElementById('copy-panel').classList.add('hidden');
  });
}

function bindCopyAppUrl() {
  document.getElementById('copy-app-url').addEventListener('click', async () => {
    const url = 'https://taka070600538-tech.github.io/exercise-app/';
    try {
      await navigator.clipboard.writeText(url);
      alert('アプリのURLをコピーしました。');
    } catch {
      prompt('このURLをコピーしてください:', url);
    }
  });
}

function showStartupErrorBanner(message) {
  const banner = document.createElement('div');
  banner.className = 'startup-error-banner';
  banner.textContent = message;
  document.body.insertBefore(banner, document.body.firstChild);
}

async function init() {
  try {
    state.db = await openDB();
  } catch (err) {
    showStartupErrorBanner('データベースを利用できません。記録は保存されません。');
    return;
  }

  bindDateNav();
  bindCopyFromDate();
  bindCopyAppUrl();
  bindFormChange(saveCurrentForm);
  await loadDate(state.date);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // 共有モジュールは動的import。オフラインやapp-sync障害時は黙ってスキップ。
  import('https://taka070600538-tech.github.io/app-sync/v1/sync.js')
    .then((sync) => {
      sync.initDailyBackup({
        appId: 'exercise-app',
        collect: () => collectBackup(state.db),
        restore: (data) => restoreBackup(state.db, data),
      });
      sync.renderSyncSettings(document.getElementById('sync-settings'));
    })
    .catch(() => {});
}

init();
```

- [ ] **Step 5: frontend-designスキルを呼び、`style.css` を実装**(モバイル前提・大きめのタップ領域・カロリーアプリと差別化した配色)
- [ ] **Step 6: ローカルサーバー(launch.json)で起動し、Browserで動作確認**
  - 入力→リロードで値が残る(自動保存)
  - 日付切替で日別に値が分かれる
  - 別の日からコピーが動く(記録なし日への警告、上書き確認含む)
  - 全項目クリア→リロードでレコードが消えている(空レコードを保存しない)
- [ ] **Step 7: `node --test tests/` 全通過を確認してコミット**(`feat: 運動記録フォームUIと自動保存を実装`)

---

### Task 5: PWAアセット(manifest / sw.js / アイコン)

**Files:**
- Create: `manifest.json`, `sw.js`, `icons/icon.svg`, `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-maskable-512.png`, `tests/pwaAssets.test.js`
- Modify: `index.html`(manifest/テーマカラーのlink追加)

**Interfaces:**
- Consumes: なし(静的アセット)
- Produces: `sw.js` の `ASSETS` 配列(全静的ファイルを列挙。**sync.jsは含めない**)

- [ ] **Step 1: `manifest.json` を作成**

```json
{
  "name": "運動管理",
  "short_name": "運動管理",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#c2410c",
  "icons": [
    { "src": "icons/icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any" },
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

(theme_colorはstyle.cssのアクセント色に合わせて調整可)

- [ ] **Step 2: `sw.js` を作成**(カロリーアプリと同型。cache-first、`exercise-app-v1`)

```js
const CACHE_NAME = 'exercise-app-v1';
const ASSETS = [
  './', './index.html', './style.css', './manifest.json',
  './js/app.js', './js/db.js', './js/record.js', './js/form.js',
  './js/dateUtils.js', './js/backup.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
```

- [ ] **Step 3: `icons/icon.svg` を作成**(ダンベルまたはランニングをモチーフに、アクセント色背景。`width="512" height="512"`属性を必ず付ける)
- [ ] **Step 4: `tests/pwaAssets.test.js` を作成**(カロリーアプリの同テストを流用: manifest宣言3種PNG、ファイル実在、PNG実寸一致、ASSETS包含。加えて`sw.js`に`app-sync`のURLが含まれないことを検証)

```js
test('sw.js: 共有モジュールsync.jsをキャッシュしない', () => {
  assert.ok(!swSource.includes('app-sync'), 'sw.jsのASSETSにapp-syncを含めない');
});
```

- [ ] **Step 5: ローカルサーバーのBrowserでicon.svgをcanvasラスタライズし、PNG 3種を生成**
  (SVG文字列fetch→`width/height`注入→Image→canvas→`toDataURL`のbase64をNodeでファイル化。
  maskableは背景全面塗り+中央80%に図柄。PNGヘッダーの実寸を検証)
- [ ] **Step 6: `node --test tests/` 全通過を確認してコミット**(`feat: PWAアセットを追加`)

---

### Task 6: GitHub公開とエンドツーエンド確認

**Files:**
- Create: `README.md`
- リモート: GitHubリポジトリ `taka070600538-tech/exercise-app`(公開)

- [ ] **Step 1: `README.md` を作成**(アプリ概要、公開URL、データの流れ(IndexedDB→app-sync→app-data→PC)、開発方法)
- [ ] **Step 2: リポジトリ作成**: `gh auth status` を確認。使えれば `gh repo create exercise-app --public --source . --push`。使えなければユーザーにGitHub上での空リポジトリ作成を依頼し、`git remote add origin https://github.com/taka070600538-tech/exercise-app.git` → `git push -u origin main`(Git Credential Manager経由)
- [ ] **Step 3: GitHub Pagesを有効化**: `gh api -X POST repos/taka070600538-tech/exercise-app/pages -f "source[branch]=main" -f "source[path]=/"`(gh不可ならユーザーにSettings→Pages→main/rootを依頼)。初回デプロイ完了まで数十秒待つ
- [ ] **Step 4: 公開URL(https://taka070600538-tech.github.io/exercise-app/)をBrowserで開き確認**
  - 新しいタブで開く(HTTPキャッシュの罠対策)
  - 入力→自動保存→リロードで残る
  - 設定セクションに「トークン設定済み」表示(カロリーアプリで入力済みPATが同一オリジン共有で効いている)
  - 「今すぐ保存」→ `app-data` リポジトリに `exercise-app/backup.json` のコミットが増える
  - 「GitHubから復元」でデータが戻る
- [ ] **Step 5: PC側同期の確認**: `git -C "D:\Obsidian Vault for Claude Code\Git\app-data" pull` で `exercise-app/backup.json` が届く
- [ ] **Step 6: 最終コミット・push**(`docs: READMEを追加`)。ユーザーへ公開URLとスマホでの「ホーム画面に追加」手順を案内

---

## Self-Review結果

- スペック全要件(データモデル/1画面フォーム/自動保存/日付ナビ/別の日からコピー/app-sync連携/PWA化/テスト)にタスクが対応していることを確認
- 型整合: `values`キー(situps等)はform.jsのinput idと同名、`replaceAllRecords`はTask 3のbackup.jsとTask 4のdb.jsで一致
- プレースホルダーなし(index.htmlの全文とstyle.cssのみ実装時完成とし、要素id・構成・デザイン方針は本計画で確定済み)
