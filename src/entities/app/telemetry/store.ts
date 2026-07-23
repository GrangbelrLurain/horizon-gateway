import { atom, getDefaultStore } from "jotai";
import { atomWithStorage } from "jotai/utils";

const INSTALL_ID_KEY = "horizon-gateway-install-id";

function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (very old webviews).
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function readOrCreateInstallId(): string {
  try {
    const existing = localStorage.getItem(INSTALL_ID_KEY);
    if (existing) {
      return existing;
    }
    const created = generateUuid();
    localStorage.setItem(INSTALL_ID_KEY, created);
    return created;
  } catch {
    return generateUuid();
  }
}

/** Opt-in only. Default is OFF — never send telemetry without explicit user consent. */
export const telemetryEnabledAtom = atomWithStorage<boolean>("horizon-gateway-telemetry-enabled", false);

/** Anonymous, locally-generated install identifier. Not tied to any account. */
export const installIdAtom = atom<string>(readOrCreateInstallId());

/** Regenerates the local install id (e.g. when the user disables telemetry and wants a clean slate). */
export function regenerateInstallId(): string {
  const created = generateUuid();
  try {
    localStorage.setItem(INSTALL_ID_KEY, created);
  } catch {
    // best-effort; ignore storage failures
  }
  getDefaultStore().set(installIdAtom, created);
  return created;
}
