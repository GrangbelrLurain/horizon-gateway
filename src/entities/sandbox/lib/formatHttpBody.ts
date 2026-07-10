/** JSON 문자열·객체를 읽기 좋은 본문 텍스트로 포맷 (실제 줄바꿈 유지) */
export function formatHttpBody(body: unknown): string {
  if (body === undefined || body === null) {
    return "";
  }
  if (typeof body === "object") {
    return stringifyForDisplay(body);
  }

  const text = String(body);
  if (!text.trim()) {
    return "";
  }

  try {
    const parsed: unknown = JSON.parse(text);
    // 전체가 JSON 문자열로 한 번 더 감싸진 경우 → 원문 복원
    if (typeof parsed === "string") {
      try {
        return stringifyForDisplay(JSON.parse(parsed));
      } catch {
        return restoreLiteralEscapes(parsed);
      }
    }
    return stringifyForDisplay(parsed);
  } catch {
    return restoreLiteralEscapes(text);
  }
}

function stringifyForDisplay(value: unknown): string {
  return expandJsonStringEscapes(JSON.stringify(value, null, 2));
}

/**
 * Pretty JSON 안의 `\\n` / `\\t` 등을 실제 제어문자로 풀어
 * `<pre>`에서 원문에 가깝게 보이게 한다. (`\\\\` 는 유지)
 */
function expandJsonStringEscapes(prettyJson: string): string {
  return prettyJson
    .replace(/(^|[^\\])((?:\\\\)*)\\r\\n/g, "$1$2\r\n")
    .replace(/(^|[^\\])((?:\\\\)*)\\n/g, "$1$2\n")
    .replace(/(^|[^\\])((?:\\\\)*)\\r/g, "$1$2\r")
    .replace(/(^|[^\\])((?:\\\\)*)\\t/g, "$1$2\t");
}

/**
 * 저장/전송 과정에서 `\\n` 등이 문자 그대로 남은 본문을
 * 실제 제어문자로 되돌려 원문에 가깝게 보이게 한다.
 * 이미 실제 줄바꿈이 있으면 건드리지 않는다.
 */
function restoreLiteralEscapes(text: string): string {
  const hasLiteralNewlines = text.includes("\n") || text.includes("\r");
  const hasEscapedNewlines = /\\n|\\r/.test(text);
  if (hasLiteralNewlines || !hasEscapedNewlines) {
    return text;
  }

  return text
    .replace(/\\r\\n/g, "\r\n")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, "\\");
}
