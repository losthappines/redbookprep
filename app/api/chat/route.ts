import { NextRequest, NextResponse } from "next/server";
import { COACH_MODELS, FAILURE_MESSAGES, resolveModel, type Provider } from "../../../lib/redcoach-models";
import { runCoach, type ApiKeys, type ChatMessage } from "../../../lib/redcoach-provider";
import { cleanCoachText } from "../../../lib/redcoach-text";

export const runtime = "edge";

function cleanKey(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/^["']|["']$/g, "").trim() : "";
}

function getKeys(client: Partial<ApiKeys> = {}): ApiKeys {
  const gemini = cleanKey(client.gemini) || cleanKey(process.env.GEMINI_API_KEY) || cleanKey(process.env.GOOGLE_AI_API_KEY);
  return {
    gemini,
    groq: cleanKey(client.groq) || cleanKey(process.env.GROQ_API_KEY),
    mistral: cleanKey(client.mistral) || cleanKey(process.env.MISTRAL_API_KEY),
    gemma: cleanKey(client.gemma) || cleanKey(process.env.GEMMA_API_KEY) || gemini,
  };
}

const SYSTEM_INSTRUCTION = `You are "redCoach", the AI SAT test preparation coach for RedBookPrep (https://www.redbookprep.site).
Tone: Concise, encouraging, and immediately actionable. Never produce overly long essays, repetitive intros, or confusing theoretical jargon.

STYLE GUIDELINES:
1. Keep explanations short, clear, and direct (aim for 120-220 words total).
2. For Reading & Writing Transitions (e.g. Contrast vs. Concession):
   - Keep the difference intuitive and simple:
     * Direct Contrast (comparing two opposing facts or alternatives): "In contrast", "On the other hand", "Meanwhile".
       Example: The north ridge receives heavy snowfall. In contrast, the southern valley stays dry all winter.
     * Concession (an unexpected or surprising outcome happening despite the first fact): "Nevertheless", "Nonetheless", "Still", "Even so".
       Example: The team had no funding and a tight deadline. Nevertheless, their prototype passed every test.
   - Give a 1-line test-day rule: Ask "Is Sentence 2 just different (Contrast), or surprising given Sentence 1 (Concession)?"
3. For Math questions:
   - State the core rule/formula in 1 line.
   - Show 3-4 clean, bulleted solution steps.
   - Mention the quick Desmos graphing trick when helpful.

CRITICAL FORMATTING RULES:
- Use plain text headings and dash bullets. Do not use Markdown bold, headings, or backticks.
- Write math in clean plain text. Do not use LaTeX delimiters such as $, $$, \\(, or \\[, or commands such as \\frac, \\begin{cases}, or \\sqrt.
- Use Unicode symbols: ², ³, √, ×, ÷, −, ≠, ≤, ≥, π, ±.
- Write fractions as (numerator)/(denominator).
- Put equations on their own lines.`;

export async function GET() {
  const keys = getKeys();
  return NextResponse.json({
    configured: Object.fromEntries(Object.entries(keys).map(([provider, key]) => [provider, Boolean(key)])),
    supportedModels: COACH_MODELS,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { message, history = [], apiKeys = {}, model = COACH_MODELS[0].id } = body;
  const requested = typeof model === "string" ? resolveModel(model) : undefined;
  if (!requested || typeof message !== "string" || !message.trim() || message.length > 12000 ||
      !Array.isArray(history) || history.length > 6 || history.some((h) =>
        !h || !["user", "assistant"].includes(h.role) || typeof h.content !== "string" || h.content.length > 16000) ||
      !apiKeys || typeof apiKeys !== "object" || Array.isArray(apiKeys) ||
      Object.entries(apiKeys).some(([key, value]) => !["gemini", "groq", "mistral", "gemma"].includes(key) || typeof value !== "string" || value.length > 1024)) {
    return NextResponse.json({ error: "Use a supported model, a question of up to 12,000 characters, and at most six recent messages." }, { status: 400 });
  }
  try {
    const out = await runCoach(requested, getKeys(apiKeys), history as ChatMessage[], message.trim(), SYSTEM_INSTRUCTION);
    const checkedAt = new Date().toISOString();
    const checks = out.attempts.map((attempt) => ({ ...attempt, checkedAt }));
    // Log only safe metadata; never credentials, request bodies or provider error bodies.
    for (const attempt of out.attempts) {
      if (attempt.status !== "ok") console.warn("redCoach provider failure", { requestId, ...attempt });
    }
    if (!("text" in out)) {
      const first = out.attempts[0];
      const reason = first && first.status !== "ok" ? FAILURE_MESSAGES[first.status] : "No provider could complete the request.";
      return NextResponse.json({ error: `${requested.name}: ${reason} Please try another model.`, requestId, checks },
        { status: out.attempts.some((a) => a.status === "timeout") ? 504 : 503 });
    }
    const first = out.attempts[0];
    const reason = first.status === "ok" ? "" : FAILURE_MESSAGES[first.status];
    return NextResponse.json({
      reply: cleanCoachText(out.text), model: out.model, modelId: out.modelId,
      requestedModelId: out.requestedModelId, provider: out.provider,
      fallback: out.fallback,
      notice: out.fallback ? `${requested.name}: ${reason} Answered by ${out.model}.` : undefined,
      requestId, checks,
    });
  } catch {
    console.error("redCoach unexpected failure", { requestId });
    return NextResponse.json({ error: "The coaching server could not complete this request.", requestId }, { status: 500 });
  }
}
