import html2canvas from "html2canvas";
import { useCallback, useEffect, useState } from "react";
import { saveAnnotationApi } from "../api/gateway";
import { generateRobustSelector } from "../lib/selector";
import type { EditingElement } from "../types";

export function useInspectMode(fetchAnnotations: () => void) {
  const [isInspectMode, setIsInspectMode] = useState(false);
  const [hoveredElement, setHoveredElement] = useState<HTMLElement | null>(null);
  const [editingElement, setEditingElement] = useState<EditingElement | null>(null);
  const [role, setRole] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "WT_SET_INSPECT_MODE") {
        setIsInspectMode(event.data.enabled);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isInspectMode || editingElement) {
        return;
      }
      const target = e.target as HTMLElement;
      if (target && !target.closest("#horizon-gateway-injection-container") && target !== hoveredElement) {
        setHoveredElement(target);
      }
    },
    [isInspectMode, editingElement, hoveredElement],
  );

  const handleClick = useCallback(
    async (e: MouseEvent) => {
      if (!isInspectMode || editingElement) {
        return;
      }
      const target = e.target as HTMLElement;
      if (target.closest("#horizon-gateway-injection-container")) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      setHoveredElement(null);
      setIsInspectMode(false);

      setEditingElement({
        tagName: target.tagName,
        selector: generateRobustSelector(target),
        target: target,
      });
      setRole("");
      setDescription("");
    },
    [isInspectMode, editingElement],
  );

  useEffect(() => {
    if (isInspectMode) {
      document.addEventListener("mousemove", handleMouseMove, true);
      document.addEventListener("click", handleClick, true);
    } else {
      document.removeEventListener("mousemove", handleMouseMove, true);
      document.removeEventListener("click", handleClick, true);
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove, true);
      document.removeEventListener("click", handleClick, true);
    };
  }, [isInspectMode, handleMouseMove, handleClick]);

  const saveAnnotation = async () => {
    if (!editingElement || !role) {
      return;
    }
    setIsSaving(true);
    let thumbnail = "";
    try {
      const canvas = await html2canvas(editingElement.target, { useCORS: true, scale: 1, logging: false });
      thumbnail = canvas.toDataURL("image/webp", 0.3);
    } catch (_err) {}

    const cleanUrl = window.location.href.split("/.horizon-gateway")[0];

    const payload = {
      id: crypto.randomUUID(),
      role,
      description,
      tagName: editingElement.tagName,
      selector: editingElement.selector,
      content: (editingElement.target.innerText || "").substring(0, 100),
      url: cleanUrl,
      domain: window.location.host,
      timestamp: Date.now(),
      thumbnail,
    };

    const res = await saveAnnotationApi(payload);
    if (res.ok) {
      setEditingElement(null);
      fetchAnnotations();
      window.parent.postMessage({ type: "WT_POLICY_SAVED" }, "*");
    }
    setIsSaving(false);
  };

  return {
    isInspectMode,
    setIsInspectMode,
    hoveredElement,
    editingElement,
    setEditingElement,
    role,
    setRole,
    description,
    setDescription,
    isSaving,
    saveAnnotation,
  };
}
