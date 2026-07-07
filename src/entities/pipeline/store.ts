import { atomWithStorage } from "jotai/utils";
import {
  createDefaultActiveFlow,
  migrateLegacyActiveFlow,
  SANDBOX_ACTIVE_FLOW_KEY,
  SAVED_PIPELINES_KEY,
} from "./lib/migrate";
import type { SandboxActiveFlow, SavedPipeline } from "./types";

const migratedActiveFlow = migrateLegacyActiveFlow();

export const sandboxActiveFlowAtom = atomWithStorage<SandboxActiveFlow>(
  SANDBOX_ACTIVE_FLOW_KEY,
  migratedActiveFlow ?? createDefaultActiveFlow(),
);

export const savedPipelinesAtom = atomWithStorage<SavedPipeline[]>(SAVED_PIPELINES_KEY, []);
