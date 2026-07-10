import { createContext, useContext } from "react";
import type { BulkPointerModifiers } from "../lib/bulkSelection";

export type DomainListBadgeLabels = {
  monitor: string;
  proxy: string;
  api: string;
};

export type DomainListInteractionHandlers = {
  onPointer: (id: number, mods: BulkPointerModifiers) => void;
  onEditDomain: (id: number) => void;
  onDeleteDomain: (id: number) => void;
  badgeLabels: DomainListBadgeLabels;
};

export const DomainListInteractionContext = createContext<DomainListInteractionHandlers | null>(null);

export function useDomainListInteraction(): DomainListInteractionHandlers {
  const ctx = useContext(DomainListInteractionContext);
  if (!ctx) {
    throw new Error("useDomainListInteraction must be used within DomainListInteractionContext");
  }
  return ctx;
}
