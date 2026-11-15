import { GoogleGenAI, Modality, Type } from "@google/genai";
import { NextResponse } from "next/server";
import { GEMINI_LIVE_MODEL, MATCH_CONTEXT } from "@/lib/dynads/config";

export const runtime = "nodejs";
export async function POST() {
  if (!process.env.GEMINI_API_KEY) return NextResponse.json(
    { error: "GEMINI_API_KEY is not configured" }, { status: 503 });
  const config = {
    responseModalities: [Modality.AUDIO], systemInstruction: MATCH_CONTEXT,
    tools: [{ functionDeclarations: [{
      name: "trigger_ad", description: "Report a goal scorer visibly celebrating.",
      parameters: { type: Type.OBJECT, properties: {
        event: { type: Type.STRING, enum: ["goal"] },
        player_name: { type: Type.STRING }, jersey_number: { type: Type.INTEGER },
        team: { type: Type.STRING }, confidence: { type: Type.NUMBER },
        evidence: { type: Type.STRING, description: "Brief observable evidence: jersey, scoreboard or celebration. No internal reasoning." },
      }, required: ["event", "player_name", "jersey_number", "team", "confidence"] },
    }] }],
  };
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { apiVersion: "v1beta" } });
    const token = await ai.authTokens.create({ config: {
      uses: 1, expireTime: new Date(Date.now() + 10 * 60_000).toISOString(),
      newSessionExpireTime: new Date(Date.now() + 60_000).toISOString(),
      liveConnectConstraints: { model: GEMINI_LIVE_MODEL, config },
    } });
    return NextResponse.json({ token: token.name, model: GEMINI_LIVE_MODEL, config },
      { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Gemini Live token failed. Check API access and quota." }, { status: 502 });
  }
}
