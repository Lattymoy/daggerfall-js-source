// PORTAL-BAY (2026-10-26, bible/06-Systems/Portal-Stone.md PORTAL-BAY; the owner, playing the branch: "attempting to
// teleport anywhere outside the bay with the portal stone leads to a black screen and a prompt telling you cannot
// travel", and "it wasnt letting the user teleport to a city either"). A TELEPORT IS NO JOURNEY: AUDIT TESA II P4 put
// TESA-NO-FAST's journey law (systems/travel/pastBayTravel.js pastBayJourney) at the gate every journey passes
// (scenes/world.js wildTravelGate), and the guild's teleport (teleportTo), the stone's step into it and Recall passed it
// too - the stone spent at the pick, the screen blacked at the step, then "No road the Bay knows leads there". These pins
// run the stone's whole road with the host's own code: the held map's press on a city past the Bay (ui/heldMap.js
// _pickAt, in teleport mode), the stone's door, pick and step (scenes/portalStoneHost.js, the module the world host
// wires), the portals' step (scenes/portalGates.js), and world.js's own teleportTo, its gates and Recall, cut whole and
// run over a stand-in scope (test/systems/portal1_stone.test.js's idiom) down to _teleportToPixel - the streamer's
// rebuild of the destination, the arrival every teleport of the Bay's takes - recorded with what it was asked.
import '../modsOff.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPortalStoneHost } from '../../src/scenes/portalStoneHost.js';
import { createPortalGates } from '../../src/scenes/portalGates.js';
import { hudFade } from '../../src/ui/fadeLayer.js';
import { playerEntity } from '../../src/characters/playerEntity.js';
import { portalStones } from '../../src/systems/gate/gateSpoils.js';
import { PORTAL_TEXT, PORTAL_HOLD_TEXT } from '../../src/systems/portalStone.js';
import { pastBayJourney, teleportJourney } from '../../src/systems/travel/pastBayTravel.js';
import { wildJourney, wildInside, buildWildMask, WILD_NAME } from '../../src/systems/wild/wildZone.js';
import { zonePortFree, teleportLanding } from '../../src/systems/wild/zoneSafe.js';   // WILD-CITY-PORT
import { inEther } from '../../src/world/ethericSea.js';
import { inBay } from '../../src/world/tamriel/tamrielFrame.js';
import { REPOSITION } from '../../src/systems/ship.js';
import { teleportPlan } from '../../src/systems/teleportAnchor.js';
import { HeldMapWindow } from '../../src/ui/heldMap.js';
import { tamrielInkFor } from '../../src/ui/tamrielInk.js';
import { setCapitalsStanding, capitalOnPixel, synthesizeCapitalLocation } from '../../src/world/tamrielCapitals.js';
import { locationWorldRect, mapPixelToWorldCoords } from '../../src/world/streamingWorld.js';   // WILD-CITY-PORT: a slice's streets
import { _resetForTests } from '../../src/systems/uiPrefs.js';
import { portalLandAt } from '../../src/systems/travel/pastBayTravel.js';   // PORTAL-ANYWHERE
import { floorLanding, heldInSolid, openGroundNear, safeGroundAt, safeGroundNear, levelGroundAt, LANDING_LEVEL_REACH, LANDING_STEEP } from '../../src/player/enterExit.js';
import { TERRAIN_SIZE } from '../../src/world/terrain/terrainSampler.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const W_SRC = read('src/scenes/world.js');
function cut(src, head, end) {
  const i = src.indexOf(head);
  assert.ok(i >= 0, `${head} is in the source`);
  const j = src.indexOf(end, i);
  assert.ok(j > i, 'and it ends');
  return src.slice(i, j + end.length);
}
function mount(scope, code, name) {
  const proxy = new Proxy(scope, {
    has: () => true,
    get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  // eslint-disable-next-line no-new-func
  return new Function('__scope', `with (__scope) { ${code}\n return ${name}; }`)(proxy);
}
const settle = () => new Promise((res) => setTimeout(res, 0));
const fakeRenderer = () => ({ uploadTexture() {}, uploadEmissionTexture() {}, createBillboardBatch: () => ({}), destroyBillboardBatch() {} });

// ── the held map (test/systems/starts/auditstarts.test.js's harness) ──
const skin = (v) => { _resetForTests(); globalThis.location = { search: `?skin=${v}` }; };
afterEach(() => { _resetForTests(); delete globalThis.location; delete globalThis.document; setCapitalsStanding(false); hudFade.clearFade(); });
globalThis.ImageData ??= class { constructor(d, w, h) { if (typeof d === 'number') { h = w; w = d; d = new Uint8ClampedArray(w * h * 4); } this.data = d; this.width = w; this.height = h ?? d.length / 4 / w; } };
const pen = () => new Proxy({}, {
  get: (t, k) => (k in t ? t[k] : k === 'createImageData' || k === 'getImageData' ? (w = 1, h = 1) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h })
    : k === 'measureText' ? () => ({ width: 1 }) : () => ({ addColorStop() {} })),
  set: (t, k, v) => { t[k] = v; return true; },
});
function fakeDocument() {
  const node = (tag) => {
    const n = {
      tag, children: [], style: {}, dataset: {}, classList: { toggle() {}, add() {}, remove() {} },
      append(...k) { n.children.push(...k); }, remove() { n.removed = true; },
      addEventListener() {}, removeEventListener() {}, setPointerCapture() {}, querySelectorAll: () => [],
      className: '', textContent: '', id: '', attrs: {}, setAttribute(k, v) { n.attrs[k] = v; },
      set innerHTML(v) { n.children = []; }, get innerHTML() { return ''; }, getContext: () => pen(), width: 0, height: 0,
    };
    return n;
  };
  return { createTextNode: (t) => ({ textContent: t, nodeType: 3 }), createElementNS: (_ns, t) => node(t), createElement: (t) => node(t), getElementById: () => null, head: node('head'), body: node('body'), addEventListener() {}, removeEventListener() {} };
}
/** The held map as the stone's door builds it (world.js buildTravelMapWindow - the deps the door hands, onTeleport its pick). */
function heldMap(deps = {}) {
  const win = new HeldMapWindow({
    getPlayerPixel: () => ({ x: 5, y: 5 }), getClimateIndex: () => 231, woods: { heightMapBuffer: new Uint8Array(100).fill(10) }, mapSize: { width: 10, height: 10 },
    gold: () => 1e6, goldPieces: () => 1e6, hasHorse: false, hasCart: false, hasShip: false, diseaseCount: () => 0, poisonCount: () => 0, ...deps,
  });
  for (let i = 0; i < 20; i++) win.tick(0.05);   // the sheet up
  win._tamriel = true;   // the land past the Bay on the sheet (the world host's TAMRIEL2)
  win._onSheet = () => true; win._markerAt = () => null; win._questAt = () => null;   // a press on the bare sheet, no mark of the Bay's under it
  return win;
}
/** The map's press at a map point: the view laid so screen (100, 100) is the point, at a zoom inside the Bay's band. */
function pressAt(win, x, y, scale = 8) {
  win._view = { ox: x - 100 / scale, oy: y - 100 / scale, scale };
  win._pickAt(100, 100);
}
const closeMap = (win) => { for (let i = 0; i < 200 && !win.done; i++) win.tick(0.05); };

