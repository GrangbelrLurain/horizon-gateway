import { useAtom, useAtomValue } from "jotai";
import { FolderOpen, GitBranch, Plus, Save, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { languageAtom } from "@/entities/app";
import {
  type SandboxActiveFlow,
  type SavedPipeline,
  sandboxActiveFlowAtom,
  savedPipelinesAtom,
} from "@/entities/pipeline";
import { createSavedPipeline, deleteSavedPipeline, updateSavedPipeline } from "@/entities/sandbox";
import { toastError, toastInfo } from "@/shared/ui/toast";

const en = {
  title: "Saved Pipelines",
  search: "Search pipelines...",
  empty: "No saved pipelines yet.",
  newPipeline: "New",
  save: "Save",
  saveAs: "Save As",
  saved: "Saved!",
  load: "Load",
  deleteConfirm: "Delete this pipeline?",
  name: "Pipeline name",
  description: "Description (optional)",
  nodes: "nodes",
  loaded: "Loaded",
  update: "Update",
};

const ko = {
  title: "저장된 파이프라인",
  search: "파이프라인 검색...",
  empty: "저장된 파이프라인이 없습니다.",
  newPipeline: "새로 만들기",
  save: "저장",
  saveAs: "다른 이름으로 저장",
  saved: "저장됨!",
  load: "불러오기",
  deleteConfirm: "이 파이프라인을 삭제하시겠습니까?",
  name: "파이프라인 이름",
  description: "설명 (선택)",
  nodes: "노드",
  loaded: "불러옴",
  update: "업데이트",
};

function formatRelativeTime(ts: number, isKo: boolean): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) {
    return isKo ? "방금" : "just now";
  }
  if (minutes < 60) {
    return isKo ? `${minutes}분 전` : `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return isKo ? `${hours}시간 전` : `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return isKo ? `${days}일 전` : `${days}d ago`;
}

