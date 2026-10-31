// @ts-check
// DRAGON3 (bible/11-Multiplayer/Dwarven-Dragon.md sections 4 and 9): WHAT THE CLIENT HOLDS OF A DRAGON'S FIGHT - the cell's
// words (net/wire.js validDragonOut) folded into one state: its look, phase, health, mode, ward, the plan its body flies
// (net/dragon/dragonBody.js planAt walks it as the relay does), its blows in flight, its fall and its leaving; and this
// account's receipts by watch and place. The serpent's link's twin (net/serpent/serpentLink.js): only this machine's own site's words
// are folded, so a forged site's fight is never drawn as mine. `foldDragon` is pure. Not a DFU member. Ledger A (DRAGON).
import { readDragonReceipt } from './dragonReceipt.js';
import { dragonSiteKey } from './dragonLaw.js';
import { DRAGON_BLOWS_KEPT, BLOW_KEEP_MS } from './dragonBrain.js';

/**
 * @typedef {{w: number|null, b: number, sx: number, sz: number, ph: number, hp: number, max: number, md: number, ma: number,
 *   mu: number, sh: number, legs: any[], blows: any[], n: number, lv: number, op: number, fell: any, gone: number|null,
 *   heardAt: number}} DragonState
 */
/** Nothing heard yet. @type {Readonly<DragonState>} */
export const DRAGON_STATE_EMPTY = Object.freeze({
  w: null,
  b: 0,
  sx: 0,
  sz: 0,
  ph: 1,
  hp: 0,
  max: 0,
  md: 0,
  ma: 0,
  mu: 0,
  sh: 0,
  legs: [],
  blows: [],
  n: 0,
  lv: 0,
  op: 0,
  fell: null,
  gone: null,
  heardAt: 0,
});

/** Is a word of this site (its native point to the whole unit)? @param {{sx: number, sz: number}|null} a @param {any} b */
export const sameDragonSite = (a, b) =>
  !!a &&
  !!b &&
  Number.isFinite(b.sx) &&
  Number.isFinite(b.sz) &&
  dragonSiteKey(a.sx, a.sz) === dragonSiteKey(b.sx, b.sz);
/** A blow kept while it can still land or linger. */
const keep = (blows, now) => blows.filter((q) => now < q.at + (q.sp ?? 0) + BLOW_KEEP_MS).slice(-DRAGON_BLOWS_KEPT);

/**
 * One word folded in. `st` replaces everything; the rest move their own fields; a word before any whole state, or of
 * another watch than the state's, changes nothing. A blow already held is never taken twice.
 * @param {Readonly<DragonState>} s @param {any} w a validDragonOut projection @param {number} now
 * @returns {Readonly<DragonState>}
 */
export function foldDragon(s, w, now) {
  if (!w) return s;
  if (w.k === 'st') {
    return {
      w: w.w,
      b: w.b,
      sx: w.sx,
      sz: w.sz,
      ph: w.ph,
      hp: w.h,
      max: w.m,
      md: w.md,
      ma: Number.isFinite(w.ma) ? w.ma : s.w === w.w && s.md === w.md ? s.ma : 0,
      mu: w.mu,
      sh: w.sh,
      legs: [...w.legs],
      blows: keep(w.blows, now),
      n: w.n,
      lv: w.lv,
      op: w.op,
      fell: w.fell,
      gone: w.gone,
      heardAt: now,
    };
  }
  if (s.w === null || w.w !== s.w) return s;
  switch (w.k) {
    case 'mv':
      return { ...s, legs: [...w.legs], heardAt: now };
    case 'atk':
      return s.blows.some((q) => q.i === w.i)
        ? s
        : {
            ...s,
            blows: keep(
              [...s.blows, { i: w.i, a: w.a, at: w.at, wu: w.wu, s: w.s, ...(w.sp ? { sp: w.sp } : {}) }],
              now,
            ),
            heardAt: now,
          };
    case 'hp':
      return { ...s, hp: w.h, max: w.m, ...(w.n !== undefined ? { n: w.n } : {}), heardAt: now };
    case 'ph':
      return { ...s, ph: w.n, sh: w.until, heardAt: now };
    case 'md':
      return { ...s, md: w.m, ma: w.at, mu: w.until, heardAt: now };
    case 'fell':
      return s.fell
        ? w.dm && !s.fell.dm
          ? { ...s, fell: { ...s.fell, dm: w.dm } }
          : s
        : {
            ...s,
            fell: { at: w.at, top: w.top, n: w.n, ...(w.dm ? { dm: w.dm } : {}) },
            hp: 0,
            blows: [],
            heardAt: now,
          };
    case 'gone':
      return { ...s, gone: w.at, blows: [], heardAt: now };
    default:
      return s;
  }
}

/**
 * The link: the state of this machine's own site's fight, the receipts by watch and place, a refusal said once until the fight is
 * left. `site()` this machine's site for the dragon the clock is about (`{w, sx, sz}`, null unknown); `onReceipt` hears each
 * new receipt once.
 * @param {{now: () => number, say?: (code: string) => void, onReceipt?: (r: string) => void, site?: () => ({w: number, sx: number, sz: number}|null)}} deps
 */
export function createDragonLink({ now, say = () => {}, onReceipt = () => {}, site = () => null }) {
  /** @type {Readonly<DragonState>} */
  let state = DRAGON_STATE_EMPTY;
  const receipts = new Map();
  const refused = new Set();
  return {
    /** A word from the cell or the hub. */
    word(w) {
      if (!w) return;
      if (w.k === 'no') {
        if (!refused.has(w.m)) {
          refused.add(w.m);
          say(w.m);
        }
        return;
      }
      if (w.k === 'rcpt') {
        const c = readDragonReceipt(w.r),
          k = c ? `${c.q}|${c.p ?? -1}` : null;
        if (k && !receipts.has(k)) {
          receipts.set(k, w.r);
          onReceipt(w.r);
        }
        return;
      } // DRAGON-EACH: one a dragon
      const mine = site();
      if (!mine || w.w !== mine.w || !sameDragonSite(mine, w)) return;
      state = foldDragon(state, w, now());
    },
    state: () => state,
    receipt: (w, p = -1) => receipts.get(`${w}|${p}`) ?? null,
    /** Out of its fight: the state forgotten, a refusal said again next time. */
    leave() {
      state = DRAGON_STATE_EMPTY;
      refused.clear();
    },
  };
}