// ── the world host: its teleport, its gates and Recall, cut whole ──
function worldHost(o = {}) {
  const said = [], jumps = [];
  const scope = {
    townTalk: { say: (l) => said.push(l), showOverlay: (w) => { scope.overlay = w; } },
    hudFade, console: { warn: () => {}, error: () => {} },
    etherSea: false, inEther, pastBayJourney, teleportJourney, wildJourney, wildInside, WILD_NAME, ETHER_WILD_TEXT: { teleport: () => 'the sea' },
    TEST_GODMODE: false, staffPowers: () => ({}), online: { wildOk: false }, wildMapMask: () => null, etherWildRingAt: () => 0,
    playerEntity: { wildTravelAt: null, anchorPosition: null }, legacyGold: () => 0, deductGoldPieces() {}, WILD_TEXT: { travelPaid: () => '' },
    here: { x: 300, y: 300 }, busy: false, _teleporting: false, _recalling: false,
    modes: { forceExitToExterior() {}, mode: 'exterior', insideContext: () => ({ insideBuilding: false, insideDungeon: false, buildingKey: 0 }) },
    REPOSITION, weatherOverride: true, surfacePlayer() {}, getLocalizedLocationName: (_id, n) => n,
    // the streamer's rebuild of the destination: recorded with what it was asked, and the black it ran under
    _teleportToPixel: async (px, py, localPos = null, opts = {}) => { jumps.push({ px, py, reposition: opts.reposition ?? null, black: hudFade.backgroundColor[3] }); if (scope.stopAfterJump) throw new Error('stop'); },
    arenaBouts: { holds: () => false }, ARENA_TEXT: { refuse: { travel: 'arena' } }, madeRuleHere: () => null, madeSay() {}, teleportPlan,
    routByJump() {}, cacheExteriorScene() {}, _wodInside: false,
    // WILD-CITY-PORT (systems/wild/zoneSafe.js zonePortFree): where I stand and the place a pixel stands - none by default
    zonePortFree, teleportLanding, campToWire: (p) => p, player: { feetAt: () => [0, 0, 0] }, locationIndex: new Map(), _locationToBuild: () => null,
    ...o,
  };
  scope.wildOutdoors = () => (scope.modes?.mode ?? 'exterior') === 'exterior';
  scope.playerTravelPixel = () => scope.here;
  scope.worldMoveBusy = () => scope.busy;
  for (const [head, end, name] of [
    ['const veilRefused = (to = null) => {', '\n  };\n', 'veilRefused'],
    ['const wildTeleportRefused = (to = null, landing = undefined) => {', '\n  };\n', 'wildTeleportRefused'],
    ['const wildTravelGate = (to, spoken = 0, law = pastBayJourney) => {', '\n  };\n', 'wildTravelGate'],
    ['const wildTravelPaid = (j) => {', '\n  };\n', 'wildTravelPaid'],
    ['  async function teleportTo(pick, { zoneFree = false } = {}) {', '\n  }\n', 'teleportTo'],   // PIN MOVED (AUDIT TAMRIEL-WIDE III F1): a caller's own zone verdict
    ['  async function recallToAnchor() {', '\n  }\n', 'recallToAnchor'],
  ]) scope[name] = mount(scope, cut(W_SRC, head, end), name);
  return { scope, said, jumps };
}
/** The stone's host (scenes/portalStoneHost.js) as world.js constructs it, over the world's own teleport and gates. */
function stoneHost(W, o = {}) {
  let now = 1000;
  const feet = [0, 0, 0];
  const host = {
    _mode: () => 'exterior', cam: { pos: [0, 1.6, 0], yaw: 0 }, cityGuards: { guards: [] }, exteriorFoes: { foes: [] },
    collider: { surfaceHit: () => ({ dist: 1 }), raycastHit: () => null }, csaBoatUnderMe: () => null, duelEnemyNear: () => false,
    hccRuntimeOn: () => null, navalHostileNear: () => false, player: { isPlayerSwimming: false, feetAt: () => [...feet] },
    playerTravelPixel: () => W.scope.here, teleportTo: (p, o) => W.scope.teleportTo(p, o), townTalk: W.scope.townTalk, walkMode: true,
    worldMoveBusy: () => W.scope.busy, _foesFullAt: 0, inSiegeRoom: () => false, playerSpawned: true, travelOptions: null, travelView: { state: 'off' },
    get _teleporting() { return W.scope._teleporting; },
    veilRefused: (to) => W.scope.veilRefused(to), wildTeleportRefused: (to) => W.scope.wildTeleportRefused(to),
    wildTravelGate: (...a) => W.scope.wildTravelGate(...a),
    buildTravelMapWindow: (deps) => heldMap(deps),
    ...o,
  };
  host.portalGates = createPortalGates({ renderer: fakeRenderer(), now: () => now, onEnter: (g) => stone.portalArrive(g), onRefused: (hold) => W.scope.townTalk.say(PORTAL_HOLD_TEXT[hold]) });
  const stone = createPortalStoneHost(host);
  /** Walk in: from where I stand (outside) to the portal's foot (two metres ahead) - the step world.js's frame hands the pool. */
  const walkIn = () => {
    host.portalGates.tick([0, 0, 0], { hold: stone.portalHoldNow }); now += 100;
    host.portalGates.tick([0, 0, 1.5], { hold: stone.portalHoldNow }); now += 100;
  };
  return { host, stone, walkIn };
}
/** Count the screen's blacks: a refused step must never black it at all, not black and lift. */
function countBlacks() {
  const real = hudFade.smashHUDToBlack;
  const box = { n: 0 };
  hudFade.smashHUDToBlack = function smash() { box.n += 1; return real.call(this); };
  box.restore = () => { hudFade.smashHUDToBlack = real; };
  return box;
}
const capitalsPastBay = () => tamrielInkFor(null).cities.filter((c) => c.pixel && !inBay(c.pixel.x, c.pixel.y));

