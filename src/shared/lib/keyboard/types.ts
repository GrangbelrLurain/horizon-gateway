export type ShortcutGroup = "navigation" | "palette" | "actions" | "selection";

export interface ShortcutDef {
  id: string;
  key: string; // e.g. "p", "c", "Escape", "ArrowLeft"
  ctrl?: boolean;
  meta?: boolean;
  alt?: boolean;
  shift?: boolean;
  group: ShortcutGroup;
  description: {
    ko: string;
    en: string;
  };
  handler?: (e: KeyboardEvent) => void;
}
