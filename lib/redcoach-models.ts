export type Provider = "gemini" | "groq" | "mistral" | "gemma";

// Keep UI labels and provider IDs together; never label a fallback as the requested model.
export const COACH_MODELS = [
  { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash", provider: "gemini", envVar: "GEMINI_API_KEY", badge: "Default", desc: "SAT explanations and study strategies" },
  { id: "openai/gpt-oss-20b", name: "Groq · GPT-OSS 20B", provider: "groq", envVar: "GROQ_API_KEY", badge: "Fast", desc: "Quick algebra and grammar checks" },
  { id: "openai/gpt-oss-120b", name: "Groq · GPT-OSS 120B", provider: "groq", envVar: "GROQ_API_KEY", badge: "Reasoning", desc: "Multi-step math and passage reasoning" },
  { id: "mistral-large-latest", name: "Mistral Large", provider: "mistral", envVar: "MISTRAL_API_KEY", badge: "Flagship", desc: "Rhetoric, transitions and multi-step math" },
  { id: "mistral-small-latest", name: "Mistral Small", provider: "mistral", envVar: "MISTRAL_API_KEY", badge: "Fast", desc: "Punctuation and quick concept drills" },
  { id: "gemma-4-31b-it", name: "Gemma 4 31B", provider: "gemma", envVar: "GEMMA_API_KEY", badge: "Open weights", desc: "SAT tutoring through Google AI Studio" },
] as const;

export type CoachModel = (typeof COACH_MODELS)[number];
const LEGACY_MODELS: Record<string, string> = {
  "Gemini 3.5 Flash": "gemini-3.8-flash",
  "Groq · Llama 3.3 70B": "openai/gpt-oss-20b",
  "Groq · Llama 4 Maverick": "openai/gpt-oss-120b",
  "Gemma 3 27B": "gemma-4-31b-it",
};
export function resolveModel(value: string): CoachModel | undefined {
  const id = LEGACY_MODELS[value] || value;
  return COACH_MODELS.find((m) => m.id === id || m.name === id);
}

export type Attempt = {
  modelId: string;
  provider: Provider;
  status: "ok" | "missing_key" | "invalid_key" | "access_denied" | "rate_limited" | "model_unavailable" | "bad_request" | "upstream_error" | "timeout" | "network_error" | "empty_response";
  httpStatus?: number;
};

export const FAILURE_MESSAGES: Record<Exclude<Attempt["status"], "ok">, string> = {
  missing_key: "No API key is configured.",
  invalid_key: "The provider rejected the API key.",
  access_denied: "The provider denied access. Check model permissions and account access.",
  rate_limited: "The provider's rate or quota limit was reached.",
  model_unavailable: "This model is unavailable for the configured endpoint or account.",
  bad_request: "The provider rejected the request. Check the model configuration.",
  upstream_error: "The provider returned a service error.",
  timeout: "The provider did not respond within the time limit.",
  network_error: "The provider could not be reached.",
  empty_response: "The provider returned no visible answer.",
};
