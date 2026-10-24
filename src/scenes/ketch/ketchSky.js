// @ts-check
// KETCH (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 2): THE KETCH IN DAGGERFALL'S SKY - what the world outside
// sees of the voyage, on the shared clock alone (net/ketch/ketchLaw.js ketchVoyageAt), so every screen sees one ship in one
// place with nothing said between them:
//
//   SIGHTED  she comes in from the east, a speck KT_SKY.approach metres out and KT_SKY.high over her station, slowing
//            as she nears, her bow west; over the sighting's last share she turns to her station's heading (bow south).
//   DOCKED   she keeps station over the fields outside Daggerfall's east wall (world/ketch/ketchModel.js KT_STATION - the
//            made level draws the city where this draws her), still; her ANCHOR-LIFT is let down on its chain to the
//            fields over KT_SKY.lower, and a body that stands in it KT_BOARD_HOLD_MS rides it up (`onBoard` - the client's).
//            She stands to the world's collider while she keeps station: a body levitated up to her finds her hull.
//   DEPARTING she weighs anchor - the lift drawn up over KT_SKY.lower - turns west over KT_SKY.turnWest, and goes, gaining
//            way and height, over the city and out of sight.
//
// The ship is the made level's own mesh (world/ketch/ketchModel.js buildKetchShip), drawn in the exterior's world pass at
// her place; the lift is world/ketch/ketchModel.js buildKetchAnchorLift's. Pure but for its set (createKetchSky), whose seams
// the client hands in (scenes/ketch/ketchClient.js).
//
// Not a DFU member: Daggerfall has no airship. Ledger A (KETCH).
import { ketchVoyageAt, KT_SIGHT_MS } from '../../net/ketch/ketchLaw.js';
import { KT_ANCHOR_LIFT, deckToDungeon } from '../../net/ketch/ketchDeck.js';
import { buildKetchShip, buildKetchAnchorLift, KT_STATION, KT_SKY_CHAIN, KT_GROUND, KT_LIFT_CROWN } from '../../world/ketch/ketchModel.js';
import { packKetchHit } from '../../world/ketch/ketchKit.js';
import { ketchArtUp } from './ketchDeckHost.js';
import { t } from '../../systems/textManager.js';

/** THE FLIGHT: the deck z she turns about (her middle), how far east and how high over her station she is first seen, the
 *  share of the sighting through which she turns to her heading, how long her lift takes down and up (ms), how long she
 *  turns west (ms), how she gains way (m/s/s) and height (m/s) going, how far from her station she is drawn at all (the
 *  world's far plane). */
export const KT_SKY = Object.freeze({ centre: 118, approach: 6000, high: 90, turnFrom: 0.955, lower: 40_000, turnWest: 60_000, accel: 0.012, climb: 0.05, bob: 0.6, bobMs: 9000, far: 6500 });
/** How long a body stands in the lowered lift before it rises; how near the lift its prompt is said. */
export const KT_BOARD_HOLD_MS = 2500;
export const KT_LIFT_NEAR_M = 14;
/** Her collider's bucket while she keeps station. */
export const KT_SKY_BUCKET = 'kt:sky';
/** The words - each read through the text core when it is said (L10N4). */
export const KT_SKY_TEXT = Object.freeze({
  get near() { return t('ketch.sky.near', 'The anchor-lift hangs from the Ketch. Stand in it to ride it up.'); },
  rising: (s) => t('ketch.sky.rising', 'The anchor-lift rises in {s}...', { s }),
  get up() { return t('ketch.sky.up', 'The anchor-lift is drawn up.'); },
});

const smooth = (k) => { const u = Math.max(0, Math.min(1, k)); return u * u * (3 - 2 * u); };

/**
 * WHERE SHE IS at `now` (relay ms): her middle's offset from her station's (`dx` east, `dy` up, `dz` north - metres), her
 * turn (`yaw` - 0 her station's heading, bow south; PI/2 bow west), her lift let down (`lift`, 0 up to 1 on the fields),
 * whether she moves (`moving`), the voyage - or null: no Ketch in the sky. Pure.
 * @param {number} now
 */
