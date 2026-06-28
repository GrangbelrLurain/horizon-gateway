import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Check, Copy, Eye, EyeOff, Layers, Lock, Plus, Save, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { languageAtom } from "@/entities/app";
import { processCrypto } from "../api";
import { cryptoToolCurrentConfigAtom, savedCryptoPresetsAtom } from "../store";
import type { CryptoAction, SavedCryptoPreset } from "../types";

export interface CryptoNodeProps {
  payload?: string;
  onChangePayload?: (val: string) => void;
  action?: CryptoAction;
  onChangeAction?: (val: CryptoAction) => void;
  secretKey?: string;
  onChangeSecretKey?: (val: string) => void;
  iv?: string;
  onChangeIv?: (val: string) => void;
  isStandalone?: boolean;
}

const en = {
  title: "Crypto & Utility Sandbox",
  subtitle: "Manage and run encryption, decryption, and encoding configurations.",
  addPreset: "Add Preset",
  presetList: "Saved Presets",
  searchPresets: "Search presets...",
  noPresets: "No saved presets found.",
  presetTitle: "Preset Name",
  presetDesc: "Description",
  save: "Save Preset",
  saved: "Saved!",
  copy: "Copy Output",
  copied: "Copied!",
  deleteConfirm: "Are you sure you want to delete this preset?",
  execute: "Run",
  executing: "Running...",
  action: "Action Select",
  payload: "Input Data (Payload)",
  key: "Secret Key",
  iv: "IV",
  outputResult: "Output Result (Output)",
  modified: "Modified",
  noActivePreset: "No active preset selected. Select or create a preset.",
};

const ko = {
  title: "암복호화 및 인코딩",
  subtitle: "암호화, 복호화 및 인코딩 설정을 관리하고 빠르게 실행합니다.",
  addPreset: "새 프리셋 추가",
  presetList: "저장된 프리셋",
  searchPresets: "프리셋 검색...",
  noPresets: "저장된 프리셋이 없습니다.",
  presetTitle: "프리셋 이름",
  presetDesc: "프리셋 설명",
  save: "프리셋 저장",
  saved: "저장됨",
  copy: "복사",
  copied: "복사됨!",
  deleteConfirm: "이 프리셋을 삭제하시겠습니까?",
  execute: "실행하기",
  executing: "처리 중...",
  action: "Action 선택",
  payload: "대상 데이터 (Payload)",
  key: "비밀 키 (Secret Key)",
  iv: "초기화 벡터 (IV)",
  outputResult: "출력 결과 (Output)",
  modified: "변경됨",
  noActivePreset: "선택된 프리셋이 없습니다. 프리셋을 선택하거나 새로 추가하세요.",
};

