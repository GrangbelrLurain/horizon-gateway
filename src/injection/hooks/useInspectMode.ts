import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Annotation } from "@/entities/inspector";
import { saveAnnotationApi } from "../api/gateway";
import { captureElementThumbnail, capturePageMeta } from "../lib/capture";
import { buildLocatorsFromElement, denormalizedSelector } from "../lib/locator";
import { generateRobustSelector } from "../lib/selector";
import type { EditingElement } from "../types";

export function useInspectMode(fetchAnnotations: () => void, allAnnotations: Annotation[] = []) {
  const [isInspectMode, setIsInspectMode] = useState(false);
  const [hoveredElement, setHoveredElement] = useState<HTMLElement | null>(null);
  const [editingElement, setEditingElement] = useState<EditingElement | null>(null);
  const [role, setRole] = useState("");
  const [description, setDescription] = useState("");
  const [hostPattern, setHostPatternState] = useState("");
  const [pathPattern, setPathPatternState] = useState("");
  const hostPatternRef = useRef("");
  const pathPatternRef = useRef("");
  const [isSaving, setIsSaving] = useState(false);

  const setHostPattern = (value: string) => {
    hostPatternRef.current = value;
    setHostPatternState(value);
  };
  const setPathPattern = (value: string) => {
    pathPatternRef.current = value;
    setPathPatternState(value);
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "WT_SET_INSPECT_MODE") {
        setIsInspectMode(event.data.enabled);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const suggestedHostPatterns = useMemo(() => {
    const set = new Set<string>();
    const currentHost = window.location.host;
    set.add(currentHost);
    for (const ann of allAnnotations) {
      if (ann.domain === currentHost || ann.hostPattern) {
        if (ann.hostPattern) {
          set.add(ann.hostPattern);
        }
      }
    }
    return Array.from(set);
  }, [allAnnotations]);

  const suggestedPathPatterns = useMemo(() => {
    const set = new Set<string>();
    const currentPath = window.location.pathname;
    set.add(currentPath);
    for (const ann of allAnnotations) {
      if (ann.pathPattern) {
        set.add(ann.pathPattern);
      }
    }
    return Array.from(set);
  }, [allAnnotations]);

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

      const currentHost = window.location.host;
      const currentPath = window.location.pathname;

      // Smart auto-fill: Find most recent custom patterns used on this host/path
      const existingHostAnn = allAnnotations.find((a) => a.domain === currentHost && a.hostPattern);
      const existingPathAnn = allAnnotations.find((a) => a.pathPattern && a.pathPattern !== currentPath);

      setEditingElement({
        tagName: target.tagName,
        selector: generateRobustSelector(target),
        target: target,
      });
      setRole("");
      setDescription("");
      const nextHost = existingHostAnn?.hostPattern || currentHost;
      const nextPath = existingPathAnn?.pathPattern || currentPath;
      hostPatternRef.current = nextHost;
      pathPatternRef.current = nextPath;
      setHostPatternState(nextHost);
      setPathPatternState(nextPath);
    },
    [isInspectMode, editingElement, allAnnotations],
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

  const saveAnnotation = async (live?: { hostPattern?: string; pathPattern?: string; description?: string }) => {
    if (!editingElement || !role) {
      return;
    }
    const liveHostPattern = (live?.hostPattern ?? hostPatternRef.current).trim() || window.location.host;
    const livePathPattern = (live?.pathPattern ?? pathPatternRef.current).trim() || window.location.pathname;
    const liveDescription = (live?.description ?? description).trim();
    setIsSaving(true);
    const thumbnail = await captureElementThumbnail(editingElement.target);
    const pageMeta = capturePageMeta();
    const cssSelector = editingElement.selector;
    const locators = buildLocatorsFromElement(editingElement.target, cssSelector);

    const payload = {
      id: crypto.randomUUID(),
      role: role.trim(),
      description: liveDescription,
      tagName: editingElement.tagName,
      selector: denormalizedSelector(locators) || cssSelector,
      content: (editingElement.target.innerText || "").substring(0, 100),
      url: pageMeta.url,
      domain: pageMeta.domain,
      hostPattern: liveHostPattern,
      pathPattern: livePathPattern,
      timestamp: Date.now(),
      thumbnail,
      locators,
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
    hostPattern,
    setHostPattern,
    pathPattern,
    setPathPattern,
    suggestedHostPatterns,
    suggestedPathPatterns,
    isSaving,
    saveAnnotation,
  };
}
