import { useState, useEffect } from 'react';
import { getSetting, setSetting } from '../store/db';

const REMINDER_DAYS = 7;

export function BackupReminder({ onOpenSettings }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const salt = await getSetting('encryption_salt');
        if (!salt) return;
        const dismissed = await getSetting('backup_reminder_dismissed_until');
        if (dismissed && Date.now() < dismissed) return;
        const lastBackup = await getSetting('last_encrypted_backup');
        if (!lastBackup) {
          if (!cancelled) setVisible(true);
          return;
        }
        const elapsed = Date.now() - lastBackup;
        if (elapsed > REMINDER_DAYS * 24 * 60 * 60 * 1000) {
          if (!cancelled) setVisible(true);
        }
      } catch {
        // Settings not accessible yet
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleDismiss = async () => {
    try {
      await setSetting('backup_reminder_dismissed_until', Date.now() + REMINDER_DAYS * 24 * 60 * 60 * 1000);
    } catch {
      // Silently fail
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="backup-reminder-banner">
      <div className="backup-reminder-text">
        &#128274; 已超过 {REMINDER_DAYS} 天未进行加密备份。建议立即备份以防数据丢失。
      </div>
      <div className="backup-reminder-actions">
        <button className="btn btn-primary btn-sm" onClick={onOpenSettings}>
          立即备份
        </button>
        <button className="btn btn-ghost btn-sm" onClick={handleDismiss}>
          稍后提醒
        </button>
      </div>
    </div>
  );
}
