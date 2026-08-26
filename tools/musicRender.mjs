// A5: render a song to a WAV so a human can HEAR it.
//
// The probe proves the graph emits signal. This proves it emits MUSIC -
// it renders offline through the REAL production voice code (SongPlayer
// ._voice, gmSynth's specs) and writes a file you can play.
//
// Usage: node tools/musicRender.mjs [SONG.HMI] [seconds] [out.wav]
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const SONG = process.argv[2] || 'DUNGEON.HMI';
const SECONDS = Number(process.argv[3] || 20);
const OUT = process.argv[4] || '/tmp/song.wav';
const RATE = 22050;

const server = await createServer({ server: { port: 5207, strictPort: true } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
page.on('console', (m) => { const t = m.text(); if (/music|MIDI|error/i.test(t)) console.log('[page]', t); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.route('**/', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><body>' }));
await page.goto('http://localhost:5207/play/');

const out = await page.evaluate(async ({ SONG, SECONDS, RATE }) => {
  const { MidiBsaFile } = await import('/src/formats/hmiFile.js');
  const { SongPlayer, applyChannelEvents, freshChannelState } = await import('/src/systems/songPlayer.js');
  const { fetchBytes } = await import('/src/scenes/shared.js');

  const bsa = new MidiBsaFile();
  bsa.load(await fetchBytes('MIDI.BSA'));
  const idx = bsa.getSongIndex(SONG);
  if (idx === null || idx < 0) return { error: `no song ${SONG}` };
  const song = bsa.getSong(idx);

  const off = new OfflineAudioContext(2, Math.ceil(SECONDS * RATE), RATE);
  const p = new SongPlayer(off);
  p._ensureMaster();
  p._state = freshChannelState();
  p._originTime = 0;

  // Fold state forward event by event and schedule every note - the same
  // production _voice the live player calls, just without the lookahead
  // loop, which offline rendering does not need.
  let notes = 0;
  for (const e of song.events) {
    const t = e.tick * song.secondsPerTick;
    if (t > SECONDS) break;
    applyChannelEvents(p._state, [e]);
    if (e.type === 'noteOn' && e.velocity) {
      p._voice(e, t, (e.duration || 0) * song.secondsPerTick);
      notes++;
    }
  }
  const buf = await off.startRendering();
  const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;

  // 16-bit PCM WAV
  const n = buf.length;
  const bytes = new Uint8Array(44 + n * 4);
  const dv = new DataView(bytes.buffer);
  const wstr = (o, s) => { for (let i = 0; i < s.length; i++) bytes[o + i] = s.charCodeAt(i); };
  wstr(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); wstr(8, 'WAVE');
  wstr(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
  dv.setUint16(22, 2, true); dv.setUint32(24, RATE, true); dv.setUint32(28, RATE * 4, true);
  dv.setUint16(32, 4, true); dv.setUint16(34, 16, true);
  wstr(36, 'data'); dv.setUint32(40, n * 4, true);
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const l = Math.max(-1, Math.min(1, L[i])), r = Math.max(-1, Math.min(1, R[i]));
    peak = Math.max(peak, Math.abs(l), Math.abs(r));
    dv.setInt16(44 + i * 4, l * 32767, true);
    dv.setInt16(46 + i * 4, r * 32767, true);
  }
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode(...bytes.subarray(i, i + CH));
  return { b64: btoa(bin), notes, peak, seconds: song.durationSeconds, tracks: song.tracks.length };
}, { SONG, SECONDS, RATE });

if (out.error) { console.log('ERROR', out.error); }
else {
  writeFileSync(OUT, Buffer.from(out.b64, 'base64'));
  console.log(`${SONG}: ${out.notes} notes, ${out.tracks} tracks, song ${out.seconds.toFixed(1)}s, peak ${out.peak.toFixed(3)} -> ${OUT}`);
}
await browser.close();
await server.close();
