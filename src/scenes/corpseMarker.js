// THE CORPSE MARKER (AUDIT 24, wave 38) - EnemyDeath.CompleteDeath
// (:62-141) + GameObjectHelper.CreateLootableCorpseMarker (:786-841)
// + PlayerActivate's CorpseMarker arm (:926-955), in ONE place.
//
// Both exterior pools minted a corpse inline and IDENTICALLY - the
// second copy of a thing worth writing once - and both copies had
// drifted from the dungeon's in the same three ways:
//
//   - no FindGroundPosition (:817). DFU asks the MOTOR for the ground
//     under the enemy and drops the marker there, so a bat or a
//     harpy killed on the wing leaves its corpse on the floor. The
//     exterior pools used the foe's last feet, so a flyer's corpse
//     hung in the air where it died.
//   - no BodyFall (:126-129). DFU plays SoundClips.BodyFall at the
//     corpse position on EVERY enemy death, in every context. No pool
//     played it, not even the dungeon's.
//   - exteriorFoes had no way to OPEN the corpse at all. The pool
//     rolls the loot table at spawn and equips the foe, then mints a
//     corpse billboard - and exported no activation seam, so every
//     encounter foe's loot and equipment were generated, drawn, and
//     unreachable for the life of the session.
//
// PlayerActivate's own arms are here too, because they are what an
// activation MEANS: an empty corpse says so and is DISABLED (:942-947
// - it does not stay a target), a corpse holding nothing but arrows
// is picked up whole without a window (:948-952), and anything else
// hands its items over.
//
// RESIDUE (honest): DFU's general arm opens the inventory window with
// the corpse as the remote LootTarget (:957). The port transfers the
// lot and reports the count - the pre-existing G3 shape, kept so this
// wave does not smuggle a UI change into a parity fix. Info mode
// ("You see a dead %s") needs an activation mode the hosts do not
// carry yet.

import { floorLanding } from '../player/enterExit.js';
import { scaledBillboardSize } from '../world/rmbFlats.js';
import { addItem } from '../systems/inventory.js';
import { SOUND } from '../systems/soundClips.js';
import { CORPSE_ACTIVATION_DISTANCE } from '../player/activate.js';
import { enemyDisplayName } from '../characters/enemyBasics.js';

/** ItemTemplates Arrow - the auto-pickup arm keys on it. */
export const ARROW_TEMPLATE_INDEX = 131;

/**
 * CreateLootableCorpseMarker's mint. Resolves to the pool's corpse
 * record ({ batch, archive, record, size, pos }) or null when the
 * enemy has no corpse texture, the record is missing, or the foe
 * stopped being dead while the texture warmed.
 *
 * `stillDead` is the SL2 guard the dungeon has carried since its own
 * audit: a backward load can RESURRECT a foe inside this await, and a
 * corpse must never mint for a live one.
 */
export async function mintCorpseMarker({
  renderer, getTexture, uploadRecordFrame, collider = null,
  corpseTexture, feet, fallbackSize = null, stillDead = () => true,
}) {
  if (!corpseTexture) return null;
  const { archive, record } = corpseTexture;
  // FindGroundPosition (:817). Cast from just above the feet so a
  // corpse already resting on the floor is not missed by its own
  // surface; no collider (a test rig, a host without one) leaves the
  // position verbatim rather than inventing a floor.
  const pos = collider
    ? floorLanding(collider, [feet[0], feet[1] + 0.1, feet[2]])
    : [feet[0], feet[1], feet[2]];
  const t = await getTexture(archive);
  if (!t) return null;
  if (t.recordCount != null && record >= t.recordCount) return null;
  if (!stillDead()) return null;
  uploadRecordFrame(archive, record, 0);
  const size = scaledBillboardSize(t.getSize(record), t.getScale(record)) ?? fallbackSize;
  const batch = renderer.createBillboardBatch(archive, record, size, [[pos[0], pos[1], pos[2]]]);
  // FA1 slice 3: a BARE record plus a frame FIELD - the draw builds
  // `record#frame`, so the record must not carry one already.
  batch.frame = 0;
  // AUDIT 17e F23 / THE FOUR HOSTS RULE: the creation params travel
  // with the record, because a floating-origin recenter has to REBUILD
  // the batch (centres are baked into a STATIC_DRAW buffer).
  return { batch, archive, record, size, pos };
}

