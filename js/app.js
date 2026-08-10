import { openDB, getRecord, putRecord, deleteRecord } from './db.js';
import { emptyRecord, buildRecord, isEmptyRecord } from './record.js';
import { renderTimeline } from './timeline.js';
import { readFormValues, fillForm, bindFormChange } from './form.js';
import { formatDate, shiftDate } from './dateUtils.js';
import { collectBackup, restoreBackup } from './backup.js';

const APP_URL = 'https://taka070600538-tech.github.io/exercise-app/';

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

function bindCopyAppUrl() {
  document.getElementById('copy-app-url').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(APP_URL);
      alert('アプリのURLをコピーしました。');
    } catch {
      prompt('このURLをコピーしてください:', APP_URL);
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
  bindNav();
  bindCopyAppUrl();
  bindFormChange(saveCurrentForm);
  await loadDate(state.date);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // 共有モジュールは動的import。オフラインやapp-sync障害時は黙ってスキップし、
  // アプリ本体の起動を妨げない(次回オンライン起動時に再試行される)。
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
