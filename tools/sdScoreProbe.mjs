// SD13 - THE SCORE OF THE HOUR, PLAYED BY THE GAME'S OWN PLAYER IN A REAL BROWSER, RENDERED AND MEASURED (the Warden's
// own probe's method, tools/gateScoreProbe.mjs).
//
// node holds the score's shape and its law (test/sd13_score.test.js); what node cannot answer is what the songs SOUND
// like through the game's own song player and FM bank: whether every voice the score asks for makes a sound, whether
// the mix clips, whether the war grows as the Remnant's phases do and its last minute over them, whether the places'
// songs sit under the fight's, and whether the fall rings out inside the time the law gives it. So: the repo's own
// modules served as they are, each song played by systems/songPlayer.js into an OfflineAudioContext (the player's
// clock carried through the song window by window), the render read back and measured; and one player through the
// whole Hour - every song and one with no press after them - in one context.
//
//     node tools/sdScoreProbe.mjs [--wav <dir>] [--seconds <n>]
//         --wav writes each render there as 16-bit WAV, normalised to -1 dBFS, for a person to listen to
import { chromium } from 'playwright';
import http from 'node:http';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null);
const wavAt = arg('--wav');
const SECONDS = Number(arg('--seconds') ?? 24);
const out = []; const check = (n, ok, d = '') => { out.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${d ? ` - ${d}` : ''}`); };
const KEYS = ['hollow', 'hall', 'steps', 'war1', 'war2', 'war3', 'last', 'fell', 'gone'];

const PAGE = `<!doctype html><html><body><script type=module>
import { SongPlayer } from '/src/systems/songPlayer.js';
import { sdScoreSongs, HOUR_PRESS, SD_SCORE_STING_MS } from '/src/systems/sdScore.js';
const RATE = 44100;
window.stingS = SD_SCORE_STING_MS / 1000;
window.render = async (key, seconds) => {
  const song = sdScoreSongs()[key];
  const secs = Math.min(seconds, song.durationTicks * song.secondsPerTick - 0.5);   // one pass: the loop's seam is not the song
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
  return { key, secs, peak, nan, rms, ceiling: HOUR_PRESS[key].ceiling, voices: [...new Set(song.events.filter((e) => e.type === 'noteOn').map((e) => e.channel))].length, pcm: btoa(bin), rate: RATE };
};
// one player, the whole Hour and the song after it, a few seconds each, in one context
window.hour = async () => {
  const songs = sdScoreSongs();
  const plain = { name: 'PLAIN', beatsPerMinute: 120, secondsPerTick: 60 / (120 * 60), durationTicks: 480, events: [{ tick: 0, type: 'noteOn', channel: 0, note: 62, velocity: 100, duration: 120 }] };
  const order = [...${JSON.stringify(KEYS)}.map((k) => songs[k]), plain], each = 2;
  const real = new OfflineAudioContext(2, RATE * each * order.length, RATE);
  let now = 0;
  const ctx = new Proxy(real, { get(t, k) { if (k === 'currentTime') return now; const v = t[k]; return typeof v === 'function' ? v.bind(t) : v; } });
  const p = new SongPlayer(ctx, real.destination);
  const routes = [];
  try {
    for (const song of order) {
      p.play(song); clearInterval(p._timer);
      routes.push(p._levelTo === p._fader ? 'plain' : p._levelTo === p._press?.comp ? 'pressed' : 'lost');
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
    const loud = r[key].rms.slice(1, 12);
    r[key].meanDb = db(loud.reduce((a, b) => a + b, 0) / loud.length);
    console.log(`     ${key}: ${r[key].secs.toFixed(1)} s, peak ${db(r[key].peak).toFixed(1)} dBFS, loudness ${r[key].meanDb.toFixed(1)} dBFS, ${r[key].voices} voices`);
    if (wavAt) writeFileSync(join(wavAt, `${key}.wav`), wav(r[key].pcm, r[key].rate));
  }
  for (const key of KEYS) check(`${key}: it plays - every second of it sounding, no NaN`, r[key].nan === 0 && r[key].rms.slice(0, 10).every((x) => x > 1e-4), r[key].rms.slice(0, 10).map((x) => db(x).toFixed(0)).join(' '));
  // the highest MusicVolume is twice the 0.5 this renders at: +6 dB - under each song's own ceiling there
  for (const key of KEYS) check(`${key}: under its ceiling of ${r[key].ceiling} dBFS at the highest MusicVolume`, db(r[key].peak) + 6.02 <= r[key].ceiling + 0.05, `${(db(r[key].peak) + 6.02).toFixed(2)} dBFS at full volume`);
  // the fight as loud as the Warden's (-15.8 / -15.4 / -14.2 dBFS there), the places' songs under it but over the game's own (-28.7 to -41)
  for (const [key, floor] of [['war1', -17], ['war2', -16.5], ['war3', -16], ['last', -16], ['fell', -18], ['steps', -19], ['hall', -23], ['hollow', -24], ['gone', -24]]) check(`${key}: at least ${floor} dBFS`, r[key].meanDb >= floor, `${r[key].meanDb.toFixed(1)} dBFS`);
  check('the war grows with the Remnant\'s phases, the last minute over them', r.war2.meanDb > r.war1.meanDb - 0.3 && r.war3.meanDb > r.war2.meanDb - 0.3 && r.last.meanDb > r.war2.meanDb - 0.3, `${r.war1.meanDb.toFixed(1)} / ${r.war2.meanDb.toFixed(1)} / ${r.war3.meanDb.toFixed(1)} / ${r.last.meanDb.toFixed(1)} dBFS`);
  check('the places under the fight', Math.max(r.hollow.meanDb, r.hall.meanDb, r.gone.meanDb) < r.war1.meanDb, `hollow ${r.hollow.meanDb.toFixed(1)}, hall ${r.hall.meanDb.toFixed(1)}, gone ${r.gone.meanDb.toFixed(1)} vs war1 ${r.war1.meanDb.toFixed(1)} dBFS`);
  // the law gives the fall SD_SCORE_STING_MS from its first note: by then it has rung out
  const stingS = await page.evaluate(() => window.stingS);
  const tail = r.fell.rms.slice(Math.ceil(stingS), 23), top = Math.max(...r.fell.rms.slice(0, 10));
  check('the fall rings out inside the time the law gives it', tail.length > 4 && tail.every((x) => x < top * 0.05), `top ${db(top).toFixed(1)}, from ${Math.ceil(stingS)} s ${tail.map((x) => db(x).toFixed(0)).join(' ')} dBFS`);
  const h = await page.evaluate(() => window.hour());
  check('one player through the whole Hour: every song started, the press on for its nine and off for the song after, nothing thrown, no NaN', h.error === null && h.bad === 0 && h.routes.join() === `${KEYS.map(() => 'pressed').join()},plain`, `${h.error ?? ''} ${h.routes.join()} bad ${h.bad}`);
  check('no page error', errs.length === 0, errs.join('; '));
} finally {
  await browser.close();
  server.close();
}
const failed = out.filter((o) => !o).length;
console.log(`\n${out.length - failed}/${out.length} checks passed`);
process.exit(failed ? 1 : 0);
