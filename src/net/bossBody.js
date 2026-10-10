// @ts-check
// INT11 (2026-10-10, the INTEGRITY arc's lane 3 - bible/06-Systems/Integrity-Arc.md section 6; Mac: "I want to do
// everything and do it properly", and of the healing the relay cannot see: "Measure, then enforce"): THE BODY COUNTED -
// the relay's own count of each fighter's body in a boss fight (a gate's, an Abyss Dungeon's) and of each ship's hull
// in a serpent's, kept beside the client's.
//
// A boss's blow was judged on the struck player's machine alone (co-op's law - net/gateStrike.js, net/sdStrike.js,
// systems/serpentStrike.js), so a client that took none stood every fight out, earned the spoils' "stood" share, and
// could carry a fight alone. Now the relay runs the same tests on the poses it holds (net/bossRef.js) and takes each
// blow no saving throw answers off its OWN count (`v`, a share of the whole). The client's admissions never lower it -
// a blow the client took and said before the relay judged it would be taken twice - so the count is the relay's
// ledger alone: one less every blow it judged, one more every mend it believed.
//
// What a client's machine can soften and the relay cannot see - a potion, a Heal, a Shield, a set's halving, a brace,
// a carpenter's patch - is the client's word (`vt`, its body's share, or its hull's): a word that says MORE than the
// count claims the difference as a MEND, believed out of a budget a fighter fills with time (`line`: `depth` held, `perS`
// a second). A word that says less claims nothing: a hurt the relay never counted (an element's, a pool's, a fall's) is
// the client's own, and healing it back is no claim on the budget.
//
// MEASURE FIRST (Mac, 2026-10-10: "Measure, then enforce" - lane 1's wealth budget's law, INT5): BODY_DEFAULT.enforce
// is off. The count runs, and each fighter's measure (`bodyMeasure`: what it counted, what it believed, what was claimed
// past the line, how often the count fell, whether the receipt would have stood had its first fall been a fall) rides
// the fighter's receipt to the account service for staff to read. Nobody falls by it. Staff set the line and turn
// `enforce` on (the relay's BOSS_BODY var - bodyConfig): from then a body the count takes to nothing is fallen (its
// blows land nothing, it stands no time, it is chosen no more, the Abyss Dungeon takes its one life, a ship is
// wrecked) and its game is told.
//
// PURE: a fighter's record, a share, a clock in; the record (`p.bd`) moved in place. Not a DFU member. Ledger A (INT).

/** A pose must stand this deep inside a blow's shape for the relay to count it (metres) - in the struck player's favour:
 *  a pose is up to a tenth of a second old at the relay (net/online.js POSE_HZ), and a run covers a metre in it. */
export const BODY_MARGIN = 1.5;
/** A landing is judged this long after it, so the first pose after it has come (net/online.js POSE_HZ's tenth of a
 *  second, and the way here) - a body that sent none since stands where it stood. The whole arena's blows, which have no
 *  shape to step out of, at once. */
export const BODY_AFTER_MS = 400;
/** A death the fight saw (the pose's `dd`) is a new life only this long after it, once `enforce` is on - a respawn and
 *  the walk back are longer; a `dd` and a living pose a beat apart are no rise. */
export const BODY_RISE_MS = 15_000;
/** A ship the count wrecked floats again past this share of her hull - the sea's own law (systems/naval/navalYard.js
 *  FIELD_REFLOAT, held equal by test/int11_body.test.js: the relay's bundle does not carry the yard). */
export const HULL_REFLOAT = 0.15;
/** The most a mend line may hold or fill a second (a staff typo is refused, never obeyed). */
export const BODY_LINE_MAX = 10;
/**
 * THE LINE STAFF START FROM - each number a guess the measure exists to replace (INT5's law): a body's mends a whole
 * body held and a whole one more every 20 s; a hull's, the sea's repairs under fire beside the free mending
 * (navalYard.js SEA_REPAIR_PER_S x SEA_REPAIR_UNDER_FIRE + FIELD_MEND_PER_S, 0.006 a second) twice over.
 */
export const BODY_DEFAULT = Object.freeze({
  enforce: false,
  body: Object.freeze({ depth: 1, perS: 0.05 }),
  hull: Object.freeze({ depth: 0.15, perS: 0.012 }),
});

