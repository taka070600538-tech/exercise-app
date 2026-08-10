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
