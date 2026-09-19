// MAP1/MAP2 - THE HELD MAP, in a real browser.
//
// WHAT ONLY A BROWSER CAN PROVE HERE is the sheet standing up: the
// sprite loading and the thumbs keyed back over the ink, a real 2D
// canvas laid on the paper's rectangle and painted, real pointer events
// panning, zooming toward the cursor, picking a mark and marking one,
// the card and the boxes as DOM the player can click, and the window
// walking open -> map -> closing -> done against a real clock. The LAWS
// are pinned in node (test/heldmap.test.js); here every number the
// screen shows is re-checked against the modules imported INTO the page.
//
// CI has no ARENA2 and never will, so the bay is SYNTHETIC: a 96x64
// heightmap with a western sea, a ridge and a handful of places, built
// in-page - the same seam the node tests use (deps.mapSize).
//
// Self-hosting: starts its own vite on 5225. Writes two screenshots
// beside the report so a person can look at the sheet.
//     node tools/heldMapProbe.mjs [--shots DIR]
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const PORT = 5225;
const SHOTS = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
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
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

/** The synthetic bay + a live window on the menu page (no game data). */
async function mount(page, { armed = false, gotoPlace = null, mod = false, party = false, hands = false } = {}) {
  await page.goto(`${BASE}/menu.html?skin=enhanced`, { waitUntil: 'networkidle' });
  await page.evaluate(async ({ armed2, gotoPlace2, mod2, party2, hands2 }) => {
    document.getElementById('enhanced-menu')?.remove();
    // MAP3: the REAL first-person rig on the fixture arm, drawn on a WebGL
    // canvas under the window, holding the sheet through the same four
    // closures the world host hands the window
    let holder, armLoop = null;
    if (hands2) {
      const [{ Renderer }, fp] = await Promise.all([import('/src/render/renderer.js'), import('/src/combat/fpArm.js')]);
      const cv = document.createElement('canvas');
      cv.id = 'armcv'; cv.width = innerWidth; cv.height = innerHeight;
      Object.assign(cv.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', zIndex: '1', background: '#223' });
      document.body.append(cv);
      const renderer = new Renderer(cv);
      const arm = fp.createFpArm();
      arm.attach(renderer, () => ({ pos: [0, 1.6, 0], yaw: 0, pitch: 0 }));
      const fx = async (n) => new Uint8Array(await (await fetch(`/test/fixtures/mw/${n}`)).arrayBuffer());
      const files = new Map([
        [fp.fpSkeletonPath({}), await fx('armfp.nif')], [fp.FP_CLIP_PATH, await fx('armfpidle.kf')],
        ['meshes/fixture/armfphand.nif', await fx('armfphand.nif')], ['meshes/fixture/armfparm.nif', await fx('armfparm.nif')],
        ['textures/tx_fixture.dds', await fx('fixture.dds')],
      ]);
      const esm = await fx('armfp.esm');
      const built = await arm.build({ race: 'fprace', deps: {
        loadMorrowindArchives: async () => [{ has: (q) => files.has(q), get: (q) => files.get(q) }],
        storedMorrowindNames: async () => ['armfp.esm'], loadMorrowindFile: async () => esm,
      } });
      let drew = false;
      const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      armLoop = (dt) => { renderer.beginFrame(I, I, new Float32Array([0.3, -0.9, 0.2])); arm.update(dt); drew = arm.draw(cv); };
      // the fixture rig is metre-scaled: the default sheet hangs off the
      // bottom of its frame, so the probe's pose puts a smaller sheet higher
      holder = {
        available: () => drew,
        hold: (spec, opts) => arm.holdPaper(spec ?? { paper: { width: 0.3, drop: 0.02, forward: 0.6 } }, opts),
        release: () => arm.releasePaper(),
        corners: () => arm.paperCorners(),
      };
      globalThis.__arm = arm;
      globalThis.__armRenderer = renderer;
      globalThis.__armCanvas = cv;
      globalThis.__armBuilt = { ok: built.ok, stage: built.stage, error: built.error };
    }
    const { createTravelMapWindow } = await import('/src/ui/travelMapDoor.js');
    const travel = await import('/src/systems/travel.js');
    const ink = await import('/src/ui/inkMap.js');
    const held = await import('/src/ui/heldMap.js');
    const mapsFile = await import('/src/formats/mapsFile.js');
    const ports = await import('/src/systems/travelPorts.js');

    const W = 96, H = 64;
    const bytes = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let b = 0;
        if (x >= 28 + Math.round(4 * Math.sin(y * 0.4))) b = 8 + Math.round(6 * Math.sin(x * 0.3) * Math.cos(y * 0.2) + 6);
        if (x > 55 && x < 65) b = 90 + ((x + y) % 20);
        bytes[y * W + x] = b;
      }
    }
    const climateAt = (x, y) => (bytes[y * W + x] === 0 ? 223 : (x > 55 && x < 65 ? 226 : 231));
    const R = 17, R2 = 18;
    const spots = [
      { x: 40, y: 30, type: 0, name: 'Proofhold', discovered: true, mapID: ports.PORT_LOCATION_IDS[0] },   // TownCity, a port
      { x: 45, y: 34, type: 2, name: 'Lowmarsh', discovered: true, mapID: 700001 },                        // TownVillage
      { x: 50, y: 28, type: 10, name: 'Cryptwatch', discovered: true, mapID: 700002 },                     // DungeonRuin
      { x: 42, y: 40, type: 5, name: 'Kyn Temple', discovered: true, mapID: 700003 },                      // ReligionTemple
      { x: 70, y: 20, type: 1, name: 'Farhamlet', discovered: true, mapID: 700004 },                       // TownHamlet
      { x: 52, y: 30, type: 0, name: 'Hiddenport', discovered: false, mapID: 700005 },
    ];
    const mapDict = new Map();
    const mapNames = [], mapTable = [], mapNameLookup = new Map();
    spots.forEach((s, i) => {
      const id = s.y * 1000 + s.x;
      mapDict.set(id, { id, mapID: s.mapID, regionIndex: R, mapIndex: i, locationType: s.type, dungeonType: 255, discovered: s.discovered });
      mapNames.push(s.name);
      mapNameLookup.set(s.name, i);
      mapTable.push({ longitude: s.x * 128, latitude: (499 - s.y) * 128 });
    });
    const region = { name: mapsFile.REGION_NAMES[R], mapNames, mapTable, mapNameLookup };
    const maps = {
      regionCount: R2 + 1,
      getRegion: (r) => (r === R ? region : null),
      getRegionByName: (n) => (n === region.name ? region : null),
      getPoliticIndex: (x, y) => (bytes[y * W + x] === 0 ? 64 : (y < 32 ? R : R2) + 128),
      getClimateIndex: climateAt,
    };
    const roads = new Uint8Array(W * H), tracks = new Uint8Array(W * H);
    for (let x = 40; x < 70; x++) roads[30 * W + x] = 32 | 2;   // an E-W road along row 30
    for (let y = 30; y < 40; y++) roads[y * W + 45] |= 128 | 8;  // a spur south from (45,30)
    for (let x = 45; x < 52; x++) tracks[36 * W + x] = 32 | 2;
    const net = { roads, tracks, source: 'basic-roads' };
    globalThis.__log = { traveled: [], ported: [], coords: [], resumed: 0, closed: 0 };
    globalThis.__gold = { total: 10000, pieces: 10000 };
    const to = mod2 ? {
      settings: { shipTravelPortsOnly: true, targetCoordsAllowed: true, cautiousTravel: true, stopAtInnsTravel: true,
        cautiousTravelMultiplier: 0.8, recklessTravelMultiplier: 1, markLocationColor: [255, 235, 5, 255], teleportCost: false },
      destinationName: mod2 === 'resume' ? 'Proofhold' : null, isTravelActive: false,
    } : null;
    const deps = {
      maps, mapDict, woods: { heightMapBuffer: bytes }, mapSize: { width: W, height: H },
      roads: () => net,
      getPlayerPixel: () => ({ x: 60, y: 45 }),
      getClimateIndex: climateAt,
      gold: () => globalThis.__gold.total, goldPieces: () => globalThis.__gold.pieces,
      hasHorse: () => false, hasCart: () => false, hasShip: () => false,
      diseaseCount: () => 0, poisonCount: () => 0,
      travelOptions: () => to, coordsAllowed: () => true,
      helpRows: () => (to ? ['Held map help', 'drag, wheel, click'] : null),
      discoveredBuildings: () => [{ buildingType: 0, displayName: 'The Odd Blades' }, { buildingType: 11, displayName: 'The Fighters Guild' }],
      buildingTypeName: (t) => (t === 0 ? 'Alchemist' : String(t)),
      party: party2 ? () => [{ acct: 'a1', name: 'Nym', px: 45, py: 34, in: 1, loc: 'Lowmarsh', online: true }] : undefined,
      onTravel: (pick, opts, computed) => globalThis.__log.traveled.push({ pick, opts, computed }),
      onTeleport: (pick) => globalThis.__log.ported.push(pick),
      onTravelToCoords: (pick, opts) => globalThis.__log.coords.push({ pick, opts }),
      onResumeTravel: () => { globalThis.__log.resumed++; },
      onClose: () => { globalThis.__log.closed++; },
      holder,
    };
    const win = createTravelMapWindow(deps);
    if (armed2) win.activateTeleportationTravel();
    if (gotoPlace2) win.gotoPlace(gotoPlace2);
    globalThis.__win = win;
    globalThis.__deps = deps;
    globalThis.__law = { travel, ink, held };
    globalThis.__spots = spots;
    globalThis.__frames = 0;
    let last = performance.now();
    let disposed = false;
    const loop = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (armLoop) armLoop(dt);
      if (!win.done) { win.tick(dt); win.draw(null, null); globalThis.__frames++; }
      else if (!disposed) { disposed = true; win.dispose(); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }, { armed2: armed, gotoPlace2: gotoPlace, mod2: mod, party2: party, hands2: hands });
}

