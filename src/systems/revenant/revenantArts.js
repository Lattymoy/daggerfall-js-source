// @ts-check
// RVN-ARTS (2026-10-17, the owner: "Give revenants the chance to have unique telegraphed abilities, magic abilities like
// healing or other buffs, etc (Must be balanced)") - A REVENANT'S ART. One revenant in ARTS_CHANCE is born with an art,
// drawn on its id from its family's pool (revenantFeud.js signatureFamily - a blade, a beast, a brute, or the casters and
// the rest), so it is the same on every read, every load and every client, and an older record has the one its id draws.
// Every art has two halves: what it does to the player while it hunts them, and what it does for them once it is sworn.
//
//   art      | hostile (from ART_RANK, the Enhanced AI switch on - a telegraph)    | sworn (any rank)
//   ---------+---------------------------------------------------------------------+-------------------------------------
//   Mending  | under MEND.AT of its health, once a fight: a CHANNEL - its colour's  | a hurt leaves me under SWORN_MEND.AT:
//            | disc about its own feet; any blow that lands on it breaks it;        | it heals me SHARE + PER_RANK a rank
//            | whole, it heals MEND.HEAL of its health                              | of my health, every COOLDOWN s
//   Ward     | under WARD.AT, once a fight: a channel; whole, WARD.SECONDS of       | it goes into a fight: a Shield on me,
//            | blows taken at WARD.TAKEN (never past an adaptation's floor; never   | BASE + PER_RANK a rank, every COOLDOWN
//            | its weakness)                                                       |
//   War Cry  | as it joins the fight, once: a channel; whole, it and its band strike| it goes into a fight: Fortify Strength
//            | CRY.BLOWS harder for CRY.SECONDS                                     | BASE + PER_RANK a rank, every COOLDOWN
//   Siphon   | a lane at me (the charge's shape); caught, a blast of magic at the   | its foe's health drawn (the pyre's,
//            | pyre's weight, and it drinks what it dealt                           | at my level) and a third to me
//   Barrage  | three discs at my feet, each re-aimed as it is cast; caught, each a  | its foe struck at x BARRAGE
//            | blast of its element                                                 |
//   Nova     | a ring where it stands as it casts (safe at the ring's heart, for    | every hostile foe about it struck
//            | the one who backs off); caught, a blast of its element               |
//
// THE LANGUAGE OF THE GROUND (Feud-Arc.md's): a mark at MY feet or about it says MOVE; a disc about ITS feet in its art's
// colour says it is CHANNELLING - strike it (the disc goes where it goes). Its marks are the brain's own shapes
// (ai/blowShapes.js), laid on the ground they mark (foeBlows.js fitBlowToGround - AUDIT RVN B1, the brain's AUDIT TACT D8)
// and drawn by the ground's pass as any wind-up (ai/foeBlows.js liveBlows - its own key, kept fresh while its foe is
// stepped: a foe the pool stops stepping - a kneeling one, a dead one - has its marks cut at once, AUDIT RVN B4), and one
// wind-up near me at a time holds for them too: an art waits on any wind-up near me, and while one is live no foe winds
// another. A blast is a spell through the host's own door - my saving throw and resistances answer it, as the pyre's.
// A foe that cannot act (paralysed, held), a silenced one (every art but the cry - the rest are spells), or one at peace
// with me throws nothing, and what it had begun is cut (AUDIT RVN B2, B11).
//
// BALANCED: a hostile channel once a fight and broken by any harm; a telegraphed art COOLDOWN apart, each blast its
// multiple of the pyre's mean exactly (artSpell - AUDIT RVN B3: the pyre's own spell rounded a level's x0.6 up to x1), a
// barrage's three together lighter than the signature's x2 (SIG.MULT); a sworn one's gifts on cooldowns, its strikes the
// pyre's weight at my level by its rank, on hostile foes in reach and in sight. Owner-side, as the pyre is: a peer
// fighting my revenant sees its marks only in my game (FEUD WIRE carries none), and its ward and its cry are my game's
// alone (the wire's `rb` carries its blows' standing weight, never a cry's).
//
// RVN-STARS (Revenants.md section 44): a sworn one's Grave - `art` more weight on each of its gifts and strikes, `haste`
// a share off their cooldowns (swornArtNumbers - the page's words read the same; never the first strike's wait, which is
// no cooldown), and AWAKENED ART: one born without an art learns one of its family's pool, drawn on its id (taughtArt),
// for as long as its sky holds the star - at SWORN_TAUGHT of a born art's weight. AUDIT RVN-STARS S7 (lane E, measured:
// Awakened Art and the whole Grave lifted three companions' arts about five times over): a taught art is the lesser; the
// side mends once in half a Mending's cooldown however many mend (SWORN_MEND.SIDE); a Siphon gives a quarter of what it
// draws. Its hostile half never reads them - a hostile revenant has no oath.

