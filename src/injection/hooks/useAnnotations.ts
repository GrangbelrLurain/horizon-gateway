import { useCallback, useEffect, useMemo, useState } from "react";
import type { Annotation } from "@/entities/inspector";
import { deleteAnnotationApi, fetchAnnotationsApi } from "../api/gateway";
import { normalizeUrl } from "../lib/url";

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
    return () => window.removeEventListener("message", handleMessage);
  }, [fetchAnnotations]);

  const currentPagePolicies = useMemo(() => {
    const current = normalizeUrl(window.location.href);
    return allAnnotations.filter((ann) => {
      if (!ann.url) {
        return false;
      }
      const target = normalizeUrl(ann.url);
      return target.host === current.host && target.path === current.path;
    });
  }, [allAnnotations]);

  const deleteAnnotation = async (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    const res = await deleteAnnotationApi(id);
    if (res.ok) {
      fetchAnnotations();
    }
  };

  return {
    allAnnotations,
    showPolicyBadges,
    setShowPolicyBadges,
    activeBadgeId,
    setActiveBadgeId,
    currentPagePolicies,
    fetchAnnotations,
    deleteAnnotation,
  };
}
