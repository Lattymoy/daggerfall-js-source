// @ts-check
// EG-FULL (2026-10-11, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md section 15): THE VESTIGES - what the
// Battlemages left in their Redoubts: run-only powers, three offered at every Redoubt from three families, one taken,
// ranked I -> II -> III by taking again; the Mastery Vestiges that change what a member does; the Accords two members'
// choices grant together; each family's capstone at three of its Vestiges (resonance); and THE TRUST LAW's caps -
//   a member's CLIENT-DECLARED damage factors together at most EG_BUCKET_X_MAX (1.25: the bucket grows by them),
//   the RELAY-ESTABLISHED ones at most EG_RELAY_X_MAX (1.6), and both together at most EG_BUCKET_ALL_MAX (1.6);
//   every Vestige's damage reduction together at most EG_DR_MAX (30%); the same aura from several holders the
//   strongest plus 2% each other, +6% at most.
//
// A member's Vestiges on the wire are `[id, rank]` pairs (rank 1-3); a Mastery its own id. Pure law: the tables, the
// offer's draw (the relay's rng), the factors. In the relay bundle. Not a DFU member. Ledger A (ELITE-GATES).
// EG-ZR (2026-10-12): the numbers section 15 gives no rank (Momentum's stack, Second Wind's and Bloodied Fury's lines, an
// Echo's share, Shield-Hymn's seconds, an Accord's reach) and Shield-Hymn's pair (egHymnOf), each declared once here - the
// holder's screen (systems/eliteGates/spireVestiges.js, scenes/eliteGates/egFight.js) and the relay's census (net/eliteGates/egBrain.js) import them.
// AUDIT EG III (2026-10-13, lane 1 #7 / lane 3 #10): SPIREBRIDGE BUILT - the Fellowship's Mastery was offered and applied
// nowhere; the room's rule is here (egSpirebridge: once a hall's span, the holder's ask, the next gap ahead of it, 6 s, said to
// the company), its plank the span law's (net/eliteGates/egSpanLaw.js egBridgeOf), ground on the relay's fair trail while it stands
// (net/eliteGates/egFair.js) and on every screen (scenes/eliteGates/egSpan.js).
// EG-ZS (2026-10-12): the capstones' and the Accords' numbers (Bladestorm's fifth blow and its reach, Spellweave's fourth spell,
// the reach "beyond 12 m", Hammer and Anvil's, Ambush's and Living Wall's shares, Kindled Steel's splash, an Echo's number)
// and THE PAIR LAW every Accord but Shield-Hymn is read by (egAccordMates), declared once here beside egHymnOf.

import { egBridgeAhead, EG_SB_MS } from './egSpanLaw.js';   // AUDIT EG III: Spirebridge's gap and its time (a leaf)

export const EG_V_FAMILIES = Object.freeze(['stone', 'blade', 'hunt', 'arcana', 'fellowship']);
export const EG_V_FAMILY_NAMES = Object.freeze({ stone: 'Stone', blade: 'Blade', hunt: 'Hunt', arcana: 'Arcana', fellowship: 'Fellowship' });
/** THE CAPS (section 15). */
export const EG_BUCKET_X_MAX = 1.25;
export const EG_RELAY_X_MAX = 1.6;
export const EG_BUCKET_ALL_MAX = 1.6;
export const EG_DR_MAX = 0.3;
export const EG_AURA_EXTRA = 0.02;
export const EG_AURA_EXTRA_MAX = 0.06;
/** Fade's cooldown (s), the Lean's first Redoubt, the most cards an offer holds. */
export const EG_FADE_CD_S = 8;
export const EG_OFFER_MAX = 6;
/** Three shards make a rank of a held Vestige, or a pick of two new ones. */
export const EG_SHARDS_PER = 3;
/** EG-ZR (section 15's numbers that are no rank's): Momentum's share a stack; the line Second Wind falls under; the line
 *  Bloodied Fury fights under; an Arcane Echo's share of the spell it repeats; how long Shield-Hymn's protection lasts (ms);
 *  how near two members stand for an Accord (m). */
