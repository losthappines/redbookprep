import { COACH_MODELS, type Attempt, type CoachModel, type Provider } from "./redcoach-models";

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ApiKeys = Record<Provider, string>;
type Result = { text: string; model: string; modelId: string; provider: Provider };

function failureStatus(status: number): Attempt["status"] {
  if (status === 401) return "invalid_key";
  if (status === 403) return "access_denied";
  if (status === 429) return "rate_limited";
  if (status === 404 || status === 410) return "model_unavailable";
  if (status >= 400 && status < 500) return "bad_request";
  return "upstream_error";
}

function openAIText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content.filter((p) => p?.type === "text" && typeof p.text === "string").map((p) => p.text).join("\n").trim();
}

// One exact model per attempt. No dynamic selection of unrelated provider models.
async function callModel(
  model: CoachModel, key: string, history: ChatMessage[], message: string,
  instruction: string, timeoutMs: number, fetcher: typeof fetch,
): Promise<{ result?: Result; attempt: Attempt }> {
  const attempt: Attempt = { modelId: model.id, provider: model.provider, status: "missing_key" };
  if (!key) return { attempt };
  const google = model.provider === "gemini" || model.provider === "gemma";
  // Gemma is explicitly served by Google; never send another provider's key to Google.
  if (model.provider === "gemma" && /^(gsk_|sk-or-|hf_)/.test(key)) {
    return { attempt: { ...attempt, status: "invalid_key" } };
  }
  const endpoint = google
    ? `https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent`
    : model.provider === "groq"
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://api.mistral.ai/v1/chat/completions";
  const contents = [...history, { role: "user", content: message }].map((h) => ({
    role: h.role === "assistant" ? "model" : "user", parts: [{ text: h.content }],
  }));
  // Gemma accepts the instruction as prompt text rather than a systemInstruction.
  if (model.provider === "gemma") contents[0].parts[0].text = `${instruction}\n\n${contents[0].parts[0].text}`;
  const body = google ? {
    ...(model.provider === "gemini" ? { systemInstruction: { parts: [{ text: instruction }] } } : {}),
    contents,
    generationConfig: { temperature: 0.5, maxOutputTokens: 2048 },
  } : {
    model: model.id,
    messages: [{ role: "system", content: instruction }, ...history, { role: "user", content: message }],
    temperature: 0.5, max_tokens: 2048,
  };
  const controller = new AbortController();
  // Cover response-body consumption as well as the initial response headers.
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(endpoint, {
      method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json", ...(google ? { "x-goog-api-key": key } : { Authorization: `Bearer ${key}` }) },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      let status = failureStatus(response.status);
      // Classify known machine-readable reasons without exposing raw provider errors.
      try {
        const data = await response.json();
        const reasons = [data.error?.code, data.error?.status,
          ...(Array.isArray(data.error?.details) ? data.error.details.map((d: { reason?: unknown }) => d.reason) : [])];
        if (reasons.some((r) => ["API_KEY_INVALID", "invalid_api_key"].includes(r))) status = "invalid_key";
        if (reasons.some((r) => ["model_not_found", "model_decommissioned", "NOT_FOUND"].includes(r))) status = "model_unavailable";
      } catch { /* HTTP status remains sufficient for non-JSON errors. */ }
      // Do not log raw response bodies: they can echo keys or student prompts.
      return { attempt: { ...attempt, status, httpStatus: response.status } };
    }
    const data = await response.json();
    const text = google
      ? (data.candidates?.[0]?.content?.parts || [])
          .filter((p: { thought?: boolean; text?: unknown }) => !p.thought && typeof p.text === "string")
          .map((p: { text: string }) => p.text).join("\n").trim()
      : openAIText(data.choices?.[0]?.message?.content);
    if (!text) return { attempt: { ...attempt, status: "empty_response" } };
    const reportedId = google ? data.modelVersion : data.model;
    const modelId = typeof reportedId === "string" && reportedId.length < 160 ? reportedId : model.id;
    return {
      result: { text, model: model.name, modelId, provider: model.provider },
      attempt: { ...attempt, status: "ok" },
    };
  } catch {
    return { attempt: { ...attempt, status: controller.signal.aborted ? "timeout" : "network_error" } };
  } finally {
    clearTimeout(timer);
  }
}

export async function runCoach(
  requested: CoachModel, keys: ApiKeys, history: ChatMessage[], message: string, instruction: string,
  options: { fetcher?: typeof fetch; now?: () => number; totalMs?: number; attemptMs?: number } = {},
) {
  const now = options.now || Date.now;
  const deadline = now() + (options.totalMs ?? 14500);
  const attempts: Attempt[] = [];
  // Reserve time for a known, configured backup on another provider.
  const backups = [COACH_MODELS[1], COACH_MODELS[0], COACH_MODELS[4], COACH_MODELS[5]];
  const backup = backups.find((m) => m.provider !== requested.provider && keys[m.provider]);
  const plan = backup ? [requested, backup] : [requested];
  for (const model of plan) {
    const remaining = deadline - now();
    if (remaining < 250) break;
    const out = await callModel(model, keys[model.provider], history, message, instruction,
      Math.min(options.attemptMs ?? 6500, remaining), options.fetcher || fetch);
    attempts.push(out.attempt);
    if (out.result) return { ...out.result, requestedModelId: requested.id, fallback: model.id !== requested.id, attempts };
  }
  return { requestedModelId: requested.id, attempts };
}
