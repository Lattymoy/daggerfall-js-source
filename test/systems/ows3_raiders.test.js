// OWS3 (2026-09-28, the player's ask: "The pirate quest system should work like how we're changing enemies and nearby
// dungeons. Like mount and blade, being able to see other players sailing in the overworld and other enemy ships") -
// WARM ASHES' RAIDERS, SEEN COMING. The mod's raid is a roll on a fast travel by sea the traveller never sees; on the
// Overworld its raiders are ships on the open sea - a cell's sail a life, its course a function of its seed and the
// shared clock, so every player sees the same sails - and one that sights a traveller at sea gives chase: outsailed it
// sheers off, alongside it makes the mod's own raid.
//
// Pinned here: the law (systems/seaRaiders.js - the seed, the birth on the open sea, the course, the cells about the
// traveller, the chase), the mod's seen raid (systems/warmAshesShips.js raidAtSea - its sailing arm's one home, the
// coroutine, the refusals), the readout's raider (ui/travel/travelViewHud.js) and the world host's wiring by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  raiderOf, raiderAt, raidersNear, raiderSight, chaseStep, nativeOfPixel, pixelOfNative, seededRng, NATIVE_PIXEL,
  RAIDER_CELL_PX, RAIDER_LIFE_MS, RAIDER_CHANCE, RAIDER_SAIL_MPS, RAIDER_LEG_MS, RAIDER_SIGHT_M, RAIDER_SIGHT_NIGHT_M,
  RAIDER_CHASE_MPS, RAIDER_LEASH_M, RAIDER_GIVE_UP_MS, RAIDER_CONTACT_M, RAIDER_CONTACT_PLAY_M, RAIDER_REACH_PX, RAIDER_LABEL,
  RAIDERS_WIRE_MAX, RAIDER_WORD_MS, raiderWordOf, validRaiderWord, raiderNearMe,   // OW6: the chase, shared
} from '../../src/systems/seaRaiders.js';
import { chaseYields } from '../../src/systems/travel/travelBands.js';
import { worldCoordToMapPixel } from '../../src/formats/mapsFile.js';
import { travellerMarkOf, travellerWorldOf } from '../../src/systems/travellerMarks.js';
import {
  setWarmAshesHost, onPreFastTravel, frame, raidAtSea, hasArmedAmbush, isTempShip, boardPending, _resetWarmAshesShips,
  WA_RAID_QUEST, WA_SEA_REGION,
} from '../../src/systems/warmAshesShips.js';
import { ANY_LOCATION_KEY } from '../../src/systems/worldDataVariants.js';
import { SHIP_TYPES } from '../../src/systems/banking.js';
import { TRAVEL_VIEW_TEXT } from '../../src/scenes/travelView.js';
import { onBayOrEther, inEther } from '../../src/world/ethericSea.js';   // ETHER-OW: the raiders' ground, the host's own (AUDIT ETHER-OW C2-3: and the box, where a raider is the sea fight's alone)

// PIN MOVED (AUDIT OW5 G2): the Overworld's own lines are said through tvSay - held at the scale they are said at
const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const M = NATIVE_PIXEL / 819.2;   // native units a metre
const all = () => true;

// ── THE LAW ─────────────────────────────────────────────────────────────────────────────────────────────────────────

test('OWS3 law: a cell\'s raider is rolled from the cell and the life alone - the same for everyone - about a third of the open sea\'s cells a life; born inside its drawn pixel, on the open sea only', () => {
  const a = raiderOf({ cx: 40, cy: 30, life: 9, open: all }), b = raiderOf({ cx: 40, cy: 30, life: 9, open: all });
  assert.deepEqual(a, b, 'the same cell and life: the same raider on every machine');
  let n = 0, seen = 0;
  for (let cx = 0; cx < 60; cx++) for (let cy = 0; cy < 40; cy++) {
    const r = raiderOf({ cx, cy, life: 3, open: all });
    if (!r) continue;
    n++;
    const px = pixelOfNative(r.born.x, r.born.z);
    assert.ok(px.x >= cx * RAIDER_CELL_PX && px.x < (cx + 1) * RAIDER_CELL_PX && px.y >= cy * RAIDER_CELL_PX && px.y < (cy + 1) * RAIDER_CELL_PX, 'born in its own cell');
    assert.equal(r.id, `r${cx}.${cy}.3`);
    seen++;
  }
  const share = n / 2400;
  assert.ok(share > RAIDER_CHANCE - 0.05 && share < RAIDER_CHANCE + 0.05, `about ${RAIDER_CHANCE} of the cells (${share})`);
  assert.ok(seen > 0);
  let asked = null;
  const refused = raiderOf({ cx: 40, cy: 30, life: 9, open: (px, py) => { asked = [px, py]; return false; } });
  assert.equal(refused, null, 'not the open sea: no raider');
  assert.deepEqual(asked, [pixelOfNative(a.born.x, a.born.z).x, pixelOfNative(a.born.x, a.born.z).y], 'the birth pixel asked is the one it stands in');
  assert.notDeepEqual(raiderOf({ cx: 40, cy: 30, life: 10, open: all }), a, 'the next life, a new roll');
  assert.equal(seededRng(7)(), seededRng(7)());
});

test('OWS3 law: the row counts south - MapsFile\'s own two, and the traveller mark\'s - so a raider at a pixel stands where a traveller there stands', () => {
  for (const [x, z] of [[207 * NATIVE_PIXEL + 5, 286 * NATIVE_PIXEL + 9], [3 * NATIVE_PIXEL, 499 * NATIVE_PIXEL - 1]]) assert.deepEqual(pixelOfNative(x, z), worldCoordToMapPixel(x, z));
  const o = nativeOfPixel(207, 213);
  assert.deepEqual(pixelOfNative(o.x + 10, o.z + 10), { x: 207, y: 213 });
  const mark = travellerMarkOf({ x: o.x + 100, z: o.z + 100 });
  assert.deepEqual([mark.px, mark.py], [207, 213]);
  const w = travellerWorldOf(mark);
  assert.deepEqual(pixelOfNative(w.x, w.z), { x: 207, y: 213 }, 'the same pixel both ways');
});