const lineOk = (l) => !!l && typeof l === 'object' && [l.depth, l.perS].every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= BODY_LINE_MAX);
/**
 * The relay's line from its BOSS_BODY var - JSON `{enforce, body: {depth, perS}, hull: {depth, perS}}`, each part
 * optional (the default's where absent). Anything else - not JSON, a wrong type, a number out of bounds - is the
 * default whole: a line staff mistyped measures; it never enforces something nobody chose.
 * @param {unknown} raw
 * @returns {{enforce: boolean, body: {depth: number, perS: number}, hull: {depth: number, perS: number}}}
 */
export function bodyConfig(raw) {
  if (raw == null || raw === '') return BODY_DEFAULT;
  let c = raw;
  if (typeof raw === 'string') { try { c = JSON.parse(raw); } catch { return BODY_DEFAULT; } }
  if (!c || typeof c !== 'object' || Array.isArray(c)) return BODY_DEFAULT;
  const o = /** @type {any} */ (c);
  if (o.enforce !== undefined && typeof o.enforce !== 'boolean') return BODY_DEFAULT;
  if (o.body !== undefined && !lineOk(o.body)) return BODY_DEFAULT;
  if (o.hull !== undefined && !lineOk(o.hull)) return BODY_DEFAULT;
  return Object.freeze({
    enforce: o.enforce ?? BODY_DEFAULT.enforce,
    body: Object.freeze({ depth: (o.body ?? BODY_DEFAULT.body).depth, perS: (o.body ?? BODY_DEFAULT.body).perS }),
    hull: Object.freeze({ depth: (o.hull ?? BODY_DEFAULT.hull).depth, perS: (o.hull ?? BODY_DEFAULT.hull).perS }),
  });
}

/**
 * A fighter's count, new: whole, its budget full. The measure (`t` counted, `h` believed, `o` claimed past the line, `w`
 * falls by the count, `fs`/`fd` the time it had stood and the damage it had dealt at the first) is the fight's, kept
 * across its lives.
 * @param {number} now @param {{depth: number}} line
 */
export const newBody = (now, line) => ({ v: 1, m: line.depth, mAt: now, u: 0, dn: false, t: 0, h: 0, o: 0, w: 0, fs: null, fd: null, dd: null, sd: false });
/** @param {any} p @param {number} now @param {{depth: number}} line */
const bodyOf = (p, now, line) => (p.bd ??= newBody(now, line));
/** The budget filled to `now`. */
function fill(b, now, line) {
  if (now > b.mAt) { b.m = Math.min(line.depth, b.m + (line.perS * (now - b.mAt)) / 1000); b.mAt = now; }
  else if (b.m > line.depth) b.m = line.depth;   // a line lowered since
}
/** Is the fighter fallen by the count (whether or not that is enforced)? */
export const bodyDown = (p) => !!p?.bd?.dn;
/** Is the fighter OUT of the fight by the count - fallen by it, or dead and not yet risen - while `enforce` holds? Its
 *  blows land nothing (the dead strike nothing, by the relay's word now as by the pose's). */
export const bodyOut = (p, enforce) => !!enforce && !!p?.bd && (p.bd.dn || p.bd.dd != null);
/** AUDIT INT11: the count's fall is told again this often while its game has not taken it (bodyTellOwed). */
export const BODY_TELL_MS = 3000;
/**
 * AUDIT INT11: IS THE COUNT'S FALL OWED ITS GAME AGAIN? It was said once, to the sockets the fighter held at that beat -
 * one mid-reconnect heard nothing, lived on in its own game, and fought on a ghost: its blows landing nothing, its time
 * standing none, no word of why. Once `enforce` holds: fallen by the count, no death seen since (`dd` - its game took the
 * fall), and BODY_TELL_MS since it was last told (`ta`, stamped here when it answers true; the first telling stamps it
 * too). The caller adds its own acknowledgement where a death is no word (a ship's: her own `wr 1`).
 * @param {any} p @param {number} now @param {boolean} enforce
 */
export function bodyTellOwed(p, now, enforce) {
  const b = p?.bd;
  if (!enforce || !b?.dn || b.dd != null || now - (b.ta ?? -Infinity) < BODY_TELL_MS) return false;
  b.ta = now;
  return true;
}
/** The relay's trail of a body's poses: this long, this many at most (net/bossRef.js posAt reads it). */
export const BODY_TRAIL_MS = 2000;
export const BODY_TRAIL_MAX = 24;

/**
 * A BLOW the relay judged landed: `share` of the whole off the count. Answers true when it took the count to nothing -
 * the count's fall (`w` one more; the first's stood time and damage kept for the receipt's measure). A count at
 * nothing already takes nothing (fallen, by its own word or the count's).
 * @param {any} p the fighter's record in its fight @param {number} share @param {number} now @param {{depth: number}} line
 */
