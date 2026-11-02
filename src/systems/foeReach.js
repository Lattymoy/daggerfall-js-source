// @ts-check
// WATER-FOES (2026-10-04, from the field: "Enemies in the water on a boat shouldn't slow down your ship or prevent you
// from resting when on board") - A FOE THAT CANNOT REACH THE PLAYER IS NO ENEMY NEARBY. GameManager.AreEnemiesNearby
// (systems/encounters.js areEnemiesNearby) counts a hostile foe that sees the player or stands in the classic spawn
// band - and outdoors that band has no height test (enemyMotor.js wouldBeSpawnedInClassic), so a slaughterfish or a
// dreugh anywhere under the sea within 102.4 m of a boat reset the helm's time scale, stopped a journey, slowed the
// Overworld and refused every rest aboard, though no foe in the water can come up onto a deck (Deep Waters freezes its
// swimmers while the player is on a boat, deepWatersPlayer.js). So, aboard - at a helm, on a deck, another player's or a
// sea ship's - and not swimming, a foe IN THE WATER (an aquatic one, or one whose centre stands under the sea's top) is
// latched `ai.unreachable` each frame by the world host (`markFoeReach`), and the sweep passes it over. Swimming, every
// foe counts as before. A departure from DFU (Port-Ledger A, WATER-FOES): its boats are the mod's, and the C# asks
// AreEnemiesNearby(false, false) at the helm as it does ashore.
//
// Not a DFU member.

/** Whether foe `f` is in the water: an aquatic one (EnemyMotor's `swims` - it lives there), or one whose controller
 *  centre (its feet and `centreOffset`, EnemyMotor.cs's controller.transform.position) stands under `seaY`. */
export function foeInWater(f, seaY) {
  const ai = f?.ai;
  if (!ai) return false;
  if (ai.swims) return true;
  const y = ai.feet?.[1];
  return Number.isFinite(y) && Number.isFinite(seaY) && y + (ai.centreOffset ?? 0) < seaY;
}

/**
 * Latch each foe's reach for this frame: `ai.unreachable` true for a foe in the water while the player is `aboard`
 * (and not swimming - the caller's word), false otherwise. Every pool of the host's street, every frame after the foes
 * moved.
 * @param {Iterable<any>} foes @param {{ aboard: boolean, seaY: number }} at
 */
export function markFoeReach(foes, { aboard, seaY }) {
  for (const f of foes) if (f?.ai) f.ai.unreachable = !!aboard && foeInWater(f, seaY);
}
