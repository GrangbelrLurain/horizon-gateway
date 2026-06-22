import { commands, unwrap } from "@/shared/api";
import type { DomainMonitorWithUrl, DomainStatusLog } from "./types";

export async function fetchMonitorLinks(): Promise<DomainMonitorWithUrl[]> {
  const res = unwrap(await commands.getDomainMonitorList());
  return res.data ?? [];
}

export async function fetchLatestStatus(): Promise<DomainStatusLog[]> {
  const res = unwrap(await commands.getLatestStatus());
  return res.data ?? [];
}
