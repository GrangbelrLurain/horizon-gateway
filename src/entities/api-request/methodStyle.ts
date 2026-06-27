export type MethodBadgeColor = "green" | "blue" | "amber" | "red" | "slate";

const METHOD_COLORS: Record<string, { color: MethodBadgeColor; bg: string }> = {
  get: { color: "green", bg: "bg-success/10 border-success/20" },
  post: { color: "blue", bg: "bg-info/10 border-info/20" },
  put: { color: "amber", bg: "bg-warning/10 border-warning/20" },
  delete: { color: "red", bg: "bg-error/10 border-error/20" },
  patch: { color: "amber", bg: "bg-warning/10 border-warning/20" },
};

export function methodStyle(method: string) {
  return METHOD_COLORS[method.toLowerCase()] ?? { color: "slate" as const, bg: "bg-base-200 border-base-300" };
}
