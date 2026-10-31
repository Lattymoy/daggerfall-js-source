// @ts-check
// RAM-RETURN (2026-10-26, the owner: "I would like to reintegrate it in a thoughtful way. The major issue was that you
// could easily instability ships just by ramming"; bible/03-World/Naval-Refit.md RAM-RETURN and its AUDIT) - THE RAMS AT
// SEA, wired by the naval host (scenes/naval/navalHost.js frame, stepSea, applyPeerHit, clear - HOST-SPLIT: the module
// the host wires, as navalHaul.js is) over the ram's own law (systems/naval/navalRam.js: the face, the closing way, the
// blow, the line, the recoil and what pays for it). The port's own - Daggerfall has no sea.
//
//   MY HELM   `helm(boat)`, once a frame on the hulls as that frame poses them (AUDIT NAV1): my stem (the hull's own
//             bowZ) within RAM_REACH of a fighting ship's box, my own way on (RAM_SPEED of it, the most of the last
//             RAM_MEMORY_S - the collider takes it at her planking), at the closing way toward the face it meets. It
//             strikes only a ship that is FAIR GAME (`fair`, the host's: one that would take me or that I have provoked,
//             or one flying no lawful flag) - a lawful ship at peace with me is bumped, never rammed, so a ram is never
//             the first act of fire on her (AUDIT RAM-RETURN A1: a docking bump was piracy). The way is spent on the first
//             ship it strikes; one ram a ship a RAM_COOLDOWN_S. It is an act of fire, and on a ship another player stands
//             it is said to her stander as a ram (`ram` on the wire), hers to take to her own line (`peer`). A booked
//             ship's master never rams (FERRY-CLEAR); a wreck rams nothing.
//   A GALLEY  `galleys()`, each step of the sea's clock: a captain's galley afloat and fighting - engaged on a ship or
//             closing to board her - whose stem is in THAT ship's hull at RAM_SPEED or more of closing way: a boat of mine
//             if it is me she fights (braced, half; the Captain's Due on it), else a ship of my sea. A galley never rams a
//             ship she is not fighting: a bump between friends is a bump.
//
// A ram lands on a FIGHTING ship alone (`fighting`: afloat, not being boarded) - one whose colours are down is the
// grapples' (BOARD-MAGNET), never the stem's - with her line as its floor, and only as hard as the rammer's recoil room
// pays for (navalRam.js ramPaid). A blow of less than a point, or on a hull at its line, is a bump.

import {
  RAM_SPEED,
  RAM_MEMORY_S,
  RAM_COOLDOWN_S,
  ramContact,
  ramClosing,
  ramBlow,
  ramLine,
  ramRoom,
  recoilRoom,
  recoilShare,
  ramPaid,
  ramMen,
  ramMenSaid,
} from '../../systems/naval/navalRam.js';
import { hullBuild, PLAYER_CREW_TOUGHNESS } from '../../systems/naval/navalShips.js';
import { SHIP_STATES, BRACE_TAKEN } from '../../systems/naval/navalDamage.js';
import { forwardOfYaw, velocityOf } from '../../systems/naval/navalAI.js';
import { flatUnit } from '../../systems/naval/navalBallistics.js';
import { navalHitData, NAVAL_HIT_MAX } from '../../systems/naval/navalWire.js';
import { NAVAL_SFX } from '../../systems/naval/navalSounds.js';
import { captainsDue } from '../../systems/sigil/sigilSetPowers.js';
import { quatRotate } from '../../world/quat.js';
import { t } from '../../systems/textManager.js';

/**
 * @param {{ ships: () => Iterable<any>, get: (id: any) => any, myBoats: () => any[], myId: () => string, now: () => number,
 *   seaY: () => number, random: () => number, boatPose: (boat: any) => { position: number[], rotation: number[], velocity: number[] },
 *   hullBox: (boat: any) => any, state: (boat: any) => any, boarding: () => any, called: (e: any) => string,
 *   fair: (e: any) => boolean, strike: (e: any, hurt: any, by: any) => void, sendHit: (data: any) => any, charge: (e: any) => void,
 *   hit: (at: number[], dir: number[]) => void, sound: (key: string, at: number[], vol: number) => void,
 *   shake?: (k: number) => void, mid?: (text: string, s: number) => void, due?: () => { hull: number } }} deps
 */
