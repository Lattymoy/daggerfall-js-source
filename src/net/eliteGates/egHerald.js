// @ts-check
// EG-E3 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 20, "The herald"): THE
// SPIRE'S HERALD - what the relay's hub posts to the world events' Discord channel for the Elite Breach, and when: the
// gate's law (net/gate/gateHerald.js), the serpent's and the Abyss Dungeon's (net/serpent/serpentHerald.js, net/superDungeon/sdHerald.js), given to
// the Battlespire. Five posts:
//
// - EVERY TENTH REDOUBT (10, 20, 30...): "<opener>'s company took Redoubt 10 of the Battlespire (Hall 50) in 1:51:20." - AUDIT
//   EG V (L8-7): the time is from the breach's first hall's wake, so a breach begun deeper says where it began ("..., from
//   Redoubt 9."). FIELD BUGS 2026-10-20d LONE-HERALD: a company of one is named as one - "Mara took Redoubt 20 of the
//   Battlespire (Hall 100) alone in ..." - by the size its news carries (`n`, the Descent's count); First of the Spire and a
//   seal's post the same.
// - FIRST OF THE SPIRE: the first company ever to take Redoubt 10 - its post in that Redoubt's place, said once ever (a
//   flag the hub keeps in its storage for good).
// - THE LONE BEACON: a Court felled alone in a company of four or more (the relay's own `lb`, net/eliteGates/egBrain.js redoubt) -
//   once a member a breach.
// - A NEW TOP OF THE DESCENT in any bracket - Alone (1), the Few (2-4), the Company (5-8): the hub's own reckoning of the
//   season's best (the deepest hall cleared, then the fewest seconds from Hall 1's wake to that hall's door) from every
//   breach begun at Hall 1, unwagered and no Rehearsal - the facts the end receipts carry; the season is the arena's
//   (net/arena/arenaLaw.js arenaSeasonOf). A top shallower than Hall EG_HERALD_TOP_HALL is kept and not said: a season's first
//   breaches are each a new top, and the channel would hear every hall of them.
// - A BAND'S SEAL LIFTED: "The way below the Galleries is open." - the first breach through a band a deploy opened (THE
//   SEAL, section 13.3: net/eliteGates/egLaw.js EG_OPEN, the bands a deploy opens). The hub keeps the bands that were open when it
//   first heard of the Spire and the last band it said, so a band open from the start is never news.
//
// AN OPENING IS NEVER HERALDED: a company's breach is its own.
//
// THE PATH: the breach's room (`eg:<16hex>`) keeps its news on the breach (`B.hq`, the director's) and tells the hub
// (EG_INTERNAL_HERALD - the room-to-hub door the gate's kill uses, GATE_INTERNAL_FELL) until the hub answers; the hub
// folds each tell into its record once (egHeraldFold - news told twice is folded once, by its breach and number), keeps
// the posts it owes in its storage (EG_HERALD_KEY), and posts them off its alarm beside the other heralds, in order, each
// again HERALD_RETRY_MS on until Discord takes it, and lets one go once it is no news (EG_HERALD_KEEP_MS).
//
// PURE, and the relay's: this imports gateHerald.js, egLaw.js and arenaLaw.js, all in the relay already. Nothing here
// fetches; the hub hands Discord what these build.
//
// - THE DOOR: the gate's channel (GATE_DISCORD_WEBHOOK). EVERY POST PINGS NOBODY (`allowed_mentions: { parse: [] }`) - the
//   page's "falls back to the gate's role, pinging no one": the gate's role is its omen's, and no Spire post needs one.
// - SAFE TO POST: every name a player can reach is held to letters, digits, spaces and a little punctuation (heraldName).
//
// Not a DFU member: Daggerfall has no other players and no Discord. Ledger A (ELITE-GATES).
import { heraldName, heraldList } from '../gate/gateHerald.js';
import { EG_BREACH_RE, EG_PARTY_MAX, EG_LORDS, EG_OPEN, egBandOfHall } from './egLaw.js';
import { arenaSeasonOf } from '../arena/arenaLaw.js';

