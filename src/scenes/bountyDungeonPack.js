// @ts-check
// BOUNTY1: A BOUNTY'S PACK UNDERGROUND, its lair 25 to 90 metres from the hunter (else the farthest place there is),
// its members stood round it through the dungeon's own chain (spawnLooseFoe, SUMMON-SYNC); a member with no floor near
// is stood on the next visit. FIELD BUGS 29h (BOUNTY-LAIR, "Bounty targets can spawn in inaccessible parts of dungeons"):
// the places are the dungeon's quest spawn markers (199.11), where DFU's Place stands a quest's foe - a foe's own place
// (sealed rooms, water, past held doors) only where it has none. STOREFRONT moved it out of world.js bootWorld
// (HOST-SPLIT). Not a DFU member. Ledger A (BOUNTY1).
import { placeFoeEnv, entityOccupancy } from './quest/questFoeHost.js';
import { placeFoeFreely } from '../systems/quest/sceneMount.js';
import { LOOSE_FOE_PLACE_ATTEMPTS } from './hostEnchant.js';
import { ENEMY_BASICS } from '../characters/enemy/enemyBasics.js';

/** @typedef {{ env: (o: any) => any, occupancy: (feetOf: (f: any) => any, foes: () => any[], at: number[]) => any, freely: (env: any, o: { minDistance: number, maxDistance: number, lineOfSightCheck: boolean }) => any, attempts: number }} PackPlace */
/** DFU's own placement (the tests' seam): the environment, who stands where, and the free spot's search.
 *  @type {PackPlace} */
const PLACE = Object.freeze({ env: placeFoeEnv, occupancy: entityOccupancy, freely: /** @type {any} */ (placeFoeFreely), attempts: LOOSE_FOE_PLACE_ATTEMPTS });

/**
 * Stand a bounty's pack of `count` `mobileType` in the dungeon `pool` (the host's dungeon context, or null), round an
 * anchor chosen from the hunter's `feet`; each member in the camp `newCampId()` numbers. Answers `{ foes, dx, dz }` - the
 * members' promise and the anchor's offset from the feet - or null where nothing could stand.
 * @param {{ pool: any, feet: number[], newCampId: () => number, place?: PackPlace, random?: () => number }} o
 * @param {{ mobileType: number, count: number }} pack
 */
export function standBountyDungeonPack({ pool: d, feet, newCampId, place = PLACE, random = Math.random }, { mobileType, count }) {
  if (!d?.spawnLooseFoe || !d.collider) return null;
  const dist = (p) => Math.hypot(p[0] - feet[0], p[2] - feet[2]);
  const spots = d.questSpawnSpots?.() ?? [];
  const places = spots.length ? spots : (d.foes ?? []).filter((f) => f?.ai?.feet && !f.puppet && f._ownFrom == null).map((f) => f.ai.feet);
  if (!places.length) return null;
  const band = places.filter((p) => { const m = dist(p); return m >= 25 && m <= 90; });
  const at = band.length ? band[Math.floor(random() * band.length)] : places.reduce((a, b) => (dist(b) > dist(a) ? b : a));
  const anchorFeet = [at[0], at[1], at[2]];
  const campId = newCampId();   // OW6 (MERGE 2): the one counter, the pool's - a pack never shares a camp's number
  const stands = [];
  for (let k = 0; k < count; k++) {
    const env = place.env({
      collider: d.collider,
      playerFeet: [anchorFeet[0], anchorFeet[1] + 0.9, anchorFeet[2]],
      playerYawRad: random() * Math.PI * 2,
      fovDegrees: 0,
      isOccupied: place.occupancy((f) => f.ai?.feet ?? f.feet, () => d.foes ?? [], anchorFeet),
    });
    let spot = null;
    for (let i = 0; i < place.attempts && !spot; i++) spot = place.freely(env, { minDistance: 1, maxDistance: 6, lineOfSightCheck: false });
    if (!spot) continue;
    const fly = (ENEMY_BASICS[mobileType]?.behaviour ?? 'General') === 'Flying';
    stands.push(Promise.resolve(d.spawnLooseFoe(mobileType, [spot.x, fly ? spot.y + 1.5 : spot.y, spot.z], { yawRad: random() * Math.PI * 2 })).then((f) => {
      if (f) { f.campId = campId; if (f.entity) f.entity.campId = campId; }
      return f;
    }).catch(() => null));
  }
  if (!stands.length) return null;
  return { foes: Promise.all(stands), dx: anchorFeet[0] - feet[0], dz: anchorFeet[2] - feet[2] };
}
