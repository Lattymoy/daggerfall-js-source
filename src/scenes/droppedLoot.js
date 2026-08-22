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
// P2-slice (AUDIT 23 items-2) retired the flags that stood here:
// world piles now ride the F9/F11 envelope (snapshotWorld/
// restoreWorld, NATIVE coordinates) and die WITH their pixel
// (collectPixel = the reference's mid-session collection sweep).
// The dungeon host rides piles through collectWorld/applyWorld
// via restorePiles below (AUDIT 23).

import { FlatAnimator, armFlatAnim } from '../render/flatAnimation.js';   // FA1 slice 3
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
  const flatAnims = new FlatAnimator();   // FA1 slice 3: the rule lives in ONE place
  let _nextId = 0;   // AUDIT 17e F28: stable ids - keys must survive releaseEmptied's splice
  const roll = pick ?? (() => Math.floor(Math.random() * RANDOM_TREASURE_ICONS.length));

  /** The flat mounts when the archive's record is warm (the
   *  corpse-batch shape); shared by drop and restore. */
  function mount(pile) {
    getTexture(RANDOM_TREASURE_ARCHIVE).then((t) => {
      // AUDIT 24 (the seven-slice sweep): the pile can be removed while
      // this texture is in flight - collectPixel with its map pixel,
      // releaseEmptied when the loot window closes, or either restore
      // clearing the set. Every one of those guards on `p.batch`,
      // which is still null for the whole of this window, so all four
      // free nothing and splice the pile away - and then this
      // continuation mints a batch onto an orphan that nothing holds.
      // The dungeon's missile mount has carried exactly this check
      // since its own audit; retire() marks, the continuation reads.
      if (pile.dead) return;
      uploadRecordFrame(RANDOM_TREASURE_ARCHIVE, pile.record, 0);
      const size = scaledBillboardSize(t.getSize(pile.record), t.getScale(pile.record));
      pile.size = size;   // AUDIT 17e F23: kept so a recenter can rebuild
      // FA1 slice 3: the record is BARE and the frame is a field, so
      // the draw builds `record#frame` the one way. Hand-writing the
      // `#0` into the record was why these sites could not be armed at
      // slice 2 - a frame index appended to a record that already ends
      // in one reads `5#0#2`.
      pile.batch = renderer.createBillboardBatch(RANDOM_TREASURE_ARCHIVE, pile.record, size, [[pile.pos[0], pile.pos[1], pile.pos[2]]]);
      pile.batch.frame = 0;
      armFlatAnim(pile.batch, t, RANDOM_TREASURE_ARCHIVE, pile.record, flatAnims, uploadRecordFrame);
    }).catch(() => {});
  }

  /** Drop items as a pile at the player's feet. P2-slice (items-2):
   *  pixelKey is the map pixel the pile lives on - the reference's
   *  LooseObjectDesc stores exactly this pair at track time
   *  (StreamingWorld.TrackLooseObject :465-476) so the range sweep
   *  can find it later. Hosts without pixels (the dungeon) pass
   *  nothing. */
  function dropPile(items, feet, pixelKey = null) {
    if (!items?.length) return null;
    const record = RANDOM_TREASURE_ICONS[roll()];
    const pile = { id: ++_nextId, items, pos: [feet[0], feet[1], feet[2]], record, batch: null, pixelKey };
    piles.push(pile);
    mount(pile);
    return pile;
  }

  /** P2-slice (items-2) - CollectLooseObjects (StreamingWorld.cs
   *  :1040-1052): a loose pile whose pixel leaves the streamed range
   *  is DESTROYED mid-session - object and record both - and only a
   *  save's serialized state can bring it back. The world host calls
   *  this from its pixel teardown, so a pile dies WITH its pixel. */
  function collectPixel(pixelKey) {
    for (let i = piles.length - 1; i >= 0; i--) {
      const p = piles[i];
      if (p.pixelKey !== pixelKey) continue;
      p.dead = true;   // AUDIT 24: an in-flight mount must not publish onto this
      if (p.batch) { flatAnims.remove(p.batch); renderer.destroyBillboardBatch(p.batch); }   // FA1: the clock goes with the batch
      piles.splice(i, 1);
    }
  }

  /** P2-slice (items-2): the world-save halves. The reference
   *  serialises loose containers everywhere (LootContainerData_v1:
   *  position, icon, items); the world host stores NATIVE coordinates
   *  so a pile survives every floating-origin recenter - the same
   *  law the player half of the envelope rides. */
  function snapshotWorld(toNative) {
    return piles.filter((p) => p.items.length).map((p) => {
      const wc = toNative(p.pos);
      return { nativeX: wc.x, nativeZ: wc.z, y: p.pos[1], record: p.record, pixelKey: p.pixelKey ?? null, items: p.items.map((it) => ({ ...it })) };
    });
  }
  function restoreWorld(saved, fromNative, yOffset = 0) {
    for (const p of piles) { p.dead = true; if (p.batch) renderer.destroyBillboardBatch(p.batch); }   // AUDIT 24: mark first - an in-flight mount reads it
    piles.length = 0;
    for (const s of saved ?? []) {
      if (!s.items?.length) continue;
      const [lx, lz] = fromNative(s.nativeX, s.nativeZ);
      const pile = { id: ++_nextId, items: s.items.map((it) => ({ ...it })), pos: [lx, s.y + yOffset, lz], record: s.record, batch: null, pixelKey: s.pixelKey ?? null };
      piles.push(pile);
      mount(pile);
    }
  }

  /** AUDIT 23 (save-load-4): piles ride the world snapshot - pos,
   *  record, items are the container, exactly the trio DFU's
   *  LootContainerData_v1 carries (SerializableGameObject.cs:396-416).
   *  Clears the live set and re-mints each saved pile with its SAVED
   *  record - a restore must not reroll the icon. A snapshot with no
   *  piles clears, matching DFU's rebuild-from-save. */
  function restorePiles(saved) {
    for (const p of piles) { p.dead = true; if (p.batch) renderer.destroyBillboardBatch(p.batch); }   // AUDIT 24: mark first - an in-flight mount reads it
    piles.length = 0;
    for (const s of saved ?? []) {
      if (!s.items?.length) continue;
      const pile = { id: ++_nextId, items: s.items.map((it) => ({ ...it })), pos: [s.pos[0], s.pos[1], s.pos[2]], record: s.record, batch: null };
      piles.push(pile);
      mount(pile);
    }
  }

  // emptied piles vanish (the verbatim removal) - both reads filter
  /** FA1 slice 3: `tick` is separate from `batches` on purpose - a
   *  getter that also advanced a clock would run at whatever rate its
   *  callers happened to ask, and two hosts ask twice in one frame. */
  const tickFlats = (dt) => flatAnims.tick(dt);
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
      p.dead = true;   // AUDIT 24: an in-flight mount must not publish onto this
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
        p.batch = renderer.createBillboardBatch(RANDOM_TREASURE_ARCHIVE, p.record, p.size, [[p.pos[0], p.pos[1], p.pos[2]]]);
        p.batch.frame = 0;
      }
    }
  }

  return { dropPile, restorePiles, collectPixel, snapshotWorld, restoreWorld, batches, tickFlats, lootTargets, pileFor, releaseEmptied, offsetAll, _piles: piles };
}
