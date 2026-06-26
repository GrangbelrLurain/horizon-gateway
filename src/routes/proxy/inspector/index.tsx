import { createFileRoute } from "@tanstack/react-router";
import { InspectorPanel, useInspectorPanel } from "@/features/inspector";

export const Route = createFileRoute("/proxy/inspector/")({
  component: InspectorPage,
});

function InspectorPage() {
  const panel = useInspectorPanel();
  return <InspectorPanel {...panel} />;
}