/** The hub's internal door a breach's room tells its news at. */
export const EG_INTERNAL_HERALD = '/internal/eg/herald';
/** The hub's storage key: the herald's record (egHeraldFold). */
export const EG_HERALD_KEY = 'egherald';
/** Every this-many Redoubts the channel hears; the Redoubt whose first taking is First of the Spire. */
export const EG_HERALD_EVERY = 10;
export const EG_HERALD_FIRST = 10;
/** A Descent top is said from this hall cleared (Redoubt 2's Court); below it, kept and not said. */
export const EG_HERALD_TOP_HALL = 10;
/** The most news a breach keeps for the hub (and one tell carries), and the most posts the hub owes (the oldest let go
 *  past either). */
export const EG_HERALD_TELL_MAX = 16;
export const EG_HERALD_OWE_MAX = 16;
/** How long a piece of news, or a post owed, is still news (ms) - a Discord down an hour lets it go. */
export const EG_HERALD_KEEP_MS = 3_600_000;
/** How soon a breach's room tells the hub again after a tell the hub did not take (ms). */
export const EG_HERALD_TELL_MS = 5000;
/** The tells the hub remembers folding (a breach's news told again after a lost answer is folded once). */
export const EG_HERALD_SEEN_MAX = 64;
/** The Descent's three brackets, by the company's entrants - every member its room admitted, earning or not (section 20). */
export const EG_DESCENT_BRACKETS = Object.freeze(['Alone', 'the Few', 'the Company']);
/** A company of `n`'s bracket (0 Alone, 1 the Few, 2 the Company), or -1. */
export const egDescentBracket = (n) => (n === 1 ? 0 : n >= 2 && n <= 4 ? 1 : n >= 5 && n <= EG_PARTY_MAX ? 2 : -1);
/** Each band as the seal's post names it ("The way below the Galleries is open."). */
export const EG_HERALD_BAND_WORDS = Object.freeze(['the Galleries', 'the Soul Cairn', 'the Shade Perilous', 'the Havoc Wellhead']);

/** Seconds as the posts say them: `h:mm:ss`, or `m:ss` under the hour. */
export function egHeraldTime(s) {
  const t = Math.max(0, Math.floor(Number(s) || 0)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60);
  const two = (v) => String(v).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(t % 60)}` : `${m}:${two(t % 60)}`;
}
/** "<opener>'s company", or "A company" for a name that says nothing. */
const companyOf = (o) => { const n = heraldName(o); return n ? `${n}'s company` : 'A company'; };
/** FIELD BUGS 2026-10-20d LONE-HERALD: is the news's company one member (`n`, its entrants - 0 when the news did not say)? */
const lone = (n) => n === 1;
/** Who a post names: a company of one by its member's name ("Someone" for a name that says nothing); any other company - and
 *  one whose size its news did not say - as "<opener>'s company". */
const whoOf = (o, n) => (lone(n) ? heraldName(o) || 'Someone' : companyOf(o));
/** The names a post may say, at most a company's. */
const namesOf = (by) => (Array.isArray(by) ? by : []).slice(0, EG_PARTY_MAX).map(heraldName).filter(Boolean);
/** A lord mid-sentence: its name (a leading "The" lowered), or the Court's lord for a key the table lacks. */
export const egHeraldLord = (lk) => { const L = EG_LORDS[lk]; return L ? L.name.replace(/^The /, 'the ') : 'the Court\'s lord'; };
const quiet = (content) => ({ content, allowed_mentions: { parse: [] } });

/** AUDIT EG V (L8-7): the start a post's time ran from, said when it was not Hall 1 (`ew` the Redoubt the breach began at). */
const fromOf = (ew) => (Number.isSafeInteger(ew) && ew > 0 ? `, from Redoubt ${ew}` : '');
/**
 * EVERY TENTH REDOUBT: the opener's company - or a company of one's member, alone (`n` 1) - the Redoubt, its hall and the time
 * since the breach's first hall woke - Hall 1's, or the Redoubt it began at said (`ew`). Pings nobody.
 * @param {{o?: string, n?: number, w: number, h: number, t: number, ew?: number}} p
 */
