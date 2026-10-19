// @ts-check
// EG-PLAY (2026-10-11, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md section 23) and EG-FULL (2026-10-11,
// Mac: "I said I want everything"): WHAT THE CLIENT HOLDS OF AN ELITE BREACH - the hub's call and the breach room's words
// (net/wire.js validEgOut) folded into one state:
//   the call (who opened it, its seed, its company, when it opens);
//   the breach (its hall and stage, THE COUNT, the company's lives and witnesses, the Redoubts, the decrees in force -
//     the Proclamation, the Wager, the tide, the strata -, each member's run, the cache's kind, the Mementos lying, the
//     respite and the Surplus, the company's word open, the end);
//   the hall's fight in the Spire's own words (net/eliteGates/egBodies.js): its bodies (the lords and champions, the legion, the
//     errands' objects) each with its walk, its blows (FULL shape stamps), its zones, tethers and marks, its progress, the
//     place's gusts and darkness, the beats said;
//   what is the member's alone: their Vestige offer, what they were given, a recall's word;
//   EG-H1 (EG8d): the blows Watchfire told me early (`told` - each `tell`'s blow and the lead shown, until its `eb` or its
//     `untell`);
//   EG-ZF (2026-10-12; section 27.6, THE RECAP): each member's damage and healing over the breach (`ds`, `[sub, dealt,
//     healed]` - each `st`'s, and the end's), and the last lord's fall's DAMAGE CHART (`chart` - `{ at, h, dm }`, the
//     Redoubt's `dm` or an end's at the fall - net/eliteGates/egTally.js).
//
// PURE in its fold (`foldEg`); the link around it keeps the state, hands each receipt on and says a refusal once.
//
//   EG-ZJ (2026-10-12; sections 11.7, 22 and 23): each body's feet and its walk's height, its state as the room said it (an
//     object's, a lord's phase and fall), and the zones still burning - the whole fight (`efs`) folded over what this screen
//     already holds of each body (when it rose, its hurt), so a member who joins or reloads mid-fight holds the company's
//     fight at once and the fight said again every two seconds never stands its bodies anew.
//   EG-ZQ (2026-10-12; section 14): a lord's size (`sz`, Colossal's) kept on its body.
//   AUDIT EG III (2026-10-13; section 15): the SPIREBRIDGES the room raised in this hall (`bridges` - each `ebridge`'s hall, gap,
//     stand and end, who raised it), kept across the fight said again, until a second past their end.
//   AUDIT EG V (2026-10-15, lane1 #7; section 8.5): each body's FACING (`yaw` - its row's and each walk's `yw`), which the screen
//     draws it by and the relay judges a flank by.
//
// Not a DFU member. Ledger A (ELITE-GATES).
import { EG_ROLE, EG_FL, egWalkY } from './egBodies.js';   // EG-ZJ: a lord's fall, a walk's height (the room's own law)

/** A fight before anything is heard. */
export const EG_FIGHT_EMPTY = Object.freeze({ h: 0, wk: 0, bodies: Object.freeze([]), blows: Object.freeze([]), zones: Object.freeze([]), tx: Object.freeze([]), mk: Object.freeze([]), pg: Object.freeze({}), gust: null, dark: 0, rail: 0, says: Object.freeze([]), fells: Object.freeze([]), gone: Object.freeze([]), phases: Object.freeze([]), told: Object.freeze([]) });
/** The state before anything is heard. */
export const EG_STATE_EMPTY = Object.freeze({
  call: null, b: null, seed: 0, egv: 0, op: 0, wk: 0, h: 0, sg: 'wait', sa: 0, su: 0, cl: 0, ca: 0, hw: 0, dn: 0, tm: 0,   // EG-PERFECT: `tm` the company at a routed hall's tube (stageOf)
  co: Object.freeze([]), rd: 0, rh: 0, dg: 0, end: null,
  dc: Object.freeze([]), nx: Object.freeze([]), pr: '', wg: Object.freeze([]), td: '', sr: Object.freeze([]), geo: 0, ms: Object.freeze([]), ca2: '', mm: Object.freeze([]), rp: 0, sp: 0, as: Object.freeze([]),
  fight: EG_FIGHT_EMPTY, offer: null, tally: Object.freeze({}), asked: Object.freeze({}), got: Object.freeze([]), rises: Object.freeze([]), pings: Object.freeze([]), heals: Object.freeze([]), pz: null,
  falls: Object.freeze([]), redoubt: null, no: null, heardAt: 0,
  site: null,   // EG-F: the arch's site as the room keeps it (the cast-out's landing with the arch gone)
  ds: Object.freeze([]), chart: null,   // EG-ZF: the recap's numbers and the last lord's fall's chart
});
/** How many falls, beats, gifts and pings the state keeps for the screen to say. */
export const EG_FALLS_KEPT = 8;
export const EG_SAYS_KEPT = 12;
export const EG_GONE_KEPT = 48;
/** A stage's word as the state keeps it. EG-PERFECT (2026-10-18; Elite-Gates.md section 11.3): `tm` the instant the company reached
 *  a routed hall's Collapsing Tube (relay ms, 0 not yet - net/eliteGates/egBrain.js egTubeMouthOf): its fall runs from there on this
 *  screen as on the relay (scenes/eliteGates/egSpan.js tubeEdgeOf, through systems/eliteGates/spireKit.js spireWake). */
