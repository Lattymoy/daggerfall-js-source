// @ts-check
// EG-FULL (2026-10-11, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 14, 15, 16 and 17): THE RUN'S
// COMPANY SYSTEMS, as the breach's room keeps them - the parts of a breach that are the company's rather than a hall's:
//   THE COMPANY'S WORD (section 16.4) - a choice put to every member, the witnesses included, open 30 s: it passes on a
//     majority of those who answer; silence abstains; a tie refuses (for the decrees, a tie takes the first shown);
//   THE DECREES (section 14) - at each Redoubt the next circle's families drawn from those the standing decrees (the
//     Proclamation, the Wager) leave free, two of each offered, the company choosing; ranks from circle 10; the
//     Wellhead's tide past circle 20 and its strata from Redoubt 20;
//   THE VESTIGES' OFFERS AND PICKS (section 15), the Surplus's fourth card or reroll, shards, the Athenaeum's free rank;
//   CACHES, CANTRIPS, LUMEN AND THE SUTLER (section 17), the Mementos and the niches (section 16.5);
//   THE RELAY'S VESTIGES - the factors a blow takes from what the room can see (Long Sight, Culling Edge, Spire's
//     Standard, Fallen's Due, Hunter's Mark, Counterstroke, Spotter), capped by THE TRUST LAW (net/eliteGates/egVestige.js).
// EG-ZS (2026-10-12, section 15; EG-ZR's "Not built"): and the Accords a blow takes from where the company stands (net/eliteGates/egVestige.js
// egAccordMates) - HAMMER AND ANVIL (a foe the mate's mark is on, +8% from the oath's holder) and AMBUSH (the first blow after a
// Fade, near the Standard's holder, +15%), inside the caps; and an ARCANE ECHO's share (egEchoShare: half, or whole in WAR-CHORUS).
//
// Pure: a breach record (net/eliteGates/egBrain.js) and a beat in, frames out. In the relay bundle. Not a DFU member. Ledger A
// (ELITE-GATES).
import { EG_DECREES, EG_DECREE_FAMILIES, EG_DECREE_BY_KEY, egDecreeCount, egDecreeRanksUp, egBandOfCircle } from './egLaw.js';
import { egOfferOf, egTake, egVOf, egDeclaredX, egCapX, egResonance, EG_SHARDS_PER, EG_FADE_CD_S } from './egVestige.js';
import { egAccordMates, EG_FAR_M, EG_HAMMER_X, EG_AMBUSH_X, EG_ECHO_SHARE } from './egVestige.js';   // EG-ZS: the Accords' pair law and numbers
import { EG_V_BY_KEY, EG_AURA_EXTRA, EG_AURA_EXTRA_MAX, EG_M_ID, EG_COUNTER_MS, EG_COUNTER_X, EG_MARK_MS } from './egVestige.js';   // AUDIT EG III: the Standard's aura, Counterstroke's numbers, a mark's life - declared once
import { HIT_KINDS } from '../gate/gateBrain.js';
import { egSeed } from './egLaw.js';   // AUDIT EG IV (lane10 #11): the season's strata, a seeded order
import { sdRng } from '../superDungeon/sdBrain.js';
import { arenaSeasonOf } from '../arena/arenaLaw.js';
import { EG_OFFER_MAX, EG_SPOT_X } from './egVestige.js';   // AUDIT EG IV: an offer's six; Spotter's share over a Hunter's Mark
import { EG_RUN_REL_MAX } from '../wire.js';   // AUDIT EG III (lane2 #1): the Reliquaries' circles a run's row carries
import { egCirclePlan, egCircleOfHall, egSlotOfHall } from './egLaw.js';   // AUDIT EG V (L2-10): THE FRAYING drawn only for a circle with an Athenaeum
import { SD_OMENS } from '../superDungeon/sdMarks.js';   // AUDIT EG V (L2-10): the Hour's omen The Fraying, its fray read
import { SD_FRAY_MAX } from '../superDungeon/sdBrain.js';   // AUDIT EG V (L2-10): the Orrery's own fray, the Hour's default

/** The company's word stays open this long (ms). FIELD BUGS 2026-10-25 ASK-LONGER (Grost on Discord, #suggestions: "Having
 *  only 10 seconds to read over potentially 16 different options ... At the very least, increase it to 20 seconds, maybe
 *  even 30"): it was 10 s, too short to read a rest's decrees beside the Vestige cards. 30 s sits well inside the rest's
 *  90 s (EG_REST_S). */