export const egRedoubtPost = ({ o = '', n = 0, w, h, t, ew = 0 }) => quiet(`**${whoOf(o, n)} took Redoubt ${w} of the Battlespire (Hall ${h})${lone(n) ? ' alone' : ''}** in ${egHeraldTime(t)}${fromOf(ew)}.`);
/**
 * FIRST OF THE SPIRE: the first company ever to take Redoubt 10 - the opener's company and every name in it, or a company of
 * one's member, alone (AUDIT EG V, L8-7: its time's start said as the Redoubt's post says it). Pings nobody.
 * @param {{o?: string, n?: number, by?: ReadonlyArray<string>, w: number, h: number, t: number, ew?: number}} p
 */
export function egFirstPost({ o = '', n = 0, by = [], w, h, t, ew = 0 }) {
  const names = lone(n) ? [] : namesOf(by);
  return quiet(`**First of the Spire:** ${whoOf(o, n)} is the first ever to take Redoubt ${w} of the Battlespire (Hall ${h}), ${lone(n) ? 'alone, ' : ''}in ${egHeraldTime(t)}${fromOf(ew)}${names.length ? ` - ${heraldList(names)}` : ''}.`);
}
/**
 * THE LONE BEACON: who felled which lord alone, and the company they were the last standing of. Pings nobody.
 * @param {{n?: string, lk?: string, c: number}} p
 */
export const egLonePost = ({ n = '', lk = '', c }) => quiet(`**The Lone Beacon:** ${heraldName(n) || 'Someone'} felled ${egHeraldLord(lk)} alone, the last of a company of ${c} still standing.`);
/**
 * A NEW TOP OF THE DESCENT: the bracket, the company's names, the hall and its seconds. Pings nobody.
 * @param {{br: number, by?: ReadonlyArray<string>, o?: string, h: number, td: number}} p
 */
export function egTopPost({ br, by = [], o = '', h, td }) {
  const names = namesOf(by);
  return quiet(`**A new top of the Descent** (${EG_DESCENT_BRACKETS[br] ?? ''}): ${names.length ? heraldList(names) : companyOf(o)} cleared Hall ${h} in ${egHeraldTime(td)}.`);
}
/**
 * A BAND'S SEAL LIFTED: the way below the band, and the company first through (a company of one's member, alone). Pings nobody.
 * @param {{band: number, o?: string, n?: number}} p
 */
export const egSealPost = ({ band, o = '', n = 0 }) => quiet(`**The way below ${EG_HERALD_BAND_WORDS[band] ?? 'the Spire'} is open.** ${whoOf(o, n)} is the first through${lone(n) ? ', alone' : ''}.`);
/** The post for an owed record (egHeraldFold's `q`), by its kind. */
export function egHeraldPost(p) {
  if (p.kind === 'first') return egFirstPost(p);
  if (p.kind === 'lb') return egLonePost(p);
  if (p.kind === 'top') return egTopPost(p);
  if (p.kind === 'seal') return egSealPost(p);
  return egRedoubtPost(p);
}

const nat = (v, lo, hi) => Number.isSafeInteger(v) && v >= lo && v <= hi;
const str = (v) => (typeof v === 'string' ? v.slice(0, 64) : '');
const LORD_RE = /^[a-z]{1,16}$/;
/**
 * A breach room's tell, as the hub reads it: `{ b, ev }` - the breach and its news, each piece projected through the
 * law (a piece out of shape dropped, as a client's would be); null for a tell that is not one.
 *   `{ i, at, k: 'rd', w, h, t, n, ew, o, by }`  a Valkynaz's Redoubt (every fifth): the Redoubt, its hall, seconds since the
 *                                          breach's first hall woke (Hall 1's only when `ew`, the Redoubt it began at, is 0 -
 *                                          AUDIT EG V, L8-7), the company's entrants (0 when a room before LONE-HERALD did
 *                                          not say), the name its post leads with (the opener's; a company of one's member)
 *                                          and the earners'
 *   `{ i, at, k: 'lb', n, lk, c }`        a Court felled alone: who, the lord, the company's entrants
 *   `{ i, at, k: 'dc', h, td, n, o, by }` the breach's end, a Descent's candidate: the deepest hall cleared, its seconds,
 *                                          the entrants, the opener's name and theirs
 * @param {any} body
 * @returns {{ b: string, ev: any[] }|null}
 */
