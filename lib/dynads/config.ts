export const CAPTURE_SECONDS = 31;
export const INSERT_SECONDS = 47;
export const BEAT_CHUNKS = 4;
export const GEMINI_LIVE_MODEL = "gemini-3.8-live";

export const MATCH_CONTEXT = `South Africa vs Mexico, opening match of the 2010 World Cup.
South Africa wear yellow shirts and green shorts. Number 8 is Siphiwe Tshabalala,
11 is Teko Modise, 13 is Kagisho Dikgacoi. Determine whether a goal occurs from the supplied frames.
Use visible jersey numbers and scoreboard evidence, never facial recognition.
Observe only the frames supplied. Call trigger_ad once when you see the goal scorer
visibly celebrating with teammates. Include a short evidence field describing visible
jersey numbers, scoreboard changes or celebrations, not internal reasoning.
Report uncertainty honestly. Do not speak.`;

export const SPONSOR = {
  brand: "Coca-Cola", product: "Coca-Cola", slogan: "The winners drink Coca Cola",
  bottle: "a contoured glass Coca-Cola bottle with a red label",
};
export const FALLBACK_SPONSOR = {
  brand: "Orbit Cola", product: "Orbit Cola", slogan: "The winners drink Orbit Cola",
  bottle: "a glass Orbit Cola bottle with a red fictional-brand label",
};
export type Sponsor = typeof SPONSOR;
export type AdTrigger = {
  event: "goal"; player_name: string; jersey_number: number;
  team: string; confidence: number;
  evidence?: string;
};
export function validTrigger(value: unknown): value is AdTrigger {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.event === "goal" && typeof v.player_name === "string" &&
    typeof v.team === "string" && Number.isInteger(v.jersey_number) &&
    Number(v.jersey_number) > 0 && Number(v.jersey_number) < 100 &&
    typeof v.confidence === "number" && v.confidence >= 0 && v.confidence <= 1;
}
export function beatRequests(sponsor: Sponsor) {
  const scene = `Continue the reference frame in the same stadium and daylight.
Focus on the celebrating player wearing yellow jersey number 8, center-right,
beside teammates 11 and 13. Preserve his appearance and yellow/green uniform.
A stadium advertising backdrop reads "${sponsor.slogan}". Natural photorealistic motion.`;
  return [
    `${scene} Someone off-screen gently tosses ${sponsor.bottle} to number 8.
He catches it with one hand, smiling while his teammates dance. Medium-wide shot.`,
    `${scene} Number 8 now holds ${sponsor.bottle}. The camera slowly pushes in
to a close-up as he lifts the bottle, takes a sip and smiles. Keep the bottle visible.`,
  ];
}
