// @ts-check
// ARENA5 (2026-10-03): YOUR LADDER REPLAY - bible/11-Multiplayer/Arena.md "2. The fights", the table's Spectate row:
// offline, "exhibitions, your ladder replay". The last REPLAY_KEEP ladder bouts this save fought, recorded small into the
// save's arena record (systems/save.js `arena.replays`), and one of them played back on the floor's instance as a watched
// bout. Pure: a recording grown by the bout driver (scenes/arenaBouts.js, beside its own law), a record out, a record in,
// and the words that play it back.
//
// WHAT IS KEPT, AND HOW SMALL. At REPLAY_HZ (ten a second): each fighter's feet on the sand (from the floor's centre, a
// tenth of a metre a step) and its facing (a 256th of a turn), each as the change since the last tick - one signed byte
// apiece, the quantizer closed on its own output so it never drifts - one fighter's ticks after another's, so a fighter
// standing still is two bytes a run (a zero marker and its length, to 127 ticks); then base64. Beside it, sparse: each
// fighter's health share (a 255th)
// when it moves, each strike's moment and striker, and THE BOUT LAW'S OWN EVENTS (systems/arenaBout.js - the call, the
// criers, the count, every blow, the end, the verdict, the healers) with their times to a hundredth of a second. Bounded:
// at most REPLAY_MAX_TICKS (four minutes - the law's three of fighting and its ceremony), four fighters, so a Grand
// Melee's worst is under REPLAY_BYTES_MAX; measured in test/arena5_replay.test.js. Versioned inside its own shape (`v`);
// a save from before ARENA5 - or a record of any other shape - reads back with none.
//
// HOW IT PLAYS. Not a second driver: the relay's bout mirror (scenes/arenaBouts.js startRelay / relayWord over
// net/arenaLink.js) already stands puppets, the HUD, the crowd, the Herald and the music from a stream of words. A replay
// IS such a stream (`replayFeed`): every fighter a puppet of the relay's own kind (`ai` 1 - the player too, as the class
// enemy of their own career), its walk the `mv` words between two ticks, its blows `atk`, the health bars `hp`, the law's
// events `ev`, all on this screen's clock from the moment it starts. Watched from the stands (`me` '' - nothing of it
// pays, counts, or holds a gate), and left at any time by the floor's gates.
//
// Not a DFU member (Daggerfall has no arena). Ledger A (ARENA).

import { MOBILE_TYPES } from '../characters/mobileTypes.js';

/** The replay record's version. */
export const REPLAY_VERSION = 1;
/** How many ladder bouts are kept (the newest first). */
export const REPLAY_KEEP = 3;
/** Ticks a second, and a tick's length, ms. */
export const REPLAY_HZ = 10;
export const REPLAY_TICK_MS = 1000 / REPLAY_HZ;
/** The longest a recording runs, ticks: four minutes (the law's three of fight, its call and walk before, its verdict
 *  and healers after) - past it the bout is kept to there. */
export const REPLAY_MAX_TICKS = 4 * 60 * REPLAY_HZ;
/** The most fighters a record holds (a Grand Melee's player and three). */
export const REPLAY_FIGHTERS_MAX = 4;
/** A step of the feet, metres; a step of the facing, of a whole turn (1/256). */
export const REPLAY_POS_Q = 0.1;
export const REPLAY_YAW_STEPS = 256;
/** A whole record serialized is never longer than this (its worst: four fighters moving every tick for four minutes). */
export const REPLAY_BYTES_MAX = 64 * 1024;
/** The law's events a record keeps, by index (systems/arenaBout.js's own names). */
export const REPLAY_EVENTS = Object.freeze(['call', 'crier', 'walk', 'count', 'fight', 'hit', 'crit', 'miss', 'knockdown', 'comeback', 'stall', 'flee', 'yield', 'fall', 'ringout', 'timeout', 'end', 'verdict', 'heal', 'done']);
/** The RLE marker in the delta stream (no delta is ever -128: they are clamped to -127..127). */
const RUN = -128;