import { idStream, signatureFamily, SIG, pyreElement, pyreSpell } from './revenantFeud.js';
import { makeBlow, setLiveBlow, shatterBlow, windupNear, inBlow, BLOW, BLOW_STALE, fitBlowToGround } from '../../ai/foeBlows.js';
import { tacticsNow } from '../../ai/tacticsClock.js';
import { tacticsSwitchOn } from '../../ai/tactics.js';
import { revenantById, revenantEvent } from './revenant.js';
import { healMine } from '../playerHeal.js';
import { t } from '../textManager.js';   // L10N4: its words through the text core
import { silenceBlocksCast } from '../mysticism.js';   // AUDIT RVN B2: a silenced revenant casts no art
import { rvnStatsOf, rvnAwakened } from './revenantStars.js';   // RVN-STARS: its Grave's stars

/** The arts. */
export const ARTS = Object.freeze(['mending', 'warding', 'warcry', 'siphon', 'barrage', 'nova']);
/** How many revenants are born with an art. */
export const ARTS_CHANCE = 0.35;
/** A hunting revenant shows its art from this rank (its signature's). */
export const ART_RANK = 2;
/** Each family's pool. */
export const ART_POOL = Object.freeze({
  blade: Object.freeze(['warding', 'warcry', 'siphon', 'mending']),
  beast: Object.freeze(['warcry', 'mending', 'nova']),
  brute: Object.freeze(['warcry', 'nova', 'warding']),
  caster: Object.freeze(['mending', 'warding', 'barrage', 'siphon', 'nova']),
});
/** Its art's name, in the player's language. */
export const ART_NAMES = Object.freeze({
  get mending() { return t('rvn.art.name.mending', 'Mending'); }, get warding() { return t('rvn.art.name.warding', 'Ward'); },
  get warcry() { return t('rvn.art.name.warcry', 'War Cry'); }, get siphon() { return t('rvn.art.name.siphon', 'Siphon'); },
  get barrage() { return t('rvn.art.name.barrage', 'Barrage'); }, get nova() { return t('rvn.art.name.nova', 'Nova'); },
});
/** The three that channel (a disc about its own feet, broken by a blow), and the three that are thrown at me. */
export const ART_CHANNELS = Object.freeze(['mending', 'warding', 'warcry']);
/** Every number, hostile then sworn. The thrown three's weights are on the pyre's blast (SIG.PYRE_BASE, SIG.PYRE_PER a
 *  level) - SIG.MULT is the signature's. */
export const ART_LAW = Object.freeze({
  MEND: Object.freeze({ AT: 0.5, CHANNEL: 2.0, HEAL: 0.2 }),
  WARD: Object.freeze({ AT: 0.75, CHANNEL: 1.5, TAKEN: 0.65, SECONDS: 10 }),
  CRY: Object.freeze({ REACH: 20, CHANNEL: 1.0, BLOWS: 1.2, SECONDS: 12 }),
  SIPHON: Object.freeze({ REACH: 8.5, WINDUP: 1.3, MULT: 1.0 }),
  BARRAGE: Object.freeze({ REACH: 12, WINDUP: 1.1, STEP: 0.45, COUNT: 3, MULT: 0.6 }),
  NOVA: Object.freeze({ REACH: 3.8, WINDUP: 1.4, MULT: 1.2 }),
  COOLDOWN: Object.freeze([14, 20]),
  FIRST: Object.freeze([3, 6]),
  SWORN_MEND: Object.freeze({ AT: 0.4, SHARE: 0.12, PER_RANK: 0.02, COOLDOWN: 120, SIDE: 0.5 }),
  SWORN_TAUGHT: 0.75,
  SWORN_WARD: Object.freeze({ BASE: 6, PER_RANK: 3, ROUNDS: 6, COOLDOWN: 90 }),
  SWORN_CRY: Object.freeze({ BASE: 4, PER_RANK: 2, ROUNDS: 6, COOLDOWN: 90 }),
  SWORN_STRIKE: Object.freeze({ COOLDOWN: Object.freeze([16, 22]), SIPHON: 1.0, SIPHON_HEAL: 1 / 4, BARRAGE: 1.5, NOVA: 0.8, NOVA_REACH: 5, REACH: 12, RANK: Object.freeze([0.5, 0.1]) }),
});
/** Each art's colour on the ground - never the ember or the iron red a blow wears. */
export const ART_COLORS = Object.freeze({
  mending: Object.freeze([0.3, 0.9, 0.5]), warding: Object.freeze([0.35, 0.6, 1.0]), warcry: Object.freeze([1.0, 0.82, 0.25]),
  siphon: Object.freeze([0.85, 0.15, 0.45]), barrage: Object.freeze([0.7, 0.35, 1.0]), nova: Object.freeze([0.6, 0.9, 1.0]),
});
/** The blow classes a ward takes less of (RVN2's - adaptBlowClass). */
const WARD_CLASSES = Object.freeze(['blade', 'blunt', 'axe', 'h2h', 'arrow']);

