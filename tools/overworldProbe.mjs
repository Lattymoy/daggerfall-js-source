// U61 - THE OVERWORLD, in a real browser.
//
// WHAT ONLY A BROWSER CAN PROVE HERE is the whole screen standing up:
// a real WebGL2 relief drawing the right colors in the right places,
// real pointer events panning/zooming/picking through the DOM chrome,
// the phase machine walking ascend -> map -> flight -> descend ->
// done against a real clock, and the classic-skin boundary. The LAWS
// are pinned in node (test/overworldmap.test.js); here every number
// the screen shows is re-checked against the law modules imported
// INTO the page, so the two can never quietly disagree.
//
// CI has no ARENA2 and never will, so the bay is SYNTHETIC: a 96x64
// heightmap with a western sea, a mountain ridge and a handful of
// locations, built in-page - the same seam the node tests use
// (deps.mapSize). The real-data path differs only in the bytes.
//
// Self-hosting (pattern A): starts its own vite on 5224.
//     node tools/overworldProbe.mjs
import { createServer } from 'vite';
import { chromium, devices } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const PORT = 5224;
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

const server = await createServer({
  root: new URL('..', import.meta.url).pathname,
  server: { port: PORT, strictPort: true, hmr: false },
});
await server.listen();
const BASE = `http://127.0.0.1:${PORT}`;
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

/** The synthetic bay + a live window, mounted on the menu page (which
 *  needs no game data). Returns nothing - state lives on globalThis
 *  for the checks that follow. */
async function mountOverworld(page, { armed = false, gotoPlace = null } = {}) {
  await page.goto(`${BASE}/menu.html?skin=enhanced&nofonts`, { waitUntil: 'networkidle' });
  await page.evaluate(async ({ armed2, gotoPlace2 }) => {
    document.getElementById('enhanced-menu')?.remove();
    const canvas = document.createElement('canvas');
    canvas.id = 'ovprobe-canvas';
    canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:1';
    document.body.append(canvas);
    const { Renderer } = await import('/src/render/renderer.js');
    const { createTravelMapWindow } = await import('/src/ui/travelMapDoor.js');
    const travel = await import('/src/systems/travel.js');
    const model = await import('/src/ui/overworldModel.js');
    const mapsFile = await import('/src/formats/mapsFile.js');

    const W = 96, H = 64;
    const bytes = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let b = 0;
        if (x >= 28) b = 8 + Math.round(6 * Math.sin(x * 0.3) * Math.cos(y * 0.2) + 6);
        if (x > 55 && x < 65) b = 90 + ((x + y) % 8);
        bytes[y * W + x] = b;
      }
    }
    const climateAt = (x, y) => (x < 28 ? 223 : (x > 55 && x < 65 ? 226 : 231));
    const R = 17;
    const spots = [
      { x: 40, y: 30, type: 0, name: 'Proofhold', discovered: true },      // TownCity
      { x: 45, y: 32, type: 2, name: 'Lowmarsh', discovered: true },       // TownVillage
      { x: 50, y: 28, type: 10, name: 'Cryptwatch', discovered: true },    // DungeonRuin
      { x: 42, y: 36, type: 5, name: 'Kyn Temple', discovered: true },     // ReligionTemple
      { x: 52, y: 30, type: 0, name: 'Hiddenport', discovered: false },
    ];
    const mapDict = new Map();
    const mapNames = [], mapTable = [], mapNameLookup = new Map();
    spots.forEach((s, i) => {
      const id = s.y * 1000 + s.x;
      mapDict.set(id, {
        id, mapID: id, regionIndex: R, mapIndex: i,
        locationType: s.type, dungeonType: 255, discovered: s.discovered,
      });
      mapNames.push(s.name);
      mapNameLookup.set(s.name, i);
      mapTable.push({ longitude: s.x * 128, latitude: (499 - s.y) * 128 });
    });
    const region = { name: mapsFile.REGION_NAMES[R], mapNames, mapTable, mapNameLookup };
    const maps = {
      regionCount: R + 1,
      getRegion: (r) => (r === R ? region : null),
      getRegionByName: (n) => (n === region.name ? region : null),
      getPoliticIndex: (x, y) => (x < 28 ? 64 : R + 128),
      getClimateIndex: climateAt,
    };
    globalThis.__log = { traveled: [], ported: [], closed: 0 };
    globalThis.__gold = { total: 10000, pieces: 10000 };
    const deps = {
      maps, mapDict,
      woods: { heightMapBuffer: bytes },
      mapSize: { width: W, height: H },
      getPlayerPixel: () => ({ x: 70, y: 40 }),
      getClimateIndex: climateAt,
      gold: () => globalThis.__gold.total,
      goldPieces: () => globalThis.__gold.pieces,
      hasHorse: () => false, hasCart: () => false, hasShip: () => false,
      diseaseCount: () => 0, poisonCount: () => 0,
      onTravel: (pick, opts, computed) => globalThis.__log.traveled.push({ pick, opts, computed }),
      onTeleport: (pick) => globalThis.__log.ported.push(pick),
      onClose: () => { globalThis.__log.closed++; },
    };
    const renderer = new Renderer(canvas);
    const win = createTravelMapWindow(deps);
    if (armed2) win.activateTeleportationTravel();
    if (gotoPlace2) win.gotoPlace(gotoPlace2);
    globalThis.__win = win;
    globalThis.__deps = deps;
    globalThis.__renderer = renderer;
    globalThis.__canvas = canvas;
    globalThis.__law = { travel, model };
    globalThis.__spots = spots;
    globalThis.__frames = 0;
    let last = performance.now();
    let disposed = false;
    const loop = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!win.done) { win.tick(dt); win.draw(renderer, canvas); globalThis.__frames++; }
      else if (!disposed) { disposed = true; win.dispose(); }   // the host's own done->dispose step
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }, { armed2: armed, gotoPlace2: gotoPlace });
}

