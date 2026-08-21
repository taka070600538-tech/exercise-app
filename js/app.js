import { openDB, getRecord, putRecord, deleteRecord } from './db.js';
import { emptyRecord, buildRecord, isEmptyRecord } from './record.js';
import { renderTimeline } from './timeline.js';
import { renderAnalysis, loadPeriod, savePeriod } from './analysis.js';
import { readFormValues, fillForm, bindFormChange } from './form.js';
import { formatDate, shiftDate } from './dateUtils.js';
import { collectBackup, restoreBackup, validateBackupData } from './backup.js';

const state = { db: null, date: formatDate(new Date()), period: null };

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

function renderAnalysisView() {
  return renderAnalysis(document.getElementById('analysis-cards'), state.db, state.period);
}

function bindNav() {
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      switchView(view);
      if (view === 'timeline') renderTimeline(document.getElementById('timeline-container'), state.db);
      if (view === 'analysis') renderAnalysisView();
    });
  });
}

function updatePeriodChips() {
  document.querySelectorAll('.period-chips .chip').forEach((btn) => {
    btn.classList.toggle('is-active', Number(btn.dataset.days) === state.period);
  });
}

function bindAnalysisPeriod() {
  document.querySelectorAll('.period-chips .chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.period = Number(btn.dataset.days);
      savePeriod(state.period);
      updatePeriodChips();
      renderAnalysisView();
    });
  });
}

function setFileMessage(text) {
  document.getElementById('file-message').textContent = text;
}

function bindDataFile() {
  document.getElementById('export-file').addEventListener('click', async () => {
    const payload = await collectBackup(state.db);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exercise-app-backup-${formatDate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setFileMessage('エクスポートしました。');
  });

  const fileInput = document.getElementById('import-file-input');
  document.getElementById('import-file').addEventListener('click', () => {
    fileInput.click();
  });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const data = validateBackupData(JSON.parse(await file.text()));
      if (!confirm(`${data.records.length}件を取り込みます。現在の記録は置き換えられます。よろしいですか？`)) return;
      await restoreBackup(state.db, data);
      await loadDate(state.date);
      setFileMessage(`${data.records.length}件を取り込みました。`);
    } catch (err) {
      console.error(err);
      setFileMessage('ファイルの形式が正しくありません。');
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

  state.period = loadPeriod();
  updatePeriodChips();

  bindDateNav();
  bindNav();
  bindAnalysisPeriod();
  bindDataFile();
  bindFormChange(saveCurrentForm);
  await loadDate(state.date);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // 共有モジュールは動的import。オフラインやapp-sync障害時はアプリ本体の起動を
  // 妨げないよう黙ってスキップし、設定タブにはフォールバック文言を表示する
  // (次回オンライン起動時に再試行される)。
  import('https://taka070600538-tech.github.io/app-sync/v1/sync.js')
    .then((sync) => {
      sync.initDailyBackup({
        appId: 'exercise-app',
        collect: () => collectBackup(state.db),
        restore: (data) => restoreBackup(state.db, data),
      });
      sync.renderBackupControls(document.getElementById('sync-backup-section'));
      sync.renderTokenSettings(document.getElementById('sync-token-section'));
    })
    .catch(() => {
      const message = '<p class="settings-note">GitHubバックアップ機能は現在利用できません(オフラインの可能性)。</p>';
      document.getElementById('sync-backup-section').innerHTML = message;
      document.getElementById('sync-token-section').innerHTML = message;
    });
}

init();