/** Its family's pool of arts (revenantFeud.js signatureFamily - the casters' for the rest). */
const artPool = (mobileType) => ART_POOL[signatureFamily(mobileType) ?? 'caster'];
/** ITS ART, drawn on its id: one in ARTS_CHANCE, from its family's pool; else null. */
export function drawArt(id, mobileType) {
  if (typeof id !== 'string' || !id || !Number.isInteger(mobileType)) return null;
  const rolls = idStream(id, 'art');
  if (rolls() >= ARTS_CHANCE) return null;
  const pool = artPool(mobileType);
  return pool[Math.min(pool.length - 1, Math.floor(rolls() * pool.length))];
}
/** RVN-STARS: THE ART AWAKENED in one born without - its family's pool, drawn on its id (its own stream, so the same on
 *  every read); null for an unknown kind. */
export function taughtArt(id, mobileType) {
  if (typeof id !== 'string' || !id || !Number.isInteger(mobileType)) return null;
  const pool = artPool(mobileType);
  return pool[Math.min(pool.length - 1, Math.floor(idStream(id, 'art:taught')() * pool.length))];
}
/** A record's art - derived, never stored: the one it was born with, else (RVN-STARS) the one Awakened Art taught it. */
export const artOf = (r) => drawArt(r?.id, r?.mobileType) ?? (rvnAwakened(r) ? taughtArt(r.id, r.mobileType) : null);
/** RVN-STARS: A SWORN ONE'S ART IN NUMBERS, its rank's and its Grave's: Mending's share and cooldown, Ward's and War Cry's
 *  points and cooldown, its strikes' weight (x the pyre's) and their cooldown's span - the steps and the page read these. */
export function swornArtNumbers(r) {
  const rank = Math.max(1, Math.min(5, r?.rank | 0)), st = rvnStatsOf(r), quick = 1 - st.haste;
  const more = (1 + st.art) * (drawArt(r?.id, r?.mobileType) ? 1 : ART_LAW.SWORN_TAUGHT);   // AUDIT RVN-STARS S7: a taught art the lesser
  const S = ART_LAW.SWORN_STRIKE;
  return {
    mendShare: (ART_LAW.SWORN_MEND.SHARE + ART_LAW.SWORN_MEND.PER_RANK * rank) * more, mendCooldown: ART_LAW.SWORN_MEND.COOLDOWN * quick,
    wardPoints: Math.round((ART_LAW.SWORN_WARD.BASE + ART_LAW.SWORN_WARD.PER_RANK * rank) * more), wardCooldown: ART_LAW.SWORN_WARD.COOLDOWN * quick,
    cryPoints: Math.round((ART_LAW.SWORN_CRY.BASE + ART_LAW.SWORN_CRY.PER_RANK * rank) * more), cryCooldown: ART_LAW.SWORN_CRY.COOLDOWN * quick,
    weight: (S.RANK[0] + S.RANK[1] * rank) * more, strikeCooldown: [S.COOLDOWN[0] * quick, S.COOLDOWN[1] * quick],
  };
}
/** The pyre's blast at `level`, its mean, x `mult` - the weight of a thrown art. */
export const artMagnitude = (level, mult) => ((SIG.PYRE_BASE[0] + SIG.PYRE_BASE[1]) / 2 + SIG.PYRE_PER * Math.max(1, level | 0)) * mult;
/** AUDIT RVN B3: A THROWN ART'S BLAST - the pyre's spell (revenantFeud.js pyreSpell: its element, at range, the save
 *  answering it) with its magnitude whole at `level`: the pyre's range plus its level's, x `mult`, and no per-level term
 *  for the cast to round (pyreSpell rounds SIG.PYRE_PER x `mult` - every multiple from 0.5 to 1.5 was the pyre's own
 *  level's). Its mean is artMagnitude(level, mult). */
export function artSpell(name, element, level, mult) {
  const lv = Math.max(1, level | 0), base = pyreSpell(name, element, /** @type {any} */ (1));   // its shape; the magnitudes are set below
  const lo = Math.round((SIG.PYRE_BASE[0] + SIG.PYRE_PER * lv) * mult), hi = Math.round((SIG.PYRE_BASE[1] + SIG.PYRE_PER * lv) * mult);
  return Object.freeze({ ...base, effects: [{ ...base.effects[0], magnitudeBaseLow: lo, magnitudeBaseHigh: hi, magnitudeLevelBase: 0, magnitudeLevelHigh: 0 }, ...base.effects.slice(1)] });
}

