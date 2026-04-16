# TODOS


## [2026-04-17] conflicts.json 에 startDate ISO 필드 백필

**What**: 26개 conflict 중 현재 `startYear` (숫자만) 보유. 정확한 ISO 날짜 (`"startDate": "2022-02-24"`) 필드 추가.

**Why**: seed-prices.py 가 conflict 시작일의 주가를 yfinance 에서 조회할 때 정확한 날짜 필요. 현재는 `startYear-01-01` fallback 으로 생성된 카드는 "Feb 24 2022 기준" 이 아니라 "Jan 1 2022 기준" — WSB 에서 fact-check 당하면 신뢰도 타격.

**Pros**: P&L 카드 정밀도 최대. "If you bought on [exact conflict start day]" 내러티브 유지. 과거 시세 차이로 인한 숫자 오차 제거.

**Cons**: 26개 수동 조사 ~30분. 일부 conflict는 "시작일" 모호 (ongoing since 1948 등) — 대표 날짜 합의 필요.

**Context**: Engineering review 2026-04-17 에서 식별. Phase 1 Viral Amplification Layer (P&L Card Generator) 구현 시 seed-prices.py 가 정확한 날짜를 요구. 현재 `design-20260417-010456.md` 의 스키마 확장 섹션에 반영됨. 애매한 conflict는 "첫 주요 교전일" 기준 제안.

**Depends on**: seed-prices.py 구현보다 선행 필요.
