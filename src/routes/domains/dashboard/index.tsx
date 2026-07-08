import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/domains/dashboard/")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