const clampI = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));
const qPos = (m) => clampI(m / REPLAY_POS_Q, -32000, 32000);
const qYaw = (rad) => ((Math.round(((Number(rad) || 0) / (Math.PI * 2)) * REPLAY_YAW_STEPS) % REPLAY_YAW_STEPS) + REPLAY_YAW_STEPS) % REPLAY_YAW_STEPS;
const share255 = (hp, max) => clampI((Math.max(0, Number(hp) || 0) / Math.max(1, Number(max) || 1)) * 255, 0, 255);

/** The class enemy a player is stood as in their own replay (MOBILE_TYPES' careers, 128..145, by the career's name), the
 *  Warrior for a career of their own making. Pure. */
export function playerMobileOf(entity) {
  const m = MOBILE_TYPES[entity?.career?.name ?? ''];
  return Number.isInteger(m) && m >= 128 && m <= 145 ? m : MOBILE_TYPES.Warrior;
}

/**
 * A RECORDING BEGUN at the bout's first bell (`t0` this screen's clock): its fighters in the law's order (`[{ id, name,
 * side, mobile, gender, home, epithet, health, maxHealth }]`, at most REPLAY_FIGHTERS_MAX), the ladder bout it is (`next`
 * - nextLadderBout's tier, bout, label, champion, grand, free, beasts, tierName), the banners its two halves wore
 * (`sides` `[west, east]`), and the game minute (`at`) - the Records page's row it belongs to. Pure.
 */
export function newRecording({ t0 = 0, fighters = [], next = null, sides = [null, null], at = 0 } = {}) {
  const f = fighters.slice(0, REPLAY_FIGHTERS_MAX);
  return {
    t0, at: Math.floor(Number(at) || 0), ids: f.map((x) => x.id),
    f: f.map((x) => ({ n: String(x.name ?? '').slice(0, 40), s: clampI(x.side, 0, 3), m: clampI(x.mobile, -1, 999), g: x.gender === 'female' ? 'female' : 'male', h: String(x.home ?? '').slice(0, 40), e: String(x.epithet ?? '').slice(0, 40) })),
    next: next ? { tier: clampI(next.tier, 0, 9), bout: clampI(next.bout, 0, 3), label: String(next.label ?? ''), tierName: String(next.tierName ?? ''), champion: !!next.champion, grand: !!next.grand, free: !!next.free, beasts: !!next.beasts } : null,
    sides: [0, 1].map((i) => (sides?.[i] === 'red' || sides?.[i] === 'blue' ? sides[i] : null)),
    ticks: 0, start: null, last: null, deltas: f.map(() => []), zeros: f.map(() => 0), ev: [], hp0: f.map((x) => share255(x.health ?? x.maxHealth, x.maxHealth)), hp: [], hpLog: [], k: [], lastStrike: f.map(() => -Infinity), full: false,
  };
}

/** Flush fighter `i`'s run of standing ticks into its stream. */
function flushRun(R, i) {
  while (R.zeros[i] > 0) { const n = Math.min(127, R.zeros[i]); R.deltas[i].push(RUN, n); R.zeros[i] -= n; }
}

/**
 * THE TICKS DUE at `t`: each fighter's pose (`poses[i]` `[x, z, yaw]` - feet from the floor's centre, metres, and facing,
 * radians; null keeps its last) and health (`health[i]` `[hp, max]`, or null) - one sample a tick passed since the last
 * call (a long frame's missed ticks carry the same pose). Stops at REPLAY_MAX_TICKS (`full`). Pure but for `R`.
 */
