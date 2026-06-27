import { createFileRoute } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { livePreviewDataAtom } from "@/entities/sandbox";
import { LivePreviewer, SandboxPageLayout } from "@/features/sandbox";

export const Route = createFileRoute("/sandbox/preview/")({
  component: SandboxPreviewPage,
});

function SandboxPreviewPage() {
  const previewData = useAtomValue(livePreviewDataAtom);

  return (
    <SandboxPageLayout>
      <LivePreviewer initialData={previewData ?? undefined} />
    </SandboxPageLayout>
  );
}
