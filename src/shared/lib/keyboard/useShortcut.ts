import { useEffect } from "react";
import { shortcutRegistry } from "./registry";
import type { ShortcutDef } from "./types";

export function useShortcut(def: ShortcutDef) {
  useEffect(() => {
    shortcutRegistry.register(def);
    return () => {
      shortcutRegistry.unregister(def.id);
    };
  }, [def]);
}
