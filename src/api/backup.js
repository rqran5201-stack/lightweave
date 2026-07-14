/**
 * Backup & restore for 织光 LightWeave.
 * All user data lives in IndexedDB — this is the safety net.
 * Supports both plain JSON and E2E-encrypted (.lightweave) backups.
 */

import { getAllRecords, getAllAssociations, getAllSOPs, getQAHistory, getSetting, setSetting, putRecord, saveSOP, saveQAMessage, saveAssociation } from '../store/db';
import { generateSalt, deriveKey, encryptData, decryptData } from './crypto';

const BACKUP_VERSION = 2;

// Settings keys excluded from backup (metadata, not user content)
const EXCLUDED_SETTINGS = ['encryption_salt', 'last_encrypted_backup', 'encryption_setup_at', 'backup_reminder_dismissed_until'];

// --- Internal helpers ---

function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function gatherBackupData() {
  const [records, associations, sops, qaHistory] = await Promise.all([
    getAllRecords(),
    getAllAssociations(),
    getAllSOPs(),
    getQAHistory(),
  ]);

  const settingKeys = ['llm_api_key', 'deepseek_api_key', 'llm_model', 'llm_api_base', 'llm_proxy_url', 'guide_completed'];
  const settings = {};
  for (const key of settingKeys) {
    const val = await getSetting(key);
    if (val !== undefined) settings[key] = val;
  }

  return { records, associations, sops, qaHistory, settings };
}

// --- Plain-text export ---

/**
 * Export all data as a downloadable JSON file.
 */
export async function exportAllData() {
  const { records, associations, sops, qaHistory, settings } = await gatherBackupData();

  const backup = {
    version: BACKUP_VERSION,
    app: 'lightweave',
    exportedAt: new Date().toISOString(),
    summary: {
      records: records.length,
      associations: associations.length,
      sops: sops.length,
      qaMessages: qaHistory.length,
    },
    data: { records, associations, sops, qaHistory, settings },
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const date = new Date().toISOString().slice(0, 10);
  downloadFile(blob, `lightweave-backup-${date}.json`);

  return backup.summary;
}

// --- E2E encrypted export ---

/**
 * Export all data as an AES-256-GCM encrypted .lightweave file.
 * The password is never stored or transmitted.
 * @param {string} password
 * @returns {Promise<object>} summary
 */
export async function exportEncryptedBackup(password) {
  const { records, associations, sops, qaHistory, settings } = await gatherBackupData();

  const inner = {
    version: BACKUP_VERSION,
    app: 'lightweave',
    exportedAt: new Date().toISOString(),
    data: { records, associations, sops, qaHistory, settings },
  };

  const salt = generateSalt();
  const key = await deriveKey(password, salt);
  const { ciphertext, iv } = await encryptData(JSON.stringify(inner), key);

  const wrapper = {
    format: 'lightweave-encrypted-v1',
    app: 'lightweave',
    exportedAt: inner.exportedAt,
    salt,
    iterations: 100000,
    iv,
    payload: ciphertext,
    summary: {
      records: records.length,
      associations: associations.length,
      sops: sops.length,
      qaMessages: qaHistory.length,
    },
  };

  const blob = new Blob([JSON.stringify(wrapper)], { type: 'application/octet-stream' });
  const date = new Date().toISOString().slice(0, 10);
  downloadFile(blob, `lightweave-backup-${date}.lightweave`);

  await setSetting('encryption_salt', salt);
  await setSetting('encryption_setup_at', new Date().toISOString());
  await setSetting('last_encrypted_backup', Date.now());

  return wrapper.summary;
}

// --- Validation ---

/**
 * Validate a backup file's structure.
 * Returns { valid, summary } for plain backups,
 * or { valid, encrypted: true, summary } for encrypted ones.
 */
export function validateBackup(json) {
  if (!json || typeof json !== 'object') {
    return { valid: false, error: '文件格式不正确' };
  }

  if (json.app !== 'lightweave') {
    return { valid: false, error: '这不是织光的备份文件' };
  }

  // Encrypted format detection
  if (json.format === 'lightweave-encrypted-v1') {
    if (!json.payload || !json.salt || !json.iv) {
      return { valid: false, error: '加密备份文件数据缺失', encrypted: true };
    }
    return {
      valid: true,
      encrypted: true,
      summary: json.summary || { exportedAt: json.exportedAt },
    };
  }

  // Plain-text format
  if (!json.data || !Array.isArray(json.data.records)) {
    return { valid: false, error: '备份文件数据缺失或损坏' };
  }

  return {
    valid: true,
    summary: {
      records: json.data.records?.length || 0,
      associations: json.data.associations?.length || 0,
      sops: json.data.sops?.length || 0,
      qaMessages: json.data.qaHistory?.length || 0,
      exportedAt: json.exportedAt,
    },
  };
}

// --- File reading ---

/**
 * Read a File object and parse it as JSON.
 * Supports .json and .lightweave files.
 */
export function readBackupFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result));
      } catch {
        if (file.name && file.name.endsWith('.lightweave')) {
          reject(new Error('无法解析加密备份文件，文件可能已损坏'));
        } else {
          reject(new Error('无法解析文件，请确认是 JSON 格式'));
        }
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
}

// --- Plain-text import ---

/**
 * Import plain-text backup data into IndexedDB (merge mode).
 */
export async function importBackup(json) {
  const { records, associations, sops, qaHistory, settings } = json.data;

  const imported = { records: 0, associations: 0, sops: 0, qaMessages: 0 };

  if (records?.length) {
    for (const r of records) {
      await putRecord(r);
    }
    imported.records = records.length;
  }

  if (associations?.length) {
    for (const a of associations) {
      if (a.recordId && a.associations) {
        await saveAssociation(a.recordId, a.associations);
      }
    }
    imported.associations = associations.length;
  }

  if (sops?.length) {
    for (const s of sops) {
      await saveSOP(s);
    }
    imported.sops = sops.length;
  }

  if (qaHistory?.length) {
    for (const q of qaHistory) {
      await saveQAMessage(q);
    }
    imported.qaMessages = qaHistory.length;
  }

  if (settings) {
    for (const [key, value] of Object.entries(settings)) {
      if (EXCLUDED_SETTINGS.includes(key)) continue;
      const existing = await getSetting(key);
      if (existing === undefined && value !== undefined) {
        await setSetting(key, value);
      }
    }
  }

  return imported;
}

// --- Encrypted import ---

/**
 * Decrypt and import an encrypted backup file.
 * @param {object} wrapper - the parsed encrypted wrapper JSON
 * @param {string} password
 * @returns {Promise<object>} import result
 */
export async function decryptAndImportBackup(wrapper, password) {
  const { salt, iterations, iv, payload } = wrapper;
  const key = await deriveKey(password, salt, iterations || 100000);
  const plaintext = await decryptData(payload, iv, key);
  const inner = JSON.parse(plaintext);
  return importBackup(inner);
}
