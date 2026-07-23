import * as Babel from "@babel/standalone";
import CryptoJS from "crypto-js";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Check, Copy, Eye, EyeOff, Layers, Lock, Plus, Save, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { languageAtom, themeAtom } from "@/entities/app";
import { createCryptoPreset, deleteCryptoPreset, processCrypto, updateCryptoPreset } from "../api";
import { cryptoToolCurrentConfigAtom, savedCryptoPresetsAtom } from "../store";
import type { CryptoAction, SavedCryptoPreset } from "../types";

if (typeof window !== "undefined") {
  (window as Window & { CryptoJS?: typeof CryptoJS }).CryptoJS = CryptoJS;
}

import { toastError } from "@/shared/ui/toast";
import { TsCodeEditor } from "@/shared/ui/ts-code-editor/TsCodeEditor";

export interface CryptoNodeProps {
  payload?: string;
  onChangePayload?: (val: string) => void;
  action?: CryptoAction;
  onChangeAction?: (val: CryptoAction) => void;
  secretKey?: string;
  onChangeSecretKey?: (val: string) => void;
  iv?: string;
  onChangeIv?: (val: string) => void;
  customCode?: string;
  onChangeCustomCode?: (val: string) => void;
  isStandalone?: boolean;
  layout?: "page" | "panel";
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
  customCode: propCustomCode,
  onChangeCustomCode,
  isStandalone = true,
  layout = "page",
}: CryptoNodeProps) {
  // Internal fallback states for standalone mode
  const [localPayload, setLocalPayload] = useState("");
  const [localAction, setLocalAction] = useState<CryptoAction>("base64Encode");
  const [localSecretKey, setLocalSecretKey] = useState("");
  const [localIv, setLocalIv] = useState("");
  const [localCustomCode, setLocalCustomCode] = useState("");
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
  const customCode = propCustomCode !== undefined ? propCustomCode : localCustomCode;
  const setCustomCode = onChangeCustomCode || setLocalCustomCode;

  const setSharedConfig = useSetAtom(cryptoToolCurrentConfigAtom);

  // Saved presets state
  const [savedPresets, setSavedPresets] = useAtom(savedCryptoPresetsAtom);
  const lang = useAtomValue(languageAtom);
  const theme = useAtomValue(themeAtom);
  const t = lang === "ko" ? ko : en;
  const isKo = lang === "ko";

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
        setLocalCustomCode(found.code || "");
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
        setLocalCustomCode("");
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
        code: customCode,
      });
    }
  }, [isStandalone, action, secretKey, iv, customCode, setSharedConfig]);

  const handleExecute = async () => {
    setLoading(true);
    setError(null);
    try {
      let res: string;
      if (action === "custom") {
        let transpiled = "";
        try {
          transpiled =
            Babel.transform(customCode, {
              presets: ["typescript"],
              plugins: ["transform-modules-commonjs"],
              filename: "crypto_custom.ts",
            }).code || "";
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : "Unknown compile error";
          throw new Error(`컴파일 에러: ${message}`);
        }

        const runFn = new Function("exports", transpiled);
        const exportsObj: { default?: (...args: string[]) => unknown } = {};
        runFn(exportsObj);

        const defaultExport = exportsObj.default;
        if (typeof defaultExport !== "function") {
          throw new Error(
            "Default export가 함수가 아닙니다. 'export default function(payload, key, iv) { ... }' 형태로 내보내주세요.",
          );
        }

        const customResult = await defaultExport(payload, secretKey, iv);
        res = typeof customResult === "string" ? customResult : JSON.stringify(customResult, null, 2);
      } else {
        res = await processCrypto(action, payload, secretKey, iv);
      }
      setResult(res);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Crypto processing failed";
      setError(message);
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
    { value: "custom", label: "커스텀 스크립트 (JS)" },
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
      found.iv !== iv ||
      (found.code || "") !== customCode
    );
  }, [selectedId, savedPresets, title, description, action, payload, secretKey, iv, customCode]);

  // CRUD Actions
  const handleAddPreset = async () => {
    try {
      const created = await createCryptoPreset({
        name: "New Preset",
        description: "A newly created crypto preset",
        action: "base64Encode",
        payload: "Hello, Horizon Gateway!",
        key: "",
        iv: "",
        code: `export default function(payload, key, iv) {
  // CryptoJS 라이브러리가 전역(window.CryptoJS)에 제공되므로 바로 사용할 수 있습니다.
  // 예: const hash = CryptoJS.SHA256(payload).toString();
  
  return payload;
}`,
      });
      const normalized: SavedCryptoPreset = {
        ...created,
        action: created.action as CryptoAction,
        createdAt: created.createdAt ?? Date.now(),
        updatedAt: created.updatedAt ?? Date.now(),
      };
      setSavedPresets([...savedPresets, normalized]);
      setSelectedId(normalized.id);
    } catch (e) {
      console.error(e);
      toastError(isKo ? "프리셋 추가에 실패했습니다." : "Failed to add preset.");
    }
  };

  const handleSavePreset = async () => {
    try {
      const updatedItem = await updateCryptoPreset(selectedId, {
        name: title,
        description,
        action,
        payload,
        key: secretKey,
        iv,
        code: customCode,
      });
      if (!updatedItem) {
        throw new Error("Not found");
      }
      const normalized: SavedCryptoPreset = {
        ...updatedItem,
        action: updatedItem.action as CryptoAction,
        createdAt: updatedItem.createdAt ?? Date.now(),
        updatedAt: updatedItem.updatedAt ?? Date.now(),
      };
      setSavedPresets(savedPresets.map((p) => (p.id === selectedId ? normalized : p)));
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch (e) {
      console.error(e);
      toastError(isKo ? "저장에 실패했습니다." : "Failed to save preset.");
    }
  };

  const handleDeletePreset = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(t.deleteConfirm)) {
      return;
    }
    try {
      await deleteCryptoPreset(id);
      const remaining = savedPresets.filter((p) => p.id !== id);
      setSavedPresets(remaining);
      if (selectedId === id) {
        if (remaining.length > 0) {
          setSelectedId(remaining[0].id);
        } else {
          setSelectedId("");
        }
      }
    } catch (err) {
      console.error(err);
      toastError(isKo ? "삭제에 실패했습니다." : "Failed to delete preset.");
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

        {action === "custom" && (
          <div className="flex flex-col gap-1 min-h-[180px]">
            <label className="font-semibold text-base-content/80">Custom JS 스크립트</label>
            <TsCodeEditor
              value={customCode}
              onChange={(val) => setCustomCode(val)}
              language="javascript"
              theme={theme}
              className="flex-1"
            />
          </div>
        )}

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

  if (layout === "panel") {
    return (
      <div className="flex flex-col gap-4 h-full overflow-y-auto pr-1 no-scrollbar text-xs pb-4">
        {/* Presets Select Row */}
        <div className="flex items-end gap-2 shrink-0 bg-base-200/60 p-3 rounded-xl border border-base-300/80">
          <div className="flex-1 min-w-0">
            <label className="text-[10px] font-black uppercase text-base-content/40 block mb-1">{t.presetList}</label>
            <select
              className="select select-bordered select-xs w-full font-bold focus:outline-none bg-base-100"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {savedPresets.length === 0 ? (
                <option value="">{t.noPresets}</option>
              ) : (
                savedPresets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleAddPreset}
              className="btn btn-square btn-xs btn-primary text-primary-content hover:scale-105 transition-transform"
              title={t.addPreset}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            {selectedId && (
              <button
                onClick={(e) => handleDeletePreset(selectedId, e)}
                className="btn btn-square btn-xs btn-outline btn-error hover:scale-105 transition-transform"
                title={t.deleteConfirm}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {selectedId ? (
          <>
            {/* Config Form Card */}
            <div className="card bg-base-100 border border-base-300 p-4 shadow-sm flex flex-col gap-3.5 shrink-0">
              <div className="flex justify-between items-center pb-2 border-b border-base-200 mb-1">
                <h3 className="font-bold text-xs text-primary flex items-center gap-1.5 truncate pr-2">
                  🔐 {title || "Preset Config"}
                </h3>
                <div className="flex items-center gap-2 shrink-0">
                  {hasUnsavedChanges && (
                    <span className="badge badge-warning badge-xs font-bold text-[9px] py-1 px-1.5 shrink-0">
                      {t.modified}
                    </span>
                  )}
                  <button
                    onClick={handleSavePreset}
                    className={`btn btn-xs ${
                      justSaved ? "btn-success" : "btn-primary"
                    } h-6 min-h-0 px-2 flex items-center gap-1 font-bold text-[10px]`}
                  >
                    <Save className="w-3 h-3" /> {justSaved ? t.saved : t.save}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-base-content/65">{t.presetTitle}</label>
                  <input
                    type="text"
                    className="input input-bordered input-xs font-semibold focus:outline-none w-full bg-base-50"
                    placeholder={t.presetTitle}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-base-content/65">{t.presetDesc}</label>
                  <input
                    type="text"
                    className="input input-bordered input-xs focus:outline-none w-full bg-base-50"
                    placeholder={t.presetDesc}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-base-content/65">{t.action}</label>
                <select
                  className="select select-bordered select-xs w-full font-semibold focus:outline-none bg-base-50"
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
                <label className="text-[10px] font-semibold text-base-content/65">{t.payload}</label>
                <textarea
                  className="textarea textarea-bordered textarea-xs font-mono text-xs w-full min-h-[70px] focus:outline-none bg-base-50"
                  placeholder="Payload..."
                  value={payload}
                  onChange={(e) => setPayload(e.target.value)}
                />
              </div>

              {action === "custom" && (
                <div className="flex flex-col gap-1 min-h-[180px] border border-base-200 rounded-lg p-2 bg-base-200/20">
                  <label className="text-[10px] font-semibold text-base-content/65">Custom JS 스크립트 작성</label>
                  <p className="text-[9px] text-base-content/40 mb-1">
                    `export default async function(payload, key, iv)` 형태로 작성합니다.
                  </p>
                  <TsCodeEditor
                    value={customCode}
                    onChange={(val) => setCustomCode(val)}
                    language="javascript"
                    theme={theme}
                    className="flex-1 rounded-md overflow-hidden border border-base-300"
                  />
                </div>
              )}

              {requiresKey && (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-base-content/65">
                    {t.key} {action === "jwtDecode" && "(선택 사항)"}
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type={showSecretKey ? "text" : "password"}
                      className="input input-bordered input-xs font-mono w-full pr-8 focus:outline-none bg-base-50"
                      placeholder={t.key}
                      value={secretKey}
                      onChange={(e) => setSecretKey(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute right-2 text-base-content/40 hover:text-base-content/70 cursor-pointer"
                      onClick={() => setShowSecretKey(!showSecretKey)}
                    >
                      {showSecretKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {requiresIv && (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-base-content/65">{t.iv}</label>
                  <div className="relative flex items-center">
                    <input
                      type={showIv ? "text" : "password"}
                      className="input input-bordered input-xs font-mono w-full pr-8 focus:outline-none bg-base-50"
                      placeholder={t.iv}
                      value={iv}
                      onChange={(e) => setIv(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute right-2 text-base-content/40 hover:text-base-content/70 cursor-pointer"
                      onClick={() => setShowIv(!showIv)}
                    >
                      {showIv ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              <button
                className={`btn btn-primary btn-xs btn-block mt-1 h-8 min-h-0 text-[11px] font-bold ${
                  loading ? "loading" : ""
                }`}
                onClick={handleExecute}
                disabled={loading || !payload}
              >
                {loading ? t.executing : t.execute}
              </button>
            </div>

            {/* Output Card */}
            <div className="card bg-base-100 border border-base-300 p-4 shadow-sm flex flex-col min-h-[160px] max-h-[300px] overflow-hidden">
              <div className="flex items-center justify-between border-b border-base-200 pb-2 mb-2 shrink-0">
                <span className="font-semibold text-xs text-base-content/85">{t.outputResult}</span>
                {result && (
                  <button
                    className={`btn btn-xs ${
                      copied ? "btn-success" : "btn-outline btn-ghost"
                    } h-5 min-h-0 px-1.5 flex items-center gap-1 text-[10px]`}
                    onClick={() => {
                      navigator.clipboard.writeText(result);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    {copied ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                    {copied ? t.copied : t.copy}
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-auto bg-base-200 border border-base-300 rounded-lg p-3 font-mono text-[11px] leading-relaxed no-scrollbar flex flex-col min-h-0">
                {error ? (
                  <div className="text-error font-medium">⚠️ Error: {error}</div>
                ) : result ? (
                  <pre className="whitespace-pre-wrap break-all text-success text-[10.5px] leading-relaxed">
                    {result}
                  </pre>
                ) : (
                  <span className="text-base-content/40 italic">
                    {lang === "ko"
                      ? "실행하기 버튼을 누르면 여기에 결과가 나타납니다."
                      : "Click Run to see the output here."}
                  </span>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center bg-base-100 border border-base-300 rounded-xl p-8 text-xs text-base-content/40 italic min-h-[200px]">
            <Lock className="w-10 h-10 text-base-content/20 mb-2" />
            <span>{t.noPresets}</span>
            <button onClick={handleAddPreset} className="btn btn-xs btn-primary mt-3 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> {t.addPreset}
            </button>
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

                <div className="flex flex-col gap-1 shrink-0">
                  <label className="label-text text-xs font-semibold text-base-content/70">{t.payload}</label>
                  <textarea
                    className="textarea textarea-bordered font-mono text-sm w-full min-h-[80px] focus:outline-none"
                    placeholder="Payload..."
                    value={payload}
                    onChange={(e) => setPayload(e.target.value)}
                  />
                </div>

                {action === "custom" && (
                  <div className="flex flex-col gap-1 flex-1 min-h-[220px]">
                    <label className="label-text text-xs font-semibold text-base-content/70">
                      Custom JS 스크립트 작성
                    </label>
                    <p className="text-[10px] text-base-content/50 mb-1">
                      `export default async function(payload, key, iv)` 형태로 작성합니다.
                    </p>
                    <TsCodeEditor
                      value={customCode}
                      onChange={(val) => setCustomCode(val)}
                      language="javascript"
                      theme={theme}
                      className="flex-1"
                    />
                  </div>
                )}

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
