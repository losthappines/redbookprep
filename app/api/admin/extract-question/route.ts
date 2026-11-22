import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

function cleanKey(val?: string | null): string {
  if (!val || typeof val !== 'string') return '';
  return val.trim().replace(/^["']|["']$/g, '').trim();
}

const EXTRACTION_PROMPT = `You are an expert Digital SAT curriculum engineer converting cropped Mathbook 3.0 PNG images into clean, native Digital SAT JSON.
Inspect the image carefully and extract ALL math text, equations, answer choices, and any geometric/coordinate figures.

Return ONLY valid JSON with this exact shape (no markdown fences):
{
  "questionType": "mcq" | "spr",
  "passage": "string (optional context before the stem, using $...$ for inline LaTeX)",
  "prompt": "string (exact question stem using $...$ for inline LaTeX and $$...$$ for display equations)",
  "options": ["string", "string", "string", "string"],
  "answer": 0,
  "sprAnswers": ["string"],
  "svgDiagram": "string (if the image contains a geometric figure, graph, scatterplot, or table, generate a clean minimal responsive <svg viewBox='0 0 360 240' ...> with stroke='currentColor' and crisp labels; otherwise empty string '')",
  "difficulty": 3,
  "desmosExpressions": ["string (Desmos-compatible calculator expressions to solve/verify)"],
  "explanation": "string (clear worked solution using $...$)",
  "explanationMethods": [
    {
      "title": "Algebraic Method",
      "badge": "Core",
      "steps": ["step 1", "step 2", "step 3"]
    },
    {
      "title": "Desmos Shortcut",
      "badge": "Fastest",
      "steps": ["step 1", "step 2"],
      "desmosExpressions": ["y=..."]
    }
  ]
}`;

export async function POST(req: NextRequest) {
  const geminiKey = cleanKey(
    process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      process.env.GOOGLE_AI_API_KEY
  );
  if (!geminiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY is not configured on the server.' },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const { imageDataUrl, promptHint, moduleTitle, domain, answerHint, sprAnswersHint } = body || {};
    if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Valid base64 imageDataUrl is required.' }, { status: 400 });
    }

    const match = imageDataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
    if (!match) {
      return NextResponse.json({ error: 'Unsupported data URL image format.' }, { status: 400 });
    }
    const [, mimeType, base64Data] = match;

    const hintContext = [
      domain ? `Domain: ${domain}` : '',
      moduleTitle ? `Skill/Module: ${moduleTitle}` : '',
      promptHint ? `Existing prompt hint: ${promptHint}` : '',
      typeof answerHint === 'number' ? `Known MCQ answer index (0=A..3=D): ${answerHint}` : '',
      Array.isArray(sprAnswersHint) && sprAnswersHint.length
        ? `Known SPR accepted answers: ${sprAnswersHint.join(', ')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
        geminiKey
      )}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: `${EXTRACTION_PROMPT}\n\nMetadata hints:\n${hintContext}` },
                { inlineData: { mimeType, data: base64Data } },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.15,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: `Gemini Vision error (${res.status}): ${errText.slice(0, 240)}` },
        { status: 502 }
      );
    }

    const payload = await res.json();
    const rawText = payload?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleaned = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    const extracted = JSON.parse(cleaned);
    return NextResponse.json({ extracted });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Could not extract native question from image.' },
      { status: 500 }
    );
  }
}