test('PORTAL-BAY a Portal Stone to EVERY city past the Bay the stone\'s map offers arrives, through the host\'s own road: the held map\'s press picks the city, the pick spends one stone and tears the portal open, the step blacks the screen, the world\'s own teleportTo rebuilds the destination at the city\'s pixel by its start markers (RandomStartMarker, the Bay\'s own arrival) under the black, and the black lifts on "You arrive at"; from the Bay and from one city past the Bay to another (mutants: the teleport\'s law the journey\'s; the pick\'s gate the journey\'s; the step\'s gate the journey\'s)', async () => {
  skin('enhanced');
  globalThis.document = fakeDocument();
  setCapitalsStanding(true);
  const cities = capitalsPastBay();
  assert.deepEqual(cities.map((c) => c.name).sort(), ['Alinor', 'Falinesti', 'Helstrom', 'Imperial City', 'Mournhold', 'Solitude', 'Torval'], 'the seven capitals the world stands past the Bay - the stone\'s map\'s cities there (TESA13)');
  hudFade.hasTarget = true; hudFade.allowFade = true;
  const blacks = countBlacks();
  try {
    for (const [from, city] of [[{ x: 300, y: 300 }, cities[0]], ...cities.map((c, i) => [cities[(i + 1) % cities.length].pixel, c])]) {
      const W = worldHost();
      W.scope.here = { ...from };
      const { host, stone, walkIn } = stoneHost(W);
      const pack = [portalStones(2)];
      playerEntity.health = 50;
      assert.equal(stone.openPortalStone(pack[0], pack), true, 'the door opens');
      const win = W.scope.overlay;
      assert.equal(win.teleportationTravel, true, 'the map in teleport mode');
      pressAt(win, city.x, city.y);
      assert.equal(win._selected?.name, city.name, `${city.name}: the press picks the city`);
      assert.equal(win._panel, 'teleport', 'its confirm opens');
      win._confirmTeleport(true);
      closeMap(win);
      assert.equal(pack[0].stackCount, 1, `${city.name}: one stone spent at the pick`);
      const g = host.portalGates.mine();
      assert.deepEqual(g?.dest, { pixel: city.pixel, name: city.name }, 'the portal stands to the city\'s own pixel');
      assert.equal(W.said.at(-1), PORTAL_TEXT.opened(city.name));
      hudFade.clearFade(); blacks.n = 0;
      walkIn();
      assert.equal(blacks.n, 1, 'the step blacks the screen');
      await settle();
      assert.deepEqual(W.jumps, [{ px: city.pixel.x, py: city.pixel.y, reposition: REPOSITION.RandomStartMarker, black: 1 }], `${city.name}: the world rebuilt at the city's pixel, landed by its start markers, under the black`);
      assert.equal(W.said.at(-1), `You arrive at ${city.name}.`, 'arrived - no refusal said');
      assert.deepEqual(W.said, [PORTAL_TEXT.opened(city.name), `You arrive at ${city.name}.`], 'nothing else said - no refusal');
      assert.deepEqual([hudFade.fadeInProgress, hudFade.fadeEndColor[3]], [true, 0], 'the black fading in');
      for (let i = 0; i < 100 && hudFade.fadeInProgress; i++) hudFade.tickFade(0.05);
      assert.equal(hudFade.backgroundColor[3], 0, 'and gone');
      assert.equal(W.scope._teleporting, false);
      win.dispose?.();
    }
  } finally { blacks.restore(); }
  // PIN MOVED (TRAVEL-EVERYWHERE, TESA-NO-FAST retired): the same gate under its default law lets a journey past the Bay go
  const W = worldHost();
  assert.deepEqual(W.scope.wildTravelGate(cities[0].pixel), { ok: true, fee: 0 }, 'a journey (fast travel, a carriage\'s, a party\'s) past the Bay goes, as on the Bay');
  assert.equal(W.said.length, 0, 'nothing said');
  assert.equal(W.scope.wildTravelGate(cities[0].pixel, 0, teleportJourney).ok, true, 'a teleport too');
});

