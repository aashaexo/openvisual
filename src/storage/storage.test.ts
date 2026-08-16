import { FIXTURES } from "@/diagrams/fixtures";
import { closeDb } from "@/storage/db";
import {
  BACKUP_KIND,
  importDiagramJson,
  importExcalidrawScene,
  parseProjectBackup,
  serializeProjectBackup,
} from "@/storage/importExport";
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_KEY,
  loadPreferences,
  savePreferences,
} from "@/storage/preferences";
import {
  UNTITLED_PROJECT_NAME,
  countProjects,
  createProjectId,
  deleteProject,
  duplicateProject,
  getProject,
  listProjects,
  renameProject,
  saveProject,
} from "@/storage/projects";
import type { AppError, SavedProject } from "@/types";

/**
 * IndexedDB does not exist in jsdom, so `idb` is replaced by an in-memory fake
 * that implements only the handful of methods db.ts and projects.ts call.
 */
const fakeIdb = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  const stores = new Map<string, Map<string, Row>>();
  const indexKeyPaths = new Map<string, Map<string, string>>();

  const rows = (store: string): Map<string, Row> => {
    const existing = stores.get(store);
    if (!existing) throw new Error(`unknown object store: ${store}`);
    return existing;
  };

  const db = {
    objectStoreNames: { contains: (name: string) => stores.has(name) },
    createObjectStore(name: string) {
      stores.set(name, new Map());
      indexKeyPaths.set(name, new Map());
      return {
        createIndex: (index: string, keyPath: string) => {
          indexKeyPaths.get(name)?.set(index, keyPath);
        },
      };
    },
    put: async (store: string, value: Row) => {
      rows(store).set(String(value.id), value);
      return String(value.id);
    },
    get: async (store: string, key: string) => rows(store).get(key),
    delete: async (store: string, key: string) => {
      rows(store).delete(key);
    },
    count: async (store: string) => rows(store).size,
    getAllFromIndex: async (store: string, index: string) => {
      const keyPath = indexKeyPaths.get(store)?.get(index);
      if (!keyPath) throw new Error(`unknown index: ${index}`);
      // A real index reads ascending, and listProjects reverses it to get
      // newest first, so the fake has to sort the same way to stay honest.
      return [...rows(store).values()].sort((a, b) =>
        String(a[keyPath]).localeCompare(String(b[keyPath])),
      );
    },
    close: () => {},
  };

  const tx = {
    objectStore: (name: string) => ({
      indexNames: { contains: (index: string) => indexKeyPaths.get(name)?.has(index) ?? false },
      createIndex: (index: string, keyPath: string) => {
        indexKeyPaths.get(name)?.set(index, keyPath);
      },
    }),
  };

  interface OpenOptions {
    upgrade?: (
      database: typeof db,
      oldVersion: number,
      newVersion: number,
      transaction: typeof tx,
    ) => void;
  }

  return {
    openDB: async (_name: string, version: number, options?: OpenOptions) => {
      options?.upgrade?.(db, 0, version, tx);
      return db;
    },
    reset: () => {
      stores.clear();
      indexKeyPaths.clear();
    },
  };
});

vi.mock("idb", () => ({ openDB: fakeIdb.openDB }));

// db.ts refuses to open when the global is missing; the fake never touches it.
if (typeof indexedDB === "undefined") {
  Object.defineProperty(globalThis, "indexedDB", { value: {}, configurable: true });
}

