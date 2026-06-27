/** JSON 문자열·객체를 읽기 좋은 본문 텍스트로 포맷 */
export function formatHttpBody(body: unknown): string {
  if (body === undefined || body === null) {
    return "";
  }
  if (typeof body === "object") {
    return JSON.stringify(body, null, 2);
  }
  const text = String(body);
  if (!text.trim()) {
    return "";
  }
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}
