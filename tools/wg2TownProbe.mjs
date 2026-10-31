// WG2-TOWNS (bible/03-World/World-2-Canon.md, "Buildings and settlements") - A WORLD 2.0 TOWN STANDING in the real game.
// Boots the streaming world headless on SwiftShader at a one-square land view with the prototype region behind `?wg2=`,
// jumps to each town asked (`__tesaJump`, as a fast travel lands) and judges what stood: the pixel's location is the town,
// every building a door (`__doors`), each door's floor on the ground the region stands there (a terrace's on its pad), its
// record the building's type (`__buildingAt`), and the tavern's door entered into its made interior. Every wait is on the
// shot-mode frame counter or the stream's idle flag, never a sleep (Home.md, Process). Photographs each town from over it.
//
//   ARENA2_PATH=/home/claude/dfdata/arena2 OUT=/tmp/wg2towns node tools/wg2TownProbe.mjs
//
// Env: OUT the PNGs' directory (renders of game data stay outside the tree); TOWNS pixels `x,y;x,y` (default Tava Wells,
// 1046,452); PORT the dev server's; W/H the viewport; CHROMIUM a browser other than the pinned Playwright's.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const port = Number(process.env.PORT || 5371);
const OUT = process.env.OUT || '/tmp/wg2towns';
const TOWNS = (process.env.TOWNS || '1046,452').split(';').map((s) => s.split(',').map(Number));
mkdirSync(OUT, { recursive: true });
const fail = (m) => { console.log('FAIL:', m); throw new Error(m); };
const server = await createServer({ root: process.cwd(), configFile: process.cwd() + '/vite.config.js', server: { port, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
const page = await browser.newPage({ viewport: { width: Number(process.env.W || 960), height: Number(process.env.H || 600) } });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message); });
page.on('crash', () => { console.log('[crash] the page crashed'); process.exit(3); });
page.on('console', (m) => { const t = m.text(); if ((m.type() === 'error' || /\[(wg2|travel)\]/.test(t) || (m.type() === 'warning' && /fail|threw/i.test(t))) && !/404|cursor|CERT|GL Driver/i.test(t)) console.log(`[page:${m.type()}]`, t.slice(0, 300)); });
await page.addInitScript(() => {
  localStorage.setItem('dagger.ui.v1', JSON.stringify({ landViewDistance: 1, tutorialPopups: false, survival: false }));
  localStorage.setItem('dagger.settings.v1', JSON.stringify({ Experimental: { TerrainDistance: '1' } }));
});
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const frames = async (n) => { const f = await ev(() => window.__frame); await page.waitForFunction(([f0, k]) => window.__frame >= f0 + k, [f, n], { timeout: 900000, polling: 500 }); };
const t0 = Date.now(), secs = () => ((Date.now() - t0) / 1000).toFixed(0);
let verdict = 0;
try {
  const q = 'world&shot&play&fps&region=Daggerfall&loc=Daggerfall&class=1&novideo&nofoes&tod=12:00&skin=enhanced&touch=off&season=summer&weather=sunny&wg2=hammerfell-test';
  await page.goto(`http://localhost:${port}/play/?${q}`, { timeout: 900000, waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 1800000, polling: 2000 });
  await ev(() => window.__arenaCloseOverlays?.());
  console.log('ready in', secs(), 's');
  await ev(async () => (await import('/src/characters/playerEntity.js')).setStaffPowers({ god: true, fly: true }));
  await page.waitForFunction(async () => !!(await import('/src/world/tamriel/tamrielLand.js')).tamrielTrace(), null, { timeout: 900000, polling: 2000 });
  await page.waitForFunction(async () => (await import('/src/world/gen2/gen2Ground.js')).gen2Regions().some((r) => r.id === 'hammerfell-test'), null, { timeout: 900000, polling: 2000 });
  console.log('the trace and hammerfell-test installed in', secs(), 's');
  for (const [px, py] of TOWNS) {
    const town = await ev(async ([x, y]) => { const at = (await import('/src/world/settle2/settle2Towns.js')).settle2TownAt(x, y); return at && { id: at.town.id, name: at.town.name, mapId: at.town.mapId, buildings: at.town.buildings.length, ordinal: at.town.ordinal }; }, [px, py]);
    if (!town) fail(`no town at ${px},${py}`);
    // the town the build will stand there, asked of the host the game runs (scenes/settle2Host.js) before the jump
    const stands = await ev(async ([x, y]) => { const loc = (await import('/src/scenes/settle2Host.js')).settle2LocationAt(x, y); return loc ? { name: loc.name, type: loc.mapTableData.locationType, mapId: loc.mapTableData.mapId } : null; }, [px, py]);
    console.log(`${town.name}: the host stands`, JSON.stringify(stands));
    if (!stands || stands.name !== town.name) fail(`${town.name}: the host stands no town on its pixel`);
    await ev(([x, y]) => { window.__jumpError = null; Promise.resolve(window.__tesaJump(x, y)).catch((e) => { window.__jumpError = String(e?.stack ?? e); }); }, [px, py]);
    // the stream's own state each round while it builds the town (SwiftShader takes long), until idle with the town built
    for (let m = 0; ; m++) {
      const st = await ev(([x, y]) => ({ at: window.__currentPixel?.(), idle: window.__streamIdle?.(), frame: window.__frame, journey: window.__journeyState?.(), error: window.__jumpError, town: window.__tesaPlace?.(x, y), me: window.__player?.pos }), [px, py]);
      if (st.error) fail(`the jump threw: ${st.error.slice(0, 300)}`);
      if (st.idle && st.town?.built) break;
      console.log(`  ${secs()} s: at ${st.at} (${st.me?.map((v) => v.toFixed(0)).join(',')}), idle ${st.idle}, frame ${st.frame}, built ${st.journey?.built}, owed ${st.journey?.owed}, failed ${st.journey?.failed}, queue ${st.journey?.queue}; the town built ${st.town?.built}, its location ${st.town?.location}`);
      if (m >= 60) fail(`${town.name}: the stream never stood idle with the town built in 60 rounds of 40 frames`);
      // the next round: 40 more frames drawn, or the stream idle with the town built, or the jump thrown - never a sleep
      await page.waitForFunction(([x, y, f0]) => (window.__streamIdle?.() === true && window.__tesaPlace?.(x, y)?.built) || window.__frame >= f0 + 40 || !!window.__jumpError, [px, py, st.frame], { timeout: 900000, polling: 3000 });
    }
    const arrived = await ev(() => window.__currentPixel());
    console.log(`${town.name}: built; the player arrived on ${arrived}`);
    if (arrived !== `${px},${py}`) fail(`${town.name}: the arrival stood off the town's pixel, on ${arrived}`);
    await frames(6);
    const marker = await ev(() => window.__player.pos);
    const place = await ev(([x, y]) => window.__tesaPlace(x, y), [px, py]);
    console.log(town.name, 'stood in', secs(), 's:', JSON.stringify({ built: place.built, location: place.location, name: place.name, mapId: place.mapId, buildings: place.buildings, type: place.type, region: place.region }));
    if (!place.built || place.location !== town.name || place.mapId !== town.mapId) fail(`${town.name}: the built pixel is not the town`);
    // every building a door, each its record's type, its floor on the ground the region stands before it
    const doors = await ev(async (tw) => {
      const T = await import('/src/world/settle2/settle2Towns.js'), at = T.settle2TownAt(tw.px, tw.py), out = [];
      const all = window.__doors(), bySlot = new Map(at.town.buildings.map((b) => [T.settle2BlockName(at.town.ordinal, b.slot[0], b.slot[1]) + '#' + b.slot[2], b]));
      for (const d of all) {
        const b = bySlot.get(`${d.block}#${d.record}`);
        if (!b) continue;
        const front = [d.pos[0] + d.normal[0] * 0.3, d.pos[2] + d.normal[2] * 0.3], data = JSON.parse(window.__buildingAt(d.i) ?? 'null');
        window.__player.warp(front[0], d.pos[1], front[1]);
        const ground = JSON.parse(window.__standing()).ground, fx = b.doors[0].x + b.doors[0].dir[0] * 0.3 / 819.2, fy = b.doors[0].y + b.doors[0].dir[1] * 0.3 / 819.2;
        const want = T.sceneOf(b.doors[0].z) + 0.05 - T.sceneOf(at.region.heightAt(fx, fy));
        out.push({ id: b.id, kind: b.ground.kind, type: b.type, read: data?.buildingType ?? null, lift: d.pos[1] - 1.25 - ground, want });
      }
      return out;
    }, { px, py });
    const ids = new Set(doors.map((d) => d.id)), off = doors.filter((d) => Math.abs(d.lift - d.want) > 0.5), wrong = doors.filter((d) => d.read !== d.type);
    const pads = doors.filter((d) => d.kind === 'terrace');
    console.log(`${town.name}: ${doors.length} doors for ${town.buildings} buildings (${ids.size} distinct); floor over its ground worst ${Math.max(...doors.map((d) => Math.abs(d.lift - d.want))).toFixed(2)} m off the region's; ${pads.length} on pads`);
    if (ids.size < town.buildings || doors.length < town.buildings) fail(`${town.name}: ${ids.size} buildings with a door of ${town.buildings}`);
    if (off.length) fail(`${town.name}: floors off the region's ground: ${off.slice(0, 4).map((d) => `${d.id} ${d.lift.toFixed(2)} for ${d.want.toFixed(2)}`).join('; ')}`);
    if (wrong.length) fail(`${town.name}: a door reads another building's type: ${wrong.slice(0, 4).map((d) => `${d.id} ${d.read} for ${d.type}`).join('; ')}`);
    // the photograph, from over the plaza looking north across the town
    await ev(([x, y, z]) => window.__pose(x, y + 45, z - 70, 0, -0.45), marker);
    await frames(8);
    const path = `${OUT}/${town.id}.png`;
    await page.screenshot({ path, timeout: 1500000 });
    console.log('shot', path, 'from', marker.map((v) => v.toFixed(1)).join(','));
    // the tavern's door entered: its own interior made and mounted, its record a tavern's
    const entered = await ev(async (tw) => {
      const T = await import('/src/world/settle2/settle2Towns.js'), at = T.settle2TownAt(tw.px, tw.py);
      const tavern = at.town.buildings.find((b) => b.role === 'tavern'), name = T.settle2BlockName(at.town.ordinal, tavern.slot[0], tavern.slot[1]);
      const d = window.__doors().find((x) => x.block === name && x.record === tavern.slot[2]);
      if (!d) return { door: false };
      window.__pose(d.pos[0] + d.normal[0] * 1.5, d.pos[1] - 1.2, d.pos[2] + d.normal[2] * 1.5, Math.atan2(-d.normal[0], -d.normal[2]), -0.05);
      return { door: true, entered: await window.__enter() };
    }, { px, py });
    await frames(10);
    const inside = await ev(() => ({ mode: window.__mode?.() ?? null, building: JSON.parse(window.__building?.() ?? 'null') }));
    console.log(`${town.name}: the tavern's door`, JSON.stringify(entered), '->', JSON.stringify({ mode: inside.mode, building: inside.building }));
    if (!entered.door || !entered.entered || inside.mode !== 'interior' || inside.building?.type !== 15) fail(`${town.name}: the tavern's door did not open on a tavern`);
    await page.screenshot({ path: `${OUT}/${town.id}-tavern.png`, timeout: 1500000 });
    await ev(() => window.__exit?.());
    await frames(6);
  }
  if (errors.length) fail(`page errors: ${errors.slice(0, 3).join(' | ')}`);
  console.log('PASS in', secs(), 's');
} catch (e) {
  verdict = 1;
  console.log('the probe failed:', e?.message ?? e);
} finally {
  await browser.close();
  await server.close();
}
process.exit(verdict);
