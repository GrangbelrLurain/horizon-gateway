import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/domains/groups/")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
