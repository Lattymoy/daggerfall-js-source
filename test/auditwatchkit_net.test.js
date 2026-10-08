// AUDIT WATCH-KIT (2026-10-01, Mac: "Just want to audit this to make sure it's perfection") - THE SAFETY NET, the
// lead's share (bible/01-Overview/Audit-Watch-Kit.md, lens D's fresh mutants): behaviour #502 shipped with no pin that
// could fail on it - the captains' night hold and their flee by flashes, the lurk's night hub, her work off her hurts,
// the lookout's cry cleared with the sea, a pack stowed only when there is one, a fallen hand's pack not lost, and the
// world's wiring of the companions' cards and pack door. Each test kills its mutant (tools/mutants/auditwatchkit_net.json).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { NIGHT_DARK_SIGHT } from '../src/systems/naval/shipWatch.js';
import { createSeaShip, stepCaptain, WIND_RATED, DISENGAGE, FLEE_RANGE } from '../src/systems/naval/navalAI.js';
import { findHarbour, createWaterGrid, errandFor, stepErrand, LURK_R, LURK_SAILS, NIGHT_LURK_K } from '../src/systems/naval/shipLife.js';
import { HULL } from '../src/systems/naval/navalShips.js';
import { sea } from './navalSea.mjs';

const WORLD = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const open = () => true;
const world = (o = {}) => ({ now: 0, dt: 1, seaY: 0, wind: [0, 0, WIND_RATED], isWater: open, contacts: [], random: () => 0.5, ...o });
const contactOf = (s, o = {}) => ({ id: s.id, kind: 'ship', faction: s.cls.faction, pos: s.pos, vel: [0, 0, 0], speed: 0, yaw: s.yaw, hull: s.hull, ship: s, ...o });

// ── the captains by night ──────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT WK-SN the night\'s hold: a pirate keeps a dark boat she fights out to DISENGAGE of her NIGHT\'s sight, not her day\'s - and lets her go past it (mutants: the hold by the day\'s lookout)', () => {
  const p = createSeaShip({ id: 'p', seed: 1, classId: 'pirateBrig', pos: [0, 0, 0], yaw: 0, temper: 'bold' });
  const me = (z) => ({ id: 'me', kind: 'player', pos: [0, 0, z], vel: [0, 0, 0], speed: 0, lit: false });
  stepCaptain(p, world({ night: true, contacts: [me(200)] }));
  assert.equal(p.target, 'me', 'seen close aboard');
  p.pos = [0, 0, 0];
  stepCaptain(p, world({ night: true, contacts: [me(NIGHT_DARK_SIGHT * DISENGAGE - 15)] }));
  assert.equal(p.target, 'me', 'held inside DISENGAGE of the night\'s sight');
  p.pos = [0, 0, 0];
  stepCaptain(p, world({ night: true, contacts: [me(NIGHT_DARK_SIGHT * DISENGAGE + 25)] }));
  assert.notEqual(p.target, 'me', 'let go past it');
});

test('AUDIT WK-SN the flee by flashes: by night a merchantman runs from a dark pirate past a dark ship\'s flee reach when the pirate fired within GUNS_SEEN_S - seen by her flashes (mutants: the flashes unread for the threat)', () => {
  const run = (fired) => {
    const m = createSeaShip({ id: 'm', seed: 2, classId: 'merchantGalleon', pos: [0, 0, 0], yaw: 0 });
    const p = createSeaShip({ id: 'p', seed: 1, classId: 'pirateBrig', pos: [0, 0, 280], yaw: Math.PI, temper: 'bold' });
    stepCaptain(m, world({ now: 100, night: true, contacts: [contactOf(p, { lit: false })], gunfire: fired ? [{ pos: [0, 0, 280], at: 95, by: 'p' }] : [] }));
    return m.mode;
  };
  assert.ok(280 > NIGHT_DARK_SIGHT && 280 < FLEE_RANGE);
  assert.equal(run(false), 'cruise', 'dark and silent: unseen');
  assert.equal(run(true), 'flee', 'firing: seen');
});

// ── the lurk by night ──────────────────────────────────────────────────────────────────────────────────────────────

