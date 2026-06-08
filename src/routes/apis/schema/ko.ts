import type { en } from "./en";

type TranslationSchema = {
  [K in keyof typeof en]: (typeof en)[K] extends (...args: infer A) => unknown ? (...args: A) => string : string;
};

export const ko: TranslationSchema = {
  title: "API 스키마",
  subtitle: "OpenAPI 스키마를 탐색하고 엔드포인트를 테스트합니다.",
  targetApi: "대상 API",
  selectDomain: "-- 조사할 도메인을 선택하세요 --",
  parsingSchema: "스키마 파싱 중...",
  endpointsCount: (count: number) => `${count}개 엔드포인트`,
  noSchemaError: "다운로드된 스키마 파일이 없습니다. Dashboard에서 먼저 다운로드하세요.",
  parseFailedError: (e: string) => `스키마 파싱 실패: ${e}`,
  searchEndpoints: "엔드포인트 검색...",
  selectEndpoint: "왼쪽에서 엔드포인트를 선택하세요.",
  endpointsInfo: (eps: number, tags: number) => `${eps}개 엔드포인트, ${tags}개 태그 그룹`,
  chooseDomainToStart: "위에서 도메인을 선택하면 OpenAPI 스키마를 탐색할 수 있습니다.",
  requestHistoryToday: "요청 기록 (오늘)",
  noLogsFound: "오늘 이 엔드포인트에 대한 로그가 없습니다.",
  hasBody: "본문 있음",
  noBody: "본문 없음",
  headersCount: (count: number) => `${count}개 헤더`,
  noHeaders: "헤더 없음",
  load: "불러오기",
  history: "기록",
  send: "전송",
  parameters: "매개변수",
  body: "본문",
  customHeaders: "사용자 정의 헤더",
  error: "오류",
  empty: "(비어 있음)",
  headers: (count: number) => `헤더 (${count})`,
  historyTitle: (method: string, path: string) => `${method} ${path} 기록`,
  registeredDomains: (count: number) => `${count}개 등록된 도메인`,
  btnCopy: "복사",
  copied: "복사 완료!",
  copiedDesc: "클립보드에 복사되었습니다.",
  copyHtml: "HTML 복사",
  copyMarkdown: "Markdown 복사",
};