export const EG_ASK_MS = 30_000;
/** A Cantrip a member holds at most; a Spire Tonic at most; the Sutler's prices (section 17). */
export const EG_CANT_MAX = 3;
export const EG_TONIC_MAX = 2;
export const EG_SUTLER = Object.freeze({ cant: 20, tonic: 15, shard: 30 });
/** THE CANTRIPS (section 17.2), by number. */
export const EG_CANTRIPS = Object.freeze([
  Object.freeze({ id: 0, key: 'sight', name: 'Sight', line: 'Shows the company every cache, alcove and Lurker in the hall.' }),
  Object.freeze({ id: 1, key: 'stillness', name: 'Stillness', line: "The next hall's first wave and rift come 10 s later." }),
  Object.freeze({ id: 2, key: 'mending', name: 'Mending', line: 'The company heals 15%.' }),
  Object.freeze({ id: 3, key: 'severance', name: 'Severance', line: "The next lord's Sappers do not rise in its first phase." }),
  Object.freeze({ id: 4, key: 'longstep', name: 'Long Step', line: 'Crumbling ground holds 0.5 s longer under you for one span.' }),
]);
/** A CACHE's kinds (section 17.1). */
export const EG_CACHES = Object.freeze(['shard', 'tonic', 'cant', 'lumen']);
export const EG_CACHE_NAMES = Object.freeze({ shard: 'a Vestige shard', tonic: 'a Spire Tonic', cant: 'a Cantrip', lumen: '10 lumen' });
/** Lumen for a slain add (to its slayer) and a closed rift (to every living member). */
export const EG_LUMEN_ADD = 1;
export const EG_LUMEN_RIFT = 3;
export const EG_LUMEN_CACHE = 10;
/** THE WELLHEAD'S TIDES (past circle 20) and STRATA (Redoubt 20 and every fifth after - section 18). */
export const EG_TIDES = Object.freeze(['erupts', 'feud', 'warband', 'hungering']);
export const EG_TIDE_NAMES = Object.freeze({ erupts: 'The Wellhead Erupts', feud: 'Clan Feud', warband: 'The Warband', hungering: 'Hungering Dark' });
export const EG_STRATA = Object.freeze(['twincourt', 'mingled', 'oldmasters', 'moltenrim', 'kynchampions', 'hollow']);
export const EG_STRATA_NAMES = Object.freeze({ twincourt: 'The Twin Court', mingled: 'The Mingled Legion', oldmasters: 'The Old Masters', moltenrim: 'The Molten Rim', kynchampions: 'Kyn Champions', hollow: 'The Hollow Offer' });

// ── the company's word ──────────────────────────────────────────────────────────────────────────────────────
/** A choice put to the company: `q` its question's key, `o` its options (1 for yes/no), open EG_ASK_MS. */
export function egAsk(B, q, o, now, out) {
  B.asks = (B.asks ?? []).filter((a) => a.q !== q);
  const a = { q, o, until: now + EG_ASK_MS, v: {} };
  B.asks.push(a);
  out.push({ k: 'ask', q, o, until: a.until });
  return a;
}
/** A member's answer (an option's index; for a yes/no 1 yes, 0 no). Answers whether it counted. */
export function egVote(B, sub, q, y) {
  const a = (B.asks ?? []).find((x) => x.q === q);
  const m = B.mem[sub];
  if (!a || !m || !m.in || m.home || m.forsaken || !Number.isSafeInteger(y) || y < 0 || y >= Math.max(2, a.o.length)) return false;
  a.v[sub] = y;
  return true;
}
/** A choice's outcome from its votes: the option with most answers (ties to the first shown - `firstOnTie`), or -1 when
 *  nobody answered or a yes/no tied. */
export function egAskResult(a, firstOnTie = false) {
  const n = Math.max(2, a.o.length), tally = Array(n).fill(0);
  for (const y of Object.values(a.v)) if (y >= 0 && y < n) tally[y]++;
  const total = tally.reduce((s, x) => s + x, 0);
  if (!total) return firstOnTie ? 0 : -1;
  const top = Math.max(...tally), at = tally.indexOf(top);
  if (tally.filter((x) => x === top).length > 1 && !firstOnTie) return -1;
  return at;
}
/** The asks whose window closed, taken off: answers them, each with its outcome. */
export function egAsksDue(B, now, all = false) {
  const due = (B.asks ?? []).filter((a) => all || now >= a.until);
  B.asks = (B.asks ?? []).filter((a) => !due.includes(a));
  return due;
}

