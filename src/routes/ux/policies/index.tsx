import { createFileRoute } from "@tanstack/react-router";
import { listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import html2canvas from "html2canvas";
import { useAtomValue } from "jotai";
import { jsPDF } from "jspdf";
import {
  BookOpen,
  Download,
  Edit2,
  ExternalLink,
  FileText,
  Globe,
  Info,
  LayoutGrid,
  Maximize2,
  RotateCcw,
  Search,
  Settings2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { languageAtom } from "@/entities/app";
import type { Annotation } from "@/shared/api";
import { commands, unwrap } from "@/shared/api";
import { useIsEmbeddedPage } from "@/shared/lib/tauri/useEmbedMode";
import { Button } from "@/shared/ui/button/Button";
import { Card } from "@/shared/ui/card/card";
import { Input } from "@/shared/ui/input/Input";
import { ConfirmModal } from "@/shared/ui/modal/ConfirmModal";
import { Modal } from "@/shared/ui/modal/Modal";
import { H1, P } from "@/shared/ui/typography/typography";
import { en } from "./en";
import { ko } from "./ko";

export const Route = createFileRoute("/ux/policies/")({
  component: PolicyListPage,
});

type ViewMode = "manage" | "report";

function PolicyListPage() {
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;
  const isEmbedded = useIsEmbeddedPage();

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [search, setSearch] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<ViewMode>("manage");

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Annotation | null>(null);
  const [editForm, setEditForm] = useState({ role: "", description: "", url: "" });

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  // Display Options State (For Report)
  const [visibleFields, setVisibleFields] = useState({
    selector: false,
    tag: false,
    url: true,
  });

  const documentRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const fetchAnnotations = useCallback(async () => {
    const res = unwrap(await commands.getAnnotations());
    if (res.success && res.data) {
      setAnnotations(res.data);
    }
  }, []);

  useEffect(() => {
    fetchAnnotations();
    const unlisten = listen("annotations-updated", fetchAnnotations);
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [fetchAnnotations]);

  const domains = useMemo(() => {
    const set = new Set<string>();
    for (const ann of annotations) {
      if (ann.domain) {
        set.add(ann.domain);
      }
    }
    return Array.from(set).sort();
  }, [annotations]);

  const filteredAnnotations = useMemo(() => {
    return annotations.filter((ann) => {
      const matchesDomain = selectedDomain === "ALL" || ann.domain === selectedDomain;
      const matchesSearch =
        search === "" ||
        ann.role.toLowerCase().includes(search.toLowerCase()) ||
        ann.description.toLowerCase().includes(search.toLowerCase()) ||
        ann.selector.toLowerCase().includes(search.toLowerCase());
      return matchesDomain && matchesSearch;
    });
  }, [annotations, selectedDomain, search]);

  const handleDelete = async (id: string) => {
    const res = unwrap(await commands.deleteAnnotation({ id }));
    if (res.success && res.data) {
      setAnnotations(res.data);
    }
    setDeleteId(null);
  };

  const openEditModal = (ann: Annotation) => {
    setEditingPolicy(ann);
    setEditForm({ role: ann.role, description: ann.description, url: ann.url || "" });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingPolicy) {
      return;
    }
    const res = unwrap(
      await commands.updateAnnotation({
        id: editingPolicy.id,
        role: editForm.role,
        description: editForm.description,
      }),
    );
    if (res.success && res.data) {
      setAnnotations(res.data);
      setIsEditModalOpen(false);
    }
  };

  const handleExportPdf = async () => {
    if (filteredAnnotations.length === 0) {
      return;
    }

    // Switch to report view if not already there, but wait for render
    const originalView = viewMode;
    if (viewMode !== "report") {
      setViewMode("report");
      // Short delay to ensure DOM is ready for html2canvas
      await new Promise((r) => setTimeout(r, 100));
    }

    if (!documentRef.current) {
      return;
    }
    setIsExporting(true);

    try {
      const filePath = await save({
        filters: [{ name: "PDF Document", extensions: ["pdf"] }],
        defaultPath: `${t.pdfFileName}.pdf`,
      });
      if (!filePath) {
        setIsExporting(false);
        if (originalView !== "report") {
          setViewMode(originalView);
        }
        return;
      }

      const element = documentRef.current;
      const canvas = await html2canvas(element, {
        scale: 1.5,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: "#ffffff",
        scrollY: -window.scrollY,
        scrollX: 0,
        windowWidth: 1200,
        onclone: (clonedDoc) => {
          const styles = clonedDoc.getElementsByTagName("style");
          for (let i = styles.length - 1; i >= 0; i--) {
            styles[i].remove();
          }
          const links = clonedDoc.getElementsByTagName("link");
          for (let i = links.length - 1; i >= 0; i--) {
            if (links[i].rel === "stylesheet") {
              links[i].remove();
            }
          }
          const reportEl = clonedDoc.getElementById("policy-document-view");
          if (reportEl) {
            reportEl.style.width = "1100px";
            reportEl.style.padding = "80px";
            reportEl.style.margin = "0 auto";
          }
        },
      });

      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const pxPerMm = imgWidth / pdfWidth;
      const canvasPageHeight = pdfHeight * pxPerMm;

      let heightLeft = imgHeight;
      let sY = 0;

      while (heightLeft > 0) {
        const h = Math.min(heightLeft, canvasPageHeight);
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = imgWidth;
        pageCanvas.height = h;
        const ctx = pageCanvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(canvas, 0, sY, imgWidth, h, 0, 0, imgWidth, h);
        }
        const pageData = pageCanvas.toDataURL("image/jpeg", 0.9);
        const renderedHeight = h / pxPerMm;
        pdf.addImage(pageData, "JPEG", 0, 0, pdfWidth, renderedHeight, undefined, "FAST");
        heightLeft -= h;
        sY += h;
        if (heightLeft > 0) {
          pdf.addPage();
        }
      }

      const pdfArrayBuffer = pdf.output("arraybuffer");
      await writeFile(filePath, new Uint8Array(pdfArrayBuffer));
      alert("PDF 리포트가 성공적으로 생성되었습니다.");
    } catch (err) {
      console.error(err);
      alert(`PDF 생성 중 오류 발생: ${err}`);
    } finally {
      setIsExporting(false);
      // Restore view mode if we switched it
      if (originalView !== "report") {
        setViewMode(originalView);
      }
    }
  };

  const openExternalUrl = async (url: string | null | undefined) => {
    if (!url) {
      return;
    }
    try {
      await openPath(url);
    } catch (_err) {
      try {
        await openUrl(url);
      } catch {
        window.open(url, "_blank");
      }
    }
  };

  const handleExportJson = async () => {
    try {
      const filePath = await save({
        filters: [{ name: "JSON", extensions: ["json"] }],
        defaultPath: "watchtower-policies.json",
      });
      if (!filePath) {
        return;
      }
      await writeTextFile(filePath, JSON.stringify(annotations, null, 2));
      alert(t.exportSuccess);
    } catch (err) {
      alert(`Export failed: ${err}`);
    }
  };

  const handleImportJson = async () => {
    try {
      const selected = await open({ multiple: false, filters: [{ name: "JSON", extensions: ["json"] }] });
      if (!selected || Array.isArray(selected)) {
        return;
      }
      const content = await readTextFile(selected);
      const imported = JSON.parse(content) as Annotation[];
      const res = unwrap(await commands.importAnnotations({ annotations: imported }));
      if (res.success && res.data) {
        setAnnotations(res.data);
        alert(`${imported.length}${t.importSuccess}`);
      }
    } catch (err) {
      alert(`Import failed: ${err}`);
    }
  };

  return (
    <div className={`flex flex-col gap-6 max-w-7xl mx-auto ${isEmbedded ? "h-full min-h-0" : "pb-20"}`}>
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        {!isEmbedded && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/20 rounded-xl text-primary">
                <BookOpen className="w-6 h-6" />
              </div>
              <H1 className="text-3xl font-black tracking-tight">{t.title}</H1>
            </div>
            <P className="text-base-content/60 ml-1">{t.subtitle}</P>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {/* View Toggle */}
          <div className="flex bg-base-300 p-1 rounded-xl mr-2">
            <button
              type="button"
              onClick={() => setViewMode("manage")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                viewMode === "manage"
                  ? "bg-base-100 shadow-sm text-primary"
                  : "text-base-content/40 hover:text-base-content"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              {t.viewManage}
            </button>
            <button
              type="button"
              onClick={() => setViewMode("report")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                viewMode === "report"
                  ? "bg-base-100 shadow-sm text-primary"
                  : "text-base-content/40 hover:text-base-content"
              }`}
            >
              <FileText className="w-4 h-4" />
              {t.viewPreview}
            </button>
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="gap-2 bg-base-100 h-10 px-4" onClick={handleImportJson}>
              <Upload className="w-4 h-4" />
              {t.importJson}
            </Button>
            <Button variant="ghost" size="sm" className="gap-2 bg-base-100 h-10 px-4" onClick={handleExportJson}>
              <Download className="w-4 h-4" />
              {t.exportJson}
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="gap-2 h-10 px-5 font-black"
              onClick={handleExportPdf}
              disabled={isExporting || filteredAnnotations.length === 0}
            >
              {isExporting ? <RotateCcw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              {t.exportPdf}
            </Button>
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-8 flex flex-col gap-3">
          <Card className="p-2 flex items-center gap-2 bg-base-100 border-none shadow-sm ring-1 ring-base-300">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/30" />
              <input
                type="text"
                placeholder={t.searchPlaceholder}
                className="input input-ghost w-full pl-10 focus:bg-base-200/50"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 px-2 border-l border-base-200 ml-2 pl-2">
              <button
                type="button"
                onClick={() => setSelectedDomain("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  selectedDomain === "ALL"
                    ? "bg-primary text-primary-content shadow-md"
                    : "bg-base-200 hover:bg-base-300"
                }`}
              >
                {t.filterAll}
              </button>
              {domains.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDomain(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    selectedDomain === d ? "bg-primary text-primary-content shadow-md" : "bg-base-200 hover:bg-base-300"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div className="md:col-span-4">
          <Card className="p-3 flex items-center justify-between bg-base-100 border-none shadow-sm ring-1 ring-base-300 h-full">
            <span className="text-[10px] font-black uppercase text-base-content/40 tracking-widest px-1 flex items-center gap-2">
              <Settings2 className="w-3 h-3" /> {t.displayOptions}
            </span>
            <div className="flex items-center gap-3">
              {["url", "tag", "selector"].map((field) => (
                <label key={field} className="flex items-center gap-1.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-xs checkbox-primary rounded-md"
                    checked={visibleFields[field as keyof typeof visibleFields]}
                    onChange={(e) => setVisibleFields((prev) => ({ ...prev, [field]: e.target.checked }))}
                  />
                  <span className="text-[10px] font-bold text-base-content/60 group-hover:text-primary uppercase">
                    {field}
                  </span>
                </label>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="relative">
        {/* VIEW 1: MANAGE MODE (INTERACTIVE CARDS) */}
        {viewMode === "manage" && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredAnnotations.length === 0 ? (
              <div className="col-span-full py-40 flex flex-col items-center justify-center text-base-content/20 bg-base-100/30 rounded-3xl border-2 border-dashed border-base-300">
                <Info className="w-16 h-16 mb-4 opacity-10" />
                <p className="text-xl font-bold">{t.noPolicies}</p>
              </div>
            ) : (
              filteredAnnotations.map((ann, idx) => (
                <Card
                  key={ann.id}
                  className="group p-5 flex flex-col gap-4 bg-base-100 hover:shadow-xl hover:ring-2 hover:ring-primary/20 transition-all border-none shadow-sm ring-1 ring-base-300"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-lg bg-base-200 flex items-center justify-center font-black text-xs text-base-content/40">
                        {idx + 1}
                      </span>
                      <h3 className="font-bold text-base text-base-content truncate max-w-[180px]" title={ann.role}>
                        {ann.role}
                      </h3>
                    </div>
                    {ann.url && (
                      <Button
                        variant="ghost"
                        size="xs"
                        className="h-8 w-8 p-0 text-primary/40 hover:text-primary hover:bg-primary/10 rounded-full"
                        onClick={() => openExternalUrl(ann.url)}
                        title={t.visitSite}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  <div className="relative aspect-video bg-base-200 overflow-hidden border border-base-300/50">
                    <img src={ann.thumbnail} alt="" className="w-full h-full object-contain" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="rounded-full bg-white/90 text-black border-none"
                        onClick={() => setZoomImage(ann.thumbnail)}
                      >
                        <Maximize2 className="w-4 h-4" /> {t.zoom}
                      </Button>
                    </div>
                  </div>

                  <div className="flex-1">
                    <p className="text-sm text-base-content/70 line-clamp-3 leading-relaxed min-h-[60px]">
                      {ann.description || "-"}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 pt-4 border-t border-base-200">
                    <div className="flex items-center justify-between text-[10px] font-medium text-base-content/40">
                      <div className="flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        <span className="font-bold">{ann.domain}</span>
                      </div>
                      <span>{new Date(ann.timestamp ?? 0).toLocaleDateString()}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1 gap-2 text-xs font-bold"
                        onClick={() => openEditModal(ann)}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        {t.edit}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-none w-10 text-error hover:bg-error/10"
                        onClick={() => setDeleteId(ann.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {/* VIEW 2: REPORT PREVIEW (CLEAN WYSIWYG) */}
        {viewMode === "report" && (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <div
              ref={documentRef}
              id="policy-document-view"
              style={{
                backgroundColor: "#ffffff",
                color: "#0f172a",
                display: "flex",
                flexDirection: "column",
                gap: "48px",
              }}
              className="p-12 rounded-3xl shadow-sm border border-base-200 min-h-[600px] mx-auto overflow-hidden"
            >
              {filteredAnnotations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-40" style={{ color: "#cbd5e1" }}>
                  <Info className="w-16 h-16 mb-4 opacity-10" />
                  <p className="text-xl font-bold">{t.noPolicies}</p>
                </div>
              ) : (
                <>
                  {/* PDF Header */}
                  <div
                    style={{
                      borderBottom: "2px solid #6366f133",
                      paddingBottom: "24px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-end",
                    }}
                  >
                    <div>
                      <h2 style={{ color: "#6366f1", fontSize: "36px", fontWeight: "900", margin: 0 }}>
                        {t.pdfFileName.replace(/_/g, " ")}
                      </h2>
                      <p
                        style={{
                          color: "#94a3b8",
                          fontSize: "14px",
                          fontFamily: "monospace",
                          fontStyle: "italic",
                          margin: "4px 0 0 0",
                        }}
                      >
                        Generated at: {new Date().toLocaleString()}
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p
                        style={{
                          color: "#6366f166",
                          fontSize: "12px",
                          fontWeight: "900",
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                          margin: 0,
                        }}
                      >
                        {selectedDomain}
                      </p>
                      <p style={{ color: "#0f172a", fontSize: "24px", fontWeight: "900", margin: 0 }}>
                        {filteredAnnotations.length} {t.policyCount}
                      </p>
                    </div>
                  </div>

                  {filteredAnnotations.map((ann, idx) => (
                    <div key={ann.id} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                          <span
                            style={{
                              backgroundColor: "#6366f1",
                              color: "#ffffff",
                              width: "32px",
                              height: "32px",
                              borderRadius: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: "900",
                              fontSize: "14px",
                            }}
                          >
                            {idx + 1}
                          </span>
                          <h3
                            style={{
                              color: "#0f172a",
                              fontSize: "24px",
                              fontWeight: "bold",
                              margin: 0,
                              lineHeight: "1.2",
                            }}
                          >
                            {ann.role}
                          </h3>
                        </div>
                        <div
                          style={{
                            color: "#94a3b8",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            fontSize: "12px",
                          }}
                        >
                          <Globe style={{ width: "12px", height: "12px" }} />
                          <span style={{ fontFamily: "monospace" }}>{ann.domain}</span>
                          <span>•</span>
                          <span>{new Date(ann.timestamp ?? 0).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(12, 1fr)",
                          gap: "32px",
                          alignItems: "flex-start",
                        }}
                      >
                        <div style={{ gridColumn: "span 5" }}>
                          <div style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", overflow: "hidden" }}>
                            <img src={ann.thumbnail} alt="" style={{ width: "100%", display: "block" }} />
                          </div>
                        </div>

                        <div style={{ gridColumn: "span 7", display: "flex", flexDirection: "column", gap: "16px" }}>
                          <div
                            style={{
                              backgroundColor: "#f8fafc",
                              border: "1px solid #f1f5f9",
                              padding: "20px",
                              borderRadius: "16px",
                              minHeight: "120px",
                            }}
                          >
                            <p
                              style={{
                                color: "#334155",
                                fontSize: "18px",
                                margin: 0,
                                whiteSpace: "pre-wrap",
                                lineHeight: "1.6",
                              }}
                            >
                              {ann.description}
                            </p>
                          </div>

                          {(visibleFields.tag || visibleFields.selector) && (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                              {visibleFields.tag && (
                                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                  <span
                                    style={{
                                      color: "#94a3b8",
                                      fontSize: "10px",
                                      fontWeight: "900",
                                      textTransform: "uppercase",
                                      letterSpacing: "0.1em",
                                      padding: "0 4px",
                                    }}
                                  >
                                    {t.tagName}
                                  </span>
                                  <span
                                    style={{
                                      backgroundColor: "#e2e8f0",
                                      color: "#475569",
                                      fontWeight: "bold",
                                      padding: "6px 12px",
                                      borderRadius: "8px",
                                      fontSize: "14px",
                                      width: "fit-content",
                                    }}
                                  >
                                    {ann.tagName}
                                  </span>
                                </div>
                              )}
                              {visibleFields.selector && (
                                <div
                                  style={{ display: "flex", flexDirection: "column", gap: "4px", overflow: "hidden" }}
                                >
                                  <span
                                    style={{
                                      color: "#94a3b8",
                                      fontSize: "10px",
                                      fontWeight: "900",
                                      textTransform: "uppercase",
                                      letterSpacing: "0.1em",
                                      padding: "0 4px",
                                    }}
                                  >
                                    {t.selector}
                                  </span>
                                  <code
                                    style={{
                                      backgroundColor: "#eef2ff",
                                      color: "#4f46e5",
                                      border: "1px solid #e0e7ff",
                                      fontSize: "10px",
                                      padding: "6px 8px",
                                      borderRadius: "6px",
                                      fontFamily: "monospace",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {ann.selector}
                                  </code>
                                </div>
                              )}
                            </div>
                          )}

                          {visibleFields.url && ann.url && (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                color: "rgba(99, 102, 241, 0.6)",
                                fontSize: "12px",
                                marginTop: "8px",
                              }}
                            >
                              <ExternalLink style={{ width: "12px", height: "12px" }} />
                              <span style={{ textDecoration: "underline", opacity: 0.8 }}>{ann.url}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      {idx < filteredAnnotations.length - 1 && (
                        <div style={{ backgroundColor: "#f1f5f9", height: "1px", margin: "16px 0" }} />
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)}>
        <Modal.Header title={t.editPolicy} />
        <Modal.Body className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase text-base-content/40 tracking-widest px-1">
              {t.roleLabel}
            </label>
            <Input
              value={editForm.role}
              onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value }))}
              className="font-bold text-lg"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase text-base-content/40 tracking-widest px-1">
              {t.descLabel}
            </label>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
              className="textarea textarea-bordered bg-base-200/50 min-h-[120px] focus:outline-primary leading-relaxed"
            />
          </div>
          <div className="flex flex-col gap-1.5 opacity-50">
            <label className="text-[10px] font-black uppercase text-base-content/40 tracking-widest px-1">
              {t.urlLabel}
            </label>
            <Input value={editForm.url} disabled className="font-mono text-xs bg-base-200" />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>
            {t.cancel}
          </Button>
          <Button variant="primary" onClick={handleUpdate} disabled={!editForm.role}>
            {t.save}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Image Zoom Modal */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-md flex items-center justify-center p-10"
          onClick={() => setZoomImage(null)}
        >
          <button type="button" className="absolute top-10 right-10 text-white/50 hover:text-white transition-colors">
            <X className="w-10 h-10" />
          </button>
          <img
            src={zoomImage}
            alt=""
            className="max-w-full max-h-full shadow-2xl rounded-lg animate-in zoom-in-95 duration-200"
          />
        </div>
      )}

      <ConfirmModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        title={t.delete}
        message={t.deleteConfirm}
        type="danger"
      />
    </div>
  );
}
