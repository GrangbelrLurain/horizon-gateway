# Horizon Gateway

<p align="right">
  <a href="./README.en.md"><strong>English Version 🌐</strong></a>
</p>

**Horizon Gateway**는 Tauri 2 + Rust + React로 만든 데스크톱 앱입니다. 도메인 헬스체크, 로컬 프록시(MITM·모킹·라우팅), OpenAPI 뷰어, Inspector 주입, 모바일 연결(USB/터널) 등 개발·운영 인프라를 한 곳에서 다룹니다.

---

## 목차
1. [설치 방법 (Installation)](#설치-방법-installation)
2. [사용 방법 (Usage)](#사용-방법-usage)
3. [CLI 사용법 (CLI Usage)](#cli-사용법-cli-usage)
4. [기술 스택 (Tech Stack)](#기술-스택-tech-stack)
5. [개발자 가이드 (Getting Started)](#개발자-가이드-getting-started)
6. [아키텍처 규칙 (Architecture Rules)](#아키텍처-규칙-architecture-rules)
7. [개발 워크플로우 (Development Workflow)](#개발-워크플로우-development-workflow)
8. [릴리스 내역 (Release History)](#릴리스-내역-release-history)
9. [제작자 및 라이선스 (Author & License)](#제작자-및-라이선스-author--license)

---

## 설치 방법 (Installation)

### 일반 사용자 (바이너리 실행)
1. **GitHub Releases** 페이지에서 본인의 운영체제(Windows `.msi`, macOS `.dmg` 등)에 맞는 최신 버전을 다운로드합니다.
2. 다운로드한 설치 파일을 실행하여 설치를 진행합니다.
3. **보안 경고 발생 시**:
   - **Windows**: "추가 정보"를 클릭한 후 "실행"을 선택합니다.
   - **macOS**: 시스템 설정 -> 개인정보 보호 및 보안에서 차단된 앱 실행을 명시적으로 허용해야 할 수 있습니다.

### 개발자 (소스 코드 빌드)
소스를 통해 직접 빌드하고 실행하려면 아래의 [개발자 가이드](#개발자-가이드-getting-started) 섹션을 참조하십시오.

---

## 사용 방법 (Usage)

### 1. 도메인 헬스체크 (Domain Health Check)
- 앱 내 **Domains** 탭에서 상태를 모니터링할 도메인을 등록합니다.
- 주기적인 Ping 및 HTTP 상태 코드 검사를 수행하고 대시보드에서 실시간 연결 상태를 한눈에 확인할 수 있습니다.
- 등록된 도메인들을 그룹별로 묶어 체계적으로 관리할 수 있습니다.

### 2. 로컬 프록시 및 MITM (Local Proxy & MITM)
- **Proxy Settings**에서 프록시 포트(기본 9090 등)와 역방향 포트를 설정한 후 프록시 서버를 구동시킵니다.
- **HTTPS 트래픽 캡처 (MITM)**:
  - Settings 메뉴에서 **Root CA 인증서**를 생성하고 다운로드(Export Root CA)합니다.
  - 운영체제 혹은 브라우저의 인증서 보관함에 해당 Root CA를 "신뢰할 수 있는 루트 인증 기관"으로 가져오기(설치)해야 HTTPS 패킷의 복호화 및 모니터링이 가능합니다.
- **로컬 라우팅 규칙**: 특정 외부 도메인의 요청을 로컬 폴더나 다른 포트의 개발 서버로 강제 라우팅할 수 있어 편리한 프록시 테스트 환경을 제공합니다.

### 3. OpenAPI 뷰어 및 Mocking
- **APIs** 메뉴에서 OpenAPI 스펙 문서를 불러오거나 연동하여 API Schema를 구조적으로 살펴볼 수 있습니다.
- 시나리오(Scenarios)와 모킹 규칙(Mock Rules)을 정의하여, 프록시를 통해 유입되는 특정 API 요청에 대해 개발자가 정의한 모의 응답(상태 코드, 헤더, JSON 바디 등)을 반환하도록 할 수 있습니다.

### 4. Inspector 주입 (Inspector Injection)
- 모니터링 중인 특정 웹페이지 도메인에 Horizon Gateway의 디버깅 Inspector 스크립트를 동적으로 주입할 수 있습니다.
- 이를 통해 클라이언트 브라우저의 콘솔 로그, 네트워크 요청, DOM 트리 상태 등을 Horizon Gateway 앱 내에서 실시간으로 원격 검사하고 제어할 수 있습니다.

### 5. 모바일 연결 (Mobile Connection)
- **USB 디버깅 (ADB)** 연동을 통해 연결된 안드로이드 기기의 특정 포트 트래픽을 로컬 프록시 서버로 역방향 포워딩할 수 있습니다.
- **터널링 (Tailscale / Cloudflare)** 모듈을 기동하여 로컬 프록시 환경을 외부 인터넷 망이나 특정 가상 네트워크에 노출시켜 모바일 기기에서의 원격 디버깅을 한층 더 쉽게 구성합니다.

---

## CLI 사용법 (CLI Usage)

Horizon Gateway는 GUI 클라이언트 환경 외에도 강력한 명령행 인터페이스(CLI)를 갖추고 있어 터미널을 통한 설정 제어와 AI 코딩 에이전트(Cursor, Gemini, Claude 등)와의 자동화 연동을 지원합니다.

### CLI 실행 방법
- **패키징된 실행 파일 기준**:
  ```bash
  Horizon Gateway.exe cli <subcommand> [arguments]
  ```
- **개발 환경(소스 코드) 기준**:
  ```bash
  # 프로젝트 루트에서
  cargo run --manifest-path src-tauri/Cargo.toml -- cli <subcommand> [arguments]
  ```

### 주요 CLI 명령어

#### 1. `init` (에이전트 스킬 설정 초기화)
AI 어시스턴트가 프로젝트 내에서 Horizon Gateway 기능을 자동 인지하고 제어할 수 있도록 스킬 문서를 설치합니다.
- **프로젝트 로컬 설치**:
  ```bash
  Horizon Gateway cli init --project
  ```
  현재 프로젝트의 `.agents/skills/Horizon Gateway` 경로에 `SKILL.md` 및 관련 헬퍼 스크립트를 생성합니다.
- **글로벌 에이전트 설치**:
  ```bash
  Horizon Gateway cli init --target gemini
  ```
  특정 에이전트 플랫폼(예: `gemini`, `cursor`, `claude`, `copilot`, `windsurf` 등)의 글로벌 환경에 스킬을 연동합니다.
- **옵션**:
  - `--force`: 이미 파일이 존재하는 경우 덮어씁니다.
  - `--print`: 파일로 쓰지 않고 `SKILL.md` 내용만 JSON 스트림으로 콘솔에 출력합니다.

#### 2. `list` (사용 가능한 API 명령어 확인)
CLI 모드에서 호출 및 제어 가능한 모든 Horizon Gateway 내부 API 명령어 목록을 JSON 양식으로 출력합니다.
```bash
Horizon Gateway cli list
```

#### 3. `help` (명령어 상세 가이드)
특정 API 명령어의 실행 설명과 해당 명령어가 요구하는 입력 JSON Payload 규격을 조회합니다.
```bash
Horizon Gateway cli help get_domains
```

#### 4. `run` (API 명령어 실행)
Horizon Gateway의 백엔드 비즈니스 로직을 직접 실행합니다. 두 번째 인자로 JSON 페이로드를 전달하며, `--query` 옵션을 통해 출력 결과를 필터링(jq 형태의 쿼리)할 수 있습니다.
- **전체 도메인 조회**:
  ```bash
  Horizon Gateway cli run get_domains '{}'
  ```
- **특정 그룹 생성**:
  ```bash
  Horizon Gateway cli run create_group '{"name": "운영 도메인"}'
  ```
- **결과 필터링 예시**:
  ```bash
  Horizon Gateway cli run get_domains '{}' --query 'data[].domainName'
  ```

---

## 기술 스택 (Tech Stack)

| 구분 | 기술 |
|------|------|
| Frontend | Vite 7, React 19, TanStack Router, Jotai, Tailwind CSS 4 |
| Backend | Rust, Tauri 2, Specta (TS 바인딩 자동 생성) |
| Proxy | Axum, Hyper, Tokio |
| Tooling | pnpm, Biome, Husky, TypeScript 5.8 |

---

## 개발자 가이드 (Getting Started)

### 사전 요구 사항
- [Rust 설치](https://www.rust-lang.org/tools/install)
- [Node.js](https://nodejs.org/) & [pnpm 설치](https://pnpm.io/installation)

### 개발 서버 구동
```bash
pnpm install
pnpm tauri dev
```
`tauri dev` 실행 시 `beforeDevCommand`로 `pnpm dev`가 자동으로 기동됩니다. `pnpm dev`는 주입에 필요한 `inspector.js`가 없을 경우 `build:injection`을 먼저 빌드한 뒤 Vite dev 서버를 시작합니다.

디버그용 Inspector 스크립트를 수정 및 실시간 반영하려면 별도 터미널에서 아래 명령을 실행하십시오.
```bash
pnpm watch:injection
```

### 빌드 및 배포
```bash
pnpm tauri build   # beforeBuildCommand 실행 -> pnpm build (injection 포함)
```
패키징된 릴리스 버전은 `package.json`, `tauri.conf.json`, `Cargo.toml` 간 자동 동기화됩니다.

버전 업데이트는 아래 스크립트를 이용하십시오.
```bash
pnpm version:patch   # 또는 version:minor, version:major
```
이후 `CHANGELOG.md`가 갱신되고, 커밋 및 `git tag v<VERSION>` 생성 후 원격에 푸시되면 GitHub Actions 릴리스 CI가 실행됩니다.

### 업데이트 업데이터 공개키 등록
1. 로컬에서 개인 서명 키를 생성합니다:
   `pnpm tauri signer generate -w ~/.tauri/Horizon Gateway.key`
2. `tauri.conf.json` 내 `plugins.updater.pubkey` 위치에 생성된 공개키 문자열을 입력합니다.
3. GitHub Actions에 비밀 변수로 `TAURI_SIGNING_PRIVATE_KEY`를 설정합니다.

---

## 아키텍처 규칙 (Architecture Rules)

코드 배치·연동 규칙입니다.

### Directory Layout

```
src/                          # Frontend
├── routes/                   # TanStack Router (페이지 조합)
├── features/                 # 기능별 UI 조립
├── entities/                 # domain entity (store, api, hooks, ui)
├── shared/
│   ├── api/                  # bindings re-export + unwrap
│   └── ui/                   # 공통 컴포넌트
├── injection/                # Proxy Inspector 주입 스크립트 (별도 Vite 엔트리)
└── bindings.ts               # Specta 자동 생성 — 직접 수정 금지

src-tauri/src/                # Backend
├── command/                  # Tauri Commands (얇은 진입점)
├── service/                  # 비즈니스 로직
│   └── local_proxy/          # HTTP 프록시 런타임 (복합 모듈, 아래 참고)
├── model/                    # 데이터 모델
└── storage/                  # JSON 버전 관리·마이그레이션
```

### Frontend layering (FSD)

```
bindings.ts → entities/{name}/ → features/ → routes/
```

Biome `noRestrictedImports`로 의존 방향과 barrel import를 강제합니다.

| 레이어 | 금지 import |
|--------|-------------|
| `shared` | `@/entities/**`, `@/features/**`, `@/routes/**` |
| `entities` | `@/features/**`, `@/routes/**`, `@/entities/*/**` (deep) |
| `features` | `@/routes/**`, `@/entities/*/**`, `@/features/*/**` (deep) |
| `routes` | `@/entities/*/**`, `@/features/*/**` (deep) |

entity/feature는 `@/entities/{name}`, `@/features/{name}` barrel만 사용합니다. entity 내부 구현 파일 간에는 relative import(`../store`)를 사용합니다.

### Backend service unit convention (Tier 2)

복합 service는 unit 폴더마다 동일 구조를 유지합니다.

```
service/{module}/{unit}/
├── mod.rs              # wiring + re-export
├── {role}.rs           # 역할별 구현
└── tests/
    ├── mod.rs
    └── {role}.rs       # 로직 파일과 1:1
```

`local_proxy/`가 첫 reference module입니다 (`flags`, `routing`, `connect`, `handler`, `server` 등).

단순 CRUD service (`domain_service.rs` 등)는 Tier 1 flat 파일로 유지합니다.

### Routes (현재)

| 경로 | 역할 |
|------|------|
| `/` | Home / Dashboard |
| `/domains/*` | 도메인 등록·그룹·대시보드 |
| `/monitor/*` | 상태 모니터, 로그, 설정 |
| `/proxy/*` | 프록시 대시보드, 설정, 모바일, Inspector |
| `/apis/*` | API 대시보드, Schema, 로그, Mocking, 설정 |
| `/ux/*` | 정책, Live Capture |
| `/settings`, `/profile`, `/about`, `/server-logs` | 앱 설정·프로필·소개·서버 로그 |

`routeTree.gen.ts`는 자동 생성 — 직접 수정하지 않습니다.

### Backend Layering

```
command/  →  service/  →  model/ + storage/
```

| 규칙 | 내용 |
|------|------|
| Command 인자 | 단일 `payload` 객체, `#[serde(rename_all = "camelCase")]` |
| 응답 | `ApiResponse<T>` (`success`, `message`, `data`) |
| Join 테이블 | `*_link` 접미사 (`domain_group_links.json` 등) |
| 에러 | `Result` + `?`. `unwrap()` 지양 |
| 직렬화 | FE 연동 필드는 camelCase |

### Frontend ↔ Backend

| 규칙 | 내용 |
|------|------|
| 타입·호출 | `@/shared/api`에서 import (`bindings.ts` 직접 import 지양) |
| 응답 처리 | `unwrap(result)` 또는 `result.status` 분기 |
| 네이밍 | 컴포넌트 PascalCase, 함수/변수 camelCase, 상수 CONSTANT_CASE |
| Export | default export 지양 (TanStack Router 라우트 파일 제외) |
| 스타일 | Biome 설정(`biome.json`)이 단일 소스 |

### Data Storage

Tauri `app_data_dir` 아래 JSON (`schema_version` + `data` 래퍼). 앱 시작 시 `storage::migration::run_all()` 실행.

| 파일 | 용도 |
|------|------|
| `domains.json` | 도메인 마스터 |
| `groups.json` / `domain_group_links.json` | 그룹·n:n 링크 |
| `domain_monitor_links.json` / `logs/` | 모니터 설정·일별 로그 |
| `domain_local_routes.json` | 프록시 로컬 라우트 |
| `proxy_settings.json` | 프록시 포트·DNS |
| `domain_api_logging_links.json` | API 로깅 대상 |
| `scenarios.json` / `mock_rules.json` | Mocking 시나리오·규칙 |

### Error Handling

| 계층 | 방식 |
|------|------|
| Rust Command | `ApiResponse<T>`로 비즈니스·네트워크 실패 반환 |
| Proxy | 요청/응답 단위 처리 (`service/local_proxy/handler/`) |
| FE | `typedError` + `unwrap()`. invoke 예외는 거의 없음 |
| UI | ErrorBoundary 미사용 (Tauri SPA, 에러는 대부분 ApiResponse로 처리) |

### Security (의도적 설정)

프록시·MITM·외부 연동 특성상 아래 설정은 **의도적**입니다.

| 설정 | 이유 |
|------|------|
| `csp: null` | 프록시 페이지·스크립트 주입 |
| Opener `url: "*"` | setup URL, 터널, 외부 IP 연결 |
| `danger_accept_invalid_certs` | MITM 프록시 TLS 처리 |
| FS 쓰기 권한 | CA export, 설정 백업 |

---

## 개발 워크플로우 (Development Workflow)

### 로컬 환경 검사 (Husky pre-commit)
- `biome check --write` (lint-staged)
- `tsc --noEmit`

### CI 환경 검사 (`.github/workflows/ci.yml`)
| Job | 검사 |
|-----|------|
| `frontend` | `biome ci src`, `pnpm type-check` |
| `rust` | `cargo clippy -D warnings`, `cargo test` |

---

## 릴리스 내역 (Release History)

자세한 버전별 업데이트 이력은 [CHANGELOG.md](./CHANGELOG.md)를 참고하세요.

---

## 제작자 및 라이선스 (Author & License)

- **제작자**: 규연 (Administrator)
- **저작권**: Copyright (c) 2026 규연. All rights reserved.
- **라이선스 정책**:
  - **인스톨러 기본 기능**: 개인 및 상업적 목적 모두 무료로 사용 및 이용할 수 있습니다.
  - **유료 기능**: 향후 유료 기능이 추가될 경우, 해당 유료 기능 사용을 위해 별도 결제나 정기 구독이 필요할 수 있습니다.
  - **소스 코드 저작권**: 본 소프트웨어의 소스 코드 전체의 권리는 '규연'에게 있으며 무단 복제, 배포 및 수정을 금합니다. 상세 내용은 [LICENSE](./LICENSE) 파일을 참고하십시오.
