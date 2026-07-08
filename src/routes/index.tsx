import { createFileRoute } from "@tanstack/react-router";
import { DomainHubPage, type HubSearchParams } from "@/features/panel-stack";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): HubSearchParams => ({
    d:
      typeof search.d === "number"
        ? search.d
        : typeof search.d === "string"
          ? Number(search.d) || undefined
          : undefined,
    p: typeof search.p === "string" ? search.p : undefined,
    logId: typeof search.logId === "string" ? search.logId : undefined,
    g: typeof search.g === "string" ? search.g : undefined,
  }),
  component: DomainHubPage,
});
