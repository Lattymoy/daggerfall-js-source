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
// off by default. The Town tier GUIDE8 names (the building an entry names, in its town) is not built here.
//
// Not a DFU member.

import { isEnhanced } from './uiSkin.js';
import { getPref } from './uiPrefs.js';

/** The prefs key (the `quest-guidance` Features row, which holds its tiers). */
export const GUIDANCE_PREF = 'questGuidance';

/** The tier in force: 'exact' only on the enhanced skin and only when asked for; 'journal' otherwise. */
export const guidanceTier = () => (isEnhanced() && getPref(GUIDANCE_PREF) === 'exact' ? 'exact' : 'journal');

/**
 * @typedef {{ at: number[], name: string, followed: boolean }} QuestMark
 */
/**
 * THE EXACT TIER'S MARKS in a dungeon: each quest stand (`stands` - the host's dungeon list: `{ active, dead,
 * behaviour: { questUID, targetResource } }`, its place `boxOf(stand)`, activate's own box - sceneMount.js
 * questStandBox) that stands and is not hidden, and each live foe a quest spawned (`foes`: `{ dead, questBehaviour,
 * ai: { feet }, mobileType }`), with its name (`itemName(stand, resource)` for an item; a person's or a foe's own
 * displayName, else `foeName(foe)`) and whether its quest is the one followed (`followedId`, the tracker's
 * String(quest.uid)). The place is the foot of the stand's box, or the foe's feet. Pure but for what the readers read.
 * @param {{ stands?: ReadonlyArray<any>|null, foes?: ReadonlyArray<any>|null, boxOf: (s: any) => any,
 *   followedId?: string|null, itemName?: (s: any, res: any) => string|null|undefined, foeName?: (f: any) => string|null|undefined }} o
 * @returns {QuestMark[]}
 */
export function dungeonQuestMarks({ stands = [], foes = [], boxOf, followedId = null, itemName = () => null, foeName = () => null }) {
  /** @type {QuestMark[]} */
  const out = [];
  const followed = (uid) => followedId != null && uid != null && String(uid) === String(followedId);
  for (const s of stands ?? []) {
    const res = s?.behaviour?.targetResource ?? null;
    if (!res || !s.active || s.dead || res.isHidden === true) continue;
    const box = boxOf(s);
    if (!box?.min || !box?.max) continue;
    const at = [(box.min[0] + box.max[0]) / 2, box.min[1], (box.min[2] + box.max[2]) / 2];
    const name = res.isPerson === true ? (res.displayName || 'Someone') : (itemName(s, res) || 'Quest item');
    out.push({ at, name, followed: followed(s.behaviour.questUID) });
  }
  for (const f of foes ?? []) {
    const b = f?.questBehaviour;
    const feet = f?.ai?.feet;
    if (!b || f.dead || !feet || b.targetResource?.isHidden === true) continue;
    out.push({ at: [feet[0], feet[1], feet[2]], name: b.targetResource?.displayName || foeName(f) || 'Quest foe', followed: followed(b.questUID) });
  }
  return out;
}