export const EG_MOMENTUM_STEP = 0.04;
export const EG_SECOND_WIND_UNDER = 0.3;
export const EG_BLOODIED_UNDER = 0.5;
export const EG_ECHO_SHARE = 0.5;
export const EG_HYMN_MS = 4000;
export const EG_ACCORD_M = 10;
/** EG-ZS (section 15's capstones): Bladestorm strikes at every EG_STORM_N-th melee blow, every foe within EG_STORM_M (m) of its
 *  holder; Spellweave's every EG_WEAVE_N-th damage spell costs nothing; Long Sight and Deadeye read an arrow or a spell from
 *  beyond EG_FAR_M (m). */
export const EG_STORM_N = 5;
export const EG_STORM_M = 3;
export const EG_WEAVE_N = 4;
export const EG_FAR_M = 12;
/** EG-ZS (section 15's Accords): Hammer and Anvil's share on a marked foe, Ambush's on the first blow after a Fade, Living
 *  Wall's on a heal; Kindled Steel's splash (m). */
export const EG_HAMMER_X = 0.08;
export const EG_AMBUSH_X = 0.15;
export const EG_WALL_X = 0.1;
export const EG_KINDLED_M = 2;
/** EG-ZR, moved here by EG-ZS: an Arcane Echo is a blow of its own on the relay, numbered this far past the cast it repeats
 *  (scenes/eliteGates/egFight.js sends it; the relay knows an Echo by it and takes its share - net/eliteGates/egRun.js egEchoShare) - the bodies one
 *  cast meets share their echo's number as they share the cast's (the wire's `q` holds to 0x7fffffff). */
export const EG_ECHO_Q = 0x40000000;
/** AUDIT EG III (section 15's numbers, declared once - net/eliteGates/egRun.js, net/eliteGates/egBrain.js read them): Sweeping Arc splashes adds
 *  within EG_SWEEP_M (m) of its target; a mark (Hunter's Mark, Spotter) lasts EG_MARK_MS; Counterstroke's blow lands
 *  EG_COUNTER_X within EG_COUNTER_MS of a lord's blow landing within EG_COUNTER_M (m) of its holder; Spillover's overkill
 *  carries to an add within EG_SPILL_M (m) of the one it felled. */
export const EG_SWEEP_M = 3;
export const EG_MARK_MS = 8000;
/** AUDIT EG IV (lane10 #13): Spotter's share on a foe it spots - over any Hunter's Mark (net/eliteGates/egRun.js egMarkFoe). */
export const EG_SPOT_X = 0.1;
export const EG_COUNTER_MS = 600;
export const EG_COUNTER_X = 1.4;
export const EG_COUNTER_M = 6;
export const EG_SPILL_M = 6;

/**
 * EVERY VESTIGE: its number, family, name, its three ranks' values (`v`), what applies it (`by`: 'client' - the holder's
 * own body; 'relay' - the room, to a blow; 'word' - each client, from the room's word), its expected damage factor where
 * it is client-declared (`x` - the bucket's), and its line.
 */
