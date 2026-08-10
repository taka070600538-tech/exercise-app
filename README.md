# 運動管理アプリ (exercise-app)

毎日の筋トレ・ジョギング・握力を記録するPWA。
Google AI Studio製の「運動管理アプリ」と同一機能を、自前の静的PWAとして再実装したもの。

- **公開URL**: https://taka070600538-tech.github.io/exercise-app/
- スマホのブラウザで開き「ホーム画面に追加」するとアプリとして使える

## 機能

- 日付ごとの記録(前日/翌日ボタン・カレンダーで切替)
  - 基本の筋力トレーニング: 腹筋・背筋・スクワット・ハンドグリップの回数、腕立て伏せ3セット(合計自動計算)
  - ジョギング: 出発時刻・天気・距離km・時間分
  - 握力測定: 左手/右手kg
  - メモ
- 入力の都度、自動保存(保存ボタンなし)
- 「別の日からコピー」で過去の記録を当日に転記
- ログインなし・端末内IndexedDB保存

## データの流れ

```
スマホ(IndexedDB)
  → app-sync共通基盤(1日1回、アプリを開いたとき自動)
  → GitHub: taka070600538-tech/app-data の exercise-app/backup.json
  → PC: 日次自動pull(タスクスケジューラ AppDataGitPull)
```

- バックアップ用PATはGitHub Pages同一オリジンのlocalStorage共有により、
  他アプリ(カロリー計算アプリ等)で入力済みならそのまま有効
- 復元は設定セクションの「GitHubから復元」から

## 開発

ビルド不要の静的PWA(vanilla JS ESModules)。

```
node --test        # テスト実行
python -m http.server 8792   # ローカル確認
```

- 設計書: `docs/superpowers/specs/2026-08-10-exercise-app-design.md`
- 実装計画: `docs/superpowers/plans/2026-08-10-exercise-app-plan.md`
