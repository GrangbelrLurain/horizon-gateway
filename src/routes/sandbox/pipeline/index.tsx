import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSetAtom } from "jotai";
import { livePreviewDataAtom } from "@/entities/sandbox";
import { FlowBuilder, SandboxPageLayout } from "@/features/sandbox";

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
      <FlowBuilder onExportPreviewData={handleExportToPreview} />
    </SandboxPageLayout>
  );
}
