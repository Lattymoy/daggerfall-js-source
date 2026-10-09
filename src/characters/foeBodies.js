// @ts-check
// MWNPC5b (2026-10-09, the MW-NPC arc's fifth slice - bible/04-Characters/Morrowind-NPCs.md section 10b): A FOE, READ
// FOR ITS BODY. The NPC lane (characters/npcBodies.js) stands an actor from a look and a few facts; this reads both off
// a class foe as every foe host keeps it (dungeonContext.js's records, scenes/exteriorFoes.js's - the same shape: an
// `entity` with its worn equip table, an `ai` motor with its feet, yaw and stride, the stream's attack and cast counts,
// the billboard `batch` the host has already dressed in the foe's tells this frame). It owns no rule of the foe's: the
// look is what the foe WEARS (its equip table - composeLook's own read, the player's look's), the race and the face
// are the foe's own stable draw (Daggerfall's class foes have neither; one Breton for every bandit is the plan's own
// complaint), and the tells are the batch's as the host set them.
import { composeLook } from '../net/remotePlayers.js';
import { EQUIP_SLOTS } from '../systems/equip.js';

/** The Iliac Bay's people, weighted - the races a class foe is drawn as (Daggerfall's own spelling, the look's). The
 *  Bay is Breton and Redguard country; the rest are travellers, the beast folk fewest. */
/** @type {ReadonlyArray<[string, number]>} */
export const FOE_RACES = Object.freeze([
  ['Breton', 30], ['Redguard', 25], ['Nord', 10], ['WoodElf', 9], ['DarkElf', 8], ['HighElf', 8], ['Khajiit', 5], ['Argonian', 5],
]);
const RACE_TOTAL = FOE_RACES.reduce((a, [, w]) => a + w, 0);

/** What a foe wears UNDER its armour, by gender: a shirt, pants (or a skirt), shoes - the templates Daggerfall's own
 *  wardrobe draws them from (itemTemplates.json; mwItemMap.js DF_CLOTHING_ROWS dresses each in a Morrowind CLOT), and
 *  the dyes a common garment takes. A slot the foe's armour fills (the cuirass, the greaves, the boots) shows the armour
 *  - the reference's own slot law; the clothes are under it. */
export const FOE_WARDROBE = Object.freeze({
  male: Object.freeze({ group: 'MensClothing', shirts: [165, 166, 167, 168, 169, 170, 171, 172, 158], legs: [151, 152], feet: [147, 149, 148] }),
  female: Object.freeze({ group: 'WomensClothing', shirts: [202, 203, 204, 205, 206, 207, 208, 209, 184], legs: [190, 212], feet: [186, 188, 187] }),
});
export const FOE_DYES = Object.freeze([1, 3, 5, 0, 2, 9, 4, 6]);   // Grey, DarkBrown, LightBrown, Blue, Red, Green, Purple, White

