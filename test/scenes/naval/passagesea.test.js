// PASSAGE (2026-10-19; bible/03-World/Passage.md) - THE SHIP AT HER BERTH (scenes/naval/navalHost.js passageShip,
// charter, charterSailed), over the real host and Come Sail Away's real pool (test/navalSea.mjs): a harbour's own
// friendly ship, moored, on foot within reach and the look on her, takes Activate and asks the passage door; her boat is
// placed at her berth from a deed of her hull, the voyage written on it, and she lies there still until the voyage is
// under way - then she is let go, and not stood at her berth again today.

import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sea } from '../../navalSea.mjs';
import { room } from '../../navalRoom.mjs';
import { navalWireRecord, validNavalRecord, NAVAL_WIRE_GONE } from '../../../src/systems/naval/navalWire.js';
import { PASSAGE_HULLS, PASSAGE_TEXT, PASSAGE_RAY_M } from '../../../src/systems/naval/passage.js';
import { BOAT_DEED_TEMPLATE } from '../../../src/systems/shipyards.js';
import { hullBuild } from '../../../src/systems/naval/navalShips.js';

const coast = (x, z) => !(z > 200 || (x > 300 && x < 400 && z > -300));
const PORT = { key: 'port:1', rect: { minX: -100, maxX: 100, minZ: 220, maxZ: 420 } };
const moored = (w) => [...w.host._sea.values()].filter((e) => e.ship.errand?.kind === 'moored' && e.fromHarbour);

/** A port with its ships at their berths, the passage door recording, and a Come Sail Away runtime that places a deed's
 *  boat as a record. Answers the sea and the first ship of a passage hull. */
async function port() {
  const w = await sea({ hull: null, water: coast });
  const asked = [], placed = [];
  w.deps.passage = (ship) => asked.push(ship);
  w.deps.board.mintUid = () => 4242;
  w.deps.csa = () => ({
    state: { AllBoats: [] }, isSailing: () => false,
    LaunchFromDeed: (deed, list, pos, dir) => { placed.push({ deed, list, pos, dir }); return { uid: deed.UID, hull: Math.floor(deed.message / 10), GameObject: { position: pos } }; },
  });
  w.view.feet = [0, 0, 300]; w.deps.harbourNear = () => PORT;
  w.run(1);
  const e = moored(w).find((x) => PASSAGE_HULLS.includes(x.ship.hull));
  assert.ok(e, 'a ship of a passage hull at her berth');
  return { w, e, asked, placed };
}
/** On foot beside her side - `gap` metres off it, across her beam (her side's normal, off her yaw) - the look on her side
 *  (or `away` from her). */
function standBy(w, e, { away = false, gap = 3 } = {}) {
  const s = e.ship.pos, side = [Math.cos(e.ship.yaw), 0, -Math.sin(e.ship.yaw)], off = hullBuild(e.ship.hull).halfWidth + gap;
  const feet = [s[0] + side[0] * off, 0, s[2] + side[2] * off];
  w.view.feet = feet;
  w.view.look = { origin: [feet[0], 1.6, feet[2]], dir: away ? side : [-side[0], 0, -side[2]] };
}
/** Identity, never a deep compare: a failed equal on a ship's entry inspects the whole sea. */
const same = (a, b, msg) => assert.ok(a === b, msg);

test('PASSAGE sea: a harbour\'s own friendly ship at her berth takes Activate on foot and asks the passage door - her number, name, captain and hull; never with the look off her, out of reach, or at a helm (mutants: the look unread; the reach unread; no door asked)', async () => {
  const { w, e, asked } = await port();
  standBy(w, e, { away: true });
  assert.ok(w.host.passageShip() === null, 'the look off her');
  standBy(w, e);
  same(w.host.passageShip(), e, 'the look on her side');
  assert.equal(w.host.takesActivate(), true, 'the street hears it as the sea\'s press');
  assert.equal(w.host.activate(), true);
  assert.deepEqual(asked, [{ id: e.id, name: e.ship.names?.name ?? null, captain: e.ship.names?.captain ?? null, hull: e.ship.hull, faction: e.ship.cls.faction }]);
  standBy(w, e, { gap: PASSAGE_RAY_M + 1 });
  assert.ok(w.host.passageShip() === null, 'her side past the ray\'s reach (AUDIT PASSAGE B6)');
  standBy(w, e, { gap: PASSAGE_RAY_M - 1 });
  same(w.host.passageShip(), e, 'within it');
  w.deps.passage = undefined;
  standBy(w, e);
  assert.ok(w.host.passageShip() === null, 'no door: no ship to book');
});

