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
// THAT RESIDUE IS PAID (MAC-E, 2026-09-17, Mac: "seems like when i
// click on a dead enemy now, i loot all their items automatically? ...
// it lets me exceed my carry weight with no penalty"). This header
// used to read: "DFU's general arm opens the inventory window with the
// corpse as the remote LootTarget (:957). The port transfers the lot
// and reports the count - the pre-existing G3 shape, kept so this wave
// does not smuggle a UI change into a parity fix." A recorded residue
// is a bug with a note on it, and a player found this one: one click
// emptied a body into the pack, past every weight the window shows,
// and "You take 2 items." is a line DFU does not have.
//
// `openCorpseLoot` is :926-955 whole now - the empty body's refusal,
// the arrows-only pickup, and then the WINDOW with the body as the
// remote target, which is what the dungeon host has done since U26.
// `takeCorpseLoot` stays, and is no longer an activation: it is the
// TAKE, and its one caller is the online grant landing, where the
// items are already in flight from the body's owner and there is
// nothing left to choose (exteriorFoes' `data.grant` arm).
//
// Info mode ("You see a dead %s") still needs an activation mode the
// hosts do not carry yet.
//
// WHAT IS NOT A BUG: exceeding MaxEncumbrance costs nothing. Neither
// PlayerSpeedChanger.cs nor PlayerEntity.cs mentions encumbrance at
// all - DFU shows the figure on the target icon and never charges for
// it, so the port does the same. What the window restores is the
// CHOICE, which is the half that was missing.

import { capFoeLoot } from '../systems/foeLootCap.js';   // FOE-CAP: the death's cap, after its handlers
import { championName, properName } from '../systems/champions.js';   // LOOT7: a champion's death line names it
import { getBool } from '../systems/settings/settings.js';   // AUDIT 28 W1: DisableEnemyDeathAlert
import { floorLanding } from '../player/enterExit.js';
import { billboardSize } from '../world/rmbFlats.js';
import { addItem, takeOneInto } from '../systems/inventory.js';   // QUICK-LOOT B2: the one-item door, which the bulk take below is now written over
import { SOUND } from '../systems/soundClips.js';
import { lootRarityOn, bestRarity, RARITIES } from '../systems/loot/lootRarity.js';   // LR3: the drop chime asks the body's best tier
import { CORPSE_ACTIVATION_DISTANCE, RAY_DISTANCE } from '../player/activate.js';
import { enemyDisplayName, ENEMY_BASICS } from '../characters/enemy/enemyBasics.js';
import { FlatAnim, isAnimatedFlat } from '../render/flatAnimation.js';   // AUDIT DEX B3: a corpse of more than one frame animates, as DFU's billboard does
import { localizedText, getLocalizedEnemyName } from '../systems/textManager.js';   // L10N3d: DFU's Internal_Strings, read in the player's language; L10N3e: and the enemy's name
import { silverFindAt } from '../systems/silverFinds.js';   // SILVER-FINDS: a body opened holds silver now and then

/** ItemTemplates Arrow - the auto-pickup arm keys on it. */
export const ARROW_TEMPLATE_INDEX = 131;

/** EnemyDeath.cs:86-93 - the corpse's picture: a female mobile's own where its row names one (`FemaleCorpseTexture != 0`
 *  - no classic row does; Daggerfall Enemy Expansion's riders and its Dark Slayer, AUDIT DEX A1), else CorpseTexture. A5:
 *  the per-mobile struct copy (`f.mobile.basics` - the seducer's winged corpse) and its resolved gender (a mod's forced
 *  one too), the row for a rig foe with no mobile. */
