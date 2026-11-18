import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { da } from "../../i18n/da";
import { db } from "../../db/db";

const REMINDER_DAYS = 30;

function BackupReminder() {
  const show = useLiveQuery(async () => {
    if ((await db.wines.count()) === 0) return false;
    const last = (await db.settings.get("lastBackupAt"))?.value as string | undefined;
    return !last || Date.now() - Date.parse(last) > REMINDER_DAYS * 864e5;
  }, [], false);
  if (!show) return null;
  return (
    <div role="status" className="banner">
      <span>{da.cellar.backupReminder}</span> <Link to="/indstillinger">{da.cellar.backupNow}</Link>
    </div>
  );
}

export default function CellarPage() {
  return (
    <section className="page">
      <h1>{da.appName}</h1>
      <BackupReminder />
    </section>
  );
}
