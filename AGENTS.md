# Dynads working notes

## Agreed behavior
- Capture jersey 8 with his teammates at source time 31 seconds. Never read future frames.
- Generate a fresh Coca-Cola ad in Orbis Dynamic: catch bottle, then push in and drink.
- Pause source at 47 seconds; wait for a complete playable ad, play it, resume from 47.
- Gemini observes current frames and logs tool calls; the timed cue remains authoritative.
- Show generated advertising scenery plus a readable slogan overlay.
- Coca-Cola is the configured demo campaign, not a verified player endorsement.

## Current brand rollback
- User requested restoration of Coca-Cola after observing floating-bottle artifacts
  with the generic drink. Restored prior bottle description, slogan, red styling,
  research context and fictional rejection fallback. Observer fix and timing-strip
  removal retained. No new claim that the brand alone prevents motion artifacts.

## Earlier correction
- Removed the visible 01 / 31s / 47s timing strip as requested; timed mechanics
  remain for hackathon reliability and trace provenance remains accurate.
- Replaced Coca-Cola campaign copy, bottle and overlay styling with fictional
  Orbit Refresh (teal label); fallback is an unbranded drink.
- Fixed corrupted observer call `ai.live.y` / standalone `connect` back to
  `ai.live.connect`. No authentication configuration changes.
- Agent-controlled insertion is the intended core concept; timed insertion is
  the current demo constraint, not a separate product feature.
- Verified typecheck and production build. Chrome check confirmed strip removal,
  Orbit Refresh copy, real Gemini connection, and no page exceptions. Orbis was
  mocked only for this isolated observer/UI check; new-brand generation not rerun.

## Engineering rules
- Keep provider keys server-side. Preserve development session registry and cleanup wrapper.
- Keep one model constant shared by token minting, provider, and registry.
- Use model events for beats; first chunk can contain no frames.
- Do not claim live verification or latency without a real provider run.
- Update these notes after implementation milestones. Run typecheck and production build.

## Progress
- [x] Inspected starter, attached brief, and video metadata (84.78s, 1280x720, 25fps).
- [x] Inspected temporary 31s frame; number 8 is visible next to 11 and 13.
- [x] Timed capture, Orbis generation, recording, insertion and return implemented.
- [x] Gemini ephemeral-token observation and HUD implemented.
- [x] Typecheck, production build, real provider loop, and mocked failure browser checks.
- Initial prerequisites: dependencies not installed; .env.local absent. Never log secret values.
- Dependencies installed; both keys subsequently became available in .env.local.
- Typecheck and production build passed. Browser plugin unavailable; using existing Playwright + Chrome.
- First real run: capture 31.08s, prompts 4.50s after capture, generation start 7.29s,
  first decoded frame 13.59s. Both beats and pause worked, source held at 47s.
- Reactor archive assembly remained pending >60s. Primary recording changed to
  browser MediaRecorder on the actual WebRTC tracks; archive API retained as fallback.
- Capture now briefly seeks backward to exactly 31s after reaching the cue; never seeks ahead.
- Gemini browser uses v1alpha per installed SDK requirements; server token minting uses v1beta.
- Second real Chrome run passed: captured 31.00s; Gemini identified Tshabalala #8;
  prompts ready 3.45s, generation start 6.11s, first frame 12.16s, local recording
  ready 22.85s, ad on screen 23.03s, return 33.73s (all relative to capture).
  Source held at 47s and resumed correctly. No page exceptions or app errors.
- Mobile 390x844 mocked-error test passed: duplicate suppression, hold at 47,
  Continue Match recovery, and no horizontal overflow. Desktop checked at 1440x1000.
- Real-brand rejection fallback and archive fallback completion remain unverified.
- Final live visual run also passed: first frame 12.44s, recording ready 23.15s,
  ad visible 23.40s, return 34.09s after capture. Recording contains VP8 video
  and Opus audio. Session registry empty after completion. Final build/typecheck passed.
- Visually confirmed generated player holding a red-label cola bottle and readable
  composited slogan. Model still drifts jersey numbers and background text; a precise
  drinking gesture and identity preservation are not guaranteed by prompt steering.
- Saved exact extracted source frame at public/demo/celebration-31s.png for review;
  runtime generation still captures from the currently playing video.

## Agent trace follow-up
- Follow-up: added visible Agent activity trace with actual connection, tool-call,
  capture, generation and delivery events. Timestamps are source-video seconds.
- Sponsor lookup now calls /api/sponsors with Google Search grounding for South
  Africa in 2010. Research sources/queries are shown; requested Coca-Cola demo
  campaign remains explicit and independent of historical endorsement evidence.
- Removed advance scorer claim from Gemini match context; it receives jersey
  mappings and must report observable goal/celebration evidence from frames.
- Trace lookup starts on matching Gemini detection, or explicitly labeled timed
  cue fallback. One lookup per run; errors do not block the demo.
- Real live trace run identified #8 at source time 26.9s and started sponsor
  research from that event. Ad insertion/return still passed (23.13s capture-to-ad).
- Initial search timed out; disabling search-model thinking resolved it. Real
  endpoint returned 11 source links in 4.469s. Never portray retrieved research
  as an established personal endorsement or silently change the requested brand.
- Final isolated browser check: real Gemini detection at 26.2s; real research
  returned four source links by 28.5s. Expanded summary, citations, search
  suggestions, and mobile width checks passed with no page exceptions.
  Orbis was mocked only in that isolated check; full live playback passed earlier.
- Final typecheck and production build passed after the search configuration fix.

## References
- https://www.reactor.inc/models/visko-orbis-dynamic/api
- https://docs.reactor.inc/concepts/recordings
- https://aistudio.google.com/docs/live-api/ephemeral-tokens
- https://aistudio.google.com/docs/live-api/tools
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
