import { commands, unwrap } from "@/shared/api";

export async function fetchMockingEnabled(): Promise<boolean> {
  const res = unwrap(await commands.getMockingStatus());
  return res.data?.enabled ?? false;
}