const state = (page) => page.evaluate(() => JSON.parse(globalThis.__heldMap?.() ?? 'null'));
const waitPhase = (page, phase, timeout = 15000) => page.waitForFunction(
  (p) => globalThis.__heldMap && JSON.parse(globalThis.__heldMap()).phase === p, phase, { timeout });
/** A map pixel's CSS position on screen, through the window's own view. */
const screenOf = (page, x, y) => page.evaluate(([mx, my]) => {
  const w = globalThis.__win;
  const r = w._chrome.ink.getBoundingClientRect();
  const [px, py] = globalThis.__law.ink.toPaper(w._view, mx, my);
  return { x: r.left + px, y: r.top + py };
}, [x, y]);
/** How many ink-canvas pixels are painted (alpha > 0) inside a CSS rect, sampled. */
const inkCount = (page, rect) => page.evaluate((rc) => {
  const w = globalThis.__win;
  const c = w._chrome.ink; const ctx = c.getContext('2d');
  const dpr = w._paper.dpr;
  const r = c.getBoundingClientRect();
  const x0 = Math.max(0, Math.round((rc.x - r.left) * dpr)), y0 = Math.max(0, Math.round((rc.y - r.top) * dpr));
  const ww = Math.min(c.width - x0, Math.round(rc.w * dpr)), hh = Math.min(c.height - y0, Math.round(rc.h * dpr));
  if (ww <= 0 || hh <= 0) return 0;
  const d = ctx.getImageData(x0, y0, ww, hh).data;
  let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
  return n;
}, rect);

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => check(`page error: ${e.message}`, false));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`  [console.${m.type()}] ${m.text()}`); });

  // ── 1. THE SHEET STANDS UP ─────────────────────────────────────
  await mount(page, { party: true });
  await waitPhase(page, 'map');
  const geo = await page.evaluate(() => {
    const w = globalThis.__win; const c = w._chrome;
    const root = c.root.getBoundingClientRect(), stage = c.stage.getBoundingClientRect(), ink = c.ink.getBoundingClientRect();
    return {
      rootId: c.root.id, root: [root.width, root.height], stage: [stage.left, stage.top, stage.width, stage.height],
      ink: [ink.left, ink.top, ink.width, ink.height], inkPx: [c.ink.width, c.ink.height], dpr: w._paper.dpr,
      sprite: [c.sprite.naturalWidth, c.sprite.naturalHeight, c.sprite.complete],
      hands: [c.hands.width, c.hands.height],
      bg: getComputedStyle(c.root).backgroundColor, cursor: getComputedStyle(c.stage).cursor,
      PAPER: globalThis.__law.held.PAPER,
      HEIGHT: globalThis.__law.held.HELD_MAP_HEIGHT, BITE: globalThis.__law.held.HELD_MAP_BITE,
      FOOT: globalThis.__law.held.SPRITE_ART_FOOT, SPRITE: globalThis.__law.held.SPRITE,
    };
  });
