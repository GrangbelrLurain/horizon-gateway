import { commands, unwrap } from "@/shared/api";
import type { DomainApiLoggingLink } from "./types";

export async function fetchApiLoggingLinks(): Promise<DomainApiLoggingLink[]> {
  const res = unwrap(await commands.getDomainApiLoggingLinks());
  return res.data ?? [];
}
