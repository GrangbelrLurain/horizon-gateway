import { useCallback, useEffect, useState } from "react";
import { fetchStatusApi } from "../api/gateway";
import type { GatewayStatus } from "../types";

const defaultStatus: GatewayStatus = {
  proxy: false,
  proxyCount: 0,
  mocking: false,
  mockCount: 0,
  logging: true,
  inspector: false,
};

export function useGatewayStatus() {
  const [status, setStatus] = useState<GatewayStatus>(defaultStatus);

  const fetchStatus = useCallback(() => {
    fetchStatusApi()
      .then((data) => {
        if (data) {
          setStatus((prev) => ({ ...prev, ...data }));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "WT_UPDATE_STATUS") {
        setStatus((prev) => ({ ...prev, ...event.data.payload }));
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return { status, setStatus, fetchStatus };
}
