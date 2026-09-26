// @ts-check
// WB3 (2026-09-25, Mac: "an oversized enemy with telegraphed attacks (like wind ups, etc)", and Option B: the relay's
// Durable Object is the authority over the boss): THE BOSS'S BRAIN - the whole of what the relay runs for a gate's
// fight, as pure law. Design: bible/11-Multiplayer/World-Bosses.md sections 5-6.
//
// WHY THE RELAY CAN RUN THIS AND NOT A DUNGEON. Co-op's law is that the host's browser is the server, because a Durable
// Object running the simulation would be a second copy of the game (11-Multiplayer/Multiplayer.md). The arena is built
// so that a boss needs no game: it stands on a flat disc with nothing to path round, so its whole world is a point, a
// facing, a health bar, a clock and the players' feet - which the relay already holds (each socket's last pose rides
// its attachment). This file is that world: a state, and the functions that move it.
//
// PURE. No clock of its own (every function takes `now`, the relay's clock), no randomness of its own (an `rng` is
// handed in - a seeded one in the pins, the object's CSPRNG in the relay), no I/O: the relay's object
// (server/src/index.js) owns the sockets, the alarm that steps this, the storage that checkpoints it and the receipts,
// and turns what `stepBrain` answers into frames. The client reads the SAME tables (the attacks' shapes and timings) to
// draw the telegraphs and to resolve an attack against its own feet - one law, both ends. Everything here is a plain
// object of numbers and strings, so the checkpoint is the state itself.
//
// THE COURT'S FRAME. Metres, the court's centre at the origin, +z toward the south bridge the players arrive by
// (world/gateArena.js stands the court so; the relay subtracts its centre from a pose before a body reaches this
// file). A facing is `atan2(dx, dz)` - 0 looks south, at the door.
//
// THE FIGHT'S NUMBERS (bible section 5): each player's level CLAIM scales both what they bring (health) and what they
// may deal (a bucket), so no claim buys a faster kill - the fastest possible is BOSS_TTK_S / BUCKET_RATE_X of
// full-rate damage whatever anybody says.
//
// Not a DFU member. Ledger A (WB).

// ── the court and the body ─────────────────────────────────────────────
/** Where the court's centre stands in the arena's own dungeon frame, metres: its one made block's middle
 *  (world/gateArena.js lays the block at the grid's origin, RDB_SIDE 51.2 across, the floor's top at y 0 - pinned
 *  equal). The relay subtracts it from a pose, so the brain reads every body in the court's frame. */
export const COURT_CENTRE = Object.freeze([25.6, 0, 25.6]);
/** The court's floor, metres: the ring the motor keeps a player inside (motor.arena), and the relay's bound on where a
 *  blow can come from. */
export const COURT_R = 24;
/** The boss's body: its radius and height, metres (three times a Daedra Lord's - WB4 draws it at this size). */
export const BOSS_R = 1.8;
export const BOSS_H = 5.6;
/** The disc his centre keeps to - the rune ring he never crosses, so the floor past it is always a way out. */
export const BOSS_REACH_R = 16;
/** How fast he walks, metres a second (a player runs 7.6 - motor.js - so a runner can always get clear). */
export const BOSS_SPEED = 3.2;

// ── the clock of the fight ─────────────────────────────────────────────
/** The brain's beat, ms: the relay's alarm steps it this often while the fight lives. */
export const BRAIN_TICK_MS = 250;
/** How often at most the health goes out, and the whole state at least. */
export const HP_SEND_MS = 250;
export const STATE_SEND_MS = 5000;
/** How often the relay writes the fight to storage - an eviction loses this much of it, not the fight. */
export const CHECKPOINT_MS = 2000;
/** The longest step one beat credits: a room woken after a long sleep stands nobody the time it slept. */
export const STEP_MAX_MS = 1000;
/** He stands this long after the first fighter enters before he moves - time to see him. */
export const OPENING_MS = 3000;
/** A walk is said again when its goal moves this far (metres) or this long has passed (ms). */
export const MOVE_RESAY_M = 1.5;
export const MOVE_RESAY_MS = 1000;
/** A walk's target is kept this long before he looks again (a target who died or left is dropped at once). */
export const TARGET_HOLD_MS = 6000;
/** After an attack's recovery, this long before the next is chosen. */
export const BREATH_MS = 300;
/** The most accounts one fight remembers - its checkpoint's bound (a newcomer past it is refused). */
export const GATE_FIGHTERS_MAX = 256;