export function ketchSkyPose(now) {
  const v = ketchVoyageAt(now), S = KT_SKY;
  if (v.phase === 'away') return null;
  if (v.phase === 'sighted') {
    const u = Math.max(0, Math.min(1, (now - v.sightAt) / KT_SIGHT_MS)), s = (1 - u) ** 2;
    const bob = S.bob * Math.sin((2 * Math.PI * now) / S.bobMs);
    return { v, phase: v.phase, dx: S.approach * s, dy: S.high * s + bob, dz: 0, yaw: (Math.PI / 2) * (1 - smooth((u - S.turnFrom) / (1 - S.turnFrom))), lift: 0, moving: true };
  }
  if (v.phase === 'docked') return { v, phase: v.phase, dx: 0, dy: 0, dz: 0, yaw: 0, lift: smooth((now - v.at) / S.lower), moving: false };
  const e = now - v.departAt, go = Math.max(0, e - S.lower - S.turnWest) / 1000, dx = -0.5 * S.accel * go * go;
  if (-dx > S.far) return null;
  return { v, phase: v.phase, dx, dy: S.climb * go, dz: 0, yaw: (Math.PI / 2) * smooth((e - S.lower) / S.turnWest), lift: 1 - smooth(e / S.lower), moving: e >= S.lower };
}

/** Her station's middle from the city's centre (scene metres east, north). */
export const KT_STATION_MID = Object.freeze({ x: KT_STATION.x, z: KT_STATION.z + KT_SKY.centre });
/** Where her anchor-lift hangs from the city's centre at her station (scene metres east, north). */
export const KT_LIFT_AT = Object.freeze({ x: KT_STATION.x + KT_ANCHOR_LIFT.x, z: KT_STATION.z + KT_ANCHOR_LIFT.z });

/**
 * Her matrix (column-major, the renderer's) for a pose about `mid` (her middle's scene place at her station, its y her
 * deck's): a model in the dungeon's frame (the made level's - deckToDungeon) to the scene - its deck taken back to the deck's
 * frame, turned about her middle, stood at her place. Pure; `out` written.
 */
export function ketchSkyMatrix(out, mid, pose) {
  const O = deckToDungeon(0, 0, 0), c = Math.cos(pose.yaw), s = Math.sin(pose.yaw);
  const ox = O[0], oy = O[1], oz = O[2] + KT_SKY.centre;   // the model's middle in its own frame
  out.fill(0);
  out[0] = c; out[2] = -s; out[5] = 1; out[8] = s; out[10] = c; out[15] = 1;
  out[12] = mid[0] + pose.dx - (c * ox + s * oz);
  out[13] = mid[1] + pose.dy - oy;
  out[14] = mid[2] + pose.dz - (-s * ox + c * oz);
  return out;
}

/**
 * THE SET: her mesh and her lift drawn where the clock has her, her collider while she keeps station, and the lift's ride.
 * @param {{
 *   renderer?: any, collider?: () => any, city?: () => ([number, number]|null), groundAt?: (x: number, z: number) => number,
 *   frameY?: () => number, now: () => number, feet?: () => (number[]|null), say?: (text: string) => void,
 *   onBoard?: () => void, mayBoard?: () => boolean,
 * }} deps `city` Daggerfall's centre in the scene now (east, north) or null; `groundAt` the terrain under a scene point
 *   (NaN where none streams); `frameY` the scene's vertical shift (its floating frame's); `feet` mine outside, or null
 */
