// LOAD-OWED / BUILD-RETRY (bible/06-Systems/Travel-View.md): THE PIXEL BUILD, SWEPT OVER THE MAP ON THE PLAYER'S DATA.
//
// "The speed randomly drops and gets locked at 1x after traveling for a while" was the load governor holding the clock
// for a pixel whose build had thrown (LOAD-OWED). This asks which builds throw: the world host booted in headless
// Chromium (SwiftShader) in shot mode on the player's own ARENA2, its frame HELD (scenes/shared.js holdFrame) so nothing
// but the builds runs, and the pump's own build driven pixel by pixel through the host's probe door
// (scenes/world.js window.__pixelBuild: the stream re-centred on the pixel, then buildPixel, a throw caught as the
// pump's catch catches it and handed back with its stack). The places swept: every town of the location index (a
// city, a town, a village, a hamlet, every row a mod added) and every fourth other place, the Bay's wilderness on a
// lattice (every region, every climate) and its sea more thinly, the land past the Bay (TAMRIEL2's frame) and the
// Eltheric Ocean's isles and sea. One JSON line a pixel; the summary groups the throws by message and stack.
//
//   ARENA2_PATH=<arena2> node tools/pixelBuildSweep.mjs [--out DIR] [--pages 2] [--step 10] [--every 4] [--far 3]
//       [--query season=winter] [--again] [--swap] [--limit N] [--fail TEXTURE.302 --fail-count 1] [--journey SECONDS]
//
//   --again          each pixel built, torn down and built again (a re-skin's or a return's rebuild after release)
//   --swap           that rebuild under the other season - the season's flip in one session, both sets cached
//   --query Q        more of the page's query (season=winter, season=rain, ...)
//   --fail NAME      the first --fail-count reads of a file whose URL ends in NAME are refused (a dropped fetch):
//                    what a build does with a read that failed, and whether the next ask reads again
//   --journey S      no sweep: the frame runs (its draws stubbed - SwiftShader rasterises nothing), the Overworld is
//                    raised and the movement key held for S real seconds - the keys' travel at the road's or the open
//                    ground's rate, the stream building under it at the journey's pace; the clock, its hold and every
//                    build that threw are reported
//
// RENDERS NOTHING THAT IS KEPT: no screenshot, no picture of the player's data is written (Port-Doctrine).
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const ARGS = process.argv.slice(2);
const opt = (name, d = null) => { const i = ARGS.indexOf(`--${name}`); return i >= 0 ? ARGS[i + 1] : d; };
const flag = (name) => ARGS.includes(`--${name}`);
const A2 = process.env.ARENA2_PATH;
if (!A2 || !existsSync(join(A2, 'MAPS.BSA'))) { console.error('ARENA2_PATH is not set to an ARENA2 folder - point it at your own.'); process.exit(2); }
const OUT = opt('out', 'scratch/pixelsweep');
mkdirSync(OUT, { recursive: true });
const PAGES = Number(opt('pages', 2)), STEP = Number(opt('step', 10)), EVERY = Number(opt('every', 4)), FAR = Number(opt('far', 3));
const PORT = Number(opt('port', 5311));
const QUERY = `world&shot&play&region=Daggerfall&loc=Daggerfall&class=1&novideo&skin=enhanced&touch=off${opt('query') ? `&${opt('query')}` : ''}`;
const PIXEL_TIMEOUT_MS = 180000, REBOOT_EVERY = 300;   // a page is let go every few hundred builds: the session caches of a whole map in one page outgrow a small box

