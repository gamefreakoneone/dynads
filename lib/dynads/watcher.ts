import { GoogleGenAI, type Session } from "@google/genai";
import { validTrigger, type AdTrigger } from "./config";

/** Observation only: callers can later wire onTrigger into the ad coordinator. */
export async function startWatcher(video: HTMLVideoElement, signal: AbortSignal,
  log: (text: string) => void, onTrigger: (trigger: AdTrigger) => void,
  onStatus?: (status: "connected" | "closed" | "error") => void) {
  const response = await fetch("/api/gemini-token", { method: "POST", signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Gemini token failed");
  const ai = new GoogleGenAI({ apiKey: data.token, httpOptions: { apiVersion: "v1alpha" } });
  let session: Session | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let reported = false;
  const stop = () => { clearInterval(timer); session?.close(); };
  signal.addEventListener("abort", stop, { once: true });
  session = await ai.live.connect({ model: data.model, config: data.config, callbacks: {
    onopen: () => { log("Gemini observer connected"); onStatus?.("connected"); },
    onerror: () => { log("Gemini observer error; timed cue remains active"); onStatus?.("error"); },
    onclose: () => { clearInterval(timer); log("Gemini observer closed"); onStatus?.("closed"); },
    onmessage: (message) => {
      for (const call of message.toolCall?.functionCalls || []) {
        const valid = call.name === "trigger_ad" && validTrigger(call.args);
        if (valid && !reported) { reported = true; onTrigger(call.args as AdTrigger); }
        session?.sendToolResponse({ functionResponses: [{ id: call.id, name: call.name,
          response: { result: valid ? "Observed; timed cue controls demo" : "Invalid trigger arguments" } }] });
      }
    },
  } });
  if (signal.aborted) { stop(); return; }
  const canvas = document.createElement("canvas");
  canvas.width = 640; canvas.height = 360;
  let previousTime = -1;
  let frames = 0;
  timer = setInterval(() => {
    if (video.paused || video.ended || video.readyState < 2 || video.currentTime === previousTime) return;
    previousTime = video.currentTime;
    try {
      canvas.getContext("2d")!.drawImage(video, 0, 0, 640, 360);
      session?.sendRealtimeInput({ video: { mimeType: "image/jpeg", data: canvas.toDataURL("image/jpeg", 0.65).split(",")[1] } });
      if (++frames % 5 === 0) session?.sendClientContent({ turns: [{ role: "user", parts: [{ text: "Review the recent frames. If the scorer is visibly celebrating, call trigger_ad. Otherwise keep observing." }] }], turnComplete: true });
    } catch { log("Gemini frame send failed"); stop(); }
  }, 1000);
}