// ── the numbers a claim sets ───────────────────────────────────────────
export const LV_MIN = 1;
export const LV_MAX = 60;
/** A level claim as the fight reads it: a whole number, LV_MIN..LV_MAX. */
export const clampLv = (lv) => Math.max(LV_MIN, Math.min(LV_MAX, Number.isFinite(lv) ? Math.floor(lv) : LV_MIN));
/** The reference damage a second at a level: the port's own formulas at a normal swing (bible section 5). */
export const dpsRef = (lv) => 5 + clampLv(lv);
/** Seconds of reference damage the health a player brings stands for. */
export const BOSS_TTK_S = 240;
/** A player's damage bucket: refilled at BUCKET_RATE_X times their reference a second, BUCKET_DEPTH_X deep, and no one
 *  blow over HIT_CAP_X times it. */
export const BUCKET_RATE_X = 3;
export const BUCKET_DEPTH_X = 15;
export const HIT_CAP_X = 12;
/** The most blows one account lands a second (a fast swing is about one; arrows and spells fewer). */
export const GATE_HIT_HZ_MAX = 4;
/** How far a melee blow reaches past the boss's body (the player's own 2.5 - playerWeapon.js) and the slack for the
 *  pose's age (a pose is up to a fifth of a second old, and the boss walks while it travels). */
export const MELEE_REACH = 2.5;
export const POSE_SLACK = 3;
/** The blow kinds on the wire: a swing, a shaft, a spell. */
export const HIT_KINDS = Object.freeze({ Melee: 0, Shaft: 1, Spell: 2 });

// ── phases ─────────────────────────────────────────────────────────────
/** The health fractions he changes phase at, and how long he stands shielded when he does. */
export const PHASE_AT = Object.freeze([0.66, 0.33]);
export const SHIELD_MS = 3000;
/** Phase three's wind-ups, shortened by a fifth. */
export const PHASE3_WINDUP = 0.8;

// ── the attacks ────────────────────────────────────────────────────────
// `shape` is what the ground shows and what a struck player's machine tests its own feet against:
//   cone - from the boss, `r` long, `arc` degrees wide, about his facing
//   disc - `r` around a point (his own feet, or each target's)
//   lane - from where he stood toward his target, `w` wide, `len` long; he runs it over `active`
//   ring - between `r0` and `r1` around him - safe at his feet (or far across the floor from him)
//   all  - the whole court
// `pct` is the share of the STRUCK player's own maximum health it takes (resolved on their machine - co-op's law), `el`
// its element (fire honours the game's own saving throw), `aim` where it is laid, `phase` the first it may come in,
// `range` how near the target must be (metres, past his body) before it is begun, `minGap` how far at least, `w` its
// weight in the choice. `windup` is from the word to the landing, `active` the landing's own span (the charge's run),
// `recover` his stillness after it.
export const ATTACKS = Object.freeze({
  cleave: Object.freeze({ id: 0, key: 'cleave', name: 'Cleave', windup: 1400, active: 200, recover: 900, shape: 'cone', r: 9, arc: 110, pct: 0.30, el: null, aim: 'target', phase: 1, range: 6, w: 3, minGap: 0 }),
  slam: Object.freeze({ id: 1, key: 'slam', name: 'Ground Slam', windup: 1600, active: 200, recover: 1100, shape: 'disc', r: 7, pct: 0.35, el: null, aim: 'self', phase: 1, range: 4, w: 2, minGap: 0 }),
  charge: Object.freeze({ id: 2, key: 'charge', name: 'Charge', windup: 1200, active: 900, recover: 1200, shape: 'lane', w: 2, width: 3.5, len: 22, pct: 0.25, el: null, aim: 'target', phase: 1, range: 40, minGap: 8 }),
  hellfire: Object.freeze({ id: 3, key: 'hellfire', name: 'Hellfire', windup: 2000, active: 300, recover: 900, shape: 'disc', r: 3.5, max: 5, pct: 0.30, el: 'fire', aim: 'players', phase: 2, range: 40, w: 2, minGap: 0 }),
  nova: Object.freeze({ id: 4, key: 'nova', name: 'Flame Nova', windup: 2200, active: 300, recover: 1300, shape: 'ring', r0: 4, r1: 30, pct: 0.40, el: 'fire', aim: 'self', phase: 2, range: 40, w: 1, minGap: 0 }),
  wrath: Object.freeze({ id: 5, key: 'wrath', name: "Dagon's Wrath", windup: 6000, active: 500, recover: 0, shape: 'all', pct: 9.99, el: 'fire', aim: 'self', phase: 99, range: 999, w: 0, minGap: 0 }),
});
/** The attacks by their wire id. */
export const ATTACK_BY_ID = Object.freeze(Object.values(ATTACKS).sort((a, b) => a.id - b.id));
/** The ones he chooses among (the wrath is the clock's, not his). */
const CHOSEN = Object.freeze([ATTACKS.cleave, ATTACKS.slam, ATTACKS.charge, ATTACKS.hellfire, ATTACKS.nova]);
/** The share of aimed attacks at the player who dealt the most lately; the rest at a random living one. */
export const THREAT_PICK = 0.6;
/** How fast threat forgets, a share a second (a player who stopped hitting stops being the target). */
export const THREAT_DECAY = 0.1;
/** Who earns a receipt (bible section 6): dealt this share of the health their own claim brought, or stood alive in
 *  the court this share of the fight. */
