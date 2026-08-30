// DOES THE LOGO LAND ON THE BEAT - IN THE FILE MAC WATCHES?
//
// Mac's report on v4: it doesn't. Every number upstream said it did -
// the cue lands y=0 at barTime(12), the probe reads the transform at
// dead centre on the frozen bar - and none of those numbers is about
// the ARTIFACT: a video where the audio was muxed at a sampled offset
// and the visuals lag the song clock by however long this box takes to
// draw. This tool measures the delivered file itself, which is the
// only measurement that is about what an ear and an eye receive.
//
//   node tools/introSyncCheck.mjs [intro.mp4]
//
// ── THE BEAT, by cross-correlation ───────────────────────────────
// The video's audio is the theme, placed at some offset. Envelope
// cross-correlation against the source recording over the groove
// window recovers that offset to a couple of milliseconds, with no
// dependence on the onset detector's conventions. The beat's video
// time is then songBeat + offset.
//
// ── THE LANDING, by watching the wordmark ────────────────────────
// The logo is the only large red mass in the frame. Each frame's
// red-dominant pixels give a vertical centroid; the fall is a clean
// downward sweep and the hold is a flat line, so the landing is where
// the sweep meets the line - fitted, not eyeballed, which places it
// BETWEEN frames. A capture at 30 fps cannot say "on the beat" to
// better than 33 ms; the fit can.
//
// PASS: landing inside [-50 ms, +15 ms] of the beat. Asymmetric on
// purpose: an impact seen slightly EARLY fuses with its sound (light
// arrives first in nature); an impact HEARD first reads as a missed
// cue, and that is the exact complaint this exists to catch.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const FILE = process.argv[2] ?? 'test-harness/intro/intro.mp4';
const SR = 12000;
const SONG_BEAT = 21.013;            // bar 12, the slam's onset (themeOnsets.py)

const run = (args) => execFileSync('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });

// ── audio: envelope xcorr, video vs source ─────────────────────────
run(['-y', '-v', 'error', '-i', FILE, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '/tmp/sync-vid.pcm']);
run(['-y', '-v', 'error', '-i', 'src/assets/intro/theme.mp3', '-ac', '1', '-ar', String(SR), '-f', 'f32le', '/tmp/sync-src.pcm']);
const vid = new Float32Array(readFileSync('/tmp/sync-vid.pcm').buffer);
const src = new Float32Array(readFileSync('/tmp/sync-src.pcm').buffer);

/** 5 ms RMS envelope, decimated to 1 ms steps - plenty for +-2 ms. */
function envelope(x) {
  const w = (SR * 0.005) | 0, step = (SR * 0.001) | 0;
  const out = new Float32Array(Math.max(0, ((x.length - w) / step) | 0));
  for (let i = 0; i < out.length; i++) {
    let s = 0; const o = i * step;
    for (let j = 0; j < w; j++) s += x[o + j] * x[o + j];
    out[i] = Math.sqrt(s / w);
  }
  return out;   // 1 sample = 1 ms
}
const ev = envelope(vid), es = envelope(src);
// The groove window of the SOURCE, slid across the video's whole length.
const s0 = 15000, s1 = 25000;
let best = 0, bestAt = 0;
for (let off = -2000; off < 8000; off++) {
  let c = 0, n = 0;
  for (let i = s0; i < s1; i += 2) {
    const vv = ev[i + off];   // src ms i sits at video ms i+off
    if (vv === undefined) continue;
    c += es[i] * vv; n++;
  }
  if (n > 3000 && c > best) { best = c; bestAt = off; }
}
const audioOffsetMs = bestAt;   // videoTime = songTime + audioOffsetMs/1000
const beatVideoT = SONG_BEAT + audioOffsetMs / 1000;
console.log(`audio offset: video = song ${audioOffsetMs >= 0 ? '+' : '-'} ${Math.abs(audioOffsetMs)} ms  ->  beat at ${beatVideoT.toFixed(3)} s of video`);

// ── video: the wordmark's centroid per frame around the beat ───────
const F0 = Math.max(0, beatVideoT - 1.2), F1 = beatVideoT + 0.8;
const W = 320, H = 180, FPS = 60;   // decode at 60 fps for a denser fit
run(['-y', '-v', 'error', '-ss', F0.toFixed(3), '-t', (F1 - F0).toFixed(3), '-i', FILE,
  '-vf', `fps=${FPS},scale=${W}:${H}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '/tmp/sync-frames.raw']);
const raw = readFileSync('/tmp/sync-frames.raw');
const frameBytes = W * H * 3;
const frames = (raw.length / frameBytes) | 0;
const pts = [];
for (let f = 0; f < frames; f++) {
  let sy = 0, n = 0;
  const base = f * frameBytes;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = base + (y * W + x) * 3;
      const r = raw[o], g = raw[o + 1], b = raw[o + 2];
      if (r > 130 && r > g + 55 && r > b + 55) { sy += y; n++; }
    }
  }
  if (n > 150) pts.push({ t: F0 + f / FPS, y: sy / n });
}
if (pts.length < 8) { console.log('FAIL: the wordmark was not found falling'); process.exit(1); }

// The hold level = median of the last quarter; the landing = the fitted
// fall crossing that level. Fit the last 5 falling samples linearly -
// near touchdown the quadratic is locally linear and 5 points at 60 fps
// span ~80 ms of the fastest part of the drop.
const holdY = pts.slice(-Math.max(4, (pts.length / 4) | 0)).map((p) => p.y).sort((a, b) => a - b);
const settle = holdY[(holdY.length / 2) | 0];
const falling = pts.filter((p) => p.y < settle - 4);
if (falling.length < 5) { console.log('FAIL: no fall observed before the hold'); process.exit(1); }
const tail = falling.slice(-5);
const mx = tail.reduce((a, p) => a + p.t, 0) / tail.length;
const my = tail.reduce((a, p) => a + p.y, 0) / tail.length;
let num = 0, den = 0;
for (const p of tail) { num += (p.t - mx) * (p.y - my); den += (p.t - mx) ** 2; }
const slope = num / den;                       // px per second, downward positive
const landT = mx + (settle - my) / slope;      // where the sweep meets the line
const deltaMs = (landT - beatVideoT) * 1000;

console.log(`landing (fitted): ${landT.toFixed(3)} s   beat: ${beatVideoT.toFixed(3)} s   delta: ${deltaMs >= 0 ? '+' : ''}${deltaMs.toFixed(0)} ms ${deltaMs >= 0 ? '(visual AFTER audio)' : '(visual before audio)'}`);
const ok = deltaMs >= -50 && deltaMs <= 15;
console.log(ok ? 'PASS: the landing sits on the beat' : 'FAIL: the landing is off the beat');
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ audioOffsetMs, beatVideoT, landT, deltaMs, ok }));
}
process.exit(ok ? 0 : 1);