/** @type {ReadonlyArray<{ id: number, key: string, fam: string, name: string, v: number[], by: string, x?: number[], aura?: number, line: (v: any) => string }>} */
export const EG_VESTIGES = Object.freeze([
  // STONE
  Object.freeze({ id: 0, key: 'stoneskin', fam: 'stone', name: 'Stoneskin', v: [0.10, 0.18, 0.25], by: 'client', line: (v) => `+${pc(v)} maximum health.` }),
  Object.freeze({ id: 1, key: 'ironfooting', fam: 'stone', name: 'Iron Footing', v: [0.35, 0.65, 1.0], by: 'client', line: (v) => `You are pushed ${pc(v)} less.` }),
  Object.freeze({ id: 2, key: 'secondwind', fam: 'stone', name: 'Second Wind', v: [0.15, 0.25, 0.35], by: 'client', line: (v) => `Once a hall, falling under ${pc(EG_SECOND_WIND_UNDER)} health heals you ${pc(v)}.` }),
  Object.freeze({ id: 3, key: 'bastion', fam: 'stone', name: 'Bastion', v: [0.04, 0.08, 0.12], by: 'word', aura: 6, line: (v) => `Allies within 6 m take ${pc(v)} less damage.` }),
  Object.freeze({ id: 4, key: 'oath', fam: 'stone', name: "Challenger's Oath", v: [1.5, 2, 2.5], by: 'relay', line: (v) => `Your threat x${v}, and lords' blows hurt you less.` }),
  // BLADE
  Object.freeze({ id: 5, key: 'searing', fam: 'blade', name: 'Searing Edge', v: [3, 6, 9], x: [1.04, 1.07, 1.10], by: 'client', line: (v) => `Melee hits deal +${v} fire damage.` }),
  Object.freeze({ id: 6, key: 'momentum', fam: 'blade', name: 'Momentum', v: [3, 4, 5], x: [1.05, 1.07, 1.09], by: 'client', line: (v) => `Each hit on one target adds ${pc(EG_MOMENTUM_STEP)} damage, up to ${v} times.` }),
  Object.freeze({ id: 7, key: 'sweeping', fam: 'blade', name: 'Sweeping Arc', v: [0.20, 0.35, 0.50], by: 'relay', line: (v) => `Melee hits splash ${pc(v)} of their damage onto adds within 3 m.` }),
  Object.freeze({ id: 8, key: 'bloodied', fam: 'blade', name: 'Bloodied Fury', v: [0.10, 0.18, 0.25], x: [1.03, 1.05, 1.07], by: 'client', line: (v) => `+${pc(v)} damage while under half health.` }),
  Object.freeze({ id: 9, key: 'culling', fam: 'blade', name: 'Culling Edge', v: [0.30, 0.45, 0.60], by: 'relay', line: (v) => `+${pc(v)} damage to adds under a quarter health.` }),
  // HUNT
  Object.freeze({ id: 10, key: 'longsight', fam: 'hunt', name: 'Long Sight', v: [0.08, 0.14, 0.20], by: 'relay', line: (v) => `Arrows and spells deal +${pc(v)} from beyond 12 m.` }),
  Object.freeze({ id: 11, key: 'featherstep', fam: 'hunt', name: 'Featherstep', v: [0.2, 0.35, 0.5], by: 'client', line: (v) => `Crumbling ground holds ${v} s longer under you, and falls cost less.` }),
  Object.freeze({ id: 12, key: 'fade', fam: 'hunt', name: 'Fade', v: [1.5, 2.5, 3.5], by: 'relay', line: (v) => `After you strike, adds lose track of you for ${v} s.` }),
  Object.freeze({ id: 13, key: 'huntersmark', fam: 'hunt', name: "Hunter's Mark", v: [0.05, 0.08, 0.12], by: 'relay', line: (v) => `Your first arrow from beyond 12 m marks a foe, and the company deals +${pc(v)} damage to it.` }),
  Object.freeze({ id: 14, key: 'fleetfoot', fam: 'hunt', name: 'Fleetfoot', v: [0.04, 0.07, 0.10], by: 'client', line: (v) => `Run speed +${pc(v)}.` }),
  // ARCANA
  Object.freeze({ id: 15, key: 'focus', fam: 'arcana', name: "Battlemage's Focus", v: [0.10, 0.18, 0.25], by: 'client', line: (v) => `Spell cost -${pc(v)}.` }),
  Object.freeze({ id: 16, key: 'overcharge', fam: 'arcana', name: 'Overcharge', v: [0.08, 0.14, 0.20], x: [1.08, 1.14, 1.20], by: 'client', line: (v) => `Spell damage +${pc(v)}.` }),
  Object.freeze({ id: 17, key: 'spellbane', fam: 'arcana', name: 'Spellbane', v: [10, 18, 25], by: 'client', line: (v) => `Every resistance +${v}.` }),
  Object.freeze({ id: 18, key: 'shieldweaver', fam: 'arcana', name: 'Shieldweaver', v: [0.20, 0.35, 0.50], by: 'client', line: (v) => `Your Shield spell absorbs ${pc(v)} more.` }),
  Object.freeze({ id: 19, key: 'echo', fam: 'arcana', name: 'Arcane Echo', v: [0.10, 0.16, 0.22], x: [1.05, 1.08, 1.11], by: 'client', line: (v) => `${pc(v)} of your damage spells repeat at half strength.` }),
  // FELLOWSHIP
  Object.freeze({ id: 20, key: 'rally', fam: 'fellowship', name: 'Rally', v: [0.08, 0.14, 0.20], by: 'word', line: (v) => `When a hall's door opens, the company heals ${pc(v)}.` }),
  Object.freeze({ id: 21, key: 'standard', fam: 'fellowship', name: "Spire's Standard", v: [0.04, 0.07, 0.10], by: 'relay', aura: 10, line: (v) => `Allies within 10 m deal +${pc(v)} damage.` }),
  Object.freeze({ id: 22, key: 'watchfire', fam: 'fellowship', name: 'Watchfire', v: [0.15, 0.25, 0.35], by: 'relay', line: (v) => `The company sees blows aimed near you ${v} s sooner.` }),
  Object.freeze({ id: 23, key: 'fallensdue', fam: 'fellowship', name: "Fallen's Due", v: [0.10, 0.15, 0.20], by: 'relay', line: (v) => `When an ally falls, the rest deal +${pc(v)} damage for the hall.` }),
  Object.freeze({ id: 24, key: 'steadfast', fam: 'fellowship', name: 'Steadfast Line', v: [0.05, 0.10, 0.15], by: 'client', line: (v) => `With 3 allies within 8 m, you take ${pc(v)} less damage.` }),
  Object.freeze({ id: 25, key: 'mender', fam: 'fellowship', name: "Mender's Grace", v: [0.15, 0.25, 0.35], by: 'word', line: (v) => `Your heals on allies are ${pc(v)} stronger.` }),
  Object.freeze({ id: 26, key: 'lifeline', fam: 'fellowship', name: 'Lifeline', v: [0.20, 0.25, 0.30], by: 'word', line: (v) => `Healing an ally under 30% health makes them take ${pc(v)} less damage for 3 s.` }),   // AUDIT EG III (lane2 #5): every rank under EG_DR_MAX, III at it - its 40% never applied
]);
function pc(v) { return `${Math.round(v * 100)}%`; }
export const EG_V_BY_KEY = Object.freeze(Object.fromEntries(EG_VESTIGES.map((v) => [v.key, v])));
/** THE MASTERIES: one held at a time (a new one replaces it), offered as a fourth card at Redoubt 3 and every Valkynaz
 *  Redoubt. Numbered from 100. */
