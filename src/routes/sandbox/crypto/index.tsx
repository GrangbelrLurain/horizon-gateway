import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { CryptoNode } from "@/entities/sandbox";
import { HandoffBanner, pickHandoffPayload, useApiExchangeHandoffEffect } from "@/features/panel-stack";
import { SandboxPageLayout } from "@/features/sandbox";

export const Route = createFileRoute("/sandbox/crypto/")({
  component: SandboxCryptoPage,
});

function SandboxCryptoPage() {
  const [payload, setPayload] = useState("");

  useApiExchangeHandoffEffect(
    useCallback((handoff) => {
      setPayload(pickHandoffPayload(handoff));
    }, []),
  );

  return (
    <SandboxPageLayout>
      <div className="px-4 pt-2">
        <HandoffBanner />
      </div>
      <CryptoNode isStandalone payload={payload} onChangePayload={setPayload} />
    </SandboxPageLayout>
  );
}