export function recordTick(R, t, poses, health = []) {
  if (!R || R.full) return R;
  const due = Math.floor((t - R.t0) / REPLAY_TICK_MS);
  if (!R.hp.length) R.hp = [...R.hp0];
  while (R.ticks <= due) {
    if (R.ticks >= REPLAY_MAX_TICKS) { R.full = true; break; }
    const q = R.f.map((_, i) => {
      const p = poses[i] ?? null;
      return p ? [qPos(p[0]), qPos(p[1]), qYaw(p[2])] : R.last ? [...R.last[i]] : [0, 0, 0];
    });
    if (!R.start) { R.start = q.map((x) => [...x]); R.last = q.map((x) => [...x]); }
    else {
      for (let i = 0; i < q.length; i++) {
        const L = R.last[i];
        const dx = clampI(q[i][0] - L[0], -127, 127), dz = clampI(q[i][1] - L[1], -127, 127);
        let dy = ((q[i][2] - L[2] + 128) & 255) - 128;
        if (dy < -127) dy = -127;
        L[0] += dx; L[1] += dz; L[2] = (L[2] + dy + 256) & 255;   // closed on its own output: never a drift
        if (dx === 0 && dz === 0 && dy === 0) { R.zeros[i]++; continue; }
        flushRun(R, i);
        R.deltas[i].push(dx, dz, dy);
      }
    }
    for (let i = 0; i < R.f.length; i++) {
      const h = health[i];
      if (!h) continue;
      const s = share255(h[0], h[1]);
      if (s !== R.hp[i]) { R.hp[i] = s; R.hpLog.push(R.ticks, i, s); }
    }
    R.ticks++;
  }
  return R;
}

/** A STRIKE begun by fighter `id` at `t` (the player's swing, a fighter's blow resolved) - one a fighter in 300 ms. */
export function recordStrike(R, t, id) {
  if (!R || R.full) return R;
  const i = R.ids.indexOf(id);
  if (i < 0 || t - R.lastStrike[i] < 300) return R;
  R.lastStrike[i] = t;
  R.k.push(Math.max(0, Math.round((t - R.t0) / 10)), i);
  return R;
}

/** One of THE LAW'S EVENTS (systems/arenaBout.js takeBoutEvents) at its time: kept as `[t/10ms, kind, a, b, dmg, n,
 *  side, how]`, its fighters by their place in the record, the trailing fields it does not carry left off. */
export function recordEvent(R, e) {
  if (!R || !e || R.full) return R;
  const k = REPLAY_EVENTS.indexOf(e.k);
  if (k < 0) return R;
  const fi = (id) => (id == null ? -1 : R.ids.indexOf(id));
  const row = [Math.max(0, Math.round(((e.at ?? R.t0) - R.t0) / 10)), k, fi(e.a), fi(e.b), clampI(e.dmg ?? 0, 0, 99999), e.n == null ? -9 : clampI(e.n, -1, 3), e.side === undefined ? -9 : e.side === null ? -1 : clampI(e.side, 0, 3), typeof e.how === 'string' ? e.how.slice(0, 12) : ''];
  while (row.length > 2) { const v = row[row.length - 1], j = row.length - 1; if ((j <= 3 && v === -1) || (j === 4 && v === 0) || ((j === 5 || j === 6) && v === -9) || (j === 7 && v === '')) row.pop(); else break; }
  R.ev.push(row);
  return R;
}

// ── THE RECORD ───────────────────────────────────────────────────────────────────────────────────────────────
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/** Bytes to base64 (no padding needed back: the length is the record's own). Pure. */
export function toBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1] ?? 0, c = bytes[i + 2] ?? 0, n = (a << 16) | (b << 8) | c;
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? B64[n & 63] : '=');
  }
  return s;
}
/** Base64 to bytes, or null for a string that is not. Pure. */
export function fromBase64(s) {
  if (typeof s !== 'string' || s.length % 4) return null;
  const out = [];
  for (let i = 0; i < s.length; i += 4) {
    const v = [0, 1, 2, 3].map((k) => (s[i + k] === '=' ? -2 : B64.indexOf(s[i + k])));
    if (v.some((x) => x === -1) || v[0] < 0 || v[1] < 0 || (v[2] === -2 && v[3] !== -2)) return null;
    const n = (v[0] << 18) | (v[1] << 12) | (Math.max(0, v[2]) << 6) | Math.max(0, v[3]);
    out.push((n >> 16) & 255);
    if (v[2] >= 0) out.push((n >> 8) & 255);
    if (v[3] >= 0) out.push(n & 255);
  }
  return Uint8Array.from(out);
}

