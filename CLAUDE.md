# Pulse of War

2026 Global Conflict Visualization — "More wars are happening right now than at any point since World War II"

## Build & Dev

- `npx serve .` (로컬 개발 서버)
- 빌드 불필요 — Vanilla JS 정적 사이트, 번들러 없음
- 배포: Vercel (`vercel --prod`)

## Project Structure

```
pulse-of-war/
├── index.html          # 메인 페이지 (Globe.GL + UI)
├── css/
│   └── style.css       # 스타일시트
├── js/
│   ├── app.js          # 앱 진입점
│   ├── globe.js        # Globe.GL 초기화 + 펄스 이펙트
│   ├── data.js         # conflicts.json 로드 + 파싱
│   ├── panel.js        # 클릭 시 상세 패널
│   ├── counter.js      # 사상자 카운트업 애니메이션
│   └── sound.js        # Web Audio API 심장박동
├── data/
│   └── conflicts.json  # 큐레이션된 전쟁 데이터 (25-30개)
├── public/
│   ├── og.png          # Open Graph 이미지 (1200x630)
│   └── favicon.ico
└── scripts/
    └── screenshot.js   # Puppeteer og:image 생성 스크립트
```

## Code Style

- ES Modules (import/export) — type="module" 사용
- Vanilla JS only — 프레임워크 없음
- 2-space 들여쓰기
- const 우선, let 필요시만
- 함수명: camelCase
- CSS: BEM 네이밍 (.panel__title, .counter--active)

## Data Schema (conflicts.json)

```json
{
  "name": "Ukraine-Russia War",
  "lat": 48.3794,
  "lng": 31.1656,
  "type": "interstate",
  "parties": ["Ukraine", "Russia"],
  "casualties": 150000,
  "refugees": 6400000,
  "startYear": 2022,
  "description": "Full-scale Russian invasion of Ukraine",
  "source": "ACLED"
}
```

## Visual Design

- 배경: #000000 (순수 검정)
- 지구본 대기: 파란/보라 글로우
- 전쟁 포인트: 빨간 펄스 (#ff2020), 2초 주기 확장+페이드
- 펄스 크기: casualties에 비례 (min 0.5, max 3.0)
- 타이포: 'Space Mono' (모노스페이스), 흰색 (#ffffff)
- 카운터 숫자: 큰 사이즈, tabular-nums

## Verification

- 모든 수정 후 브라우저에서 시각 확인
- 모바일 뷰포트 (375px) 테스트
- 콘솔 에러 0개 유지
- Lighthouse Performance 80+ 목표

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action.

Key routing rules:
- Bugs, errors, "why is this broken" → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Visual audit, design polish → invoke design-review