function makeProject(overrides: Partial<SavedProject> = {}): SavedProject {
  return {
    id: "project-1",
    name: "Agent loop",
    originalText: "The loop an agent repeats until it is done.",
    diagramSpec: FIXTURES.flowchart,
    excalidrawElements: [{ id: "el-1", type: "rectangle" }],
    appState: { viewBackgroundColor: "#ffffff" },
    theme: "minimal",
    model: "qwen3:4b",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function catchThrown(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error("expected the call to throw");
}

function expectImportAppError(thrown: unknown): void {
  expect(thrown).not.toBeInstanceOf(Error);
  const error = thrown as AppError;
  expect(typeof error.title).toBe("string");
  expect(typeof error.message).toBe("string");
  expect(error.retryable).toBe(false);
}

describe("preferences", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * The module keeps the last known preferences in a module-level variable, so
   * only a fresh module registry gives a genuinely untouched starting state.
   */
  async function freshModule() {
    vi.resetModules();
    return import("@/storage/preferences");
  }

  it("returns the defaults when nothing is stored", async () => {
    const { loadPreferences: load, DEFAULT_PREFERENCES: defaults } = await freshModule();
    expect(load()).toEqual(defaults);
  });

  it("merges a stored partial over the defaults", () => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ theme: "editorial", detail: "simple" }));

    expect(loadPreferences()).toEqual({
      ...DEFAULT_PREFERENCES,
      theme: "editorial",
      detail: "simple",
    });
  });

  it("falls back to the defaults when the stored JSON is malformed", () => {
    localStorage.setItem(PREFERENCES_KEY, "{not json at all");

    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it("ignores unknown keys and wrong-typed values", () => {
    localStorage.setItem(
      PREFERENCES_KEY,
      JSON.stringify({
        theme: "neon",
        exportScale: 7,
        detail: 42,
        model: "   ",
        onboardingComplete: "yes",
        favouriteColour: "green",
      }),
    );

    const prefs = loadPreferences();
    expect(prefs).toEqual(DEFAULT_PREFERENCES);
    expect(prefs).not.toHaveProperty("favouriteColour");
  });

  it("persists the merged result and hands it back", () => {
    const saved = savePreferences({ model: "llama3:8b", exportScale: 3 });

    expect(saved).toEqual({ ...DEFAULT_PREFERENCES, model: "llama3:8b", exportScale: 3 });
    expect(JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? "null")).toEqual(saved);
    expect(loadPreferences()).toEqual(saved);
  });

  it("survives a localStorage that refuses to read", async () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("storage is blocked");
    });

    const { loadPreferences: load, DEFAULT_PREFERENCES: defaults } = await freshModule();
    expect(load()).toEqual(defaults);
  });

  it("survives a localStorage that refuses to write", () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    expect(savePreferences({ onboardingComplete: true }).onboardingComplete).toBe(true);
  });
});

describe("projects", () => {
  beforeEach(async () => {
    await closeDb();
    fakeIdb.reset();
    // Saved timestamps come from the clock, and the library sorts by them.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-03-01T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("round-trips a saved project", async () => {
    const project = makeProject();
    await saveProject(project);

    const stored = await getProject(project.id);
    expect(stored).not.toBeNull();
    expect(stored).toMatchObject({
      id: project.id,
      name: "Agent loop",
      originalText: project.originalText,
      theme: "minimal",
      model: "qwen3:4b",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-03-01T10:00:00.000Z",
    });
    expect(stored?.excalidrawElements).toEqual(project.excalidrawElements);
  });

  it("returns null for an unknown id", async () => {
    expect(await getProject("nobody-home")).toBeNull();
  });

  it("lists the most recently updated project first", async () => {
    await saveProject(makeProject({ id: "a", name: "Oldest" }));
    vi.setSystemTime(new Date("2026-03-01T11:00:00.000Z"));
    await saveProject(makeProject({ id: "b", name: "Middle" }));
    vi.setSystemTime(new Date("2026-03-01T12:00:00.000Z"));
    await saveProject(makeProject({ id: "c", name: "Newest" }));

    expect((await listProjects()).map((summary) => summary.id)).toEqual(["c", "b", "a"]);
  });

  it("searches name, original text and diagram title case-insensitively", async () => {
    await saveProject(makeProject({ id: "by-name", name: "Onboarding sketch" }));
    await saveProject(
      makeProject({ id: "by-text", name: "Second", originalText: "Notes about kittens" }),
    );
    await saveProject(
      makeProject({
        id: "by-title",
        name: "Third",
        originalText: "nothing to see",
        diagramSpec: FIXTURES.timeline,
      }),
    );

    expect((await listProjects("ONBOARDING")).map((s) => s.id)).toEqual(["by-name"]);
    expect((await listProjects("kittens")).map((s) => s.id)).toEqual(["by-text"]);
    expect((await listProjects("PUBLISHED post")).map((s) => s.id)).toEqual(["by-title"]);
  });

  it("returns nothing when the search matches no project", async () => {
    await saveProject(makeProject());

    expect(await listProjects("zzz-nothing-matches")).toEqual([]);
  });

  it("strips the heavy canvas fields from each summary", async () => {
    await saveProject(makeProject());

    const [summary] = await listProjects();
    expect(summary).not.toHaveProperty("excalidrawElements");
    expect(summary).not.toHaveProperty("appState");
    expect(summary.diagramSpec.title).toBe(FIXTURES.flowchart.title);
  });

  it("renames a project and returns the updated record", async () => {
    await saveProject(makeProject({ id: "rename-me" }));

    const renamed = await renameProject("rename-me", "  Fresh name  ");
    expect(renamed?.name).toBe("Fresh name");
    expect((await getProject("rename-me"))?.name).toBe("Fresh name");
  });

  it("returns null when renaming an unknown project", async () => {
    expect(await renameProject("ghost", "Anything")).toBeNull();
  });

  it("falls back to the untitled name when the new name is empty", async () => {
    await saveProject(makeProject({ id: "blank-name" }));

    expect((await renameProject("blank-name", "   "))?.name).toBe(UNTITLED_PROJECT_NAME);
  });

  it("duplicates a project under a new id with a copy suffix", async () => {
    const project = makeProject({ id: "original" });
    await saveProject(project);

    const copy = await duplicateProject("original");
    expect(copy).not.toBeNull();
    expect(copy?.id).not.toBe("original");
    expect(copy?.name).toBe("Agent loop (copy)");
    expect(await countProjects()).toBe(2);
    expect(await getProject(copy?.id ?? "")).not.toBeNull();
  });

  it("returns null when duplicating an unknown project", async () => {
    expect(await duplicateProject("ghost")).toBeNull();
  });

  it("deletes a project and counts what is left", async () => {
    await saveProject(makeProject({ id: "keep" }));
    await saveProject(makeProject({ id: "drop" }));
    expect(await countProjects()).toBe(2);

    await deleteProject("drop");
    expect(await getProject("drop")).toBeNull();
    expect(await countProjects()).toBe(1);
  });

  it("creates unique project ids", () => {
    const ids = new Set(Array.from({ length: 500 }, () => createProjectId()));
    expect(ids.size).toBe(500);
  });
});

