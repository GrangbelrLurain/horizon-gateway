import { useAtomValue } from "jotai";
import { useEffect, useRef } from "react";
import { domainsAtom } from "@/entities/domain";
import { inspectorEnabledAtom } from "@/entities/inspector";
import { mockingEnabledAtom } from "@/entities/mocking";
import { proxyStatusAtom } from "@/entities/proxy";
import { bucketize, trackEvent } from "./client";
import { telemetryEnabledAtom } from "./store";

/**
 * Sends a single anonymous heartbeat event per app session, only when the user has
 * opted in. Mount this once near the app root (inside the ErrorBoundary). Renders nothing.
 */
export function TelemetryProvider() {
  const enabled = useAtomValue(telemetryEnabledAtom);
  const proxyStatus = useAtomValue(proxyStatusAtom);
  const mockingEnabled = useAtomValue(mockingEnabledAtom);
  const inspectorEnabled = useAtomValue(inspectorEnabledAtom);
  const domains = useAtomValue(domainsAtom);
  const heartbeatSentRef = useRef(false);

  useEffect(() => {
    if (!enabled || heartbeatSentRef.current) {
      return;
    }
    heartbeatSentRef.current = true;
    void trackEvent("heartbeat", {
      proxy_on: Boolean(proxyStatus?.running),
      mocking_on: Boolean(mockingEnabled),
      inspector_on: Boolean(inspectorEnabled),
      domains_bucket: bucketize(domains.length),
    });
  }, [enabled, proxyStatus, mockingEnabled, inspectorEnabled, domains]);

  return null;
}
