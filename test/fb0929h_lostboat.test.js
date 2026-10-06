// FIELD BUGS 2026-09-29h (LOST-BOAT) - "Boat Noises at Kinging Court: it seems that my previous attempts at spawning in
// large boat deeds (before today's patch) may have left the large boats floating underneath the town. When i travel to
// the town i can hear very loud boat noises but no boats to be seen. two of them are layered over one another so it's
// probably two boats. They'll likely need to be de-spawned somehow."
//
// FIELD-CSA1 closed four ways a placed boat was lost (the seabed; far out; a respawn's frame - "it stood by the temple
// its owner woke at, under the ground"; a recentre out of sight) for boats placed from then on. A boat lost before it is
// in its owner's save where it stood, and the load restores it there (ComeSailAwaySaveData, verbatim): its loops play
// whenever its pixel is near, and a Large Boat's deed was spent placing it. The port gives such a boat back: once the
// ground under it is built, a hull standing under the ground or under the sea is packed into its parts (the mod's own
// PackBoat) - unless it is crewed, whose deed still calls it to a port.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { comeSailAwayModels } from '../src/systems/comeSailAwayModels.js';
import { spawnBoat } from '../src/systems/comeSailAwayBoat.js';
import { createComeSailAwayRuntime, NO_WATER_LEVEL, BOAT_PARTS_TEMPLATE, BOAT_DEED_TEMPLATE, LOST_UNDER_M } from '../src/systems/comeSailAway.js';

const DIR = new URL('../vendor/come-sail-away/Models/', import.meta.url);
const json = (f) => JSON.parse(readFileSync(new URL(f, DIR), 'utf8'));
const MODELS = comeSailAwayModels({ prefabs: json('prefabs.json'), meshes: json('meshes.json'), bin: new Uint8Array(readFileSync(new URL('meshes.bin', DIR))), materials: json('materials.json'), animation: json('animation.json') });
const ctxFor = (player) => ({ models: MODELS, player: () => player, billboardSize: () => [0.8, 1.6], modelBounds: () => ({ min: [-1, 0, -1], max: [1, 1, 1] }) });

/** A built pixel as the host hands it (world.js csaTerrainOf): its corner, a TileMap, a SampleHeight over its own y. */
function terrain(x, y, height, up = 0) {
  return { mapPixelX: x, mapPixelY: y, position: [(x - 10) * 819.2, up, -(y - 20) * 819.2], tileMap: new Uint8Array(128 * 128), sampleHeight: typeof height === 'function' ? height : () => height };
}
function scene({ terrains, inside = false, compensation = [0, 0, 0], held = [] } = {}) {
  const out = { hud: [], removed: [], pack: [] };
  const player = { position: [1, 36, 3], rotation: [0, 0, 0, 1] };
  const deps = {
    pool: { models: MODELS, ready: () => true, spawnNow: (boat, p) => { spawnBoat(boat, ctxFor(p)); return boat; }, remove: (b) => { out.removed.push(b); } },
    player: () => player,
    camera: () => ({ position: [0, 50, 0], forward: [0, -1, 0] }),
    currentMapPixel: () => ({ X: 10, Y: 20 }),
    isPlayerInside: () => inside,
    blockWaterLevel: () => NO_WATER_LEVEL,
    iliacPuddleNoMore: () => false,
    raycast: () => null,
    playerTerrain: () => terrains.find((t) => t.mapPixelX === 10 && t.mapPixelY === 20) ?? null,
    terrainAt: (x, y) => terrains.find((t) => t.mapPixelX === x && t.mapPixelY === y) ?? null,
    terrains: () => terrains,
    heightMapValue: () => 255,
    worldCompensation: () => compensation,
    hudText: (t) => out.hud.push(t),
    midScreenText: () => {},
    log: () => {},
    random: { range: (min) => min },
    time: () => 0,
    persistentDungeonBoats: () => false,
    packedItems: { serialize: (items) => items.map((it) => ({ ...it })), deserialize: (records) => records.map((it) => ({ ...it })) },
    items: { create: (template) => ({ template, UID: 900 + out.pack.length }), addToPlayer: (it) => out.pack.push(it), player: () => held },
    cargoWeight: () => 0,
  };
  return { rt: createComeSailAwayRuntime(deps), out };
}
/** A boat as ComeSailAwaySaveData keeps it. Hull 1 is the Large Boat (no crew: its deed is spent placing it), 2 the
 *  Small Ship (crewed: its deed stays). */
const saved = (hull, x, y, z, over = {}) => ({ UID: 40 + hull, Hull: hull, Variant: 0, MapPixel: { X: 10, Y: 20 }, Position: { x, y, z }, Direction: { x: 0, y: 0, z: 1 }, Items: [], lights: false, inside: false, ...over });
const restore = (rt, boats) => rt.restoreSaveData({ ...rt.newSaveData(), placedBoats: boats });

test('LOST-BOAT: two Large Boats restored under the town are given back as their parts - the report (mutant: the ground never asked)', () => {
  // the town's pixel: its ground stands at 52 m; the save put both boats at the sea's 34 under it, one over the other
  const s = scene({ terrains: [terrain(10, 20, 52)] });
  restore(s.rt, [saved(1, 300, 34, 400), saved(1, 300, 34, 400)]);
  assert.equal(s.rt.AllBoats.length, 2);
  s.rt.update();
  assert.equal(s.rt.AllBoats.length, 0, 'no boat left singing under the town');
  assert.equal(s.out.removed.length, 2);
  assert.deepEqual(s.out.pack.map((it) => it.template), [BOAT_PARTS_TEMPLATE, BOAT_PARTS_TEMPLATE], 'the parts of each, to place again');
  assert.equal(s.out.hud.filter((t) => t === 'A boat of yours was lost where no one could reach it').length, 2);
  assert.ok(s.out.hud.includes('You store the boat in your inventory'), 'the mod\'s own PackBoat line');
});