export function validEgHeraldTell(body) {
  if (!body || typeof body !== 'object' || typeof body.b !== 'string' || !EG_BREACH_RE.test(body.b) || !Array.isArray(body.ev) || body.ev.length > EG_HERALD_TELL_MAX) return null;
  const ev = [];
  for (const e of body.ev) {
    if (!e || typeof e !== 'object' || !nat(e.i, 1, 1e9) || !nat(e.at, 0, Number.MAX_SAFE_INTEGER)) continue;
    const by = Array.isArray(e.by) ? e.by.slice(0, EG_PARTY_MAX).map(str) : [];
    if (e.k === 'rd' && nat(e.w, 1, 19_999) && nat(e.h, 1, 99_999) && nat(e.t, 0, 7 * 86_400)) ev.push({ i: e.i, at: e.at, k: 'rd', w: e.w, h: e.h, t: e.t, n: nat(e.n, 1, EG_PARTY_MAX) ? e.n : 0, ew: nat(e.ew, 0, 19_999) ? e.ew : 0, o: str(e.o), by });
    else if (e.k === 'lb' && nat(e.c, 1, EG_PARTY_MAX) && (e.lk === '' || (typeof e.lk === 'string' && LORD_RE.test(e.lk)))) ev.push({ i: e.i, at: e.at, k: 'lb', n: str(e.n), lk: e.lk, c: e.c });
    else if (e.k === 'dc' && nat(e.h, 1, 99_999) && nat(e.td, 0, 7 * 86_400) && nat(e.n, 1, EG_PARTY_MAX)) ev.push({ i: e.i, at: e.at, k: 'dc', h: e.h, td: e.td, n: e.n, o: str(e.o), by });
  }
  return { b: body.b, ev };
}

/** @typedef {{ q: any[], n: number, first: number, base: number, said: number, top: { s: number, b: Array<number[]|null> }, seen: string[] }} EgHeraldState */
/**
 * The herald's record as the hub's storage holds it, every part read through its shape: `q` the posts owed (each `{ i,
 * at, kind, ... }`), `n` the last post's number, `first` 1 once First of the Spire is taken, `base` the bands open when
 * the hub first heard of the Spire (-1 before), `said` the last band whose seal lifting was said (-1 none), `top` the
 * season's best a bracket (`[hall, seconds]`, or null), `seen` the news folded (`<breach>:<number>`).
 * @returns {EgHeraldState}
 */
export function readEgHeraldState(v) {
  const o = v && typeof v === 'object' ? v : {};
  const tb = Array.isArray(o.top?.b) ? o.top.b : [];
  const pair = (x) => (Array.isArray(x) && Number.isSafeInteger(x[0]) && Number.isSafeInteger(x[1]) ? [x[0], x[1]] : null);
  return {
    q: Array.isArray(o.q) ? o.q.filter((p) => p && typeof p === 'object' && Number.isSafeInteger(p.i) && Number.isSafeInteger(p.at) && typeof p.kind === 'string').slice(-EG_HERALD_OWE_MAX) : [],
    n: Number.isSafeInteger(o.n) ? o.n : 0,
    first: o.first === 1 ? 1 : 0,
    base: Number.isSafeInteger(o.base) ? o.base : -1,
    said: Number.isSafeInteger(o.said) ? o.said : -1,
    top: { s: Number.isSafeInteger(o.top?.s) ? o.top.s : 0, b: [pair(tb[0]), pair(tb[1]), pair(tb[2])] },
    seen: Array.isArray(o.seen) ? o.seen.filter((x) => typeof x === 'string').slice(-EG_HERALD_SEEN_MAX) : [],
  };
}

