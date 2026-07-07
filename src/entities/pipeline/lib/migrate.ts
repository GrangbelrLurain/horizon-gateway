import type { PipelineFlow, SandboxActiveFlow } from "../types";
import { emptyPipelineFlow } from "./serialize";

export const LEGACY_ACTIVE_FLOW_KEY = "watchtower-active-pipeline-flow";
export const SANDBOX_ACTIVE_FLOW_KEY = "watchtower-sandbox-active-pipeline";
export const SAVED_PIPELINES_KEY = "watchtower-saved-pipelines";

export function createDefaultActiveFlow(): SandboxActiveFlow {
  return {
    flow: emptyPipelineFlow(),
    loadedFromId: null,
    revision: 0,
    updatedAt: Date.now(),
  };
}

export function migrateLegacyActiveFlow(): SandboxActiveFlow | null {
  if (typeof localStorage === "undefined") {
    return null;
  }

  if (localStorage.getItem(SANDBOX_ACTIVE_FLOW_KEY) !== null) {
    return null;
  }

  const legacyRaw = localStorage.getItem(LEGACY_ACTIVE_FLOW_KEY);
  if (!legacyRaw) {
    return null;
  }

  try {
    const flow = JSON.parse(legacyRaw) as PipelineFlow;
    return {
      flow: {
        nodes: Array.isArray(flow.nodes) ? flow.nodes : [],
        edges: Array.isArray(flow.edges) ? flow.edges : [],
      },
      loadedFromId: null,
      revision: 0,
      updatedAt: Date.now(),
    };
  } catch {
    return null;
  }
}
