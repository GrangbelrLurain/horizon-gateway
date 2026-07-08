import { useSetAtom } from "jotai";
import { lazy, Suspense, useCallback } from "react";
import { HubSurfaceEmbedProvider } from "@/shared/lib/hub/HubSurfaceEmbedContext";
import { getRouteSurfaceLoader } from "@/shared/lib/hub/routeSurfaceRegistry";
import { normalizeRequestPath } from "@/shared/lib/openapi-parser";
import { LoadingScreen } from "@/shared/ui/loader/LoadingScreen";
import { useApiExchangeHandoffEffect } from "../../hooks/useHubHandoff";
import { hubSchemaExplorerSeedAtom } from "../../store";
import { HandoffBanner } from "../HandoffBanner";

const ApiSchemaPage = lazy(() => {
  const loader = getRouteSurfaceLoader("/apis/schema");
  if (!loader) {
    return Promise.reject(new Error("Schema route surface is not registered"));
  }
  return loader();
});

function GlobalSchemaExplorerSurfaceInner() {
  const setSeed = useSetAtom(hubSchemaExplorerSeedAtom);

  useApiExchangeHandoffEffect(
    useCallback(
      (handoff) => {
        setSeed({
          domainId: handoff.source.domainId,
          method: handoff.method,
          path: normalizeRequestPath(handoff.url),
          sourceLabel: handoff.source.label,
        });
      },
      [setSeed],
    ),
  );

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="px-4 pt-3 shrink-0">
        <HandoffBanner />
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <Suspense fallback={<LoadingScreen />}>
          <ApiSchemaPage />
        </Suspense>
      </div>
    </div>
  );
}

export function GlobalSchemaExplorerSurface() {
  return (
    <HubSurfaceEmbedProvider>
      <GlobalSchemaExplorerSurfaceInner />
    </HubSurfaceEmbedProvider>
  );
}
