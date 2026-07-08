import { useNavigate } from "@tanstack/react-router";
import { useSetAtom } from "jotai";
import { useCallback } from "react";
import type { PipelineFlow } from "@/entities/pipeline";
import { sandboxActiveFlowAtom } from "@/entities/pipeline";
import { livePreviewDataAtom } from "@/entities/sandbox";
import { FlowBuilder, PipelineLibraryPanel } from "@/features/sandbox";
import { HubSurfaceEmbedProvider } from "@/shared/lib/hub/HubSurfaceEmbedContext";
import { useApiExchangeHandoffEffect } from "../../hooks/useHubHandoff";
import { pickHandoffPayload } from "../../lib/inferSchemaFromJson";
import { HandoffBanner } from "../HandoffBanner";

function seedFlowFromPayload(body: string): PipelineFlow {
  const id = `mapper_${Date.now()}`;
  let pretty = body;
  try {
    pretty = JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    // keep raw text
  }

  return {
    nodes: [
      {
        id,
        label: "API Response",
        type: "mapper",
        position: { x: 120, y: 120 },
        config: JSON.stringify({
          mappings: [{ targetKey: "body", sourceValue: pretty }],
          errorPolicy: "fastFail",
        }),
      },
    ],
    edges: [],
  };
}

function GlobalPipelineSurfaceInner() {
  const navigate = useNavigate();
  const setPreviewData = useSetAtom(livePreviewDataAtom);
  const setActiveFlow = useSetAtom(sandboxActiveFlowAtom);

  useApiExchangeHandoffEffect(
    useCallback(
      (handoff) => {
        const body = pickHandoffPayload(handoff);
        if (!body.trim()) {
          return;
        }
        setActiveFlow((prev) => ({
          ...prev,
          revision: prev.revision + 1,
          loadedFromId: null,
          updatedAt: Date.now(),
          flow: seedFlowFromPayload(body),
        }));
      },
      [setActiveFlow],
    ),
  );

  const handleExportToPreview = (data: unknown) => {
    setPreviewData(data);
    navigate({ to: "/sandbox/preview" });
  };

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="px-4 pt-3 shrink-0">
        <HandoffBanner />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 w-full flex-1 min-h-0 p-4 pt-2 overflow-hidden">
        <div className="xl:col-span-1 h-full min-h-[200px] xl:min-h-0 overflow-hidden">
          <PipelineLibraryPanel />
        </div>
        <div className="xl:col-span-3 h-full min-h-0 overflow-hidden">
          <FlowBuilder onExportPreviewData={handleExportToPreview} />
        </div>
      </div>
    </div>
  );
}

export function GlobalPipelineSurface() {
  return (
    <HubSurfaceEmbedProvider>
      <GlobalPipelineSurfaceInner />
    </HubSurfaceEmbedProvider>
  );
}