export const RECEIPT_SHARE = 0.02;
export const STOOD_SHARE = 0.5;

const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
/** A point kept inside a disc of radius `r` about the court's centre (the boss's own, by default). */
export function keepInCourt(x, z, r = BOSS_REACH_R) {
  const d = Math.hypot(x, z);
  return d <= r ? [x, z] : [(x / d) * r, (z / d) * r];
}

/**
 * A fresh fight: nobody in it, the boss at the court's centre facing the south door, no health until someone brings
 * some.
 * @param {number} day @param {number} now @param {number} wrathAt the gate's midnight (net/gateLaw.js gateTimes)
 * @param {string} boss the boss's id (net/gateLaw.js GATE_BOSSES)
 */
export function newFight(day, now, wrathAt, boss) {
  return {
    v: 1, day, boss, startedAt: now, wrathAt, phase: 1, shieldUntil: 0, hp: 0, max: 0,
    pos: [0, 0], yaw: 0, move: null, atk: null, lastA: -1, nextAt: now + OPENING_MS, seq: 0,
    target: null, targetAt: 0,
    /** @type {Record<string, {name: string, lv: number, share: number, dealt: number, clipped: number, bucket: number, bucketAt: number, rate: number, rateAt: number, stoodMs: number, joinedAt: number}>} */
    players: {},
    /** @type {Record<string, number>} sub -> decayed damage */
    threat: {},
    /** @type {{at: number, top: string[], n: number}|null} */
    fell: null,
    /** @type {{at: number}|null} */
    wrath: null,
    lastHpAt: 0, lastHpSent: -1, lastStateAt: now, lastTickAt: now,
  };
}

/**
 * A player steps into the fight. A newcomer brings BOSS_TTK_S seconds of their reference damage as health - at the
 * boss's CURRENT fraction, so a late arrival does not heal him - and only while `admits` (the gate is open) and the
 * fight has room (AUDIT WB A1: a full fight frees an idle seat - freeSeat - over `present`, the accounts in the court).
 * A player already in keeps their FIRST claim: a second `in` cannot raise a cap. A fight that is over takes nobody new.
 * @param {Set<string>|null} [present]
 * @returns {boolean} whether they are in the fight
 */
