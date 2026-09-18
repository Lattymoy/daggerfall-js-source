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
async function mount(page, { armed = false, gotoPlace = null, mod = false, party = false } = {}) {
  await page.goto(`${BASE}/menu.html?skin=enhanced`, { waitUntil: 'networkidle' });
  await page.evaluate(async ({ armed2, gotoPlace2, mod2, party2 }) => {
    document.getElementById('enhanced-menu')?.remove();
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
      if (!win.done) { win.tick(dt); win.draw(null, null); globalThis.__frames++; }
      else if (!disposed) { disposed = true; win.dispose(); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }, { armed2: armed, gotoPlace2: gotoPlace, mod2: mod, party2: party });
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
    };
  });
  check('root mounted with the map id, opaque black', geo.rootId === 'enhanced-travelmap' && geo.bg === 'rgb(0, 0, 0)', geo.bg);
  const sw = Math.min(1280, 800 * 1448 / 1086);
  check('stage is the sprite\'s 4:3 letterboxed into the viewport', Math.abs(geo.stage[2] - sw) < 1 && Math.abs(geo.stage[3] - 800) < 1 && Math.abs(geo.stage[0] - (1280 - sw) / 2) < 1, JSON.stringify(geo.stage));
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
    // a thumb pixel (left thumb, inside the paper), the paper's centre, the black beside the hand
    return { thumb: at(0.16, 0.55), paper: at(0.5, 0.45), black: at(0.02, 0.9), thumbZoneRow: Array.from({ length: 10 }, (_, i) => at(0.12 + i * 0.015, 0.6)) };
  });
  check('the left thumb is keyed back OVER the ink (opaque)', key.thumb === 255, JSON.stringify(key));
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
} catch (e) {
  check(`probe threw: ${e.message}`, false);
} finally {
  await browser.close();
  await server.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
