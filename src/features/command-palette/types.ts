import type React from "react";

// ─── Step Types ─────────────────────────────────────────────────────────────

export type SelectStep = {
  type: "select";
  options: PaletteOption[];
};

export type AutocompleteStep = {
  type: "autocomplete";
  getOptions: (query: string) => PaletteOption[] | Promise<PaletteOption[]>;
};

export type InputStep = {
  type: "input";
  inputType?: "text" | "url" | "number";
  validate?: (value: string) => string | null;
};

export type PaletteStepDef = {
  id: string;
  prompt: { ko: string; en: string };
  placeholder?: { ko: string; en: string };
  description?: { ko?: string; en?: string };
} & (SelectStep | AutocompleteStep | InputStep);

// ─── Option Type ─────────────────────────────────────────────────────────────

export type PaletteOption = {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  keywords?: string[];
};

// ─── Multilingual Corpus Meta ──────────────────────────────────────────────

export type PaletteCommandMeta = {
  label: {
    ko: string;
    en: string;
  };
  description?: {
    ko?: string;
    en?: string;
  };
  aliases?: {
    ko?: string[];
    en?: string[];
    common?: string[];
  };
};

// ─── Command Definition ───────────────────────────────────────────────────

export type PaletteGroup =
  | "recent"
  | "domains"
  | "proxy"
  | "mocking"
  | "tools"
  | "logs"
  | "actions"
  | "team"
  | "settings";

export type PaletteCommandDef = {
  id: string;
  group: PaletteGroup;
  icon?: React.ReactNode;
  meta: PaletteCommandMeta;
  steps?: PaletteStepDef[];
  action: (values: Record<string, string>) => unknown;
};

// ─── Runtime Session State ─────────────────────────────────────────────────

export type PaletteSession = {
  command: PaletteCommandDef;
  stepIndex: number;
  values: Record<string, string>;
};
