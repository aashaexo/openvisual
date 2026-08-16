import { useEffect, useState } from "react";
import { CanvasPanel } from "@/components/canvas/CanvasPanel";
import { InputPanel } from "@/components/editor/InputPanel";
import { OnboardingDialog } from "@/components/onboarding/OnboardingDialog";
import { ProjectsDrawer } from "@/components/projects/ProjectsDrawer";
import { useAppStore } from "@/store/appStore";
import { applyThemeVariables, getTheme } from "@/themes";

export default function App() {
  const [projectsOpen, setProjectsOpen] = useState(false);

  const themeId = useAppStore((s) => s.themeId);
  const initialise = useAppStore((s) => s.initialise);
  const setOnboardingOpen = useAppStore((s) => s.setOnboardingOpen);

  useEffect(() => {
    void initialise();
  }, [initialise]);

  useEffect(() => {
    applyThemeVariables(getTheme(themeId), document.documentElement);
  }, [themeId]);

  return (
    <div className="flex h-full w-full overflow-hidden" style={{ background: "var(--ov-bg)" }}>
      <InputPanel
        onOpenProjects={() => setProjectsOpen(true)}
        onOpenSetup={() => setOnboardingOpen(true)}
      />
      <CanvasPanel />

      <OnboardingDialog />
      <ProjectsDrawer open={projectsOpen} onClose={() => setProjectsOpen(false)} />
    </div>
  );
}
