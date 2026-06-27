import { createFileRoute } from "@tanstack/react-router";
import { CryptoNode } from "@/entities/sandbox";
import { SandboxPageLayout } from "@/features/sandbox";

export const Route = createFileRoute("/sandbox/crypto/")({
  component: SandboxCryptoPage,
});

function SandboxCryptoPage() {
  return (
    <SandboxPageLayout>
      <CryptoNode isStandalone={true} />
    </SandboxPageLayout>
  );
}
