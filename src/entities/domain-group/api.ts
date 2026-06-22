import { commands, unwrap } from "@/shared/api";
import type { DomainGroup, DomainGroupLink } from "./types";

export async function fetchGroups(): Promise<DomainGroup[]> {
  const res = unwrap(await commands.getGroups());
  return res.data ?? [];
}

export async function fetchLinks(): Promise<DomainGroupLink[]> {
  const res = unwrap(await commands.getDomainGroupLinks());
  return res.data ?? [];
}
