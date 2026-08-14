import { createFileRoute } from "@tanstack/react-router";
import { MobileConnectionContent } from "@/features/mobile-connection";
import { useEmbedMode } from "@/shared/lib/tauri/useEmbedMode";

export const Route = createFileRoute("/proxy/mobile/")({
  component: ProxyMobileRoutePage,
});

function ProxyMobileRoutePage() {
  const embedMode = useEmbedMode();
  return <MobileConnectionContent embedded={embedMode !== "standalone"} />;
}
