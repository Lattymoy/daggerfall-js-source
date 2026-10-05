// @ts-check
// TELL8 (bible/12-Enhanced-AI/Feud-Arc.md section 10; Mac, 2026-10-04: "breath more depth into it", then "Go" - OPEN 9:
// wind-ups at peers, each client judging its own feet): A WIND-UP ON THE WIRE. Before it a telegraphed blow lived on
// its owner's machine alone - no peer saw its mark, its glint or its held arm, and a foe never wound up at a peer. Now:
//   THE OWNER'S WORD (`blowWire`) - each foe record carries its live wind-up: `wk` the shape (0-6, WIRE_KINDS) +8 for
//     iron +16 for a feint, `wy` its yaw, `wl` milliseconds to its landing (relative: the brain's clock is each
//     client's own; it absorbs the frame's wait), `wo` its origin (the record's own coordinates), `wp` a leap's or a
//     shot's point (its distance along `wy`, metres); and `ws` 1 staggered, 2 overreached.
//   THE PUPPET'S STATE (`applyBlowRecord`, `puppetBlowTurn`) - a SYNTHETIC brain state on the puppet's `ai._tac`
//     (marked `puppet`), so every reader of a wind-up - the ground (ai/foeBlows.js drawableBlows), the glint, the ear and
//     the target bar (scenes/hostCombat.js tellCues, ai/tactics.js poiseTrack) - reads a peer's foe as a local one: the
//     mark from `wl` (part-filled by the shape's nominal length), its held arm, a feint's dashed cut, a broken one's
//     cancel; its stagger and its overreach (the puppet's pose; its entity's `staggerUntil`/`overreachUntil`, so my roll
//     against it takes the same x1.25 and x1.3 - systems/blowTaken.js).
//   EACH JUDGES THEIR OWN FEET (10.3, net/gateStrike.js's law) - a puppet's wind-up AT ME lands on my feet at the
//     landing: the verdict, the weight and the effect on the puppet's `ai` as a local landing leaves them, so its swing
//     resolves through the host's own door (resolveFoeMeleeVsPlayer -> blowConnects, blowScaled, landBlowEffect); the
//     late sample makes a perfect dodge mine too. The owner's view of my feet opens its foe's window (6.3) - never my
//     damage.
//   THE BLOW'S CLASS (`blowClassOf`, net/wire.js `wc`) - my blow on a puppet winding up rides to its owner with its K,
//     its back flag (my feet against the puppet's facing) and its weakness flag, so the owner's poise meter weighs it as
//     its own (10.4).
import { BLOW, TELL_IRON_EXTRA } from './blowShapes.js';
import { makeBlow, setLiveBlow, shatterBlow, liveBlows, inBlow, fitBlowToGround, BLOW_COLOR, IRON_COLOR, BLOW_VERDICT_LIFE } from './foeBlows.js';
import { TELL, blowK, behind } from './tells.js';
import { tacticsNow } from './tacticsClock.js';
import { LOCAL_TARGET, PUPPET_HELD_UNTIL, releaseTactics } from './tactics.js';

/** The shapes in their wire order (`wk & 7`). */
export const WIRE_KINDS = Object.freeze(['lunge', 'sweep', 'slam', 'ring', 'charge', 'leap', 'aimed']);
export const WIRE_IRON = 8;
export const WIRE_FEINT = 16;
/** AUDIT TELL O2: `wk`'s landed flag - its owner's landing, written for WIRE_LANDED_S after it. */
export const WIRE_LANDED = 32;
/** FEUD WIRE (Feud-Arc.md 25): `wk`'s signature flag - a revenant's signature (RVN5), struck at its multiplier. */
export const WIRE_SIG = 64;
export const WIRE_LANDED_S = 0.5;
/** `wl`'s ceiling (ms): no wind-up is longer. */
export const WIRE_LAND_MS = 3000;

/** A stagger or an overreach its owner says stands, on the puppet's entity until its owner says it ended (its home
 *  ai/tactics.js, which clears it when a puppet is handed over). */
export { PUPPET_HELD_UNTIL };

const q2 = (v) => Math.round(v * 100) / 100;
const q3 = (v) => Math.round(v * 1000) / 1000;

