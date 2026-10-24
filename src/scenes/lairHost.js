// @ts-check
// LAIR-DOOR (FIELD BUGS 2026-10-22d, bible/01-Overview/bugs/Field-Bugs-2026-10-22d.md report 4 - fogs on Zenako's behalf:
// "the Revenant lair designated on the Revenants page is inaccessible -- there are no interactable doors, hatches or
// openings to the marked dungeon ... The Stuvam Graveyard, south of Ceriburea ... approximate coordinates 565, 427"):
// WHERE A REVENANT MAY GO TO GROUND - the world host's `lairHere` door (systems/playerDoor.js, RVN7 bible/12-Enhanced-AI/
// Feud-Arc.md 18.1), out of bootWorld (HOST-SPLIT).
//
// A lair is one of the game's own dungeons in the bounty boards' ring about a map pixel (systems/bounty/bountyBoard.js
// bountyDungeons over the host's index of MAPS.BSA rows with `hasDungeon`) - and a dungeon is only a lair if the player
// can go in. Twenty-eight of the 774 graveyards MAPS.BSA flags with a dungeon lay a single block, GRVEAS10.RMB or
// GRVEAS36.RMB, that places no model with a dungeon-entrance door (DFU's door law, world/meshReader.js subMeshDoorType:
// archive 56, or 331 past its stone record) - The Stuvam Graveyard is one, its one block GRVEAS36 - so in this game, as
// in DFU (a door is how PlayerEnterExit goes down), nobody enters them. Every one of the 3,455 labyrinths, keeps and
// ruins places its door. ENTERABLE is that measured on the place itself: its blocks laid as the pixel build lays them
// (world/locationLayout.js), and a door on any of their models (systems/travel/travelDungeonModels.js
// meshHasDungeonEntrance, the Overworld's dungeon models' own test). A place the host cannot lay, or whose models the
// player's ARCH3D does not carry, is not judged - it stays a lair, as it always was.
//
// The answer is kept a pixel (and a model's, a model id), so a ring is laid once a session; nothing of a mesh is kept.
//
// Not a DFU member: revenants are the port's own (bible/12-Enhanced-AI/Feud-Arc.md 18.1, LAIR-DOOR).
import { bountyDungeons } from '../systems/bounty/bountyBoard.js';
import { RUMOR_PX } from '../systems/revenant/revenantFeud.js';
import { meshHasDungeonEntrance } from '../systems/travel/travelDungeonModels.js';
import { layoutLocation } from '../world/locationLayout.js';
import { isEnhanced } from '../systems/uiSkin.js';

/**
 * Whether laid blocks place a dungeon-entrance door: `entranceOf(modelIdNum)` answers true, false, or null where the
 * model's mesh is not to be had. True on the first door; false when every model was read and none is a door; null when
 * none is a door but a model could not be read (not judged). An enhanced-only model stands only on the enhanced skin,
 * as the pixel build stands it. Pure.
 * @param {ReadonlyArray<{ layout?: { models?: ReadonlyArray<{ modelIdNum: number, enhancedOnly?: boolean }> } }>} blocks
 * @param {(id: number) => boolean | null} entranceOf
 * @param {boolean} [enhanced]
 * @returns {boolean | null}
 */
export function blocksPlaceEntrance(blocks, entranceOf, enhanced = false) {
  let unread = false;
  for (const b of blocks ?? []) {
    for (const m of b?.layout?.models ?? []) {
      if (m.enhancedOnly && !enhanced) continue;
      const e = entranceOf(m.modelIdNum);
      if (e === true) return true;
      if (e == null) unread = true;
    }
  }
  return unread ? null : false;
}

/** How far from a lair nobody can enter its revenant goes to ground instead (map pixels, the larger axis): a rumour's
 *  reach (revenantFeud.js RUMOR_PX) - the towns that told of the old lair tell of the new. The Stuvam Graveyard's ring
 *  (4-10 px) holds no other dungeon at all; its nearest, Morarker's Nest, is 14 px south. */
