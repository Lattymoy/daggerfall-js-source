// WG2-TOWNS (bible/03-World/World-2-Canon.md, "Buildings and settlements") - WORLD 2.0 TOWNS STANDING in the real game.
// Boots the streaming world headless on SwiftShader at a one-square land view with the prototype regions behind `?wg2=`,
// jumps to each town asked (`__tesaJump`, as a fast travel lands) and judges what stood: the pixel's location is the town,
// the arrival on its own pixel, every building a door, each floor on the region's ground, each record its building's
// type, its walkers on its streets and walking, its features stood (a wall and its gate, stilt platforms and a dock), and
// its tavern's door entered into its made interior. Every wait is on the shot-mode frame counter or the stream's idle
// flag, never a sleep (Home.md, Process). Photographs each town, its features and its tavern.
//
//   ARENA2_PATH=/home/claude/dfdata/arena2 OUT=/tmp/wg2towns node tools/wg2TownProbe.mjs
//
// Env: OUT the PNGs' directory (renders of game data stay outside the tree); TOWNS pixels `x,y;x,y` (default Tava Wells,
// Sentry Hold and Hist Shallows); PORT the dev server's; W/H the viewport; CHROMIUM a browser other than Playwright's.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const port = Number(process.env.PORT || 5371);
const OUT = process.env.OUT || '/tmp/wg2towns';
const TOWNS = (process.env.TOWNS || '1046,452;1095,420;3283,1302').split(';').map((s) => s.split(',').map(Number));
const REGIONS = ['hammerfell-test', 'blackmarsh-test'];
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
/** The page's own read of a town: its records and the scene frame of its pixel (a door's place less its pixel-local one). */
const TOWN_FRAME = `
  const T = await import('/src/world/settle2/settle2Towns.js'), at = T.settle2TownAt(tw.px, tw.py), P = 819.2;
  const local = (x, y) => [(x - tw.px) * P, (tw.py + 1 - y) * P];
  const name = (b) => T.settle2BlockName(at.town.ordinal, b.slot[0], b.slot[1]);
  const one = at.town.buildings.find((b) => window.__doors().some((d) => d.block === name(b) && d.record === b.slot[2]));
  const d0 = window.__doors().find((d) => d.block === name(one) && d.record === one.slot[2]), l0 = local(one.doors[0].x, one.doors[0].y);
  const t = [d0.pos[0] - l0[0], d0.pos[1] - 1.3 - T.sceneOf(one.doors[0].z), d0.pos[2] - l0[1]];
  const scene = (x, y, over = 0) => { const l = local(x, y); return [l[0] + t[0], T.sceneOf(at.region.heightAt(x, y)) + over + t[1], l[1] + t[2]]; };
  const look = (from, to) => window.__pose(from[0], from[1], from[2], Math.atan2(to[0] - from[0], to[2] - from[2]), Math.atan2(to[1] - from[1], Math.hypot(to[0] - from[0], to[2] - from[2])));`;
