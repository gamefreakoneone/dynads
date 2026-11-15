import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { ORBIS_PROMPT_MODEL } from "@/lib/orbis-prompt";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (body?.team !== "South Africa" || body?.year !== 2010) {
    return NextResponse.json({ error: "This demo supports South Africa, 2010." }, { status: 400 });
  }
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 503 });
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: ORBIS_PROMPT_MODEL,
      contents: "Search the web for sponsors of South Africa's men's football team (Bafana Bafana) in 2010. Prefer SAFA, sponsor announcements, and FIFA sources. In under 100 words name sponsors with evidence relevant to 2010. Explicitly distinguish team sponsors from FIFA World Cup sponsors and individual player endorsements. Is Coca-Cola evidenced as a team sponsor or only a tournament sponsor? Do not infer a player endorsement. If historical evidence is unclear say so. Use plain text, with source citation numbers if available.",
      config: { tools: [{ googleSearch: {} }], temperature: 0.1, maxOutputTokens: 1500,
        thinkingConfig: { thinkingBudget: 0 },
        httpOptions: { timeout: 25000 } },
    });
    const grounding = response.candidates?.[0]?.groundingMetadata;
    const sources = (grounding?.groundingChunks || []).flatMap(chunk => {
      const web = chunk.web;
      return web?.uri && /^https?:\/\//.test(web.uri) ? [{ title: web.title || "Source", url: web.uri }] : [];
    });
    if (!sources.length || !response.text) return NextResponse.json(
      { error: "Search returned no cited sponsor evidence. Using the configured demo campaign." }, { status: 502 });
    return NextResponse.json({ summary: response.text, sources,
      queries: grounding?.webSearchQueries || [],
      searchSuggestions: grounding?.searchEntryPoint?.renderedContent || "",
      team: "South Africa", year: 2010,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Sponsor research unavailable. Using the configured demo campaign." }, { status: 502 });
  }
}
