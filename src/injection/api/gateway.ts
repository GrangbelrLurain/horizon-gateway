import type { Annotation } from "@/entities/inspector";
import type { GatewayStatus, MockedApiEntry, MockRule } from "../types";

export async function fetchStatusApi(): Promise<GatewayStatus | null> {
  try {
    const res = await fetch("/.horizon-gateway/api/status");
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchProxyRoutesApi() {
  try {
    const res = await fetch("/.horizon-gateway/api/proxy-routes");
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function toggleProxyRouteApi(id: number, enabled: boolean) {
  await fetch("/.horizon-gateway/api/proxy-route/toggle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, enabled }),
  });
}

export async function fetchMockRulesApi(): Promise<MockRule[]> {
  try {
    const res = await fetch("/.horizon-gateway/api/mock-rules");
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function fetchLoggingDomainsApi(): Promise<string[]> {
  try {
    const res = await fetch("/.horizon-gateway/api/logging-domains");
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function toggleMockRuleApi(id: string, enabled?: boolean) {
  await fetch("/.horizon-gateway/api/mock-rule/toggle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, enabled }),
  });
}

export async function toggleAllMockRulesApi(enabled: boolean) {
  await fetch("/.horizon-gateway/api/mock-rule/toggle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ all: true, enabled }),
  });
}

export async function saveMockRuleFromRequestApi(req: MockedApiEntry, enabled: boolean) {
  await fetch("/.horizon-gateway/api/mock-rule/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `Mock for ${req.ruleName || req.url.split("/").pop() || "API"}`,
      method: req.method,
      url_pattern: req.url.split("?")[0],
      response_status: 200,
      response_body: '{\n  "mocked": true\n}',
      enabled,
    }),
  });
}

export async function saveMockRuleApi(rule: Partial<MockRule>) {
  await fetch("/.horizon-gateway/api/mock-rule/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rule),
  });
}

export async function deleteMockRuleApi(id: string) {
  await fetch("/.horizon-gateway/api/mock-rule/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
}

export async function fetchAnnotationsApi(): Promise<Annotation[]> {
  try {
    const res = await fetch("/.horizon-gateway/api/annotations");
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function applyAnnotationPayload(data: unknown, onData: (annotations: Annotation[]) => void) {
  if (Array.isArray(data)) {
    onData(data as Annotation[]);
  }
}

/** Push updates over SSE. Reconnects on drop; does not poll GET /api/annotations. */
export function subscribeAnnotations(onData: (annotations: Annotation[]) => void): () => void {
  let closed = false;
  let es: EventSource | null = null;
  let retryId: number | null = null;

  const connect = () => {
    if (closed) {
      return;
    }
    es?.close();
    try {
      es = new EventSource("/.horizon-gateway/api/annotations/stream");
    } catch {
      scheduleRetry();
      return;
    }
    es.onmessage = (ev) => {
      try {
        applyAnnotationPayload(JSON.parse(ev.data), onData);
      } catch {
        /* ignore malformed frames */
      }
    };
    es.onerror = () => {
      es?.close();
      es = null;
      scheduleRetry();
    };
  };

  const scheduleRetry = () => {
    if (closed || retryId != null) {
      return;
    }
    retryId = window.setTimeout(() => {
      retryId = null;
      connect();
    }, 5_000);
  };

  connect();

  return () => {
    closed = true;
    es?.close();
    if (retryId != null) {
      window.clearTimeout(retryId);
    }
  };
}

export async function deleteAnnotationApi(id: string) {
  return fetch("/.horizon-gateway/api/annotation", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
}

export async function saveAnnotationApi(payload: Record<string, unknown>) {
  return fetch("/.horizon-gateway/api/annotation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
