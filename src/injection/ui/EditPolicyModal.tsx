import { Edit3, FolderTree, Globe, Save, X } from "lucide-react";
import { useState } from "react";
import type { Annotation } from "@/entities/inspector";
import { saveAnnotationApi } from "../api/gateway";

interface EditPolicyModalProps {
  annotation: Annotation;
  onClose: () => void;
  onSaved: () => void;
  showToast: (msg: string) => void;
}

export function EditPolicyModal({ annotation, onClose, onSaved, showToast }: EditPolicyModalProps) {
  const [role, setRole] = useState(annotation.role || "");
  const [description, setDescription] = useState(annotation.description || "");
  const [hostPattern, setHostPattern] = useState(annotation.hostPattern || "");
  const [pathPattern, setPathPattern] = useState(annotation.pathPattern || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!role.trim()) {
      return;
    }
    setIsSaving(true);

    const updated: Annotation = {
      ...annotation,
      role: role.trim(),
      description: description.trim(),
      hostPattern: hostPattern.trim(),
      pathPattern: pathPattern.trim(),
    };

    try {
      const res = await saveAnnotationApi(updated as Record<string, unknown>);
      if (res.ok) {
        onSaved();
        showToast("가이드가 수정되었습니다.");
        window.parent.postMessage({ type: "WT_POLICY_SAVED" }, "*");
        onClose();
      }
    } catch (_e) {
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483647,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.96) 100%)",
          width: "440px",
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "85vh",
          overflowY: "auto",
          padding: "20px 24px",
          borderRadius: "20px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
          border: "1px solid rgba(236, 72, 153, 0.35)",
          color: "white",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Edit3 style={{ width: "16px", height: "16px", color: "#ec4899" }} />
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#f8fafc" }}>가이드 수정</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255, 255, 255, 0.5)",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
            }}
          >
            <X style={{ width: "18px", height: "18px" }} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label
            htmlFor="edit-role-input"
            style={{ fontSize: "10px", fontWeight: "800", color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}
          >
            가이드명 (Role / Title)
          </label>
          <input
            id="edit-role-input"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="예: 로그인 버튼 정책"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "10px",
              padding: "10px 12px",
              color: "white",
              fontSize: "13px",
              fontWeight: "600",
              outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label
            htmlFor="edit-desc-input"
            style={{ fontSize: "10px", fontWeight: "800", color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}
          >
            설명 (Description - 마크다운 지원)
          </label>
          <textarea
            id="edit-desc-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="상세 규칙, 코드 참조(`path`), - 목록..."
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "10px",
              padding: "10px 12px",
              color: "white",
              fontSize: "12px",
              lineHeight: "1.5",
              outline: "none",
              minHeight: "100px",
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label
              htmlFor="edit-host-pattern"
              style={{
                fontSize: "10px",
                fontWeight: "800",
                color: "rgba(255,255,255,0.5)",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Globe style={{ width: "10px", height: "10px", color: "#60a5fa" }} /> Host Pattern
            </label>
            <input
              id="edit-host-pattern"
              value={hostPattern}
              onChange={(e) => setHostPattern(e.target.value)}
              placeholder="예: *.modetour.dev"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "8px",
                padding: "8px 10px",
                color: "#93c5fd",
                fontSize: "11px",
                fontFamily: "monospace",
                outline: "none",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label
              htmlFor="edit-path-pattern"
              style={{
                fontSize: "10px",
                fontWeight: "800",
                color: "rgba(255,255,255,0.5)",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <FolderTree style={{ width: "10px", height: "10px", color: "#f472b6" }} /> Path Pattern
            </label>
            <input
              id="edit-path-pattern"
              value={pathPattern}
              onChange={(e) => setPathPattern(e.target.value)}
              placeholder="예: /products/*"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "8px",
                padding: "8px 10px",
                color: "#f472b6",
                fontSize: "11px",
                fontFamily: "monospace",
                outline: "none",
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "10px",
              padding: "8px 16px",
              color: "white",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!role.trim() || isSaving}
            style={{
              background: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
              border: "none",
              borderRadius: "10px",
              padding: "8px 18px",
              color: "white",
              fontSize: "12px",
              fontWeight: "800",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              opacity: !role.trim() || isSaving ? 0.5 : 1,
            }}
          >
            <Save style={{ width: "14px", height: "14px" }} />
            {isSaving ? "저장 중..." : "저장 완료"}
          </button>
        </div>
      </div>
    </div>
  );
}
