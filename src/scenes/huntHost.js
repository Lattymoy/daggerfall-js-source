// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF7 (2026-09-29, Mac: "Do it") - HUNTING, a kind in the gathering
// host (scenes/gatherHost.js; bible/06-Systems/Professions-Arc.md 4.4,
// 5.2, 6, 29; FORAGE0 14):
//
//   THE BODY. Offline - and online where a pool speaks no skin law (an older build's) - "a body your own blow felled" (5.2): a foe's death is
//   told by one signal, the player's own kill (systems/playerKills.js - the
//   melee, the arrow, the spell, and a puppet's owner's word), and a foe
//   4.4 skins is stamped there with its id - the UTC day and twelve hex
//   digits drawn at the kill (net/nodeLaw.js bodyKey). ONLINE (PARTY-SKIN, net/bodySkin.js; Travis, 2026-10-19: "bodies can be skinned
//   only once by anyone which I think aligns with your recommendations") the body's authority mints ONE id at the death, whoever may loot
//   the body may skin it, first come, and the pool hands the body's handle in (`skinOf`): the shared id is the node's, and the act waits at
//   its end for the authority's word before a hide is asked. Hunting is bounded,
//   not witnessed (PROF0 6): the id is the client's word and the account's
//   rare hides - 3 of tiers 5-6 a day - the service's defence (CAP-OFF:
//   the day's thirty hides of any tier are gone).
//   THE NODE. A stamped body is a node while it lies in its pool (the
//   street's, the dungeon's, or - INDOOR-SKIN - a building's: bodiesHere)
//   and the pack holds a Skinning Knife: DFU's
//   corpse first, a node only for the one who can skin it - so a body is
//   never a prompt in the way of a player with no knife. It carries its
//   own place (`at`, the corpse marker's ground, which the floating origin
//   moves), not a pixel's or a dungeon's: a LOOSE node.
//   THE PLAN. E skins; the act choice key searches the body instead (its
//   loot is DFU's, untouched - "skinning adds, never replaces", 4.4) and
//   hands the press on to the loot.
//   THE ACT. The knife's checks in Foraging's voice (KNIFE_CHECKS: never
//   inside nor daylight - the body lies where it fell, and foes die at
//   night); the machine is systems/traceAct.js - E held, the crosshair
//   drawn along the line (attack is the weapon's, and DFU's swing modes
//   hold the look still under it); the hand draws DFU's Dagger (FORAGE0
//   14.2). TOUCH-HOLD: the Skinning Knife's Use from the hotbar or a
//   quick slot is E at the body, and holds the knife itself - the line
//   drawn with no key held (a phone's swipe, a pad's right stick).
// ═══════════════════════════════════════════════════════════════════
import { bodyKey, utcDayOfMs } from '../net/nodeLaw.js';
import { bodyId } from '../net/bodySkin.js';
import {
  hideOfFoe, tierOpen, TIER_RANKS, knifeBand, SKINNING_KNIFE, KNIFE_CHECKS, KNIFE_REFUSALS, HIGH_HIDES_PER_DAY,
  HIGH_HIDE_TIER, TRACKER_M, KNIFE_WHERE, KNIFE_WHERE_WORDS, TRACE_ACT, storesFullIn, goneIn, fullWordsIn,
} from '../net/professionLaw.js';
import { enemyDisplayName } from '../characters/enemy/enemyBasics.js';
import { createTraceAct } from '../systems/traceAct.js';
import { actChecksRefusal, foragingToolIn } from '../systems/foraging/foragingInstall.js';
import { materialLabel } from '../systems/professions/profItems.js';
import { liveStat } from '../systems/statMods.js';
import { getPref } from '../systems/uiPrefs.js';
import { CORPSE_ACTIVATION_DISTANCE } from '../player/activate.js';
import { PITCH_FLOOR } from '../player/lookFilter.js';

/** The Skinning Knife in the hand (FORAGE0 14.2): DFU's own Dagger. */
export const KNIFE_HAND = Object.freeze({ group: 'Weapons', templateIndex: 113, material: 0 });
/** A body answers E within this many metres of the eye - DFU's own reach for a corpse (CorpseActivationDistance, 3.75:
 *  AUDIT 32 H7 - the knife reaches the body the loot does; it was 2.5 against the eye's height, and a body a metre
 *  downhill or under a rider was none) - and stands this far above its ground for the look. */