/** THE RECORD a finished recording keeps (`result` the law's `{ side, how }`): small, plain, versioned. Pure. */
export function finishRecording(R, result = null) {
  if (!R?.start) return null;
  R.f.forEach((_, i) => flushRun(R, i));
  // one fighter's ticks after another's (a fighter standing still is one run however long), each its own stream
  return {
    v: REPLAY_VERSION, at: R.at, next: R.next, f: R.f.map((x) => ({ ...x })), sides: [...R.sides], n: R.ticks,
    s: R.start.flat(), d: toBase64(Uint8Array.from(R.deltas.flat(), (x) => x & 255)), hp0: [...R.hp0], hp: [...R.hpLog], k: [...R.k], ev: R.ev.map((r) => [...r]),
    r: result ? { side: result.side ?? null, how: String(result.how ?? '').slice(0, 12) } : null,
  };
}

/** Every fighter's pose at every tick, decoded: `[tick][fighter] = [qx, qz, qyaw]`, or null for a stream that does not
 *  hold exactly `n` ticks of `f` fighters. Pure. */
export function decodePoses(rec) {
  const nf = rec?.f?.length ?? 0, n = rec?.n ?? 0;
  const bytes = fromBase64(rec?.d);
  if (!bytes || !Array.isArray(rec.s) || rec.s.length !== nf * 3) return null;
  const out = Array.from({ length: Math.max(1, n) }, () => []);
  const sb = (b) => (b > 127 ? b - 256 : b);
  let p = 0;
  // fighter-major: each fighter's n - 1 ticks of deltas (or runs) after the one before's
  for (let i = 0; i < nf; i++) {
    let L = [rec.s[i * 3], rec.s[i * 3 + 1], rec.s[i * 3 + 2]], run = 0;
    out[0].push([...L]);
    for (let t = 1; t < n; t++) {
      if (run === 0 && p < bytes.length && sb(bytes[p]) === RUN) { run = bytes[p + 1] ?? 0; p += 2; if (run < 1) return null; }
      if (run > 0) { run--; out[t].push([...L]); continue; }
      if (p + 3 > bytes.length) return null;
      L = [L[0] + sb(bytes[p]), L[1] + sb(bytes[p + 1]), (L[2] + sb(bytes[p + 2]) + 256) & 255];
      p += 3;
      out[t].push([...L]);
    }
    if (run !== 0) return null;
  }
  return p === bytes.length ? out : null;
}

const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const isStr = (v, max) => typeof v === 'string' && v.length <= max;
/** A replay record read back as it was written, or null for any other shape. Pure. */
export function replayOk(r) {
  if (!r || typeof r !== 'object' || r.v !== REPLAY_VERSION) return null;
  if (!Array.isArray(r.f) || r.f.length < 1 || r.f.length > REPLAY_FIGHTERS_MAX) return null;
  for (const f of r.f) if (!f || !isStr(f.n, 40) || !isInt(f.s, 0, 3) || !isInt(f.m, -1, 999) || (f.g !== 'male' && f.g !== 'female') || !isStr(f.h, 40) || !isStr(f.e, 40)) return null;
  if (!isInt(r.n, 1, REPLAY_MAX_TICKS) || !isInt(r.at, 0, 2 ** 40) || !Array.isArray(r.sides) || r.sides.length !== 2 || !r.sides.every((b) => b === null || b === 'red' || b === 'blue')) return null;
  if (!Array.isArray(r.hp0) || r.hp0.length !== r.f.length || !r.hp0.every((v) => isInt(v, 0, 255))) return null;
  if (!Array.isArray(r.hp) || r.hp.length % 3 || !r.hp.every((v, i) => isInt(v, 0, i % 3 === 1 ? r.f.length - 1 : i % 3 === 0 ? r.n : 255))) return null;
  if (!Array.isArray(r.k) || r.k.length % 2 || !r.k.every((v, i) => isInt(v, 0, i % 2 ? r.f.length - 1 : 1e6))) return null;
  if (!Array.isArray(r.ev) || !r.ev.every((e) => Array.isArray(e) && e.length >= 2 && e.length <= 8 && isInt(e[0], 0, 1e6) && isInt(e[1], 0, REPLAY_EVENTS.length - 1) && e.slice(2, 4).every((v) => isInt(v, -1, r.f.length - 1)) && (e.length < 5 || isInt(e[4], 0, 99999)) && e.slice(5, 7).every((v) => isInt(v, -9, 3)) && (e.length < 8 || isStr(e[7], 12)))) return null;
  if (r.next !== null && (!r.next || !isInt(r.next.tier, 0, 9) || !isInt(r.next.bout, 0, 3) || !isStr(r.next.label, 60) || !isStr(r.next.tierName, 40))) return null;
  if (!isStr(r.d, REPLAY_BYTES_MAX) || !decodePoses(r)) return null;
  return r;
}
/** THE SAVE'S REPLAYS read back: every record of the right shape, the newest first, REPLAY_KEEP at most; anything else
 *  (a save from before ARENA5, a broken one) none. Pure. */
