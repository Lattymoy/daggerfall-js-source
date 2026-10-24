// @ts-check
// WB14a (2026-10-19, Mac: "More diabolical boss movesets"; bible/11-Multiplayer/Breach-Portents.md section 3): THE
// WARDEN'S NEW ARSENAL ON MY SCREEN - the blows that strike by WHO they mark (the Chains, the Brand, the Torment) and the
// one that strikes by where I LOOK (the Gaze), judged on my own machine as every blow of his is (co-op's law, World-Bosses.md
// section 5): the relay says who is marked (the atk word's `pk`, peer ids, beside where each stood - `tg`), and this
// screen weighs its own feet against where it sees the others now (the online frame's own places - scenes/gate/gateCourt.js
// stepsIn). The Wheel and the Unmaking are ground, and the court's own verdict judges them (net/gate/gateStrike.js
// strikeVerdict).
//
//   the Chains   marked me: inside CHAIN_HOLD_M of him as it lands, struck and reeled to his feet (the motor's blow push)
//   the Brand    marked me: its own share; within its reach of ANOTHER branded fighter: its burst
//   the Torment  inside its ring: its blow shared among everyone this screen sees inside it, me among them
//   the Gaze     my view holding him as it lands: struck, and blinded GAZE_BLIND_MS (ui/gate/gateGroundView.js)
//
// Each says the one thing to do while it winds up, under the crosshair (`order` - the ground view's warning, its arrow the
// way out or the way to turn): never in the chat, which keeps the gate's moments (WB13b).
//
// Not a DFU member. Ledger A (WB).
import { ATTACK_BY_ID, ATTACKS, windupOf } from '../../net/gate/gateBrain.js';
import { markedAt, markedMe, markedOf, chainHolds, chainPull, brandOn, tormentShare, gazeHolds, markedVerdict, isMarkedBlow, blowOf } from '../../net/gate/gateStrike.js';
import { t } from '../../systems/textManager.js';

/** The orders under the crosshair - each the one thing to do. */
export const ARSENAL_TEXT = Object.freeze({
  chained: () => t('gate.arsenal.chained', 'Chained! Run from him!'),
  branded: () => t('gate.arsenal.branded', 'Dagon\'s Brand is on you. Keep clear of the others!'),
  nearBrand: () => t('gate.arsenal.nearBrand', 'Dagon\'s Brand! Keep clear!'),
  tormentMe: () => t('gate.arsenal.tormentMe', 'Shared Torment on you. Gather the others!'),
  tormentOther: (name) => t('gate.arsenal.tormentOther', 'Shared Torment! Stand with {name}!', { name }),
  tormentAnon: () => t('gate.arsenal.tormentAnon', 'Shared Torment! Stand in the gold!'),
  gaze: () => t('gate.arsenal.gaze', 'Look away!'),
});
/** The Gaze's rim - white, as his eyes. */
export const GAZE_COLOR = Object.freeze([1.0, 0.97, 0.9]);
/** The Torment's rim - its ring's gold. */
export const TORMENT_RIM = Object.freeze([1.0, 0.82, 0.3]);
/** The Chains' rim past the break - the telegraph's safe edge. */
export const CHAIN_FREE_RIM = Object.freeze([0.72, 0.95, 1.0]);
/** A blow's last moment (render/gate/gateTelegraph.js TELEGRAPH_NOW_MS's). */
const NOW_MS = 180;
const NONE = Object.freeze([]);

/** WB14a: THE HOST'S SEAMS FOR THE ARSENAL, made here so the host wires them in one entry (HOST-SPLIT): my peer id
 *  off the online link (`online` read at each ask - it is made after the court), my body's push (the motor's blow push,
 *  the Chains' reel) and its decay (player/motor.js BLOW_PUSH_DECAY, handed in - the motor is not this module's import). */
export function arsenalSeams(motor, online, pullDecay) {
  return { myId: () => online()?.id ?? null, pull: (vx, vz) => motor.blowPush(vx, vz), pullDecay };
}

/**
 * @param {{ me: () => (string|null), placeOf: (id: string) => (number[]|null), nameOf?: (id: string) => (string|null),
 *   others: () => ReadonlyArray<number[]>, land: (atk: any, P: any, so: any) => void, pull?: (vx: number, vz: number) => void,
 *   pullDecay?: number, sting?: (atk: any) => void, watching?: () => boolean }} deps
 *   `me` my peer id; `placeOf` another's place on my screen (the court's frame) by peer id; `nameOf` their name; `others`
 *   every other fighter's place; `land` the court's strike on me; `pull` my body pushed (the motor's blow push, metres a
 *   second in the court's frame) against its `pullDecay`; `sting` a blow named me, as it is called; `watching` whether I
 *   only watch the fight (COURT-WATCH - AUDIT WB14 SCREEN-5: no blow of theirs is mine, the Gaze's blinding and its order
 *   none of them).
 */
