# Plan: Articles Page — `/articles/war-is-a-business-model`

*Created 2026-04-17 as scaffold for /plan-design-review*

## Intent

Pulse of War 에 장문 기사("전쟁은 비즈니스 모델이다")를 공개. 현재는 `articles/war-is-a-business-model.md` (8KB short), `articles/war-is-a-business-model-full.md` (67KB long) 두 파일이 미커밋 상태. 메인 지구본 사이트의 **신뢰·권위 층**을 담당한다. 숫자 뒤의 논리를 설명하는 장문 컨텐츠.

## Core decisions (locked)

1. **IA**: 별도 경로 `/articles/[slug]`. 메인 지구본과 분리된 reading page. `/articles/war-is-a-business-model` 과 `/articles/war-is-a-business-model/full`.
2. **Primary article**: short (8KB) 를 웹 기본. long-form 은 `/full` 경로에서 접근.
3. **Data link**: 본문 중간에 인라인 데이터 카드 (예: "Lockheed Martin +24.4%") + "View on globe" 버튼으로 메인 지구본의 해당 conflict/stock 으로 딥링크.

## Scope

### In
- `/articles/war-is-a-business-model` route (static HTML)
- `/articles/war-is-a-business-model/full` route (long-form)
- 인라인 데이터 카드 컴포넌트 (stock return, casualties, commodities)
- "View on globe" 딥링크 (`/?conflict=<slug>&panel=open`)
- Reading typography (Space Mono 모노스페이스 유지? 또는 reading-optimized serif?)
- Sticky TL;DR / progress bar / table of contents (long-form only)
- Share mechanism (copy link, Share on X, OG image)
- 메인에서 /articles 로의 entry point (헤더? 하단? 바닥글?)
- Dark theme 일관성 (#000000 배경, 빨간 펄스 강조색)
- i18n: 기사 원문은 Korean. 영어 버전은 phase 2 또는 미지원 명시
- Mobile responsive (375/768/1440)

### Out
- CMS 도입 (지금은 markdown → 정적 HTML 로 충분)
- Comment/discussion 기능
- 뉴스레터 가입 폼
- Article 검색
- Related articles (글이 2개뿐)

## UI elements (enumerate before review)

- Article header: title, date, read time, subtitle
- Body: long-form Korean prose with H2/H3 sections
- Inline data card: stock ticker + % change + mini chart + "View on globe" CTA
- Pull quotes: Rothbard, Eisenhower 인용구 강조
- Footer/CTA: "See the live map →" back to main globe
- Progress indicator (scroll progress)
- Table of contents (long-form only)
- Share row: Twitter, copy link
- Source citations block at bottom

## Pass 1 — Information Architecture (decided)

**Rating: 6/10 → 9/10**

### 1A. Entry point (main globe → articles)

`index.html` 헤더 좌상단 `.header__left` 안에 추가:

```html
<a class="header__read-cta" href="/articles/war-is-a-business-model">
  READ THE STORY →
</a>
```

- Position: brand 아래, subtitle 위 (brand 와 subtitle 사이 삽입)
- Style: Space Mono 11px uppercase, letter-spacing .1em, 빨간 #ff2020, border-bottom 1px solid 빨간 40% alpha, padding-bottom 2px
- Hover: 빨간 100% alpha + glow
- Mobile: `.header__market-clock` 위에 동일하게 노출

### 1B. Article end CTA

양쪽 article 공통 — `/articles/war-is-a-business-model` 과 `/full` 둘 다.

- Full-bleed black CTA block (padding: 120px 32px)
- Bebas Neue 72px 빨간 `SEE ALL 26 CONFLICTS LIVE`
- 26개 conflict 점 grid (4 rows × 7 cols, 남은 2칸 빈자리 OK), 각 점 = 8px red dot, hover 시 tooltip (conflict name + casualties), click = `/#conflict=<slug>` (기존 hash-deeplink 패턴, panel auto-open)
- 하단: `RETURN TO THE GLOBE →` 큰 버튼, Space Mono 13px uppercase, 1px 빨간 보더 box, padding 16px 32px
- `/full` 엔 추가로 "Read the short version" secondary 링크

### 1C. Long-form navigation (`/full` 전용)

- **상단**: 2px sticky progress bar (빨간 #ff2020), scroll 에 따라 width animates. Short 페이지에도 동일하게 얇게 추가 (일관성).
- **좌측 sticky TOC** (desktop ≥1100px): width 220px, `position: sticky; top: 100px`, Space Mono 12px. 각 항목 = H2 제목. 현재 보이는 섹션은 빨간 bar + 빨간 글씨. 그 외는 dim white. 섹션 구조: 1부 인센티브의 해부학 / 2부 누가 돈을 버는가 / 3부 아무도 안 보는 전쟁들 / 4부 $2.4T 방산 시장 / 5부 사이버·크립토 / 6부 그래서 뭘 하라는 건가.
- **Mobile (<1100px)**: TOC 숨김, progress bar 만 유지. TOC 대신 상단 kicker 로 현재 섹션 제목 sticky 노출.

## Pass 2 — Interaction States (decided)

**Rating: 2/10 → 9/10**

### 2A. Data policy: FROZEN at article write time

- Inline data card 숫자는 기사 작성 시점 snapshot. 예: `+24.4%`
- 카드 하단 meta: `AS OF 2026.04.17 · VIEW LIVE →` (Space Mono 10px dim)
- 구현: 기사 markdown 에 메타 블록 직접 embed. API 호출 없음. Narrative 진실성 보존.
- 장점: build-time static, loading/error 상태 전부 N/A, 캐싱 완전 무료, 과거 사실로서 정확.

### 2B. Interaction state table

| Element | Loading | Empty | Error | Success | Partial/Stale |
|---------|---------|-------|-------|---------|--------------|
| Article body | N/A — static HTML | N/A | N/A | Rendered | N/A |
| Inline data card | N/A — frozen | 데이터 없으면 카드 omit | N/A | 기본 렌더 | `AS OF 2026.04.17` meta 상시 노출 — "partial" = 시간 경과 자체 |
| "View on globe" link | 기본 텍스트 → hover 빨간 색 | N/A | slug invalid 시 `/` 로 랜딩 + console log(토스트 없음) | `/?conflict=<slug>&panel=open` 로 이동, panel 자동 열림 | N/A |
| 26-dot end CTA grid | N/A — conflicts.json build-time | conflicts.json empty → 블록 숨김, "RETURN TO THE GLOBE" 만 노출 | N/A | 4×7 grid with hover tooltip | casualties 없는 conflict → dim 점 (50% opacity), tooltip "data pending" |
| Scroll progress bar | width: 0 | N/A | N/A | scroll 연동, 100% 에서 full red | N/A |
| Long-form TOC active | 기본: 첫 섹션 highlight | N/A | N/A | IntersectionObserver, 현재 섹션 빨간 bar + 빨간 글씨 | — |
| Share on X 버튼 | 클릭 시 커서 progress 1 frame | N/A | `window.open` 차단 → 자동 copy link + toast "Copied fallback" | 새 탭 open | N/A |
| Copy link 버튼 | 클릭 | N/A | `navigator.clipboard` 부재 → textarea select + "Press ⌘C" toast 2s | 버튼 텍스트 1.5s간 `COPIED ✓` (빨간), 복귀 | N/A |
| Main globe entry 'READ THE STORY →' | 기본 | N/A | N/A | navigate | N/A |

### 2C. Empty-state warmth principle

"No items found." 금지. 26-dot grid 가 empty 면 대신: "The globe is loading — **try again in a moment** →" 를 Space Mono 빨간 글씨로 노출, 5초 후 `/` 로 자동 redirect. 빈 화면 금지.

## Pass 3 — User Journey & Emotional Arc (decided)

**Rating: 5/10 → 9/10**

### 3A. Emotional storyboard (5s / 5min / 5y)

| Step | User does | User feels | Design supports |
|------|-----------|------------|-----------------|
| 0 | Lands on main globe | 충격 (빨간 펄스 + "X died since you opened" counter) | 기존 index.html |
| 1 | 좌상단 'READ THE STORY →' 발견 | 호기심 | 빨간 underline + Space Mono — curiosity tease |
| 2 | 기사 랜딩 (5s visceral) | 진지함 (scale), 연결감 (ambient red glow) | 128px Bebas Neue + 좌상단 red glow = globe 연장선 |
| 3 | Opening paragraph | 냉소적 각성 ("뉴스 vs 월가") | Space Mono body, 서사 친화적 mono |
| 4 | 첫 data card (LMT +24.4%) | 구체적 충격 — "진짜구나" | 1px 빨간 border, 큰 숫자, `AS OF 2026.04.17 · VIEW LIVE →` |
| 5 | Pull quote Rothbard | 지적 infrastructure 획득 | 짧은 인용 + 빨간 좌측 border (body 와 구별) |
| 6 | Body deep section | 구조 이해 심화 | TOC 로 현재 위치 자각 |
| 7 | Final data cards | 분노 · 슬픔 · 무력감 | 카드 마다 'VIEW ON GLOBE →' = 탐색 agency 제공 |
| 8 | Article end 감정 종결타 | **Gut punch** — 자신이 읽는 동안에도 죽고 있음 | 'WHILE YOU READ THIS, [N] PEOPLE DIED' (아래 3B) |
| 9 | 26-dot grid → RETURN TO THE GLOBE | 구체성 + 행동 의지 | hover tooltip 으로 각 전쟁 이름 노출 |
| 10 | 지구본 복귀 | 이제 같은 화면이 다르게 보임 | 전쟁 뉴스를 볼 때마다 이 구조가 떠오름 (5y reflective) |

### 3B. Article-end emotional close (Hero CTA)

풀 블리드 검정 블록. 위에서 아래 순서:

1. **Session death mirror** (지구본의 live counter 를 이 페이지에서도 재현):
   - Kicker: `WHILE YOU READ THIS,` — Space Mono 14px dim, letter-spacing .15em, 중앙 정렬
   - 거대 숫자: `[live count] PEOPLE DIED` — Bebas Neue 96px 빨간 #ff2020, 중앙, tabular-nums
   - 계산: `sessionSeconds * (748 / 86400)` — 기존 `js/counter.js` 에서 상수 import, `/articles` 에서도 동일 session 시작 시각 기준
2. **Grid divider**: 1px 흰색 12% 선
3. **26-dot conflict grid**: 4×7 (남은 2칸 empty), 각 점 10px 빨간 + 약간 pulse animation delay 랜덤, hover tooltip (conflict name + `X deaths`, Space Mono 11px)
4. **Primary CTA**: `RETURN TO THE GLOBE →` — 1px 빨간 border box, Space Mono 13px uppercase, padding 20px 40px, hover = 빨간 fill + 검정 글씨 inversion
5. **(Long-form only) Secondary**: `← Read the short version` Space Mono 11px dim

### 3C. Brand continuity token

두 페이지(`/` 와 `/articles/*`) 공통 시각 DNA:
- 좌상단 ambient red glow (600px radial, 15-18% opacity) — 두 페이지 모두에서 "live pulse" 감각 유지
- Brand bar pulse dot (6px, `animation: pulse 2s`) — 동일 animation keyframes 재사용
- `--pulse-red: #ff2020`, `--bg: #000`, `--border: rgba(255,255,255,.12)` — CSS 변수 동일

## Pass 4 — AI Slop Risk (decided)

**Rating: 7/10 → 9/10**

### 4A. 명시 금지 (슬롭 가드)

- **Emoji 금지**: 기사 내부에 `💀`, `📈`, `🚀` 등 이모지 사용 금지. 대신 ASCII/유니코드 typographic 글리프만 (`▲`, `▼`, `→`, `●`, `·`).
- **Icon library 금지**: Material Icons / Heroicons / Lucide 등 금지. 모든 시각 요소는 타이포그래피 + 1px 선 + 빨간색 점으로 표현.
- **Stock imagery 금지**: 전쟁 사진, 주식 그래프 스톡 이미지 등 절대 금지. 기사는 텍스트 + 데이터 카드만.
- **3-column rhythm 금지**: "이란전 + 우크라이나전 + 수단전" 을 3-카드 grid 로 나열 유혹 경계. 본문은 항상 single-column 흐름.
- **Section 길이 균질화 금지**: 섹션 높이 통일 금지 — content 가 필요한 만큼 쓰고 끝.
- **데코 blob/gradient 금지**: 좌상단 ambient red glow 단 하나만 예외 (의미: 살아있는 펄스 = globe 연장).
- **Placeholder copy 금지**: "Welcome", "Unlock the power", "Your all-in-one" 등 템플릿 문구 금지.

### 4B. 브랜드 일관성 cross-check

기사 페이지가 메인 globe 와 공유해야 할 토큰 (이미 CSS 변수로 잠금):

```css
:root {
  --pulse-red: #ff2020;
  --bg: #000000;
  --text: #ffffff;
  --text-dim: rgba(255,255,255,.55);
  --text-body: rgba(255,255,255,.9);
  --border: rgba(255,255,255,.12);
  --border-strong: rgba(255,255,255,.22);
}
```

폰트: `Bebas Neue` (헤드라인 전용) + `Space Mono` 400/700 (본문/메타). 그 외 font family 금지.

### 4C. 슬롭 자체 검증 (구현 후 `/design-review` 에서 재확인)

AI slop 블랙리스트 10 패턴 중 한 건이라도 실제 구현에서 슬립하면 `/design-review` 에서 빨간 깃발. 특히 주의: centered everything 은 article-end CTA (1개 블록) 에만 허용.

## Pass 5 — Design System Alignment (decided)

**Rating: 5/10 → 9/10**

### 5A. CSS 파일 구조

- 신규: `css/article.css` (article 페이지 전용)
- 기존 수정: `css/style.css` 에 `.header__read-cta` 만 추가 (메인 globe 엔트리 버튼)
- 기존 변경 없음: `card.css`, `ticker.css`, `js/app.js` (main globe 영향 최소화)

### 5B. 재사용 vs 신규 컴포넌트

| 기사 페이지 요소 | 소스 | 재사용 방식 |
|------------------|------|-------------|
| CSS variables (`--pulse-red`, `--bg`, `--text-*`, `--border*`) | `css/style.css :root` | 동일 블록 `article.css` 에 복제 (reading page 단독 로드 가능하게) |
| Pulse dot animation (`@keyframes pulse`) | `css/style.css` `.brand-bar__dot` 패턴 | 키프레임 복제, 동일 timing (2s ease-out infinite) |
| Space Mono + Bebas Neue font imports | 기존 Google Fonts link | 기사 페이지에서도 동일 링크 사용 (노드 재활용, 캐시 공유) |
| Button 패턴 (1px border, uppercase, letter-spacing, hover invert) | `.share__btn`, `.sidebar-toggle` | 동일 시각 언어 — `.article-cta`, `.article-return-btn` 신규 class but 동일 토큰 |
| Live death counter 로직 | `js/counter.js` → `js/app.js` (session deaths) | `js/article.js` 에서 공용 상수 import (daily rate 748, 초당 비례 계산) |
| `body.has-ticker-bar` 오프셋 cascade 패턴 | 기존 레이아웃 | 기사 페이지는 fullscreen scroll 이므로 ticker-bar 없음 — body class 리셋 |

### 5C. 신규 컴포넌트 (기존 패턴 없음)

- `.article-header` — sticky 40px brand bar (기존 `.header` 와 다름: 메인 globe 는 fullscreen fixed, 기사는 scroll 페이지)
- `.article__title` — Bebas Neue 128px → 72px (mobile)
- `.article__data-card` — 1px 빨간 border box, 숫자 중심
- `.article__pullquote` — 2px 빨간 좌측 border + serif italic… **아니다**: Variant A 결정은 Space Mono 유지. Pull quote 도 Space Mono 22px italic + 빨간 좌측 border. (Italic variant Space Mono 사용 가능 확인 필요 — 불가 시 일반 weight 유지)
- `.article__progress` — 2px sticky top progress bar
- `.article__toc` — sticky 220px 좌측 사이드바 (desktop ≥1100px only)
- `.article__end-cta` — full-bleed emotional close block

### 5D. Page-level 레이아웃 패러다임 차이

메인 globe = `overflow: hidden; position: fixed` 레이어링. 기사 페이지 = 일반 scrollable document flow. 기사 페이지에선 `body.has-ticker-bar` 와 `#map-container` 을 로드하지 않음. `js/app.js` 도 로드하지 않음.

## Pass 6 — Responsive & Accessibility (decided)

**Rating: 2/10 → 9/10**

### 6A. Breakpoints + 레이아웃

| Viewport | Title | Body font | TOC | Padding | Grid | End CTA |
|----------|-------|-----------|-----|---------|------|---------|
| ≥1440 | 128px | 16px | sticky left 220px | 80px top / 32px side | 26-dot 4×7 | 72px Bebas |
| 1100-1439 | 112px | 16px | sticky left 200px | 72px top / 32px side | 26-dot 4×7 | 64px Bebas |
| 768-1099 | 88px | 16px | **hidden**, 상단 section kicker sticky | 64px top / 24px side | 26-dot 4×7 | 56px Bebas |
| 375-767 | 64px | 15px | hidden, progress bar only | 48px top / 20px side | 26-dot 13×2 (reflow) | 44px Bebas |

Article max-width 본문: 720px (desktop) → viewport - 40px (mobile). Long-form 은 TOC 빼고 본문 max 640px.

Korean word-break: `word-break: keep-all; overflow-wrap: break-word;` 로 어절 단위 wrap. 긴 문장이 중간에 잘리는 현상 방지.

### 6B. Contrast + 타이포 스케일 (WCAG AA 통과)

| Token | 현재 opacity | 새 opacity (AA 통과) | 용도 | 비고 |
|-------|--------------|----------------------|------|------|
| `--text` | 1.0 (#fff) | 1.0 | Title, 본문 강조 | ✅ 21:1 |
| `--text-body` | 0.9 | 0.9 | 본문 단락 (16px Space Mono) | ✅ 18.9:1 |
| `--text-meta` (신규) | — | 0.75 | Meta row, TOC inactive, data card label (11px) | ✅ ~12:1 |
| `--text-dim` (레거시) | 0.55 | **0.7 로 상향** | Large-only 보조 (14px+) | ✅ ~10:1 |
| `--pulse-red` | #ff2020 on #000 | 동일 | Accent, CTA | ✅ 5.3:1 (AA large pass, 일반 text 에서는 AAA-border) |

11px uppercase 메타 텍스트는 letter-spacing .12em + font-weight 400 이라도 `--text-meta` (.75) 사용 강제.

### 6C. Keyboard navigation

- **Skip link**: 최상단 `<a class="skip-link" href="#article-content">Skip to article</a>` — 포커스 시 화면에 노출, 클릭 시 본문 단락으로 focus 이동
- **Tab order**: brand bar nav → skip link → meta `DEEP DIVE →` → 본문 링크 (인라인 링크 있으면) → data card `VIEW ON GLOBE →` → pull quote (focusable 불필요) → 26-dot grid (arrow keys 로 탐색 가능) → RETURN TO GLOBE
- **Focus ring**: `outline: 2px solid #ff2020; outline-offset: 2px;` 모든 focusable 요소. `outline: none` 금지.
- **ESC** (long-form): ESC 키로 TOC 사이드바 시각 리셋 (현재 섹션으로 스크롤), 2번째 ESC 로 페이지 top 으로
- **Spacebar/Arrow**: 기본 browser scroll behavior 유지, 방해 안 함

### 6D. Screen reader contract

```html
<header class="article-header" role="banner">...</header>
<nav aria-label="Article sections" class="article__toc">...</nav>
<article id="article-content" role="article" aria-labelledby="article-title">
  <h1 id="article-title">전쟁은 비즈니스 모델이다</h1>
  <div class="article__meta" aria-label="Article meta">...</div>
  <div role="progressbar" aria-label="Reading progress" aria-valuenow="42" class="article__progress"></div>
  ...
</article>
```

- Pulse dot: `aria-hidden="true"` (decorative, not announced)
- Live death count in end CTA: `aria-live="polite"` + `aria-atomic="true"` — 카운트 업데이트 시 screen reader 가 자연스럽게 읽음 (초마다 폭격 방지 위해 5초 throttle)
- 26-dot grid: 각 점 `<button aria-label="Conflict: Ukraine-Russia — 150000 casualties — View on globe">` (data-driven)
- Images: 없음 (alt 필요 없음)
- Inline data card: `<figure><figcaption>` 로 wrap, figcaption 은 screen reader 만 (`sr-only`)

### 6E. Touch targets (mobile)

- 최소 44×44px 정사각형. 11px 텍스트 버튼은 padding 으로 확장.
- `VIEW ON GLOBE →` data card CTA: padding 14px 20px 보장 → 하단 클릭 영역 44px 이상
- 26-dot grid 모바일: dot 자체는 10px 이지만 tap target 은 `::before` pseudo-element 로 24px 정사각 확장 (시각 변화 없음)

### 6F. Bottom bar 정책

메인 globe `.bottom-bar` (sound/share/autofocus) 는 기사 페이지에서 **렌더링 안 함**. Sound toggle/autofocus 는 reading 컨텍스트에 부적합. Share 는 article-end block 에 inline 으로 별도 배치.

## Pass 7 — Unresolved Decisions (resolved)

### 7A. i18n policy — Korean article, English visitors

상단 `article-header` 바로 아래 dismissible notice bar:

```html
<div class="article-lang-notice" role="note" data-i18n="articleLangNotice">
  This article is in Korean.
  <a href="https://www.deepl.com/translator#auto/en/..." target="_blank" rel="noopener">
    Machine translate →
  </a>
  <button class="article-lang-notice__close" aria-label="Dismiss">×</button>
</div>
```

- Style: 32px tall, 검정 배경, 하단 1px 빨간 보더, Space Mono 11px dim
- DeepL 딥링크에 `encodeURIComponent(window.location.href)` 삽입
- dismiss 시 `localStorage.setItem('pow_lang_notice_dismissed', '1')`
- lang=en 브라우저만 표시 (`navigator.language.startsWith('en')`)
- Korean lang browser 에는 렌더링 안 함

### 7B. Articles index — 당분간 없음

- `/articles/` → 301 redirect to `/articles/war-is-a-business-model`
- 3번째 기사 추가 시 별도 ticket 으로 index 페이지 제작
- 지금 만들면 future-forecast 에너지 낭비

### 7C. "Read the deep dive" 링크 배치

Short article (`/articles/war-is-a-business-model`) 에만 해당:

1. Meta row 에 `DEEP DIVE →` (이미 있음, variant A)
2. Article body 중간 — 4번째 문단 이후 interstitial: `1부에 관한 더 깊은 분석은 deep dive (20분 읽기)로 계속 →` — Space Mono 12px dim + 빨간 underline link, 구분선 없음
3. End CTA 블록 위에 prominent: `WANT THE FULL STORY?` kicker + `READ THE DEEP DIVE (20 MIN) →` 버튼, short 종료 순간의 자연스러운 continuation

Long-form (`/full`) 에는 상단 meta 에 `← Back to short` secondary 링크 (TOC 아래).

### 7D. SEO meta (기사 페이지 `<head>`)

```html
<title>전쟁은 비즈니스 모델이다 — Pulse of War</title>
<meta name="description" content="전쟁이 터지면 뉴스는 사상자를 센다. 월가는 수익률을 센다. 같은 사건, 다른 눈.">
<link rel="canonical" href="https://pulseofwar.com/articles/war-is-a-business-model">
<meta property="og:title" content="전쟁은 비즈니스 모델이다">
<meta property="og:description" content="2026년 전 세계 26개 전쟁, 2차대전 이후 최다. 글로벌 방산 시총 +$2.4T. 인센티브 구조 해부.">
<meta property="og:image" content="/og-article-business-model.png"> <!-- 1200×630, Bebas Neue 헤드라인 + 좌상단 red glow 캡처 -->
<meta property="og:type" content="article">
<meta property="article:published_time" content="2026-04-17">
<meta property="article:section" content="Structure">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "전쟁은 비즈니스 모델이다",
  "datePublished": "2026-04-17",
  "author": { "@type": "Organization", "name": "Pulse of War Editorial" },
  "publisher": { "@type": "Organization", "name": "Pulse of War" },
  "inLanguage": "ko"
}
</script>
```

og 이미지는 variant A 의 hero 캡처 — `scripts/generate-og.py` (Python, 기존) 확장하여 variant-A-mono.html 렌더 기반 1200×630 자동 생성. `scripts/screenshot.js` 없음.

### 7E. Back-to-top 버튼 (long-form only)

Scroll 50% 이상 시 fadeIn. `position: fixed; bottom: 32px; right: 32px; z-index: 5`. 32×32px 빨간 1px border 정사각, `↑` 글리프, 클릭 시 smooth scroll to top. 44×44 touch target via `::before`. Mobile 은 `bottom: 24px; right: 16px`.

### 7F. Performance budget

| Metric | Target | Note |
|--------|--------|------|
| HTML size (short article) | ≤ 40KB | Markdown → static HTML, font CSS 포함 |
| HTML size (long-form) | ≤ 180KB | 67KB markdown + HTML overhead |
| Font loading | FOUT OK | `font-display: swap` — Space Mono + Bebas Neue 이미 preconnect |
| FCP | ≤ 1.5s on 3G | 정적 HTML, critical CSS inline |
| LCP | ≤ 2.5s | 첫 viewport 의 heading |
| Total JS | ≤ 8KB | progress bar, TOC IntersectionObserver, share button, lang notice dismiss — vanilla, no deps |

### 7G. 나머지 deferred (TODOS 후보)

- Article 내부 inline link 스타일 (기사 본문에 참조 링크가 생긴다면)
- 다크 / 라이트 reading mode toggle — 현재 다크만
- 프린트 CSS — future
- Article comment/discussion — 미제공 (out of scope)
- Newsletter signup — 미제공 (out of scope)

## NOT in scope

| 제외된 것 | 이유 |
|-----------|------|
| CMS 도입 (Contentful, Sanity 등) | Markdown → static HTML 로 2-3개 기사는 충분. 10+ 기사 시 재고 |
| 댓글/디스커션 시스템 | 바이럴 amplification 보다 reading 집중. 노이즈 제거 |
| 뉴스레터 가입 폼 | 별도 growth loop — 지금 구현 시 reading UX 방해 |
| Article 검색 | 2개 기사에 과도 |
| Related articles / 추천 | 글 2개라 불필요 |
| 영어 번역본 네이티브 제공 | 번역 비용 + 원본 진실성. DeepL 딥링크로 대체 |
| Dark/Light reading mode toggle | 브랜드 일관성 (Pulse of War = 다크만) |
| Print CSS / reader mode | future, low priority |
| Articles index page | 기사 2개뿐이라 future |

## What already exists (reuse 대상)

- `css/style.css :root` CSS 변수 블록 (`--pulse-red`, `--bg`, `--text-*`, `--border*`) — article.css 에 import/복제
- `@keyframes pulse` (pulse dot animation) — 동일 timing 재사용
- Google Fonts preconnect + Bebas Neue + Space Mono — 이미 로드됨
- `js/counter.js` daily death rate 상수 (748/day) — article-end live mirror 에서 공용
- `.share__btn` / `.sidebar-toggle` 버튼 시각 언어 (1px border, uppercase, letter-spacing .1em, hover invert) — 동일 DNA
- `scripts/screenshot.js` Puppeteer — og:image 생성 시 확장
- `data/conflicts.json` — 26-dot grid 렌더링 소스

## Approved Mockups

| Screen | Mockup Path | Direction | Constraints |
|--------|-------------|-----------|-------------|
| Articles page hero (first viewport) | `~/.gstack/projects/pulse-of-war/designs/articles-page-20260417/variant-A-mono.html` | **Variant A — Mono Terminal**. Space Mono body + Bebas Neue 128px 헤드라인. 빨간 1px 인라인 data card. 좌상단 ambient red glow. | Serif 전환 금지, 빨간 #ff2020 유일 accent, rounded corners 금지, illustration 금지 |

비교 보드 HTTP server: `http://127.0.0.1:8765/index.html` (local only).

## Completion Summary

```
+====================================================================+
|         DESIGN PLAN REVIEW — COMPLETION SUMMARY                    |
+====================================================================+
| System Audit         | DESIGN.md 부재 (→ TODO), UI 스코프 명확       |
| Step 0               | 초기 4/10, 포커스 4영역 모두                   |
| Step 0.5 (mockups)   | 3 variant 생성 (HTML), A (Mono Terminal) 승인  |
| Pass 1  (Info Arch)  | 6/10 → 9/10 (entry + end CTA + TOC 잠금)       |
| Pass 2  (States)     | 2/10 → 9/10 (frozen data + state table)        |
| Pass 3  (Journey)    | 5/10 → 9/10 (emotional arc + 감정 종결타)     |
| Pass 4  (AI Slop)    | 7/10 → 9/10 (7가지 금지 명시 잠금)              |
| Pass 5  (Design Sys) | 5/10 → 9/10 (재사용/신규 컴포넌트 매핑)         |
| Pass 6  (Responsive) | 2/10 → 9/10 (breakpoints + a11y + contrast)    |
| Pass 7  (Decisions)  | 2 surfaced, 5 default, 1 TODO                  |
+--------------------------------------------------------------------+
| NOT in scope         | written (9 items)                              |
| What already exists  | written (7 reusable assets)                    |
| TODOS.md updates     | 1 item added (DESIGN.md via /design-consultation) |
| Approved Mockups     | 1 generated, 1 approved (Variant A)            |
| Decisions made       | 12 added to plan                               |
| Decisions deferred   | 5 (reading mode, print CSS, inline link style, comments, newsletter) |
| Overall design score | 4/10 → 9/10                                    |
+====================================================================+
```

**Plan 은 design-complete.** 다음 단계: `/plan-eng-review` (필수 gate) 로 구현 계획 lock-in. 구현 후 `/design-review` 로 실측 시각 QA.

## Unresolved Decisions

해결 안 된 것 없음. 모든 AskUserQuestion 응답 받음. Deferred items 5개는 사용자 판단으로 "지금 안 함" 결정됨.

## Engineering Review Decisions (2026-04-17)

### Architecture (A1-A8)

**A1. Markdown → HTML 파이프라인**: HTML 직접 작성. `content/articles/*.md` 는 소스 참조용만. 빌드 스텝 불필요. 기사 3+ 개로 늘면 TODO 로 build script 추가.

**A2. Deep link URL 포맷**: 기존 `js/app.js:266` 의 `#conflict=<slug>` hash 패턴 사용. 플랜 초안의 `?conflict=&panel=open` 포맷 폐기. Inline data card `VIEW ON GLOBE` 링크는 `/#conflict=<slug>` — panel auto-open 은 기존 `handleDeepLink` 가 처리.

**A3. Session death 공식 단일 소스**:
```js
// js/deaths.js (NEW — both globe and article import)
export function calculateAnnualDeathRate(conflicts) {
  const currentYear = new Date().getFullYear();
  return conflicts.reduce((sum, c) => {
    const yearsActive = Math.max(1, currentYear - (c.startYear || currentYear));
    return sum + c.casualties / yearsActive;
  }, 0);
}
export function deathsPerSecond(annualDeathRate) {
  return annualDeathRate / (365.25 * 24 * 3600);
}
export const FALLBACK_ANNUAL = 273000;  // 2026-04-17 conflicts.json baseline
export const FALLBACK_DAILY = 748;
```
`js/app.js` refactor: 내부 공식 제거 → `deaths.js` import.

**A4. og 이미지 생성**: `scripts/generate-og.py` (Python) 확장. `scripts/screenshot.js` 는 존재하지 않음 — 플랜 초안 오류 수정. Python Playwright 또는 Pillow 로 variant-A hero 스타일 1200×630 `public/og-article-business-model.png` 생성.

**A5. 26-dot grid 데이터 로딩**: `js/article.js` 가 페이지 로드 시 `fetch('/data/conflicts.json')`. Grid 영역 초기 = 26개 dim 회색 dot (skeleton, pulse delay 랜덤). Fetch 완료 시 빨간 dot + tooltip 데이터 hydrate. Fetch 실패 시 fallback 상수 사용.

**A6. sessionStorage 공유**: 두 페이지가 `pow-session-start-ms` 키로 timestamp 공유.
```js
// js/article.js + refactored js/app.js
function getSessionStart() {
  let ms = sessionStorage.getItem('pow-session-start-ms');
  if (!ms) {
    ms = String(Date.now());
    try { sessionStorage.setItem('pow-session-start-ms', ms); } catch {}
  }
  return Number(ms);
}
```
sessionStorage 미가용(private mode) 시 `Date.now()` in-memory fallback.

**A7. File layout + source privacy**:
```
articles/
├── war-is-a-business-model/
│   ├── index.html              # short article (public)
│   └── full/
│       └── index.html          # long-form (public)
content/
└── articles/
    ├── war-is-a-business-model.md       # source (private, not served)
    └── war-is-a-business-model-full.md  # source (private)
```
`.vercelignore` 에 `content/` 추가 — public build 에서 제외.

**A8. Exit overlay 공용 모듈**:
```
js/
└── exit-overlay.js   # NEW - extracted from app.js:316-364
    export function setupExitOverlay({ getSessionDeaths, lang, origin })
```
글로브와 article 페이지 모두 import. 각 페이지가 자신의 `getSessionDeaths` 클로저 제공. sessionStorage 공유 덕분에 숫자도 일관.

### Code Quality (CQ1-CQ4)

**CQ1. Fetch 실패 fallback**: `js/deaths.js` 의 `FALLBACK_ANNUAL=273000`, `FALLBACK_DAILY=748`. `js/article.js` 는 fetch 실패 시 이 상수로 계산 지속. 감정 arc 보존.

**CQ2. Pull quote italic**: Google Fonts URL 에 Space Mono italic 추가:
```html
<!-- index.html AND article HTML -->
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
```

**CQ3. localStorage 키 컨벤션**: `pow-xxx` (dash) 로 통일. 플랜의 `pow_lang_notice_dismissed` → `pow-lang-notice-dismissed`. 기존 `pow_visit_<date>` 는 별도 TODO 로 migration (지금 건드리지 않음 — 데이터 손실 위험).

**CQ4. Article i18n 로딩**: `js/article.js` 가 `js/i18n.js` import, lang toggle 비브랜드 하단 (brand bar 우측) 에 렌더. body Korean 유지. Lang notice bar 는 `getLang() === 'en'` 일 때만 렌더. `data/i18n.json` 에 추가 키:
- `article.readStory` (READ THE STORY / 기사 읽기)
- `article.deepDive` (DEEP DIVE → / 전문 보기 →)
- `article.readShort` (← Read the short version / ← 요약본으로)
- `article.returnGlobe` (RETURN TO THE GLOBE → / 지구본으로 돌아가기 →)
- `article.viewOnGlobe` (VIEW ON GLOBE → / 지구본에서 보기 →)
- `article.whileReading` (WHILE YOU READ THIS, / 이 글을 읽는 동안,)
- `article.peopleDied` (PEOPLE DIED / 명이 죽었다)
- `article.skipToContent` (Skip to article / 본문으로 건너뛰기)
- `article.langNotice` (This article is in Korean — Machine translate → / null — KO user 에게는 비노출)
- `article.seeAllConflicts` (SEE ALL 26 CONFLICTS LIVE / 26개 분쟁 전부 보기)

### Test Plan (T1)

**구현과 동시에 작성할 테스트 30개** (IRON RULE regression 3개 포함):

| File | Type | Purpose |
|------|------|---------|
| `test/deaths.test.js` | unit | R1 regression + edge cases (empty, 26, missing startYear, fallback) |
| `test/article.test.js` | unit | fetchConflicts success/fail/timeout, sessionStart read/write, render26DotGrid, counter tick math |
| `test/exit-overlay.test.js` | unit | R2 extraction parity + visibilitychange state machine |
| `test/lang-notice.test.js` | unit | navigator.language detection, dismiss flag |
| `test/e2e/article-flow.e2e.js` | E2E | Globe → article → back, session counter continuity |
| `test/e2e/article-deep-link.e2e.js` | E2E | Data card click → globe panel opens |
| `test/e2e/article-mobile.e2e.js` | E2E | 375px viewport, TOC hidden, 13×2 grid |
| `test/e2e/article-a11y.e2e.js` | E2E | keyboard nav, focus rings, ARIA |

Test plan 상세: `~/.gstack/projects/pulse-of-war/gunter-main-articles-page-eng-review-test-plan-20260417-173000.md`

### Performance (P1)

**성능 예산 재정의**: JS `≤ 5KB gzipped` (기존 ≤ 8KB uncompressed 가 실제 로드량 초과). Article 페이지 실제 로드:
- `js/article.js` ~5KB raw (~2KB gz)
- `js/deaths.js` ~1KB raw (~0.5KB gz)
- `js/exit-overlay.js` ~2KB raw (~1KB gz)
- `js/i18n.js` ~3KB raw (~1.5KB gz)
- **합계 ~5KB gzipped** ✅ budget 통과

### Updated File Structure

```
pulse-of-war/
├── index.html                       # MODIFY - .header__read-cta 추가, Google Fonts URL 에 italic 추가
├── articles/
│   └── war-is-a-business-model/
│       ├── index.html               # NEW - short article (rendered HTML)
│       └── full/
│           └── index.html           # NEW - long-form
├── content/                         # NEW - sources, excluded from public via .vercelignore
│   └── articles/
│       ├── war-is-a-business-model.md
│       └── war-is-a-business-model-full.md
├── css/
│   ├── article.css                  # NEW - article 페이지 전용
│   └── style.css                    # MODIFY - .header__read-cta 스타일
├── js/
│   ├── article.js                   # NEW - article 오케스트레이션
│   ├── deaths.js                    # NEW - 공식 단일 소스
│   ├── exit-overlay.js              # NEW - extracted from app.js
│   ├── app.js                       # MODIFY - deaths.js, exit-overlay.js import; 내부 공식/overlay 삭제
│   └── i18n.js                      # MODIFY - article.* 키 포함
├── data/
│   └── i18n.json                    # MODIFY - article.* keys
├── scripts/
│   └── generate-og.py               # MODIFY - variant-A-style article og 생성
├── public/
│   └── og-article-business-model.png   # NEW - 1200×630
├── vercel.json                      # MODIFY - /articles → /articles/war-is-a-business-model redirect
├── .vercelignore                    # NEW - content/ 제외
└── test/
    ├── deaths.test.js               # NEW
    ├── article.test.js              # NEW
    ├── exit-overlay.test.js         # NEW
    ├── lang-notice.test.js          # NEW
    └── e2e/
        ├── article-flow.e2e.js      # NEW
        ├── article-deep-link.e2e.js # NEW
        ├── article-mobile.e2e.js    # NEW
        └── article-a11y.e2e.js      # NEW
```

### Worktree Parallelization

| Lane | Steps | 독립성 |
|------|-------|--------|
| A | `js/deaths.js` 추출 → `js/app.js` refactor → `test/deaths.test.js` | A는 전 후 변경의 foundation — 가장 먼저 |
| B | `js/exit-overlay.js` 추출 → `js/app.js` refactor → `test/exit-overlay.test.js` | B는 A와 독립, 같은 app.js 수정 — A 후 순차 |
| C | `articles/war-is-a-business-model/index.html` + `content/articles/*.md` 이동 + `css/article.css` | A/B와 독립 |
| D | `js/article.js` + 30개 테스트 작성 | C 이후 (HTML skeleton 필요) |
| E | `articles/war-is-a-business-model/full/index.html` + TOC/progress bar | D와 일부 겹침 — 순차 |
| F | `scripts/generate-og.py` 확장 + `public/og-article-business-model.png` 생성 + SEO meta | C 이후 |
| G | `vercel.json` redirect + `.vercelignore` | 독립 — 마지막 통합 |

**실행 순서**: `A → B → (C + F 병렬) → D → E → G`. Lane B, C, F 는 A 완료 후 병렬 가능. 3-4 worktree 활용하면 wall-clock 50% 단축.

### Failure Modes Table

각 새 코드패스의 프로덕션 실패 시나리오:

| Failure | Covered? | UX when it happens |
|---------|----------|--------------------|
| conflicts.json 404 / network timeout | ✅ fallback constants | counter = FALLBACK 기반, grid skeleton stays |
| conflicts.json malformed JSON | ✅ try/catch around fetch | fallback, console.error, no UI hang |
| sessionStorage disabled | ✅ in-memory fallback | counter 정확, 다만 페이지 간 재시작 |
| navigator.clipboard 부재 | ✅ textarea select fallback | "Press ⌘C" toast 2s |
| IntersectionObserver 미지원 (IE, 매우 구버전) | ⚠️ polyfill 없음 | TOC highlight 안 됨, 나머지 OK — **silent degradation 허용** (target browsers = evergreen) |
| Pull quote italic 폰트 로드 실패 | ✅ font-display: swap | 일반 weight 로 fallback, 시각적 차이 미미 |
| DeepL 외부 URL down | ⚠️ 확인 불가 | 사용자 새 탭 "site unavailable" 노출 — **acceptable (외부 서비스)** |
| lang toggle 중 fetch in-flight | ⚠️ race | 현재 fetched conflicts 로 re-render 가능 — **acceptable** |
| 26-dot grid 모바일 reflow 시 tap target 44px 미달 | ⚠️ visual verify 필요 | E2E test 에서 확인 |

**Critical gaps**: 0 (silent failure 없음, 모든 failure mode 는 graceful).

## Outside Voice Findings (2026-04-17)

Codex auth expired → Claude subagent fallback. 7개 finding, 4개 accepted, 2개 auto-fixed, 1개 false positive.

| # | Finding | Status | Resolution |
|---|---------|--------|------------|
| OV1 | `performance.now()` → sessionStorage + `Date.now()` 는 globe 카운터 timing 모델 변경 | ✅ ACCEPTED | Wall-clock 이 의미론적으로 정확 (탭 sleep 중에도 사망 계속). Globe/article 둘 다 `Date.now()` 전환. |
| OV2 | 플랜 내 stale `scripts/screenshot.js` 참조 | ✅ AUTO-FIXED | 7D 섹션 `scripts/generate-og.py` (기존 Python) 로 scrub 완료. |
| OV3 | 플랜 1B 에 stale `?conflict=&panel=open` URL | ✅ AUTO-FIXED | `/#conflict=<slug>` 로 scrub 완료. |
| OV4 | KO-only 기사 하나에 scope goldplating (TOC, notice, 30 tests) | ⚠️ REJECTED | 사용자 판단: 품질 투자, 재사용 가능. Full scope 유지. |
| OV5 | 5분 read = 2.6 deaths 가 96px Bebas Neue 로 작아보임 | ✅ ACCEPTED | Hybrid counter: session deaths + global daily. `3 / 748 TODAY` 형태. |
| OV6 | `vercel.json` 에 `redirects` block 없음, 추가 필요 | ✅ AUTO-FIXED | 아래 7D 스펙 확정. |
| OV7 | "conflicts.json 25 entries" 주장 | ❌ FALSE POSITIVE | 실측 26개 확인. Grid 4×7, copy "26 CONFLICTS" 그대로. |

### OV5 구현 스펙 변경

Article-end CTA block 수정:

```
WHILE YOU READ THIS,
   [N]  PEOPLE DIED          ← Bebas Neue 96px 빨강
             
   TODAY: 748 SO FAR          ← Space Mono 13px dim, letter-spacing .15em
   ───────────────            ← 1px 흰색 12% 선
   [26-dot grid]
   [RETURN TO THE GLOBE →]
```

`TODAY: 748 SO FAR` 는 build 시점의 daily rate (`conflicts.json` 기반). fetch 성공 시 실시간 값으로 교체.

### OV6 구현 스펙: vercel.json

기존 vercel.json 에 top-level `redirects` 추가:

```json
{
  "outputDirectory": ".",
  "buildCommand": "",
  "installCommand": "npm install",
  "framework": null,
  "functions": {
    "api/chat.ts": { "maxDuration": 30 }
  },
  "redirects": [
    {
      "source": "/articles",
      "destination": "/articles/war-is-a-business-model",
      "permanent": true
    },
    {
      "source": "/articles/",
      "destination": "/articles/war-is-a-business-model",
      "permanent": true
    }
  ]
}
```

## Eng Review Completion Summary

```
+====================================================================+
|         ENG PLAN REVIEW — COMPLETION SUMMARY                       |
+====================================================================+
| Step 0 Scope Challenge | accepted (~10 files, 1 new module, OK)    |
| Section 1 Architecture | 8 issues resolved                         |
| Section 2 Code Quality | 4 issues resolved                         |
| Section 3 Tests        | 30 paths mapped, 3 IRON regressions, 0 cov|
| Section 4 Performance  | 1 budget revision (gzipped metric)        |
| Outside Voice          | 7 findings, 5 accepted (4 applied +1 REJ),|
|                        | 2 auto-fixed, 1 false positive           |
+--------------------------------------------------------------------+
| NOT in scope           | written (9 items)                         |
| What already exists    | written (7 reusable assets)               |
| TODOS.md updates       | 0 new (DESIGN.md already added by design) |
| Failure modes          | 0 critical gaps                            |
| Worktree parallelization| 7 lanes, A→B→(C+F parallel)→D→E→G        |
| Lake score             | 13/13 recommendations chose complete       |
| Unresolved decisions   | 0                                          |
+====================================================================+
```

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion (outside voice) | 1 | ISSUES_FOUND (claude subagent fallback — codex auth expired) | 7 findings: 5 accepted (4 applied + 1 rejected via user), 2 auto-fixed, 1 false positive |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (PLAN, 853ea02) | 13 issues: 8 architecture + 4 code quality + 1 performance. 3 IRON regressions flagged. 0 critical gaps. |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR (PLAN, 853ea02) | score: 4/10 → 9/10, 12 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | 기사 페이지는 developer-facing 아님 — 생략 적절 |

**CROSS-MODEL:** Claude subagent (outside voice) found 7 gaps that primary eng review missed (sessionStorage refactor semantics, stale plan references, scope goldplate query, counter emotional dilution, vercel.json redirects block, off-by-one conflict count [FP], og generator path consistency). 6 valid findings = high-overlap with code reality. 1 false positive on conflict count (critic miscount).

**UNRESOLVED:** 0

**VERDICT:** DESIGN + ENG BOTH CLEARED — ready to implement. Follow worktree parallelization in `## Engineering Review Decisions` section. Regression IRON RULE: deaths.js + exit-overlay.js extraction MUST have tests before shipping.



- 메인 지구본에서 `/articles` 로의 entry point 위치 — 헤더 링크? bottom-bar 버튼? watermark 옆?
- Article typography — Space Mono 모노스페이스 유지(일관성) vs. reading-first serif(가독성)
- Inline data card 의 Visual weight — 크게(attention grab) vs. inline(flow 방해 최소화)
- Scroll progress indicator — 상단 바? 측면? 없음?
- Table of contents — sticky 사이드바? 상단 접힘? long-form 전용?
- Pull quote 스타일 — 좌측 빨간 border? 중앙 정렬 큰 인용부호?
- 기사 끝 CTA — 단순 링크? 영구 sticky "return to globe" 버튼?
- Dark vs. light reading mode toggle 제공?
- "Read the deep dive" 링크 위치 — short article 끝? 상단 메타? 중간 interstitial?
- i18n: 한국어만 공개 시 영어 유저에게 어떻게 알릴까 — 자동 안내 bar? "KO only" 라벨?

## Not specified (will be resolved during review)

- Interaction states (loading, empty, error, partial)
- Responsive behavior per viewport
- Accessibility (a11y) contract
- Motion/animation language
- SEO meta (og:image per article, canonical, schema.org Article)
- Performance budget (size, FCP, LCP)

## Approved visual direction — Variant A (Mono Terminal)

- **Prototype**: `~/.gstack/projects/pulse-of-war/designs/articles-page-20260417/variant-A-mono.html`
- **DNA**: Space Mono body + Bebas Neue 128px 헤드라인. 순수 검정 #000 배경. 빨간 #ff2020 유일 accent. 좌상단 ambient red glow.
- **Constraints** (잠금):
  - Body 는 Space Mono 모노스페이스 유지. 절대 serif 로 바꾸지 말 것.
  - Bebas Neue 는 헤드라인 전용. Body 에 쓰지 말 것.
  - 빨간 #ff2020 외 다른 accent 색 금지.
  - Rounded corners 금지, gradient 금지 (헤드라인 glow 제외), illustration/photo 금지.
  - Inline data card = 1px 빨간 보더 only, fill 없음. 숫자 큰 사이즈.
