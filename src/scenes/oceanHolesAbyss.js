// ═══════════════════════════════════════════════════════════════════
// OH-D / OH-E (2026-09-26): THE ABYSS - There's a Hole in the Bottom of the
// Ocean's dungeon half (jet082's OceanHoles, 1.1.0). A swimmer touching a
// pit's entrance is taken down (TryEnterPit): a dungeon borrowed by hash
// (TryFindTemplate), cloned and renamed (CloneDungeon, BuildDungeonName), the
// GPS moved to the template's own map pixel (the save position) and renamed
// "<name> [x,y]", and entered as TransitionDungeonInterior enters a door's.
// While it builds (OnSetDungeon) it is FLOODED (WaterizeDungeon), renamed
// and its map id made the pit's (RenameDungeon, GetAbyssMapId), and its
// enemies made the deep's (ProcessAbyssEnemies); on arrival
// (OnTransitionDungeonInterior) it is prepared again (PrepareAbyssDungeon:
// the borrowed quest resources and every light fixture gone). Its exit
// (OnTransitionDungeonExterior) teleports back to the pit's own world
// coordinates and stands the swimmer on the entrance (RestoreOceanPosition).
// A Recall anchor set inside is bound to the abyss (OceanHoleRecallBinding)
// and brings it back when recalled into the template (ReactivateRecalledAbyss);
// a load inside the template restores it (RestoreSaveData); a respawn, a
// load elsewhere or a failed door clears it. While the player is in the bound
// abyss its presentation is overridden every frame (LateUpdate): the water's
// fog darker and denser, the dungeon's ambient darker, the sunlight's
// indirect bounce off, the Light spell's candle at half, the torch out.
//
// THE GPS MOVE IS A TELEPORT HERE (Port-Ledger, the Ocean Holes row): DFU's
// PlayerGPS takes the template's coordinates without the world moving - the
// streamer is off while the player is underground - and the port's GPS IS
// its streamer's pixel, so the world is stood at the template's pixel (the
// save position) before the dungeon is entered, as Recall stands it before
// its dungeon arm. Everything that asks where the player is while inside -
// the save's dungeon home, the anchor, the respawner, the template tests -
// then asks the pixel the mod set.
//
// DECLARED here, not in the scene: the save data's shape (OceanHoleSaveData,
// OceanHoleRecallBinding), the gates of each handler in the C#'s order.
// ═══════════════════════════════════════════════════════════════════

import {
  tryFindTemplate, cloneDungeon, buildDungeonName, buildGpsDungeonName, getAbyssMapId, getMidpointColor, getScaledSliderValue,
  abyssWaterLevel, isFlameEnemy, tryPickUnderwaterEnemy, isEligibleUnderwaterReplacement, enemyHash, enemyRow, isDungeonLightFixture,
  MINIMUM_AQUATIC_ENEMY_FRACTION, ABYSS_FOG_COLOR, ABYSS_AMBIENT_LIGHT, ABYSS_FOG_BLEND_AT_MIDPOINT, ABYSS_FOG_DENSITY_AT_MIDPOINT,
  ABYSS_MAGIC_LIGHT_SCALE, MAX_FLOOR_WAIT_FRAMES, PIT_RESTORE_GRACE_FRAMES, MOBILE_BEHAVIOUR,
} from '../world/oceanHoles.js';
import { worldCoordToMapPixel } from '../formats/mapsFile.js';
import { NO_WATER_LEVEL } from '../world/deepWater/deepWaterSwim.js';
import { colorLerp } from '../systems/mathf.js';
import { MOBILE_TYPES } from '../characters/mobile/mobileTypes.js';
import { SITE_TYPES } from '../systems/quest/place.js';   // TryFindTemplate's GetSiteLinks(SiteTypes.Dungeon, mapId)

const f32 = Math.fround;
const BLACK = Object.freeze([0, 0, 0, 1]);