/** The owner's word for `ai`'s record now - `{ wk, wy, wl, wo, wn, wp?, ws? }`, or the parts that apply ({} none): a live
 *  wind-up (never a cut feint, never one past its landing - a charge's run is its landing), and AUDIT TELL O2 its
 *  LANDING for WIRE_LANDED_S after it (`wk` + WIRE_LANDED, `wl` 0) - so a receiver whose clock runs behind lands it on its
 *  owner's word rather than reading the field gone as a break; `wn` the blow's serial (its foe's own count, mod 256);
 *  and the stagger or the overreach. `toWire` the record's own projection of a scene point. A puppet's synthetic state
 *  says nothing. */
export function blowWire(ai, now = tacticsNow(), toWire = (p) => p) {
  const s = ai?._tac;
  /** @type {{ wk?: number, wy?: number, wl?: number, wo?: number[], wn?: number, wp?: number, ws?: number }} */
  const out = {};
  if (!s || s.puppet) return out;
  const live = s.state === 'windup' && s.blow && s.blow.cut == null && now < s.blow.land ? s.blow : null;
  const landed = !live && s.landed && now - s.landed.at <= WIRE_LANDED_S && s.landed.blow?.cut == null ? s.landed.blow : null;
  const b = live ?? landed;
  const k = b ? WIRE_KINDS.indexOf(b.kind) : -1;
  if (b && k >= 0) {
    const w = toWire(b.origin);
    if (w && w.length === 3 && w.every(Number.isFinite)) {
      out.wk = k | (b.guard === 'iron' ? WIRE_IRON : 0) | (b.feint ? WIRE_FEINT : 0) | (landed ? WIRE_LANDED : 0) | (b.sig ? WIRE_SIG : 0);
      out.wy = q3(b.yaw);
      out.wl = landed ? 0 : Math.max(0, Math.min(WIRE_LAND_MS, Math.round((b.land - now) * 1000)));
      out.wo = [q2(w[0]), q2(w[1]), q2(w[2])];
      out.wn = (b.n ?? 0) & 255;
      if (Number.isFinite(b.ahead)) out.wp = q2(b.ahead);
    }
  }
  if (s.state === 'staggered' && now < (s.until ?? 0)) out.ws = 1;
  else if (s.state === 'overreach' && now < (s.until ?? 0)) out.ws = 2;
  return out;
}
/** The record's dedupe key's share: the blow (its serial, its landing) and its state, never `wl` (it runs down every
 *  frame; the landing it names is fixed). */
export const blowWireKey = (r) => `${r.wk ?? ''}/${r.wn ?? ''}/${r.wy ?? ''}/${r.wo ? r.wo.join(':') : ''}/${r.wp ?? ''}/${r.ws ?? 0}`;

/**
 * A record's blow fields onto a puppet's `ai` (the host's `applyPuppetRecord` / `applyFoeRecord`): `origin` the record's
 * `wo` already in this frame (the host projects it - null when the record has none), `me` whether the blow is at me,
 * `entity` the puppet's (its stagger and overreach, for my rolls), `collider` the ground it is fitted to. A blow is known
 * by its serial (`wn`): the same one turns (a lunge's tracking); its owner's LANDING lands it here at once (my clock
 * behind its owner's); another serial lands the live one first (its owner's chain - the one before it landed there);
 * the same serial again after it landed here (my clock ahead) is nothing new. A record without `wk` before the landing:
 * an overreach lands it (it follows a landing only), a feint's cut dashes its mark, anything else is a break (its held
 * arm cancelled); at or past the landing it lands on its own clock. FEUD WIRE: `sig` the host's signature numbers
 * (systems/revenantFeud.js SIG - the brain brings no revenant system): a blow its owner flags one strikes at its
 * multiplier, in its ember, its WIND deeper. Answers the synthetic state.
 */