// MAP-FIELD2 RETIRED THE LETTERBOX, and these two checks had gone stale
// with it - they still described the poster the sheet used to be, and
// had been failing quietly ever since. The sheet is HELD now: the root
// is CLEAR, because the world stands behind a thing in the player's
// hands, and the stage is bottom-anchored on the PAINTING's foot rather
// than centred in the viewport.
  check('root mounted with the map id, and CLEAR - the world stands behind a held thing', geo.rootId === 'enhanced-travelmap' && /rgba\(0, 0, 0, 0\)|transparent/.test(geo.bg), geo.bg);
  let wantH = 800 * geo.HEIGHT / geo.FOOT, wantW = wantH * geo.SPRITE.w / geo.SPRITE.h;
  if (wantW > 1280) { wantW = 1280; wantH = wantW * geo.SPRITE.h / geo.SPRITE.w; }
  const wantY = 800 - (geo.FOOT - geo.BITE) * wantH;
  check('stage is the sprite anchored on the PAINTING\'s foot, centred across', Math.abs(geo.stage[2] - wantW) < 1 && Math.abs(geo.stage[3] - wantH) < 1
    && Math.abs(geo.stage[0] - (1280 - wantW) / 2) < 1 && Math.abs(geo.stage[1] - wantY) < 1, JSON.stringify({ stage: geo.stage, want: [(1280 - wantW) / 2, wantY, wantW, wantH] }));
  check('...and the painting\'s foot goes PAST the bottom edge, so no gap is left under the arms', geo.stage[1] + geo.stage[3] * geo.FOOT > 800, `foot at ${(geo.stage[1] + geo.stage[3] * geo.FOOT).toFixed(1)} of 800`);
  const P = geo.PAPER;
  check('ink canvas lies on PAPER of the stage', Math.abs(geo.ink[0] - (geo.stage[0] + geo.stage[2] * P.x0)) < 1 && Math.abs(geo.ink[2] - geo.stage[2] * (P.x1 - P.x0)) < 1 && Math.abs(geo.ink[3] - geo.stage[3] * (P.y1 - P.y0)) < 1, JSON.stringify(geo.ink));
  check('canvas backing store is the paper at device resolution', Math.abs(geo.inkPx[0] - geo.ink[2] * geo.dpr) <= 1 && Math.abs(geo.inkPx[1] - geo.ink[3] * geo.dpr) <= 1, JSON.stringify(geo.inkPx));
  await page.waitForFunction(() => globalThis.__win._chrome.sprite.complete && globalThis.__win._chrome.hands.width > 1, null, { timeout: 10000 }).catch(() => {});
  const spr = await page.evaluate(() => { const c = globalThis.__win._chrome; return [c.sprite.naturalWidth, c.sprite.naturalHeight, c.hands.width, c.hands.height]; });
  check('the sprite loaded at its own size', spr[0] === 1448 && spr[1] === 1086, JSON.stringify(spr));
  check('the hands canvas was keyed at the sprite\'s size', spr[2] === 1448 && spr[3] === 1086, JSON.stringify(spr));
  const key = await page.evaluate(() => {
    const c = globalThis.__win._chrome.hands; const ctx = c.getContext('2d');
    const at = (fx, fy) => ctx.getImageData(Math.round(fx * c.width), Math.round(fy * c.height), 1, 1).data[3];
    // a thumb pixel (left thumb, on the paper), the paper's centre, and
    // the clear ground beside the hand. MAP-FIELD4: the sample point is
    // READ OFF the row below, not guessed - the thumbs moved with the
    // painting, and the old point (0.16, 0.55) now lands just outside
    // the left one.
    return { thumb: at(0.18, 0.6), paper: at(0.5, 0.45), clear: at(0.02, 0.9), thumbZoneRow: Array.from({ length: 10 }, (_, i) => at(0.12 + i * 0.015, 0.6)) };
  });
