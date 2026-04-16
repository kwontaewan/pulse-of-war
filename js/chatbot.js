// Chatbot widget — floating button + panel.
// Every page includes this. Calls /api/chat (Vercel Function), streams response.

import { initI18n, t, getLang } from './i18n.js';

const MAX_HISTORY = 20;
const DAILY_LIMIT = 50;
const STORAGE_KEY = 'pow-chat-history';
const USAGE_KEY_PREFIX = 'pow-chat-usage-';

let modalEl = null;
let state = {
  open: false,
  streaming: false,
  history: [],
  lang: 'en',
};

export async function initChatbot() {
  state.lang = (await initI18n()) || 'en';
  state.history = loadHistory();

  // Probe the chat endpoint. If it returns 503 "paused", hide the FAB entirely
  // so the UI never promises a feature it can't deliver. Runs once at page
  // load. Failure to reach the endpoint is treated as paused too.
  const available = await probeAvailability();
  if (!available) return;

  renderButton();
}

async function probeAvailability() {
  try {
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'ping' }], lang: state.lang }),
    });
    // Drain the body so the stream doesn't stay open.
    try { await r.body?.cancel(); } catch {}
    // Only a real 200 stream indicates the chatbot is live. Anything else
    // (404 static-serve, 401 auth wall, 503 paused, 5xx errors) means hide
    // the widget.
    return r.status === 200;
  } catch {
    return false;
  }
}

function renderButton() {
  const btn = document.createElement('button');
  btn.className = 'chat-fab';
  btn.setAttribute('aria-label', state.lang === 'ko' ? '챗봇 열기' : 'Open chat');
  btn.innerHTML = '<span class="chat-fab__icon">💬</span>';
  btn.addEventListener('click', openPanel);
  document.body.appendChild(btn);
}

function openPanel() {
  if (!modalEl) buildModal();
  modalEl.classList.add('chat-panel--open');
  state.open = true;
  modalEl.querySelector('.chat-input')?.focus();
  renderMessages();
}

function closePanel() {
  if (!modalEl) return;
  modalEl.classList.remove('chat-panel--open');
  state.open = false;
}

function buildModal() {
  const placeholder = state.lang === 'ko'
    ? 'LMT가 왜 올랐어? Ukraine 상황은?'
    : 'Why did LMT move? Ukraine situation?';
  const title = state.lang === 'ko' ? '전쟁 AI 질의' : 'Ask the War Map';
  const disclaimer = state.lang === 'ko'
    ? 'AI commentary · 투자자문 아님'
    : 'AI commentary · not investment advice';

  modalEl = document.createElement('div');
  modalEl.className = 'chat-panel';
  modalEl.innerHTML = `
    <div class="chat-panel__header">
      <div class="chat-panel__title">${escapeHtml(title)}</div>
      <button class="chat-panel__close" data-action="close" aria-label="Close">&times;</button>
    </div>
    <div class="chat-panel__disclaimer">${escapeHtml(disclaimer)}</div>
    <div class="chat-panel__messages" id="chat-messages"></div>
    <form class="chat-panel__form" id="chat-form">
      <input class="chat-input" name="q" placeholder="${escapeAttr(placeholder)}" maxlength="2000" autocomplete="off" required />
      <button class="chat-submit" type="submit">▶</button>
    </form>
    <div class="chat-panel__usage" id="chat-usage"></div>
  `;
  document.body.appendChild(modalEl);

  modalEl.addEventListener('click', (e) => {
    const act = e.target.closest('[data-action]')?.dataset.action;
    if (act === 'close') closePanel();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.open) closePanel();
  });
  modalEl.querySelector('#chat-form').addEventListener('submit', onSubmit);
  updateUsageLabel();
}

