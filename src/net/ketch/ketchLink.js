// @ts-check
// KETCH (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 10): WHAT THE PAGE HOLDS OF ITS CREW'S SHIP - the room's words
// (net/wire.js validKetchOut) folded into one state, as net/superDungeon/sdFightLink.js folds the Hour's fight: the voyage's
// stage and crew, the constructs where they stand and walk and what they strike, the cells, the bridge, and the Tonal
// Warden's fight whole (its body, its blows, its ward and resonators, its forks, its sections, its fall). The deck's set
// draws from it (scenes/ketch/ketchDeckHost.js), the fight's set and the HUD read it (scenes/ketch/ketchFight.js,
// ui/ketch/ketchHud.js).
//
// PURE in its fold (`foldKetch`): a state and a word in, the next state out. The link around it keeps the state, says the
// voyage's turns in words once each, keeps MY PLACE IN THE BRIDGE'S FIGHT (the room counts me in only when it answers my
// `in` with the fight whole and `me` - net/ketch/ketchBrain.js voyageWord), and keeps THE WHOLE BRIDGE'S BLOWS OWED (the
// Discord, the Keel-Song, the Ketch turning west: no place to misjudge, so a hidden tab across one still pays it - the
// Hour's AUDIT SD IV (5) law).
//
// Not a DFU member. Ledger A (KETCH).
import { KT_STAGE } from './ketchLaw.js';
import { KW_ID, KW_FORK_ID0, KW_BLOWS } from './ketchWarden.js';
import { KT_KIND_BY_K } from './ketchConstructs.js';
import { STATE_SEND_MS } from '../gate/gateBrain.js';
import { t } from '../../systems/textManager.js';
import { KT_WORDS, ketchPhaseName } from '../../systems/ketch/ketchWords.js';

/**
 * @typedef {{ id: number, k: number, x: number, y: number, z: number, yw: number, h: number, m: number, wake: number, up: number, mv: any, down: number, hurtAt: number, sw?: number }} KtBody
 * @typedef {{ n: number, sg: number, sga: number, crew: Array<[string, string]>, bodies: KtBody[], blows: any[], wv: number,
 *   cl: any, br: {at: number, by: string}|null, ws: any, fell: {at: number, top: string[], n: number}|null, heardAt: number }} KtState
 */
/** The empty state: no ship heard. @type {Readonly<KtState>} */
export const KT_EMPTY = Object.freeze({ n: -1, sg: KT_STAGE.watch, sga: 0, crew: [], bodies: [], blows: [], wv: 0, cl: null, br: null, ws: null, fell: null, heardAt: 0 });
/** How long the page waits for the room's answer to its `in` before it says it again. */
export const KT_IN_RETRY_MS = 2000;
/** A ship that has said nothing this long has left me behind - three of its beats' whole states. */
export const KT_HEARD_MS = 3 * STATE_SEND_MS;
/** The whole bridge's blows a link keeps owed at most. */
export const KT_OWED_MAX = 32;
/** A blow over the whole bridge (its stamp `a` - net/eliteGates/egShape.js shAll): the Discord, the Keel-Song, the turn west. */
export const ktWholeBridge = (b) => !!b && Array.isArray(b.s) && b.s.some((s) => s?.[0] === 'a');

/** THE WORDS the voyage says as it goes (each once, as it happens) - each read through the text core when it is said
 *  (L10N4), so the language a player chose is the one they hear. */
