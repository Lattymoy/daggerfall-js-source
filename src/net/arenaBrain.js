// @ts-check
// ARENA4 (2026-10-02, Mac: "Players can choose to watch AI fights, player fights, join a team (red and blue) and climb
// esclating tiers of opponents, or choose to matchmake for a real opponent to take on in real time"): ONE BOUT ON THE
// RELAY - the bout law (systems/arenaBout.js, the same law every screen runs) on the relay's clock, its referee (PVP-REF,
// Seats-Arc 6.1, built here: the relay holds every fighter's vitality and believes as much of a blow as its reach, its
// rate, its weapon and its bucket allow) and, on the ladder, its AI fighters - the gate's `gateBrain` pattern on the
// floor's flat ground, no pathing: each walks straight at its nearest foe, telegraphs its blow and lands it if the foe is
// still in reach. Design: bible/11-Multiplayer/Arena.md "7. Online". ARENA4b: and THE HOUR'S EXHIBITION (Arena.md 2 -
// "the relay runs it, every client sees one bout"): two of those fighters against each other, the hour's pair
// (net/arenaExhibition.js exhibitionFor), nobody on the sand but them and everybody in the stands.
//
// PURE. No clock, no dice and no socket of its own: `now` and `rng` are handed to every call, and every call answers
// the WORDS to fan (net/arenaLaw.js validArenaOut's shapes) - the room (server/src/index.js) sends them, keeps the state
// in storage and signs the receipts this says are owed (`owed`).
//
// THE STATE `{ o, kind, at, seed, phase: 'wait'|'law'|'void', f: [fighters], b: the law's bout | null, ai: [bodies],
// ref: {fid: meter}, last: {fid: [x, z, at]}, gone: {fid: at}, res, owed, said, spectators, cheer }` - plain data, so
// the room checkpoints it whole.
//
// Not a DFU member. Ledger A (ARENA).
import {
  newBout, boutTick, boutHit, boutMiss, boutFell, boutYield, boutPos, boutAtMarks, takeBoutEvents, boutLive, boutFighter, boutOver,
} from '../systems/arenaBout.js';
import {
  ARENA_FLOOR_CENTRE, ARENA_RING_R, ARENA_PVP_MARKS, ARENA_HIT, ARENA_HIT_HZ_MAX, ARENA_BUCKET_RATE, ARENA_BUCKET_DEPTH, ARENA_MELEE_REACH,
  ARENA_POSE_SLACK, ARENA_BOW_REACH, ARENA_SPELLS_IN, ARENA_SPELL_WINDOW_MS, ARENA_SPEED_MAX, ARENA_SPEED_SLACK, ARENA_JOIN_WAIT_MS,
  ARENA_GONE_MS, arenaBlowCap, pvpVitality, ladderVitality, arenaLadderBout, ARENA_SPECTATORS_MAX, ARENA_CHEER_MS, arenaFoeStats, bannerClaim, ARENA_EX_BANNERS,
} from './arenaLaw.js';

/** A fighter of a bout between players stands on its mark once it says `in`; an AI fighter stands on its own. */
const C = ARENA_FLOOR_CENTRE;
/** A point of the floor's frame (`[x, z]` from the centre) in the made level's, and back. */
const toLevel = (xz) => [C[0] + xz[0], C[2] + xz[1]];
/** THE MARKS: `n` per side on the floor's long axis (x) for two sides, round the ring for more - systems/arenaFighters.js
 *  boutMarks' law, pinned equal. */
export const MARK_APART = 6;
export function arenaMarks(sides, perSide) {
  const out = [];
  for (let s = 0; s < sides; s++) {
    const marks = [];
    for (let k = 0; k < perSide[s]; k++) {
      if (sides === 2) marks.push([(s === 0 ? -1 : 1) * MARK_APART, (k - (perSide[s] - 1) / 2) * 2.5]);
      else { const a = (s / sides) * Math.PI * 2 + Math.PI; marks.push([Math.cos(a) * MARK_APART + k * 1.5, Math.sin(a) * MARK_APART]); }
    }
    out.push(marks);
  }
  return out;
}
/** A bout's seed - the client names the relay's fighters by it (systems/arenaFighters.js fighterIdentity), so every
 *  screen bills them alike. */
