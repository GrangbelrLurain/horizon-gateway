import { createFileRoute } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { AlertCircle, CheckCircle2, Download, Folder, Globe, Loader2Icon, Plus, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { languageAtom } from "@/entities/app/i18n/store";
import type { DomainGroup } from "@/entities/domain-group";
import { commands, unwrap } from "@/shared/api";
import { Badge } from "@/shared/ui/badge/badge";
import { Button } from "@/shared/ui/button/Button";
import { Card } from "@/shared/ui/card/card";
import { Textarea } from "@/shared/ui/textarea/Textarea";
import { H1, P } from "@/shared/ui/typography/typography";
import { en } from "./en";
import { ko } from "./ko";

function RegistDomains() {
  const urlInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const [addedUrls, setAddedUrls] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [groups, setGroups] = useState<DomainGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [existingUrls, setExistingUrls] = useState<Set<string>>(new Set());

  const fetchDomains = useCallback(async () => {
    try {
      const response = await commands.getDomains().then(unwrap);
      if (response.success && response.data) {
        setExistingUrls(new Set(response.data.map((d) => d.url)));
      }
    } catch (err) {
      console.error("Failed to fetch domains:", err);
    }
  }, []);

  const fetchGroups = useCallback(async () => {
    try {
      const response = await commands.getGroups().then(unwrap);
      if (response.success) {
        setGroups(response.data);
      }
    } catch (err) {
      console.error("Failed to fetch groups:", err);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  const registDomains = async (urls: string[]) => {
    if (urls.length === 0) {
      return;
    }

    setStatus("loading");
    try {
      const response = await commands
        .registDomains({
          urls,
          groupId: selectedGroupId,
        })
        .then(unwrap);

      if (response.success) {
        setStatus("success");
        setMessage(response.message);
        setAddedUrls([]);
      } else {
        setStatus("error");
        setMessage(response.message);
      }
    } catch (err) {
      setStatus("error");
      setMessage(String(err));
    }
  };

  const downloadJson = async () => {
    if (addedUrls.length === 0) {
      return;
    }
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");

      const path = await save({
        filters: [
          {
            name: "JSON",
            extensions: ["json"],
          },
        ],
        defaultPath: `watchtower-queue-${new Date().toISOString().slice(0, 10)}.json`,
      });

      if (path) {
        const data = JSON.stringify(addedUrls, null, 2);
        await writeTextFile(path, data);
        setStatus("success");
        alert(t.alertFileSaved);
      }
    } catch (err) {
      console.error("Failed to save JSON:", err);
      // Fallback
      const data = JSON.stringify(addedUrls, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `watchtower-queue-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        let urls: string[] = [];
        if (Array.isArray(parsed)) {
          urls = parsed.map((item) => (typeof item === "string" ? item : (item.url as string))).filter(Boolean);
        } else if (parsed.urls && Array.isArray(parsed.urls)) {
          urls = parsed.urls as string[];
        }

        if (urls.length > 0) {
          const newOnes = urls.filter((url) => !existingUrls.has(url));
          const skipped = urls.length - newOnes.length;
          setAddedUrls((prev) => [...new Set([...prev, ...newOnes])]);
          setStatus("success");
          setMessage(skipped > 0 ? t.skippedMessage(newOnes.length, skipped) : t.importedMessage(urls.length));
        }
      } catch (_err) {
        setStatus("error");
        setMessage(t.alertInvalidJson);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    urlInputRef.current?.focus();
  }, []);

  const updateAddedUrls = () => {
    if (urlInputRef.current) {
      const value = urlInputRef.current.value;
      const urls = value
        .split("\n")
        .flatMap((line) => line.split(",").map((url) => url.trim()))
        .filter((url) => {
          try {
            new URL(url.startsWith("http") ? url : `https://${url}`);
            return true;
          } catch {
            return false;
          }
        })
        .map((url) => (url.startsWith("http") ? url : `https://${url}`))
        .filter((url) => !existingUrls.has(url) && !addedUrls.includes(url));

      if (urls.length > 0) {
        setAddedUrls((prev) => [...prev, ...urls]);
      }
      urlInputRef.current.value = "";
      urlInputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      updateAddedUrls();
      return;
    }
    if (e.key === "," || (e.key === "Enter" && !e.shiftKey)) {
      if (urlInputRef.current?.value.trim()) {
        e.preventDefault();
        updateAddedUrls();
      }
    }
  };

  const removeUrl = (urlToRemove: string) => {
    setAddedUrls(addedUrls.filter((u) => u !== urlToRemove));
  };

  return (
    <div className="flex flex-col gap-8 max-w-4xl pb-20">
      <header className="shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 text-primary rounded-xl">
            <Plus className="w-5 h-5" />
          </div>
          <H1 className="text-3xl font-black tracking-tight text-base-content">{t.title}</H1>
        </div>
        <P className="text-base-content/60 text-sm font-medium">{t.subtitle}</P>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
        <div className="md:col-span-3 flex flex-col gap-6">
          <Card className="p-6 bg-base-100 border-base-300 shadow-xl rounded-3xl">
            <div className="mb-6">
              <label
                htmlFor="group-select"
                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest mb-3 text-base-content/40"
              >
                <Folder className="w-4 h-4 text-primary" />
                {t.assignGroup}
              </label>
              <div className="relative group/sel">
                <select
                  id="group-select"
                  className="w-full bg-base-200 border border-base-300 rounded-xl px-4 py-3 text-sm font-bold text-base-content focus:ring-2 focus:ring-primary focus:bg-base-100 focus:border-transparent outline-none transition-all appearance-none cursor-pointer"
                  value={selectedGroupId || ""}
                  onChange={(e) => setSelectedGroupId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="" className="bg-base-100 font-medium">
                    No Group (Default)
                  </option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id} className="bg-base-100 font-medium">
                      {group.name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-base-content/20 group-hover/sel:text-primary transition-colors">
                  <Folder className="w-4 h-4" />
                </div>
              </div>
              <p className="mt-3 text-[10px] text-base-content/30 font-bold uppercase tracking-tight pl-2">
                <span className="text-primary mr-1">TIP:</span> {t.groupTip}
              </p>
            </div>

            <label
              htmlFor="url-import"
              className="block text-[10px] font-black uppercase tracking-widest mb-3 text-base-content/40"
            >
              {t.importUrls}
            </label>
            <Textarea
              id="url-import"
              placeholder={t.placeholder}
              className="min-h-[220px] mb-5 font-mono text-sm leading-relaxed w-full bg-base-200/50 border-base-300 focus:bg-base-100 rounded-2xl p-4 transition-all shadow-inner"
              ref={urlInputRef}
              onKeyDown={handleKeyDown}
            />
            <div className="flex justify-between items-center bg-base-200/30 p-3 rounded-2xl border border-base-300/50">
              <div className="flex gap-2">
                <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileUpload} />
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  variant="secondary"
                  size="sm"
                  className="gap-2 font-bold tracking-tight bg-base-100"
                >
                  <Upload className="w-3.5 h-3.5 inline-block" /> {t.uploadJson}
                </Button>
                {addedUrls.length > 0 && (
                  <Button
                    type="button"
                    onClick={downloadJson}
                    variant="secondary"
                    size="sm"
                    className="gap-2 font-bold tracking-tight bg-base-100"
                  >
                    <Download className="w-3.5 h-3.5 inline-block" /> {t.export}
                  </Button>
                )}
              </div>
              <Button
                type="button"
                onClick={updateAddedUrls}
                variant="primary"
                size="sm"
                className="font-black uppercase tracking-widest text-xs shadow-md shadow-primary/20"
              >
                {t.parseBtn}
              </Button>
            </div>
          </Card>

          {status === "success" && (
            <div className="p-4 bg-green-50 border border-green-100 rounded-xl flex items-center gap-3 text-green-700 animate-in fade-in slide-in-from-top-2">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-medium">{message}</span>
            </div>
          )}

          {status === "error" && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm font-medium">{message}</span>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              onClick={() => registDomains(addedUrls)}
              disabled={status === "loading" || addedUrls.length === 0}
              variant="primary"
              className="flex-1 py-8 text-xl font-black uppercase tracking-widest shadow-2xl shadow-primary/30 border-none transition-all active:scale-[0.98]"
            >
              {status === "loading" ? (
                <Loader2Icon className="animate-spin mr-3 inline-block w-6 h-6" />
              ) : (
                <Plus className="w-6 h-6 mr-3 inline-block" />
              )}
              {t.startMonitor} {addedUrls.length > 0 && `(${addedUrls.length})`}
            </Button>
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="sticky top-8">
            <div className="flex justify-between items-center mb-5 px-1">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-base-content/40 flex items-center gap-3">
                {t.queue}
                <Badge variant={{ color: "blue" }} className="font-black scale-110 tracking-widest tabular-nums">
                  {addedUrls.length}
                </Badge>
              </h3>
              {addedUrls.length > 0 && (
                <button
                  type="button"
                  onClick={() => setAddedUrls([])}
                  className="text-[10px] text-error hover:text-error/80 font-black uppercase tracking-widest flex items-center gap-1.5 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" /> {t.clear}
                </button>
              )}
            </div>

            {addedUrls.length > 0 && (
              <div className="mb-6 bg-base-100 p-4 rounded-3xl border border-base-300 shadow-md">
                <label
                  htmlFor="queue-group-select"
                  className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-base-content/30 mb-3"
                >
                  <Folder className="w-3.5 h-3.5 text-primary" />
                  {t.importAtRegist}
                </label>
                <div className="relative">
                  <select
                    id="queue-group-select"
                    value={selectedGroupId ?? ""}
                    onChange={(e) => setSelectedGroupId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full bg-base-200 border border-base-300 rounded-xl px-4 py-2.5 text-sm font-bold text-base-content focus:ring-0 outline-none cursor-pointer appearance-none transition-all"
                  >
                    <option value="" className="bg-base-100">
                      {t.noGroupDefault}
                    </option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id} className="bg-base-100">
                        {g.name}
                      </option>
                    ))}
                  </select>
                  <Folder className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/20 pointer-events-none" />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-2 no-scrollbar">
              {addedUrls.length === 0 ? (
                <div className="bg-base-200/50 border-2 border-dashed border-base-300 rounded-3xl p-12 flex flex-col items-center justify-center text-center shadow-inner">
                  <div className="w-16 h-16 bg-base-300/50 rounded-full flex items-center justify-center mb-4 opacity-30">
                    <Globe className="w-8 h-8 text-base-content" />
                  </div>
                  <p className="text-[10px] text-base-content/30 font-black uppercase tracking-widest">
                    {t.noDomainsInQueue}
                  </p>
                </div>
              ) : (
                addedUrls.map((url) => (
                  <div
                    key={url}
                    className="group flex items-center justify-between p-4 bg-base-100 border border-base-300 rounded-2xl hover:border-primary/40 hover:shadow-lg transition-all animate-in zoom-in-95 duration-200 shadow-sm"
                  >
                    <span className="text-xs font-mono text-base-content/70 truncate mr-3 font-medium tracking-tight selection:bg-primary/20">
                      {url}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeUrl(url)}
                      className="p-2 text-base-content/20 hover:text-error hover:bg-error/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/domains/regist/")({
  component: RegistDomains,
});