export function bodyStruck(p, share, now, line) {
  if (!p || !(share > 0)) return false;
  const b = bodyOf(p, now, line);
  if (b.dn || !(b.v > 0)) return false;
  b.t += share;
  b.v = Math.max(0, b.v - share);
  if (b.v > 0) return false;
  b.dn = true;
  b.w++;
  if (b.fs == null) { b.fs = p.stoodMs ?? 0; b.fd = p.dealt ?? 0; }
  return true;
}

/**
 * THE CLIENT'S WORD of its body (or hull): `c`, a share of the whole. More than the count claims the difference as a
 * mend: believed out of the budget (`h`), the rest left unmet (`u`) - and each rise of what is left unmet is claimed
 * PAST THE LINE (`o`), counted once however often the same word comes again. Less claims nothing. Fallen by the count:
 * a body mends no more while `enforce` holds (a new life alone stands it up - bodyLife); a hull mends, and floats again
 * past `up` (HULL_REFLOAT); unenforced, either stands again past `up`.
 * @param {any} p @param {number} c @param {number} now @param {{depth: number, perS: number}} line
 * @param {{enforce?: boolean, up?: number, hull?: boolean}} [o]
 */
export function bodySaid(p, c, now, line, { enforce = false, up = 0, hull = false } = {}) {
  if (!p || typeof c !== 'number' || !Number.isFinite(c)) return false;
  const b = bodyOf(p, now, line);
  b.sd = true;   // its game says its body: its measure means something (bodyMeasure)
  fill(b, now, line);
  if (b.dn && enforce && !hull) return false;
  const s = Math.min(1, Math.max(0, c)) - b.v;
  if (!(s > 0)) { b.u = 0; return false; }
  const g = Math.min(s, b.m), u = s - g;
  b.m -= g; b.h += g; b.v += g;
  if (u > b.u) b.o += u - b.u;
  b.u = u;
  if (b.dn && b.v > up) b.dn = false;
  return g > 0;
}

/**
 * AUDIT INT11: AN ALLY'S HEAL the relay believed (the gate's `heal` word, through its own heal bucket - gateBrain.js
 * applyHeal), `share` of the whole: no mend of the body's own, so never its budget's. It was charged to it: a tank three
 * healers held up claimed every point of theirs out of its own budget, past the line (`o`), and under `enforce` fell by
 * the count while every screen had it standing. The heal's word comes after the body's (a second's batch against a
 * quarter's), so it pays back what the body's word claimed of it, in order: what the count left unmet - believed now, and
 * no longer past the line; then what the budget paid - given back, and no longer the body's own believing (`h`); the rest,
 * a heal whose body's word is still to come, stands the count up itself. Fallen by the count while `enforce` holds, a
 * heal stands it up no more than its own word would. Answers the share it took. Pure.
 * @param {any} p @param {number} share @param {number} now @param {{depth: number, perS: number}} line
 * @param {{enforce?: boolean, up?: number}} [o]
 */
export function bodyHealed(p, share, now, line, { enforce = false, up = 0 } = {}) {
  if (!p || !(share > 0) || !Number.isFinite(share)) return 0;
  const b = bodyOf(p, now, line);
  fill(b, now, line);
  if (b.dn && enforce) return 0;
  const k = Math.min(share, b.u);
  b.u -= k; b.o = Math.max(0, b.o - k); b.v = Math.min(1, b.v + k);
  const back = Math.min(share - k, Math.max(0, line.depth - b.m), b.h);
  b.m += back; b.h -= back;
  b.v = Math.min(1, b.v + (share - k - back));
  if (b.dn && b.v > up) b.dn = false;
  return share;
}

/** A NEW LIFE in the fight (a death it saw, then the fighter alive in it again): whole, its budget full, standing - its
 *  measure kept. @param {any} p @param {number} now @param {{depth: number}} line */
export function bodyLife(p, now, line) {
  const b = bodyOf(p, now, line);
  Object.assign(b, { v: 1, m: line.depth, mAt: now, u: 0, dn: false, dd: null });
}

/**
 * THE CENSUS AS THE COUNT HAS IT: each body's death (`dead`, its own `dd`) noted on its count; a body alive again after
 * one is a new life (bodyLife) - once `enforce` holds, only BODY_RISE_MS after it, and dead until then; and a body the
 * count has fallen is dead while `enforce` holds. Answers the bodies (new objects where they change) - the fight's
 * brain reads `dead` from here as it always did.
 * @param {any} f the fight ({players}) @param {Array<{sub: string, dead: boolean}>} bodies @param {number} now
 * @param {{depth: number}} line @param {boolean} enforce @param {{lives?: boolean}} [o] `lives` false: no new life (the Abyss Dungeon's one)
 */