const state = (page) => page.evaluate(() => JSON.parse(globalThis.__overworld?.() ?? 'null'));
const waitPhase = (page, phase, timeout = 15000) => page.waitForFunction(
  (p) => globalThis.__overworld && JSON.parse(globalThis.__overworld()).phase === p, phase, { timeout });

/** A known scene point's CSS-pixel screen position, via the window's
 *  own projection. */
const screenAt = (page, x, z) => page.evaluate(([x2, z2]) => {
  const w = globalThis.__win;
  const y = w._heightAt(x2, z2) + 0.3;
  return w._project(x2, y, z2);
}, [x, z]);

async function runDesktop() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await mountOverworld(page);

  // ── 1. THE ASCENT ──────────────────────────────────────────────
  check('desktop: the door mounted the overworld', await page.evaluate(
    () => !!document.getElementById('enhanced-travelmap') && !!globalThis.__overworld));
  const sawVeil = await page.evaluate(() => new Promise((res) => {
    const t0 = performance.now();
    const poll = () => {
      const s = JSON.parse(globalThis.__overworld());
      if (s.veil >= 0.95) return res(true);
      if (performance.now() - t0 > 4000) return res(false);
      requestAnimationFrame(poll);
    };
    poll();
  }));
  check('desktop: the cloud veil covers the camera cut', sawVeil);
  await waitPhase(page, 'map');
  const rest = await state(page);
  check('desktop: the rise settles on the map at rest', rest.phase === 'map' && rest.veil === 0,
    JSON.stringify({ phase: rest.phase, veil: rest.veil }));
  check('desktop: the camera rose over the player pixel', Math.abs(rest.cam.tx - 70) <= 1
    && Math.abs(rest.cam.tz + 40) <= 1, JSON.stringify(rest.cam));

  // ── 2. THE RELIEF IS THE DATA ──────────────────────────────────
  // markers: the law's own count over the same summaries and filters
  const counts = await page.evaluate(() => {
    const { model } = globalThis.__law;
    const expected = model.buildMarkerModel(
      globalThis.__deps.mapDict.values(), globalThis.__win.filters,
      { isDiscovered: (s) => !!s.discovered }).length;
    return { expected, got: JSON.parse(globalThis.__overworld()).markers };
  });
  check('desktop: markers = buildMarkerModel over the same data (undiscovered hidden)',
    counts.expected === counts.got && counts.got === 4, JSON.stringify(counts));
  // pixels: a sea point reads blue, a land point does not
  const px = await page.evaluate(() => {
    const w = globalThis.__win, r = globalThis.__renderer, c = globalThis.__canvas;
    w.draw(r, c);   // fresh frame, read in the same task
    const gl = r.gl;
    const read = (sx, sy) => {
      const b = new Uint8Array(4);
      gl.readPixels(Math.round(sx * (c.width / c.clientWidth)),
        Math.round(gl.drawingBufferHeight - sy * (c.height / c.clientHeight)),
        1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b);
      return [...b];
    };
    const sea = w._project(10, w._heightAt(10, -40), -40);
    const land = w._project(45, w._heightAt(45, -40), -40);
    return { sea: sea && read(sea[0], sea[1]), land: land && read(land[0], land[1]) };
  });
  check('desktop: the western sea draws blue', !!px.sea && px.sea[2] > px.sea[0],
    JSON.stringify(px.sea));
  check('desktop: the eastern land does not', !!px.land && px.land[1] >= px.land[2],
    JSON.stringify(px.land));

  // ── 3. PAN AND ZOOM OWN THE POINTER ────────────────────────────
  const before = (await state(page)).cam;
  await page.mouse.move(640, 400);
  await page.mouse.down();
  await page.mouse.move(540, 340, { steps: 5 });
  await page.mouse.up();
  const afterPan = (await state(page)).cam;
  // grab semantics: dragging LEFT looks further east (+tx), dragging
  // UP looks further south (-tz - south is negative z)
  check('desktop: dragging pans the map', afterPan.tx > before.tx && afterPan.tz < before.tz,
    `${JSON.stringify(before)} -> ${JSON.stringify(afterPan)}`);
  await page.mouse.wheel(0, -600);
  await page.waitForTimeout(400);
  const afterZoom = (await state(page)).cam;
  check('desktop: the wheel zooms in', afterZoom.dist < afterPan.dist,
    `${afterPan.dist} -> ${afterZoom.dist}`);

  // ── 4. PICK -> THE DECISION PANEL, numbers law-checked ────────
  const cityPos = await screenAt(page, 40.5, -30.5);
  check('desktop: the city projects on screen', !!cityPos, JSON.stringify(cityPos));
  await page.mouse.click(cityPos[0], cityPos[1]);
  let s = await state(page);
  check('desktop: clicking the marker selects it', s.selected === 'Proofhold', s.selected);
  check('desktop: the hover label reads Region : Location shape',
    await page.evaluate(() => {
      globalThis.__win._hoverLabel(...globalThis.__win._project(40.5,
        globalThis.__win._heightAt(40.5, -30.5) + 0.3, -30.5));
      return document.querySelector('#enhanced-travelmap .ovlabel').textContent;
    }).then((t) => / : Proofhold$/.test(t)), 'label');
  await page.locator('#enhanced-travelmap .ovcard button', { hasText: 'Travel here' }).click();
  s = await state(page);
  check('desktop: the decision panel opens with the remembered defaults',
    s.panel === 'travel' && s.save.speedCautious === true && s.save.sleepInn === true
    && s.save.travelShip === true, JSON.stringify(s.save));
  const lawTrip = await page.evaluate(() => {
    const { travel } = globalThis.__law;
    const t = travel.calculateTravelTime({ x: 70, y: 40 }, { x: 40, y: 30 },
      { speedCautious: true, sleepModeInn: true, travelShip: true },
      globalThis.__deps.getClimateIndex);
    const c = travel.calculateTripCost(t.minutes, t.oceanPixels,
      { sleepModeInn: true, hasShip: false, travelShip: true });
    return { ...t, ...c, days: travel.travelDays(t.minutes) };
  });
  check('desktop: the panel trip is the law\'s own answer', JSON.stringify(s.trip) === JSON.stringify(lawTrip),
    `${JSON.stringify(s.trip)} vs ${JSON.stringify(lawTrip)}`);
  // a click ASSIGNS the pair member; reckless halves the cautious minutes
  await page.locator('#enhanced-travelmap .ovpick', { hasText: 'Recklessly' }).click();
  s = await state(page);
  check('desktop: Recklessly is exactly the halved law', s.trip.minutes === (lawTrip.minutes >> 1),
    `${s.trip.minutes} vs ${lawTrip.minutes} >> 1`);
  await page.locator('#enhanced-travelmap .ovpick', { hasText: 'Cautiously' }).click();

  // the two-sided gold gate: rich on paper, coinless at the inn
  await page.evaluate(() => { globalThis.__gold.pieces = 0; });
  await page.locator('#enhanced-travelmap .ovacts button', { hasText: 'Begin journey' }).click();
  s = await state(page);
  check('desktop: letters of credit cannot pay the inn', /gold pieces/.test(s.notice ?? '')
    && s.phase === 'map', s.notice);
  await page.evaluate(() => { globalThis.__gold.pieces = 10000; });

  // ── 5. THE FLIGHT, AND HOLD-TO-SKIP ────────────────────────────
  await page.locator('#enhanced-travelmap .ovacts button', { hasText: 'Begin journey' }).click();
  s = await state(page);
  check('desktop: Begin flies', s.phase === 'flight', s.phase);
  // the pill lights on the first FLIGHT tick, one frame after Begin
  check('desktop: the skip pill shows', await page.waitForFunction(
    () => document.querySelector('#enhanced-travelmap .ovskip')?.classList.contains('on'),
    null, { timeout: 3000 }).then(() => true, () => false));
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();
  await page.waitForFunction(() => globalThis.__win.done, null, { timeout: 15000 });
  // the host's done->dispose step runs on the next frame; wait for the
  // teardown the way townTalk's tick would deliver it
  await page.waitForFunction(
    () => document.querySelectorAll('#enhanced-travelmap').length === 0, null, { timeout: 5000 })
    .catch(() => {});
  const log = await page.evaluate(() => ({
    traveled: globalThis.__log.traveled, closed: globalThis.__log.closed,
    dom: document.querySelectorAll('#enhanced-travelmap').length,
  }));
  check('desktop: holding skipped the flight and the journey committed once',
    log.traveled.length === 1, `${log.traveled.length}`);
  const t0 = log.traveled[0];
  check('desktop: onTravel got fastTravelTo\'s own shapes',
    JSON.stringify(Object.keys(t0.pick)) === JSON.stringify(['pixel', 'name', 'region', 'mapId', 'regionIndex', 'locationIndex'])
    && t0.pick.name === 'Proofhold' && t0.pick.pixel.x === 40
    && JSON.stringify(Object.keys(t0.computed)) === JSON.stringify(['minutes', 'oceanPixels', 'piecesCost', 'totalCost']),
    JSON.stringify(t0.pick));
  check('desktop: onClose fired and the chrome is gone', log.closed === 1 && log.dom === 0,
    JSON.stringify(log));
  check('desktop: no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

async function runFilters() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await mountOverworld(page);
  await waitPhase(page, 'map');

  const base = (await state(page)).markers;
  await page.locator('#enhanced-travelmap .ovchip', { hasText: 'Dungeons' }).click();
  await page.waitForTimeout(150);
  await page.evaluate(() => { globalThis.__win.draw(globalThis.__renderer, globalThis.__canvas); });
  let s = await state(page);
  check('filters: hiding Dungeons drops exactly the dungeon bucket', s.markers === base - 1
    && s.filters.dungeons === true, `${base} -> ${s.markers}`);
  await page.locator('#enhanced-travelmap .ovchip', { hasText: 'Dungeons' }).click();

  // search: the find box's law - ranked, discovery-gated
  await page.fill('#enhanced-travelmap .ovsearch input', 'proofhold');
  const names = await page.$$eval('#enhanced-travelmap .ovresult-name', (ns) => ns.map((n) => n.textContent));
  check('search: the ranked match surfaces', names[0] === 'Proofhold', names.join('/'));
  await page.fill('#enhanced-travelmap .ovsearch input', 'hiddenport');
  const hidden = await page.$$eval('#enhanced-travelmap .ovresult-name', (ns) => ns.map((n) => n.textContent));
  check('search: an undiscovered place cannot be found', !hidden.includes('Hiddenport'),
    hidden.join('/') || '(none)');
  await page.fill('#enhanced-travelmap .ovsearch input', 'proofhold');
  await page.locator('#enhanced-travelmap .ovresult').first().click();
  s = await state(page);
  check('search: picking a result selects and flies the camera', s.selected === 'Proofhold'
    && Math.abs(s.cam.tx - 40.5) < 40, JSON.stringify({ sel: s.selected, cam: s.cam }));

  // Escape walks back: panel -> selection -> the world
  await page.keyboard.press('Escape');
  // the host would route Escape through input(); the probe drives the
  // same contract arm directly
  await page.evaluate(() => globalThis.__win.input('Escape'));
  s = await state(page);
  check('escape: steps back through selection', s.selected === null || s.panel === null, JSON.stringify(s));
  await page.evaluate(() => globalThis.__win.input('Escape'));
  await page.waitForFunction(() => globalThis.__win.done, null, { timeout: 5000 });
  check('escape: then closes the map', true);
  check('filters/search: no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

async function runTeleportAndGoto() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await mountOverworld(page, { armed: true });
  await waitPhase(page, 'map');

  const cityPos = await screenAt(page, 40.5, -30.5);
  await page.mouse.click(cityPos[0], cityPos[1]);
  let s = await state(page);
  check('teleport: an armed map answers a pick with the teleport box',
    s.panel === 'teleport' && s.armed === true, JSON.stringify({ panel: s.panel, armed: s.armed }));
  await page.locator('#enhanced-travelmap .ovacts button', { hasText: 'Not there' }).click();
  s = await state(page);
  check('teleport: No closes the box and the map stays ARMED', s.panel === null && s.armed === true,
    JSON.stringify({ panel: s.panel, armed: s.armed }));
  await page.mouse.click(cityPos[0], cityPos[1]);
  await page.locator('#enhanced-travelmap .ovacts button', { hasText: 'Teleport' }).click();
  s = await state(page);
  check('teleport: Yes skips the journey AND the flight', s.phase === 'descend' || s.phase === 'hold',
    s.phase);
  await page.waitForFunction(() => globalThis.__win.done, null, { timeout: 15000 });
  const ported = await page.evaluate(() => globalThis.__log.ported);
  check('teleport: onTeleport fired once with the pick shape', ported.length === 1
    && ported[0].name === 'Proofhold', JSON.stringify(ported));

  // gotoPlace: the journal's click-through
  await mountOverworld(page, {
    gotoPlace: {
      siteDetails: {
        regionName: await page.evaluate(() => globalThis.__deps.maps.getRegion(17).name),
        regionIndex: 17, locationName: 'Kyn Temple',
      },
    },
  });
  await waitPhase(page, 'map');
  s = await state(page);
  check('gotoPlace: the journal\'s place arrives selected with the decision open',
    s.selected === 'Kyn Temple' && s.panel === 'travel', JSON.stringify({ sel: s.selected, panel: s.panel }));
  check('teleport/goto: no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

async function runPhone() {
  const ctx = await browser.newContext(devices['Pixel 5']);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await mountOverworld(page);
  await waitPhase(page, 'map', 20000);
  const cityPos = await screenAt(page, 40.5, -30.5);
  check('phone: the city is on screen', !!cityPos);
  await page.touchscreen.tap(cityPos[0], cityPos[1]);
  const s = await state(page);
  check('phone: a tap selects', s.selected === 'Proofhold', s.selected ?? '(none)');
  const small = await page.$$eval('#enhanced-travelmap button', (ns) => ns
    .map((n) => ({ t: (n.textContent ?? '').trim().slice(0, 16), r: n.getBoundingClientRect() }))
    .filter(({ r }) => r.height > 0 && r.height < 44)
    .map(({ t, r }) => `${t}@${Math.round(r.height)}`));
  check('phone: every finger target is 44px', small.length === 0, small.join(', '));
  check('phone: no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

async function runClassicBoundary() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/menu.html?skin=classic&nofonts`, { waitUntil: 'domcontentloaded' });
  const out = await page.evaluate(async () => {
    const { createTravelMapWindow, travelMapDoorReady } = await import('/src/ui/travelMapDoor.js');
    return {
      ready: travelMapDoorReady(),
      win: createTravelMapWindow({ getPlayerPixel: () => ({ x: 0, y: 0 }) }) === null,
      dom: document.querySelectorAll('#enhanced-travelmap').length,
    };
  });
  check('classic: without its art the door answers null, and no overworld mounts',
    out.ready === false && out.win === true && out.dom === 0, JSON.stringify(out));
  await ctx.close();
}

try {
  await runDesktop();
  await runFilters();
  await runTeleportAndGoto();
  await runPhone();
  await runClassicBoundary();
} finally {
  await browser.close();
  await server.close();
}
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} checks passed`);
process.exit(bad.length ? 1 : 0);