export function CryptoNode({
  payload: propPayload,
  onChangePayload,
  action: propAction,
  onChangeAction,
  secretKey: propSecretKey,
  onChangeSecretKey,
  iv: propIv,
  onChangeIv,
  isStandalone = true,
}: CryptoNodeProps) {
  // Internal fallback states for standalone mode
  const [localPayload, setLocalPayload] = useState("");
  const [localAction, setLocalAction] = useState<CryptoAction>("base64Encode");
  const [localSecretKey, setLocalSecretKey] = useState("");
  const [localIv, setLocalIv] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showIv, setShowIv] = useState(false);

  // Bind props or local states
  const payload = propPayload !== undefined ? propPayload : localPayload;
  const setPayload = onChangePayload || setLocalPayload;
  const action = propAction !== undefined ? propAction : localAction;
  const setAction = onChangeAction || setLocalAction;
  const secretKey = propSecretKey !== undefined ? propSecretKey : localSecretKey;
  const setSecretKey = onChangeSecretKey || setLocalSecretKey;
  const iv = propIv !== undefined ? propIv : localIv;
  const setIv = onChangeIv || setLocalIv;

  const setSharedConfig = useSetAtom(cryptoToolCurrentConfigAtom);

  // Saved presets state
  const [savedPresets, setSavedPresets] = useAtom(savedCryptoPresetsAtom);
  const lang = useAtomValue(languageAtom);
  const t = lang === "ko" ? ko : en;

  const [selectedId, setSelectedId] = useState<string>(() => {
    return savedPresets.length > 0 ? savedPresets[0].id : "";
  });

  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [copied, setCopied] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Load selected preset
  useEffect(() => {
    if (isStandalone) {
      const found = savedPresets.find((p) => p.id === selectedId);
      if (found) {
        setTitle(found.name);
        setDescription(found.description);
        setLocalAction(found.action);
        setLocalPayload(found.payload);
        setLocalSecretKey(found.key);
        setLocalIv(found.iv);
        setResult("");
        setError(null);
      } else if (savedPresets.length > 0) {
        setSelectedId(savedPresets[0].id);
      } else {
        setTitle("");
        setDescription("");
        setLocalAction("base64Encode");
        setLocalPayload("");
        setLocalSecretKey("");
        setLocalIv("");
        setResult("");
        setError(null);
      }
    }
  }, [selectedId, savedPresets, isStandalone]);

  // Sync standalone inputs to shared Jotai config atom
  useEffect(() => {
    if (isStandalone) {
      setSharedConfig({
        action,
        key: secretKey,
        iv,
      });
    }
  }, [isStandalone, action, secretKey, iv, setSharedConfig]);

  const handleExecute = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await processCrypto(action, payload, secretKey, iv);
      setResult(res);
    } catch (err: any) {
      setError(err.message || "Crypto processing failed");
      setResult("");
    } finally {
      setLoading(false);
    }
  };

  // Determine if key/iv inputs are relevant based on action
  const requiresKey = ["aesEncrypt", "aesDecrypt", "hmacSha256", "jwtDecode"].includes(action);
  const requiresIv = ["aesEncrypt", "aesDecrypt"].includes(action);

  const actionsList: { value: CryptoAction; label: string }[] = [
    { value: "base64Encode", label: "Base64 Encode" },
    { value: "base64Decode", label: "Base64 Decode" },
    { value: "urlEncode", label: "URL Encode" },
    { value: "urlDecode", label: "URL Decode" },
    { value: "hexEncode", label: "Hex Encode" },
    { value: "hexDecode", label: "Hex Decode" },
    { value: "jwtDecode", label: "JWT Decode" },
    { value: "aesEncrypt", label: "AES-256-GCM Encrypt" },
    { value: "aesDecrypt", label: "AES-256-GCM Decrypt" },
    { value: "sha256", label: "SHA-256 Hash" },
    { value: "hmacSha256", label: "HMAC-SHA-256" },
  ];

  // Search filter
  const filteredPresets = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) {
      return savedPresets;
    }
    return savedPresets.filter(
      (p) => p.name.toLowerCase().includes(query) || p.description.toLowerCase().includes(query),
    );
  }, [savedPresets, search]);

  // Has unsaved changes check
  const hasUnsavedChanges = useMemo(() => {
    const found = savedPresets.find((p) => p.id === selectedId);
    if (!found) {
      return false;
    }
    return (
      found.name !== title ||
      found.description !== description ||
      found.action !== action ||
      found.payload !== payload ||
      found.key !== secretKey ||
      found.iv !== iv
    );
  }, [selectedId, savedPresets, title, description, action, payload, secretKey, iv]);

  // CRUD Actions
  const handleAddPreset = () => {
    const newId = Math.random().toString(36).substring(2, 9);
    const newPreset: SavedCryptoPreset = {
      id: newId,
      name: "New Preset",
      description: "A newly created crypto preset",
      action: "base64Encode",
      payload: "Hello, Watchtower!",
      key: "",
      iv: "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setSavedPresets([...savedPresets, newPreset]);
    setSelectedId(newId);
  };

  const handleSavePreset = () => {
    const updated = savedPresets.map((p) => {
      if (p.id === selectedId) {
        return {
          ...p,
          name: title,
          description,
          action,
          payload,
          key: secretKey,
          iv,
          updatedAt: Date.now(),
        };
      }
      return p;
    });
    setSavedPresets(updated);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(t.deleteConfirm)) {
      const remaining = savedPresets.filter((p) => p.id !== id);
      setSavedPresets(remaining);
      if (selectedId === id) {
        if (remaining.length > 0) {
          setSelectedId(remaining[0].id);
        } else {
          setSelectedId("");
        }
      }
    }
  };

  if (!isStandalone) {
    // Form rendering for visual nodes properties
    return (
      <div className="space-y-3 text-xs p-2">
        <div className="flex flex-col gap-1">
          <label className="font-semibold text-base-content/80">변환 작업 (Action)</label>
          <select
            className="select select-bordered select-xs w-full text-xs"
            value={action}
            onChange={(e) => setAction(e.target.value as CryptoAction)}
          >
            {actionsList.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-semibold text-base-content/80">입력 데이터 (Payload)</label>
          <textarea
            rows={3}
            className="textarea textarea-bordered textarea-xs font-mono w-full"
            placeholder="암복호화 혹은 인코딩할 데이터를 입력하세요..."
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
          />
        </div>

        {requiresKey && (
          <div className="flex flex-col gap-1">
            <label className="font-semibold text-base-content/80">
              비밀키 (Key) {action === "jwtDecode" && "(선택 사항 - 서명 검증용)"}
            </label>
            <div className="relative flex items-center">
              <input
                type={showSecretKey ? "text" : "password"}
                className="input input-bordered input-xs font-mono w-full pr-7"
                placeholder="Secret Key..."
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-1.5 text-base-content/40 hover:text-base-content/70 cursor-pointer"
                onClick={() => setShowSecretKey(!showSecretKey)}
              >
                {showSecretKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        )}

        {requiresIv && (
          <div className="flex flex-col gap-1">
            <label className="font-semibold text-base-content/80">초기화 벡터 (IV)</label>
            <div className="relative flex items-center">
              <input
                type={showIv ? "text" : "password"}
                className="input input-bordered input-xs font-mono w-full pr-7"
                placeholder="IV (12-byte hex or plain)..."
                value={iv}
                onChange={(e) => setIv(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-1.5 text-base-content/40 hover:text-base-content/70 cursor-pointer"
                onClick={() => setShowIv(!showIv)}
              >
                {showIv ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Standalone Playground UI
  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 w-full h-full min-h-0 items-stretch overflow-hidden">
      {/* Left Column: Presets List */}
      <div className="xl:col-span-1 card bg-base-100 border border-base-300 p-4 shadow-sm flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between border-b border-base-200 pb-3 mb-3 shrink-0">
          <span className="font-semibold flex items-center gap-1.5 text-base-content/85">
            <Layers className="w-4 h-4 text-primary" /> {t.presetList} ({savedPresets.length})
          </span>
          <button onClick={handleAddPreset} className="btn btn-xs btn-primary flex items-center gap-1">
            <Plus className="w-3 h-3" /> {t.addPreset}
          </button>
        </div>

        <div className="relative group/preset shrink-0 mb-3">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30" />
          <input
            type="text"
            className="input input-bordered input-xs pl-8 w-full text-xs font-semibold focus:outline-none"
            placeholder={t.searchPresets}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1 no-scrollbar">
          {filteredPresets.length === 0 ? (
            <div className="text-center py-10 text-xs text-base-content/40 italic">{t.noPresets}</div>
          ) : (
            filteredPresets.map((p) => (
              <div
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`p-3 border rounded-xl cursor-pointer transition-all duration-200 flex items-center justify-between group ${
                  selectedId === p.id
                    ? "bg-primary/10 border-primary/45 shadow-sm"
                    : "border-base-200 hover:border-primary/40 hover:bg-base-200/50"
                }`}
              >
                <div className="flex flex-col space-y-1 min-w-0 pr-2">
                  <span className="font-bold text-xs truncate text-base-content/85">{p.name}</span>
                  <span className="text-[10px] text-base-content/50 truncate">{p.description || "No description"}</span>
                </div>
                <button
                  className="btn btn-xs btn-ghost text-error opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => handleDeletePreset(p.id, e)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Center & Right Column Container */}
      <div className="xl:col-span-3 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch h-full overflow-hidden">
        {selectedId ? (
          <>
            {/* Center Column: Config Editor */}
            <div className="lg:col-span-7 card bg-base-100 border border-base-300 p-5 shadow-sm flex flex-col h-full overflow-hidden">
              <div className="flex justify-between items-center pb-3 border-b border-base-200 mb-4 shrink-0">
                <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
                  🔐 {title || "Preset Config"}
                </h3>
                <div className="flex items-center gap-3">
                  {hasUnsavedChanges && (
                    <span className="badge badge-warning badge-xs font-bold text-[10px] py-1.5 px-2">{t.modified}</span>
                  )}
                  <button
                    onClick={handleSavePreset}
                    className={`btn btn-xs ${justSaved ? "btn-success" : "btn-primary"} flex items-center gap-1 font-bold`}
                  >
                    <Save className="w-3.5 h-3.5" /> {justSaved ? t.saved : t.save}
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1 no-scrollbar flex flex-col min-h-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
                  <div className="flex flex-col gap-1">
                    <label className="label-text text-xs font-semibold text-base-content/70">{t.presetTitle}</label>
                    <input
                      type="text"
                      className="input input-bordered input-sm font-semibold focus:outline-none"
                      placeholder={t.presetTitle}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="label-text text-xs font-semibold text-base-content/70">{t.presetDesc}</label>
                    <input
                      type="text"
                      className="input input-bordered input-sm focus:outline-none"
                      placeholder={t.presetDesc}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1 shrink-0">
                  <label className="label-text text-xs font-semibold text-base-content/70">{t.action}</label>
                  <select
                    className="select select-bordered select-sm w-full font-semibold focus:outline-none"
                    value={action}
                    onChange={(e) => setAction(e.target.value as CryptoAction)}
                  >
                    {actionsList.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1 flex-1 min-h-0">
                  <label className="label-text text-xs font-semibold text-base-content/70">{t.payload}</label>
                  <textarea
                    className="textarea textarea-bordered font-mono text-sm w-full flex-1 min-h-[120px] focus:outline-none"
                    placeholder="Payload..."
                    value={payload}
                    onChange={(e) => setPayload(e.target.value)}
                  />
                </div>

                {requiresKey && (
                  <div className="flex flex-col gap-1 shrink-0">
                    <label className="label-text text-xs font-semibold text-base-content/70">
                      {t.key} {action === "jwtDecode" && "(선택 사항 - 서명 검증용)"}
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type={showSecretKey ? "text" : "password"}
                        className="input input-bordered font-mono text-sm w-full pr-9 focus:outline-none"
                        placeholder={t.key}
                        value={secretKey}
                        onChange={(e) => setSecretKey(e.target.value)}
                      />
                      <button
                        type="button"
                        className="absolute right-3 text-base-content/40 hover:text-base-content/70 cursor-pointer"
                        onClick={() => setShowSecretKey(!showSecretKey)}
                      >
                        {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {requiresIv && (
                  <div className="flex flex-col gap-1 shrink-0">
                    <label className="label-text text-xs font-semibold text-base-content/70">{t.iv}</label>
                    <div className="relative flex items-center">
                      <input
                        type={showIv ? "text" : "password"}
                        className="input input-bordered font-mono text-sm w-full pr-9 focus:outline-none"
                        placeholder={t.iv}
                        value={iv}
                        onChange={(e) => setIv(e.target.value)}
                      />
                      <button
                        type="button"
                        className="absolute right-3 text-base-content/40 hover:text-base-content/70 cursor-pointer"
                        onClick={() => setShowIv(!showIv)}
                      >
                        {showIv ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  className={`btn btn-primary btn-sm btn-block shrink-0 mt-2 ${loading ? "loading" : ""}`}
                  onClick={handleExecute}
                  disabled={loading || !payload}
                >
                  {loading ? t.executing : t.execute}
                </button>
              </div>
            </div>

            {/* Right Column: Output Viewer */}
            <div className="lg:col-span-5 card bg-base-100 border border-base-300 p-5 shadow-sm flex flex-col h-full overflow-hidden">
              <div className="flex items-center justify-between border-b border-base-200 pb-3 mb-4 shrink-0">
                <span className="font-semibold text-sm text-base-content/85">{t.outputResult}</span>
                {result && (
                  <button
                    className={`btn btn-xs ${copied ? "btn-success" : "btn-outline btn-ghost"} flex items-center gap-1`}
                    onClick={() => {
                      navigator.clipboard.writeText(result);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? t.copied : t.copy}
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-auto bg-base-200 border border-base-300 rounded-lg p-4 font-mono text-sm leading-relaxed no-scrollbar flex flex-col min-h-0">
                {error ? (
                  <div className="text-error font-medium">⚠️ Error: {error}</div>
                ) : result ? (
                  <pre className="whitespace-pre-wrap break-all text-success text-xs leading-relaxed">{result}</pre>
                ) : (
                  <span className="text-base-content/40 italic text-xs">
                    {lang === "ko"
                      ? "실행하기 버튼을 누르면 여기에 결과가 나타납니다."
                      : "Click Run to see the output here."}
                  </span>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="col-span-12 flex flex-col items-center justify-center bg-base-100 border border-base-300 rounded-xl p-12 text-sm text-base-content/40 italic h-full min-h-[300px]">
            <Lock className="w-12 h-12 text-base-content/20 mb-3" />
            <span>{t.noPresets}</span>
            <button onClick={handleAddPreset} className="btn btn-sm btn-primary mt-4 flex items-center gap-1">
              <Plus className="w-4 h-4" /> {t.addPreset}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
