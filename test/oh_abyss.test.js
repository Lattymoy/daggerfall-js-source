// OH-D / OH-E (2026-09-26) - THE ABYSS (src/scenes/oceanHolesAbyss.js) against
// the assembly's OceanHoles dungeon half: TryEnterPit's gates and the save data
// it writes, the GPS moved and renamed, OnSetDungeon's flood / rename / enemies
// while the abyss builds, OnTransitionDungeonInterior's arrival (PrepareAbyssDungeon,
// the HUD line), OnTransitionDungeonExterior's way back up (RestoreOceanPosition on
// the entrance, by the recorded depth, or at the surface), OnFailedTransition,
// OnRespawnerComplete, RestoreSaveData and RefreshRestoredDungeon, the Recall
// binding (captured, dropped, reactivated, IsPendingAbyssRecall), ProcessAbyssEnemy's
// gates and EnsureAquaticEnemyQuota's two passes, LateUpdate's presentation and
// ShouldUpgradeLoot; then the loot pair (AddBonusMagicLoot, UpgradeLoot) against
// the mod's own OceanHolesDiagnosticsRunner case, the arrow its group-index test
// lets through, and the two events that carry them (LootTables / EnemyEntity
// OnLootSpawned).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createOceanHolesAbyss, newAbyssSaveData, matchesRecallAnchor } from '../src/scenes/oceanHolesAbyss.js';
import {
  buildDungeonName, buildGpsDungeonName, getAbyssMapId, tryGetTemplateSavePosition, abyssWaterLevel, enemyHash,
  tryPickUnderwaterEnemy, isDungeonLightFixture, ABYSS_FOG_COLOR, ABYSS_AMBIENT_LIGHT, addBonusMagicLoot, upgradeLoot,
} from '../src/world/oceanHoles.js';
import { mapPixelToLongitudeLatitude, mapPixelToWorldCoord, worldCoordToMapPixel } from '../src/formats/mapsFile.js';
import { enemyRoster } from '../src/world/underwaterEnemies.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';
import { SITE_TYPES } from '../src/systems/quest/place.js';
import { createWeapon, weaponOfMaterial, armorOfMaterial } from '../src/combat/enemyEquipment.js';
import { mintCondition, setItemFields, templateByIndex, itemBaseValue } from '../src/systems/itemTemplates.js';
import { isEnchanted, ARROW_TEMPLATE } from '../src/systems/inventory.js';
import { clampArmorVariant } from '../src/systems/armorMaterials.js';
import { valueMultipliersByMaterial, conditionMultipliersByMaterial } from '../src/characters/weapons.js';
import { lootMatrix, LOOT_MATRICES, tableLootSpawned, addPileLootExtras } from '../src/systems/loot.js';
import { enemyLootSpawned } from '../src/characters/enemyEntity.js';
import { spawnEnemyLoot } from '../src/scenes/hostCombat.js';
import { equipTableOf } from '../src/systems/equip.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { _resetForTests } from '../src/systems/uiPrefs.js';
import { rriLootMatrix } from '../src/systems/rriRealism.js';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';

const f32 = Math.fround;
const PIT = { x: 392, y: 338 };
const NO_WATER = 10000;

/** Unity's Color.Lerp, restated: t clamped, each channel a + (b - a) * t in floats. */
const lerp = (a, b, t) => { const u = f32(Math.min(1, Math.max(0, t))); return a.map((v, i) => f32(v + f32(f32(b[i] - v) * u))); };
/** GetMidpointColor, restated: the slider's lower half low -> midpoint, its upper midpoint -> high. */
const midpointColor = (s, low, mid, high) => (s <= 0.5 ? lerp(low, mid, f32(s / 0.5)) : lerp(mid, high, f32(f32(s - 0.5) / 0.5)));

/** A dungeon location at (px, py), as MapsFile hands one over. */
function loc(px, py, { type = 6, blocks = 3, mapId = 5000, name = 'Template Crypt', regionIndex = 0, locationIndex = 0 } = {}) {
  const ll = mapPixelToLongitudeLatitude(px, py);
  return {
    loaded: true, hasDungeon: true, name, regionIndex, locationIndex,
    mapTableData: { mapId, longitude: ll.x, latitude: ll.y, dungeonType: type },
    exterior: { exteriorData: { width: 1, height: 1, blockNames: ['RESIAA00.RMB'] } },
    dungeon: { blocks: Array.from({ length: blocks }, (_, i) => ({ blockName: `B${i}.RDB`, waterLevel: NO_WATER })) },
  };
}

/** An enemy record and the view ProcessAbyssEnemy reads (dungeonContext.js abyssFoeView's shape). */
function foe(mobileType, { loadID = 1, health = 20, quest = false, demo = true, wasHumanoid = false } = {}) {
  const rec = { mobileType, entity: { health }, dead: false, src: { loadID }, questBehaviour: quest ? {} : null, abyssWasHumanoid: wasHumanoid };
  return rec;
}
const viewOf = (rec, demo = true) => ({
  rec,
  get entity() { return rec.entity; },
  get dead() { return !!rec.dead; },
  get mobileType() { return rec.retypedTo ?? rec.mobileType; },
  get isClass() { const t = rec.retypedTo ?? rec.mobileType; return t >= 128 && t <= 146; },
  get loadID() { return rec.src?.loadID ?? 0; },
  get questSpawn() { return !!rec.questBehaviour; },
  demo,
  get abyssWasHumanoid() { return !!rec.abyssWasHumanoid; },
  get retypedTo() { return rec.retypedTo; },
});

/** The live dungeon's abyss seams (dungeonContext.js `abyss` + world.js removeQuestResources), over a location. */
function fakeDungeon(location, { foes = [], startY = 10, top = 30, log = [] } = {}) {
  let name = location.name, mapId = location.mapTableData.mapId;
  return {
    log, recs: foes,
    location: () => ({ regionIndex: location.regionIndex, locationIndex: location.locationIndex }),
    summaryName: () => name,
    summaryId: () => mapId,
    rename(n, id) { name = n; mapId = id; log.push(['rename', n, id]); },
    startMarkerY: () => startY,
    maxMeshTopY: () => top,
    originY: () => 0,
    setAllBlockWaterLevels(level) { log.push(['flood', level]); },
    setBlockWaterLevel(level) { log.push(['blockWater', level]); },
    foes: () => foes.filter((f) => !f.dead && f.entity).map((f) => viewOf(f)),
    destroyFoe(v) { v.rec.dead = true; v.rec.destroyed = true; log.push(['destroy', v.rec.mobileType]); },
    replaceFoe(v, type, { wasHumanoid = false } = {}) { v.rec.retypedTo = type; v.rec.abyssWasHumanoid = !!v.rec.abyssWasHumanoid || wasHumanoid; log.push(['replace', v.rec.mobileType, type]); },
    settle() { for (const f of foes) if (f.retypedTo != null) { f.mobileType = f.retypedTo; f.retypedTo = undefined; } log.push(['settle']); return Promise.resolve(); },
    removeQuestResources() { log.push(['questResources']); },
    removeLightFixtures(isFixture) { log.push(['lights', isFixture === isDungeonLightFixture]); },
  };
}

/**
 * The abyss over a fake world: the GPS a pair of world coordinates, the pit
 * standing at PIT (its entrance 150 m under a sea at y 34), a map of one
 * region holding `template`, and worldModes' TransitionDungeonInterior as
 * enterAbyss: OnSetDungeon (awaited), the player inside, OnTransitionDungeonInterior.
 */