test('PASSAGE sea: her word as the look comes onto her, once a ship (mutants: never said; said every frame)', async () => {
  const { w, e } = await port();
  standBy(w, e);
  w.run(0.5);
  const hint = PASSAGE_TEXT.hint(e.ship.names?.name ?? null);
  assert.equal(w.log.say.filter((t) => t === hint).length, 1);
});

test('PASSAGE sea: a ship that is not hers to carry me is no passage - a packet, a pirate, one fading out, one under way (mutants: the harbour\'s mark unread; the stance unread; the mooring unread)', async () => {
  const { w, e } = await port();
  standBy(w, e);
  e.fromHarbour = null;
  assert.ok(w.host.passageShip() === null, 'not a harbour\'s own');
  e.fromHarbour = PORT.key;
  const cls = e.ship.cls;
  e.ship.cls = { ...cls, faction: 'pirate' };
  assert.ok(w.host.passageShip() === null, 'no lawful master');
  e.ship.cls = cls;
  e.retiring = true;
  assert.ok(w.host.passageShip() === null, 'fading out');
  e.retiring = false;
  const errand = e.ship.errand;
  e.ship.errand = { ...errand, kind: 'depart' };
  assert.ok(w.host.passageShip() === null, 'under way');
  e.ship.errand = errand;
  same(w.host.passageShip(), e, 'and herself again');
});

test('PASSAGE sea: her boat at her berth from a deed of her own hull, never into the pack, the voyage written on it - and she lies there still until the voyage is under way; then let go and not stood again today (mutants: the record unwritten; she packs; she dropped at the placing; never let go; stood again after a door)', async () => {
  const { w, e, placed } = await port();
  const record = { to: { name: 'Sentinel', px: 130, py: 100 }, ship: 'x', captain: null, fare: 50 };
  const boat = w.host.charter(e.id, record);
  assert.ok(boat);
  assert.equal(boat.charter, record);
  assert.equal(boat.packable, false, 'she never packs - the crossing plans no second launch of her');
  assert.equal(placed.length, 1);
  assert.equal(placed[0].deed.templateIndex, BOAT_DEED_TEMPLATE);
  assert.equal(Math.floor(placed[0].deed.message / 10), e.ship.hull, 'her own hull');
  assert.deepEqual(placed[0].list, [placed[0].deed], 'a list of its own - never the pack or the Fleet\'s book');
  assert.ok(Math.hypot(placed[0].pos[0] - e.ship.pos[0], placed[0].pos[2] - e.ship.pos[2]) < 1, 'at her berth, as she lies');
  assert.ok(w.host._sea.has(e.id), 'she lies there still');
  assert.equal(w.host.charter('nobody', record), null, 'a ship gone: nothing placed');
  const seed = e.ship.seed;
  assert.equal(w.host.charterSailed(e.id), true);
  assert.ok(!w.host._sea.has(e.id), 'let go');
  w.host.clear();   // a door
  w.run(1);
  assert.ok(!moored(w).some((x) => x.ship.seed === seed), 'not stood at her berth again today');
  assert.equal(w.host.charterSailed(e.id), false);
});

