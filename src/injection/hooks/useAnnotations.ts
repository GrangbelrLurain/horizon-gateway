import { useCallback, useEffect, useMemo, useState } from "react";
import type { Annotation, LocatorValidation } from "@/entities/inspector";
import { matchHostPattern, matchPathPattern } from "@/shared/lib/pattern";
import { deleteAnnotationApi, fetchAnnotationsApi, saveAnnotationApi } from "../api/gateway";
import { denormalizedSelector, ensureLocators, promoteLocator } from "../lib/locator";

export function useAnnotations() {
  const [allAnnotations, setAnnotations] = useState<Annotation[]>([]);
  const [showPolicyBadges, setShowPolicyBadges] = useState(true);
  const [activeBadgeId, setActiveBadgeId] = useState<string | null>(null);

  const fetchAnnotations = useCallback(() => {
    fetchAnnotationsApi()
      .then((data) => setAnnotations(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "WT_POLICY_SAVED") {
        fetchAnnotations();
      }
    };
    window.addEventListener("message", handleMessage);
    fetchAnnotations();
    // Headless CLI writes bypass Tauri events; poll so injected badges stay in sync.
    const pollId = window.setInterval(fetchAnnotations, 2000);
    return () => {
      window.removeEventListener("message", handleMessage);
      window.clearInterval(pollId);
    };
  }, [fetchAnnotations]);

  const currentPagePolicies = useMemo(() => {
    const currentHost = window.location.host;
    const currentPath = window.location.pathname;

    return allAnnotations.filter((ann) => {
      const matchesHost = matchHostPattern(ann.hostPattern, ann.domain, currentHost);
      const matchesPath = matchPathPattern(ann.pathPattern, ann.url, currentPath);
      return matchesHost && matchesPath;
    });
  }, [allAnnotations]);

  const [editingAnnotation, setEditingAnnotation] = useState<Annotation | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  const copyToClipboard = useCallback((text: string, toastMsg: string) => {
    try {
      navigator.clipboard.writeText(text);
      setToastMessage(toastMsg);
    } catch (_e) {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setToastMessage(toastMsg);
    }
  }, []);

  const copyDescription = useCallback(
    (ann: Annotation, e?: React.MouseEvent) => {
      e?.stopPropagation();
      copyToClipboard(ann.description || "", `'${ann.role}' 설명이 복사되었습니다`);
    },
    [copyToClipboard],
  );

  const copySelector = useCallback(
    (ann: Annotation, e?: React.MouseEvent) => {
      e?.stopPropagation();
      const locs = ensureLocators(ann);
      const primary = locs[0];
      const line =
        primary?.strategy === "role"
          ? `role=${primary.role} name=${primary.name}`
          : `${primary?.strategy ?? "css"}=${primary?.value ?? ann.selector}`;
      copyToClipboard(line || ann.selector || "", `'${ann.role}' Locator가 복사되었습니다`);
    },
    [copyToClipboard],
  );

  const copySummary = useCallback(
    (ann: Annotation, e?: React.MouseEvent) => {
      e?.stopPropagation();
      const locs = ensureLocators(ann)
        .map((l, i) => {
          if (l.strategy === "role") {
            return `${i}: role ${l.role}/${l.name}`;
          }
          return `${i}: ${l.strategy}=${l.value ?? ""}`;
        })
        .join(", ");
      const summary = `### [${ann.role}]\n${ann.description || "-"}\n\n- Locators: \`${locs}\`\n- Selector: \`${ann.selector}\`\n- Host Pattern: \`${ann.hostPattern || ann.domain || "*"}\`\n- Path Pattern: \`${ann.pathPattern || "*"}\`\n- Validation: \`${ann.lastValidation?.status ?? "unknown"}\`\n- URL: ${ann.url || "-"}`;
      copyToClipboard(summary, `'${ann.role}' 가이드 요약이 복사되었습니다`);
    },
    [copyToClipboard],
  );

  const deleteAnnotation = async (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    const res = await deleteAnnotationApi(id);
    if (res.ok) {
      fetchAnnotations();
      setToastMessage("가이드가 삭제되었습니다");
    }
  };

  const persistValidation = useCallback(async (ann: Annotation, validation: LocatorValidation) => {
    const updated: Annotation = { ...ann, lastValidation: validation };
    setAnnotations((prev) => prev.map((a) => (a.id === ann.id ? updated : a)));
    try {
      await saveAnnotationApi(updated as unknown as Record<string, unknown>);
    } catch {
      /* ignore */
    }
  }, []);

  const promoteAnnotation = useCallback(
    async (ann: Annotation, promoteIndex: number) => {
      const locators = promoteLocator(ensureLocators(ann), promoteIndex);
      const updated: Annotation = {
        ...ann,
        locators,
        selector: denormalizedSelector(locators) || ann.selector,
        lastValidation: null,
      };
      setAnnotations((prev) => prev.map((a) => (a.id === ann.id ? updated : a)));
      const res = await saveAnnotationApi(updated as unknown as Record<string, unknown>);
      if (res.ok) {
        setToastMessage(`'${ann.role}' locator를 primary로 승격했습니다`);
        fetchAnnotations();
        window.parent.postMessage({ type: "WT_POLICY_SAVED" }, "*");
      } else {
        setToastMessage("승격에 실패했습니다");
        fetchAnnotations();
      }
    },
    [fetchAnnotations],
  );

  return {
    allAnnotations,
    showPolicyBadges,
    setShowPolicyBadges,
    activeBadgeId,
    setActiveBadgeId,
    currentPagePolicies,
    editingAnnotation,
    setEditingAnnotation,
    toastMessage,
    setToastMessage,
    showToast,
    copyDescription,
    copySelector,
    copySummary,
    fetchAnnotations,
    deleteAnnotation,
    persistValidation,
    promoteAnnotation,
  };
}
