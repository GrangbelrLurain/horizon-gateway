import { commands, unwrap } from "@/shared/api";
import type { Domain } from "./types";

export async function fetchDomains(): Promise<Domain[]> {
  const res = unwrap(await commands.getDomains());
  return res.data ?? [];
}