export function applyBlowRecord(ai, r, { origin = null, me = false, entity = null, collider = null, now = tacticsNow(), sig = null } = {}) {
  if (!ai || !r) return null;
  if (ai._tac && !ai._tac.puppet) releaseTactics(ai);   // AUDIT TELL O4: a brain that was mine (a seat handed back) gives up its tokens
  const s = ai._tac?.puppet ? ai._tac : (ai._tac = { puppet: true, state: 'engage', blow: null, key: null, seen: now, cancel: false, landed: null, wn: null, feet: null });
  s.seen = now;
  const kind = Number.isInteger(r.wk) ? WIRE_KINDS[r.wk & 7] : null;
  const live = s.state === 'windup' ? s.blow : null;
  if (kind && origin && Number.isFinite(r.wy) && Number.isFinite(r.wl)) {
    const landedThere = (r.wk & WIRE_LANDED) !== 0, n = Number.isInteger(r.wn) ? r.wn : null;
    if (live && live.n === n) {
      if (landedThere) landPuppetBlow(ai, s, live, now);   // its owner's landing reached me before my clock did
      else if (live.yaw !== r.wy) { live.yaw = r.wy; fitBlowToGround(live, collider); }   // a lunge's tracking, turned on its owner's
    } else {
      if (live) landPuppetBlow(ai, s, live, now);   // its owner is on another blow: this one landed there
      if (!landedThere && n !== s.wn) {
        const iron = (r.wk & WIRE_IRON) !== 0, feint = (r.wk & WIRE_FEINT) !== 0, signature = (r.wk & WIRE_SIG) !== 0 && !!sig;
        const left = Math.max(0.001, r.wl / 1000);
        const total = Math.max(BLOW[kind].windup + (iron ? TELL_IRON_EXTRA : 0), left);   // the shape's nominal length: a late record starts part-filled
        const b = makeBlow(kind, origin, r.wy, now + left - total, signature ? sig.COLOR : iron ? IRON_COLOR : BLOW_COLOR, iron ? 'iron' : 'poise', total);
        b.n = n;
        if (signature) { b.sig = true; b.mult = sig.MULT; b.windPitch = sig.WIND_PITCH; }   // FEUD WIRE: its owner's signature - x2.0 on my feet as on its owner's
        if (feint) b.feint = true;   // a feint never glints (the glint is the honest tell)
        if (Number.isFinite(r.wp)) b.ahead = r.wp;
        fitBlowToGround(b, collider);
        setLiveBlow(ai, b);
        s.blow = b; s.state = 'windup'; s.cancel = false; s.wn = n;
        s.key = me ? LOCAL_TARGET : null;
        ai._blowLandedAt = null; ai._perfectAt = null;
      }
    }
  } else if (live && now < live.land - 0.05) {
    if (r.ws === 2) landPuppetBlow(ai, s, live, now);   // an overreach follows a landing alone - it landed there
    else {
      if (live.feint) live.cut = now;   // its owner cut it: the plain swing goes on (the held arm released), the mark dashes out
      else { if (r.ws === 1) shatterBlow(ai, now); else setLiveBlow(ai, null); s.cancel = true; }   // broken - a stagger, a knock, a paralysis, a turn: the held arm drops; AUDIT TELL (3.2): one its owner staggered shatters here too
      s.blow = null; s.state = 'engage'; s.key = null;
    }
  }   // at or past its landing with the field gone: it lands on its own clock (puppetBlowTurn)
  // the stagger and the overreach - the puppet's pose and my rolls' fold (x1.25, x1.3)
  if (r.ws === 1) { if (s.state !== 'windup') s.state = 'staggered'; if (entity) { entity.staggerUntil = PUPPET_HELD_UNTIL; entity.overreachUntil = 0; } }
  else if (r.ws === 2) { if (s.state !== 'windup') s.state = 'overreach'; if (entity) { entity.overreachUntil = PUPPET_HELD_UNTIL; entity.staggerUntil = 0; } }
  else {
    if (s.state === 'staggered' || s.state === 'overreach') s.state = 'engage';
    if (entity) { if (entity.staggerUntil === PUPPET_HELD_UNTIL) entity.staggerUntil = 0; if (entity.overreachUntil === PUPPET_HELD_UNTIL) entity.overreachUntil = 0; }
  }
  return s;
}

/** A puppet's blow lands now - AT ME judged on my `feet` (the last frame's when its owner's word lands it between
 *  frames): the verdict, the weight, the effect, a perfect dodge (inside at the late sample, out at the landing). Its
 *  mark flashes from now. */
