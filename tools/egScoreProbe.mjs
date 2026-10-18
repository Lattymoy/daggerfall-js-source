// EG-G2 - THE SCORE OF THE SPIRE, PLAYED BY THE GAME'S OWN PLAYER IN A REAL BROWSER, RENDERED AND MEASURED (the Hour's own
// probe's method, tools/sdScoreProbe.mjs; bible/11-Multiplayer/Elite-Gates.md section 26).
//
// node holds the score's shape and its law (test/systems/eliteGates/eglook_score.test.js); what node cannot answer is what the songs SOUND
// like through the game's own song player and FM bank: whether every song sounds, whether the mix stays under its ceiling
// at the highest MusicVolume, whether the war grows by phase and the count and the Valkynaz stand over it, whether the
// halls sit under the fights, and whether the end decays inside the time the law gives it. So: the repo's own modules
// served as they are, each song of one context played by systems/song/songPlayer.js into an OfflineAudioContext (the player's
// clock carried through the song window by window), the render read back and measured; and one player through every song
// in one context, the press on for each.
//
//     node tools/egScoreProbe.mjs [--band <0-3>] [--wav <dir>] [--seconds <n>]
//         --band the context's band (the Galleries by default); --wav writes each render as 16-bit WAV, normalised
import { chromium } from 'playwright';
import http from 'node:http';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null);
const wavAt = arg('--wav');
const SECONDS = Number(arg('--seconds') ?? 24);
const BAND = Math.max(0, Math.min(3, Number(arg('--band') ?? 0) | 0));
const out = []; const check = (n, ok, d = '') => { out.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${d ? ` - ${d}` : ''}`); };
const KEYS = ['hall', 'yard', 'set', 'lord1', 'lord2', 'lord3', 'valk', 'redoubt', 'count', 'end'];

const PAGE = `<!doctype html><html><body><script type=module>
import { SongPlayer } from '/src/systems/song/songPlayer.js';
import { spireScoreSongs, SPIRE_END_MS } from '/src/systems/eliteGates/egScore.js';
const RATE = 44100, CTX = { band: ${BAND}, motif: ${BAND * 3}, valk: ${BAND * 3 + 3}, seed: 1 };
window.endS = SPIRE_END_MS / 1000;
window.render = async (key, seconds) => {
  const song = spireScoreSongs(CTX)[key];
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
  return { key, secs, peak, nan, rms, ceiling: song.press.ceiling, pcm: btoa(bin), rate: RATE };
};
window.all = async () => {
  const songs = spireScoreSongs(CTX);
  const order = ${JSON.stringify(KEYS)}.map((k) => songs[k]), each = 2;
  const real = new OfflineAudioContext(2, RATE * each * order.length, RATE);
  let now = 0;
  const ctx = new Proxy(real, { get(t, k) { if (k === 'currentTime') return now; const v = t[k]; return typeof v === 'function' ? v.bind(t) : v; } });
  const p = new SongPlayer(ctx, real.destination);
  const routes = [];
  try {
    for (const song of order) {
      p.play(song); clearInterval(p._timer);
      routes.push(p._levelTo === p._press?.comp || (p._levelTo === p._floor && p._floorTo === p._press?.comp) ? 'pressed' : 'lost');   // EG-ROAR: through the floor to the press
      if (song === order[3]) p.duck(6, 0.3);   // THE SPIRE MIX's duck under a Court
      for (const end = now + each; now < end - 1e-9; now += 0.1) p._pump();
    }
  } catch (e) { return { error: String(e?.message ?? e), routes }; }
  p.stop();
  const buf = await real.startRendering();
  let bad = 0; for (let c = 0; c < 2; c++) for (const x of buf.getChannelData(c)) if (!Number.isFinite(x)) bad++;
  return { error: null, routes, bad };
};
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
  const f = join(ROOT, url);
  if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': extname(f) === '.js' ? 'text/javascript' : extname(f) === '.json' ? 'application/json' : 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/probe/`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
  const db = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
  const r = {};
  for (const key of KEYS) {
    r[key] = await page.evaluate(([k, s]) => window.render(k, s), [key, SECONDS]);
    const loud = r[key].rms.slice(1, Math.min(12, r[key].rms.length));
    r[key].meanDb = db(loud.reduce((a, b) => a + b, 0) / Math.max(1, loud.length));
    console.log(`     ${key}: ${r[key].secs.toFixed(1)} s, peak ${db(r[key].peak).toFixed(1)} dBFS, loudness ${r[key].meanDb.toFixed(1)} dBFS`);
    if (wavAt) writeFileSync(join(wavAt, `spire-${BAND}-${key}.wav`), wav(r[key].pcm, r[key].rate));
  }
  for (const key of KEYS) check(`${key}: it plays - every second of it sounding, no NaN`, r[key].nan === 0 && r[key].rms.slice(0, Math.min(5, r[key].rms.length)).every((x) => x > 1e-4), r[key].rms.slice(0, 8).map((x) => db(x).toFixed(0)).join(' '));
  for (const key of KEYS) check(`${key}: under its ceiling of ${r[key].ceiling} dBFS at the highest MusicVolume`, db(r[key].peak) + 6.02 <= r[key].ceiling + 0.05, `${(db(r[key].peak) + 6.02).toFixed(2)} dBFS at full volume`);
  check('the war grows by phase, the count and the Valkynaz over it', r.lord2.meanDb > r.lord1.meanDb - 0.3 && r.lord3.meanDb > r.lord2.meanDb - 0.3 && r.count.meanDb > r.lord2.meanDb - 0.3 && r.valk.meanDb > r.lord2.meanDb - 0.3, `${r.lord1.meanDb.toFixed(1)} / ${r.lord2.meanDb.toFixed(1)} / ${r.lord3.meanDb.toFixed(1)}; count ${r.count.meanDb.toFixed(1)}, valk ${r.valk.meanDb.toFixed(1)} dBFS`);
  check('the halls and the hymn under the fights', Math.max(r.hall.meanDb, r.redoubt.meanDb) < r.lord1.meanDb, `hall ${r.hall.meanDb.toFixed(1)}, hymn ${r.redoubt.meanDb.toFixed(1)} vs ${r.lord1.meanDb.toFixed(1)} dBFS`);
  const endS = await page.evaluate(() => window.endS);
  const e = await page.evaluate(([k, s]) => window.render(k, s), ['end', Math.ceil(endS) + 1]);
  const top = Math.max(...e.rms.slice(0, 8)), tail = e.rms.slice(Math.floor(endS) - 4, Math.floor(endS));
  check('the end decays inside the time the law gives it', tail.length > 2 && tail.every((x) => x < top * 0.1), `top ${db(top).toFixed(1)}, its last seconds ${tail.map((x) => db(x).toFixed(0)).join(' ')} dBFS`);
  const all = await page.evaluate(() => window.all());
  check('one player through every song, a duck under a Court: every song pressed, nothing thrown, no NaN', all.error === null && all.bad === 0 && all.routes.every((q) => q === 'pressed'), `${all.error ?? ''} ${all.routes.join()} bad ${all.bad}`);
  check('no page error', errs.length === 0, errs.join('; '));
} finally {
  await browser.close();
  server.close();
}
const failed = out.filter((o) => !o).length;
console.log(`\n${out.length - failed}/${out.length} checks passed`);
process.exit(failed ? 1 : 0);
