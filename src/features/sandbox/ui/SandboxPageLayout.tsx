import { Link, useRouterState } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { FlaskConical, GitBranch, Lock, Tv } from "lucide-react";
import type { ReactNode } from "react";
import { languageAtom } from "@/entities/app";
import { H1, P } from "@/shared/ui/typography/typography";

interface SandboxPageLayoutProps {
  children: ReactNode;
}

const TABS = [
  { to: "/sandbox/pipeline", icon: GitBranch, labelEn: "Data Pipeline", labelKo: "데이터 파이프라인" },
  { to: "/sandbox/crypto", icon: Lock, labelEn: "Crypto Tool", labelKo: "암복호화 & 유틸" },
  { to: "/sandbox/preview", icon: Tv, labelEn: "UI Preview", labelKo: "실시간 UI 프리뷰" },
] as const;

export function SandboxPageLayout({ children }: SandboxPageLayoutProps) {
  const lang = useAtomValue(languageAtom);
  const isKo = lang === "ko";
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const title = isKo ? "샌드박스 플레이그라운드" : "Sandbox Playground";
  const subtitle = isKo
    ? "데이터 흐름 파이프라인 설계, 실시간 암복호화, 동적 React UI 바인딩 등 강력한 도구들을 활용하세요."
    : "Design pipelines, encode/decode data, and render real-time React UIs dynamically.";

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-10rem)] overflow-hidden">
      <header className="shrink-0 flex flex-col md:flex-row md:items-center md:justify-between border-b border-base-200 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 text-primary rounded-lg">
            <FlaskConical className="w-5 h-5" />
          </div>
          <div>
            <H1 className="text-2xl font-bold tracking-tight text-base-content">{title}</H1>
            <P className="text-base-content/60 text-xs font-medium">{subtitle}</P>
          </div>
        </div>

        <nav className="tabs tabs-boxed mt-3 md:mt-0 font-sans">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = pathname === tab.to || pathname === `${tab.to}/`;
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={`tab tab-sm font-bold flex items-center gap-1.5 ${
                  isActive ? "tab-active bg-primary text-primary-content" : ""
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {isKo ? tab.labelKo : tab.labelEn}
              </Link>
            );
          })}
        </nav>
      </header>

      <div className="flex-1 overflow-hidden mt-2">{children}</div>
    </div>
  );
}