const coast = (x, z) => !(z > 200 || (x > 300 && x < 400 && z > -300));
const TOWN = { minX: -100, maxX: 100, minZ: 220, maxZ: 420 };
function lifeOn(harbour, o = {}) {
  const grids = new Map();
  const grid = (h) => grids.get(h) ?? (grids.set(h, createWaterGrid({ isWater: coast, hull: h })), grids.get(h));
  return { harbour: (k) => (k === 'port' ? harbour : null), grid, free: () => true, harbours: () => [{ key: 'port', harbour, free: () => true }], ...o };
}
const lurker = (harbour) => {
  const p = createSeaShip({ id: 'p', seed: 9, classId: 'pirateBrig', pos: [600, 0, -600], yaw: 0, temper: 'bold' });
  p.errand = errandFor({ seed: 9, faction: 'pirate', hull: p.hull, pos: p.pos, harbours: [{ key: 'port', harbour, free: () => true }] });
  assert.equal(p.errand.kind, 'lurk');
  return p;
};

test('AUDIT WK-SN the lurk by night: a harbour gone from the errand\'s reach leaves her lurking at her day\'s place, no throw; at her night hub she shortens sail as at her day\'s; her ring is sounded from the night hub (mutants: the night without a harbour, the sails by the day\'s place, the ring cleared from the day\'s place)', () => {
  const harbour = findHarbour({ rect: TOWN, isWater: coast });
  // no harbour by night
  const lost = lurker(harbour);
  assert.doesNotThrow(() => stepErrand(lost, 0.1, lifeOn(harbour, { night: true, harbour: () => null })));
  // the sails at the night hub
  const p = lurker(harbour);
  const at = p.errand.at, mouth = harbour.mouth;
  const hub = [mouth[0] + (at[0] - mouth[0]) * NIGHT_LURK_K, mouth[1] + (at[1] - mouth[1]) * NIGHT_LURK_K];
  // a little in from her night hub toward the mouth: near the hub, past half her reach from her day's place
  const toMouth = Math.hypot(mouth[0] - hub[0], mouth[1] - hub[1]);
  const spot = [hub[0] + ((mouth[0] - hub[0]) / toMouth) * 60, hub[1] + ((mouth[1] - hub[1]) / toMouth) * 60];
  assert.ok(Math.hypot(spot[0] - hub[0], spot[1] - hub[1]) < LURK_R * 0.5 && Math.hypot(spot[0] - at[0], spot[1] - at[1]) > LURK_R * 0.5);
  p.pos = [spot[0], 0, spot[1]];
  assert.equal(stepErrand(p, 0.1, lifeOn(harbour, { night: true })).sails, LURK_SAILS, 'lurking: sail shortened');
  // the ring sounded from the night hub: a water whose only clear soundings start there
  const q = lurker(harbour);
  const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6;
  const fromHub = { clear: (a) => near(a, hub) };
  stepErrand(q, 0.1, lifeOn(harbour, { night: true, grid: () => fromHub }));
  // four points about the hub (the chords between them, unsounded here, go by the hub - ringOver's law)
  assert.equal(q.errand.path.filter((pt) => !near(pt, hub)).length, 4, `four points about the hub: ${JSON.stringify(q.errand.path)}`);
});

// ── the host ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT WK-SN the host: her work is her hull\'s loss and half her canvas\'s; a lookout\'s cry waiting is cleared with the sea; an empty pack is no stowing to say; a fallen hand\'s pack goes to her hold (mutants: the canvas whole, the cry outliving the clear, the empty said, the prune\'s pack lost)', async () => {
  const s = await sea({ hull: HULL.SmallShip, settings: { ShipsAtSea: 'off' } });
  s.boat.crewed = true;
  s.host.restoreSaveData({ v: 1, boats: { 42: { hull: 420, sail: 80, crew: 24, fire: 0, state: 'afloat', barrels: 4 } }, notoriety: {}, day: 1, raids: [] });
  assert.ok(Math.abs(s.host.myCrew(s.boat).work - 0.25) < 1e-9, 'half her canvas: a quarter\'s work');
  // the cry waiting, then the sea cleared
  s.host.spawnShip('pirateBrig', { range: 600, bearing: Math.PI / 2, temper: 'bold' });
  s.run(1.2);
  assert.ok(s.log.say.some((t) => /Sail ho/.test(t)));
  s.host.clear();
  assert.equal(s.host.myCrew(s.boat).call, null, 'cleared with the sea');
  // an empty pack sent back: nothing to stow, nothing said of it
  s.runtime.sailing = false;
  const hand = s.host._myState(s.boat).crew.hands[0].name;
  assert.equal(s.host.companionPress(s.boat, hand, 0), 'take');
  const said = s.log.say.length;
  assert.equal(s.host.companionPress(s.boat, hand, 1), 'back');
  assert.ok(s.log.say.slice(said).some((t) => t === `${hand} goes back aboard.`));
  assert.equal(s.log.say.slice(said).some((t) => /pack is stowed/.test(t)), false, 'no stowing said');
  // a fallen hand's pack
  const h = await sea({ hull: HULL.SmallShip });
  h.boat.crewed = true;
  h.host.restoreSaveData({ v: 1, boats: { 42: { hull: 420, sail: 160, crew: 24, fire: 0, state: 'afloat', barrels: 4 } }, notoriety: {}, day: 1, raids: [] });
  h.run(0.2);
  h.runtime.sailing = false;
  const c = h.host.companions.take(42, { name: 'Nobody Aboard', role: 'Cook', mobile: 144, gender: 'male' }, 0);
  c.items.push({ name: 'Rope' }, { name: 'Lamp' });
  const gone = h.host.pruneCompanions();
  assert.equal(gone.length, 1);
  assert.deepEqual(h.log.given.at(-1), [2, h.boat], 'his pack into her hold');
});