describe("import and export", () => {
  it("round-trips a project through a backup envelope", () => {
    const project = makeProject();
    const serialized = serializeProjectBackup(project);

    expect(JSON.parse(serialized).kind).toBe(BACKUP_KIND);

    const restored = parseProjectBackup(serialized);
    expect(restored).toEqual({
      ...project,
      diagramSpec: importDiagramJson(FIXTURES.flowchart),
    });
  });

  it("accepts a bare saved project as well as the envelope", () => {
    const project = makeProject({ id: "bare" });

    expect(parseProjectBackup(project).id).toBe("bare");
  });

  it("accepts a JSON string as well as a parsed value", () => {
    const project = makeProject({ id: "from-string" });

    expect(parseProjectBackup(JSON.stringify(project)).id).toBe("from-string");
  });

  it("rejects a backup that is not an object", () => {
    expectImportAppError(catchThrown(() => parseProjectBackup(42)));
  });

  it("rejects a backup whose diagram is invalid", () => {
    const broken = { ...makeProject(), diagramSpec: { version: 1, nodes: [] } };

    expectImportAppError(catchThrown(() => parseProjectBackup(broken)));
  });

  it("imports a valid diagram file", () => {
    const spec = importDiagramJson(FIXTURES.hierarchy);

    expect(spec.title).toBe(FIXTURES.hierarchy.title);
    expect(spec.nodes).toHaveLength(FIXTURES.hierarchy.nodes.length);
  });

  it("rejects a diagram file that no longer matches the schema", () => {
    const mutated = { ...FIXTURES.hierarchy, nodes: [] };

    expectImportAppError(catchThrown(() => importDiagramJson(mutated)));
  });

  it("imports an empty excalidraw scene", () => {
    expect(importExcalidrawScene({ type: "excalidraw", elements: [] })).toEqual({
      elements: [],
      appState: {},
    });
  });

  it("rejects junk in place of an excalidraw scene", () => {
    expectImportAppError(catchThrown(() => importExcalidrawScene([1, 2, 3])));
  });

  it("rejects a scene with the wrong type field", () => {
    expectImportAppError(
      catchThrown(() => importExcalidrawScene({ type: "tldraw", elements: [] })),
    );
  });

  it("rejects a scene with no elements array", () => {
    expectImportAppError(catchThrown(() => importExcalidrawScene({ type: "excalidraw" })));
  });
});