export const arenaBoutSeed = (o) => parseInt(String(o).slice(0, 8), 16) >>> 0;
/** An AI fighter's temper at the yield line - a class fighter's from the seed, a monster's none (it fights to the floor). */
export const arenaAiTemper = (seed, i, mobile) => (mobile < 128 ? 0 : 0.2 + (((Math.imul((seed ^ (0x9e3779b1 * (i + 1))) >>> 0, 0x85ebca6b) >>> 8) % 1000) / 1000) * 0.7);

/** An AI fighter's attack: it begins a blow this near its foe (a share of its reach), and its walk is said again when its
 *  target has moved this far from the last word, or this long has passed. */
export const AI_ENGAGE = 0.85;
export const AI_RESAY_M = 1.2;
export const AI_RESAY_MS = 900;

/**
 * A BOUT OPENED. A bout between players: `f` its two fighters `[{ sub, name, lv, rating }]`, side 0 first. A ladder bout:
 * `f` its one fighter (`lv` their claimed level, ARENA4b: `cl` the level their token signed - the vitality's, see
 * net/arenaLaw.js ladderVitality) and `tier`, `bout`. Nobody is on the sand until each says `in` (`joinBout`). ARENA4b:
 * the hour's exhibition (`kind` 'ex', `ex` net/arenaExhibition.js exhibitionFor's - its hour, its tier, its pair): no
 * fighter of a socket, its two fighters the relay's own on sides 0 and 1, the law begun at once.
 * ARENA4b: `casual` a bout between players the two asked for unrated - refereed all the same, no receipt owed.
 * @param {{ o: string, kind: 'pvp'|'pve'|'ex', f: any[], tier?: number, bout?: number, ex?: any, casual?: boolean, now: number }} p
 */
export function openBout({ o, kind, f, tier = 0, bout = 0, ex = null, casual = false, now }) {
  const seed = arenaBoutSeed(o);
  const st = {
    o, kind, at: now, seed, phase: 'wait', tier: kind === 'ex' ? ex.tier : tier, bout, b: null, res: null, owed: [], said: false, endAt: NaN, spectators: 0, cheer: {},
    // ARENA4b: `banner` the fighter's word's claim (bannerClaim - billed on the list to watch, cosmetic, never counted)
    f: f.map((x, i) => ({ id: `p${i}`, sub: x.sub, name: x.name, side: i, lv: x.lv ?? 1, cl: x.cl ?? null, rating: x.rating ?? null, title: x.title ?? null, banner: bannerClaim(x.banner), in: false })),
    ai: [], ref: {}, last: {}, gone: {},
    casual: kind === 'pvp' && casual === true,
  };
  if (kind === 'ex') {
    // ARENA4b: THE EXHIBITION - the hour's two on their marks, side 0 (the Red's) west and side 1 (the Blue's) east, the
    // law at its call now: no socket is waited for (the stands may be empty; the bout is the hour's all the same)
    st.hour = ex.hour;
    const marks = arenaMarks(2, [1, 1]);
    st.ai = ex.opponents.map((x, i) => {
      const body = arenaFoeStats(x.mobile, x.level);
      return { id: `a${i}`, i, mobile: body.mobile, level: body.level, hp: body.hp, dmg: body.dmg, speed: body.speed, every: body.every, windup: body.windup, reach: body.reach, side: i,
        temper: arenaAiTemper(seed, i, body.mobile), pos: toLevel(marks[i][0]), mv: null, atk: null, nextAt: 0, said: null };
    });
    startLaw(st, now);
    return st;
  }
  if (kind === 'pve') {
    const L = arenaLadderBout(tier, bout);
    if (!L) throw new Error('arenaBrain: no such ladder bout');
    st.free = L.free;
    const sides = L.free ? L.foes.length + 1 : 2;
    const per = Array(sides).fill(0); per[0] = 1;
    L.foes.forEach((x, i) => { per[L.free ? i + 1 : 1]++; });
    const marks = arenaMarks(sides, per);
    const used = Array(sides).fill(0); used[0] = 1;
    st.ai = L.foes.map((x, i) => {
      const side = L.free ? i + 1 : 1;
      const mark = marks[side][used[side]++];
      return { id: `a${i}`, i, mobile: x.mobile, level: x.level, hp: x.hp, dmg: x.dmg, speed: x.speed, every: x.every, windup: x.windup, reach: x.reach, side,
        temper: arenaAiTemper(seed, i, x.mobile), pos: toLevel(mark), mv: null, atk: null, nextAt: 0, said: null };
    });
    st.mark0 = marks[0][0];
  }
  return st;
}

