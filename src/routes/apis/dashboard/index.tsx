import { createFileRoute, Link } from "@tanstack/react-router";
import clsx from "clsx";
import { useAtom, useAtomValue } from "jotai";
import { Check, Download, Loader2Icon, Search, Settings, Trash2, Wifi } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { globalApiLoggingLinksAtom, globalDomainsAtom } from "@/domain/global-data/store";
import { languageAtom } from "@/domain/i18n/store";
import type { Domain, DomainApiLoggingLink } from "@/shared/api";
import { commands, unwrap } from "@/shared/api";
import { Button } from "@/shared/ui/button/Button";
import { Card } from "@/shared/ui/card/card";
import { Input } from "@/shared/ui/input/Input";
import { ConfirmModal } from "@/shared/ui/modal/ConfirmModal";
import { H1, P } from "@/shared/ui/typography/typography";
import { en } from "./en";
import { ko } from "./ko";
import { apiDashboardSchemaUrlEditsAtom } from "./store";

export const Route = createFileRoute("/apis/dashboard/")({
  component: ApisDashboardPage,
});

function ApisDashboardPage() {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const [domains, setDomains] = useAtom(globalDomainsAtom);
  const [links, setLinks] = useAtom(globalApiLoggingLinksAtom);
  const [loading, setLoading] = useState(true);
  const [removeDomainId, setRemoveDomainId] = useState<number | null>(null);

  const fetchDomains = useCallback(async () => {
    try {
      const res = await commands.getDomains().then(unwrap);
      if (res.success) {
        setDomains(res.data ?? []);
      }
    } catch (e) {
      console.error("get_domains:", e);
    }
  }, [setDomains]);

  const fetchLinks = useCallback(async () => {
    try {
      const res = await commands.getDomainApiLoggingLinks().then(unwrap);
      if (res.success) {
        setLinks(res.data ?? []);
      }
    } catch (e) {
      console.error("get_domain_api_logging_links:", e);
    } finally {
      setLoading(false);
    }
  }, [setLinks]);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  /** domainId → Domain 매핑 */
  const domainMap = useMemo(() => {
    const map = new Map<number, Domain>();
    for (const d of domains) {
      map.set(d.id, d);
    }
    return map;
  }, [domains]);

  /** Schema URL 편집 중인 도메인 id → 입력값 */
  const [schemaUrlEdits, setSchemaUrlEdits] = useAtom(apiDashboardSchemaUrlEditsAtom);
  /** Schema 다운로드 진행 중인 도메인 id set */
  const [downloadingIds, setDownloadingIds] = useState<Set<number>>(new Set());
  /** Schema URL 저장 진행 중인 도메인 id set */
  const [savingUrlIds, setSavingUrlIds] = useState<Set<number>>(new Set());
  /** 다운로드 결과 메시지 (domainId → message) */
  const [downloadMessages, setDownloadMessages] = useState<Record<number, { ok: boolean; msg: string }>>({});

  const handleRemove = async (domainId: number) => {
    try {
      const res = await commands.removeDomainApiLogging({ domainId }).then(unwrap);
      if (res.success) {
        setLinks(res.data ?? []);
      }
    } catch (e) {
      console.error("remove_domain_api_logging:", e);
    } finally {
      setRemoveDomainId(null);
    }
  };

  const handleToggleLogging = async (link: DomainApiLoggingLink) => {
    try {
      const res = await commands
        .setDomainApiLogging({
          domainId: link.domainId,
          loggingEnabled: !(link.loggingEnabled ?? false),
          bodyEnabled: link.bodyEnabled ?? false,
          schemaUrl: link.schemaUrl ?? null,
        })
        .then(unwrap);
      if (res.success) {
        setLinks(res.data ?? []);
      }
    } catch (e) {
      console.error("set_domain_api_logging:", e);
    }
  };

  const handleToggleBody = async (link: DomainApiLoggingLink) => {
    try {
      const res = await commands
        .setDomainApiLogging({
          domainId: link.domainId,
          loggingEnabled: link.loggingEnabled ?? false,
          bodyEnabled: !(link.bodyEnabled ?? false),
          schemaUrl: link.schemaUrl ?? null,
        })
        .then(unwrap);
      if (res.success) {
        setLinks(res.data ?? []);
      }
    } catch (e) {
      console.error("set_domain_api_logging:", e);
    }
  };

  /** Schema URL 저장 */
  const handleSaveSchemaUrl = async (link: DomainApiLoggingLink) => {
    const newUrl = schemaUrlEdits[link.domainId];
    if (newUrl === undefined) {
      return;
    }
    setSavingUrlIds((s) => new Set(s).add(link.domainId));
    try {
      const res = await commands
        .setDomainApiLogging({
          domainId: link.domainId,
          loggingEnabled: link.loggingEnabled ?? false,
          bodyEnabled: link.bodyEnabled ?? false,
          schemaUrl: newUrl.trim() || null,
        })
        .then(unwrap);
      if (res.success) {
        setLinks(res.data ?? []);
        // 편집 상태 초기화
        setSchemaUrlEdits((prev) => {
          const next = { ...prev };
          delete next[link.domainId];
          return next;
        });
      }
    } catch (e) {
      console.error("save schema url:", e);
    } finally {
      setSavingUrlIds((s) => {
        const next = new Set(s);
        next.delete(link.domainId);
        return next;
      });
    }
  };

  /** Schema 다운로드 실행 */
  const handleDownloadSchema = async (link: DomainApiLoggingLink) => {
    const url = link.schemaUrl?.trim();
    if (!url) {
      return;
    }
    setDownloadingIds((s) => new Set(s).add(link.domainId));
    setDownloadMessages((prev) => {
      const next = { ...prev };
      delete next[link.domainId];
      return next;
    });
    try {
      const res = await commands.downloadApiSchema({ domainId: link.domainId, url }).then(unwrap);
      if (res.success) {
        setDownloadMessages((prev) => ({
          ...prev,
          [link.domainId]: { ok: true, msg: t.downloadSuccess((res.data.sizeBytes ?? 0).toLocaleString()) },
        }));
      } else {
        setDownloadMessages((prev) => ({
          ...prev,
          [link.domainId]: { ok: false, msg: t.downloadFailed(res.message) },
        }));
      }
    } catch (e) {
      setDownloadMessages((prev) => ({
        ...prev,
        [link.domainId]: { ok: false, msg: t.downloadFailed(String(e)) },
      }));
    } finally {
      setDownloadingIds((s) => {
        const next = new Set(s);
        next.delete(link.domainId);
        return next;
      });
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-20">
      <header>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 text-primary rounded-lg">
            <Wifi className="w-5 h-5" />
          </div>
          <H1>{t.title}</H1>
        </div>
        <P className="text-base-content/60">{t.subtitle}</P>
        <Link
          to="/apis/settings"
          className="inline-flex items-center gap-2 mt-3 text-sm text-primary hover:text-primary/80 font-medium"
        >
          <Settings className="w-4 h-4" />
          {t.manageInSettings}
        </Link>
      </header>

      {/* 등록된 도메인 리스트 */}
      <Card className="p-4 md:p-6 bg-base-100 border-base-300">
        <h2 className="font-bold text-base-content mb-4 flex items-center gap-2">
          <Search className="w-4 h-4" />
          {t.registeredDomains(links.length)}
        </h2>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2Icon className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : links.length === 0 ? (
          <p className="text-base-content/60 text-sm py-6">
            {t.noDomainsYet.split("Settings")[0]}
            <Link to="/apis/settings" className="text-primary hover:underline font-medium">
              {t.settings}
            </Link>
            {t.noDomainsYet.split("Settings")[1]}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {links.map((link) => {
              const domain = domainMap.get(link.domainId);
              const isEditingUrl = link.domainId in schemaUrlEdits;
              const currentUrlValue = isEditingUrl ? schemaUrlEdits[link.domainId] : (link.schemaUrl ?? "");
              const hasUrlChanged = isEditingUrl && schemaUrlEdits[link.domainId] !== (link.schemaUrl ?? "");
              const dlMsg = downloadMessages[link.domainId];

              return (
                <div
                  key={link.domainId}
                  className="p-4 rounded-xl border border-base-300/50 hover:border-primary/30 transition-all bg-base-200/30 flex flex-col gap-4"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Domain Info */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-2 h-8 bg-primary rounded-full shrink-0" />
                      <div className="min-w-0">
                        <div className="font-bold text-base-content flex items-center gap-2">
                          <span className="truncate">{domain?.url ?? `Domain #${link.domainId}`}</span>
                          <span className="text-[10px] px-2 py-0.5 bg-base-300 text-base-content/60 rounded-full shrink-0">
                            ID: {link.domainId}
                          </span>
                        </div>
                        {dlMsg && (
                          <p className={`text-xs mt-1 ${dlMsg.ok ? "text-success" : "text-error"}`}>{dlMsg.msg}</p>
                        )}
                      </div>
                    </div>

                    {/* Toggles */}
                    <div className="flex items-center gap-4 sm:gap-6 bg-base-100 px-4 py-2 rounded-lg border border-base-300 shadow-sm flex-wrap sm:flex-nowrap justify-center sm:justify-start">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${link.loggingEnabled ? "bg-primary border-primary" : "bg-base-100 border-base-300"}`}
                        >
                          {link.loggingEnabled && <Check className="w-3 h-3 text-primary-content" />}
                        </div>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={link.loggingEnabled}
                          onChange={() => handleToggleLogging(link)}
                        />
                        <span
                          className={clsx(
                            "text-sm font-medium",
                            link.loggingEnabled ? "text-primary" : "text-base-content/60",
                          )}
                        >
                          {t.logging}
                        </span>
                      </label>

                      <div className="w-px h-4 bg-base-300" />

                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${link.bodyEnabled ? "bg-primary border-primary" : "bg-base-100 border-base-300"}`}
                        >
                          {link.bodyEnabled && <Check className="w-3 h-3 text-primary-content" />}
                        </div>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={link.bodyEnabled}
                          onChange={() => handleToggleBody(link)}
                        />
                        <span
                          className={clsx(
                            "text-sm font-medium",
                            link.bodyEnabled ? "text-primary" : "text-base-content/60",
                          )}
                        >
                          {t.saveBody}
                        </span>
                      </label>
                    </div>

                    {/* Actions */}
                    <Button
                      variant="danger"
                      size="sm"
                      className="h-9 w-9 p-0 flex items-center justify-center rounded-lg opacity-80 hover:opacity-100 ml-auto md:ml-0"
                      onClick={() => setRemoveDomainId(link.domainId)}
                      title={t.removeTitle}
                    >
                      <Trash2 className="w-4 h-4 shrink-0" />
                    </Button>
                  </div>

                  {/* Schema Section */}
                  <div className="flex items-center gap-2 bg-base-100 p-2 rounded-lg border border-base-300">
                    <div className="px-2 text-xs font-bold text-base-content/40 uppercase tracking-wider shrink-0">
                      {t.schema}
                    </div>
                    <div className="h-4 w-px bg-base-300" />
                    <Input
                      type="url"
                      placeholder={t.schemaPlaceholder}
                      className="border-0 shadow-none focus-visible:ring-0 px-2 text-sm h-8"
                      value={currentUrlValue}
                      onChange={(e) => setSchemaUrlEdits((prev) => ({ ...prev, [link.domainId]: e.target.value }))}
                    />

                    {hasUrlChanged && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-7 gap-1 text-xs flex items-center shrink-0 whitespace-nowrap"
                        disabled={savingUrlIds.has(link.domainId)}
                        onClick={() => handleSaveSchemaUrl(link)}
                      >
                        {savingUrlIds.has(link.domainId) ? (
                          <Loader2Icon className="w-3 h-3 animate-spin" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                        {t.save}
                      </Button>
                    )}

                    {link.schemaUrl && (
                      <Button
                        variant="primary"
                        size="sm"
                        className="h-7 gap-1 text-xs flex items-center ml-1 shrink-0 whitespace-nowrap"
                        disabled={downloadingIds.has(link.domainId)}
                        onClick={() => handleDownloadSchema(link)}
                      >
                        {downloadingIds.has(link.domainId) ? (
                          <Loader2Icon className="w-3 h-3 animate-spin" />
                        ) : (
                          <Download className="w-3 h-3" />
                        )}
                        {t.fetch}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <ConfirmModal
        isOpen={removeDomainId !== null}
        onClose={() => setRemoveDomainId(null)}
        onConfirm={() => removeDomainId !== null && handleRemove(removeDomainId)}
        title={t.confirmRemoveTitle}
        message={t.confirmRemoveMessage}
        confirmText={t.confirmRemoveAction}
        cancelText={t.cancel}
        type="danger"
      />
    </div>
  );
}
