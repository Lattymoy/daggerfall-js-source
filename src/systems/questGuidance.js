// @ts-check
// GUIDE8 (the delve arc, 2026-10-05 - the player, on the dungeon blocks: "removing the esoteric nature of dungeons";
// bible/06-Systems/Quest-Guide-Arc.md GUIDE8, DECISIONS 3: "a player who cannot read a dungeon should be able to ask
// for it"): THE GUIDANCE TIERS, and the Exact tier's marks underground.
//
// Journal is GUIDE5's law, and the default: a quest is marked only where the player's map already holds its place, and
// never inside a dungeon. EXACT is the quest debugger's knowledge (DFU's HUDQuestDebugger draws the same markers): every
// quest resource standing in the dungeon - an item not yet taken, a person, a foe not yet killed - on the held map's
// dungeon sheet (ui/automapSheet.js, kind 'quest', its floor marked on the strip) and the followed quest's nearest on
// the compass. It is the one tier that can spoil a quest, so it is asked for by name (the `quest-guidance` row) and
// off by default. AUDIT DELVE E6: a shared quest's foe a party mate's client owns (a puppet, its behaviour the share's)
// and a dungeon's own quest people are marked too; and the tier reaches INTO BUILDINGS (scenes/worldModes.js
// interiorQuestMarksHere: the held map's interior sheet and the compass).
//
// AUDIT DELVE (the open item closed): THE TOWN TIER, between them. In the town of the building a quest's latest entry
// NAMES (its `_p_` - ui/questLens.js entryTarget's `building`), the town map rings that building and the compass points
// at it (scenes/world.js townQuestCompassMark) - the place the journal already gave, found in the streets, never a
// thing inside. Exact holds it too.
//
// Not a DFU member.

import { isEnhanced } from './uiSkin.js';
import { getPref } from './uiPrefs.js';

/** The prefs key (the `quest-guidance` Features row, which holds its tiers). */
export const GUIDANCE_PREF = 'questGuidance';

/** The tiers, least first: GUIDE5's law, the building in its town, the quest debugger's knowledge. */
export const GUIDANCE_TIERS = Object.freeze(['journal', 'town', 'exact']);

/** The tier in force: 'town' or 'exact' only on the enhanced skin and only when asked for; 'journal' otherwise. */
export const guidanceTier = () => {
  const v = isEnhanced() ? getPref(GUIDANCE_PREF) : null;
  return v === 'exact' || v === 'town' ? v : 'journal';
};
/** Is the Town tier's knowledge in force (the Town tier, or Exact, which holds it)? */
export const townTierOn = () => guidanceTier() !== 'journal';

/**
 * @typedef {{ at: number[], name: string, followed: boolean }} QuestMark
 */
/** AUDIT SD III (D3): A QUEST ENDED MARKS NOTHING - its quest complete or tombstoned (a tombstoned quest stays in the
 *  machine a game week, its stands standing and its behaviours still bound to it): the Exact tier marked an ended
 *  quest's item, people and foes, and the compass pointed at them. The behaviour's quest, else its resource's. */
export const questEnded = (b) => {
  const q = b?.targetQuest ?? b?.targetResource?.parentQuest ?? null;
  return !!q && (q.questComplete === true || q.questTombstoned === true);
};

/**
 * THE EXACT TIER'S MARKS in a dungeon: each quest stand (`stands` - the host's dungeon list: `{ active, dead,
 * behaviour: { questUID, targetResource } }`, its place `boxOf(stand)`, activate's own box - sceneMount.js
 * questStandBox) that stands and is not hidden, each live foe a quest spawned (`foes`: `{ dead, questBehaviour,
 * ai: { feet }, mobileType }` - its behaviour `behaviourOf(foe)`, AUDIT DELVE E6: a puppet's is the share's), and each
 * of the dungeon's own people a quest has taken (`people`: `{ x, y, z, active, questBehaviour }`, y the feet), with its
 * name (`itemName(stand, resource)` for an item; a person's or a foe's own displayName, else `foeName(foe)`) and
 * whether its quest is the one followed (`followedId`, the tracker's String(quest.uid)). The place is the foot of the
 * stand's box, or the foe's feet. Pure but for what the readers read.
 * @param {{ stands?: ReadonlyArray<any>|null, foes?: ReadonlyArray<any>|null, people?: ReadonlyArray<any>|null, boxOf: (s: any) => any,
 *   followedId?: string|null, itemName?: (s: any, res: any) => string|null|undefined, foeName?: (f: any) => string|null|undefined,
 *   behaviourOf?: (f: any) => any }} o
 * @returns {QuestMark[]}
 */