const stageOf = (w) => ({ h: w.h, sg: w.sg, sa: w.sa, su: w.su, cl: w.cl, ca: w.ca, hw: w.hw, dn: w.dn, tm: w.tm ?? 0 });
/**
 * A body as the state keeps it, from its wire array `[i, role, k, pt, x, z, hp, max, fl, tx, tz, v, at, y, ty, st, sa, sz, yw]`.
 * EG-ZJ (sections 11.7, 22 and 23): its feet `y` and its walk's end's (`mv.ty`); its state as the room said it - an object's
 * (`st`, since `stAt` - its `eob`), a lord's phase once it wakes (`ph`; 0 asleep) and, fallen (EG_FL.fell), its fall
 * (`fellAt`); `born` when it rose (`ead` - now; a body this screen first hears whole has stood all along, `born` 0, and never
 * rises again); `had` the body this screen already holds, whose own memory it keeps - when it rose, when it was last hurt and
 * whether by my blow. EG-ZQ (section 14): a lord's size over its look's (`sz` - Colossal's; 1 its look's own), which the screen
 * draws it at (scenes/eliteGates/egFight.js egLookOf). AUDIT EG V (lane1 #7): `yaw` its facing (`yw`, the relay's - net/eliteGates/egBodies.js egYawOf).
 * AUDIT FB1018f L3-4: `r` its radius, the relay's own (the word's `r` beside its row - net/eliteGates/egBodies.js egRadiusWire); none
 * heard (a relay before it), none - the strike rule then judges its object as it did (egStruckOff).
 */
export function egBodyOf(t, now, had = null, born = now, r = NaN) {
  const b = { i: t[0], role: t[1], k: t[2], pt: t[3], x: t[4], z: t[5], y: t[13] ?? 0, hp: t[6], max: t[7], fl: t[8], mv: t[11] > 0 ? { x: t[4], z: t[5], tx: t[9], tz: t[10], v: t[11], at: t[12], y: t[13] ?? 0, ty: t[14] ?? t[13] ?? 0 } : null, born: had ? had.born : born, yaw: Number.isFinite(t[18]) ? t[18] : had?.yaw ?? 0 };
  if (t[1] === EG_ROLE.obj) { b.st = t[15] ?? 0; b.stAt = t[16] ?? 0; }
  else if (t[1] === EG_ROLE.lord) { b.ph = t[15] ?? 0; b.sz = t[17] > 0 ? t[17] / 1000 : 1; if ((t[8] & EG_FL.fell) !== 0) b.fellAt = t[16] || had?.fellAt || now; }
  if (Number.isFinite(r)) b.r = r;   // AUDIT FB1018f L3-4: the relay's own radius
  if (had?.hurtAt != null) b.hurtAt = had.hurtAt;
  if (had?.mineAt != null) b.mineAt = had.mineAt;
  return b;
}
/** Where a body stands at `now` - its walk carried from its word (net/eliteGates/egBodies.js egBodyAt's law). */
export function egBodyPlace(b, now) {
  const m = b?.mv;
  if (!m || !(m.v > 0)) return [b.x, b.z];
  const len = Math.hypot(m.tx - m.x, m.tz - m.z);
  if (len < 1e-6) return [m.tx, m.tz];
  const along = Math.min(len, (Math.max(0, now - m.at) / 1000) * m.v);
  return [m.x + ((m.tx - m.x) / len) * along, m.z + ((m.tz - m.z) / len) * along];
}
/** EG-ZJ: a body's feet at `now` - its walk's height carried from its word (net/eliteGates/egBodies.js egWalkY, the room's own law),
 *  else where it stands. */
