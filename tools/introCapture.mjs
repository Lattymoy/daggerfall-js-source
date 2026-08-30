// RECORD THE INTRO AS AN MP4, music aligned to the frame.
//
// The probe freezes bars and reads positions; this watches the whole
// performance and writes it down, because "does the slam land ON the
// beat" is finally a question about a moving picture with sound, and
// the first person to ever see this intro in motion should not have to
// be Mac on the deployed site.
//
// ── HOW THE SYNC IS EXACT, NOT VIBES ─────────────────────────────
//
// Headless Chromium is launched with autoplay allowed and audio muted,
// so the REAL theme element plays and the intro runs on its real clock
// - the same code path a player gets. While the screencast collects
// frames (each stamped with an epoch time by CDP), a sampler polls the
// theme element's currentTime through the page's own module registry
// and pairs it with the same epoch. The median of (epoch - songTime)
// is the offset between the wall and the song; the muxed audio is the
// theme file sought to firstFrameEpoch - offset. Every cue in the
// video therefore sits against the recording exactly where the page
// put it, dropped frames and all.
//
// ── AND THE FILE IS MEASURED BEFORE IT IS BELIEVED ───────────────
//
// v4's capture reported clean offsets and delivered a landing +255 ms
// after the beat - the sampler's currentTime and the audible output
// are different clocks, and SwiftShader's render latency sits between
// the page's clock and every captured frame. So the mux is now a
// LOOP: write the file, run tools/introSyncCheck.mjs on it (the beat
// by cross-correlation, the landing by watching the wordmark), and
// re-mux with the measured correction until the landing sits at
// -20 ms of the beat - a breath EARLY, because an impact heard before
// it is seen reads as a missed cue and one seen a breath early fuses.
// Frames are captured once; only the audio placement iterates.
//
//     node tools/introCapture.mjs [out.mp4]
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';

const OUT = process.argv[2] ?? 'test-harness/intro/intro.mp4';
const TMP = 'test-harness/intro/frames';

const server = await createServer({ server: { port: 5199 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});

try {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const frames = [];
  const cdp = await page.context().newCDPSession(page);
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    frames.push({ t: metadata.timestamp, data });
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });

  await page.goto('http://localhost:5199/play/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#intro canvas', { timeout: 20000 });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 85, everyNthFrame: 1 });

  // The wall<->song pairing. The audio element is not in the DOM (the
  // theme module owns it), but the dev server serves the same module
  // graph the page runs, so importing it back returns the same
  // instance and the same element.
  const pairs = [];
  const sample = async () => {
    try {
      const s = await page.evaluate(async () => {
        const m = await import('/src/systems/introTheme.js');
        const el = m.themeElement();
        return el && !el.paused ? { song: el.currentTime, epoch: Date.now() / 1000 } : null;
      });
      if (s) pairs.push(s);
    } catch { /* navigating away; the sampler simply stops learning */ }
  };
  const sampler = setInterval(sample, 150);

  await page.waitForSelector('#enhanced-menu', { timeout: 120000 });
  await page.waitForTimeout(2000);   // a breath of the menu at the end
  clearInterval(sampler);
  await cdp.send('Page.stopScreencast');

  if (frames.length < 30 || pairs.length < 10) {
    throw new Error(`too little captured: ${frames.length} frames, ${pairs.length} clock pairs`);
  }

  // offset = wall epoch of song-time zero; median rejects the odd
  // stalled sample without needing to model why it stalled.
  const offsets = pairs.map((p) => p.epoch - p.song).sort((a, b) => a - b);
  const offset = offsets[offsets.length >> 1];
  const audioStart = frames[0].t - offset;

  const lines = [];
  frames.forEach((f, i) => {
    writeFileSync(`${TMP}/f${String(i).padStart(5, '0')}.jpg`, Buffer.from(f.data, 'base64'));
    const dur = (i + 1 < frames.length ? frames[i + 1].t : frames[i].t + 1 / 30) - f.t;
    lines.push(`file 'f${String(i).padStart(5, '0')}.jpg'`, `duration ${Math.max(0.001, dur).toFixed(4)}`);
  });
  writeFileSync(`${TMP}/list.txt`, lines.join('\n') + '\n');

  const total = frames[frames.length - 1].t - frames[0].t;
  const mux = (startAt) => {
    // A POSITIVE start trims the source; a NEGATIVE one must insert
    // real silence. -itsoffset only moves container timestamps, and
    // the delay silently vanished on decode - four correction passes
    // measured the identical +150 ms because the file never changed.
    // adelay writes actual samples, which every decoder must honour.
    const src = startAt >= 0
      ? ['-ss', startAt.toFixed(3), '-i', 'src/assets/intro/theme.mp3']
      : ['-i', 'src/assets/intro/theme.mp3'];
    const filt = startAt >= 0 ? [] : ['-af', `adelay=${Math.round(-startAt * 1000)}:all=1`];
    execFileSync('ffmpeg', [
      '-y', '-f', 'concat', '-safe', '0', '-i', `${TMP}/list.txt`,
      ...src, ...filt,
      '-t', total.toFixed(3),
      '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
      '-preset', 'medium', '-crf', '20', '-c:a', 'aac', '-b:a', '192k', '-shortest', OUT,
    ], { stdio: 'pipe' });
  };
  // The sign picks the mechanism (a negative -ss reads as zero and
  // slid a whole score 120 ms early once): positive trims the front of
  // the audio, negative DELAYS it.
  let startAt = audioStart;
  const TARGET = -20;   // ms; the landing sits a breath EARLY of the beat
  let verdict = null;
  for (let pass = 0; pass < 4; pass++) {
    mux(startAt);
    let out = '';
    try {
      out = execFileSync('node', ['tools/introSyncCheck.mjs', OUT, '--json'],
        { encoding: 'utf8' });
    } catch (e) { out = String(e.stdout ?? ''); }
    const line = out.trim().split('\n').find((l) => l.startsWith('{'));
    if (!line) { console.log(out); throw new Error('syncCheck gave no measurement'); }
    verdict = JSON.parse(line);
    console.log(`pass ${pass}: landing ${verdict.deltaMs >= 0 ? '+' : ''}${verdict.deltaMs.toFixed(0)} ms of the beat`);
    if (Math.abs(verdict.deltaMs - TARGET) <= 12) break;
    // Landing late means the audio must come later too: push the score
    // by the miss. The frames never move; only the placement does.
    startAt -= (verdict.deltaMs - TARGET) / 1000;
  }
  if (Math.abs(verdict.deltaMs - TARGET) > 12) {
    throw new Error(`could not converge: landing ${verdict.deltaMs.toFixed(0)} ms off after re-muxing`);
  }
  console.log(`wrote ${OUT}: ${frames.length} frames over ${total.toFixed(1)}s, `
    + `audio placed by measurement (${pairs.length} clock pairs, landing ${verdict.deltaMs.toFixed(0)} ms)`);
} finally {
  await browser.close();
  await server.close();
}
