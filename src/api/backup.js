/**
 * Backup & restore for 织光 LightWeave.
 * All user data lives in IndexedDB — this is the safety net.
 */

import { getAllRecords, getAllAssociations, getAllSOPs, getQAHistory, getSetting, setSetting, putRecord, saveSOP, saveQAMessage, saveAssociation } from '../store/db';

const BACKUP_VERSION = 1;

/**
 * Export all data as a downloadable JSON file.
 */
export async function exportAllData() {
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
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  a.download = `lightweave-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return backup.summary;
}

/**
 * Validate a backup file's structure.
 */
export function validateBackup(json) {
  if (!json || typeof json !== 'object') {
    return { valid: false, error: '文件格式不正确' };
  }
  if (json.app !== 'lightweave') {
    return { valid: false, error: '这不是织光的备份文件' };
  }
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

/**
 * Read a File object and parse it as JSON.
 */
export function readBackupFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result));
      } catch {
        reject(new Error('无法解析文件，请确认是 JSON 格式'));
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
}

/**
 * Import backup data into IndexedDB (merge mode).
 * Existing records with same ID get updated; new ones get added.
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
      const existing = await getSetting(key);
      if (existing === undefined && value !== undefined) {
        await setSetting(key, value);
      }
    }
  }

  return imported;
}
