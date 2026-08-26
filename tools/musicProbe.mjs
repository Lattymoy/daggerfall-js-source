// A5: does the music layer actually make a sound?
//
// A pin can prove the scheduler picks the right song and computes the
// right times; only a real browser proves the audio graph produces
// signal. This taps an AnalyserNode onto the shared AudioContext's
// destination and measures RMS over several seconds, so "music plays"
// is a MEASUREMENT rather than "nothing threw".
//
// Usage: node tools/musicProbe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const server = await createServer({ server: { port: 5206, strictPort: true } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => { const t = m.text(); if (/music|MIDI|song|error/i.test(t)) console.log('[page]', t); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

// A MINIMAL PAGE, not the game. Booting a whole dungeon host to ask
// "does the synth make a sound" couples this probe to every other
// system; intercepting the root and serving one script isolates the
// audio question, and the modules under test are the real ones vite
// serves from src/.
await page.route('**/', (route) => route.fulfill({
  status: 200,
  contentType: 'text/html',
  body: '<!doctype html><meta charset="utf-8"><title>music probe</title><body><canvas id="c"></canvas>',
}));
await page.goto('http://localhost:5206/play/');
await page.mouse.click(200, 200);          // the gesture that allows audio

const result = await page.evaluate(async () => {
  const mod = await import('/src/systems/music.js');
  const aud = await import('/src/systems/audio.js');
  const { DUNGEON_SONGS } = await import('/src/systems/songManager.js');
  const { fetchBytes } = await import('/src/scenes/shared.js');

  await aud.audio.ensure(fetchBytes);
  await mod.music.ensure(fetchBytes);
  if (!mod.music.enabled) return { error: 'MIDI.BSA did not load' };

  // The context is created lazily on gesture; force it up for the probe.
  aud.audio._ensureCtx();
  const ctx = aud.audio.ctx;
  if (!ctx) return { error: 'no AudioContext' };
  if (ctx.state === 'suspended') await ctx.resume();

  const started = mod.music.playFrom(DUNGEON_SONGS, { gameDays: 0 });
  const player = mod.music.player;
  if (!player) return { error: 'no player', started, ctxState: ctx.state };

  const an = ctx.createAnalyser();
  an.fftSize = 2048;
  player._master.connect(an);

  const buf = new Float32Array(an.fftSize);
  const samples = [];
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 150));
    an.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let j = 0; j < buf.length; j++) sum += buf[j] * buf[j];
    samples.push(Math.sqrt(sum / buf.length));
  }
  return {
    ctxState: ctx.state,
    started,
    current: mod.music.current,
    playing: !!player.playing,
    songSeconds: player.song?.durationSeconds,
    events: player.song?.events?.length,
    peakRms: Math.max(...samples),
    meanRms: samples.reduce((a, b) => a + b, 0) / samples.length,
    audibleFrames: samples.filter((s) => s > 0.001).length,
    frames: samples.length,
  };
});
console.log(JSON.stringify(result, null, 2));

// T3: the question in this file's own header is "does the music layer
// actually make a sound?", and the answer was sitting in peakRms and
// audibleFrames while the probe exited 0 either way - so a silent
// audio graph, which is the entire thing it was built to catch, read
// as a pass. `> 0.001` is the same audibility floor the sampler above
// already uses for audibleFrames; a MAJORITY of the forty frames must
// clear it, because a single click at the start is not music.
const verdict = [];
if (result.error) verdict.push(result.error);
else {
  if (!result.playing) verdict.push('the player is not playing');
  if (!(result.peakRms > 0.001)) verdict.push(`silence: peakRms ${result.peakRms}`);
  if (!(result.audibleFrames > result.frames / 2)) {
    verdict.push(`mostly silent: ${result.audibleFrames}/${result.frames} frames above the floor`);
  }
}
if (verdict.length) for (const v of verdict) console.log(`FAIL: ${v}`);
else console.log(`MUSIC AUDIBLE: peak ${result.peakRms.toFixed(4)}, ${result.audibleFrames}/${result.frames} frames`);

await browser.close();
await server.close();
process.exit(verdict.length ? 1 : 0);
