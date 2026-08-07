import type { ShortcutDef } from "./types";

class ShortcutRegistry {
  private shortcuts = new Map<string, ShortcutDef>();
  private globalListenersAttached = false;

  public register(def: ShortcutDef) {
    this.shortcuts.set(def.id, def);
    this.ensureGlobalListener();
  }

  public unregister(id: string) {
    this.shortcuts.delete(id);
  }

  public getAll(): ShortcutDef[] {
    return Array.from(this.shortcuts.values());
  }

  private ensureGlobalListener() {
    if (this.globalListenersAttached || typeof window === "undefined") {
      return;
    }
    this.globalListenersAttached = true;
    window.addEventListener("keydown", this.handleKeyDown);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    const isEditable = () => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isContentEditable = (document.activeElement as HTMLElement)?.isContentEditable;
      return activeTag === "input" || activeTag === "textarea" || activeTag === "select" || isContentEditable;
    };

    for (const def of this.shortcuts.values()) {
      if (!def.handler) {
        continue;
      }

      const keyMatch = e.key.toLowerCase() === def.key.toLowerCase();
      const ctrlMatch = Boolean(def.ctrl) === (e.ctrlKey || e.metaKey);
      const altMatch = Boolean(def.alt) === e.altKey;
      const shiftMatch = Boolean(def.shift) === e.shiftKey;

      if (keyMatch && ctrlMatch && altMatch && shiftMatch) {
        // Special case: Esc is allowed even in inputs, but typing shortcuts like Ctrl+P or C should skip inputs
        if (isEditable() && def.key.toLowerCase() !== "escape") {
          continue;
        }
        def.handler(e);
        break;
      }
    }
  };
}

export const shortcutRegistry = new ShortcutRegistry();
