import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ClientApiKeys {
  gemini?: string;
  groq?: string;
  mistral?: string;
  gemma?: string;
}

function cleanKey(val?: string | null): string {
  if (!val || typeof val !== "string") return "";
  return val.trim().replace(/^["']|["']$/g, "").trim();
}

function sanitizeMathResponse(raw: string): string {
  return raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim()
    .replace(/\$\$/g, "")
    .replace(/\\\[|\\\]|\\\(|\\\)/g, "")
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "($1)/($2)")
    .replace(/\\sqrt\{([^{}]+)\}/g, "√($1)")
    .replace(/\\neq\b/g, "≠")
    .replace(/\\leq?\b/g, "≤")
    .replace(/\\geq?\b/g, "≥")
    .replace(/\\times\b/g, "×")
    .replace(/\\div\b/g, "÷")
    .replace(/\\pm\b/g, "±")
    .replace(/\\pi\b/g, "π")
    .replace(/\^2\b/g, "²")
    .replace(/\^3\b/g, "³")
    .replace(/\\begin\{cases\}([\s\S]*?)\\end\{cases\}/g, (_: string, body: string) =>
      body
        .split("\\\\")
        .map((s: string) => s.trim())
        .filter(Boolean)
        .join("\n")
    )
    .replace(/\$([^$\n]+)\$/g, "$1")
    .replace(/\$/g, "");
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
- Write math in clean plain text. Do not use LaTeX delimiters such as $, $$, \\(, or \\[, or commands such as \\frac, \\begin{cases}, or \\sqrt.
- Use Unicode symbols: ², ³, √, ×, ÷, −, ≠, ≤, ≥, π, ±.
- Write fractions as (numerator)/(denominator).
- Put equations on their own lines.`;

export async function GET() {
  const geminiKey = cleanKey(
    process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      process.env.GOOGLE_AI_API_KEY
  );
  const groqKey = cleanKey(process.env.GROQ_API_KEY);
  const mistralKey = cleanKey(process.env.MISTRAL_API_KEY);
  const gemmaKey = cleanKey(process.env.GEMMA_API_KEY);

  return NextResponse.json({
    configured: {
      gemini: Boolean(geminiKey),
      groq: Boolean(groqKey),
      mistral: Boolean(mistralKey),
      gemma: Boolean(gemmaKey || geminiKey),
    },
    supportedModels: [
      "Gemini 3.5 Flash",
      "Groq · Llama 3.3 70B",
      "Groq · Llama 4 Maverick",
      "Mistral Large",
      "Mistral Small",
      "Gemma 4 (31B)",
    ],
  });
}

// -------------------------------------------------------------
// Provider Callers (with strict deadline budget to avoid 502s)
// -------------------------------------------------------------

async function callGemini(
  apiKey: string,
  requestedLabel: string,
  history: ChatMessage[],
  message: string,
  effort: string,
  deadline: number
): Promise<{ text: string; model: string } | null> {
  const isPro = requestedLabel.includes("Pro");
  const candidates = isPro
    ? ["gemini-2.5-pro", "gemini-flash-latest"]
    : ["gemini-flash-latest", "gemini-2.5-flash", "gemini-3.5-flash"];

  const formattedContents = [
    ...history.map((h) => ({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.content }],
    })),
    {
      role: "user",
      parts: [{ text: `(Effort level: ${effort})\n${message}` }],
    },
  ];

  const displayLabel = isPro ? "Gemini 2.5 Pro" : "Gemini 3.5 Flash";

  for (const m of candidates) {
    const remaining = deadline - Date.now();
    if (remaining < 1500) break;

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents: formattedContents,
          generationConfig: {
            temperature: effort === "Max Effort" ? 0.3 : 0.6,
            maxOutputTokens: 1000,
          },
        }),
        signal: AbortSignal.timeout(Math.min(4500, remaining)),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return { text, model: displayLabel };
      } else if (res.status === 400 || res.status === 401 || res.status === 403) {
        // Invalid key or malformed request — fail fast
        break;
      }
    } catch {}
  }
  return null;
}

async function callGroq(
  apiKey: string,
  requestedLabel: string,
  history: ChatMessage[],
  message: string,
  deadline: number
): Promise<{ text: string; model: string } | null> {
  const isLlama4 = requestedLabel.includes("Llama 4") || requestedLabel.includes("Maverick");
  const candidates = isLlama4
    ? [
        "meta-llama/llama-4-maverick-17b-128e-instruct",
        "meta-llama/llama-4-scout-17b-16e-instruct",
        "llama-3.3-70b-versatile",
      ]
    : ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];

  const displayLabel = isLlama4 ? "Groq · Llama 4 Maverick" : "Groq · Llama 3.3 70B";

  const tryGroqModel = async (modelId: string): Promise<{ text?: string; authFail?: boolean }> => {
    const remaining = deadline - Date.now();
    if (remaining < 1500) return {};
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: "system", content: SYSTEM_INSTRUCTION },
            ...history.map((h) => ({
              role: h.role === "assistant" ? "assistant" : "user",
              content: h.content,
            })),
            { role: "user", content: message },
          ],
          temperature: 0.5,
          max_tokens: 1000,
        }),
        signal: AbortSignal.timeout(Math.min(5500, remaining)),
      });

      if (res.ok) {
        const json = await res.json();
        const text = json.choices?.[0]?.message?.content;
        if (text) return { text };
      } else if (res.status === 401 || res.status === 403) {
        return { authFail: true };
      }
    } catch {}
    return {};
  };

  for (const m of candidates) {
    const out = await tryGroqModel(m);
    if (out.text) return { text: out.text, model: displayLabel };
    if (out.authFail) return null;
  }

  // Dynamic fallback if hardcoded model snapshot was rotated
  if (deadline - Date.now() > 3000) {
    try {
      const modelsRes = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(2500),
      });
      if (modelsRes.ok) {
        const modelsJson = await modelsRes.json();
        const dynamicModel = (modelsJson.data || [])
          .map((d: any) => String(d.id || ""))
          .find(
            (id: string) =>
              id &&
              !id.includes("whisper") &&
              !id.includes("guard") &&
              !id.includes("tts") &&
              !id.includes("playai") &&
              !candidates.includes(id)
          );
        if (dynamicModel) {
          const out = await tryGroqModel(dynamicModel);
          if (out.text) return { text: out.text, model: displayLabel };
        }
      }
    } catch {}
  }

  return null;
}

async function callMistral(
  apiKey: string,
  requestedLabel: string,
  history: ChatMessage[],
  message: string,
  deadline: number
): Promise<{ text: string; model: string } | null> {
  const isSmall = requestedLabel.includes("Small");
  const candidates = isSmall
    ? ["mistral-small-latest", "mistral-large-latest"]
    : ["mistral-large-latest", "mistral-small-latest"];

  const displayLabel = isSmall ? "Mistral Small" : "Mistral Large";

  for (const m of candidates) {
    const remaining = deadline - Date.now();
    if (remaining < 1500) break;

    try {
      const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: m,
          messages: [
            { role: "system", content: SYSTEM_INSTRUCTION },
            ...history.map((h) => ({
              role: h.role === "assistant" ? "assistant" : "user",
              content: h.content,
            })),
            { role: "user", content: message },
          ],
          temperature: 0.5,
          max_tokens: 1000,
        }),
        signal: AbortSignal.timeout(Math.min(6500, remaining)),
      });

      if (res.ok) {
        const json = await res.json();
        const text = json.choices?.[0]?.message?.content;
        if (text) return { text, model: displayLabel };
      } else if (res.status === 401 || res.status === 403) {
        break;
      }
    } catch {}
  }

  return null;
}

async function callGemma(
  apiKey: string,
  requestedLabel: string,
  history: ChatMessage[],
  message: string,
  deadline: number
): Promise<{ text: string; model: string } | null> {
  const displayLabel = requestedLabel.includes("Gemma") ? requestedLabel : "Gemma 4 (31B)";

  // 1. OpenAI-compatible Gemma providers (Groq gsk_, OpenRouter sk-or-, HuggingFace hf_)
  if (apiKey.startsWith("gsk_") || apiKey.startsWith("sk-or-") || apiKey.startsWith("hf_")) {
    const endpoint = apiKey.startsWith("gsk_")
      ? "https://api.groq.com/openai/v1/chat/completions"
      : apiKey.startsWith("sk-or-")
      ? "https://openrouter.ai/api/v1/chat/completions"
      : "https://router.huggingface.co/v1/chat/completions";

    const modelCandidates = apiKey.startsWith("gsk_")
      ? ["gemma2-9b-it", "llama-3.3-70b-versatile"]
      : ["google/gemma-3-27b-it", "google/gemma-2-27b-it"];

    for (const m of modelCandidates) {
      const remaining = deadline - Date.now();
      if (remaining < 1500) break;
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: m,
            messages: [
              { role: "user", content: `${SYSTEM_INSTRUCTION}\n\nStudent question: ${message}` },
            ],
            temperature: 0.5,
            max_tokens: 1000,
          }),
          signal: AbortSignal.timeout(Math.min(6000, remaining)),
        });
        if (res.ok) {
          const json = await res.json();
          const text = json.choices?.[0]?.message?.content;
          if (text) return { text, model: displayLabel };
        } else if (res.status === 401 || res.status === 403) {
          break;
        }
      } catch {}
    }
    return null;
  }

  // 2. Google AI Studio / Generative Language API key (AIza...)
  const gemmaCandidates = ["gemma-4-31b-it", "gemma-3-27b-it", "gemma-3-12b-it"];

  const contextStr = history.length
    ? `\n\nRecent conversation:\n${history
        .map((h) => `${h.role === "assistant" ? "Coach" : "Student"}: ${h.content}`)
        .join("\n")}`
    : "";

  const contents = [
    {
      role: "user",
      parts: [{ text: `${SYSTEM_INSTRUCTION}${contextStr}\n\nStudent question: ${message}` }],
    },
  ];

  for (const m of gemmaCandidates) {
    const remaining = deadline - Date.now();
    if (remaining < 1500) break;
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 1000,
          },
        }),
        signal: AbortSignal.timeout(Math.min(5500, remaining)),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return { text, model: displayLabel };
      } else if (res.status === 401 || res.status === 403) {
        break;
      }
    } catch {}
  }

  return null;
}

// -------------------------------------------------------------
// POST Handler
// -------------------------------------------------------------

export async function POST(req: NextRequest) {
  // Keep total execution strictly under 15s so Cloudflare/Vercel Edge never 502s
  const deadline = Date.now() + 15000;

  try {
    const body = await req.json();
    const {
      message,
      effort = "Medium",
      history = [],
      model = "Gemini 3.5 Flash",
      apiKeys = {} as ClientApiKeys,
    } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const geminiKey = cleanKey(
      apiKeys.gemini ||
        process.env.GEMINI_API_KEY ||
        process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
        process.env.GOOGLE_AI_API_KEY
    );
    const groqKey = cleanKey(apiKeys.groq || process.env.GROQ_API_KEY);
    const mistralKey = cleanKey(apiKeys.mistral || process.env.MISTRAL_API_KEY);
    const explicitGemmaKey = cleanKey(apiKeys.gemma || process.env.GEMMA_API_KEY);
    const gemmaKey = explicitGemmaKey || geminiKey;

    let result: { text: string; model: string } | null = null;
    let fallbackNotice = "";

    // 1. Groq Request
    if (model.includes("Groq") || model.includes("Llama")) {
      if (groqKey) {
        result = await callGroq(groqKey, model, history, message, deadline);
        if (!result) {
          fallbackNotice =
            "Note: Groq could not complete this request right now (verify GROQ_API_KEY). Answering with backup coach:\n\n";
        }
      } else {
        fallbackNotice =
          "Note: Add GROQ_API_KEY in Vercel Environment Variables (or click 'API Keys' in the model menu) to activate Groq. Answering with backup coach:\n\n";
      }
    }
    // 2. Mistral Request
    else if (model.includes("Mistral")) {
      if (mistralKey) {
        result = await callMistral(mistralKey, model, history, message, deadline);
        if (!result) {
          fallbackNotice =
            "Note: Mistral could not complete this request right now (verify MISTRAL_API_KEY). Answering with backup coach:\n\n";
        }
      } else {
        fallbackNotice =
          "Note: Add MISTRAL_API_KEY in Vercel Environment Variables (or click 'API Keys' in the model menu) to activate Mistral. Answering with backup coach:\n\n";
      }
    }
    // 3. Gemma Request
    else if (model.includes("Gemma")) {
      if (gemmaKey) {
        result = await callGemma(gemmaKey, model, history, message, deadline);
        if (!result) {
          fallbackNotice =
            "Note: Gemma endpoint was unavailable with the current key. Answering with backup coach:\n\n";
        }
      } else {
        fallbackNotice =
          "Note: Add GEMMA_API_KEY in Vercel Environment Variables (or click 'API Keys' in the model menu) to activate Gemma. Answering with backup coach:\n\n";
      }
    }

    // 4. Primary Gemini or Automatic Cross-Provider Failover
    if (!result && geminiKey) {
      result = await callGemini(geminiKey, model, history, message, effort, deadline);
    }
    if (!result && groqKey && !model.includes("Groq")) {
      result = await callGroq(groqKey, "Groq · Llama 3.3 70B", history, message, deadline);
    }
    if (!result && mistralKey && !model.includes("Mistral")) {
      result = await callMistral(mistralKey, "Mistral Large", history, message, deadline);
    }
    if (!result && explicitGemmaKey && !model.includes("Gemma")) {
      result = await callGemma(explicitGemmaKey, "Gemma 4 (31B)", history, message, deadline);
    }

    if (!result) {
      if (!geminiKey && !groqKey && !mistralKey && !explicitGemmaKey) {
        return NextResponse.json({
          reply: `Hello! I'm redCoach, your Digital SAT AI companion on RedBookPrep.

To activate your models, add your keys in Vercel -> Settings -> Environment Variables (or paste them under 'API Keys' in the Sparkles model menu):
- GROQ_API_KEY (Groq LPU)
- MISTRAL_API_KEY (Mistral AI)
- GEMMA_API_KEY (Google AI Studio / Gemma)
- GEMINI_API_KEY (Google Gemini)`,
          model: model || "redCoach Setup",
        });
      }

      return NextResponse.json({
        reply:
          "The selected AI provider is momentarily rate-limited or unreachable. Try switching to Groq, Mistral, Gemma, or Gemini in the Sparkles model menu, or verify your API key!",
        model: model || "redCoach",
      });
    }

    const cleanedText = fallbackNotice + sanitizeMathResponse(result.text);

    return NextResponse.json({
      reply: cleanedText,
      model: result.model,
    });
  } catch (error: any) {
    console.error("Error in /api/chat:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
