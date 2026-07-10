/**
 * IndexedDB storage layer for 织光 LightWeave.
 * All user data stays in the browser.
 */

import { openDB } from 'idb';

const DB_NAME = 'lightweave';
const DB_VERSION = 1;

let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Records store
        if (!db.objectStoreNames.contains('records')) {
          const recordsStore = db.createObjectStore('records', { keyPath: 'id' });
          recordsStore.createIndex('createdAt', 'createdAt');
          recordsStore.createIndex('tags', 'tags', { multiEntry: true });
        }
        // Associations store (cached analysis results)
        if (!db.objectStoreNames.contains('associations')) {
          const assocStore = db.createObjectStore('associations', { keyPath: 'recordId' });
          assocStore.createIndex('createdAt', 'createdAt');
        }
        // SOPs store
        if (!db.objectStoreNames.contains('sops')) {
          db.createObjectStore('sops', { keyPath: 'id' });
        }
        // Q&A history
        if (!db.objectStoreNames.contains('qaHistory')) {
          const qaStore = db.createObjectStore('qaHistory', { keyPath: 'id' });
          qaStore.createIndex('createdAt', 'createdAt');
        }
        // Settings
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      },
    });
  }
  return dbPromise;
}

// ========== Records ==========

export async function saveRecord({ content, tags = [] }) {
  const db = await getDB();
  const id = crypto.randomUUID();
  const record = {
    id,
    content,
    tags,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    wordCount: content.length,
    summary: content.slice(0, 100).replace(/\n/g, ' '),
  };
  await db.add('records', record);
  return record;
}

export async function getRecord(id) {
  const db = await getDB();
  return db.get('records', id);
}

export async function getAllRecords() {
  const db = await getDB();
  return db.getAllFromIndex('records', 'createdAt');
}

/**
 * Batch import records (for knowledge migration).
 * Each item: { content, tags?, createdAt? }
 * Returns array of saved records.
 */
export async function batchImportRecords(items) {
  const db = await getDB();
  const tx = db.transaction('records', 'readwrite');
  const saved = [];
  for (const item of items) {
    const id = crypto.randomUUID();
    const record = {
      id,
      content: item.content,
      tags: item.tags || [],
      createdAt: item.createdAt || Date.now(),
      updatedAt: Date.now(),
      wordCount: (item.content || '').length,
      summary: (item.content || '').slice(0, 100).replace(/\n/g, ' '),
    };
    await tx.store.add(record);
    saved.push(record);
  }
  await tx.done;
  return saved;
}

export async function getRecentRecords(limit = 20) {
  const db = await getDB();
  const all = await db.getAllFromIndex('records', 'createdAt');
  return all.reverse().slice(0, limit);
}

export async function deleteRecord(id) {
  const db = await getDB();
  await db.delete('records', id);
  // Also delete cached associations
  await db.delete('associations', id);
}

export async function searchRecords(query) {
  const db = await getDB();
  const all = await db.getAllFromIndex('records', 'createdAt');
  const q = query.toLowerCase();
  return all
    .filter(r => r.content.toLowerCase().includes(q))
    .reverse();
}

export async function getRecordsByTag(tag) {
  const db = await getDB();
  return db.getAllFromIndex('records', 'tags', tag);
}

export async function getRecordCount() {
  const db = await getDB();
  return db.count('records');
}

// ========== Associations ==========

export async function saveAssociation(recordId, associations) {
  const db = await getDB();
  await db.put('associations', {
    recordId,
    associations,
    createdAt: Date.now(),
  });
}

export async function getAssociation(recordId) {
  const db = await getDB();
  return db.get('associations', recordId);
}

export async function getAllAssociations() {
  const db = await getDB();
  const all = await db.getAllFromIndex('associations', 'createdAt');
  return all.reverse();
}

export async function getBacklinks(recordId) {
  const db = await getDB();
  const allAssociations = await db.getAllFromIndex('associations', 'createdAt');
  const backlinks = [];
  for (const entry of allAssociations) {
    if (!entry.associations) continue;
    for (const assoc of entry.associations) {
      if (assoc.targetRecordId === recordId) {
        backlinks.push({
          sourceRecordId: entry.recordId,
          reason: assoc.reason,
          confidence: assoc.confidence,
        });
      }
    }
  }
  return backlinks;
}

// ========== SOPs ==========

export async function saveSOP(sop) {
  const db = await getDB();
  const id = sop.id || crypto.randomUUID();
  const record = {
    ...sop,
    id,
    createdAt: sop.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
  await db.put('sops', record);
  return record;
}

export async function getSOP(id) {
  const db = await getDB();
  return db.get('sops', id);
}

export async function getAllSOPs() {
  const db = await getDB();
  return db.getAll('sops');
}

export async function deleteSOP(id) {
  const db = await getDB();
  await db.delete('sops', id);
}

// ========== Q&A History ==========

export async function saveQAMessage(msg) {
  const db = await getDB();
  await db.put('qaHistory', msg);
}

export async function getQAHistory() {
  const db = await getDB();
  const all = await db.getAllFromIndex('qaHistory', 'createdAt');
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function deleteQAMessage(id) {
  const db = await getDB();
  await db.delete('qaHistory', id);
}

export async function clearQAHistory() {
  const db = await getDB();
  await db.clear('qaHistory');
}

// ========== Settings ==========

export async function getSetting(key) {
  const db = await getDB();
  return db.get('settings', key);
}

export async function setSetting(key, value) {
  const db = await getDB();
  await db.put('settings', value, key);
}

export async function deleteSetting(key) {
  const db = await getDB();
  await db.delete('settings', key);
}
