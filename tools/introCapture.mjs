// Frame-accurate DIRECTOR'S PREVIEW, not a claim about hardware playback.
// Each PNG is the real intro DOM/WebGL renderer evaluated at frame / fps.
// Source music begins at exactly zero; NO corrective offset or remux loop.
// Live synchronization and the tap/volume handoff are verified by introProbe.
// Run: node tools/introCapture.mjs [output-directory]
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { TITLE_IMPACT_TIME } from '../src/ui/introCue.js';

const out = process.argv[2] ?? 'test-harness/intro';
const frames = `${out}/frames`;
const fps = 30, duration = 26;
mkdirSync(frames, { recursive: true });
const server = await createServer({ server: { port: 5202, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: [
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await page.goto('http://localhost:5202/play/?introdebug&introat=0');
  await page.waitForFunction(() => window.__intro?.state.phase === 'playing' && window.__intro.state.landscapeReady, null, { timeout: 30000 });
  for (let i = 0; i < duration * fps; i++) {
    const t = i / fps;
    const n = await page.evaluate(t => window.__intro.seek(t), t);
    await page.waitForFunction(({ n, t }) => window.__intro.state.frames > n && window.__intro.state.time === t, { n, t });
    await page.screenshot({ path: `${frames}/${String(i).padStart(5, '0')}.png` });
    if (i % fps === 0) console.log(`preview ${i / fps}/${duration}s`);
  }
  assert.equal(readdirSync(frames).filter(name => name.endsWith('.png')).length, duration * fps,
    'the preview must contain every frame');
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(fps), '-i', `${frames}/%05d.png`, '-i', 'src/assets/intro/theme.mp3', '-t', String(duration), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-af', 'volume=0.82', '-movflags', '+faststart', `${out}/daggerfall-intro-preview.mp4`]);
  const media = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,start_time,duration', '-of', 'json', `${out}/daggerfall-intro-preview.mp4`], { encoding: 'utf8' }));
  assert.deepEqual(media.streams.map(stream => stream.codec_type).sort(), ['audio', 'video']);
  assert.ok(media.streams.every(stream => Number(stream.start_time) === 0), 'picture and source score start together');
  assert.ok(Math.abs(Number(media.format.duration) - duration) < 1 / fps, 'the preview has the authored duration');
  writeFileSync(`${out}/preview-method.json`, JSON.stringify({ type: 'deterministic-rendered-preview', fps, duration, audioOffset: 0, titleImpactTime: TITLE_IMPACT_TIME, firstLandedFrame: Math.ceil(TITLE_IMPACT_TIME * fps), handoff: 'Real tap/fade/continued audio verified separately in browser-report.json', hardwareClaim: 'None: see live-timing.json for live browser measurements' }, null, 2));
} finally { await browser.close(); await server.close(); rmSync(frames, { recursive: true, force: true }); }