export const EG_MASTERIES = Object.freeze([
  Object.freeze({ id: 100, key: 'immovable', fam: 'stone', name: 'Immovable', line: 'Stand still for 1 s on a fight floor to take 25% less damage and ignore pushes until you move.' }),
  Object.freeze({ id: 101, key: 'counterstroke', fam: 'blade', name: 'Counterstroke', line: "Strike a lord in melee within 0.6 s after its blow lands near you for x1.4 damage." }),
  Object.freeze({ id: 102, key: 'spotter', fam: 'hunt', name: 'Spotter', line: "Your arrow from beyond 12 m spots a foe for 8 s. The company deals it +10% damage, and an add loses the attack it is winding." }),   // AUDIT EG IV (lane10 #13): a verb - its wake every blow's since AUDIT EG III
  Object.freeze({ id: 103, key: 'spillover', fam: 'arcana', name: 'Spillover', line: "A spell's overkill on an add carries to the nearest add within 6 m." }),
  Object.freeze({ id: 104, key: 'spirebridge', fam: 'fellowship', name: 'Spirebridge', line: 'Once a span, raise a gold bridge over the next gap for 6 s.' }),
]);
export const EG_M_BY_ID = Object.freeze(Object.fromEntries(EG_MASTERIES.map((m) => [m.id, m])));
/** AUDIT EG III: each Mastery's number by its key (`EG_M_ID.counterstroke` 101) - the relay reads a held Mastery by it. */
export const EG_M_ID = Object.freeze(Object.fromEntries(EG_MASTERIES.map((m) => [m.key, m.id])));
/** AUDIT EG III: Spirebridge's number (the Fellowship's Mastery). */
export const EG_SPIREBRIDGE_ID = EG_M_ID.spirebridge ?? -1;
/**
 * AUDIT EG III - SPIREBRIDGE, THE ROOM'S RULE (section 15: "once a span, a gold bridge over the next gap for the company, for
 * 6 s" - "the room's word; known to the fair trail"): member `sub` of breach `B` asks it (`mast`) standing at `p` (`{x, z}`,
 * the hall's frame of `spec`, the hall the breach stands in) at relay ms `now`. A living holder, in a trial or its closing,
 * once a hall's span (`m.sbH` - its hall), over the next gap ahead of it on its road (net/eliteGates/egSpanLaw.js egBridgeAhead): the
 * plank kept in `B.sb` (`{ h, g, from, until }` - the fair trail's ground, net/eliteGates/egFair.js) for EG_SB_MS, and said to the
 * company. Answers the word (`ebridge`), or null - refused, nothing spent (no gap ahead, not the holder, spent this span).
 * @param {any} B @param {string} sub @param {any} spec @param {{x: number, z: number}|null} p @param {number} now
 */