const someone = (who) => who || t('ketch.link.someone', 'A crew member');
export const KT_LINK_TEXT = Object.freeze({
  get no() {
    return [
      t('ketch.link.no.gone', 'The Ketch is gone.'),
      t('ketch.link.no.over', 'The fight on the bridge is over.'),
      t('ketch.link.no.older', 'Your game is out of date. Leave the Ketch and reload or update to fight.'),
    ];
  },
  get wave() {
    return [
      '',
      t('ketch.link.wave.1', 'The Watch sounds! Dwarven Spheres drop from the rigging.'),
      t('ketch.link.wave.2', 'Sentries march up from below with the second wave!'),
      // KETCH-LONGER (2026-10-25): five waves - the third and fourth more brass, the Watch-Captain with the fifth
      t('ketch.link.wave.more', 'Wave {w} of the Watch climbs aboard!', { w: 3 }),
      t('ketch.link.wave.more', 'Wave {w} of the Watch climbs aboard!', { w: 4 }),
      t('ketch.link.wave.3', 'The Watch-Captain climbs onto the deck!'),
    ];
  },
  get wardens() { return t('ketch.link.wardens', 'Two Hammer Wardens guard the landing. They wake when you pass the last hammers.'); },
  get woke() { return t('ketch.link.woke', 'The Hammer Wardens wake!'); },
  engine: (n) => t('ketch.link.engine', 'The engine needs {n} aether cells. Bring them from the cradles to its sockets.', { n }),
  banked: (who, k, n) => t('ketch.link.banked', '{who} sets a cell in the engine ({k} of {n}).', { who: someone(who), k, n }),
  dropped: (who, why) => (why === 'struck' ? t('ketch.link.dropped.struck', '{who} is struck and drops their aether cell.', { who: someone(who) })
    : why === 'fell' ? t('ketch.link.dropped.fell', '{who} falls and drops their aether cell.', { who: someone(who) })
      : why === 'left' ? t('ketch.link.dropped.left', '{who} leaves the deck with their aether cell. It is lost.', { who: someone(who) })   // AUDIT KETCH L3-14: never "lets go"
        : t('ketch.link.dropped.let', '{who} lets go of their aether cell.', { who: someone(who) })),
  bridge: (by) => t('ketch.link.bridge', '{who} reaches the bridge. {open}', { who: someone(by), open: KT_WORDS.bridgeOpen }),
  phase: (n) => t('ketch.link.phase', '{phase}!', { phase: ketchPhaseName(n) }),
  get discord() { return t('ketch.link.discord', 'The Warden throws the ship out of tune! Carry cells to the four resonators.'); },
  retuned: (left) => (left > 0 ? t('ketch.link.retuned', 'A resonator rings true. {left, plural, one {# is} other {# are}} still false.', { left })
    : t('ketch.link.retunedAll', 'The last resonator rings true! The Warden\'s ward breaks!')),
  get lastNote() { return t('ketch.link.lastNote', 'The Last Note! Break the tuning-forks before the song ends.'); },
  get song() { return t('ketch.link.song', 'The Warden sings the Keel-Song! Break the tuning-forks!'); },
  forkBroken: (who, left) => (left > 0 ? t('ketch.link.forkBroken', '{who} breaks a fork. {left, plural, one {# stands} other {# stand}}.', { who: someone(who), left })
    : t('ketch.link.forkBrokenAll', '{who} breaks the last fork!', { who: someone(who) })),
  get stunned() { return t('ketch.link.stunned', 'The song breaks! The Warden reels!'); },
  get sections() { return t('ketch.link.sections', 'The bridge\'s outer ring shudders - get onto the core!'); },
  get west() { return t('ketch.link.west', 'The Ketch turns west!'); },
  get lost() { return t('ketch.link.lost', 'The bridge is empty. The Warden returns to the helm.'); },
  fell: (top) => (top?.length ? t('ketch.link.fell', 'The Tonal Warden falls - {top} struck the hardest. {open}', { top: top.join(', '), open: KT_WORDS.cabinOpen })
    : t('ketch.link.fellNone', 'The Tonal Warden falls. {open}', { open: KT_WORDS.cabinOpen })),
});

