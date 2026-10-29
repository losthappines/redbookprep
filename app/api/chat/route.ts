import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

function sanitizeMathResponse(raw: string): string {
  return raw
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
     * Direct Contrast (comparing opposing facts or alternatives): "In contrast", "On the other hand", "Meanwhile".
       Example: The north ridge receives heavy snowfall. In contrast, the southern valley stays dry all winter.
     * Concession (an unexpected outcome happening despite the previous fact): "Nevertheless", "Nonetheless", "Still", "Even so".
       Example: The team had no funding and a tight deadline. Nevertheless, their prototype passed every test.
   - Give the student a simple test-day rule of thumb to decide between them.
3. For Math questions:
   - State the core rule/formula in 1 line.
   - Show 3-4 clean, bulleted solution steps.
   - Mention the 1-click Desmos trick if applicable.

CRITICAL FORMATTING RULES:
- Write math in clean plain text. Do not use LaTeX delimiters such as $, $$, \\(, or \\[, or commands such as \\frac, \\begin{cases}, or \\sqrt.
- Use Unicode symbols: ², ³, √, ×, ÷, −, ≠, ≤, ≥, π, ±.
- Write fractions as (numerator)/(denominator).
- Put equations on their own lines.`;

export async function GET(req: NextRequest) {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;

  return NextResponse.json({
    configured: {
      gemini: Boolean(geminiKey),
      openai: Boolean(openaiKey),
      anthropic: Boolean(anthropicKey),
      deepseek: Boolean(deepseekKey),
    },
    supportedModels: [
      "Gemini 3.5 Flash",
      "Gemini 2.5 Pro",
      "Claude 3.5 Sonnet",
      "GPT-4o",
      "GPT-4o Mini",
      "DeepSeek R1",
    ],
  });
}

// -------------------------------------------------------------
// Provider Callers
// -------------------------------------------------------------

async function callGemini(
  apiKey: string,
  modelName: string,
  history: ChatMessage[],
  message: string,
  effort: string
): Promise<{ text: string; model: string } | null> {
  const isPro = modelName.includes("Pro");
  const candidates = isPro
    ? ["gemini-1.5-pro", "gemini-2.5-pro", "gemini-3.5-flash"]
    : ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-flash-latest"];

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

  for (const m of candidates) {
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
            maxOutputTokens: 1200,
          },
        }),
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return { text, model: isPro ? "Gemini 2.5 Pro" : "Gemini 3.5 Flash" };
        }
      }
    } catch {}
  }
  return null;
}

async function callOpenAI(
  apiKey: string,
  modelId: string,
  history: ChatMessage[],
  message: string
): Promise<{ text: string; model: string } | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: "system", content: SYSTEM_INSTRUCTION },
          ...history.map((h) => ({ role: h.role, content: h.content })),
          { role: "user", content: message },
        ],
        temperature: 0.6,
        max_tokens: 1200,
      }),
      signal: AbortSignal.timeout(9000),
    });

    if (res.ok) {
      const json = await res.json();
      const text = json.choices?.[0]?.message?.content;
      if (text) {
        return { text, model: modelId === "gpt-4o" ? "GPT-4o" : "GPT-4o Mini" };
      }
    }
  } catch {}
  return null;
}

async function callClaude(
  apiKey: string,
  modelId: string,
  history: ChatMessage[],
  message: string
): Promise<{ text: string; model: string } | null> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: modelId,
        system: SYSTEM_INSTRUCTION,
        messages: [
          ...history.map((h) => ({ role: h.role, content: h.content })),
          { role: "user", content: message },
        ],
        max_tokens: 1200,
      }),
      signal: AbortSignal.timeout(9000),
    });

    if (res.ok) {
      const json = await res.json();
      const text = json.content?.[0]?.text;
      if (text) {
        return { text, model: "Claude 3.5 Sonnet" };
      }
    }
  } catch {}
  return null;
}

async function callDeepSeek(
  apiKey: string,
  history: ChatMessage[],
  message: string
): Promise<{ text: string; model: string } | null> {
  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-reasoner",
        messages: [
          { role: "system", content: SYSTEM_INSTRUCTION },
          ...history.map((h) => ({ role: h.role, content: h.content })),
          { role: "user", content: message },
        ],
        max_tokens: 1200,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const json = await res.json();
      const text = json.choices?.[0]?.message?.content;
      if (text) {
        return { text, model: "DeepSeek R1" };
      }
    }
  } catch {}
  return null;
}

// -------------------------------------------------------------
// POST Handler
// -------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const {
      message,
      effort = "Medium",
      history = [],
      model = "Gemini 3.5 Flash",
    } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const geminiKey =
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      process.env.GOOGLE_AI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const deepseekKey = process.env.DEEPSEEK_API_KEY;

    let result: { text: string; model: string } | null = null;
    let fallbackNotice = "";

    // 1. Anthropic Claude Request
    if (model.includes("Claude")) {
      if (anthropicKey) {
        result = await callClaude(anthropicKey, "claude-3-5-sonnet-20241022", history, message);
      } else {
        fallbackNotice =
          "> 💡 *Notice: `ANTHROPIC_API_KEY` is not yet added in Vercel settings. Using Gemini 3.5 Flash for this answer.* \n\n";
      }
    }
    // 2. OpenAI Request (GPT-4o or GPT-4o Mini)
    else if (model.includes("GPT")) {
      if (openaiKey) {
        const modelId = model.includes("Mini") ? "gpt-4o-mini" : "gpt-4o";
        result = await callOpenAI(openaiKey, modelId, history, message);
      } else {
        fallbackNotice =
          "> 💡 *Notice: `OPENAI_API_KEY` is not yet added in Vercel settings. Using Gemini 3.5 Flash for this answer.* \n\n";
      }
    }
    // 3. DeepSeek Request (DeepSeek R1)
    else if (model.includes("DeepSeek")) {
      if (deepseekKey) {
        result = await callDeepSeek(deepseekKey, history, message);
      } else {
        fallbackNotice =
          "> 💡 *Notice: `DEEPSEEK_API_KEY` is not yet added in Vercel settings. Using Gemini 3.5 Flash for this answer.* \n\n";
      }
    }

    // 4. Gemini or Fallback Provider
    if (!result && geminiKey) {
      result = await callGemini(geminiKey, model, history, message, effort);
    }

    // If still no result (e.g. no Gemini key configured either)
    if (!result) {
      if (!geminiKey) {
        return NextResponse.json({
          reply: `Hello! I'm **redCoach**, your Digital SAT AI companion on RedBookPrep.

I'm ready to walk you through math problems, grammar rules, transition questions, and pacing strategies!

> **Setup steps:** Please add your API key in **Vercel → Settings → Environment Variables**:
> - \`GEMINI_API_KEY\` (free at [aistudio.google.com](https://aistudio.google.com))
> - \`OPENAI_API_KEY\` (from [platform.openai.com](https://platform.openai.com))
> - \`ANTHROPIC_API_KEY\` (from [console.anthropic.com](https://console.anthropic.com))
> - \`DEEPSEEK_API_KEY\` (from [platform.deepseek.com](https://platform.deepseek.com))`,
          model: model || "Gemini 3.5 Flash",
        });
      }

      return NextResponse.json(
        { error: "Could not generate an AI response. Please try again in a moment." },
        { status: 502 }
      );
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