export const egBodyHeight = (b, now) => (b?.mv ? egWalkY(b.mv, now) : b?.y ?? 0);
const keepLast = (list, item, n) => [...list, item].slice(-n);
/** EG-ZJ: a lord's fall as its flags say it - fallen (EG_FL.fell, a Twin's first fall among them, which no `efell` says) it
 *  lies from its fall's word or from now, raised again (the Twins' fifteen seconds) it stands. In place; answers the body. */
function fellOf(b, now) {
  if (b.role !== EG_ROLE.lord) return b;
  if ((b.fl & EG_FL.fell) !== 0) b.fellAt ??= now;
  else delete b.fellAt;
  return b;
}

/** One fight word folded (pure). */
function foldFight(f, w, now) {
  switch (w.k) {
    case 'efs': {
      // EG-ZJ (section 22): the room's whole fight over what this screen holds of it - each body known kept its own memory
      // (egBodyOf's `had`), one first heard here standing all along; the zones the room still burns
      const same = f.h === w.h, had = same ? new Map(f.bodies.map((b) => [b.i, b])) : null;
      return { ...EG_FIGHT_EMPTY, h: w.h, wk: w.wk, bodies: w.b.map((t, j) => egBodyOf(t, now, had?.get(t[0]) ?? null, 0, w.r?.[j])), blows: w.bl, tx: w.tx, mk: w.mk, pg: w.pg, zones: w.zs ?? (same ? f.zones : []), says: same ? f.says : [], gone: same ? f.gone : [], fells: same ? f.fells : [], phases: same ? f.phases : [], told: same ? f.told ?? [] : [], gust: f.gust, dark: f.dark, rail: f.rail, bridges: (f.bridges ?? []).filter((q) => q.h === w.h) };   // AUDIT EG III: the hall's Spirebridges kept (one heard before its fight was)
    }
    case 'ead': { const had = new Set(f.bodies.map((b) => b.i)); return { ...f, bodies: [...f.bodies, ...w.a.flatMap((t, j) => (had.has(t[0]) ? [] : [egBodyOf(t, now, null, now, w.r?.[j])]))] }; }   // AUDIT FB1018f L3-4: each with its radius
    case 'emv': {
      const by = new Map(w.m.map((t) => [t[0], t]));   // EG-ZJ: `[i, x, z, tx, tz, v, at, y, ty, yw]` - its height and its end's; AUDIT EG V: its facing
      return { ...f, bodies: f.bodies.map((b) => { const t = by.get(b.i); return t ? { ...b, x: t[1], z: t[2], y: t[7] ?? b.y, yaw: Number.isFinite(t[9]) ? t[9] : b.yaw, mv: t[5] > 0 ? { x: t[1], z: t[2], tx: t[3], tz: t[4], v: t[5], at: t[6], y: t[7] ?? b.y, ty: t[8] ?? t[7] ?? b.y } : null } : b; }) };
    }
    case 'ehp': { const by = new Map(w.h.map((t) => [t[0], t[1]])); return { ...f, bodies: f.bodies.map((b) => (by.has(b.i) ? { ...b, hp: by.get(b.i), hurtAt: by.get(b.i) < b.hp ? now : b.hurtAt } : b)) }; }
    case 'edie': {
      const gone = f.bodies.filter((b) => w.is.includes(b.i)).map((b) => ({ ...b, goneAt: w.at, w: w.w, n: w.n }));
      return { ...f, bodies: f.bodies.filter((b) => !w.is.includes(b.i)), gone: [...f.gone, ...gone].slice(-EG_GONE_KEPT), tx: f.tx.filter((t) => !w.is.includes(t[0]) && !w.is.includes(t[1])) };
    }
    case 'efl': return { ...f, bodies: f.bodies.map((b) => (b.i === w.i ? fellOf({ ...b, fl: w.fl }, now) : b)) };   // EG-ZJ: a lord fallen lies down at once, one raised again stands
    case 'eb': return { ...f, blows: [...f.blows.filter((b) => b.i !== w.i && now <= b.at + Math.max(1, b.sp) + 1500), { ...w, heard: now }].slice(-40), told: (f.told ?? []).filter((b) => b.i !== w.i) };   // EG-H1: a told blow said - its early outline gone
    case 'tell': return { ...f, told: [...(f.told ?? []).filter((b) => b.i !== w.i && now <= b.at + 1500), { ...w, heard: now }].slice(-16) };   // EG-H1: Watchfire's early outline
    case 'untell': return { ...f, told: (f.told ?? []).filter((b) => b.i !== w.i) };   // EG-H1: a told blow the union floor held - no ghost on the floor
    case 'ecut': return { ...f, blows: f.blows.map((b) => (b.i === w.i ? { ...b, cut: Number.isFinite(w.at) ? Math.min(now, w.at) : now } : b)) };   // EG-PERFECT: frozen at the instant the relay cut it (its FEINT_AT), never the beat's
    case 'etx': return { ...f, tx: w.t };
    case 'emk': return { ...f, mk: w.m };
    case 'eph': return { ...f, bodies: f.bodies.map((b) => (b.i === w.i ? { ...b, ph: w.ph } : b)), phases: w.ph > 1 ? keepLast(f.phases, { i: w.i, ph: w.ph, at: now }, 6) : f.phases };   // AUDIT FB1018f L3-1: a wake's word (its first phase, net/eliteGates/egLords.js egLordsWake) wakes it here and turns no phase - no card, no growl (the wake's own roar)
    case 'efell': return { ...f, bodies: f.bodies.map((b) => (b.i === w.i ? { ...b, fellAt: w.at, hp: 0 } : b)), fells: keepLast(f.fells, { i: w.i, at: w.at, n: w.n }, 6) };
    case 'eob': return { ...f, bodies: f.bodies.map((b) => (b.i === w.i ? { ...b, st: w.st, stAt: w.at } : b)) };
    case 'ez': return { ...f, zones: [...f.zones.filter((z) => z.i !== w.i && z.until > now - 2000), w].slice(-32) };
    case 'esay': return { ...f, says: keepLast(f.says, { ...w, at: now }, EG_SAYS_KEPT) };
    case 'egust': return { ...f, gust: w };
    case 'edark': return { ...f, dark: w.until };
    case 'erail': return { ...f, rail: w.until };
    case 'ebridge': return { ...f, bridges: [...(f.bridges ?? []).filter((q) => q.h === w.h && q.until > now - 1000), { h: w.h, g: w.g, at: w.at, until: w.until, s: w.s, n: w.n }].slice(-8) };   // AUDIT EG III: a Spirebridge raised
    default: return f;
  }
}
const FIGHT_WORDS = new Set(['efs', 'ead', 'emv', 'ehp', 'edie', 'efl', 'eb', 'ecut', 'etx', 'emk', 'eph', 'efell', 'eob', 'ez', 'esay', 'egust', 'edark', 'erail', 'tell', 'untell', 'ebridge']);

