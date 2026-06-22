import { commands, unwrap } from "@/shared/api";

export async function fetchInspectorEnabled(): Promise<boolean> {
  const res = unwrap(await commands.getGlobalInspectorEnabled());
  return res.data ?? false;
}