export const LAIR_MEND_PX = RUMOR_PX;

/**
 * THE DOOR - `lairHere(at)` answers the host's word on a map pixel (`at`, else the player's - `here()`) for a revenant's
 * lair: `{ px, py, dungeons, enterable, nearest }` - the enterable dungeons in the ring about it, each with its region;
 * the test itself (a kept lair is asked it: systems/revenant/revenantFeud.js lairAfter, systems/revenant/revenant.js
 * mendRevenantLairs); and `nearest(px, py)`, the enterable dungeon nearest that pixel within LAIR_MEND_PX (not the pixel
 * itself), or null - where the mend moves a lair nobody can enter. The host's own index, by `x,y` key: `locations` its
 * locations (the world data door's), `dungeons` the game's own dungeons' names, `regions` their regions.
 * @param {{ maps: any, blocks: any, arch: { getRecordIndex: (id: number) => number, getMesh: (i: number) => any },
 *   locations: Map<string, any>, dungeons: Map<string, string>, regions: Map<string, number>, here: () => { x: number, y: number },
 *   enhanced?: () => boolean, layout?: typeof layoutLocation }} deps
 */
export function createLairDoor({ maps, blocks, arch, locations, dungeons, regions, here, enhanced = isEnhanced, layout = layoutLocation }) {
  const locationAt = (x, y) => locations.get(`${x},${y}`) ?? null;
  const dungeonAt = (x, y) => dungeons.get(`${x},${y}`) || null;
  const regionAt = (x, y) => regions.get(`${x},${y}`) ?? -1;
  /** @type {Map<number, boolean | null>} a model's door, by id */
  const byModel = new Map();
  /** @type {Map<string, boolean>} a place's, by skin and pixel */
  const byPixel = new Map();
  const entranceOf = (id) => {
    if (byModel.has(id)) return /** @type {boolean | null} */ (byModel.get(id));
    let v = null;
    try { const i = arch.getRecordIndex(id); const mesh = i === -1 ? null : arch.getMesh(i); v = mesh ? meshHasDungeonEntrance(mesh) : null; } catch { v = null; }
    byModel.set(id, v);
    return v;
  };
  /** Can the player go down into the place at map pixel (`px`, `py`)? Not judged - true. */
  const enterable = (px, py) => {
    const en = !!enhanced();
    const key = `${en ? 1 : 0}:${px},${py}`;
    const kept = byPixel.get(key);
    if (kept !== undefined) return kept;
    let v = true;
    try {
      const loc = locationAt(px, py);
      if (loc?.exterior?.exteriorData) v = blocksPlaceEntrance(layout(loc, maps, blocks, { enhanced: en, windmills: false }).blocks, entranceOf, en) !== false;
    } catch { v = true; }
    byPixel.set(key, v);
    return v;
  };
  const nearest = (px, py) => {
    let best = null, bestD = Infinity;
    for (let dy = -LAIR_MEND_PX; dy <= LAIR_MEND_PX; dy++) {
      for (let dx = -LAIR_MEND_PX; dx <= LAIR_MEND_PX; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy)), x = px + dx, y = py + dy;
        if (d === 0 || d >= bestD || x < 0 || y < 0 || x >= 1000 || y >= 500) continue;
        const name = dungeonAt(x, y);
        if (!name || !enterable(x, y)) continue;
        best = { px: x, py: y, name: String(name).slice(0, 80), region: regionAt(x, y) };   // revenantFeud.js sanitizeLair's shape
        bestD = d;
      }
    }
    return best;
  };
  return function lairHere(at) {
    const { x, y } = at ?? here();
    // AUDIT FB1022d B6/E10: the ring laid only when it is read - the mend asks `enterable` and `nearest` alone
    let ring = null;
    return {
      px: x, py: y, enterable, nearest,
      get dungeons() { return (ring ??= bountyDungeons(x, y, dungeonAt).filter((d) => enterable(d.px, d.py)).map((d) => ({ ...d, region: regionAt(d.px, d.py) }))); },
    };
  };
}