export function egSpirebridge(B, sub, spec, p, now) {
  const m = B?.mem?.[sub];
  if (!m || !m.in || !m.alive || m.home || m.mast !== EG_SPIREBRIDGE_ID || !spec || !p || !(B.h > 0) || spec.h !== B.h) return null;
  if ((B.sg !== 'trial' && B.sg !== 'closing') || m.sbH === B.h) return null;
  const g = egBridgeAhead(spec, p.x, p.z);
  if (g < 0) return null;
  m.sbH = B.h;
  const q = { h: B.h, g, from: now, until: now + EG_SB_MS };
  B.sb = [...(B.sb ?? []).filter((o) => o.h === B.h && o.until > now), q];
  return { k: 'ebridge', h: B.h, g, at: q.from, until: q.until, s: sub, n: m.name ?? '' };
}
/** THE ACCORDS: two members within 10 m holding a named pair from two families. */
export const EG_ACCORDS = Object.freeze([
  Object.freeze({ key: 'hammer', name: 'Hammer and Anvil', a: 'oath', b: 'huntersmark', line: "A foe under Hunter's Mark takes +8% damage from the Challenger's Oath holder." }),
  Object.freeze({ key: 'hymn', name: 'Shield-Hymn', a: 'bastion', b: 'rally', line: "Rally's heal also gives 4 s of Bastion's protection." }),
  Object.freeze({ key: 'ambush', name: 'Ambush', a: 'fade', b: 'standard', line: 'Your first blow after a Fade deals +15% near the Standard.' }),
  Object.freeze({ key: 'kindled', name: 'Kindled Steel', a: 'searing', b: 'overcharge', line: "Searing Edge's melee fire splashes 2 m." }),
  Object.freeze({ key: 'farwatch', name: 'Far Watch', a: 'longsight', b: 'watchfire', line: 'Blows aimed at the Long Sight holder are seen even sooner.' }),
  Object.freeze({ key: 'livingwall', name: 'Living Wall', a: 'stoneskin', b: 'mender', line: 'Heals on the Stoneskin holder are 10% stronger.' }),
  Object.freeze({ key: 'noquarter', name: 'No Quarter', a: 'culling', b: 'fallensdue', line: "While Fallen's Due is active, Culling Edge works on adds under a third of their health." }),
  Object.freeze({ key: 'warchorus', name: 'War-Chorus', a: 'echo', b: 'standard', line: 'Near the Standard, Arcane Echo repeats at full strength.' }),
]);
/** RESONANCE: three different Vestiges of one family grant its capstone, for the breach. */
export const EG_CAPSTONES = Object.freeze({
  stone: Object.freeze({ name: 'Rooted', line: 'You cannot be pushed, and your threat doubles.' }),
  blade: Object.freeze({ name: 'Bladestorm', line: 'Every fifth melee blow strikes every foe within 3 m.' }),
  hunt: Object.freeze({ name: 'Deadeye', line: 'An arrow from beyond 12 m pierces the add behind its target.' }),
  arcana: Object.freeze({ name: 'Spellweave', line: 'Every fourth damage spell costs nothing.' }),
  fellowship: Object.freeze({ name: 'Rallying Cry', line: "Rally's heal and the company's Second Winds come again at each Court phase and when a hall's door opens." }),   // AUDIT EG IV (lane10 #14): where the support is tested
});