export function joinFight(f, sub, name, lv, now, admits, present = null) {
  const known = f.players[sub];
  if (known) { if (typeof name === 'string' && name) known.name = name.slice(0, 24); return true; }
  if (f.fell || f.wrath || !admits) return false;
  if (Object.keys(f.players).length >= GATE_FIGHTERS_MAX && !freeSeat(f, present)) return false;
  const level = clampLv(lv);
  const share = BOSS_TTK_S * dpsRef(level);
  const frac = f.max > 0 ? f.hp / f.max : 1;
  // AUDIT WB A8: a newcomer to a fight already bled comes with an EMPTY bucket - its share joins the health at the
  // fraction he stands at, and a full bucket on top of it let a string of late joiners each spend BUCKET_DEPTH_X
  // seconds of damage at once: a kill faster than any claim is meant to buy
  const fresh = frac >= 1;
  f.max += share;
  f.hp += share * frac;
  f.players[sub] = {
    name: String(name ?? '').slice(0, 24), lv: level, share, dealt: 0, clipped: 0,
    bucket: fresh ? BUCKET_DEPTH_X * dpsRef(level) : 0, bucketAt: now, rate: GATE_HIT_HZ_MAX, rateAt: now, stoodMs: 0, joinedAt: now,
  };
  return true;
}

/**
 * AUDIT WB A1: THE COURT IS FULL OF ITS FIGHTERS, NOT OF EVERYONE WHO EVER CAME. A full fight frees the seat of one who
 * joined and left without a blow struck or a moment stood (`present` the accounts in the court now - none freed without
 * it): nothing earned is lost, and their share leaves the boss's health at the fraction he stands at, as it came.
 * Answers whether a seat was freed.
 * @param {ReturnType<typeof newFight>} f @param {Set<string>|null} present
 */
export function freeSeat(f, present) {
  if (!present) return false;
  for (const [sub, p] of Object.entries(f.players)) {
    if (present.has(sub) || p.dealt > 0 || p.stoodMs > 0) continue;
    const frac = f.max > 0 ? f.hp / f.max : 1;
    f.max = Math.max(0, f.max - p.share);
    f.hp = f.max * frac;
    delete f.players[sub];
    delete f.threat[sub];
    if (f.target === sub) f.target = null;
    return true;
  }
  return false;
}

/**
 * A blow on the boss from `sub`, standing at `pose` ({x, z} in the court's frame, or null), of kind `r`, claiming `d`.
 * Answers the damage ACCEPTED (0 for a refused blow). Refused: a stranger to the fight, a fight over, the boss
 * shielded, past the account's blow rate, a pose that says nothing, a melee blow from out of reach, anything from
 * off the court. Clipped (and counted): past the one-blow cap, past the bucket.
 */
export function applyHit(f, sub, d, r, pose, now) {
  const p = f.players[sub];
  if (!p || f.fell || f.wrath || !Number.isFinite(d) || !(d > 0)) return 0;
  if (now < f.shieldUntil) return 0;
  // the blow rate: a token bucket, GATE_HIT_HZ_MAX a second, one second deep - spent whatever the blow turns out to be
  p.rate = Math.min(GATE_HIT_HZ_MAX, p.rate + (Math.max(0, now - p.rateAt) / 1000) * GATE_HIT_HZ_MAX);
  p.rateAt = now;
  if (p.rate < 1) return 0;
  p.rate -= 1;
  if (!pose || !Number.isFinite(pose.x) || !Number.isFinite(pose.z)) return 0;
  if (Math.hypot(pose.x, pose.z) > COURT_R + POSE_SLACK) return 0;   // nobody strikes the court from off it
  const gap = dist(pose.x, pose.z, f.pos[0], f.pos[1]) - BOSS_R;
  if (r === HIT_KINDS.Melee && gap > MELEE_REACH + POSE_SLACK) return 0;
  // the damage: capped a blow, then the bucket
  const ref = dpsRef(p.lv);
  p.bucket = Math.min(BUCKET_DEPTH_X * ref, p.bucket + (Math.max(0, now - p.bucketAt) / 1000) * BUCKET_RATE_X * ref);
  p.bucketAt = now;
  const got = Math.max(0, Math.min(d, HIT_CAP_X * ref, p.bucket, f.hp));
  p.bucket -= got;
  p.clipped += d - got;
  p.dealt += got;
  if (got > 0) f.threat[sub] = (f.threat[sub] ?? 0) + got;
  f.hp -= got;
  if (f.hp <= 1e-6 && f.max > 0) {
    f.hp = 0;
    f.fell = { at: now, top: topDealers(f, 3), n: Object.keys(f.players).length };
    f.move = null;
    f.atk = null;
  }
  return got;
}

