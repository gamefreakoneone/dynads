# Dynads — timed sports ad demo

Run `npm ci`, configure `REACTOR_API_KEY` and `GEMINI_API_KEY` in `.env.local`,
then run `npm run dev` and open http://localhost:3000 in desktop Chrome or Edge.
The development command retains the starter's session-cleanup wrapper.

Click **Start demo**. The supplied match plays normally, captures jersey 8 at
31 seconds, and generates a fresh two-beat Coca-Cola scene in Orbis Dynamic.
At 47 seconds the match pauses until the generated recording is ready. The ad
plays with a readable slogan overlay, then the match resumes from 47 seconds.
The source briefly seeks backward to exactly 31 seconds at capture; no future
frames are read. **F** forces a current-frame capture for stage debugging.

Gemini Live observes one current frame per second and logs validated
`trigger_ad` calls. It does not control insertion in this version. The sponsor
mapping is illustrative, not evidence of a real endorsement. Model outputs
can vary; the original manual controls remain under **Debug controls**.

The **Agent activity** trace shows actual observation, detection, jersey-to-player
mapping, sponsor lookup, frame capture, generation, and broadcast return events.
After Gemini reports South Africa #8, `/api/sponsors` performs a Google
Search-grounded lookup of the team's 2010 sponsorships. If detection has not
arrived, the 31-second cue starts that lookup and explicitly labels its origin.
Expand **View sponsor research & sources** for the summary, citations, queries,
and Google Search suggestions. Lookup errors are visible and do not block the ad.
The requested Coca-Cola campaign remains configured; research distinguishes
team sponsorship from tournament sponsorship and does not imply endorsement.

The browser records the live WebRTC tracks after the first decoded frame.
Reactor's recording API is a fallback if local recording is unavailable; live
testing found archive assembly too slow for the primary demo path. No generated
clip is bundled or reused between runs. This version does not export a combined
match/ad MP4. The capture can be saved from the reference preview.

The HUD reports elapsed time since capture (including the deliberate wait at
47 seconds), prompt preparation, first frame, recording readiness, insertion,
and return. Failures expose **Retry ad** and **Continue match**. Restart reloads
the page, triggering session cleanup and clearing all temporary media.

Run `npm run typecheck` and `npm run build` to validate changes. See `AGENTS.md`
for implementation progress, decisions, and live verification results.

## Original starter reference

A minimal Next.js example for the public Reactor-hosted Visko Orbis Stable API.
It demonstrates server-side token minting, WebRTC video and audio, text-to-video,
optional image-to-video, live prompt steering, delivery resolution, pause,
resume, and a foldable Nano Banana-to-Orbis livestreaming example.

## Requirements

- Node.js 20.9 or newer
- A Reactor API key with access to Visko Orbis Stable
- A Google Gemini API key with access to Nano Banana

## Run locally

```bash
cp .env.example .env.local
# Add your Reactor API key to .env.local.
npm install
npm run dev
```

Open <http://localhost:3000>.

`npm run dev` starts Next.js through a small session-cleanup wrapper. While in
development, sessions created by this starter are recorded in the gitignored
`.reactor-dev-sessions.json` file. It contains session IDs and metadata, but no
API keys or JWTs. The wrapper uses the server-only `REACTOR_API_KEY` to delete
recorded sessions before startup and again on `Ctrl+C`/`SIGTERM`, so restarting
the dev server cannot silently leave a previous Orbis session consuming
capacity. If a startup sweep cannot delete a recorded session, the wrapper
refuses to start another dev server and reports the session ID.

Set both keys in `.env.local`:

```dotenv
REACTOR_API_KEY=your_reactor_api_key
GEMINI_API_KEY=your_gemini_api_key
```

Keep both keys server-side. The browser receives only the short-lived Reactor
JWT and the image returned by the Nano Banana route.

## Nano Banana kickoff example