test('OWS3 law: a raider\'s course - born where it was rolled, a leg of RAIDER_SAIL_MPS for RAIDER_LEG_MS, the next bent; land at a leg\'s end turns it about, land both ways holds it; its life clamps the clock; every machine the same', () => {
  const r = raiderOf({ cx: 40, cy: 30, life: 9, open: all });
  assert.deepEqual([raiderAt(r, r.bornMs, all).x, raiderAt(r, r.bornMs, all).z], [r.born.x, r.born.z]);
  const one = raiderAt(r, r.bornMs + RAIDER_LEG_MS, all);
  assert.ok(Math.abs(Math.hypot(one.x - r.born.x, one.z - r.born.z) / M - RAIDER_SAIL_MPS * RAIDER_LEG_MS / 1000) < 1e-6, 'a leg sailed');
  const half = raiderAt(r, r.bornMs + RAIDER_LEG_MS / 2, all);
  assert.ok(Math.abs(Math.hypot(half.x - r.born.x, half.z - r.born.z) / M - RAIDER_SAIL_MPS * RAIDER_LEG_MS / 2000) < 1e-6, 'and half a leg half the way - it sails between the bends, never jumps leg to leg');
  assert.deepEqual(raiderAt(r, r.bornMs + 5.5 * RAIDER_LEG_MS, all), raiderAt(r, r.bornMs + 5.5 * RAIDER_LEG_MS, all), 'stateless');
  assert.deepEqual(raiderAt(r, r.bornMs + 10 * RAIDER_LIFE_MS, all), raiderAt(r, r.bornMs + RAIDER_LIFE_MS, all), 'held at its life\'s end');
  // land ahead at the first leg's end: about
  const ahead = { x: r.born.x + Math.sin(r.heading0) * RAIDER_SAIL_MPS * M * 120, z: r.born.z + Math.cos(r.heading0) * RAIDER_SAIL_MPS * M * 120 };
  const seaBut = (x, z) => Math.hypot(x - ahead.x, z - ahead.z) > 1;
  const about = raiderAt(r, r.bornMs + RAIDER_LEG_MS, seaBut);
  assert.ok(Math.hypot(about.x - (2 * r.born.x - ahead.x), about.z - (2 * r.born.z - ahead.z)) < 1e-6, 'sailed the other way');
  const held = raiderAt(r, r.bornMs + RAIDER_LEG_MS, (x, z) => x === r.born.x && z === r.born.z);
  assert.deepEqual([held.x, held.z], [r.born.x, r.born.z], 'no water either way: it lies to');
});

test('OWS3 law: the raiders about a traveller - every cell within RAIDER_REACH_PX, each where its course has it now; two travellers whose reaches meet see the same raider in the same place', () => {
  const ms = 77 * RAIDER_LIFE_MS + 400000;
  const at = { x: 300, y: 200 };
  const cells = new Set();
  const list = raidersNear({ at, ms, open: (px, py) => { cells.add(`${Math.floor(px / RAIDER_CELL_PX)},${Math.floor(py / RAIDER_CELL_PX)}`); return true; }, sea: all });
  const span = Math.floor((at.x + RAIDER_REACH_PX) / RAIDER_CELL_PX) - Math.floor((at.x - RAIDER_REACH_PX) / RAIDER_CELL_PX) + 1;
  assert.ok(cells.size <= span * span && list.length > 0, `the cells in reach (${cells.size} rolled a birth of ${span * span})`);
  for (const r of list) {
    const p = raiderAt(r, ms, all);
    assert.deepEqual([r.x, r.z], [p.x, p.z]);
  }
  const there = raidersNear({ at: { x: 306, y: 205 }, ms, open: all, sea: all });
  const shared = list.filter((r) => there.some((q) => q.id === r.id));
  assert.ok(shared.length > 0, 'overlapping reaches share raiders');
  for (const r of shared) { const q = there.find((t) => t.id === r.id); assert.deepEqual([q.x, q.z], [r.x, r.z]); }
  assert.equal(raiderSight(false), RAIDER_SIGHT_M);
  assert.equal(raiderSight(true), RAIDER_SIGHT_NIGHT_M);
  assert.ok(RAIDER_SIGHT_NIGHT_M < RAIDER_SIGHT_M);
});

test('OWS3 law: a chase closes at its way times the world\'s scale; alongside is contact; past the leash, or no metre gained in RAIDER_GIVE_UP_MS, it is lost; land in its way balks it', () => {
  const pos = { x: 0, z: 0 }, quarry = { x: 500 * M, z: 0 };
  const s = chaseStep({ pos, quarry, dt: 1, scale: 10, contact: RAIDER_CONTACT_M, now: 0, best: Infinity, bestAt: 0, sea: all });
  assert.equal(s.state, 'chase');
  assert.ok(Math.abs(s.pos.x / M - RAIDER_CHASE_MPS * 10) < 1e-9, 'the scale on its way');
  assert.equal(s.bestAt, 0);
  assert.ok(Math.abs(s.left - (500 - RAIDER_CHASE_MPS * 10)) < 1e-9);
  const near = chaseStep({ pos: { x: 450 * M, z: 0 }, quarry, dt: 1, scale: 1, contact: RAIDER_CONTACT_M, now: 5, best: 60, bestAt: 5, sea: all });
  assert.equal(near.state, 'contact', 'within the contact after the step');
  assert.equal(chaseStep({ pos, quarry: { x: (RAIDER_LEASH_M + 50) * M, z: 0 }, dt: 0.1, scale: 1, contact: 60, now: 0, best: Infinity, bestAt: 0, sea: all }).state, 'lost', 'past the leash');
  const tired = chaseStep({ pos, quarry, dt: 0.001, scale: 1, contact: 60, now: RAIDER_GIVE_UP_MS + 1, best: 400, bestAt: 0, sea: all });
  assert.equal(tired.state, 'lost', 'three minutes gaining nothing');
  const gaining = chaseStep({ pos, quarry, dt: 1, scale: 1, contact: 60, now: RAIDER_GIVE_UP_MS + 1, best: 501, bestAt: 0, sea: all });
  assert.equal(gaining.state, 'chase', 'a metre gained: its patience renewed');
  assert.equal(gaining.bestAt, RAIDER_GIVE_UP_MS + 1);
  const balked = chaseStep({ pos, quarry, dt: 1, scale: 1, contact: 60, now: 0, best: Infinity, bestAt: 0, sea: () => false });
  assert.deepEqual([balked.state, balked.pos], ['lost', pos], 'no isthmus sailed');
  assert.equal(RAIDER_CONTACT_PLAY_M > RAIDER_CONTACT_M, true);
  assert.equal(RAIDER_LABEL, 'Pirates');
});

