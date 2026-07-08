/**
 * Contextual Empty State component
 * Shows different content based on why data is empty:
 * - Tier 1: No domains registered at all
 * - Tier 2: Feature-specific prerequisite not met
 * - Tier 3: Setup complete, just no data yet
 */
import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { openPopupWindow } from "@/shared/lib/tauri/openPopupWindow";
import { Button } from "@/shared/ui/button/Button";

export interface EmptyStateTier1Props {
  tier: 1;
  lang?: "ko" | "en";
}

export interface EmptyStateTier2Props {
  tier: 2;
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}

export interface EmptyStateTier3Props {
  tier: 3;
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export type EmptyStateProps = EmptyStateTier1Props | EmptyStateTier2Props | EmptyStateTier3Props;

const KO_T1 = {
  title: "아직 등록된 도메인이 없어요",
  description: "이 기능을 사용하려면 먼저 도메인을 등록해야 합니다.",
  action: "도메인 등록하기",
};
const EN_T1 = {
  title: "No domains registered yet",
  description: "To use this feature, you need to register a domain first.",
  action: "Register a Domain",
};

export function EmptyState(props: EmptyStateProps) {
  if (props.tier === 1) {
    const t = props.lang === "ko" ? KO_T1 : EN_T1;
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center gap-5 bg-base-100 rounded-3xl border border-base-200 shadow-sm">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-indigo-500/10 flex items-center justify-center">
            <svg
              className="w-10 h-10 text-indigo-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253"
              />
            </svg>
          </div>
          <div className="absolute -right-1 -bottom-1 w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
            <span className="text-amber-500 text-xs font-bold">!</span>
          </div>
        </div>
        <div className="max-w-xs">
          <h3 className="text-lg font-bold text-base-content mb-1">{t.title}</h3>
          <p className="text-sm text-base-content/40 leading-relaxed">{t.description}</p>
        </div>
        <Button
          variant="primary"
          className="gap-2 flex items-center shadow-lg shadow-indigo-500/20"
          onClick={() => void openPopupWindow("add-domain")}
        >
          {t.action}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  if (props.tier === 2) {
    const Icon = props.icon;
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center gap-5 bg-base-100 rounded-3xl border border-base-200 shadow-sm">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-base-200/50 flex items-center justify-center">
            <Icon className="w-9 h-9 text-base-content/20" />
          </div>
          <div className="absolute -right-1 -bottom-1 w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
            <span className="text-amber-500 text-xs font-bold">!</span>
          </div>
        </div>
        <div className="max-w-xs">
          <h3 className="text-lg font-bold text-base-content mb-1">{props.title}</h3>
          <p className="text-sm text-base-content/40 leading-relaxed">{props.description}</p>
        </div>
        <Link to={props.actionHref}>
          <Button variant="primary" className="gap-2 flex items-center">
            {props.actionLabel}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    );
  }

  // Tier 3 — normal "no data" state
  const Icon = props.icon;
  return (
    <div className="py-16 flex flex-col items-center justify-center text-center gap-4 bg-base-100 rounded-3xl border border-base-200 shadow-sm">
      <div className="w-16 h-16 rounded-full bg-base-200/50 flex items-center justify-center">
        <Icon className="w-8 h-8 text-base-content/20" />
      </div>
      <div className="max-w-xs">
        <h3 className="text-base font-bold text-base-content/80 mb-1">{props.title}</h3>
        <p className="text-sm text-base-content/40 leading-relaxed">{props.description}</p>
      </div>
      {props.actionLabel && props.onAction && (
        <Button variant="secondary" onClick={props.onAction} className="mt-1">
          {props.actionLabel}
        </Button>
      )}
    </div>
  );
}