test('LOST-BOAT: a boat afloat stays, a crewed hull stays (its deed calls it), a boat on the seabed is lost too; asked once, and only when its ground is built', () => {
  // the sea: ground at 33.99 (the node law's line), a boat at 34 on it
  const sea = scene({ terrains: [terrain(10, 20, 33.99)] });
  restore(sea.rt, [saved(1, 100, 34, 100)]);
  sea.rt.update();
  assert.equal(sea.rt.AllBoats.length, 1, 'afloat: kept');
  // a shelving beach: ground just under the boat's allowance
  const beach = scene({ terrains: [terrain(10, 20, 34 + LOST_UNDER_M)] });
  restore(beach.rt, [saved(1, 100, 34, 100)]);
  beach.rt.update();
  assert.equal(beach.rt.AllBoats.length, 1, 'a keel on a beach is no lost boat');
  // a Small Ship under the ground: her deed repositions her at a port (useBoatDeed) - never packed into parts too. Her
  // deed in the pack, as a deed ship's is (SHIP-PACK): with none PackBoat itself refuses her, and could not tell the skip
  const deed = { templateIndex: BOAT_DEED_TEMPLATE, UID: 42 }, held = [deed];
  const crewed = scene({ terrains: [terrain(10, 20, 60)], held });
  restore(crewed.rt, [saved(2, 100, 34, 100)]);
  crewed.rt.update();
  assert.equal(crewed.rt.AllBoats.length, 1, 'crewed: kept');
  assert.deepEqual(crewed.out.pack, []);
  assert.deepEqual(held, [deed], 'her deed still in the pack');
  assert.deepEqual([crewed.out.hud, crewed.rt.AllBoats[0]?.groundAsked], [[], true], 'asked, and nothing said of a lost boat');
  // the seabed: FIELD-CSA1's first way - a boat stood on the floor 14 m under the sea's top
  const bed = scene({ terrains: [terrain(10, 20, 20)] });
  restore(bed.rt, [saved(1, 100, 20, 100)]);
  bed.rt.update();
  assert.equal(bed.rt.AllBoats.length, 0, 'under the sea: lost, and given back');
  // its ground not built yet: nothing decided; built later, asked then - and a boat asked is never asked again
  const terrains = [terrain(10, 20, 33.99)];
  const late = scene({ terrains });
  restore(late.rt, [saved(1, 900, 34, 100)]);   // x 900: the pixel east of the player's, not built
  late.rt.update();
  assert.equal(late.rt.AllBoats.length, 1, 'no ground to ask');
  terrains.push(terrain(11, 20, 70));
  late.rt.update();
  assert.equal(late.rt.AllBoats.length, 0, 'its pixel built: under the ground, given back');
  // the pixel's row runs against the scene's z (map y grows southward): a boat at z -400 stands on the row after the
  // player's, whose ground is the town's - never the row before, which is sea
  const row = scene({ terrains: [terrain(10, 20, 33.99), terrain(10, 21, 60), terrain(10, 19, 33.99)] });
  restore(row.rt, [saved(1, 100, 34, -400)]);
  row.rt.update();
  assert.equal(row.rt.AllBoats.length, 0, 'the row south of the player\'s: under the town');
  // after a recentre that moved the world 20 m down: the sea's top and every terrain stand in the scene 20 m lower, and
  // a boat afloat there is afloat - the ground is the terrain's own y and its height over it (Terrain.SampleHeight)
  const low = scene({ terrains: [terrain(10, 20, 33.99, -20)], compensation: [0, -20, 0] });
  restore(low.rt, [saved(1, 100, 34, 100)]);   // saved at the sea's 34 under a compensation of nought: restored at 14
  low.rt.update();
  assert.equal(low.rt.AllBoats.length, 1, 'afloat on a recentred sea: kept');
  const once = scene({ terrains: [terrain(10, 20, 33.99)] });
  restore(once.rt, [saved(1, 100, 34, 100)]);
  once.rt.update();
  once.rt.AllBoats[0].GameObject.position = [100, -50, 100];   // stood somewhere else afterwards: not the port's to judge again
  once.rt.update();
  assert.equal(once.rt.AllBoats.length, 1, 'asked once');
});

test('LOST-BOAT: never indoors, never a boat placed inside, never the one being sailed', () => {
  const inside = scene({ terrains: [terrain(10, 20, 60)], inside: true });
  restore(inside.rt, [saved(1, 100, 34, 100)]);
  inside.rt.update();
  assert.equal(inside.rt.AllBoats.length, 1, 'the player indoors: nothing asked');
  const placedInside = scene({ terrains: [terrain(10, 20, 60)] });
  restore(placedInside.rt, [saved(1, 100, 34, 100, { inside: true })]);
  placedInside.rt.update();
  assert.deepEqual([placedInside.rt.AllBoats.length, placedInside.out.pack.length], [1, 0], 'a dungeon\'s boat stands on its own water');
  const helm = scene({ terrains: [terrain(10, 20, 60)] });
  restore(helm.rt, [saved(1, 100, 34, 100)]);
  helm.rt.state.CurrentBoat = helm.rt.AllBoats[0];   // hers - the helm's own law carries her (disembarking: no sailing frame here)
  helm.rt.state.disembarking = {};
  helm.rt.update();
  assert.equal(helm.rt.AllBoats.length, 1, 'the boat under the player is never judged from under them');
});
