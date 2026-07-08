import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/proxy/dashboard/")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
