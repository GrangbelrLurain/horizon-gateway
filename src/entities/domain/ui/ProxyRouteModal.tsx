import { useState } from "react";
import { commands, unwrap } from "@/shared/api";
import { notifyHubDataChanged } from "@/shared/lib/tauri/hubEvents";
import { Button } from "@/shared/ui/button/Button";
import { Input } from "@/shared/ui/input/Input";
import { Modal } from "@/shared/ui/modal/Modal";
import type { ProxyRouteModalT } from "./types";

interface ProxyRouteModalProps {
  domainId: number;
  domainUrl: string;
  t: ProxyRouteModalT;
  onClose: () => void;
  onAdded: () => void;
}

export function ProxyRouteModal({ domainId, domainUrl, t, onClose, onAdded }: ProxyRouteModalProps) {
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState("3000");
  const [adding, setAdding] = useState(false);

  let domainHost = domainUrl;
  try {
    const u = new URL(domainUrl.startsWith("http") ? domainUrl : `https://${domainUrl}`);
    domainHost = u.hostname;
  } catch (e) {
    console.error("Invalid URL:", e);
  }

  const handleAdd = async () => {
    const portNum = Number(port);
    if (!host.trim() || Number.isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return;
    }
    setAdding(true);
    try {
      await commands
        .addLocalRoute({
          domainId,
          targetHost: host.trim(),
          targetPort: portNum,
        })
        .then(unwrap);
      await notifyHubDataChanged("routes");
      onAdded();
      onClose();
    } catch (e) {
      console.error("add_local_route:", e);
    } finally {
      setAdding(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose}>
      <Modal.Header title={t.proxyRouteModalTitle} description={t.proxyRouteModalDesc(domainHost)} />
      <Modal.Body className="space-y-6">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="proxy-route-host" className="block text-xs font-bold text-base-content/50 ml-1">
            {t.proxyRouteTargetHost}
          </label>
          <Input
            id="proxy-route-host"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="localhost"
            className="w-full rounded-2xl h-11 px-4 shadow-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="proxy-route-port" className="block text-xs font-bold text-base-content/50 ml-1">
            {t.proxyRouteTargetPort}
          </label>
          <Input
            id="proxy-route-port"
            type="number"
            min={1}
            max={65535}
            value={port}
            onChange={(e) => setPort(e.target.value)}
            placeholder="3000"
            className="w-full rounded-2xl h-11 px-4 shadow-sm"
          />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={adding} className="px-6 rounded-xl">
          {t.proxyRouteCancel}
        </Button>
        <Button onClick={handleAdd} disabled={adding} className="px-8 rounded-xl shadow-lg shadow-primary/20">
          {adding ? t.proxyRouteAdding : t.proxyRouteAdd}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
