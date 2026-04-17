# E2E Tests — TODO

The articles-page plan (`plan-articles-page.md` Test Plan section)
identifies 18 E2E scenarios that can't run under `node --test` without
a real browser. They are deferred until we add a Playwright/Puppeteer
harness.

## Scenarios to cover when infrastructure lands

### Primary flow
- Globe → `READ THE STORY →` → short article → scroll → `RETURN TO THE GLOBE →` → globe.
- `DEEP DIVE →` click on short → lands on `/full` → `← BACK TO SHORT` → back to short.
- Direct article URL (no prior globe visit) → fresh `pow-session-start-ms` → counter starts at 0.

### Data card + deep link
- Click inline `VIEW ON GLOBE →` → navigates to `/#conflict=<slug>` → panel auto-opens on globe.
- `/#stock=LMT` direct link → globe renders with stock panel.
- Invalid slug → globe lands clean, no panel, no toast.

### English-visitor notice
- `navigator.language='en-US'` → notice bar visible.
- Click DeepL link → new tab to `https://www.deepl.com/translator#auto/en/<encoded>`.
- Click × → `localStorage['pow-lang-notice-dismissed']='1'` → reload → notice stays hidden.
- `navigator.language='ko-KR'` → notice never renders.

### Exit overlay (shared module)
- Tab away 5s → return → overlay fires once per session.
- Share button → Twitter intent opens with session-death text.
- Close → overlay fades, does not re-fire.
- Globe exit overlay still fires post-extraction (R2 regression smoke).

### 26-dot grid
- Article loads with 26 dim skeleton dots.
- After `conflicts.json` hydrates → dots become red + pulse.
- Hover desktop / tap mobile → tooltip shows `name · casualties`.
- Click dot → deep link to globe with panel.
- Empty dataset → grid hides, "RETURN TO THE GLOBE" standalone.

### Long-form TOC
- Scroll through sections → `.article__toc a.is-active` tracks topmost visible section.
- Click TOC entry → smooth scroll to anchor.
- Mobile (<1100px) → TOC hidden, progress bar sticky.

### Back-to-top
- Scroll >40% → FAB fades in.
- Click FAB → smooth scroll to top.

### Accessibility
- Tab from brand bar → skip link (visible) → article meta → data-card CTA → end CTA → RETURN.
- All focusable elements show 2px red outline on focus.
- Screen reader announces `#js-end-deaths` updates every ~5s.

### Viewport
- 375px → title wraps without mid-word breaks (`word-break: keep-all`).
- 375px → data-card CTA touch target ≥ 44×44px.
- 375px → 26-dot grid reflows to 13×2 (not 4×7).

## Recommended harness

Playwright. Fluid on Vercel (per skill preamble), dev env has Node 24,
no existing browser automation.

- `npm i -D playwright` (~80 MB, fine for dev-only)
- `test/e2e/*.spec.js` — one spec per scenario group
- Run against `npx serve . -p 3911` in CI
- Parallel execution via `playwright.config.js`

## Status

Unit coverage for the articles page: 25 tests across `deaths.test.js`,
`exit-overlay.test.js`, `article.test.js`, `lang-notice.test.js`.
Regression tests (R1 deaths parity, R2 exit-overlay CSS selectors) are
unit-level and do NOT require this harness.

This TODO is tracked in the 2026-04-17 TODOs.md and unblocks once a
browser-automation dep is accepted into the stack.
