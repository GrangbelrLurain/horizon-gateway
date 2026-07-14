import type { en } from "./en";

type TranslationSchema = Record<keyof typeof en, string>;

export const ko: TranslationSchema = {
  title: "프록시 설정",
  loading: "로딩 중...",
  notRunning: "프록시가 실행 중이 아닙니다. 먼저 프록시 페이지에서 프록시를 시작하세요.",
  goToProxy: "프록시 페이지로 이동",
  certTitle: "HTTPS 인증서 설치 (Horizon Gateway Root CA)",
  certDesc:
    "모든 도메인에 대해 HTTPS 가로채기를 활성화하려면 Horizon Gateway Root CA를 한 번 설치해야 합니다. 이를 통해 브라우저가 Horizon Gateway에서 생성한 보안 연결을 신뢰할 수 있게 됩니다.",
  saveCertBtn: "Horizon Gateway Root CA 인증서 저장",
  installationStepsTitle: "설치 단계 (Windows)",
  step1: "저장된 horizon-gateway-root-ca.crt 파일을 엽니다.",
  step2: "인증서 설치...를 클릭합니다.",
  step3: "로컬 컴퓨터(관리자 권한 필요)를 선택하고 다음을 클릭합니다.",
  step4: "모든 인증서를 다음 저장소에 저장(P)을 선택하고 찾아보기...를 클릭합니다.",
  step5: "신뢰할 수 있는 루트 인증 기관을 선택하고 확인을 클릭합니다.",
  step6: "다음을 클릭한 다음 마침을 클릭합니다.",
  step7: "변경 사항을 적용하려면 브라우저를 재시작하세요.",
  macosUsers:
    "macOS 사용자: .crt 파일을 두 번 클릭 → 키체인(시스템)에 추가 → 추가된 인증서를 두 번 클릭 → 신뢰 → 항상 신뢰.",
  pacTitle: "브라우저 프록시 설정 (PAC)",
  pacDesc: "아래 URL을 시스템 또는 브라우저의 자동 프록시 구성에 입력하세요.",
  pacWindows: "Windows: 설정 → 네트워크 및 인터넷 → 프록시 → 설정 스크립트 사용",
  pacMacos: "macOS: 시스템 설정 → 네트워크 → 고급 → 프록시 → 자동 프록시 구성 URL",
  manualTitle: "수동 프록시 설정",
  manualDesc: "PAC 대신 수동 프록시를 사용하려면:",
  manualAddress: "주소:",
  manualPort: "포트:",
  certSaved: "Root CA 인증서가 성공적으로 저장되었습니다!",
  certSaveFailed: "Root CA 인증서 저장에 실패했습니다.",
};