/** What its art does - the page's words, by its side. */
export function artWords(r, { sworn = !!r?.sworn } = {}) {
  const art = artOf(r);
  if (!art) return null;
  const n = ART_NAMES[art];
  if (sworn) {
    const A = swornArtNumbers(r);   // RVN-STARS: its rank's and its Grave's
    switch (art) {
      case 'mending': return t('rvn.art.sworn.mendingSecs', 'Art: {n} - when you fall under {at} of your health it heals {share} of it (every {s} seconds).', { n, at: pct(ART_LAW.SWORN_MEND.AT), share: pct(A.mendShare), s: Math.round(A.mendCooldown) });   // AUDIT RVN-STARS S9: seconds, as the Ward's and the War Cry's - a minute and a half read as a minute
      case 'warding': return t('rvn.art.sworn.warding', 'Art: {n} - as it goes into a fight it shields you for {points} (every {s} seconds).', { n, points: A.wardPoints, s: Math.round(A.wardCooldown) });
      case 'warcry': return t('rvn.art.sworn.warcry', 'Art: {n} - as it goes into a fight your Strength rises by {points} (every {s} seconds).', { n, points: A.cryPoints, s: Math.round(A.cryCooldown) });
      case 'siphon': return t('rvn.art.sworn.siphonShare', 'Art: {n} - now and then it draws its foe\'s life and gives you {share} of it.', { n, share: pct(ART_LAW.SWORN_STRIKE.SIPHON_HEAL) });   // AUDIT RVN D13: its share, its constant's
      case 'barrage': return t('rvn.art.sworn.barrage', 'Art: {n} - now and then it looses a barrage on its foe.', { n });
      default: return t('rvn.art.sworn.nova', 'Art: {n} - now and then it strikes every foe about it.', { n });
    }
  }
  const young = (r.rank | 0) < ART_RANK, on = tacticsSwitchOn(), from = ROMAN[ART_RANK];   // AUDIT RVN D13: the rank its constant's
  const below = young ? (on ? t('rvn.art.note.fromRank', ' (from Rank {rank})', { rank: from }) : t('rvn.art.note.fromRankSwitch', ' (from Rank {rank}, with Enhanced AI)', { rank: from })) : on ? '' : t('rvn.art.note.switch', ' (with Enhanced AI)');
  switch (art) {
    case 'mending': return t('rvn.art.hunt.mending', 'Art: {n} - when hurt, it gathers itself to heal. Strike it to break the spell{below}.', { n, below });
    case 'warding': return t('rvn.art.hunt.warding', 'Art: {n} - when hurt, it raises a ward against your blows. Strike it to break the spell{below}.', { n, below });
    case 'warcry': return t('rvn.art.hunt.warcry', 'Art: {n} - it roars as the fight begins, and it and its band strike harder. Strike it to cut the roar short{below}.', { n, below });
    case 'siphon': return t('rvn.art.hunt.siphon', 'Art: {n} - a beam that drains your life. Step out of its line{below}.', { n, below });
    case 'barrage': return t('rvn.art.hunt.barrageCount', 'Art: {n} - {count} blasts at your feet, one after another. Keep moving{below}.', { n, count: ART_LAW.BARRAGE.COUNT, below });
    default: return t('rvn.art.hunt.novaRing', 'Art: {n} - a ring bursts where it stands. Step out of it, or into its center{below}.', { n, below });
  }
}
const pct = (x) => `${Math.round(x * 100)}%`;
const ROMAN = Object.freeze(['', 'I', 'II', 'III', 'IV', 'V']);
const U = (lo, hi, rolls) => lo + rolls() * (hi - lo);

// ── the hostile half: the pools' frame ──────────────────────────────
/** A blow's key in the ground's registry (ai/foeBlows.js liveBlows) - its own, never the foe's brain's - kept fresh
 *  (`_tac.seen`) while its foe is stepped, so a dead foe's mark goes as a dead foe's wind-up does. */
const keyFor = (now) => ({ _tac: { seen: now } });
const yawTo = (from, to) => Math.atan2(to[0] - from[0], to[2] - from[2]);
const flat = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
/** A foe that may throw its art now: a hostile revenant of the rank, not running, kneeling, judged, roaring or scattering,
 *  nobody else's puppet, alive, able to act (AUDIT RVN B2: a paralysed or held foe - the motor's CanAct - holds nothing,
 *  as the brain's own wind-up does) and at war with me (AUDIT RVN B11). */
function mayArt(f) {
  const e = f?.entity, rev = e?.revenant;
  if (!rev?.id || rev.sworn || f.dead || f.puppet || !(e.health > 0)) return false;
  if (f.fleeing || f.scattering || f.yielded || f.roaring || f.executing || f.sparing || f._knockedOut || e.team === 'PlayerAlly') return false;
  if (f.ai?.canAct === false || f.ai?.isHostile === false) return false;
  return (rev.rank | 0) >= ART_RANK;
}
/** Its art's state on the pool's record, made once a stand. */
const stateOf = (f, art) => (f._art ??= { art, used: {}, ready: null, live: null, seen: 0, wardUntil: 0, wardWas: null, wardOn: null, cryUntil: 0, cryBand: [], called: false });

