import { setSetting } from "./repo";

/** Hands the backup to the user: share sheet (iOS → Filer/iCloud) when available, else a download.
 *  Records lastBackupAt only when the file actually went out. Returns false if the user cancelled. */
export async function saveBackupFile(blob: Blob, fileName: string): Promise<boolean> {
  const file = new File([blob], fileName, { type: "application/json" });
  const nav = navigator as Navigator & { canShare?(d: ShareData): boolean };
  if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: fileName });
      await setSetting("lastBackupAt", new Date().toISOString());
      return true;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return false;
      // Share failed for another reason: fall back to download.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  await setSetting("lastBackupAt", new Date().toISOString());
  return true;
}
