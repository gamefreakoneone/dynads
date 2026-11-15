"use client";

import { ReactorProvider, ReactorView, useReactor, useReactorMessage } from "@reactor-team/js-sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import { useOrbisSession } from "@/hooks/use-orbis-session";
import { ORBIS_MODEL_NAME, ORBIS_TRACKS, requestReactorJwt, unwrapOrbisMessage } from "@/lib/orbis";
import { CHEER_PROMPTS, STAGE_LABELS, nextEnergy, nextStageAtChunk, type CheerStage, type MovementReport } from "@/lib/cheer/energy";
import { observeCheering } from "@/lib/cheer/observer";
import styles from "./cheer.module.css";

const REFERENCE = "/demo/celebration-31s.png";
const STAGES: CheerStage[] = ["tired", "waking", "energized", "jumping", "running"];

export function CheerExperience() {
  const jwt = useRef<string | null>(null);
  const pending = useRef<Promise<string> | null>(null);
  const getJwt = useCallback(async () => {
    try { return jwt.current = await (pending.current ??= requestReactorJwt()); }
    catch (error) { pending.current = null; throw error; }
  }, []);
  const clearJwt = useCallback(() => { jwt.current = null; pending.current = null; }, []);
  const getCurrentJwt = useCallback(() => jwt.current, []);
  return <ReactorProvider apiUrl="https://api.reactor.inc" modelName={ORBIS_MODEL_NAME}
    modelTracks={[...ORBIS_TRACKS]} connectOptions={{ autoConnect: false }} jwtToken={getJwt}>
    <CheerStageView clearJwt={clearJwt} getCurrentJwt={getCurrentJwt} />
  </ReactorProvider>;
}

