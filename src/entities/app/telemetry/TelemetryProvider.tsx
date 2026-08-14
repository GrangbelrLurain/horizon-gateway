import { useAtomValue } from "jotai";
import { useEffect, useRef } from "react";
import { domainsAtom } from "@/entities/domain";
import { proxyStatusAtom } from "@/entities/proxy";
import { commands, unwrap } from "@/shared/api";
import { bucketize, trackEvent } from "./client";
import { telemetryEnabledAtom } from "./store";

/**
 * Sends a single anonymous heartbeat event per app session, only when the user has
 * opted in. Mount this once near the app root (inside the ErrorBoundary). Renders nothing.
 */
export function TelemetryProvider() {
  const enabled = useAtomValue(telemetryEnabledAtom);
  const proxyStatus = useAtomValue(proxyStatusAtom);
  const domains = useAtomValue(domainsAtom);
  const heartbeatSentRef = useRef(false);

  useEffect(() => {
    if (!enabled || heartbeatSentRef.current) {
      return;
    }
    heartbeatSentRef.current = true;
    void (async () => {
      let mockingOn = false;
      let inspectorOn = false;
      try {
        const [rulesRes, injectionRes] = await Promise.all([
          commands.getMockRules().then(unwrap),
          commands.getInjectionDomains().then(unwrap),
        ]);
        mockingOn = Boolean(rulesRes.success && rulesRes.data?.some((rule) => rule.enabled));
        inspectorOn = Boolean(injectionRes.success && (injectionRes.data?.length ?? 0) > 0);
      } catch {
        // keep false
      }
      void trackEvent("heartbeat", {
        proxy_on: Boolean(proxyStatus?.running),
        mocking_on: mockingOn,
        inspector_on: inspectorOn,
        domains_bucket: bucketize(domains.length),
      });
    })();
  }, [domains, enabled, proxyStatus]);

  return null;
}