/** The fighter of `sub`, or null. */
export const fighterOfSub = (st, sub) => st.f.find((x) => x.sub === sub) ?? null;

/**
 * A SOCKET'S `in`: a fighter of this bout comes to the sand (`r` 'f'), or anyone takes a seat (`r` 's', ARENA_SPECTATORS_MAX
 * at most). Answers `{ role: 'f'|'s', id? }` or `{ no }` (the refusal's word, net/arenaLaw.js ARENA_NO_TEXT). The last
 * fighter in starts the law.
 */
export function joinBout(st, sub, r, now) {
  if (st.phase === 'void' || (st.b && boutOver(st.b) && st.b.phase === 'done')) return { no: 'no bout' };
  const me = fighterOfSub(st, sub);
  if (r === 'f') {
    if (!me) return { no: 'not yours' };
    me.in = true;
    delete st.gone[me.id];
    if (st.phase === 'wait' && st.f.every((x) => x.in)) startLaw(st, now);
    return { role: 'f', id: me.id };
  }
  if (me) return { role: 'f', id: me.id };   // a fighter who asks to watch their own bout fights it
  if (st.spectators >= ARENA_SPECTATORS_MAX) return { no: 'seats full' };
  st.spectators++;
  return { role: 's' };
}
/** A spectator left their seat. */
export function leaveSeat(st) { st.spectators = Math.max(0, st.spectators - 1); }

/** Every fighter is on the sand: the law's bout, every fighter on its mark. */
function startLaw(st, now) {
  st.phase = 'law';
  const fighters = st.f.map((x) => ({
    id: x.id, name: x.name, side: x.side, ai: false, temper: 0,
    // ARENA4b: a ladder fighter's vitality is the relay's from the signed level alone - never the health the word claimed
    maxHealth: st.kind === 'pvp' ? pvpVitality(x.lv) : ladderVitality(x.cl, x.lv, st.tier),
  }));
  for (const a of st.ai) fighters.push({ id: a.id, name: '-', side: a.side, ai: true, temper: a.temper, maxHealth: a.hp });
  st.b = newBout({ id: st.o, kind: st.kind === 'pvp' ? 'pvp' : st.kind === 'ex' ? 'exhibition' : 'ladder', fighters, ring: { centre: [C[0], C[2]], radius: ARENA_RING_R }, now, tier: st.tier });
  for (const x of fighters) st.ref[x.id] = { bucket: ARENA_BUCKET_DEPTH, bucketAt: now, hits: [], spells: [], q: -1, qAt: -Infinity };
}

/** A fighter's pose from its socket - kept as the last good one unless it moved faster than any fighter can (the
 *  referee's speed check: a pose past it is not believed, and the last good pose stands). Answers whether it was kept. */
export function poseOf(st, id, x, z, now) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  const was = st.last[id];
  if (was) {
    const dt = Math.max(0, now - was[2]) / 1000;
    if (Math.hypot(x - was[0], z - was[1]) > ARENA_SPEED_MAX * dt + ARENA_SPEED_SLACK + (dt > 2 ? ARENA_SPEED_MAX : 0)) return false;
  }
  st.last[id] = [x, z, now];
  if (st.b) boutPos(st.b, id, [x, z]);
  return true;
}

/** Where a fighter stands now: an AI's body, a player's last good pose - however old: a player standing still sends a
 *  pose only on the heartbeat, and where they last stood is where they stand. */
