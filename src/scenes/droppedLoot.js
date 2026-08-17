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
// FLAGGED loud: pile persistence across saves (the quicksave arc
// doesn't carry world loot yet - same standing gap as guard
// corpses); StreamingWorld.TrackLooseObject across the ?world
// pixel destroy (piles share the corpse-batch frame doctrine).

import { scaledBillboardSize } from '../world/rmbFlats.js';

export const RANDOM_TREASURE_ARCHIVE = 216;
// DaggerfallLootDataTables.randomTreasureIconIndices verbatim
export const RANDOM_TREASURE_ICONS = Object.freeze([
  0, 20, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 37, 43, 44, 45, 46, 47,
]);

/** deps = { renderer, getTexture, uploadRecordFrame, pick? } (pick
 *  is the icon roll seam - UnityEngine.Random.Range over the list). */
export function createDroppedLoot({ renderer, getTexture, uploadRecordFrame, pick }) {
  const piles = [];
  const roll = pick ?? (() => Math.floor(Math.random() * RANDOM_TREASURE_ICONS.length));

  /** Drop items as a pile at the player's feet; the flat mounts when
   *  the archive's record is warm (the corpse-batch shape). */
  function dropPile(items, feet) {
    if (!items?.length) return null;
    const record = RANDOM_TREASURE_ICONS[roll()];
    const pile = { items, pos: [feet[0], feet[1], feet[2]], record, batch: null };
    piles.push(pile);
    getTexture(RANDOM_TREASURE_ARCHIVE).then((t) => {
      uploadRecordFrame(RANDOM_TREASURE_ARCHIVE, record, 0);
      const size = scaledBillboardSize(t.getSize(record), t.getScale(record));
      pile.batch = renderer.createBillboardBatch(RANDOM_TREASURE_ARCHIVE, `${record}#0`, size, [[pile.pos[0], pile.pos[1], pile.pos[2]]]);
    }).catch(() => {});
    return pile;
  }

  // emptied piles vanish (the verbatim removal) - both reads filter
  const batches = () => piles.filter((p) => p.items.length && p.batch).map((p) => p.batch);
  function lootTargets() {
    const out = [];
    piles.forEach((p, i) => {
      if (!p.items.length) return;
      out.push({ key: `droppedLoot:${i}`, aabb: { min: [p.pos[0] - 0.5, p.pos[1], p.pos[2] - 0.5], max: [p.pos[0] + 0.5, p.pos[1] + 0.6, p.pos[2] + 0.5] } });
    });
    return out;
  }
  const pileFor = (key) => piles[Number(key.split(':')[1])] ?? null;

  return { dropPile, batches, lootTargets, pileFor, _piles: piles };
}
