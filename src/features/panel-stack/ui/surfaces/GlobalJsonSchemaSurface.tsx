import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { importPropertiesFromJson } from "@/features/sandbox";
import { HubSurfaceEmbedProvider } from "@/shared/lib/hub/HubSurfaceEmbedContext";
import { useApiExchangeHandoffEffect } from "../../hooks/useHubHandoff";
import { pickHandoffPayload } from "../../lib/inferSchemaFromJson";
import { hubJsonSchemaSeedAtom } from "../../store";
import { HandoffBanner } from "../HandoffBanner";
import { GlobalRouteEmbed } from "./GlobalRouteEmbed";

function GlobalJsonSchemaSurfaceInner() {
  const setSeed = useSetAtom(hubJsonSchemaSeedAtom);

  useApiExchangeHandoffEffect(
    useCallback(
      (handoff) => {
        const raw = pickHandoffPayload(handoff);
        if (!raw.trim()) {
          return;
        }

        let path = handoff.url;
        try {
          path = new URL(handoff.url).pathname;
        } catch {
          // keep url
        }

        let properties: ReturnType<typeof importPropertiesFromJson> = [];
        try {
          properties = importPropertiesFromJson(JSON.parse(raw));
        } catch {
          // invalid json — seed with empty properties; user can paste manually
        }

        setSeed({
          title: `${handoff.method} ${path}`,
          description: handoff.source.label,
          properties,
          sampleJson: raw,
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
        <GlobalRouteEmbed route="/apis/json-schema" />
      </div>
    </div>
  );
}

export function GlobalJsonSchemaSurface() {
  return (
    <HubSurfaceEmbedProvider>
      <GlobalJsonSchemaSurfaceInner />
    </HubSurfaceEmbedProvider>
  );
}