function whereIs(st, id, now) {
  const a = st.ai.find((q) => q.id === id);
  if (a) return aiAt(a, now);
  const p = st.last[id];
  return p ? [p[0], p[1]] : null;
}
/** An AI body's place now - its walk carried on from its last word (the gate's bossAt law). */
export function aiAt(a, now) {
  const m = a.mv;
  if (!m || !(m.v > 0)) return a.pos;
  const len = Math.hypot(m.tx - m.x, m.tz - m.z);
  if (len < 1e-6) return [m.tx, m.tz];
  const along = Math.min(len, (Math.max(0, now - m.at) / 1000) * m.v);
  return [m.x + ((m.tx - m.x) / len) * along, m.z + ((m.tz - m.z) / len) * along];
}

/** The fighter's health as the law holds it. */
const hpOf = (st, id) => boutFighter(st.b, id);
/** The `hp` word: every fighter's health. */
export function hpWord(st) {
  return { k: 'hp', h: st.b ? st.b.fighters.map((x) => [x.id, Math.max(0, Math.round(x.health)), Math.max(1, Math.round(x.maxHealth))]) : [] };
}

/**
 * THE REFEREE: a blow claim of fighter `id` on fighter `to` (`d` the damage its game rolled, `r` the kind, `w` the
 * weapon's template, `m` its material, `q` the blow's sequence). Believed only while the fight is live, both standing,
 * the striker under ARENA_HIT_HZ_MAX a second (a swing through two bodies is ONE blow by its `q`), a melee blow within
 * reach of the striker's own last good pose and a shaft within a bow's, a spell under its count; the damage capped by the
 * weapon's DFU maximum (doubled for a critical) and the striker's bucket. Answers the words to fan (none for a blow not
 * believed) and what landed (`got`).
 */
export function refBlow(st, id, { i: to, d, r, w = -1, m = 0, q = null }, now) {
  const out = { words: [], got: 0 };
  if (!st.b || !boutLive(st.b) || id === to) return out;
  const a = hpOf(st, id), t = hpOf(st, to);
  if (!a || !t || a.out || t.out || a.side === t.side) return out;
  const M = st.ref[id];
  // THE RATE: the blows of the last second, one blow by its sequence however many bodies it met
  M.hits = M.hits.filter((x) => now - x < 1000);
  const same = q != null && q === M.q && now - M.qAt < 250;
  if (!same) {
    if (M.hits.length >= ARENA_HIT_HZ_MAX) return out;
    // THE SPELL'S COUNT - ARENA4b: a cast once, by its sequence, however many bodies its blast met
    if (r === ARENA_HIT.Spell) {
      M.spells = M.spells.filter((x) => now - x < ARENA_SPELL_WINDOW_MS);
      if (M.spells.length >= ARENA_SPELLS_IN) return out;
      M.spells.push(now);
    }
    M.hits.push(now); M.q = q ?? -1; M.qAt = now;
  }
  // THE REACH, from the striker's own last good pose to where the struck stands
  const from = whereIs(st, id, now), at = whereIs(st, to, now);
  if (!from || !at) return out;
  const gap = Math.hypot(from[0] - at[0], from[1] - at[1]);
  if (r === ARENA_HIT.Melee && gap > ARENA_MELEE_REACH + ARENA_POSE_SLACK) { boutMiss(st.b, { from: id, now }); return { words: takeWords(st), got: 0 }; }
  if (r === ARENA_HIT.Shaft && gap > ARENA_BOW_REACH) return out;
  // THE CAP AND THE BUCKET
  M.bucket = Math.min(ARENA_BUCKET_DEPTH, M.bucket + (Math.max(0, now - M.bucketAt) / 1000) * ARENA_BUCKET_RATE);
  M.bucketAt = now;
  const want = Math.max(0, Number(d) || 0);
  const got = Math.max(0, Math.floor(Math.min(want, arenaBlowCap({ r, w, m }), M.bucket)));
  M.bucket -= got;
  if (!(got > 0)) { boutMiss(st.b, { from: id, now }); return { words: takeWords(st), got: 0 }; }
  land(st, id, to, got, now, got >= t.maxHealth * 0.15);
  return { words: takeWords(st), got };
}

