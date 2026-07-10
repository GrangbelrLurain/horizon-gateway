import { atom } from "jotai";
import { atomFamily } from "jotai/utils";
import { domainListBulkSelectedIdsAtom, selectedDomainIdAtom } from "../store";

export const domainListBulkAnchorIdAtom = atom<number | null>(null);

export const domainListBulkSelectedCountAtom = atom((get) => get(domainListBulkSelectedIdsAtom).size);

/** Per-row subscription — only re-renders when this domain's checked state changes */
export const domainBulkCheckedAtomFamily = atomFamily((domainId: number) =>
  atom((get) => get(domainListBulkSelectedIdsAtom).has(domainId)),
);

/** Per-row anchor highlight — only re-renders for old/new anchor rows */
export const domainBulkAnchorAtomFamily = atomFamily((domainId: number) =>
  atom((get) => get(domainListBulkAnchorIdAtom) === domainId),
);

/** Per-row nav highlight — only re-renders for old/new selected domain */
export const domainNavSelectedAtomFamily = atomFamily((domainId: number) =>
  atom((get) => get(selectedDomainIdAtom) === domainId),
);
