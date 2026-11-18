import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";

/** Live-reads the stored API key. undefined while loading or when unset. */
export function useApiKey(): string | undefined {
  return useLiveQuery(async () => (await db.settings.get("apiKey"))?.value as string | undefined);
}