export function bodyCensus(f, bodies, now, line, enforce, { lives = true } = {}) {
  return bodies.map((x) => {
    const p = f.players?.[x.sub];
    if (!p) return x;
    const b = bodyOf(p, now, line);
    if (x.dead) { if (b.dd == null) b.dd = now; return x; }
    if (b.dd != null) {
      if (!lives) return enforce ? { ...x, dead: true } : x;
      if (enforce && now - b.dd < BODY_RISE_MS) return { ...x, dead: true };
      bodyLife(p, now, line);
    }
    return enforce && b.dn ? { ...x, dead: true } : x;
  });
}

/**
 * A FIGHTER'S MEASURE, as its receipt carries it (`m`): [counted, believed, claimed past the line] in thousandths of a
 * whole, the count's falls, whether the receipt would have stood had the first been a fall (1/0 - `kept`, the fight's
 * own law asked of the fighter as it stood then), and its seconds stood in the fight. Null for a fighter the count
 * never saw, and for one whose game never said its body (`sd` - a tab from before INT11 believes no mend, and its count
 * would read a fall that never was: no line is set from it).
 * @param {any} p @param {(q: any) => boolean} kept the fight's earning law, asked of a copy of the fighter
 */
export function bodyMeasure(p, kept) {
  const b = p?.bd;
  if (!b?.sd) return null;
  const k = b.fs == null ? 1 : (kept({ ...p, stoodMs: b.fs, dealt: b.fd }) ? 1 : 0);
  const th = (x) => Math.max(0, Math.min(BODY_MEASURE_MAX, Math.round(x * 1000)));
  return [th(b.t), th(b.h), th(b.o), Math.min(BODY_MEASURE_MAX, b.w), k, Math.min(BODY_MEASURE_MAX, Math.round((p.stoodMs ?? 0) / 1000))];
}
/** The most any number of a measure says (a receipt's bound, and the service's). */
export const BODY_MEASURE_MAX = 999_999;
/** Is `m` a measure a receipt may carry? Six whole numbers, each 0..BODY_MEASURE_MAX, the fifth 0 or 1. */
export const bodyMeasureValid = (m) => Array.isArray(m) && m.length === 6 && m.every((n) => Number.isSafeInteger(n) && n >= 0 && n <= BODY_MEASURE_MAX) && m[4] <= 1;

/** THE MARGIN: is (x, z) inside `test` with every point BODY_MARGIN (or `m`) round it inside too - the struck player's
 *  favour, eight ways round. @param {(x: number, z: number) => boolean} test @param {number} x @param {number} z */
export function deepIn(test, x, z, m = BODY_MARGIN) {
  if (!Number.isFinite(x) || !Number.isFinite(z) || !test(x, z)) return false;
  for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; if (!test(x + Math.sin(a) * m, z + Math.cos(a) * m)) return false; }
  return true;
}

/** THE CLIENT'S SAYING (INT15): its word (`vt`) at most every BODY_SAY_MS, at once when its body moves a thousandth, and
 *  every BODY_SAY_KEEP_MS however still - the budget the relay fills between words grants nothing until a word asks it. */
export const BODY_SAY_MS = 250;
export const BODY_SAY_KEEP_MS = 3000;
/** The whole, in the word's thousandths (net/wire.js BODY_WORD_MAX, pinned equal). */
export const BODY_SAY_WHOLE = 1000;
/**
 * A sayer: `say(share, t)` sends the body's share (0..1) as the word's thousandths through `send(v)` when the rule above
 * says so - true when it did. Pure but for its own two numbers.
 * @param {(v: number) => boolean} send
 */
export function bodySayer(send) {
  let lastV = -1, lastAt = -Infinity;
  return (/** @type {number} */ share, /** @type {number} */ t) => {
    if (!Number.isFinite(share) || !Number.isFinite(t) || t - lastAt < BODY_SAY_MS) return false;
    const v = Math.max(0, Math.min(BODY_SAY_WHOLE, Math.round(share * BODY_SAY_WHOLE)));
    if (v === lastV && t - lastAt < BODY_SAY_KEEP_MS) return false;
    if (!send(v)) return false;
    lastV = v; lastAt = t;
    return true;
  };
}