// ── the decrees ─────────────────────────────────────────────────────────────────────────────────────────────
/** The families the standing decrees hold (the Proclamation's, the Wager's). */
export const egStandingFams = (B) => [...(B.pr ? [EG_DECREE_BY_KEY[B.pr]?.fam] : []), ...(B.wg ?? []).map((id) => EG_DECREES[id]?.fam)].filter(Boolean);
/**
 * AUDIT EG V (L2-10; sections 8.4 and 14) - THE FRAYING, the Hour's omen (net/superDungeon/sdMarks.js SD_OMENS' `fraying`: the Orrery snaps
 * back at thirty-six turns) as a decree of the ground: an Athenaeum's Orrery snaps back at egFrayOf(c, rank) turns, not the
 * Hour's default SD_FRAY_MAX. The Spire's Orrery's road grows two turns every five Redoubts (net/eliteGates/egBrain.js standFight), so its
 * fray grows with it - eight turns past the longest road at rank I, as the omen's 36 stands over the first circles' 28; four at
 * rank II (EG_FRAYING_II_TURNS fewer) - and never past the default. Drawn only where it bites (egFrayingOpen).
 */
export const EG_FRAYING_FRAY = SD_OMENS.find((o) => o.id === 'fraying')?.law.fray ?? 36;
export const EG_FRAYING_II_TURNS = 4;
/** The Fraying's fray at circle c, by its rank. Pure. */
export const egFrayOf = (c, rank = 1) => Math.min(SD_FRAY_MAX, EG_FRAYING_FRAY + 2 * Math.floor((Math.max(1, c) - 1) / 5) - (rank >= 2 ? EG_FRAYING_II_TURNS : 0));
/** May The Fraying be drawn for circle c of breach seed `seed`: an Athenaeum stands in its plan at slot `from` or after (a
 *  Bargain's: one still ahead of its hall), and its fray is short of the Hour's default (to circle 30)? Pure. */
export const egFrayingOpen = (seed, c, from = 1) => egFrayOf(c) < SD_FRAY_MAX && egCirclePlan(seed, c).some((p, i) => p.kind === 'athenaeum' && i + 1 >= from);
/** May a decree be drawn at circle c (it never draws a kind or a piece its band lacks: Swarm-Mother's Binders and
 *  Gale-Swept's Gust from the Cairn)? AUDIT EG V (L2-10): and The Fraying only for a circle with an Athenaeum (egFrayingOpen,
 *  breach seed `seed`, its slot `from` on). */
const decreeOpen = (D, c, seed = 0, from = 1) => !((D.key === 'swarm' || D.key === 'gale') && egBandOfCircle(c) < 1) && (D.key !== 'fraying' || egFrayingOpen(seed, c, from));
/**
 * THE NEXT CIRCLE'S DECREES PUT TO THE COMPANY (section 14): egDecreeCount(c) families from the free ones, each with two
 * decrees offered - one ask a family (`dec:<family>`); from circle 10 one of them ranks up to II. Answers the asks.
 * AUDIT EG V (L2-1): each ask closes at its EG_ASK_MS as every ask does (section 16.4), its choice kept for the next circle
 * (`B.next.dc` - net/eliteGates/egBrain.js asksStep) and said on the beacon (the state's `nx`).
 */