function world({ template = loc(100, 100), foes = [], swimming = true, entrance = true, surface = 34, entranceTop = -150, enter = 'ok', settings = { dungeonVisualIntensity: 0.5, dungeonVisualDarkness: 0.5 } } = {}) {
  const log = [];
  const pitCorner = mapPixelToWorldCoord(PIT.x, PIT.y);
  const gps = { x: pitCorner.x + 20000, z: pitCorner.y + 12000 };
  const P = { inside: false, insideDungeon: false, swimming, anchor: null, teleported: false, respawning: false, loading: false };
  let live = null;   // PlayerEnterExit.Dungeon
  let time = 0;
  const w = { log, gps, P, template, dungeons: [], get live() { return live; }, set live(d) { live = d; }, tick: (s) => { time += s; }, pitShown: entrance };
  const regions = [[template]];
  const deps = {
    settings: () => settings,
    maps: { regionCount: 1, locationCount: (r) => regions[r].length, location: (r, i) => regions[r][i] },
    siteLinks: (siteType, mapId) => { w.siteAsked = [siteType, mapId]; return []; },
    isMainStoryDungeon: () => false,
    gps: {
      worldX: () => gps.x, worldZ: () => gps.z,
      currentMapPixel: () => worldCoordToMapPixel(gps.x, gps.z),
      currentLocation: () => null,
    },
    teleportToWorld: async (x, z) => { log.push(['teleport', x, z]); gps.x = x; gps.z = z; return true; },
    renameGps: (name, mapId) => log.push(['gpsName', name, mapId]),
    player: {
      isInside: () => P.inside || P.insideDungeon,
      isInsideDungeon: () => P.insideDungeon,
      isSwimming: () => P.swimming,
      anchor: () => P.anchor,
      teleportedIntoDungeon: () => P.teleported,
      isRespawning: () => P.respawning,
      loadInProgress: () => P.loading,
      placeFeet: (p) => log.push(['feet', ...p]),
      placeCentreY: (y) => log.push(['centreY', y]),
      clearFallingDamage: () => log.push(['clearFall']),
    },
    modes: {
      async enterAbyss(clone) {
        log.push(['enter', clone.name]);
        w.clone = clone;
        if (enter === 'fail') { await w.abyss.onTransitionFailed(); return false; }
        if (enter === 'refuse') return false;
        const d = fakeDungeon(clone, { foes, log });
        w.dungeons.push(d);
        live = d;
        w.buildingSeen = w.abyss.buildingAbyss;
        w.upgradeSeen = w.abyss.shouldUpgradeLoot();
        await w.abyss.onDungeonSet(d);
        P.insideDungeon = true;
        w.abyss.onDungeonEntered(d);
        return true;
      },
      dungeon: () => live,
    },
    pitEntrance: (x, y) => (w.pitShown && x === PIT.x && y === PIT.y && worldCoordToMapPixel(gps.x, gps.z).x === PIT.x ? { position: [555, entranceTop - 0.175, 588], topY: entranceTop } : null),
    oceanSurfaceY: (x, y) => (worldCoordToMapPixel(gps.x, gps.z).x === x && worldCoordToMapPixel(gps.x, gps.z).y === y ? surface : null),
    pitPlacement: () => ({ x: 600, z: 610 }),
    terrainReady: () => true,
    hud: (text, seconds) => log.push(['hud', text, seconds]),
    roster: () => enemyRoster(),
    nowSeconds: () => time,
    waitFrame: () => Promise.resolve(),
  };
  w.abyss = createOceanHolesAbyss(deps);
  return w;
}
const entries = (log, kind) => log.filter((e) => e[0] === kind);

// ── the way down ─────────────────────────────────────────────────────────

test('OH-D TryEnterPit\'s gates, in the C#\'s order: a swimmer outside, a template found - else the refusal line', async () => {
  const dry = world({ swimming: false });
  assert.equal(await dry.abyss.tryEnterPit(PIT.x, PIT.y), false);
  assert.deepEqual(dry.log, [], 'not swimming: nothing at all');
  const inside = world();
  inside.P.inside = true;
  assert.equal(await inside.abyss.tryEnterPit(PIT.x, PIT.y), false);
  assert.deepEqual(inside.log, [], 'inside: nothing');
  const none = world({ template: loc(100, 100, { blocks: 1 }) });
  assert.equal(await none.abyss.tryEnterPit(PIT.x, PIT.y), false);
  assert.deepEqual(none.log, [['hud', 'The darkness below refuses to open.', 3]], 'no template: the one line, three seconds, no move');
  const w = world();
  assert.equal(await w.abyss.tryEnterPit(PIT.x, PIT.y), true);
  const n = w.log.length;
  assert.equal(await w.abyss.tryEnterPit(PIT.x, PIT.y), false, 'data.Active: a second touch is nothing');
  assert.equal(w.log.length, n);
});

test('OH-D TryEnterPit writes OceanHoleSaveData and moves the GPS to the template\'s save position before the door', async () => {
  const w = world();
  const start = { ...w.gps };
  await w.abyss.tryEnterPit(PIT.x, PIT.y);
  const d = w.abyss.data;
  const save = tryGetTemplateSavePosition(w.template);
  const tp = worldCoordToMapPixel(save.x, save.y);
  const name = buildDungeonName(PIT.x, PIT.y);
  assert.deepEqual({ ...d, RecallBinding: d.RecallBinding }, {
    Active: true, PitMapX: PIT.x, PitMapY: PIT.y, ReturnWorldX: start.x, ReturnWorldZ: start.z,
    HasReturnPitDepth: true, ReturnPitDepth: f32(34 - -150),
    TemplateRegionIndex: 0, TemplateLocationIndex: 0, TemplateMapX: tp.x, TemplateMapY: tp.y,
    DungeonName: name, RecallBinding: null,
  });
  // the order: the teleport (PlayerGPS.WorldX/Z + UpdateWorldInfo), the GPS's name, then the door
  const kinds = w.log.map((e) => e[0]);
  assert.deepEqual(w.log[0], ['teleport', save.x, save.y]);
  assert.deepEqual(w.log[1], ['gpsName', buildGpsDungeonName(name, PIT.x, PIT.y), getAbyssMapId(PIT.x, PIT.y)]);
  assert.equal(kinds[2], 'enter');
  assert.equal(w.clone.name, name, 'CloneDungeon renames the copy');
  assert.deepEqual(w.siteAsked, [SITE_TYPES.Dungeon, w.template.mapTableData.mapId], 'GetSiteLinks(SiteTypes.Dungeon, the template\'s MapId)');
  assert.equal(w.template.name, 'Template Crypt', 'the template keeps its own');
  assert.notEqual(w.clone.dungeon.blocks, w.template.dungeon.blocks);
  assert.equal(w.buildingSeen, true, 'buildingAbyss holds through TransitionDungeonInterior');
  assert.equal(w.upgradeSeen, true, 'ShouldUpgradeLoot while it builds');
  assert.equal(w.abyss.buildingAbyss, false, 'and drops in its finally');
  assert.equal(w.abyss.transitioning, false);
  // a pit whose entrance is not standing records no depth
  const blind = world({ entrance: false });
  await blind.abyss.tryEnterPit(PIT.x, PIT.y);
  assert.equal(blind.abyss.data.HasReturnPitDepth, false);
  assert.equal(blind.abyss.data.ReturnPitDepth, 0);
  const shallow = world({ surface: 34, entranceTop: 33.6 });
  await shallow.abyss.tryEnterPit(PIT.x, PIT.y);
  assert.equal(shallow.abyss.data.HasReturnPitDepth, false, 'a depth of 0.5 m or less is none');
});

test('OH-D OnSetDungeon while the abyss builds: WaterizeDungeon, RenameDungeon, ProcessAbyssEnemies (replacement allowed); the arrival prepares it again', async () => {
  const fire = foe(MOBILE_TYPES.FireDaedra, { loadID: 7 });
  const mage = foe(MOBILE_TYPES.Mage, { loadID: 9 });
  const magePick = tryPickUnderwaterEnemy(enemyHash(PIT.x, PIT.y, 9), true, false, enemyRoster());
  const aquaPick = tryPickUnderwaterEnemy(enemyHash(PIT.x, PIT.y, 9), false, true, enemyRoster());
  const w = world({ foes: [fire, mage] });
  await w.abyss.tryEnterPit(PIT.x, PIT.y);
  const d = w.dungeons[0];
  const level = abyssWaterLevel(10, 30, 0);
  const name = w.abyss.data.DungeonName, id = getAbyssMapId(PIT.x, PIT.y);
  const after = w.log.slice(w.log.findIndex((e) => e[0] === 'enter') + 1);
  // OnSetDungeon: flood (the live dungeon's block too), rename, the flame foe destroyed
  // ...and the mage made one of the deep's undead, then - EnsureAquaticEnemyQuota's humanoid pass, one living foe wanting
  // ceil(0.3f) = 1 aquatic - one of its aquatic kinds, off the whole hash
  assert.deepEqual(after.slice(0, 6), [['flood', level], ['blockWater', level], ['rename', name, id], ['destroy', MOBILE_TYPES.FireDaedra],
    ['replace', MOBILE_TYPES.Mage, magePick], ['replace', MOBILE_TYPES.Mage, aquaPick]]);
  assert.ok(magePick != null && aquaPick != null, 'the fixture: the mage has both picks');
  assert.equal(mage.mobileType, aquaPick, 'the last type stood (settle) before the dungeon goes live');
  assert.equal(entries(w.log, 'replace').length, 2, 'the arrival\'s pass replaces nothing more: no replacement allowed, the quota met');
  // OnTransitionDungeonInterior: PrepareAbyssDungeon - flood, rename, the GPS's name, the borrowed quest resources, the lights
  const arrival = after.slice(after.findIndex((e, i) => i > 5 && e[0] === 'flood'));
  assert.deepEqual(arrival.slice(0, 6).map((e) => e[0]), ['flood', 'blockWater', 'rename', 'gpsName', 'questResources', 'lights']);
  assert.deepEqual(arrival[5], ['lights', true], 'RemoveDungeonLightFixtures with IsDungeonLightFixture');
  assert.deepEqual(entries(w.log, 'hud').at(-1), ['hud', `You descend into ${name}.`, 4]);
  assert.equal(d.summaryName(), name);
  assert.equal(d.summaryId(), id);
  assert.equal(w.abyss.isBoundAbyssDungeon(), true);
  // outside a build OnSetDungeon touches nothing
  const other = fakeDungeon(loc(5, 5));
  assert.equal(w.abyss.onDungeonSet(other), undefined);
  assert.deepEqual(other.log, []);
});

