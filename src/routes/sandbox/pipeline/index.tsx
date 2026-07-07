import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSetAtom } from "jotai";
import { livePreviewDataAtom } from "@/entities/sandbox";
import { FlowBuilder, PipelineLibraryPanel, SandboxPageLayout } from "@/features/sandbox";

export const Route = createFileRoute("/sandbox/pipeline/")({
  component: SandboxPipelinePage,
});

function SandboxPipelinePage() {
  const navigate = useNavigate();
  const setPreviewData = useSetAtom(livePreviewDataAtom);

  const handleExportToPreview = (data: unknown) => {
    setPreviewData(data);
    navigate({ to: "/sandbox/preview" });
  };

  return (
    <SandboxPageLayout>
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 w-full h-full min-h-0 items-stretch overflow-hidden">
        <div className="xl:col-span-1 h-full min-h-[280px] xl:min-h-0 overflow-hidden">
          <PipelineLibraryPanel />
        </div>
        <div className="xl:col-span-3 h-full min-h-0 overflow-hidden">
          <FlowBuilder onExportPreviewData={handleExportToPreview} />
        </div>
      </div>
    </SandboxPageLayout>
  );
}