export function egDecreesAsk(B, c, rng, now, out) {
  const k = egDecreeCount(c);
  if (k <= 0) { B.next = { c, fams: [], up: null, dc: [] }; return []; }
  const held = new Set(egStandingFams(B));
  const free = EG_DECREE_FAMILIES.filter((f) => !held.has(f)).sort(() => rng() - 0.5).slice(0, k);
  const up = egDecreeRanksUp(c) && free.length ? free[Math.floor(rng() * free.length)] : null;
  B.next = { c, fams: free, up, dc: [] };
  return free.map((f) => {
    const pool = EG_DECREES.filter((D) => D.fam === f && decreeOpen(D, c, B.seed)).sort(() => rng() - 0.5).slice(0, 2);
    return egAsk(B, `dec:${f}`, pool.map((D) => D.id), now, out);
  });
}
/** The company's choices folded into the next circle's decrees (`[[id, rank], ...]`), the standing ones beside them. */
export function egDecreesChosen(B, asks) {
  const out = [];
  for (const a of asks) {
    if (!a.q.startsWith('dec:')) continue;
    const at = egAskResult(a, true), id = a.o[at] ?? a.o[0];
    if (id == null) continue;
    out.push([id, B.next?.up === a.q.slice(4) ? 2 : 1]);
  }
  return out;
}
/** Every decree in force for a circle: the drawn, a Bargain's, the Proclamation's, the Wager's - as `{ key: rank }`. */
export function egDecreeRanks(B) {
  const r = {};
  const put = (id, rank) => { const D = EG_DECREES[id]; if (D) r[D.key] = Math.max(r[D.key] ?? 0, rank); };
  for (const [id, rank] of B.dc ?? []) put(id, rank);
  for (const [id, rank] of B.bargainDc ?? []) put(id, rank);
  if (B.pr) put(EG_DECREE_BY_KEY[B.pr]?.id, 1);
  for (const id of B.wg ?? []) put(id, 1);
  // the tide and the strata (the Wellhead's - section 18)
  if (B.tide === 'feud' || (B.strata ?? []).includes('kynchampions')) r.feud = 1;
  return r;
}
/** All decrees in force as `[[id, rank], ...]` (the state's word). */
export const egDecreesInForce = (B) => Object.entries(egDecreeRanks(B)).filter(([k]) => EG_DECREE_BY_KEY[k]).map(([k, rank]) => [EG_DECREE_BY_KEY[k].id, rank]);
/** AUDIT EG V (L2-5): the decrees of family `f` a Bargain in breach `B`'s hall may draw - those the circle's draw may
 *  (decreeOpen: never Swarm-Mother before the Cairn; The Fraying only with an Athenaeum still ahead in the circle), never
 *  Gale-Swept or Crumbling Halls (the circle's level is laid already: a Bargain never redraws its spans). */
const bargainPool = (B, f) => {
  const c = egCircleOfHall(B.h), from = egSlotOfHall(B.h) + 1;
  return EG_DECREES.filter((D) => D.fam === f && D.key !== 'gale' && D.key !== 'crumbling' && decreeOpen(D, c, B.seed, from));
};
/** AUDIT EG V (L2-4, L3-5; sections 8.7 and 14: "none when no family is free") - THE FAMILIES FREE FOR A BARGAIN: those neither
 *  the standing decrees (the Proclamation, the Wager) nor the circle's drawn ones hold, each with a decree it may draw. Pure. */
export function egBargainFams(B) {
  const used = new Set([...egStandingFams(B), ...(B.dc ?? []).map(([id]) => EG_DECREES[id]?.fam)]);
  return EG_DECREE_FAMILIES.filter((f) => !used.has(f) && bargainPool(B, f).length > 0);
}
/** Is a Bargain open (once a circle, and only with a family free - egBargainFams)? The director asks the company only then. */
export const egBargainOpen = (B) => !(B.bargainDc ?? []).length && egBargainFams(B).length > 0;
/** AUDIT EG V (L2-4, L3-5; section 8.7) - THE TWIST A SCREEN SHOWS for hall `spec` under the decrees in force `dc` (the state's
 *  `[[id, rank], ...]`): the law's, but no Dagon's Bargain once every family is held (the room asks none then - egBargainOpen),
 *  so no card offers a shrine that never asks. Pure. */
export const egTwistShown = (spec, dc) => (spec?.twist === 'bargain' && EG_DECREE_FAMILIES.every((f) => (dc ?? []).some(([id]) => EG_DECREES[id]?.fam === f)) ? null : spec?.twist ?? null);
/** A Dagon's Bargain passed: one more decree for the rest of the circle, from a free family - null when none is free. */
export function egBargainDecree(B, rng) {
  const free = egBargainFams(B);
  if (!free.length) return null;
  const pool = bargainPool(B, free[Math.floor(rng() * free.length)]);
  const D = pool[Math.floor(rng() * pool.length)];
  B.bargainDc = [[D.id, 1]];
  return D;
}
/** THE WELLHEAD'S TIDE for circle c (past 20). */
export const egTideOf = (c, rng) => (c > 20 ? EG_TIDES[Math.floor(rng() * EG_TIDES.length)] : null);
/** AUDIT EG IV (lane10 #11, lane2 #3; section 18: "drawn without repeat each season from six") - THE SEASON'S STRATA: the six in
 *  the order arena season `season` draws them (a seeded shuffle - every breach of the season the same, so the Depths board ranks
 *  one test), the first joining at Redoubt 20 and the next at every fifth after. Pure. */