/** The names of the `k` who dealt the most, most first (ties by the earlier to join). */
export function topDealers(f, k) {
  return Object.values(f.players).filter((q) => q.dealt > 0)
    .sort((a, b) => b.dealt - a.dealt || a.joinedAt - b.joinedAt).slice(0, k).map((q) => q.name);
}

/** Did `sub` earn a receipt (bible section 6)? Only a fallen boss pays: dealt RECEIPT_SHARE of the health it brought, or
 *  stood alive in the court for STOOD_SHARE of the fight. */
export function earned(f, sub) {
  const p = f.players[sub];
  if (!p || !f.fell) return false;
  const fight = Math.max(1, f.fell.at - f.startedAt);
  return p.dealt >= RECEIPT_SHARE * p.share || p.stoodMs >= STOOD_SHARE * fight;
}
/** How `sub` earned it, for the receipt: 'dealt' first (it is the stronger claim), else 'stood'. */
export const earnedBy = (f, sub) => (f.players[sub]?.dealt >= RECEIPT_SHARE * (f.players[sub]?.share ?? Infinity) ? 'dealt' : 'stood');

/** The attack's wind-up in this phase. */
export const windupOf = (atk, phase) => (phase >= 3 && atk.id !== ATTACKS.wrath.id ? Math.round(atk.windup * PHASE3_WINDUP) : atk.windup);

/** Pick who he goes at: THREAT_PICK of the time the living player with the most threat, else a random living one. */
export function pickTarget(f, bodies, rng) {
  const live = bodies.filter((b) => !b.dead && f.players[b.sub]);
  if (!live.length) return null;
  if (rng() < THREAT_PICK) {
    let best = null, t = 0;
    for (const b of live) { const v = f.threat[b.sub] ?? 0; if (v > t) { t = v; best = b; } }
    if (best) return best;
  }
  return live[Math.floor(rng() * live.length) % live.length];
}

/** The attacks this phase allows against a target `gap` metres past his body, with `near` living players inside his
 *  slam - the last one he used left out when anything else is open. */
export function attacksFor(phase, gap, near, lastA = -1) {
  const out = CHOSEN.filter((a) => a.phase <= phase && gap <= a.range && (a.minGap <= 0 || gap >= a.minGap) && !(a === ATTACKS.slam && near < 1));   // a body inside his (a negative gap) is still in reach
  const fresh = out.filter((a) => a.id !== lastA);
  return fresh.length ? fresh : out;
}

/** One of `can` by weight. */
export function chooseAttack(can, rng) {
  const total = can.reduce((s, a) => s + a.w, 0);
  let x = rng() * total;
  for (const a of can) { x -= a.w; if (x < 0) return a; }
  return can[can.length - 1];
}

/**
 * ONE BEAT. `bodies` are the fight's players standing in the court now ({sub, x, z, dead}, the court's frame), `rng` a
 * [0,1) source. Answers the frames to send, in order, as plain objects the relay stamps and fans ({k, ...} - the
 * `gate` frame's kinds). Moves the state in place.
 */
