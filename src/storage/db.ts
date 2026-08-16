import { openDB } from "idb";
import type { DBSchema, IDBPDatabase } from "idb";
import type { SavedProject } from "@/types";
import { createAppError } from "@/utils/errors";
import { log } from "@/utils/logger";

/**
 * The single local database behind every saved project. Nothing in this
 * subsystem opens a socket, reads a URL or leaves the machine.
 */

export const DB_NAME = "openvisual-local";
export const DB_VERSION = 1;
export const PROJECT_STORE = "projects";
export const UPDATED_INDEX = "by-updated";

export interface OpenVisualDB extends DBSchema {
  projects: {
    key: string;
    value: SavedProject;
    /** ISO timestamps sort lexicographically, so this index is chronological too. */
    indexes: { "by-updated": string };
  };
}

let connection: Promise<IDBPDatabase<OpenVisualDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<OpenVisualDB>> {
  if (connection) return connection;

  const pending = open().catch((error: unknown) => {
    // A failed open is never cached, so a later attempt can still succeed.
    if (connection === pending) connection = null;
    throw createAppError("storage_unavailable", error);
  });

  connection = pending;
  return pending;
}

/**
 * True when projects can actually be persisted. Private windows, blocked
 * storage and jsdom all land here as `false` rather than as a crash.
 */
export async function isStorageAvailable(): Promise<boolean> {
  if (typeof indexedDB === "undefined") return false;
  try {
    await getDb();
    return true;
  } catch {
    return false;
  }
}

export async function closeDb(): Promise<void> {
  const pending = connection;
  connection = null;
  if (!pending) return;
  try {
    (await pending).close();
  } catch {
    // It never opened, so there is nothing to release.
  }
}

async function open(): Promise<IDBPDatabase<OpenVisualDB>> {
  if (typeof indexedDB === "undefined") {
    throw new Error("indexedDB is not available in this environment");
  }

  return openDB<OpenVisualDB>(DB_NAME, DB_VERSION, {
    upgrade(db, _oldVersion, _newVersion, tx) {
      if (!db.objectStoreNames.contains(PROJECT_STORE)) {
        const created = db.createObjectStore(PROJECT_STORE, { keyPath: "id" });
        created.createIndex(UPDATED_INDEX, "updatedAt");
        return;
      }
      // An interrupted first run can leave the store behind without its index,
      // and nothing would ever create it: version 1 never upgrades again.
      const store = tx.objectStore(PROJECT_STORE);
      if (!store.indexNames.contains(UPDATED_INDEX)) {
        store.createIndex(UPDATED_INDEX, "updatedAt");
      }
    },
    blocked() {
      log.warn("storage", "Another window is holding an older version of the database open.");
    },
    blocking() {
      // Release the handle so a newer version can upgrade instead of hanging.
      void closeDb();
    },
    terminated() {
      log.warn("storage", "The browser closed the database connection unexpectedly.");
      connection = null;
    },
  });
}
