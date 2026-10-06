// @ts-check
// SERPENT1 (2026-10-04, Mac: "a large scale sea serpent in the ocean"): WHAT THE CLIENT HOLDS OF THE SERPENT'S FIGHT -
// the cell's words (net/wire.js validSerpentOut) folded into one state: its health, its swim (the legs its body lies
// along - net/serpentBody.js bodyAt draws it from this state as the relay does from its own), how it rides the sea, the
// attack in flight, its phase and ward, the coil and the maelstrom, the kill and the sounding, and this account's
// receipt. The gate's link's twin (net/gateLink.js). Design: bible/11-Multiplayer/Sea-Serpent.md section 6.
//
// PURE in its fold (`foldSerpent`): a state and a word in, the next state out. The link around it keeps the state, the
// falls by day and site (the hub says each site's kill to everyone online - AUDIT SERPENT S1: a forged site's is not
// this machine's serpent's) and the receipts by day, and says a refusal in words once. AUDIT SERPENT 2 F1: every word
// of a fight names its site (the relay stamps each - server/src/index.js _serpentFan) and only this machine's own
// site's is folded.
//
// Not a DFU member. Ledger A (SERPENT1).
import { readSerpentReceipt } from './serpentReceipt.js';
import { pruneLegs } from './serpentBrain.js';
import { MODES_KEPT, LEGS_KEPT, onTimeline, sameLeg, sameMode } from './serpentBody.js';
import { serpentSiteKey, sameSerpentSite } from './serpentLaw.js';

/**
 * @typedef {{day: number|null, boss: string|null, sx: number, sz: number, ph: number, hp: number, max: number,
 *   legs: any[], modes: {at: number, m: number}[], coil: any, mael: {at: number, x: number, z: number}|null, atk: any,
 *   sh: number, su: number, sa: number, n: number, op: number, fell: any, gone: number|null, heardAt: number,
 *   broke: {n: string, at: number}|null, crushed: number}} SerpentState
 */
/** The empty state: nothing heard yet. @type {Readonly<SerpentState>} */
export const SERPENT_STATE_EMPTY = Object.freeze({
  day: null, boss: null, sx: 0, sz: 0, ph: 1, hp: 0, max: 0, legs: [], modes: [], coil: null, mael: null, atk: null,
  sh: 0, su: 0, sa: 0, n: 0, op: 0, fell: null, gone: null, heardAt: 0, broke: null, crushed: 0,
});

/** AUDIT SERPENT S4/M1: a coil still holding let go at `at` - a dead or sounded serpent grips nothing. */
const letGo = (c, at) => (c && !(c.off > 0) ? { ...c, off: at } : c);

/**
 * One word folded into the state. `st` replaces everything it names (a coil already seen broken keeps who broke it);
 * the rest move their own fields; a word before any whole state is nothing; a kill of another day's serpent than the
 * state's changes nothing but a whole state.
 * @param {Readonly<SerpentState>} s @param {any} w a validSerpentOut projection @param {number} now
 * @returns {Readonly<SerpentState>}
 */
export function foldSerpent(s, w, now) {
  if (!w) return s;
  if (w.k === 'st') {
    const same = s.day === w.d;
    return {
      day: w.d, boss: w.b, sx: w.sx, sz: w.sz, ph: w.ph, hp: w.h, max: w.m, legs: [...w.legs], modes: [...w.modes],
      coil: w.coil ? { ...w.coil } : null, mael: w.mael, atk: w.atk, sh: w.sh, su: w.su, sa: w.sa, n: w.n, op: w.op,
      fell: w.fell, gone: w.gone, heardAt: now, broke: same ? s.broke : null, crushed: same ? s.crushed : 0,
    };
  }
  if (s.day === null) return s;
  switch (w.k) {
    // AUDIT SERPENT S2: THE TIMELINE'S ONE RULE, the relay's own (serpentBody.js onTimeline) - a word supersedes every leg or
    // mode still to come after it, so this track is the relay's, word for word, and the body drawn here is the one it judges
    case 'sw': {
      const f = { legs: [...s.legs] };
      if (!onTimeline(f.legs, w.l, sameLeg)) return s;
      pruneLegs(f, now);
      while (f.legs.length > LEGS_KEPT * 2) f.legs.shift();
      return { ...s, legs: f.legs, heardAt: now };
    }
    case 'dv': {
      const modes = [...s.modes];
      if (!onTimeline(modes, { at: w.at, m: w.m }, sameMode)) return s;
      return { ...s, modes: modes.slice(-MODES_KEPT), heardAt: now };
    }
    case 'atk': return { ...s, atk: { i: w.i, a: w.a, at: w.at, x: w.x, z: w.z, yw: w.yw, tg: w.tg, ...(w.s ? { s: w.s } : {}) }, heardAt: now };
    case 'hp': return { ...s, hp: w.h, max: w.m, heardAt: now };
    case 'ph': return { ...s, ph: w.n, sh: w.until, coil: s.coil && !(s.coil.off > 0) ? { ...s.coil, off: now } : s.coil, heardAt: now };
    case 'coil': return { ...s, coil: { i: w.i, s: w.s, x: w.x, z: w.z, th: w.th, at: w.at, ...(w.w !== undefined ? { w: w.w } : {}), until: w.until, off: s.coil?.i === w.i ? s.coil.off : w.off ?? 0, h: w.h, m: w.m }, heardAt: now };   // AUDIT SHIPS D2: `w`, its winding's drawn moment
    case 'ch': return s.coil?.i === w.i ? { ...s, coil: { ...s.coil, h: w.h }, heardAt: now } : s;
    case 'cb': return s.coil?.i === w.i ? { ...s, coil: { ...s.coil, h: 0, off: w.at }, su: w.su, broke: { n: w.n, at: w.at }, heardAt: now } : { ...s, su: w.su, heardAt: now };
    case 'cr': return s.coil?.i === w.i ? { ...s, coil: { ...s.coil, off: w.at }, crushed: w.at, heardAt: now } : s;
    case 'cx': return s.coil?.i === w.i ? { ...s, coil: { ...s.coil, off: w.at }, heardAt: now } : s;
    case 'mael': return { ...s, mael: { at: w.at, x: w.x, z: w.z }, heardAt: now };
    case 'fell': {
      if (w.d !== undefined && w.d !== s.day) return s;
      if (s.fell) return w.dm && !s.fell.dm ? { ...s, fell: { ...s.fell, dm: w.dm }, heardAt: now } : s;
      return { ...s, fell: { at: w.at, top: w.top, n: w.n, ...(w.dm ? { dm: w.dm } : {}) }, hp: 0, atk: null, coil: letGo(s.coil, w.at), heardAt: now };
    }
    case 'gone': return { ...s, gone: w.at, atk: null, coil: letGo(s.coil, w.at), heardAt: now };
    default: return s;
  }
}