/**
 * One word folded into the breach's state (pure). A word of another breach than the one held is not this one's - a call
 * starts a breach's state over, a room's `st` replaces it. AUDIT EG V (lane4 L4-4; section 6.1, "one breach at a time"):
 * but never the breach this screen stands in - a call of another breach heard while the room's breach is live (egLiveHeld)
 * is kept as the call alone, and the breach, its hall and its fight stand: the hub calls the opener's whole frozen company,
 * and a member still in another breach's trial (its opener's own end come, a second breach opened) had its state wiped -
 * the screen's frame stood down every frame until its room next said `st`.
 * @param {any} s @param {any} w a validEgOut projection @param {number} now
 */
export function foldEg(s, w, now) {
  if (!w) return s;
  if (FIGHT_WORDS.has(w.k)) {
    if (w.k !== 'efs' && w.k !== 'esay' && s.fight.h && s.fight.h !== s.h) return { ...s, fight: foldFight(EG_FIGHT_EMPTY, w, now), heardAt: now };
    return { ...s, fight: foldFight(s.fight, w, now), heardAt: now };
  }
  switch (w.k) {
    case 'call': return s.b === w.b || egLiveHeld(s) ? { ...s, call: w, heardAt: now } : { ...EG_STATE_EMPTY, call: w, b: w.b, seed: w.seed, op: w.op, rh: w.rh, heardAt: now };
    case 'st': {
      const same = s.b === w.b;
      return { ...(same ? s : EG_STATE_EMPTY), call: same ? s.call : null, b: w.b, seed: w.seed, egv: w.egv, op: w.op, wk: w.wk, ...stageOf(w), co: w.co, rd: w.rd, rh: w.rh, dg: w.dg, end: w.end,
        dc: w.dc, nx: w.nx ?? [], pr: w.pr, wg: w.wg, td: w.td, sr: w.sr, geo: w.geo, ms: w.ms, ca2: w.ca2, mm: w.mm, rp: w.rp, sp: w.sp, as: w.as,   // AUDIT EG V (L2-11): `nx` the rest's beacon
        site: w.site ?? (same ? s.site : null),   // EG-F
        ds: w.ds ?? [],   // EG-ZF
        fight: same && s.fight.h === w.h ? s.fight : EG_FIGHT_EMPTY, heardAt: now };
    }
    case 'sg': return { ...s, ...stageOf(w), ...(w.h !== s.h ? { dg: 0 } : {}), fight: w.h === s.fight.h ? s.fight : EG_FIGHT_EMPTY, offer: w.sg === 'rest' ? s.offer : null, heardAt: now };   // AUDIT EG V (L3-12): a new hall's stage lets the last hall's digest go - `dg` is only ever its own hall's (`st` brings the next)
    case 'co': return { ...s, co: w.co, heardAt: now };
    case 'fall': return { ...s, falls: keepLast(s.falls, { s: w.s, n: w.n, at: w.at, fin: w.fin }, EG_FALLS_KEPT), heardAt: now };
    case 'rd': return { ...s, rd: w.w, redoubt: { w: w.w, h: w.h, at: w.at, cl: w.cl, g: w.g, v: w.v, cov: w.cov }, chart: w.dm ? { at: w.at, h: w.h, dm: w.dm } : s.chart, heardAt: now };   // EG-ZF: the lord's fall's chart
    case 'end': return { ...s, end: w.why, sg: 'end', offer: null, as: [], ds: w.ds?.length ? w.ds : s.ds, chart: w.dm ? { at: w.at, h: s.h, dm: w.dm } : s.chart, heardAt: now };   // EG-ZF: the end's numbers, and its fall's chart
    case 'no': return { ...s, no: w.m, heardAt: now };
    case 'offer': return { ...s, offer: w.v.length && w.n > 0 ? { v: w.v, n: w.n, at: now } : null, heardAt: now };
    case 'ask': return { ...s, as: [...s.as.filter((a) => a[0] !== w.q), [w.q, w.o, w.until]], heardAt: now };
    case 'asked': return { ...s, as: s.as.filter((a) => a[0] !== w.q), asked: { ...s.asked, [w.q]: w.r }, heardAt: now };
    case 'tally': return { ...s, tally: { ...s.tally, [w.q]: w.v }, heardAt: now };
    case 'egot': return { ...s, got: keepLast(s.got, { w: w.w, at: now }, 8), heardAt: now };
    case 'run': return { ...s, ms: [...s.ms.filter((r) => r[0] !== w.r[0]), w.r], heardAt: now };
    case 'rise': return { ...s, rises: keepLast(s.rises, { ...w, at: now }, 4), heardAt: now };
    case 'eping': return { ...s, pings: keepLast(s.pings.filter((p) => now - p.at < 6000), { ...w, at: now }, 16), heardAt: now };
    case 'eheal': return { ...s, heals: keepLast(s.heals, { p: w.p, why: w.why, at: now }, 6), heardAt: now };
    case 'pz': return { ...s, pz: { ...w, at: now }, fight: { ...s.fight, pg: { ...s.fight.pg, st: w.st, f: w.f, lit: w.lit } }, heardAt: now };
    case 'rcpt': return s;
    default: return s;
  }
}
/** AUDIT EG V (lane4 L4-4): does state `s` hold a breach its room has spoken of (its company said) that has not ended -
 *  the breach this screen stands in, which no other breach's call replaces? */