test('OH-D a door that never opened: OnFailedTransition, and the port\'s own refusals answered as though it had been raised', async () => {
  for (const enter of ['fail', 'refuse']) {
    const w = world({ enter });
    const start = { ...w.gps };
    assert.equal(await w.abyss.tryEnterPit(PIT.x, PIT.y), false, enter);
    assert.equal(w.abyss.active, false);
    assert.equal(w.abyss.transitioning, false, `${enter}: never left entering`);
    const tele = entries(w.log, 'teleport');
    assert.deepEqual(tele.at(-1), ['teleport', start.x, start.z], `${enter}: back to ReturnWorldX/Z`);
    assert.deepEqual(entries(w.log, 'centreY'), [['centreY', f32(34 - 0.1)]], `${enter}: RestoreOceanPosition(returnToPit false) - 0.1 m under the surface`);
    assert.ok(entries(w.log, 'gpsName').some((e) => e[1] === null), `${enter}: the GPS's name dropped`);
    assert.ok(entries(w.log, 'clearFall').length === 1);
  }
  const w = world();
  assert.equal(w.abyss.onTransitionFailed(), false, 'no entry pending: not ours');
});

// ── the way up ───────────────────────────────────────────────────────────

test('OH-D OnTransitionDungeonExterior: back at the pit\'s world coordinates, stood on its entrance - by the recorded depth when it is not up, at the surface when nothing is', async () => {
  const w = world();
  await w.abyss.tryEnterPit(PIT.x, PIT.y);
  const { ReturnWorldX: rx, ReturnWorldZ: rz, DungeonName: name } = w.abyss.data;
  w.P.insideDungeon = false;
  w.live = null;
  const n = w.log.length;
  const back = w.abyss.onDungeonExited();
  assert.equal(w.abyss.active, false);
  assert.equal(w.abyss.transitioning, true, 'transitioning while the world comes back');
  assert.deepEqual(w.log.slice(n).filter((e) => e[0] === 'hud'), [['hud', `You rise from ${name}.`, 3]]);
  await back;
  const tail = w.log.slice(n).filter((e) => e[0] !== 'hud' && e[0] !== 'gpsName');
  assert.deepEqual(tail, [['teleport', rx, rz], ['feet', 555, f32(-150 + 0.25), 588], ['clearFall']], 'the capsule\'s bottom 0.25 m over the box');
  assert.equal(w.abyss.transitioning, false);
  // the entrance not standing: after the 30-frame grace, PlacementFraction's spot at the recorded depth
  const d2 = world();
  await d2.abyss.tryEnterPit(PIT.x, PIT.y);
  d2.P.insideDungeon = false; d2.live = null; d2.pitShown = false;
  await d2.abyss.onDungeonExited();
  assert.deepEqual(entries(d2.log, 'feet'), [['feet', 600, f32(f32(34 - d2.abyss.data.ReturnPitDepth) + 0.25), 610]]);
  // no depth and no entrance: the surface
  const d3 = world({ entrance: false });
  await d3.abyss.tryEnterPit(PIT.x, PIT.y);
  d3.P.insideDungeon = false; d3.live = null;
  await d3.abyss.onDungeonExited();
  assert.deepEqual(entries(d3.log, 'feet'), []);
  assert.deepEqual(entries(d3.log, 'centreY'), [['centreY', f32(34 - 0.1)]]);
  // a respawn out of the abyss clears it and moves nothing
  const r = world();
  await r.abyss.tryEnterPit(PIT.x, PIT.y);
  r.P.respawning = true;
  const m = r.log.length;
  assert.equal(r.abyss.onDungeonExited(), false);
  assert.equal(r.abyss.active, false);
  assert.deepEqual(r.log.slice(m).map((e) => e[0]), ['blockWater', 'gpsName'], 'ClearAbyssState: the block\'s water off, the name dropped');
  assert.equal(world().abyss.onDungeonExited(), false, 'not active: not ours');
});

// ── the binding, the respawner, the load ─────────────────────────────────

test('OH-D the Recall binding: an anchor set in the bound abyss is captured, survives the exit while it still matches, and brings the abyss back on a Recall into the template', async () => {
  const w = world();
  await w.abyss.tryEnterPit(PIT.x, PIT.y);
  const at = { ...w.gps };
  w.P.anchor = { insideDungeon: true, worldPosX: at.x, worldPosZ: at.z, position: [4, 1, 9] };
  w.abyss.update();
  const b = w.abyss.data.RecallBinding;
  assert.ok(b, 'RefreshRecallBinding -> CaptureCurrentRecallBinding');
  assert.deepEqual([b.AnchorWorldX, b.AnchorWorldZ, b.AnchorPosition, b.PitMapX, b.PitMapY, b.DungeonName], [at.x, at.z, [4, 1, 9], PIT.x, PIT.y, w.abyss.data.DungeonName]);
  assert.equal(matchesRecallAnchor(b, { ...w.P.anchor, position: [4.05, 1.05, 9.05] }), true, 'within 0.1 m');
  assert.equal(matchesRecallAnchor(b, { ...w.P.anchor, position: [4, 1.1, 9] }), false, 'the square\'s bound is strict: 1.1f - 1 is over 0.1');
  assert.equal(matchesRecallAnchor(b, { ...w.P.anchor, position: [4.1, 1, 9] }), true, 'in floats: 4.1f is under 4.1, and its square under 0.01f');
  assert.equal(matchesRecallAnchor(b, { ...w.P.anchor, insideDungeon: false }), false);
  assert.equal(matchesRecallAnchor(b, { ...w.P.anchor, worldPosX: at.x + 1 }), false);
  // the way up; the binding stays while the anchor matches
  w.P.insideDungeon = false; w.live = null;
  await w.abyss.onDungeonExited();
  w.abyss.update();
  assert.ok(w.abyss.data.RecallBinding, 'kept');
  // the Recall: the respawner lays out the template's own dungeon at its pixel - PlayerEnterExit.Dungeon is assigned
  // before SetDungeon, so while the layout rolls its loot the dungeon is only its summary (world.js ohLayingOutOf)
  w.gps.x = at.x; w.gps.z = at.z;
  w.P.respawning = true; w.P.teleported = true;
  w.live = { location: () => ({ regionIndex: 0, locationIndex: 0 }), summaryName: () => w.template.name, summaryId: () => w.template.mapTableData.mapId };
  assert.equal(w.abyss.shouldUpgradeLoot(), true, 'IsPendingAbyssRecall while it is laid out: the piles and foes it rolls are the abyss\'s');
  w.abyss.update();
  assert.equal(w.abyss.active, false, 'nothing reactivates before the player is inside');
  const d = fakeDungeon(w.template, { log: w.log });
  w.live = d; w.P.insideDungeon = true;
  assert.equal(w.abyss.shouldUpgradeLoot(), true, 'IsPendingAbyssRecall: the loot rolled on the way in is the abyss\'s');
  w.P.loading = true;
  assert.equal(w.abyss.shouldUpgradeLoot(), false, 'never during a load');
  w.P.loading = false;
  w.P.respawning = false;
  w.P.anchor = null;   // consumed on arrival
  const n = w.log.length;
  w.abyss.update();
  assert.equal(w.abyss.active, true, 'ReactivateRecalledAbyss');
  assert.equal(w.abyss.data.RecallBinding, null, 'ApplyRecallBinding clears it');
  assert.deepEqual(w.log.slice(n).map((e) => e[0]).slice(0, 6), ['flood', 'blockWater', 'rename', 'gpsName', 'questResources', 'lights'], 'PrepareAbyssDungeon, replacement allowed');
  assert.equal(w.abyss.isBoundAbyssDungeon(), true);
  // a binding whose anchor moves on is dropped once the abyss is not active
  const v = world();
  await v.abyss.tryEnterPit(PIT.x, PIT.y);
  v.P.anchor = { insideDungeon: true, worldPosX: v.gps.x, worldPosZ: v.gps.z, position: [0, 0, 0] };
  v.abyss.update();
  v.P.insideDungeon = false; v.live = null;
  await v.abyss.onDungeonExited();
  v.P.anchor = { insideDungeon: false, worldPosX: 1, worldPosZ: 2, position: [0, 0, 0] };
  v.abyss.update();
  assert.equal(v.abyss.data.RecallBinding, null);
});