// ── the world's wiring ─────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT WK-SN the world: the cards drawn every frame of the layer; a card\'s health off his body where one stands, else the party\'s; the offline panel gives way to the party\'s; the pack door asks the pack is ready and says no when the slot is held (mutants: the frame dropped, the card off the party, the offline panel orphaned, the door unasked, a failed mount said open)', () => {
  assert.match(WORLD, /function crewAshoreTick\(\) \{\n\s*try \{ companionPanelFrame\(\); \} catch/);
  assert.match(WORLD, /partyPanel\?\.destroy\?\.\(\);   \/\/ COMPANION-KIT: the offline panel my companions stood gives way to the party's\n\s*makePartyPanel\(social\);/);
  assert.match(WORLD, /if \(!naval\?\.companionPack\?\.\(key\) \|\| !inventoryDoorReady\(\)\) return false;/);
  assert.match(WORLD, /if \(!modes\?\.mountWindow\?\.\(w\)\) \{ \(w\.dispose\?\.bind\(w\) \?\? w\._closeSilently\?\.bind\(w\)\)\?\.\(\); return false; \}\n\s*return true;\n\s*\};/);
  // the card, lifted
  const at = WORLD.indexOf('function partyCompanions() {');
  const body = WORLD.slice(WORLD.indexOf('{', at) + 1, WORLD.indexOf('\n  }\n', at));
  const cards = new Function('navalOn', 'csaRuntime', 'naval', 'crewAshore', 'composePartyFx', 'swornCards', 'modes', body);   // REVENANT-COMPANION: the sworn's cards (none here); GATE-ALONE: the mode machine, for a gate's court
  const party = [{ boat: 42, name: 'Hilda', role: 'Bosun', health: 20, maxHealth: 60 }];
  const naval = { companions: { party } };
  const standing = { bodies: () => [{ companion: '42:Hilda', dead: false, entity: { health: 45, maxHealth: 60 } }] };
  const none = { bodies: () => [] };
  const fx = () => ['fx'];
  assert.deepEqual(cards(() => true, null, naval, standing, fx), [{ key: '42:Hilda', name: 'Hilda', role: 'Bosun', h: 45, hm: 60, fx: ['fx'] }], 'off his body');
  assert.deepEqual(cards(() => true, null, naval, none, fx), [{ key: '42:Hilda', name: 'Hilda', role: 'Bosun', h: 20, hm: 60, fx: [] }], 'off the party');
  const fallen = { bodies: () => [{ companion: '42:Hilda', dead: true, entity: { health: 0, maxHealth: 60 } }] };
  assert.deepEqual(cards(() => true, null, naval, fallen, fx), [{ key: '42:Hilda', name: 'Hilda', role: 'Bosun', h: 20, hm: 60, fx: [] }], 'a body down: the party\'s word');
  assert.deepEqual(cards(() => false, null, naval, standing, fx), [], 'the arc off');
  assert.deepEqual(cards(() => true, { isSailing: () => true }, naval, standing, fx), [], 'sailing (AUDIT WK-U5)');
  assert.deepEqual(cards(() => true, null, naval, standing, fx, undefined, { gateArenaDay: () => 3 }), [], 'in a gate\'s court (GATE-ALONE: they wait outside it)');
  assert.equal(cards(() => true, null, naval, standing, fx, undefined, { gateArenaDay: () => null }).length, 1, 'out of it, the cards as ever');
});
