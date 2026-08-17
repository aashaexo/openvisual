import { openDB } from "idb";
import type { DBSchema, IDBPDatabase } from "idb";
import { createAppError } from "@/utils/errors";
import { log } from "@/utils/logger";

/**
 * The single local database behind every saved project. Nothing in this
 * subsystem opens a socket, reads a URL or leaves the machine.
 */

export const DB_NAME = "openvisual-local";
/** 2 turned a project from one diagram into an ordered deck of slides. */
export const DB_VERSION = 2;
export const PROJECT_STORE = "projects";
export const UPDATED_INDEX = "by-updated";

export interface OpenVisualDB extends DBSchema {
  projects: {
    key: string;
    /**
     * Deliberately `unknown`: a read can still hand back a version-1 record, so
     * every caller has to put it through `migrateProject` before trusting it.
     */
    value: unknown;
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
      // Version-1 rows are left exactly as they were written. Rewriting them
      // here would mean loading every canvas inside the upgrade transaction,
      // which blocks the app and cannot be resumed if it fails halfway;
      // `migrateProject` upgrades each record as it is read instead.
      //
      // An interrupted first run can also leave the store behind without its
      // index, and only this callback can put it back.
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