const bodyOf = (b) => ({ id: b[0], k: b[1], x: b[2], y: b[3], z: b[4], yw: b[5], h: b[6], m: b[7], wake: b[8] ?? 1, up: b[9] ?? 0, mv: null, down: b[6] > 0 ? 0 : 1, hurtAt: -Infinity });
const walkOf = (w) => (w.v > 0 ? { x: w.x, z: w.z, tx: w.tx, tz: w.tz, v: w.v, at: w.at } : null);
/** Where a body (a construct, or the Warden's `wd`) stands at `now` on its said walk. Pure. */
export function ktBodyAt(B, now, out = [0, 0]) {
  const m = B?.mv;
  if (!m || !(m.v > 0)) { out[0] = B?.x ?? 0; out[1] = B?.z ?? 0; return out; }
  const lx = m.tx - m.x, lz = m.tz - m.z, len = Math.sqrt(lx * lx + lz * lz);
  if (len < 1e-6) { out[0] = m.tx; out[1] = m.tz; return out; }
  const along = Math.min(len, (Math.max(0, now - m.at) / 1000) * m.v);
  out[0] = m.x + (lx / len) * along; out[1] = m.z + (lz / len) * along;
  return out;
}
/** Whether a blow is done by `now` (landed, its span spent). */
export const ktBlowDone = (b, now) => now >= b.at + Math.max(1, b.sp ?? 0) + 1500;

/**
 * One word folded into the ship's state. `st` replaces the voyage (`ws` the fight inside it); the rest move their own
 * fields; a word before any whole state changes nothing.
 * @param {Readonly<KtState>} s @param {any} w a validKetchOut projection @param {number} now
 * @returns {Readonly<KtState>}
 */
