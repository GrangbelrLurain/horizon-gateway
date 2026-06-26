import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/shared/ui/button/Button";
import { Card } from "@/shared/ui/card/card";
import type { SetupStep } from "../types";

interface SetupProgressCardProps {
  steps: SetupStep[];
  lang: "ko" | "en";
  onDismiss: () => void;
}

const SETUP_T = {
  ko: {
    title: "시작하기",
    subtitle: "아래 단계를 완료하면 Watchtower의 모든 기능을 사용할 수 있어요.",
    done: "완료",
    skip: "건너뛰기",
  },
  en: {
    title: "Getting Started",
    subtitle: "Complete the steps below to unlock all Watchtower features.",
    done: "Done",
    skip: "Skip",
  },
};

export function SetupProgressCard({ steps, lang, onDismiss }: SetupProgressCardProps) {
  const t = SETUP_T[lang];
  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;

  if (allDone) {
    return null;
  }

  return (
    <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 shadow-xl shadow-primary/5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-black text-base-content tracking-tight">{t.title}</h2>
          <p className="text-sm text-base-content/60 mt-0.5">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-primary bg-primary/20 px-3 py-1 rounded-full">
            {completedCount}/{steps.length}
          </span>
          <button
            type="button"
            onClick={onDismiss}
            className="p-1.5 text-base-content/40 hover:text-base-content/80 hover:bg-base-content/5 rounded-lg transition-colors group"
            title={t.skip}
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="w-full bg-primary/10 rounded-full h-1.5 mb-5 overflow-hidden">
        <div
          className="bg-primary h-1.5 rounded-full transition-all duration-700"
          style={{ width: `${(completedCount / steps.length) * 100}%` }}
        />
      </div>

      <div className="flex flex-col gap-3">
        {steps.map((step, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 p-3 rounded-xl transition-all border ${
              step.done
                ? "bg-transparent border-transparent opacity-40 grayscale"
                : "bg-base-100 border-primary/10 shadow-sm"
            }`}
          >
            {step.done ? (
              <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
            ) : (
              <div className="w-5 h-5 rounded-full border-2 border-primary/30 shrink-0 flex items-center justify-center">
                <span className="text-[10px] font-bold text-primary/60">{i + 1}</span>
              </div>
            )}
            <span
              className={`text-sm flex-1 ${step.done ? "text-base-content/40 line-through" : "text-base-content font-bold"}`}
            >
              {step.label}
            </span>
            {!step.done && (
              <Link to={step.href}>
                <Button variant="primary" size="sm" className="gap-1 shrink-0 text-xs h-7 px-4">
                  {step.actionLabel}
                  <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
