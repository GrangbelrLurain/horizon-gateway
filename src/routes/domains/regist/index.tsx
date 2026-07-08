import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/domains/regist/")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
