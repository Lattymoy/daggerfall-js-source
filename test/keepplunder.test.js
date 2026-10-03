// KEEP-PLUNDER and KEEP-BOATS (2026-09-30, Mac: ship ownership "less punishing" - "Keep boats & cargo"). The sea is
// never a save's, and a transition or a fast travel empties it: a prize whose hold was not yet emptied and the casks of
// the ships I sank went with it. Before it goes, my crew stows them (scenes/navalHost.js stowPlunder). And a boat
// placed in a dungeon is kept, hold and all, when the player leaves it (the mod's PersistentDungeonBoats, shipped on).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sea } from './navalSea.mjs';
import { GRAPPLE_S } from '../src/systems/naval/navalBoarding.js';
import { STRUCK_GRACE_S } from '../src/scenes/navalHost.js';
import { SHIP_STATES } from '../src/systems/naval/navalDamage.js';
import { navalHitData, NAVAL_HIT_MAX } from '../src/systems/naval/navalWire.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';
import { scene } from './csaScene.mjs';
import { Boat } from '../src/systems/comeSailAwayBoat.js';

const WORLD = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
/** A peer's blow - PIN MOVED (TOUGHER-SHIPS): one past a hit's most (navalWire.js NAVAL_HIT_MAX, a broadside's worth) lands
 *  as several, her fire and her men with the first; a toughened hull outweighs one hit. The pieces after one that strikes
 *  her are the same volley's (STRUCK_GRACE_S: floored at 1) - a blow meant to take her from afloat straight under is
 *  two blows a grace apart, never one. */
const blow = (h, e, from, o) => {
  let left = Math.max(0, o.hull ?? 0), first = true;
  do {
    const hull = Math.min(left, NAVAL_HIT_MAX);
    h.host.applyPeerHit(from, navalHitData('local', first ? { n: e.n, ...o, hull } : { n: e.n, hull, zone: o.zone }));
    left -= hull; first = false;
  } while (left > 0);
};
function place(h, classId, pos, yaw = 0) {
  const id = h.host.spawnShip(classId, { range: Math.hypot(pos[0], pos[2]), bearing: Math.atan2(pos[0], pos[2]), yaw });
  const e = h.host._sea.get(id);
  e.ship.pos = [...pos];
  h.host.frame(0.1);
  return e;
}
/** A merchant struck alongside, boarded from my helm and taken: her hold drawn, not yet emptied. */
async function prize() {
  const h = await sea({ hull: 2 });
  const { deps } = h;
  const e = place(h, 'merchantGalleon', [7.4 + 7.4 + 12, 0, 0], 0);
  e.ship.damage.apply({ hull: Math.ceil(e.ship.damage.maxHull * 0.8), sail: 0, crew: 0 });
  h.host.frame(0.1);
  assert.equal(h.host.activate(), true, 'the grapples');
  h.run(GRAPPLE_S + 0.3);
  for (const f of h.log.foes.filter((x) => x.side === 'enemy')) f.dead = true;
  h.run(0.3);
  assert.equal(h.host.boarding, null, 'taken');
  assert.ok(e.prize?.hold?.length > 0, 'her hold drawn');
  return { h, e, deps };
}
/** A ship sunk by `by` ('local': me) - struck, then her hull broken past it. */
function sink(h, e, by) {
  const d = e.ship.damage;
  blow(h, e, by, { hull: Math.floor(d.hull - 1) });
  h.run(STRUCK_GRACE_S + 1);
  blow(h, e, by, { hull: Math.ceil(d.hull + 1) });
  h.run(0.5);
  assert.equal(d.state, SHIP_STATES.sinking, `${by}: going down`);
}

test('KEEP-PLUNDER: A PRIZE\'S HOLD NOT YET EMPTIED IS STOWED IN THE BOAT THAT TOOK HER before the sea goes - once, said once; a second stow finds nothing; a scuttled prize\'s hold goes down with her (mutants: the prize unstowed, the captor\'s boat not asked, the scuttled stowed)', async () => {
  const { h, e } = await prize();
  const n = e.prize.hold.length;
  h.log.given.length = 0;
  const r = h.host.stowPlunder();
  assert.deepEqual([r.items, r.prizes], [n, 1]);
  assert.deepEqual(h.log.given, [[n, h.boat]], 'into her captor\'s hold');
  assert.equal(e.prize.hold.length, 0);
  assert.ok(h.log.say.includes(`Your crew stows the plunder left at sea (${n} ${n === 1 ? 'thing' : 'things'}).`));
  assert.equal(h.host.stowPlunder().items, 0, 'nothing left to stow');
  // her captor another boat of mine than the helm's: hers, not the helm's
  const c = await prize();
  const other = c.h.pool.spawnNow(Object.assign(new Boat(1, 0), { uid: 43 }), { position: [60, 0, 0], rotation: [0, 0, 0, 1] });
  c.h.runtime.state.AllBoats.push(other);
  c.e.prize.boat = other;
  c.h.log.given.length = 0;
  c.h.host.stowPlunder();
  assert.deepEqual(c.h.log.given.map(([, b]) => b), [other], 'into her captor, the helm\'s boat notwithstanding');
  const s = await prize();
  s.e.prize.fate = 'scuttle';
  s.h.log.given.length = 0;
  assert.equal(s.h.host.stowPlunder().items, 0, 'a scuttled prize keeps her hold');
  assert.deepEqual(s.h.log.given, []);
});

