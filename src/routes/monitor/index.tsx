import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/monitor/")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
