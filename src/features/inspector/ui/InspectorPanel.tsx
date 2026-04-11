import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { useAtomValue } from "jotai";
import { jsPDF } from "jspdf";
import {
  AlertCircle,
  Camera,
  Check,
  Edit2,
  ExternalLink,
  FileText,
  Globe,
  Info,
  RotateCcw,
  Save,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { proxyRunningAtom } from "@/domain/app-status/store";
import { languageAtom } from "@/domain/i18n/store";
import type { Annotation, CapturedElement } from "@/entities/domain/types/inspector";
import { invokeApi } from "@/shared/api";
import { Button } from "@/shared/ui/button/Button";
import { Card } from "@/shared/ui/card/card";
import { Input } from "@/shared/ui/input/Input";
import { H1, P } from "@/shared/ui/typography/typography";

/**
 * URL을 감지하여 <a> 태그로 변환하는 컴포넌트
 */
function AutoLinkText({ text }: { text: string }) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return (
    <>
      {parts.map((part, i) =>
        urlRegex.test(part) ? (
          <a
            key={i}
            href={part}
            onClick={(e) => {
              e.preventDefault();
              invoke("plugin:opener|open", { path: part });
            }}
            className="text-primary hover:underline inline-flex items-center gap-0.5"
          >
            {part}
            <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function InspectorPanel() {
  const lang = useAtomValue(languageAtom);
  const isProxyRunning = useAtomValue(proxyRunningAtom);
  const [captured, setCaptured] = useState<CapturedElement | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [role, setRole] = useState("");
  const [description, setDescription] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const t = {
    ko: {
      title: "UX 정책 관리",
      subtitle: "서비스의 UI 요소별 정책과 요구사항을 문서화하고 관리합니다.",
      statusActive: "워치타워 프록시가 활성화되어 있습니다.",
      statusInactive: "프록시가 실행 중이 아닙니다. 인스펙터 기능을 사용하려면 프록시를 켜주세요.",
      capturedTitle: "새 정책 정의",
      rolePlaceholder: "요소 명칭 (예: 메인 로그인 버튼)",
      descPlaceholder: "기능 정의 및 UX 정책 내용을 입력하세요.",
      saveBtn: "정책 저장",
      listTitle: "정의된 UX 정책",
      noAnnotations: "아직 등록된 정책이 없습니다. 브라우저에서 요소를 캡처하여 시작하세요.",
      selector: "CSS 선택자",
      tagName: "태그",
      exportBtn: "문서로 내보내기",
      copySuccess: "마크다운 문서가 클립보드에 복사되었습니다.",
      domainGroup: "도메인",
    },
    en: {
      title: "UX Policy Management",
      subtitle: "Document and manage UI policies and requirements for each service.",
      statusActive: "Watchtower Proxy is active.",
      statusInactive: "Proxy is not running. Please start the proxy to use the inspector.",
      capturedTitle: "Define New Policy",
      rolePlaceholder: "Element Title (e.g. Main Login Button)",
      descPlaceholder: "Enter functional definitions and UX policy details.",
      saveBtn: "Save Policy",
      listTitle: "Defined UX Policies",
      noAnnotations: "No policies registered yet. Start by capturing elements from your browser.",
      selector: "CSS Selector",
      tagName: "Tag",
      exportBtn: "Export as Document",
      copySuccess: "Markdown document copied to clipboard.",
      domainGroup: "Domain",
    },
  }[lang] || {
    title: "UX Policy Management",
    subtitle: "Document and manage UI policies and requirements for each service.",
    statusActive: "Watchtower Proxy is active.",
    statusInactive: "Proxy is not running. Please start the proxy to use the inspector.",
    capturedTitle: "Define New Policy",
    rolePlaceholder: "Element Title (e.g. Main Login Button)",
    descPlaceholder: "Enter functional definitions and UX policy details.",
    saveBtn: "Save Policy",
    listTitle: "Defined UX Policies",
    noAnnotations: "No policies registered yet. Start by capturing elements from your browser.",
    selector: "CSS Selector",
    tagName: "Tag",
    exportBtn: "Export as Document",
    copySuccess: "Markdown document copied to clipboard.",
    domainGroup: "Domain",
  };

  useEffect(() => {
    // Initial status
    invokeApi("get_annotations").then((res) => {
      if (res.success && res.data) {
        setAnnotations(res.data);
      }
    });

    const unlisten = listen<CapturedElement>("annotation-dialog-requested", (event) => {
      setCaptured(event.payload);
      setRole("");
      setDescription("");
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const annotationsByDomain = useMemo(() => {
    const groups: Record<string, Annotation[]> = {};
    for (const ann of annotations) {
      const domain = ann.domain || "Unknown";
      if (!groups[domain]) {
        groups[domain] = [];
      }
      groups[domain].push(ann);
    }
    return groups;
  }, [annotations]);

  const saveAnnotation = async () => {
    if (!captured) {
      return;
    }
    const newAnnotation: Annotation = {
      ...captured,
      id: Math.random().toString(36).substring(2, 9),
      role,
      description,
      timestamp: Date.now(),
    };

    const res = await invokeApi("add_annotation", { payload: newAnnotation });
    if (res.success && res.data) {
      setAnnotations(res.data);
    }
    setCaptured(null);
  };

  const deleteAnnotation = async (id: string) => {
    const res = await invokeApi("delete_annotation", { payload: { id } });
    if (res.success && res.data) {
      setAnnotations(res.data);
    }
  };

  const startEdit = (ann: Annotation) => {
    setEditingId(ann.id);
    setEditRole(ann.role);
    setEditDesc(ann.description);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditRole("");
    setEditDesc("");
  };

  const handleUpdate = async () => {
    if (!editingId) {
      return;
    }
    const res = await invokeApi("update_annotation", {
      payload: { id: editingId, role: editRole, description: editDesc },
    });
    if (res.success && res.data) {
      setAnnotations(res.data);
      cancelEdit();
    }
  };

  const openExternalUrl = async (url: string) => {
    if (!url) {
      return;
    }
    try {
      await invoke("plugin:opener|open", { path: url });
    } catch (err) {
      console.error("Failed to open URL:", err);
      // Fallback
      window.open(url, "_blank");
    }
  };

  const exportToPdf = async () => {
    try {
      const filePath = await save({
        filters: [{ name: "PDF Document", extensions: ["pdf"] }],
        defaultPath: "ux-policy-report.pdf",
      });

      if (!filePath) {
        return;
      }

      const doc = new jsPDF();

      // Load Korean Font (Malgun Gothic)
      try {
        const fontBytes = await readFile("C:\\Windows\\Fonts\\malgun.ttf");
        // Convert to Base64
        let binary = "";
        const bytes = new Uint8Array(fontBytes);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Font = btoa(binary);

        doc.addFileToVFS("malgun.ttf", base64Font);
        doc.addFont("malgun.ttf", "malgun", "normal");
        doc.setFont("malgun");
      } catch (e) {
        console.error("Font load failed:", e);
      }

      let yPos = 20;

      // Title
      doc.setFontSize(22);
      doc.setTextColor(0, 102, 204);
      doc.text(t.title, 20, yPos);
      yPos += 15;

      for (const ann of annotations) {
        if (yPos > 240) {
          doc.addPage();
          doc.setFont("malgun");
          yPos = 20;
        }

        // 1. Role (Title)
        doc.setFontSize(16);
        doc.setTextColor(0, 0, 0);
        doc.text(ann.role, 20, yPos);
        yPos += 10;

        // 2. Image (Thumbnail)
        if (ann.thumbnail) {
          try {
            doc.addImage(ann.thumbnail, "PNG", 20, yPos, 100, 60);
            yPos += 70;
          } catch (e) {
            console.error("Failed to add image to PDF:", e);
          }
        }

        // 3. Description (Multi-line)
        doc.setFontSize(11);
        doc.setTextColor(100, 100, 100);
        const splitText = doc.splitTextToSize(ann.description, 170);
        doc.text(splitText, 20, yPos);
        yPos += splitText.length * 7 + 15;

        // Separator
        doc.setDrawColor(230, 230, 230);
        doc.line(20, yPos - 10, 190, yPos - 10);
      }

      const pdfArrayBuffer = doc.output("arraybuffer");
      await writeFile(filePath, new Uint8Array(pdfArrayBuffer));
      alert("이미지가 포함된 PDF 문서가 성공적으로 생성되었습니다.");
    } catch (err: unknown) {
      console.error("Failed to export PDF:", err);
      const message = err instanceof Error ? err.message : String(err);
      alert(`PDF 생성 중 오류가 발생했습니다: ${message}`);
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-20">
      <header className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-primary/20 rounded-xl text-primary">
              <FileText className="w-6 h-6" />
            </div>
            <H1 className="text-3xl font-black tracking-tight">{t.title}</H1>
          </div>
          <P className="text-base-content/60 ml-1">{t.subtitle}</P>
        </div>
        {annotations.length > 0 && (
          <Button variant="secondary" size="sm" className="gap-2 mb-1" onClick={exportToPdf}>
            <FileText className="w-4 h-4" />
            PDF로 저장하기
          </Button>
        )}
      </header>

      {/* 안내 문구: 프록시가 꺼져 있을 때만 표시 (오류 상태) */}
      {!isProxyRunning && (
        <Card className="p-6 border-none bg-error/10 shadow-sm ring-1 ring-error/20">
          <div className="flex items-center gap-5">
            <div className="p-3.5 bg-error/20 rounded-2xl text-error border border-error/20">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="flex flex-col gap-1.5">
              <h3 className="font-bold text-xl text-error">{t.statusInactive}</h3>
              <P className="text-sm text-error/70 leading-relaxed">
                현재 워치타워 프록시가 비활성화되어 있어 브라우저에서 요소를 선택하거나 캡처할 수 없습니다. 설정
                페이지에서 프록시를 시작해 주세요.
              </P>
            </div>
          </div>
        </Card>
      )}

      {captured && (
        <Card className="p-6 border-2 border-primary/50 animate-in zoom-in-95 duration-300 shadow-2xl bg-base-100 ring-4 ring-primary/5">
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-3 text-primary">
              <Camera className="w-6 h-6" />
              {t.capturedTitle}
            </h2>
            <button
              type="button"
              onClick={() => setCaptured(null)}
              className="p-2 rounded-full hover:bg-base-200 text-base-content/40 hover:text-base-content transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-base-200/50 rounded-2xl overflow-hidden flex items-center justify-center p-6 border border-base-300/50 relative group">
              <img
                src={captured.thumbnail}
                alt="Captured element"
                className="max-w-full max-h-[320px] shadow-2xl rounded-lg"
              />
              <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] text-white font-bold flex items-center gap-2">
                <Globe className="w-3 h-3" />
                {captured.domain}
              </div>
            </div>

            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="captured-selector"
                  className="text-xs font-bold text-base-content/40 uppercase tracking-widest px-1"
                >
                  {t.selector}
                </label>
                <code
                  id="captured-selector"
                  className="text-[11px] bg-base-200 p-3 rounded-xl block break-all whitespace-pre-wrap font-mono border border-base-300/30 text-base-content/80"
                >
                  {captured.selector}
                </code>
              </div>

              <div className="flex flex-col gap-4">
                <Input
                  placeholder={t.rolePlaceholder}
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="font-bold text-lg h-12"
                />
                <textarea
                  placeholder={t.descPlaceholder}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="textarea textarea-bordered w-full h-28 bg-base-200/30 focus:outline-primary rounded-xl"
                />
                <Button
                  variant="primary"
                  className="w-full h-12 gap-2 text-lg font-bold"
                  onClick={saveAnnotation}
                  disabled={!role}
                >
                  <Save className="w-5 h-5" />
                  {t.saveBtn}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="flex flex-col gap-10">
        {annotations.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-base-300/50 rounded-3xl bg-base-200/20 text-base-content/20">
            <Info className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <P className="text-lg">{t.noAnnotations}</P>
          </div>
        ) : (
          Object.entries(annotationsByDomain).map(([domain, items]) => (
            <section key={domain} className="flex flex-col gap-5">
              <div className="flex items-center gap-3 border-b border-base-300 pb-3">
                <Globe className="w-5 h-5 text-primary/50" />
                <h2 className="text-xl font-black uppercase tracking-wider text-base-content/70">
                  {domain} <span className="text-primary ml-2 font-mono">({items.length})</span>
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-5">
                {items.map((ann) => (
                  <Card
                    key={ann.id}
                    className="p-5 flex gap-6 hover:border-primary/40 transition-all group bg-base-100 hover:shadow-lg border-base-300/50"
                  >
                    <div className="w-40 h-40 bg-base-200 rounded-xl overflow-hidden shrink-0 border border-base-300/30 flex items-center justify-center p-3 relative group/thumb">
                      <img src={ann.thumbnail} alt="" className="max-w-full max-h-full object-contain drop-shadow-md" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-white hover:bg-white/20 gap-1.5"
                          onClick={() => setZoomImage(ann.thumbnail)}
                        >
                          <Camera className="w-4 h-4" />
                          확대
                        </Button>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col py-1">
                      {editingId === ann.id ? (
                        <div className="flex flex-col gap-3">
                          <Input
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value)}
                            className="font-bold text-lg h-10"
                            placeholder="요소 명칭"
                          />
                          <textarea
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            className="textarea textarea-bordered w-full h-24 bg-base-200/30 focus:outline-primary rounded-xl text-sm"
                            placeholder="정책 내용"
                          />
                          <div className="flex gap-2 justify-end mt-1">
                            <Button variant="ghost" size="sm" className="gap-1.5" onClick={cancelEdit}>
                              <RotateCcw className="w-4 h-4" />
                              취소
                            </Button>
                            <Button variant="primary" size="sm" className="gap-1.5" onClick={handleUpdate}>
                              <Check className="w-4 h-4" />
                              저장
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <h3 className="font-bold text-2xl text-primary group-hover:text-primary-focus transition-colors">
                                  {ann.role}
                                </h3>
                                {ann.url && (
                                  <Button
                                    variant="ghost"
                                    size="xs"
                                    className="h-7 px-2 text-primary/60 hover:text-primary hover:bg-primary/10 gap-1 bg-primary/5 rounded-lg border border-primary/10"
                                    onClick={() => openExternalUrl(ann.url)}
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    사이트 방문
                                  </Button>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-base-content/40 font-medium mt-1">
                                <span className="truncate max-w-[300px]">{ann.url}</span>
                                <span>•</span>
                                <span>{new Date(ann.timestamp).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>

                          <div className="bg-base-200/30 p-4 rounded-xl border border-base-200 mt-2">
                            <P className="text-base text-base-content/80 whitespace-pre-wrap leading-relaxed">
                              <AutoLinkText text={ann.description} />
                            </P>
                          </div>
                        </>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-base-200/50">
                        <span className="badge badge-md bg-base-200 border-none text-base-content/60 rounded-lg font-bold">
                          {ann.tagName}
                        </span>
                        <code className="text-[10px] bg-primary/5 px-2 py-1 rounded-md text-primary/60 truncate max-w-sm font-mono border border-primary/10">
                          {ann.selector}
                        </code>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 self-start pt-1">
                      {editingId !== ann.id && (
                        <button
                          type="button"
                          onClick={() => startEdit(ann)}
                          className="text-base-content/20 hover:text-primary hover:bg-primary/10 rounded-xl p-2.5 transition-all"
                          title="수정"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteAnnotation(ann.id)}
                        className="text-base-content/20 hover:text-error hover:bg-error/10 rounded-xl p-2.5 transition-all"
                        title="삭제"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      {/* 이미지 확대 모달 */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-10 animate-in fade-in duration-200"
          onClick={() => setZoomImage(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setZoomImage(null);
            }
          }}
          role="button"
          tabIndex={0}
        >
          <button
            type="button"
            className="absolute top-10 right-10 text-white/50 hover:text-white transition-colors"
            onClick={() => setZoomImage(null)}
          >
            <X className="w-10 h-10" />
          </button>
          <img
            src={zoomImage}
            alt="Zoomed preview"
            className="max-w-full max-h-full shadow-2xl rounded-lg animate-in zoom-in-95 duration-300"
          />
        </div>
      )}
    </div>
  );
}

function Trash2({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}
