// WB7 - THE WARDEN'S SCORE, PLAYED BY THE GAME'S OWN PLAYER IN A REAL BROWSER, RENDERED AND MEASURED.
//
// node holds the score's shape and its law (test/wb7_boss_audio.test.js); what node cannot answer is what the songs
// SOUND like through the game's own song player and FM bank: whether every voice the score asks for makes a sound,
// whether the mix clips, whether the war songs grow as the phases do, and whether the fall rings out and then leaves
// the court quiet. So: the repo's own modules served as they are, each song played by systems/songPlayer.js into an
// OfflineAudioContext (the player's clock carried through the song window by window, as its own pump carries it), the
// render read back and measured.
//
//     node tools/gateScoreProbe.mjs [--wav <dir>] [--seconds <n>]
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

const PAGE = `<!doctype html><html><body><script type=module>
import { SongPlayer } from '/src/systems/songPlayer.js';
import { gateScoreSongs } from '/src/systems/gateScore.js';
const RATE = 44100;
window.render = async (key, seconds) => {
  const song = gateScoreSongs()[key];
  const secs = Math.min(seconds, song.durationTicks * song.secondsPerTick - 0.5);   // one pass: the loop's seam is not the song
  const real = new OfflineAudioContext(2, Math.ceil(RATE * secs), RATE);
  // the player's clock, carried by hand: it reads ctx.currentTime, which an offline context holds at 0 until it renders
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
  // 16-bit WAV, normalised, for a person
  const k = peak > 0 ? 0.89 / peak : 1;
  const pcm = new Int16Array(L.length * 2);
  for (let i = 0; i < L.length; i++) { pcm[2 * i] = Math.max(-32767, Math.min(32767, Math.round(L[i] * k * 32767))); pcm[2 * i + 1] = Math.max(-32767, Math.min(32767, Math.round(R[i] * k * 32767))); }
  const bytes = new Uint8Array(pcm.buffer);
  let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { key, secs, peak, nan, rms, voices: [...new Set(song.events.filter((e) => e.type === 'noteOn').map((e) => e.channel))].length, pcm: btoa(bin), rate: RATE };
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
  for (const key of ['war1', 'war2', 'war3', 'fell']) {
    r[key] = await page.evaluate(([k, s]) => window.render(k, s), [key, SECONDS]);
    const loud = r[key].rms.slice(1, 12);
    const mean = loud.reduce((a, b) => a + b, 0) / loud.length;
    r[key].meanDb = db(mean);
    console.log(`     ${key}: ${r[key].secs.toFixed(1)} s, peak ${db(r[key].peak).toFixed(1)} dBFS, loudness ${r[key].meanDb.toFixed(1)} dBFS, ${r[key].voices} voices`);
    if (wavAt) writeFileSync(join(wavAt, `${key}.wav`), wav(r[key].pcm, r[key].rate));
  }
  for (const key of ['war1', 'war2', 'war3', 'fell']) check(`${key}: it plays - every second of it sounding, no NaN`, r[key].nan === 0 && r[key].rms.slice(0, 10).every((x) => x > 1e-4), JSON.stringify(r[key].rms.slice(0, 10).map((x) => db(x).toFixed(0))));
  for (const key of ['war1', 'war2', 'war3', 'fell']) check(`${key}: under the effects, never clipping`, r[key].peak < 0.9, `peak ${db(r[key].peak).toFixed(1)} dBFS`);
  check('the war grows with his phases', r.war2.meanDb > r.war1.meanDb && r.war3.meanDb > r.war2.meanDb - 0.5, `${r.war1.meanDb.toFixed(1)} / ${r.war2.meanDb.toFixed(1)} / ${r.war3.meanDb.toFixed(1)} dBFS`);
  // the law gives the fall SCORE_STING_MS (12.5 s): by then it has rung out
  const tail = r.fell.rms.slice(12, 20), top = Math.max(...r.fell.rms.slice(0, 8));
  check('the fall rings out inside the time the law gives it, and leaves the court quiet', tail.length === 8 && tail.every((x) => x < top * 0.05), `top ${db(top).toFixed(1)}, from 12 s ${tail.map((x) => db(x).toFixed(0)).join(' ')} dBFS`);
  check('no page error', errs.length === 0, errs.join('; '));
} finally {
  await browser.close();
  server.close();
}
const failed = out.filter((o) => !o).length;
console.log(`\n${out.length - failed}/${out.length} checks passed`);
process.exit(failed ? 1 : 0);
