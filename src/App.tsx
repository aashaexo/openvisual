import { useEffect, useState } from "react";
import { CanvasPanel } from "@/components/canvas/CanvasPanel";
import { PresentMode } from "@/components/canvas/PresentMode";
import { InputPanel } from "@/components/editor/InputPanel";
import { OnboardingDialog } from "@/components/onboarding/OnboardingDialog";
import { ProjectsDrawer } from "@/components/projects/ProjectsDrawer";
import { useAppStore } from "@/store/appStore";
import { applyThemeVariables, getTheme } from "@/themes";

export default function App() {
  const [projectsOpen, setProjectsOpen] = useState(false);

  const themeId = useAppStore((s) => s.themeId);
  const appearance = useAppStore((s) => s.resolvedAppearance);
  const initialise = useAppStore((s) => s.initialise);
  const setOnboardingOpen = useAppStore((s) => s.setOnboardingOpen);

  useEffect(() => {
    void initialise();
  }, [initialise]);

  /*
   * Starting Ollama after the app is already open is the normal way round —
   * you see the "not running" message, go and start it, and come back. Without
   * this the app would still be showing the stale error, so the environment is
   * re-checked whenever the window regains attention. Only while it is down:
   * once Ollama answers, this stops doing anything.
   */
  useEffect(() => {
    const recheck = () => {
      const state = useAppStore.getState();
      if (state.ollamaStatus?.running || state.environmentChecking) return;
      void state.refreshEnvironment();
    };

    // A focus event already means the window has the user's attention, so it
    // needs no visibility test; visibilitychange does, since it also fires on
    // the way out.
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") recheck();
    };

    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    applyThemeVariables(getTheme(themeId), appearance, document.documentElement);
  }, [themeId, appearance]);

  return (
    <div className="flex h-full w-full overflow-hidden" style={{ background: "var(--ov-bg)" }}>
      <InputPanel
        onOpenProjects={() => setProjectsOpen(true)}
        onOpenSetup={() => setOnboardingOpen(true)}
      />
      <CanvasPanel />

      <PresentMode />
      <OnboardingDialog />
      <ProjectsDrawer open={projectsOpen} onClose={() => setProjectsOpen(false)} />
    </div>
  );
}