export function createNavalRams(deps) {
  /** When my stem last struck each ship, and when each galley's ram last struck (the sea's clock). */
  const rammedAt = new WeakMap(),
    galleyAt = new WeakMap();
  /** My boat's way over the last RAM_MEMORY_S - [{ t, v }], `v` her velocity on the flat. */
  let wayIn = [];
  /** SEA-SET: the Captain's Due on a hurt to my ship's hull (systems/sigil/sigilSetPowers.js captainsDue). */
  const due = () => (deps.due ?? captainsDue)().hull;

  /** A ship a ram lands on: afloat, not being boarded. */
  const fighting = (e) =>
    e.ship.damage.state === SHIP_STATES.afloat && !e.ship.boarded && deps.boarding()?.shipId !== e.id;
  /** The blow felt where it lands: the splinters, the crash and - on my deck - the shake. */
  const landed = (at, dir, shake = 0) => {
    deps.hit(at, dir);
    deps.sound(NAVAL_SFX.hit, at, 1);
    if (shake) deps.shake?.(shake);
  };
  /** A captain's galley takes back her `blow`'s recoil - never brought to her own strike by it. */
  const recoil = (e, blow, now) =>
    e.ship.damage.apply(
      { hull: Math.min(Math.round(blow * recoilShare(true)), recoilRoom(e.ship.damage)), sail: 0, crew: 0 },
      now,
    );
  /** A galley's blow as hard as her own recoil room pays for. */
  const galleyBlow = (e, closing, side, hers) =>
    ramPaid(
      ramBlow({ closing, side, mine: e.ship.damage.maxHull, hers, galley: true }),
      recoilRoom(e.ship.damage),
      recoilShare(true),
    );

  /** My helm's ram, on the hulls as this frame poses them. Answers the ship it struck, or null. */
  function helm(boat) {
    if (!boat || boat.charter) {
      wayIn = [];
      return null;
    } // FERRY-CLEAR: a booked ship's master never rams
    const now = deps.now();
    const pose = deps.boatPose(boat);
    const fwd = flatUnit(quatRotate(pose.rotation, [0, 0, 1])) ?? [0, 0, 1];
    wayIn.push({ t: now, v: [pose.velocity[0], 0, pose.velocity[2]] });
    while (wayIn.length && now - wayIn[0].t > RAM_MEMORY_S) wayIn.shift();
    if (!wayIn.some((w) => w.v[0] * fwd[0] + w.v[2] * fwd[2] >= RAM_SPEED)) return null; // my stem driven: my own way on
    const st = deps.state(boat);
    if (st.damage.state !== SHIP_STATES.afloat) return null; // a wreck rams nothing
    const build = hullBuild(boat.hull),
      galley = !!build.ram;
    const stem = [pose.position[0] + fwd[0] * build.bowZ, pose.position[1] + 1, pose.position[2] + fwd[2] * build.bowZ];
    for (const e of deps.ships()) {
      if (!e.boat || !fighting(e) || now - (rammedAt.get(e) ?? -Infinity) < RAM_COOLDOWN_S) continue;
      const box = deps.hullBox(e.boat);
      const at = box ? ramContact(box, stem) : null;
      if (!at || !deps.fair(e)) continue; // AUDIT RAM-RETURN A1: a lawful ship at peace with me is bumped
      const k = recoilShare(galley) * (st.guns.braced ? BRACE_TAKEN : 1) * due(); // what my hull takes back of a point
      const closing = ramClosing(
        wayIn.map((w) => w.v),
        velocityOf(e.ship),
        at.normal,
      );
      const blow = ramPaid(
        ramBlow({ closing, side: at.side, mine: st.damage.maxHull, hers: e.ship.damage.maxHull, galley }),
        recoilRoom(st.damage),
        k,
      );
      if (blow < 1) continue; // a bump
      rammedAt.set(e, now);
      wayIn = []; // the way spent on her
      const dealt = Math.min(blow, ramRoom(e.ship.damage)); // to her line, never under it
      landed(stem, fwd, 3);
      deps.mid?.(
        galley ? t('naval.ram.galley', 'Your ram smashes into the hull!') : t('naval.ram.mine', 'You ram the ship!'),
        2,
      );
      deps.charge(e);
      if (!e.owner)
        deps.strike(
          e,
          { hull: blow, sail: 0, crew: ramMen(dealt, deps.random()), floor: ramLine(e.ship.damage) },
          deps.myId(),
        );
      else
        deps.sendHit(
          navalHitData(e.owner, {
            n: e.n,
            hull: Math.min(NAVAL_HIT_MAX, Math.ceil(dealt)),
            crew: ramMenSaid(dealt),
            zone: 'holed',
            ram: true,
          }),
        ); // her stander's to take, to her line (`peer`)
      st.damage.apply({ hull: Math.min(Math.round(blow * k), recoilRoom(st.damage)), sail: 0, crew: 0 }, now);
      return e;
    }
    return null;
  }

  /** A galley's ram on a boat of mine she fights - braced, half; the Captain's Due on it. Answers whether it struck. */
  function onMine(e, boat, f, bow, now) {
    const s = e.ship,
      st = deps.state(boat);
    const box = deps.hullBox(boat);
    const at = box && st.damage.state === SHIP_STATES.afloat ? ramContact(box, bow) : null; // a wreck of mine is not rammed
    if (!at) return false;
    const pose = deps.boatPose(boat);
    const blow = galleyBlow(
      e,
      ramClosing([velocityOf(s)], [pose.velocity[0], 0, pose.velocity[2]], at.normal),
      at.side,
      st.damage.maxHull,
    );
    const hurt = Math.round(blow * (st.guns.braced ? BRACE_TAKEN : 1) * due());
    const dealt = Math.min(hurt, ramRoom(st.damage));
    if (blow < 1 || !(dealt > 0)) return false; // a bump - or a hull at its line
    galleyAt.set(e, now);
    st.damage.apply({ hull: hurt, sail: 0, crew: ramMen(dealt, deps.random(), PLAYER_CREW_TOUGHNESS) }, now, {
      floor: ramLine(st.damage),
    }); // CREW-HOLD: my boat's crew
    landed(bow, f, 3.5);
    deps.mid?.(t('naval.ram.taken', '{ship} rams you!', { ship: deps.called(e) }), 2);
    recoil(e, blow, now);
    return true;
  }
  /** A galley's ram on a ship of my sea she fights. */
  function onShip(e, x, f, bow, now) {
    const box = deps.hullBox(x.boat);
    const at = box ? ramContact(box, bow) : null;
    if (!at) return;
    const blow = galleyBlow(
      e,
      ramClosing([velocityOf(e.ship)], velocityOf(x.ship), at.normal),
      at.side,
      x.ship.damage.maxHull,
    );
    const dealt = Math.min(blow, ramRoom(x.ship.damage));
    if (blow < 1 || !(dealt > 0)) return;
    galleyAt.set(e, now);
    landed(bow, f);
    deps.strike(x, { hull: blow, sail: 0, crew: ramMen(dealt, deps.random()), floor: ramLine(x.ship.damage) }, e.id);
    recoil(e, blow, now);
  }
  /** Each captain's galley that rams the ship she fights, this step. */
  function galleys() {
    const now = deps.now();
    for (const e of deps.ships()) {
      const s = e.ship;
      if (
        e.owner ||
        !hullBuild(s.hull).ram ||
        s.damage.state !== SHIP_STATES.afloat ||
        s.boarded ||
        s.speed < RAM_SPEED
      )
        continue;
      if ((s.mode !== 'engage' && s.mode !== 'board') || now - (galleyAt.get(e) ?? -Infinity) < RAM_COOLDOWN_S)
        continue;
      const f = forwardOfYaw(s.yaw),
        bowZ = hullBuild(s.hull).bowZ;
      const bow = [s.pos[0] + f[0] * bowZ, deps.seaY() + 1, s.pos[2] + f[2] * bowZ];
      if (s.target === deps.myId()) {
        for (const b of deps.myBoats()) if (onMine(e, b, f, bow, now)) break;
        continue;
      }
      const x = deps.get(s.target);
      if (x?.boat && x !== e && !x.owner && fighting(x)) onShip(e, x, f, bow, now);
    }
  }

  return {
    helm,
    galleys,
    /** AUDIT RAM-RETURN A3: another player's ram on a ship I stand (navalWire.js `ram`) - hers to take to her own line
     *  (the `floor` it lands with), never on a ship that has struck since it was sent. Answers whether it lands. */
    peer(e, hurt) {
      if (!fighting(e)) return false;
      hurt.floor = ramLine(e.ship.damage);
      return true;
    },
    /** The sea cleared (a door, the arc off): my way's memory with it. */
    clear() {
      wayIn = [];
    },
  };
}
