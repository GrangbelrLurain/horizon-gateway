import type { ApiLogEntry } from "@/shared/api";
import { commands, unwrap } from "@/shared/api";

export async function fetchApiLogById(logId: string, hostFilter?: string | null): Promise<ApiLogEntry | null> {
  if (!logId) {
    return null;
  }

  try {
    const res = await commands.getApiLogDetail({ id: logId, date: null }).then(unwrap);
    if (res.success && res.data) {
      if (hostFilter && !res.data.host.includes(hostFilter) && res.data.host !== hostFilter) {
        // Detail found but host mismatch — still return; caller may have stale host filter
      }
      return res.data;
    }
  } catch (e) {
    console.error("get_api_log_detail:", e);
  }

  return null;
}

export async function fetchApiLogDetail(logId: string, date?: string | null): Promise<ApiLogEntry | null> {
  if (!logId) {
    return null;
  }
  try {
    const res = await commands.getApiLogDetail({ id: logId, date: date ?? null }).then(unwrap);
    if (res.success && res.data) {
      return res.data;
    }
  } catch (e) {
    console.error("get_api_log_detail:", e);
  }
  return null;
}