test('PORTAL-BAY a refused step is refused BEFORE the black, said, and the screen never blacked; an arrival that does not come lifts the black; PVP-PORTAL: online the zone\'s land is a stone\'s end - the pick spends, the step arrives (mutants: the step\'s gate after the black; the arrival\'s answer unread; teleportTo\'s answer; the stone asking the zone again)', async () => {
  skin('enhanced');
  globalThis.document = fakeDocument();
  setCapitalsStanding(true);
  hudFade.hasTarget = true; hudFade.allowFade = true;
  const imperial = capitalsPastBay().find((c) => c.name === 'Imperial City');
  const zone = buildWildMask({ width: 100, height: 100, ox: imperial.pixel.x - 50, oy: imperial.pixel.y - 50, inZone: () => true });
  const blacks = countBlacks();
  try {
    // PVP-PORTAL: online, a pixel of the zone no settlement stands on (the
    // harness stands none) - the pick spends one stone and opens the portal, the step arrives under the black
    let W = worldHost({ online: { wildOk: true }, wildMapMask: () => zone });
    let s = stoneHost(W);
    const pack = [portalStones(2)];
    playerEntity.health = 50;
    assert.equal(s.stone.openPortalStone(pack[0], pack), true);
    let win = W.scope.overlay;
    hudFade.clearFade(); blacks.n = 0;
    pressAt(win, imperial.x, imperial.y);
    win._confirmTeleport(true);
    closeMap(win);
    assert.deepEqual([W.said.at(-1), pack[0].stackCount, s.host.portalGates.mine()?.dest.name, blacks.n], [PORTAL_TEXT.opened(imperial.name), 1, imperial.name, 0], 'the zone\'s land picked: one stone, a portal, no black');
    win.dispose?.();
    W = worldHost({ online: { wildOk: true }, wildMapMask: () => zone });
    s = stoneHost(W);
    s.host.portalGates.open([0, 0, 2], { pixel: imperial.pixel, name: imperial.name });
    hudFade.clearFade(); blacks.n = 0; W.said.length = 0;
    s.walkIn();
    await settle();
    assert.deepEqual([W.said, blacks.n, W.jumps.length], [[`You arrive at ${imperial.name}.`], 1, 1], 'the step into the zone arrives');
    // the Veil's, the same: the step asks the teleport's whole gate before the black
    W = worldHost({ etherSea: true });
    W.scope.here = { x: 300, y: 300 };
    s = stoneHost(W);
    const veil = { x: 1, y: 1 };
    s.host.portalGates.open([0, 0, 2], { pixel: veil, name: 'Veilhaven' });
    W.scope.inEther = (x, y) => x === veil.x && y === veil.y;
    hudFade.clearFade(); blacks.n = 0; W.said.length = 0;
    s.walkIn();
    await settle();
    assert.deepEqual([W.said, blacks.n, W.jumps], [['The Bay\'s magic does not reach across the Veil. Only the crossing does.'], 0, []], 'across the Veil: refused before the black');
    // AN ARRIVAL THAT DOES NOT COME (the world moved on between the step and the teleport): the black lifts
    W = worldHost();
    s = stoneHost(W, { teleportTo: async () => false });
    s.host.portalGates.open([0, 0, 2], { pixel: imperial.pixel, name: imperial.name });
    hudFade.clearFade(); blacks.n = 0;
    s.walkIn();
    assert.equal(blacks.n, 1, 'blacked at the step');
    await settle();
    assert.equal(hudFade.backgroundColor[3], 0, 'no arrival: the black lifted - never left over a refusal');
    // teleportTo answers whether it arrived - false for each refusal, true on the arrival
    W = worldHost();
    W.scope.busy = true;
    assert.equal(await W.scope.teleportTo({ pixel: imperial.pixel, name: imperial.name }), false, 'a move under way');
    W.scope.busy = false;
    W.scope._teleporting = true;
    assert.equal(await W.scope.teleportTo({ pixel: imperial.pixel, name: imperial.name }), false, 'a teleport under way');
    W.scope._teleporting = false;
    W = worldHost({ online: { wildOk: true }, wildMapMask: () => zone });
    assert.equal(await W.scope.teleportTo({ pixel: imperial.pixel, name: imperial.name }), false, 'into the zone');
    W = worldHost();
    assert.equal(await W.scope.teleportTo({ pixel: imperial.pixel, name: imperial.name }), true, 'arrived');
  } finally { blacks.restore(); }
});

test('PORTAL-BAY Recall is a teleport too: an anchor set past the Bay is reached by the world\'s own recallToAnchor, never refused as a journey; an anchor in the zone still refused (mutant: Recall\'s law the journey\'s)', async () => {
  // AUDIT TAMRIEL-WIDE E1 (PIN MOVED): the anchor makeAnchor mints - its feet inside its pixel, where a teleport now lands
  const anchorAt = (pixel) => { const o = mapPixelToWorldCoords(pixel.x, pixel.y); return { worldContext: 0, pixel, nativeX: o.x + 16384, nativeZ: o.z + 16384, y: 2, yaw: 0, pitch: 0, insideBuilding: false, insideDungeon: false, buildingKey: 0 }; };
  const solitude = { x: 1728, y: -545 };
  const W = worldHost({ stopAfterJump: true });
  W.scope.playerEntity.anchorPosition = anchorAt(solitude);
  await W.scope.recallToAnchor().catch(() => {});
  assert.deepEqual(W.jumps.map((j) => [j.px, j.py]), [[solitude.x, solitude.y]], 'the anchor past the Bay reached');
  const zone = buildWildMask({ width: 100, height: 100, ox: solitude.x - 50, oy: solitude.y - 50, inZone: () => true });
  const Z = worldHost({ stopAfterJump: true, online: { wildOk: true }, wildMapMask: () => zone });
  Z.scope.playerEntity.anchorPosition = anchorAt(solitude);
  await Z.scope.recallToAnchor().catch(() => {});
  assert.deepEqual([Z.jumps, Z.said], [[], [`In ${WILD_NAME} you can teleport only to or from a city, town or village. Walk or ride its roads.`]], 'the zone\'s own law stands');
});