function CheerStageView({ clearJwt, getCurrentJwt }: { clearJwt: () => void; getCurrentJwt: () => string | null }) {
  const session = useOrbisSession(clearJwt, getCurrentJwt);
  const latest = useRef(session); latest.current = session;
  const sendCommand = useReactor(state => state.sendCommand);
  const camera = useRef<HTMLVideoElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const controller = useRef<AbortController | null>(null);
  const active = useRef(false);
  const firstFrame = useRef(false);
  const energyRef = useRef(0);
  const intensityRef = useRef(0);
  const stageRef = useRef<CheerStage>("tired");
  const chunk = useRef(0);
  const stageChunk = useRef(0);
  const steering = useRef(false);
  const ending = useRef(false);
  const lastObservation = useRef(0);
  const sessionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [phase, setPhase] = useState<"idle" | "starting" | "playing" | "stopped" | "complete">("idle");
  const [stage, setStage] = useState<CheerStage>("tired");
  const [energy, setEnergy] = useState(0);
  const [intensity, setIntensity] = useState(0);
  const [observer, setObserver] = useState("Camera is off");
  const [observation, setObservation] = useState("Wave, dance, or jump in view to bring the team back.");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [lastImage, setLastImage] = useState(REFERENCE);
  const [events, setEvents] = useState<string[]>([]);
  const log = useCallback((text: string) => setEvents(previous => [`${new Date().toLocaleTimeString()} · ${text}`, ...previous].slice(0, 24)), []);

  const releaseCamera = useCallback(() => {
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
    if (camera.current) camera.current.srcObject = null;
  }, []);
  const stop = useCallback(async (complete = false) => {
    active.current = false; controller.current?.abort(); clearTimeout(sessionTimer.current);
    releaseCamera(); setObserver("Camera is off");
    const video = world.current?.querySelector("video");
    if (video && video.readyState >= 2 && video.videoWidth) {
      const canvas = document.createElement("canvas"); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      canvas.getContext("2d")!.drawImage(video, 0, 0); setLastImage(canvas.toDataURL("image/jpeg", 0.85));
    }
    setReady(false); setPhase(complete ? "complete" : "stopped");
    log(complete ? "Finale complete. Camera and observer stopped." : "Stopped. Camera and observer released.");
    await latest.current.disconnectSession();
  }, [log, releaseCamera]);
  const fail = useCallback((reason: unknown) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    setError(message); log(message); void stop();
  }, [log, stop]);

  const onMovement = useCallback((report: MovementReport) => {
    if (!active.current) return;
    lastObservation.current = performance.now();
    const value = report.person_visible ? report.intensity : 0;
    intensityRef.current = value; setIntensity(value);
    setObservation(report.observation); setObserver(report.person_visible ? "Gemini is watching you" : "Step into the camera view");
    log(`Gemini: ${Math.round(value)} / 100 · ${report.observation}`);
    if (!firstFrame.current || stageRef.current === "jumping" || stageRef.current === "running") return;
    energyRef.current = nextEnergy(energyRef.current, report); setEnergy(energyRef.current);
  }, [log]);

  const start = async () => {
    if (active.current) return;
    active.current = true; setPhase("starting"); setError(""); setObserver("Requesting camera permission");
    const abort = new AbortController(); controller.current = abort;
    sessionTimer.current = setTimeout(() => fail(new Error("Session finished. Start a new cheer session to play again.")), 270_000);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access needs localhost or HTTPS in a supported browser.");
      const media = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 360 } } });
      if (abort.signal.aborted) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media; camera.current!.srcObject = media; await camera.current!.play();
      media.getVideoTracks()[0].addEventListener("ended", () => { if (active.current) fail(new Error("Camera disconnected. Start a new session to reconnect.")); }, { once: true });
      setObserver("Connecting Gemini Live"); log("Camera on. Connecting Gemini and Orbis.");
      const observerReady = observeCheering(camera.current!, abort.signal, onMovement, state => {
        if (!active.current) return;
        setObserver(state);
        if (/interrupted|disconnected|failed/.test(state)) fail(new Error(state));
      });
      const worldReady = (async () => {
        const response = await fetch(REFERENCE, { signal: abort.signal });
        if (!response.ok) throw new Error("The saved celebration frame could not be loaded.");
        const file = new File([await response.blob()], "celebration-31s.png", { type: "image/png" });
        if (!await latest.current.connectSession()) {
          await new Promise(resolve => setTimeout(resolve, 0));
          throw new Error(latest.current.error || "Orbis connection failed. Stop any other active Orbis demo and retry.");
        }
        if (abort.signal.aborted) { await latest.current.disconnectSession(); return; }
        log("Orbis connected. Starting the tired team from the celebration frame.");
        await latest.current.startGeneration(file, CHEER_PROMPTS.tired, abort.signal);
        if (abort.signal.aborted) await latest.current.disconnectSession();
      })();
      await Promise.all([observerReady, worldReady]);
      if (!abort.signal.aborted) log("World started. Waiting for the first decoded frame.");
    } catch (reason) {
      if (!abort.signal.aborted) {
        if (reason instanceof DOMException && reason.name === "NotAllowedError") fail(new Error("Camera permission was denied. Allow camera access in your browser, then start a new session."));
        else if (reason instanceof DOMException && reason.name === "NotFoundError") fail(new Error("No camera was found. Connect a camera and try again."));
        else fail(reason);
      }
    }
  };

  const steer = async (next: CheerStage) => {
    if (steering.current || !active.current || next === stageRef.current) return;
    steering.current = true;
    try {
      const reply = unwrapOrbisMessage(await sendCommand("set_prompt", { prompt: CHEER_PROMPTS[next] }));
      if (controller.current?.signal.aborted) return;
      if (!reply || reply.type === "command_error") throw new Error(reply?.reason || "Orbis rejected the direction");
      stageRef.current = next; stageChunk.current = chunk.current; setStage(next);
      log(`Orbis direction accepted: ${next}. Applies at the next chunk boundary.`);
    } catch (reason) { if (active.current) fail(reason); }
    finally { steering.current = false; }
  };

  useReactorMessage(raw => {
    if (!active.current) return;
    const message = unwrapOrbisMessage(raw);
    if (message.type === "command_error") { fail(new Error(`${message.command}: ${message.reason}`)); return; }
    if (message.type === "generation_started") log("Orbis is generating the tired team.");
    if (message.type === "generation_paused" && ending.current) { void stop(true); return; }
    if (message.type !== "chunk_complete") return;
    chunk.current += 1;
    if (!firstFrame.current || steering.current) return;
    const next = nextStageAtChunk(stageRef.current, energyRef.current, intensityRef.current, chunk.current - stageChunk.current);
    if (next === "complete") {
      if (!ending.current) {
        ending.current = true;
        void sendCommand("pause", {}).catch(fail);
      }
    } else void steer(next);
  });

  useEffect(() => {
    if (!session.runStarted || !world.current) return;
    let video: HTMLVideoElement | null = null; let callback = 0;
    const watch = () => {
      video = world.current?.querySelector("video") || null;
      if (video) callback = video.requestVideoFrameCallback(() => {
        if (!active.current) return;
        firstFrame.current = true; stageChunk.current = chunk.current; setReady(true); setPhase("playing");
        log("First world frame received. Cheer to charge the team!");
      });
    };
    watch();
    const observer = new MutationObserver(() => { if (!video) watch(); });
    observer.observe(world.current, { childList: true, subtree: true });
    return () => { observer.disconnect(); if (video) video.cancelVideoFrameCallback(callback); };
  }, [session.runStarted, log]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (!active.current || !firstFrame.current || ["jumping", "running"].includes(stageRef.current)) return;
      if (performance.now() - lastObservation.current > 8000) {
        intensityRef.current = 0; setIntensity(0);
        energyRef.current = Math.max(0, energyRef.current - 4); setEnergy(energyRef.current);
        setObservation("Waiting for a fresh Gemini movement report. Keep your movement in view.");
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const leave = () => { active.current = false; controller.current?.abort(); releaseCamera(); };
    window.addEventListener("pagehide", leave);
    return () => { window.removeEventListener("pagehide", leave); leave(); clearTimeout(sessionTimer.current); void latest.current.disconnectSession(); };
  }, [releaseCamera]);

  const live = phase === "starting" || phase === "playing";
  return <main className={styles.page}>
    <nav className={styles.nav}><a href="/">dynads<span> / playground</span></a><span className={styles.pill}>CAMERA → GEMINI → WORLD MODEL</span></nav>
    <header className={styles.header}><p className={styles.eyebrow}>THE CROWD IS THE CONTROLLER</p>
      <h1>CHEER FOR<br /><span>YOUR TEAM.</span></h1>
      <p>They gave everything. Now it’s your turn.<br />Your movement brings them back to life.</p>
    </header>
    <div className={styles.grid}>
      <section className={styles.worldCard} aria-label="Generated team world">
        <div className={styles.worldTop}><span>SOUTH AFRICA · THE COMEBACK</span><span>{ready ? "● LIVE WORLD" : "REFERENCE → LIVE WORLD"}</span></div>
        <div className={styles.world}>
          <img src={lastImage} alt="South Africa players celebrating, the reference frame for the cheer world" />
          <div ref={world} className={`${styles.stream} ${ready ? styles.visible : ""}`}>
            {session.runStarted ? <ReactorView track="main_video" audioTrack="main_audio" muted={session.muted} videoObjectFit="contain" /> : null}
          </div>
          <div className={styles.worldCaption}><span>{phase === "complete" ? "POWERED BY YOU" : "TEAM ENERGY"}</span>
            <h2>{phase === "complete" ? "What a comeback." : phase === "starting" ? "Building your world…" : STAGE_LABELS[stage]}</h2>
            {phase === "idle" ? <p>Start the tired-team world, then cheer them on.</p> : null}
          </div>
        </div>
        <div className={styles.stages}>{STAGES.map((item, index) => <div key={item} data-active={stage === item}><b>0{index + 1}</b><span>{["Catch a breath", "Recover", "Get energized", "Jump together", "Run off-screen"][index]}</span></div>)}</div>
        <div className={styles.controls}>
          {phase === "idle" ? <button className={styles.primary} onClick={() => void start()}>Enable camera & start ↗</button> : live ? <button onClick={() => void stop()}>Stop & turn camera off</button> : <button className={styles.primary} onClick={() => window.location.reload()}>Start a new session ↗</button>}
          {live ? <button onClick={session.toggleMuted}>{session.muted ? "Enable stadium sound" : "Mute stadium sound"}</button> : null}
        </div>
        {error || session.error ? <p className={styles.error} role="alert">{error || session.error}</p> : null}
        <p className={styles.privacy}>Camera frames go to Gemini while you play. No microphone access or camera recording. Stop turns the camera off.</p>
      </section>
      <aside className={styles.panel}>
        <div className={styles.panelTitle}><span>YOUR SIDE OF THE STADIUM</span><span>{live ? "● CAMERA" : "CAMERA OFF"}</span></div>
        <div className={styles.camera}><video ref={camera} muted playsInline autoPlay />{!live ? <div>YOU BRING THE ENERGY<span>Your camera appears here</span></div> : null}</div>
        <div className={styles.energyTitle}><h2>Team energy</h2><strong>{Math.round(energy)}<small>/100</small></strong></div>
        <div className={styles.meter} role="progressbar" aria-label="Team energy" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(energy)}><div style={{ width: `${energy}%` }} /></div>
        <div className={styles.meterLabels}><span>TIRED</span><span>UNSTOPPABLE</span></div>
        <p className={styles.action}>{stage === "jumping" || stage === "running" ? "You did it. Watch them go!" : ready ? "Wave. Dance. Jump. Keep it going!" : "Your team is waiting for you."}</p>
        <div className={styles.observation}><span>GEMINI LIVE · {Math.round(intensity)}% MOVEMENT</span><h3>{observer}</h3><p>{observation}</p></div>
        <p className={styles.note}>Keep your arms and upper body in view. Repeated energetic movement charges the team; standing still lets them rest. World changes arrive a few seconds after your movement.</p>
      </aside>
    </div>
    <details className={styles.trace}><summary>See the live control loop</summary>
      <p>Camera observations → energy → Orbis prompt changes at chunk boundaries.</p>
      <ol>{events.map((event, index) => <li key={`${index}-${event}`}>{event}</li>)}</ol>
      <p>Current direction: {CHEER_PROMPTS[stage]}</p>
    </details>
  </main>;
}