/**
 * THE HOSTILE ART, a frame of it (each pool's foe loop, beside the signature's - scenes/exteriorFoes.js, scenes/dungeonContext.js):
 * `feet` my feet in the pool's frame; `ctx` the pool's door, made once a stand (AUDIT RVN B12: nothing made per foe per
 * frame) - `onMe()` whether its fight is with me; `strike(spell)` a spell at me through the host's door (my save answers
 * it), answering the health it took from me; `say(ev)` an event said (its card, else its line); `sfx(element, at)` a
 * cast's sound; `foes()` the pool's live records (its band). Answers what happened this frame ('start', 'broken',
 * 'landed', 'hit', 'missed') or null.
 * @param {any} f @param {number[]|null} feet @param {{ onMe?: () => boolean, strike: (spell: any) => (number|void), say?: (ev: any) => void, sfx?: (element: number, at: number[]) => void, foes?: () => any[], rolls?: () => number }} ctx
 */
export function revenantArtFrame(f, feet, ctx) {
  const now = tacticsNow();
  const e = f?.entity, rev = e?.revenant;
  const s = f?._art ?? null;
  if (s?.live && now - s.seen > BLOW_STALE) endLive(s, now, true);   // AUDIT RVN B4: frames it was not stepped (kneeling, held) - its marks cut, never landed late
  if (s) { s.seen = now; stepTimers(f, s, now); }
  if (!mayArt(f) || !tacticsSwitchOn() || !feet) { if (s?.live) endLive(s, now, true); return null; }
  const art = drawArt(rev.id, f.mobileType ?? e.mobileType);
  if (!art) return null;
  if (art !== 'warcry' && silenceBlocksCast(e)) { if (s?.live) endLive(s, now, true); return null; }   // AUDIT RVN B2: silenced - a spell's art is cut
  const st = stateOf(f, art);
  st.seen = now;
  const rolls = ctx.rolls ?? Math.random;
  const at = f.ai?.feet;
  if (!at) return null;
  if (st.live) return liveStep(f, st, now, ctx, feet);
  const engaged = !!f.ai?.detected && !!f.ai?.inSight && (ctx.onMe?.() ?? true);
  if (!engaged) return null;
  if (st.ready == null) st.ready = now + U(ART_LAW.FIRST[0], ART_LAW.FIRST[1], rolls);
  if (windupNear(feet, now)) return null;   // one wind-up near me at a time - its own brain's too
  const d = flat(at, feet), hp = e.health / Math.max(1, e.maxHealth || 1);
  const yaw = yawTo(at, feet);
  if (art === 'mending' && !st.used.mending && hp < ART_LAW.MEND.AT) return channel(f, st, now, ART_LAW.MEND.CHANNEL, ctx);
  if (art === 'warding' && !st.used.warding && hp < ART_LAW.WARD.AT) return channel(f, st, now, ART_LAW.WARD.CHANNEL, ctx);
  if (art === 'warcry' && !st.used.warcry && d <= ART_LAW.CRY.REACH) return channel(f, st, now, ART_LAW.CRY.CHANNEL, ctx);
  if (now < st.ready) return null;
  if (art === 'siphon' && d <= ART_LAW.SIPHON.REACH) return thrown(f, st, now, [{ kind: 'charge', origin: at, yaw, windup: ART_LAW.SIPHON.WINDUP, at: now }], ctx, feet);
  if (art === 'nova' && d <= ART_LAW.NOVA.REACH + 1) return thrown(f, st, now, [{ kind: 'ring', origin: at, yaw, windup: ART_LAW.NOVA.WINDUP, at: now }], ctx, feet);
  if (art === 'barrage' && d <= ART_LAW.BARRAGE.REACH) {
    const marks = [];
    for (let i = 0; i < ART_LAW.BARRAGE.COUNT; i++) marks.push({ kind: 'pyre', aimed: true, windup: ART_LAW.BARRAGE.WINDUP, at: now + i * ART_LAW.BARRAGE.STEP });
    return thrown(f, st, now, marks, ctx, feet);
  }
  return null;
}
/** A channel begun: its colour's disc about its own feet, for `seconds`; any blow that lands breaks it. */
function channel(f, st, now, seconds, ctx) {
  const b = makeBlow('pyre', f.ai.feet, f.ai.yaw ?? 0, now, ART_COLORS[st.art], 'poise', seconds);
  /** @type {any} */ (b).ahead = 0;
  /** @type {any} */ (b).art = st.art;
  fitBlowToGround(b, f.ai.collider);   // AUDIT RVN B1: on the ground it marks
  const key = keyFor(now);
  setLiveBlow(key, b);
  st.live = { channel: true, hp: f.entity.health, land: b.land, marks: [{ key, blow: b, landed: false, at: now }] };
  st.used[st.art] = true;
  call(f, st, ctx, 'start');
  ctx.sfx?.(4, f.ai.feet);
  return 'start';
}
/** A thrown art begun: its marks, each made at its own `at` (a barrage's later ones re-aimed at my feet then). */
function thrown(f, st, now, marks, ctx, feet) {
  st.live = { channel: false, marks: marks.map((m) => ({ ...m, key: null, blow: null, landed: false })) };
  st.ready = now + U(ART_LAW.COOLDOWN[0], ART_LAW.COOLDOWN[1], ctx.rolls ?? Math.random);
  liveStep(f, st, now, ctx, feet);
  call(f, st, ctx, 'start');
  ctx.sfx?.(element(f, st.art), f.ai.feet);
  return 'start';
}
/** The element a thrown art blasts in: a siphon's magic, the rest its kind's (the pyre's). */
const element = (f, art) => (art === 'siphon' ? 4 : pyreElement(f.mobileType ?? f.entity?.mobileType));
/** Its art called out - the first one a stand (its card); a broken channel each time. */
function call(f, st, ctx, what) {
  const r = revenantById(f.entity?.revenant?.id);
  if (!r || !ctx.say) return;
  const n = ART_NAMES[st.art];
  if (what === 'start') {
    if (st.called) return;
    st.called = true;
    const body = ART_CHANNELS.includes(st.art) ? t('rvn.art.call.channel', 'Strike it to break the spell!') : st.art === 'siphon' ? t('rvn.art.call.siphon', 'Step out of its line!') : st.art === 'nova' ? t('rvn.art.call.nova', 'Step away from it!') : t('rvn.art.call.barrage', 'Keep moving!');
    ctx.say(revenantEvent('art', r, { body, line: t('rvn.art.call.line', '{given} calls on its {n}! {body}', { given: r.given, n, body }) }));
  } else if (what === 'broken') ctx.say(revenantEvent('art', r, { body: t('rvn.art.broken.body', 'Its {n} is broken.', { n }), line: t('rvn.art.broken.line', '{given}\'s {n} is broken!', { given: r.given, n }) }));
}
/** A live art's frame: its marks kept fresh, made and landed; a channel broken by a blow. */
function liveStep(f, st, now, ctx, feet) {
  const L = st.live;
  let out = null;
  for (const m of L.marks) {
    if (!m.blow && now >= m.at) {
      const origin = f.ai.feet, yaw = yawTo(origin, feet);
      const b = makeBlow(m.kind, origin, yaw, now, ART_COLORS[st.art], 'poise', m.windup);
      if (m.aimed) /** @type {any} */ (b).ahead = Math.min(BLOW.pyre.range, flat(origin, feet));
      /** @type {any} */ (b).art = st.art;
      fitBlowToGround(b, f.ai.collider);   // AUDIT RVN B1: on the ground it marks - a stair's, a hill's
      m.blow = b; m.key = keyFor(now);
      setLiveBlow(m.key, b);
    }
    if (m.key) m.key._tac.seen = now;
  }
  if (L.channel) {
    // AUDIT RVN B10: broken by any harm since the last frame - a heal between raises the line, never hides a blow
    if (!L.marks[0].landed && f.entity.health < L.hp - 1e-6) {   // struck: broken - its disc shatters
      for (const m of L.marks) if (m.key) shatterBlow(m.key, now);
      st.live = null;
      call(f, st, ctx, 'broken');
      return 'broken';
    }
    L.hp = f.entity.health;
    const m = L.marks[0];
    const b = m.blow, here = f.ai.feet;
    if (b && (b.origin[0] !== here[0] || b.origin[2] !== here[2])) {   // AUDIT RVN B9: its disc about its feet, wherever they go
      b.origin[0] = here[0]; b.origin[1] = here[1]; b.origin[2] = here[2];
      fitBlowToGround(b, f.ai.collider);
    }
    if (!m.landed && now >= m.blow.land) { m.landed = true; resolveChannel(f, st, now, ctx); out = 'landed'; }
  } else {
    for (const m of L.marks) {
      if (!m.blow || m.landed || now < m.blow.land) continue;
      m.landed = true;
      const hit = inBlow(m.blow, feet[0], feet[2]);
      out = hit ? 'hit' : (out ?? 'missed');
      if (hit) landOnMe(f, st, ctx);
    }
  }
  if (L.marks.every((m) => m.landed) && L.marks.every((m) => now >= m.blow.land + 0.3)) endLive(st, now, false);
  return out;
}
/** A thrown art's blast on me: through the host's door (my save answers it); a siphon drinks what it drew - the health
 *  the door took from me (AUDIT RVN B10: a blast saved, resisted, absorbed or turned back draws nothing). */
