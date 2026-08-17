import { create } from "zustand";
import type { AppState as ExcalidrawAppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { checkOllama, DEFAULT_MODEL, listOllamaModels } from "@/ai/client";
import { runGeneration } from "@/ai/pipeline";
import { layoutDiagram } from "@/diagrams/layout";
import {
  convertLayoutToExcalidraw,
  restyleExcalidrawElements,
} from "@/diagrams/convertToExcalidraw";
import type { DiagramSpec, DiagramType } from "@/diagrams/schema";
import type { DiagramLayout } from "@/diagrams/layouts/types";
import { getTheme, type ThemeId } from "@/themes";
import { copyPngToClipboard, exportDiagram, type ExportFormat } from "@/export";
import {
  createProjectId,
  deleteProject as deleteStoredProject,
  duplicateProject as duplicateStoredProject,
  getProject,
  isStorageAvailable,
  listProjects,
  loadPreferences,
  renameProject as renameStoredProject,
  savePreferences,
  saveProject,
  serializeProjectBackup,
  UNTITLED_PROJECT_NAME,
  UNTITLED_SLIDE_NAME,
} from "@/storage";
import { getCanvasApi } from "@/store/canvasBridge";
import type {
  AppError,
  DetailLevel,
  GenerationAction,
  OllamaModel,
  OllamaStatus,
  ProjectSummary,
  RequestedDiagramType,
  SavedProject,
  SavedSlide,
} from "@/types";
import { createAppError, toAppError } from "@/utils/errors";
import { log } from "@/utils/logger";

/** The subset of Excalidraw's tools our own strip exposes. */
export type CanvasToolType = "selection" | "rectangle" | "ellipse" | "arrow" | "freedraw" | "text";

const TOOL_TYPES = new Set<string>([
  "selection",
  "rectangle",
  "ellipse",
  "arrow",
  "freedraw",
  "text",
]);

export type GenerationStatus = "idle" | "generating" | "arranging";
export type SaveStatus = "idle" | "saving" | "saved" | "unavailable";

interface GenerationMeta {
  model: string;
  action: GenerationAction;
  repaired: boolean;
  durationMs: number;
}

interface AppStore {
  /* input and options */
  text: string;
  requestedType: RequestedDiagramType;
  detail: DetailLevel;
  themeId: ThemeId;
  model: string;
  exportScale: 1 | 2 | 3;
  transparentBackground: boolean;

  /* local model environment */
  ollamaStatus: OllamaStatus | null;
  models: OllamaModel[];
  environmentChecking: boolean;
  onboardingOpen: boolean;
  onboardingComplete: boolean;

  /* the diagram */
  spec: DiagramSpec | null;
  layout: DiagramLayout | null;
  elements: ExcalidrawElement[];
  sceneAppState: Partial<ExcalidrawAppState> | null;
  files: BinaryFiles | null;
  warnings: string[];
  lastMeta: GenerationMeta | null;
  /** True once the user has touched the canvas; blocks automatic re-layout. */
  sceneDirty: boolean;

  /* lifecycle */
  status: GenerationStatus;
  error: AppError | null;

  /* the deck */
  slides: SavedSlide[];
  activeSlideId: string | null;
  presenting: boolean;
  /** Mirrors Excalidraw's active tool so our own tool strip can reflect it. */
  activeTool: CanvasToolType;

  /* projects */
  projects: ProjectSummary[];
  projectSearch: string;
  currentProjectId: string | null;
  currentProjectName: string;
  saveStatus: SaveStatus;
  storageAvailable: boolean;

  /* actions */
  setText: (text: string) => void;
  setRequestedType: (type: RequestedDiagramType) => void;
  setDetail: (detail: DetailLevel) => void;
  setTheme: (theme: ThemeId) => void;
  setModel: (model: string) => void;
  setExportScale: (scale: 1 | 2 | 3) => void;
  setTransparentBackground: (value: boolean) => void;
  setOnboardingOpen: (open: boolean) => void;
  setProjectName: (name: string) => void;
  completeOnboarding: () => void;
  dismissError: () => void;

  initialise: () => Promise<void>;
  refreshEnvironment: () => Promise<void>;

  generate: (action?: GenerationAction, targetType?: DiagramType) => Promise<void>;
  cancelGeneration: () => void;
  autoLayout: () => Promise<void>;
  loadFixture: (spec: DiagramSpec) => Promise<void>;

  onSceneChange: (
    elements: readonly ExcalidrawElement[],
    appState: ExcalidrawAppState,
    files: BinaryFiles,
  ) => void;

  addSlide: () => void;
  duplicateSlide: (id: string) => void;
  deleteSlide: (id: string) => void;
  selectSlide: (id: string) => void;
  renameSlide: (id: string, name: string) => void;
  moveSlide: (id: string, direction: -1 | 1) => void;
  setPresenting: (presenting: boolean) => void;
  stepSlide: (direction: -1 | 1) => void;
  setActiveTool: (tool: CanvasToolType) => void;

  newProject: () => void;
  saveCurrentProject: (options?: { silent?: boolean }) => Promise<void>;
  openProject: (id: string) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  renameCurrentProject: (name: string) => Promise<void>;
  duplicateProject: (id: string) => Promise<void>;
  refreshProjects: () => Promise<void>;
  setProjectSearch: (search: string) => void;
  exportProjectBackup: (id: string) => Promise<string | null>;

  exportCurrent: (format: ExportFormat) => Promise<void>;
  copyPng: () => Promise<void>;

  applySpec: (spec: DiagramSpec, options?: { warnings?: string[] }) => Promise<void>;
}

/** Cancellation handle for the in-flight generation, if any. */
let controller: AbortController | null = null;
/** Set while the store pushes a scene, so our own updates are not "user edits". */
let applyingScene = false;
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

const preferences = loadPreferences();
const firstSlide = blankSlide("Slide 1");

export const useAppStore = create<AppStore>((set, get) => ({
  text: "",
  requestedType: preferences.diagramType,
  detail: preferences.detail,
  themeId: preferences.theme,
  model: preferences.model || DEFAULT_MODEL,
  exportScale: preferences.exportScale,
  transparentBackground: preferences.transparentBackground,

  ollamaStatus: null,
  models: [],
  environmentChecking: false,
  onboardingOpen: false,
  onboardingComplete: preferences.onboardingComplete,

  spec: null,
  layout: null,
  elements: [],
  sceneAppState: null,
  files: null,
  warnings: [],
  lastMeta: null,
  sceneDirty: false,

  status: "idle",
  error: null,

  // A deck always has at least one slide, so the rail is never empty.
  slides: [firstSlide],
  activeSlideId: firstSlide.id,
  presenting: false,
  activeTool: "selection",

  projects: [],
  projectSearch: "",
  currentProjectId: null,
  currentProjectName: UNTITLED_PROJECT_NAME,
  saveStatus: "idle",
  storageAvailable: true,

  setText: (text) => set({ text }),
  setRequestedType: (requestedType) => {
    savePreferences({ diagramType: requestedType });
    set({ requestedType });
  },
  setDetail: (detail) => {
    savePreferences({ detail });
    set({ detail });
  },
  setModel: (model) => {
    savePreferences({ model });
    set({ model });
  },
  setExportScale: (exportScale) => {
    savePreferences({ exportScale });
    set({ exportScale });
  },
  setTransparentBackground: (transparentBackground) => {
    savePreferences({ transparentBackground });
    set({ transparentBackground });
  },
  setOnboardingOpen: (onboardingOpen) => set({ onboardingOpen }),
  // Typing only updates the field; the rename is persisted on blur.
  setProjectName: (currentProjectName) => set({ currentProjectName }),
  completeOnboarding: () => {
    savePreferences({ onboardingComplete: true });
    set({ onboardingComplete: true, onboardingOpen: false });
  },
  dismissError: () => set({ error: null }),

  setTheme: (themeId) => {
    savePreferences({ theme: themeId });
    const { spec, elements } = get();
    const theme = getTheme(themeId);

    // Repaint in place so manual edits and positions survive a theme change.
    const restyled =
      spec && elements.length ? restyleExcalidrawElements(elements, spec, theme) : elements;
    set({ themeId, elements: restyled });

    const api = getCanvasApi();
    if (api) {
      applyingScene = true;
      api.updateScene({
        elements: restyled,
        appState: { viewBackgroundColor: theme.canvas.background },
      });
      queueMicrotask(() => {
        applyingScene = false;
      });
    }
    if (get().currentProjectId) void get().saveCurrentProject({ silent: true });
  },

  initialise: async () => {
    const available = await isStorageAvailable();
    set({ storageAvailable: available, saveStatus: available ? "idle" : "unavailable" });
    if (available) await get().refreshProjects();

    await get().refreshEnvironment();

    const { ollamaStatus, models, onboardingComplete, model } = get();
    const needsHelp =
      !ollamaStatus?.running || models.length === 0 || !models.some((m) => m.name === model);
    if (!onboardingComplete || needsHelp) set({ onboardingOpen: true });
  },

  refreshEnvironment: async () => {
    set({ environmentChecking: true });
    try {
      const status = await checkOllama();
      let models: OllamaModel[] = [];
      if (status.running) {
        try {
          models = await listOllamaModels();
        } catch (error) {
          log.warn("store", "could not list models", error);
        }
      }

      const current = get().model;
      const stillInstalled = models.some((m) => m.name === current);
      const fallback =
        models.find((m) => m.name === DEFAULT_MODEL)?.name ?? models[0]?.name ?? current;

      set({
        ollamaStatus: status,
        models,
        model: stillInstalled ? current : fallback,
        environmentChecking: false,
      });
    } catch (error) {
      set({
        environmentChecking: false,
        ollamaStatus: { running: false },
        error: toAppError(error),
      });
    }
  },

  generate: async (action = "generate", targetType) => {
    const state = get();
    if (state.status !== "idle") return;

    if (!state.ollamaStatus?.running) {
      set({ error: createAppError("ollama_unreachable"), onboardingOpen: true });
      return;
    }
    if (state.models.length === 0) {
      set({ error: createAppError("no_models_installed"), onboardingOpen: true });
      return;
    }
    if (!state.models.some((m) => m.name === state.model)) {
      set({ error: createAppError("model_missing", state.model), onboardingOpen: true });
      return;
    }

    controller = new AbortController();
    set({ status: "generating", error: null, warnings: [] });

    try {
      const result = await runGeneration({
        action,
        text: state.text,
        model: state.model,
        detail: state.detail,
        requestedType: state.requestedType,
        currentSpec: state.spec,
        targetType,
        requestId: createProjectId(),
        signal: controller.signal,
      });

      set({ lastMeta: result.meta });
      await get().applySpec(result.spec, { warnings: result.warnings });

      if (get().storageAvailable) await get().saveCurrentProject({ silent: true });
    } catch (error) {
      const appError = toAppError(error);
      set({ error: appError.code === "cancelled" ? null : appError });
    } finally {
      controller = null;
      set({ status: "idle" });
    }
  },

  cancelGeneration: () => {
    controller?.abort();
    controller = null;
    set({ status: "idle" });
  },

  applySpec: async (spec, options) => {
    set({ status: "arranging" });
    try {
      const theme = getTheme(get().themeId);
      const layout = await layoutDiagram(spec);
      const elements = convertLayoutToExcalidraw(spec, layout, theme);

      set({
        spec,
        layout,
        elements,
        warnings: options?.warnings ?? [],
        sceneDirty: false,
        currentProjectName: spec.title || get().currentProjectName,
      });

      pushScene(elements, theme.canvas.background);
    } catch (error) {
      set({ error: toAppError(error, "layout_failed") });
    } finally {
      set({ status: "idle" });
    }
  },

  autoLayout: async () => {
    const { spec } = get();
    if (!spec) return;
    await get().applySpec(spec, { warnings: get().warnings });
    if (get().currentProjectId) void get().saveCurrentProject({ silent: true });
  },

  loadFixture: async (spec) => {
    set({ currentProjectId: null, currentProjectName: spec.title, lastMeta: null });
    await get().applySpec(spec);
  },

  onSceneChange: (elements, appState, files) => {
    if (applyingScene) return;

    const previous = get().elements;
    const changed =
      previous.length !== elements.length ||
      elements.some((element, index) => element.version !== previous[index]?.version);

    const tool = appState.activeTool.type;
    if (tool !== get().activeTool && TOOL_TYPES.has(tool)) {
      set({ activeTool: tool as CanvasToolType });
    }

    set({
      elements: elements as ExcalidrawElement[],
      sceneAppState: {
        viewBackgroundColor: appState.viewBackgroundColor,
        gridSize: appState.gridSize,
        zoom: appState.zoom,
        scrollX: appState.scrollX,
        scrollY: appState.scrollY,
      },
      files,
      ...(changed ? { sceneDirty: true } : {}),
    });

    if (changed) scheduleAutosave(get);
  },

  addSlide: () => {
    const state = get();
    const slides = commitActiveSlide(state);
    const slide = blankSlide(`Slide ${slides.length + 1}`);

    set({ slides: [...slides, slide] });
    loadSlide(set, slide, getTheme(state.themeId).canvas.background);
  },

  duplicateSlide: (id) => {
    const state = get();
    const slides = commitActiveSlide(state);
    const index = slides.findIndex((slide) => slide.id === id);
    if (index === -1) return;

    const copy: SavedSlide = {
      ...structuredClone(slides[index]),
      id: createProjectId(),
      name: `${slides[index].name} (copy)`,
    };
    const next = [...slides.slice(0, index + 1), copy, ...slides.slice(index + 1)];

    set({ slides: next });
    loadSlide(set, copy, getTheme(state.themeId).canvas.background);
    void get().saveCurrentProject({ silent: true });
  },

  deleteSlide: (id) => {
    const state = get();
    const slides = commitActiveSlide(state);
    if (slides.length <= 1) return;

    const index = slides.findIndex((slide) => slide.id === id);
    if (index === -1) return;

    const next = slides.filter((slide) => slide.id !== id);
    set({ slides: next });

    if (state.activeSlideId === id) {
      const neighbour = next[Math.min(index, next.length - 1)];
      loadSlide(set, neighbour, getTheme(state.themeId).canvas.background);
    }
    void get().saveCurrentProject({ silent: true });
  },

  selectSlide: (id) => {
    const state = get();
    if (state.activeSlideId === id) return;

    const slides = commitActiveSlide(state);
    const target = slides.find((slide) => slide.id === id);
    if (!target) return;

    set({ slides });
    loadSlide(set, target, getTheme(state.themeId).canvas.background);
  },

  renameSlide: (id, name) => {
    const trimmed = name.trim() || UNTITLED_SLIDE_NAME;
    set({
      slides: get().slides.map((slide) => (slide.id === id ? { ...slide, name: trimmed } : slide)),
    });
    void get().saveCurrentProject({ silent: true });
  },

  moveSlide: (id, direction) => {
    const slides = commitActiveSlide(get());
    const index = slides.findIndex((slide) => slide.id === id);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= slides.length) return;

    const next = [...slides];
    [next[index], next[target]] = [next[target], next[index]];
    set({ slides: next });
    void get().saveCurrentProject({ silent: true });
  },

  setPresenting: (presenting) => set({ presenting }),

  stepSlide: (direction) => {
    const state = get();
    const index = state.slides.findIndex((slide) => slide.id === state.activeSlideId);
    const target = state.slides[index + direction];
    if (target) get().selectSlide(target.id);
  },

  setActiveTool: (tool) => {
    getCanvasApi()?.setActiveTool({ type: tool });
    set({ activeTool: tool });
  },

  newProject: () => {
    const slide = blankSlide("Slide 1");
    set({
      slides: [slide],
      activeSlideId: slide.id,
      text: "",
      spec: null,
      layout: null,
      elements: [],
      sceneAppState: null,
      warnings: [],
      lastMeta: null,
      sceneDirty: false,
      currentProjectId: null,
      currentProjectName: UNTITLED_PROJECT_NAME,
      error: null,
    });
    const api = getCanvasApi();
    if (api) {
      applyingScene = true;
      api.updateScene({ elements: [] });
      queueMicrotask(() => {
        applyingScene = false;
      });
    }
  },

  saveCurrentProject: async (options) => {
    const state = get();
    if (!state.storageAvailable) return;

    const slides = commitActiveSlide(state);
    if (slides.every((slide) => slide.diagramSpec === null)) return;

    const now = new Date().toISOString();
    const id = state.currentProjectId ?? createProjectId();
    const project: SavedProject = {
      id,
      name: state.currentProjectName || slides[0]?.diagramSpec?.title || UNTITLED_PROJECT_NAME,
      slides,
      activeSlideId: state.activeSlideId,
      theme: state.themeId,
      model: state.model,
      createdAt: state.currentProjectId
        ? (state.projects.find((p) => p.id === id)?.createdAt ?? now)
        : now,
      updatedAt: now,
    };

    set({ slides });

    if (!options?.silent) set({ saveStatus: "saving" });
    try {
      await saveProject(project);
      set({ currentProjectId: id, saveStatus: "saved" });
      await get().refreshProjects();
    } catch (error) {
      const appError = toAppError(error, "storage_unavailable");
      set({
        saveStatus: appError.code === "storage_unavailable" ? "unavailable" : "idle",
        storageAvailable: appError.code !== "storage_unavailable",
        ...(options?.silent ? {} : { error: appError }),
      });
    }
  },

  openProject: async (id) => {
    try {
      const project = await getProject(id);
      if (!project) return;

      const theme = getTheme(project.theme);
      const active =
        project.slides.find((slide) => slide.id === project.activeSlideId) ?? project.slides[0];

      set({
        currentProjectId: project.id,
        currentProjectName: project.name,
        slides: project.slides,
        activeSlideId: active?.id ?? null,
        text: active?.originalText ?? "",
        spec: active?.diagramSpec ?? null,
        elements: (active?.excalidrawElements ?? []) as ExcalidrawElement[],
        sceneAppState: (active?.appState ?? null) as Partial<ExcalidrawAppState> | null,
        themeId: theme.id,
        model: project.model || get().model,
        warnings: [],
        sceneDirty: false,
        error: null,
      });

      pushScene((active?.excalidrawElements ?? []) as ExcalidrawElement[], theme.canvas.background);
    } catch (error) {
      set({ error: toAppError(error, "storage_unavailable") });
    }
  },

  removeProject: async (id) => {
    try {
      await deleteStoredProject(id);
      if (get().currentProjectId === id) get().newProject();
      await get().refreshProjects();
    } catch (error) {
      set({ error: toAppError(error, "storage_unavailable") });
    }
  },

  renameCurrentProject: async (name) => {
    const trimmed = name.trim() || "Untitled diagram";
    set({ currentProjectName: trimmed });
    const id = get().currentProjectId;
    if (!id) return;
    try {
      await renameStoredProject(id, trimmed);
      await get().refreshProjects();
    } catch (error) {
      set({ error: toAppError(error, "storage_unavailable") });
    }
  },

  duplicateProject: async (id) => {
    try {
      await duplicateStoredProject(id);
      await get().refreshProjects();
    } catch (error) {
      set({ error: toAppError(error, "storage_unavailable") });
    }
  },

  refreshProjects: async () => {
    try {
      const projects = await listProjects(get().projectSearch);
      set({ projects });
    } catch (error) {
      log.warn("store", "could not list projects", error);
      set({ projects: [], storageAvailable: false, saveStatus: "unavailable" });
    }
  },

  setProjectSearch: (projectSearch) => {
    set({ projectSearch });
    void get().refreshProjects();
  },

  exportProjectBackup: async (id) => {
    const project = await getProject(id);
    return project ? serializeProjectBackup(project) : null;
  },

  exportCurrent: async (format) => {
    const state = get();
    try {
      await exportDiagram({
        format,
        scale: state.exportScale,
        transparent: state.transparentBackground,
        elements: state.elements,
        appState: state.sceneAppState ?? {},
        files: state.files,
        theme: getTheme(state.themeId),
        spec: state.spec,
      });
    } catch (error) {
      set({ error: toAppError(error, "export_failed") });
    }
  },

  copyPng: async () => {
    const state = get();
    try {
      await copyPngToClipboard({
        scale: state.exportScale,
        transparent: state.transparentBackground,
        elements: state.elements,
        appState: state.sceneAppState ?? {},
        files: state.files,
        theme: getTheme(state.themeId),
        spec: state.spec,
      });
    } catch (error) {
      set({ error: toAppError(error, "export_failed") });
    }
  },
}));