export const BODY_REACH = CORPSE_ACTIVATION_DISTANCE;
export const BODY_LIFT = 0.2;
/** NODE-MARKS: a body's glow where it lies (m) - long and low. */
export const BODY_MARK = Object.freeze({ w: 2.2, h: 1.0 });
/** AUDIT 32 H7: the steepest bearing below the eye a body's line can be drawn at - the look stops at PITCH_FLOOR, and the
 *  line's lowest point lies TRACE_ACT.spanPitchDeg under the body's centre (a degree's margin). Steeper, the player is
 *  standing over it: the plan asks them to step back. */
export const BODY_STEEPEST_DEG = -((PITCH_FLOOR * 180) / Math.PI - TRACE_ACT.spanPitchDeg - 1);

export { bodyId };   // a body's id (net/bodySkin.js, its one home): twelve hex digits from the crypto source's fill

/**
 * THE STAMPS: a foe 4.4 skins, stamped at the kill the player's own blow made - `{ key, foe, tier, hide }` by its entity.
 * A kill told again (the same entity felled anew) stamps it anew.
 * @param {{ nowMs: () => number, rand?: (b: Uint8Array<ArrayBuffer>) => void }} deps `nowMs` the shared clock
 */
export function createBodyStamps({ nowMs, rand = (b) => { globalThis.crypto.getRandomValues(b); } }) {
  let stamps = new WeakMap();
  /** PARTY-SKIN: the UTC day each shared body id was first seen HERE - its key's day (a body skinned is a day's), and AUDIT 32 B1's lapse for it:
   *  a body first seen before midnight is nobody's after it, as a private stamp's is not (the service lets its key lapse - PROF0 19). */
  const sights = new Map();
  return {
    /** The player's own kill (systems/playerKills.js's listener). The stamp, or null for a foe no knife takes a hide from. */
    stamp(entity) {
      if (!entity || typeof entity !== 'object') return null;
      const hide = hideOfFoe(entity.mobileType);
      if (!hide) return null;
      const s = Object.freeze({ key: bodyKey({ day: utcDayOfMs(nowMs()), id: bodyId(rand) }), foe: entity.mobileType, tier: hide.tier, hide: hide.key });
      stamps.set(entity, s);
      return s;
    },
    /** A body's stamp, or null - AUDIT 32 B1: null once its UTC day has ended, as the service lets its key lapse (PROF0
     *  19: `prof-day`): the body DFU's corpse alone, E its loot's. It stood as a node after midnight, every trace wearing
     *  the knife for a refusal, and a body skinned before it stood ready again (the day's read forgets yesterday's). */
    of: (entity) => {
      const s = entity && typeof entity === 'object' ? stamps.get(entity) ?? null : null;
      return s && s.key.startsWith(`body:${utcDayOfMs(nowMs())}:`) ? s : null;
    },
    /** PARTY-SKIN: a shared body's key - the day it was first seen here, its id - or null once that UTC day has ended. */
    keyOfShared(id) {
      const today = utcDayOfMs(nowMs());
      let day = sights.get(id);
      if (day === undefined) {
        day = today;
        sights.set(id, day);
        while (sights.size > 512) sights.delete(sights.keys().next().value);
      }
      return day === today ? bodyKey({ day, id }) : null;
    },
    /** A new character: no body is theirs. */
    clear() { stamps = new WeakMap(); sights.clear(); },
  };
}

/**
 * A POOL'S STAMPED BODIES - `{ key, foe, tier, hide, at, lift, reach, lootKey }` for each dead foe with a body and a
 * stamp; `at()` its place now (the pool's own: the corpse marker's ground on the street, its corpse's in a dungeon), or
 * null; `lootKey()` its loot's key in its pool while it may be searched (AUDIT 32 H8), or null.
 * @param {readonly any[]|null|undefined} foes @param {{ of: (e: any) => any, keyOfShared?: (id: string) => string|null }} stamps @param {(f: any) => number[]|null|undefined} placeOf
 * @param {(f: any) => string|null|undefined} [keyOf]
 * @param {((f: any) => any)|null} [skinOf] PARTY-SKIN: the pool's door to a body's shared skin - null: the private stamp rules this body
 *   (offline, an authority that speaks no skin law, the killer's own); false: the authority speaks the law and has said nothing of it, no
 *   node; else the body's handle (`id`, `view()`, `mineSkinned()`, `claim()`, `refused()`), which beats the stamp - one node per body
 */