async function onSubmit(e) {
  e.preventDefault();
  if (state.streaming) return;
  const input = modalEl.querySelector('.chat-input');
  const q = input.value.trim();
  if (!q) return;

  if (!consumeUsage()) {
    appendMessage('system', state.lang === 'ko'
      ? `오늘 채팅 한도 ${DAILY_LIMIT}건 도달. 내일 다시 와주세요.`
      : `Daily chat limit (${DAILY_LIMIT}) reached. Come back tomorrow.`);
    return;
  }
  input.value = '';

  state.history.push({ role: 'user', content: q });
  trimHistory();
  saveHistory();
  renderMessages();

  const assistantIdx = state.history.length;
  state.history.push({ role: 'assistant', content: '' });
  renderMessages();

  state.streaming = true;
  setThinking(true);

  try {
    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: state.history.slice(0, assistantIdx),
        lang: state.lang,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      state.history[assistantIdx].content = formatError(resp.status, errText);
    } else if (!resp.body) {
      state.history[assistantIdx].content = state.lang === 'ko'
        ? '응답을 받지 못했습니다.'
        : 'No response received.';
    } else {
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      setThinking(false);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        state.history[assistantIdx].content += decoder.decode(value, { stream: true });
        renderMessages();
        scrollToBottom();
      }
    }
  } catch (err) {
    console.error('chat request failed', err);
    state.history[assistantIdx].content = state.lang === 'ko'
      ? '네트워크 오류. 잠시 후 다시 시도해주세요.'
      : 'Network error. Try again in a moment.';
  } finally {
    setThinking(false);
    state.streaming = false;
    trimHistory();
    saveHistory();
    renderMessages();
    scrollToBottom();
  }
}

function formatError(status, text) {
  try {
    const obj = JSON.parse(text);
    if (obj.message) return `[${status}] ${obj.message}`;
    if (obj.error) return `[${status}] ${obj.error}`;
  } catch {}
  return `[${status}] ${state.lang === 'ko' ? '오류가 발생했습니다.' : 'Request failed.'}`;
}

function setThinking(on) {
  const msgs = modalEl?.querySelector('#chat-messages');
  if (!msgs) return;
  let t = msgs.querySelector('.chat-thinking');
  if (on && !t) {
    t = document.createElement('div');
    t.className = 'chat-thinking';
    t.textContent = state.lang === 'ko' ? '…생각 중' : '…thinking';
    msgs.appendChild(t);
  } else if (!on && t) {
    t.remove();
  }
}

function renderMessages() {
  if (!modalEl) return;
  const c = modalEl.querySelector('#chat-messages');
  c.innerHTML = state.history.map(m => {
    const cls = m.role === 'user' ? 'chat-msg chat-msg--user'
      : m.role === 'assistant' ? 'chat-msg chat-msg--assistant'
      : 'chat-msg chat-msg--system';
    return `<div class="${cls}">${formatMessageContent(m.content)}</div>`;
  }).join('');
}

function formatMessageContent(text) {
  // Very light markdown: bold, italic, links. Escape first.
  let html = escapeHtml(text || '');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');
  html = html.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

function scrollToBottom() {
  const c = modalEl?.querySelector('#chat-messages');
  if (c) c.scrollTop = c.scrollHeight;
}

function appendMessage(role, content) {
  state.history.push({ role, content });
  trimHistory();
  saveHistory();
  renderMessages();
  scrollToBottom();
}

function trimHistory() {
  if (state.history.length > MAX_HISTORY) {
    state.history = state.history.slice(-MAX_HISTORY);
  }
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.slice(-MAX_HISTORY);
  } catch {
    return [];
  }
}

function saveHistory() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
  } catch {
    // quota exceeded — drop half and retry once
    state.history = state.history.slice(-Math.floor(MAX_HISTORY / 2));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
    } catch {}
  }
}

function todayKey() {
  return USAGE_KEY_PREFIX + new Date().toISOString().slice(0, 10);
}

function consumeUsage() {
  const k = todayKey();
  const n = Number(localStorage.getItem(k) || '0');
  if (n >= DAILY_LIMIT) return false;
  try {
    localStorage.setItem(k, String(n + 1));
  } catch {
    return true;  // allow on quota errors
  }
  updateUsageLabel();
  return true;
}

function updateUsageLabel() {
  const el = modalEl?.querySelector('#chat-usage');
  if (!el) return;
  const used = Number(localStorage.getItem(todayKey()) || '0');
  el.textContent = state.lang === 'ko'
    ? `오늘 ${used}/${DAILY_LIMIT}건 사용`
    : `${used}/${DAILY_LIMIT} today`;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

// Auto-init on every page that includes this script.
initChatbot().catch(err => console.error('chatbot init failed', err));