// ── THE MOD'S RAID, SEEN COMING ─────────────────────────────────────────────────────────────────────────────────────

function recordingHost({ owns = false } = {}) {
  const calls = [], variants = [];
  const h = {
    calls, variants, owned: owns, random: () => 0.99,
    ownsShip: () => h.owned,
    assignShip: (t) => { calls.push(['assign', t]); h.owned = t !== SHIP_TYPES.None; },
    resetShip: () => { calls.push(['reset']); h.owned = false; },
    getQuest: (name) => ({ name }), startQuest: (q) => calls.push(['start', q.name]),
    setTransportModeShip: () => calls.push(['ship']), currentRegionIndex: () => WA_SEA_REGION,
    setBlockVariant: (block, variant, key) => variants.push([block, variant, key]),
  };
  return h;
}

test('OWS3 Warm Ashes: a raider alongside makes the mod\'s own raid - armed as a sea crossing arms it (the blocks raided, a lent ship for one without), the coroutine started, then the quest and the boarding after the mod\'s wait', () => {
  _resetWarmAshesShips();
  let h = recordingHost({ owns: true });
  setWarmAshesHost(h);
  assert.equal(raidAtSea(), 'raid');
  assert.equal(hasArmedAmbush(), true);
  assert.equal(boardPending(), true, 'CheckforEncounters: the coroutine armed');
  assert.deepEqual(h.variants, [['SHIPAA00.RMB', '_smallraid', ANY_LOCATION_KEY], ['SHIPAA01.RMB', '_smallraid', ANY_LOCATION_KEY]]);
  assert.equal(raidAtSea(), 'busy', 'one raid at a time');
  assert.equal(frame(0.05), true);
  assert.deepEqual(h.calls, [['start', WA_RAID_QUEST], ['ship']], 'the raid quest, then the ship boarded');
  // no ship of their own: the large one lent, and taken back with them on it
  _resetWarmAshesShips();
  h = recordingHost();
  setWarmAshesHost(h);
  assert.equal(raidAtSea(), 'raid-lent');
  assert.deepEqual(h.calls[0], ['assign', SHIP_TYPES.Large]);
  assert.equal(isTempShip(), true);
  frame(0.05);
  assert.deepEqual(h.calls.slice(1), [['start', WA_RAID_QUEST], ['ship'], ['reset']]);
  assert.equal(raidAtSea(), 'lent', 'a lent ship out: no second raid until Leave Ship');
  // the fast travel's own arm is the same one
  _resetWarmAshesShips();
  h = recordingHost({ owns: true });
  setWarmAshesHost(h);
  assert.equal(onPreFastTravel({ oceanPixels: 2, travelShip: true }), 'raid');
  assert.equal(boardPending(), false, 'the fast travel\'s own arm waits for its post-travel event');
  assert.deepEqual(h.variants, [['SHIPAA00.RMB', '_smallraid', ANY_LOCATION_KEY], ['SHIPAA01.RMB', '_smallraid', ANY_LOCATION_KEY]]);
  const wa = rd('src/systems/warmAshesShips.js');
  assert.match(wa, /if \(travelShip\) return raidRefusal\(\) === 'busy' \? 'busy' : armRaid\(\);/, 'one home for the sailing arm');   // PIN MOVED (RAID-ASHORE): never armed over a raid still on
  assert.match(wa, /const armed = armRaid\(\);\n\s*onPostFastTravel\(\);\n\s*return armed;/);
  _resetWarmAshesShips();
});

// ── THE READOUT ─────────────────────────────────────────────────────────────────────────────────────────────────────

test('OWS3 readout: a raider is a ship in the cinnabar, "Pirates" under it in the same', async () => {
  const hud = await import('../../src/ui/travel/travelViewHud.js');
  assert.equal(hud.TRAVEL_VIEW_MARK_COLORS.raider, '#bf2a1f');
  const calls = [];
  const fills = [];
  const ctx = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : k === 'measureText' ? (s) => ({ width: String(s).length * 7 }) : (...a) => { calls.push([k, ...a]); if (k === 'fill' || k === 'fillText') fills.push([k, t.fillStyle]); }),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  const win = { devicePixelRatio: 1, innerWidth: 1280, innerHeight: 720, addEventListener() {}, removeEventListener() {} };
  const doc = { defaultView: win, fonts: null };
  const mk = (tag) => {
    const n = { tagName: tag.toUpperCase(), className: '', children: [], style: { setProperty() {} }, ownerDocument: doc, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, append(...c) { this.children.push(...c); }, remove() {}, addEventListener() {}, isConnected: true, width: 0, height: 0, getBoundingClientRect() { return { width: 0, height: 0 }; } };
    if (tag === 'canvas') n.getContext = () => ctx;
    return n;
  };
  Object.assign(doc, { createElement: mk, createElementNS: (_, tag) => mk(tag), getElementById: () => null, querySelectorAll: () => [], head: mk('head'), body: mk('body') });
  hud.showTravelViewHud({}, doc);
  try {
    hud.updateTravelViewHud({ feet: null, heading: null, yaw: 0, where: '', marks: [{ key: 'raid:r1', x: 300, y: 300, front: true, label: RAIDER_LABEL, kind: 'raider ship' }] });
  } finally { hud.disposeTravelViewHud(); }
  assert.equal(calls.filter((c) => c[0] === 'arc').length, 0, 'a ship, not a dot');
  assert.deepEqual(fills.filter(([k]) => k === 'fill').map(([, c]) => c), ['#bf2a1f', '#bf2a1f'], 'its hull and sail in the cinnabar');
  assert.ok(fills.some(([k, c]) => k === 'fillText' && c === '#bf2a1f'), 'its name in the same');
  assert.equal(TRAVEL_VIEW_TEXT.raidersAlongside, 'Pirates come alongside!');
});

