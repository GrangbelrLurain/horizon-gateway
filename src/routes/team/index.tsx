import { createFileRoute } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { Lock, Users } from "lucide-react";
import { languageAtom, supabaseSessionAtom } from "@/entities/app";
import { TeamSection } from "@/entities/team";
import { useIsHubSurfaceEmbed } from "@/shared/lib/hub/HubSurfaceEmbedContext";
import { useIsEmbeddedPage } from "@/shared/lib/tauri/useEmbedMode";

export const Route = createFileRoute("/team/")({
  component: TeamPage,
});

function TeamPage() {
  const lang = useAtomValue(languageAtom);
  const session = useAtomValue(supabaseSessionAtom);
  const isEmbedded = useIsEmbeddedPage();
  const isHubEmbed = useIsHubSurfaceEmbed();
  const hideChrome = isEmbedded || isHubEmbed;
  const locked = !session;

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full animate-in fade-in duration-500 pb-20 px-4">
      {!hideChrome && (
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-black tracking-tight text-base-content flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            {lang === "ko" ? "팀 워크스페이스" : "Team Workspaces"}
          </h1>
          <p className="text-sm text-base-content/60 font-medium">
            {lang === "ko"
              ? "팀원과 도메인·그룹·mock 설정을 공유하고 seat를 관리합니다."
              : "Share domains, groups, and mock config with your team and manage seats."}
          </p>
        </header>
      )}

      {locked ? (
        <div className="bg-base-100 rounded-3xl border border-base-200 p-10 shadow-sm flex flex-col items-center justify-center text-center gap-4">
          <div className="p-4 bg-base-200 text-base-content/50 rounded-full">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-base-content">
              {lang === "ko" ? "팀 기능이 잠겨 있습니다" : "Team features are locked"}
            </h2>
            <p className="text-sm text-base-content/60 mt-2 max-w-md leading-relaxed">
              {lang === "ko"
                ? "GitHub로 로그인한 뒤 팀 워크스페이스를 만들고 결제·초대를 사용할 수 있습니다."
                : "Sign in with GitHub to create a team workspace, buy seats, and invite members."}
            </p>
          </div>
        </div>
      ) : (
        <TeamSection />
      )}
    </div>
  );
}