export function bodiesOf(foes, stamps, placeOf, keyOf = () => null, skinOf = null) {
  const out = [];
  for (const f of foes ?? []) {
    if (!f?.dead || !f.corpse) continue;
    const sk = skinOf ? skinOf(f) : null;
    if (sk === false) continue;
    const at = () => placeOf(f) ?? null, lootKey = () => keyOf(f) ?? null;
    if (sk) {
      const mobileType = f.entity?.mobileType ?? f.mobileType;
      const hide = hideOfFoe(mobileType), key = hide ? stamps.keyOfShared(sk.id) : null;
      if (hide && key) out.push({ key, foe: mobileType, tier: hide.tier, hide: hide.key, skin: sk, at, lift: BODY_LIFT, reach: BODY_REACH, lootKey });
      continue;
    }
    const s = stamps.of(f.entity);
    if (!s) continue;
    out.push({ key: s.key, foe: s.foe, tier: s.tier, hide: s.hide, at, lift: BODY_LIFT, reach: BODY_REACH, lootKey });
  }
  return out;
}

/**
 * FIELD BUGS 2026-10-07 INDOOR-SKIN ("Cannot skin indoors": a Fighters Guild "Hunt for Giant Rodents" - M0B00Y15's
 * `Place _house_ local random`, its Giant Rats and Giant Bats stood in a house in town - "their bodies are not able to be
 * skinned"): THE BODIES WHERE THE PLAYER IS, BY THE ONE POOL THE MODE STANDS THEM IN - the street's, a dungeon's, or a
 * building's. Each pool answers `{ foes, corpseAt, corpseKeyOf }` (scenes/exteriorFoes.js - the street's and, through
 * makeInteriorFoes, a building's; scenes/dungeonContext.js). The host asked the dungeon's or else the street's, so a
 * body felled in a building was looked for among the street's dead: stamped at the kill (the building's pool tells the
 * kill as the street's does), never found. A mode with no pool standing (a building with none yet) has no bodies.
 * @param {string} mode the host's mode ('exterior', 'interior', 'dungeon')
 * @param {{ street?: any, dungeon?: any, interior?: any }} pools @param {{ of: (e: any) => any }} stamps
 */
export function bodiesHere(mode, { street = null, dungeon = null, interior = null } = {}, stamps) {
  const pool = mode === 'dungeon' ? dungeon : mode === 'interior' ? interior : street;
  if (!pool) return [];
  return bodiesOf(pool.foes, stamps, (f) => pool.corpseAt?.(f), (f) => pool.corpseKeyOf?.(f), pool.skinOf ? (f) => pool.skinOf(f) : null);   // AUDIT 32 H3: where it lies, not where it flew; PARTY-SKIN: and its shared skin
}

/** A Tracker's marks (3.3): the living animals of a pool within TRACKER_M of `at` - the foes 4.4 skins - as scene XZ.
 *  @param {readonly any[]|null|undefined} foes @param {number[]} at */
export function trackerMarks(foes, at) {
  const out = [];
  for (const f of foes ?? []) {
    const feet = f?.ai?.feet;
    if (!f || f.dead || !feet || !hideOfFoe(f.entity?.mobileType ?? f.mobileType)) continue;
    if (Math.hypot(feet[0] - at[0], feet[2] - at[2]) <= TRACKER_M) out.push([feet[0], feet[2]]);
  }
  return out;
}

/** The foe's name as DFU gives it ("Grizzly Bear"). */
const foeName = (mobileType) => enemyDisplayName(mobileType) ?? 'body';

/**
 * WHAT E DOES AT A BODY, and the prompt that says it: `{ harvest, verb, rest, ready }` - `ready` false with `rest`
 * naming what is missing (skinned, being counted, the ground the knife never works - AUDIT 32 H4, the account's rare
 * hides, the rank, the Stores' room - CAP-OFF: no day's cap); a rank short carries the rank it needs (VEIN-NEED). `loot` - the choice key's
 * pick: the body's loot, the press handed on. `where` - the knife's ground refusal (KNIFE_WHERE_WORDS), or null;
 * `steep` - the body lies under the player's feet, its line below the look's reach (AUDIT 32 H7).
 * @param {{ body: any, taken: boolean, counting: boolean, rank: number, storesFull: (key: string) => boolean,
 *   high: number, loot?: boolean, where?: string|null, steep?: boolean, fullWords?: string, held?: boolean, skinned?: boolean, pending?: boolean }} o
 */