/** The cell's refusals' words as the player reads them (net/wire.js SERPENT_NO_WORDS). */
export const SERPENT_NO_TEXT = Object.freeze({
  'the serpent is gone': 'The serpent is gone into the deep.',
  'the storm has closed its waters': 'A storm has closed over the serpent\'s waters - no ship can join the fight now.',
  'it is already slain': 'The serpent is already slain.',
  'too far from its waters': 'Sail closer to the serpent\'s waters.',
  'the waters are full': 'There are too many ships in the serpent\'s waters.',
  reload: 'Your game is older than this serpent - save, then reload (or update the app) to fight it.',
});
/** A kill's key: its day and its site's name. */
const fallKey = (day, site) => `${day}|${serpentSiteKey(site.sx, site.sz)}`;

/**
 * The link: the state, the falls by day and site and the receipts by day, and the words said. `site` this machine's
 * own site for the day (systems/serpentSite.js, null unknown). AUDIT SERPENT 2 F1: ONLY ITS OWN SITE'S WORDS ARE FOLDED -
 * every word of a fight names the site it is of (the relay stamps each, the hub's kill its own), and one naming no
 * site, another site or none this machine knows is not its serpent's: a socket of mine in a neighbouring cell heard a
 * forged site's fight by its pose there, and its kill (which named no site) was filed as mine - my serpent read as
 * slain, its blows struck at my ship in my site's frame. `onFell` hears each kill once, with the site it fell at.
 * @param {{now: () => number, say?: (text: string) => void, onFell?: (day: number, fell: any, site: {sx: number, sz: number}) => void,
 *   onReceipt?: (receipt: string) => void, site?: () => ({day: number, sx: number, sz: number}|null)}} deps
 */
export function createSerpentLink({ now, say = () => {}, onFell = () => {}, onReceipt = () => {}, site = () => null }) {
  /** @type {Readonly<SerpentState>} */
  let state = SERPENT_STATE_EMPTY;
  const falls = new Map();
  const receipts = new Map();
  const refused = new Set();
  return {
    /** A word from the cell or the hub. */
    word(w) {
      if (!w) return;
      if (w.k === 'no') { if (!refused.has(w.m)) { refused.add(w.m); say(SERPENT_NO_TEXT[w.m] ?? w.m); } return; }
      if (w.k === 'rcpt') { const c = readSerpentReceipt(w.r); if (c && !receipts.has(c.d)) { receipts.set(c.d, w.r); onReceipt(w.r); } return; }
      // a kill, any site's, kept by its day and site (the hub's names its day; the cell's is the day of the fight here)
      const mine = site();
      if (w.k === 'fell' && w.sx !== undefined) {
        const day = w.d ?? (mine && sameSerpentSite(mine, w) ? state.day ?? mine.day : null);
        if (Number.isSafeInteger(day) && !falls.has(fallKey(day, w))) { const f = { at: w.at, top: w.top, n: w.n }; falls.set(fallKey(day, w), f); onFell(day, f, { sx: w.sx, sz: w.sz }); }
      }
      // a whole state naming a kill this link never heard said (a ship sailing in on a serpent slain while it was away,
      // a hub that missed the word): kept for the omen, unsaid - the bar says it
      if (w.k === 'st' && w.fell && Number.isSafeInteger(w.d) && !falls.has(fallKey(w.d, w))) falls.set(fallKey(w.d, w), { at: w.fell.at, top: w.fell.top, n: w.fell.n });
      // a word of no site's fight, another site's, or one this machine knows no site for: not its serpent's
      if (!mine || !sameSerpentSite(mine, w)) return;
      state = foldSerpent(state, w, now());
    },
    state: () => state,
    /** The kill of the serpent at `at` on `day` (its relay time), or null. */
    fellAt: (day, at) => (at && Number.isFinite(at.sx) && Number.isFinite(at.sz) ? falls.get(fallKey(day, at))?.at ?? null : null),
    receipt: (day) => receipts.get(day) ?? null,
    /** A refusal said again only after the fight is left (a ship turned away from the storm's wall is told once). */
    leave() { state = SERPENT_STATE_EMPTY; refused.clear(); },
  };
}
