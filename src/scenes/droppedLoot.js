// U8e: DROPPED LOOT - the ground pile the inventory's Remove mode
// feeds (DFU GameObjectHelper.CreateDroppedLootContainer +
// DaggerfallInventoryWindow's droppedItems, MIT Daggerfall
// Workshop). Verbatim laws:
// - the pile flat is archive 216 (DaggerfallLootDataTables.
//   randomTreasureArchive) with a RANDOM record from
//   randomTreasureIconIndices (the 20-entry list below), dropped at
//   the ground position below the player;
// - activating a pile opens the inventory window WITH the pile as
//   the remote target (PlayerActivate's default loot handling), so
//   Remove becomes the default action mode (the OnPush law);
// - an EMPTIED container is removed from the world
//   (SerializableLootContainer: Items.Count == 0 ->
//   RemoveLootContainer) - here the flat + target drop out the
//   frame the last item leaves.
// FLAGGED loud: EXTERIOR pile persistence (the save arc snapshots
// only the dungeon world - S12 scope - so ?world/exterior piles
// still vanish on load where DFU serialises loose containers
// everywhere); StreamingWorld.TrackLooseObject across the ?world
// pixel destroy (piles share the corpse-batch frame doctrine).
// The dungeon host rides piles through collectWorld/applyWorld
// via restorePiles below (AUDIT 23).

import { scaledBillboardSize } from '../world/rmbFlats.js';
import { RANDOM_TREASURE_ARCHIVE, RANDOM_TREASURE_ICONS } from '../systems/loot.js';

// AUDIT 17e F34 / ONE DFU MEMBER, ONE EXPORT: this file re-declared
// randomTreasureArchive and randomTreasureIconIndices, regressing the
// single-sourcing the 2026-07-06b audit had already done in
// systems/loot.js. Re-exported so existing importers keep working.
export { RANDOM_TREASURE_ARCHIVE, RANDOM_TREASURE_ICONS };

/** deps = { renderer, getTexture, uploadRecordFrame, pick? } (pick
 *  is the icon roll seam - UnityEngine.Random.Range over the list). */
export function createDroppedLoot({ renderer, getTexture, uploadRecordFrame, pick }) {
  const piles = [];
  let _nextId = 0;   // AUDIT 17e F28: stable ids - keys must survive releaseEmptied's splice
  const roll = pick ?? (() => Math.floor(Math.random() * RANDOM_TREASURE_ICONS.length));

  /** The flat mounts when the archive's record is warm (the
   *  corpse-batch shape); shared by drop and restore. */
  function mount(pile) {
    getTexture(RANDOM_TREASURE_ARCHIVE).then((t) => {
      uploadRecordFrame(RANDOM_TREASURE_ARCHIVE, pile.record, 0);
      const size = scaledBillboardSize(t.getSize(pile.record), t.getScale(pile.record));
      pile.size = size;   // AUDIT 17e F23: kept so a recenter can rebuild
      pile.batch = renderer.createBillboardBatch(RANDOM_TREASURE_ARCHIVE, `${pile.record}#0`, size, [[pile.pos[0], pile.pos[1], pile.pos[2]]]);
    }).catch(() => {});
  }

  /** Drop items as a pile at the player's feet. */
  function dropPile(items, feet) {
    if (!items?.length) return null;
    const record = RANDOM_TREASURE_ICONS[roll()];
    const pile = { id: ++_nextId, items, pos: [feet[0], feet[1], feet[2]], record, batch: null };
    piles.push(pile);
    mount(pile);
    return pile;
  }

  /** AUDIT 23 (save-load-4): piles ride the world snapshot - pos,
   *  record, items are the container, exactly the trio DFU's
   *  LootContainerData_v1 carries (SerializableGameObject.cs:396-416).
   *  Clears the live set and re-mints each saved pile with its SAVED
   *  record - a restore must not reroll the icon. A snapshot with no
   *  piles clears, matching DFU's rebuild-from-save. */
  function restorePiles(saved) {
    for (const p of piles) if (p.batch) renderer.destroyBillboardBatch(p.batch);
    piles.length = 0;
    for (const s of saved ?? []) {
      if (!s.items?.length) continue;
      const pile = { id: ++_nextId, items: s.items.map((it) => ({ ...it })), pos: [s.pos[0], s.pos[1], s.pos[2]], record: s.record, batch: null };
      piles.push(pile);
      mount(pile);
    }
  }

  // emptied piles vanish (the verbatim removal) - both reads filter
  const batches = () => piles.filter((p) => p.items.length && p.batch).map((p) => p.batch);
  function lootTargets() {
    const out = [];
    piles.forEach((p) => {
      if (!p.items.length) return;
      out.push({ key: `droppedLoot:${p.id}`, aabb: { min: [p.pos[0] - 0.5, p.pos[1], p.pos[2] - 0.5], max: [p.pos[0] + 0.5, p.pos[1] + 0.6, p.pos[2] + 0.5] } });
    });
    return out;
  }
  const pileFor = (key) => piles.find((p) => p.id === Number(key.split(':')[1])) ?? null;

  /** AUDIT 17e F28 / EVERY ALLOCATION HAS AN OWNER: an emptied pile
   *  stopped being drawn but kept its GL billboard batch forever, and
   *  the piles array grew without bound. DFU frees the container when
   *  the INVENTORY WINDOW CLOSES (DaggerfallInventoryWindow.cs:697-722
   *  mints/removes there), not the instant the last item leaves - a
   *  pile refilled before closing must keep its flat, or lootTargets
   *  (which gates only on items.length) would offer an invisible
   *  activatable ghost. Hosts call this when a loot window closes. */
  function releaseEmptied() {
    for (let i = piles.length - 1; i >= 0; i--) {
      const p = piles[i];
      if (p.items.length) continue;
      if (p.batch) renderer.destroyBillboardBatch(p.batch);
      piles.splice(i, 1);
    }
  }

  /** AUDIT 17e F23: the ?world floating-origin recenter shifts the
   *  camera and player; ground piles are world-space and must follow
   *  or they drift 819.2 units away from where they were dropped. */
  function offsetAll(offset) {
    const [dx, dy, dz] = offset;
    for (const p of piles) {
      p.pos[0] += dx; p.pos[1] += dy; p.pos[2] += dz;
      // the centers are baked into a STATIC_DRAW buffer - rebuild
      if (p.batch) {
        renderer.destroyBillboardBatch(p.batch);
        p.batch = renderer.createBillboardBatch(RANDOM_TREASURE_ARCHIVE, `${p.record}#0`, p.size, [[p.pos[0], p.pos[1], p.pos[2]]]);
      }
    }
  }

  return { dropPile, restorePiles, batches, lootTargets, pileFor, releaseEmptied, offsetAll, _piles: piles };
}
