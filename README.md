# Watchtower

**Watchtower**는 Tauri 2 + Rust + React로 만든 데스크톱 앱입니다. 도메인 헬스체크, 로컬 프록시(MITM·모킹·라우팅), OpenAPI 뷰어, Inspector 주입, 모바일 연결(USB/터널) 등 개발·운영 인프라를 한 곳에서 다룹니다.

## Tech Stack

| 구분 | 기술 |
|------|------|
| Frontend | Vite 7, React 19, TanStack Router, Jotai, Tailwind CSS 4 |
| Backend | Rust, Tauri 2, Specta (TS 바인딩 자동 생성) |
| Proxy | Axum, Hyper, Tokio |
| Tooling | pnpm, Biome, Husky, TypeScript 5.8 |

## Getting Started

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install)
- [Node.js](https://nodejs.org/) & [pnpm](https://pnpm.io/installation)

### Development

```bash
pnpm install
pnpm tauri dev
```

`tauri dev`가 `beforeDevCommand`로 `pnpm dev`를 자동 실행합니다. `pnpm dev`는 `inspector.js`가 없으면 `build:injection`을 한 번 실행한 뒤 Vite dev 서버를 띄웁니다.

Inspector injection 스크립트를 수정할 때는 별도 터미널에서:

```bash
pnpm watch:injection
```

### Build & Release

```bash
pnpm tauri build   # beforeBuildCommand → pnpm build (injection 포함)
```

버전은 `package.json`, `tauri.conf.json`, `Cargo.toml`에 동기화됩니다.

```bash
pnpm version:patch   # 또는 version:minor, version:major
```

이후 CHANGELOG 갱신 → 커밋 → `git tag v<VERSION>` → push (릴리스 CI 트리거).

### Updater Signing

1. `pnpm tauri signer generate -w ~/.tauri/watchtower.key`
2. `tauri.conf.json` → `plugins.updater.pubkey`에 공개키 설정
3. GitHub Actions: `TAURI_SIGNING_PRIVATE_KEY` secret 등록

---

## Architecture Rules

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

Biome `noRestrictedImports`로 의존 방향을 강제합니다: `shared` → `entities`/`features`/`routes` 금지, `entities` → `features`/`routes` 금지, `features` → `routes` 금지.

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

## Development Workflow

### Local (Husky pre-commit)

- `biome check --write` (lint-staged)
- `tsc --noEmit`

### CI (`.github/workflows/ci.yml`)

| Job | 검사 |
|-----|------|
| `frontend` | `biome ci src`, `pnpm type-check` |
| `rust` | `cargo clippy -D warnings`, `cargo test` |

UI/E2E 테스트는 포함하지 않습니다.

### Useful Scripts

```bash
pnpm format          # biome check --write
pnpm type-check      # tsc --noEmit
pnpm clippy          # cargo clippy
pnpm build:injection # Inspector 스크립트만 빌드
```

---

## Release History

[CHANGELOG.md](./CHANGELOG.md)

---

## Author

규연 (Administrator)

© 2026 Watchtower Project.
