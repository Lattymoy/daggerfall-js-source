// GALLEON-HOLDINGS (2026-10-04) - main's HOLDINGS (#549) on Mac's galleon, met at the merge of main into the Galleon arc.
// HER GANGWAY: QUAYS measured hull 2's off the mod's galleon (`[7.65, 4.14]`: her side 7.5 m out at her main deck's
// port, 4.14 m up), which left the new galleon's plank there - its head 2.3 m off her side, 2.6 m under her main deck,
// over the quay. Her own colliders read here (Come Sail Away's real pool, test/navalSea.mjs): the entry port in her
// waist's bulwark open from z -0.5 to 1.5 over 6.25 m, her side 5.33 m out under it, her main deck 6.20 m up.
// HER CARPENTER: HOLDINGS stands him to starboard of her hatch, and hers stands to port of her open fore hatchway.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sea, readyPool } from './navalSea.mjs';
import { Boat } from '../src/systems/comeSailAwayBoat.js';
import { raycastColliders, BUILTIN_COLLIDER_MESHES } from '../src/world/prefabColliders.js';
import { mainLevel, outOfDeck, intoDeck } from '../src/systems/naval/navalDeck.js';
import { HULL, setGalleonStanding } from '../src/systems/naval/navalShips.js';
import { GANGWAY_SIDE, MOD_SMALL_SHIP_GANGWAY, gangwaySide } from '../src/systems/naval/quays.js';
import { findHarbour, alongside } from '../src/systems/naval/shipLife.js';
import { createCrewLife } from '../src/systems/naval/crewLife.js';
import { MOBILE } from '../src/systems/naval/navalBoarding.js';
import { quatOfYaw } from '../src/systems/naval/navalAI.js';

/** The hulls a quay takes (quays.js DOCK_REFUSED: never the Large Galley). */
const DOCKERS = [HULL.Rowboat, HULL.LargeBoat, HULL.SmallShip, HULL.Carrack];
/** How far off her side a gangway's head may rest (m). */
const OFF_SIDE = 0.25;

/** `hull` stood alone at the origin out of the pool, and a ray at her colliders in her mesh's frame: the x where a ray
 *  in from 15 m out at `y`, `z` on `side` first meets her, or null. */
async function standing(hull) {
  const pool = await readyPool();
  pool.destroyAll();
  const boat = pool.spawnNow(Object.assign(new Boat(hull, 0), { uid: 42 }), { position: [0, 0, 0], rotation: [0, 0, 0, 1] });
  const geometry = (c) => (c.m_Mesh?.mesh ? pool.models?.geometry(c.m_Mesh.mesh) ?? null : c.m_Mesh?.builtin ? BUILTIN_COLLIDER_MESHES[c.m_Mesh.builtin] ?? null : null);
  const m = boat.MeshObject.worldMatrix();
  const main = mainLevel(pool.deckOf(hull, 0));
  const sideAt = (side, y, z) => {
    const o = outOfDeck(m, [side * 15, y, z]), to = outOfDeck(m, [0, y, z]);
    const d = [0, 1, 2].map((k) => to[k] - o[k]), L = Math.hypot(...d);
    const hit = raycastColliders(boat.GameObject, o, d.map((v) => v / L), 15, { triggers: false, geometry });
    return hit ? 15 - hit.distance : null;
  };
  return { pool, boat, main, sideAt, rail: (side) => pool.deckOf(hull, 0).rail(side, 0, [0, 0, 0], main) };
}

test('GALLEON-HOLDINGS: every docking hull\'s gangway meets her - its head no more than 0.25 m off her side at her main deck, a ship\'s half a metre over that deck (Mac\'s galleon\'s at 5.45 m out and 6.7 m up, where the mod\'s galleon\'s 7.65 and 4.14 left it 2.3 m off her)', async () => {
  const bad = [];
  for (const hull of DOCKERS) {
    const s = await standing(hull);
    const [sx, sy] = gangwaySide(hull);
    for (const side of [1, -1]) {
      // SHIPS-2: a boat whose gunwale stands well over her deck (Mac's Tiny Ship's, 1.35 m) takes the plank on her cap -
      // met at its own height, her side turned in there from her flare's widest (2.0 m out at her deck, 1.89 at her cap)
      const at = hull === HULL.LargeBoat ? sy - 0.05 : s.main + 0.05;
      const x = s.sideAt(side, at, 0);
      if (x == null || !(sx - x > 0 && sx - x <= OFF_SIDE)) bad.push(`hull ${hull} ${side > 0 ? 'starboard' : 'port'}: her side ${x?.toFixed(2)} m out, the head ${sx}`);
    }
    if (hull >= HULL.SmallShip && Math.abs(sy - s.main - 0.5) > 0.01) bad.push(`hull ${hull}: the head ${sy} over her main deck ${s.main.toFixed(3)}`);
  }
  assert.deepEqual(bad, []);
  assert.deepEqual([...GANGWAY_SIDE[HULL.SmallShip]], [5.45, 6.7]);
});

test('GALLEON-HOLDINGS: Mac\'s galleon\'s gangway rests in the entry port in her waist\'s bulwark - from her rail\'s cell out to her side nothing of her stands at its head\'s height across the plank\'s 0.9 m, where her bulwark stands either side of the port', async () => {
  const s = await standing(HULL.SmallShip);
  const [, sy] = gangwaySide(HULL.SmallShip);
  for (const side of [1, -1]) {
    const rail = Math.abs(s.rail(side)[0]);
    for (const z of [-0.45, 0, 0.45]) {
      const x = s.sideAt(side, sy, z);
      assert.ok(x == null || x < rail, `${side > 0 ? 'starboard' : 'port'} z ${z}: open to her rail at ${rail.toFixed(2)} (met at ${x?.toFixed(2)})`);
    }
    for (const z of [-1.5, 2.5]) assert.ok(Math.abs(s.sideAt(side, sy, z) - 5.33) < 0.05, `${side > 0 ? 'starboard' : 'port'} z ${z}: her bulwark beside the port`);
  }
});