Connect to Orbis, expand **Livestreaming example**, and click
**Edit and start stream**. The bundled `dog.png` is displayed as the source
image. The server sends it with the displayed image-editing prompt to
`gemini-2.5-flash-image`. Gemini then analyzes the edited image with the user
prompt and returns a plain-text, image-grounded prompt. The
edited output is previewed, uploaded as the Orbis start image, and used with
that grounded prompt to begin the stream.

The two starting prompts are exported from `lib/nano-banana.ts`.
`NANO_BANANA_PROMPT` controls the image edit, while `ORBIS_KICKOFF_PROMPT`
describes the requested motion. The final Gemini-grounded prompt is displayed
before it is sent to Orbis.

## API flow

1. `POST /api/token` requests a scoped session JWT from
   `https://api.reactor.inc/tokens`.
2. `ReactorProvider` connects to `reactor/visko-orbis-stable` with the
   recv-only `main_video` and `main_audio` tracks.
3. The model sends a `state` snapshot. Its `state.available_resolutions` list
   replaces the starter's initial documented resolution choices.
4. If supplied, the reference image is uploaded and passed to `set_image`
   before `start`.
5. If selected, `set_resolution` stages a delivery tier for the next `start`.
   Omitting it keeps the model's current setting; the documented default is
   `2k`.
6. `set_prompt` supplies the required prompt, then `start` begins generation.
7. Sending another `set_prompt` while running steers the video at the next
   chunk boundary.

## Documented model behavior

- A prompt is required before `start`; the reference image is optional.
- A 16:9 reference image works best. Other aspect ratios are resized without
  cropping and may appear distorted.
- The starter initially shows the currently documented `1080p`, `2k`, and `4k`
  tiers. After connection, treat `state.available_resolutions` as authoritative
  and send the selected value exactly as given.
- `set_resolution` applies from the next `start`, not during the active run.
- Orbis emits chunks about every 1.8 seconds. The first chunk emits no frames
  while the upscaler primes; this is expected.
- Commands are asynchronous. Use model events such as `state`,
  `prompt_accepted`, `resolution_accepted`, `generation_started`,
  `chunk_complete`, and `command_error` as the source of truth.
- `pause` takes effect after the current chunk. `resume` continues the same
  generation, and `reset` clears the current prompt and image.

## Project files

- `app/api/token/route.ts` performs the server-side token exchange.
- `app/api/session-cleanup/route.ts` performs best-effort session deletion when
  the browser page exits.
- `app/api/session-registry/route.ts` records verified development sessions for
  startup and shutdown cleanup.
- `scripts/dev-with-session-cleanup.mjs` wraps `next dev` with the development
  cleanup sweeps.
- `app/api/nano-banana/route.ts` performs the server-side image edit.
- `app/api/orbis-prompt/route.ts` creates the image-grounded video prompt.
- `components/orbis-demo.tsx` composes the provider, player, controls, and demo.
- `components/orbis-player.tsx` renders the streamed video and audio.
- `components/orbis-controls.tsx` renders the session controls.
- `components/nano-banana-example.tsx` owns the kickoff example and source image.
- `hooks/use-orbis-session.ts` contains the reusable Orbis command sequence and
  session state.
- `dog.png` is the Nano Banana source image.
- `lib/orbis.ts` contains the public model configuration and message helpers.
- `lib/orbis-prompt.ts` contains the plain-text Gemini grounding instruction.
- `lib/nano-banana.ts` contains the model and kickoff prompt.
- `.env.example` documents the required environment variables.

For the complete command parameters, message schemas, tracks, and current model
behavior, use the public Reactor documentation:

- [Visko Orbis Stable API](https://www.reactor.inc/models/visko-orbis-stable/api)
- [Visko Orbis Dynamic API](https://www.reactor.inc/models/visko-orbis-dynamic/api)
- [Gemini image generation and editing](https://ai.google.dev/gemini-api/docs/image-generation)
