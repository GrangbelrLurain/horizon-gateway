import type { en } from "./en";

type TranslationSchema = {
  [K in keyof typeof en]: (typeof en)[K] extends (...args: infer A) => unknown ? (...args: A) => string : string;
};

export const ko: TranslationSchema = {
  // Header
  title: "대시보드",
  subtitle: "Horizon Gateway의 현재 상태를 한눈에 확인하세요.",
  proxyStatus: "프록시 상태",

  // Setup steps
  setupTitle: "시작하기",
  setupSubtitle: "아래 단계를 완료하면 모든 기능을 사용할 수 있어요.",
  step1Label: "첫 번째 도메인 등록",
  step1Action: "등록",
  step2Label: "프록시 시작",
  step2Action: "프록시로 이동",
  step3Label: "도메인에 API 로깅 활성화",
  step3Action: "설정",

  // Quick stats
  statDomains: "등록된 도메인",
  statApiLogging: "API 로깅",
  statTodayRequests: "오늘 API 요청",
  statProxyStatus: "프록시 상태",
  proxyRunning: "실행 중",
  proxyStopped: "중지됨",

  // Recent activity
  recentMonitorTitle: "최근 모니터링",
  recentApiTitle: "최근 API 요청",
  viewAll: "전체 보기",
  noMonitorData: "아직 모니터링 데이터가 없어요",
  noApiData: "아직 API 로그가 없어요",
  healthy: "정상",
  warning: "경고",
  error: "오류",

  // Quick actions
  quickActionsTitle: "빠른 작업",
  qa1Label: "도메인 추가",
  qa1Desc: "모니터링할 도메인 등록",
  qa2Label: "로그 보기",
  qa2Desc: "오늘의 API 트래픽 확인",
  qa3Label: "API 스키마",
  qa3Desc: "API 엔드포인트 탐색",
  qa4Label: "프록시 설정",
  qa4Desc: "프록시 및 인증서 구성",
};
