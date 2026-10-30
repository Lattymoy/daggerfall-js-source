// AUDIT-STOREFRONT III D6 (bible/06-Systems/Aurum.md section 3a): A CACHE DUNGEON AS THE GAME BUILDS IT ONLINE, in Node
// over the freeware - for the probe (tools/aurumCacheProbe.mjs) and the real-data pins (test/scenes/aurum_cache_world.test.js).
// The treasure piles as scenes/dungeonContext.js stands them (the room's icon roll, a random pile landed on its floor, a
// fixed one centred, each sized from the archive), the host's collider (tools/dungeonFireProbe.mjs), and what a coffer's
// box meets: a pile's box, a door's, a mover's.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { layoutDungeon } from '../src/world/dungeon/dungeonLayout.js';
import { floorLanding } from '../src/player/enterExit.js';
import { RANDOM_TREASURE_MARKER_RECORD } from '../src/systems/loot/loot.js';
import { RANDOM_TREASURE_ARCHIVE, RANDOM_TREASURE_ICONS } from '../src/systems/loot/lootDataTables.js';
import { seededRolls } from '../src/systems/roomLoot.js';
import { TextureFile, texName } from '../src/formats/textureFile.js';
import { billboardSize, classicBillboardSize } from '../src/world/rmbFlats.js';
import { aurumCofferBox, aurumPileBox } from '../src/scenes/aurumCacheHost.js';
import { installWorldDataReplacement, bindWorldDataBlocks } from '../src/formats/worldData/worldDataReplacement.js';
import { installCuratedBlocks } from '../src/world/dungeon/curatedInstall.js';
import { hostFireCollider } from './dungeonFireProbe.mjs';

/** The world-data door as the game opens it for a dungeon (scenes/modWorldData.js loadModWorldData): the port's own
 *  blocks, among them DELVE II's curated ones, which an online layout may name. Once. */
let _door = false;
export function openBlockDoor(/** @type {any} */ blocksFile) {
  if (_door) return;
  _door = true;
  installWorldDataReplacement();
  bindWorldDataBlocks(blocksFile);
  installCuratedBlocks();
}

/** The treasure archive's file off the freeware. */
export function treasureTexture(/** @type {string} */ arena2) {
  const tex = new TextureFile();
  tex.load(new Uint8Array(readFileSync(join(arena2, texName(RANDOM_TREASURE_ARCHIVE)))), texName(RANDOM_TREASURE_ARCHIVE));
  return tex;
}

/** The piles in the build's order, as dungeonContext.js's marker loop and billboard loop leave them online. */
export function cachePiles(/** @type {any} */ loc, /** @type {any[]} */ blocks, /** @type {any} */ collider, /** @type {any} */ tex) {
  const piles = [];
  for (const b of blocks) {
    for (const m of b.layout.markers) {
      const isRandom = !m.archive && m.record === RANDOM_TREASURE_MARKER_RECORD, isFixed = m.archive === RANDOM_TREASURE_ARCHIVE;
      if (!isRandom && !isFixed) continue;
      const roll = seededRolls(`dungeon:${loc?.dungeon?.recordElement?.header?.locationId ?? 'probe'}|loot:${piles.length}|icon`);
      const record = isFixed ? m.record : RANDOM_TREASURE_ICONS[Math.floor(roll() * RANDOM_TREASURE_ICONS.length)];
      const pile = /** @type {any} */ ({ pos: [m.x + b.originX, m.y, m.z + b.originZ], record, isFixed });
      piles.push(pile);
      if (record >= tex.recordCount) continue;
      const size = billboardSize(tex, record), law = classicBillboardSize(tex, record);
      [pile.half, pile.lawHalf] = [[size.w / 2, size.h / 2], [law.w / 2, law.h / 2]];
      pile.pos = isFixed ? [pile.pos[0], pile.pos[1] - size.h / 2, pile.pos[2]] : floorLanding(collider, [pile.pos[0], pile.pos[1] + 0.2, pile.pos[2]]);
    }
  }
  return piles;
}

/** A dungeon location laid out as the context lays it: `{ d, col, piles }`. */
export function cacheDungeon(/** @type {any} */ loc, /** @type {any} */ blocksFile, /** @type {any} */ getModel, /** @type {any} */ tex) {
  openBlockDoor(blocksFile);
  const d = layoutDungeon(loc, blocksFile, getModel), col = hostFireCollider(d.blocks, getModel);
  return { d, col, piles: cachePiles(loc, d.blocks, col, tex) };
}

const meets = (/** @type {any} */ a, /** @type {any} */ b) => [0, 1, 2].every((k) => a.min[k] < b.max[k] && b.min[k] < a.max[k]);
/** What the coffer's box on `foot` meets - `loot:<i>` for a pile's box, a bucket's key for a door's or a mover's, `on
 *  loot:<i>` for a pile's own foot. Empty where it stands clear. */
export function cofferMeets(/** @type {number[]} */ foot, /** @type {any[]} */ piles, /** @type {any} */ collider) {
  const box = aurumCofferBox(foot), out = [];
  piles.forEach((p, i) => {
    if (Math.hypot(p.pos[0] - foot[0], p.pos[2] - foot[2]) < 1e-6) out.push(`on loot:${i}`);
    if (p.lawHalf && meets(box, aurumPileBox(p))) out.push(`loot:${i}`);
  });
  for (const b of collider.bucketBoxes({ skip: ['dungeon'] })) if (meets(box, b)) out.push(b.key);
  return out;
}
