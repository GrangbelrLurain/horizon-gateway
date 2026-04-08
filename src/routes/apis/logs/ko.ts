import type { en } from "./en";

type TranslationSchema = {
  [K in keyof typeof en]: (typeof en)[K] extends (...args: infer A) => unknown ? (...args: A) => string : string;
};

export const ko: TranslationSchema = {
  title: "API 로그",
  subtitle: "프록시를 통과한 API 요청/응답 이력입니다. (5초 자동 갱신)",
  refresh: "새로고침",
  filterPath: "경로로 필터링...",
  filterHost: "호스트로 필터링...",
  allMethods: "전체",
  clearDate: (date: string) => `${date} 삭제`,
  clearAll: "전체 삭제",
  clearConfirm: (date: string) => `${date} 로그를 삭제하시겠습니까?`,
  clearAllConfirm: "모든 날짜의 로그를 삭제하시겠습니까?",
  status: "상태",
  method: "메서드",
  urlPath: "URL 경로",
  time: "시간",
  loadingLogs: "로그를 불러오는 중...",
  noLogsFound: "로그가 없습니다.",
  logDetails: "로그 상세 정보",
  requestHeaders: "요청 헤더",
  requestBody: "요청 본문",
  responseHeaders: "응답 헤더",
  responseBody: "응답 본문",
  close: "닫기",
  host: "호스트 (Origin)",
  urlPattern: "URL 패턴",
  noApiLoggingTitle: "API 로깅이 설정된 도메인이 없어요",
  noApiLoggingDesc: "최소 하나의 도메인에서 API 로깅을 활성화하면 트래픽이 여기에 기록됩니다.",
  noApiLoggingAction: "API 설정 바로가기",
};
