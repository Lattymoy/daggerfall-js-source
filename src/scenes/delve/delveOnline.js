// @ts-check
// DELVE II (DLV3, bible/03-World/Delve-II.md section 7): THE ENCOUNTERS ONLINE, THE PAGE'S HALF. The dungeon's room keeps
// each site's ledger (server/src/delveRoom.js); a page says its plan, its words, its acts and its blows, and reads the
// room's state back. The host and its looks read a ledger's fields, so the room's state is made a ledger-shaped VIEW here
// (AUDIT DLV4 F5: one adapter, the looks unchanged) - its encounter clock re-anchored at every state from the time left
// in the phase, and run on between them. Pure.
import {
  DELVE_KIND_NAMES,
  DP,
  FLAME,
  WEIGHT,
  VIGIL_LIGHT,
  WEIGHTS,
  gatherMs,
  litanyCount,
  litanyShowMs,
  HOLD_WAVE_MAX_MS,
  HOLD_BREATH_MS,
  HOLD_CAPTAIN_MAX_MS,
  SPRING_MAX_MS,
  SEAL_SINK_MS,
  sealWindowMs,
} from '../../net/delve/delveLaw.js';

/** A page says a site's word this often while it is near, its foes' machine or carrying - at once when it changes (ms). */
export const DELVE_WORD_MS = 1_000;
/** An act is said once, and again this long after if the room's state has not moved (its bucket may drop one). */
export const DELVE_ACT_AGAIN_MS = 600;
/** The plan is said until the room answers, this often (ms). */
export const DELVE_PLAN_AGAIN_MS = 3_000;
/** My own attempt at another site, said again at most this often (ms) while I stand in a second ward. */
export const DELVE_HELD_SAY_MS = 30_000;
/** The view's own carrier when it is mine, and when it is another member's (the room names no account). */
export const VIEW_ME = 'me';
export const VIEW_PEER = 'peer';

/** The plan on the wire: its hash, whether an Elite dungeon's, its sites as tuples (net/wire.js validDelveIn `pl`). Pure. */
export function delvePlanWire(sites, hash, tier) {
  return {
    k: 'pl',
    h: hash,
    e: tier === 'elite' ? 1 : 0,
    s: sites.map((s) => [
      s.i,
      DELVE_KIND_NAMES.indexOf(s.kind) + 1,
      s.x,
      s.y,
      s.z,
      s.r,
      s.vault[0],
      s.vault[1],
      s.vault[2],
    ]),
  };
}
/** A phase's whole length on the encounter clock, from the room's state (-1 for one with none). Pure. */
export function phaseMs(kind, st, k) {
  switch (st.p) {
    case DP.gather:
      return gatherMs(kind);
    case DP.wave:
      return HOLD_WAVE_MAX_MS;
    case DP.breath:
      return HOLD_BREATH_MS;
    case DP.captain:
      return HOLD_CAPTAIN_MAX_MS;
    case DP.show:
      return litanyShowMs(k);
    case DP.spring:
      return SPRING_MAX_MS;
    case DP.work:
      return kind === 'seals' ? sealWindowMs(k) : -1; // the law's own window for its count, never a wave's size
    case DP.sunk:
      return SEAL_SINK_MS;
    default:
      return -1;
  }
}
/**
 * THE ROOM'S STATE AS A LEDGER (net/wire.js validDelveOut `dl`) - null for a site at rest. Each phase starts at 0 on the
 * view's clock and `ec` is how far into it the room is, so the looks' `ec - sh` and the pours' `ec - ss` read as they do
 * offline. A piece I carry is the view's VIEW_ME; another member's, VIEW_PEER. `prev` the last view, whose clock and
 * shows run on. Pure.
 * @param {any} site @param {any} st @param {any} prev
 */
export function delveView(site, st, prev = null) {
  if (!st || st.p === DP.idle) return null;
  const kind = site.kind;
  const k = st.n ?? (kind === 'litany' ? litanyCount(site.tier) : kind === 'weighing' ? WEIGHTS : 0);
  const len = phaseMs(kind, st, k);
  const ec = len >= 0 && st.wl >= 0 ? Math.max(0, len - st.wl) : prev?.p === st.p ? prev.ec : 0;
  const me = st.me ?? {};
  return {
    kind,
    s: site.i,
    tier: site.tier,
    p: st.p,
    w: st.w,
    wz: st.wz,
    sw: kind === 'seals' ? sealWindowMs(k) : 0,
    kn: st.kn,
    next: st.nx,
    k,
    ec,
    gs: 0,
    ws: 0,
    bs: 0,
    cs: 0,
    sh: 0,
    ss: 0,
    su: 0,
    hp: Array.isArray(st.h) ? [...st.h] : [],
    hx: st.hx ?? 0,
    lt: st.lt ?? VIGIL_LIGHT,
    lb: st.lb ?? 0,
    fl: st.fl ?? FLAME.heart,
    fx: Array.isArray(st.fx) && st.fx.length === 3 ? [...st.fx] : [0, 0, 0],
    fc: me.hd === -1 ? VIEW_ME : st.fl === FLAME.carried ? VIEW_PEER : '',
    wt: (st.wt ?? []).map(([s, p, x, z], j) => ({
      s,
      p,
      x,
      y: site.y,
      z,
      by: me.hd === j ? VIEW_ME : s === WEIGHT.carried ? VIEW_PEER : '',
    })),
    hs: Number.isSafeInteger(st.hd) && st.hd >= 0 ? 0 : -1,
    order: Array.isArray(st.or) ? [...st.or] : (prev?.order ?? []),
    shows: (prev?.shows ?? 0) + (st.p === DP.show && prev?.p !== DP.show ? 1 : 0),
    inAt: prev?.inAt ?? -Infinity,
    fo: st.fo ? (me.fm ? VIEW_ME : VIEW_PEER) : '',
    earned: [],
    a: Object.create(null),
  };
}
/** A word's key: what moves it (the room hears it at once when it changes). Pure. */
export const delveWordKey = (w) => `${w.i}|${w.o}|${w.kw}|${w.kn}|${w.wc}|${w.cf}|${w.st}|${w.hb}|${w.iw}`;