/** OceanHoleSaveData's defaults. */
export function newAbyssSaveData() {
  return {
    Active: false, PitMapX: 0, PitMapY: 0, ReturnWorldX: 0, ReturnWorldZ: 0, HasReturnPitDepth: false, ReturnPitDepth: 0,
    TemplateRegionIndex: -1, TemplateLocationIndex: -1, TemplateMapX: -1, TemplateMapY: -1, DungeonName: '', RecallBinding: null,
  };
}
/** An OceanHoleRecallBinding from the data and an anchor. */
function bindingOf(data, anchor) {
  return {
    AnchorWorldX: anchor.worldPosX, AnchorWorldZ: anchor.worldPosZ, AnchorPosition: [...anchor.position],
    PitMapX: data.PitMapX, PitMapY: data.PitMapY, ReturnWorldX: data.ReturnWorldX, ReturnWorldZ: data.ReturnWorldZ,
    HasReturnPitDepth: data.HasReturnPitDepth, ReturnPitDepth: data.ReturnPitDepth,
    TemplateRegionIndex: data.TemplateRegionIndex, TemplateLocationIndex: data.TemplateLocationIndex,
    TemplateMapX: data.TemplateMapX, TemplateMapY: data.TemplateMapY, DungeonName: data.DungeonName,
  };
}
/** Restore a save's record into the defaults' shape (a missing field keeps its default). */
function restoredData(saved) {
  const d = newAbyssSaveData();
  if (!saved || typeof saved !== 'object') return d;
  for (const k of Object.keys(d)) if (k in saved) d[k] = saved[k];
  return d;
}

/** MatchesRecallAnchor: the anchor inside a dungeon, at the binding's world coordinates, and `(anchor.position -
 *  binding.AnchorPosition).sqrMagnitude < 0.01f` - two Vector3s, so the difference and its square are floats. */
export function matchesRecallAnchor(binding, anchor) {
  if (!binding || !anchor || !anchor.insideDungeon || anchor.worldPosX !== binding.AnchorWorldX || anchor.worldPosZ !== binding.AnchorWorldZ) return false;
  const d = (i) => f32(f32(anchor.position[i]) - f32(binding.AnchorPosition[i]));
  const dx = d(0), dy = d(1), dz = d(2);
  return f32(f32(f32(dx * dx) + f32(dy * dy)) + f32(dz * dz)) < f32(0.01);
}

/**
 * @param {object} deps
 * @param {() => {dungeonVisualIntensity: number, dungeonVisualDarkness: number}} deps.settings
 * @param {object} deps.maps - {regionCount, locationCount(r), location(r, i)}: MapsFile for TryFindTemplate
 * @param {(siteType: number, mapId: number) => object[]} deps.siteLinks - QuestMachine.GetSiteLinks
 * @param {(mapId: number) => boolean} deps.isMainStoryDungeon
 * @param {object} deps.gps - {worldX(), worldZ(), currentMapPixel(), currentLocation()}
 * @param {(worldX: number, worldZ: number) => Promise<boolean>} deps.teleportToWorld - the GPS set and the world stood there
 * @param {(name: ?string, mapId: ?number) => void} deps.renameGps - RenameGpsLocation's write (null, null clears it)
 * @param {object} deps.player - {isInside(), isInsideDungeon(), isSwimming(), anchor(), teleportedIntoDungeon(), isRespawning(), loadInProgress(), placeFeet(p), placeCentreY(y), clearFallingDamage()}
 * @param {object} deps.modes - {enterAbyss(clone): Promise<boolean>, dungeon(): ?object} - the live dungeon's seams (see dungeonContext.js abyss)
 * @param {(mapX: number, mapY: number) => ?{position: number[], topY: number}} deps.pitEntrance
 * @param {(mapX: number, mapY: number) => ?number} deps.oceanSurfaceY - GetOceanSurfaceWorldY at a loaded pixel
 * @param {(mapX: number, mapY: number) => ?{x: number, z: number}} deps.pitPlacement - the pit's world X/Z from PlacementFraction at a loaded pixel
 * @param {() => boolean} deps.terrainReady - the stream settled where the teleport put it (!IsInit, !IsRepositioningPlayer)
 * @param {(text: string, seconds: number) => void} deps.hud
 * @param {() => number[]} deps.roster - UnderwaterEnemySpawner.GetEnemyRoster
 * @param {() => number} deps.nowSeconds - Time.time
 */