test('OH-D OnRespawnerComplete, RestoreSaveData and the save: a load or a respawn anywhere but the bound abyss clears it; a load inside the template keeps it', async () => {
  const w = world();
  await w.abyss.tryEnterPit(PIT.x, PIT.y);
  w.abyss.onRespawnerComplete();
  assert.equal(w.abyss.active, true, 'a respawn inside the bound abyss keeps it');
  w.P.loading = true;
  w.abyss.onRespawnerComplete();
  assert.equal(w.abyss.active, false, 'LoadInProgress clears it');
  // the save carries the data (the binding refreshed first) and a load inside the template dungeon restores it
  const v = world();
  await v.abyss.tryEnterPit(PIT.x, PIT.y);
  const saved = v.abyss.getSaveData();
  assert.notEqual(saved, v.abyss.data, 'a copy');
  assert.deepEqual(saved, { ...v.abyss.data });
  const u = world();
  const d = fakeDungeon(u.template, { log: u.log });
  u.live = d; u.P.insideDungeon = true;
  u.gps.x = v.gps.x; u.gps.z = v.gps.z;
  u.abyss.restoreSaveData(saved);
  await Promise.resolve();
  assert.equal(u.abyss.active, true);
  assert.equal(entries(u.log, 'questResources').length, 2, 'PrepareAbyssDungeon, then RefreshRestoredDungeon a frame on');
  assert.equal(u.abyss.isBoundAbyssDungeon(), true, 'renamed back to the abyss');
  // anywhere else the load drops it
  const x = world();
  x.abyss.restoreSaveData(saved);
  assert.equal(x.abyss.active, false);
  assert.deepEqual(x.log, [['gpsName', null, null]]);
  const y = world();
  y.abyss.restoreSaveData({ bogus: 1 });
  assert.deepEqual(y.abyss.data, newAbyssSaveData(), 'a record of the wrong shape is the defaults');
});

test('OH-D Update: ReleaseStaleAbyssContext when the GPS leaves the template\'s pixel; ApplyAbyssName once a second; OnMapPixelChanged and OnTransitionDungeonInterior outside an entry', async () => {
  const w = world();
  await w.abyss.tryEnterPit(PIT.x, PIT.y);
  const n = w.log.length;
  w.abyss.update();
  assert.deepEqual(w.log.slice(n).map((e) => e[0]), ['rename', 'gpsName'], 'the first update names it');
  const m = w.log.length;
  w.tick(0.5); w.abyss.update();
  assert.equal(w.log.length, m, 'not before the second is up');
  w.tick(0.5); w.abyss.update();
  assert.deepEqual(w.log.slice(m).map((e) => e[0]), ['rename', 'gpsName']);
  w.abyss.onMapPixelChanged();
  assert.equal(entries(w.log, 'gpsName').at(-1)[1], buildGpsDungeonName(w.abyss.data.DungeonName, PIT.x, PIT.y));
  // entering some other dungeon while the abyss is active clears it
  const other = fakeDungeon(loc(7, 7, { mapId: 77, regionIndex: 3 }));
  w.live = other;
  w.abyss.onDungeonEntered(other);
  assert.equal(w.abyss.active, false);
  // the GPS moved off the template's pixel while its dungeon is loaded: stale
  const s = world();
  await s.abyss.tryEnterPit(PIT.x, PIT.y);
  s.gps.x += 40000;
  s.abyss.update();
  assert.equal(s.abyss.active, false);
  // a new game resets everything
  const g = world();
  await g.abyss.tryEnterPit(PIT.x, PIT.y);
  g.abyss.onNewGame();
  assert.deepEqual(g.abyss.data, newAbyssSaveData());
  assert.deepEqual(g.log.at(-1), ['gpsName', null, null]);
});

// ── the enemies ──────────────────────────────────────────────────────────

/** The abyss with its pit at PIT and nothing else (RestoreSaveData with Active off sets the data). */
function bare() {
  const w = world();
  w.abyss.restoreSaveData({ ...newAbyssSaveData(), PitMapX: PIT.x, PitMapY: PIT.y });
  return w;
}
/** The first load ids whose enemy hash is, and is not, a multiple of three. */
function loadIds() {
  let third = 0, other = 0;
  for (let id = 1; (!third || !other) && id < 1000; id++) {
    const h = enemyHash(PIT.x, PIT.y, id);
    if (h % 3 === 0) third ||= id; else other ||= id;
  }
  return { third, other };
}

test('OH-E ProcessAbyssEnemy\'s gates in the C#\'s order: the flame foes destroyed; nothing without LoadID, a quest spawn, SetupDemoEnemy, a deep kind, the Seducer, a flyer, no shadow or a glow', () => {
  const { abyss } = bare();
  const d = fakeDungeon(loc(1, 1));
  const run = (rec, allow = true, aquaticOnly = false, demo = true) => { abyss.processAbyssEnemy(d, viewOf(rec, demo), allow, aquaticOnly); return rec; };
  for (const t of [MOBILE_TYPES.FireDaedra, MOBILE_TYPES.FireAtronach, MOBILE_TYPES.Dragonling_Alternate]) {
    assert.equal(run(foe(t), false).destroyed, true, `${t}: destroyed whether or not replacement is allowed`);
  }
  const { third } = loadIds();
  const rat = MOBILE_TYPES.Rat;
  const untouched = (rec) => rec.retypedTo === undefined && !rec.destroyed;
  assert.ok(untouched(run(foe(rat, { loadID: third }), false)), 'no replacement allowed');
  assert.ok(untouched(run(foe(rat, { loadID: 0 }))), 'LoadID 0');
  assert.ok(untouched(run(foe(rat, { loadID: third, quest: true }))), 'QuestSpawn');
  assert.ok(untouched(run(foe(rat, { loadID: third }), true, false, false)), 'no SetupDemoEnemy');
  assert.ok(untouched(run(foe(MOBILE_TYPES.Slaughterfish, { loadID: third }))), 'already one of the deep\'s');
  assert.ok(untouched(run(foe(MOBILE_TYPES.Dreugh, { loadID: third }), true, true)), 'the quota\'s pass: already aquatic');
  assert.ok(untouched(run(foe(MOBILE_TYPES.DaedraSeducer, { loadID: third }))), 'the Seducer (29)');
  assert.ok(untouched(run(foe(MOBILE_TYPES.GiantBat, { loadID: third }))), 'a flyer is not General');
  assert.ok(untouched(run(foe(MOBILE_TYPES.FrostDaedra, { loadID: third }))), 'NoShadow / GlowColor');
  assert.ok(untouched(run({ ...foe(rat, { loadID: third }), entity: null })), 'no EnemyEntity');
  const dead = foe(rat, { loadID: third }); dead.dead = true;
  assert.ok(untouched(run(dead)), 'a corpse');
});

