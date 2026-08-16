import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { IconButton } from "@/components/ui/IconButton";
import { CopyIcon, DownloadIcon, FolderIcon, TrashIcon } from "@/components/ui/Icons";
import { useAppStore } from "@/store/appStore";
import { importDiagramJson, importExcalidrawScene } from "@/storage";
import { saveBlob, suggestFileName } from "@/export";
import { toAppError } from "@/utils/errors";

interface ProjectsDrawerProps {
  open: boolean;
  onClose: () => void;
}

/** Project library: search, open, rename, duplicate, delete, import, back up. */
export function ProjectsDrawer({ open, onClose }: ProjectsDrawerProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const projects = useAppStore((s) => s.projects);
  const search = useAppStore((s) => s.projectSearch);
  const setSearch = useAppStore((s) => s.setProjectSearch);
  const refreshProjects = useAppStore((s) => s.refreshProjects);
  const openProject = useAppStore((s) => s.openProject);
  const removeProject = useAppStore((s) => s.removeProject);
  const duplicateProject = useAppStore((s) => s.duplicateProject);
  const exportProjectBackup = useAppStore((s) => s.exportProjectBackup);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const storageAvailable = useAppStore((s) => s.storageAvailable);
  const newProject = useAppStore((s) => s.newProject);
  const applySpec = useAppStore((s) => s.applySpec);

  useEffect(() => {
    if (open) void refreshProjects();
  }, [open, refreshProjects]);

  const handleImport = async (file: File) => {
    try {
      const raw: unknown = JSON.parse(await file.text());
      if (file.name.endsWith(".excalidraw")) {
        // A scene has no semantics behind it, so it is opened as a drawing only.
        const scene = importExcalidrawScene(raw);
        useAppStore.setState({
          elements: scene.elements as never,
          currentProjectId: null,
          currentProjectName: file.name.replace(/\.excalidraw$/, ""),
          sceneDirty: true,
        });
        onClose();
        return;
      }
      const spec = importDiagramJson(raw);
      newProject();
      await applySpec(spec);
      onClose();
    } catch (error) {
      useAppStore.setState({ error: toAppError(error) });
    }
  };

  const backup = async (id: string, name: string) => {
    try {
      const json = await exportProjectBackup(id);
      if (!json) return;
      await saveBlob(
        new Blob([json], { type: "application/json" }),
        suggestFileName(name, ".json"),
      );
    } catch (error) {
      useAppStore.setState({ error: toAppError(error, "export_failed") });
    }
  };

  return (
    <Modal
      open={open}
      title="Saved projects"
      description="Everything here is stored in this app's local database on your computer."
      onClose={onClose}
      width="lg"
      footer={
        <>
          <input
            ref={fileInput}
            type="file"
            accept=".json,.excalidraw,application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleImport(file);
              event.target.value = "";
            }}
          />
          <button type="button" className="ov-btn" onClick={() => fileInput.current?.click()}>
            Import diagram or scene
          </button>
          <button
            type="button"
            className="ov-btn"
            onClick={() => {
              newProject();
              onClose();
            }}
          >
            New diagram
          </button>
        </>
      }
    >
      {!storageAvailable ? (
        <p className="text-sm" style={{ color: "var(--ov-muted)" }}>
          Local storage is unavailable in this environment, so projects cannot be saved. Your
          current diagram still works and can be exported.
        </p>
      ) : (
        <>
          <label className="sr-only" htmlFor="ov-project-search">
            Search projects
          </label>
          <input
            id="ov-project-search"
            className="ov-input mb-3"
            type="search"
            placeholder="Search by name or text…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          {projects.length === 0 ? (
            <p className="py-8 text-center text-sm" style={{ color: "var(--ov-muted)" }}>
              {search ? "No projects match that search." : "Nothing saved yet."}
            </p>
          ) : (
            <ul className="space-y-2">
              {projects.map((project) => (
                <li
                  key={project.id}
                  className="ov-panel flex items-center gap-3 rounded-xl border p-3"
                  style={{
                    borderColor:
                      project.id === currentProjectId ? "var(--ov-accent)" : "var(--ov-border)",
                  }}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    onClick={() => {
                      void openProject(project.id);
                      onClose();
                    }}
                  >
                    <span style={{ color: "var(--ov-muted)" }} aria-hidden="true">
                      <FolderIcon />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{project.name}</span>
                      <span className="block truncate text-xs" style={{ color: "var(--ov-muted)" }}>
                        {project.diagramSpec.type.replace("_", " ")} ·{" "}
                        {new Date(project.updatedAt).toLocaleString()}
                      </span>
                    </span>
                  </button>

                  <div className="flex shrink-0 items-center gap-1">
                    <IconButton label="Duplicate" onClick={() => void duplicateProject(project.id)}>
                      <CopyIcon />
                    </IconButton>
                    <IconButton
                      label="Export backup"
                      onClick={() => void backup(project.id, project.name)}
                    >
                      <DownloadIcon />
                    </IconButton>
                    {confirmingId === project.id ? (
                      <span className="flex items-center gap-1">
                        <button
                          type="button"
                          className="ov-btn ov-btn-danger px-2 py-1 text-xs"
                          onClick={() => {
                            void removeProject(project.id);
                            setConfirmingId(null);
                          }}
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          className="ov-btn px-2 py-1 text-xs"
                          onClick={() => setConfirmingId(null)}
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <IconButton
                        label="Delete project"
                        className="ov-btn-danger"
                        onClick={() => setConfirmingId(project.id)}
                      >
                        <TrashIcon />
                      </IconButton>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Modal>
  );
}
