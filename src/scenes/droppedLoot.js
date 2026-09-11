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
import { CONTAINER_IMAGES } from '../ui/targetIconPanel.js';   // AUDIT 63 F22: InventoryContainerImages, the picture both makers hand CreateLootContainer
import { RAY_DISTANCE, TREASURE_ACTIVATION_DISTANCE } from '../player/activate.js';   // AUDIT 65 MC-2: the ray's reach, the handler's own

// AUDIT 17e F34 / ONE DFU MEMBER, ONE EXPORT: this file re-declared
// randomTreasureArchive and randomTreasureIconIndices, regressing the
// single-sourcing the 2026-07-06b audit had already done in
// systems/loot.js. Re-exported so existing importers keep working.
export { RANDOM_TREASURE_ARCHIVE, RANDOM_TREASURE_ICONS };

/** ROAD-G G5: what a player-dropped pile IS to the inventory window -
 *  DaggerfallLoot's own fields (DaggerfallLoot.cs: playerOwned,
 *  TextureArchive, TextureRecord), which OnPush reads to recover the
 *  icon index (:616-631), UpdateRemoteTargetIcon to draw the flat
 *  (:880-884), CanChangeDropIcon to allow the cycling (:2140-2144) and
 *  OnPop to notice the icon changed (:689-694). `playerOwned` is TRUE
 *  because CreateDroppedLootContainer sets it (GameObjectHelper.cs:766)
 *  and this pool mints nothing else. ONE shape for all four hosts, so
 *  a fifth call site cannot ship a partial identity. */
export const droppedLootHooks = (pile) => ({
  items: () => pile.items,
  // AUDIT 63 F22 (review round): the flag is the CONTAINER's, not the
  // call site's. CreateDroppedLootContainer sets `playerOwned = true`
  // (GameObjectHelper.cs:766); CreateLootContainer (:658-708), which
  // is what AddFlats' RandomTreasure arm calls, never touches it, so
  // a scene-built container keeps DaggerfallLoot.cs:41's `false` and
  // CanChangeDropIcon (:2141-2145) refuses to cycle its picture.
  playerOwned: !pile.container,
  textureArchive: pile.archive,
  textureRecord: pile.record,
  // DaggerfallLoot.cs:37 - `ContainerImage = InventoryContainerImages
  // .Chest` is the field's default AND what both makers pass
  // (GameObjectHelper.cs:754-756, DaggerfallInterior.cs:891-893).
  // UpdateRemoteTargetIcon reads it only in its LAST arm (:885-889),
  // after the target's own world flat (:880-884), so a pile with an
  // archive draws the flat and this is the fallback either maker
  // would have given it.
  containerImage: () => CONTAINER_IMAGES.Chest,
  pos: [...pile.pos],
});

/** OnPop's re-position (:710-714): a container minted to replace a
 *  loot target keeps that target's X and Z and takes only its own Y -
 *  the ground under the player. No target, no move. */
export const containerDropPos = (at, feet) => (at ? [at[0], feet[1], at[2]] : feet);

/** deps = { renderer, getTexture, uploadRecordFrame, pick? } (pick
 *  is the icon roll seam - UnityEngine.Random.Range over the list). */