// ---- the list ---------------------------------------------------------------------------------------------------
async function sweepList(locationKeys) {
  const { MapsFile, longitudeLatitudeToMapPixel } = await import('../src/formats/mapsFile.js');
  const { CLIMATES } = await import('../src/formats/mapsTables.js');
  const { tamrielFrameInBay } = await import('../src/world/tamriel/tamrielFrame.js');
  const ES = await import('../src/world/ethericSea.js');
  const rd = (f) => new Uint8Array(readFileSync(join(A2, f)));
  const maps = new MapsFile(); maps.load(rd('MAPS.BSA'), rd('CLIMATE.PAK'), rd('POLITIC.PAK'));
  const type = new Map();
  for (let r = 0; r < maps.regionCount; r++) {
    for (let l = 0; l < (maps.baseLocationCount(r) ?? 0); l++) {
      const loc = maps.getLocation(r, l);
      if (!loc?.mapTableData) continue;
      const p = longitudeLatitudeToMapPixel(loc.mapTableData.longitude, loc.mapTableData.latitude);
      type.set(`${p.x},${p.y}`, loc.mapTableData.locationType);
    }
  }
  const TOWNS = new Set([0, 1, 2]);   // LocationTypes TownCity, TownHamlet, TownVillage
  const out = [], seen = new Set();
  const add = (p) => { const k = `${p.px},${p.py}`; if (!seen.has(k)) { seen.add(k); out.push(p); } };
  let other = 0;
  for (const k of locationKeys) {
    const [px, py] = k.split(',').map(Number), t = type.get(k);
    if (t === undefined || TOWNS.has(t) || (other++ % EVERY) === 0) add({ px, py, kind: 'location', ltype: t ?? 'mod' });
  }
  for (let y = 1; y < 500; y += STEP) for (let x = 2; x < 1000; x += STEP) {
    const sea = maps.getClimateIndex(x, y) === CLIMATES.Ocean;
    if (sea && ((((x - 2) / STEP) % 2) || (((y - 1) / STEP) % 2))) continue;   // the sea on every other lattice point
    add({ px: x, py: y, kind: sea ? 'bay-sea' : 'bay-wild', region: maps.getRegionIndexAt(x, y) });
  }
  const f = tamrielFrameInBay();
  let n = 0;
  for (let y = f.y0 + 3; y < f.y0 + f.h; y += 120) for (let x = f.x0 + 3; x < f.x0 + f.w; x += 120) {
    if (x >= 0 && x < 1000 && y >= 0 && y < 500) continue;
    if ((n++ % FAR) === 0) add({ px: x, py: y, kind: 'tamriel' });
  }
  const B = ES.ETHER_BOX;
  n = 0;
  for (let y = B.y0 + 7; y < B.y1; y += 320) for (let x = B.x0 + 7; x < B.x1; x += 320) if ((n++ % FAR) === 0) add({ px: x, py: y, kind: 'ether-sea' });
  const isles = new Map();
  for (let y = B.y0; y < B.y1; y += 200) for (let x = B.x0; x < B.x1; x += 200) for (const i of ES.islesNear(x, y, 100)) isles.set(`${i.px},${i.py}`, i);
  n = 0;
  for (const i of isles.values()) if ((n++ % (100 * FAR)) === 0) add({ px: i.px, py: i.py, kind: 'ether-isle' });
  return out;
}