export function huntPlan({ body, taken, counting, rank, storesFull, high, loot = false, where = null, steep = false, fullWords = 'Stores full', held = false, skinned = false, pending = false }) {   // BAG1: `fullWords` the book's; PARTY-SKIN: another's live lease, a skin by anyone, an authority not heard
  const name = foeName(body.foe);
  const harvest = 'hide';
  const verb = `Skin the ${name}`;
  const rankWord = `Hunting ${rank}`;
  if (loot) return { harvest, verb: `Search the ${name}`, rest: '', ready: false, loot: true };
  if (taken || skinned) return { harvest, verb: `The ${name} - skinned`, rest: '', ready: false };
  if (held) return { harvest, verb, rest: 'being skinned', ready: false };
  if (pending) return { harvest, verb, rest: 'waiting', ready: false };
  if (counting) return { harvest, verb, rest: 'being counted', ready: false };
  if (where) return { harvest, verb, rest: where, ready: false };
  if (steep) return { harvest, verb, rest: 'step back', ready: false };
  if (body.tier >= HIGH_HIDE_TIER && high >= HIGH_HIDES_PER_DAY) return { harvest, verb, rest: `${high} of ${HIGH_HIDES_PER_DAY} rare hides today`, ready: false, full: true };
  if (!tierOpen(rank, body.tier)) return { harvest, verb, rest: `needs Hunting ${TIER_RANKS[body.tier - 1]}`, ready: false, needsRank: TIER_RANKS[body.tier - 1] };
  if (storesFull(body.hide)) return { harvest, verb, rest: `${fullWords} - ${materialLabel(body.hide)}`, ready: false };
  return { harvest, verb, rest: rankWord, ready: true };
}

/**
 * HUNTING'S KIND in the gathering host (scenes/gatherHost.js): the stamped bodies as loose nodes, the plan, the act.
 * @param {{ book: any, bodies: () => any[], openLoot?: ((key: string) => void)|null }} deps `bodies` the stamped bodies where
 *   the player is (bodiesOf over the street's pool or the dungeon's); `openLoot(key)` - AUDIT 32 H8: the pool's own door to
 *   a body's loot by its key, which the choice key's search opens (never the ray's: at the edge of the look it missed the
 *   corpse's box, and E opened nothing); without it the press is passed on, AUDIT 29 C1's way
 * @returns {import('./gatherHost.js').GatherKind}
 */