/** A blow lands: the struck's health down by it, the law told; a blow that would take them under 1 holds them at it, and
 *  they are down (nobody dies on the arena's sand). */
function land(st, from, to, dmg, now, crit = false) {
  const t = hpOf(st, to);
  const health = t.health - dmg;
  boutHit(st.b, { from, to, dmg, health: Math.max(1, health), crit, now });
  if (health <= 1) boutFell(st.b, to, now);
}

/** A fighter's yield (sheathing the blade at the line): the law's, refused above it. Answers the words and the refusal. */
export function yieldOf(st, id, now) {
  if (!st.b) return { words: [], no: 'not-live' };
  const no = boutYield(st.b, id, now);
  return { words: takeWords(st), no };
}

/** A spectator's cheer or boo: one each ARENA_CHEER_MS a spectator, fanned with how many have shouted together. */
export function cheerOf(st, key, c, now) {
  if (now - (st.cheer[key] ?? -Infinity) < ARENA_CHEER_MS) return null;
  st.cheer[key] = now;
  st.crowd = (st.crowd && now - st.crowd.at < 1500 && st.crowd.c === c) ? { c, n: Math.min(ARENA_SPECTATORS_MAX, st.crowd.n + 1), at: now } : { c, n: 1, at: now };
  return { k: 'cr', c, n: st.crowd.n };
}

/** The events the law raised since the last take, as the `ev` word, and the `hp` word with them when a blow moved health. */
function takeWords(st) {
  const e = st.b ? takeBoutEvents(st.b) : [];
  if (!e.length) return [];
  // AUDIT PRE-MERGE 1003 O1: THE HEALERS ON THE RELAY'S SAND - the law's 'heal' heals nobody (systems/arenaBout.js: on a
  // screen's own bout the host's door does), and here the relay is the host: every fighter whole at the word, so the
  // `hp` that rides with it says so (it said the bout's end health, and every fighter's screen struck its own healed
  // player back down to it), and so does every `st` after
  if (e.some((x) => x.k === 'heal')) for (const f of st.b.fighters) f.health = f.maxHealth;
  /** @type {any[]} */
  const words = [{ k: 'ev', e: e.map(evWire) }];
  if (e.some((x) => x.k === 'hit' || x.k === 'heal' || x.k === 'fall')) words.push(hpWord(st));
  return words;
}
const evWire = (x) => {
  const o = { k: x.k, at: x.at };
  for (const f of ['a', 'b', 'dmg', 'n', 'side', 'how']) if (x[f] !== undefined) o[f] = x[f];
  return o;
};

/** An AI fighter's nearest foe still standing with a place - another side's fighter. */
function foeOf(st, a, now) {
  const me = aiAt(a, now);
  let best = null, bd = Infinity;
  for (const x of st.b.fighters) {
    if (x.out || x.side === a.side || x.id === a.id) continue;
    const p = whereIs(st, x.id, now);
    if (!p) continue;
    const d = Math.hypot(p[0] - me[0], p[1] - me[1]);
    if (d < bd) { bd = d; best = { id: x.id, p, d }; }
  }
  return best;
}

/**
 * ONE BEAT: the law's clock (the call, the count, the fight, the tempers at the line, the ring, the time), every fighter
 * on its mark at the walk, the AI fighters' walks and blows, a player gone too long out of a live fight (a forfeit), a
 * matched bout nobody came to (void). Answers the words to fan; `st.owed` the receipts to mint once the fight ends.
 */
