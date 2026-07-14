import { getCurrentWindow } from "@tauri-apps/api/window";
import { atomWithStorage } from "jotai/utils";

/**
 * Gets the current window's unique ID (label).
 * Defaults to 'main' if not running in a Tauri context.
 */
export const getWindowId = () => {
  if (typeof window === "undefined") {
    return "main";
  }
  try {
    return getCurrentWindow().label;
  } catch (_e) {
    return "main";
  }
};

/**
 * A wrapper for atomWithStorage that automatically prefixes keys with the windowId
 * to ensure that multiple windows have isolated persistence.
 *
 * If a new isolated window is opened (and has no saved state yet), it will inherit
 * the current state from the 'main' window as a starting point.
 */
export function atomWithWindowStorage<T>(key: string, initialValue: T) {
  const windowId = getWindowId();
  const fullKey = `horizon_gateway_${windowId}_${key}`;

  // State Inheritance: If this is a detached window and we don't have our own state yet,
  // try to clone the current state from the 'main' window.
  if (typeof window !== "undefined" && windowId !== "main") {
    try {
      if (localStorage.getItem(fullKey) === null) {
        const mainKey = `horizon_gateway_main_${key}`;
        const mainValue = localStorage.getItem(mainKey);
        if (mainValue !== null) {
          localStorage.setItem(fullKey, mainValue);
        }
      }
    } catch (e) {
      console.error("Failed to inherit state from main window:", e);
    }
  }

  return atomWithStorage<T>(fullKey, initialValue);
}
