import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const { message, model = "gemini-3.8-flash", effort = "Medium", history = [] } = await req.json();

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
      return NextResponse.json({
        reply: `Hello! I'm **redCoach**, your Digital SAT AI companion on RedBookPrep.

I'm ready to walk you through math problems, grammar rules, transition questions, and pacing strategies!

> **Note for the developer:** To enable live responses from Google's free Gemini API, please add your free **\`GEMINI_API_KEY\`** in **Vercel → Settings → Environment Variables** (get a free key at [aistudio.google.com](https://aistudio.google.com)).`,
        model: "redCoach (Demo / API Key needed)",
      });
    }

    // Call Google Gemini API (gemini-3.8-flash / gemini-2.0-flash / gemini-1.5-flash fallback)
    const supportedModels = [
      "gemini-3.8-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
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
    let chosenModel = "gemini-3.8-flash";

    for (const m of supportedModels) {
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
      });

      if (response.ok) {
        data = await response.json();
        chosenModel = m;
        break;
      } else {
        lastError = await response.text();
      }
    }

    if (!data) {
      console.error("Gemini API error across all models:", lastError);
      return NextResponse.json(
        { error: "Could not generate response from Gemini.", details: lastError },
        { status: 502 }
      );
    }

    const candidate = data.candidates?.[0];
    const replyText =
      candidate?.content?.parts?.[0]?.text || "I was unable to generate an answer. Please try again.";

    return NextResponse.json({ reply: replyText, model: chosenModel });
  } catch (error: any) {
    console.error("Error in /api/chat:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