export function dungeonQuestMarks({ stands = [], foes = [], people = [], boxOf, followedId = null, itemName = () => null, foeName = () => null, behaviourOf = (f) => f?.questBehaviour ?? null }) {
  /** @type {QuestMark[]} */
  const out = [];
  const followed = (uid) => followedId != null && uid != null && String(uid) === String(followedId);
  for (const s of stands ?? []) {
    const res = s?.behaviour?.targetResource ?? null;
    if (!res || !s.active || s.dead || res.isHidden === true || questEnded(s.behaviour)) continue;
    const box = boxOf(s);
    if (!box?.min || !box?.max) continue;
    const at = [(box.min[0] + box.max[0]) / 2, box.min[1], (box.min[2] + box.max[2]) / 2];
    const name = res.isPerson === true ? (res.displayName || 'Someone') : (itemName(s, res) || 'Quest item');
    out.push({ at, name, followed: followed(s.behaviour.questUID) });
  }
  for (const f of foes ?? []) {
    const b = f ? behaviourOf(f) : null;
    const feet = f?.ai?.feet;
    if (!b || f.dead || !feet || b.targetResource?.isHidden === true || questEnded(b)) continue;
    out.push({ at: [feet[0], feet[1], feet[2]], name: b.targetResource?.displayName || foeName(f) || 'Quest foe', followed: followed(b.questUID) });
  }
  for (const p of people ?? []) {
    const b = p?.questBehaviour;
    const res = b?.targetResource ?? null;
    if (!res || p.active === false || res.isHidden === true || res.isDestroyed === true || questEnded(b)) continue;
    if (![p.x, p.y, p.z].every(Number.isFinite)) continue;
    out.push({ at: [p.x, p.y, p.z], name: res.displayName || 'Someone', followed: followed(b.questUID) });
  }
  return out;
}

/**
 * AUDIT DELVE C6: THE COMPASS'S PICK - of the Exact tier's marks (`marks`, QuestMark), the followed quest's nearest to
 * `feet`, else the nearest of all; its [x, z], or null with none. Pure.
 * @param {ReadonlyArray<QuestMark>|null|undefined} marks @param {number[]|null|undefined} feet
 * @returns {number[]|null}
 */
export function questCompassPick(marks, feet) {
  if (!feet || !marks?.length) return null;
  let best = null, bestD = Infinity;
  for (const pass of [true, false]) {
    for (const q of marks) {
      if (pass && !q.followed) continue;
      const d = Math.hypot(q.at[0] - feet[0], q.at[1] - feet[1], q.at[2] - feet[2]);
      if (d < bestD) { bestD = d; best = q; }
    }
    if (best) break;
  }
  return best ? [best.at[0], best.at[2]] : null;
}

/**
 * THE TOWN TIER'S BUILDINGS in the town whose map id is `mapId`: of the quest views (ui/questTracker.js `views` - each
 * active quest's latest entry's target), each building an entry names there (`target.building`), once, by key, the
 * followed quest's (`followedId`) said. Pure.
 * @param {ReadonlyArray<any>|null|undefined} views @param {number|null|undefined} mapId @param {string|null} [followedId]
 * @returns {Array<{ buildingKey: number, followed: boolean }>}
 */
export function townQuestBuildings(views, mapId, followedId = null) {
  /** @type {Map<number, { buildingKey: number, followed: boolean }>} */
  const out = new Map();
  if (!Number.isFinite(Number(mapId))) return [];
  const here = Number(mapId) >>> 0;
  for (const v of views ?? []) {
    const b = v?.target?.building;
    if (!b || !(b.buildingKey > 0) || (Number(b.mapId) >>> 0) !== here) continue;
    const followed = followedId != null && v.id != null && String(v.id) === String(followedId);
    const had = out.get(b.buildingKey);
    out.set(b.buildingKey, { buildingKey: b.buildingKey, followed: followed || !!had?.followed });
  }
  return [...out.values()];
}

/** A building summary's place in its location's own frame (m; world/buildingSummaries.js - the block's corner, RMB
 *  `side` metres a block, plus the building's position in it), [x, z]: the frame the town map's player is in. Pure. */
export function townBuildingLocal(summary, side) {
  const p = summary?.position;
  if (!p) return null;
  return [(summary.blockX ?? 0) * side + p[0], (summary.blockY ?? 0) * side + p[2]];
}