function landOnMe(f, st, ctx) {
  const e = f.entity, lvl = e.level ?? 1;
  const mult = st.art === 'siphon' ? ART_LAW.SIPHON.MULT : st.art === 'barrage' ? ART_LAW.BARRAGE.MULT : ART_LAW.NOVA.MULT;
  const took = Number(ctx.strike(artSpell(ART_NAMES[st.art], element(f, st.art), lvl, mult)));
  if (st.art === 'siphon' && took > 0) e.health = Math.min(e.maxHealth || e.health, e.health + Math.min(took, Math.round(artMagnitude(lvl, ART_LAW.SIPHON.MULT))));
}
/** A channel whole: its heal, its ward or its cry. */
function resolveChannel(f, st, now, ctx) {
  const e = f.entity, rev = e.revenant;
  if (st.art === 'mending') e.health = Math.min(e.maxHealth || e.health, e.health + Math.round((e.maxHealth || 0) * ART_LAW.MEND.HEAL));
  else if (st.art === 'warding' && rev?.edge && !st.wardWas) {
    st.wardWas = rev.edge;
    st.wardOn = rev;   // AUDIT RVN B8: the stamp it warded - a stamp made since (revenantDeed) keeps its own edge
    rev.edge = wardEdge(rev.edge);
    st.wardUntil = now + ART_LAW.WARD.SECONDS;
  } else if (st.art === 'warcry' && st.cryUntil === 0) {
    st.cryBand = [f, ...(ctx.foes?.() ?? []).filter((x) => x !== f && !x.dead && x.retinueOf === rev?.id && x.entity)];
    for (const x of st.cryBand) x.entity.damageScale = (Number.isFinite(x.entity.damageScale) && x.entity.damageScale > 0 ? x.entity.damageScale : 1) * ART_LAW.CRY.BLOWS;
    st.cryUntil = now + ART_LAW.CRY.SECONDS;
  }
}
/** Its ward's edge: every blow class at WARD.TAKEN or its adaptation's own less - never its weakness. */
export function wardEdge(edge) {
  /** @type {Record<string, number>} */
  const taken = { ...(edge?.taken ?? {}) };
  for (const cls of WARD_CLASSES) if (cls !== edge?.weak) taken[cls] = Math.min(taken[cls] ?? 1, ART_LAW.WARD.TAKEN);
  return Object.freeze({ ...(edge ?? {}), taken: Object.freeze(taken) });
}
/** Its ward and its cry run out. */
function stepTimers(f, s, now) {
  const rev = f?.entity?.revenant;
  if (s.wardWas && (now >= s.wardUntil || rev !== s.wardOn)) { if (rev && rev === s.wardOn) rev.edge = s.wardWas; s.wardWas = null; s.wardOn = null; }
  if (s.cryUntil > 0 && now >= s.cryUntil) {
    for (const x of s.cryBand) if (x.entity && Number.isFinite(x.entity.damageScale)) x.entity.damageScale /= ART_LAW.CRY.BLOWS;
    s.cryBand = []; s.cryUntil = -1;   // spent: once a fight
  }
}
/** A live art ended - its marks out of the registry (`cut`: a foe that may throw nothing now - its marks go at once). */
function endLive(st, now, cut) {
  if (!st.live) return;
  for (const m of st.live.marks) if (m.key) { if (cut && m.blow && now < m.blow.land) shatterBlow(m.key, now); else setLiveBlow(m.key, null); }
  st.live = null;
}

