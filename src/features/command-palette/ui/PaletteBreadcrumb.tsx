import { ChevronRight } from "lucide-react";
import type { PaletteCommandDef, PaletteStepDef } from "../types";

interface PaletteBreadcrumbProps {
  command: PaletteCommandDef;
  currentStep?: PaletteStepDef;
  stepIndex: number;
  totalSteps: number;
  lang: "ko" | "en";
}

export function PaletteBreadcrumb({ command, currentStep, stepIndex, totalSteps, lang }: PaletteBreadcrumbProps) {
  const label = command.meta.label[lang] || command.meta.label.en;
  const prompt = currentStep ? currentStep.prompt[lang] || currentStep.prompt.en : "";

  return (
    <div className="flex items-center gap-1.5 px-4 py-2 bg-base-200/50 border-b border-base-300 text-xs text-base-content/70">
      <span className="font-semibold text-primary">{label}</span>
      {currentStep && (
        <>
          <ChevronRight className="w-3 h-3 text-base-content/40" />
          <span className="font-medium text-base-content">{prompt}</span>
          <span className="ml-auto text-[10px] opacity-50 font-mono">
            {stepIndex + 1} / {totalSteps}
          </span>
        </>
      )}
    </div>
  );
}