// MAP-FIELD4: OPAQUE, not exactly 255. The copy of Mac's painting this
// port was given arrived through a lossy re-encode, which left its
// solid interior at alpha 251-254 instead of 255. That is invisible on
// screen and above every threshold the module tests, so the pin asks
// the module's own question - is this pixel THERE - rather than a
// number the transport happened not to preserve. An original PNG would
// pass this unchanged.
  check('the left thumb is keyed back OVER the ink (opaque)', key.thumb > 128, JSON.stringify(key));
  check('the paper\'s centre is clear (outside the thumb zones nothing is drawn)', key.paper === 0, String(key.paper));

  // the ink: something is painted, and it is where the model says
  const painted = await inkCount(page, await page.evaluate(() => { const r = globalThis.__win._chrome.ink.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }));
  check('the sheet carries ink', painted > 2000, `${painted} painted device pixels`);
  const city = await screenOf(page, 40.5, 30.5);
  check('ink at the city\'s mark', await inkCount(page, { x: city.x - 8, y: city.y - 8, w: 16, h: 16 }) > 20);
  const sea = await screenOf(page, 5, 5);
  check('no ink on open sea', await inkCount(page, { x: sea.x - 6, y: sea.y - 6, w: 12, h: 12 }) === 0);
  const st0 = await state(page);
  const restScale = await page.evaluate(() => globalThis.__law.ink.scaleMinOf(globalThis.__win._limits()));
  check('at rest the whole bay is on the sheet (contain) and the five discovered places are marks', Math.abs(st0.view.scale - restScale) < 0.01 && st0.marks === 5, JSON.stringify({ marks: st0.marks, view: st0.view, restScale }));
  check('the party stands with the window', st0.party.length === 1 && st0.party[0].startsWith('Nym@45,34/1'), JSON.stringify(st0.party));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/held-map-rest.png` });

  // ── 2. THE POINTER: hover, pan, wheel, pick ────────────────────
  await page.mouse.move(city.x, city.y);
  await page.waitForTimeout(50);
  const hov = await page.evaluate(() => [globalThis.__win._chrome.label.textContent, getComputedStyle(globalThis.__win._chrome.stage).cursor]);
  check('hover over the city reads "Region : Name" with a pointer cursor', hov[0] === 'Daggerfall : Proofhold' && hov[1] === 'pointer', JSON.stringify(hov));
  const before = (await state(page)).view;
  await page.mouse.move(city.x + 200, city.y + 100);
  await page.mouse.down();
  await page.mouse.move(city.x + 150, city.y + 60, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(80);
  const afterPan = (await state(page)).view;
  check('a drag pans the view (clamped)', afterPan.ox !== before.ox || afterPan.oy !== before.oy || before.scale === afterPan.scale, JSON.stringify({ before, afterPan }));
  const mid = await page.evaluate(() => { const r = globalThis.__win._chrome.ink.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const under = await page.evaluate(([x, y]) => { const w = globalThis.__win; const r = w._chrome.ink.getBoundingClientRect(); return globalThis.__law.ink.toMap(w._view, x - r.left, y - r.top); }, [mid.x, mid.y]);
  await page.mouse.move(mid.x, mid.y);
  await page.mouse.wheel(0, -600);
  await page.mouse.wheel(0, -600);   // past the ceiling: the clamp must not move the point under the cursor
  await page.waitForTimeout(80);
  const after = await page.evaluate(([x, y]) => { const w = globalThis.__win; const r = w._chrome.ink.getBoundingClientRect(); return { under: globalThis.__law.ink.toMap(w._view, x - r.left, y - r.top), scale: w._view.scale }; }, [mid.x, mid.y]);
  check('the wheel zooms IN toward the cursor - the map point under it holds', after.scale > before.scale && Math.abs(after.under[0] - under[0]) < 0.05 && Math.abs(after.under[1] - under[1]) < 0.05, JSON.stringify({ under, after }));
  const st1 = await state(page);
  check('the band moved with the scale', st1.band === (await page.evaluate((s) => globalThis.__law.ink.zoomBand(s), after.scale)), st1.band);
  // pick the village (visible at mid/near)
  await page.evaluate(() => { const w = globalThis.__win; w._focusOn(45.5, 34.5, 8); for (let i = 0; i < 60; i++) w.tick(0.05); });
  const vil = await screenOf(page, 45.5, 34.5);
  await page.mouse.click(vil.x, vil.y);
  await page.waitForTimeout(80);
  const st2 = await state(page);
  check('a click on the village selects it', st2.selected === 'Lowmarsh', String(st2.selected));
  const card = await page.evaluate(() => { const c = globalThis.__win._chrome.card; const r = c.getBoundingClientRect(); return { display: getComputedStyle(c).display, w: r.width, title: c.children[0]?.textContent, buttons: [...c.querySelectorAll('button')].map((b) => b.textContent) }; });
  check('the card is on screen with the place and its one button', card.display === 'block' && card.w > 200 && card.title === 'Lowmarsh' && card.buttons.includes('Travel here'), JSON.stringify(card));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/held-map-picked.png` });
  await page.click('.hmcard button');   // Travel here
  await page.waitForTimeout(50);
  const st3 = await state(page);
  const lawTrip = await page.evaluate(() => {
    const { travel } = globalThis.__law; const d = globalThis.__deps;
    const t = travel.calculateTravelTime(d.getPlayerPixel(), { x: 45, y: 34 }, { speedCautious: true, sleepModeInn: true, travelShip: true, hasHorse: false, hasCart: false }, d.getClimateIndex);
    const c = travel.calculateTripCost(t.minutes, t.oceanPixels, { sleepModeInn: true, hasShip: false, travelShip: true });
    return { minutes: t.minutes, totalCost: c.totalCost, days: travel.travelDays(t.minutes) };
  });
  check('the panel\'s trip is the law\'s own numbers', st3.panel === 'travel' && st3.trip.minutes === lawTrip.minutes && st3.trip.totalCost === lawTrip.totalCost && st3.trip.days === lawTrip.days, JSON.stringify({ trip: st3.trip, lawTrip }));
  const cardTexts = await page.evaluate(() => [...globalThis.__win._chrome.card.querySelectorAll('dd')].map((d) => d.textContent));
  check('the card reads the same days and fare', cardTexts[0] === `${lawTrip.days} ${lawTrip.days === 1 ? 'day' : 'days'}` && cardTexts[1] === `${lawTrip.totalCost} gold`, JSON.stringify(cardTexts));
  await page.click('.hmcard .hmacts .act:not(.hmghost)');   // Begin journey
  await page.waitForFunction(() => globalThis.__win.done, null, { timeout: 5000 });
  const log = await page.evaluate(() => globalThis.__log);
  check('Begin lowers the sheet, fires onTravel once with the classic pick, and the window is done', log.traveled.length === 1 && log.traveled[0].pick.name === 'Lowmarsh' && log.traveled[0].pick.pixel.x === 45 && log.closed === 1, JSON.stringify(log.traveled[0]?.pick));
  const gone = await page.evaluate(() => !!document.getElementById('enhanced-travelmap'));
  check('the DOM is torn down after done', gone === false);

  // ── 3. MAP2: the mod on the sheet ───────────────────────────────
  await mount(page, { mod: true });
  await waitPhase(page, 'map');
  const portsBtn = await page.evaluate(() => getComputedStyle(globalThis.__win._chrome.ports).display);
  check('the Ports button shows while ships are restricted to ports', portsBtn !== 'none', portsBtn);
  await page.click('.hmports');
  await page.waitForTimeout(50);
  const stP = await state(page);
  check('Ports only: the inland places leave the sheet', stP.portsFilter === true && stP.marks === 1, JSON.stringify({ portsFilter: stP.portsFilter, marks: stP.marks }));
  await page.click('.hmports');
  await page.evaluate(() => { const w = globalThis.__win; w._focusOn(45.5, 34.5, 8); for (let i = 0; i < 60; i++) w.tick(0.05); });
  const vil2 = await screenOf(page, 45.5, 34.5);
  await page.mouse.click(vil2.x, vil2.y, { button: 'middle' });
  await page.waitForTimeout(50);
  const stM = await state(page);
  check('a middle click marks the place under the cursor', stM.marked === 700001, String(stM.marked));
  const ringInk = await inkCount(page, { x: vil2.x - 12, y: vil2.y - 12, w: 24, h: 24 });
  check('the mark is inked', ringInk > 30, String(ringInk));
  await page.mouse.click(vil2.x, vil2.y);
  await page.evaluate(() => globalThis.__win.input('KeyI'));
  await page.waitForTimeout(50);
  const box = await page.evaluate(() => { const b = globalThis.__win._chrome.box; return { display: getComputedStyle(b).display, text: b.textContent }; });
  check('I opens the building list over the sheet', box.display === 'block' && /Lowmarsh/.test(box.text) && /Fighters Guild/.test(box.text) && /Alchemist/.test(box.text), box.text.slice(0, 80));
  await page.mouse.click(mid.x, mid.y);
  await page.waitForTimeout(50);
  const boxAfter = await page.evaluate(() => ({ display: getComputedStyle(globalThis.__win._chrome.box).display, selected: globalThis.__win._selected?.name }));
  check('a click anywhere closes the box and neither pans nor picks', boxAfter.display === 'none' && boxAfter.selected === 'Lowmarsh', JSON.stringify(boxAfter));
  await page.evaluate(() => globalThis.__win.input('KeyH'));
  const help = await page.evaluate(() => globalThis.__win._chrome.box.textContent);
  check('H shows the host\'s help rows', /Held map help/.test(help));
  await page.evaluate(() => globalThis.__win.input('Escape'));
  // the coordinates click on bare land
  await page.evaluate(() => globalThis.__win.input('Escape'));   // drop the selection
  const bare = await screenOf(page, 47.5, 31.5);
  await page.mouse.click(bare.x, bare.y);
  await page.waitForTimeout(50);
  const stC = await state(page);
  check('a bare pixel opens the coordinates decision with the walked estimate', stC.selected === 'Map coordinates: 47, 31.' && stC.panel === 'travel' && stC.trip?.walked === true, JSON.stringify({ selected: stC.selected, panel: stC.panel, walked: stC.trip?.walked }));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/held-map-coords.png` });
  await page.click('.hmcard .hmacts .act:not(.hmghost)');
  await page.waitForFunction(() => globalThis.__win.done, null, { timeout: 5000 });
  const log2 = await page.evaluate(() => globalThis.__log);
  check('Begin hands onTravelToCoords the popup\'s {pixel, name} with playerControlled', log2.coords.length === 1 && log2.coords[0].pick.pixel.x === 47 && log2.coords[0].opts.playerControlled === true, JSON.stringify(log2.coords[0]));

  // ── 4. the resume prompt, and No stays ─────────────────────────
  await mount(page, { mod: 'resume' });
  await page.waitForFunction(() => JSON.parse(globalThis.__heldMap()).top === 'resume', null, { timeout: 5000 });
  const rbox = await page.evaluate(() => [...globalThis.__win._chrome.box.querySelectorAll('button')].map((b) => b.textContent));
  check('the resume prompt offers Resume / Not now', rbox.includes('Resume') && rbox.includes('Not now'), JSON.stringify(rbox));
  await page.click('.hmbox .hmghost');
  await page.waitForTimeout(50);
  const stR = await state(page);
  check('Not now pops the box alone and the map stays', stR.top === null && stR.phase !== 'closing', JSON.stringify({ top: stR.top, phase: stR.phase }));
  await waitPhase(page, 'map');
  await page.evaluate(() => globalThis.__win.input('Escape'));
  await page.waitForFunction(() => globalThis.__win.done, null, { timeout: 5000 });

  // ── 5. gotoPlace lands selected with the panel open, teleport arms the pick ──
  await mount(page, { gotoPlace: { siteDetails: { regionName: 'Daggerfall', regionIndex: 17, locationName: 'Kyn Temple' } } });
  await waitPhase(page, 'map');
  const stG = await state(page);
  check('gotoPlace selects the place and opens the decision', stG.selected === 'Kyn Temple' && stG.panel === 'travel', JSON.stringify({ selected: stG.selected, panel: stG.panel }));
  await page.evaluate(() => globalThis.__win.input('Escape'));
  await page.evaluate(() => globalThis.__win.input('Escape'));
  await page.evaluate(() => globalThis.__win.input('Escape'));
  await page.waitForFunction(() => globalThis.__win.done, null, { timeout: 5000 });
  await mount(page, { armed: true });
  await waitPhase(page, 'map');
  await page.evaluate(() => { const w = globalThis.__win; w._focusOn(40.5, 30.5, 8); for (let i = 0; i < 60; i++) w.tick(0.05); });
  const cityT = await screenOf(page, 40.5, 30.5);
  await page.mouse.click(cityT.x, cityT.y);
  await page.waitForTimeout(50);
  const stT = await state(page);
  check('armed for teleport, a pick opens the teleport box', stT.armed === true && stT.panel === 'teleport');
  await page.click('.hmcard .hmacts .act:not(.hmghost)');
  await page.waitForFunction(() => globalThis.__win.done, null, { timeout: 5000 });
  const log3 = await page.evaluate(() => globalThis.__log);
  check('Teleport fires onTeleport once', log3.ported.length === 1 && log3.ported[0].name === 'Proofhold');

  // ── 6. MAP3: THE HANDS LANE on the real rig ────────────────────
  await mount(page, { hands: true });
  await waitPhase(page, 'map');
  await page.waitForFunction(() => JSON.parse(globalThis.__heldMap()).placed, null, { timeout: 10000 }).catch(() => {});
  const hb = await page.evaluate(() => globalThis.__armBuilt);
  check('the fixture rig built in the page', hb.ok === true, JSON.stringify(hb));
  const hs = await state(page);
  check('the window took the hands lane and placed the sheet', hs.lane === 'hands' && hs.placed === true, JSON.stringify({ lane: hs.lane, placed: hs.placed }));
  const hg = await page.evaluate(() => {
    const w = globalThis.__win; const c = w._chrome;
    const cs = getComputedStyle(c.ink);
    const r = c.ink.getBoundingClientRect();
    const corners = globalThis.__arm.paperCorners();
    const xs = corners.map((p) => p[0]), ys = corners.map((p) => p[1]);
    return {
      sheet: getComputedStyle(c.sheet).display, hands: getComputedStyle(c.hands).display,
      rootBg: getComputedStyle(c.root).backgroundColor,
      transform: cs.transform.slice(0, 9), origin: cs.transformOrigin,
      box: [r.left, r.top, r.right, r.bottom].map((v) => Math.round(v)),
      want: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map((v) => Math.round(v)),
      corners: corners.map((p) => p.map((v) => Math.round(v))),
    };
  });
// MAP-FIELD2 again: what the stage SHOWS is the canvas, `sheet` - the
// <img> is only the loader and was never displayed, so asking after its
// display told us nothing and this check had gone stale with the rest.
  check('the painting and its thumbs are gone and the root is clear', hg.sheet === 'none' && hg.hands === 'none' && /rgba\(0, 0, 0, 0\)|transparent/.test(hg.rootBg), JSON.stringify([hg.sheet, hg.hands, hg.rootBg]));
  check('the ink is under a matrix3d about its top-left', hg.transform === 'matrix3d(' && hg.origin.startsWith('0px 0px'), JSON.stringify([hg.transform, hg.origin]));
  const near = (a, b) => Math.abs(a - b) <= 2;
  check('the browser lays the canvas exactly on the rig\'s corners (the bounding box, to 2 px)', hg.box.every((v, i) => near(v, hg.want[i])), JSON.stringify({ box: hg.box, want: hg.want }));
  check('four corners on screen, a level trapezium wider at the bottom', hg.corners.length === 4 && hg.corners[0][1] === hg.corners[1][1] && hg.corners[2][0] - hg.corners[3][0] > hg.corners[1][0] - hg.corners[0][0], JSON.stringify(hg.corners));
  // the PARCHMENT is under the ink: the texel at the corners' centre on
  // the arm's own offscreen target (the pass clears it to alpha 0, so
  // alpha there is the sheet; the first browser run had none - the
  // sheet sat past the far plane the arm's reach set)
  const texel = await page.evaluate(async () => {
    const { MW_ARM_PIXEL, CHAR_SPRITE_RT_SIZE } = await import('/src/render/renderer.js');
    const cv = globalThis.__armCanvas, r = globalThis.__armRenderer, gl = r.gl;
    const wantW = cv.clientWidth / MW_ARM_PIXEL, wantH = cv.clientHeight / MW_ARM_PIXEL;
    const sc = Math.min(1, CHAR_SPRITE_RT_SIZE / wantW, CHAR_SPRITE_RT_SIZE / wantH);
    const pw = Math.max(2, Math.round(wantW * sc)), ph = Math.max(2, Math.round(wantH * sc));
    const c = globalThis.__arm.paperCorners();
    const cx = (c[0][0] + c[2][0]) / 2, cy = (c[0][1] + c[2][1]) / 2;
    const tx = Math.min(pw - 1, Math.max(0, Math.round(cx / cv.clientWidth * pw))), ty = Math.min(ph - 1, Math.max(0, Math.round((1 - cy / cv.clientHeight) * ph)));
    const cs = r._charSpriteRT();
    gl.bindFramebuffer(gl.FRAMEBUFFER, cs.fbo);
    const px = new Uint8Array(4);
    gl.readPixels(tx, ty, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tx, ty, rgba: [...px] };
  });
  check('the parchment is drawn under the ink (the arm target\'s texel at the corners\' centre)', texel.rgba[3] > 8 && texel.rgba[0] > texel.rgba[2], JSON.stringify(texel));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/held-map-hands.png` });
  // a click through the angle: the city's sheet point, forward-mapped, hits it
  await page.evaluate(() => { const w = globalThis.__win; w._focusOn(40.5, 30.5, 8); for (let i = 0; i < 60; i++) w.tick(0.05); });
  const cityH = await page.evaluate(() => {
    const w = globalThis.__win;
    const [px, py] = globalThis.__law.ink.toPaper(w._view, 40.5, 30.5);
    const [sx, sy] = w._placement.toScreen(px, py);
    const r = w._chrome.root.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + sx, r.top + sy);
    return { x: r.left + sx, y: r.top + sy, px, py, back: w._paperPoint(r.left + sx, r.top + sy), under: el ? `${el.tagName}.${el.className}` : null, marks: w._model.marks.filter((m) => m.name === 'Proofhold').map((m) => [m.x, m.y]) };
  });
  await page.mouse.move(cityH.x, cityH.y);
  await page.waitForTimeout(50);
  const hoverH = await page.evaluate(() => globalThis.__win._chrome.label.textContent);
  check('hover through the inverse names the city under the angled sheet', hoverH === 'Daggerfall : Proofhold', JSON.stringify(hoverH));
  await page.mouse.click(cityH.x, cityH.y);
  await page.waitForTimeout(50);
  const pickH = await state(page);
  check('a click through the inverse picks it', pickH.selected === 'Proofhold', JSON.stringify({ selected: pickH.selected }));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/held-map-hands-picked.png` });
  // the sheet goes with the window
  await page.evaluate(() => globalThis.__win.input('Escape'));
  await page.evaluate(() => globalThis.__win.input('Escape'));
  await page.waitForFunction(() => globalThis.__win.done, null, { timeout: 5000 });
  const released = await page.evaluate(() => ({ pose: globalThis.__arm.heldPose(), corners: globalThis.__arm.paperCorners() }));
  check('closing the map releases the sheet from the arm', released.pose === null && released.corners === null, JSON.stringify(released));

  // ── 7. MAP-FIELD: the sprite, asked for from the GAME'S OWN PAGE ──
  // Every check above mounts the window on menu.html, which sits at the
  // site root - where a document-relative 'art/held-map.png' happens to
  // resolve. The game is /play/index.html, one directory down, and there
  // the same string asked for /play/art/held-map.png and got the page
  // back. So this check runs from that depth, on purpose.
  await page.goto(`${BASE}/play/index.html?skin=enhanced`, { waitUntil: 'domcontentloaded' });
  const sprite = await page.evaluate(async () => {
    const { HELD_MAP_URL } = await import('/src/ui/heldMap.js');
    const res = await fetch(HELD_MAP_URL);
    const img = new Image();
    const decoded = await new Promise((ok) => { img.onload = () => ok(true); img.onerror = () => ok(false); img.src = HELD_MAP_URL; });
    return { url: HELD_MAP_URL, page: location.pathname, status: res.status, type: res.headers.get('content-type'), decoded, w: img.naturalWidth, h: img.naturalHeight };
  });
  check('the sprite resolves from the GAME page, not the site root', /^https?:\/\/[^/]+\/art\/held-map\.png$/.test(sprite.url) && sprite.page === '/play/index.html', JSON.stringify({ url: sprite.url, page: sprite.page }));
  check('...and it is served as a PNG', sprite.status === 200 && /image\/png/.test(sprite.type ?? ''), JSON.stringify({ status: sprite.status, type: sprite.type }));
  check('...and the browser decodes Mac\'s painting at its own size', sprite.decoded && sprite.w === 1448 && sprite.h === 1086, JSON.stringify({ decoded: sprite.decoded, w: sprite.w, h: sprite.h }));
} catch (e) {
  check(`probe threw: ${e.message}`, false);
} finally {
  await browser.close();
  await server.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