test('AUDIT PASSAGE (lanes B, D): no passage on a packet, a prize or a rowboat, at a helm, through her own helm\'s or hold\'s ray, nor on a hull this helm cannot cross a sea in (a Carrack under the Classic handling) (mutants: the packet carries; the prize carries; any hull carries; at a helm; the press over her helm ray; the crossing unasked)', async () => {
  const { w, e } = await port();
  standBy(w, e);
  same(w.host.passageShip(), e, 'herself');
  const check = (set, unset, msg) => { set(); assert.ok(w.host.passageShip() === null, msg); unset(); same(w.host.passageShip(), e, `${msg} - and herself again`); };
  check(() => { e.liner = { seed: 1 }; }, () => { e.liner = null; }, 'a packet keeps her timetable');
  check(() => { e.prize = { fate: null }; }, () => { e.prize = null; }, 'a prize carries no one');
  const hull = e.ship.hull;
  check(() => { e.ship.hull = 0; }, () => { e.ship.hull = hull; }, 'a rowboat crosses no sea');
  check(() => { w.deps.passageCrosses = (h) => h !== hull; }, () => { w.deps.passageCrosses = undefined; }, 'a hull this helm cannot cross a sea in (AUDIT PASSAGE B7)');
  const rt = w.deps.csa();
  const mine = { GameObject: { activeSelf: true, position: [0, 0, 0] } };
  check(() => { w.deps.csa = () => ({ ...rt, isSailing: () => true, state: { AllBoats: [mine], CurrentBoat: mine } }); }, () => { w.deps.csa = () => rt; }, 'at a helm');
  assert.equal(w.host.takesActivate({ boatTrigger: true }), false, 'her own helm, hold or door under the ray first');
  assert.equal(w.host.takesActivate(), true);
});

test('AUDIT PASSAGE B5: ANOTHER PLAYER\'S SHIP AT HER BERTH IS BOOKED TOO - her copy carries no errand on the wire, so she is found lying still at a berth of a harbour I know; her boat stands at that berth, and her letting go takes her over and marks her sailed from that harbour today (mutants: a peer\'s copy unbookable; her berth not found; not taken over)', async () => {
  const { w, e, placed } = await port();
  const harbour = e.ship.errand.harbour, berth = e.ship.errand.berth, seed = e.ship.seed;
  e.owner = 'peer-b'; e.ship.errand = null; e.ship.speed = 0; e.fromHarbour = null;   // as another player's word stands her
  standBy(w, e);
  same(w.host.passageShip(), e, 'lying still at a berth: hers to book');
  e.ship.speed = 5;
  assert.ok(w.host.passageShip() === null, 'under way: no berth');
  e.ship.speed = 0;
  const boat = w.host.charter(e.id, { to: { name: 'Sentinel', px: 1, py: 2 }, ship: null, captain: null, fare: 25 });
  assert.ok(boat, 'her boat stands');
  const b = [...w.host._sea.values()].length;
  assert.ok(Math.hypot(placed[0].pos[0] - e.ship.pos[0], placed[0].pos[2] - e.ship.pos[2]) < 1, 'at the berth she lies at');
  const id = e.id;
  assert.equal(w.host.charterSailed(id), true);
  assert.equal(e.owner, null, 'taken over before she is let go - mine to let go, as a boarding takes her');
  assert.equal([...w.host._sea.values()].length, b - 1, 'let go');
  assert.ok(![...w.host._sea.values()].some((x) => x.ship.seed === seed), 'from my sea');
  w.host.clear(); w.run(1);
  assert.ok(![...w.host._sea.values()].some((x) => x.ship.seed === seed && x.ship.errand?.harbour === harbour && x.ship.errand?.berth === berth), 'not stood at her berth again today, by me');
});