export function foldKetch(s, w, now) {
  if (!w) return s;
  if (w.k === 'st') {
    return {
      n: w.n, sg: w.sg, sga: w.sga, crew: w.cr.map((c) => [c[0], c[1]]),
      bodies: w.bd.map(bodyOf).map((B) => { const mv = w.mv.find((m) => m.o === B.id); return mv ? { ...B, mv: walkOf(mv) } : B; }),
      blows: w.bl.filter((b) => !ktBlowDone(b, now)), wv: w.wv, cl: w.cl, br: w.br, ws: w.ws ? { ...w.ws } : s.ws && w.ws === null ? null : s.ws, fell: w.fell, heardAt: now,
    };
  }
  if (s.n < 0) return s;   // nothing but a whole state starts a voyage
  const live = (list) => list.filter((b) => !ktBlowDone(b, now));
  switch (w.k) {
    case 'nb': { const B = bodyOf(w.b); B.up = w.up; B.wake = w.wk; return { ...s, bodies: [...s.bodies.filter((q) => q.id !== B.id), B], heardAt: now }; }
    case 'mv':
      if (w.o === KW_ID) return s.ws ? { ...s, ws: { ...s.ws, wd: { ...s.ws.wd, x: w.x, z: w.z, mv: walkOf(w), yw: w.v > 0 && Math.hypot(w.tx - w.x, w.tz - w.z) > 1e-6 ? Math.atan2(w.tx - w.x, w.tz - w.z) : s.ws.wd.yw } }, heardAt: now } : s;
      return { ...s, bodies: s.bodies.map((B) => (B.id === w.o ? { ...B, x: w.x, z: w.z, mv: walkOf(w), yw: w.v > 0 && Math.hypot(w.tx - w.x, w.tz - w.z) > 1e-6 ? Math.atan2(w.tx - w.x, w.tz - w.z) : B.yw } : B)), heardAt: now };
    case 'bl': {
      const b = w.b;
      if (b.o === KW_ID || b.o === 0) return s.ws ? { ...s, ws: { ...s.ws, bl: [...live(s.ws.bl ?? []), b] }, heardAt: now } : s;
      return { ...s, blows: [...live(s.blows), b], bodies: s.bodies.map((B) => (B.id === b.o ? { ...B, mv: null, atkAt: b.at, atkWu: b.wu } : B)), heardAt: now };
    }
    case 'hp': { const H = new Map(w.h); return { ...s, bodies: s.bodies.map((B) => (H.has(B.id) ? { ...B, h: H.get(B.id) } : B)), heardAt: now }; }
    // AUDIT KETCH II L3-5: its walk stepped to the fall's moment (its start was where it lay - up to 23 m back); L3-3: one the
    // ship took off (`sw`) kept so
    case 'dn': return { ...s, bodies: s.bodies.map((B) => { if (B.id !== w.o) return B; const p = ktBodyAt(B, w.at); return { ...B, x: p[0], z: p[1], h: 0, down: w.at, mv: null, sw: w.sw === 1 ? 1 : 0 }; }), heardAt: now };
    case 'wk': return { ...s, bodies: s.bodies.map((B) => (B.id === w.o ? { ...B, wake: 1 } : B)), heardAt: now };
    case 'sg': return { ...s, sg: w.sg, sga: w.at, br: w.sg === KT_STAGE.bridge ? { at: w.at, by: w.by ?? '' } : s.br, heardAt: now };
    case 'wave': return { ...s, wv: w.w, heardAt: now };
    case 'cl': return { ...s, cl: { cr: w.cr, br: w.br, lo: w.lo, ca: w.ca, bk: w.bk, nd: w.nd, sk: w.sk }, heardAt: now };
    case 'wf': return { ...s, ws: null, heardAt: now };
    case 'ws': { const { me, ...ws } = w; void me; return { ...s, ws, heardAt: now }; }
    case 'whp': return s.ws ? { ...s, ws: { ...s.ws, h: w.h, m: w.m }, heardAt: now } : s;
    case 'ph': return s.ws ? { ...s, ws: { ...s.ws, ph: w.n, ou: w.up, wd: { ...s.ws.wd, mv: null } }, heardAt: now } : s;
    case 'ward': return s.ws ? { ...s, ws: { ...s.ws, ward: w.on, ...(w.stun ? { su: w.stun } : {}), ...(w.on === 1 ? {} : { bl: (s.ws.bl ?? []).filter((b) => b.o !== KW_ID || b.at <= w.at) }) }, heardAt: now } : s;
    case 'rs': return s.ws ? { ...s, ws: { ...s.ws, rs: [...w.rs] }, heardAt: now } : s;
    case 'fk': return s.ws ? { ...s, ws: { ...s.ws, fk: { i: w.i, at: w.at, m: w.m, c: w.c.map((q) => [q[0], q[1], w.m]) } }, heardAt: now } : s;
    case 'fkh': return s.ws?.fk && s.ws.fk.i === w.i ? { ...s, ws: { ...s.ws, fk: { ...s.ws.fk, c: s.ws.fk.c.map((q, j) => [q[0], q[1], Number.isFinite(w.h[j]) ? w.h[j] : q[2]]) } }, heardAt: now } : s;
    case 'fkb': return s.ws?.fk && s.ws.fk.i === w.i && s.ws.fk.c[w.c] ? { ...s, ws: { ...s.ws, fk: { ...s.ws.fk, c: s.ws.fk.c.map((q, j) => (j === w.c ? [q[0], q[1], 0] : q)) } }, heardAt: now } : s;
    case 'stun': return s.ws ? { ...s, ws: { ...s.ws, su: w.until, fk: null, bl: (s.ws.bl ?? []).filter((b) => b.a !== KW_BLOWS.song.a), wd: { ...s.ws.wd, mv: null } }, heardAt: now } : s;
    case 'sec': return s.ws ? { ...s, ws: { ...s.ws, sec: w.s.map((e) => [e[0], e[1], e[2]]) }, heardAt: now } : s;
    case 'lost': return s.ws ? { ...s, ws: { ...s.ws, lost: w.at }, heardAt: now } : s;
    case 'wl': return { ...s, ws: null, bodies: s.bodies.filter((B) => !(B.h > 0) || ![KT_KIND_BY_K.findIndex((K) => K.key === 'sentry')].includes(B.k) || B.z < 170), heardAt: now };
    case 'fell': return { ...s, fell: { at: w.at, top: w.top, n: w.n }, ws: s.ws ? { ...s.ws, fell: { at: w.at, top: w.top, n: w.n }, bl: [], fk: null, sec: [], h: 0 } : s.ws, heardAt: now };
    default: return s;
  }
}