test('OH-E ProcessAbyssEnemy\'s pick: a monster one hash in three (the third of it), a class always (undead only, WasHumanoid), the quota\'s pass the whole hash among the aquatic', () => {
  const { abyss } = bare();
  const d = fakeDungeon(loc(1, 1));
  const roster = enemyRoster();
  const { third, other } = loadIds();
  const rat = foe(MOBILE_TYPES.Rat, { loadID: third });
  abyss.processAbyssEnemy(d, viewOf(rat), true);
  assert.equal(rat.retypedTo, tryPickUnderwaterEnemy(Math.floor(enemyHash(PIT.x, PIT.y, third) / 3), false, false, roster));
  assert.ok(roster.includes(rat.retypedTo));
  assert.equal(rat.abyssWasHumanoid, false);
  // over the first dozen ids the one-in-three admits, the pick is the THIRD of the hash's - never the hash's own
  let differs = 0;
  for (let id = 1, n = 0; n < 12; id++) {
    const h = enemyHash(PIT.x, PIT.y, id);
    if (h % 3 !== 0) continue;
    n++;
    const r = foe(MOBILE_TYPES.Rat, { loadID: id });
    abyss.processAbyssEnemy(d, viewOf(r), true);
    assert.equal(r.retypedTo, tryPickUnderwaterEnemy(Math.floor(h / 3), false, false, roster), `load id ${id}`);
    if (r.retypedTo !== tryPickUnderwaterEnemy(h, false, false, roster)) differs++;
  }
  assert.ok(differs > 0, 'the fixture tells the third from the whole');
  const spared = foe(MOBILE_TYPES.Rat, { loadID: other });
  abyss.processAbyssEnemy(d, viewOf(spared), true);
  assert.equal(spared.retypedTo, undefined, 'two monsters in three stay');
  for (const t of [MOBILE_TYPES.Mage, MOBILE_TYPES.Knight_CityWatch]) {
    const cls = foe(t, { loadID: other });
    abyss.processAbyssEnemy(d, viewOf(cls), true);
    const pick = tryPickUnderwaterEnemy(enemyHash(PIT.x, PIT.y, other), true, false, roster);
    assert.equal(cls.retypedTo, pick, `${t}: every class, the whole hash, undead only (the watch's Guard behaviour passes)`);
    if (pick != null) assert.equal(cls.abyssWasHumanoid, true);
  }
  const q = foe(MOBILE_TYPES.Rat, { loadID: other });
  abyss.processAbyssEnemy(d, viewOf(q), true, true);
  assert.equal(q.retypedTo, tryPickUnderwaterEnemy(enemyHash(PIT.x, PIT.y, other), false, true, roster), 'aquaticOnly: no one-in-three');
  // the hash's 64-bit load id: the low and high words each XORed into its axis
  assert.equal(enemyHash(PIT.x, PIT.y, 2 ** 32 + 5), enemyHash(PIT.x, PIT.y ^ 1 ^ 1, 2 ** 32 + 5));
  assert.notEqual(enemyHash(PIT.x, PIT.y, 2 ** 32 + 5), enemyHash(PIT.x, PIT.y, 5), 'the high word counts');
});

test('OH-E EnsureAquaticEnemyQuota: CeilToInt(living x 0.3f) aquatic - in floats (ten foes want three, not four), those never humanoid first, then the ones that were', () => {
  const { abyss } = bare();
  // ten living non-flame foes: 3.0000001192... rounds to 3f, so the quota is 3
  const recs = [];
  for (let id = 1; recs.length < 10; id++) recs.push(foe(MOBILE_TYPES.Rat, { loadID: id }));
  recs[0].mobileType = MOBILE_TYPES.Slaughterfish;   // one aquatic already
  const flame = foe(MOBILE_TYPES.FireDaedra, { loadID: 999 });
  const d = fakeDungeon(loc(1, 1), { foes: [...recs, flame] });
  abyss.ensureAquaticEnemyQuota(d);
  const aquatic = recs.filter((r) => [MOBILE_TYPES.Slaughterfish, MOBILE_TYPES.Lamia, MOBILE_TYPES.Dreugh].includes(r.retypedTo ?? r.mobileType));
  assert.equal(aquatic.length, 3, 'three, the float quota - 10 x 0.3f unrounded to a float (3.0000001) would ask four');
  // restated: the first pass walks the never-humanoid in order, each given the aquatic pick of its whole hash
  const roster = enemyRoster();
  const expected = [];
  for (const r of recs.slice(1)) {
    if (expected.length >= 2) break;
    const pick = tryPickUnderwaterEnemy(enemyHash(PIT.x, PIT.y, r.src.loadID), false, true, roster);
    if (pick != null) expected.push([r.src.loadID, pick]);
  }
  assert.deepEqual(recs.filter((r) => r.retypedTo != null).map((r) => [r.src.loadID, r.retypedTo]), expected);
  assert.equal(flame.retypedTo, undefined, 'the flame foe is never counted or changed');
  // fifty living: 50 x 0.3f is 15.000000953674316 as a float, over 15 - CeilToInt asks sixteen (doubles' 50 x 0.3 would ask fifteen)
  const f50 = bare();
  const fifty = Array.from({ length: 50 }, (_, i) => foe(MOBILE_TYPES.Rat, { loadID: 100 + i }));
  f50.abyss.ensureAquaticEnemyQuota(fakeDungeon(loc(1, 1), { foes: fifty }));
  assert.equal(fifty.filter((r) => r.retypedTo != null).length, 16);
  // the humanoid pass comes second: four living, the quota ceil(1.2f) = 2 - the one never humanoid, then the first that was
  const h = bare();
  const hr = [11, 12, 13, 14].map((id) => foe(MOBILE_TYPES.Rat, { loadID: id, wasHumanoid: id !== 13 }));
  const picks = hr.map((r) => tryPickUnderwaterEnemy(enemyHash(PIT.x, PIT.y, r.src.loadID), false, true, roster));
  assert.ok(picks.every((p) => p != null), 'the fixture: every one of them has an aquatic pick');
  h.abyss.ensureAquaticEnemyQuota(fakeDungeon(loc(1, 1), { foes: hr }));
  assert.deepEqual(hr.map((r) => r.retypedTo), [picks[0], undefined, picks[2], undefined]);
});

test('OH-E GameManager.OnEnemySpawn: in the building or bound abyss only, never during a load; the quota kept outside the build', async () => {
  const w = world();
  await w.abyss.tryEnterPit(PIT.x, PIT.y);
  const d = w.live;
  const fire = foe(MOBILE_TYPES.FireAtronach, { loadID: 3 });
  await w.abyss.onEnemySpawned(d, viewOf(fire));
  assert.equal(fire.destroyed, true);
  const late = foe(MOBILE_TYPES.FireAtronach, { loadID: 4 });
  w.P.loading = true;
  assert.equal(w.abyss.onEnemySpawned(d, viewOf(late)), undefined);
  assert.equal(late.destroyed, undefined, 'a load\'s spawns are the save\'s');
  w.P.loading = false;
  const elsewhere = fakeDungeon(loc(9, 9));
  assert.equal(w.abyss.onEnemySpawned(elsewhere, viewOf(late)), undefined, 'ShouldAffectDungeonObject: the live dungeon\'s own');
  assert.equal(late.destroyed, undefined);
});

// ── the presentation ─────────────────────────────────────────────────────

test('OH-E LateUpdate\'s presentation: the water fog toward the abyss\'s (85% at the midpoint, black at the top), its ceiling the intensity\'s 0.25, the ambient toward AbyssAmbientLight, the lights down', async () => {
  const saved = { fogColor: [0.1, 0.2, 0.3, 1], dungeonAmbient: [0.2, 0.25, 0.3, 1] };
  const off = world();
  assert.equal(off.abyss.presentation(saved, 1), null, 'not in the bound abyss: RestoreAbyssPresentation');
  for (const [dark, intensity] of [[0.5, 0.5], [0, 0], [1, 1], [0.25, 0.75]]) {
    const w = world({ settings: { dungeonVisualIntensity: intensity, dungeonVisualDarkness: dark } });
    await w.abyss.tryEnterPit(PIT.x, PIT.y);
    const p = w.abyss.presentation(saved, 0.8);
    const mid = lerp(saved.fogColor, ABYSS_FOG_COLOR, f32(0.85));
    assert.deepEqual(p.fogColor, midpointColor(dark, saved.fogColor, mid, [0, 0, 0, 1]), `fog at ${dark}`);
    const ambient = midpointColor(dark, saved.dungeonAmbient, ABYSS_AMBIENT_LIGHT, [0, 0, 0, 1]);
    assert.deepEqual(p.dungeonAmbient, ambient, `ambient at ${dark}`);
    assert.deepEqual(p.renderAmbient, ambient.map((v) => f32(v * 0.8)), 'RenderSettings.ambientLight: the new DungeonAmbientLight x DungeonAmbientLightScale');
    assert.equal(p.fogDensityMax, f32(f32(intensity) * f32(0.25 / 0.5)), 'GetScaledSliderValue about 0.25: clamp01(v) x (0.25 / 0.5)');
    assert.deepEqual([p.indirect, p.magicLightScale, p.torchOff], [0, 0.5, true], 'SuppressAbyssLights: the bounce off, the candle at half, the torch out');
  }
  const m = world();
  await m.abyss.tryEnterPit(PIT.x, PIT.y);
  assert.equal(m.abyss.presentation(saved, 1).fogDensityMax, 0.25, 'the midpoint is 0.25 itself');
  m.abyss.presentation(saved, 1).dungeonAmbient.forEach((v, i) => assert.ok(Math.abs(v - ABYSS_AMBIENT_LIGHT[i]) < 1e-7, 'the midpoint is AbyssAmbientLight, to Color.Lerp\'s float'));
});

// ── the loot ─────────────────────────────────────────────────────────────

const mint = {
  remintWeapon: (ti, m) => weaponOfMaterial(ti, m),
  remintArmor: (ti, m, v) => armorOfMaterial(ti, m, v),
  isEnchanted,
};