// WILD-CITY-PORT: the Imperial City's slices as the world host stands them (the producer's: synthesizeCapitalLocation -
// test/world/icgrand_lod.test.js's fixture), each a TownCity with its exterior
const IC_FH = { rmbBlock: { fldHeader: { numBlockDataRecords: 1, buildingDataList: [{ buildingType: 9, factionId: 0, quality: 5 }] } } };
const IC_BASE = { name: 'B', regionIndex: 1, regionName: 'R', politic: 129, climate: {}, hasDungeon: false, mapTableData: { mapId: 9, locationType: 0 }, exterior: { exteriorData: { blockNames: ['X'], width: 1, height: 1 }, buildings: [] } };
const IC_NAMES = new Map(['GENR', 'ARMR', 'ALCH', 'GEMS', 'BOOK', 'PAWN', 'BANK', 'TVRN', 'RESI', 'FIGH', 'TEMP', 'LIBR', 'THIE', 'MAGE'].map((k) => [k, [`${k}AA00.RMB`]]));
const capitalSliceAt = (x, y) => { const on = capitalOnPixel(x, y); return on ? synthesizeCapitalLocation(on, { base: IC_BASE, names: IC_NAMES, blockOf: (n) => (n.startsWith('TES') ? null : IC_FH), px: x, py: y }) : null; };

test('WILD-CITY-PORT: online, every teleport goes into and out of the zone at a settlement - the guild\'s, Recall, a stone\'s door, pick and step - over the Imperial City\'s own slices, and asks no zone fare; the zone\'s other land, and a dungeon under the city, still refused to the guild\'s and Recall - a stone\'s door anywhere (PVP-PORTAL) (mutants: the city end refused; the end I stand at refused; a dungeon free; the old law; the teleport the journey\'s)', async () => {
  skin('enhanced');
  globalThis.document = fakeDocument();
  setCapitalsStanding(true);
  hudFade.hasTarget = true; hudFade.allowFade = true;
  const imperial = capitalsPastBay().find((c) => c.name === 'Imperial City');
  const zone = buildWildMask({ width: 100, height: 100, ox: imperial.pixel.x - 50, oy: imperial.pixel.y - 50, inZone: () => true });
  const ZONE = `In ${WILD_NAME} you can teleport only to or from a city, town or village. Walk or ride its roads.`;
  const ic = imperial.pixel, slice = { x: ic.x + 3, y: ic.y - 2 }, bare = { x: ic.x + 40, y: ic.y }, bay = { x: 300, y: 300 };
  assert.ok(capitalSliceAt(slice.x, slice.y) && !capitalSliceAt(bare.x, bare.y), 'a slice of the city, and the zone\'s land past it');
  const online = (o = {}) => worldHost({ online: { wildOk: true }, wildMapMask: () => zone, _locationToBuild: capitalSliceAt, ...o });
  // THE GUILD'S (teleportTo): from the Bay into the city - arrived; onto the zone's land - refused, said
  let W = online();
  assert.equal(await W.scope.teleportTo({ pixel: ic, name: imperial.name }), true, 'into the Imperial City');
  assert.deepEqual(W.jumps.map((j) => [j.px, j.py]), [[ic.x, ic.y]]);
  W = online();
  assert.equal(await W.scope.teleportTo({ pixel: bare, name: 'Cyrodiil' }), false, 'onto the zone\'s land');
  assert.equal(W.said.at(-1), ZONE);
  // out of the city from a building of it (its Mages Guild: the guild's teleport is asked indoors) - arrived; and from one
  // slice to another, inside the zone, no fare (the zone's journeys ask one; this purse holds none)
  for (const to of [bay, slice]) {
    W = online({ here: { ...ic } });
    W.scope.modes.mode = 'interior';
    assert.equal(await W.scope.teleportTo({ pixel: to, name: 'There' }), true, `from the city's guild hall to ${to.x},${to.y}`);
    assert.deepEqual(W.said, ['You arrive at There.'], 'arrived, nothing refused and no fare said');
  }
  // under the city a dungeon is the zone's: refused
  W = online({ here: { ...ic } });
  W.scope.modes.mode = 'dungeon';
  assert.equal(await W.scope.teleportTo({ pixel: bay, name: 'Wayrest' }), false, 'from a dungeon under the city');
  assert.equal(W.said.at(-1), ZONE);
  // RECALL: an anchor in the city reached; one on the zone's land refused
  // AUDIT TAMRIEL-WIDE E1 (PIN MOVED): the anchor makeAnchor mints - its feet inside its pixel, where a teleport now lands
  const anchorAt = (pixel) => { const o = mapPixelToWorldCoords(pixel.x, pixel.y); return { worldContext: 0, pixel, nativeX: o.x + 16384, nativeZ: o.z + 16384, y: 2, yaw: 0, pitch: 0, insideBuilding: false, insideDungeon: false, buildingKey: 0 }; };
  for (const [pixel, reached] of [[slice, true], [bare, false]]) {
    W = online({ stopAfterJump: true });
    W.scope.playerEntity.anchorPosition = anchorAt(pixel);
    await W.scope.recallToAnchor().catch(() => {});
    assert.deepEqual(W.jumps.map((j) => [j.px, j.py]), reached ? [[pixel.x, pixel.y]] : [], `Recall to ${pixel.x},${pixel.y}`);
  }
  // AUDIT TAMRIEL-WIDE E1: the Mark's own point, not its pixel - a village on the zone's land, its streets reached, two
  // blocks past its walls (the open country, on its pixel) refused
  const village = { name: 'V', mapTableData: { mapId: 5, locationType: 2 }, exterior: { exteriorData: { blockNames: ['A', 'B', 'C', 'D'], width: 2, height: 2 } } };
  const vr = locationWorldRect(village, bare.x, bare.y);
  for (const [nativeX, reached] of [[(vr.minX + vr.maxX) / 2, true], [vr.maxX + 2 * 4096, false]]) {
    W = online({ stopAfterJump: true, _locationToBuild: (x, y) => (x === bare.x && y === bare.y ? village : capitalSliceAt(x, y)) });
    W.scope.playerEntity.anchorPosition = { ...anchorAt(bare), nativeX, nativeZ: (vr.minZ + vr.maxZ) / 2 };
    await W.scope.recallToAnchor().catch(() => {});
    assert.deepEqual(W.jumps.map((j) => [j.px, j.py]), reached ? [[bare.x, bare.y]] : [], reached ? 'a Mark in the village\'s streets' : 'a Mark past its walls');
  }
  // A STONE: its door in the city's streets (outdoors, settledAt's frame) opens; PVP-PORTAL: in the open country past it too - the zone's law is not a stone's
  const loc = capitalSliceAt(ic.x, ic.y), r = locationWorldRect(loc, ic.x, ic.y);
  const street = [(r.minX + r.maxX) / 2, 0, (r.minZ + r.maxZ) / 2], country = [r.maxX + 40 * 4096, 0, (r.minZ + r.maxZ) / 2];
  for (const [feet, where] of [[street, 'in the city\'s streets'], [country, 'in the open country']]) {
    W = online({ here: { ...ic }, player: { feetAt: () => feet }, locationIndex: new Map([[`${ic.x},${ic.y}`, loc]]) });
    const { stone } = stoneHost(W);
    const pack = [portalStones(2)];
    playerEntity.health = 50;
    assert.equal(stone.openPortalStone(pack[0], pack), true, `the door, ${where}`);
    W.scope.overlay.dispose?.();
  }
  // its pick into the city, from the Bay: one stone spent, the portal torn open; the step arrives
  W = online();
  const s = stoneHost(W);
  const pack = [portalStones(2)];
  assert.equal(s.stone.openPortalStone(pack[0], pack), true);
  const win = W.scope.overlay;
  win.deps.onTeleport({ pixel: ic, name: imperial.name });
  closeMap(win);
  assert.deepEqual([pack[0].stackCount, s.host.portalGates.mine()?.dest.name], [1, imperial.name], 'the pick: a stone spent, the portal to the city');
  s.walkIn();
  await settle();
  assert.deepEqual(W.jumps.map((j) => [j.px, j.py]), [[ic.x, ic.y]], 'the step: arrived');
  win.dispose?.();
});