export const egLiveHeld = (s) => !!s?.b && (s.co?.length ?? 0) > 0 && !s.end;
/** THE COUNT at `now` (the relay's clock): what was left when it last began to run, less the time since - or, held,
 *  what is left. */
export const egCountAt = (s, now) => (s.ca > 0 ? Math.max(0, s.cl - Math.max(0, now - s.ca)) : s.cl);
/** The company's row for an account, or null: `{ sub, name, n, alive, home, in, wit, forsaken, falls, recall, here }`. */
export function egMemberOf(s, sub) {
  const t = s.co.find((c) => c[0] === sub);
  return t ? { sub: t[0], name: t[1], n: t[2], alive: t[3] === 1, home: t[4] === 1, in: t[5] === 1, wit: t[6] === 1, forsaken: t[7] === 1, falls: t[8] ?? 0, recall: t[9] === 1, here: t[10] === 1 } : null;   // AUDIT EG V (c, L3-10): `here` said in the hall the company stands in
}
/** A member's run (`{ rel, lumen, shards, tonics, cant, vs, mast, rw }`), or an empty one - AUDIT EG III: `rw` each Reliquary's
 *  circle (net/eliteGates/egRun.js egRunOf). */
export function egRunOfMember(s, sub) {
  const r = s.ms.find((x) => x[0] === sub);
  return r ? { rel: r[1], lumen: r[2], shards: r[3], tonics: r[4], cant: r[5], vs: r[6], mast: r[7], rw: Array.isArray(r[8]) ? r[8] : [] } : { rel: 0, lumen: 0, shards: 0, tonics: 0, cant: [], vs: [], mast: -1, rw: [] };
}
/** How many of the company live and have entered, and how many have entered at all. */
export const egLivingCount = (s) => s.co.filter((c) => c[3] === 1 && c[4] === 0 && c[5] === 1).length;
/** AUDIT EG V (c, L3-10; section 7 - "a ring fills over the plate, *3 of 6 here*"): THE GATHER as the room counts it -
 *  `{ here, n }`: of the members the hall waits for (the living entrants; before the breach's first wake, the whole company -
 *  net/eliteGates/egBrain.js's arrive step), how many have said `here` (the company row's eleventh). Pure. */
