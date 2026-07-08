import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/monitor/settings/")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