export function createGateArsenal({ me, placeOf, nameOf = () => null, others, land, pull = () => {}, pullDecay = 0, sting = () => {}, watching = () => false }) {
  // AUDIT WB14 (SCREEN-9): an attack is its number AND its moment (AUDIT WB B4's law - a room woken from its checkpoint
  // numbers again: the court's own noMark / marked / setMark)
  const judged = { i: -1, at: NaN }, stung = { i: -1, at: NaN };
  const marked = (m, atk) => m.i === atk.i && m.at === atk.at, setMark = (m, atk) => { m.i = atk.i; m.at = atk.at; };
  let blindAt = -Infinity;
  /** Where the k-th marked of `atk` stands on my screen, `mine` my feet. */
  const at = (atk, k, mine) => markedAt(atk, k, me(), mine, placeOf);

  /** At the landing: the blow weighed on me, once an attack. `mine` my feet (the court's frame), `yaw` my camera's. */
  function judge(s, now, P, mine, yaw, standing) {
    const atk = s?.atk, A = atk ? ATTACK_BY_ID[atk.a] : null;
    if (!A || !isMarkedBlow(A) || marked(judged, atk)) return;
    const v = markedVerdict(atk, now);
    if (v === 'wait') return;
    setMark(judged, atk);
    if (v !== 'judge' || !standing || !mine || watching()) return;
    const [px, pz] = mine, L = P.atk[A.key], so = blowOf(atk, P);
    if (A === ATTACKS.chains) {
      if (!markedMe(atk, me()) || !chainHolds(atk, px, pz)) return;
      land(atk, P, so);
      const v2 = chainPull(atk, px, pz, pullDecay);
      if (v2) pull(v2[0], v2[1]);
    } else if (A === ATTACKS.brand) {
      const b = brandOn(atk, me(), px, pz, placeOf, P);
      if (b.self) land(atk, P, { ...so, pct: ATTACKS.brand.selfPct * P.dmgX, base: ATTACKS.brand.selfBase * P.dmgX });
      if (b.burst) land(atk, P, so);
    } else if (A === ATTACKS.torment) {
      const k = tormentShare(atk, me(), px, pz, placeOf, others(), P);
      if (k > 0) land(atk, P, { ...so, pct: L.pct / k, base: L.base / k });
    } else if (A === ATTACKS.gaze) {
      if (gazeHolds(atk.x, atk.z, px, pz, yaw)) { land(atk, P, so); blindAt = now; }
    }
  }

  /**
   * While one of them winds up: the order under the crosshair for me, or null - its name, its wind-up's share `t`, its last
   * moment `now`, the rim's colour, the order itself and the way out (`dir`, the court's frame: away from him for the Chains
   * and the Gaze, away from the nearest other for the branded, toward the marked for the Torment's others). Pure but for
   * the sting, once an attack that names me.
   */
  function order(s, now, P, mine, yaw) {
    const atk = s?.atk, A = atk ? ATTACK_BY_ID[atk.a] : null;
    if (!A || !isMarkedBlow(A) || !mine || !Number.isFinite(atk.at) || s.fell || s.wrath != null || watching()) return null;
    const w = windupOf(A, s.phase);
    if (!(now >= atk.at - w && now < atk.at)) return null;
    const share = w > 0 ? Math.max(0, Math.min(1, (now - (atk.at - w)) / w)) : 1, last = atk.at - now <= NOW_MS;
    const [px, pz] = mine, id = me(), mineMarked = markedMe(atk, id);
    if (mineMarked && !marked(stung, atk)) { setMark(stung, atk); sting(atk); }
    const name = P.atk[A.key].name;
    const from = (x, z) => [px - x, pz - z];
    if (A === ATTACKS.chains) {
      if (!mineMarked) return null;
      const held = chainHolds(atk, px, pz);
      return { name, t: share, now: last, color: held ? null : CHAIN_FREE_RIM, order: ARSENAL_TEXT.chained(), dir: from(atk.x, atk.z), free: !held };
    }
    if (A === ATTACKS.brand) {
      const r = P.atk.brand.r;
      if (mineMarked) {
        let near = null, nd = Infinity;
        for (const o of others() ?? NONE) { const d = Math.hypot(o[0] - px, o[1] - pz); if (d < nd) { nd = d; near = o; } }
        return { name, t: share, now: last, color: null, order: ARSENAL_TEXT.branded(), dir: near && nd <= r + 2 ? from(near[0], near[1]) : null };
      }
      const pk = markedOf(atk), n = Math.max(pk.length, atk.tg?.length ?? 0);
      for (let k = 0; k < n; k++) {
        const p = at(atk, k, null);
        if (p && Math.hypot(px - p[0], pz - p[1]) <= r) return { name, t: share, now: last, color: null, order: ARSENAL_TEXT.nearBrand(), dir: from(p[0], p[1]) };
      }
      return null;
    }
    if (A === ATTACKS.torment) {
      if (mineMarked) return { name, t: share, now: last, color: TORMENT_RIM, order: ARSENAL_TEXT.tormentMe(), dir: null };
      const c = at(atk, 0, null);
      if (!c) return null;
      const who = markedOf(atk)[0] ? nameOf(markedOf(atk)[0]) : null;
      const inside = Math.hypot(px - c[0], pz - c[1]) <= P.atk.torment.r;
      return { name, t: share, now: last, color: TORMENT_RIM, order: who ? ARSENAL_TEXT.tormentOther(who) : ARSENAL_TEXT.tormentAnon(), dir: inside ? null : [c[0] - px, c[1] - pz] };
    }
    if (A === ATTACKS.gaze) {
      const looking = gazeHolds(atk.x, atk.z, px, pz, yaw);
      return { name, t: share, now: last, color: GAZE_COLOR, order: ARSENAL_TEXT.gaze(), dir: looking ? from(atk.x, atk.z) : null };
    }
    return null;
  }

  return {
    judge, order, at,
    /** When the Gaze last blinded me (the court's clock). */
    blindAt: () => blindAt,
    /** A new fight, or out of the court. */
    reset() { judged.i = -1; judged.at = NaN; stung.i = -1; stung.at = NaN; blindAt = -Infinity; },
  };
}
