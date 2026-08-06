import { createFileRoute } from "@tanstack/react-router";
import { TeamWorkspaceShell } from "@/entities/team";

export const Route = createFileRoute("/team/")({
  component: TeamPage,
});

function TeamPage() {
  return (
    <div className="flex flex-col h-full min-h-0 w-full overflow-hidden">
      <TeamWorkspaceShell />
    </div>
  );
}
