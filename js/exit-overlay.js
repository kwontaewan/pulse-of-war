// Exit overlay — shown when the user leaves and returns to the page.
// Extracted from js/app.js (2026-04-17) so the article pages can reuse
// the same "N died while you were away" moment without duplicating the
// state machine or the overlay markup.
//
// Call setupExitOverlay once during page init. It wires a one-shot
// visibilitychange → onReturn listener: the overlay only shows on the
// FIRST return after the user left the tab. getSessionDeaths must
// return the current session death count (the caller owns the math
// and the session start — typically via js/deaths.js).
//
// Returns a cleanup fn for tests.

export function setupExitOverlay({ getSessionDeaths, lang, shareUrl, doc = document }) {
  let exitShown = false;
  let onLeave, onReturn;

  onLeave = () => {
    if (doc.hidden && !exitShown) {
      exitShown = true;
      onReturn = () => {
        doc.removeEventListener('visibilitychange', onReturn);
        showExitOverlay({ getSessionDeaths, lang, shareUrl, doc });
      };
      doc.addEventListener('visibilitychange', onReturn);
    }
  };
  doc.addEventListener('visibilitychange', onLeave);

  return () => {
    doc.removeEventListener('visibilitychange', onLeave);
    if (onReturn) doc.removeEventListener('visibilitychange', onReturn);
  };
}

export function showExitOverlay({ getSessionDeaths, lang, shareUrl, doc = document }) {
  const deaths = getSessionDeaths();
  if (deaths < 1) return null;
  const overlay = doc.createElement('div');
  overlay.className = 'exit-overlay';
  const msg = lang === 'ko'
    ? `이 페이지를 보는 동안<br><span class="exit-overlay__number">${deaths.toLocaleString('en-US')}</span><br>명이 전쟁으로 사망했습니다`
    : `While you were reading this page<br><span class="exit-overlay__number">${deaths.toLocaleString('en-US')}</span><br>people died in armed conflicts`;
  const subMsg = lang === 'ko' ? '이 숫자는 멈추지 않습니다.' : 'This number never stops.';
  overlay.innerHTML = `
    <div class="exit-overlay__content">
      <div class="exit-overlay__text">${msg}</div>
      <div class="exit-overlay__sub">${subMsg}</div>
      <div class="exit-overlay__actions">
        <button class="exit-overlay__share">${lang === 'ko' ? 'X에 공유' : 'SHARE ON X'}</button>
        <button class="exit-overlay__close">${lang === 'ko' ? '닫기' : 'CLOSE'}</button>
      </div>
    </div>
  `;
  doc.body.appendChild(overlay);
  setTimeout(() => overlay.classList.add('exit-overlay--visible'), 50);

  overlay.querySelector('.exit-overlay__close').addEventListener('click', () => {
    overlay.classList.remove('exit-overlay--visible');
    setTimeout(() => overlay.remove(), 500);
  });

  overlay.querySelector('.exit-overlay__share').addEventListener('click', () => {
    const text = encodeURIComponent(
      lang === 'ko'
        ? `이 페이지를 보는 동안 ${deaths}명이 전쟁으로 사망했습니다.\n이 숫자는 멈추지 않습니다.`
        : `${deaths} people died in armed conflicts while I was reading this page.\nThis number never stops.`
    );
    const origin = shareUrl || (typeof location !== 'undefined' ? location.origin : '');
    if (typeof window !== 'undefined') {
      window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(origin)}`, '_blank');
    }
  });

  return overlay;
}
