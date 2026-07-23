import type { ApiLogEntry } from "@/shared/api";
import { commands, unwrap } from "@/shared/api";

const MAX_SEARCH_DAYS = 14;

export async function fetchApiLogById(logId: string, hostFilter?: string | null): Promise<ApiLogEntry | null> {
  if (!logId) {
    return null;
  }

  let dates: string[] = [];
  try {
    const datesRes = await commands.listApiLogDates().then(unwrap);
    if (datesRes.success && datesRes.data?.length) {
      dates = [...datesRes.data].reverse();
    }
  } catch {
    // fall through to today
  }

  if (dates.length === 0) {
    dates = [new Date().toISOString().split("T")[0]];
  }

  const searchDates = dates.slice(0, MAX_SEARCH_DAYS);
  const logResults = await Promise.all(
    searchDates.map((date) =>
      commands
        .getApiLogs({
          date,
          domainFilter: hostFilter ?? null,
          methodFilter: null,
          hostFilter: null,
          exactMatch: null,
        })
        .then(unwrap)
        .catch(() => null),
    ),
  );

  for (const res of logResults) {
    if (res?.success && res.data) {
      const found = res.data.find((l) => l.id === logId);
      if (found) {
        return found;
      }
    }
  }

  if (hostFilter) {
    return fetchApiLogById(logId, null);
  }

  return null;
}
