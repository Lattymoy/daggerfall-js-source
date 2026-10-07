// @ts-check
// GALLEON (2026-10-01, Mac: "ensuring cannon fire shoots from the cannon holes properly"): THE GUN DECK AT WORK - a
// ship's gunport shutters and the guns behind them, as a broadside is laid and fired.
//
// The new galleon (world/galleonModel.js) carries a gun behind each of her ten ports (`Gun<Side><i>`, its frame's +x
// outboard) and a shutter over each (`Gunport<Side><i>`, an Animator on the mod's Door Controller - Opened swings it up
// on its hinge). This is what moves them, for every ship of hers in play - mine, the sea's, another player's (her lay on
// her word's `g`, navalWire.js - AUDIT GN-G3):
//
//   LAID: a battery laid (my look at the guns, a captain's run-out - navalAI.js, the tell the helm sees) opens that
//     side's shutters and runs its guns out, their muzzles through the ports; and it stays laid HOLD_S after the last
//     word of it, so a ripple's last gun is not run in under the smoke.
//   FIRED: each gun as its ball leaves (navalShots.js's 'muzzle', its index in the battery - HULL_BUILDS' order, the
//     ports' own) kicks back RECOIL m and is hauled out again over HAUL_S - and a side fired is a side laid. AUDIT
//     GN-G2/G3: A BALL LEAVES ONLY THROUGH AN OPEN PORT: a gun fired before it is out (a quick click with no lay before
//     the release, another player's volley read before her lay, a long frame of a fast sea) stands out at its shot and
//     its shutter snaps open - it kicked back from where it stood in, its ball bursting out of a shut port.
//   AT REST: the guns run in to load and the shutters close. AUDIT GN2-GN2: a boat laid or fired is stepped on until
//     she is, whether or not the caller still names her (another player's boat moored out of her helm stood frozen with
//     her guns out and her shutters up); AUDIT GN2-GN5: `clear` stands every one at rest at once (the sea gone).
//
// It reads nothing but node names and moves nothing but those nodes (the gun's local position along its own +x; the
// shutter's Opened), so a hull without them is left alone. Pure but for those nodes: the clock is the caller's.
// Not a DFU member. Ledger A (GALLEON).
import { GUN } from '../../world/galleonModel.js';

/** The ship's two broadsides, as the nodes spell them. */
export const GUN_DECK_SIDES = Object.freeze({ starboard: 'Starboard', port: 'Port' });
/** A battery stays laid this long (s) after its last word - a lay, a run-out, a gun fired. */
export const HOLD_S = 2.5;
/** Where a gun stands along its own +x (m, from her centreline): run in to load, run out to fire (world/galleonModel.js
 *  GUN's - its muzzle a hair outside her planking). SHIPS-2: a gun whose node carries a GunCarriage stands at that
 *  carriage's own `runInX` and `runOutX` (world/carrackModel.js: the new carrack's, on their platforms under her
 *  wider-set ports); a gun with none at these. */
export const RUN_IN_X = GUN.runInX;
export const RUN_OUT_X = GUN.runOutX;
/** How fast a gun is run out and in (m/s) - out in about a second, as the run-out's tell (navalAI.js RUN_OUT_S 1.3). */
export const RUN_SPEED = 0.95;
/** A fired gun's kick back (m), how long the kick takes (s), and how long the crew take to haul it out again (s). */
export const RECOIL = 0.95;
export const KICK_S = 0.12;
export const HAUL_S = 2.2;
/** The Door Controller's open state, which a gun's shutter snaps to as its ball leaves (AUDIT GN-G2). */
const OPENED_STATE = 'Opened';

/** A gun's offset inboard of where it stands, `t` s after it fired: the kick back, then hauled out. */
export function recoilAt(t) {
  if (!(t >= 0)) return 0;
  if (t < KICK_S) return RECOIL * (t / KICK_S);
  const u = Math.min(1, (t - KICK_S) / HAUL_S);
  return RECOIL * (1 - u * u * (3 - 2 * u));
}

/**
 * The gun deck for every ship it is shown: `lay(boat, side, now)`, `fired(boat, side, index, now)`, `step(boats, now)`,
 * `clear()`. Each boat's nodes are found once (by name, under its tree) and kept while its tree is the same.
 */