test('OH-E UpgradeLoot against OceanHolesDiagnosticsRunner\'s own case: an iron dagger to steel, leather armour to chain, an enchanted dagger up with its name, value, condition and identification kept', () => {
  const dagger = createWeapon(113, 0);
  const cuirass = mintCondition(setItemFields({ group: 'Armor', templateIndex: 102, material: 0, variant: 0 }));
  const magic = { ...createWeapon(113, 0), enchantments: [{ type: 11, param: 0 }], name: 'Abyss Test Magic', value: 321, currentCondition: 7, maxCondition: 9, isIdentified: true };
  const items = [dagger, cuirass, magic];
  upgradeLoot(items, mint);
  assert.deepEqual([dagger.material, cuirass.material, magic.material], [1, 256, 1], 'lootTier');
  assert.ok(isEnchanted(magic) && magic.isIdentified === true && magic.name === 'Abyss Test Magic' && magic.value === 321 && magic.currentCondition === 7 && magic.maxCondition === 9, 'magicPreserved');
  assert.equal(magic.enchantments.length, 1, 'SetItem leaves the enchantments');
  // a plain item is the next material's fresh one: SetItem's name, value and condition, then the material pass
  const fresh = createWeapon(113, 1);
  assert.deepEqual([dagger.name, dagger.value, dagger.currentCondition, dagger.maxCondition], [fresh.name, fresh.value, fresh.maxCondition, fresh.maxCondition]);
  const worn = { ...createWeapon(116, 3), name: 'Old Blade', currentCondition: 5, isIdentified: true };
  upgradeLoot([worn], mint);
  assert.equal(worn.name, createWeapon(116, 4).name, 'shortName back to the template\'s');
  assert.equal(worn.currentCondition, worn.maxCondition, 'the condition a fresh item\'s');
  assert.equal('isIdentified' in worn, false, 'flags = 0');
  assert.equal(worn.flags, 0);
});

test('OH-E UpgradeLoot\'s edges: Daedric stays, the armour variant kept, quest items / artifacts / a custom class untouched - and every weapon passes `GroupIndex != 131`, the arrow too (kept bug for bug)', () => {
  const daedric = { ...createWeapon(120, 9), stackCount: 1, currentCondition: 3, name: 'Old Daedric', isIdentified: true };
  const plate = mintCondition(setItemFields({ group: 'Armor', templateIndex: 102, material: 521, variant: 1 }));
  const quest = { ...createWeapon(113, 0), questItem: true };
  const artifact = { ...createWeapon(113, 0), artifact: true };
  const custom = { ...createWeapon(113, 0) };
  const chain = mintCondition(setItemFields({ group: 'Armor', templateIndex: 102, material: 256, variant: 1 }));
  const ring = { group: 'Jewellery', templateIndex: 133, name: 'Ring', value: 10 };
  const items = [daedric, plate, quest, artifact, custom, chain, ring];
  upgradeLoot(items, { ...mint, isCustom: (it) => it === custom });
  assert.deepEqual([daedric.material, daedric.currentCondition, daedric.name, daedric.isIdentified], [9, 3, 'Old Daedric', true], 'Daedric stays: no SetItem at all');
  assert.equal(plate.material, 521, 'daedric plate stays');
  assert.deepEqual([quest.material, artifact.material, custom.material], [0, 0, 0]);
  // AUDIT OH-F C8: CurrentVariant carried - the chain arm's 4 - and SetVariant's clamp for iron draws it as 3
  assert.deepEqual([chain.material, chain.variant], [512, 4], 'chain to iron, CurrentVariant carried');
  assert.equal(clampArmorVariant(102, 512, chain.variant), 3, 'DFU\'s upgraded chain cuirass is variant 3');
  for (const [ti, want] of [[104, 5], [105, 3]]) {
    const piece = mintCondition(setItemFields({ group: 'Armor', templateIndex: ti, material: 256 }));
    upgradeLoot([piece], mint);
    assert.equal(clampArmorVariant(ti, piece.material, piece.variant), want, `template ${ti}: DFU's 3 / 5 / 3`);
  }
  assert.deepEqual(ring, { group: 'Jewellery', templateIndex: 133, name: 'Ring', value: 10 });
  // the arrow: 131 is its TEMPLATE index; its group index is 18, so the test never turns it away
  const t = templateByIndex(ARROW_TEMPLATE);
  const arrows = { ...createWeapon(ARROW_TEMPLATE, 0), stackCount: 20 };
  upgradeLoot([arrows], mint);
  assert.equal(arrows.material, 1, 'one material up');
  assert.equal(arrows.stackCount, 1, 'SetItem: a stack of twenty is one arrow');
  assert.equal(arrows.value, t.basePrice * 3 * valueMultipliersByMaterial[1], 'ApplyWeaponMaterial\'s value lands on it (a stored field)');
  assert.equal(arrows.maxCondition, Math.trunc(t.hitPoints * conditionMultipliersByMaterial[1] / 4));
  assert.equal(arrows.currentCondition, arrows.maxCondition);
  assert.equal(itemBaseValue({ group: 'Weapons', templateIndex: ARROW_TEMPLATE, material: 1 }), t.basePrice, 'the readers\' ammunition floor is the arrow ARM\'s, not this re-mint\'s');
});

test('OH-E weaponOfMaterial is CreateWeapon\'s melee arm for every template, and the only mint that runs the material pass over an arrow', () => {
  for (const [ti, m] of [[113, 0], [116, 4], [120, 9], [129, 2]]) assert.deepEqual(weaponOfMaterial(ti, m), createWeapon(ti, m), `${ti}/${m}`);
  const a = weaponOfMaterial(ARROW_TEMPLATE, 2);
  assert.equal(a.material, 2);
  assert.equal(a.stackCount, undefined, 'no Range(1, 21) stack - SetItem\'s one (UpgradeLoot writes it)');
  const arm = createWeapon(ARROW_TEMPLATE, 2, () => 0);
  assert.deepEqual([arm.material, arm.currentCondition], [0, 0], 'CreateWeapon\'s arrow arm: no material, condition 0');
});

test('OH-E AddBonusMagicLoot: while Dice100 succeeds at (int)chance, one more magic item, the chance halved in floats', () => {
  let made = 0;
  const make = () => ({ name: `magic ${++made}` });
  const items = [];
  assert.equal(addBonusMagicLoot(100, items, make, () => 0), 7, '100, 50, 25, 12, 6, 3, 1 - then (int)0.78 is 0');
  assert.equal(items.length, 7);
  assert.equal(addBonusMagicLoot(100, [], make, () => 0.5), 1, 'a roll of 50 passes 100, not 50');
  assert.equal(addBonusMagicLoot(0, [], make, () => 0), 0, 'no chance, no roll');
  assert.equal(addBonusMagicLoot(-5, [], make, () => 0), 0);
  assert.equal(addBonusMagicLoot(3, [], make, () => 0.02), 1, '3 -> 1.5 -> (int)1: a roll of 2 fails the second');
  const none = [];
  assert.equal(addBonusMagicLoot(100, none, () => null, () => 0), 0, 'nothing to mint (no MAGIC.DEF): nothing counted');
  assert.equal(lootMatrix('A'), rriLootMatrix('A') ?? LOOT_MATRICES.A, 'the key\'s row of DefaultLootTables - RRI\'s table while its rebalance is on');
  assert.equal(lootMatrix('no such key'), rriLootMatrix('no such key') ?? LOOT_MATRICES['-'], 'GetMatrix\'s fallback is the table\'s first row');
  assert.equal(lootMatrix('no such key').MI, 0);
  setModSetting('roleplay-realism-items', 'lootRebalance', false);
  try {
    assert.equal(lootMatrix('A'), LOOT_MATRICES.A, 'RRI\'s rebalance off: DFU\'s own row');
    assert.equal(lootMatrix('A').MI, 2);
    assert.equal(lootMatrix('no such key'), LOOT_MATRICES['-'], 'and DefaultLootTables[0] for a key it has not');
  } finally { _resetModSettings(); }
});

