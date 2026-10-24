// SEA-SCORE - THE SEA'S MUSIC, PLAYED BY THE GAME'S OWN PLAYER IN A REAL BROWSER, RENDERED AND MEASURED (the Warden's
// and the Hour's probes' method, tools/gateScoreProbe.mjs, tools/sdScoreProbe.mjs).
//
// node holds the score's shape and its law (test/systems/soundscape/seascore.test.js); what node cannot answer is what the
// songs SOUND like through systems/song/songPlayer.js and the FM bank: whether every second of each sounds, whether any
// clips at the highest MusicVolume, and - the sea's own question - whether they sit where Daggerfall's own outdoor songs
// sit, since a helm hears them in place of SUNNYDAY and its kin: never a boss's level. With the player's ARENA2 at hand
// (ARENA2_PATH, `sh tools/fetch-data.sh`) the day, cloudy, night and rain songs of MIDI.BSA are rendered through the same
// player and measured beside them; without it the comparison is skipped and said so.
//
//     node tools/seaScoreProbe.mjs [--wav <dir>] [--seconds <n>]
//         --wav writes each render there as 16-bit WAV, normalised to -1 dBFS, for a person to listen to
//         --seconds renders only so much of each song (default: the whole of it - AUDIT SOUNDSCAPE M4: the first cut
//         measured 30 s, 11 to 26 bars of songs 32 to 64 long, and never heard the storm's stabs or the fight's tutti)
import { chromium } from 'playwright';
import http from 'node:http';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null);
const wavAt = arg('--wav');
const SECONDS = Number(arg('--seconds') ?? 1e9);
const ARENA2 = process.env.ARENA2_PATH ?? '/home/claude/dfdata/arena2';
const MIDI_BSA = join(ARENA2, 'MIDI.BSA');
const out = []; const check = (n, ok, d = '') => { out.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${d ? ` - ${d}` : ''}`); };
const KEYS = ['calm', 'open', 'storm', 'night', 'port', 'fight'];
/** DFU's outdoor songs a helm heard before (systems/song/songManager.js SUNNY_SONGS, CLOUDY_SONGS, NIGHT_SONGS, RAIN_SONGS). */
const CLASSIC = ['SUNNYDAY.HMI', 'GDAY___D.HMI', 'GSUNNY2.HMI', '02.HMI', '29.HMI', 'OVERCAST.HMI', '10.HMI', 'GEERIE.HMI', 'RAINING.HMI'];

const PAGE = `<!doctype html><html><body><script type=module>
import { SongPlayer } from '/src/systems/song/songPlayer.js';
import { MidiBsaFile } from '/src/formats/hmiFile.js';
import { seaScoreSongs } from '/src/systems/soundscape/seaScore.js';
const RATE = 44100;
let bsa = null;
window.loadBsa = async () => {
  const r = await fetch('/arena2/MIDI.BSA');
  if (!r.ok) return false;
  bsa = new MidiBsaFile();
  return bsa.load(new Uint8Array(await r.arrayBuffer()));
};
const measure = async (song, seconds) => {
  const secs = Math.min(seconds, song.durationTicks * song.secondsPerTick - 0.5);
  const real = new OfflineAudioContext(2, Math.ceil(RATE * secs), RATE);
  let now = 0;
  const ctx = new Proxy(real, { get(t, k) { if (k === 'currentTime') return now; const v = t[k]; return typeof v === 'function' ? v.bind(t) : v; } });
  const p = new SongPlayer(ctx, real.destination);
  p.play(song);
  clearInterval(p._timer);
  for (now = 0; now < secs; now += 0.1) p._pump();
  const buf = await real.startRendering();
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  let peak = 0, nan = 0;
  const rms = [];
  for (let s = 0; s < Math.floor(secs); s++) {
    let acc = 0;
    for (let i = s * RATE; i < (s + 1) * RATE; i++) { const a = L[i], b = R[i]; if (!Number.isFinite(a) || !Number.isFinite(b)) { nan++; continue; } acc += a * a + b * b; peak = Math.max(peak, Math.abs(a), Math.abs(b)); }
    rms.push(Math.sqrt(acc / (2 * RATE)));
  }
  const k = peak > 0 ? 0.89 / peak : 1;
  const pcm = new Int16Array(L.length * 2);
  for (let i = 0; i < L.length; i++) { pcm[2 * i] = Math.max(-32767, Math.min(32767, Math.round(L[i] * k * 32767))); pcm[2 * i + 1] = Math.max(-32767, Math.min(32767, Math.round(R[i] * k * 32767))); }
  const bytes = new Uint8Array(pcm.buffer);
  let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { secs, peak, nan, rms, voices: [...new Set(song.events.filter((e) => e.type === 'noteOn').map((e) => e.channel))].length, pcm: btoa(bin), rate: RATE };
};
window.render = (key, seconds) => measure(seaScoreSongs()[key], seconds);
window.renderClassic = (name, seconds) => { const i = bsa?.getSongIndex(name); return i == null || i < 0 ? null : measure(bsa.getSong(i), seconds); };
window.ready = true;
</script></body></html>`;

function wav(pcmB64, rate) {
  const data = Buffer.from(pcmB64, 'base64');
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/probe/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE); return; }
  if (url === '/arena2/MIDI.BSA') {
    if (!existsSync(MIDI_BSA)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': 'application/octet-stream' }); res.end(readFileSync(MIDI_BSA)); return;
  }
  const f = join(ROOT, url);
  if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': extname(f) === '.js' ? 'text/javascript' : extname(f) === '.json' ? 'application/json' : 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
try {
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/probe/`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
  const db = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
  // the loudness of the whole render (its first second, the band's attack, left out) - M4: it was seconds 1 to 24 alone
  const loudness = (rms) => { const loud = rms.slice(1); return db(Math.sqrt(loud.reduce((a, b) => a + b * b, 0) / loud.length)); };
  const r = {};
  for (const key of KEYS) {
    r[key] = await page.evaluate(([k, s]) => window.render(k, s), [key, SECONDS]);
    r[key].meanDb = loudness(r[key].rms);
    console.log(`     ${key}: ${r[key].secs.toFixed(1)} s, peak ${db(r[key].peak).toFixed(1)} dBFS, loudness ${r[key].meanDb.toFixed(1)} dBFS, ${r[key].voices} voices`);
    if (wavAt) writeFileSync(join(wavAt, `${key}.wav`), wav(r[key].pcm, r[key].rate));
  }
  for (const key of KEYS) check(`${key}: it plays - every second of it sounding, no NaN`, r[key].nan === 0 && r[key].rms.every((x) => x > 1e-4), r[key].rms.slice(0, 12).map((x) => db(x).toFixed(0)).join(' '));
  // the highest MusicVolume is twice the 0.5 this renders at: +6 dB - under the clip there
  for (const key of KEYS) check(`${key}: under the clip at the highest MusicVolume`, db(r[key].peak) + 6.02 <= -1, `${(db(r[key].peak) + 6.02).toFixed(2)} dBFS at full volume`);
  check('the night under the open sea, the storm and the fight over the still sea', r.night.meanDb < r.open.meanDb && r.storm.meanDb > r.calm.meanDb && r.fight.meanDb > r.calm.meanDb,
    KEYS.map((k) => `${k} ${r[k].meanDb.toFixed(1)}`).join(', '));
  const haveBsa = existsSync(MIDI_BSA) && await page.evaluate(() => window.loadBsa());
  if (!haveBsa) console.log(`     (no MIDI.BSA at ${MIDI_BSA}: the comparison with Daggerfall's own songs is skipped)`);
  else {
    const c = {};
    for (const name of CLASSIC) {
      const m = await page.evaluate(([n, s]) => window.renderClassic(n, s), [name, SECONDS]);
      if (!m) { console.log(`     ${name}: not in the archive`); continue; }
      c[name] = loudness(m.rms);
      console.log(`     ${name}: loudness ${c[name].toFixed(1)} dBFS, peak ${db(m.peak).toFixed(1)} dBFS`);
    }
    const vals = Object.values(c);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const day = ['SUNNYDAY.HMI', 'GDAY___D.HMI', 'GSUNNY2.HMI'].map((n) => c[n]).filter(Number.isFinite);
    const dayDb = day.reduce((a, b) => a + b, 0) / day.length;
    // a helm's songs inside the range of the songs they stand in for - none a boss's level over them (the Warden's war
    // reads -15.8 dBFS) - and the open sea and landfall, which stand in for the day songs, within 2 dB of them
    for (const key of KEYS) check(`${key}: inside Daggerfall's outdoor songs (${lo.toFixed(1)} to ${hi.toFixed(1)} dBFS, a decibel over at most)`, r[key].meanDb >= lo && r[key].meanDb <= hi + 1, `${r[key].meanDb.toFixed(1)} dBFS`);
    for (const key of ['open', 'port']) check(`${key}: within 2 dB of the day songs (${dayDb.toFixed(1)} dBFS)`, Math.abs(r[key].meanDb - dayDb) <= 2, `${r[key].meanDb.toFixed(1)} dBFS`);
  }
  check('no page error', errs.length === 0, errs.join('; '));
} finally {
  await browser.close();
  server.close();
}
const failed = out.filter((o) => !o).length;
console.log(`\n${out.length - failed}/${out.length} checks passed`);
process.exit(failed ? 1 : 0);
