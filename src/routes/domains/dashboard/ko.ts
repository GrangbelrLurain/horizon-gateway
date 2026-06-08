import type { en } from "./en";

type TranslationSchema = {
  [K in keyof typeof en]: (typeof en)[K] extends (...args: infer A) => unknown ? (...args: A) => string : string;
};

export const ko: TranslationSchema = {
  title: "모니터링 도메인 목록",
  subtitle: "등록된 모든 도메인의 상태를 한 곳에서 편리하게 관리하세요.",
  btnGroups: "그룹 관리",
  btnDomain: "도메인 등록",
  searchPlaceholder: "도메인 검색...",
  filterAllGroups: "모든 그룹",
  filterNoGroup: "그룹 없음",
  exportJson: "JSON 방식 내보내기",
  clearAll: "전체 삭제",
  btnCopy: "복사",
  copyDomainGroup: "도메인 + 그룹명 복사",
  copyGroupDomains: "그룹별 도메인 목록 복사",
  copied: "복사 완료!",
  total: "전체",
  noGroup: "그룹 없음",
  confirmDelete: "해당 도메인을 목록에서 삭제하시겠습니까?",
  confirmDeleteTitle: "도메인 삭제 확인",
  confirmDeleteAction: "삭제하기",
  confirmClearAll: "🚨 주의: 등록된 모든 도메인이 삭제됩니다. 정말 진행하시겠습니까?",
  confirmClearAllTitle: "전체 삭제 확인",
  confirmClearAllAction: "지금 모두 삭제",
  alertExportSuccess: "파일이 성공적으로 저장되었습니다!",
  emptyTitle: "등록된 도메인이 없습니다",
  emptyDesc: "검색어를 확인하거나 새로운 도메인을 추가해 보세요.",

  listEmptySearchTitle: "일치하는 도메인 없음",
  listEmptySearchDesc: "검색어와 일치하는 도메인을 찾을 수 없습니다.",
  listEmptyClearSearch: "검색어 지우기",
  listEmptyNoDomainsTitle: "등록된 도메인이 없습니다",
  listEmptyNoDomainsDesc: "우측 상단의 버튼을 눌러 모니터링할 도메인을 첫 등록해보세요.",
  listEmptyAddDomainBtn: "첫 도메인 추가하기",

  editModalTitle: "도메인 설정",
  editModalDesc: "이 도메인의 주소와 소속 그룹을 변경하세요",
  editModalCancel: "취소",
  editModalUrlLabel: "접속 URL",
  editModalGroupLabel: "소속 그룹",
  editModalSave: "변경사항 저장",
  editModalSaving: "저장 중...",

  groupModalTitle: "소속 그룹 지정",
  groupModalDesc: (url) => `${url}의 소속 그룹을 선택하세요`,
  groupModalNoGroup: "선택 해제 (그룹 없음)",
  groupModalEmpty: "아직 등록된 그룹이 없습니다. 그룹 관리 페이지에서 먼저 생성해주세요.",

  // Feature Badges
  featureMonitor: "모니터링",
  featureProxy: "프록시",
  featureApiLogging: "API 로깅",
  featureOn: "ON",
  featureOff: "OFF",
  featureTogglingOn: "활성화 중...",
  featureTogglingOff: "비활성화 중...",
  featureProxyGlobalOff: "프록시가 꺼져 있습니다. 먼저 프록시를 시작하세요.",
  featureProxyGlobalOffLink: "프록시로 이동",

  // Proxy Route mini-modal
  proxyRouteModalTitle: "프록시 라우트 추가",
  proxyRouteModalDesc: (domain: string) => `${domain}의 로컬 프록시 라우트를 설정합니다`,
  proxyRouteTargetHost: "대상 호스트",
  proxyRouteTargetPort: "포트",
  proxyRouteAdd: "라우트 추가",
  proxyRouteCancel: "취소",
  proxyRouteAdding: "추가 중...",
};