/** A member's rank in a Vestige (0 none). */
export const egRankOf = (vs, key) => { const V = EG_V_BY_KEY[key]; if (!V) return 0; const p = (vs ?? []).find((x) => x[0] === V.id); return p ? p[1] : 0; };
/** A member's value of a Vestige at its rank (0 none). */
export const egVOf = (vs, key) => { const r = egRankOf(vs, key); return r ? EG_V_BY_KEY[key].v[r - 1] : 0; };
/** The families resonating for a member (three different Vestiges of one family). */
export function egResonance(vs) {
  const by = {};
  for (const [id] of vs ?? []) { const V = EG_VESTIGES[id]; if (V) by[V.fam] = (by[V.fam] ?? 0) + 1; }
  return EG_V_FAMILIES.filter((f) => (by[f] ?? 0) >= 3);
}
/** A member's client-declared damage factor (the bucket's - THE TRUST LAW: at most EG_BUCKET_X_MAX). */
export function egDeclaredX(vs) {
  let x = 1;
  for (const [id, r] of vs ?? []) { const V = EG_VESTIGES[id]; if (V?.x) x *= V.x[r - 1]; }
  return Math.min(EG_BUCKET_X_MAX, x);
}
/** The relay-established factor for a blow, capped (EG_RELAY_X_MAX) and, with the declared one, capped together
 *  (EG_BUCKET_ALL_MAX). */
export const egCapX = (relayX, declaredX) => Math.min(EG_RELAY_X_MAX, relayX, EG_BUCKET_ALL_MAX / Math.max(1, declaredX));
/**
 * EG-ZR - SHIELD-HYMN (section 15's Accord: Bastion with Rally - "Rally's heal also gives the company 4 s of Bastion's
 * protection"): the Bastion holders among the living company `ms` (`{ sub, vs, x, z }` - each where it stands) within
 * EG_ACCORD_M of a Rally holder who is another member (an Accord is two members'). Their Bastion is the company's for
 * EG_HYMN_MS when Rally's heal is said - the relay's census (net/eliteGates/egBrain.js egHymnStep) and each screen (scenes/eliteGates/egFight.js
 * `rally`) read the pair by this one law, each on the places it holds. Pure.
 * @param {Array<{ sub: string, vs: number[][], x: number, z: number }>} ms
 */
export function egHymnOf(ms) {
  const rally = ms.filter((m) => egRankOf(m.vs, 'rally') > 0);
  return ms.filter((b) => egRankOf(b.vs, 'bastion') > 0 && rally.some((r) => r.sub !== b.sub && Math.hypot(r.x - b.x, r.z - b.z) <= EG_ACCORD_M)).map((b) => b.sub);
}
/**
 * EG-ZS - THE PAIR LAW (section 15's Accords: "Two members within 10 m, holding a named pair from two different families, gain
 * an Accord while they stand together"): the members of the company `ms` (`{ sub, vs, x, z }` - each where it stands) who
 * stand within EG_ACCORD_M of member `me` and hold Accord `key` with it - `me` holding the Vestige the Accord names on side
 * `as` (EG_ACCORDS' `a` or `b`), each of them the other side's. An Accord is two members', so `me` is never its own mate.
 * The relay (net/eliteGates/egRun.js egVestigeX and egEchoShare, net/eliteGates/egBrain.js) and each screen (scenes/eliteGates/egFight.js accordMates) read
 * Hammer and Anvil, Ambush, Kindled Steel, Living Wall and War-Chorus by it, each on the places it holds. Pure.
 * @param {Array<{ sub: string, vs: number[][], x: number, z: number }>} ms @param {string} me @param {string} key @param {'a'|'b'} [as]
 * @returns {string[]}
 */