export function stepBrain(f, now, bodies, rng) {
  const out = [];
  const dt = Math.min(STEP_MAX_MS, Math.max(0, now - f.lastTickAt));
  f.lastTickAt = now;
  if (f.fell || f.wrath) return out;
  // standing: a living body in the court stands its time
  for (const b of bodies) { const p = f.players[b.sub]; if (p && !b.dead) p.stoodMs += dt; }
  // threat forgets
  const keep = Math.pow(1 - THREAT_DECAY, dt / 1000);
  for (const k of Object.keys(f.threat)) { f.threat[k] *= keep; if (f.threat[k] < 0.5) delete f.threat[k]; }
  // THE WRATH: the clock's, not his - begun so it lands on the gate's midnight (a room woken late gives a second's
  // warning at least), and unanswerable
  const wr = ATTACKS.wrath;
  if (f.atk?.a === wr.id) {
    if (now >= f.atk.at) { f.wrath = { at: f.atk.at }; f.atk = null; out.push({ k: 'wrath', at: f.wrath.at }); }
    return out;
  }
  if (now >= f.wrathAt - wr.windup) {
    f.move = null;
    f.atk = { i: ++f.seq, a: wr.id, at: Math.max(f.wrathAt, now + 1000), x: f.pos[0], z: f.pos[1], yw: f.yaw, tg: [], until: 0 };
    f.atk.until = f.atk.at + wr.active;
    out.push({ k: 'atk', ...atkFrame(f.atk) });
    return out;
  }
  // a phase crossed: a roar, a shield, and a nova with it (an attack in flight is superseded - the new word is the
  // one every screen draws)
  if (f.max > 0 && f.phase < 3 && f.hp / f.max <= PHASE_AT[f.phase - 1]) {
    f.phase++;
    f.shieldUntil = now + SHIELD_MS;
    f.move = null;
    out.push({ k: 'ph', n: f.phase, until: f.shieldUntil });
    begin(f, ATTACKS.nova, now, null, bodies, rng, out);
  }
  // an attack in flight: the charge runs its lane over its active span; the rest hold still until their recovery ends
  if (f.atk) {
    const atk = ATTACK_BY_ID[f.atk.a];
    if (atk === ATTACKS.charge && now >= f.atk.at) {
      const k = Math.min(1, (now - f.atk.at) / atk.active), end = f.atk.tg[0];
      f.pos = keepInCourt(f.atk.x + (end[0] - f.atk.x) * k, f.atk.z + (end[1] - f.atk.z) * k);
    }
    if (now < f.atk.until) { hpFrame(f, now, out); stateFrame(f, now, out); return out; }
    f.lastA = f.atk.a;
    f.atk = null;
    f.target = null;
    f.nextAt = now + BREATH_MS;
  }
  // choose: a target he keeps a while, and what can be done to it from here - else walk at it
  if (now >= f.nextAt) {
    let target = f.target ? bodies.find((b) => b.sub === f.target && !b.dead) ?? null : null;
    if (!target || now - f.targetAt >= TARGET_HOLD_MS) {
      target = pickTarget(f, bodies, rng);
      f.target = target?.sub ?? null;
      f.targetAt = now;
    }
    if (target) {
      const gap = dist(target.x, target.z, f.pos[0], f.pos[1]) - BOSS_R;
      const near = bodies.filter((b) => !b.dead && f.players[b.sub] && dist(b.x, b.z, f.pos[0], f.pos[1]) <= ATTACKS.slam.r).length;
      const can = attacksFor(f.phase, gap, near, f.lastA);
      if (can.length) { f.move = null; begin(f, chooseAttack(can, rng), now, target, bodies, rng, out); }
      else walkToward(f, target, now, out);
    } else if (f.move) {
      stepWalk(f, now);
      f.move = null;
      out.push({ k: 'mv', x: r2(f.pos[0]), z: r2(f.pos[1]), tx: r2(f.pos[0]), tz: r2(f.pos[1]), v: 0, at: now });
    }
  }
  stepWalk(f, now);
  hpFrame(f, now, out);
  stateFrame(f, now, out);
  return out;
}

/** Where the last said walk has taken him by `now`. */
function stepWalk(f, now) {
  const m = f.move;
  if (!m) return;
  const len = dist(m.x, m.z, m.tx, m.tz);
  if (len < 1e-6) { f.pos = [m.tx, m.tz]; return; }
  const along = Math.min(len, (Math.max(0, now - m.at) / 1000) * m.v);
  f.pos = keepInCourt(m.x + ((m.tx - m.x) / len) * along, m.z + ((m.tz - m.z) / len) * along);
}

/** Walk at a target, stopping short of it by his body and a little: a new segment is said when its goal moved past
 *  MOVE_RESAY_M or MOVE_RESAY_MS has passed. */