/**
 * THE HUB'S RECKONING: a breach's tell folded into the herald's record at `nowMs`, each piece of news once (its breach
 * and number). It owes a post (when `post` - a hub with no herald keeps the reckoning alone, the first company ever, the
 * season's tops and the bands said, and owes nothing):
 * - a Redoubt every EG_HERALD_EVERY - First of the Spire in place of the first EG_HERALD_FIRST ever;
 * - a Valkynaz's Redoubt closing band k (Hall 25, 50, 75), when band k + 1 is open now (`open`), was not open when the
 *   hub first heard of the Spire (`base`), and has not been said;
 * - a Court felled alone;
 * - a Descent candidate deeper than its bracket's best this season (or as deep, in fewer seconds), from Hall
 *   EG_HERALD_TOP_HALL.
 * Answers the new record; `st` is left as it was.
 * @param {EgHeraldState} st @param {{ b: string, ev: any[] }} tell
 * @param {{ nowMs: number, open?: number, post?: boolean }} o
 * @returns {EgHeraldState}
 */
export function egHeraldFold(st, tell, { nowMs, open = EG_OPEN, post = true }) {
  const S = { ...st, q: [...st.q], top: { s: st.top.s, b: [...st.top.b] }, seen: [...st.seen] };
  if (S.base < 0) S.base = open;
  const owe = (p) => { if (post) { S.n += 1; S.q.push({ i: S.n, at: nowMs, ...p }); } };
  for (const e of tell.ev) {
    const id = `${tell.b}:${e.i}`;
    if (S.seen.includes(id)) continue;
    S.seen.push(id);
    if (e.k === 'rd') {
      if (e.w % EG_HERALD_EVERY === 0) {
        if (e.w === EG_HERALD_FIRST && !S.first) { S.first = 1; owe({ kind: 'first', o: e.o, n: e.n ?? 0, by: e.by, w: e.w, h: e.h, t: e.t, ew: e.ew ?? 0 }); }
        else owe({ kind: 'rd', o: e.o, n: e.n ?? 0, w: e.w, h: e.h, t: e.t, ew: e.ew ?? 0 });
      }
      const below = egBandOfHall(e.h) + 1;
      if (e.h % 25 === 0 && below < open && below >= S.base && below > S.said) { S.said = below; owe({ kind: 'seal', band: below - 1, o: e.o, n: e.n ?? 0 }); }
    } else if (e.k === 'lb') owe({ kind: 'lb', n: e.n, lk: e.lk, c: e.c });
    else if (e.k === 'dc') {
      const br = egDescentBracket(e.n), season = arenaSeasonOf(Math.floor(nowMs / 1000));
      if (br < 0) continue;
      if (S.top.s !== season) S.top = { s: season, b: [null, null, null] };
      const cur = S.top.b[br];
      if (cur && (e.h < cur[0] || (e.h === cur[0] && e.td >= cur[1]))) continue;
      S.top.b[br] = [e.h, e.td];
      if (e.h >= EG_HERALD_TOP_HALL) owe({ kind: 'top', br, by: e.by, o: e.o, h: e.h, td: e.td });
    }
  }
  S.seen = S.seen.slice(-EG_HERALD_SEEN_MAX);
  S.q = S.q.slice(-EG_HERALD_OWE_MAX);
  return S;
}

/**
 * The post the herald owes next at `nowMs`, past the ones already `done` this beat: `{ p, gone }` - the first owed post
 * still news (null for none), and the numbers of those no longer news, to let go unposted.
 * @param {EgHeraldState} st @param {ReadonlySet<number>} done @param {number} nowMs
 */
export function egHeraldNext(st, done, nowMs) {
  const gone = [];
  for (const p of st.q) {
    if (done.has(p.i)) continue;
    if (nowMs < p.at + EG_HERALD_KEEP_MS) return { p, gone };
    gone.push(p.i);
  }
  return { p: null, gone };
}