// ── the sworn half ──────────────────────────────────────────────────
/** A sworn one's art's own clock and fight, by its id. */
const _sworn = new Map();
const swornState = (id) => { let s = _sworn.get(id); if (!s) { s = { ready: 0, fighting: false, mendReady: 0 }; _sworn.set(id, s); } return s; };
/** A Shield (Alteration's, 35/255: its magnitude the pool) for `rounds` magic rounds - one more, as Eventide's. */
export const shieldBundle = (points, rounds) => ({
  name: ART_NAMES.warding, rangeType: 0, element: 4, icon: 0,
  effects: [{ type: 35, subType: 255, durationBase: rounds + 1, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1,
    magnitudeBaseLow: points, magnitudeBaseHigh: points, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 }],
});
/** Fortify Strength (9/0) by `points` for `rounds` magic rounds - one more. */
export const mightBundle = (points, rounds) => ({
  name: ART_NAMES.warcry, rangeType: 0, element: 4, icon: 0,
  effects: [{ type: 9, subType: 0, durationBase: rounds + 1, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1,
    magnitudeBaseLow: points, magnitudeBaseHigh: points, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 }],
});

/**
 * A SWORN ONE'S ART, a frame of it on its body (`rec` - the companion layer's; systems/revenant/revenantCompanions.js
 * swornFightStep, every frame): as it goes into a fight, its Ward or its War Cry on me; in a fight, its Siphon, Barrage or
 * Nova on its foe - through the scene's door (systems/playerDoor.js: my harm, a foe MY harm may reach - so it is MY harm,
 * as every power of mine the door lands: the foe it strikes may turn on me, its kill is mine, my renown and my set's
 * "each kill" powers answer it). AUDIT RVN B5, B7: only a hostile foe, never an ally of mine (a summon at my side, a
 * foe my tongue has calmed), within SWORN_STRIKE.REACH (a Nova its NOVA_REACH) and in sight (the door's `clear`); its
 * weight by its rank (SWORN_STRIKE.RANK - E8: rank V the pyre's whole). Mending answers a hurt (swornMendStep). Answers
 * what it did, or null.
 * @param {any} rec @param {any} r @param {any} door @param {{ rolls?: () => number, say?: (line: string) => void }} [o]
 */
