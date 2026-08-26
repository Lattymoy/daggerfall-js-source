// The underwater breath laws (P18, closing the P12 residue): the
// per-classic-update clause of PlayerEntity.FixedUpdate and the guild
// fold its refill runs through. The classic-update cadence and the
// submergence geometry stay host-side (dungeonContext.breathTick -
// both dungeon-mode hosts drive it through dungeonCtx.drawFoes).

import { RACES } from './races.js';
import { maxBreath } from './statMods.js';
import { hasActiveEffect } from './effects.js';
import { templeOf } from './guildVariants.js';

// The one guild whose DeepBreath override is not the identity.
const KYNARETH = templeOf('Kynareth').name;

/** GuildManager.DeepBreath (GuildManager.cs:388-394): the refill runs
 *  the duration through EVERY membership's guild in turn.
 *  Guild.DeepBreath (Guild.cs:246-249) is the identity; the ONE
 *  override is Temple.DeepBreath (Temple.cs:440-448), and only for
 *  Kynareth: (int)(((10f + rank) / 10) * duration). Ported on doubles
 *  + trunc, following the Ledger A FaceUVTool row (DFU-under-Mono
 *  widens float arithmetic to double); the two disagree inside the
 *  fortified-Endurance range - probed rank 0..9 x duration 0..120,
 *  float32 first drifts at rank 4 x 45 (63 vs 62).
 *  Lives here rather than beside the guild code: systems/guilds.js is
 *  mid-flight in a parallel session (2026-08-19), and this is the
 *  member's only export either way. */
export function deepBreath(memberships, duration) {
  let d = duration;
  for (const m of Object.values(memberships ?? {})) {
    if (m.guild === KYNARETH) d = Math.trunc(((10 + m.rank) / 10) * d);
  }
  return d;
}

/** PlayerEntity.FixedUpdate's breath clause (PlayerEntity.cs:322-343),
 *  ONE classic update's worth. While submerged without WaterBreathing:
 *  a dive from empty fills currentBreath through the guild fold
 *  (:326-327 - deepBreath(MaxBreath); `!` also covers old saves where
 *  the field is missing), every 19th classic update drains 1 with the
 *  Argonian coin refund (:330-336 - Races.Argonian is raceId 8, and
 *  UnityEngine.Random.Range(0, 2) == 1 re-adds the point on the same
 *  tick), and breath at 0 returns 'drowned' - SetHealth(0) is the
 *  caller's (:339-340). Surfacing zeroes the counter (:342).
 *  state = { tally } is breathUpdateTally; roll is Range(0, 2),
 *  max-exclusive, injectable for the pins. */
export function breathStep(entity, submerged, state, roll = () => Math.floor(Math.random() * 2)) {
  // PlayerEnterExit.IsPlayerSubmerged, recorded where the host already
  // hands it over. Temple.AvoidDeath (Temple.cs:452) reads that
  // property at the killing blow - a Stendarr member is NOT saved from
  // drowning - and the death door (characters/playerEntity.hurtPlayer)
  // has no geometry of its own to answer it with. It is refreshed on
  // every classic update the breath ticks, which is every update the
  // player is anywhere near water.
  entity.submerged = submerged;
  if (submerged && !hasActiveEffect(entity, 'waterBreathing')) {
    if (!entity.currentBreath) {
      entity.currentBreath = deepBreath(entity.guildMemberships, maxBreath(entity));
    }
    if (state.tally > 18) {
      --entity.currentBreath;
      if (entity.raceId === RACES.Argonian && roll() === 1) ++entity.currentBreath;
      state.tally = 0;
    } else {
      ++state.tally;
    }
    if (entity.currentBreath <= 0) {
      entity.currentBreath = 0;
      return 'drowned';
    }
  } else {
    entity.currentBreath = 0;
  }
  return null;
}
