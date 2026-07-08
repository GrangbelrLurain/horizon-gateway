import clsx from "clsx";
import { useAtom, useAtomValue } from "jotai";
import { Download, ExternalLink, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { languageAtom } from "@/entities/app";
import { apiLoggingLinksAtom } from "@/entities/domain-api-logging";
import type { Domain } from "@/shared/api";
import { commands, unwrap } from "@/shared/api";
import { notifyHubDataChanged } from "@/shared/lib/tauri/hubEvents";
import { openDetachedWindow } from "@/shared/lib/tauri/openDetachedWindow";
import { Button } from "@/shared/ui/button/Button";
import { Input } from "@/shared/ui/input/Input";
import { useDomainHubData } from "../hooks/useDomainHubData";
import { en } from "../i18n/en";
import { ko } from "../i18n/ko";
import { Panel } from "./Panel";

interface DomainApiSchemaPanelProps {
  domain: Domain;
  onClose: () => void;
}

export function DomainApiSchemaPanel({ domain, onClose }: DomainApiSchemaPanelProps) {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const { getDomainHost } = useDomainHubData();
  const host = getDomainHost(domain);
  const [links, setLinks] = useAtom(apiLoggingLinksAtom);
  const link = links.find((l) => l.domainId === domain.id);
  const [schemaUrl, setSchemaUrl] = useState(link?.schemaUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    setSchemaUrl(link?.schemaUrl ?? "");
  }, [link?.schemaUrl]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await commands
        .setDomainApiLogging({
          domainId: domain.id,
          loggingEnabled: link?.loggingEnabled ?? true,
          bodyEnabled: link?.bodyEnabled ?? false,
          schemaUrl: schemaUrl.trim() || null,
        })
        .then(unwrap);
      const res = await commands.getDomainApiLoggingLinks().then(unwrap);
      if (res.success) {
        setLinks(res.data ?? []);
      }
      await notifyHubDataChanged("features");
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }, [domain.id, link, schemaUrl, setLinks]);

  const handleDownload = useCallback(async () => {
    const url = (link?.schemaUrl ?? schemaUrl).trim();
    if (!url) {
      setDownloadMessage({ ok: false, msg: t.schemaUrlRequired });
      return;
    }
    setDownloading(true);
    setDownloadMessage(null);
    try {
      const res = await commands.downloadApiSchema({ domainId: domain.id, url }).then(unwrap);
      if (res.success) {
        setDownloadMessage({
          ok: true,
          msg: t.schemaDownloadSuccess((res.data.sizeBytes ?? 0).toLocaleString()),
        });
      } else {
        setDownloadMessage({ ok: false, msg: t.schemaDownloadFailed(res.message) });
      }
    } catch (e) {
      setDownloadMessage({ ok: false, msg: t.schemaDownloadFailed(String(e)) });
    } finally {
      setDownloading(false);
    }
  }, [domain.id, link?.schemaUrl, schemaUrl, t]);

  const handleOpenExplorer = useCallback(() => {
    void openDetachedWindow(`/apis/schema?d=${domain.id}`, `${host} — Schema`, 1280, 860);
  }, [domain.id, host]);

  return (
    <Panel id="api/schema" title={t.apiSchema} subtitle={host} onClose={onClose} width="lg">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase text-base-content/50">{t.schemaUrlLabel}</label>
          <Input
            value={schemaUrl}
            onChange={(e) => setSchemaUrl(e.target.value)}
            placeholder="https://api.example.com/openapi.json"
            className="h-9 text-xs font-mono"
          />
        </div>

        <div className="flex gap-2">
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t.schemaSave}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="gap-1.5"
            onClick={handleDownload}
            disabled={downloading || !schemaUrl.trim()}
          >
            {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {t.schemaDownload}
          </Button>
        </div>

        {downloadMessage && (
          <p className={clsx("text-xs", downloadMessage.ok ? "text-success" : "text-error")}>{downloadMessage.msg}</p>
        )}

        <Button variant="secondary" size="sm" className="w-full gap-1.5 text-xs" onClick={handleOpenExplorer}>
          <ExternalLink className="w-3.5 h-3.5" />
          {t.schemaOpenExplorer}
        </Button>
      </div>
    </Panel>
  );
}
