export type MovementReport = { intensity: number; person_visible: boolean; observation: string };
export type CheerStage = "tired" | "waking" | "energized" | "jumping" | "running";
export function isMovementReport(value: unknown): value is MovementReport {
  if (!value || typeof value !== "object") return false;
  const report = value as Record<string, unknown>;
  return typeof report.intensity === "number" && Number.isFinite(report.intensity) &&
    report.intensity >= 0 && report.intensity <= 100 && typeof report.person_visible === "boolean" &&
    typeof report.observation === "string" && report.observation.length <= 400;
}
export function nextEnergy(current: number, report: MovementReport): number {
  if (!report.person_visible || report.intensity < 20) return Math.max(0, current - 10);
  return Math.min(100, current + Math.min(18, (report.intensity - 15) / 4));
}
export function stageForEnergy(energy: number, intensity: number): CheerStage {
  if (energy >= 85 && intensity >= 70) return "jumping";
  if (energy >= 55) return "energized";
  if (energy >= 25) return "waking";
  return "tired";
}
export function nextStageAtChunk(current: CheerStage, energy: number, intensity: number,
  chunksInStage: number): CheerStage | "complete" {
  if (current === "running") return chunksInStage >= 5 ? "complete" : current;
  if (current === "jumping") return chunksInStage >= 3 ? "running" : current;
  if (chunksInStage < 2) return current;
  const stages: CheerStage[] = ["tired", "waking", "energized", "jumping"];
  const wanted = stages.indexOf(stageForEnergy(energy, intensity));
  return stages[Math.min(wanted, stages.indexOf(current) + 1)];
}

const SCENE = `A continuous photorealistic shot of the South African football team
from the reference image on the same stadium pitch in daylight. Keep the same
players, yellow jerseys and green shorts, especially number 8 with teammates
11 and 13. Full bodies remain visible. Camera holds a steady wide framing.
No bottles, drinks, advertising scenes, new people or cuts.`;
export const CHEER_PROMPTS: Record<CheerStage, string> = {
  tired: `${SCENE} The celebration has exhausted the team. They slowly settle down,
    shoulders sagging, hands resting on knees, breathing heavily. They stay in place,
    looking toward the crowd, tired and waiting for encouragement. Subtle motion.`,
  waking: `${SCENE} The team hears encouraging cheers. The tired players straighten
    their backs, lift their heads and smile toward the crowd. Number 8 claps slowly
    and encourages his teammates. They are recovering energy but stay on the spot.`,
  energized: `${SCENE} The crowd's encouragement energizes the team. Number 8 and
    his teammates bounce lightly on their feet, pump their fists, clap overhead and
    dance together. Their movements become energetic. They remain fully in frame.`,
  jumping: `${SCENE} The team bursts into a joyful victory celebration. Number 8
    and his teammates jump repeatedly together, landing naturally on the grass,
    throwing their arms up and cheering. Show full-body jumps, keeping the team in frame.`,
  running: `${SCENE} Still energized from their jumps, all the players turn to their
    right and sprint together toward the right edge of the image. Their feet run
    naturally on the grass. They run completely off-screen to the right. The camera
    stays fixed on the now empty pitch. Do not follow them or bring them back.`,
};
export const STAGE_LABELS: Record<CheerStage, string> = {
  tired: "They need you", waking: "Finding their second wind", energized: "The team feels it",
  jumping: "You brought them back!", running: "Unstoppable",
};
