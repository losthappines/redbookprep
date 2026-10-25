import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function GET(req: NextRequest) {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY;

  if (!apiKey) return NextResponse.json({ error: "No API key configured." });

  const url = new URL(req.url);
  const testModel = url.searchParams.get("testModel");

  if (testModel) {
    const t0 = Date.now();
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${testModel}:generateContent?key=${apiKey}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Hello, reply 'OK' in one word." }] }],
        }),
        signal: AbortSignal.timeout(6000),
      });
      const durationMs = Date.now() - t0;
      const text = await res.text();
      return NextResponse.json({
        model: testModel,
        status: res.status,
        durationMs,
        response: text.slice(0, 500),
      });
    } catch (err: any) {
      return NextResponse.json({
        model: testModel,
        error: err.name === "TimeoutError" ? "Timeout after 6s" : err.message,
        durationMs: Date.now() - t0,
      });
    }
  }

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { message, effort = "Medium", history = [] } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      process.env.GOOGLE_AI_API_KEY;

    // RedCoach SAT Tutor system instructions
    const systemInstruction = `You are "redCoach", the AI SAT test preparation coach for RedBookPrep (https://www.redbookprep.site).
Your job is to help students excel on the Digital SAT (Math: Algebra, Advanced Math, Problem-Solving and Data Analysis, Geometry & Trigonometry; and Reading & Writing: Craft & Structure, Information & Ideas, Expression of Ideas, Standard English Conventions).
Tone: Encouraging, clear, concise, and pedagogical. Break down problems step-by-step using first principles and keep advice practical for SAT timing and test-taking strategies.

CRITICAL FORMATTING RULES:
Write math in readable plain text. Do not use LaTeX delimiters such as $, $$, \\(, or \\[, or commands such as \\frac or \\sqrt.
Use Unicode symbols when helpful: ², ³, √, ×, ÷, −, ≠, ≤, ≥, π, and ±.
Write fractions as (numerator)/(denominator).
Put longer equations on their own line.
Use short explanations and avoid excessive formatting.

Example math output:
(x − 3)² + (y + 2)² = 25
Center: (3, −2)
Radius: √25 = 5`;

    if (!apiKey) {
      return NextResponse.json({
        reply: `Hello! I'm **redCoach**, your Digital SAT AI companion on RedBookPrep.

I'm ready to walk you through math problems, grammar rules, transition questions, and pacing strategies!

> **Note for the developer:** Please add your free **\`GEMINI_API_KEY\`** in **Vercel → Settings → Environment Variables** (get a free key at [aistudio.google.com](https://aistudio.google.com)).`,
        model: "redCoach (Demo / API Key needed)",
      });
    }

    // Google's active generation models in tested performance & availability order:
    // 1. gemini-3.5-flash: ~1.6s latency, 200 OK
    // 2. gemini-3.5-flash-lite: ~1.4s latency, 200 OK
    // 3. gemini-flash-latest / 3.8-flash: Fallbacks when available
    const priorityModels = [
      "gemini-3.5-flash",
      "gemini-3.5-flash-lite",
      "gemini-flash-latest",
      "gemini-3.8-flash",
    ];

    const formattedContents = [
      ...history.map((h: ChatMessage) => ({
        role: h.role === "assistant" ? "model" : "user",
        parts: [{ text: h.content }],
      })),
      {
        role: "user",
        parts: [{ text: `(Effort level: ${effort})\n${message}` }],
      },
    ];

    let lastError = "";
    let data: any = null;
    let successfulModel = "";

    for (const m of priorityModels) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemInstruction }],
            },
            contents: formattedContents,
            generationConfig: {
              temperature: effort === "Max Effort" ? 0.3 : 0.7,
              maxOutputTokens: effort === "Low" ? 600 : 1800,
            },
          }),
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          data = await response.json();
          successfulModel = m;
          break;
        } else {
          lastError = await response.text();
        }
      } catch (err: any) {
        lastError = err.message;
      }
    }

    if (!data) {
      console.error("Gemini API error across priority models:", lastError);
      return NextResponse.json(
        { error: "Could not generate response from Gemini.", details: lastError },
        { status: 502 }
      );
    }

    const candidate = data.candidates?.[0];
    const rawReply =
      candidate?.content?.parts?.[0]?.text || "I was unable to generate an answer. Please try again.";

    // Clean any stray LaTeX delimiters/commands into readable Unicode plain text
    const replyText = rawReply
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

    return NextResponse.json({ reply: replyText, model: successfulModel });
  } catch (error: any) {
    console.error("Error in /api/chat:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