export function egGatherOf(s) {
  const waits = s.wk > 0 ? s.co.filter((c) => c[3] === 1 && c[4] === 0 && c[5] === 1) : s.co.filter((c) => c[3] === 1 && c[4] === 0);
  return { here: waits.filter((c) => c[10] === 1).length, n: waits.length };
}

/**
 * THE LINK: `word(w)` folds a word (a receipt handed on to `onReceipt`, a refusal said once), `state()`, `now()` (the
 * relay's clock), `clear()` (out of the breach: the state forgotten, the call kept while it stands).
 * @param {{ now: () => number, say?: (text: string) => void, onReceipt?: (r: string) => void, onRefused?: (word: string) => (boolean|void) }} deps
 *   EG-F: `onRefused` answering true has said the refusal its own way, and the link says nothing more.
 */
export function createEgLink({ now, say = () => {}, onReceipt = () => {}, onRefused = () => {} }) {
  let s = EG_STATE_EMPTY;
  return {
    word(w) {
      if (!w) return;
      if (w.k === 'rcpt') { onReceipt(w.r); return; }
      s = foldEg(s, w, now());
      if (w.k === 'no' && !onRefused(w.m)) say(w.m.charAt(0).toUpperCase() + w.m.slice(1) + '.');   // EG-F: a refusal the client words itself (the late line) is said once, in its words
    },
    state: () => /** @type {any} */ (s),
    now,
    /** Out of the breach: everything but a call still standing forgotten. */
    clear() { s = s.call ? { ...EG_STATE_EMPTY, call: s.call, b: s.call.b, seed: s.call.seed, op: s.call.op, rh: s.call.rh } : EG_STATE_EMPTY; },
    /** The call forgotten too (its window over, or the breach ended). */
    forget() { s = EG_STATE_EMPTY; },
  };
}