export function createKetchSky({ renderer = null, collider = () => null, city = () => null, groundAt = () => NaN, frameY = () => 0, now, feet = () => null, say = () => {}, onBoard = () => {}, mayBoard = () => true }) {
  let ship = null, lamps = null, lift = null, chain = null, hit = null, built = false;
  /** the fields' height under the lift, less the frame's shift - the terrain's own, found once */
  let groundLocal = null;
  const M = new Float32Array(16), CAGE = new Float32Array(16), CHAIN = new Float32Array(16);
  let colliderAt = null, standAt = -1, nearSaid = false, lastCount = -1, shown = false;
  /** set down in the lift by the way down (or a fall): it rises again only once the body has stepped out of it */
  let needOut = false;
  /** where she stands this frame (null: not in the sky, or no city to stand her by) */
  let place = null;
  function build() {
    if (built || !renderer?.createMesh) return;
    built = true;
    try {
      ketchArtUp(renderer);
      const s = buildKetchShip();
      ship = renderer.createMesh(s.model);
      lamps = renderer.createMesh(s.lamps);   // AUDIT SHIP A4: her lamps' glass from the world too (KETCH-LOOK KL1 took them out of her mesh)
      hit = packKetchHit(s.hit);
      const a = buildKetchAnchorLift();
      lift = renderer.createMesh(a.cage); chain = renderer.createMesh(a.chain);
    } catch (e) { console.warn('[kt] the Ketch would not build in the sky', e?.message ?? e); ship = null; }
  }
  const same = (a, b) => { if (!a || !b) return false; for (let i = 0; i < 16; i++) if (Math.abs(a[i] - b[i]) > 1e-3) return false; return true; };
  function standCollider(want) {
    const col = collider();
    if (!col?.addMesh) return;
    if (want ? same(M, colliderAt) : colliderAt === null) return;
    col.removeBucket?.(KT_SKY_BUCKET);
    colliderAt = null;
    if (!want || !hit) return;
    try { col.addMesh(KT_SKY_BUCKET, hit.positions, hit.indices, M); colliderAt = new Float32Array(M); } catch (e) { console.warn('[kt] her collider', e?.message ?? e); }
  }
  return {
    /** One frame outside: where she is, her collider, the lift's ride. Answers her place (or null). */
    frame() {
      const t = now(), pose = ketchSkyPose(t), c = pose ? city() : null;
      if (!pose || !c) { place = null; standCollider(false); standAt = -1; shown = false; return null; }
      build();
      // the fields under her lift: the terrain's own height (the frame's shift taken off), found once it streams
      const ax = c[0] + KT_LIFT_AT.x, az = c[1] + KT_LIFT_AT.z, fy = frameY();
      if (groundLocal == null) { const g = groundAt(ax, az); if (Number.isFinite(g)) groundLocal = g - fy; }
      const ground = (groundLocal ?? 0) + fy, deck = ground - KT_GROUND.y;
      const mid = [c[0] + KT_STATION_MID.x, deck, c[1] + KT_STATION_MID.z];
      ketchSkyMatrix(M, mid, pose);
      const cageY = ground + (1 - pose.lift) * KT_SKY_CHAIN;
      place = { pose, ground, deck, lift: [ax, cageY, az], let: Math.max(0, deck - (cageY + KT_LIFT_CROWN)), still: !pose.moving && groundLocal != null };
      CAGE.fill(0); CAGE[0] = CAGE[5] = CAGE[10] = CAGE[15] = 1; CAGE[12] = ax; CAGE[13] = cageY; CAGE[14] = az;
      CHAIN.fill(0); CHAIN[0] = CHAIN[10] = CHAIN[15] = 1; CHAIN[5] = place.let; CHAIN[12] = ax; CHAIN[13] = deck; CHAIN[14] = az;
      shown = true;
      standCollider(place.still && pose.phase === 'docked');
      // THE RIDE: a body in the lift let down, still for KT_BOARD_HOLD_MS - up
      const f = feet();
      const lowered = pose.phase === 'docked' && pose.lift >= 0.999 && groundLocal != null;
      const inLift = !!f && lowered && Math.hypot(f[0] - ax, f[2] - az) <= KT_ANCHOR_LIFT.r - 0.2 && Math.abs(f[1] - cageY) <= 1.6;
      const near = !!f && Math.hypot(f[0] - ax, f[2] - az) <= KT_LIFT_NEAR_M;
      if (near && !nearSaid) { nearSaid = true; say(lowered ? KT_SKY_TEXT.near : KT_SKY_TEXT.up); }
      if (!near) nearSaid = false;
      if (needOut && !inLift) needOut = false;
      if (inLift && !needOut && mayBoard()) {
        if (standAt < 0) { standAt = t; lastCount = -1; }
        const left = Math.ceil((KT_BOARD_HOLD_MS - (t - standAt)) / 1000);
        if (left > 0 && left !== lastCount) { lastCount = left; say(KT_SKY_TEXT.rising(left)); }
        if (t - standAt >= KT_BOARD_HOLD_MS) { standAt = -1; needOut = true; onBoard(); }   // asked once (AUDIT KETCH L3-2: a refusal counted down again forever) - out and back in to ask again
      } else standAt = -1;
      return place;
    },
    /** Her and her lift in the exterior's world pass (after the opaque street - the gate's stone's seat). */
    draw(r = renderer) {
      if (!shown || !ship || !place || !r?.drawMesh) return 0;
      r.drawMesh(ship, M, null, { noShadow: true });
      if (lamps) r.drawMesh(lamps, M, null, { noShadow: true });
      if (place.pose.lift > 0.01 && lift && chain) { r.drawMesh(chain, CHAIN, null, { noShadow: true }); r.drawMesh(lift, CAGE, null, { noShadow: true }); }
      return 1;
    },
    /** Where she stands now (the map's, the compass's and the client's read), or null. */
    place: () => place,
    /** A body set down in the lift (the way down, a fall): it rises again only once stepped out of it and back in. */
    hold() { needOut = true; standAt = -1; },
    /** Off the world: her collider taken back. */
    away() { standCollider(false); standAt = -1; shown = false; },
    /** Gone for good: her meshes freed. */
    destroy() {
      standCollider(false);
      for (const m of [ship, lamps, lift, chain]) if (m) { try { renderer?.destroyMesh?.(m); } catch { /* gone */ } }
      ship = lamps = lift = chain = null; built = false; shown = false;
    },
  };
}