// ---- the browser ------------------------------------------------------------------------------------------------
const server = await createServer({ root: process.cwd(), server: { port: PORT, strictPort: true, hmr: false, watch: null }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const failName = opt('fail'), failCount = Number(opt('fail-count', 1));
let refused = 0;

async function bootPage(sink) {
  const page = await browser.newPage({ viewport: { width: 320, height: 200 } });
  if (failName) {
    await page.route((url) => url.pathname.toUpperCase().endsWith(failName.toUpperCase()), (route) => {
      if (refused < failCount) { refused++; sink.refusals.push(route.request().url()); return route.abort('failed'); }
      return route.continue();
    });
  }
  // a renderer the system kills (out of memory on a shared box) leaves an evaluate that never answers - the crash is the answer
  page.on('crash', () => sink.crashWake?.());
  page.on('pageerror', (e) => sink.errors.push({ at: sink.at, message: String(e.message ?? e), stack: String(e.stack ?? '').slice(0, 2000) }));
  page.on('console', (m) => {
    const t = m.text();
    if (/^pixel -?\d+,-?\d+ failed:/.test(t)) sink.failed.push({ at: Date.now(), text: t.slice(0, 2000) });
    else if (m.type() === 'error' && !/status of 404|CURSOR\.IMG/.test(t)) sink.errors.push({ at: sink.at, console: t.slice(0, 1500) });
  });
  await page.goto(`http://localhost:${PORT}/play/?${QUERY}`);
  for (const until = Date.now() + 1800000; Date.now() < until;) {
    if (await page.evaluate(() => !!window.__pixelBuild && !!window.__mode && window.__mode() != null).catch(() => false)) break;
    await page.waitForTimeout(2000);
  }
  return page;
}

// ---- the journey ------------------------------------------------------------------------------------------------
if (opt('journey')) {
  const sink = { errors: [], failed: [], refusals: [], at: 'journey' };
  const page = await bootPage(sink);
  await page.evaluate(() => {   // the frame's logic, none of its rasterising
    const gl = window.__renderer.gl;
    for (const f of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements', 'clear', 'blitFramebuffer']) if (gl[f]) gl[f] = () => {};
  });
  for (const until = Date.now() + 600000; Date.now() < until;) {
    const s = await page.evaluate(() => window.__journeyState());
    if (s.queue === 0 && s.owed === 0) break;
    await page.waitForTimeout(2000);
  }
  // the boot's own pages (a tutorial's, the main quest's box) put away, then the Overworld raised - again until it stands
  let view = null, asked = null;
  for (let i = 0; i < 20 && view !== 'up'; i++) {
    asked = await page.evaluate(() => { window.__arenaCloseOverlays?.(); return { ...window.__overworld(), frame: window.__frame }; });
    await page.waitForTimeout(2000);
    view = await page.evaluate(() => window.__journeyState().view);
  }
  console.log(`the Overworld: ${view} (${JSON.stringify(asked)})`);
  await page.keyboard.down('KeyW');
  const samples = [];
  const t0 = Date.now(), seconds = Number(opt('journey'));
  let crashed = null;
  const crash = new Promise((r) => { sink.crashWake = () => { crashed ??= Math.round((Date.now() - t0) / 1000); r(null); }; });
  while (crashed == null && Date.now() - t0 < seconds * 1000) {
    await Promise.race([page.waitForTimeout(1000).catch(() => null), crash]);
    const s = await Promise.race([page.evaluate(() => ({ ...window.__journeyState(), frame: window.__frame, heapMB: Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1048576) })).catch(() => null), crash]);
    if (s) samples.push({ t: Math.round((Date.now() - t0) / 1000), ...s });
  }
  if (crashed != null) console.log(`the renderer was killed at ${crashed} s (the system's: out of memory on a shared box) - the samples to then`);
  else await page.keyboard.up('KeyW');
  writeFileSync(join(OUT, 'journey.json'), JSON.stringify({ samples, crashed, failed: sink.failed, errors: sink.errors, refusals: sink.refusals }, null, 1));
  const px = samples.map((s) => s.pixel), moved = px.length ? Math.max(Math.abs(px.at(-1).x - px[0].x), Math.abs(px.at(-1).y - px[0].y)) : 0;
  const scales = samples.map((s) => s.scale), at1 = samples.filter((s) => s.scale === 1).length;
  console.log(`journey: ${samples.length} s, ${moved} pixels on, scale min ${Math.min(...scales)} max ${Math.max(...scales)}, ${at1} s at x1, held ${samples.filter((s) => s.held != null).length} s (${[...new Set(samples.map((s) => s.why).filter(Boolean))].join(', ') || 'never'}), ${sink.failed.length} build(s) threw, ${sink.refusals.length} read(s) refused, ${sink.errors.length} other error(s)`);
  for (const f of sink.failed.slice(0, 10)) console.log(`  ${f.text.split('\n')[0]}`);
  await browser.close(); await server.close();
  process.exit(sink.failed.length && !failName ? 1 : 0);
}

// ---- the sweep --------------------------------------------------------------------------------------------------
const listPath = join(OUT, 'list.json'), rowsPath = join(OUT, 'pixels.jsonl');
const again = flag('again'), swap = flag('swap');
let list;
if (existsSync(listPath)) list = JSON.parse(readFileSync(listPath, 'utf8'));
else {
  const sink = { errors: [], failed: [], refusals: [] };
  const page = await bootPage(sink);
  list = await sweepList(await page.evaluate(() => window.__locationPixels()));
  await page.close();
  writeFileSync(listPath, JSON.stringify(list));
}
if (opt('limit')) list = list.slice(0, Number(opt('limit')));
const done = new Set();
if (existsSync(rowsPath)) for (const l of readFileSync(rowsPath, 'utf8').split('\n')) if (l) { try { const r = JSON.parse(l); done.add(`${r.px},${r.py}`); } catch { /* a line cut short */ } }
const todo = list.filter((p) => !done.has(`${p.px},${p.py}`));
console.log(`${list.length} pixels, ${done.size} swept already, ${todo.length} to go, ${PAGES} page(s)`);
const t0 = Date.now();
let swept = 0;
async function lane(k) {
  const sink = { errors: [], failed: [], refusals: [], at: null };
  let page = null, n = 0;
  const boot = async () => {
    if (page) await page.close().catch(() => {});
    page = await bootPage(sink);
    await page.evaluate(async () => { const { holdFrame } = await import('/src/scenes/shared.js'); window.__probeRelease = holdFrame(); });
  };
  await boot();
  const once = async (p) => {
    sink.at = `${p.px},${p.py}`; sink.errors = [];
    try {
      return await Promise.race([
        page.evaluate(async ({ px, py, again, swap, ms }) => Promise.race([
          window.__pixelBuild(px, py, { again, swap }).then((x) => ({ ...x, heapMB: Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1048576) })),
          new Promise((res) => setTimeout(() => res({ timeout: true }), ms)),
        ]), { px: p.px, py: p.py, again, swap, ms: PIXEL_TIMEOUT_MS }),
        new Promise((res) => { sink.crashWake = () => res({ crash: 'the page\'s renderer died' }); }),
        new Promise((res) => setTimeout(() => res({ timeout: true, page: 'no answer' }), PIXEL_TIMEOUT_MS + 60000)),
      ]);
    } catch (e) { return { crash: String(e.message ?? e).slice(0, 500) }; }
  };
  for (let i = k; i < todo.length; i += PAGES) {
    const p = todo[i];
    let r = await once(p);
    // a page that died or a build that never answered is asked again ONCE on a fresh page - the box may have killed
    // the renderer for its memory; what fails twice is the pixel's
    if (r.timeout || r.crash) { const first = r; await boot(); r = { ...(await once(p)), first }; }
    appendFileSync(rowsPath, `${JSON.stringify({ ...p, ...r, pageErrors: sink.errors.length ? sink.errors : undefined })}\n`);
    swept++; n++;
    if (swept % 200 === 0) console.log(`${swept}/${todo.length}, ${((Date.now() - t0) / swept).toFixed(0)} ms a pixel`);
    if (r.timeout || r.crash || n % REBOOT_EVERY === 0) await boot();
  }
  await page.close().catch(() => {});
}
await Promise.all(Array.from({ length: PAGES }, (_, k) => lane(k)));
await browser.close(); await server.close();

// ---- the summary -------------------------------------------------------------------------------------------------
const rows = readFileSync(rowsPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const by = new Map();
const frames = (stack) => String(stack ?? '').split('\n').slice(1, 4).map((s) => s.trim().replace(/\?[^:)]*/g, '').replace(/:\d+:\d+\)?$/, '')).join(' < ');
for (const r of rows) {
  const why = r.error ? `threw: ${String(r.error.message).replace(/-?\d+/g, 'N')} @ ${frames(r.error.stack)}` : r.timeout ? 'did not settle in 180 s' : r.crash ? `page: ${r.crash.split('\n')[0]}` : r.pageErrors ? `stood, with ${r.pageErrors[0].message ?? r.pageErrors[0].console}` : null;
  if (!why) continue;
  if (!by.has(why)) by.set(why, []);
  by.get(why).push(`${r.px},${r.py}${r.location ? ` ${r.location}` : ''}`);
}
const kinds = rows.reduce((m, r) => ((m[r.kind] = (m[r.kind] ?? 0) + 1), m), {});
const summary = { pixels: rows.length, stood: rows.filter((r) => r.built && !r.error).length, threw: rows.filter((r) => r.error).length, unsettled: rows.filter((r) => r.timeout).length, crashed: rows.filter((r) => r.crash).length, kinds, causes: [...by].map(([why, px]) => ({ why, n: px.length, pixels: px.slice(0, 20) })) };
writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary, null, 1));
console.log(`swept ${summary.pixels}: ${summary.stood} stood, ${summary.threw} threw, ${summary.unsettled} unsettled, ${summary.crashed} crashed; ${Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(', ')}`);
for (const c of summary.causes) console.log(`  ${c.n} x ${c.why}\n      ${c.pixels.slice(0, 6).join('; ')}`);
process.exit(summary.threw || summary.unsettled ? 1 : 0);