function landPuppetBlow(ai, s, b, now, feet = s.feet) {
  ai._blowLandedAt = now;   // the LAND cue's (tellCues)
  const mine = s.key === LOCAL_TARGET && !!feet && b.kind !== 'aimed';   // an aimed shot's arrow is its owner's to loose
  if (mine) {
    const v = inBlow(b, feet[0], feet[2]);
    ai._blowVerdict = v; ai._blowMult = b.mult; ai._blowAt = now; ai._blowSwing = true;
    ai._blowFx = v ? { kind: b.kind, iron: b.guard === 'iron', at: now } : null;   // TELL6e: on MY machine, where its damage lands
    if (!v && b.lateIn === true) ai._perfectAt = now;
  }
  if (b.land > now) b.land = now;   // landed on its owner's word: the flash is now
  s.landed = { kind: b.kind, at: now, mine, used: false };
  s.blow = null; s.state = 'engage';
}

/**
 * A puppet's frame (the host's puppet loop, every frame): its state kept seen (so the ground keeps its mark), my `feet`
 * kept for a landing its owner's word brings between frames, and its landing on its own clock. Answers what its sprite
 * does: `hold` (true its held arm through the wind-up, 'cancel' once for a broken one, 'spent' through an overreach,
 * else false) and `staggered` (its Hurt held).
 */
export function puppetBlowTurn(ai, feet = null, now = tacticsNow()) {
  const s = ai?._tac;
  if (!s?.puppet) return { hold: false, staggered: false };
  s.seen = now;
  if (feet) s.feet = feet;
  /** @type {boolean | 'cancel' | 'spent'} */
  let hold = false;
  const b = s.state === 'windup' ? s.blow : null;
  if (b) {
    if (now < b.land) {
      hold = b.kind !== 'aimed';
      if (s.key === LOCAL_TARGET && feet && b.kind !== 'aimed' && b.lateIn == null && now >= b.land - TELL.TELL_LATE) b.lateIn = inBlow(b, feet[0], feet[2]);
    } else landPuppetBlow(ai, s, b, now, feet);
  } else if (s.cancel) { s.cancel = false; hold = 'cancel'; }
  else if (s.state === 'overreach') hold = 'spent';
  ai._blowHold = hold === 'cancel' ? false : hold;   // the cues read it as a local foe's
  return { hold, staggered: s.state === 'staggered' };
}

/** Did this puppet's gap-closer (a charge, a leap) land AT ME on its owner's word inside a verdict's life? Its run or
 *  its jump carried it farther than a walk could - the host's leap gate lets that one blow through, once (AUDIT TELL O6:
 *  not a charge at anyone, not twice). */
export function puppetGapLanded(ai, now = tacticsNow()) {
  const l = ai?._tac?.puppet ? ai._tac.landed : null;
  if (!l || !l.mine || l.used || (l.kind !== 'charge' && l.kind !== 'leap') || now - l.at > BLOW_VERDICT_LIFE) return false;
  l.used = true;
  return true;
}

/** 10.4: my blow on a foe winding up, as its class for its owner's meter - `{ k, back, weak }` (K by its kind and
 *  weapon, the door's `opts`; from behind its facing, judged from `from`, my feet; its weakness, RVN3's) - or null when
 *  it is not winding up (no class to weigh). AUDIT FEUD: a blow of its WEAKNESS rides whether or not it winds up (no
 *  facing to be behind) - its owner's reveal reads it (RVN13, Feud-Arc.md 25). */
export function blowClassOf(ai, { kind = 'melee', weapon = null, claws = false, round = false } = {}, from = null, weak = false) {
  const s = ai?._tac, b = s?.state === 'windup' ? s.blow : null;
  if (!b) return weak ? { k: blowK({ kind, weapon, claws, round }), back: false, weak: true } : null;
  return { k: blowK({ kind, weapon, claws, round }), back: behind(b.origin, b.yaw, from), weak: !!weak };
}

/** Tests: the live blows a puppet holds. */
export const puppetBlow = (ai) => (ai?._tac?.puppet ? liveBlows().get(ai) ?? null : null);
