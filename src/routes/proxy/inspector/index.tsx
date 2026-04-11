import { createFileRoute } from "@tanstack/react-router";
import { InspectorPanel } from "@/features/inspector/ui/InspectorPanel";

export const Route = createFileRoute("/proxy/inspector/")({
  component: InspectorPage,
});

function InspectorPage() {
  return <InspectorPanel />;
}
