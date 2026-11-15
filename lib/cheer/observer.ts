import { GoogleGenAI, type Session } from "@google/genai";
import { isMovementReport, type MovementReport } from "./energy";

export async function observeCheering(video: HTMLVideoElement, signal: AbortSignal,
  onReport: (report: MovementReport) => void, onState: (state: string) => void) {
  const response = await fetch("/api/cheer-token", { method: "POST", signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Observer token failed");
  signal.throwIfAborted();
  let session: Session | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let pending = false;
  let requestedAt = 0;
  let lastReport = 0;
  let closed = false;
  const close = () => { closed = true; clearInterval(timer); session?.close(); };
  signal.addEventListener("abort", close, { once: true });
  try {
    const ai = new GoogleGenAI({ apiKey: data.token, httpOptions: { apiVersion: "v1alpha" } });
    session = await ai.live.connect({ model: data.model, config: data.config, callbacks: {
      onopen: () => onState("Watching your movement"),
      onerror: () => onState("Observer interrupted — stop and reconnect"),
      onclose: () => { closed = true; clearInterval(timer); if (!signal.aborted) onState("Observer disconnected — stop and reconnect"); },
      onmessage: message => {
        if (closed || signal.aborted) return;
        for (const call of message.toolCall?.functionCalls || []) {
          const valid = call.name === "report_movement" && isMovementReport(call.args);
          // One report per assessment; duplicate callbacks cannot inflate energy.
          if (valid && pending && performance.now() - lastReport >= 1500) {
            lastReport = performance.now(); pending = false;
            onReport(call.args as MovementReport);
          }
          session?.sendToolResponse({ functionResponses: [{ id: call.id, name: call.name,
            response: { result: valid ? "Movement recorded" : "Invalid movement report" } }] });
        }
        if (message.serverContent?.turnComplete) pending = false;
      },
    } });
    if (signal.aborted || closed) { close(); return; }
    const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 360;
    let frames = 0;
    timer = setInterval(() => {
      if (video.readyState < 2 || video.paused || closed) return;
      try {
        canvas.getContext("2d")!.drawImage(video, 0, 0, 640, 360);
        session!.sendRealtimeInput({ video: { mimeType: "image/jpeg", data: canvas.toDataURL("image/jpeg", 0.65).split(",")[1] } });
        if (++frames >= 2 && (!pending || performance.now() - requestedAt > 8000)) {
          pending = true; requestedAt = performance.now(); frames = 0;
          session!.sendClientContent({ turns: [{ role: "user", parts: [{ text: "Assess movement across the latest frames now. Call report_movement, even if still or no person is visible." }] }], turnComplete: true });
        }
      } catch { onState("Camera frame delivery failed — stop and reconnect"); close(); }
    }, 1000);
  } catch (error) { close(); signal.removeEventListener("abort", close); throw error; }
}
