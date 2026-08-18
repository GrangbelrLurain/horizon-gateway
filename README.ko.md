<div align="center">

<img src="https://delete-horizon.com/logo-animated.svg" alt="Horizon Gateway Logo" width="220" />

# Horizon Gateway (호라이즌 게이트웨이)

### 로컬 개발 인프라를 지키는 올인원 관측소

**도메인 관측성 • 로컬 MITM 프록시 • OpenAPI 모킹 • UI/UX 가이드 인스펙터 • 모바일 터널링 • AI 에이전트 CLI**

<p align="center">
  <a href="./README.md"><strong>English Version 🌐</strong></a>
</p>

[![Release](https://img.shields.io/github/v/release/GrangbelrLurain/watchtower?style=flat-square&color=blue)](https://github.com/GrangbelrLurain/watchtower/releases)
[![License](https://img.shields.io/badge/license-Custom-green?style=flat-square)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey?style=flat-square)](#-설치-방법-installation)
[![Built with](https://img.shields.io/badge/built%20with-Rust%20%2B%20Tauri%202%20%2B%20React%2019-orange?style=flat-square)](https://tauri.app)

</div>

---

## 💡 왜 Horizon Gateway인가요? (Why Horizon Gateway?)

현대 웹/앱 개발 환경에서는 개발자가 **5가지 이상의 개별 도구**를 번갈아 띄워야 합니다:
- HTTPS 패킷 분석을 위한 Charles / Proxyman
- API 모킹 및 가상 응답을 위한 Mockoon / Postman
- 모바일 및 외부 디바이스 테스트를 위한 Ngrok / Cloudflare 터널링
- UI/UX 가이드라인 확인과 도메인 상태 체크를 위한 브라우저 개발자 도구 및 스프레드시트

**Horizon Gateway는 흩어져 있던 로컬 개발 및 네트워크 인프라를 단 하나의 초경량 네이티브 데스크톱 앱으로 통합합니다.**

- ⚡ **네이티브 고성능**: Rust + Tauri 2 기반 — Electron 앱 대비 90% 이상 가벼운 용량과 압도적으로 적은 메모리 점유율.
- 🤖 **AI 에이전트 퍼스트**: AI 코딩 어시스턴트(Cursor, Gemini CLI, Claude Code)와 완벽 연동되는 전용 콘솔 CLI (`hgc`) 내장.
- 🧩 **클릭 한 번으로 전환**: 복잡한 설정 없이 직관적인 GUI에서 프록시 라우팅, 모킹, 인스펙터를 1초 만에 제어.

---

## ✨ 핵심 기능 (Core Features)

### 🌐 1. 도메인 헬스체크 & 실시간 관측 (Domain Health Observability)
- 개발, 스테이징, 운영 도메인의 지연 시간(Ping), HTTP 상태 코드, SSL 인증서 유효성을 실시간 모니터링합니다.
- 도메인을 프로젝트/그룹별로 분류하여 대시보드에서 상태를 한눈에 파악할 수 있습니다.

### 🔀 2. 고성능 MITM 프록시 & 동적 로컬 라우팅 (Dynamic Routing)
- Hyper & Tokio 기반의 고성능 HTTPS 복호화 프록시를 지원합니다.
- **동적 로컬 라우팅**: `/etc/hosts`나 DNS 설정 변경 없이, 특정 도메인(`*.example.com`) 트래픽을 로컬 개발 포트(`localhost:3000`)나 정적 디렉토리로 즉시 우회(Routing)합니다.
- 업무 도구(Teams, Slack, Zoom, SSO 등)를 위한 맞춤형 TLS 바이패스 PAC 자동 생성.

### 🧪 3. OpenAPI 스키마 뷰어 & 시나리오 기반 모킹 (API Mocking)
- OpenAPI 규격 문서를 불러와 엔드포인트와 스키마 트리를 시각적으로 탐색합니다.
- 백엔드 개발 완료를 기다릴 필요 없이 상태 코드, 응답 딜레이, 커스텀 JSON 바디를 조작하는 모킹 규칙과 시나리오를 정의합니다.

### 🎯 4. 라이브 캡처 & UI/UX 정책 인스펙터 (UI Guide Inspector)
- 모니터링 중인 웹페이지에 경량 인스펙터 스크립트를 동적으로 주입합니다.
- DOM 요소를 시각적으로 선택하여 화면에 플로팅 가이드 핀을 꽂고, 마크다운(`[[` 링크 지원) 기반의 정책 문서를 직관적으로 연결합니다.
- 메인 앱의 DaisyUI 테마 토큰과 실시간 동기화.

### 📱 5. 모바일 디버깅 & 안전한 터널링 (Mobile Tunneling)
- **ADB 포트 포워딩**: USB로 연결된 안드로이드 기기의 웹뷰/브라우저 트래픽을 로컬 프록시로 손쉽게 역방향 포워딩합니다.
- **원클릭 터널링**: Tailscale 및 Cloudflare 터널을 통해 로컬 개발망을 외부 인터넷이나 가상망에 안전하게 노출합니다.

### 🤖 6. AI 에이전트 CLI (`hgc`)
- 모든 프록시 라우트, 모킹 규칙, 도메인 상태를 터미널 명령어로 제어합니다.
- `hgc init --project` 명령으로 Cursor, Gemini CLI, Claude Code 등 AI 도구에 전용 스킬을 자동 설치합니다.

---

## 📥 설치 방법 (Installation)

**[GitHub Releases](https://github.com/GrangbelrLurain/watchtower/releases)** 페이지에서 운영체제에 맞는 설치 파일을 다운로드하세요:

| 운영체제 | 패키지 | 비고 |
|----------|--------|------|
| **Windows** | `.msi` / `.exe` | Windows 10/11 (x64) |
| **macOS** | `.dmg` | Universal / Apple Silicon & Intel |

---

## 🚀 빠른 시작 가이드 (Quick Start)

1. **앱 실행**: Horizon Gateway를 실행하고 사이드바에서 로컬 프록시를 켭니다.
2. **Root CA 설치**: **설정(Settings) ➔ Root CA ➔ Export & Install**을 통해 HTTPS 복호화 인증서를 설치합니다.
3. **라우팅 규칙 추가**: **Proxy ➔ Routes**에서 우회할 도메인 패턴(예: `api.example.dev`)을 로컬 개발 주소(`http://localhost:8080`)로 연결합니다.
4. **API 모킹**: **APIs ➔ Mocking**에서 원하는 경로(예: `/user/profile`)에 모킹 규칙을 추가하고 즉시 프론트엔드 테스트를 시작하세요!

---

## 🤖 AI 에이전트 CLI 연동 (`hgc`)

Horizon Gateway는 별도 권한 상승 없이 빠르게 동작하는 콘솔 CLI 클라이언트 `hgc`를 제공합니다.

```bash
# 1. 현재 프로젝트에 AI 에이전트 스킬 설치
hgc init --project

# 2. 제어 가능한 전체 API 명령어 목록 확인
hgc list

# 3. 명령어 상세 가이드 및 파라미터 조회
hgc help get_domains

# 4. 백엔드 명령어 직접 실행
hgc run get_domains '{}'
```

---

## 🛠️ 기술 스택 (Tech Stack)

- **데스크톱 셸**: Tauri 2, Rust, Tokio, Hyper, Axum
- **프론트엔드 UI**: React 19, Vite 7, TanStack Router, Jotai, Tailwind CSS 4, DaisyUI 5
- **도구 및 품질**: TypeScript 5.8, Biome, pnpm

아키텍처 규칙 및 개발자 가이드는 **[CONTRIBUTING.md](./CONTRIBUTING.md)**를 참고하세요.

---

## 📄 제작자 및 라이선스 (License)

- **제작자**: 규연 (kyuyeon)
- **저작권**: Copyright (c) 2026 규연. All rights reserved.
- **릴리스 변경 이력**: 자세한 버전별 내역은 [CHANGELOG.ko.md](./CHANGELOG.ko.md)를 참고하세요.
