// AUDIT LW-III (bible/01-Overview/audits/Audit-LivingWorld-III.md, "The deep"): ONE PILE A BODY - the deep's remains tagged with
// their key, kept through a save made inside and adopted on the load, never laid again beside it (deepRemains.js
// `pileOf`, dungeonContext.js `layRemains` / `remainsPile`, droppedLoot.js restorePiles); THE DIVERS' ELECTION ASKED EACH
// FRAME - a reader that loses it gives its companies up (dungeonDivers.js, the outlaws' AUDIT LW-II-2 C13); the way out
// walked at the door's own floor (world.js livingDeepRoute / livingDeepCleared). Pure and synthetic: no game data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDeepRemains } from '../../src/scenes/livingWorld/deepRemains.js';
import { createDroppedLoot } from '../../src/scenes/droppedLoot.js';
import { createRelations } from '../../src/systems/livingWorld/relations.js';
import { createDungeonDivers } from '../../src/scenes/dungeonDivers.js';
import { amGroupRollOwner } from '../../src/systems/campEncounters.js';
import { routeOf } from '../../src/systems/livingWorld/deepRoute.js';

const lootDeps = () => ({ renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {} }, getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }), uploadRecordFrame: () => {}, pick: () => 0 });

test('AUDIT LW-III ONE PILE A BODY: remains laid before a save made inside ride it with their key, and the load\'s pile is theirs - adopted, never a second laid beside it; taken from, spent (mutants: the adoption, the key saved, the key restored)', () => {
  const rel = createRelations();
  let loot = createDroppedLoot(lootDeps());
  const r = { key: 'deep:R1:T1', res: { id: 'R1', name: 'Ada Lark' }, trip: { id: 'T1', fallen: [] }, t: 100 };
  const src = readFileSync(new URL('../../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
  // the dungeon's own doors (dungeonContext.js layRemains / remainsPile), over its droppedLoot
  const d = {
    layRemains: (items, feet, icon, key = null) => { const p = loot.dropPile(items, feet, null, icon); if (p && key) p.remainsKey = key; return p; },
    remainsPile: (key) => loot._piles.find((p) => p.remainsKey === key && !p.dead) ?? null,
  };
  assert.match(src, /layRemains: \(items, feet, icon, key = null\) => \{ const p = droppedLoot\.dropPile\(items, feet, null, icon\); if \(p && key\) p\.remainsKey = key; return p; \},/);
  assert.match(src, /remainsPile: \(key\) => droppedLoot\._piles\.find\(\(p\) => p\.remainsKey === key && !p\.dead\) \?\? null,/);
  assert.match(src, /\.\.\.\(p\.remainsKey \? \{ remainsKey: p\.remainsKey \} : \{\}\),/, 'the save\'s row keeps the key');
  const rem = createDeepRemains({
    spots: () => [], laid: (k) => rel.turns().laid.has(k), mark: (k) => rel.turn('laid', k),
    lay: (res, feet, key) => d.layRemains([{ name: 'sword' }, { name: `${res.name}'s locket` }], feet, { archive: 380, record: 1 }, key),
    pileOf: (key) => d.remainsPile(key),
    there: (feet) => loot._piles.some((p) => !p.dead && p.items.length && Math.hypot(p.pos[0] - feet[0], p.pos[2] - feet[2]) <= 0.6),
    count: (p) => p.items.length, feet: () => [0, 0, 0], say: () => {}, townName: () => '', placeOf: () => [40, 0, 40],
  });
  rem.frame([r]);
  assert.equal(loot._piles.length, 1, 'laid on the way in');
  // the save made inside (dungeonContext.js collectWorld's row), the load (a fresh dungeon's restorePiles), the door's clear
  const saved = loot._piles.map((p) => ({ pos: [...p.pos], archive: p.archive, record: p.record, items: p.items.map((it) => ({ ...it })), ...(p.remainsKey ? { remainsKey: p.remainsKey } : {}) }));
  loot = createDroppedLoot(lootDeps());
  loot.restorePiles(saved);
  assert.equal(loot._piles[0].remainsKey, r.key, 'restored with its key');
  rem.clear();
  rem.frame([r]);
  assert.equal(loot._piles.length, 1, 'after the load: one pile, theirs');
  loot._piles[0].items.length = 0;
  rem.frame([r]);
  assert.equal(rel.turns().laid.has(r.key), true, 'the restored pile taken from: spent');
});

test('AUDIT LW-III THE DIVERS\' ELECTION ASKED EACH FRAME: a reader that loses it gives its companies up (none drawing on it), so a company stands once in the room whoever meets it next (mutants: the give-up, the asked once)', async () => {
  const stops = [{ key: '0:1', kind: 'foe', x: 20, y: 0, z: 0, block: 0, loadID: 1 }, { key: '0:2', kind: 'treasure', x: 40, y: 0, z: 0, block: 0, loadID: 2 }];
  const members = [{ id: 'm1', cls: 140, name: 'Ada Lark', level: 3 }, { id: 'm2', cls: 128, name: 'Bram Holt', level: 2 }];
  const trip = { id: 'T1', leader: members[0], party: members, dive: { t0: 0, t1: 600 }, backT0: 600, to: { name: 'Mournoth' } };
  const route = routeOf(stops, { x: 0, z: 0 }, trip);
  const feet = { a: [300, 0, 0], b: [22, 0, 0] };
  const room = [];
  const layer = (me, other) => createDungeonDivers({
    spawn: async (cls, f) => { const rec = { by: me, cls, ai: { feet: [...f] }, entity: { health: 40, maxHealth: 40 } }; room.push(rec); return rec; },
    remove: (rec) => room.splice(room.indexOf(rec), 1), inPool: (rec) => room.includes(rec),
    leader: () => ({ feet: feet[me], yaw: 0 }), spot: (f, dx, dz) => [f[0] + dx, f[1], f[2] + dz],
    owner: () => amGroupRollOwner(me, feet[me], [{ id: other, feet: feet[other] }], 200),
    relations: () => ({ standing: () => 'neutral', note: () => {}, turn: () => {} }), turnKeyOf: (x) => x.id, dies: () => false, day: () => 0,
    route: () => route, say: () => {},
  });
  const A = layer('a', 'b'), B = layer('b', 'a');
  const tick = async (t) => { A.frame([{ trip, members }], t); B.frame([{ trip, members }], t); await new Promise((res) => setTimeout(res, 1)); };
  await tick(30);
  assert.deepEqual(room.map((x) => x.by), ['b', 'b'], 'B alone: B stands it');
  feet.a = [150, 0, 0];
  await tick(31);
  assert.equal(B.size, 0, 'A elected: B gives it up');
  feet.a = [24, 0, 2];
  await tick(32);
  assert.deepEqual(room.map((x) => x.by), ['a', 'a'], 'stood once, by A');
});

test('AUDIT LW-III the way out at the door\'s own floor: both hosts of the dive\'s route hand the entry\'s y (deepRoute.js yOf) - the last leg was walked at the first stop\'s (mutants: each host)', () => {
  const w = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /r = deepRouteOf\(stops, e \? \{ x: e\.x, y: e\.y, z: e\.z \} : \{ x: stops\[0\]\.x, z: stops\[0\]\.z \}, trip\);/);
  assert.match(w, /const from = entry \? \{ x: entry\.x, y: entry\.y, z: entry\.z \} : \{ x: stops\[0\]\.x, z: stops\[0\]\.z \};/);
  const r = routeOf([{ key: '0:1', kind: 'foe', x: 20, y: -6, z: 0, block: 0, loadID: 1 }], { x: 0, y: 2, z: 0 }, { id: 'T1', dive: { t0: 0, t1: 600 } });
  assert.equal(r?.out.path.at(-1).y, 2, 'the way out ends on the door\'s floor');
});