test('PORTAL-BAY the wiring: the world host constructs the stone\'s host where its code stood (HOST-SPLIT), handing it the world\'s own teleport and the teleport\'s gates live; its portals step into that host\'s arrival; teleportTo and Recall ask the gate under the teleport\'s law, a journey under its own (mutant: the gate unhanded)', () => {
  const wiring = cut(W_SRC, 'const { openPortalStone, portalArrive, portalHoldNow, openToSpot } = createPortalStoneHost({',   /* PIN MOVED (PORTAL-BOOK): and the kept door's opener */ '\n  });\n');
  assert.match(wiring, /\bteleportTo, townTalk,/, 'the world\'s own teleportTo, by value (a function declaration)');
  for (const name of ['_teleporting', 'veilRefused', 'wildTravelGate']) assert.match(wiring, new RegExp(`get ${name}\\(\\) \\{ return ${name}; \\}`), `${name} read live`);   // PIN MOVED (PVP-PORTAL): the zone's gate, wildTeleportRefused, is no longer the stone's
  assert.match(W_SRC, /onEnter: \(g\) => portalArrive\(g\),/, 'a portal\'s step is the stone host\'s arrival');
  assert.match(W_SRC, /openPortal: \(item, list\) => \(isPortalBook\(item\) \? portalBook\.open\(\) : openPortalStone\(item, list\)\),/, 'the pack\'s door');   // PIN MOVED (PORTAL-BOOK): a book opens its window
  assert.match(cut(W_SRC, '  async function teleportTo(pick, { zoneFree = false } = {}) {', '\n  }\n'), /const wildTrip = wildTravelGate\(pick\.pixel, 0, teleportJourney\);/);
  assert.match(cut(W_SRC, '  async function recallToAnchor() {', '\n  }\n'), /: wildTravelGate\(plan\.anchor\.pixel, 0, teleportJourney\);/);
  assert.match(W_SRC, /const wildTrip = wildTravelGate\(pick\.pixel, computed\?\.piecesCost \?\? 0\);/, 'fast travel: the journey\'s law');
});

// ── PORTAL-ANYWHERE (2026-10-26; the owner, asked whether the stone should reach any point past the Bay: "Anywhere on land") ──
/** A pixel of bare land past the Bay beside three capitals, off its city's reach (the land's own law, no trace: the
 *  authored shape the suite runs on), and a pixel of sea east of Alinor. */
