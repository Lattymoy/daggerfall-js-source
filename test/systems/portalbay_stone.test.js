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
import { pastBayJourney, teleportJourney, PAST_BAY_TRAVEL_TEXT } from '../../src/systems/travel/pastBayTravel.js';
import { wildJourney, wildInside, buildWildMask, WILD_NAME } from '../../src/systems/wild/wildZone.js';
import { inEther } from '../../src/world/ethericSea.js';
import { inBay } from '../../src/world/tamriel/tamrielFrame.js';
import { REPOSITION } from '../../src/systems/ship.js';
import { teleportPlan } from '../../src/systems/teleportAnchor.js';
import { HeldMapWindow } from '../../src/ui/heldMap.js';
import { tamrielInkFor } from '../../src/ui/tamrielInk.js';
import { setCapitalsStanding } from '../../src/world/tamrielCapitals.js';
import { _resetForTests } from '../../src/systems/uiPrefs.js';

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
    ...o,
  };
  scope.playerTravelPixel = () => scope.here;
  scope.worldMoveBusy = () => scope.busy;
  for (const [head, end, name] of [
    ['const veilRefused = (to = null) => {', '\n  };\n', 'veilRefused'],
    ['const wildTeleportRefused = (to = null) => {', '\n  };\n', 'wildTeleportRefused'],
    ['const wildTravelGate = (to, spoken = 0, law = pastBayJourney) => {', '\n  };\n', 'wildTravelGate'],
    ['const wildTravelPaid = (j) => {', '\n  };\n', 'wildTravelPaid'],
    ['  async function teleportTo(pick) {', '\n  }\n', 'teleportTo'],
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
    playerTravelPixel: () => W.scope.here, teleportTo: (p) => W.scope.teleportTo(p), townTalk: W.scope.townTalk, walkMode: true,
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
      assert.ok(!W.said.includes(PAST_BAY_TRAVEL_TEXT.refused), 'never the journey\'s refusal');
      assert.deepEqual([hudFade.fadeInProgress, hudFade.fadeEndColor[3]], [true, 0], 'the black fading in');
      for (let i = 0; i < 100 && hudFade.fadeInProgress; i++) hudFade.tickFade(0.05);
      assert.equal(hudFade.backgroundColor[3], 0, 'and gone');
      assert.equal(W.scope._teleporting, false);
      win.dispose?.();
    }
  } finally { blacks.restore(); }
  // the journeys keep TESA-NO-FAST: the same gate under its default law refuses a journey past the Bay
  const W = worldHost();
  assert.deepEqual(W.scope.wildTravelGate(cities[0].pixel), { ok: false, text: PAST_BAY_TRAVEL_TEXT.refused }, 'a journey (fast travel, a party\'s, a rider\'s) past the Bay is still refused');
  assert.equal(W.said.at(-1), PAST_BAY_TRAVEL_TEXT.refused);
  assert.equal(W.scope.wildTravelGate(cities[0].pixel, 0, teleportJourney).ok, true, 'a teleport is not');
});