export function corpseTextureOf(f) {
  const row = f?.mobile?.basics ?? ENEMY_BASICS[f?.mobileType];
  return ((f?.mobile?.gender ?? f?.gender) === 'female' && row?.femaleCorpseTexture) || row?.corpseTexture;
}

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
  corpseTexture, feet, fallbackSize = null, stillDead = () => true, sizeScale = 1,   // ELITE FOES: an elite's body lies larger
  centre = null,   // DEX5: a flat stood by its CENTRE, `centre` over `feet` (GameObjectHelper.CreateDaggerfallBillboardGameObject aligns nothing) - a prefab's ash
}) {
  if (!corpseTexture) return null;
  const { archive, record } = corpseTexture;
  const t = await getTexture(archive);
  if (!t) return null;
  if (t.recordCount != null && record >= t.recordCount) return null;
  if (!stillDead()) return null;
  // FindGroundPosition (:817). Cast from just above the feet so a
  // corpse already resting on the floor is not missed by its own
  // surface; no collider (a test rig, a host without one) leaves the
  // position verbatim rather than inventing a floor.
  //
  // READ AFTER THE WARM, and `feet` MUST be the pool's live array: a
  // floating-origin recenter during a cold TEXTURE.### read shifts
  // every foe's feet in place, and this record is in no pool yet - the
  // caller pushes it only when the mint resolves - so a position baked
  // BEFORE the await stranded the body, and its loot AABB, a whole map
  // pixel from the kill. Nothing can recenter between here and the
  // caller's push: that is a microtask, and the frame loop is a task.
  const pos = collider
    ? floorLanding(collider, [feet[0], feet[1] + 0.1, feet[2]])
    : [feet[0], feet[1], feet[2]];
  uploadRecordFrame(archive, record, 0);
  const size0 = billboardSize(t, record) ?? fallbackSize;
  const size = sizeScale !== 1 && size0 ? { ...size0, w: size0.w * sizeScale, h: size0.h * sizeScale } : size0;   // ELITE FOES
  if (centre != null && size) pos[1] += centre - size.h / 2;   // DEX5: the shader bottom-anchors, so the base is half a height under the centre
  const batch = renderer.createBillboardBatch(archive, record, size, [[pos[0], pos[1], pos[2]]]);
  // FA1 slice 3: a BARE record plus a frame FIELD - the draw builds
  // `record#frame`, so the record must not carry one already.
  batch.frame = 0;
  // AUDIT DEX B3: DFU's corpse is a billboard (GameObjectHelper.cs:681-683) and animates when its record has frames
  // (DaggerfallBillboard.cs:260 AnimatedMaterial) - every classic corpse has one, the mod's Hell Hound's (1614_20) three.
  // The clock rides the record (`anim`, tickCorpseMarkers), so a batch rebuilt by a recentre keeps it.
  const frames = t.getFrameCount?.(record) ?? 1;
  let anim = null;
  if (isAnimatedFlat(frames)) {
    for (let i = 1; i < frames; i++) uploadRecordFrame(archive, record, i);
    anim = new FlatAnim(archive, frames);
    batch.frame = anim.frame;
  }
  // AUDIT 17e F23 / THE FOUR HOSTS RULE: the creation params travel
  // with the record, because a floating-origin recenter has to REBUILD
  // the batch (centres are baked into a STATIC_DRAW buffer).
  return { batch, archive, record, size, pos, anim };
}

