import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/domains/")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