test('AUDIT PASSAGE B5: A BOOKED SHIP IS GONE FOR EVERY PLAYER - her seed said in the word (`q`, the last NAVAL_WIRE_GONE, said on by every reader): the copy lying at her berth fades out, and no player stands her there again that day or takes her over, whoever stood her and whoever booked her; the door reads it whole or refuses the word; before, the next player to stand the port stood her again at her berth (mutants: `q` unsaid; unread; not said on; the roll unasked; her copy kept; her copy read again; taken over again)', async () => {
  const PASSENGER = { to: { name: 'Sentinel', px: 1, py: 2 }, ship: null, captain: null, fare: 25 };
  const gone = (c, seed) => ![...c.s.host._sea.values()].some((x) => x.ship.seed === seed);
  for (const [booker, leaves] of [['stander', false], ['other', false], ['stander', true]]) {
    const r = await room([{ id: 'a', hull: null, water: coast }, { id: 'b', hull: null, water: coast }]);
    for (const c of r.clients.values()) {
      c.s.deps.passage = () => true; c.s.deps.board.mintUid = () => 4242; c.s.deps.harbourNear = () => PORT;
      c.s.deps.csa = () => ({ state: { AllBoats: [] }, isSailing: () => false, LaunchFromDeed: (deed, list, pos) => ({ uid: deed.UID, hull: Math.floor(deed.message / 10), GameObject: { position: pos } }) });
      c.s.view.feet = [0, 0, 300];
    }
    r.run(3);
    const stander = [...r.get('a').s.host._sea.values()].some((x) => !x.owner && x.fromHarbour) ? r.get('a') : r.get('b');
    const other = stander === r.get('a') ? r.get('b') : r.get('a');
    const by = booker === 'stander' ? stander : other, them = by === stander ? other : stander;
    const e = [...by.s.host._sea.values()].find((x) => PASSAGE_HULLS.includes(x.ship.hull) && (x.fromHarbour || x.owner));
    assert.ok(e, `${booker}: a ship to book`);
    const seed = e.ship.seed;
    assert.ok(!gone(them, seed), `${booker}: both see her at her berth`);
    assert.ok(by.s.host.charter(e.id, PASSENGER), `${booker}: her boat`);
    assert.equal(by.s.host.charterSailed(e.id), true);
    if (leaves) {   // the stander sails off at once: the other rolls the port while her copy still fades at her berth
      by.s.view.feet = [99999, 0, 99999];
      r.run(1);
      assert.ok([...them.s.host._sea.values()].some((x) => x.ship.seed === seed && x.retiring), 'her copy fading as the other takes the port');
    }
    r.run(6);   // past SHIP_FADE_S
    assert.ok(gone(by, seed) && gone(them, seed), `${booker}: gone from both seas - her copy faded out, never kept or taken over`);
    // the booker sails off; the other player rolls the port afresh (a door's visit, a day's harbour found again)
    by.s.view.feet = [99999, 0, 99999];
    r.run(3);
    them.s.host.clear(); r.run(3);
    assert.ok(gone(them, seed), `${booker}: never stood at her berth again today by the other player`);
  }
  // said on: a word heard from another player is said in mine, so a player who never met the booker hears it too
  const w = (await port()).w;
  assert.equal(w.host.applyWord('peer-c', { s: [], q: [77, 78] }), true);
  assert.deepEqual(w.host.word()?.q, [77, 78], 'said on in my word');
  // the door: said, bounded, read whole or the word refused
  const said = navalWireRecord({ ships: [], gone: [1, 2, 3] });
  assert.deepEqual(said.q, [1, 2, 3], 'said in its own key - the only thing said');
  assert.deepEqual(validNavalRecord(said).gone, [1, 2, 3]);
  assert.deepEqual(validNavalRecord({ s: [] }).gone, [], 'an older build\'s word says none');
  assert.equal(navalWireRecord({ ships: [], gone: Array.from({ length: NAVAL_WIRE_GONE + 3 }, (_, i) => i) }).q.length, NAVAL_WIRE_GONE, 'the last NAVAL_WIRE_GONE');
  for (const bad of [{ s: [], q: 'x' }, { s: [], q: [-1] }, { s: [], q: [1.5] }, { s: [], q: Array.from({ length: NAVAL_WIRE_GONE + 1 }, (_, i) => i) }]) assert.equal(validNavalRecord(bad), null, JSON.stringify(bad).slice(0, 40));
});
