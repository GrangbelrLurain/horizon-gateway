import { useSetAtom } from "jotai";
import { useEffect, useState } from "react";
import { processCrypto } from "../api";
import { cryptoToolCurrentConfigAtom } from "../store";
import type { CryptoAction } from "../types";

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
            <input
              type="text"
              className="input input-bordered input-xs font-mono w-full"
              placeholder="Secret Key..."
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
            />
          </div>
        )}

        {requiresIv && (
          <div className="flex flex-col gap-1">
            <label className="font-semibold text-base-content/80">초기화 벡터 (IV)</label>
            <input
              type="text"
              className="input input-bordered input-xs font-mono w-full"
              placeholder="IV (12-byte hex or plain)..."
              value={iv}
              onChange={(e) => setIv(e.target.value)}
            />
          </div>
        )}
      </div>
    );
  }

  // Standalone Playground UI
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full h-full">
      {/* Control Panel / Inputs */}
      <div className="card bg-base-100 border border-base-300 p-5 shadow-sm space-y-4">
        <h3 className="font-semibold text-lg text-primary flex items-center gap-2">🔐 암복호화 및 인코딩</h3>

        <div className="flex flex-col gap-1">
          <label className="label-text font-medium text-base-content/70">Action 선택</label>
          <select
            className="select select-bordered select-sm w-full"
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
          <label className="label-text font-medium text-base-content/70">대상 데이터 (Payload)</label>
          <textarea
            rows={6}
            className="textarea textarea-bordered font-mono text-sm w-full focus:outline-none"
            placeholder="인코딩/암호화할 데이터를 입력하세요..."
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
          />
        </div>

        {requiresKey && (
          <div className="flex flex-col gap-1">
            <label className="label-text font-medium text-base-content/70">
              비밀 키 (Secret Key) {action === "jwtDecode" && "(선택 사항 - 서명 검증용)"}
            </label>
            <input
              type="text"
              className="input input-bordered font-mono text-sm w-full"
              placeholder="비밀 키 또는 서명 검증용 공개키 PEM..."
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
            />
          </div>
        )}

        {requiresIv && (
          <div className="flex flex-col gap-1">
            <label className="label-text font-medium text-base-content/70">초기화 벡터 (IV)</label>
            <input
              type="text"
              className="input input-bordered font-mono text-sm w-full"
              placeholder="IV (24자 hex 또는 일반 문자열)..."
              value={iv}
              onChange={(e) => setIv(e.target.value)}
            />
          </div>
        )}

        <button
          className={`btn btn-primary btn-block ${loading ? "loading" : ""}`}
          onClick={handleExecute}
          disabled={loading || !payload}
        >
          {loading ? "처리 중..." : "실행하기"}
        </button>
      </div>

      {/* Output Viewer */}
      <div className="card bg-base-100 border border-base-300 p-5 shadow-sm flex flex-col h-full">
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-lg text-base-content/85">출력 결과 (Output)</span>
          {result && (
            <button className="btn btn-xs btn-outline btn-ghost" onClick={() => navigator.clipboard.writeText(result)}>
              복사
            </button>
          )}
        </div>

        <div className="flex-1 min-h-[300px] flex flex-col bg-base-200 border border-base-300 rounded-lg p-4 font-mono text-sm overflow-auto">
          {error ? (
            <div className="text-error font-medium">⚠️ 에러 발생: {error}</div>
          ) : result ? (
            <pre className="whitespace-pre-wrap break-all text-success">{result}</pre>
          ) : (
            <span className="text-base-content/40 italic">실행하기 버튼을 누르면 여기에 결과가 나타납니다.</span>
          )}
        </div>
      </div>
    </div>
  );
}