const LAND = [{ x: 1734, y: -545, name: 'Skyrim' }, { x: 2359, y: 890, name: 'Imperial Province' }, { x: -223, y: 2006, name: 'Sumurset Isle' }];
const SEA = { x: 240, y: 2006 };

test('PORTAL-ANYWHERE the stone\'s map picks ANY land past the Bay, named by its province, and the portal goes there through the host\'s own road - the step, the world\'s teleportTo, the rebuild at that pixel under the black, "You arrive at"; the sea picks nothing and spends nothing; the guild\'s teleport map and the travel map pick no bare land; a quest\'s place past the Bay is a portal\'s end (PIN MOVED, TRAVEL-EVERYWHERE: on every teleport map, as a Bay place is); the hover points at it; online the zone\'s land a stone\'s end too (PVP-PORTAL) (mutants: the law\'s sea; the press\'s land unread; the guild\'s map given it; the stone\'s map not asking; the hover; the quest place)', async () => {
  skin('enhanced');
  globalThis.document = fakeDocument();
  setCapitalsStanding(true);
  hudFade.hasTarget = true; hudFade.allowFade = true;
  assert.equal(portalLandAt(SEA.x, SEA.y), null, 'the sea is no portal\'s end');
  assert.equal(portalLandAt(300, 300), null, 'nor the Bay\'s own map (its places are its picks)');
  for (const land of LAND) {
    assert.deepEqual(portalLandAt(land.x, land.y), { pixel: { x: land.x, y: land.y }, name: land.name }, `${land.name}: land`);
    const W = worldHost();
    const { host, stone, walkIn } = stoneHost(W);
    const pack = [portalStones(2)];
    playerEntity.health = 50;
    assert.equal(stone.openPortalStone(pack[0], pack), true);
    const win = W.scope.overlay;
    assert.equal(win.deps.portalLandPastBay, true, 'the stone\'s map asks for the land');
    win._view = { ox: land.x + 0.5 - 100 / 8, oy: land.y + 0.5 - 100 / 8, scale: 8 };
    assert.equal(win._hoverLabel(100, 100)?.cursor, 'pointer', 'the hover points at it');
    pressAt(win, land.x + 0.5, land.y + 0.5);
    assert.deepEqual([win._selected?.name, win._panel], [land.name, 'teleport'], `${land.name}: picked, its confirm open`);
    win._confirmTeleport(true);
    closeMap(win);
    assert.equal(pack[0].stackCount, 1, 'one stone spent');
    assert.deepEqual(host.portalGates.mine()?.dest, { pixel: { x: land.x, y: land.y }, name: land.name });
    hudFade.clearFade();
    walkIn();
    await settle();
    assert.deepEqual(W.jumps, [{ px: land.x, py: land.y, reposition: REPOSITION.RandomStartMarker, black: 1 }], `${land.name}: rebuilt at the pixel, under the black`);
    assert.equal(W.said.at(-1), `You arrive at ${land.name}.`);
    assert.equal(hudFade.fadeInProgress, true, 'the black fading in');
    win.dispose?.();
  }
  // the sea: nothing picked, no confirm, nothing spent
  {
    const W = worldHost();
    const { stone } = stoneHost(W);
    const pack = [portalStones(2)];
    stone.openPortalStone(pack[0], pack);
    const win = W.scope.overlay;
    pressAt(win, SEA.x + 0.5, SEA.y + 0.5);
    assert.deepEqual([win._selected ?? null, win._panel ?? null, pack[0].stackCount], [null, null, 2], 'the sea: nothing');
    win.dispose?.();
  }
  // the guild's teleport map (no `portalLandPastBay`) and the travel map: no land pick past the Bay
  for (const armed of [true, false]) {
    const win = heldMap({ onTeleport: () => assert.fail('no portal') });
    if (armed) win.activateTeleportationTravel();
    pressAt(win, LAND[0].x + 0.5, LAND[0].y + 0.5);
    assert.deepEqual([win._selected ?? null, win._panel ?? null], [null, null], armed ? 'the guild\'s map: no bare land' : 'the travel map: bare land walked under Travel Options alone (OW-PAST-BAY)');
    if (armed) {
      win._view = { ox: LAND[0].x + 0.5 - 100 / 8, oy: LAND[0].y + 0.5 - 100 / 8, scale: 8 };
      assert.equal(win._hoverLabel(100, 100)?.cursor ?? '', '', 'no pointer there');
    }
    win.dispose?.();
  }
  // a quest's place past the Bay (START3's pick): a portal's end on both maps (TRAVEL-EVERYWHERE); bare land on the stone's alone
  const stoneMap = heldMap({ portalLandPastBay: true });
  stoneMap.activateTeleportationTravel();
  const haunt = { px: LAND[0].x, py: LAND[0].y, placeName: 'The Haunt' };
  const law = (px, py, named) => (named ? { locationType: 4 } : null);   // the world's law: an unfound labyrinth (LOCATION_TYPES 4), named by its quest
  assert.equal(stoneMap._questPlace(haunt).portal, true, 'the stone\'s map: the place a portal\'s end');
  assert.equal(stoneMap._pastBayPick(LAND[0].x, LAND[0].y, 'x').portal, true, 'and its bare land');
  assert.equal(stoneMap._pastBayPick(SEA.x, SEA.y, 'x').portal, false, 'never the sea');
  const guildMap = heldMap({ pastBayPlace: law });
  guildMap.activateTeleportationTravel();
  assert.equal(guildMap._questPlace(haunt).portal, true, 'the guild\'s: the quest\'s place, as a Bay place');
  assert.equal(guildMap._pastBayPick(LAND[0].x, LAND[0].y, 'x').portal, false, 'the guild\'s: no bare land');
  stoneMap.dispose?.(); guildMap.dispose?.();
  // PVP-PORTAL: online, the zone's land a stone's end too - picked, one stone spent, the portal named by its province
  const imperial = LAND[1];
  const zone = buildWildMask({ width: 100, height: 100, ox: imperial.x - 50, oy: imperial.y - 50, inZone: () => true });
  const W = worldHost({ online: { wildOk: true }, wildMapMask: () => zone });
  const { host, stone } = stoneHost(W);
  const pack = [portalStones(2)];
  stone.openPortalStone(pack[0], pack);
  const win = W.scope.overlay;
  pressAt(win, imperial.x + 0.5, imperial.y + 0.5);
  win._confirmTeleport(true);
  closeMap(win);
  assert.deepEqual([W.said.at(-1), pack[0].stackCount, host.portalGates.mine()?.dest.name], [PORTAL_TEXT.opened(imperial.name), 1, imperial.name], 'the zone\'s land: picked');
  win.dispose?.();
});

