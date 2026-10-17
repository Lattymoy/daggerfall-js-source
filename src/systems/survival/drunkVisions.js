// @ts-check
// DRUNK3 (2026-10-17, asked for: "an impairment to the characters judgement. For example, seeing a dragonling as a bat,
// or an elite zombie as a rat"). THE DRINK, MISJUDGED: while the player is VERY DRUNK some of the creatures in view are
// DRAWN as something else, something small that cannot hurt anyone - the zombie that is a rat, the dragonling that is a
// bat. The eye and the feet are drunkFeel.js's and the words drunkSpeech.js's; this is the judgement. Neither Daggerfall
// Unity nor Climates & Calories has any of it - the port's own, and a picture with no gameplay in it: the foe keeps its
// real mobile type, stats, AI, collision, sounds, damage and - above all - its REAL ANIMATION CLOCK (MobileUnit's frame
// clock is what lands a melee blow and looses an arrow); only the sprite the host draws this frame is another's.
//
//   - THE LAW (pure, exported): `ILLUSIONS` what a foe is seen as - the dragonlings as a giant bat and the zombie as a
//     rat (the two the player asked for, always) - and `HARMLESS`, the pool every other creature draws from (never its
//     own kind); `illusionChance(state)`, nothing short of Very drunk, then 0.4 and 0.4 more at the endurance;
//     `pickIllusion(mobileType, roll)`. A person (a class mobile, an orc, a vampire, a werewolf - foeBodies.js
//     isPersonFoe) is never transformed: the drink misjudges a monster, never a face.
//   - THE DECISION (`createDrunkVisions`): made once per foe per BINGE - a foe is a bat or it is not, it never
//     flickers between frames - from a hash of the foe's own number (a foe with none, a roll kept on the foe), and
//     forgotten the moment the player drops below Very drunk, so the next binge deals the dice again.
//   - THE DRAW (`createVisionDraw` / `foeVision`): the seam the two draw assemblies call (exteriorFoes.js batches,
//     dungeonContext.js drawFoes). It answers the archive, texture, record and frame to DRAW: the illusion's archive,
//     the record the foe's clock chose (record 0 where the illusion lacks it) and the frame clamped to the illusion's
//     own count for that record (a bat has fewer frames than a dragonling; the file answers a missing one with an empty
//     bitmap). Until the illusion's texture has loaded - or if it never does - the real foe is drawn. The size is
//     the host's, off the answered texture, times the elite scale as ever: an elite zombie is a BIG rat, the joke.
//     A foe seen as another stands in no Morrowind body: the draw marks the foe (`f._drunkSeen`) and creatureBodies.js
//     creatureLook answers no look for a marked live foe, so isBodyFoe is false, the lane is never offered it, the body
//     it stood is let go by the lane's sync and the sprite shows; the body comes back with the foe's own look the frame
//     the drink wears off. (The hosts' lines that offer a foe to the lane are untouched - the mark does it.)

import { drunkFeel, onDrunkBand } from './drunkFeel.js';
import { MOBILE_TYPES as M } from '../../characters/mobile/mobileTypes.js';
import { ENEMY_BASICS, isClassEnemyId } from '../../characters/enemy/enemyBasics.js';
import { isPersonFoe } from '../../characters/foeBodies.js';

/** What a foe is SEEN as, by its mobile type: the user's own two examples, always used - the dragonlings (both of
 *  them) a giant bat, the zombie a rat. Every other creature draws from HARMLESS. */
export const ILLUSIONS = Object.freeze({
  [M.Dragonling]: M.GiantBat,
  [M.Dragonling_Alternate]: M.GiantBat,
  [M.Zombie]: M.Rat,
});

/** The pool every other creature is seen as - small things that look harmless (all with a sprite of their own in
 *  ENEMY_BASICS). A foe is never seen as its own kind. */
export const HARMLESS = Object.freeze([M.Rat, M.GiantBat, M.Imp]);

/** The chance a foe is seen as another at Very drunk: this at the line, and this much more at the endurance. */
export const ILLUSION_CHANCE = Object.freeze({ base: 0.4, add: 0.4 });

/** How long a read of the drink holds (ms): a frame draws every foe, and the counter moves by the minute. */
export const STATE_TTL_MS = 100;

