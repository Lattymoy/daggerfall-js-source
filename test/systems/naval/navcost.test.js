// NAV-COST (2026-10-12, an allocation profile of a player's live client walking the coast: the sea's captains were
// 12% of the main thread and some 29% of what it allocated; bible/07-Rendering/Performance-Priority.md NAV-COST) - THE
// SAME ANSWERS FOR LESS. A captain asks her sight before she asks whether a ship is her enemy, or whether it would
// take her (`hostile` sizes a quarry up) - never of a ship past it; and the hulls kept apart are measured only where
// they could touch: past twice their reaches hullOverlap answers null, and two that do stand in each other are still
// pushed apart.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSeaShip, stepCaptain, WIND_RATED } from '../../../src/systems/naval/navalAI.js';
import { flatHull, hullOverlap } from '../../../src/scenes/naval/navalHost.js';
import { seeded, sea } from '../../navalSea.mjs';

const world = (o = {}) => ({ now: 0, dt: 0.1, seaY: 0, wind: [0, 0, WIND_RATED], isWater: () => true, contacts: [], random: () => 0.5, ...o });
/** A ship contact whose sizing-up is counted - `faction` (is she my enemy) and `ship` (would she take me). */
function counted(id, pos, classId) {
  const s = createSeaShip({ id, seed: 3, classId, pos, yaw: 0, temper: 'bold' });
  const asked = { faction: 0, ship: 0 };
  const c = { id, kind: 'ship', pos, vel: [0, 0, 0], speed: 0, hull: s.hull };
  Object.defineProperty(c, 'faction', { get: () => { asked.faction++; return s.cls.faction; } });
  Object.defineProperty(c, 'ship', { get: () => { asked.ship++; return s; } });
  return { c, asked };
}

test('NAV-COST: a captain never sizes up a ship past her sight - one 400 km off is neither asked whether she is an enemy nor whether she would take her; one in sight is, and is fought', () => {
  for (const temper of ['bold', 'wary']) {
    const pirate = createSeaShip({ id: 'p', seed: 1, classId: 'pirateBrig', pos: [0, 0, 0], yaw: 0, temper });
    const far = counted('far', [400000, 0, 0], 'merchantCoaster');
    const navy = counted('navy', [0, 0, 300000], 'navyCutter');
    stepCaptain(pirate, world({ contacts: [far.c, navy.c] }));
    assert.deepEqual(far.asked, { faction: 0, ship: 0 }, `${temper}: the far merchantman never sized up`);
    assert.deepEqual(navy.asked, { faction: 0, ship: 0 }, `${temper}: nor the far cutter`);
  }
  const pirate = createSeaShip({ id: 'p', seed: 1, classId: 'pirateBrig', pos: [0, 0, 0], yaw: 0, temper: 'bold' });
  const prey = counted('prey', [0, 0, 300], 'merchantCoaster');
  stepCaptain(pirate, world({ contacts: [prey.c] }));
  assert.ok(prey.asked.faction > 0, 'one in sight is asked');
  assert.equal(pirate.target, 'prey', 'and a bold pirate goes for her');
  const navy = createSeaShip({ id: 'n', seed: 1, classId: 'merchantCoaster', pos: [0, 0, 0], yaw: 0 });
  const threat = counted('pirate', [0, 0, 250], 'pirateBrig');
  stepCaptain(navy, world({ contacts: [threat.c] }));
  assert.ok(threat.asked.ship > 0, 'a pirate in reach is asked whether she would take a merchantman');
});

test('NAV-COST: past twice their reaches two hulls never overlap - any hull, any heading, just past the line (hullOverlap answers null)', () => {
  const rnd = seeded(7);
  for (let i = 0; i < 20000; i++) {
    const ha = 1 + Math.floor(rnd() * 5), hb = 1 + Math.floor(rnd() * 5);
    const A = flatHull([0, 0, 0], rnd() * 6.3, ha);
    const reach = 2 * (A.hl + A.hw + flatHull([0, 0, 0], 0, hb).hl + flatHull([0, 0, 0], 0, hb).hw);
    const ang = rnd() * 6.3, d = reach * (1 + rnd() * 0.01) + 1e-6;
    const B = flatHull([A.c[0] + Math.sin(ang) * d, 0, A.c[1] + Math.cos(ang) * d], rnd() * 6.3, hb);
    const dx = B.c[0] - A.c[0], dz = B.c[1] - A.c[1];
    if (dx * dx + dz * dz <= reach * reach) continue;
    assert.equal(hullOverlap(A, B), null, `hulls ${ha}/${hb} ${Math.sqrt(dx * dx + dz * dz).toFixed(1)} m apart`);
  }
});

test('NAV-COST: two ships of mine standing in each other are still pushed apart', async () => {
  const h = await sea({ hull: null, water: (x, z) => Math.hypot(x, z) > 30 });
  const a = h.host._sea.get(h.host.spawnShip('merchantGalleon', { range: 900, bearing: 0, yaw: 0 }));
  const b = h.host._sea.get(h.host.spawnShip('merchantGalleon', { range: 904, bearing: 0, yaw: 0 }));
  const gap0 = Math.hypot(a.ship.pos[0] - b.ship.pos[0], a.ship.pos[2] - b.ship.pos[2]);
  h.run(0.1, 0.05);
  const gap = Math.hypot(a.ship.pos[0] - b.ship.pos[0], a.ship.pos[2] - b.ship.pos[2]);
  assert.ok(gap > gap0 + 1, `pushed apart: ${gap0.toFixed(1)} -> ${gap.toFixed(1)} m`);
});

test('NAV-COST: three ships of mine in a heap are pushed where the old pass put them - a hull shoved is measured again where it went', async () => {
  const h = await sea({ hull: null, water: (x, z) => Math.hypot(x, z) > 30 });
  const ids = [900, 903, 905.5].map((r, i) => h.host.spawnShip('merchantGalleon', { range: r, bearing: 0.002 * i, yaw: 0.3 * i }));
  const ships = ids.map((id) => h.host._sea.get(id).ship);
  // the old pass, restated: every pair measured from where each stands NOW (two new flats a pair)
  const want = ships.map((s) => [...s.pos]);
  for (let i = 0; i < ships.length; i++) {
    for (let j = i + 1; j < ships.length; j++) {
      const push = hullOverlap(flatHull(want[i], ships[i].yaw, ships[i].hull), flatHull(want[j], ships[j].yaw, ships[j].hull));
      if (!push) continue;
      want[i][0] += push[0] / 2; want[i][2] += push[1] / 2; want[j][0] -= push[0] / 2; want[j][2] -= push[1] / 2;
    }
  }
  h.run(1e-6, 1e-6);
  for (let i = 0; i < ships.length; i++) {
    assert.ok(Math.hypot(ships[i].pos[0] - want[i][0], ships[i].pos[2] - want[i][2]) < 1e-3, `ship ${i} where the old pass put her`);
  }
  assert.ok(Math.hypot(want[2][0] - 0, want[2][2] - 905.5) > 0.5, 'the heap did move');
});