export function arenaReplaysRestore(raw) {
  return (Array.isArray(raw) ? raw : []).map(replayOk).filter(Boolean).slice(0, REPLAY_KEEP);
}
/** The replays as the save writes them (copies). Pure. */
export const arenaReplaysSnapshot = (list) => arenaReplaysRestore(list).map((r) => JSON.parse(JSON.stringify(r)));
/** A new replay kept: first, the oldest past REPLAY_KEEP let go. Pure. */
export const keepReplay = (list, rec) => (replayOk(rec) ? [rec, ...arenaReplaysRestore(list)].slice(0, REPLAY_KEEP) : arenaReplaysRestore(list));
/** A record's size as the save holds it, bytes. Pure. */
export const replayBytes = (rec) => JSON.stringify(rec ?? null).length;

// ── PLAYING IT BACK ──────────────────────────────────────────────────────────────────────────────────────────
/** The fighter id a record's fighter `i` wears on the mirror: the relay's own AI ids (net/arenaLaw.js `a0`..`a3`), so each
 *  stands as a puppet of its walk. */
export const replayId = (i) => `a${i}`;
/** A 16-hex bout id for a record - the mirror's `o`, the seed its seats are picked by. Pure. */
export function replayBoutId(rec) {
  let h = 0x811c9dc5;
  const s = `${rec?.at ?? 0}:${rec?.next?.tier ?? 0}:${rec?.next?.bout ?? 0}:${rec?.n ?? 0}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return (h.toString(16).padStart(8, '0') + (h ^ 0x5a5a5a5a).toString(16).padStart(8, '0')).slice(0, 16);
}

/**
 * THE WORDS THAT PLAY A RECORD (scenes/arenaBouts.js relayWord's own), on this screen's clock from `t0`, about the floor
 * centre `centre` (`[x, y, z]` - the instance's): `{ first, st, due(t), yawAt(i, t), end }` - `first` the fighters' places
 * before the state (each puppet stood where the bout began), `st` the bout's state at its first bell, `due(t)` every word
 * whose moment has come since the last call (in order: the walks, the blows, the health, the law's events - the call
 * handed back as `{ k: 'call' }`, the host's to say), `yawAt` a fighter's recorded facing then, `end` the record's last
 * moment, ms. Null for a record that does not decode. Pure but for its cursor.
 * @param {any} rec @param {{ t0: number, centre: number[], o?: string, limitMs?: number }} o
 */
export function replayFeed(rec, { t0, centre, o = replayBoutId(rec), limitMs = 180_000 }) {
  const poses = replayOk(rec) ? decodePoses(rec) : null;
  if (!poses) return null;
  const c = centre ?? [0, 0, 0];
  const X = (q) => c[0] + q * REPLAY_POS_Q, Z = (q) => c[2] + q * REPLAY_POS_Q;
  const nf = rec.f.length;
  /** @type {{ t: number, w: any }[]} */
  const words = [];
  for (let k = 1; k < poses.length; k++) {
    for (let i = 0; i < nf; i++) {
      const a = poses[k - 1][i], b = poses[k][i];
      if (a[0] === b[0] && a[1] === b[1]) continue;
      const tm = (k - 1) * REPLAY_TICK_MS;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) * REPLAY_POS_Q;
      words.push({ t: tm, w: { k: 'mv', i: replayId(i), x: X(a[0]), z: Z(a[1]), tx: X(b[0]), tz: Z(b[1]), v: len / (REPLAY_TICK_MS / 1000), at: t0 + tm } });
    }
  }
  const hp = [...rec.hp0];
  for (let j = 0; j < rec.hp.length; j += 3) {
    hp[rec.hp[j + 1]] = rec.hp[j + 2];
    words.push({ t: rec.hp[j] * REPLAY_TICK_MS, w: { k: 'hp', h: hp.map((s, i) => [replayId(i), s, 255]) } });
  }
  for (let j = 0; j < rec.k.length; j += 2) {
    const tm = rec.k[j] * 10, i = rec.k[j + 1];
    const tick = Math.min(poses.length - 1, Math.floor(tm / REPLAY_TICK_MS));
    const me = poses[tick][i];
    let tg = -1, best = Infinity;
    for (let q = 0; q < nf; q++) {
      if (q === i || rec.f[q].s === rec.f[i].s) continue;
      const p = poses[tick][q], d = Math.hypot(p[0] - me[0], p[1] - me[1]);
      if (d < best) { best = d; tg = q; }
    }
    const at = tg >= 0 ? poses[tick][tg] : me;
    words.push({ t: tm, w: { k: 'atk', i: replayId(i), at: t0 + tm, x: X(at[0]), z: Z(at[1]), tg: replayId(Math.max(0, tg)) } });
  }
  for (const e of rec.ev) {
    const tm = e[0] * 10, kind = REPLAY_EVENTS[e[1]];
    if (kind === 'call') { words.push({ t: tm, w: { k: 'call' } }); continue; }
    const ev = { k: kind, at: t0 + tm };
    if ((e[2] ?? -1) >= 0) ev.a = replayId(e[2]);
    if ((e[3] ?? -1) >= 0) ev.b = replayId(e[3]);
    if ((e[4] ?? 0) > 0) ev.dmg = e[4];
    if ((e[5] ?? -9) !== -9) ev.n = e[5];
    if ((e[6] ?? -9) !== -9) ev.side = e[6] === -1 ? null : e[6];
    if (e[7]) ev.how = e[7];
    words.push({ t: tm, w: { k: 'ev', e: [ev] } });
  }
  words.sort((a, b) => a.t - b.t);   // stable: a tick's walks, then its blows, its health and its events, as pushed
  const first = poses[0].map((p, i) => ({ k: 'mv', i: replayId(i), x: X(p[0]), z: Z(p[1]), tx: X(p[0]), tz: Z(p[1]), v: 0, at: t0 }));
  const st = {
    k: 'st', o, kind: 'pve', ph: 'call', pa: t0, fa: null, lim: limitMs, me: '', sp: 0,
    f: rec.f.map((f, i) => [replayId(i), f.n || '?', f.s, rec.hp0[i], 255, '', 1, f.m, 0, f.h, f.e]),
    ...(rec.next ? { tier: rec.next.tier, bout: rec.next.bout } : {}),
  };
  let at = 0;
  const end = words.length ? words[words.length - 1].t : 0;
  return {
    first, st, end,
    due(t) {
      const out = [];
      while (at < words.length && words[at].t <= t - t0) out.push(words[at++].w);
      return out;
    },
    yawAt(i, t) {
      const k = Math.max(0, Math.min(poses.length - 1, Math.floor((t - t0) / REPLAY_TICK_MS)));
      return ((poses[k][i]?.[2] ?? 0) / REPLAY_YAW_STEPS) * Math.PI * 2;
    },
  };
}
