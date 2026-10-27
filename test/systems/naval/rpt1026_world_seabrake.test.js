// RPT1026-WORLD (2026-10-27), two private reports of a ship at the helm that would not make way - capped far under her
// speed after the sailing patch of 2026-10-23, and frozen in fights with pirates and beside the navy's cutters. Driven
// on the real naval host over Come Sail Away's real pool (test/navalSea.mjs): the host's three holds on my way - the
// grapples' haul (BOARD-MAGNET's `brake` and `wayScale`), her hurts, and the quay's warp - hold her only while their
// cause stands. A GUARD, not a fix: no hold was found left on after a fight or beside a cutter. bible/03-World/Naval-Refit.md
// BOARD-MAGNET, the record's RPT1026-WORLD paragraph.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sea } from '../../navalSea.mjs';
import { GRAPPLE_S, HAUL_MAX_S } from '../../../src/systems/naval/navalBoarding.js';
import { WRECKED_OARS } from '../../../src/systems/naval/navalDamage.js';

const WRECKED = { v: 1, boats: { 42: { hull: 0, sail: 0, crew: 24, fire: 0, state: 'wrecked', barrels: 4 } }, notoriety: {}, day: 1, raids: [] };
function place(h, classId, pos, yaw = 0) {
  const id = h.host.spawnShip(classId, { range: Math.hypot(pos[0], pos[2]), bearing: Math.atan2(pos[0], pos[2]), yaw });
  const e = h.host._sea.get(id);
  e.ship.pos = [...pos];
  h.host.frame(0.1);
  assert.ok(e.boat, 'built');
  return e;
}

test('RPT1026-WORLD guard: a pirate\'s grapples hold my way only while they haul - at most HAUL_MAX_S - and nothing of it is left once the fight is fought', async () => {
  const h = await sea({ hull: 2, save: WRECKED });
  place(h, 'pirateBrig', [16, 0, 0], 0);
  h.run(0.5);
  assert.equal(h.host.boarding?.kind, 'repel', 'boarded');
  const hauled = h.host.boarding.phase === 'grapple';
  if (hauled) assert.deepEqual([h.host.wayScale(true), h.host.wayScale(false)], [0, 0], 'the haul: nothing driving her on');
  h.run(Math.max(GRAPPLE_S, HAUL_MAX_S) + 0.2);
  assert.equal(h.host.boarding?.phase, 'fight', 'the haul is over by HAUL_MAX_S');
  h.runtime.sailing = true;   // back at my helm through the fight: she answers it
  assert.equal(h.host.brake(), 0, 'no brake past the haul');
  assert.equal(h.host.wayScale(false), WRECKED_OARS, 'her oars as her hurts allow');
  for (const f of h.log.foes) if (f.side === 'enemy') f.dead = true;
  h.run(0.5);
  assert.equal(h.host.boarding, null, 'the fight fought');
  h.runtime.sailing = true;
  assert.equal(h.host.brake(), 0);
  assert.equal(h.host.wayScale(false), WRECKED_OARS, 'her oars as before the fight');
});

test('RPT1026-WORLD guard: a navy cutter alongside fighting a pirate takes nothing of my way - no brake, no haul, no warp; what holds her is her own hurts alone', async () => {
  const h = await sea({ hull: 2, settings: { ShipsAtSea: 'off', Boarders: false } });
  const cutter = place(h, 'navyCutter', [14, 0, 0], 0);
  const pirate = place(h, 'pirateBrig', [70, 0, 30], Math.PI);
  h.run(3);
  assert.ok(h.host._sea.has(cutter.id) && h.host._sea.has(pirate.id), 'both at sea');
  // AUDIT RPT1026 J3: and at each other - the guard asked nothing of the fight it is named for, so a cutter that never
  // engaged would have passed it as well
  assert.deepEqual([cutter.ship.mode, cutter.ship.target, pirate.ship.mode, pirate.ship.target], ['engage', pirate.id, 'engage', cutter.id], 'the cutter and the pirate fight each other');
  assert.equal(h.host.boarding, null);
  assert.equal(h.host.brake(), 0, 'no brake');
  assert.equal(h.host.wayScale(false), 1, 'her oars whole');
  assert.ok(h.host.wayScale(true) >= 0.35, 'her canvas sets - her hurts (BARE_POLES at the least) and nothing else');
  assert.equal(h.host.warp?.(h.boat, { struck: false, oars: true, dt: 0.1 }) ?? null, null, 'no warp under sail and oars');
});
