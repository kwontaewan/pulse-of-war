// P&L card renderer — Canvas 2D, retina-aware.
//
// Layout (1200x630, WSB/X friendly og:image ratio):
//
//  ┌─────────────────────────────────────────┐
//  │  PULSE OF WAR                  [badge]  │  ← brand strip
//  │                                         │
//  │  If you bought $1,000 of $LMT          │  ← thesis line
//  │  when Ukraine-Russia War started        │
//  │                                         │
//  │  $3,420            +242%                │  ← today value + gain
//  │                                         │
//  │  while the war continued.               │  ← kicker
//  │                                         │
//  │                    pulseofwar.com/#...  │  ← footer watermark
//  └─────────────────────────────────────────┘

import { calculateGain, formatCurrency, formatPct } from './card-math.js';
import { t, getLang } from './i18n.js';

const CARD_W = 1200;
const CARD_H = 630;

const COLORS = {
  bg: '#000000',
  bgAccent: '#0a0a0a',
  text: '#ffffff',
  textDim: 'rgba(255,255,255,0.55)',
  brand: '#ff2020',
  gain: '#2ee67a',
  loss: '#ff2020',
  rule: 'rgba(255,255,255,0.12)',
};

// Render into a given canvas. Returns { ctx, canvas }.
export function renderCard(canvas, { conflict, stock, amount, lang }) {
  const L = lang || getLang() || 'en';
  const gain = calculateGain(amount, stock.change);
  if (!gain) throw new Error('Invalid amount/change');

  const dpr = window.devicePixelRatio || 1;
  canvas.width = CARD_W * dpr;
  canvas.height = CARD_H * dpr;
  canvas.style.width = CARD_W + 'px';
  canvas.style.height = CARD_H + 'px';

  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  // Background with subtle radial glow
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const glow = ctx.createRadialGradient(CARD_W * 0.7, CARD_H * 0.3, 0, CARD_W * 0.7, CARD_H * 0.3, 600);
  glow.addColorStop(0, gain.isLoss ? 'rgba(255,32,32,0.18)' : 'rgba(46,230,122,0.15)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Brand strip
  ctx.fillStyle = COLORS.brand;
  ctx.fillRect(0, 0, 8, CARD_H);

  const padX = 72;
  let y = 68;

  // Brand name
  ctx.font = '700 22px "Space Mono", monospace';
  ctx.fillStyle = COLORS.textDim;
  ctx.textBaseline = 'top';
  ctx.fillText('PULSE OF WAR', padX, y);

  // Live tag on the right
  const liveTag = L === 'ko' ? '● 실시간 전쟁' : '● LIVE WAR';
  ctx.font = '700 18px "Space Mono", monospace';
  ctx.fillStyle = COLORS.brand;
  const liveW = ctx.measureText(liveTag).width;
  ctx.fillText(liveTag, CARD_W - padX - liveW, y);

  y += 72;

  // Thesis line 1: "If you bought $X of $TICKER"
  const thesis1 = L === 'ko'
    ? `${formatCurrency(gain.invested)}으로 $${stock.ticker}를 샀다면`
    : `If you bought ${formatCurrency(gain.invested)} of $${stock.ticker}`;
  ctx.font = '700 52px "Bebas Neue", "Space Mono", sans-serif';
  ctx.fillStyle = COLORS.text;
  ctx.fillText(thesis1, padX, y);

  y += 64;

  // Thesis line 2: "when Ukraine-Russia War started"
  const conflictName = (L === 'ko' && conflict.name_ko) ? conflict.name_ko : conflict.name;
  const thesis2 = L === 'ko'
    ? `${conflictName} 시작 시점에`
    : `when ${conflictName} started`;
  ctx.font = '400 34px "Space Mono", monospace';
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText(thesis2, padX, y);

  y += 84;

  // BIG NUMBER: today's value
  ctx.font = '700 136px "Bebas Neue", "Space Mono", sans-serif';
  ctx.fillStyle = COLORS.text;
  const todayStr = formatCurrency(gain.today);
  ctx.fillText(todayStr, padX, y);

  // Gain % — right-aligned, colored
  const gainStr = formatPct(gain.gainPct);
  ctx.font = '700 96px "Bebas Neue", "Space Mono", sans-serif';
  ctx.fillStyle = gain.isLoss ? COLORS.loss : COLORS.gain;
  const gainW = ctx.measureText(gainStr).width;
  ctx.fillText(gainStr, CARD_W - padX - gainW, y + 20);

  y += 156;

  // Divider
  ctx.strokeStyle = COLORS.rule;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, y);
  ctx.lineTo(CARD_W - padX, y);
  ctx.stroke();

  y += 28;

  // Kicker
  const kicker = L === 'ko'
    ? (gain.isLoss ? '이 전쟁이 진행되는 동안.' : '전쟁이 계속되는 동안.')
    : (gain.isLoss ? 'while the war dragged on.' : 'while the war continued.');
  ctx.font = '400 28px "Space Mono", monospace';
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText(kicker, padX, y);

  // Footer watermark — bottom-right
  const slug = toSlug(conflict.name);
  const wm = `pulseofwar.com/#conflict=${slug}`;
  ctx.font = '400 20px "Space Mono", monospace';
  ctx.fillStyle = COLORS.textDim;
  const wmW = ctx.measureText(wm).width;
  ctx.fillText(wm, CARD_W - padX - wmW, CARD_H - 44);

  return { ctx, canvas };
}

// Export canvas as PNG blob.
export function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('toBlob returned null'));
    }, 'image/png');
  });
}

function toSlug(name) {
  return String(name).toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
