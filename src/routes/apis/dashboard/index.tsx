import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/apis/dashboard/")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