export function createGalleonGunDeck() {
  /** boat -> { sides: { starboard: rig, port: rig } } (rig: { guns: node[], lids: node[], laidUntil, firedAt: number[] }) */
  const rigs = new WeakMap();
  /** AUDIT GN2-GN2: every boat laid or fired and not yet at rest - each step stands her too, until she is. */
  const settling = new Set();
  let lastNow = 0;
  function rigOf(boat) {
    if (!boat?.GameObject) return null;
    let r = rigs.get(boat);
    if (r && r.root === boat.GameObject) return r.sides ? r : null;
    const found = { starboard: { guns: [], lids: [], laidUntil: -Infinity, firedAt: [], x: [], inX: [], outX: [] }, port: { guns: [], lids: [], laidUntil: -Infinity, firedAt: [], x: [], inX: [], outX: [] } };
    for (const n of boat.GameObject.walk()) {
      const m = /^(Gun|Gunport)(Starboard|Port)(\d+)$/.exec(n.name);
      if (!m) continue;
      const side = m[2] === 'Starboard' ? found.starboard : found.port;
      (m[1] === 'Gun' ? side.guns : side.lids)[Number(m[3])] = n;
    }
    const any = found.starboard.guns.length || found.port.guns.length || found.starboard.lids.length || found.port.lids.length;
    r = { root: boat.GameObject, sides: any ? found : null };
    if (any) for (const s of Object.values(found)) {
      s.firedAt = s.guns.map(() => -Infinity);
      // SHIPS-2: each gun's own stations where its carriage names them
      s.inX = s.guns.map((g) => g?.getComponent?.('GunCarriage')?.runInX ?? RUN_IN_X);
      s.outX = s.guns.map((g) => g?.getComponent?.('GunCarriage')?.runOutX ?? RUN_OUT_X);
      s.x = s.guns.map((g, i) => Math.abs(g?.localPosition?.[0] ?? s.inX[i]));
    }
    rigs.set(boat, r);
    return any ? r : null;
  }
  /** A boat's shutters and guns as `now` stands them, its guns run `dt` on - and whether she is at rest (nothing laid,
   *  every gun run in, no kick left to haul). */
  function stand(r, now, dt) {
    let rest = true;
    for (const [side, s] of Object.entries(r.sides)) {
      const laid = now < s.laidUntil;
      if (laid) rest = false;
      for (const lid of s.lids) {
        const a = lid?.getComponent?.('Animator')?.animator;
        if (a && a.GetBool('Opened') !== laid) a.SetBool('Opened', laid);
      }
      s.guns.forEach((g, i) => {
        if (!g) return;
        const want = laid ? s.outX[i] : s.inX[i];
        const x = s.x[i];
        s.x[i] = x < want ? Math.min(want, x + RUN_SPEED * dt) : Math.max(want, x - RUN_SPEED * dt);
        const kick = recoilAt(now - s.firedAt[i]);
        if (s.x[i] !== s.inX[i] || kick > 0) rest = false;
        const sign = side === 'starboard' ? 1 : -1;
        const at = sign * (s.x[i] - kick);
        if (g.localPosition[0] !== at) g.localPosition = [at, g.localPosition[1], g.localPosition[2]];
      });
    }
    return rest;
  }
  return {
    /** A side laid (or run out) now: its shutters open and its guns run out until HOLD_S past `now`. */
    lay(boat, side, now) {
      const s = rigOf(boat)?.sides?.[side];
      if (s) { s.laidUntil = Math.max(s.laidUntil, now + HOLD_S); settling.add(boat); }
    },
    /** A gun of a side fired now (its index in the battery): it kicks back, and the side is laid. */
    fired(boat, side, index, now) {
      const s = rigOf(boat)?.sides?.[side];
      if (!s) return;
      s.laidUntil = Math.max(s.laidUntil, now + HOLD_S);
      settling.add(boat);
      if (!(index >= 0 && index < s.firedAt.length)) return;
      s.firedAt[index] = now;
      // AUDIT GN-G2/G3: out and open as it fires - the kick starts from the port. AUDIT GN2-PF1: the snap taken at once -
      // her Animators ran this frame before the shot (world.js: csaUpdate's animate and csaPeers.frame, then navalFrame),
      // and a Play left for their next update stood the shutter at 0-27 deg as its ball left
      if (s.x[index] < s.outX[index]) s.x[index] = s.outX[index];
      const a = s.lids[index]?.getComponent?.('Animator')?.animator;
      if (a) { a.SetBool('Opened', true); a.Play(OPENED_STATE); a.update(0); }
    },
    /** Every boat's shutters and guns as `now` stands them - those named, and every one still settling. */
    step(boats, now) {
      // AUDIT GN-G7: the step is the clock's own - a fast sea's long frame (Come Sail Away's time scale, 0.5 s) runs the
      // guns as far as its time does (clamped to 0.25 s, a captain's volley came with them 0.35 m short of the port)
      const dt = Math.max(0, now - lastNow);
      lastNow = now;
      const seen = new Set();
      for (const boat of [...boats, ...settling]) {
        if (seen.has(boat)) continue;
        seen.add(boat);
        const r = rigOf(boat);
        if (!r || stand(r, now, dt)) settling.delete(boat);
      }
    },
    /** AUDIT GN2-GN5: every boat at rest at once - the sea gone (the Naval arc off, a transition), no step to come: no lay
     *  held, no kick, her guns run in and her shutters told to shut (her own Animators close them). */
    clear() {
      for (const boat of settling) {
        const r = rigOf(boat);
        if (!r) continue;
        for (const s of Object.values(r.sides)) { s.laidUntil = -Infinity; s.firedAt.fill(-Infinity); s.x = [...s.inX]; }
        stand(r, lastNow, 0);
      }
      settling.clear();
    },
    /** A probe's reading: a boat's sides as they stand ({ laid, guns: [x...], open: [bool...] }), or null. */
    read(boat, now = lastNow) {
      const r = rigOf(boat);
      if (!r) return null;
      const out = {};
      for (const [side, s] of Object.entries(r.sides)) out[side] = { laid: now < s.laidUntil, guns: s.guns.map((g) => (g ? Math.abs(g.localPosition[0]) : null)), open: s.lids.map((l) => !!l?.getComponent?.('Animator')?.animator?.GetBool('Opened')) };
      return out;
    },
  };
}