/**
 * The active slide is edited through the top-level `text`/`spec`/`elements`
 * fields rather than inside the array, so every read of the deck has to fold
 * those live values back into it first.
 */
function commitActiveSlide(state: AppStore): SavedSlide[] {
  const live: Omit<SavedSlide, "id" | "name"> = {
    originalText: state.text,
    diagramSpec: state.spec,
    excalidrawElements: state.elements,
    appState: state.sceneAppState,
  };

  if (!state.activeSlideId || state.slides.length === 0) {
    const slide = blankSlide("Slide 1");
    return [{ ...slide, ...live }];
  }

  return state.slides.map((slide) =>
    slide.id === state.activeSlideId ? { ...slide, ...live } : slide,
  );
}

function blankSlide(name: string): SavedSlide {
  return {
    id: createProjectId(),
    name,
    originalText: "",
    diagramSpec: null,
    excalidrawElements: [],
    appState: null,
  };
}

/** Swaps a slide's stored content into the live editing fields and repaints. */
function loadSlide(
  set: (partial: Partial<AppStore>) => void,
  slide: SavedSlide,
  background: string,
): void {
  set({
    activeSlideId: slide.id,
    text: slide.originalText,
    spec: slide.diagramSpec,
    layout: null,
    elements: slide.excalidrawElements as ExcalidrawElement[],
    sceneAppState: slide.appState as Partial<ExcalidrawAppState> | null,
    warnings: [],
    sceneDirty: false,
  });
  pushScene(slide.excalidrawElements as ExcalidrawElement[], background);
}

function pushScene(elements: ExcalidrawElement[], background: string): void {
  const api = getCanvasApi();
  if (!api) return;

  applyingScene = true;
  api.updateScene({ elements, appState: { viewBackgroundColor: background } });
  // Let the scene settle before fitting it, otherwise bounds are stale.
  requestAnimationFrame(() => {
    api.scrollToContent(elements, { fitToContent: true, animate: false });
    applyingScene = false;
  });
}

function scheduleAutosave(get: () => AppStore): void {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null;
    const state = get();
    if (state.spec && state.storageAvailable) void state.saveCurrentProject({ silent: true });
  }, 900);
}