export function createOceanHolesAbyss(deps) {
  const { settings, maps, siteLinks, isMainStoryDungeon, gps, teleportToWorld, renameGps, player, modes, pitEntrance, oceanSurfaceY,
    pitPlacement, terrainReady, hud, roster, nowSeconds, waitFrame = () => new Promise((r) => requestAnimationFrame(() => r())) } = deps;
  let data = newAbyssSaveData();
  let buildingAbyss = false;
  let entryPending = false;
  let transitioning = false;
  let nextNameRefresh = 0;
  const underwaterEnemyTypes = () => roster() ?? [];
  const siteLinkCount = (mapId) => (siteLinks(SITE_TYPES.Dungeon, mapId) ?? []).length;   // GetSiteLinks(SiteTypes.Dungeon, mapId).Length

  const abyssMapId = () => getAbyssMapId(data.PitMapX, data.PitMapY);
  const gpsName = () => buildGpsDungeonName(data.DungeonName, data.PitMapX, data.PitMapY);

  /** IsLoadedTemplateDungeon(region, location): inside a dungeon whose summary is that location's. */
  function isLoadedTemplateDungeon(regionIndex = data.TemplateRegionIndex, locationIndex = data.TemplateLocationIndex) {
    const d = modes.dungeon();
    if (!player.isInsideDungeon() || !d) return false;
    const loc = d.location();
    return loc.regionIndex === regionIndex && loc.locationIndex === locationIndex;
  }
  /** IsPlayerAtTemplateLocation: the GPS at the template's map pixel (or, with none recorded, at its location). */
  function isPlayerAtTemplateLocation() {
    if (data.TemplateMapX >= 0 && data.TemplateMapY >= 0) {
      const p = gps.currentMapPixel();
      return p.x === data.TemplateMapX && p.y === data.TemplateMapY;
    }
    const loc = gps.currentLocation();
    return !!loc && loc.regionIndex === data.TemplateRegionIndex && loc.locationIndex === data.TemplateLocationIndex;
  }
  /** IsBoundAbyssDungeon: the template's dungeon, at its pixel, under the abyss's name and id. */
  function isBoundAbyssDungeon(d = isLoadedTemplateDungeon() ? modes.dungeon() : null) {
    if (!d || !isPlayerAtTemplateLocation()) return false;
    const loc = d.location();
    if (loc.regionIndex !== data.TemplateRegionIndex || loc.locationIndex !== data.TemplateLocationIndex) return false;
    return d.summaryName() === data.DungeonName && d.summaryId() === abyssMapId();
  }

  function clearAbyssState() {
    data.Active = false;
    buildingAbyss = false;
    entryPending = false;
    transitioning = false;
    modes.dungeon()?.setBlockWaterLevel?.(NO_WATER_LEVEL);   // playerEnterExit.blockWaterLevel = 10000
    renameGps(null, null);
  }

  // ── the recall binding ──────────────────────────────────────────────
  function captureCurrentRecallBinding(anchor = null) {
    const d = modes.dungeon();
    if (!data.Active || !d || !isBoundAbyssDungeon(d)) return;
    anchor ??= player.anchor();
    if (anchor && anchor.insideDungeon && anchor.worldPosX === gps.worldX() && anchor.worldPosZ === gps.worldZ() && !matchesRecallAnchor(data.RecallBinding, anchor)) {
      data.RecallBinding = bindingOf(data, anchor);
    }
  }
  function refreshRecallBinding() {
    const anchor = player.anchor();
    if (data.Active) captureCurrentRecallBinding(anchor);
    else if (data.RecallBinding && !matchesRecallAnchor(data.RecallBinding, anchor)) data.RecallBinding = null;
  }
  function applyRecallBinding(b) {
    Object.assign(data, {
      PitMapX: b.PitMapX, PitMapY: b.PitMapY, ReturnWorldX: b.ReturnWorldX, ReturnWorldZ: b.ReturnWorldZ,
      HasReturnPitDepth: b.HasReturnPitDepth, ReturnPitDepth: b.ReturnPitDepth, TemplateRegionIndex: b.TemplateRegionIndex,
      TemplateLocationIndex: b.TemplateLocationIndex, TemplateMapX: b.TemplateMapX, TemplateMapY: b.TemplateMapY, DungeonName: b.DungeonName,
    });
    data.RecallBinding = null;
  }
  /** ReactivateRecalledAbyss: a Recall into the bound template's dungeon brings the abyss back. */
  function reactivateRecalledAbyss() {
    const b = data.RecallBinding;
    const d = modes.dungeon();
    if (!data.Active && d && player.teleportedIntoDungeon() && b && isLoadedTemplateDungeon(b.TemplateRegionIndex, b.TemplateLocationIndex)) {
      applyRecallBinding(b);
      data.Active = true;
      prepareAbyssDungeon(d, true);
    }
  }
  /** IsPendingAbyssRecall: the respawner (a Recall) landing in the bound template's dungeon, before the binding is applied. */
  function isPendingAbyssRecall() {
    const b = data.RecallBinding;
    const d = modes.dungeon();
    if (!player.isRespawning() || player.loadInProgress()) return false;
    if (!matchesRecallAnchor(b, player.anchor()) || !d) return false;
    if (b.TemplateMapX >= 0 && b.TemplateMapY >= 0) {
      const p = gps.currentMapPixel();
      if (p.x !== b.TemplateMapX || p.y !== b.TemplateMapY) return false;
    }
    const loc = d.location();
    return loc.regionIndex === b.TemplateRegionIndex && loc.locationIndex === b.TemplateLocationIndex;
  }

  // ── the dungeon's own changes ───────────────────────────────────────
  /**
   * WaterizeDungeon: the level a metre over the tallest mesh (never less
   * than 3 m over the start marker, and at least 2.5 m over it), every
   * block's WaterLevel set to it, each block's water plane moved (or added),
   * and the player's block water level with it when this is their dungeon.
   */
  function waterizeDungeon(d) {
    const start = d?.startMarkerY?.();
    if (d == null || start == null) return;
    const level = abyssWaterLevel(start, d.maxMeshTopY(), d.originY());
    d.setAllBlockWaterLevels(level);
    if (modes.dungeon() === d) d.setBlockWaterLevel(level);
  }
  /** RenameDungeon: the summary's id the abyss's and its name the dungeon's - the location's name and map id with it. */
  function renameDungeon(d, dungeonName) {
    if (!d || !dungeonName) return;
    d.rename(dungeonName, abyssMapId());
  }
  /** RenameGpsLocation: the GPS's current location renamed "<name> [x,y]" under the abyss's id (while it has one). */
  function renameGpsLocation(dungeonName) {
    if (!dungeonName) return;
    renameGps(dungeonName, abyssMapId());
  }

  /** ProcessAbyssEnemy: a flame enemy destroyed; otherwise, with replacement allowed, maybe made one of the deep's. */
  function processAbyssEnemy(d, foe, allowReplacement, aquaticOnly = false) {
    if (!foe || !foe.entity || foe.dead) return;
    const type = foe.mobileType;
    if (isFlameEnemy(type)) { d.destroyFoe(foe); return; }
    if (!allowReplacement) return;
    const row = enemyRow(type);
    const flag = foe.isClass && type >= 128 && type <= 146;   // the mod's own range (AUDIT DEX C4): a custom class - Daggerfall Enemy Expansion's 384-398 - is a monster to it
    const flag2 = flag ? (row?.behaviour === MOBILE_BEHAVIOUR.General || row?.behaviour === MOBILE_BEHAVIOUR.Guard) : row?.behaviour === MOBILE_BEHAVIOUR.General;
    if (!foe.loadID || foe.questSpawn || !foe.demo || (!aquaticOnly && underwaterEnemyTypes().includes(type))
      || (aquaticOnly && row?.behaviour === MOBILE_BEHAVIOUR.Aquatic) || type === MOBILE_TYPES.DaedraSeducer || !flag2 || row?.noShadow || row?.glowColor) return;
    const num = enemyHash(data.PitMapX, data.PitMapY, foe.loadID);
    if (!aquaticOnly && !flag && num % 3 !== 0) return;
    const hash = aquaticOnly || flag ? num : Math.floor(num / 3);
    const pick = tryPickUnderwaterEnemy(hash, flag && !aquaticOnly, aquaticOnly, underwaterEnemyTypes());
    if (pick == null) return;
    d.replaceFoe(foe, pick, { wasHumanoid: flag });   // ApplyEnemySettings(type, reaction, Unspecified, spawn distance, allied) + AlignToGround
  }
  function processAbyssEnemies(d, allowReplacement) {
    for (const foe of d.foes()) processAbyssEnemy(d, foe, allowReplacement);
    ensureAquaticEnemyQuota(d);
  }
  /**
   * EnsureAquaticEnemyQuota: 30% of the living, non-flame enemies aquatic
   * (rounded up) - first from those not made from a humanoid, then from
   * those that were, each made one of the deep's aquatic kinds.
   */
  function ensureAquaticEnemyQuota(d) {
    if (!d) return;
    const alive = () => d.foes().filter((f) => f.entity && !f.dead && (f.entity.health ?? 0) > 0 && !isFlameEnemy(f.mobileType));
    let num = 0, num2 = 0;
    for (const f of alive()) { num++; if (enemyRow(f.mobileType)?.behaviour === MOBILE_BEHAVIOUR.Aquatic) num2++; }
    const num3 = Math.ceil(f32(num * MINIMUM_AQUATIC_ENEMY_FRACTION));
    for (let j = 0; j < 2 && num2 < num3; j++) {
      for (const f of d.foes()) {
        if (num2 >= num3) break;
        if (!f.entity || f.dead || (f.entity.health ?? 0) <= 0 || isFlameEnemy(f.mobileType) || enemyRow(f.mobileType)?.behaviour === MOBILE_BEHAVIOUR.Aquatic) continue;
        const wasHumanoid = !!f.abyssWasHumanoid;
        if ((j === 0 && wasHumanoid) || (j === 1 && !wasHumanoid)) continue;
        processAbyssEnemy(d, f, true, true);
        if (enemyRow(f.retypedTo ?? f.mobileType)?.behaviour === MOBILE_BEHAVIOUR.Aquatic) num2++;
      }
    }
  }

  /** PrepareAbyssDungeon: flooded, renamed (the GPS too), its borrowed quest resources and its light fixtures gone, its enemies processed. */
  function prepareAbyssDungeon(d, allowEnemyReplacement = false) {
    if (!d) return;
    waterizeDungeon(d);
    renameDungeon(d, data.DungeonName);
    renameGpsLocation(gpsName());
    d.removeQuestResources();
    d.removeLightFixtures(isDungeonLightFixture);
    processAbyssEnemies(d, allowEnemyReplacement);
    return d.settle?.();   // the port's rebuilt bodies (ApplyEnemySettings is immediate in DFU)
  }

  // ── the way down and the way up ────────────────────────────────────
  /** TryEnterPit: from a pit's entrance, swimming, outside - a template borrowed, the GPS moved, the door taken. */
  async function tryEnterPit(mapPixelX, mapPixelY) {
    if (transitioning || entryPending || data.Active) return false;
    if (player.isInside() || !player.isSwimming()) return false;
    const found = tryFindTemplate(mapPixelX, mapPixelY, maps, siteLinkCount, isMainStoryDungeon);
    if (!found) { hud('The darkness below refuses to open.', 3); return false; }
    const { template, savePosition } = found;
    const dungeonName = buildDungeonName(mapPixelX, mapPixelY);
    const clone = cloneDungeon(template, dungeonName);
    const tp = worldCoordToMapPixel(savePosition.x, savePosition.y);
    const recallBinding = data.RecallBinding;
    let hasReturnPitDepth = false, num = 0;
    const at = pitEntrance(mapPixelX, mapPixelY);
    const sea = oceanSurfaceY(mapPixelX, mapPixelY);
    if (at && sea != null) {
      num = f32(sea - at.topY);
      hasReturnPitDepth = num > 0.5;
    }
    data = {
      Active: false, PitMapX: mapPixelX, PitMapY: mapPixelY, ReturnWorldX: gps.worldX(), ReturnWorldZ: gps.worldZ(),
      HasReturnPitDepth: hasReturnPitDepth, ReturnPitDepth: num,
      TemplateRegionIndex: template.regionIndex, TemplateLocationIndex: template.locationIndex, TemplateMapX: tp.x, TemplateMapY: tp.y,
      DungeonName: dungeonName, RecallBinding: recallBinding,
    };
    transitioning = true;
    entryPending = true;
    // PlayerGPS.WorldX/WorldZ = the save position; UpdateWorldInfo - the port's GPS is the streamer's pixel (the header)
    let moved = false;
    try { moved = await teleportToWorld(savePosition.x, savePosition.y); }
    catch (e) { console.warn('[ocean-holes] the descent\'s teleport failed - the swimmer stays at the pit:', e?.message ?? e); }   // AUDIT PRE-MERGE 0928 H/S: the host drops this promise (world.js onEnterPit) - a teleport that threw left `entering` up for the session (every load, fast travel and Recall waits on it) and its rejection unheard
    if (!moved) { entryPending = false; transitioning = false; return false; }
    renameGpsLocation(gpsName());
    buildingAbyss = true;
    let entered = false;
    try {
      entered = await modes.enterAbyss(clone);
    } catch (e) {
      console.warn('[ocean-holes] the abyss\'s door threw - the swimmer goes back to the pit:', e?.message ?? e);   // AUDIT PRE-MERGE 0928 H/S: a throw is a door that never opened (departure (8)), answered below as one - it had skipped the answer and left the swimmer entering for good
    } finally {
      buildingAbyss = false;
      if (!data.Active && !entryPending) transitioning = false;
    }
    // The port's door has refusals DFU's has not (a mode already changed, a world that moved under the build): one
    // that raised no OnFailedTransition is answered as though it had, or the swimmer is left entering forever.
    // AUDIT OH-F B4: ...unless a respawn is what took the door from under it - the respawn owns the move, and the
    // failure's teleport back to the pit would race it (the other world moves wait for the descent: `entering`)
    if (!entered && entryPending) {
      if (player.isRespawning()) { entryPending = false; buildingAbyss = false; transitioning = false; data.Active = false; renameGps(null, null); }
      else await transitionFailed();
    }
    return data.Active;
  }
  /** OnFailedTransition's body: the swimmer back where they were, at the surface. The teleport waits a frame, so it
   *  never starts inside the door machinery that raised the failure (the port's teleport aborts a transition in hand). */
  async function transitionFailed() {
    entryPending = false;
    buildingAbyss = false;
    data.Active = false;
    renameGps(null, null);
    try {
      await waitFrame();
      await teleportToWorld(data.ReturnWorldX, data.ReturnWorldZ);
      await restoreOceanPosition(data.ReturnWorldX, data.ReturnWorldZ, false);
    } catch (e) {
      transitioning = false;   // AUDIT PRE-MERGE 0928 H/S: a way back that threw leaves no transition standing, as onDungeonExited's
      console.warn('[ocean-holes] the way back from a door that never opened failed - the swimmer stays where it left them:', e?.message ?? e);
    }
  }

  /** RestoreOceanPosition: back at the pit's world coordinates - on its entrance when it stands, or by the recorded depth, else at the surface. */
  async function restoreOceanPosition(worldX, worldZ, returnToPit) {
    const pixel = returnToPit ? { x: data.PitMapX, y: data.PitMapY } : worldCoordToMapPixel(worldX, worldZ);
    let entrance = null, surface = null, place = null;
    for (let i = 0; i < MAX_FLOOR_WAIT_FRAMES; i++) {
      if (Math.abs(gps.worldX() - worldX) <= 4 && Math.abs(gps.worldZ() - worldZ) <= 4 && terrainReady()) {
        surface = oceanSurfaceY(pixel.x, pixel.y);
        entrance = pitEntrance(pixel.x, pixel.y);
        if (surface != null && (!returnToPit || entrance || (data.HasReturnPitDepth && i >= PIT_RESTORE_GRACE_FRAMES))) break;
      }
      await waitFrame();
    }
    await waitFrame();
    await waitFrame();
    if (returnToPit && surface != null) entrance = pitEntrance(pixel.x, pixel.y) ?? entrance;
    if (returnToPit && surface != null && (entrance || data.HasReturnPitDepth)) {
      let x, z, top;
      if (entrance) { [x, , z] = entrance.position; top = entrance.topY; }
      else {
        const p = pitPlacement(data.PitMapX, data.PitMapY);
        x = p.x; z = p.z; top = f32(surface - data.ReturnPitDepth);
      }
      place = [x, f32(top + 0.25), z];   // the capsule's bottom 0.25 m over the box (height / 2 - centre.y is the feet)
    }
    if (place) player.placeFeet(place);
    else if (surface != null) player.placeCentreY(f32(surface - 0.1));   // the transform's height alone (the controller's centre): 0.1 under the surface
    player.clearFallingDamage();
    transitioning = false;
  }

  return {
    /** OceanHoles.Update's dungeon half, then LateUpdate's presentation. */
    update() {
      if (data.Active && isLoadedTemplateDungeon() && !isPlayerAtTemplateLocation()) clearAbyssState();   // ReleaseStaleAbyssContext
      reactivateRecalledAbyss();
      refreshRecallBinding();
      const t = nowSeconds();
      if (data.Active && t >= nextNameRefresh) {
        nextNameRefresh = t + 1;
        if (isBoundAbyssDungeon()) {   // ApplyAbyssName
          const d = modes.dungeon();
          if (d && player.isInsideDungeon()) renameDungeon(d, data.DungeonName);
          renameGpsLocation(gpsName());
        }
      }
    },
    /**
     * LateUpdate's presentation while the player is in the bound abyss, or
     * null (RestoreAbyssPresentation: every override taken back). `saved`
     * is what the overrides replaced, read the first frame they applied:
     * the UnderwaterFog's waterFogColor and PlayerAmbientLight's
     * DungeonAmbientLight (the port always has the component, so
     * ApplyAbyssAmbientLight's other arm - RenderSettings.ambientLight alone -
     * never runs). The water fog: its colour toward the abyss's, 85% of the
     * way at the darkness slider's midpoint and on to black at its top, its
     * density's ceiling the intensity slider's 0.25 at the midpoint; the
     * dungeon's ambient toward AbyssAmbientLight the same way, the render
     * ambient that times DungeonAmbientLightScale; the sun's indirect light
     * off, the Light spell's candle at half its intensity and range, and the
     * player's torch put out.
     * @param {{fogColor: number[], dungeonAmbient: number[]}} saved
     * @param {number} dungeonAmbientLightScale - DaggerfallUnity.Settings.DungeonAmbientLightScale
     */
    presentation(saved, dungeonAmbientLightScale) {
      if (!data.Active || !isBoundAbyssDungeon()) return null;
      const s = settings();
      const midpoint = colorLerp(saved.fogColor, ABYSS_FOG_COLOR, ABYSS_FOG_BLEND_AT_MIDPOINT);
      const ambient = getMidpointColor(s.dungeonVisualDarkness, saved.dungeonAmbient, ABYSS_AMBIENT_LIGHT, BLACK);
      return {
        fogColor: getMidpointColor(s.dungeonVisualDarkness, saved.fogColor, midpoint, BLACK),
        fogDensityMax: getScaledSliderValue(s.dungeonVisualIntensity, ABYSS_FOG_DENSITY_AT_MIDPOINT),
        dungeonAmbient: ambient,
        renderAmbient: [f32(ambient[0] * dungeonAmbientLightScale), f32(ambient[1] * dungeonAmbientLightScale), f32(ambient[2] * dungeonAmbientLightScale), f32(ambient[3] * dungeonAmbientLightScale)],
        indirect: 0, magicLightScale: ABYSS_MAGIC_LIGHT_SCALE, torchOff: true,
      };
    },
    tryEnterPit,
    /** DaggerfallDungeon.OnSetDungeon: while the abyss builds, flooded, renamed and its enemies the deep's. */
    onDungeonSet(d) {
      if (!buildingAbyss || !d) return undefined;
      waterizeDungeon(d);
      renameDungeon(d, data.DungeonName);
      processAbyssEnemies(d, true);
      return d.settle?.();   // the host stands the dungeon once the replacements have their bodies
    },
    /** OnTransitionDungeonInterior. */
    onDungeonEntered(d) {
      if (!entryPending) {
        if (data.Active && !isBoundAbyssDungeon()) clearAbyssState();
        return;
      }
      entryPending = false;
      transitioning = false;
      data.Active = true;
      prepareAbyssDungeon(d);
      hud(`You descend into ${data.DungeonName}.`, 4);
    },
    /** OnTransitionDungeonExterior: out of the abyss, the teleport back to the pit (a respawn clears it instead). */
    onDungeonExited() {
      if (!data.Active) return false;
      if (player.isRespawning()) { clearAbyssState(); return false; }
      captureCurrentRecallBinding();
      const x = data.ReturnWorldX, z = data.ReturnWorldZ, name = data.DungeonName;
      data.Active = false;
      entryPending = false;
      transitioning = true;
      renameGps(null, null);
      modes.dungeon()?.setBlockWaterLevel?.(NO_WATER_LEVEL);   // playerEnterExit.blockWaterLevel = 10000 (no dungeon stands by now: nothing to write)
      // TeleportToWorldCoordinates, a frame on - the port's exit is still unwinding when this is heard
      const back = waitFrame().then(() => teleportToWorld(x, z)).then(() => restoreOceanPosition(x, z, true))
        .catch((e) => { transitioning = false; console.warn('[ocean-holes] the way back to the pit failed - the swimmer stays where the door left them:', e?.message ?? e); });   // AUDIT PRE-MERGE 0928 H/S: the host drops this promise - a teleport that failed left `transitioning` up (no pit would open again) and its rejection unheard
      hud(`You rise from ${name}.`, 3);
      return back;
    },
    /** OnFailedTransition: a door that never opened returns the swimmer to where they were. */
    onTransitionFailed() {
      if (!entryPending) return false;
      return transitionFailed();
    },
    /** OnRespawnerComplete: a load or a respawn anywhere but the bound abyss clears it. */
    onRespawnerComplete() {
      if (!data.Active) return;
      if (player.loadInProgress() || !isBoundAbyssDungeon()) clearAbyssState();
    },
    /** GameManager.OnEnemySpawn: in the abyss, a new enemy is processed (and the quota kept, outside the build). */
    onEnemySpawned(d, foe) {
      if (player.loadInProgress() || !shouldAffectDungeon(d)) return undefined;
      processAbyssEnemy(d, foe, true);
      if (!buildingAbyss) ensureAquaticEnemyQuota(d);
      return d.settle?.();
    },
    /** ShouldUpgradeLoot: the abyss building, bound, or a Recall landing in it. */
    shouldUpgradeLoot() { return buildingAbyss || (data.Active && isBoundAbyssDungeon()) || isPendingAbyssRecall(); },
    onNewGame() { data = newAbyssSaveData(); buildingAbyss = false; entryPending = false; transitioning = false; renameGps(null, null); },
    /** OnMapPixelChanged: the GPS's name kept while entering or bound. */
    onMapPixelChanged() { if (entryPending || (data.Active && isBoundAbyssDungeon())) renameGpsLocation(gpsName()); },
    // IHasModSaveData
    newSaveData: () => newAbyssSaveData(),
    getSaveData() { refreshRecallBinding(); return JSON.parse(JSON.stringify(data)); },
    /** RestoreSaveData: a load inside the template's dungeon keeps the abyss; anywhere else drops it. */
    restoreSaveData(saved) {
      data = restoredData(saved);
      buildingAbyss = false;
      entryPending = false;
      transitioning = false;
      if (!data.Active) { renameGps(null, null); return; }
      if (!isLoadedTemplateDungeon()) { data.Active = false; renameGps(null, null); return; }
      const d = modes.dungeon();
      prepareAbyssDungeon(d);
      waitFrame().then(() => { if (data.Active && player.isInsideDungeon()) prepareAbyssDungeon(modes.dungeon()); });   // RefreshRestoredDungeon
    },
    /** AUDIT OH-F B2: DFU destroys the dungeon and builds it again on every load (PlayerEnterExit.cs:453-457); the
     *  port patches a same-dungeon load in place, which cannot undo a drowning - so a load the abyss stands in (the
     *  live dungeon its own, or the save's record Active) is the world host's rebuild. */
    loadRebuilds: (saved) => buildingAbyss || entryPending || data.Active || !!saved?.Active,
    get data() { return data; },
    get active() { return data.Active; },
    get transitioning() { return transitioning; },
    /** AUDIT OH-F B4: the descent in hand - TryEnterPit's GPS move and door, ONE frame in DFU; here they await. */
    get entering() { return entryPending; },
    /** AUDIT OH-F B5: the drowned dungeon's door - the pit it was entered by (its world coordinates and pixel), or
     *  null outside it. The port's online respawn reads it: a dungeon death wakes at the dungeon's door. */
    returnPoint: () => (data.Active ? { worldX: data.ReturnWorldX, worldZ: data.ReturnWorldZ, pixel: { x: data.PitMapX, y: data.PitMapY } } : null),
    /** ...and stands the swimmer there as the way up does (RestoreOceanPosition, returnToPit). */
    standAtPit: (r) => restoreOceanPosition(r.worldX, r.worldZ, true),
    get buildingAbyss() { return buildingAbyss; },
    isBoundAbyssDungeon: () => isBoundAbyssDungeon(),
    ensureAquaticEnemyQuota,
    processAbyssEnemy,
    isEligibleUnderwaterReplacement,
  };

  /** ShouldAffectDungeonObject: building, or bound - and the object the live dungeon's. */
  function shouldAffectDungeon(d) {
    if (!buildingAbyss && (!data.Active || !isBoundAbyssDungeon())) return false;
    return !!d && modes.dungeon() === d;
  }
}