/** The chance a foe in view is seen as another at the drink `state` ({ band, share }, drunkFeel.js drunkStateOf): none
 *  short of Very drunk. */
export function illusionChance(state) {
  if (!state || state.band !== 'veryDrunk') return 0;
  const share = Number.isFinite(state.share) ? Math.max(0, Math.min(1, state.share)) : 0;
  return ILLUSION_CHANCE.base + ILLUSION_CHANCE.add * share;
}

/** Is this mobile type one the drink may misjudge: a creature with a sprite of its own, not a person, not a horse
 *  that is no foe (texture 0). */
const MISJUDGED = (mobileType) => Number.isInteger(mobileType) && !isClassEnemyId(mobileType) && (ENEMY_BASICS[mobileType]?.maleTexture ?? 0) > 0;

/**
 * The mobile type a creature of `mobileType` is seen as at `roll` (0..1, which of the pool): the table's own answer
 * where it has one, else a pick from HARMLESS that is never the creature itself; null for a type the drink does not
 * touch (a class, a type with no sprite).
 * @param {number} mobileType @param {number} roll
 * @returns {number|null}
 */
export function pickIllusion(mobileType, roll) {
  if (!MISJUDGED(mobileType)) return null;
  if (Object.prototype.hasOwnProperty.call(ILLUSIONS, mobileType)) return ILLUSIONS[mobileType];
  const pool = HARMLESS.filter((id) => id !== mobileType);
  const r = Number.isFinite(roll) ? Math.max(0, Math.min(0.999999, roll)) : 0;
  return pool[Math.floor(r * pool.length)];
}