test('KEEP-PLUNDER: THE CASKS OF A SHIP I SANK ARE HAULED IN before the sea goes - their lots into my boat\'s hold, gone from the water; a ship another sank floats hers still, never mine; clear() takes the rest as before (mutants: my casks left, another\'s taken, the cask left floating)', async () => {
  const h = await sea({ hull: 2 });
  const mine = place(h, 'merchantGalleon', [300, 0, 0], 0);
  const theirs = place(h, 'merchantGalleon', [-300, 0, 0], 0);
  sink(h, mine, 'local');
  sink(h, theirs, 'peer-x');
  const floating = () => h.host._shots.floaters().filter((f) => f.kind === 'flotsam');
  const before = floating().length;
  assert.ok(before >= 2, 'both floated casks');
  h.log.given.length = 0;
  const r = h.host.stowPlunder();
  assert.ok(r.casks >= 1, 'mine hauled in');
  assert.equal(r.casks + floating().length, before, 'mine gone from the water');
  assert.ok(floating().length >= 1, 'another\'s still float');
  assert.ok(h.log.given.length === r.casks && h.log.given.every(([k, b]) => k > 0 && b === h.boat), 'their lots into my helm\'s hold');
  assert.equal(h.host.stowPlunder().casks, 0, 'hauled once');
  h.host.clear();
  assert.equal(floating().length, 0, 'the sea gone');
});

test('KEEP-PLUNDER / KEEP-BOATS: THE WORLD\'S WIRING - the crew stows before every transition (ahead of Come Sail Away\'s own, while my boats still stand), before a jump but never a load\'s, and before a fast travel packs her; a boat placed in a dungeon is kept by default (the mod\'s key, its shipped default moved) (mutants: a hook unwired, a load stowed, the default the mod\'s)', () => {
  assert.match(WORLD, /const navalStow = \(\) => \{ if \(!_loading\) naval\?\.stowPlunder\?\.\(\); \};/);
  for (const hook of ['onTransitionInterior: () => { navalStow(); csaOnTransition(); navalTransition(); },', 'onTransitionExterior: () => { navalStow(); csaOnTransition(); navalTransition(); },',
    'onTransitionDungeonInterior: (ctx) => { navalStow(); ohAbyss', 'onTransitionDungeonExterior: () => { navalStow(); ohAbyss']) assert.ok(WORLD.includes(hook), hook);
  assert.match(WORLD, /if \(modEvent !== 'load'\) navalStow\(\);[^\n]*\n\s+csaOnTeleport\(\);/);
  assert.match(WORLD, /navalStow\(\);[^\n]*\n\s+if \(csaRuntime\) csaCall\(\(\) => csaRuntime\.OnPreFastTravel\(\)\);/);
  assert.equal(MOD_SETTINGS['come-sail-away'].keys['Compatibility.PersistentDungeonBoats'].default, true);
  assert.match(WORLD, /persistentDungeonBoats: \(\) => \{ try \{ return modSetting\('come-sail-away', 'Compatibility\.PersistentDungeonBoats'\) === true;/);
});

test('AUDIT KEEP-PLUNDER D1 / D3: OFF THE HELM THE PLUNDER GOES INTO MY BOAT NEAREST ME, WHAT WILL NOT FIT IS SAID, AND THE SWITCH OFF STOWS FIRST - a door taken off the deck (no helm, the captor packed) stows into the boat of mine nearest me before the pack; a hold that will not all go says how much was left; naval combat turned off stows before it takes the sea (mutants: the pack before my boat, the leftovers unsaid, the switch unstowed)', async () => {
  const { h, e } = await prize();
  h.runtime.sailing = false;   // off the helm - through a door
  e.prize.boat = null;   // her captor packed
  h.log.given.length = 0;
  const n = e.prize.hold.length;
  h.host.stowPlunder();
  assert.deepEqual(h.log.given, [[n, h.boat]], 'into my boat nearest me, not the pack');
  // a full hold: what will not fit is said
  const s = await prize();
  s.deps.board.giveItems = (items) => ({ left: items });   // nothing fits
  const m = s.e.prize.hold.length;
  s.h.host.stowPlunder();
  assert.ok(s.h.log.say.includes(`${m} ${m === 1 ? 'thing' : 'things'} would not fit and ${m === 1 ? 'was' : 'were'} left behind.`), 'the leftovers said');
  // the switch off
  const t = await prize();
  t.h.log.given.length = 0;
  t.h.host.setEnabled(false);
  assert.equal(t.h.log.given.length, 1, 'stowed as the switch went off');
  assert.equal(t.e.prize.hold.length, 0);
});

test('AUDIT KEEP-BOATS D2: A BOAT KEPT IN A DUNGEON STANDS IN THE DUNGEON ALONE - inside a building on the same map pixel she is not stood (the mod shows an inside boat in any interior on its pixel, which its own default never met); in the dungeon she is (mutants: the dungeon unasked)', () => {
  const s = scene();
  const boat = s.place(1);
  boat.inside = true;
  const cur = s.deps.currentMapPixel();
  boat.MapPixel = { X: cur.X, Y: cur.Y };
  s.world.inside = true;
  let dungeon = false;
  s.deps.isPlayerInsideDungeon = () => dungeon;
  s.rt.UpdateBoatVisibility();
  assert.equal(boat.GameObject.activeSelf, false, 'a building: not stood');
  dungeon = true;
  s.rt.UpdateBoatVisibility();
  assert.equal(boat.GameObject.activeSelf, true, 'the dungeon: stood');
  dungeon = false;
  s.rt.UpdateBoatVisibilityOf(boat);
  assert.equal(boat.GameObject.activeSelf, false, 'the one boat\'s arm too');
});
