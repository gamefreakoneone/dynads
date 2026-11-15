"use client";

import { ReactorProvider, ReactorView, useReactor, useReactorMessage } from "@reactor-team/js-sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import { useOrbisSession } from "@/hooks/use-orbis-session";
import { OrbisControls } from "./orbis-controls";
import { ORBIS_MODEL_NAME, ORBIS_TRACKS, requestReactorJwt, unwrapOrbisMessage } from "@/lib/orbis";
import { BEAT_CHUNKS, CAPTURE_SECONDS, INSERT_SECONDS, SPONSOR, FALLBACK_SPONSOR, beatRequests, type AdTrigger } from "@/lib/dynads/config";
import { startWatcher } from "@/lib/dynads/watcher";
import { AgentTrace, type TraceStep, type SponsorResearch } from "./agent-trace";

export function Dynads() {
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
    <Broadcast clearJwt={clearJwt} getCurrentJwt={getCurrentJwt} />
  </ReactorProvider>;
}

function Broadcast({ clearJwt, getCurrentJwt }: { clearJwt: () => void; getCurrentJwt: () => string | null }) {
  const session = useOrbisSession(clearJwt, getCurrentJwt);
  const { reactor, sendCommand } = useReactor(s => ({ reactor: s.internal.reactor, sendCommand: s.sendCommand }));
  const source = useRef<HTMLVideoElement>(null);
  const ad = useRef<HTMLVideoElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const latest = useRef(session); latest.current = session;
  const abort = useRef<AbortController | null>(null);
  const run = useRef(0);
  const captured = useRef(false);
  const inserted = useRef(false);
  const held = useRef(false);
  const running = useRef(false);
  const chunks = useRef(0);
  const prompts = useRef<string[]>([]);
  const reference = useRef<File | null>(null);
  const recording = useRef(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const recordedParts = useRef<Blob[]>([]);
  const fallback = useRef(false);
  const deadline = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const began = useRef(0);
  const urls = useRef<string[]>([]);
  const lookupStarted = useRef(false);
  const [trace, setTrace] = useState<TraceStep[]>([]);
  const [research, setResearch] = useState<SponsorResearch | null>(null);
  const recordStep = useCallback((id: string, title: string, detail: string,
    status: TraceStep["status"], origin: string) => {
    const step: TraceStep = { id, title, detail, status, source: origin, at: source.current?.currentTime || 0 };
    setTrace(previous => previous.some(item => item.id === id)
      ? previous.map(item => item.id === id ? step : item) : [...previous, step]);
  }, []);
  const [phase, setPhase] = useState("Ready to start");
  const [started, setStarted] = useState(false);
  const [time, setTime] = useState(0);
  const [frame, setFrame] = useState("");
  const [clip, setClip] = useState("");
  const [showAd, setShowAd] = useState(false);
  const [error, setError] = useState("");
  const [sponsor, setSponsor] = useState(SPONSOR);
  const [activePrompt, setActivePrompt] = useState("");
  const [payload, setPayload] = useState<AdTrigger | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const log = useCallback((text: string) => setEvents(old => [`${new Date().toLocaleTimeString()}  ${text}`, ...old].slice(0, 60)), []);
  const mark = useCallback((name: string) => setMetrics(old => ({ ...old, [name]: (performance.now() - began.current) / 1000 })), []);
  const fail = useCallback((e: unknown) => {
    clearTimeout(deadline.current); running.current = false;
    if (recorder.current?.state === "recording") recorder.current.stop();
    recorder.current = null;
    void latest.current.disconnectSession();
    const message = e instanceof Error ? e.message : String(e);
    setError(message); setPhase("Ad preparation failed"); log(message);
    recordStep("generation", "Ad preparation interrupted", message, "warning", "Application event");
  }, [log, recordStep]);

  const lookupSponsors = async (origin: string) => {
    if (lookupStarted.current || !abort.current) return;
    lookupStarted.current = true;
    const signal = abort.current.signal;
    recordStep("lookup", "Looking up team sponsors", "Searching South Africa / Bafana Bafana sponsorships relevant to the 2010 match.", "working", origin);
    try {
      const response = await fetch("/api/sponsors", { method: "POST", signal,
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ team: "South Africa", year: 2010 }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Sponsor lookup failed");
      if (signal.aborted) return;
      setResearch(result);
      recordStep("lookup", "Sponsor research returned", `${result.sources.length} sources found. Team and tournament sponsorship evidence is available below.`, "done", "Gemini + Google Search · /api/sponsors");
    } catch (e) {
      if (signal.aborted) return;
      recordStep("lookup", "Sponsor lookup unavailable", e instanceof Error ? e.message : "Lookup failed", "warning", "Google Search request");
    }
    if (!signal.aborted) recordStep("campaign", `Campaign selected: ${SPONSOR.brand}`, "Using your configured Coca-Cola campaign for this team celebration. Research does not establish a player endorsement.", "done", "Demo campaign configuration");
  };

  const generate = async (file: File, useFallback = false) => {
    const id = run.current;
    const signal = abort.current!.signal;
    const selected = useFallback ? FALLBACK_SPONSOR : SPONSOR;
    setSponsor(selected); setError(""); setPhase("Preparing image-grounded prompts");
    recordStep("generation", "Directing the dynamic ad", `Preparing two image-grounded beats for ${selected.brand}: team celebration and bottle catch, then a closer drinking shot.`, "working", "Gemini prompt preparation");
    running.current = true; chunks.current = 0; recording.current = false;
    clearTimeout(deadline.current);
    deadline.current = setTimeout(() => { abort.current?.abort(); run.current += 1; fail(new Error("Generation timed out. Retry or continue the match.")); void latest.current.disconnectSession(); }, 120_000);
    try {
      const prepared = await Promise.all(beatRequests(selected).map(async prompt => {
        const form = new FormData(); form.set("image", file); form.set("prompt", prompt);
        const response = await fetch("/api/orbis-prompt", { method: "POST", body: form, signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Prompt preparation failed");
        return result.prompt as string;
      }));
      if (id !== run.current || signal.aborted) return;
      prompts.current = prepared; mark("Prompts ready");
      if (!latest.current.connected) {
        setPhase("Waiting for Orbis connection");
        if (!await latest.current.connectSession()) throw new Error("Orbis connection failed. Check credentials and capacity.");
      }
      if (id !== run.current || signal.aborted) return;
      setPhase("Generating · beat 1"); setActivePrompt(prepared[0]);
      await latest.current.startGeneration(file, prepared[0], signal);
      if (id !== run.current || signal.aborted) return;
      mark("Generation started");
      recordStep("generation", "World model is generating", `${selected.brand} ad growing from the captured team celebration. Beat 1: catch the bottle.`, "working", "Orbis · generation_started");
    } catch (e) { if (id === run.current && !signal.aborted) fail(e); }
  };

  const capture = async (exactCue = false) => {
    const video = source.current;
    if (!video || captured.current || video.readyState < 2) return;
    const id = run.current;
    captured.current = true; began.current = performance.now(); mark("Capture");
    if (exactCue && video.currentTime >= CAPTURE_SECONDS) {
      video.pause();
      await new Promise<void>(resolve => {
        video.addEventListener("seeked", () => resolve(), { once: true });
        video.currentTime = CAPTURE_SECONDS;
      });
    }
    if (id !== run.current || abort.current?.signal.aborted) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    const capturedTime = video.currentTime;
    if (exactCue) void video.play().catch(fail);
    canvas.toBlob(blob => {
      if (!blob || id !== run.current) return;
      const file = new File([blob], "celebration.png", { type: "image/png" });
      reference.current = file;
      const url = URL.createObjectURL(blob); urls.current.push(url); setFrame(url);
      log(`Captured source frame at ${capturedTime.toFixed(2)}s; ${exactCue ? "timed" : "manual"} trigger, jersey 8`);
      recordStep("capture", "Celebration frame captured", `${capturedTime.toFixed(2)}s broadcast frame saved as the ad's visual starting point.`, "done", exactCue ? "31-second demo cue" : "Manual trigger");
      void lookupSponsors(exactCue ? "Timed cue fallback if Gemini has not reported yet" : "Manual trigger");
      recordStep("campaign", `Campaign selected: ${SPONSOR.brand}`, "Requested Coca-Cola demo campaign; sponsor research runs independently.", "done", "Demo campaign configuration");
      void generate(file);
    }, "image/png");
  };

  const finishRecording = async () => {
    if (recording.current || !running.current) return;
    recording.current = true;
    const id = run.current;
    try {
      setPhase("Assembling generated ad");
      let blob: Blob;
      const local = recorder.current;
      if (local && local.state !== "inactive") {
        blob = await new Promise<Blob>((resolve, reject) => {
          local.onstop = () => resolve(new Blob(recordedParts.current, { type: local.mimeType }));
          local.onerror = () => reject(new Error("Browser recording failed"));
          local.stop();
        });
        log("Ad recorded from live WebRTC frames in this browser");
      } else {
        log("Browser recording unavailable; requesting Reactor archive");
        const result = await reactor.requestRecording();
        blob = await reactor.downloadClipAsFile(result, null, { jwt: getCurrentJwt()!, signal: abort.current?.signal });
      }
      if (id !== run.current || abort.current?.signal.aborted) return;
      if (!blob || !blob.size) throw new Error("Orbis returned an empty recording");
      const url = URL.createObjectURL(blob); urls.current.push(url); setClip(url);
      mark("Recording ready"); setPhase("Ad ready · waiting for 47s");
      recordStep("generation", "Dynamic ad ready", "Both generation beats completed; the fresh recording is ready to insert.", "done", "Orbis + browser recording");
      running.current = false; clearTimeout(deadline.current);
    } catch (e) { if (id === run.current) fail(e); }
  };

  useReactorMessage(raw => {
    const message = unwrapOrbisMessage(raw);
    if (message.type) log(`Orbis: ${message.type}`);
    if (!running.current) return;
    if (message.type === "chunk_complete") {
      chunks.current += 1;
      if (chunks.current === BEAT_CHUNKS) {
        recordStep("generation", "Steering the second beat", "Sending the camera push-in and bottle-drinking direction while the model continues generating.", "working", "Orbis · set_prompt");
        setPhase("Generating · beat 2"); setActivePrompt(prompts.current[1]);
        void sendCommand("set_prompt", { prompt: prompts.current[1] }).catch(fail);
      }
      if (chunks.current === BEAT_CHUNKS * 2) void sendCommand("pause", {}).catch(fail);
    }
    if (message.type === "generation_paused") void finishRecording();
    if (message.type === "command_error") {
      const reason = message.reason || "Orbis rejected a command";
      if (/policy|safety|brand|moderation|blocked/i.test(reason) && !fallback.current && reference.current) {
        fallback.current = true; running.current = false;
        log(`Provider rejection: ${reason}. Retrying with fictional Orbit Cola.`);
        void sendCommand("reset", {}).then(() => generate(reference.current!, true)).catch(fail);
      } else fail(new Error(reason));
    }
  });

  const playAd = async () => {
    if (!held.current || inserted.current || !ad.current || ad.current.readyState < 2) return;
    inserted.current = true;
    try {
      await ad.current.play();
      ad.current.requestVideoFrameCallback(() => { setShowAd(true); setPhase("Sponsored moment"); mark("Ad on screen"); recordStep("delivery", "Dynamic ad on air", "Inserted at source time 47s; the match is paused underneath.", "done", "Decoded video frame"); });
    } catch { inserted.current = false; fail(new Error("Ad playback needs a click. Use Play ad.")); }
  };
  const operations = useRef({ capture, playAd }); operations.current = { capture, playAd };
  useEffect(() => {
    const video = source.current!;
    let callback = 0;
    const tick: VideoFrameRequestCallback = (_, info) => {
      if (started) {
        if (info.mediaTime >= CAPTURE_SECONDS && video.currentTime >= CAPTURE_SECONDS && !captured.current) void operations.current.capture(true);
        if (info.mediaTime >= INSERT_SECONDS && !held.current && !inserted.current) {
          held.current = true; video.pause(); video.currentTime = INSERT_SECONDS;
          setPhase("At 47s · waiting for the ad"); void operations.current.playAd();
        }
      }
      callback = video.requestVideoFrameCallback(tick);
    };
    callback = video.requestVideoFrameCallback(tick);
    return () => video.cancelVideoFrameCallback(callback);
  }, [started]);

  const begin = async () => {
    setStarted(true); setPhase("Watching the match"); abort.current = new AbortController();
    recordStep("watch", "Connecting the match observer", "Opening Gemini Live to inspect current broadcast frames.", "working", "Gemini Live");
    try { await source.current!.play(); } catch (e) { fail(e); return; }
    void latest.current.connectSession().then(ok => { if (!ok) log("Orbis warm-up failed; retry available at capture"); });
    void startWatcher(source.current!, abort.current.signal, log, trigger => {
      setPayload(trigger); log(`Gemini observed goal celebration: ${trigger.player_name} #${trigger.jersey_number}`);
      recordStep("goal", "Goal celebration detected", typeof trigger.evidence === "string" ? trigger.evidence : "Gemini reported a goal scorer celebrating in the supplied frames.", "done", `Gemini · trigger_ad · reported confidence ${Math.round(trigger.confidence * 100)}%`);
      recordStep("player", `Number ${trigger.jersey_number}: ${trigger.player_name}`, `${trigger.team}. Player mapping uses the supplied jersey roster, not facial recognition.`, "done", "Gemini observation + match roster");
      if (trigger.jersey_number === 8 && /south africa|bafana|rsa/i.test(trigger.team)) void lookupSponsors("Gemini goal celebration event");
      else recordStep("lookup", "Observation differs from the demo campaign", "The reported player/team does not match South Africa #8. The 31-second demo cue still controls the requested ad.", "warning", "Trigger validation");
    }, status => {
      recordStep("watch", status === "connected" ? "Watching the match" : status === "error" ? "Observer interrupted" : "Observation finished",
        status === "connected" ? "Sending one current frame per second; watching for a goal and a visible jersey number." : "Timed capture and insertion remain independent of the observer.",
        status === "error" ? "warning" : status === "connected" ? "working" : "done", "Gemini Live connection");
    }).catch(e => { if (!abort.current?.signal.aborted) {
      log(`Observer unavailable: ${e.message}`);
      recordStep("watch", "Observer unavailable", e.message, "warning", "Gemini Live connection");
    } });
  };
  const resumeMatch = async () => {
    run.current += 1; abort.current?.abort();
    setShowAd(false); inserted.current = true; running.current = false;
    clearTimeout(deadline.current); setPhase("Back to the match"); mark("Return to match");
    recordStep("delivery", "Broadcast resumed", "Returned to the match from the 47-second insertion point.", "done", "Playback coordinator");
    ad.current?.pause();
    if (recorder.current?.state === "recording") recorder.current.stop();
    try { await source.current!.play(); } catch (e) { fail(e); }
    void latest.current.reset().then(() => latest.current.disconnectSession());
  };
  const retry = async () => {
    if (!reference.current) return;
    run.current += 1; abort.current?.abort(); abort.current = new AbortController();
    if (recorder.current?.state === "recording") recorder.current.stop();
    recorder.current = null;
    await latest.current.disconnectSession();
    await generate(reference.current, fallback.current);
  };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.code === "KeyF" && !["INPUT", "TEXTAREA", "SELECT"].includes((event.target as HTMLElement).tagName) && abort.current) void operations.current.capture();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => () => {
    run.current += 1; abort.current?.abort(); clearTimeout(deadline.current);
    urls.current.forEach(URL.revokeObjectURL);
    if (recorder.current?.state === "recording") recorder.current.stop();
    void latest.current.disconnectSession();
  }, []);

  useEffect(() => {
    if (!session.runStarted || !preview.current) return;
    let frameCallback = 0;
    let video: HTMLVideoElement | null = null;
    const observe = () => {
      video = preview.current?.querySelector("video") || null;
      if (video) frameCallback = video.requestVideoFrameCallback(() => {
        mark("First generated frame");
        const stream = video?.srcObject;
        if (!(stream instanceof MediaStream)) return;
        const mimeType = ["video/webm;codecs=vp8,opus", "video/webm"].find(type => MediaRecorder.isTypeSupported(type));
        if (!mimeType) return;
        recordedParts.current = [];
        const media = new MediaStream(stream.getTracks());
        const audio = preview.current?.querySelector("audio")?.srcObject;
        if (audio instanceof MediaStream && !media.getAudioTracks().length) audio.getAudioTracks().forEach(track => media.addTrack(track));
        const local = new MediaRecorder(media, { mimeType });
        local.ondataavailable = event => { if (event.data.size) recordedParts.current.push(event.data); };
        local.onerror = () => log("Local recording failed; Reactor archive will be used");
        local.start(250); recorder.current = local;
      });
    };
    observe();
    const observer = new MutationObserver(() => { if (!video) observe(); });
    observer.observe(preview.current, { childList: true, subtree: true });
    return () => { observer.disconnect(); if (video) video.cancelVideoFrameCallback(frameCallback); };
  }, [session.runStarted, mark, log]);

  return <div className="dynads-grid">
    <section className="broadcast-column">
      <div className="broadcast-top"><span>RSA <b>1 — 0</b> MEX</span><span>2010 WORLD CUP · DEMO FEED</span></div>
      <div className="broadcast-surface">
        <video ref={source} src="/demo/match.mp4" playsInline preload="auto"
          onTimeUpdate={() => setTime(source.current?.currentTime || 0)}
          onEnded={() => { abort.current?.abort(); setPhase("Match ended"); }} />
        <video ref={ad} src={clip || undefined} playsInline preload="auto"
          className={`ad-surface ${showAd ? "visible" : ""}`} onLoadedData={() => void playAd()}
          onEnded={() => void resumeMatch()} onError={() => { if (clip) fail(new Error("Generated recording could not be decoded")); }} />
        {showAd ? <><div className="sponsored-bug">SPONSORED MOMENT · AI DEMO</div>
          <div className="ad-slogan">{sponsor.slogan}</div></> : null}
        {!started ? <div className="start-cover"><span className="eyebrow">A moment becomes a message</span><h2>From celebration<br />to creation.</h2><button onClick={() => void begin()}>▶ Start demo</button></div> : null}
      </div>
      <div className="transport"><span>{time.toFixed(1)}s / 84.8s</span><strong aria-live="polite">{phase}</strong><button onClick={() => window.location.reload()}>Restart</button></div>
      {error || session.error ? <div role="alert" className="dynads-error">{error || session.error}<div className="button-row"><button disabled={!reference.current || running.current} onClick={() => void retry()}>Retry ad</button><button onClick={() => void resumeMatch()}>Continue match</button>{clip ? <button onClick={() => void playAd()}>Play ad</button> : null}</div></div> : null}
      <div className="evidence-grid"><section><h3>Reference · 31 second cue</h3>{frame ? <><img src={frame} alt="Captured celebration with jersey 8 and teammates" /><a href={frame} download="celebration-31s.png">Save captured frame</a></> : <p>The current broadcast frame will appear here.</p>}</section>
        <section><h3>World model · live generation</h3>{session.runStarted ? <div ref={preview} className="generation-preview"><ReactorView track="main_video" audioTrack="main_audio" muted videoObjectFit="contain" /></div> : <p>Orbis {session.status}</p>}</section></div>
      <details><summary>Debug controls · F forces a current-frame trigger</summary><OrbisControls session={session} /></details>
    </section>
    <aside className="dynads-hud"><span className="eyebrow">CONTROL ROOM</span><h2>The live loop</h2>
      <AgentTrace steps={trace} research={research} />
      <div className="sponsor-card"><small>CONFIGURED DEMO SPONSOR</small><h3>{sponsor.brand}</h3><p>Siphiwe Tshabalala · South Africa · #8</p><small>Illustrative placement, not a real endorsement</small></div>
      <h3>Stage timings <small>since capture</small></h3><dl>{Object.entries(metrics).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value.toFixed(2)}s</dd></div>)}</dl>
      <h3>Gemini observation</h3><pre>{payload ? JSON.stringify(payload, null, 2) : "Observing only · timed cue controls insertion"}</pre>
      <h3>Active direction</h3><p className="prompt-copy">{activePrompt || "Two image-grounded beats will be prepared at capture."}</p>
      <h3>Event log</h3><div className="event-log" role="log">{events.map((event, i) => <p key={`${i}-${event}`}>{event}</p>)}</div>
    </aside>
  </div>;
}
