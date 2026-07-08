import { useCallback, useState } from "react";
import { CryptoNode } from "@/entities/sandbox";
import { HubSurfaceEmbedProvider } from "@/shared/lib/hub/HubSurfaceEmbedContext";
import { useApiExchangeHandoffEffect } from "../../hooks/useHubHandoff";
import { pickHandoffPayload } from "../../lib/inferSchemaFromJson";
import { HandoffBanner } from "../HandoffBanner";

function GlobalCryptoSurfaceInner() {
  const [payload, setPayload] = useState("");

  useApiExchangeHandoffEffect(
    useCallback((handoff) => {
      setPayload(pickHandoffPayload(handoff));
    }, []),
  );

  return (
    <div className="p-4 h-full min-h-0 overflow-y-auto space-y-3">
      <HandoffBanner />
      <CryptoNode isStandalone payload={payload} onChangePayload={setPayload} />
    </div>
  );
}

export function GlobalCryptoSurface() {
  return (
    <HubSurfaceEmbedProvider>
      <GlobalCryptoSurfaceInner />
    </HubSurfaceEmbedProvider>
  );
}