export function createDroppedLoot({ renderer, getTexture, uploadRecordFrame, pick }) {
  const piles = [];
  const flatAnims = new FlatAnimator();   // FA1 slice 3: the rule lives in ONE place
  let _nextId = 0;   // AUDIT 17e F28: stable ids - keys must survive releaseEmptied's splice
  const roll = pick ?? (() => Math.floor(Math.random() * RANDOM_TREASURE_ICONS.length));

  /** The flat mounts when the archive's record is warm (the
   *  corpse-batch shape); shared by drop and restore. ROAD-G G5: the
   *  ARCHIVE is the pile's own now - a player who cycled the drop icon
   *  onto TEXTURE.204 gets a bundle of clothes on the floor, not a
   *  treasure pile wearing record 3 of the wrong file. */
  function mount(pile) {
    getTexture(pile.archive).then((t) => {
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
      uploadRecordFrame(pile.archive, pile.record, 0);
      const size = scaledBillboardSize(t.getSize(pile.record), t.getScale(pile.record));
      pile.size = size;   // AUDIT 17e F23: kept so a recenter can rebuild
      // FA1 slice 3: the record is BARE and the frame is a field, so
      // the draw builds `record#frame` the one way. Hand-writing the
      // `#0` into the record was why these sites could not be armed at
      // slice 2 - a frame index appended to a record that already ends
      // in one reads `5#0#2`.
      pile.batch = renderer.createBillboardBatch(pile.archive, pile.record, size, [[pile.pos[0], pile.pos[1], pile.pos[2]]]);
      pile.batch.frame = 0;
      armFlatAnim(pile.batch, t, pile.archive, pile.record, flatAnims, uploadRecordFrame);
    }).catch(() => {});
  }

  /** Drop items as a pile at the player's feet. P2-slice (items-2):
   *  pixelKey is the map pixel the pile lives on - the reference's
   *  LooseObjectDesc stores exactly this pair at track time
   *  (StreamingWorld.TrackLooseObject :465-476) so the range sweep
   *  can find it later. Hosts without pixels (the dungeon) pass
   *  nothing. */
  function dropPile(items, feet, pixelKey = null, icon = null) {
    if (!items?.length) return null;
    // ROAD-G G5: CreateDroppedLootContainer's two signatures
    // (GameObjectHelper.cs:717-748) are ONE member with defaults -
    // `iconArchive = randomTreasureArchive, iconRecord = -1` - and
    // "Randomise container texture, if not manually set" is the -1
    // arm. A chosen icon skips the roll; nothing else changes.
    const archive = icon?.archive ?? RANDOM_TREASURE_ARCHIVE;
    const record = icon?.record ?? RANDOM_TREASURE_ICONS[roll()];
    const pile = { id: ++_nextId, items, pos: [feet[0], feet[1], feet[2]], archive, record, batch: null, pixelKey };
    piles.push(pile);
    mount(pile);
    return pile;
  }

  /** AUDIT 63 F22: the SCENE-BUILT container, beside the player's own
   *  pile above. GameObjectHelper.CreateLootContainer
   *  (GameObjectHelper.cs:658-700) is a different member from
   *  CreateDroppedLootContainer: the archive and record are GIVEN (no
   *  icon roll), `playerOwned` is never set so it stays false - which
   *  is why CanChangeDropIcon refuses to cycle its picture - and the
   *  container exists BEFORE anything is generated into it, so an
   *  empty roll still leaves a pile standing (LootTables.GenerateLoot
   *  can add nothing, or return false outright on an out-of-range
   *  location index, and PlayerActivate.cs:957-961 gives RandomTreasure
   *  no special handling either way). `dropPile`'s `!items.length ->
   *  null` guard is CreateDroppedLootContainer's shape and would have
   *  silently mounted nothing here. `key` is the container's identity
   *  across a scene cache - DFU mints a loadID from the building key
   *  and the marker's own coordinates (DaggerfallInterior.cs:885-889)
   *  so a restore applies to the right container and an emptied one,
   *  absent from the cache, is simply rebuilt. */
  function seedPile(items, feet, icon, key = null) {
    const pile = {
      id: ++_nextId, items: items ?? [], pos: [feet[0], feet[1], feet[2]],
      archive: icon.archive, record: icon.record, batch: null, pixelKey: null,
      container: true, containerKey: key,
    };
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
      // G5: `archive` rides beside `record` because DFU's
      // LootContainerData_v1 carries BOTH (textureArchive/textureRecord,
      // SerializableGameObject.cs:396-416) - the pair, never the record
      // alone.
      return { nativeX: wc.x, nativeZ: wc.z, y: p.pos[1], archive: p.archive, record: p.record, pixelKey: p.pixelKey ?? null, items: p.items.map((it) => ({ ...it })) };
    });
  }
  function restoreWorld(saved, fromNative, yOffset = 0) {
    for (const p of piles) { p.dead = true; if (p.batch) renderer.destroyBillboardBatch(p.batch); }   // AUDIT 24: mark first - an in-flight mount reads it
    piles.length = 0;
    for (const s of saved ?? []) {
      if (!s.items?.length) continue;
      const [lx, lz] = fromNative(s.nativeX, s.nativeZ);
      // `?? RANDOM_TREASURE_ARCHIVE` keeps a save written before G5
      // loadable: every pile in one was 216.
      const pile = { id: ++_nextId, items: s.items.map((it) => ({ ...it })), pos: [lx, s.y + yOffset, lz], archive: s.archive ?? RANDOM_TREASURE_ARCHIVE, record: s.record, batch: null, pixelKey: s.pixelKey ?? null };
      piles.push(pile);
      mount(pile);
    }
  }

  /** AUDIT 63 F22 (review round): the WRITE half of the interior
   *  scene cache, beside the read below, because the two must agree on
   *  which piles exist. SerializableLootContainer.GetSaveData
   *  (:55-77) has NO empty guard - every registered container rides
   *  the record whatever it holds - so the filter here is the port's
   *  own owner rule for a player pile (a DroppedLoot container the
   *  window emptied is freed whole, nothing re-mints it) and stops
   *  there: a SCENE-BUILT container is written out empty, which is
   *  what keeps an emptied tavern pile emptied across a re-entry.
   *  G5: the archive travels with the record - LootContainerData_v1
   *  carries the PAIR (SerializableGameObject.cs:396-416) - and the
   *  container's identity travels beside them, DFU's loadID
   *  (DaggerfallInterior.cs:885-889). */
  function snapshotScene() {
    return piles.filter((p) => p.items.length || p.container).map((p) => ({
      pos: [...p.pos], archive: p.archive, record: p.record,
      container: !!p.container, containerKey: p.containerKey ?? null,
      items: p.items.map((it) => ({ ...it })),
    }));
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
      // AUDIT 63 F22 (review round): the EMPTY guard is a player-pile
      // rule and cannot be spent on a scene-built container.
      // SerializableLootContainer.GetSaveData (:55-77) has no empty
      // test at all - every registered container rides the record,
      // whatever it holds - and RestoreSaveData ENDS by removing one
      // that comes back empty (:157-160). Skipping it here instead
      // dropped its identity, and the interior's marker pass, finding
      // no container on that marker, minted a FRESH roll over it: a
      // tavern pile refilled itself every time the player walked back
      // through the door.
      if (!s.items?.length && !s.container) continue;
      // AUDIT 63 F22: a scene-built container keeps its identity and
      // its not-player-owned flag across the cache, so the marker pass
      // can tell a restored pile from one it still owes.
      const pile = { id: ++_nextId, items: s.items?.map((it) => ({ ...it })) ?? [], pos: [s.pos[0], s.pos[1], s.pos[2]], archive: s.archive ?? RANDOM_TREASURE_ARCHIVE, record: s.record, batch: null, container: !!s.container, containerKey: s.containerKey ?? null, inactive: false };
      piles.push(pile);
      // RestoreSaveData:157-160 - `if (loot.Items.Count == 0)
      // RemoveLootContainer(loot)`, which is SetActive(false) for a
      // RandomTreasure (GameObjectHelper.cs:852-864). The object stays
      // in the scene holding its loadID, so it is neither drawn, nor
      // activatable, nor in GetActiveLoot's walk - and the marker pass
      // still sees that this marker is spoken for.
      if (!pile.items.length) { deactivate(pile); continue; }
      mount(pile);
    }
  }

  /** GameObjectHelper.RemoveLootContainer (:852-864): a RandomTreasure
   *  or DroppedLoot container is DEACTIVATED, not destroyed - the
   *  GameObject (and with it the SerializableLootContainer that holds
   *  the loadID) stays in the scene, which is the whole reason an
   *  emptied treasure pile stays emptied across a re-entry. */
  function deactivate(pile) {
    pile.inactive = true;
    if (pile.batch) { flatAnims.remove(pile.batch); renderer.destroyBillboardBatch(pile.batch); }
    pile.batch = null;
  }

  // emptied piles vanish (the verbatim removal) - both reads filter
  /** FA1 slice 3: `tick` is separate from `batches` on purpose - a
   *  getter that also advanced a clock would run at whatever rate its
   *  callers happened to ask, and two hosts ask twice in one frame. */
  const tickFlats = (dt) => flatAnims.tick(dt);
  // AUDIT 63 F22: a scene-built container is drawn and activatable
  // while it is EMPTY - DFU creates it before generating into it and
  // removes it only when the inventory window closes on an emptied
  // target (DaggerfallInventoryWindow.cs:715-722, which releaseEmptied
  // below is). A player-dropped pile has no such state: it is minted
  // from the items it holds.
  const alive = (p) => !p.inactive && (p.items.length > 0 || p.container === true);
  const batches = () => piles.filter((p) => alive(p) && p.batch).map((p) => p.batch);
  // AUDIT 65 MC-2: a pile is a DaggerfallLoot and ActivateLootContainer
  // refuses out loud - `hit.distance > TreasureActivationDistance` ->
  // SetMidScreenText(youAreTooFarAway), PlayerActivate.cs:868-873 -
  // which it can only do if the ray's ONE hit (:314, RayDistance) is
  // allowed to BE the pile. So the target competes at the ray's reach
  // and carries the treasure reach beside it for the ladder to speak.
  function lootTargets() {
    const out = [];
    piles.forEach((p) => {
      if (!alive(p)) return;
      out.push({ key: `droppedLoot:${p.id}`, aabb: { min: [p.pos[0] - 0.5, p.pos[1], p.pos[2] - 0.5], max: [p.pos[0] + 0.5, p.pos[1] + 0.6, p.pos[2] + 0.5] }, distance: RAY_DISTANCE, reach: TREASURE_ACTIVATION_DISTANCE });
    });
    return out;
  }
  const pileFor = (key) => piles.find((p) => p.id === Number(key.split(':')[1]) && alive(p)) ?? null;

  /** ActiveGameObjectDatabase.GetActiveLoot (:266-268) hands
   *  UpdateNearbyObjects (PlayerGPS.cs:765-776) the ACTIVE loot only -
   *  a deactivated container is out of the Detect Treasure walk. */
  const activePiles = () => piles.filter(alive);

  /** AUDIT 63 F22 (review round): has this scene already stood a
   *  container on that marker? True for a live one AND for one the
   *  player emptied, because RemoveLootContainer left the object in
   *  the scene (:852-864) - which is exactly what stops AddFlats'
   *  re-run from minting a second, freshly rolled pile there. */
  const containerSeeded = (key) => key != null && piles.some((p) => p.containerKey === key);

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
      if (p.items.length || p.inactive) continue;
      // AUDIT 63 F22 (review round): RemoveLootContainer treats both
      // removable types the same (GameObjectHelper.cs:856-863), but
      // only a SCENE-BUILT one has an identity anything re-mints
      // against. Its loadID is the building key and the marker's own
      // coordinates (DaggerfallInterior.cs:885-889) and AddFlats runs
      // again on every entry, so the deactivated object is what stops
      // the re-mint; splicing it away handed the player an endless
      // tavern pile. A player's dropped container carries a fresh
      // NextUID that nothing rebuilds, so freeing it whole stays the
      // port's owner rule (AUDIT 17e F28).
      if (p.container) { deactivate(p); continue; }
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
        p.batch = renderer.createBillboardBatch(p.archive, p.record, p.size, [[p.pos[0], p.pos[1], p.pos[2]]]);
        p.batch.frame = 0;
      }
    }
  }

  /** PX21c: what a pile HOLDS, by the same key lootTargets emits -
   *  read-only, for the hover plaque. */
  const contents = (key) => piles.find((p) => `droppedLoot:${p.id}` === key && !p.dead)?.items ?? null;
  return { contents, dropPile, seedPile, restorePiles, collectPixel, snapshotWorld, restoreWorld, batches, tickFlats, lootTargets, pileFor, activePiles, containerSeeded, snapshotScene, releaseEmptied, offsetAll, _piles: piles };
}
