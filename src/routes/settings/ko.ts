import type { en } from "./en";

type TranslationSchema = Record<keyof typeof en, string>;

export const ko: TranslationSchema = {
  title: "설정",
  subtitle: "앱 전역 설정입니다. DNS 서버는 프록시 패스스루 및 도메인 상태 확인에 사용됩니다.",
  langTitle: "표시 언어",
  langDesc: "애플리케이션 인터페이스에 표시할 언어를 선택합니다.",
  langEn: "English",
  langKo: "한국어",
  updateTitle: "소프트웨어 업데이트",
  updateDesc: "앱 업데이트를 확인합니다. 업데이트는 GitHub 릴리즈를 통해 제공됩니다.",
  updateChecking: "확인 중...",
  updateCheckBtn: "업데이트 확인",
  updateClickToCheck: "클릭하여 업데이트를 확인하세요",
  dnsTitle: "DNS 서버",
  dnsDesc:
    "호스트명 해석 시 사용됩니다 (일치하는 라우트가 없을 때의 프록시 패스스루 및 도메인 상태 확인). 시스템 DNS를 사용하려면 비워 두세요. 예:",
  dnsLabel: "DNS 서버 (IP 또는 IP:포트)",
  dnsPlaceholder: "8.8.8.8 또는 1.1.1.1:53",
  dnsSave: "저장",
  dnsCurrent: "현재 설정:",
  backupTitle: "백업 및 복원",
  backupDesc:
    "등록된 도메인, 그룹, 프록시 라우트 등 모든 설정을 JSON 파일로 백업하거나, 기존 백업 파일에서 불러옵니다. 가져오기 시 현재 데이터를 덮어씁니다.",
  backupExport: "설정 내보내기",
  backupImport: "설정 가져오기",
  alertExportSuccess: "설정이 성공적으로 내보내기 되었습니다.",
  alertExportFail: "내보내기에 실패했습니다. 자세한 내용은 콘솔을 확인하세요.",
  alertImportInvalid: "잘못된 설정 파일 형식입니다.",
  alertImportConfirm: "가져오기를 진행하면 현재의 도메인, 그룹, 프록시 설정이 모두 덮어쓰여집니다. 계속하시겠습니까?",
  alertImportSuccess: "설정을 불러왔습니다. 도메인 및 프록시 페이지를 새로고침해야 할 수 있습니다.",
  alertImportFail: "가져오기에 실패했습니다. 자세한 내용은 콘솔을 확인하세요.",

  // Proxy Server settings
  proxyTitle: "프록시 서버",
  proxyDesc: "코어 프록시 엔진과 리스닝 포트를 관리합니다. 이 서버는 로컬 라우팅, API 로깅 및 모킹을 처리합니다.",
  proxyStatusLabel: "서버 상태",
  proxyRunning: "실행 중",
  proxyStopped: "정지됨",
  proxyPortLabel: "포워드 프록시 포트",
  proxyHttpLabel: "리버스 HTTP 포트",
  proxyHttpsLabel: "리버스 HTTPS 포트",
  proxySavePorts: "포트 설정 저장",
  proxySaving: "저장 중...",

  // Proxy Warning
  proxyRequiredTitle: "프록시 서버 필요",
  proxyRequiredDesc: "이 기능을 사용하려면 프록시 서버가 실행 중이어야 합니다. 설정 페이지에서 서버를 켜주세요.",
  goToSettings: "설정으로 이동",
};
