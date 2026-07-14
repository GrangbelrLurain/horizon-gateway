import type { ChangelogItem } from "./changelogTypes";

/**
 * Curated ko/en overlays keyed into parsed CHANGELOG.md by English title.
 * Prefer keeping recent releases localized here when needed.
 */
export const changelogLocaleOverlays: ChangelogItem[] = [
  {
    version: "2.5.1",
    date: "2026-07-14",
    changes: [
      {
        type: "changed",
        title: { en: "App rebranding completion", ko: "앱 리브랜딩 마침" },
        description: {
          en: "Migrated remaining files, internal variables, directories, and selectors from watchtower to horizon-gateway.",
          ko: "watchtower에서 horizon-gateway로 남아있던 파일, 내부 변수, 디렉토리 및 셀렉터를 모두 마이그레이션했습니다.",
        },
      },
      {
        type: "changed",
        title: { en: "Robust data migration", ko: "안정적인 데이터 마이그레이션" },
        description: {
          en: "Added robust app data migration logic that checks for existing user databases (like domains.json) and copies configuration files seamlessly, ensuring no settings or domain lists are lost when upgrading.",
          ko: "앱을 업그레이드할 때 도메인 목록이나 설정이 유실되지 않도록, 기존의 사용자 데이터베이스(예: domains.json)가 존재하는지 체크하여 자동으로 설정 파일을 복사 및 마이그레이션해 주는 로직을 추가했습니다.",
        },
      },
    ],
  },
  {
    version: "2.5.0",
    date: "2026-07-13",
    changes: [
      {
        type: "added",
        title: {
          en: "Supabase Authentication & Database Integration",
          ko: "Supabase 인증 및 데이터베이스 통합",
        },
        description: {
          en: "Supabase JS SDK integrated into the app. Supports Social OAuth login using GitHub.",
          ko: "Supabase JS SDK를 앱에 연동했습니다. GitHub을 통한 소셜 OAuth 로그인을 지원합니다.",
        },
      },
      {
        type: "added",
        title: { en: "Tauri v2 Deep-Link Routing", ko: "Tauri v2 딥링크 라우팅" },
        description: {
          en: "Enabled custom URL scheme handler (horizon-gateway://) with Windows Registry auto-registration on startup.",
          ko: "앱 시작 시 Windows 레지스트리에 자동 등록되는 커스텀 URL 스킴 핸들러(horizon-gateway://)를 활성화했습니다.",
        },
      },
      {
        type: "added",
        title: {
          en: "Windows Single-Instance & Arg Forwarding",
          ko: "Windows 단일 인스턴스 실행 및 인자 전달",
        },
        description: {
          en: "Added tauri-plugin-single-instance to prevent multiple window spans. Implemented manual CLI argument parsing to route OAuth callback URL params to the active main window without communication drops.",
          ko: "여러 개의 창이 동시에 뜨는 것을 방지하기 위해 tauri-plugin-single-instance를 추가했습니다. 실행 중인 메인 창으로 OAuth 콜백 URL 등의 매개변수가 누락 없이 전달되도록 CLI 인자 수동 파싱 및 라우팅 로직을 구현했습니다.",
        },
      },
      {
        type: "added",
        title: { en: "GitHub Sponsors Integration", ko: "GitHub Sponsors 연동" },
        description: {
          en: "Shifted developer donation platform to GitHub Sponsors to avoid payment service restrictions in Korea. Includes visual pulsing Rose button theme.",
          ko: "국내 결제 서비스 제한을 방지하기 위해 개발자 후원 플랫폼을 GitHub Sponsors로 전환했습니다. 테마에 맞게 깜빡이는 로즈(Rose) 후원 단추가 추가되었습니다.",
        },
      },
      {
        type: "added",
        title: {
          en: "Early Access Labs & Developer Feedback",
          ko: "얼리 액세스 연구소 및 개발자 피드백",
        },
        description: {
          en: "Added user settings page options for experimental features (locked behind Sponsor status) and direct feedback forms inserting reports into Supabase DB.",
          ko: "후원자용 실험적 기능 설정 옵션과 Supabase DB에 직접 의견을 제출하는 개발자 피드백 폼을 사용자 설정 페이지에 추가했습니다.",
        },
      },
      {
        type: "added",
        title: {
          en: "Consolidated Settings & Clean Profile Dropdowns",
          ko: "설정 및 프로필 드롭다운 정리",
        },
        description: {
          en: "Reorganized TopBar buttons. Infrastructure configuration merged inside the new click-based Settings dropdown menu. Profile settings and logout buttons unified under a click-based dropdown menu with all visual headers removed.",
          ko: "TopBar 버튼들을 재조직하여, 인프라 설정 버튼을 클릭형 설정 드롭다운 메뉴로 통합하고 프로필 관리 및 로그아웃 버튼을 하나의 깔끔한 프로필 드롭다운 메뉴로 합쳤습니다.",
        },
      },
      {
        type: "added",
        title: { en: "Minimal Design Chevron Removal", ko: "상단 바 Chevron 아이콘 제거" },
        description: {
          en: "Removed Chevron indicators on TopBar menu buttons to achieve consistent minimal icon+text layout.",
          ko: "더 간결하고 일관된 레이아웃을 위해 상단 바 메뉴 단추에서 쉐브론 아이콘을 제거했습니다.",
        },
      },
      {
        type: "added",
        title: { en: "Automatic GitHub Profile Sync", ko: "자동 GitHub 프로필 동기화" },
        description: {
          en: "Automatic local name and avatar picture synchronization using OAuth user metadata.",
          ko: "OAuth 로그인을 수행할 시 사용자 메타데이터를 기반으로 프로필 이름과 아바타 이미지를 자동으로 로컬 프로필과 동기화합니다.",
        },
      },
    ],
  },
  {
    version: "2.4.4",
    date: "2026-07-10",
    changes: [
      {
        type: "added",
        title: { en: "API Logs bulk HTML export", ko: "API 로그 다중 HTML 내보내기" },
        description: {
          en: "Select multiple API log entries and download them as a single HTML report with table of contents, per-entry copy actions, and scrollable long bodies.",
          ko: "여러 개의 API 로그 항목을 선택하여 하나의 통합 HTML 보고서(목차, 항목별 복사 액션, 본문 스크롤 지원 등 포함)로 내보낼 수 있는 기능이 추가되었습니다.",
        },
      },
      {
        type: "added",
        title: { en: "Save & reveal folder", ko: "저장 및 폴더 열기" },
        description: {
          en: 'HTML export uses the native save dialog (Tauri) and offers "Open folder" after a successful save via revealItemInDir.',
          ko: "HTML 내보내기 시 기본 저장 창(Tauri 파일 다이얼로그)을 사용하고, 성공적으로 저장 완료 시 revealItemInDir를 통해 '폴더 열기' 액션을 제안하도록 구현했습니다.",
        },
      },
      {
        type: "added",
        title: { en: "Shared download helpers", ko: "공통 다운로드 헬퍼" },
        description: {
          en: "Added saveTextDownload, revealInFolder, and offerRevealSavedDownload for reusable file export flows.",
          ko: "재사용 가능한 파일 다운로드 흐름을 제공하기 위해 saveTextDownload, revealInFolder, offerRevealSavedDownload 함수를 추가했습니다.",
        },
      },
      {
        type: "changed",
        title: { en: "HTTP body display", ko: "HTTP 본문 표시 및 포맷팅" },
        description: {
          en: "formatHttpBody restores literal \\n / \\t escapes and unwraps double-encoded JSON strings so exported/copied bodies read closer to the original payload.",
          ko: "formatHttpBody 함수가 이스케이프 문자(\\n, \\t)를 원본 그대로 처리하며, 이중 인코딩된 JSON 문자열을 보기 쉽게 풀어내어 가독성을 개선했습니다.",
        },
      },
      {
        type: "changed",
        title: { en: "HTML card escaping", ko: "HTML 카드 이스케이프" },
        description: {
          en: "API exchange HTML cards escape user content before embedding in <pre> / headers.",
          ko: "복사 또는 내보내기용 HTML 카드 구성 시 발생 가능한 보안 이슈를 막기 위해 <pre> 태그 및 헤더 내 사용자 콘텐츠를 적절히 이스케이프하도록 수정했습니다.",
        },
      },
    ],
  },
  {
    version: "2.4.3",
    date: "2026-07-10",
    changes: [
      {
        type: "added",
        title: { en: "DisabledPanel", ko: "비활성 패널 안내(DisabledPanel)" },
        description: {
          en: "Panels for features not available on the selected domain are now shown in a disabled state instead of being silently reset to overview. Users can see which features are inactive and enable them directly from the panel.",
          ko: "도메인에서 사용할 수 없는 기능 패널 진입 시, 조용히 Overview로 리다이렉트되는 대신 비활성화 상태임을 사용자에게 명시적으로 안내하는 패널을 구현했습니다.",
        },
      },
      {
        type: "added",
        title: { en: "Bulk URL Copy", ko: "도메인 주소 일괄 복사" },
        description: {
          en: 'New bulk toolbar (DomainListBulkToolbar) exposes a "Copy URLs" action that copies all selected domain URLs to the clipboard in list order.',
          ko: "새 대량 처리 툴바에 선택한 모든 도메인의 URL 주소를 순서대로 클립보드에 한번에 복사하는 'URL 복사' 액션을 도입했습니다.",
        },
      },
      {
        type: "added",
        title: { en: "Bulk range & toggle select", ko: "범위 선택 및 개별 토글 선택" },
        description: {
          en: "Shift+click for range selection and Ctrl+click for individual toggle are now supported in bulk mode with a visual hint.",
          ko: "도메인 대량 관리 모드에서 Shift+클릭을 통한 범위 선택과 Ctrl+클릭을 통한 개별 토글이 가능하도록 사용성을 향상했습니다.",
        },
      },
      {
        type: "changed",
        title: {
          en: "Panel depth preserved on domain switch",
          ko: "도메인 변경 시 패널 깊이 보존",
        },
        description: {
          en: "Switching domains no longer resets the panel stack to overview. The current depth is kept; panels for disabled features render in a disabled state.",
          ko: "도메인을 전환하더라도 이전에 보던 패널 깊이를 초기화하여 overview로 돌리는 대신 동일한 패널 상태를 유지합니다.",
        },
      },
    ],
  },
  {
    version: "2.4.2",
    date: "2026-07-09",
    changes: [
      {
        type: "fixed",
        title: { en: "Windows CLI pipe output", ko: "Windows CLI 파이프 출력 해결" },
        description: {
          en: "Dropped unconditional AttachConsole / stdio rebinding (v2.4.1 regression). Release builds now use the console subsystem so spawn, pipes, and file redirection capture stdout reliably.",
          ko: "릴리스 빌드가 콘솔 하위 시스템을 사용하게 하여, 외부 실행, 파이프 및 파일 리다이렉션 시 표준 출력을 정상적으로 캡처하도록 수정했습니다.",
        },
      },
      {
        type: "fixed",
        title: { en: "GUI console flash", ko: "GUI 실행 시 콘솔 창 깜빡임 현상 수정" },
        description: {
          en: "Hide the console window on non-cli launch via GetConsoleWindow + ShowWindow(SW_HIDE).",
          ko: "CLI가 아닌 모드로 GUI를 실행할 때 콘솔 창이 뜨지 않고 숨겨지도록 처리했습니다.",
        },
      },
    ],
  },
  {
    version: "2.4.1",
    date: "2026-07-09",
    changes: [
      {
        type: "fixed",
        title: { en: "Windows CLI console output", ko: "Windows CLI 콘솔 출력 안정화" },
        description: {
          en: "After AttachConsole, rebind stdin/stdout/stderr via CONIN$/CONOUT$ so PowerShell and cmd show JSON output synchronously without requiring | Out-String.",
          ko: "입출력 스트림을 리바인딩하여 PowerShell 및 cmd 터미널에서 Out-String을 쓰지 않고도 JSON 출력을 동기적으로 볼 수 있도록 수정했습니다.",
        },
      },
    ],
  },
  {
    version: "2.4.0",
    date: "2026-07-09",
    changes: [
      {
        type: "added",
        title: { en: "Proxy Connections Graph View", ko: "프록시 연결 그래프 뷰" },
        description: {
          en: "Added an interactive graph view (global/proxy-graph) that visualizes connections between domains and local proxy targets (host + port) using SVG Bezier curves with flowing traffic animations. Supports toggling route status, inline host/port editing, and adding/removing routes directly.",
          ko: "도메인과 로컬 프록시 대상 간의 연결 상태를 Bezier 곡선과 흐르는 트래픽 애니메이션으로 한눈에 시각화해 주는 인터랙티브 그래프 뷰를 추가했습니다.",
        },
      },
      {
        type: "added",
        title: { en: "List Virtualization", ko: "도메인 리스트 가상화(Virtualization)" },
        description: {
          en: "Integrated @tanstack/react-virtual in the domain list to support efficient rendering and eliminate UI lag when managing hundreds of domains.",
          ko: "수백 개의 도메인을 스크롤할 때 끊김 현상이 발생하지 않도록 도메인 리스트에 가상화 기술을 도입하여 성능을 크게 올렸습니다.",
        },
      },
      {
        type: "added",
        title: { en: "Smart Sorting", ko: "스마트 정렬 순서 도입" },
        description: {
          en: "Prioritizes domains with enabled proxy routes at the top, followed by disabled proxy routes, and places unconfigured domains at the bottom of the list.",
          ko: "프록시 경로가 활성화된 도메인을 최상단에 보여주고, 비활성화된 경로, 설정되지 않은 도메인 순서로 스마트하게 정렬되도록 순서를 조정했습니다.",
        },
      },
    ],
  },
];
