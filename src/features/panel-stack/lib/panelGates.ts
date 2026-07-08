import type { DomainFeatureState } from "@/entities/domain";
import type { PanelId } from "../types";

export function canOpenPanel(panelId: PanelId, features: DomainFeatureState): boolean {
  if (panelId === "debug") {
    return true;
  }
  if (panelId === "monitor") {
    return features.monitorEnabled === true;
  }
  if (panelId === "proxy") {
    return true;
  }
  if (panelId === "api" || panelId.startsWith("api/")) {
    return features.apiLoggingEnabled === true;
  }
  return true;
}