export function egAccordMates(ms, me, key, as = 'a') {
  const A = EG_ACCORDS.find((x) => x.key === key), m = ms.find((x) => x.sub === me);
  if (!A || !m || !(egRankOf(m.vs, A[as]) > 0)) return [];
  const other = as === 'a' ? A.b : A.a;
  return ms.filter((o) => o.sub !== me && egRankOf(o.vs, other) > 0 && Math.hypot(o.x - m.x, o.z - m.z) <= EG_ACCORD_M).map((o) => o.sub);
}
/**
 * EG-ZS (section 15: "The offer card names it: *Takes an Accord with Mira's Hunter's Mark.*"): the Accords a card would take -
 * a Vestige not yet held (`vs` mine), with each companion of `co` (`[name, vs]` - the living company but me) who holds the
 * Accord's other half: `[{ key, name, with }]`, the Accord, the companion's name and the Vestige they hold. A Mastery, or a
 * Vestige held already, takes none. Pure.
 * @param {number} card @param {number[][]} vs @param {Array<[string, number[][]]>} co
 */
export function egCardAccords(card, vs, co) {
  const V = card < 100 ? EG_VESTIGES[card] : null;
  if (!V || egRankOf(vs, V.key) > 0) return [];
  const out = [];
  for (const A of EG_ACCORDS) {
    const other = A.a === V.key ? A.b : A.b === V.key ? A.a : null;
    if (other) for (const [name, ovs] of co) if (egRankOf(ovs, other) > 0) out.push({ key: A.key, name, with: EG_V_BY_KEY[other].name });
  }
  return out;
}
/** Accords a pair of members hold (by their Vestiges). */
export function egAccordsOf(vsA, vsB) {
  const has = (vs, k) => egRankOf(vs, k) > 0;
  return EG_ACCORDS.filter((A) => (has(vsA, A.a) && has(vsB, A.b)) || (has(vsA, A.b) && has(vsB, A.a)));
}

/**
 * AUDIT EG IV (lane10 #15; section 15's CARDS THAT ACT) - WHAT A CARD NEEDS TO ACT, where the room can see it: `ally` the living
 * company it needs (a Vestige that works only through an ally - 2; Steadfast Line's three allies - 4), `hit` the blow kinds
 * (net/gate/gateBrain.js HIT_KINDS: 0 melee, 1 an arrow, 2 a spell) of which its member must have landed one in the breach. A
 * Vestige whose use the room cannot see (Battlemage's Focus and Shieldweaver - any spell) needs nothing.
 */
export const EG_CARD_NEEDS = Object.freeze({
  bastion: Object.freeze({ ally: 2 }), standard: Object.freeze({ ally: 2 }), fallensdue: Object.freeze({ ally: 2 }), mender: Object.freeze({ ally: 2 }), lifeline: Object.freeze({ ally: 2 }), steadfast: Object.freeze({ ally: 4 }),
  searing: Object.freeze({ hit: Object.freeze([0]) }), sweeping: Object.freeze({ hit: Object.freeze([0]) }), counterstroke: Object.freeze({ hit: Object.freeze([0]) }),
  huntersmark: Object.freeze({ hit: Object.freeze([1]) }), spotter: Object.freeze({ hit: Object.freeze([1]) }), longsight: Object.freeze({ hit: Object.freeze([1, 2]) }),
  overcharge: Object.freeze({ hit: Object.freeze([2]) }), echo: Object.freeze({ hit: Object.freeze([2]) }), spillover: Object.freeze({ hit: Object.freeze([2]) }),
});
/** Can card `key` (a Vestige's or a Mastery's) act for a member of a living company of `n` (0 unknown) whose landed blows over
 *  the breach are `kinds` (`[melee, arrows, spells]`; null unknown)? Pure. */
