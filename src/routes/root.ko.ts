import type { en } from "./root.en";

type TranslationSchema = {
  [K in keyof typeof en]: (typeof en)[K] extends (...args: infer A) => unknown ? (...args: A) => string : string;
};

export const ko: TranslationSchema = {
  home: "홈",
  domains: "도메인",
  monitor: "모니터링",
  proxy: "프록시",
  policy_group: "정책 관리",
  apis: "API",
  dashboard: "대시보드",
  regist: "등록",
  groups: "그룹",
  logs: "로그",
  settings: "설정",
  setup: "설치",
  inspector: "인스펙터 & 설정",
  policy_list: "정책 목록",
  live_capture: "라이브 캡처",
  apiSchema: "API 스키마",
  jsonSchema: "JSON 스키마",
  server_logs: "서버 로그",
  mocking: "모킹",
  mobileConnect: "모바일 연결",
  apiClient: "API 클라이언트",
  sandbox: "샌드박스",
  sandboxPipeline: "데이터 파이프라인",
  sandboxCrypto: "암복호화 & 유틸",
  sandboxPreview: "실시간 UI 프리뷰",
} as const;
