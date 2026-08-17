/** The local persistence surface: IndexedDB projects, preferences, files. */

export { DB_NAME, DB_VERSION, closeDb, getDb, isStorageAvailable } from "@/storage/db";
export type { OpenVisualDB } from "@/storage/db";

export {
  UNTITLED_PROJECT_NAME,
  UNTITLED_SLIDE_NAME,
  countProjects,
  createProjectId,
  createSlideId,
  deleteProject,
  duplicateProject,
  getProject,
  listProjects,
  migrateProject,
  renameProject,
  saveProject,
} from "@/storage/projects";

export {
  DEFAULT_PREFERENCES,
  PREFERENCES_KEY,
  loadPreferences,
  savePreferences,
} from "@/storage/preferences";
export type { Preferences } from "@/storage/preferences";

export {
  BACKUP_KIND,
  BACKUP_VERSION,
  importDiagramJson,
  importExcalidrawScene,
  parseProjectBackup,
  serializeProjectBackup,
} from "@/storage/importExport";