/**
 * THE LINK: the ship's state, its turns said, my place in the bridge's fight, and the whole bridge's blows owed.
 * @param {{ now: () => number, say?: (text: string, key?: string) => void, me?: () => string|null }} deps
 *   `now` the relay's clock; `say` a line over the screen; `me` my account (whose word is whose).
 */
export function createKetchLink({ now, say = () => {}, me = () => null }) {
  /** @type {Readonly<KtState>} */
  let state = KT_EMPTY;
  let inAt = -Infinity, mine = 0, refused = null;
  /** @type {any[]} */
  let owed = [];
  const said = new Set();
  /** the songs whose forks were all broken before they landed (by their number in their fight) - never owed */
  const broken = new Set();
  const once = (key, text) => { if (said.has(key)) return; said.add(key); if (text) say(text); };
  function owe(was) {
    const ws = state.ws;
    if (!ws || (was.ws && ws.fi !== was.ws.fi)) owed = owed.filter((b) => ws && b.fi === ws.fi);
    if (ws && mine === ws.fi) for (const b of ws.bl ?? []) if (ktWholeBridge(b) && !owed.some((o) => o.i === b.i && o.fi === ws.fi)) owed.push({ ...b, fi: ws.fi });
    if (owed.length > KT_OWED_MAX) owed.splice(0, owed.length - KT_OWED_MAX);
    if (ws?.fell || ws?.lost) owed = owed.filter((b) => b.at <= (ws.fell?.at ?? ws.lost ?? Infinity));
  }
  return {
    /** A word from the ship I stand on: folded, its turns said once each. */
    word(w) {
      if (!w) return;
      if (w.k === 'no') { refused = { fi: state.ws?.fi ?? 0, m: w.m }; say(KT_LINK_TEXT.no[w.m] ?? ''); return; }
      const was = state, t = now();
      state = foldKetch(state, w, t);
      if (w.k === 'ws' && w.me === 1) { mine = w.fi; refused = null; }
      owe(was);
      const fresh = (at) => !Number.isFinite(at) || t - at < 5000;
      if (w.k === 'wave' && fresh(w.at)) once(`wave${state.n}.${w.w}`, KT_LINK_TEXT.wave[w.w]);
      else if (w.k === 'sg' && fresh(w.at)) {
        if (w.sg === KT_STAGE.gallery) { once(`sg${state.n}.1`, KT_WORDS.hatchOpen); once(`sg${state.n}.1b`, KT_LINK_TEXT.wardens); }
        else if (w.sg === KT_STAGE.engine) { once(`sg${state.n}.2`, KT_WORDS.holdOpen); }
        else if (w.sg === KT_STAGE.sailwalk) once(`sg${state.n}.3`, KT_WORDS.engineFed);
        else if (w.sg === KT_STAGE.bridge) once(`sg${state.n}.4`, KT_LINK_TEXT.bridge(w.by));
      } else if (w.k === 'cl' && state.sg === KT_STAGE.engine && !was.cl?.nd && w.nd) once(`eng${state.n}`, KT_LINK_TEXT.engine(w.nd));
      else if (w.k === 'wk' && fresh(w.at)) once(`wk${state.n}`, KT_LINK_TEXT.woke);
      else if (w.k === 'bank' && fresh(w.at)) { if (state.sg === KT_STAGE.engine) say(KT_LINK_TEXT.banked(w.n, Math.min(state.cl?.nd ?? 0, (state.cl?.bk ?? 0) + 1), state.cl?.nd ?? 0)); }   // the room says the cell before the cells (ketchBrain.js voyageWord): this one counted (AUDIT KETCH L3-3)
      else if (w.k === 'drop' && fresh(w.at) && w.why !== 'lost') say(KT_LINK_TEXT.dropped(w.n, w.why));
      else if (w.k === 'ph' && fresh(w.at)) { say(KT_LINK_TEXT.phase(w.n)); if (w.n === 2) say(KT_LINK_TEXT.discord); if (w.n === 3) say(KT_LINK_TEXT.lastNote); }
      else if (w.k === 'rs' && was.ws?.rs && fresh(w.at)) { const up = w.rs.filter((v, k) => v === 1 && was.ws.rs[k] === 0).length; if (up > 0) say(KT_LINK_TEXT.retuned(w.rs.filter((v) => v === 0).length)); }
      else if (w.k === 'fk' && fresh(w.at - KW_BLOWS.song.wu)) say(KT_LINK_TEXT.song);
      else if (w.k === 'fkb' && fresh(w.at)) say(KT_LINK_TEXT.forkBroken(w.n, state.ws?.fk ? state.ws.fk.c.filter((q) => q[2] > 0).length : 0));
      else if (w.k === 'stun' && was.ws?.fk) { broken.add(`${was.ws.fi}:${was.ws.fk.i}`); if (fresh(w.at)) say(KT_LINK_TEXT.stunned); }
      else if (w.k === 'sec' && w.s.length > (was.ws?.sec?.length ?? 0)) say(KT_LINK_TEXT.sections);
      else if (w.k === 'bl' && w.b.a === KW_BLOWS.west.a && !was.ws?.ended && fresh(w.b.at - 3000)) once(`west${state.ws?.fi}`, KT_LINK_TEXT.west);
      else if (w.k === 'lost' || w.k === 'wl') { if (fresh(w.at)) once(`lost${was.ws?.fi ?? 0}`, KT_LINK_TEXT.lost); mine = 0; }
      else if (w.k === 'fell' && fresh(w.at)) once(`fell${state.n}`, KT_LINK_TEXT.fell(w.top));
    },
    /** The ship's state now. */
    state: () => state,
    /** The relay's clock. */
    now: () => now(),
    /** Whether the room counts me in the bridge's fight it is fighting - a blow of mine on the Warden may go out. */
    joined: () => !!state.ws && state.ws.fi > 0 && mine === state.ws.fi && !state.ws.lost && !state.ws.fell,
    /** Whether my `in` is due at `t`: the bridge stage, the fight not mine (none, lost, or never answered me), no refusal
     *  standing (an older game's for good), its last saying KT_IN_RETRY_MS behind. */
    inDue(t) {
      if (state.sg !== KT_STAGE.bridge || state.fell) return false;
      if (refused && (refused.m === 2 || (refused.fi === (state.ws?.fi ?? 0) && t - state.heardAt < KT_HEARD_MS))) return false;
      if (state.ws && mine === state.ws.fi && !state.ws.lost && t - state.heardAt < KT_HEARD_MS) return false;
      return t - inAt >= KT_IN_RETRY_MS;
    },
    /** My `in` left the socket at `t`. */
    sentIn(t) { inAt = t; },
    /** The whole bridge's blows owed a verdict - the page judges them, then pays. */
    owed: () => owed,
    /** Whether song `i` of the fight in hand was broken before it landed (its forks all down - the room's `stun`). */
    songBroken: (i) => broken.has(`${state.ws?.fi ?? 0}:${i}`),
    /** Blow `i` judged - owed no more. */
    paid(i) { owed = owed.filter((o) => o.i !== i); },
    /** Who carries a cell (accounts). */
    carriers: () => (state.cl?.ca ?? []).map((c) => c[0]),
    /** Whether I carry a cell. */
    carrying: () => { const m = me(); return !!m && (state.cl?.ca ?? []).some((c) => c[0] === m); },
    /** Off the ship: its state forgotten, my place, the refusals and the words said with it. */
    leave() { state = KT_EMPTY; inAt = -Infinity; mine = 0; refused = null; owed = []; said.clear(); broken.clear(); },
  };
}
/** A body's kind's record by its wire number. */
export const ktKindOf = (k) => KT_KIND_BY_K[k] ?? null;
/** Is a body number the Warden's or a fork's (never a construct's). */
export const ktBossId = (o) => o === KW_ID || (o >= KW_FORK_ID0 && o < KW_FORK_ID0 + 16);
