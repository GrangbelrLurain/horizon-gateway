import { TeamWorkspaceShell } from "@/entities/team";

/** Detached / registry surface — same L→R shell as Hub full-view. */
export function ChromeTeamSurface() {
  return (
    <div className="flex flex-col h-full min-h-0 w-full overflow-hidden">
      <TeamWorkspaceShell />
    </div>
  );
}