export function PipelineLibraryPanel() {
  const lang = useAtomValue(languageAtom);
  const isKo = lang === "ko";
  const t = isKo ? ko : en;

  const [activeFlow, setActiveFlow] = useAtom(sandboxActiveFlowAtom);
  const [savedPipelines, setSavedPipelines] = useAtom(savedPipelinesAtom);

  const [search, setSearch] = useState("");
  const [saveName, setSaveName] = useState("");
  const [saveDescription, setSaveDescription] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);

  const filteredPipelines = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) {
      return savedPipelines;
    }
    return savedPipelines.filter(
      (p) => p.name.toLowerCase().includes(query) || p.description.toLowerCase().includes(query),
    );
  }, [savedPipelines, search]);

  const loadedPipeline = useMemo(() => {
    if (!activeFlow.loadedFromId) {
      return null;
    }
    return savedPipelines.find((p) => p.id === activeFlow.loadedFromId) ?? null;
  }, [activeFlow.loadedFromId, savedPipelines]);

  const handleNewPipeline = () => {
    if (
      activeFlow.flow.nodes.length > 0 &&
      !window.confirm(
        isKo ? "현재 작업을 버리고 새 파이프라인을 만드시겠습니까?" : "Discard current work and create a new pipeline?",
      )
    ) {
      return;
    }

    const next: SandboxActiveFlow = {
      flow: { nodes: [], edges: [] },
      loadedFromId: null,
      revision: activeFlow.revision + 1,
      updatedAt: Date.now(),
    };
    setActiveFlow(next);
    setSaveName("");
    setSaveDescription("");
    setShowSaveForm(false);
  };

  const handleLoad = (pipeline: SavedPipeline) => {
    if (
      activeFlow.flow.nodes.length > 0 &&
      !window.confirm(
        isKo
          ? `"${pipeline.name}"을(를) 불러오면 현재 작업이 대체됩니다. 계속하시겠습니까?`
          : `Loading "${pipeline.name}" will replace the current work. Continue?`,
      )
    ) {
      return;
    }

    setActiveFlow({
      flow: pipeline.flow,
      loadedFromId: pipeline.id,
      revision: activeFlow.revision + 1,
      updatedAt: Date.now(),
    });
    setSaveName(pipeline.name);
    setSaveDescription(pipeline.description);
  };

  const persistSaved = (pipeline: SavedPipeline) => {
    setSavedPipelines((prev) => {
      const idx = prev.findIndex((p) => p.id === pipeline.id);
      if (idx === -1) {
        return [pipeline, ...prev];
      }
      const next = [...prev];
      next[idx] = pipeline;
      return next;
    });
  };

  const handleSave = async (asNew: boolean) => {
    const name = saveName.trim();
    if (!name) {
      toastInfo(isKo ? "파이프라인 이름을 입력해주세요." : "Please enter a pipeline name.");
      return;
    }

    if (activeFlow.flow.nodes.length === 0) {
      toastInfo(isKo ? "저장할 노드가 없습니다." : "No nodes to save.");
      return;
    }

    try {
      const existingId = !asNew && activeFlow.loadedFromId ? activeFlow.loadedFromId : null;
      const description = saveDescription.trim();
      const savedRaw = existingId
        ? await updateSavedPipeline(existingId, {
            name,
            description,
            flow: activeFlow.flow,
          })
        : await createSavedPipeline(name, description, activeFlow.flow);

      if (!savedRaw) {
        throw new Error("Save failed");
      }

      const saved: SavedPipeline = {
        ...savedRaw,
        createdAt: savedRaw.createdAt ?? Date.now(),
        updatedAt: savedRaw.updatedAt ?? Date.now(),
      };

      persistSaved(saved);
      setActiveFlow({
        ...activeFlow,
        loadedFromId: saved.id,
        updatedAt: saved.updatedAt,
      });

      setJustSaved(true);
      setShowSaveForm(false);
      window.setTimeout(() => setJustSaved(false), 1500);
    } catch (e) {
      console.error(e);
      toastError(isKo ? "저장에 실패했습니다." : "Failed to save pipeline.");
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(t.deleteConfirm)) {
      return;
    }
    try {
      await deleteSavedPipeline(id);
      setSavedPipelines((prev) => prev.filter((p) => p.id !== id));
      if (activeFlow.loadedFromId === id) {
        setActiveFlow({ ...activeFlow, loadedFromId: null });
      }
    } catch (err) {
      console.error(err);
      toastError(isKo ? "삭제에 실패했습니다." : "Failed to delete pipeline.");
    }
  };

  const openSaveForm = () => {
    if (loadedPipeline) {
      setSaveName(loadedPipeline.name);
      setSaveDescription(loadedPipeline.description);
    } else if (!saveName) {
      setSaveName(isKo ? "새 파이프라인" : "New Pipeline");
      setSaveDescription("");
    }
    setShowSaveForm(true);
  };

  return (
    <div className="card bg-base-100 border border-base-300 p-4 shadow-sm flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between border-b border-base-200 pb-3 mb-3 shrink-0">
        <span className="font-semibold flex items-center gap-1.5 text-base-content/85 text-sm">
          <GitBranch className="w-4 h-4 text-primary" />
          {t.title} ({savedPipelines.length})
        </span>
        <button type="button" onClick={handleNewPipeline} className="btn btn-xs btn-outline btn-primary gap-1">
          <Plus className="w-3 h-3" />
          {t.newPipeline}
        </button>
      </div>

      <div className="flex gap-1.5 shrink-0 mb-3">
        {activeFlow.loadedFromId && loadedPipeline ? (
          <>
            <button
              type="button"
              onClick={() => handleSave(false)}
              className={`btn btn-xs flex-1 gap-1 ${justSaved ? "btn-success" : "btn-primary"}`}
            >
              <Save className="w-3 h-3" />
              {justSaved ? t.saved : t.update}
            </button>
            <button type="button" onClick={openSaveForm} className="btn btn-xs btn-outline flex-1 gap-1">
              <Save className="w-3 h-3" />
              {t.saveAs}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={openSaveForm}
            className={`btn btn-xs flex-1 gap-1 ${justSaved ? "btn-success" : "btn-primary"}`}
          >
            <Save className="w-3 h-3" />
            {justSaved ? t.saved : t.save}
          </button>
        )}
      </div>

      {showSaveForm && (
        <div className="shrink-0 mb-3 p-3 bg-base-200/50 rounded-xl border border-base-300 space-y-2">
          <input
            type="text"
            className="input input-bordered input-xs w-full text-xs font-bold"
            placeholder={t.name}
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
          />
          <input
            type="text"
            className="input input-bordered input-xs w-full text-xs"
            placeholder={t.description}
            value={saveDescription}
            onChange={(e) => setSaveDescription(e.target.value)}
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => handleSave(!activeFlow.loadedFromId)}
              className="btn btn-xs btn-primary flex-1"
            >
              {activeFlow.loadedFromId ? t.saveAs : t.save}
            </button>
            {activeFlow.loadedFromId && (
              <button type="button" onClick={() => handleSave(false)} className="btn btn-xs btn-outline flex-1">
                {t.update}
              </button>
            )}
            <button type="button" onClick={() => setShowSaveForm(false)} className="btn btn-xs btn-ghost">
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="relative shrink-0 mb-3">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30" />
        <input
          type="text"
          className="input input-bordered input-xs pl-8 w-full text-xs font-semibold"
          placeholder={t.search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
        {filteredPipelines.length === 0 ? (
          <div className="text-center py-10 text-xs text-base-content/40 italic">{t.empty}</div>
        ) : (
          filteredPipelines.map((pipeline) => {
            const isLoaded = activeFlow.loadedFromId === pipeline.id;
            const nodeCount = pipeline.flow.nodes?.length ?? 0;

            return (
              <div
                key={pipeline.id}
                onClick={() => handleLoad(pipeline)}
                className={`p-3 border rounded-xl cursor-pointer transition-all duration-200 flex items-start justify-between group ${
                  isLoaded
                    ? "bg-primary/10 border-primary/45 shadow-sm"
                    : "border-base-200 hover:border-primary/40 hover:bg-base-200/50"
                }`}
              >
                <div className="flex flex-col space-y-1 min-w-0 pr-2 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-bold text-xs truncate text-base-content/85">{pipeline.name}</span>
                    {isLoaded && <span className="badge badge-primary badge-xs font-bold shrink-0">{t.loaded}</span>}
                  </div>
                  {pipeline.description && (
                    <span className="text-[10px] text-base-content/50 truncate">{pipeline.description}</span>
                  )}
                  <div className="flex items-center gap-2 text-[9px] text-base-content/40 font-mono">
                    <span>
                      {nodeCount} {t.nodes}
                    </span>
                    <span>·</span>
                    <span>{formatRelativeTime(pipeline.updatedAt, isKo)}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    type="button"
                    className="btn btn-xs btn-ghost text-primary opacity-0 group-hover:opacity-100 transition-opacity p-0 w-6 h-6"
                    title={t.load}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLoad(pipeline);
                    }}
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    className="btn btn-xs btn-ghost text-error opacity-0 group-hover:opacity-100 transition-opacity p-0 w-6 h-6"
                    onClick={(e) => handleDelete(pipeline.id, e)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
