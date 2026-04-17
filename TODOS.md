# TODOS


## [2026-04-17] DESIGN.md 생성 (/design-consultation)

**Priority**: P2 — 블로커 아님, 일관성용

**What**: `/design-consultation` 스킬 실행 후 `DESIGN.md` 생성. Pulse of War 의 시각 언어(aesthetic, typography, color, layout, spacing, motion)를 철학 + 토큰으로 문서화.

**Why**: 기사 페이지 / 메인 지구본 / 미래 P&L card generator / daily briefing 이 모두 같은 시각 언어 공유 필요. 현재 CSS 변수(`--pulse-red`, `--bg`, 등)는 style.css 에 있지만 의도와 철학이 문서화 안 됨. plan-design-review 가 보편 원칙(Don Norman, Dieter Rams 등)으로 판단하는 상황 — 프로젝트-specific 원칙이 없으면 future 리뷰 들이 매번 같은 질문을 반복하게 됨.

**Pros**: future /design-review, /plan-design-review, agent 협업 시 DESIGN.md 로 자동 calibrate. "왜 Space Mono 만 쓰는가", "왜 센터 정렬 금지인가" 같은 맥락을 매번 설명할 필요 없음. 기사 페이지 구현 후 다른 페이지 추가될 때 시각 drift 방지.

**Cons**: 작성 ~30분. 당장 ship 블로커 아님.

**Context**: Design review 2026-04-17 (articles page plan) 에서 식별. 지금 plan-articles-page.md 는 보편 원칙 5개 조항을 inline 으로 잠금("Emoji 금지", "centered everything 금지", etc.) — 이걸 프로젝트 레벨로 끌어올리는 작업.

**Depends on**: 안 얽매임. 기사 페이지 구현 후 실행 OK.

**Where to start**: `/design-consultation` 호출. 결과물은 프로젝트 루트 `DESIGN.md`.

## [2026-04-17] conflicts.json 에 startDate ISO 필드 백필

**What**: 26개 conflict 중 현재 `startYear` (숫자만) 보유. 정확한 ISO 날짜 (`"startDate": "2022-02-24"`) 필드 추가.

**Why**: seed-prices.py 가 conflict 시작일의 주가를 yfinance 에서 조회할 때 정확한 날짜 필요. 현재는 `startYear-01-01` fallback 으로 생성된 카드는 "Feb 24 2022 기준" 이 아니라 "Jan 1 2022 기준" — WSB 에서 fact-check 당하면 신뢰도 타격.

**Pros**: P&L 카드 정밀도 최대. "If you bought on [exact conflict start day]" 내러티브 유지. 과거 시세 차이로 인한 숫자 오차 제거.

**Cons**: 26개 수동 조사 ~30분. 일부 conflict는 "시작일" 모호 (ongoing since 1948 등) — 대표 날짜 합의 필요.

**Context**: Engineering review 2026-04-17 에서 식별. Phase 1 Viral Amplification Layer (P&L Card Generator) 구현 시 seed-prices.py 가 정확한 날짜를 요구. 현재 `design-20260417-010456.md` 의 스키마 확장 섹션에 반영됨. 애매한 conflict는 "첫 주요 교전일" 기준 제안.

**Depends on**: seed-prices.py 구현보다 선행 필요.

## [2026-04-17] 한국 자본시장법 변호사 검토 (chatbot + briefing 출시 전)

**Priority**: P1 — 출시 직전 블로커

**What**: Intel Layer (chatbot + daily briefing) 출시 전 한국 증권 변호사 30분 상담.

**Why**: Outside voice 리뷰가 식별한 구체적 법적 리스크:
- 자본시장법 Article 26 (미등록 투자자문업): 키워드 필터 통과해도 "모멘텀", "저평가" 같은 암묵적 directional 응답이 투자자문업 구성 가능
- Article 178 (시장교란): 브리핑에 팩트 오류 있고 한국 유저가 이 정보로 거래한 경우 자동화 output도 "정보 유통" 으로 법원이 인정
- "투자자문 아님" disclaimer는 insufficient — "이 서비스는 자본시장법에 따른 투자자문업 등록을 하지 않았으며 투자자문을 제공하지 않습니다" 명시적 고지 필요

**Pros**: 법적 리스크 실질 제거. 한국 유저 타겟 확장 시 safe. "Dataminr for retail traders" 포지션 유지.

**Cons**: 리업금 무료 상담 30-60분. Retainer 가입 시 $300-500/월 발생 가능.

**Context**: Engineering review 2026-04-17에서 식별. Claude critic subagent의 P1 finding. Dogfooding 단계는 무시 OK but production + WSB 바이럴 이전엔 필수.

**Depends on**: Approach A (briefing + chatbot) 구현 완료 후 출시 직전에 상담. 구현은 먼저 해도 무방.

**Where to start**: 한국 증권/핀테크 전문 변호사 찾기 (로톡, AMPLE, 로앤컴퍼니 등). 상담 시 문서: design doc + chatbot 실제 응답 샘플 5개 + briefing 샘플 2개.
