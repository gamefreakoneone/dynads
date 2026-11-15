# Cheer playground

Open http://localhost:3000/cheer. This is a separate page; the broadcast/ad flow
at `/` is unchanged. It reuses the saved `public/demo/celebration-31s.png` frame
and the existing Orbis session infrastructure without modifying either.

1. Click **Enable camera & start**, then allow camera permission.
2. Orbis creates a tired-team scene from the reference frame. Gemini receives
   one webcam frame per second and reports visible movement about every two seconds.
3. Wave, clap, dance, or jump in view. Sustained movement charges team energy.
4. The world progresses through recovery, energetic celebration, group jumps,
   then a sprint off-screen. Directions are sent at model chunk boundaries.
5. Stop releases the camera and both sessions. The finale stops automatically;
   sessions also end before the existing five-minute Orbis limit.

Camera use needs localhost or HTTPS. No microphone is requested and no webcam
recording is saved. Webcam frames go to Gemini; Orbis receives only the saved
football reference frame and motion prompts. The first frame is the original
celebration; the generated continuation directs the team to become tired.

Gemini reports physical motion, not identity, emotion or health. A static pose or
an absent person does not charge energy. Reports older than eight seconds decay.
The finale needs at least 85 energy and a current intensity of 70. Each stage
is shown before the next; jumps last three model chunks and running lasts five.
Actual generated motion can vary and steering is not instantaneous.

The same server-only keys in `.env.local` are used. If Orbis reports HTTP 429
with `no available capacity`, stop other active Orbis sessions or retry later.
This page does not terminate sessions belonging to other tabs.

## Validation

```powershell
npm.cmd run typecheck
npm.cmd run build
node --experimental-strip-types --test tests/cheer.test.mjs
```

- Six unit tests cover report validation, absent people, stillness, charge limits,
  strong-motion threshold, stage ordering, and chunk-based finale completion.
- Browser checks: idle page, mobile layout, camera denial (no provider calls before
  permission), camera release on error/stop, and original demo page rendering.
- Real Gemini observer verified using prerecorded test frames rather than a webcam.
- Live Orbis attempts returned HTTP 429 (no available capacity), so generated
  tired/jumping/running visuals have not been visually verified in this feature.
