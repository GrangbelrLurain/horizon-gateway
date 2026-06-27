import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/sandbox/")({
  beforeLoad: () => {
    throw redirect({ to: "/sandbox/pipeline" });
  },
});