export function swornArtStep(rec, r, door, { rolls = Math.random, say = null } = {}) {
  const art = artOf(r);
  if (!art || !r?.sworn || !door || !rec?.entity || rec.dead || rec._knockedOut || !(rec.entity.health > 0)) return null;
  const now = tacticsNow(), s = swornState(r.id);
  const aim = rec.ai?.target;   // AUDIT RVN B6: never `t` - the text core's own name (the ward's words threw)
  const tgt = aim?.entity && !aim.dead && aim.entity.health > 0 ? aim : null;
  const began = !!tgt && !s.fighting;
  s.fighting = !!tgt;
  const A = swornArtNumbers(r);   // RVN-STARS: its rank's and its Grave's
  if (art === 'warding' || art === 'warcry') {
    if (!began || now < s.ready) return null;
    const ward = art === 'warding';
    door.castOnPlayer?.(ward ? shieldBundle(A.wardPoints, ART_LAW.SWORN_WARD.ROUNDS) : mightBundle(A.cryPoints, ART_LAW.SWORN_CRY.ROUNDS));
    s.ready = now + (ward ? A.wardCooldown : A.cryCooldown);
    say?.(art === 'warding' ? t('rvn.art.sworn.wards', '{given} wards you.', { given: r.given }) : t('rvn.art.sworn.roars', '{given} roars, and your arm grows stronger.', { given: r.given }));
    return art;
  }
  if (art === 'mending' || !tgt) return null;
  if (began && s.ready < now) s.ready = now + U(ART_LAW.FIRST[0], ART_LAW.FIRST[1], rolls);
  if (now < s.ready) return null;
  const mine = new Set(door.foes?.() ?? []);
  const lvl = door.player?.()?.level ?? 1, S = ART_LAW.SWORN_STRIKE, weight = A.weight;
  const at = rec.ai?.feet;
  if (!at) return null;
  const sees = (x) => door.clear?.(at, x.ai.feet) !== false;
  if (art === 'nova') {
    const near = [...mine].filter((x) => fair(x, rec) && flat(x.ai.feet, at) <= S.NOVA_REACH && sees(x));
    if (!near.length) return null;
    for (const x of near) door.hurtFoe?.(x, Math.round(artMagnitude(lvl, S.NOVA) * weight));
  } else {
    if (!mine.has(tgt) || !fair(tgt, rec) || flat(tgt.ai.feet, at) > S.REACH || !sees(tgt)) return null;   // a foe MY harm may not reach (the town's defenders), at peace, far or behind a wall - its art waits
    const n = Math.round(artMagnitude(lvl, art === 'siphon' ? S.SIPHON : S.BARRAGE) * weight);
    door.hurtFoe?.(tgt, n);
    if (art === 'siphon') { const me = door.player?.(); if (me) healMine(me, n * S.SIPHON_HEAL); }
  }
  s.ready = now + U(A.strikeCooldown[0], A.strikeCooldown[1], rolls);
  return art;
}
/** A foe a sworn one's art may strike: alive, standing somewhere, hostile, never itself nor an ally of mine. */
const fair = (x, rec) => !!x?.ai?.feet && x !== rec && !x.dead && x.ai.isHostile !== false && x.entity?.team !== 'PlayerAlly';
/** AUDIT RVN-STARS S7: when the side may mend me again - one Mending in SWORN_MEND.SIDE of a Mending's cooldown, however
 *  many at my side mend. */
let _sideMendReady = 0;
/**
 * A SWORN ONE'S MENDING: a hurt that leaves me (`entity`, alive) under SWORN_MEND.AT of my health - the first sworn one at
 * my side whose art is Mending, whose body stands here (`standing(id)`) and whose own clock allows, heals me, and the side
 * mends no more for SIDE of its cooldown. `sworn` the sworn at my side. Answers the record that mended, or null.
 */
export function swornMendStep(entity, after, sworn, standing, { say = null } = {}) {
  if (!entity?.isPlayer || entity.peer || !(after > 0) || after >= (entity.maxHealth || 1) * ART_LAW.SWORN_MEND.AT) return null;
  const now = tacticsNow();
  if (now < _sideMendReady) return null;
  for (const r of sworn ?? []) {
    if (artOf(r) !== 'mending' || !standing?.(r.id)) continue;
    const s = swornState(r.id);
    if (now < s.mendReady) continue;
    const A = swornArtNumbers(r);   // RVN-STARS: its rank's and its Grave's
    healMine(entity, (entity.maxHealth || 0) * A.mendShare);
    s.mendReady = now + A.mendCooldown;
    _sideMendReady = now + A.mendCooldown * ART_LAW.SWORN_MEND.SIDE;
    say?.(t('rvn.art.sworn.mends', '{given} mends your wounds.', { given: r.given }));
    return r;
  }
  return null;
}
/** A sworn one's art clock forgotten (a load, a release) - or every one's. */
export function forgetSwornArt(id = null) { if (id == null) { _sworn.clear(); _sideMendReady = 0; } else _sworn.delete(id); }
/** Tests only. */
export function _resetArtsForTests() { _sworn.clear(); _sideMendReady = 0; }
