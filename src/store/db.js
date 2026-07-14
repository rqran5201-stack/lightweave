/**
 * IndexedDB storage layer for 织光 LightWeave.
 * All user data stays in the browser.
 */

import { openDB } from 'idb';

const DB_NAME = 'lightweave';
const DB_VERSION = 2;

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
        // Embeddings (v2) — semantic search vectors
        if (!db.objectStoreNames.contains('embeddings')) {
          db.createObjectStore('embeddings', { keyPath: 'recordId' });
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
  await db.delete('associations', id);
  await db.delete('embeddings', id);
}

/** Put a record directly — preserves original ID (used for backup restore). */
export async function putRecord(record) {
  const db = await getDB();
  await db.put('records', record);
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

// ========== Embeddings (v2) ==========

export async function saveEmbedding(recordId, embedding) {
  const db = await getDB();
  await db.put('embeddings', { recordId, embedding, createdAt: Date.now() });
}

export async function getEmbedding(recordId) {
  const db = await getDB();
  return db.get('embeddings', recordId);
}

export async function getAllEmbeddings() {
  const db = await getDB();
  return db.getAll('embeddings');
}

/**
 * Join all records with their embeddings.
 * Returns records with an `.embedding` field (null if not yet embedded).
 */
export async function getAllRecordsWithEmbeddings() {
  const db = await getDB();
  const [records, embeddings] = await Promise.all([
    db.getAllFromIndex('records', 'createdAt'),
    db.getAll('embeddings'),
  ]);
  const embMap = new Map(embeddings.map(e => [e.recordId, e.embedding]));
  return records.map(r => ({ ...r, embedding: embMap.get(r.id) || null }));
}

/**
 * Check if the embedding model has been downloaded (any embedding exists).
 */
export async function hasEmbeddings() {
  const db = await getDB();
  return (await db.count('embeddings')) > 0;
}

/**
 * Return all records that don't yet have an embedding.
 */
export async function getRecordsWithoutEmbeddings() {
  const db = await getDB();
  const [records, embeddings] = await Promise.all([
    db.getAllFromIndex('records', 'createdAt'),
    db.getAll('embeddings'),
  ]);
  const embSet = new Set(embeddings.map(e => e.recordId));
  return records.filter(r => !embSet.has(r.id));
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

export async function getAssociationCounts() {
  const db = await getDB();
  const allAssociations = await db.getAllFromIndex('associations', 'createdAt');
  const counts = new Map();

  for (const entry of allAssociations) {
    if (!entry.associations) continue;
    // Source count: this record's own associations
    counts.set(entry.recordId, (counts.get(entry.recordId) || 0) + entry.associations.length);
    // Backlink count: each target reference adds 1
    for (const assoc of entry.associations) {
      if (assoc.targetRecordId) {
        counts.set(assoc.targetRecordId, (counts.get(assoc.targetRecordId) || 0) + 1);
      }
    }
  }

  return counts;
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

// ========== Weekly Insights ==========

/**
 * Get the ISO week start date (Monday) for a given date.
 */
function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export async function saveWeeklyInsight(insight) {
  const db = await getDB();
  const weekStart = insight.weekStart || getWeekStart();
  const record = { ...insight, weekStart, generatedAt: Date.now() };
  await db.put('settings', record, `weekly_insight_${weekStart}`);
  return record;
}

export async function getWeeklyInsight(weekStart) {
  const db = await getDB();
  const key = `weekly_insight_${weekStart || getWeekStart()}`;
  return db.get('settings', key);
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