export function huntKind({ book, bodies, openLoot = null }) {
  /** Whether a body may be searched: its loot's key, where the world opens loot by key (an emptied body none). */
  const searchable = (b) => !openLoot || !!b?.lootKey?.();
  /** PARTY-SKIN: the skin handles of the claims this player made, by the body's key (a refused harvest reopens its body). */
  const claimed = new Map();
  return {
    id: 'body',
    professions: Object.freeze(['hunting']),
    nodesOf: () => [],
    /** A body is a node only while the pack holds a Skinning Knife. */
    looseNodesOf: ({ entity }) => { const all = bodies(); return foragingToolIn(entity, SKINNING_KNIFE.templateIndex) ? all : []; },   // PARTY-SKIN: the bodies are read (and their first sight kept) with or without a knife
    flatsOf: () => [],   // the body is its own picture (DFU's corpse)
    gone: (b) => goneIn(book, b.key, 'hide'),   // GATHER-SPEED: or being counted
    mark: (b) => (goneIn(book, b.key, 'hide') || ['skinned', 'mineSkinned'].includes(b.skin?.view()) ? null : BODY_MARK),   // PARTY-SKIN: none once anyone has skinned it   // NODE-MARKS: a body the knife may still skin
    marksLoose: true,
    /** TOUCH-HOLD (2026-10-01 part four - Mac: "Interact button + knife Use"): the Skinning Knife's Use at a body is E
     *  there (TOOL-USE) - a phone and a pad had no E to start Hunting with, nor to hold while the line was drawn. */
    tools: Object.freeze([SKINNING_KNIFE.templateIndex]),
    /** PROF-MENU: the menu's title - the foe the body is. */
    nodeName: (b) => foeName(b.foe),
    plan(b, { rank, pitch = null }) {
      const hunt = book.state.hunt ?? { hides: 0, high: 0 };
      const view = b.skin?.view() ?? null;   // PARTY-SKIN
      const plan = huntPlan({
        body: b, held: view === 'held', skinned: view === 'skinned' || view === 'mineSkinned', pending: view === 'pending', taken: book.taken(b.key, 'hide'), counting: book.counting(b.key, 'hide'), rank: rank('hunting'),
        storesFull: (key) => storesFullIn(book, key), fullWords: fullWordsIn(book), high: hunt.high ?? 0,   // STORES-ROOM: every origin, as the service counts
        where: actChecksRefusal(KNIFE_WHERE, KNIFE_WHERE_WORDS),   // AUDIT 32 H4: a settlement or the sea - E the loot's
        steep: Number.isFinite(pitch) && pitch < BODY_STEEPEST_DEG,   // AUDIT 32 H7: stood over, its line out of the look's reach
      });
      return { ...plan, profession: 'hunting' };
    },
    /** PROF-MENU (2026-10-01, Mac: "use the same menu the loot menu uses"): THE BODY'S TWO ACTS AS THE MENU'S ROWS - the
     *  knife and the search (the act choice key's toggle, retired). The search opens the body's own loot by its key (AUDIT
     *  32 H8), or - with no door by key - hands the press on to the ray's corpse (AUDIT 29 C1); an emptied body has none. */
    rows(b, ctx) {
      const skin = { ...this.plan(b, ctx), id: 'hide' };
      if (!searchable(b)) return [skin];
      const key = openLoot ? b.lootKey() : null;
      const search = huntPlan({ body: b, taken: false, counting: false, rank: 0, storesFull: () => false, high: 0, loot: true });
      return [skin, { ...search, profession: 'hunting', id: 'search', ...(key ? { open: () => openLoot?.(key) } : {}) }];
    },
    start(b, plan, { entity, rank, keyLabel, tool = null, byPress = false }) {
      const used = tool ?? (byPress || null);   // PROF-MENU: a click's or a list's press holds the knife as its Use does
      const refusal = actChecksRefusal(KNIFE_CHECKS, KNIFE_REFUSALS);
      if (refusal) return { refused: refusal };
      const act = createTraceAct({
        tier: b.tier, rank: rank('hunting'),
        band: knifeBand({ intelligence: liveStat(entity, 'intelligence'), agility: liveStat(entity, 'agility') }),
        gentle: getPref('gentleActs') === true,
        hold: b.skin ? () => !b.skin.mineSkinned() : undefined,   // PARTY-SKIN: no hide is asked before the authority has marked the body skinned to this claim
      });
      if (b.skin) {   // PARTY-SKIN: the claim is made as the act starts, and held while it lives
        claimed.set(b.key, b.skin);
        while (claimed.size > 16) claimed.delete(claimed.keys().next().value);
        b.skin.claim({ alive: () => !act.state.cancelled && !act.state.done, ended: () => act.state.waiting === true, onLost: () => act.cancel() });
      }
      return {
        act,
        // the key the meter says to hold - TOUCH-HOLD: none when the knife's Use holds it, as the Sickle's holds the steady
        // hand (the crosshair drawn by the mouse, the right stick or a finger's swipe, no key held)
        harvest: plan.harvest, tool: foragingToolIn(entity, SKINNING_KNIFE.templateIndex), profession: 'hunting', label: used ? '' : keyLabel('Interact'),
        heldByUse: !!used,
        ask: { foe: b.foe },   // the harvest names the foe the body is (PROF0 6: the tier is the client's claim)
        material: b.hide,   // AUDIT BAG1 B4: the hide the foe gives, for the held count
        hand: (a) => (a.tool ? KNIFE_HAND : null),
      };
    },
    /** PARTY-SKIN: a harvest the service refused outright wrote no row - the body is open again for everyone (the skin handle ignores the answers that are no word). */
    refused: (key, error) => { const sk = claimed.get(key); claimed.delete(key); sk?.refused(error); },
    /** The account's day, as the chip says it: its hides today (CAP-OFF: against no cap). */
    tally: () => ({ n: book.state.hunt?.hides ?? 0 }),
    cleanNote: () => ' (a clean pelt)',
    /** AUDIT 32 P10: the trace's end said - a clean pelt, a torn one (its part lost), or a true line drawn too quick or
     *  too slow to be clean; a torn pelt and a mistimed one went unsaid. */
    actNote: (rep) => {
      if (!rep) return '';
      if (rep.clean) return ' (a clean pelt)';
      if (rep.torn) return ' (a torn pelt - its part lost)';
      if (rep.score >= TRACE_ACT.clean) return rep.seconds < TRACE_ACT.minS ? ' (a true line, too quick for a clean pelt)' : ' (a true line, too slow for a clean pelt)';
      return '';
    },
    title: () => 'Hunter',
  };
}