const STRATA_SALT = 0x57a7a;
export function egSeasonStrata(season) {
  const r = sdRng(egSeed(season >>> 0, STRATA_SALT)), a = [...EG_STRATA];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/** The STRATUM that joins breach `B` at Redoubt `w` (20 and every fifth after): its season's (`B.op`'s), never one held -
 *  joined, and answered (null for none). */
export function egStratumAt(B, w) {
  if (!(w >= 20) || w % 5 !== 0) return null;
  const s = egSeasonStrata(arenaSeasonOf((B.op ?? 0) / 1000))[(w - 20) / 5];
  if (!s || (B.strata ?? []).includes(s)) return null;
  B.strata = [...(B.strata ?? []), s];
  return s;
}
/** AUDIT EG IV (lane10 #11): A DEEPER START (section 16.6) at the Redoubt `w` it starts past begins with every stratum of the
 *  Redoubts behind it (20 to `w`, by fifths) - starting deeper never sheds what the depth holds. Answers the strata. */
export function egStrataTo(B, w) {
  for (let r = 20; r <= w; r += 5) egStratumAt(B, r);
  return B.strata ?? [];
}

// ── the Vestiges' offers ────────────────────────────────────────────────────────────────────────────────────
/** AUDIT EG V (L2-13; section 15's Lean) - THE BLOW KIND A MEMBER LEANS TO: its most-used landed blow kind over the breach
 *  (`kinds` `[melee, arrows, spells]` - the first of a tie), or null when it has landed none (no lean, never Blade by
 *  default). Pure. */
export function egLeanOf(kinds) {
  if (!Array.isArray(kinds)) return null;
  const k = [0, 1, 2].reduce((best, j) => ((kinds[j] ?? 0) > (kinds[best] ?? 0) ? j : best), 0);
  return (kinds[k] ?? 0) > 0 ? k : null;
}
/** THE OFFERS at a Redoubt's rest: one to every living member (net/eliteGates/egVestige.js egOfferOf) - the Lean at the breach's first, a
 *  Mastery at the breach's third (AUDIT EG V, h - A1 NEW-2: a deeper start's third too, as L2-13 decided the Lean) and every
 *  Valkynaz, a fallen's bequest, shards' extra card. Answers the frames (each `s` its
 *  member's alone). AUDIT EG IV (lane10 #15): no card that cannot act for its member - the living company's size and the
 *  member's landed blow kinds over the breach (`m.kinds`) read; (lane10 #22): the shards' card one of the member's own
 *  Vestiges at its next rank; (lane1 #13): the offer's own law kept (`m.offerO`) for a Surplus's reroll. */
export function egOffers(B, w, valk, rng, now) {
  const out = [];
  const bequests = Object.values(B.mem).filter((m) => m.bequest != null).map((m) => m.bequest);
  const n = Object.values(B.mem).filter((m) => m.in && m.alive && !m.home && !m.forsaken).length;
  const nth = w - (B.ew ?? 0);   // the Redoubt's place in THIS breach (section 16.6: a deeper start counts from its own first)
  const first = nth === 1;   // AUDIT EG V (L2-13): THE LEAN at the breach's first Redoubt - a deeper start's too
  for (const [sub, m] of Object.entries(B.mem)) {
    if (!m.in || !m.alive || m.home || m.forsaken) continue;
    const lean = first ? egLeanOf(m.kinds) : null;
    const shardPicks = Math.floor((m.shards ?? 0) / EG_SHARDS_PER);
    m.offerO = { lean, w: nth, valk, bequest: bequests.find((b) => b != null && !(m.vs ?? []).some((p) => p[0] === b)) ?? null, rank: shardPicks > 0 ? 1 : 0, hollow: (B.strata ?? []).includes('hollow'), n };
    const cards = egOfferOf(rng, { ...m.offerO, vs: m.vs, mast: m.mast, kinds: m.kinds });
    m.offer = cards; m.picks = 1 + shardPicks + (m.athFree ? 1 : 0); m.athFree = 0;
    out.push({ k: 'offer', to: sub, v: cards, n: m.picks });   // a member's own offer, to their sockets alone (the room's _egFan)
  }
  for (const m of Object.values(B.mem)) m.bequest = null;
  return out;
}
/** A pick: a card of the member's offer taken (a Vestige ranked, a Mastery set); shards spent past the first pick.
 *  Answers whether it was taken. */
export function egPick(B, sub, card) {
  const m = B.mem[sub];
  if (!m || !m.alive || !Array.isArray(m.offer) || !m.offer.includes(card) || !(m.picks > 0)) return false;
  const t = egTake(m.vs, m.mast, card);
  m.vs = t.vs; m.mast = t.mast; m.newestV = card;
  m.offer = m.offer.filter((c) => c !== card);
  m.picks--;
  if (m.picks >= 1 && (m.shards ?? 0) >= EG_SHARDS_PER) m.shards -= EG_SHARDS_PER;
  if (!m.picks) m.offer = null;
  return true;
}
/** The rest's end: every offer still open takes its first card - AUDIT EG V (L2-15; section 15: "takes one within the rest;
 *  unpicked, the first is taken"): for every pick still in hand (a second, the shards' or the Athenaeum's, too), each the
 *  first card left - and the offer closes with the rest, so no pick outlives it. */
export function egPicksClose(B) {
  for (const [sub, m] of Object.entries(B.mem)) {
    while (m.offer?.length && m.picks > 0) if (!egPick(B, sub, m.offer[0])) break;
    m.offer = null; m.picks = 0;
  }
}
/** A Surplus spent: a fourth card, or the three rerolled. AUDIT EG IV (lane1 #13; section 15: "an offer holds at most six
 *  cards"): a card past EG_OFFER_MAX (or none to find) is refused and the Surplus kept; a reroll deals the offer by its own law
 *  (`m.offerO` - The Hollow Offer's two, the bequest, the shards' card, the Lean), and both deal only cards that act for it. */
export function egSurplus(B, sub, use, rng, w, valk) {
  const m = B.mem[sub];
  if (!m || !m.offer || !(B.sur > 0)) return null;
  const o = { w, valk, ...(m.offerO ?? {}), vs: m.vs, mast: m.mast, kinds: m.kinds };
  if (use === 'reroll') m.offer = egOfferOf(rng, o);
  else {
    const more = m.offer.length < EG_OFFER_MAX ? egOfferOf(rng, { vs: m.vs, mast: m.mast, w: 2, extra: 1, n: o.n, kinds: m.kinds }).find((c) => !m.offer.includes(c)) : null;
    if (more == null) return null;
    m.offer = [...m.offer, more];
  }
  B.sur--;
  return { k: 'offer', to: sub, v: m.offer, n: m.picks };
}
/** A recall's cost: the member's newest Vestige lost. */
export function egLoseNewest(m) {
  if (m.newestV == null) return;
  if (m.newestV >= 100) m.mast = -1;
  else m.vs = (m.vs ?? []).map((p) => (p[0] === m.newestV ? [p[0], p[1] - 1] : p)).filter((p) => p[1] > 0);
  m.newestV = null;
}

// ── caches, Cantrips, lumen and the Sutler ──────────────────────────────────────────────────────────────────
/** A hall's cache drawn (its kind shown on the door's plaque - section 17.1); a Kyn Mimic's one in eight. */
export function egCacheDraw(rng, mimic) { return { k: EG_CACHES[Math.floor(rng() * EG_CACHES.length)], mimic: mimic && rng() < 1 / 8 ? 1 : 0, took: {} }; }
/** What a cache gives a member - its kind added to their run (`egot` - to them alone). */
export function egGive(m, kind, n = 1, rng = Math.random) {
  if (kind === 'shard') m.shards = (m.shards ?? 0) + n;
  else if (kind === 'tonic') m.tonics = Math.min(EG_TONIC_MAX, (m.tonics ?? 0) + n);
  else if (kind === 'cant') { m.cant = [...(m.cant ?? [])]; for (let k = 0; k < n && m.cant.length < EG_CANT_MAX; k++) m.cant.push(Math.floor(rng() * EG_CANTRIPS.length)); }
  else if (kind === 'lumen') m.lumen = (m.lumen ?? 0) + EG_LUMEN_CACHE * n;
  else if (kind === 'rel') m.rel = [...(m.rel ?? []), n];
}
/** A purchase from the Sutler: answers the item's kind, or null (no lumen, nothing to hold). */
export function egBuy(m, i, rng = Math.random) {
  const kind = ['cant', 'tonic', 'shard'][i];
  if (!kind) return null;
  const price = EG_SUTLER[kind];
  if ((m.lumen ?? 0) < price) return null;
  if (kind === 'cant' && (m.cant ?? []).length >= EG_CANT_MAX) return null;
  if (kind === 'tonic' && (m.tonics ?? 0) >= EG_TONIC_MAX) return null;
  m.lumen -= price;
  egGive(m, kind, 1, rng);
  return kind;
}

// ── the relay's Vestiges, on a blow ─────────────────────────────────────────────────────────────────────────
/**
 * THE RELAY-ESTABLISHED FACTOR on a member's blow (section 15's 'relay' rows), from what the room can see: Long Sight
 * (an arrow or a spell from beyond 12 m), Culling Edge (an add under a quarter - a third under No Quarter's Fallen's
 * Due), Spire's Standard (an ally holding it within 10 m: the strongest, +2% for each other, +6% at most), Fallen's Due
 * (an ally fallen this hall), Hunter's Mark and Spotter (a foe marked), Counterstroke (a melee blow on a lord just after
 * its blow landed near) - capped with the declared factor by THE TRUST LAW. Answers `{ x, bx }`: the relay factor and
 * the bucket's (declared) factor.
 * @param {any} B @param {string} sub @param {{ x: number, z: number }} pose @param {any} body @param {number} r @param {number} now
 * @param {{ sub: string, x: number, z: number }[]} here
 */
export function egVestigeX(B, sub, pose, body, r, now, here) {
  const m = B.mem[sub];
  if (!m) return { x: 1, bx: 1 };
  const vs = m.vs ?? [];
  let x = 1;
  const d = body && pose ? Math.hypot(pose.x - body.x, pose.z - body.z) : 0;
  if (r !== HIT_KINDS.Melee && d > EG_FAR_M) x *= 1 + egVOf(vs, 'longsight');
  const isAdd = body?.role === 1;
  const fallenDue = Math.max(0, ...Object.values(B.mem).filter((o) => o.alive && o.in && !o.home).map((o) => egVOf(o.vs, 'fallensdue')));   // AUDIT EG V (L2-2): a holder gone home lends none
  const dueOn = (B.F?.fellThisHall ?? 0) > 0;
  const ms = egCompanyAt(B, sub, pose, here);
  // AUDIT EG III - NO QUARTER is an Accord (THE PAIR LAW): while Fallen's Due burns, a Culling Edge holder standing within
  // EG_ACCORD_M of a mate holding Fallen's Due reaches adds under a third
  if (isAdd && body.max > 0) { const cull = egVOf(vs, 'culling'), line = dueOn && fallenDue && egAccordMates(ms, sub, 'noquarter', 'a').length ? 1 / 3 : 1 / 4; if (cull && body.hp / body.max < line) x *= 1 + cull; }
  if (dueOn) x *= 1 + fallenDue;
  // Spire's Standard: allies within its aura who hold it - the strongest, and EG_AURA_EXTRA for each other, EG_AURA_EXTRA_MAX at most
  const std = here.filter((o) => o.sub !== sub && Math.hypot(o.x - pose.x, o.z - pose.z) <= EG_V_BY_KEY.standard.aura).map((o) => egVOf(B.mem[o.sub]?.vs, 'standard')).filter((v) => v > 0).sort((a, b) => b - a);
  if (std.length) x *= 1 + Math.min(std[0] + EG_AURA_EXTRA_MAX, std[0] + EG_AURA_EXTRA * (std.length - 1));
  // a marked foe (Hunter's Mark, Spotter)
  const mk = body?.marked && body.marked.until > now ? body.marked.x : 0;
  if (mk) x *= 1 + mk;
  // Counterstroke (a Mastery): a melee blow on a lord within EG_COUNTER_MS after one of its blows landed within EG_COUNTER_M
  // of its holder (`lordLandedAt` - net/eliteGates/egBrain.js trial's census)
  if (m.mast === EG_M_ID.counterstroke && r === HIT_KINDS.Melee && body?.role === 0 && (m.lordLandedAt ?? -Infinity) + EG_COUNTER_MS >= now) x *= EG_COUNTER_X;
  // EG-ZS - THE ACCORDS ON A BLOW (section 15, every one the relay's, inside the caps): HAMMER AND ANVIL - a foe marked by a
  // mate holding Hunter's Mark (`marked.by`) takes its share more from the oath's holder standing with it; AMBUSH - the first
  // blow after a Fade (`m.amb`, egFadeOn), within 10 m of a mate holding the Standard
  if (mk && body.marked.by && egAccordMates(ms, sub, 'hammer', 'a').includes(body.marked.by)) x *= 1 + EG_HAMMER_X;
  if (m.amb && egAccordMates(ms, sub, 'ambush', 'a').length) x *= 1 + EG_AMBUSH_X;
  const bx = egDeclaredX(vs);
  return { x: egCapX(x, bx), bx };
}
/** EG-ZS: the company as the pair law reads it (net/eliteGates/egVestige.js egAccordMates) at a member's blow - each living member in the
 *  breach where the room last holds it (`here`), the striker where its blow stands (`pose`), each with its Vestiges. AUDIT EG V
 *  (L2-2): `here` holds the living alone, each by a pose of this hall (net/eliteGates/egBrain.js egPosedHere) - a member gone home, or
 *  whose last pose is an earlier hall's, stands with nobody. */
export function egCompanyAt(B, sub, pose, here) {
  const ms = here.filter((o) => o.sub !== sub).map((o) => ({ sub: o.sub, vs: B.mem[o.sub]?.vs ?? [], x: o.x, z: o.z }));
  return pose ? [{ sub, vs: B.mem[sub]?.vs ?? [], x: pose.x, z: pose.z }, ...ms] : ms;
}
/**
 * EG-ZS - AN ARCANE ECHO'S SHARE (section 15: "a damage spell repeats at half"; WAR-CHORUS, Arcane Echo with Spire's Standard:
 * "within 10 m of the Standard, an Echo repeats at full"): the share of an Echo's claim (a blow numbered past
 * net/eliteGates/egVestige.js EG_ECHO_Q - scenes/eliteGates/egFight.js sends the cast's whole) the room takes - EG_ECHO_SHARE, or the whole while its
 * holder stands within EG_ACCORD_M of a mate holding the Standard, where the room holds the company. Never a factor above 1,
 * so inside the caps; a client that claims an Echo at full gains nothing the room does not see.
 */
export const egEchoShare = (B, sub, pose, here) => (egAccordMates(egCompanyAt(B, sub, pose, here), sub, 'warchorus', 'a').length ? 1 : EG_ECHO_SHARE);
/** A member's threat on a lord - Challenger's Oath's and Rooted's (relay). */
export const egThreatX = (m) => Math.max(1, egVOf(m?.vs, 'oath')) * (egResonance(m?.vs).includes('stone') ? 2 : 1);
/** Fade (relay): after a strike, adds lose the striker for its seconds, once every EG_FADE_CD_S. EG-ZS: and Ambush armed - the
 *  holder's next blow is the first after a Fade (`amb`, spent by net/eliteGates/egBrain.js egBlow). */
export function egFadeOn(m, now) {
  const v = egVOf(m?.vs, 'fade');
  if (!v || now < (m.fadeCdAt ?? 0)) return;
  m.fadeUntil = now + v * 1000; m.fadeCdAt = now + EG_FADE_CD_S * 1000;
  m.amb = 1;
}
/** A first arrow's mark (Hunter's Mark) or a struck foe's (Spotter) on a body. EG-ZS: the mark keeps who laid it (`by` - Hammer
 *  and Anvil reads it). AUDIT EG III (lane2 #6; section 21): each reads an arrow (`r`, the client's word) from beyond EG_FAR_M
 *  of the foe (`d`, between the poses) - where no melee blow reaches, so a forged kind gains nothing a real one would not.
 *  AUDIT EG IV (lane10 #13; section 15): ONE MARK, TWO LAYERS - Hunter's Mark's share (`hm`, the first holder's arrow, its rank)
 *  and Spotter's EG_SPOT_X (`sp`) over it, either joining the other (a layer joined stands the mark EG_MARK_MS more); a
 *  holder's mark never halves the other's. Answers whether its arrow newly SPOTTED the foe (net/eliteGates/egLegion.js egSpotted). */
export function egMarkFoe(m, body, r, now, by = '', d = 0) {
  if (r !== HIT_KINDS.Shaft || !(d > EG_FAR_M)) return false;
  const cur = body.marked?.until > now ? body.marked : null;
  const hm = cur?.hm ? 0 : egVOf(m?.vs, 'huntersmark'), sp = !cur?.sp && m?.mast === EG_M_ID.spotter;
  if (!hm && !sp) return false;
  const H = hm || cur?.hm || 0, S = sp || !!cur?.sp;
  body.marked = { x: H + (S ? EG_SPOT_X : 0), until: now + EG_MARK_MS, by: hm ? by : cur?.by ?? by, ...(H ? { hm: H } : {}), ...(S ? { sp: 1 } : {}) };
  return sp;
}
/** The member's run as the state says it: `[sub, rl, lumen, shards, tonics, cantrips, vestiges, mastery, circles]` - AUDIT EG III
 *  (lane2 #1): `circles` each Reliquary's (the newest EG_RUN_REL_MAX), the rest's stake line's (ui/eliteGates/egHud.js egStakeText). */
export const egRunOf = (sub, m) => [sub, (m.rel ?? []).length, m.lumen ?? 0, m.shards ?? 0, m.tonics ?? 0, [...(m.cant ?? [])], (m.vs ?? []).map((p) => [...p]), m.mast ?? -1, (m.rel ?? []).slice(-EG_RUN_REL_MAX)];
