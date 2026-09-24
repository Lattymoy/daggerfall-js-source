// RESURRECT1 (2026-09-23, Discord: "Can we create resurrection spells?" - after the Unity co-op's revive, "maybe we
// can use that for healers"). DFU has no raise-dead effect, so this is the port's own: a RESTORATION effect,
// `Resurrect` (45,255 - no classic key uses 45), cast at a FALLEN PARTY MEMBER's body within touch reach. The
// fallen player rises where they fell at RESURRECT_HEALTH_PCT of their health (the Unity co-op's ReviveHealthPercent).
//
// THE ROUTE. A dead player has left the room (AUDIT ONLINE D12), so ALLY-CAST's `cast` frame cannot reach them - but
// they stay on the social hub, and the party pose keeps flowing both ways through the death screen. So the caster's
// party pose carries `rz: {to, at}` for RESURRECT_HOLD_MS, and the fallen player's own client, reading its party's
// poses each frame of the death screen, rises when a NEW `rz` names it. ALLY-CAST's law holds: party members alone,
// and the receiving client decides.
import { buildCustomSpell } from './spellMaker.js';

export const RESURRECT_TYPE = 45;
export const RESURRECT_SUBTYPE = 255;
export const RESURRECT_KEY = '45,255';
export const RESURRECT_HEALTH_PCT = 30;
/** Metres from the eye to the body: a touch, with room for a body lying on the floor below the crosshair. */
export const RESURRECT_REACH = 6;   // RESURRECT3 ("still too hard to hit"): 4.5 -> 6
/** RESURRECT2 ("the aiming at the corpse is off - hard to trigger"): a body LIES - wide and flat on the floor - so it
 *  is aimed at where the crosshair meets the ground, within this many metres of the body's feet... */
export const RESURRECT_GROUND_SLACK = 2.2;   // RESURRECT3: 1.3 -> 2.2
/** ...or by a crosshair passing within this of the body's middle (a body on a ledge, aimed at from below). */
export const RESURRECT_RAY_SLACK = 1.5;   // RESURRECT3: 0.9 -> 1.5
/** RESURRECT3: ...or simply lying roughly where the player faces - within this many degrees of the aim. */
export const RESURRECT_CONE_DEG = 30;

/** RESURRECT2: THE BODY THE CROSSHAIR MEANS - the pick a corpse needs, not a standing person's. `bodies` are the
 *  fallen party members' ({feet}, in the caster's frame); `ground` is the distance along the aim to the floor it
 *  meets (Infinity for none). The nearest match to where the player is looking wins; null for none. */
export function pickFallenBody(eye, dir, bodies, ground = Infinity) {
  const l = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  const d = [dir[0] / l, dir[1] / l, dir[2] / l];
  const g = Number.isFinite(ground) && ground <= RESURRECT_REACH + RESURRECT_GROUND_SLACK
    ? [eye[0] + d[0] * ground, eye[1] + d[1] * ground, eye[2] + d[2] * ground] : null;
  let best = null, bestScore = Infinity;
  for (const b of bodies ?? []) {
    const f = b?.feet;
    if (!f || f.length !== 3) continue;
    const reach = Math.hypot(f[0] - eye[0], f[1] - eye[1], f[2] - eye[2]);
    if (reach > RESURRECT_REACH) continue;
    let score = Infinity;
    if (g && Math.abs(g[1] - f[1]) < 2) {
      const dh = Math.hypot(g[0] - f[0], g[2] - f[2]);
      if (dh <= RESURRECT_GROUND_SLACK) score = dh;
    }
    const m = [f[0], f[1] + 0.3, f[2]];   // the body's middle, a hand above the floor
    const t = (m[0] - eye[0]) * d[0] + (m[1] - eye[1]) * d[1] + (m[2] - eye[2]) * d[2];
    if (t > 0 && (!Number.isFinite(ground) || t <= ground + RESURRECT_RAY_SLACK)) {
      const off = Math.hypot(eye[0] + d[0] * t - m[0], eye[1] + d[1] * t - m[1], eye[2] + d[2] * t - m[2]);
      if (off <= RESURRECT_RAY_SLACK) score = Math.min(score, off);
    }
    // RESURRECT3: the cone - a body in reach, roughly where the player faces, whatever the floor did with the ray
    if (!Number.isFinite(score)) {
      const v = [m[0] - eye[0], m[1] - eye[1], m[2] - eye[2]];
      const vl = Math.hypot(v[0], v[1], v[2]) || 1;
      const cos = (v[0] * d[0] + v[1] * d[1] + v[2] * d[2]) / vl;
      if (cos >= Math.cos(RESURRECT_CONE_DEG * Math.PI / 180)) score = RESURRECT_RAY_SLACK + Math.acos(Math.min(1, cos));   // ranked after any direct hit
    }
    if (score < bestScore) { bestScore = score; best = { ...b, distance: reach }; }
  }
  return best;
}
/** How long the caster's party pose carries the call - several party sends, so one lost frame costs nothing. */
export const RESURRECT_HOLD_MS = 8000;
/** The ready-made spell's index, in the custom (negative) space, fixed so a bought copy keys the same everywhere. */
export const RESURRECTION_SPELL_INDEX = -45001;

export const RESURRECT_TEXT = Object.freeze({
  noBody: 'There is no fallen party member within reach.',
  aim: 'Look at a fallen party member\'s body and cast.',
  cast: (name) => `You call ${name || 'your companion'} back from death.`,
  raised: (name) => `${name || 'A companion'} has brought you back from death.`,
});

/** Does this spell carry the Resurrect effect? */
export const hasResurrect = (sp) => !!sp && Array.isArray(sp.effects) && sp.effects.some((e) => e && e.type === RESURRECT_TYPE);

/** The ready-made spell a temple or the Mages Guild sells online: Resurrect, by touch. */
export function resurrectionSpell() {
  return buildCustomSpell({ slots: [{ type: RESURRECT_TYPE, subType: RESURRECT_SUBTYPE, settings: {} }], rangeType: 1, element: 4,
    name: 'Resurrection', icon: 10, index: RESURRECTION_SPELL_INDEX });
}

/** THE RECEIVER'S TWO HALVES. At the death: what every party member's pose already said (an old call, sent for an
 *  earlier death, is not this one's). Each frame after: the first member whose `rz` names me and differs from it. */
export function rezSnapshot(members) {
  const seen = new Map();
  for (const m of members ?? []) seen.set(m.acct, m?.p?.rz?.at ?? null);
  return seen;
}
export function rezFor(members, myAcct, seen) {
  if (!myAcct || !seen) return null;
  for (const m of members ?? []) {
    const rz = m?.p?.rz;
    if (!rz || rz.to !== myAcct || !Number.isFinite(rz.at)) continue;
    if (seen.get(m.acct) === rz.at) continue;
    return { acct: m.acct, name: m.name ?? null, at: rz.at };
  }
  return null;
}