export function stepBout(st, now, rng = Math.random) {
  const words = [];
  if (st.phase === 'void') return words;
  if (st.phase === 'wait') {
    if (now - st.at >= ARENA_JOIN_WAIT_MS) { st.phase = 'void'; words.push({ k: 'no', m: 'void' }); }
    return words;
  }
  const b = st.b;
  if (b.phase === 'walk') for (const x of b.fighters) if (!x.atMark) boutAtMarks(b, x.id, now);
  // A FORFEIT: a player gone (no socket) ARENA_GONE_MS into a live fight is out, and the bout goes on without them
  if (boutLive(b)) for (const x of st.f) {
    const g = st.gone[x.id];
    const lf = boutFighter(b, x.id);
    if (g != null && now - g >= ARENA_GONE_MS && lf && !lf.out) {
      boutFell(b, x.id, now);
      // the law calls it a fall; the result and its end say the forfeit (the verdict's own word)
      if (b.result) b.result.how = 'forfeit';
      for (const e of b.events) if (e.k === 'end' && e.how === 'fall') e.how = 'forfeit';
    }
  }
  // THE AI FIGHTERS
  if (boutLive(b)) for (const a of st.ai) words.push(...aiStep(st, a, now, rng));
  boutTick(b, now, rng);
  words.push(...takeWords(st));
  if (b.result && !st.said) {
    st.said = true;
    st.endAt = now;
    st.res = { side: b.result.side, how: b.result.how };
    st.owed = receiptsOwed(st);
  }
  return words;
}

/** One AI fighter's beat: a blow landing; else a blow begun when its foe is near; else a walk at its foe. */
function aiStep(st, a, now, rng) {
  const out = [];
  const me = boutFighter(st.b, a.id);
  if (!me || me.out) { if (a.mv) { a.pos = aiAt(a, now); a.mv = null; } a.atk = null; return out; }
  // a blow in flight lands at its moment, on its foe if still in reach
  if (a.atk && now >= a.atk.at) {
    const tg = a.atk.tg;
    a.atk = null;
    const t = boutFighter(st.b, tg), p = whereIs(st, tg, now), here = aiAt(a, now);
    if (t && !t.out && p && Math.hypot(p[0] - here[0], p[1] - here[1]) <= a.reach + ARENA_POSE_SLACK * 0.5) {
      const dmg = a.dmg[0] + Math.floor(rng() * (a.dmg[1] - a.dmg[0] + 1));
      if (tg.startsWith('p')) out.push({ k: 'blow', i: a.id, d: dmg, to: tg });
      land(st, a.id, tg, dmg, now, dmg >= t.maxHealth * 0.15);
    } else boutMiss(st.b, { from: a.id, now });
    return out;
  }
  if (a.atk) return out;
  const foe = foeOf(st, a, now);
  if (!foe) { if (a.mv) { a.pos = aiAt(a, now); a.mv = null; out.push(mvWord(a, now)); } return out; }
  if (foe.d <= a.reach * AI_ENGAGE) {
    if (a.mv) { a.pos = aiAt(a, now); a.mv = null; out.push(mvWord(a, now)); }
    if (now >= a.nextAt) {
      a.atk = { at: now + a.windup, tg: foe.id };
      a.nextAt = now + a.every;
      out.push({ k: 'atk', i: a.id, at: a.atk.at, x: foe.p[0], z: foe.p[1], tg: foe.id });
    }
    return out;
  }
  // the walk: straight at the foe, stopping short of it - said again when the foe has moved, or after a while
  const here = aiAt(a, now);
  const dx = foe.p[0] - here[0], dz = foe.p[1] - here[1], d = Math.hypot(dx, dz);
  const stop = Math.max(0, d - a.reach * 0.7);
  const tx = here[0] + (dx / d) * stop, tz = here[1] + (dz / d) * stop;
  const said = a.said;
  if (!a.mv || !said || Math.hypot(said[0] - tx, said[1] - tz) > AI_RESAY_M || now - a.mv.at > AI_RESAY_MS) {
    a.pos = here;
    a.mv = { x: here[0], z: here[1], tx, tz, v: a.speed, at: now };
    a.said = [tx, tz];
    out.push(mvWord(a, now));
  }
  return out;
}
const r2 = (v) => Math.round(v * 100) / 100;
const mvWord = (a, now) => (a.mv ? { k: 'mv', i: a.id, x: r2(a.mv.x), z: r2(a.mv.z), tx: r2(a.mv.tx), tz: r2(a.mv.tz), v: a.mv.v, at: a.mv.at } : { k: 'mv', i: a.id, x: r2(a.pos[0]), z: r2(a.pos[1]), tx: r2(a.pos[0]), tz: r2(a.pos[1]), v: 0, at: now });

