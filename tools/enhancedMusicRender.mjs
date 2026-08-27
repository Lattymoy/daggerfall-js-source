// ENHANCED MUSIC - render a composed piece to a WAV so a human can HEAR
// it. (EM1.) No game data: the composer needs a palette and a seed, and
// the render goes through the REAL production voice code (SongPlayer
// ._voice, the FM bank) exactly as tools/musicRender.mjs renders an
// archive song. What comes out is what the game would play.
//
//   node tools/enhancedMusicRender.mjs [environment] [seed-words...] [--seconds N] [--out file.wav]
//   node tools/enhancedMusicRender.mjs dungeonInterior Privateer Hold --seconds 60
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const args = process.argv.slice(2);
const flag = (name, dflt) => { const i = args.indexOf(name); if (i < 0) return dflt; const v = args[i + 1]; args.splice(i, 2); return v; };
const SECONDS = Number(flag('--seconds', 45));
const OUT = flag('--out', '/tmp/enhanced.wav');
const ROOT = flag('--root', null);     // EM2c: compose in a scored track's key
const MODE = flag('--mode', null);
const ENV = args[0] || 'dungeonInterior';
const SEED_WORDS = args.slice(1).length ? args.slice(1) : ['Privateer', 'Hold'];
const RATE = 22050;

const server = await createServer({ server: { port: 5234, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.route('**/', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><body>' }));
await page.goto('http://localhost:5234/play/');

const out = await page.evaluate(async ({ ENV, SEED_WORDS, SECONDS, RATE, ROOT, MODE }) => {
  const { composeScore } = await import('/src/systems/enhancedMusic/composer.js');
  const { paletteFor } = await import('/src/systems/enhancedMusic/palettes.js');
  const { hashSeed } = await import('/src/systems/enhancedMusic/theory.js');
  const { SongPlayer, applyChannelEvents, freshChannelState } = await import('/src/systems/songPlayer.js');
  const palette = paletteFor(ENV);
  if (!palette) return { error: `no palette for ${ENV}` };
  const song = composeScore(palette, hashSeed(...SEED_WORDS), { root: ROOT === null ? undefined : Number(ROOT), mode: MODE ?? undefined });
  const off = new OfflineAudioContext(2, Math.ceil(SECONDS * RATE), RATE);
  const p = new SongPlayer(off);
  p._ensureMaster();
  p._state = freshChannelState();
  p._originTime = 0;
  let notes = 0;
  for (const e of song.events) {
    const t = e.tick * song.secondsPerTick;
    if (t > SECONDS) break;
    applyChannelEvents(p._state, [e]);
    if (e.type === 'noteOn' && e.velocity) { p._voice(e, t, (e.duration || 0) * song.secondsPerTick); notes++; }
  }
  const buf = await off.startRendering();
  const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
  const n = buf.length;
  const bytes = new Uint8Array(44 + n * 4);
  const dv = new DataView(bytes.buffer);
  const wstr = (o, s) => { for (let i = 0; i < s.length; i++) bytes[o + i] = s.charCodeAt(i); };
  wstr(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); wstr(8, 'WAVE');
  wstr(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
  dv.setUint16(22, 2, true); dv.setUint32(24, RATE, true); dv.setUint32(28, RATE * 4, true);
  dv.setUint16(32, 4, true); dv.setUint16(34, 16, true);
  wstr(36, 'data'); dv.setUint32(40, n * 4, true);
  let peak = 0, sq = 0;
  for (let i = 0; i < n; i++) {
    const l = Math.max(-1, Math.min(1, L[i])), r = Math.max(-1, Math.min(1, R[i]));
    peak = Math.max(peak, Math.abs(l), Math.abs(r)); sq += l * l;
    dv.setInt16(44 + i * 4, l * 32767, true); dv.setInt16(46 + i * 4, r * 32767, true);
  }
  let bin = ''; const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode(...bytes.subarray(i, i + CH));
  return { b64: btoa(bin), notes, peak, rms: Math.sqrt(sq / n), meta: song.meta, loopSeconds: song.durationTicks * song.secondsPerTick, name: song.name };
}, { ENV, SEED_WORDS, SECONDS, RATE, ROOT, MODE });

if (out.error) console.log('ERROR', out.error);
else {
  writeFileSync(OUT, Buffer.from(out.b64, 'base64'));
  console.log(`${out.name}: ${out.meta.mode} on ${out.meta.root}, ${out.meta.bpm} bpm, loop ${out.loopSeconds.toFixed(0)}s; rendered ${SECONDS}s, ${out.notes} notes, peak ${out.peak.toFixed(3)} rms ${out.rms.toFixed(3)} -> ${OUT}`);
}
await browser.close();
await server.close();
