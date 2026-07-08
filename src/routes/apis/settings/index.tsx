import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/apis/settings/")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