/** What the end owes in receipts: a bout between players one, naming both; a ladder bout its fighter's, won or lost;
 *  ARENA4b: an exhibition none (nobody of the realm fought it - its verdict is the `st`'s, the bookmakers' to read). */
function receiptsOwed(st) {
  const r = st.res;
  if (st.kind === 'ex' || st.casual) return [];   // ARENA4b: nor a casual bout - nothing of it is the realm's to keep
  if (st.kind === 'pvp') return [{ a: 'p', j: st.o, f: [st.f[0].sub, st.f[1].sub], r: r.side === 0 ? 0 : r.side === 1 ? 1 : 2, h: r.how === 'judges' && r.side === null ? 'judges' : r.how }];
  return [{ a: 'l', j: st.o, s: st.f[0].sub, q: st.tier, u: st.bout, r: r.side === 0 ? 1 : 0, h: r.how }];
}

/** A fighter's socket went (`gone`) or came back. */
export function fighterGone(st, sub, now, gone = true) {
  const me = fighterOfSub(st, sub);
  if (!me) return;
  if (gone) st.gone[me.id] = now; else delete st.gone[me.id];
}

/** THE `st` WORD for a socket (`me` its fighter id, '' a spectator): the bout's whole state. */
export function stateWord(st, me = '') {
  const b = st.b;
  const ph = st.phase === 'void' ? 'void' : st.phase === 'wait' ? 'wait' : b.phase;
  const fighters = b ? b.fighters : st.f.map((x) => ({ id: x.id, name: x.name, side: x.side, health: 1, maxHealth: 1, out: null, ai: false, temper: 0 }));
  const meta = (id) => { const a = st.ai.find((q) => q.id === id); return a ? { mob: a.mobile, ai: 1 } : { mob: -1, ai: 0 }; };
  return {
    k: 'st', o: st.o, kind: st.kind, ph, pa: b ? b.phaseAt : st.at, fa: b && Number.isFinite(b.fightAt) ? b.fightAt : null, lim: b ? b.limitMs : 0,
    f: fighters.map((x) => { const m = meta(x.id); return [x.id, x.name, x.side, Math.max(0, Math.round(x.health)), Math.max(1, Math.round(x.maxHealth)), x.out ?? '', m.ai, m.mob, Math.round((x.temper ?? 0) * 100), '', '']; }),
    me, sp: st.spectators, ...(st.kind === 'pve' ? { tier: st.tier, bout: st.bout } : {}), ...(st.kind === 'ex' ? { h: st.hour } : {}), ...(st.casual ? { u: 1 } : {}), ...(st.res ? { res: st.res } : {}),
  };
}
/** The AI fighters' places now, as `mv` words - a joiner's picture of where they stand. */
export const aiWords = (st, now) => st.ai.map((a) => mvWord(a, now));
/** The live list's entry for this bout (the hall's `live`) - ARENA4b: an exhibition's by its hour and tier, its two by
 *  their banners alone (the relay knows no fighter's name; every screen names them off the hour); every other fighter's
 *  bill with their banner, as their word claimed it. */
export function liveEntry(st) {
  if (st.kind === 'ex') return { o: st.o, kind: 'ex', h: st.hour, a: { b: ARENA_EX_BANNERS[0] }, b: { b: ARENA_EX_BANNERS[1] }, tier: st.tier, sp: st.spectators, at: st.at };
  const bill = (x) => ({ n: x.name, ...(x.rating != null ? { r: x.rating } : {}), ...(x.title ? { t: x.title } : {}), ...(x.banner ? { b: x.banner } : {}) });
  return { o: st.o, kind: st.kind, a: bill(st.f[0]), ...(st.f[1] ? { b: bill(st.f[1]) } : {}), ...(st.kind === 'pve' ? { tier: st.tier } : {}), ...(st.casual ? { u: 1 } : {}), sp: st.spectators, at: st.at };
}
/** Is the bout's room done with it (the healers past, or void) - its receipts said and the hall told. */
export const boutFinished = (st) => st.phase === 'void' || (!!st.b && st.b.phase === 'done');