/**
 * EnemyDeath.cs:79-83 - the kill notice, which the port never showed:
 *
 *     string deathMessage = GetLocalizedText("thingJustDied");
 *     deathMessage = deathMessage.Replace("%s", GetLocalizedEnemyName(...));
 *     if (!Settings.DisableEnemyDeathAlert) PopupMessage(deathMessage);
 *
 * The name is GetLocalizedEnemyName's, which is why wave 38 moved that
 * table down to the leaf. A mobile type with no name in the list says
 * nothing rather than "undefined just died."
 */
export function sayEnemyDied(say, mobileType) {
  const name = enemyDisplayName(mobileType);
  if (!name) return null;
  const line = `${name} just died.`;   // thingJustDied, %s
  say?.(line);
  return line;
}

/** EnemyDeath.cs:126-129 - played at the CORPSE position (the ground
 *  one), not where the enemy was standing. */
export function playBodyFall(audio, pos) {
  audio?.play3d?.(SOUND.BodyFall, [pos[0], pos[1], pos[2]], 1, { maxDistance: 16 });
}

/**
 * The activation targets for a pool's corpses. `entries` is the
 * pool's own list; `isCorpse` says which of them are lootable bodies
 * and `feetOf` where each one lies.
 *
 * An EMPTY corpse is still a target: DFU only tells you the body has
 * no treasure once you have activated it (:942-947). A corpse the
 * player has already emptied has been DISABLED by then and is gone
 * from this list.
 */
export function corpseLootTargets(entries, keyPrefix, { isCorpse, feetOf }) {
  const targets = [];
  entries.forEach((e, i) => {
    if (!isCorpse(e) || e.corpseDisabled) return;
    const p = feetOf(e);
    if (!p) return;
    // PlayerActivate.cs:85/:938 - corpses reach 150 * GlobalScale, not
    // the 128-unit default.
    targets.push({
      key: `${keyPrefix}:${i}`,
      aabb: { min: [p[0] - 0.5, p[1], p[2] - 0.5], max: [p[0] + 0.5, p[1] + 0.6, p[2] + 0.5] },
      distance: CORPSE_ACTIVATION_DISTANCE,
    });
  });
  return targets;
}

/**
 * PlayerActivate's CorpseMarker arm (:936-955). Returns the number of
 * items taken - 0 for an empty body, which is a real outcome and not
 * a failure.
 */
export function takeCorpseLoot(entry, playerEntity, say = () => {}) {
  if (!entry || entry.corpseDisabled) return 0;
  const items = entry.entity?.items;
  // :942-947 - the body has no treasure, and the container is
  // DISABLED: an emptied corpse stops being activatable.
  if (!items?.length) {
    entry.corpseDisabled = true;
    say('The body has no treasure.');   // theBodyHasNoTreasure
    return 0;
  }
  // :948-952 - one item and it is arrows: taken whole, no window.
  // NOTE both taking arms leave the container ENABLED. DFU disables a
  // corpse only on the activation that FINDS it empty (:946), which is
  // the one after this - so the player who loots a body and activates
  // it again is told it has no treasure, and only then does it stop
  // being a target. Disabling on the take would eat that line.
  if (items.length === 1 && items[0]?.templateIndex === ARROW_TEMPLATE_INDEX) {
    playerEntity.items = playerEntity.items || [];
    addItem(playerEntity.items, items[0]);
    items.length = 0;
    say('You collect the arrows.');   // youCollectArrows
    return 1;
  }
  playerEntity.items = playerEntity.items || [];
  let n = 0;
  for (const item of items) { addItem(playerEntity.items, item); n++; }
  items.length = 0;
  say(n === 1 ? 'You take 1 item.' : `You take ${n} items.`);
  return n;
}