test('GALLEON-HOLDINGS: the mod\'s own galleon keeps her own gangway while she stands in for Mac\'s (AUDIT GN-G4) - gangwaySide follows the build that stands, and the host lays the plank from it', async () => {
  assert.deepEqual([...MOD_SMALL_SHIP_GANGWAY], [7.65, 4.14]);
  assert.deepEqual(gangwaySide(HULL.SmallShip), GANGWAY_SIDE[HULL.SmallShip]);
  for (const hull of DOCKERS) assert.deepEqual(gangwaySide(hull), GANGWAY_SIDE[hull], `hull ${hull} standing`);
  // the host's plank, docked: its head where gangwaySide says, in her mesh's frame - for each build of hull 2
  const coast = (x, z) => !(z > 200 || (x > 300 && x < 400 && z > -300));
  const TOWN = { minX: -100, maxX: 100, minZ: 220, maxZ: 420 };
  assert.ok(findHarbour({ rect: TOWN, isWater: coast }));
  const heads = [];
  for (const galleon of [true, false]) {
    setGalleonStanding(galleon);
    try {
      if (!galleon) {
        assert.equal(gangwaySide(HULL.SmallShip), MOD_SMALL_SHIP_GANGWAY, 'fallen back: the mod\'s galleon\'s');
        assert.deepEqual(gangwaySide(HULL.Carrack), GANGWAY_SIDE[HULL.Carrack], 'the Carrack\'s her own');
      }
      const h = await sea({ hull: HULL.SmallShip, water: coast, settings: { ShipsAtSea: 'off' } });
      h.deps.harbourNear = () => ({ key: 'port:1', name: 'Sentinel', rect: TOWN });
      h.boat.GameObject.position = [5000, 0, 5000]; h.view.feet = [5000, 0, 5000];
      h.run(0.2);
      const harbour = h.host.harbourList()[0].harbour, b = harbour.berths[0], at = alongside(b, h.boat.hull, harbour.hull);
      h.boat.GameObject.position = [at[0], 0, at[1]]; h.boat.GameObject.rotation = quatOfYaw(b.yaw);
      h.runtime.sailing = false;
      const g = h.host.gangways()[0];
      assert.ok(g, `run out (${galleon ? 'hers' : 'the mod\'s'})`);
      const q = intoDeck(h.boat.MeshObject.worldMatrix(), g.head);
      heads.push([+Math.abs(q[0]).toFixed(6), +q[1].toFixed(6)]);
    } finally { setGalleonStanding(true); }
  }
  assert.deepEqual(heads, [[5.45, 6.7], [7.65, 4.14]]);
});

test('GALLEON-HOLDINGS: her Carpenter beside her hatch on her own deck - Mac\'s galleon\'s hatch stands to port of her open fore hatchway (AUDIT GN-D7), so he stands to port of it, facing it (asked in the hole, he stood across it 3.5 m off) - and Mac\'s carrack\'s, beside her mizzen\'s partner; every other hull\'s to starboard of it as HOLDINGS stood him', async () => {
  const pool = await readyPool();
  pool.destroyAll();
  const roster = Array.from({ length: 8 }, (_, i) => ({ mobile: [MOBILE.Warrior, MOBILE.Archer, MOBILE.Monk][i % 3], gender: i % 2 ? 'female' : 'male' }));
  const roles = ['First Mate', 'Gunner', 'Carpenter', 'Lookout', 'Cook', 'Gunner', 'Bosun', 'Bosun'];
  const bad = [];
  for (const hull of [HULL.LargeBoat, HULL.SmallShip, HULL.LargeGalley, HULL.Carrack]) {
    const deck = pool.deckOf(hull, 0);
    const life = createCrewLife({ deck, roster, seed: 3 });
    life.step(0.05, { roles, lookout: 3 });
    // PIN MOVED (SHIPS-2, 2026-10-07): Mac's carrack's hatch (her main deck's cell nearest its middle) stands beside her
    // mizzen's partner, to starboard of her deck there - her Carpenter to port of it, as the galleon's
    const h = life.hatch, c = life.postOf(2), port = hull === HULL.SmallShip || hull === HULL.Carrack;
    if (hull === HULL.Carrack) assert.ok(!deck.walkable(h[0] + 1.1, h[2]) && deck.walkable(h[0] - 1.1, h[2]), `the Carrack's hatch beside her mizzen's partner: ${h}`);
    const d = Math.hypot(c.at[0] - h[0], c.at[2] - h[2]);
    if (!deck.walkable(c.at[0], c.at[2]) || d > 1.2) bad.push(`hull ${hull}: ${d.toFixed(2)} m off her hatch`);
    if (Math.sign(c.at[0] - h[0]) !== (port ? -1 : 1)) bad.push(`hull ${hull}: to ${c.at[0] < h[0] ? 'port' : 'starboard'} of it`);
    if (c.face !== (port ? Math.PI / 2 : -Math.PI / 2)) bad.push(`hull ${hull}: facing ${c.face}`);
  }
  assert.deepEqual(bad, []);
});