/** world.js's own arrival landing (_teleportToPixel, from the reposition's landing to UNSTUCK-OUT's), cut whole and run
 *  over a terrain of the test's: `H(x, z)` its ground, no meshes, the sea at 0. */
function arrivalOver(H, { landingFor = () => null } = {}) {
  const collider = { heightAt: H, raycast: () => undefined, insideSolid: () => false, sphereOverlaps: () => false };
  const scope = {
    REPOSITION, locationLandingFor: landingFor, TERRAIN_SIZE, dest: { centerHeight: 5 }, state: { compensation: [0, 0, 0] }, walkMode: true,
    collider, floorLanding, ARRIVAL_REACH: 240, ARRIVAL_LIFT: 40, OBSTRUCTED_ABOVE: 3, heldInSolid, openGroundNear, safeGroundAt, safeGroundNear,
    tvSeaY: () => 0, console: { warn: () => {} },
  };
  const body = cut(W_SRC, '    const wantsLanding = reposition === REPOSITION.RandomStartMarker\n', '        pos = open;\n      }\n    }\n');
  return mount(scope, `function arrive(px, py, localPos, reposition, travelStart, grounded) {\n${body}\n return pos; }`, 'arrive');
}

test('PORTAL-ANYWHERE the arrival at bare land stands on SAFE ground, through world.js\'s own landing: off a lake onto the dry shore, off a cliff\'s lip onto level ground, flat dry ground kept where it is; a place\'s start markers and every other arrival (a respawn, a load) left as they were (mutants: the safe question unasked; asked of a place; the search not level; the level law; the dry law; the rings\' level read)', () => {
  const C = TERRAIN_SIZE / 2;
  const level = (H, p) => [[LANDING_LEVEL_REACH, 0], [-LANDING_LEVEL_REACH, 0], [0, LANDING_LEVEL_REACH], [0, -LANDING_LEVEL_REACH]].every(([dx, dz]) => Math.abs(H(p[0] + dx, p[2] + dz) - p[1]) <= LANDING_STEEP);
  // a lake under the pixel's centre
  const lake = (x, z) => (Math.hypot(x - C, z - C) < 30 ? -3 : 2);
  let pos = arrivalOver(lake)(1734, -545, null, REPOSITION.RandomStartMarker, null, false);
  assert.ok(pos[1] >= 0 && Math.hypot(pos[0] - C, pos[2] - C) >= 30 && level(lake, pos), `off the lake onto the shore: ${pos.map((v) => v.toFixed(1))}`);
  // a cliff's lip at the centre
  const cliff = (x) => (x > C - 1 ? 50 : 0);
  pos = arrivalOver(cliff)(1734, -545, null, REPOSITION.RandomStartMarker, null, false);
  assert.ok(level(cliff, pos), `off the lip onto level ground: ${pos.map((v) => v.toFixed(1))}`);
  assert.ok(pos[1] >= 0);
  // flat dry ground: where it is
  const flat = () => 4;
  assert.deepEqual(arrivalOver(flat)(1734, -545, null, REPOSITION.RandomStartMarker, null, false), [C, 4, C], 'kept at the centre');
  // a place's start markers: the place's landing, never moved by this law
  const at = [C + 5, 10, C + 5];
  pos = arrivalOver(lake, { landingFor: () => ({ pos: at, yaw: 0, grounded: true, edgePos: at }) })(2353, 890, null, REPOSITION.RandomStartMarker, null, false);
  assert.deepEqual(pos, [C + 5, -3, C + 5], 'a place: its marker\'s floor, as ever');
  // a respawn's or a load's arrival (no reposition): as ever
  assert.deepEqual(arrivalOver(lake)(1734, -545, null, REPOSITION.None, null, false), [C, -3, C], 'not a teleport: as ever');
  // the laws themselves
  const col = (H) => ({ heightAt: H, insideSolid: () => false, sphereOverlaps: () => false });
  assert.equal(levelGroundAt(col(flat), C, C, 4), true);
  assert.equal(levelGroundAt(col(cliff), C, C, 50), false, 'a lip');
  assert.equal(safeGroundAt(col(lake), [C, -3, C], 0), false, 'under water');
  assert.equal(safeGroundAt(col(flat), [C, 4, C], 0), true);
  assert.equal(safeGroundAt({ ...col(flat), insideSolid: () => true }, [C, 4, C], 0), false, 'held in a solid');
  assert.equal(safeGroundAt({ ...col(flat), sphereOverlaps: () => true }, [C, 4, C], 0), false, 'a mesh in the way');
  assert.equal(safeGroundNear(col(() => -1), C, C, 0), null, 'all sea: none - the arrival keeps its own');
});
