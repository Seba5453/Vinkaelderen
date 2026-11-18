import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { da, formatDate } from "../../i18n/da";
import { db } from "../../db/db";
import { setSetting } from "../../db/repo";
import { BackupError, backupFileName, exportBackup, importBackup } from "../../db/backup";
import { saveBackupFile } from "../../db/saveBackup";
import { useApiKey } from "../../ai/useApiKey";

const t = da.settings;

export default function SettingsPage() {
  const storedKey = useApiKey();
  const [key, setKey] = useState("");
  const [keySaved, setKeySaved] = useState(false);
  const [pending, setPending] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const lastBackupAt = useLiveQuery(async () => (await db.settings.get("lastBackupAt"))?.value as string | undefined, [], null);

  useEffect(() => { if (storedKey) setKey(storedKey); }, [storedKey]);

  async function saveKey() {
    await setSetting("apiKey", key.trim());
    setKeySaved(true);
  }

  async function doExport() {
    try {
      await saveBackupFile(await exportBackup(), backupFileName(new Date()));
    } catch {
      setMessage(da.common.saveError);
    }
  }

  async function doRestore() {
    if (!pending) return;
    try {
      const { wines } = await importBackup(pending);
      setMessage(t.restored(wines));
    } catch (e) {
      setMessage(e instanceof BackupError ? t.backupErrors[e.kind] : t.backupErrors["ugyldig-fil"]);
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="page">
      <h1>{t.title}</h1>

      <div className="card">
        <label htmlFor="api-key">{t.apiKey}</label>
        <input id="api-key" type="password" autoComplete="off" value={key}
          onChange={(e) => { setKey(e.target.value); setKeySaved(false); }} />
        <button className="primary" onClick={saveKey} disabled={!key.trim()}>{t.saveKey}</button>
        {keySaved && <p className="ok">{t.keySaved}</p>}
        <p className="muted">{t.keyHelp}</p>
      </div>

      <div className="card">
        <h2>{t.backup}</h2>
        <p className="muted">{t.backupHelp}</p>
        {lastBackupAt !== null && <p>{t.lastBackup(lastBackupAt ? formatDate(lastBackupAt) : null)}</p>}
        <button className="primary" onClick={doExport}>{t.exportButton}</button>
        <label htmlFor="restore" className="file-label">{t.restore}</label>
        <input id="restore" type="file" accept="application/json,.json"
          onChange={(e) => { setMessage(null); setPending(e.target.files?.[0] ?? null); e.target.value = ""; }} />
        {pending && (
          <div className="confirm">
            <p>{t.restoreConfirm(pending.name)}</p>
            <button className="danger" onClick={doRestore}>{t.restoreYes}</button>
            <button onClick={() => setPending(null)}>{da.common.cancel}</button>
          </div>
        )}
        {message && <p role="alert">{message}</p>}
      </div>
    </section>
  );
}