test('PORTAL-BAY a refused pick never fades and never spends; a refused step is refused BEFORE the black, said, and the screen never blacked; an arrival that does not come lifts the black (mutants: the step\'s gate after the black; the arrival\'s answer unread; teleportTo\'s answer)', async () => {
  skin('enhanced');
  globalThis.document = fakeDocument();
  setCapitalsStanding(true);
  hudFade.hasTarget = true; hudFade.allowFade = true;
  const imperial = capitalsPastBay().find((c) => c.name === 'Imperial City');
  const ZONE = `You cannot teleport into or out of ${WILD_NAME}. Walk or ride its roads.`;
  const zone = buildWildMask({ width: 100, height: 100, ox: imperial.pixel.x - 50, oy: imperial.pixel.y - 50, inZone: () => true });
  const blacks = countBlacks();
  try {
    // THE PICK: online, the open zone's city - refused at the pick, said, nothing spent, nothing blacked
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
    assert.deepEqual([W.said.at(-1), pack[0].stackCount, s.host.portalGates.mine(), blacks.n, hudFade.backgroundColor[3]], [ZONE, 2, null, 0, 0], 'refused at the pick: said, no stone spent, no portal, no black');
    win.dispose?.();
    // THE STEP: a portal standing to the zone's city (a peer's, or mine opened before the zone was raised) - refused before
    // the black, said, never blacked; no arrival
    W = worldHost({ online: { wildOk: true }, wildMapMask: () => zone });
    s = stoneHost(W);
    s.host.portalGates.open([0, 0, 2], { pixel: imperial.pixel, name: imperial.name });
    hudFade.clearFade(); blacks.n = 0; W.said.length = 0;
    s.walkIn();
    await settle();
    assert.deepEqual([W.said, blacks.n, hudFade.backgroundColor[3], W.jumps], [[ZONE], 0, 0, []], 'refused before the black: said once, never blacked, no arrival');
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
  const anchorAt = (pixel) => ({ worldContext: 0, pixel, nativeX: 0, nativeZ: 0, y: 2, yaw: 0, pitch: 0, insideBuilding: false, insideDungeon: false, buildingKey: 0 });
  const solitude = { x: 1728, y: -545 };
  const W = worldHost({ stopAfterJump: true });
  W.scope.playerEntity.anchorPosition = anchorAt(solitude);
  await W.scope.recallToAnchor().catch(() => {});
  assert.deepEqual(W.jumps.map((j) => [j.px, j.py]), [[solitude.x, solitude.y]], 'the anchor past the Bay reached');
  assert.ok(!W.said.includes(PAST_BAY_TRAVEL_TEXT.refused), 'never the journey\'s refusal');
  const zone = buildWildMask({ width: 100, height: 100, ox: solitude.x - 50, oy: solitude.y - 50, inZone: () => true });
  const Z = worldHost({ stopAfterJump: true, online: { wildOk: true }, wildMapMask: () => zone });
  Z.scope.playerEntity.anchorPosition = anchorAt(solitude);
  await Z.scope.recallToAnchor().catch(() => {});
  assert.deepEqual([Z.jumps, Z.said], [[], [`You cannot teleport into or out of ${WILD_NAME}. Walk or ride its roads.`]], 'the zone\'s own law stands');
});

test('PORTAL-BAY the wiring: the world host constructs the stone\'s host where its code stood (HOST-SPLIT), handing it the world\'s own teleport and the teleport\'s gates live; its portals step into that host\'s arrival; teleportTo and Recall ask the gate under the teleport\'s law, a journey under its own (mutant: the gate unhanded)', () => {
  const wiring = cut(W_SRC, 'const { openPortalStone, portalArrive, portalHoldNow } = createPortalStoneHost({', '\n  });\n');
  assert.match(wiring, /\bteleportTo, townTalk,/, 'the world\'s own teleportTo, by value (a function declaration)');
  for (const name of ['_teleporting', 'veilRefused', 'wildTeleportRefused', 'wildTravelGate']) assert.match(wiring, new RegExp(`get ${name}\\(\\) \\{ return ${name}; \\}`), `${name} read live`);
  assert.match(W_SRC, /onEnter: \(g\) => portalArrive\(g\),/, 'a portal\'s step is the stone host\'s arrival');
  assert.match(W_SRC, /openPortal: \(item, list\) => openPortalStone\(item, list\),/, 'the pack\'s door');
  assert.match(cut(W_SRC, '  async function teleportTo(pick) {', '\n  }\n'), /const wildTrip = wildTravelGate\(pick\.pixel, 0, teleportJourney\);/);
  assert.match(cut(W_SRC, '  async function recallToAnchor() {', '\n  }\n'), /: wildTravelGate\(plan\.anchor\.pixel, 0, teleportJourney\);/);
  assert.match(W_SRC, /const wildTrip = wildTravelGate\(pick\.pixel, computed\?\.piecesCost \?\? 0\);/, 'fast travel: the journey\'s law');
});