const inTown = (fn) => new Function('tw', `return (async () => { ${TOWN_FRAME}\n${fn} })();`);
const shot = async (name) => { const path = `${OUT}/${name}.png`; await page.screenshot({ path, timeout: 1500000 }); console.log('shot', path); };
let verdict = 0;
try {
  const q = `world&shot&play&fps&region=Daggerfall&loc=Daggerfall&class=1&novideo&nofoes&tod=12:00&skin=enhanced&touch=off&season=summer&weather=sunny&wg2=${REGIONS.join(',')}`;
  await page.goto(`http://localhost:${port}/play/?${q}`, { timeout: 900000, waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 1800000, polling: 2000 });
  await ev(() => window.__arenaCloseOverlays?.());
  console.log('ready in', secs(), 's');
  await ev(async () => (await import('/src/characters/playerEntity.js')).setStaffPowers({ god: true, fly: true }));
  await page.waitForFunction(async () => !!(await import('/src/world/tamriel/tamrielLand.js')).tamrielTrace(), null, { timeout: 900000, polling: 2000 });
  await page.waitForFunction(async (ids) => { const have = (await import('/src/world/gen2/gen2Ground.js')).gen2Regions().map((r) => r.id); return ids.every((id) => have.includes(id)); }, REGIONS, { timeout: 900000, polling: 2000 });
  console.log('the trace and', REGIONS.join(', '), 'installed in', secs(), 's');
  for (const [px, py] of TOWNS) {
    const tw = { px, py };
    const town = await ev(async ([x, y]) => { const at = (await import('/src/world/settle2/settle2Towns.js')).settle2TownAt(x, y); return at && { id: at.town.id, name: at.town.name, mapId: at.town.mapId, buildings: at.town.buildings.length, kinds: [...new Set(at.town.features.map((f) => f.kind))] }; }, [px, py]);
    if (!town) fail(`no town at ${px},${py}`);
    // the town the build will stand there, asked of the host the game runs (scenes/settle2Host.js) before the jump
    const stands = await ev(async ([x, y]) => { const loc = (await import('/src/scenes/settle2Host.js')).settle2LocationAt(x, y); return loc ? { name: loc.name, type: loc.mapTableData.locationType } : null; }, [px, py]);
    console.log(`${town.name}: the host stands`, JSON.stringify(stands));
    if (!stands || stands.name !== town.name) fail(`${town.name}: the host stands no town on its pixel`);
    await ev(([x, y]) => { window.__jumpError = null; Promise.resolve(window.__tesaJump(x, y)).catch((e) => { window.__jumpError = String(e?.stack ?? e); }); }, [px, py]);
    // the stream's own state each round while it builds the town (SwiftShader takes long), until idle with the town built
    for (let m = 0; ; m++) {
      const st = await ev(([x, y]) => ({ at: window.__currentPixel?.(), idle: window.__streamIdle?.(), frame: window.__frame, journey: window.__journeyState?.(), error: window.__jumpError, town: window.__tesaPlace?.(x, y) }), [px, py]);
      if (st.error) fail(`the jump threw: ${st.error.slice(0, 300)}`);
      if (st.idle && st.town?.built) break;
      if (m % 4 === 0) console.log(`  ${secs()} s: at ${st.at}, idle ${st.idle}, frame ${st.frame}, built ${st.journey?.built}, owed ${st.journey?.owed}, queue ${st.journey?.queue}; the town built ${st.town?.built}`);
      if (m >= 80) fail(`${town.name}: the stream never stood idle with the town built in 80 rounds of 40 frames`);
      // the next round: 40 more frames drawn, or the stream idle with the town built, or the jump thrown - never a sleep
      await page.waitForFunction(([x, y, f0]) => (window.__streamIdle?.() === true && window.__tesaPlace?.(x, y)?.built) || window.__frame >= f0 + 40 || !!window.__jumpError, [px, py, st.frame], { timeout: 900000, polling: 3000 });
    }
    await frames(6);
    const arrived = await ev(() => window.__currentPixel());
    if (arrived !== `${px},${py}`) fail(`${town.name}: the arrival stood off the town's pixel, on ${arrived}`);
    const marker = await ev(() => window.__player.pos);
    const place = await ev(([x, y]) => window.__tesaPlace(x, y), [px, py]);
    console.log(`${town.name} stood in ${secs()} s, arrived on its pixel:`, JSON.stringify({ location: place.location, mapId: place.mapId, buildings: place.buildings, type: place.type, region: place.region }));
    if (!place.built || place.location !== town.name || place.mapId !== town.mapId) fail(`${town.name}: the built pixel is not the town`);
    // its walkers: on its own ground, off its buildings, and walking over a short run
    const walkers = inTown(`
      const pix = tw.px + ',' + tw.py, outline = at.town.footprint;
      const inside = (x, y) => { let c = false; for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) { const [xi, yi] = outline[i], [xj, yj] = outline[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
      const inBuilding = (x, y) => at.town.buildings.some((b) => { const dx = (x - b.at.x) * P, dy = (y - b.at.y) * P, n = b.at.dir; return Math.abs(dx * -n[1] + dy * n[0]) < b.footprint[0] / 2 - 0.3 && Math.abs(dx * n[0] + dy * n[1]) < b.footprint[1] / 2 - 0.3; });
      return JSON.parse(window.__people()).filter((p) => p.pixel === pix).map((p) => { const x = tw.px + (p.pos[0] - t[0]) / P, y = tw.py + 1 - (p.pos[2] - t[2]) / P; return { i: p.i, pos: p.pos, moves: p.moves, inside: inside(x, y), inBuilding: inBuilding(x, y) }; });`);
    // the population comes in over some frames: up to ten rounds of 30 for three on the town's pixel
    for (let k = 0; k < 10 && (await ev(walkers, tw)).length < 3; k++) await frames(30);
    const w0 = await ev(walkers, tw);
    await frames(60);
    const w1 = await ev(walkers, tw);
    const moved = w1.filter((p) => { const q0 = w0.find((r) => r.i === p.i); return q0 && Math.hypot(p.pos[0] - q0.pos[0], p.pos[2] - q0.pos[2]) > 0.3; });
    console.log(`${town.name}: ${w1.length} walkers on its pixel, ${moved.length} walked over 60 frames; ${w1.filter((p) => !p.inside).length} off its ground, ${w1.filter((p) => p.inBuilding).length} in a building`);
    if (w1.length < 3 || !moved.length) fail(`${town.name}: its walkers do not stand or walk`);
    if (w1.some((p) => !p.inside || p.inBuilding)) fail(`${town.name}: a walker off its streets`);
    // every building a door, each its record's type, its floor on the region's ground before it
    const doors = await ev(inTown(`
      const out = [];
      for (const d of window.__doors()) {
        const b = at.town.buildings.find((x) => name(x) === d.block && x.slot[2] === d.record);
        if (!b) continue;
        const data = JSON.parse(window.__buildingAt(d.i) ?? 'null'), fx = b.doors[0].x + b.doors[0].dir[0] * 0.3 / P, fy = b.doors[0].y + b.doors[0].dir[1] * 0.3 / P;
        window.__player.warp(d.pos[0] + d.normal[0] * 0.3, d.pos[1], d.pos[2] + d.normal[2] * 0.3);
        const ground = JSON.parse(window.__standing()).ground, want = T.sceneOf(b.doors[0].z) + 0.05 - T.sceneOf(at.region.heightAt(fx, fy));
        out.push({ id: b.id, kind: b.ground.kind, type: b.type, read: data?.buildingType ?? null, lift: d.pos[1] - 1.25 - ground, want });
      }
      return out;`), tw);
    const ids = new Set(doors.map((d) => d.id)), plinths = doors.filter((d) => d.kind !== 'stilts'), off = plinths.filter((d) => Math.abs(d.lift - d.want) > 0.5), wrong = doors.filter((d) => d.read !== d.type);
    console.log(`${town.name}: ${doors.length} doors for ${town.buildings} buildings (${ids.size} distinct); floor over its ground worst ${Math.max(0, ...plinths.map((d) => Math.abs(d.lift - d.want))).toFixed(2)} m off the region's; ${doors.filter((d) => d.kind === 'terrace').length} on pads, ${doors.length - plinths.length} on stilts`);
    if (ids.size < town.buildings || doors.length < town.buildings) fail(`${town.name}: ${ids.size} buildings with a door of ${town.buildings}`);
    if (off.length) fail(`${town.name}: floors off the region's ground: ${off.slice(0, 4).map((d) => `${d.id} ${d.lift.toFixed(2)} for ${d.want.toFixed(2)}`).join('; ')}`);
    if (wrong.length) fail(`${town.name}: a door reads another building's type: ${wrong.slice(0, 4).map((d) => `${d.id} ${d.read} for ${d.type}`).join('; ')}`);
    // the photographs: over the town from its arrival, and its features where it has them
    await ev(([x, y, z]) => window.__pose(x, y + 45, z - 70, 0, -0.45), marker);
    await frames(8);
    await shot(town.id);
    if (town.kinds.includes('gate')) {
      // its gate from outside on its road, the wall running off either side
      const seen = await ev(inTown(`
        const g = at.town.features.find((f) => f.kind === 'gate'), at2 = scene(g.at[0], g.at[1], 3), out = 26 / P;
        look(scene(g.at[0] + g.dir[0] * out + g.dir[1] * 8 / P, g.at[1] + g.dir[1] * out - g.dir[0] * 8 / P, 9), at2);
        window.__player.warp(scene(g.at[0], g.at[1])[0], scene(g.at[0], g.at[1], 1)[1], scene(g.at[0], g.at[1])[2]);
        const through = JSON.parse(window.__standing());
        look(scene(g.at[0] + g.dir[0] * out + g.dir[1] * 8 / P, g.at[1] + g.dir[1] * out - g.dir[0] * 8 / P, 9), at2);
        return { ground: through.ground, y: through.y };`), tw);
      await frames(8);
      await shot(`${town.id}-gate`);
      console.log(`${town.name}: its gate photographed; the ground in its opening ${seen.ground?.toFixed?.(2)}`);
      // a body walks through the gate on its road, and is held by the wall a run along from it
      for (const [what, along, through] of [['the gate', 0, true], ['the wall', 2, false]]) {
        const run = await ev(inTown(`
          const g = at.town.features.find((f) => f.kind === 'gate'), wall = at.town.features.find((f) => f.kind === 'wall');
          const k0 = wall.pts.reduce((b, p, i) => (Math.hypot(p[0] - g.at[0], p[1] - g.at[1]) < Math.hypot(wall.pts[b][0] - g.at[0], wall.pts[b][1] - g.at[1]) ? i : b), 0);
          const c = ${along} ? wall.pts[(k0 + ${along}) % wall.pts.length] : g.at, mid = [at.town.centre.x, at.town.centre.y];
          const o = ${along} ? (() => { const v = [c[0] - mid[0], c[1] - mid[1]], l = Math.hypot(...v); return [v[0] / l, v[1] / l]; })() : g.dir;
          const from = scene(c[0] + o[0] * 6 / P, c[1] + o[1] * 6 / P, 0.3), to = scene(c[0] - o[0] * 6 / P, c[1] - o[1] * 6 / P, 0.3);
          look(from, [to[0], from[1], to[2]]);
          return { c: scene(c[0], c[1]), n: [o[0], -o[1]] };`), tw);
        await frames(4);
        const side = async () => { const p = await ev(() => window.__player.pos); return (p[0] - run.c[0]) * run.n[0] + (p[2] - run.c[2]) * run.n[1]; };
        const before = await side();
        await page.keyboard.down('KeyW');
        for (let k = 0; k < 15 && (await side()) > -2; k++) await frames(10);
        await page.keyboard.up('KeyW');
        const after = await side();
        console.log(`${town.name}: walked at ${what} from ${before.toFixed(1)} m outside to ${after.toFixed(1)} m`);
        if (through && !(before > 3 && after < -1)) fail(`${town.name}: a body did not pass through its gate`);
        if (!through && !(after > 0)) fail(`${town.name}: a body passed through its wall`);
      }
    }
    if (town.kinds.includes('platform')) {
      // its dock and the stilt houses beside it, from over the water
      await ev(inTown(`
        const dk = at.town.features.find((f) => f.kind === 'dock'), mid = [dk.at[0] + dk.dir[0] * 12 / P, dk.at[1] + dk.dir[1] * 12 / P];
        look(scene(mid[0] + dk.dir[0] * 30 / P - dk.dir[1] * 25 / P, mid[1] + dk.dir[1] * 30 / P + dk.dir[0] * 25 / P, 14), scene(dk.at[0], dk.at[1], 2));`), tw);
      await frames(8);
      await shot(`${town.id}-dock`);
    }
    // the tavern's door entered: its own interior made and mounted, its record a tavern's
    const entered = await ev(inTown(`
      const tavern = at.town.buildings.find((b) => b.role === 'tavern'), d = window.__doors().find((x) => x.block === name(tavern) && x.record === tavern.slot[2]);
      if (!d) return { door: false };
      window.__pose(d.pos[0] + d.normal[0] * 1.5, d.pos[1] - 1.2, d.pos[2] + d.normal[2] * 1.5, Math.atan2(-d.normal[0], -d.normal[2]), -0.05);
      return { door: true, entered: await window.__enter() };`), tw);
    await frames(10);
    const inside = await ev(() => ({ mode: window.__mode?.() ?? null, building: JSON.parse(window.__building?.() ?? 'null') }));
    console.log(`${town.name}: the tavern's door`, JSON.stringify(entered), '->', JSON.stringify({ mode: inside.mode, building: inside.building }));
    if (!entered.door || !entered.entered || inside.mode !== 'interior' || inside.building?.type !== 15) fail(`${town.name}: the tavern's door did not open on a tavern`);
    await shot(`${town.id}-tavern`);
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