// ── THE WORLD HOST ──────────────────────────────────────────────────────────────────────────────────────────────────

test('OWS3 host wiring by source: the open sea a raider is born on, the shared clock, the chase begun only under the view and at sea, its contact the mod\'s raid, ashore every chase given up, a load ending them; the marks', () => {
  const w = rd('src/scenes/world.js');
  // PIN MOVED (ETHER-OW, 2026-10-13): the raiders' ground is the Bay's map or the Eltheric Ocean's box (ethericSea.js
  // onBayOrEther) - the Bay's bounds as they were, the box beside them (test/systems/travel/ether_ow.test.js)
  // PIN MOVED (AUDIT ETHER-OW C2-3): past the Veil a raider is the sea fight's ship alone (test/systems/travel/ether_ow.test.js)
  assert.match(w, /if \(!onBayOrEther\(px, py\) \|\| maps\.getClimateIndex\(px, py\) !== CLIMATES\.Ocean\) return false;\n\s*if \(inEther\(px, py\) && !navalRaidersOn\(\)\) return false;[^\n]*\n\s*for \(let dy = -1; dy <= 1; dy\+\+\) for \(let dx = -1; dx <= 1; dx\+\+\) if \(!tvWater\(px \+ dx, py \+ dy\)\) return false;/, 'the open sea: the ocean\'s, every pixel about it water');
  assert.match(w, /const raidNowMs = \(\) => Date\.now\(\) \+ _sharedOffsetMs;/);
  assert.match(w, /const ms = raidNowMs\(\), life = Math\.floor\(ms \/ RAIDER_LIFE_MS\);\n\s*if \(life !== tvRaid\.life\) \{\n\s*tvRaid\.life = life; for \(const id of tvRaid\.spent\) if \(!tvRaid\.chase\.has\(id\)\) tvRaid\.spent\.delete\(id\);[^\n]*\n[\s\S]{0,500}?\n\s*\}\n\s*tvRaid\.list = raidersNear\(\{ at: playerTravelPixel\(\), ms, open: tvRaidOpen, sea: tvRaidSea \}\);/, 'AUDIT OWS A3: a new life forgets the last life\'s spent sails (a chase still running kept)');
  // PIN MOVED (AUDIT OW5 R1): a window or a death HOLDS the chase above the gate - it read as ashore (test/player/eyeOfTheBeholder/ow5_audit.test.js
  // mounts it); AUDIT OW5b S6: and a world being moved; S2: the quarry at sea on their own boat, its helm or its deck
  assert.match(w, /if \(playerEntity\.health <= 0 \|\| modes\?\.deathUp\?\.\(\) \|\| gamePaused\(\) \|\| worldMoveBusy\(\)\) return;\n\s*const at = warmAshesOn\(\) && isEnhanced\(\) && walkMode && playerSpawned && \(modes\?\.mode \?\? 'exterior'\) === 'exterior' && raidQuarry\(\);/, 'at sea on my own boat; held by a death, a window or a world moved (AUDIT OW5 R1, OW5b S2/S6)');
  assert.match(w, /if \(!at\) \{ for \(const id of tvRaid\.chase\.keys\(\)\) seaRaidSpend\(id\); tvRaid\.chase\.clear\(\); return; \}/);
  assert.match(w, /if \(up && tvRaid\.chase\.size < 1\) \{\n\s*const sight = raiderSight\(isNight\(minuteNow\(\)\)\);/, 'sighted under the view, one at a time, by the hour\'s light');
  assert.match(w, /contact: up \? RAIDER_CONTACT_M : RAIDER_CONTACT_PLAY_M, now: tvRaid\.clock,/);
  assert.match(w, /tvRaid\.clock \+= dt \* 1000 \* Math\.max\(1, scale\);/);
  assert.match(w, /if \(step\.state === 'contact'\) raidContact\(\);/);
  assert.match(w, /const said = warmAshesRaidAtSea\(\);\n\s*if \(said !== 'raid' && said !== 'raid-lent'\) return;\n\s*travelControlUI\?\.closeWindow\?\.\(\);\n\s*tvSay\(TRAVEL_VIEW_TEXT\.raidersAlongside\);/);
  assert.match(w, /tvRaid\.chase\.clear\(\); tvRaid\.spent\.clear\(\); tvRaid\.list = \[\]; tvRaid\.at = -Infinity; tvRaid\.peer\.clear\(\); tvRaid\.spentAt\.length = 0;   \/\/ OWS3: no chase across a load/);
  assert.ok(w.indexOf('const tvRaid = {') < w.indexOf('tvRaid.chase.clear(); tvRaid.spent.clear();'), 'BOOT-TDZ: declared above the load that clears it');
  assert.match(w, /raidFrame\(dt\);[^\n]*\n\s*travelViewGovern\(dt\);/, 'each walking frame, before the cap');
  // NAV-R (2026-09-28): a raider stood as a ship of the sea chases as her captain does - `chase` is the ship's word, or the
  // Overworld's own chase with no sea fight (test/systems/naval/nav_r_raiders.test.js pins which)
  // PIN MOVED (HOST-SPLIT 1, 2026-10-15): the Overworld's marks left world.js for scenes/travelViewMarks.js
  const tvm = rd('src/scenes/travelViewMarks.js');
  assert.match(tvm, /marks\.push\(\{ key: `raid:\$\{r\.id\}`, at: tvSceneKept\(c \?\? r, at\.x, at\.z, 2, true\), label: RAIDER_LABEL, kind: chase \? 'raider ship chase' : 'raider ship', edge: chase \}\);/);
  assert.match(tvm, /if \(!chase && Math\.max\(Math\.abs\(px\.x - me\.x\), Math\.abs\(px\.y - me\.y\)\) > grid\) continue;/, 'the rest within the grid\'s reach');
  assert.match(tvm, /if \(warmAshesOn\(\) && csaOn\(\)\) \{\n\s*const grid = Math\.max\(1, state\.terrainDistance \?\? 3\);/, 'the mod off, or no Come Sail Away to be at sea with: no raiders (AUDIT OW5b S8)');
});

// ── AUDIT OW5b (S): THE HOST RUN ─────────────────────────────────────────────────────────────────────────────────────
// raidFrame, raidContact, the quarry, the sea's two tests and the raiders' marks lifted out of world.js's own text and
// run against stubs (the bands' AUDIT OW4 B10 way): the raiders' host law proven by what it DOES, not by how it reads.
const liftSea = () => {
  const w = rd('src/scenes/world.js');
  const fn = (name) => {
    const m = new RegExp(`\\n  function ${name}\\([^)]*\\) \\{\\n[\\s\\S]*?\\n  \\}\\n`).exec(w);
    assert.ok(m, `${name} lifted`);
    return m[0];
  };
  const arrow = (name) => {
    const at = w.indexOf(`\n  const ${name} = `);
    assert.ok(at >= 0, `${name} lifted`);
    const eol = w.indexOf('\n', at + 1);
    const end = w.slice(at, eol).trimEnd().endsWith('{') ? w.indexOf('\n  };\n', at) + 5 : eol;
    return w.slice(at, end);
  };
  // PIN MOVED (HOST-SPLIT 1, 2026-10-15): the Overworld's marks left world.js for scenes/travelViewMarks.js - lifted from there
  const tvm = rd('src/scenes/travelViewMarks.js');
  const a = tvm.indexOf('    // AUDIT OW5b S8: none drawn where none can come'), b = tvm.indexOf('\n    return marks;', a);
  assert.ok(a > 0 && b > a, 'the raiders\' marks lifted');
  return { frame: fn('raidFrame'), contact: fn('raidContact'), quarry: arrow('raidQuarry'), open: arrow('tvRaidOpen'), sea: arrow('tvRaidSea'), marks: tvm.slice(a, b),
    spend: fn('seaRaidSpend'), peer: fn('seaRaidPeerChase'), hear: fn('seaRaidHear'), word: fn('seaRaidWord'),   // OW6: the chase, shared
    held: fn('seaRaidHeld') };   // THE MERGE (OW6, NAV-R): the raiders my word says I hold
};
const seaHost = (over = {}) => {
  const src = liftSea();
  const order = [];
  const d = {
    gamePaused: () => false, worldMoveBusy: () => false, warmAshesOn: () => true, isEnhanced: () => true, walkMode: true, playerSpawned: true,
    modes: { mode: 'exterior' }, tvRaid: { list: [], at: -Infinity, chase: new Map(), spent: new Set(), clock: 0, life: -1, peer: new Map(), spentAt: [] },
    worldTimeScale: () => 1, travelView: { active: true }, feet: { x: 500.5 * NATIVE_PIXEL, z: 250.5 * NATIVE_PIXEL },
    state: { worldCoords: () => d.feet, terrainDistance: 3 }, player: { pos: [0, 0, 0] }, RAID_NATIVE_PIXEL: NATIVE_PIXEL, raiderSight, isNight: () => false,
    minuteNow: () => 720, list: [], travelViewRaiders: () => d.list, raiderChaseStep: chaseStep, RAIDER_CONTACT_M, RAIDER_CONTACT_PLAY_M,
    pixelOfNative, onBayOrEther, inEther, tvWater: () => true, maps: { getClimateIndex: () => 'Ocean' }, CLIMATES: { Ocean: 'Ocean' },   // ETHER-OW: the ground law the host reads
    sailing: true, csaRuntime: { isSailing: () => d.sailing, StopSailing: () => { order.push('stop'); d.sailing = false; } }, csaCall: (f) => f(),
    playerEntity: { activeEffects: [] }, isBoatEffectBundle: (n) => n === "I'm On A Boat",
    refusal: null, warmAshesRaidRefusal: () => d.refusal, warmAshesRaidAtSea: () => { order.push('raid'); return 'raid'; },
    tvSeaRelease: () => order.push('release'), travelControlUI: { closeWindow: () => order.push('close') }, townTalk: { say: (t) => order.push(t) }, TRAVEL_VIEW_TEXT,
    csaOn: () => true, me: { x: 500, y: 249 }, marks: [], tvSceneKept: (h, x, z) => [x, 0, z], RAIDER_LABEL,
    // OW6: the chase, shared - the law, my id, my pixel, the shared clock and the frame clock
    RAIDERS_WIRE_MAX, RAIDER_WORD_MS, RAIDER_LIFE_MS, raiderWordOf, validRaiderWord, raiderNearMe, chaseYields, online: { id: 'b' },
    playerTravelPixel: () => d.me, ms: 0, raidNowMs: () => d.ms, now: 0, performance: { now: () => d.now },
    owed: [], owSaySpent: (id) => d.owed.push(id),   // OW6L: a spend is owed to the cell's ledger
    navalRaidersOn: () => false,   // THE MERGE (NAV-R): the sea fight off - the Overworld's own chase, these runs' (test/systems/naval/nav_r_raiders.test.js runs it on)
    tvSay: (t) => order.push(t),   // AUDIT OW5 G2: the Overworld's own lines, held at the clock's scale
    ...over,
  };
  const names = Object.keys(d).filter((k) => /^[A-Za-z_$][\w$]*$/.test(k));
  const host = new Function('d', `const { ${names.join(', ')} } = d;
    ${src.open}\n${src.sea}\n${src.quarry}\n${src.contact}\n${src.spend}\n${src.peer}\n${src.hear}\n${src.held}\nlet _seaRaidWordKey = '';\n${src.word}\n${src.frame}
    const drawRaiders = () => { const host = d; ${src.marks} };   // HOST-SPLIT 1: the marks read their live names through host
    return { raidFrame, raidContact, raidQuarry, tvRaidOpen, tvRaidSea, drawRaiders, seaRaidHear, seaRaidWord, seaRaidPeerChase };`)(d);
  return { d, order, ...host };
};
const raiderAtM = (id, dxM, dzM, feet) => ({ id, x: feet.x + dxM * M, z: feet.z + dzM * M });

test('AUDIT OW5b S1 host run: ALONGSIDE, THE HELM IS LET GO BEFORE THE RAID ARMS (the fast travel\'s ambush order: Come Sail Away\'s, then Warm Ashes\') - a raid the mod refuses leaves the traveller sailing', () => {
  const h = seaHost();
  h.raidContact();
  assert.deepEqual(h.order, ['stop', 'release', 'raid', 'close', TRAVEL_VIEW_TEXT.raidersAlongside], 'let go, the journey\'s hand off it, then the raid - never boarded from a helm still held');
  const deck = seaHost({ sailing: false });
  deck.raidContact();
  assert.deepEqual(deck.order, ['release', 'raid', 'close', TRAVEL_VIEW_TEXT.raidersAlongside], 'on the deck: no helm to let go');
  for (const refusal of ['busy', 'lent']) {
    const no = seaHost({ refusal });
    no.raidContact();
    assert.deepEqual([no.order, no.d.sailing], [[], true], `refused (${refusal}): still at the helm, nothing said`);
  }
});

test('AUDIT OW5b S1 with the mod itself: a crewed boat\'s helm LENDS a ship (Come Sail Away\'s Small) - let go first, it is handed back and the raid lends its own Large, as the fast travel\'s ambush does', () => {
  _resetWarmAshesShips();
  const ship = { owns: true };   // the helm of a crewed boat lent the Small ship (StartSailing)
  const assigned = [];
  setWarmAshesHost({ ownsShip: () => ship.owns, assignShip: (t) => { assigned.push(t); ship.owns = true; }, setBlockVariant: () => {} });
  const said = [];
  const h = seaHost({ csaRuntime: { isSailing: () => true, StopSailing: () => { ship.owns = false; } },   // StopSailing's ReturnTemporaryShip
    warmAshesRaidRefusal: () => null, warmAshesRaidAtSea: () => { const r = raidAtSea(); said.push(r); return r; } });
  h.raidContact();
  assert.deepEqual(said, ['raid-lent'], 'the helm\'s lent ship handed back first: the raid lends its own');
  assert.deepEqual(assigned, [SHIP_TYPES.Large]);
  assert.equal(isTempShip(), true);
  _resetWarmAshesShips();
});

test('AUDIT OW5b S2/S6 host run: A PAUSE, A WINDOW OR A WORLD MOVED HOLDS THE CHASE (its patience with it) - never "ashore", never spent; the helm let go mid-sea is still at sea; a passenger aboard another\'s boat is no raider\'s quarry', () => {
  for (const [what, over] of [['a window', { gamePaused: () => true }], ['a world being moved', { worldMoveBusy: () => true }]]) {
    const h = seaHost(over);
    const c = { pos: { x: h.d.feet.x, z: h.d.feet.z + 800 * M }, best: 800, bestAt: 0 };
    h.d.tvRaid.chase.set('r1.1.5', c);
    for (let i = 0; i < 50; i++) h.raidFrame(0.1);
    assert.equal(h.d.tvRaid.chase.has('r1.1.5'), true, `${what}: still chasing`);
    assert.deepEqual([h.d.tvRaid.spent.size, h.d.tvRaid.clock, c.pos.z], [0, 0, h.d.feet.z + 800 * M], `${what}: held where it was, its clock with it`);
  }
  const deck = seaHost({ sailing: false, playerEntity: { activeEffects: [{ bundleName: "I'm On A Boat" }] } });
  const c = { pos: { x: deck.d.feet.x, z: deck.d.feet.z + 800 * M }, best: 800, bestAt: 0 };
  deck.d.tvRaid.chase.set('r1.1.5', c);
  deck.raidFrame(0.1);
  assert.ok(deck.d.tvRaid.chase.has('r1.1.5') && c.pos.z < deck.d.feet.z + 800 * M, 'off the helm, on my own deck: the chase closes on');
  const passenger = seaHost({ sailing: false });   // aboard another's boat: no helm, no "I'm On A Boat" of mine
  passenger.d.list = [raiderAtM('r2.2.5', 0, 300, passenger.d.feet)];
  passenger.raidFrame(0.1);
  assert.equal(passenger.d.tvRaid.chase.size, 0, 'a passenger is sighted by nobody');
  const helm = seaHost();
  helm.d.list = [raiderAtM('r2.2.5', 0, 300, helm.d.feet)];
  helm.raidFrame(0.1);
  assert.equal(helm.d.tvRaid.chase.size, 1, 'at my own helm: sighted');
});

test('AUDIT OW5b S3/S8 host run: A CHASE OUT OF THE LIST IS STILL SEEN (its raider\'s life turned over) and held at the edge; with no Come Sail Away no raider is drawn at all', () => {
  const h = seaHost();
  h.d.list = [raiderAtM('r3.3.9', 0, 500, h.d.feet)];
  h.d.tvRaid.chase.set('r3.3.8', { pos: { x: h.d.feet.x, z: h.d.feet.z + 900 * M }, best: 900, bestAt: 0 });
  h.drawRaiders();
  const keys = h.d.marks.map((m) => `${m.key}|${m.kind}|${m.edge}`);
  assert.ok(keys.includes('raid:r3.3.8|raider ship chase|true'), `last life's chaser drawn and held at the edge (${keys})`);
  assert.ok(keys.includes('raid:r3.3.9|raider ship|false'), 'this life\'s sail within the grid as ever');
  const off = seaHost({ csaOn: () => false });
  off.d.list = [raiderAtM('r3.3.9', 0, 500, off.d.feet)];
  off.drawRaiders();
  assert.deepEqual(off.d.marks, [], 'no boats to be at sea in: no pirates on the map');
});

test('AUDIT OW5b S5 host run: THE RAIDERS\' SEA IS ON THE MAP - never born a pixel past its edge (the off-map pixel reads as water, and its climate the PAK\'s first column), never sailing off it (the pixel law truncates the strip past the west and south edges into the edge\'s own)', () => {
  const h = seaHost();
  assert.equal(h.tvRaidOpen(-1, 10), false, 'a column off the map');
  assert.equal(h.tvRaidOpen(10, 500), false, 'a row off it');
  assert.equal(h.tvRaidOpen(0, 10), true, 'the edge\'s own open sea');
  const PX = NATIVE_PIXEL;
  assert.equal(h.tvRaidSea(-100, 10 * PX), false, 'past the west edge, inside the truncated strip');
  assert.equal(h.tvRaidSea(10 * PX, -100), false, 'past the south edge');
  assert.equal(h.tvRaidSea(1000 * PX + 1, 10 * PX), false);
  assert.equal(h.tvRaidSea(10 * PX, 500 * PX + 1), false);
  assert.equal(h.tvRaidSea(10.5 * PX, 10.5 * PX), true, 'on the map: the water\'s byte');
});

test('AUDIT OW5b S4 law: A RAIDER\'S LEG IS CHOSEN BY THE WHOLE LEG - through an archipelago, sampled every quarter second of its life, a raider never moves faster than it sails and is never over land', () => {
  // a sea of 1-pixel islands on a 3-pixel grid, their corners in the way of every heading
  const island = (px, py) => px % 3 === 1 && py % 3 === 1;   // map pixels (rows counting south), the raiders' own law
  const land = (x, z) => { const p = pixelOfNative(x, z); return island(p.x, p.y); };
  const sea = (x, z) => !land(x, z);
  let worst = 0, overLand = 0, n = 0;
  for (let cx = 0; cx < 12; cx++) for (let cy = 0; cy < 12; cy++) {
    const r = raiderOf({ cx, cy, life: 7, open: (px, py) => !island(px, py) });
    if (!r) continue;
    n++;
    let prev = raiderAt(r, r.bornMs, sea);
    for (let t = 250; t <= RAIDER_LIFE_MS; t += 250) {
      const p = raiderAt(r, r.bornMs + t, sea);
      worst = Math.max(worst, Math.hypot(p.x - prev.x, p.z - prev.z) / M / 0.25);
      if (land(p.x, p.z)) overLand++;
      prev = p;
    }
  }
  assert.ok(n > 10, `raiders to follow (${n})`);
  assert.ok(worst <= RAIDER_SAIL_MPS + 1e-6, `never faster than it sails (${worst.toFixed(1)} m/s)`);
  assert.equal(overLand, 0, 'never over land');
});

// ── OW6 - THE RAIDERS' CHASE, SHARED (2026-09-29, the player: "Everything needs that persistence between players in the
// overworld"). It was "the chased traveller's own ... nothing is sent" (bible, OWS3); it rides the cell foes frame now,
// under the band word's own law. ─────────────────────────────────────────────────────────────────────────────────────

test('OW6 law: the raider word is the band word\'s law with a raider\'s ids - its chases where they sail, then the spent, newest first, bounded; heard, a band\'s id is no raider\'s (nor a raider\'s a band\'s), a raider named twice once, a place off the map dropped; kept only for a raider that can be about me - this life\'s or the last, within the raiders\' reach (mutants: the ids crossed, the reach off, a life too many)', async () => {
  const { validBandWord } = await import('../../src/systems/travel/travelBands.js');
  assert.equal(RAIDERS_WIRE_MAX, 8);
  assert.equal(RAIDER_WORD_MS, 3000);
  const chases = new Map([['r1.2.30', { pos: { x: 10.4, z: 20.6 } }]]);
  assert.deepEqual(raiderWordOf(chases, ['r3.4.30', 'r5.6.29']), [['r1.2.30', 10, 21, 1], ['r3.4.30', 0, 0, 2], ['r5.6.29', 0, 0, 2]]);
  const many = Array.from({ length: 12 }, (_, k) => `r${k}.1.30`);
  assert.equal(raiderWordOf(new Map(), many).length, RAIDERS_WIRE_MAX);
  // PIN MOVED (ETHER-OW, 2026-10-13): a chaser's place is a pixel of the WORLD (net/wire.js worldPixelOk, TV-BEYOND's
  // law) - the raiders sail the Eltheric Ocean too, and a chase said there was dropped by every peer; past the world's
  // edge it is still dropped (it was a place a native unit west of the Bay)
  const P = NATIVE_PIXEL, ether = ['r833.-860.30', 5000 * P, (499 + 5160) * P, 1];
  assert.deepEqual(validRaiderWord([['r1.2.30', 5, 6, 1], ['b1.2.30', 0, 0, 2], ['r1.2.30', 0, 0, 2], ['r9.9.30', -8192 * P, 6, 1], ['r8.8.30', 0, 0, 3], ether, 'junk']), [['r1.2.30', 5, 6, 1], ether]);
  assert.deepEqual(validBandWord([['r1.2.30', 0, 0, 2], ['b1.2.30', 0, 0, 2]]), [['b1.2.30', 0, 0, 2]], 'a band word takes no raider');
  const at = { x: 60, y: 30 };   // my map pixel: the raider cells about it are within RAIDER_REACH_PX + RAIDER_CELL_PX
  assert.equal(raiderNearMe('r10.5.30', at, 30), true, 'my cell, this life');
  assert.equal(raiderNearMe('r10.5.29', at, 30), true, 'the last life');
  assert.equal(raiderNearMe('r10.5.28', at, 30), false, 'two lives gone');
  assert.equal(raiderNearMe(`r${Math.floor((60 + RAIDER_REACH_PX + RAIDER_CELL_PX) / RAIDER_CELL_PX)}.5.30`, at, 30), true, 'the reach\'s edge');
  assert.equal(raiderNearMe(`r${Math.floor((60 + RAIDER_REACH_PX + RAIDER_CELL_PX) / RAIDER_CELL_PX) + 1}.5.30`, at, 30), false, 'past it');
  assert.equal(raiderNearMe('b10.5.30', at, 30), false);
});

test('OW6 host run: MY CHASE IS SAID - a raider chasing me rides my frame where it sails, every frame; a spent one on the full frames and when the list changes; a quiet sea says it once, then nothing (mutants: the word never written, a spent raider unsaid)', () => {
  const h = seaHost();
  assert.equal(h.seaRaidWord(null, true), false, 'nothing to say');
  const c = { pos: { x: h.d.feet.x, z: h.d.feet.z + 800 * M }, best: 800, bestAt: 0 };
  h.d.tvRaid.chase.set('r1.1.5', c);
  const f = {};
  assert.equal(h.seaRaidWord(null, false), true, 'a chase asks for a frame');
  h.seaRaidWord(f, false);
  assert.deepEqual(f.sr, [['r1.1.5', Math.round(c.pos.x), Math.round(c.pos.z), 1]]);
  // it comes alongside: spent, and said so
  c.pos.z = h.d.feet.z + 10 * M;
  h.raidFrame(0.1);
  assert.equal(h.d.tvRaid.chase.size, 0);
  const g = {};
  h.seaRaidWord(g, false);
  assert.deepEqual(g.sr, [['r1.1.5', 0, 0, 2]], 'spent here - and said');
  assert.deepEqual(h.d.owed, ['r1.1.5'], 'and owed to the cell, which keeps it (OW6L)');
  assert.equal(h.seaRaidWord(null, false), false, 'unchanged: not said again between the full frames');
  assert.equal(h.seaRaidWord(null, true), true, 'and said on the full frames');
});

test('OW6 host run: A PEER\'S CHASE IS SEEN AND HELD - their raider drawn where they say it sails; I never give chase to a sail their chase holds; a raider we both chase goes to the lower id; their spent raider is spent here; a word about a raider far off or two lives gone is kept by nobody; a stale word lets the raider sail its own course again (mutants: the peer\'s place unused, the hold, the yield, the spent unheard)', () => {
  const h = seaHost({ ms: 5 * RAIDER_LIFE_MS + 1000, now: 1000 });
  const life = 5;
  const r = raiderAtM(`r83.41.${life}`, 0, 300, h.d.feet);   // my own cell's, three hundred metres off: in sight
  h.d.list = [r];
  h.d.me = { x: 500, y: 249 };
  const peerAt = { x: Math.round(h.d.feet.x + 2000 * M), z: Math.round(h.d.feet.z) };
  h.seaRaidHear('a-peer', [[r.id, peerAt.x, peerAt.z, 1]]);
  assert.ok(h.seaRaidPeerChase(r.id), 'their chase kept');
  h.raidFrame(0.1);
  assert.equal(h.d.tvRaid.chase.size, 0, 'a sail their chase holds: never mine to chase');
  h.d.marks.length = 0;
  h.drawRaiders();
  assert.deepEqual(h.d.marks.map((m) => m.at), [[peerAt.x, 0, peerAt.z]], 'drawn where they say it sails');
  // stale: back to its own course, and mine to see
  h.d.now += RAIDER_WORD_MS + 1;
  assert.equal(h.seaRaidPeerChase(r.id), null);
  h.raidFrame(0.1);
  assert.equal(h.d.tvRaid.chase.size, 1, 'the word gone stale: in sight, it chases me');
  // we both chase it: the lower id keeps it ('a-peer' < 'b')
  h.seaRaidHear('a-peer', [[r.id, peerAt.x, peerAt.z, 1]]);
  assert.equal(h.d.tvRaid.chase.size, 0, 'theirs, the lower id');
  const higher = seaHost({ ms: 5 * RAIDER_LIFE_MS + 1000, online: { id: 'a' } });
  higher.d.list = [r]; higher.d.me = { x: 500, y: 249 };
  higher.raidFrame(0.1);
  higher.seaRaidHear('z-peer', [[r.id, peerAt.x, peerAt.z, 1]]);
  assert.equal(higher.d.tvRaid.chase.size, 1, 'mine, the lower id');
  // their spent raider: spent here
  h.seaRaidHear('a-peer', [[r.id, 0, 0, 2]]);
  assert.ok(h.d.tvRaid.spent.has(r.id) && !h.seaRaidPeerChase(r.id));
  h.raidFrame(0.1);
  assert.equal(h.d.tvRaid.chase.size, 0, 'spent: never chased');
  // words nobody here keeps
  h.seaRaidHear('a-peer', [[`r10.10.${life}`, 1, 1, 1], [`r83.41.${life - 2}`, 1, 1, 1]]);
  assert.deepEqual([h.seaRaidPeerChase(`r10.10.${life}`), h.seaRaidPeerChase(`r83.41.${life - 2}`)], [null, null]);
});

test('OW6 host wiring: the raider word rides my cell\'s foes frame and asks for one; a peer\'s is heard past the pool\'s room test; the load forgets both (mutants: the frame unforced, the hook unregistered)', () => {
  const w = rd('src/scenes/world.js'), ef = rd('src/scenes/exteriorFoes.js');
  assert.match(w, /const seaRaidMoved = cell && seaRaidWord\(null, full\);/);
  assert.match(w, /exteriorFoes\.foesFrame\(full, _hccDirty \|\| csaMoved \|\| csaAboardMoved \|\| bandMoved(?: \|\| navalMoved)? \|\| seaRaidMoved\)/);   // THE MERGE with NAV-G: the sea's word beside it
  assert.match(w, /if \(cell\) bandWord\(frame, full\);(?: if \(cell\) navalWord\(frame, full\);)? if \(cell\) seaRaidWord\(frame, full\);/);
  assert.match(w, /exteriorFoes\.setOnSeaRaiders\(\(from, sr\) => seaRaidHear\(from, sr\)\);/);
  assert.match(ef, /if \(data\.sr !== undefined\) _onSeaRaiders\?\.\(from, data\.sr, _now\(\)\);/);
  assert.match(ef, /function setOnSeaRaiders\(fn\) \{ _onSeaRaiders = typeof fn === 'function' \? fn : null; \}/);
  assert.match(w, /tvRaid\.peer\.clear\(\); tvRaid\.spentAt\.length = 0;/);
});
