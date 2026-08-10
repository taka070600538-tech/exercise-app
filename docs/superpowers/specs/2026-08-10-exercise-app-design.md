# 運動管理アプリ(exercise-app)設計書

日付: 2026-08-10
ステータス: 承認済み

## 目的

Google AI Studioで作成した「運動管理アプリ」
(https://ais-pre-y56twfazjs25vv46ne4lmt-571554677949.asia-northeast1.run.app)
と同一機能のPWAを自前で作り、GitHub Pagesで公開してスマホのホーム画面から使えるようにする。
記録データは既存の共通基盤(app-sync / app-data)で1日1回GitHubに自動バックアップし、
PC側にも自動同期する。

## 決定事項(ユーザー確認済み)

- **データ保存**: 端末のIndexedDBに保存し、既存のapp-sync基盤でGitHub自動保存+PC同期
- **機能範囲**: 参考アプリと同一機能(履歴グラフ・睡眠・カロリーは作らない)
- **ログイン**: なし(個人用。起動即入力画面)

## 前提となる既存環境

- 共通バックアップ基盤が構築済み:
  - `app-sync`(公開リポジトリ): `https://taka070600538-tech.github.io/app-sync/v1/sync.js` を配信
  - `app-data`(非公開リポジトリ): アプリごとのフォルダにbackup.jsonを保存
- GitHub Pagesの同一オリジン(`taka070600538-tech.github.io`)共有により、
  カロリー計算アプリで入力済みのPATがそのまま本アプリにも効く(再入力不要)
- PC側の日次自動pullタスク(AppDataGitPull)も登録済み。本アプリ追加による作業は不要

## 全体構成

- 新規リポジトリ **`exercise-app`**(公開)。ローカルは `D:\Obsidian Vault for Claude Code\Git\運動管理アプリ`
- ビルド不要の静的PWA: `index.html` / `style.css` / `js/*.js`(ESModules) / `manifest.json` / `sw.js`
- カロリー計算アプリと同じ流儀: vanilla JS + IndexedDB + node:testによるテスト

## データモデル

IndexedDB(DB名 `exercise-app`、ストア `records`、キーは日付文字列 `YYYY-MM-DD`)。
1日1レコード:

```js
{
  date: '2026-08-10',        // キー
  strength: {
    situps: number|null,     // 腹筋の回数
    backExtensions: number|null, // 背筋の回数
    squats: number|null,     // スクワットの回数
    gripReps: number|null,   // ハンドグリップの回数
    pushups: [number|null, number|null, number|null], // 腕立て伏せ 1〜3回目
  },
  jogging: {
    startTime: string|null,  // 出発時刻 'HH:MM'
    weather: '晴れ'|'曇り'|'雨'|'雪'|null,
    distanceKm: number|null,
    durationMin: number|null,
  },
  gripStrength: { leftKg: number|null, rightKg: number|null }, // 握力測定
  memo: string,
  updatedAt: string,         // ISO 8601
}
```

- 腕立て伏せの合計は保存せず表示時に自動計算する(導出値は持たない)
- 未入力はnull。全項目未入力の日はレコードを作らない(空保存しない)

## 画面(1画面フォーム)

参考アプリと同じ構成の縦1カラムフォーム:

1. **ヘッダー**: アプリ名、日付ナビ(前日◀ / 日付ピッカー / 翌日▶)、保存状態表示(「保存済み」)
2. **別の日からコピー**: 日付を選ぶと、その日のレコード内容を現在表示中の日へコピー
   (現在日に既存データがある場合は上書き確認)
3. **基本の筋力トレーニング(回数)**: 腹筋・背筋・スクワット・ハンドグリップの回数入力、
   腕立て伏せ1〜3回目+合計(自動)
4. **ジョギング**: 出発時刻(time入力)、今日の天気(晴れ/曇り/雨/雪の選択)、距離km、時間分
5. **握力測定**: 左手kg・右手kg
6. **メモ**: 自由記述textarea
7. **設定セクション**: app-syncの共通バックアップUI(`renderSyncSettings`)と
   PWAインストール案内(アプリURLのコピー)

- 入力の都度、デバウンス(数百ms)して自動保存し「保存済み」表示を更新する。保存ボタンは置かない
- 日付を切り替えるとその日のレコードを読み込んでフォームに反映する

## バックアップ(app-sync連携)

- `js/app.js` 起動時に `https://taka070600538-tech.github.io/app-sync/v1/sync.js` を
  動的import(失敗時は`.catch`で静かにスキップ)し、`initDailyBackup` を呼ぶ:
  - `appId: 'exercise-app'` → 保存先は `app-data/exercise-app/backup.json`
  - `collect`: 全レコード → `{ version: 1, exportedAt: <ISO8601>, records }`
  - `restore`: ストアをクリアして全レコードを書き戻す
- `sw.js` では `sync.js` をキャッシュしない

## PWA化

- `manifest.json` + アイコン(`icons/icon.svg` から192px・512px・maskable 512pxのPNGを
  ブラウザcanvasで生成)+ `sw.js`(静的アセットのキャッシュ)
- GitHub Pages(Settings → Pages → main / root)で公開し、スマホの「ホーム画面に追加」で利用

## エラー処理

- 保存失敗(IndexedDBエラー): 保存状態表示を「保存できませんでした」にする
- バックアップ失敗: app-sync側の方針どおり静かにスキップ(次回起動時に再試行)
- 数値入力は空欄(null)を許容。負数は入力不可(min=0)

## テスト(node:test)

- レコードの組み立て・正規化(空フォーム→null、腕立て合計の計算)
- バックアップペイロードの組み立てとvalidate、collect→restoreの往復一致
- 「別の日からコピー」のデータ変換(dateとupdatedAtは引き継がない)
- PWAアセット整合性(manifestのアイコン宣言とファイル実寸、sw.jsのASSETS)

## やらないこと(YAGNI)

- 履歴一覧・推移グラフ
- 睡眠・消費カロリーの記録
- ログイン・複数ユーザー対応
- 複数端末間のマージ
- Obsidianへの自動転記(backup.jsonのまま。必要になったら別途)