/** A 32-bit mix (Murmur3's finalizer) of a few small integers, as 0..1 - the foe's dice, the same every time. */
export function visionRoll(id, mobileType, binge, salt) {
  let h = (Math.imul(id | 0, 0x9e3779b1) ^ Math.imul((mobileType | 0) + 1, 0x85ebca6b) ^ Math.imul((binge | 0) + 1, 0xc2b2ae35) ^ Math.imul((salt | 0) + 1, 0x27d4eb2f)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

/** The number a foe carries (the exterior pool's `seq` or `uid`, the dungeon's `seq`/`_mwId`), or null. */
const idOfFoe = (f) => {
  for (const id of [f?.seq, f?.uid, f?._mwId]) if (Number.isInteger(id)) return id;
  return null;
};

/**
 * The runtime: who is seen as what, decided once per foe per binge.
 * @param {{ state?: () => { band: string, share: number }, rng?: () => number, now?: () => number, ttl?: number }} [o]
 *   `state` the drink as it stands (drunkFeel.state), `rng` the dice of a foe with no number, `now` the clock
 *   (ms) the state's read is held against, `ttl` how long.
 */
export function createDrunkVisions({ state = () => drunkFeel.state(), rng = Math.random, now = () => performance.now(), ttl = STATE_TTL_MS } = {}) {
  /** @type {WeakMap<object, { binge: number, rolls: number[], seen: number|null }>} */
  const decisions = new WeakMap();
  let binge = 0, inBinge = false, held = /** @type {any} */ (null), heldAt = -Infinity;

  const read = () => {
    const t = now();
    if (held === null || !(t - heldAt < ttl)) { held = state(); heldAt = t; }
    return held;
  };

  /** The binge in hand, turned over when the player drops below Very drunk - the next one rerolls every foe. */
  const flip = (very) => {
    if (very && !inBinge) inBinge = true;
    else if (!very && inBinge) { inBinge = false; binge++; }
    return very;
  };
  const turn = (st) => flip(st?.band === 'veryDrunk');

  return {
    /**
     * The mobile type to DRAW this foe as, or null for "as it is". Stable: the same foe answers the same until the
     * binge ends.
     * @param {any} f a foe record (mobileType, gender, entity)
     * @returns {number|null}
     */
    seenAs(f) {
      const st = read();
      if (!turn(st) || !f || f.dead) return null;
      let rec = decisions.get(f);
      if (!rec || rec.binge !== binge) {
        const id = idOfFoe(f);
        const rolls = id == null ? [rng(), rng()] : [visionRoll(id, f.mobileType, binge, 0), visionRoll(id, f.mobileType, binge, 1)];
        rec = { binge, rolls, seen: null };
        if (!isPersonFoe(f) && rolls[0] < illusionChance(st)) rec.seen = pickIllusion(f.mobileType, rolls[1]);
        decisions.set(f, rec);
      }
      return rec.seen;
    },
    /** AUDIT DRUNK2: the feel's band changed (drunkFeel.js onDrunkBand) - the binge turns here too, not only when a foe is
     *  drawn: sobering up indoors (no foe to draw) and drinking again is a new binge. The held read is dropped. */
    note(band) { held = null; flip(band === 'veryDrunk'); },
    /** The number of the binge in hand (it turns when the player drops under Very drunk). */
    get binge() { return binge; },
    /** Forget every decision (a test's door; the next read is a new binge). */
    reset() { binge++; inBinge = false; held = null; },
  };
}

/** The one runtime the hosts share. */
export const drunkVisions = createDrunkVisions();
// AUDIT DRUNK2: a binge ends when the band does, drawn or not - the game's one feel says so each frame it changes
onDrunkBand((band) => drunkVisions.note(band));

/**
 * The draw helper over a runtime. `vision(f, archive, tex, out, getTexture)` answers, in one SCRATCH object the next
 * call overwrites (read it at once - no frame allocates), what to draw for foe `f` whose own sprite is `archive`/`tex`
 * and whose animation clock says `out` ({ record, frame, flip }) - the clock itself is never touched:
 *   `{ archive, tex, record, frame, flip, seen }` - the foe as it is (`seen` false) or as the drink sees it (`seen` true).
 * It also leaves the foe marked (`f._drunkSeen`, creatureBodies.js creatureLook reads it) so a foe drawn as another
 * is offered to no Morrowind body, and offered again the frame the drink wears off.
 * @param {{ seenAs: (f: any) => number|null }} visions
 */
export function createVisionDraw(visions) {
  /** archive -> texture | 'loading' | 'failed' (a load that failed is not asked again) */
  const textures = new Map();
  const answer = { archive: 0, tex: /** @type {any} */ (null), record: 0, frame: 0, flip: false, seen: false };

  const textureOf = (archive, getTexture) => {
    const held = textures.get(archive);
    if (held && typeof held === 'object') return held;
    if (held === undefined && typeof getTexture === 'function') {
      textures.set(archive, 'loading');
      Promise.resolve().then(() => getTexture(archive)).then((t) => { textures.set(archive, t && typeof t.getFrameCount === 'function' ? t : 'failed'); }, () => { textures.set(archive, 'failed'); });
    }
    return null;
  };

  /** The answer for `f`: the foe as it is unless the drink sees it as another and that other's texture is in hand. */
  const fill = (f, archive, tex, out, getTexture) => {
    answer.archive = archive; answer.tex = tex; answer.record = out.record; answer.frame = out.frame; answer.flip = out.flip; answer.seen = false;
    const seen = visions.seenAs(f);
    if (seen == null) return answer;
    const basics = ENEMY_BASICS[seen];
    const arch = f.gender === 'female' ? (basics?.femaleTexture ?? basics?.maleTexture) : basics?.maleTexture;
    if (!(arch > 0)) return answer;
    const t = textureOf(arch, getTexture);
    if (!t) return answer;   // not loaded yet (or never): the real foe is drawn
    let record = out.record, frames = t.getFrameCount(record);
    if (!(frames > 0)) { record = 0; frames = t.getFrameCount(0); }   // the illusion lacks the record: its first
    if (!(frames > 0)) return answer;
    answer.archive = arch; answer.tex = t; answer.record = record;
    answer.frame = Number.isFinite(out.frame) ? Math.max(0, Math.min(frames - 1, out.frame)) : 0;   // the clock's frame, held to the frames the illusion has
    answer.seen = true;
    return answer;
  };

  return function vision(f, archive, tex, out, getTexture) {
    fill(f, archive, tex, out, getTexture);
    if (!!f._drunkSeen !== answer.seen) f._drunkSeen = answer.seen;   // written only on a change: a sober foe's record is never touched
    return answer;
  };
}

/** The draw seam the hosts call: `foeVision(f, archive, tex, out, getTexture)`. */
export const foeVision = createVisionDraw(drunkVisions);
