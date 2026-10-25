import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY;

  if (!apiKey) return NextResponse.json({ error: "No API key configured." });

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
Tone: Encouraging, rigorous, clear, concise, and pedagogical. Break down difficult problems step-by-step using first principles. Use formatting, bullet points, and LaTeX-style math formulas (e.g. $y = mx + b$) when helpful.
Keep advice practical for SAT timing and test-taking strategies.`;

    if (!apiKey) {
      return NextResponse.json({
        reply: `Hello! I'm **redCoach**, your Digital SAT AI companion on RedBookPrep.

I'm ready to walk you through math problems, grammar rules, transition questions, and pacing strategies!

> **Note for the developer:** Please add your free **\`GEMINI_API_KEY\`** in **Vercel → Settings → Environment Variables** (get a free key at [aistudio.google.com](https://aistudio.google.com)).`,
        model: "redCoach (Demo / API Key needed)",
      });
    }

    // Try gemini-1.5-pro, gemini-1.5-flash-latest, or query the list
    let targetModel = "gemini-1.5-flash-latest";
    try {
      const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (listRes.ok) {
        const listData = await listRes.json();
        const available = (listData.models || [])
          .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
          .map((m: any) => m.name.replace(/^models\//, ""));

        if (available.length > 0) {
          // Prefer flash models, then any available content-generation model
          const flash = available.find((m: string) => m.includes("flash") && !m.includes("8b"));
          targetModel = flash || available[0];
        }
      }
    } catch {}

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

    const formattedContents = [
      ...history.map((h: any) => ({
        role: h.role === "assistant" ? "model" : "user",
        parts: [{ text: h.content }],
      })),
      {
        role: "user",
        parts: [{ text: `(Effort level: ${effort})\n${message}` }],
      },
    ];

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
    });

    if (!response.ok) {
      const errData = await response.text();
      console.error("Gemini API error:", errData);
      return NextResponse.json(
        { error: "Could not generate response from Gemini.", details: errData, attemptedModel: targetModel },
        { status: 502 }
      );
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const replyText =
      candidate?.content?.parts?.[0]?.text || "I was unable to generate an answer. Please try again.";

    return NextResponse.json({ reply: replyText, model: targetModel });
  } catch (error: any) {
    console.error("Error in /api/chat:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
