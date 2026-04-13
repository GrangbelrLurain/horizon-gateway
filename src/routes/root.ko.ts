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
  inspector: "UX 정책 관리",
  live_capture: "라이브 캡처",
  schema: "스키마",
  server_logs: "서버 로그",
  mocking: "모킹",
} as const;