function walkToward(f, target, now, out) {
  stepWalk(f, now);
  const dx = target.x - f.pos[0], dz = target.z - f.pos[1], d = Math.hypot(dx, dz);
  const stop = Math.max(0, d - (BOSS_R + 1));
  const [tx, tz] = keepInCourt(f.pos[0] + (d > 0 ? (dx / d) * stop : 0), f.pos[1] + (d > 0 ? (dz / d) * stop : 0));
  const m = f.move;
  if (m && dist(m.tx, m.tz, tx, tz) < MOVE_RESAY_M && now - m.at < MOVE_RESAY_MS) return;
  f.move = { x: f.pos[0], z: f.pos[1], tx, tz, v: BOSS_SPEED, at: now };
  if (d > 0) f.yaw = Math.atan2(dx, dz);
  out.push({ k: 'mv', x: r2(f.move.x), z: r2(f.move.z), tx: r2(tx), tz: r2(tz), v: BOSS_SPEED, at: now });
}

/** Begin an attack: where it lands and when, said now so every screen draws the wind-up at once. */
function begin(f, atk, now, target, bodies, rng, out) {
  const at = now + windupOf(atk, f.phase);
  let tg = [];
  if (target) f.yaw = Math.atan2(target.x - f.pos[0], target.z - f.pos[1]);
  if (atk === ATTACKS.charge) {
    tg = [keepInCourt(f.pos[0] + Math.sin(f.yaw) * atk.len, f.pos[1] + Math.cos(f.yaw) * atk.len)];
  } else if (atk === ATTACKS.hellfire) {
    const live = bodies.filter((b) => !b.dead && f.players[b.sub]);
    for (let i = live.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)) % (i + 1); const t = live[i]; live[i] = live[j]; live[j] = t; }
    const first = live.slice(0, atk.max);
    tg = first.map((b) => keepInCourt(b.x, b.z, COURT_R));
    // phase three: a second volley, scattered about the same feet
    if (f.phase >= 3) tg = tg.concat(first.map((b) => keepInCourt(b.x + (rng() - 0.5) * 6, b.z + (rng() - 0.5) * 6, COURT_R)));
  }
  f.atk = { i: ++f.seq, a: atk.id, at, x: f.pos[0], z: f.pos[1], yw: f.yaw, tg, until: at + atk.active + atk.recover };
  out.push({ k: 'atk', ...atkFrame(f.atk) });
}

const r2 = (v) => Math.round(v * 100) / 100;
/** An attack as the wire says it: its sequence, which, when it lands (the relay's clock), where he stood, his facing,
 *  its targets. */
export function atkFrame(a) {
  return { i: a.i, a: a.a, at: a.at, x: r2(a.x), z: r2(a.z), yw: r2(a.yw), tg: a.tg.map((p) => [r2(p[0]), r2(p[1])]) };
}
function hpFrame(f, now, out) {
  const h = Math.round(f.hp);
  if (h !== f.lastHpSent && now - f.lastHpAt >= HP_SEND_MS) { f.lastHpSent = h; f.lastHpAt = now; out.push({ k: 'hp', h, m: Math.round(f.max) }); }
}
function stateFrame(f, now, out) {
  if (now - f.lastStateAt < STATE_SEND_MS) return;
  f.lastStateAt = now;
  out.push(stateOf(f));
}
/** The whole state as the wire says it (the `st` kind): on entering, and every STATE_SEND_MS. */
export function stateOf(f) {
  return {
    k: 'st', d: f.day, b: f.boss, ph: f.phase, h: Math.round(f.hp), m: Math.round(f.max), x: r2(f.pos[0]), z: r2(f.pos[1]), yw: r2(f.yaw),
    mv: f.move ? { x: r2(f.move.x), z: r2(f.move.z), tx: r2(f.move.tx), tz: r2(f.move.tz), v: f.move.v, at: f.move.at } : null,
    atk: f.atk ? atkFrame(f.atk) : null, sh: f.shieldUntil, wr: f.wrathAt, n: Object.keys(f.players).length,
    fell: f.fell ? { at: f.fell.at, top: f.fell.top, n: f.fell.n } : null, wrath: f.wrath ? f.wrath.at : null,
  };
}