test('OH-E the loot events: EnemyEntity.OnLootSpawned carries the table key, the items and the worn kit; LootTables.OnLootSpawned sits after the pile\'s trio; world.js answers both with the bonus first', () => {
  _resetForTests();
  const seen = [];
  const off = enemyLootSpawned.add((e) => seen.push(e));
  const e = { items: [], level: 5, careerIndex: 7, isClass: false, stats: { strength: 50, speed: 50 }, skills: 30 };
  spawnEnemyLoot(e, 7, ENEMY_BASICS[7], { level: 5, gender: 'female', stats: { luck: 50 }, activeEffects: [] }, { rolls: () => 0.5 });
  off();
  assert.equal(seen.length, 1);
  assert.equal(seen[0].mobileType, 7);
  assert.equal(seen[0].lootTableKey, ENEMY_BASICS[7].lootTableKey);
  assert.equal(seen[0].items, e.items, 'the collection itself - the bonus lands in it');
  for (const it of equipTableOf(e).filter(Boolean)) assert.ok(seen[0].worn.includes(it), 'every worn piece rides along');
  const n = seen.length;
  enemyLootSpawned.raise({ items: [] });
  assert.equal(seen.length, n, 'removed');
  // LootTables.OnLootSpawned: GenerateLoot's last (addPileLootExtras, the trio's home), for EVERY key - a coven's 'Q'
  // is outside the trio's window and raises it all the same
  const t = [];
  const offT = tableLootSpawned.add((x) => t.push(x));
  for (const key of ['K', 'Q']) { const pile = []; addPileLootExtras(pile, key, () => 0.999); assert.equal(t.at(-1)?.key, key); assert.equal(t.at(-1).items, pile, 'the pile itself'); }
  offT();
  assert.equal(t.length, 2);
  const ctx = readFileSync(new URL('../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
  assert.match(ctx, /addPileLootExtras\(items, lootKey, Math\.random, \{ locationIndex: dfLocation\.mapTableData\.dungeonType, luck: liveStat\(playerEntity, 'luck'\), level: effectiveLevel\(playerEntity\), where: 'dungeon' \}\);[^\n]*\n\s*rollLootRarity\(/, 'the dungeon\'s pile: the trio and the event, then the port\'s rarity roll');
  const src = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('const ohUpgrade = '), src.indexOf('_ohLootOff = () =>'));
  assert.ok(body.includes('ohAbyss.shouldUpgradeLoot()'), 'ShouldUpgradeLoot gates both');
  assert.ok(body.includes('addBonusMagicLoot(lootMatrix(key).MI, items'), 'the key\'s MI column');
  assert.ok(body.indexOf('addBonusMagicLoot(') < body.indexOf('upgradeLoot('), 'AddBonusMagicLoot, then UpgradeLoot over the whole of Items');
  assert.match(body, /tableLootSpawned\.add\(\(e\) => ohUpgrade\(e\.key, e\.items, \[\], e\.where\)\)/);
  assert.match(body, /enemyLootSpawned\.add\(\(e\) => ohUpgrade\(e\.lootTableKey, e\.items, e\.worn, e\.where\)\)/);
  // AUDIT OH-F B3: the dungeon's rolls alone take the upgrade - the street's foes and guards roll during the build
  assert.match(body, /if \(where !== 'dungeon' \|\| !ohAbyss\.shouldUpgradeLoot\(\)\) return;/);
  assert.equal((ctx.match(/spawnEnemyLoot\(entity, e\.mobileType, basics, D\.playerEntity, \{ \.\.\.eliteLootOpts\(e\), where: 'dungeon' \}\)/g) ?? []).length, 2, 'both of the dungeon\'s foe arms');
  for (const f of ['src/scenes/exteriorFoes.js', 'src/scenes/cityGuards.js', 'src/scenes/interiorContext.js']) assert.doesNotMatch(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'), /where: 'dungeon'/, `${f} is not the dungeon`);
  assert.match(src, /_ohLootOff\?\.\(\);\s*_ohLootOff = null;\s*if \(ohAbyss\) \{/, 'a second world replaces the listeners');
  // PlayerEnterExit.Dungeon while SetDungeon lays it out: the modes seam answers the location before its context exists
  assert.match(src, /dungeon: \(\) => ohDungeonOf\(modes\?\.dungeonCtx\) \?\? ohLayingOutOf\(modes\?\.layingOutLocation\)/);
  const wm = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
  assert.match(wm, /layingOutLoc = dfLocation;[^\n]*\n\s*const ctx = await buildDungeonContext\(/, 'set before the layout');
  assert.match(wm, /layingOutLoc = null;\n\s*if \(!live\(\)\) \{ abandonContext\(ctx\); return false; \}[^\n]*\n\s*dungeonCtx = ctx;/, 'handed over to the context');
  // MapsFile.GetLocation reads each caller its own DFLocation: a build's summary is its own, so the abyss's rename and
  // flood on a Recall into the template never reach the maps cache's location
  assert.match(wm, /const dfLocation = ownDungeonLocation\(sized\);/);
  assert.match(wm, /mapTableData: loc\.mapTableData && \{ \.\.\.loc\.mapTableData \},\n\s*dungeon: loc\.dungeon && \{ \.\.\.loc\.dungeon, blocks: loc\.dungeon\.blocks\?\.map\(\(b\) => \(\{ \.\.\.b \}\)\) \},/);
});

// AUDIT OH-F B1/B2 (2026-09-26): DFU destroys the dungeon and builds it again on every load, then stands the saved
// enemy set alone (SerializableStateManager.RestoreEnemyData) - before SaveLoadManager's mod loop reads it.
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
test('AUDIT OH-F B2 loadRebuilds: a load the abyss stands in - the live dungeon its own, or the save\'s record Active - is the world host\'s rebuild', async () => {
  const w = world();
  assert.equal(w.abyss.loadRebuilds(null), false, 'a plain dungeon\'s load may patch in place');
  assert.equal(w.abyss.loadRebuilds({ ...newAbyssSaveData() }), false);
  assert.equal(w.abyss.loadRebuilds({ ...newAbyssSaveData(), Active: true }), true, 'a save made in the abyss');
  await w.abyss.tryEnterPit(PIT.x, PIT.y);
  assert.equal(w.abyss.active, true);
  assert.equal(w.abyss.loadRebuilds(null), true, 'the live dungeon is the drowned one');
  const dc = src('src/scenes/dungeonContext.js');
  assert.match(dc, /if \(opts\.worldLoad && snap\.locationKey != null && \(snap\.locationKey !== _locationKey \|\| opts\.loadRebuilds\?\.\(snap\)\)\) \{/);
  assert.match(src('src/scenes/worldModes.js'), /loadRebuilds: \(snap\) => host\.loadRebuilds\?\.\(snap\) \?\? false,/);
  assert.match(src('src/scenes/world.js'), /loadRebuilds: \(snap\) => ohAbyss\?\.loadRebuilds\(snap\?\.modData\?\.\[OCEAN_HOLES_VENDOR\] \?\? null\) \?\? false,/);
});

test('AUDIT OH-F B1 the drowned dungeon\'s save: a destroyed foe stays gone (no corpse, no respawn), the restore\'s rebuilds settle before the mod loop', () => {
  const dc = src('src/scenes/dungeonContext.js');
  assert.match(dc, /\.\.\.\(f\.abyssDestroyed \? \{ abyssDestroyed: true \} : \{\}\),/, 'collectWorld writes the destroy');
  const loop = dc.slice(dc.indexOf('function applyWorld('), dc.indexOf('function applyWorld(') + 6000);
  const destroyed = loop.indexOf('if (sf.abyssDestroyed) { if (!f.abyssDestroyed) { f.abyssDestroyed = true; questPoolOps.removeFoe(f); } return; }');
  assert.ok(destroyed > 0, 'restored through removeFoe - dead, bodiless, lootless - never setFoeDead\'s corpse');
  assert.ok(destroyed < loop.indexOf('respawnDue(sf.died, _now)') && destroyed < loop.indexOf('patchFoe(f, sf, wire);'), 'before the respawn and the patch');
  assert.match(dc, /if \(f\.abyssDestroyed\) return false;   \/\/ AUDIT OH-F B5\/C1/, 'the hour\'s respawn refuses it');
  assert.equal((loop.match(/settling\.push\(retypeFoe\(/g) ?? []).length, 2, 'both of the restore\'s rebuilds are collected');
  assert.match(dc, /return Promise\.allSettled\(settling\)\.then\(\(\) => undefined\);/);
  // AUDIT DELVE E2 (THE DELVE ARC): a save laid at another dungeon size than this one's leaves the room's record
  // unapplied (foe i of one layout is not foe i of the other); OH-F B1's law - the rebuilds handed back - stands beside it
  assert.match(dc, /const settled = extras\.world && extras\.locationKey === _locationKey && !otherLayout \? applyWorld\(extras\.world\) : null;/);
  assert.match(dc, /return settled \?\? Promise\.resolve\(\);/);
  const w = src('src/scenes/world.js');
  const restore = w.indexOf('await modes?.restoreDungeonSave?.(extras); }');
  assert.ok(restore > 0 && restore < w.indexOf('restoreModSaveRecords(extras.modData, csaModLoadFailed);', restore), 'the mod loop reads the restored set');
});

test('AUDIT OH-F B3 the loot events carry the host that rolled them: the dungeon\'s tagged, every other roll null', () => {
  _resetForTests();
  const t = [];
  const offT = tableLootSpawned.add((x) => t.push(x));
  addPileLootExtras([], 'K', () => 0.999, { where: 'dungeon' });
  addPileLootExtras([], 'K', () => 0.999);
  offT();
  assert.deepEqual(t.map((x) => x.where), ['dungeon', null]);
  const seen = [];
  const off = enemyLootSpawned.add((e) => seen.push(e));
  const e = () => ({ items: [], level: 5, careerIndex: 7, isClass: false, stats: { strength: 50, speed: 50 }, skills: 30 });
  const P = { level: 5, gender: 'female', stats: { luck: 50 }, activeEffects: [] };
  spawnEnemyLoot(e(), 7, ENEMY_BASICS[7], P, { rolls: () => 0.5, where: 'dungeon' });
  spawnEnemyLoot(e(), 7, ENEMY_BASICS[7], P, { rolls: () => 0.5 });
  off();
  assert.deepEqual(seen.map((x) => x.where), ['dungeon', null]);
});

test('AUDIT OH-F B4 the descent is one move: `entering` from the pit to the arrival; a respawn that takes the door keeps its own move', async () => {
  const w = world();
  let seen = null;
  const enter = w.abyss.tryEnterPit(PIT.x, PIT.y);
  seen = w.abyss.entering;
  await enter;
  assert.equal(seen, true, 'entering from the first await');
  assert.equal(w.abyss.entering, false, 'and not once the dungeon is entered');
  // a door refused while a respawn is under way: no teleport back to the pit, the state cleared
  const r = world({ enter: 'refuse' });
  r.P.respawning = true;
  await r.abyss.tryEnterPit(PIT.x, PIT.y);
  assert.equal(entries(r.log, 'teleport').length, 1, 'the GPS move alone - the respawn owns the way back');
  assert.equal(r.abyss.entering, false);
  assert.equal(r.abyss.transitioning, false);
  assert.equal(r.abyss.active, false);
  // without a respawn the refusal is answered as a failed transition: back to where the swimmer was
  const q = world({ enter: 'refuse' });
  await q.abyss.tryEnterPit(PIT.x, PIT.y);
  assert.equal(entries(q.log, 'teleport').length, 2);
  const src = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(src, /function worldMoveBusy\(\) \{[^}]*\|\| !!ohAbyss\?\.entering;\s*\}/, 'loads, Recall, quests and jail wait for the descent');
  assert.match(src, /function worldQuickSave\(saveName = QUICK_SAVE_NAME, \{ quiet = false, sink = null \} = \{\}\) \{\s*(?:\/\/[^\n]*\n\s*)*if \(ohAbyss\?\.entering\) \{ if \(!quiet\) townTalk\.say\('You cannot save now\.'\); return false; \}/, 'and a save refuses (AUDIT REALM2 M5: saying so to a save pressed, never to the quiet checkpoint)');
});

test('AUDIT OH-F B5 online: the Recall renames before the room is joined; a death wakes at the pit; the hour never brings a destroyed foe back', async () => {
  const w = world();
  assert.equal(w.abyss.returnPoint(), null, 'outside the abyss there is no pit door');
  await w.abyss.tryEnterPit(PIT.x, PIT.y);
  const r = w.abyss.returnPoint();
  assert.deepEqual(r.pixel, { x: PIT.x, y: PIT.y });
  assert.equal(r.worldX, w.abyss.data.ReturnWorldX);
  assert.equal(r.worldZ, w.abyss.data.ReturnWorldZ);
  w.gps.x = r.worldX; w.gps.z = r.worldZ;
  const before = entries(w.log, 'feet').length;
  await w.abyss.standAtPit(r);
  assert.equal(entries(w.log, 'feet').length, before + 1, 'stood on the entrance, as the way up stands it');
  const src = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  const oh = src.indexOf('oceanHoles.checkSettings(); ohAbyss?.update(); }');
  assert.ok(oh > 0 && oh < src.indexOf('onlineFrame(now, dt);'), 'the abyss\'s Update before the online frame reads the room key');
  assert.match(src, /const ohReturn = wasInDungeon \? ohAbyss\?\.returnPoint\(\) \?\? null : null;/);
  // RESPAWN-GROUND (FIELD BUGS 2026-09-30, PIN MOVED): the pixel is read with the return point, before the rise is
  // scheduled - so before the exit that clears the abyss, as this pin asked
  const read = src.indexOf('\n    const px = ohReturn?.pixel ?? playerTravelPixel();');
  assert.ok(src.indexOf('const ohReturn = wasInDungeon') < read && read < src.indexOf("if (mode !== 'exterior') modes?.forceExitToExterior();", read), 'read before the exit clears the abyss');
  assert.match(src, /if \(ohReturn\) \{ await ohTeleportToWorld\(ohReturn\.worldX, ohReturn\.worldZ\); await ohAbyss\.standAtPit\(ohReturn\); \}/);
});

test('AUDIT OH-F C6 the quota walks the hierarchy: each block\'s Fixed Enemies before its Random Enemies, marker order within, the spawns last', async () => {
  const { enemyHierarchyOrder, collectDungeonEnemies } = await import('../src/characters/dungeonEnemies.js');
  const r = (blockIndex, fixed, n) => ({ n, src: { blockIndex, fixed } });
  // N0000021's shape: a random marker before a fixed one in the same block
  const pool = [r(0, false, 'r0a'), r(0, true, 'f0a'), r(0, false, 'r0b'), r(1, true, 'f1a'), r(1, false, 'r1a'), r(1, true, 'f1b'), { n: 'spawn1', src: {} }, { n: 'spawn2', src: { blockIndex: 0, fixed: true } }];
  const order = enemyHierarchyOrder(pool, 6).map((f) => f.n);
  assert.deepEqual(order, ['f0a', 'r0a', 'r0b', 'f1a', 'f1b', 'r1a', 'spawn1', 'spawn2'], 'a spawn is the dungeon\'s child, whatever its record says');
  assert.deepEqual(pool.map((f) => f.n), ['r0a', 'f0a', 'r0b', 'f1a', 'r1a', 'f1b', 'spawn1', 'spawn2'], 'the pool itself keeps its order (saves and rooms are keyed by index)');
  // the layout's records carry their block
  const block = (markers) => ({ originX: 0, originZ: 0, waterLevel: 10000, markers });
  const fixedAt = (x) => ({ record: 16, archive: 199, factionOrMobileId: 5, flags: 0, x, y: 0, z: 0, rawY: 0, actionByte: 0, soundIndex: 0 });
  const got = collectDungeonEnemies([block([fixedAt(1)]), block([fixedAt(2), fixedAt(3)])], { locationId: 7, dungeonType: 0, playerLevel: 1 });
  assert.deepEqual(got.map((e) => e.blockIndex), [0, 1, 1]);
  const dc = readFileSync(new URL('../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
  assert.match(dc, /foes: \(\) => enemyHierarchyOrder\(foes, _layoutFoes\)\.filter\(\(f\) => !f\.dead && f\.entity && !runByAnother\(f\)\)\.map\(abyssFoeView\),/);   // AUDIT PRE-MERGE 0928 M1: the ones this player runs
});

test('AUDIT OH-F C3/C4/C7 the spawn\'s own marks at the build: a quest foe is QuestSpawn when OnEnemySpawn hears it, an ally is one, a Wabbajack\'s creature has LoadID 0', () => {
  const dc = readFileSync(new URL('../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
  assert.match(dc, /get questSpawn\(\) \{ return !!rec\.questBehaviour \|\| !!rec\.src\?\.questSpawn; \}/, 'GameObjectHelper.cs:1286-1294: QuestSpawn before the event');
  assert.match(dc, /const f = await spawnLooseFoe\(mobileType, position, \{ gender, yawRad, questSpawn: true \}\);/);
  const stand = dc.indexOf('const stand = (rec) => {');
  const ally = dc.indexOf('applySpawnAlliance(entity, e);');
  assert.ok(ally > 0 && ally < dc.indexOf('stand(rec);', ally), 'the team turned before stand() raises OnEnemySpawn');
  assert.ok(stand > 0);
  assert.match(dc, /Promise\.resolve\(spawnLooseFoe\(mobileType, at, \{ loadID: 0 \}\)\)\.then\(\(nf\) => \{/, 'CreateEnemy sets no LoadID');
  assert.match(dc, /if \(_layoutStood && !puppet\) \{ if \(rec\.src\) rec\.src\.loadID \?\?= \+\+_spawnUid; opts\.onEnemySpawn\?\.\(rec\); \}/, 'the counter only fills an ABSENT LoadID - a 0 stays 0 (AUDIT PRE-MERGE 0928 M1: and a puppet, another player\'s foe, is no spawn at all)');
});
