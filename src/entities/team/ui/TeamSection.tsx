import { TeamWorkspaceShell } from "./TeamWorkspaceShell";

/** @deprecated Use TeamWorkspaceShell. Kept so existing imports keep working. */
export function TeamSection() {
  return (
    <div className="h-[min(80vh,720px)] min-h-[480px] rounded-xl border border-base-200 overflow-hidden">
      <TeamWorkspaceShell />
    </div>
  );
}