/** AUDIT DEX B3: each animated marker's clock on the host's dt (FlatAnim - DFU's fixed step), its batch the frame. */
export function tickCorpseMarkers(markers, dt) {
  for (const c of markers) if (c.anim) c.batch.frame = c.anim.tick(dt);
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
 *
 * L10N3e: and it is read in the player's language (EnemyDeath.cs:81) -
 * a translation's enemyNames row by the MobileTypes id, the port's own
 * name where the language has none.
 */
// UL1: EnemyDeath.OnEnemyDeath (EnemyDeath.cs:29, raised at :139 after
// the corpse container took the entity's items at :123). The pools
// raise it at the kill; a vendored mod registers a handler by name.
const _deathHandlers = new Map();
export function registerEnemyDeathHandler(name, fn) { if (fn) _deathHandlers.set(name, fn); else _deathHandlers.delete(name); }
export function raiseEnemyDeath(entity, opts = {}) {
  for (const fn of _deathHandlers.values()) {
    try { fn(entity, opts); } catch (e) { console.warn('[enemyDeath] a handler threw', e); }
  }
  capFoeLoot(entity);   // FOE-CAP: after EVERY handler's find - a plain foe's body never carries more than its cap
}

/**
 * DEX5 (bible/04-Characters/Enemy-Expansion.md section 11): A MOD'S CORPSE PREFAB. DFU stands a corpse's billboard
 * through MeshReplacement.ImportCustomFlatGameobject (GameObjectHelper.CreateLootContainer): a mod that ships a prefab
 * named for the corpse's archive and record (`<archive>_<record>`) puts it in the billboard's place, components and all,
 * and they run as the prefab's own from then on - Daggerfall Enemy Expansion's troll corpse (1618_20) takes the loot
 * away, counts down and stands the troll again. Only a loaded mod's prefabs are found (AssetInjection reads an enabled
 * mod's bundle), so a mod registers while it is loaded.
 *   registerCorpsePrefab(archive, record, make) - `make(f, host)` answers the components on a body (or null): an object
 *     with `frame(dt)` (each frame of the foes' clock), `sphere()` (`{ center, radius }`, a trigger a spell's missile
 *     meets - or null) and `struck(spell, casterLevel, caster)` (that missile's bundle, assigned to it).
 *   createCorpsePrefabs(host) - one foe host's runner: `mint(f, corpseTexture)` at its corpse mint, on every machine (a
 *     copy's body is its owner's); `frame(foes, dt)`; `told(f, kind)` - DEX5b: the runner's record says the body is gone
 *     (`bg`: 1 taken away, 2 burnt to its ash) and this copy loses it too; `destroy()` with the host (the bodies'
 *     OnDestroy). `host` is the host's reach: `runs(f)` (this machine simulates the foe), `body(f)` (`{ pos, size }`, where
 *     the body lies and its flat's size, or null), `rise(f)` (stand a new foe of its kind where the body lies, and take the
 *     body away), `vanish(f)` (take the body away), `toAsh(f, ash)` (take the body away and stand `ash` - `{ archive,
 *     record, centre }` - where it lay), `send(f, spell, casterLevel)` (a copy's: a missile's bundle on it, to the foe's
 *     runner), `say(line)` and `key(f)` (the body's place in a save, or null where a save keeps no body). A body a prefab
 *     destroyed is marked `corpseDestroyed` (1 or 2) - what the hosts' records carry (`bg`) and their saves write.
 *     AUDIT DEX: `rise(f)` answers whether the new foe stood (D8 - a refused stand leaves the body); `forget(f)` - a foe
 *     that stands up again (a load's rewind): its body's fate forgotten with its body (D2); `settle(f, kind)` - a load's or
 *     the room's memory's word that the body is gone, with no rise and no ash, neither a saved object (D1, D3, D4);
 *     `destroy()` lets every prefab it minted go (D12). A prefab answers `release()` - freed by another road.
 *   scenes/corpsePrefabHost.js holds the two hosts' reach (AUDIT DEX D11).
 */
const _corpsePrefabs = new Map();   // `${archive}_${record}` -> make
export function registerCorpsePrefab(archive, record, make) {
  if (!Number.isInteger(archive) || !Number.isInteger(record) || typeof make !== 'function') throw new Error('registerCorpsePrefab(archive, record, make(f, host))');
  _corpsePrefabs.set(`${archive}_${record}`, make);
}
/** The test seam. */
export function _resetCorpsePrefabs() { _corpsePrefabs.clear(); }
export function createCorpsePrefabs(host) {
  let alive = true;
  const reach = Object.freeze({ ...host, alive: () => alive });
  const minted = new Set();
  const release = (f) => { const c = f.corpsePrefab; f.corpsePrefab = null; minted.delete(f); c?.release?.(); };
  return {
    mint(f, corpseTexture) {
      release(f);
      // an executed revenant's body is the port's own fate (gone for good - revenant.js), never a prefab's to raise
      const make = corpseTexture && !f.executed ? _corpsePrefabs.get(`${corpseTexture.archive}_${corpseTexture.record}`) : null;
      f.corpsePrefab = make ? make(f, reach) ?? null : null;
      if (f.corpsePrefab) minted.add(f);
      return f.corpsePrefab;
    },
    frame(foes, dt) { for (const f of foes) if (f.corpsePrefab && f.dead && f.corpse) f.corpsePrefab.frame?.(dt); },
    told(f, kind) {
      if (!f?.dead || f.corpseDestroyed || (kind !== 1 && kind !== 2)) return;
      if (f.corpsePrefab?.gone) f.corpsePrefab.gone(kind);
      else reach.vanish(f);   // a copy with no prefab of its own (none to name the ash): the body goes, as its runner's did
    },
    forget(f) { release(f); f.corpseDestroyed = 0; },
    settle(f, kind) {
      if (kind !== 1 && kind !== 2) return;
      release(f);
      if (f.corpse) reach.vanish(f);
      f.corpseDestroyed = kind;
    },
    destroy() { alive = false; for (const f of [...minted]) release(f); },
  };
}
/** The body a missile at `pos` meets, among `foes` - a dead one whose prefab stands a trigger (its sphere and the
 *  missile's own `reach`, DaggerfallMissile's cast) - or null. */
export function corpsePrefabStruck(pos, foes, reach) {
  for (const f of foes) {
    const s = f?.dead && f.corpse ? f.corpsePrefab?.sphere?.() : null;
    if (s && Math.hypot(pos[0] - s.center[0], pos[1] - s.center[1], pos[2] - s.center[2]) <= s.radius + reach) return f;
  }
  return null;
}

export function sayEnemyDied(say, mobileType, entity = null) {
  // AUDIT 28 W1: the gate the comment above quotes was never read - the
  // setting sat `stored` while every kill spoke. GetBool, as :82.
  if (getBool('GUI', 'DisableEnemyDeathAlert')) return null;
  const name = properName(entity) ?? championName(entity, enemyDisplayName(mobileType));   // LOOT7: a champion by its name; AUDIT WB12d (D2): the Summoner by his
  if (!name) return null;
  const line = localizedText('thingJustDied', '%s just died.').replaceAll('%s', getLocalizedEnemyName(mobileType, name));
  say?.(line);
  return line;
}

/** EnemyDeath.cs:126-129 - played at the CORPSE position (the ground
 *  one), not where the enemy was standing. */
export function playBodyFall(audio, pos) {
  audio?.play3d?.(SOUND.BodyFall, [pos[0], pos[1], pos[2]], 1, { maxDistance: 16 });
}

/** LR3 (loot rarity): THE DROP CHIME. A body carrying a Rare or better
 *  rings the enchanter's chime (SoundClips.MakeItem) at the corpse,
 *  beside the body fall - the one cue a Diablo player has that a fight
 *  paid. Silent with the switch off, for Common or Magic, and for an
 *  empty body. Answers the tier it rang for, or null. */
export function playRareDrop(audio, pos, items) {
  if (!lootRarityOn() || !pos) return null;
  const best = bestRarity(items);
  if (!best || RARITIES[best].rank < RARITIES.rare.rank) return null;
  audio?.play3d?.(SOUND.MakeItem, [pos[0], pos[1], pos[2]], 1, { maxDistance: 20 });
  return best;
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
export function corpseLootTargets(entries, keyPrefix, { isCorpse, feetOf, idOf = null }) {
  const targets = [];
  entries.forEach((e, i) => {
    if (!isCorpse(e) || e.corpseDisabled) return;
    const p = feetOf(e);
    if (!p) return;
    // AUDIT 39: a pool that PRUNES its list keys by a stable id
    // instead - an index names a different body the moment anything
    // ahead of it is spliced out. Without `idOf` the index stands.
    const id = idOf ? idOf(e) : i;
    // PlayerActivate.cs:85/:938 - corpses reach 150 * GlobalScale, not
    // the 128-unit default.
    //
    // AUDIT 65 MC-2: and the REACH is not the RAY. DFU's one raycast
    // runs to RayDistance (:76) and the corpse's 150 units are a
    // SECOND test inside the handler - ActivateLootContainer exempts
    // CorpseMarker from the treasure gate by name (:868-869) and the
    // corpse arm answers `hit.distance > CorpseActivationDistance`
    // with SetMidScreenText(youAreTooFarAway) (:936-941). So the body
    // competes for the pick at the ray's reach and carries its own
    // beside it; the ladder speaks the refusal. Pre-MC-2 the pick
    // simply dropped a body at 5 units and the click fell through to
    // whatever stood behind it, in silence.
    targets.push({
      key: `${keyPrefix}:${id}`,
      aabb: { min: [p[0] - 0.5, p[1], p[2] - 0.5], max: [p[0] + 0.5, p[1] + 0.6, p[2] + 0.5] },
      distance: RAY_DISTANCE,
      reach: CORPSE_ACTIVATION_DISTANCE,
      // LOOT-STACK: a BODY, in the producer's own word - the pick turns a
      // pile of these (player/lootStack.js) and reads no key's prefix to
      // know one.
      body: true,
    });
  });
  return targets;
}

/**
 * PI1 (Physical Items, scenes/physicalItemsLayer.js): THE BODIES WHOSE ITEMS STAND ROUND THEM - the pool's own lootable
 * bodies (`isCorpse`, not disabled), once the marker has landed (its foot is where they are thrown from), and never a
 * peer's puppet (its list lives on its owner's side - lootFinds' own rule). `{ entity, pos, key }`, the list read live,
 * the key the pool's own (`corpseLootTargets`' - an index where the pool has no `idOf`).
 */
export function physicalCorpseSources(entries, keyPrefix, { isCorpse, feetOf, idOf = null }) {
  const out = [];
  (entries ?? []).forEach((e, i) => {
    if (!isCorpse(e) || e.corpseDisabled || e.puppet || !e.corpseMarker) return;
    const pos = feetOf(e);
    if (pos) out.push({ entity: e.entity, pos, key: `${keyPrefix}:${idOf ? idOf(e) : i}` });
  });
  return out;
}

/**
 * WORLD-HOVER: WHICH BODY a corpse key names, off the same entry list
 * and the same identity `corpseLootTargets` above mints its keys from.
 *
 * This is the half both pools genuinely share - walking their own list
 * under the producer's own `isCorpse`/`idOf` law - and it lives beside
 * the producer for the reason AUDIT 24 (wave 38) had to fix once
 * already: the watch's bodies and the encounter pool's are the same
 * kind of thing, and the moment one of them is walked by a second,
 * hand-written rule they stop agreeing.
 *
 * It answers the ENTRY and not the word. The word is World Tooltips'
 * (`corpseName`, vendor .cs:526) and the pools apply it - because this
 * module is reached, through `unleveledLoot`, from `worldTick`, which
 * `worldTooltips` itself imports by way of the building hours. An
 * import from here would close that ring and this file's own
 * `_deathHandlers` would be read before it exists. A caller of a rule
 * is not a copy of it; a cycle is a crash at boot.
 */
export function corpseEntryFor(entries, key, keyPrefix, { isCorpse, idOf = null }) {
  let i = -1;
  for (const e of entries ?? []) {
    i += 1;
    if (!isCorpse(e)) continue;
    const id = idOf ? idOf(e) : i;
    if (`${keyPrefix}:${id}` === key) return e;
  }
  return null;
}

/**
 * WORLD-HOVER: WHAT A BODY HOLDS, read-only.
 *
 * AUDIT-WH H3. `foeCorpse:` and `guardCorpse:` have been in the hover
 * model's ITEMISED_KEYS since the first slice - the plaque opens a LIST
 * for them rather than a name - and neither above-ground host answered
 * their contents, so `contents?.(key) ?? null` fell to null and
 * `hoverLines(null)` answered `empty`. Every body you killed in a
 * street or in the wilderness read "Empty" over a full pack, which is
 * the one thing the plaque exists not to do: it said the opposite of
 * what the press would show you.
 *
 * It is the same read `openCorpseLoot` makes one line into the take
 * (`entry.entity?.items`), and it lives beside it for that reason. A
 * DISABLED body answers null and not `[]` - it is not a target any
 * more (:942-947 disables the container), and the two answers draw
 * differently.
 */
export function corpseContents(entry) {
  if (!entry || entry.corpseDisabled) return null;
  return entry.entity?.items ?? null;
}

/**
 * THE TAKE (MAC-E). This was PlayerActivate's whole corpse arm and is
 * not any more - `openCorpseLoot` above is. What is left is the
 * transfer itself, and its ONE caller is the online grant landing
 * (`exteriorFoes`' `data.grant` arm): the owner of a peer's body has
 * already chosen what leaves it and the items are in flight, so there
 * is nothing for a window to offer. Every LOCAL body goes through
 * `openCorpseLoot`.
 *
 * Returns the number of items taken - 0 for an empty body, which is a
 * real outcome and not a failure.
 */
/**
 * MAC-E - CreateLootableCorpseMarker's OWN identity as the inventory
 * window's remote target (GameObjectHelper.cs:812-841): the pair
 * `ReverseCorpseTexture` resolved at the mint, and playerOwned FALSE
 * (:833) - so `CanChangeDropIcon` refuses to cycle a body's picture,
 * exactly as it refuses a scene-built container's.
 *
 * The archive and record come off the marker the pool already minted
 * rather than from a second `ReverseCorpseTexture` read, because the
 * marker IS that read's answer and a second one is a second chance to
 * disagree.
 *
 * NO `containerImage`, and that is the DUNGEON's shape rather than an
 * omission: `UpdateRemoteTargetIcon` reads the container picture only
 * in its LAST arm (:885-889), behind the target's own world flat
 * (:880-884), and a corpse marker ALWAYS has an archive - the mint
 * refuses without one (`if (!corpseTexture) return null`). So the
 * picture DFU's call passes (`InventoryContainerImages.Corpse2`, :820)
 * is unreachable for a body, and `scenes/dungeonContext.js`'s corpse
 * arm has passed the pair alone since U26 for that reason.
 *
 * It also keeps this module a LEAF of the UI: importing
 * `CONTAINER_IMAGES` from `ui/targetIconPanel.js` closes a cycle
 * (targetIconPanel -> hud -> ... -> worldTick -> unleveledLoot ->
 * this file's `registerEnemyDeathHandler`), and the TDZ error it
 * throws is at module load, so every host dies on boot. Caught by the
 * pins the moment it was written.
 */
export const corpseLootHooks = (entry) => ({
  items: () => entry.entity?.items ?? [],
  playerOwned: false,
  textureArchive: entry.corpseMarker?.archive ?? 0,
  textureRecord: entry.corpseMarker?.record ?? 0,
  pos: [...(entry.corpseMarker?.pos ?? entry.ai?.feet ?? [0, 0, 0])],
});

/** AUDIT 68 S18-corpse-prelude-dup: PlayerActivate's first two corpse
 *  answers, written ONCE for both take paths (the window door below and
 *  the online grant's bulk take) - they were two line-for-line copies.
 *  Answers what was taken when one of them answered, null when the body
 *  is neither empty nor a lone quiver.
 *
 *  NOTE both taking arms leave the container ENABLED. DFU disables a
 *  corpse only on the activation that FINDS it empty (:946), which is
 *  the one after the take - so the player who loots a body and
 *  activates it again is told it has no treasure, and only then does it
 *  stop being a target. Disabling on the take would eat that line. */
/** :948-952's test - one item, and it is arrows: a body DFU empties into the pack with no window. AUDIT 625 S7: one law
 *  for every reader - this door's, and a peer's grant (exteriorFoes.js), whose arrows alone roll no silver either. */
export const arrowsOnly = (items) => Array.isArray(items) && items.length === 1 && items[0]?.templateIndex === ARROW_TEMPLATE_INDEX;

function corpsePrelude(entry, playerEntity, say) {
  if (!entry || entry.corpseDisabled) return 0;
  const items = entry.entity?.items;
  // :942-947 - the body has no treasure, and the container is
  // DISABLED: an emptied corpse stops being activatable.
  if (!items?.length) {
    entry.corpseDisabled = true;
    say(localizedText('theBodyHasNoTreasure', 'The body has no treasure.'));
    return 0;
  }
  // :948-952 - one item and it is arrows: taken whole, no window.
  if (arrowsOnly(items)) {
    playerEntity.items = playerEntity.items || [];
    addItem(playerEntity.items, items[0]);
    items.length = 0;
    say('You collect the arrows.');   // youCollectArrows
    return 1;
  }
  return null;
}

/**
 * PlayerActivate's CorpseMarker arm, WHOLE (:936-957).
 *
 * The three answers, in C#'s own order:
 *   the body is empty        -> "The body has no treasure." AND the
 *                               container is DISABLED (:942-947), so
 *                               it stops being a target. Note this is
 *                               the activation AFTER the one that
 *                               emptied it: DFU disables on the click
 *                               that FINDS it empty, never on the take,
 *                               which is what leaves the player that
 *                               line to hear.
 *   one item, and it is arrows -> taken whole, no window (:948-952).
 *   anything else            -> the inventory window opens with the
 *                               body as the REMOTE TARGET (:957).
 *
 * `openWindow` is the host's door onto its own inventory factory; it is
 * handed `corpseLootHooks(entry)` and nothing else. A caller that has
 * no window does NOT fall back to a bulk take - it warns and takes
 * nothing, because a silent fallback is how the vacuum survived a
 * recorded residue note for as long as it did.
 *
 * Returns the number of items the body holds, so a caller's "did
 * anything happen" test still reads.
 *
 * SILVER-FINDS: a body opened with treasure in it - the window, or the
 * quick loot the host's door takes through - rolls its silver once
 * (systems/silverFinds.js); an empty body, a body of arrows and a body
 * left shut roll none. AUDIT 625 D6: OPENED is the door's own answer -
 * `true` for a window that mounted or a quick take; a pack the host
 * refused (a werebeast's - GetSuppressInventory) is no open, and rolls
 * nothing.
 */
export function openCorpseLoot(entry, { playerEntity, say = () => {}, openWindow = null } = {}) {
  const answered = corpsePrelude(entry, playerEntity, say);
  if (answered !== null) return answered;
  const items = entry.entity.items;
  if (typeof openWindow !== 'function') {
    console.warn('[corpse] no inventory door - the body stays shut rather than emptying itself');
    return items.length;
  }
  if (openWindow(corpseLootHooks(entry)) === true) silverFindAt('corpse', entry);
  return items.length;
}

/**
 * L10N3e: A BODY'S NAME - `loot.entityName`, which
 * CreateLootableCorpseMarker fills through GetLocalizedEnemyName
 * (GameObjectHelper.cs:701): a translation's enemyNames row for the
 * MobileTypes id, the port's own name where the language has none, null
 * for a type no list names. DFU stamps it on the marker at the kill; the
 * port reads it where the body is SHOWN - the plaque's "<who> (dead)"
 * (World Tooltips .cs:526) in every pool, and the loot tab below - so a
 * body follows the language chosen, and nothing stores the word.
 */
export const corpseEntityName = (mobileType) => getLocalizedEnemyName(mobileType, enemyDisplayName(mobileType));

/**
 * LOOT-STACK: A BODY AS THE LOOT WINDOW'S TAB (player/lootStack.js
 * lootPile) - its name and how much it holds - or null for a body a tab
 * must not offer: a disabled one, an empty one (its press would only say
 * "The body has no treasure." and close the window it came from), and a
 * PUPPET's, which is its owner's to empty and opens no window here.
 * The name is the body's own (corpseEntityName, above); a tab is keyed
 * by the body's key, never by this word.
 */
export function pileBody(entry) {
  if (!entry || entry.corpseDisabled || entry.puppet) return null;
  const count = entry.entity?.items?.length ?? 0;
  return count > 0 ? { name: corpseEntityName(entry.mobileType) ?? 'Body', count } : null;
}

export function takeCorpseLoot(entry, playerEntity, say = () => {}) {
  const answered = corpsePrelude(entry, playerEntity, say);
  if (answered !== null) return answered;
  const items = entry.entity.items;
  playerEntity.items = playerEntity.items || [];
  let n = 0;
  // DoTransferItem's FIRST statement (DaggerfallInventoryWindow.cs:1562-1571):
  // a Currency.Gold_pieces pile bound for PlayerEntity.Items is spent into
  // the counter (`playerEntity.GoldPieces += item.stackCount`) and never
  // added to the list. DFU reaches that door because :957 opens the window;
  // the port's bulk take is the recorded UI residue above, so the door has
  // to be spelled away from the window too - E4's invariant is that the
  // player's collection never holds Currency, and gold that lands in it is
  // unspendable.
  //
  // QUICK-LOOT B2: and it is spelled ONCE now, in `takeOneInto`, because
  // quick loot's single-row take needs the same door and a third copy of
  // a law is a third chance to omit it (HARD2). This loop is that door
  // applied to every row; `[...items]` because the door splices the
  // source, so iterating it live would skip every second entry.
  for (const item of [...items]) { if (takeOneInto(playerEntity, items, item)) n++; }
  say(n === 1 ? 'You take 1 item.' : `You take ${n} items.`);
  return n;
}
