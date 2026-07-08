import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/proxy/setup/")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
