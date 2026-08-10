# 설계: Annotation Locator · Validation · Promote

> 작성일: 2026-08-10 · 제품: Horizon Gateway  
> 관련: [cli-guide-integration.md](./cli-guide-integration.md)

## 목표

- CSS selector 단일 의존 → **testid / role+name / text / label / css** 다중 locator
- 페이지에서 검증 상태(`ok` | `weak` | `broken` | `ambiguous`) 표시
- **silent 자동 rewrite 금지**. `weak` + fallback 정확히 1개일 때만 **승격 제안** (명시 적용)

React Fiber / 전체 컴포넌트 스캔은 범위 밖.

## 데이터

`Annotation` 필드:

- `locators: AnnotationLocator[]` — index 0 = primary
- `lastValidation?: LocatorValidation` — 마지막 검증 스냅샷
- `selector` — legacy + CSS denormalized copy 유지

Legacy 로드 시 `locators`가 비어 있으면 `[{ strategy: "css", value: selector }]` (+ content면 text fallback).

## 캡처 우선순위

1. `data-testid` / `data-qa` → testid  
2. accessible role + name → role  
3. `aria-label` → label  
4. visible text (짧을 때) → text  
5. 항상 `generateRobustSelector` → css  

## Validation

| status | 조건 | 배지 |
|--------|------|------|
| ok | primary match === 1 | 정상 |
| weak | primary ≠ 1, fallback 중 정확히 하나 match === 1 | 노란 + 승격 CTA |
| broken | 전부 0 | 앵커 없음 |
| ambiguous | 그 외 모호 | 앵커 없음(유일 매칭 없을 때) |

`lastValidation` persist는 상태 변경 시 throttle 30s.

## Promote

- UI: “fallback #N을 primary로 승격” → locators 재정렬 + selector 동기화 + validation clear
- broken / ambiguous: 자동 promote 금지

## 에이전트 / CLI

```bash
horizon-gateway cli run get_annotations '{}' --query "data.[].{id,role,description,locators,lastValidation}"
horizon-gateway cli run get_annotations '{}' --query "data[lastValidation.status==broken].{id,role,locators}"
horizon-gateway cli run get_annotations '{}' --query "data[lastValidation.status==weak].{id,role,locators}"
```

규칙:

- 에이전트는 testid / role / text 우선, 긴 css path 추측 금지
- promote는 weak + 단일 fallback만, 사람/명시적 호출로 적용
