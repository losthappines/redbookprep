import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const { message, model = "gemini-2.5-flash", effort = "Medium", history = [] } = await req.json();

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
Tone: Encouraging, rigorous, clear, concise, and pedagogical. Break down difficult problems step-by-step using first principles. Use formatting, bullet points, and LaTeX-style math formulas (e.g. $y = mx + b$, $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$) when helpful.
Keep advice practical for SAT timing and test-taking strategies.`;

    if (!apiKey) {
      // Friendly fallback mode when GEMINI_API_KEY is not yet added in Vercel
      return NextResponse.json({
        reply: `Hello! I'm **redCoach**, your Digital SAT AI companion on RedBookPrep.

I'm ready to walk you through math problems, grammar rules, transition questions, and pacing strategies!

> **Note for the developer:** To enable live responses from Google's free Gemini API, please add your free **\`GEMINI_API_KEY\`** in **Vercel → Settings → Environment Variables** (get a free key at [aistudio.google.com](https://aistudio.google.com)).

Here is a quick breakdown of your question:
- **Topic:** SAT Test Preparation & Strategy
- **Core Tip:** Always identify the given constraints first, eliminate obviously incorrect choices, and plug in values or use Desmos graphing whenever algebra gets complicated!`,
        model: "redCoach (Demo / API Key needed)",
      });
    }

    // Call Google Gemini API (gemini-2.5-flash is free on Google AI Studio)
    const geminiModel = model.toLowerCase().includes("gemini") ? "gemini-2.5-flash" : "gemini-2.5-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;

    const formattedContents = [
      {
        role: "user",
        parts: [{ text: `[System Instruction: ${systemInstruction}]` }],
      },
      ...history.map((h: ChatMessage) => ({
        role: h.role === "assistant" ? "model" : "user",
        parts: [{ text: h.content }],
      })),
      {
        role: "user",
        parts: [{ text: `(Effort level: ${effort}) ${message}` }],
      },
    ];

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: formattedContents,
        generationConfig: {
          temperature: effort === "Max Effort" ? 0.3 : 0.7,
          maxOutputTokens: effort === "Low" ? 500 : 1500,
        },
      }),
    });

    if (!response.ok) {
      const errData = await response.text();
      console.error("Gemini API error:", errData);
      return NextResponse.json(
        { error: "Could not generate response from Gemini.", details: errData },
        { status: 502 }
      );
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const replyText = candidate?.content?.parts?.[0]?.text || "I was unable to generate an answer. Please try again.";

    return NextResponse.json({ reply: replyText, model: geminiModel });
  } catch (error: any) {
    console.error("Error in /api/chat:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