export function egCardActs(key, n = 0, kinds = null) {
  const N = EG_CARD_NEEDS[key];
  if (!N) return true;
  if (N.ally && n > 0 && n < N.ally) return false;
  if (N.hit && Array.isArray(kinds) && !N.hit.some((k) => (kinds[k] ?? 0) > 0)) return false;
  return true;
}
/**
 * THE OFFER at a Redoubt for one member: three Vestiges from three different families (one held at III never shown),
 * at the breach's first Redoubt one of them from the family of their most-used blow kind (THE LEAN, `lean`: melee Blade, an
 * arrow Hunt, a spell Arcana); a Mastery as a fourth card at the breach's third Redoubt (`w` the Redoubt's place in the breach,
 * net/eliteGates/egRun.js egOffers - AUDIT EG V, h: a deeper start's third too, never Redoubt 3 alone) and every Valkynaz Redoubt; a
 * bequest's card; at most
 * EG_OFFER_MAX. `extra` cards from a Surplus or shards. Under The Hollow Offer, two cards, one a Mastery.
 * AUDIT EG IV: (lane10 #15) every card one that acts for its member (egCardActs - `n` the living company, `kinds` its landed
 * blow kinds), the bequest's aside (the fallen's own); (lane10 #22) `rank` - THE SHARDS' CARD: one of the member's own Vestiges
 * below III at its next rank (egCardText), else a new card as `extra` deals.
 * @param {() => number} rng @param {{ vs: number[][], mast?: number, lean?: number|null, w: number, valk?: boolean, bequest?: number|null, extra?: number, hollow?: boolean, n?: number, kinds?: number[]|null, rank?: number }} o
 * @returns {number[]} the cards (Vestige ids, Mastery ids from 100)
 */
export function egOfferOf(rng, { vs = [], mast = -1, lean = null, w = 1, valk = false, bequest = null, extra = 0, hollow = false, n = 0, kinds = null, rank = 0 }) {
  const maxed = new Set((vs ?? []).filter((p) => p[1] >= 3).map((p) => p[0]));
  const own = rank > 0 ? (vs ?? []).filter((p) => p[1] < 3 && EG_VESTIGES[p[0]]).map((p) => p[0]) : [], mine = own.length ? own[Math.floor(rng() * own.length)] : -1;
  const fams = [...EG_V_FAMILIES].sort(() => rng() - 0.5);
  const leanFam = lean != null ? (lean === 0 ? 'blade' : lean === 1 ? 'hunt' : 'arcana') : null;   // AUDIT EG V (L2-13): `lean` given at the breach's first Redoubt alone (net/eliteGates/egRun.js egOffers), a deeper start's too
  if (leanFam) { fams.splice(fams.indexOf(leanFam), 1); fams.unshift(leanFam); }
  const cards = [];
  const k = (hollow ? 1 : 3) + Math.max(0, extra) + (rank > 0 && mine < 0 ? 1 : 0);
  for (const f of fams) {
    if (cards.length >= k) break;
    const pool = EG_VESTIGES.filter((V) => V.fam === f && !maxed.has(V.id) && !cards.includes(V.id) && V.id !== mine && egCardActs(V.key, n, kinds));
    if (pool.length) cards.push(pool[Math.floor(rng() * pool.length)].id);
  }
  if (mine >= 0) cards.push(mine);
  if (hollow || w === 3 || valk) { const pool = EG_MASTERIES.filter((M) => M.id !== mast && egCardActs(M.key, n, kinds)); if (pool.length) cards.push(pool[Math.floor(rng() * pool.length)].id); }
  if (bequest != null && !cards.includes(bequest) && !maxed.has(bequest)) cards.push(bequest);
  return cards.slice(0, EG_OFFER_MAX);
}
/** A card taken: a Vestige ranked (or new at I), a Mastery set (replacing any). Answers the member's new `{ vs, mast }`. */
export function egTake(vs, mast, card) {
  if (card >= 100) return { vs: vs ?? [], mast: EG_M_BY_ID[card] ? card : mast };
  const V = EG_VESTIGES[card];
  if (!V) return { vs: vs ?? [], mast };
  const had = (vs ?? []).find((p) => p[0] === card);
  const next = had ? (vs ?? []).map((p) => (p[0] === card ? [p[0], Math.min(3, p[1] + 1)] : p)) : [...(vs ?? []), [card, 1]];
  return { vs: next, mast };
}
/** A card's name and line at the rank it would give. */
export function egCardText(card, vs = []) {
  if (card >= 100) { const M = EG_M_BY_ID[card]; return M ? { name: `${M.name} (Mastery)`, line: M.line, fam: M.fam } : { name: '', line: '', fam: '' }; }
  const V = EG_VESTIGES[card];
  if (!V) return { name: '', line: '', fam: '' };
  const r = Math.min(3, egRankOf(vs, V.key) + 1);
  return { name: `${V.name} ${['I', 'II', 'III'][r - 1]}`, line: V.line(V.v[r - 1]), fam: V.fam };
}