/** A 32-bit mix (splitmix's finaliser) - the foe's draws, the same on every machine that sees the same foe. */
function mix(h) {
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
/** The foe's seed: its species and where its layout stood it (`marker`, the dungeon's; the encounter's spawn point
 *  otherwise) - facts every machine in the room shares, so a foe is the same person on each. A foe with neither takes
 *  its own sequence number. */
export function foeSeed(f) {
  if (f._mwSeed != null) return f._mwSeed;
  const at = f.marker ?? f.spawnAt ?? null;
  let h = mix((f.mobileType | 0) + 0x9e3779b9);
  if (at) for (const v of [at[0], at[2]]) h = mix(h ^ (Math.round((v || 0) * 10) | 0));
  else h = mix(h ^ ((f.seq ?? 0) | 0));
  return (f._mwSeed = h);
}
const pick = (list, h) => list[h % list.length];

/** Is this foe one a Morrowind body stands for? A CLASS foe (Daggerfall's people - the mobiles past 127) - the
 *  creatures are MWNPC9's, with their own skeletons. */
export const isClassFoe = (f) => !!f?.entity?.isClass;

/** The foe's look: its race and face drawn off its seed, its gender its own, and what it wears - its equip table, as
 *  the player's look reads the player's (composeLook), with the clothes under the armour it has none over. Kept on the
 *  foe while its equip table holds the same pieces (a look is a cache key - PeerBodies builds a new body for a new
 *  one), so a foe that picks up nothing is one build for its life. */
export function foeLook(f) {
  const e = f.entity;
  const worn = composeLook(e, { eotbSet: null }).items;
  const wornKey = worn.map((it) => `${it.equipSlot}:${it.templateIndex}:${it.material ?? ''}:${it.dye ?? ''}`).join('|');
  if (f._mwLook && f._mwLookKey === wornKey) return f._mwLook;
  const h = foeSeed(f);
  let r = mix(h ^ 0x51ed27) % RACE_TOTAL, race = FOE_RACES[0][0];
  for (const [name, w] of FOE_RACES) { if (r < w) { race = name; break; } r -= w; }
  const gender = f.gender === 'female' ? 'female' : 'male';
  const W = FOE_WARDROBE[gender];
  const has = new Set(worn.map((it) => it.equipSlot));
  const items = [...worn];
  const dye = (k) => pick(FOE_DYES, mix(h ^ k));
  if (!has.has(EQUIP_SLOTS.ChestClothes)) items.push({ templateIndex: pick(W.shirts, mix(h ^ 0xc1)), group: W.group, equipSlot: EQUIP_SLOTS.ChestClothes, dye: dye(0xd1) });
  if (!has.has(EQUIP_SLOTS.LegsClothes)) items.push({ templateIndex: pick(W.legs, mix(h ^ 0xc2)), group: W.group, equipSlot: EQUIP_SLOTS.LegsClothes, dye: dye(0xd2) });
  if (!has.has(EQUIP_SLOTS.Feet)) items.push({ templateIndex: pick(W.feet, mix(h ^ 0xc3)), group: W.group, equipSlot: EQUIP_SLOTS.Feet, dye: dye(0xd3) });
  f._mwLookKey = wornKey;
  return (f._mwLook = { race, gender, faceIndex: mix(h ^ 0xfa) % 10, items });
}

/** The foe's id among the lane's: its host's sequence number where it keeps one (exteriorFoes' `seq`), else one minted
 *  on the record - never reused while the record lives. */
let _ids = 0;
export const foeId = (f) => f.seq ?? (f._mwId ??= ++_ids);

/**
 * The actor the lane stands, off the foe as its host left it this frame (characters/npcBodies.js `stand`):
 *   - THE STRIDE: its motor's feet and yaw (the player's own yaw convention: forward is (sin yaw, cos yaw)), moving
 *     and - in pursuit (its give-up timer running, both motors' field) - running;
 *   - THE BLOW: the stream's attack count (`_atkA`, its low bit the ranged flag - enemyTargets.js bumpAtkCount), each
 *     new count a swing, its strike drawn from the count (Morrowind's NPCs pick theirs at random; the count is the
 *     roll every machine shares);
 *   - THE CAST: the stream's cast count (`_castN`);
 *   - THE RECOIL: a count of the health drops the host's hit flash has seen (systems/hitFlash.js foeHitFlash marks
 *     each on the foe as `_hfAt`) - each new mark a recoil;
 *   - THE DEATH: dead, the death's roll + 1 off its seed.
 * @param {any} f
 */
export function foeActor(f) {
  if (f._hfAt != null && f._hfAt !== f._mwHitAt) { f._mwHitAt = f._hfAt; f._mwHits = ((f._mwHits | 0) + 1) & 0xffff; }
  const swings = (f._atkA | 0) >> 1;
  return {
    id: foeId(f),
    look: foeLook(f),
    feet: f.ai.feet,
    yaw: f.ai.yaw,
    moving: !!f.ai.moving,
    running: !!f.ai.moving && f.ai.giveUpTimer > 0,   // pursuing (EnemyMotor's GiveUpTimer running): a Morrowind NPC runs at its foe
    drawn: true,   // a class foe's weapon is out - Daggerfall's foes never sheathe
    swings,
    strike: 1 + (swings % 6),   // POSE_STRIKES 1..6: down, down-left, left, right, down-right, up
    casts: f._castN | 0,
    castRange: 2,   // the target range - a foe casts at its target (the pose's `cr`)
    hits: f._mwHits | 0,
    dead: f.dead ? 1 + (mix(foeSeed(f) ^ 0xdead) % 5) : 0,
  };
}

/** The tells the host has dressed the foe's billboard in this frame, for its body's quad (renderer.js
 *  drawCharacterSpriteQuad `fx`): the glint, the elite's pulse and clock, the dissolve - one object on the foe, rewritten
 *  in place each frame (no allocation a frame). Null when it wears none. `batch` the one to read - a corpse's flat for
 *  the dead (an elite's corpse keeps its rim). */
export function foeFx(f, batch = f?.batch) {
  if (!batch) return null;
  const glint = batch.glint && batch.glint[3] > 0 ? batch.glint : null;
  const elite = batch.eliteGlow || 0;
  const dissolve = batch.dissolve && batch.dissolve[0] > 0 ? batch.dissolve : null;
  if (!glint && !elite && !dissolve) return null;
  const fx = f._mwFx ?? (f._mwFx = { glint: null, elite: 0, time: 0, dissolve: null });
  fx.glint = glint; fx.elite = elite; fx.time = batch.eliteTime || 0; fx.dissolve = dissolve;
  return fx;
}
