import { commands, unwrap } from "@/shared/api";

export async function fetchMockingEnabled(): Promise<boolean> {
  const res = unwrap(await commands.getMockRules());
  return Boolean(res.data?.some((rule) => rule.enabled));
}
