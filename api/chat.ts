// Vercel Function: POST /api/chat
//
// Request flow:
//   ┌──────────────┐
//   │ parse body   │ → 400 if malformed
//   └──────┬───────┘
//   ┌──────▼───────┐
//   │ kill switch  │ → 503 if BUDGET_EXHAUSTED=true
//   └──────┬───────┘
//   ┌──────▼───────┐
//   │ IP throttle  │ → 429 (in-memory, per-instance)
//   └──────┬───────┘
//   ┌──────▼───────┐
//   │ last message │ → 400 if missing
//   │   validator  │ → 200 with refusal if hard-refuse pattern
//   └──────┬───────┘
//   ┌──────▼────────────┐
//   │ streamText to     │
//   │ anthropic/haiku   │ — system prompt cached
//   └──────┬────────────┘
//   ┌──────▼───────────────────┐
//   │ SSE stream to client     │
//   │  + trailing disclaimer   │
//   └──────────────────────────┘

import { streamText, type ModelMessage } from 'ai';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MODEL = 'anthropic/claude-haiku-4-5';
const MAX_INPUT_LENGTH = 2000; // chars per user message
const MAX_MESSAGES = 20;
const MAX_OUTPUT_TOKENS = 600;

// Per-instance IP throttle (resets on cold start). Not a real rate limiter,
// just a cost-saver against burst abuse.
const ipHits = new Map<string, { count: number; resetAt: number }>();
const IP_WINDOW_MS = 60_000;
const IP_MAX_PER_WINDOW = 10;

// Hard-refuse: ticker + action verb → refuse without calling LLM at all.
// EN + KO patterns. The regex intentionally casts wide.
const REFUSE_PATTERNS: RegExp[] = [
  /\$?[A-Z]{2,5}\b.{0,40}(should\s+i|is\s+it\s+a\s+good\s+time|buy|sell|short|go\s+long)/i,
  /(should\s+i|is\s+it\s+a\s+good\s+time|when\s+to)\s+(buy|sell|short)\s+\$?[A-Z]{2,5}/i,
  // Korean
  /\$?[A-Z]{2,5}.{0,20}(사야|팔아야|들어가도|들어갈까|매수|매도|공매도|손절)/,
  /(사야|팔아야|들어가도|들어갈까).{0,30}(\$?[A-Z]{2,5}|[가-힣]{2,6}(주|테크|인더스트리))/,
  /(target price|price target|목표\s*주가|목표가)/i,
  /(guaranteed|certain|100%\s*(profit|return|수익))/i,
];

// Load prompts + compact context at module init (cold start cost once, not per req)
const ROOT = process.cwd();
let SYSTEM_PROMPT: string;
let COMPACT_DATA: string;
try {
  SYSTEM_PROMPT = readFileSync(join(ROOT, 'prompts', 'system-prompt.md'), 'utf-8');
  COMPACT_DATA = readFileSync(join(ROOT, 'data', 'context-compact.json'), 'utf-8');
} catch {
  // Fallback — Vercel Function may have different cwd depending on config
  SYSTEM_PROMPT = '';
  COMPACT_DATA = '{}';
}

const DISCLAIMER = {
  en: '_AI commentary on public data. Not investment advice. Not a registered advisor._',
  ko: '_공개 데이터에 대한 AI 해석. 투자자문 아님. 이 서비스는 자본시장법상 투자자문업 등록을 하지 않았습니다._',
};

const REFUSAL = {
  en:
    "I can't give individual investment advice (buy/sell, price targets, specific actions). " +
    "I can explain what the data shows about this conflict or stock — try asking about the " +
    "situation, recent moves, or sector outlook.\n\n" +
    DISCLAIMER.en,
  ko:
    "개별 투자 권유(매수/매도, 목표가, 구체적 행동)는 드릴 수 없습니다. " +
    "전쟁 상황, 최근 가격 변동, 섹터 전망 같은 데이터 해석은 답변드릴 수 있으니 그런 방향으로 질문해주세요.\n\n" +
    DISCLAIMER.ko,
};

export const config = {
  maxDuration: 30,
};

type ChatRequest = {
  messages: ModelMessage[];
  lang?: 'en' | 'ko';
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // Kill switch
  if (process.env.BUDGET_EXHAUSTED === 'true') {
    return json(
      {
        error: 'budget_exhausted',
        message:
          'Daily AI budget reached. Chat will resume tomorrow. The map and data still work.',
      },
      503,
    );
  }

  // Parse
  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const lang: 'en' | 'ko' = body.lang === 'ko' ? 'ko' : 'en';
  const messages = Array.isArray(body.messages) ? body.messages.slice(-MAX_MESSAGES) : [];

  if (messages.length === 0) {
    return json({ error: 'no_messages' }, 400);
  }

  const last = messages[messages.length - 1];
  const lastText = last && last.role === 'user' && typeof last.content === 'string'
    ? last.content
    : null;
  if (!lastText) {
    return json({ error: 'bad_last_message' }, 400);
  }
  if (lastText.length > MAX_INPUT_LENGTH) {
    return json({ error: 'message_too_long' }, 413);
  }

  // IP throttle
  const ip = clientIp(req);
  if (!allowIp(ip)) {
    return json({ error: 'rate_limited', message: 'Too many requests. Try again in a minute.' }, 429);
  }

  // Hard-refuse pattern match → skip LLM entirely
  if (REFUSE_PATTERNS.some((r) => r.test(lastText))) {
    return streamStatic(REFUSAL[lang]);
  }

  const langHint = lang === 'ko'
    ? '사용자와 한국어로 대화하세요. 응답은 한국어로 작성하세요.'
    : 'Reply in English.';

  const systemPrompt =
    SYSTEM_PROMPT +
    '\n\n<data>\n' + COMPACT_DATA + '\n</data>\n\n' +
    langHint;

  // LLM call via Vercel AI Gateway. Provider string "anthropic/claude-haiku-4-5".
  const result = streamText({
    model: MODEL,
    messages,
    system: systemPrompt,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    temperature: 0.3,
  });

  // Tee the stream: as content comes in, we can't rewrite it server-side
  // (once bytes ship, they ship). So we rely on: strong system prompt +
  // hard-refuse upstream + client-side final disclaimer append. A post-hoc
  // server check is the only thing we can still do — append disclaimer in
  // the stream end callback.
  const encoder = new TextEncoder();
  const body$ = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const delta of result.textStream) {
          controller.enqueue(encoder.encode(delta));
        }
        controller.enqueue(encoder.encode('\n\n' + DISCLAIMER[lang] + '\n'));
      } catch (err) {
        const fallback = lang === 'ko'
          ? '\n\n[오류] 답변 생성 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.\n\n' + DISCLAIMER.ko
          : '\n\n[error] Something went wrong generating the response. Try again in a moment.\n\n' + DISCLAIMER.en;
        controller.enqueue(encoder.encode(fallback));
        console.error('chat stream error:', err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body$, {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'x-content-type-options': 'nosniff',
      'cache-control': 'no-store',
    },
  });
}

function streamStatic(text: string): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(c) {
        c.enqueue(encoder.encode(text));
        c.close();
      },
    }),
    {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    },
  );
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function clientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get('x-real-ip') ||
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

function allowIp(ip: string): boolean {
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || entry.resetAt < now) {
    ipHits.set(ip, { count: 1, resetAt: now + IP_WINDOW_MS });
    return true;
  }
  entry.count += 1;
  if (entry.count > IP_MAX_PER_WINDOW) return false;
  return true;
}
