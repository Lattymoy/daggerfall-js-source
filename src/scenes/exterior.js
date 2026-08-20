// Exterior location scene: a full location assembled on the block grid.
// World-Arc milestone 2: assemble and render a full exterior location from
// original data. Default scene is Daggerfall city (8x8 blocks, 316 buildings),
// selectable with ?region=<name>&loc=<name>. Ground archive comes from the
// location's climate (CLIMATE.PAK -> GetWorldClimateSettings).

import { Arch3dFile } from '../formats/arch3dFile.js';
import { requestLook, makeLookGate } from '../player/pointerLock.js';
import { attachTouch } from '../ui/touch.js';
import { BlocksFile } from '../formats/blocksFile.js';
import { DFPalette } from '../formats/dfPalette.js';
import { MapsFile, longitudeLatitudeToMapPixel } from '../formats/mapsFile.js';
import { convertTilemap } from '../world/terrainSurface.js';
import { GROUND_OFFSET, GROUND_TILE_DIM } from '../world/rmbLayout.js';
import { PlayerMotor } from '../player/motor.js';
import { jumpSpeedMultiplier, tallySkill, SKILLS } from '../systems/skills.js';
import { createWeaponRig } from '../combat/weaponRig.js';
import { ArrowFlight } from '../combat/arrowFlight.js';   // C13: visible exterior arrows
import { removeOne } from '../systems/inventory.js';
import { weaponTypeForItem, WEAPON_TYPES } from '../combat/fpsWeapon.js';
import { playerEntity, surfacePlayer, hurtPlayer, setDeathPresenter } from '../characters/playerEntity.js';
import { SOUND } from '../systems/soundClips.js';
import { Collider } from '../player/collider.js';
import { getStaticDoors } from '../world/staticDoors.js';
import { createDataPipeline } from './dataPipeline.js';
import { createWorldModes } from './worldModes.js';
import { windowEmissionRGB } from '../render/windowEmission.js';
import { CITY_LIGHT_COLOR, CITY_LIGHT_RANGE, LIGHTS_ARCHIVE, collectCityLights, nearestLights } from '../world/cityLights.js';
import { applyClimate, getGroundArchive, getNatureArchive } from '../world/climateSwaps.js';
import { RMB_SIDE, layoutLocation } from '../world/locationLayout.js';
import { lookAt, multiply, perspective, transformPoint, trs } from '../world/mat4.js';
import { drawCharacterSprite } from '../render/characterSprite.js';
import { collectBlockFlats, scaledBillboardSize } from '../world/rmbFlats.js';
import { CityLightAnimator, SUN_RIG_COLOR, INDIRECT_LIGHT_COLOR, INDIRECT_LIGHT_RANGE, exteriorAmbient, indirectLightScale, isCityLightsOn, isNight, parseTimeOfDay, sunDirection, sunScale, windowStyleForTime } from '../world/worldClock.js';
import { audio } from '../systems/audio.js';
import { AmbientEffects, EXTERIOR_AMBIENT_WAITS, presetForExterior } from '../systems/ambientEffects.js';
import { createAnimalAmbience } from '../systems/animalAmbience.js';   // A4
import { CityNavigation } from '../world/cityNavigation.js';   // T1 towns
import { TownPopulation } from '../systems/townPopulation.js';
import { GUARD_TEXTURE, MobilePerson, PERSON_TEXTURES } from '../characters/mobilePerson.js';
import { createTownTalk } from './townTalk.js';   // T3b
import { createPlayerMagic } from './hostMagic.js';   // M2: spellcasting above ground
import { SpellbookWindow, knownSpells } from '../ui/inventory.js';   // M2
import { worldMinutes, setWorldMinutes } from '../systems/worldTick.js';   // AUDIT 23 (C2): the ONE clock
import { tallySwingSkills, SWING_WEAPON_FATIGUE_LOSS } from './hostCombat.js';   // AUDIT 23 (C14)
import { exhaustionOutcome, EXHAUSTED_IN_WATER } from '../systems/rest.js';   // AUDIT 23 (C5)
import { ActionTextBox } from '../ui/actionText.js';   // AUDIT 23 (C5): the collapse box
import { maxFatigue } from '../systems/statMods.js';   // AUDIT 23 (C5)
import { FootstepMachine, pickFootstepSet } from '../systems/footsteps.js';   // FS-slice
import { calculateCastCost } from '../systems/spellcost.js';   // M2
import { seasonValue, dateFromClassicMinutes } from '../systems/gameDate.js';   // AUDIT 23 (wts-1)
import { getNameBankOfRegion } from '../characters/nameHelper.js';   // AUDIT 23 (characters-5)
import { createCityGuards } from './cityGuards.js';   // G1
import { createArrestFlow } from './arrestFlow.js';   // G2
import { makeInView } from '../player/cameraView.js';   // AUDIT 17e F24
import { pickActivatable } from '../player/activate.js';   // G3: corpse loot
import { CharSheet, LevelUpScreen, preloadCharSheetArt, charSheetArtLoaded } from '../ui/charsheet.js';   // U8a: the native char sheet (LevelUpScreen: AUDIT 21 hosts F3)
import { DeathScreen } from '../ui/inventory.js';   // AUDIT 21 hosts F6: dying above ground
import { loadHud, drawHud } from '../ui/hud.js';   // AUDIT 21 hosts F7: the classic HUD, which this host did not draw
import { ImgFile } from '../formats/imgFile.js';   // AUDIT 21 hosts F7: loadHud's reader
import { NativeInventoryWindow, preloadInventoryArt, inventoryArtLoaded } from '../ui/nativeInventory.js';   // U8d: the native inventory
import { createDroppedLoot } from './droppedLoot.js';   // U8e: the ground piles
import { preloadPaperDollArt } from '../ui/paperDoll.js';   // U8f: the avatar base
import { seedStartingEquipment, EQUIP_SLOTS } from '../systems/equip.js';   // U8h: the worn-weapon binding
import { createChargenFlow, createChargenWindow, finishChargen, loadSpellIndex, applyHeadlessChargen } from '../systems/chargenSession.js';   // S3c/U9
import { preloadChargenArt } from '../ui/chargenArt.js';   // U10
import { preloadMessageBoxArt } from '../ui/messageBox.js';   // U11
import { buildingDataForDoor } from '../systems/talkTopics.js';   // E2: the shop identity
import { hitSoundFor, swingSoundFor } from '../systems/soundClips.js';
import { isInvisible } from '../systems/effects.js';
import { ANIMALS_ARCHIVE, ANIMAL_SOUND_BY_RECORD } from '../systems/soundClips.js';
import { fetchBytes, parseSeason, createSkyController, createPlayerTicker, createMusicDirector, motorStats, climbingDeps, applyFallLanding, ensureAudio, outdoorFogColor, applyMotorEffectFlags, populatesWanderingNpcs } from './shared.js';
import {
  WEATHER_TYPES, fogForWeather, skyOffsetForWeather, weatherSunlightScale,
  windowStyleForWeather, weatherRng, fogFactor, precipitationForWeather,
  LightningPlayer,
} from '../world/weather.js';
import { PrecipitationRenderer } from '../render/precipitation.js';
import { SEASON } from '../world/climateSwaps.js';
import { addGold } from '../systems/court.js';   // U10 probe surface

export async function bootExterior(canvas, renderer, params, status) {
  const regionName = params.get('region') || 'Daggerfall';
  const locationName = params.get('loc') || 'Daggerfall';

  audio.ensure(fetchBytes);   // AUDIT 18 F6: sound was booted ONLY by buildDungeonContext, so this host was silent until a dungeon was entered
  status('loading data');
  const [palBytes, blocksBytes, archBytes, mapsBytes, climateBytes, politicBytes] =
    await Promise.all([
      fetchBytes('ART_PAL.COL'),
      fetchBytes('BLOCKS.BSA'),
      fetchBytes('ARCH3D.BSA'),
      fetchBytes('MAPS.BSA'),
      fetchBytes('CLIMATE.PAK'),
      fetchBytes('POLITIC.PAK'),
    ]);

  const palette = new DFPalette();
  palette.load(palBytes, 'ART_PAL.COL');
  const blocks = new BlocksFile();
  blocks.load(blocksBytes);
  const arch = new Arch3dFile();
  arch.load(archBytes);
  const maps = new MapsFile();
  maps.load(mapsBytes, climateBytes, politicBytes);

  // Assemble the location.
  const dfLocation = maps.getLocationByName(regionName, locationName);
  if (!dfLocation) throw new Error(`location not found: ${regionName}/${locationName}`);
  status(`laying out ${locationName}`);
  const loc = layoutLocation(dfLocation, maps, blocks);

  // Climate + season: swap every submesh archive exactly as DFU's
  // MaterialReader.ChangeClimate does - pixels from the swapped archive,
  // UVs from the original (the SetDungeonTextures pattern).
  const season = parseSeason(params);
  const climateBase = dfLocation.climate.climateType;
  // FS-slice: the location's raw CLIMATE.PAK index (the snow gate reads it)
  const _locPixel = longitudeLatitudeToMapPixel(dfLocation.mapTableData.longitude, dfLocation.mapTableData.latitude);
  const locClimateIndex = maps.getClimateIndex(_locPixel.x, _locPixel.y);
  const footsteps = new FootstepMachine();
  const groundArchive = getGroundArchive(climateBase, season);
  const natureArchive = getNatureArchive(dfLocation.climate.natureArchive, season);
  const texRemap = new Map();

  // Shared lazy pipeline (P7): the same caches the world scene uses,
  // PREWARMED for the location below so boot behavior is unchanged -
  // and able to lazy-load the models/archives interiors and dungeons
  // reference beyond the location's own set.
  const pipeline = createDataPipeline({ renderer, arch, palette });
  // AUDIT 18 HOST GAP: the audio engine's bootstrap lived only in
  // buildDungeonContext, so every sound in this host was a silent
  // no-op until a dungeon was entered (DFU's sound reader is global
  // and the exterior prefab is audible from frame one).
  ensureAudio(fetchBytes);

  const { textureFiles, getTexture, uploadRecord, uploadRecordFrame, getGpuMesh, gpuMeshes, cpuModels } = pipeline;

  // Collect the location's model ids + referenced texture archives.
  const modelIds = new Set();
  const archives = new Set([groundArchive, LIGHTS_ARCHIVE]);
  for (const b of loc.blocks) {
    for (const placed of b.layout.models) modelIds.add(placed.modelIdNum);
  }
  status(`loading ${modelIds.size} models`);
  await Promise.all([...modelIds].map((id) => getGpuMesh(id)));
  // Climate swap table over every submesh, exactly as the world's
  // per-pixel pass: pixels from the swapped archive, UVs from the
  // original (verbatim MaterialReader.ChangeClimate; missing-record
  // remaps pruned - 27 corpus pairs, R1 audit).
  for (const id of modelIds) {
    const gpu = gpuMeshes.get(id);
    if (!gpu) continue;
    for (const sm of gpu.subMeshes) {
      archives.add(sm.textureArchive);
      const swapped = applyClimate(sm.textureArchive, sm.textureRecord, climateBase, season);
      if (swapped === sm.textureArchive) continue;
      const key = `${sm.textureArchive}_${sm.textureRecord}`;
      if (texRemap.has(key)) continue;
      const t = await getTexture(swapped);
      if (sm.textureRecord >= t.recordCount) continue;
      uploadRecord(swapped, sm.textureRecord);
      texRemap.set(key, `${swapped}_${sm.textureRecord}`);
    }
  }
  status(`loading ${archives.size} texture archives`);
  await Promise.all([...archives].map((a) => getTexture(a)));

  // Per-block scene list: world matrices with the block origin folded in,
  // plus one ground mesh per block, plus flats grouped into billboard batches.
  const sky = createSkyController(renderer.gl, params);
  // R9 ground: one tilemap for the whole location grid (16 tiles per
  // block side, square texture over max(w, h) blocks; the flat surface
  // only spans the real extent so padding is never sampled).
  const tilemapDim = GROUND_TILE_DIM * Math.max(loc.width, loc.height);
  const locationTilemap = new Uint8Array(tilemapDim * tilemapDim);
  const cityLights = []; // archive-210 lantern point lights (R3)
  const CITY_LIGHT_COLOR_F32 = new Float32Array(CITY_LIGHT_COLOR);
  // World clock (R5): ?tod=HH:MM (default noon), ?timescale=game-min/sec.
  // Weather (R12): ?weather=sunny|cloudy|overcast|fog|rain|thunder|snow,
  // ?wseed for the deterministic Rain1/Rain2 (Snow1/Snow2) sky pick.
  const weather = WEATHER_TYPES.includes(params.get('weather'))
    ? params.get('weather') : 'sunny';
  const weatherFog = fogForWeather(weather);
  const weatherSkyOffset = skyOffsetForWeather(
    weather, weatherRng(Number(params.get('wseed')) || 1));
  const weatherSun = weatherSunlightScale(weather, season === SEASON.Winter);
  const precipMode = precipitationForWeather(weather);
  const precip = precipMode ? new PrecipitationRenderer(renderer.gl) : null;
  const lightning = weather === 'thunder'
    ? new LightningPlayer(Number(params.get('wseed')) || 1) : null;
  // AUDIT 23 (C2: hosts-8 = audio-1): ONE clock. The time-of-day gates
  // (music night, city lights, window styles, sun) used a demo clock
  // frozen at noon by default while gameplay time advanced on
  // worldMinutes - night never fell. ?tod now SETS the world clock's
  // time-of-day at boot and ?timescale SCALES the world tick (DFU's
  // TimeScale, default 12); minuteNow reads the one clock.
  {
    const bootTod = parseTimeOfDay(params.get('tod'));
    if (bootTod != null) setWorldMinutes(Math.floor(worldMinutes() / 1440) * 1440 + bootTod);
  }
  const timeScaleMult = params.has('timescale') ? Number(params.get('timescale')) / 12 : 1;
  const minuteNow = () => worldMinutes() % 1440;

  // A5b: OUTDOOR MUSIC. AssignPlaylist's City/Wilderness arms - night
  // overrides everything, and by day the weather picks the list
  // (SongManager.cs:585-612). The pick itself is DFU's day-seeded
  // branch, so a location's song is stable until midnight.

  const lightsOnAt = (minute) =>
    params.has('window') ? params.get('window') === 'night' : isCityLightsOn(minute);
  const lightSize = (record) => {
    const t = textureFiles.get(LIGHTS_ARCHIVE);
    return scaledBillboardSize(t.getSize(record), t.getScale(record));
  };
  const drawList = [];
  // Player collision (P1): every placed model's triangles, world-space,
  // over the flat ground floor.
  const collider = new Collider(() => GROUND_OFFSET * 0.025);
  let colliderTris = 0;
  const buildingDoors = []; // {door, dfBlock, recordIndex, climateBase, season, dfLocation, group}
  const flatGroups = new Map(); // "archive_record" -> [centers]
  const ambientAnimals = [];    // A4: archive-201 town animals as audio sources
  const animalAmbience = createAnimalAmbience(audio, () => ambientAnimals);
  const cityNav = new CityNavigation(loc.width, loc.height);   // T1 towns
  for (const b of loc.blocks) {
    const originMatrix = trs(b.originX, 0, b.originZ, 0, 0, 0);
    for (const placed of b.layout.models) {
      const mesh = gpuMeshes.get(placed.modelIdNum);
      if (!mesh) continue;
      const matrix = multiply(originMatrix, placed.matrix);
      drawList.push({ mesh, matrix });
      const cpu = cpuModels.get(placed.modelIdNum);
      collider.addMesh('world', cpu.positions, cpu.indices, matrix);
      colliderTris += cpu.indices.length / 3;
      // Building models expose their static doors for E-transitions
      // (P7: the world's registry shape; matrices are already
      // world-space, so entries feed the machine unshifted).
      if (cpu.doors && cpu.doors.length) {
        // StaticDoor.blockIndex must be TRUTHFUL (RMBLayout.cs:848
        // passes blockData.Index): DaggerfallInterior.IsBadInteriorModel
        // keys the 31000-overlap repair on EntryDoor.blockIndex, and a
        // hardcoded 0 made it unreachable from this host.
        for (const door of getStaticDoors(cpu, b.dfBlock.index, placed.recordIndex, matrix)) {
          buildingDoors.push({
            door, dfBlock: b.dfBlock, recordIndex: placed.recordIndex,
            climateBase, season, dfLocation, group: 'loc',
          });
        }
      }
    }
    // Ground tiles gather into one location-wide tilemap for the R9
    // tilemap-shader pass. These bytes are PRE-conversion (tileBitfield
    // space); convertTilemap turns a byte b into texture record
    // (b * 4) + rotate + flip. MeshReader.cs:487 resets a random marker
    // (TextureRecord >= 56) to RECORD 8, "Index 8 is grass" - so the
    // byte written here must be 2, not 8. Writing 8 made convertTilemap
    // decode record 32 and the shader drew a different ground texture.
    // Zeros ride the 0xFF sentinel.
    const srcTiles = b.dfBlock.rmbBlock.fldHeader.groundData.groundTiles;
    for (let ty = 0; ty < GROUND_TILE_DIM; ty++) {
      for (let tx = 0; tx < GROUND_TILE_DIM; tx++) {
        const tile = srcTiles[tx][GROUND_TILE_DIM - 1 - ty];
        const raw = tile.textureRecord >= 56
          ? 2   // record 2 * 4 = 8, grass (MeshReader.cs:487)
          : (tile.tileBitfield === 0 ? 0xff : tile.tileBitfield);
        locationTilemap[(b.x * GROUND_TILE_DIM + tx) +
          (b.y * GROUND_TILE_DIM + ty) * tilemapDim] = raw;
      }
    }

    for (const flat of collectBlockFlats(b.dfBlock, natureArchive)) {
      const key = `${flat.archive}_${flat.record}`;
      if (!flatGroups.has(key)) flatGroups.set(key, []);
      flatGroups.get(key).push([flat.x + b.originX, flat.y, flat.z + b.originZ]);
      // A4: every archive-201 town animal is an audio source
      // (AddAnimalAudioSource on RMB flats, verbatim).
      if (flat.archive === ANIMALS_ARCHIVE && ANIMAL_SOUND_BY_RECORD[flat.record] != null) {
        ambientAnimals.push({ pos: [flat.x + b.originX, flat.y, flat.z + b.originZ], sound: ANIMAL_SOUND_BY_RECORD[flat.record] });
      }
    }
    // T1: the navgrid - the automap carves (raw bytes, verbatim: a
    // tree flat BLOCKS its cell), tile weights from the same ground
    // grid the renderer reads.
    cityNav.setBlockData(b.x, b.y, b.dfBlock.rmbBlock.fldHeader.autoMapData,
      (tx, ty) => srcTiles[tx][ty].textureRecord);
    for (const light of collectCityLights(b.dfBlock, lightSize)) {
      cityLights.push({ x: light.x + b.originX, y: light.y, z: light.z + b.originZ });
    }
  }

  // R9 ground GL: cached tile array per archive, the location tilemap,
  // and a flat 2x2 surface at GroundOffset spanning the exact extent
  // (winding matches buildTerrainIndices' quad diagonal).
  if (!renderer.tileArrays.has(groundArchive)) {
    const groundTex = textureFiles.get(groundArchive);
    const layers = [];
    for (let r = 0; r < groundTex.recordCount; r++) {
      layers.push(groundTex.getColor32(groundTex.getDFBitmap(r, 0), 0));
    }
    renderer.uploadTileArray(groundArchive, layers);
  }
  const tilemapTex = renderer.uploadTilemapTexture(convertTilemap(locationTilemap), tilemapDim);
  const groundSurface = (() => {
    const gy = GROUND_OFFSET * 0.025;
    const gw = loc.width * RMB_SIDE;
    const gh = loc.height * RMB_SIDE;
    const positions = new Float32Array([0, gy, 0, gw, gy, 0, 0, gy, gh, gw, gy, gh]);
    const normals = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]);
    const indices = new Uint32Array([0, 2, 3, 0, 3, 1]);
    return renderer.createTerrainSurface(positions, normals, indices);
  })();
  const identityMatrix = trs(0, 0, 0, 0, 0, 0);

  // Load any flat archives not already fetched, then build one batch per
  // (archive, record) with its scaled billboard size.
  status('loading flat archives');
  const flatArchives = new Set(
    [...flatGroups.keys()].map((k) => Number(k.split('_')[0]))
  );
  await Promise.all([...flatArchives].map((a) => getTexture(a)));
  const billboardBatches = [];
  let flatCount = 0;
  for (const [key, centers] of flatGroups) {
    const [archive, record] = key.split('_').map(Number);
    const t = textureFiles.get(archive);
    if (!t || record >= t.recordCount) continue;
    uploadRecord(archive, record);
    const size = scaledBillboardSize(t.getSize(record), t.getScale(record));
    billboardBatches.push(renderer.createBillboardBatch(archive, record, size, centers));
    flatCount += centers.length;
  }

  // Camera.
  const shotMode = params.has('shot');
  // P1: grounded first-person is the default; ?fly restores the fly cam.
  const walkMode = params.has('play') || (!params.has('fly') && !shotMode);
  const player = new PlayerMotor(collider, motorStats(playerEntity), { jumpBoost: () => jumpSpeedMultiplier(playerEntity), climbing: climbingDeps(playerEntity, (l) => townTalk?.say(l)) });   // AcrobatMotor skill jump (P14) + M3 climbing; motorStats = the LIVE entity (PlayerSpeedChanger reads LiveSpeed/Running/Swimming every step)
  // AUDIT 21 (hosts lane, F3): onLevelUp. Without it advancement.js takes its
  // HEADLESS arm - `spendPoolLowest`, which dumps every point into your LOWEST
  // stats with no message and no choice. Cross a level threshold walking a
  // town and you got a different character than crossing it in a dungeon, off
  // the same XP. The dungeon host has passed one since U3; the three carriers
  // above ground passed only `say`.
  //
  // `townTalk` is declared further down this function and the closure only
  // runs once time has passed, so it is initialised by then.
  // AUDIT 23 (C5: hosts-5 = entity-3): the exhaustion collapse above
  // ground - the same exhaustionOutcome law the dungeon runs, with
  // this host's context (guards as the nearby enemies, the one clock's
  // day, outside). Function-hoisted: cityGuards/townTalk close later.
  let _inExhaustion = false;
  function onExhaustedExterior() {
    if (_inExhaustion) return;
    _inExhaustion = true;
    try {
      const out = exhaustionOutcome({
        enemiesNearby: (cityGuards?.activeCount?.() ?? 0) > 0,
        swimming: !!player.swimming, entity: playerEntity,
        day: !isNight(minuteNow()), inside: false,
      });
      // RSC 1071/1072 pend the reader in this host; classic strings fall back.
      const lines = out.inWater ? [EXHAUSTED_IN_WATER] : ['You collapse from exhaustion.'];
      if (!townTalk.overlay) townTalk.showOverlay(new ActionTextBox(lines));
      if (out.kind === 'rest') {
        playerTicker.advance(60);   // RaiseTime(1 hour); the latch holds re-entry
        playerEntity.health = Math.min(playerEntity.maxHealth, playerEntity.health + out.health);
        playerEntity.fatigue = Math.min(maxFatigue(playerEntity), (playerEntity.fatigue ?? 0) + out.fatigue);
        playerEntity.magicka = Math.min(playerEntity.maxMagicka ?? Infinity, (playerEntity.magicka ?? 0) + out.magicka);
        tallySkill(playerEntity, SKILLS.Medical);
        surfacePlayer();
      } else {
        hurtPlayer(playerEntity, playerEntity.health);   // SetHealth(0) through the one damage door
      }
    } finally { _inExhaustion = false; }
  }
  // C14: the swing's own fatigue drain rides the same collapse law.
  const drainExteriorFatigue = (n) => {
    if (n <= 0) return;
    playerEntity.fatigue = Math.max(0, (playerEntity.fatigue ?? 0) - n);
    surfacePlayer();
    if (playerEntity.fatigue <= 0 && playerEntity.health > 0) onExhaustedExterior();
  };
  const playerTicker = createPlayerTicker(playerEntity, {
    say: (msg) => console.log('[player]', msg),
    onExhausted: onExhaustedExterior,
    onLevelUp: () => {
      console.log('[player] You have gained a level!');
      townTalk.showOverlay(new LevelUpScreen(playerEntity));
    },
  });   // AUDIT 18: the per-minute tick every host owes
  // AUDIT 21 (hosts lane, F6): this host's death presenter. Guard damage,
  // fall damage and the ticker's disease/poison sink all reach the one damage
  // door in playerEntity.js; the door calls this. Registered here rather than
  // passed down four call chains, because there is one player and one death.
  setDeathPresenter(() => {
    if (!(townTalk.overlay instanceof DeathScreen)) townTalk.showOverlay(new DeathScreen());
  });

  // AUDIT 19 F4: the CUMULATIVE game-day count, for the music seed. The
  // ticker's classicMinutes is the only clock in this host that keeps
  // counting past midnight - minuteNow() wraps at 1440 by design (it
  // drives the sun and the window styles, which want a time of day).
  const gameDaysNow = () => Math.floor(playerTicker.classicMinutes / 1440);

  // AUDIT 19 / 1:1: the MUSIC DIRECTOR replaces this host's three ad-hoc
  // music entry points (boot, nightfall, returning from an interior). DFU
  // has one Update() that rebuilds a context every frame and reacts to the
  // difference; feeding that is the only way to get its law that a new day
  // or a new LOCATION re-picks even when the playlist is unchanged.
  // This host loads ONE location and the player stands in it, so the rect
  // test is constant. locationType/locationIndex come off the map table -
  // the same fields DFU's PlayerGPS reports.
  const _musicInLocationRect = () => true;
  const _musicLocationType = () => dfLocation?.mapTableData?.locationType ?? 0xffff;
  const _musicLocationIndex = () => dfLocation?.locationIndex ?? -1;
  const musicDirector = createMusicDirector();
  ensureAudio(fetchBytes);
  // C9: the exterior FP weapon (host rule - every motor host carries
  // it). AUDIT 17e F38 / RETIRING A FLAG DELETES THE SENTENCE: the
  // 'no HUD-text layer yet' flag that stood here was retired by T3b
  // three lines below, but survived to be re-published as live work
  // by the grep-regenerated open-flags list.
  // T3b: the town interaction seam (modes/talk/pickpocket) - shared
  // with the streaming host via townTalk.js. It also gives this host
  // its first HUD-text layer; the weapon rig's say routes there now.
  const townTalk = createTownTalk({
    renderer, canvas, fetchBytes, playerEntity, palette,
    regionIndex: dfLocation.regionIndex,
    onCrime: () => _crimeResponse(),   // G1: late-bound - the guards mount below
    // T3c: the Where-is topics - the named-building pool merges at
    // talk-load; building positions ride their exterior doors.
    topics: {
      exteriorBuildings: dfLocation.exterior.buildings,
      blocks: loc.blocks,
      doors: buildingDoors.map((e) => ({
        dfBlock: e.dfBlock, recordIndex: e.recordIndex,
        position: [e.door.matrix[12], e.door.matrix[13], e.door.matrix[14]],
      })),
      locationName, regionName,
      playerPos: () => (walkMode ? [...player.pos] : [...cam.pos]),
    },
  });
  townTalk.ensureLoaded();
  preloadCharSheetArt({ renderer, fetchBytes, palette });   // U8a: INFO00I0 warms at boot
  // AUDIT 21 (hosts lane, F7): the classic HUD art. loadHud swallows a missing
  // file and answers null, and drawHud no-ops on null, so a host without the
  // art draws no HUD rather than failing to boot - the same law the title
  // screen and the char sheet follow.
  let hudArt = null;
  loadHud({ fetchBytes, ImgFile, palette, renderer }).then((a) => { hudArt = a; })
    .catch((e) => console.error('[hud]', e));
  preloadInventoryArt({ renderer, fetchBytes, palette });   // U8d: INVE00I0/01I0 warm at boot
  preloadChargenArt({ renderer, fetchBytes, palette });   // U10: CHAR0*/PICK00/TMAP00 warm at boot
  preloadMessageBoxArt({ renderer, fetchBytes, palette });   // U11: SPOP/BUTTONS warm at boot
  preloadPaperDollArt({ renderer, fetchBytes, palette, getTexture });   // U8f/U8g: SCBG/BODY/FACE + the item-record pipeline (town context; Breton male 0 is the PRE-chargen default, reloaded on the chosen identity)
  // S3d: the INTERIM dagger seed is the FALLBACK only - a character
  // who runs chargen gets AssignStartingGear's real kit instead, so
  // seeding here would leave a stray dagger in the bag.
  if (playerEntity.chargenDone) seedStartingEquipment(playerEntity);
  // S3c/U9 / THE FOUR HOSTS RULE: chargen lived only in the dungeon
  // host, so booting straight into a town left the player on the
  // pre-chargen INTERIM entity (flat skills 30, maxHealth 50) for the
  // whole session. Both exterior hosts now run it through the shared
  // session, and the paperdoll reloads on the chosen identity.
  let spellsByIndex = null;   // M2: the host-level SPELLS.STD map (the spellbook + the cast engine read it)
  if (!playerEntity.chargenDone && params.has('class')) {
    // AUDIT 17f: ?class=N is the headless skip - parsed here for the
    // DUNGEON the host might build, but never honoured for the host's
    // own chargen, so a town boot had no way past the overlay.
    loadSpellIndex(fetchBytes).then((sbi) => { spellsByIndex = sbi; return applyHeadlessChargen(playerEntity, Number(params.get('class')), { fetchBytes, spellsByIndex: sbi }); })
      .then(() => {
        preloadPaperDollArt({ renderer, fetchBytes, palette, getTexture },
          { race: playerEntity.race, gender: playerEntity.gender, faceIndex: playerEntity.faceIndex });
        surfacePlayer();
      })
      .catch((e) => console.warn('[chargen] CLASS*.CFG unavailable; the interim entity stands in', e));
  } else if (!playerEntity.chargenDone) {
    // AUDIT 17i: ONE construction seam - the flow arrives with every
    // dependency already attached (careers, SPELLS.STD, the biography
    // question sets), so a host cannot forget one. Three separate bugs
    // came from hosts wiring these by hand.
    createChargenFlow(fetchBytes).then(({ flow, spellsByIndex: sbi }) => {
      spellsByIndex = sbi;   // M2
      townTalk.showOverlay(createChargenWindow(flow, {
        // ui-chargen-4: the race screen's back cancels the wizard to
        // the front door (DFU unwinds to the start screen); the
        // reload re-runs the boot flow.
        onCancel: () => location.reload(),
        onDone: (r) => {
          finishChargen(playerEntity, r, sbi);
          preloadPaperDollArt({ renderer, fetchBytes, palette, getTexture },
            { race: r.race, gender: r.gender, faceIndex: r.faceIndex });
          surfacePlayer();
        },
      }));
    }).catch((e) => console.warn('[chargen] CLASS*.CFG unavailable; the interim entity stands in', e));
  }
  const droppedLoot = createDroppedLoot({ renderer, getTexture, uploadRecordFrame });   // U8e
  // FindGroundPosition (CreateDroppedLootContainer): the pile lands
  // on the ground BELOW the player, not at the motor's height
  const dropFeet = () => {
    const p0 = walkMode ? [...player.pos] : [...cam.pos];
    const d = collider.raycast(p0, [0, -1, 0], 10);
    if (Number.isFinite(d)) p0[1] -= d;
    return p0;
  };
  surfacePlayer();   // the probe surface exists from boot (T3b: pickpocket gold reads)
  let _livePersons = [];
  // G1: the city watch (SpawnCityGuards verbatim; Knight_CityWatch
  // class foes on the C11 stack). A guard's hit hurts the PLAYER
  // through the same entity the fall-damage path bills.
  const cityGuards = createCityGuards({
    renderer, collider, fetchBytes, getTexture, uploadRecordFrame, playerEntity, audio,
    say: (l) => townTalk.say(l),   // C-slice: equipment breaks speak
    currentMinute: () => Math.floor(playerTicker.classicMinutes),   // AUDIT 23 (hosts-3): a guard's poison anchors at NOW, not 0
    onPlayerHurt: (dmg, wpn) => {
      if (dmg <= 0) return;
      const apply = () => {
        hurtPlayer(playerEntity, dmg);   // AUDIT 21 hosts F6: the one damage door - this used to write health raw and never check for death
        audio.playOneShot(hitSoundFor(wpn), 1.1);
        surfacePlayer();
      };
      // G2: the verbatim arrest interception - a guard hit on an
      // active crime opens the surrender box instead of the damage
      if (!arrestFlow.onGuardHit(dmg, apply)) apply();
    },
  });
  const _guardPool = () => _livePersons.map(({ person, pos }) => ({
    pos, fwdYaw: person.facingYaw, guard: person.guard,
    disable: () => {
      const it = population?.pool.find((i) => i.person === person);
      if (it) { it.person.release(); it.active = false; it.scheduleEnable = false; it.scheduleRecycle = false; it.visible = false; }
    },
  }));
  // AUDIT 17e F6: DFU clears the active crime on OnExitLocationRect.
  // This host IS one fixed location with no rect to leave - the
  // streaming host (world.js) owns that edge. Nothing to clear here.
  function _crimeResponse() {
    const feet = walkMode ? player.pos : cam.pos;
    const fwd = [Math.sin(cam.yaw), 0, Math.cos(cam.yaw)];
    cityGuards.spawnCityGuards(true, { playerFeet: [...feet], playerFwd: fwd, pool: _guardPool() }).catch((e) => console.error('[guards]', e));
  }
  // G2: arrest + court through the townTalk overlay seam.
  //
  // AUDIT 21 F8 RETIRED THE OPEN FLAG THAT STOOD HERE. It said the prison
  // day-skip was a no-op until the shared calendar lands, and it was false
  // twice over: the clock landed in AUDIT 21 F2 (worldTick owns one now), and
  // the no-op was no longer inert once DAYS drive diseases - a thirty-day
  // sentence cost the player and the world nothing. createArrestFlow now
  // defaults advanceDays to the real clock, so there is no argument left for a
  // host to forget. What still pends is the prison SCREEN and FillVitalSigns'
  // full refill, neither of which is a calendar.
  const arrestFlow = createArrestFlow({ townTalk, playerEntity, regionIndex: dfLocation.regionIndex });
  const weaponRig = createWeaponRig({
    renderer, canvas, fetchBytes, palette, audio, entity: playerEntity,
    say: (l) => townTalk.say(l),
    spellArmed: () => magic.spellArmed(),   // M2: HasReadySpell hides the weapon
  });
  // M2 (the AUDIT 23 hosts-2 priority row): SPELLCASTING ABOVE GROUND.
  // One engine per page, mode-aware deps - exterior mode targets the
  // live guards through the SAME damage door as melee; interior mode
  // (worldModes' arm) has no foes and its own collider; the dungeon
  // keeps its integrated stack until M3. The absorb context finally
  // answers the exterior truth (inside false, day from the one clock) -
  // the S24 InLight/InDarkness arms go live here.
  const magic = createPlayerMagic({
    renderer, audio, getTexture, uploadRecord,
    collider: { raycast: (o, d, m) => ((modes?.mode === 'interior' && modes.interiorCollider) ? modes.interiorCollider : collider).raycast(o, d, m) },
    playerEntity,
    playerSinks: {
      hurt: (n) => { if (n > 0) hurtPlayer(playerEntity, n); },
      heal: (n) => { if (n > 0) { playerEntity.health = Math.min(playerEntity.maxHealth, playerEntity.health + n); surfacePlayer(); } },
      drainMagicka: (n) => { if (n > 0) { playerEntity.magicka = Math.max(0, (playerEntity.magicka ?? 0) - n); surfacePlayer(); } },
      restoreMagicka: (n) => { if (n > 0) { playerEntity.magicka = Math.min(playerEntity.maxMagicka ?? Infinity, (playerEntity.magicka ?? 0) + n); surfacePlayer(); } },
      drainFatigue: (n) => drainExteriorFatigue(n),
      restoreFatigue: (n) => { if (n > 0) { playerEntity.fatigue = Math.min(maxFatigue(playerEntity), (playerEntity.fatigue ?? 0) + n); surfacePlayer(); } },
      say: (l) => townTalk.say(l),
    },
    say: (l) => townTalk.say(l),
    surfacePlayer,
    foes: () => (modes?.mode ?? 'exterior') === 'exterior' ? cityGuards.guards : [],
    foeSinks: (g) => ({
      hurt: (n) => { if (n > 0) cityGuards.hurtGuard(g, n, player.pos); },
      heal: (n) => { if (n > 0) g.entity.health = Math.min(g.entity.maxHealth ?? Infinity, g.entity.health + n); },
      drainMagicka: (n) => { if (n > 0) g.entity.magicka = Math.max(0, (g.entity.magicka ?? 0) - n); },
      restoreMagicka: (n) => { if (n > 0) g.entity.magicka = Math.min(g.entity.maxMagicka ?? Infinity, (g.entity.magicka ?? 0) + n); },
      drainFatigue: (n) => { if (n > 0) g.entity.fatigue = Math.max(0, (g.entity.fatigue ?? 0) - n); },
      restoreFatigue: (n) => { if (n > 0) g.entity.fatigue = Math.min(maxFatigue(g.entity), (g.entity.fatigue ?? 0) + n); },
    }),
    absorbCtx: () => ((modes?.mode ?? 'exterior') === 'exterior'
      ? { inside: false, day: !isNight(minuteNow()) }
      : { inside: true, day: false }),
  });
  const toggleSpellbook = () => {
    if (townTalk.overlayActive || !spellsByIndex) return;
    townTalk.showOverlay(new SpellbookWindow(knownSpells(playerEntity, spellsByIndex), playerEntity, {
      ready: (sp) => magic.readySpell(sp),
      castCost: (sp) => calculateCastCost(sp, playerEntity).sp,
    }));
  };
  const arrows = new ArrowFlight({ getGpuMesh, collider: () => collider });   // C13
  let zPrevW = false;   // the ReadyWeapon (Z) edge
  const modeNow = () => modes?.mode ?? 'exterior';   // lazy - modes binds below (boot-time mouse events)
  // ENGINE RIG (slice 2, ?rig): the canonical animated character in
  // the world - same body, same animate.js runtime as the viewer.
  // Spawned near the player at terrain height (proper grounding =
  // slice 3); walks in place at the 9x character-pass standard once
  // the render split lands (slice 4).
  let rig = null, rigMat = null, rigPos = null;
  // WORLD CAMERA MODES (slice 6): first person (default) / third
  // person. In third person the rig RIDES the player - position from
  // the motor's feet, facing from cam.yaw, gait from live input - and
  // the camera pulls back along the view ray. V toggles at runtime
  // (lazy rig build); ?tp starts in third person. ?rig keeps its
  // fixed-park probe semantics when not riding.
  let tpMode = params.has('tp');
  const buildRig = async () => {
    const [{ createEngineRig, deriveClassicRamps }, { ImgFile }] = await Promise.all([
      import('../characters/engineRig.js'),
      import('../formats/imgFile.js'),
    ]);
    const bodyImg = new ImgFile();
    bodyImg.load(await fetchBytes('BODY00I0.IMG'), 'BODY00I0.IMG', palette);
    rig = createEngineRig(renderer, deriveClassicRamps(palette, bodyImg.getDFBitmap()));
    rig.setGait(1);
    window.__rig = rig;
  };
  if (params.has('rig') || tpMode) await buildRig();
  player.spawn(loc.width * RMB_SIDE * 0.46, GROUND_OFFSET * 0.025 + 2, loc.height * RMB_SIDE * 0.5);
  // Edge-detect latch shared with the mode machine: a held key must not
  // re-trigger across a mode switch.
  const latch = { use: false, view: false, crouch: false };   // audit 16f: jump is HELD since P14 - the latch slot was dead
  console.log(`player: collider ${colliderTris} tris, walk=${walkMode}`);
  if (shotMode) {
    window.__player = {
      get pos() { return [...player.pos]; },
      warp: (x, y, z) => player.spawn(x, y, z),
    };
  }
  const extentX = loc.width * RMB_SIDE;
  const extentZ = loc.height * RMB_SIDE;
  const center = [extentX / 2, 4, extentZ / 2];
  const cam = {
    pos: [center[0], 14, extentZ + 40],
    yaw: Math.PI,
    pitch: -0.08,
  };
  const keys = new Set();
  // P15: AltLeft is Sneak (DFU default) - preventDefault on BOTH edges
  // or the browser menu steals focus (Firefox activates it on keyUP).
  // T3b: the town seam eats its keys FIRST (F1-F4 modes; overlay
  // Esc/Enter) so a held overlay never leaks into the movement set.
  addEventListener('keydown', (e) => {
    if (townTalk.keydown(e)) return;
    // U8a: F5 opens the classic character sheet (the dungeon's key,
    // host rule); preventDefault stops the browser reload.
    // AUDIT 17e F41: preventDefault must run for F5 in EVERY mode -
    // the mode gate skipped the handler AND its preventDefault, so
    // pressing F5 inside a building reloaded the page and destroyed
    // the session. Routing F5/F6 into interiors is its own arc
    // (FLAGGED); swallowing the browser reload is not optional.
    if (e.code === 'F5' || e.code === 'F6') e.preventDefault();
    if (e.code === 'F5' && !townTalk.overlayActive && (modes?.mode ?? 'exterior') === 'exterior') {
      townTalk.showOverlay(new CharSheet(playerEntity));
      return;
    }
    // U8d: F6 opens the classic inventory (DFU's default Inventory
    // binding; same host rule as F5).
    if (e.code === 'F6' && !townTalk.overlayActive && (modes?.mode ?? 'exterior') === 'exterior' && inventoryArtLoaded()) {
      townTalk.showOverlay(new NativeInventoryWindow({
        items: () => (playerEntity.items ??= []),
        entity: playerEntity,
        icons: { getTexture, uploadRecord, textures: renderer.textures },
        rows: (id) => townTalk.lines(id),   // U25: the real item info + use text (TEXT.RSC)
        nowMinute: () => Math.floor(playerTicker.classicMinutes),
        onDrop: (items) => droppedLoot.dropPile(items, dropFeet()),   // U8e: OnPop mints the world pile
      }));
      return;
    }
    // M2: the DFU spellbook binding (Backspace) and our cast key -
    // gameAction's own map, hand-routed like this host's F5/F6 arms.
    if (e.key === 'Backspace' && !townTalk.overlayActive && (modes?.mode ?? 'exterior') === 'exterior') {
      e.preventDefault();
      toggleSpellbook();
      return;
    }
    if (e.code === 'KeyC' && walkMode && !townTalk.overlayActive && (modes?.mode ?? 'exterior') === 'exterior') {
      const fwd = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
      magic.castInput([...cam.pos], fwd);
      return;
    }
    keys.add(e.code);
    if (e.code === 'AltLeft') e.preventDefault();
    // DFU parity: mouselook is the resting state - any gameplay
    // keypress re-engages a dropped lock (no click-to-look mode).
    if (!townTalk.overlayActive && !(modes?.overlayHeld ?? false) && document.pointerLockElement !== canvas) requestLook(canvas);
  });
  addEventListener('keyup', (e) => { keys.delete(e.code); if (e.code === 'AltLeft') e.preventDefault(); });
  canvas.addEventListener('pointerdown', (e) => { if (townTalk.pointerdown(e)) return; if (modes.pointerdown?.(e)) return; requestLook(canvas); });   // U8b/U8c: native windows own the pointer
  canvas.addEventListener('wheel', (e) => { if (townTalk.wheel(e) || modes.wheel?.(e)) e.preventDefault(); }, { passive: false });   // U-scroll: an open window owns the wheel
  // C9: RMB is a weapon control (drag-to-swing) exactly as the
  // dungeon host - the drag feeds the rig INSTEAD of the look.
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== canvas) return;
    if (walkMode && (e.buttons & 2) && modeNow() === 'exterior') { if (magic.interceptAttack(true)) return; weaponRig.attackInput(e.movementX, e.movementY, true); return; }   // M2: an armed cast eats the click
    cam.yaw -= e.movementX * 0.0025;
    cam.pitch = Math.max(-1.5, Math.min(1.5, cam.pitch - e.movementY * 0.0025));
  });
  addEventListener('mousedown', (e) => { if (e.button === 2 && walkMode && modeNow() === 'exterior') { if (magic.interceptAttack(true)) return; weaponRig.attackInput(0, 0, true); } });   // M2
  addEventListener('mouseup', (e) => { if (e.button === 2 && walkMode && modeNow() === 'exterior') weaponRig.attackInput(0, 0, false); });
  attachTouch(canvas, {   // mobile: stick synthesizes WASD; drag-look rides the mouse factor
    look: (dx, dy) => {
      cam.yaw -= dx * 0.0025;
      cam.pitch = Math.max(-1.5, Math.min(1.5, cam.pitch - dy * 0.0025));
    },
    attack: (dx, dy, held) => { if (walkMode && modeNow() === 'exterior') { if (held && magic.interceptAttack(true)) return; weaponRig.attackInput(dx, dy, held); } },   // M2
    attackTap: () => { if (walkMode && modeNow() === 'exterior') weaponRig.clickAttack(); },
    cycleMode: () => townTalk.nextMode(),   // T3-touch: the phone's F1-F4
  });

  // P7: the exterior scene hosts the same mode machine as ?world -
  // E on a building door enters its interior, E on a DUNGEON_ENTRANCE
  // door drops into the location's crawl, exits land verbatim.
  var modes = createWorldModes({
    canvas, renderer, player, cam, keys, latch, blocks,
    magic, spellsByIndex: () => spellsByIndex,   // M2: the one cast engine + SPELLS.STD ride into the interior arm
    townTalk,   // U23: the interior host borrows FACTION.TXT/TEXT.RSC + the talk seam
    // A5b: the tavern arm needs the host's clock, and leaving one has to
    // hand the street back its own song - the host owns both, so both
    // ride in as closures rather than worldModes reaching for a global.
    pipeline: { getGpuMesh, cpuModels, getTexture, uploadRecord, arch, palette },
    foes: !params.has('nofoes'),   // C11: foes are the DEFAULT now (monsters live; ?nofoes for the empty-dungeon dev view)
    playerClass: params.has('class') ? Number(params.get('class')) : undefined,
    playerSpell: params.has('spell') ? Number(params.get('spell')) : undefined,
    playerWeapon: params.get('weapon') ?? undefined,
    doorTargets: () => buildingDoors,
    baseCollider: () => collider,
    // E2: one entered door -> its merged building identity (the T3c
    // pool merge) + the directory name by buildingKey.
    buildingDataForDoor: (hit) => {
      if (!hit) return null;
      const d = buildingDataForDoor(dfLocation.exterior.buildings, loc.blocks, {
        dfBlock: hit.dfBlock, recordIndex: hit.recordIndex,
        position: [hit.door.matrix[12], hit.door.matrix[13], hit.door.matrix[14]],
      });
      if (!d) return null;
      return { ...d, regionIndex: dfLocation.regionIndex, name: townTalk.directory.find((e) => e.buildingKey === d.buildingKey)?.name ?? '' };
    },
  });
  if (shotMode) {
    window.__frame = window.__frame ?? 0;   // AUDIT 17e F37: the counter is now incremented, so seed it
    window.__pose = (x, y, z, yaw, pitch) => {
      cam.yaw = yaw; cam.pitch = pitch;
      // walk mode: the camera FOLLOWS the motor - move the player
      // (a bare cam.pos write is overwritten next frame; T1 probe fix)
      if (walkMode) player.spawn(x, y, z); else cam.pos = [x, y, z];
    };
    modes.installShotProbes();
    window.__magic = () => JSON.stringify({ mp: playerEntity.magicka, readied: magic.readied()?.name ?? null, armed: magic.spellArmed(), missiles: magic.missileCount(), mode: modes?.mode ?? 'exterior', book: (playerEntity.spells ?? []).map((sp) => ({ name: sp.name, range: sp.rangeType })) });   // M5 cast probe
    window.__readyRanged = () => { const sp = knownSpells({}, spellsByIndex).map((x) => [calculateCastCost(x, playerEntity).sp, x]).sort((a, b) => a[0] - b[0])[0]?.[1]; magic.setReadied(sp); return sp ? `${sp.name}:${calculateCastCost(sp, playerEntity).sp}` : null; };   // M5: no classic starting set carries a missile spell - ready the cheapest flier for the flight leg
    // T1: the townsfolk probe surface
    window.__people = () => JSON.stringify((population?.pool ?? []).map((it, i) => ({
      i, active: it.active, visible: it.visible, pend: it.scheduleEnable, recyc: it.scheduleRecycle,
      archive: it.person.archive, state: it.person.state, moves: it.person.moveCount, seeks: it.person.seekCount,
      pos: it.person.pos.map((v) => Number(v.toFixed(2))),
    })).filter((x) => x.active));
    window.__talk = () => JSON.stringify(townTalk._debug());   // T3b probe surface
    // U25: the inventory window's live message box (info, use, wagon,
    // the drop-gold field) - the probe reads what the player is being
    // told rather than only that a box exists.
    window.__invBox = () => townTalk._debug().overlayBox;
    window.__chargenRace = () => townTalk._debug().overlayFlow?.race?.key ?? null;   // U10 probe surface
    window.__chargenConfirm = () => townTalk._debug().overlayFlow?.raceConfirm ?? null;   // U11 probe surface
    window.__chargenFlow = () => townTalk._debug().overlayFlow ?? null;   // S3e probe surface
    window.__addGold = (n) => addGold(playerEntity, n);   // U10 probe surface: gold through the real producer
    window.__guards = () => JSON.stringify(cityGuards._debug());   // G1 probe surface
    window.__droppedLoot = () => JSON.stringify(droppedLoot._piles.map((pl) => ({ n: pl.items.length, pos: pl.pos.map((v) => +v.toFixed(1)), record: pl.record, flat: !!pl.batch })));   // U8e probe surface
    window.__crime = () => _crimeResponse();   // G1: force the response without pickpocket RNG
    window.__guardDamage = (i, dmg) => cityGuards._damage(i, dmg);   // G3: the real death path for loot probes
    window.__uiArt = () => JSON.stringify({ charsheet: charSheetArtLoaded() });   // U8a probe surface
    window.__attack = () => weaponRig.clickAttack();   // G4: ClickToAttack for swing probes
    window.__townDebug = () => JSON.stringify({
      night: isNight(minuteNow()), pool: population?.pool.length ?? 0, max: population?.maxPopulation ?? 0, populated,
      player: cam.pos.map((v) => Number(v.toFixed(1))), yaw: Number(cam.yaw.toFixed(2)), walkMode,
    });
  }

  // T1 TOWNS: the wandering population (PopulationManager verbatim -
  // 10Hz pool, 24/16-blocks clamp, daytime only, anti-skate hidden
  // first move). Race: the region's people - Daggerfall = Breton
  // (FLAGGED: the climate People table pends; the test city is
  // correct). Each pool person owns a live billboard batch (the C11
  // shape) drawn on the flats' axis (the billboard-axis doctrine).
  // AUDIT 18 HOST GAP: StreamingWorld.cs:771-781 adds PopulationManager
  // to exactly SEVEN LocationTypes. The streaming host gated on them;
  // this host constructed a population for whatever ?region/?loc
  // resolved to, so every graveyard, coven, keep, ruin and poor home
  // got wandering townsfolk (and the talk/crime surfaces they carry)
  // that DFU never creates there. The table now lives in shared.js.
  const populated = populatesWanderingNpcs(dfLocation.mapTableData.locationType);
  // AUDIT 23 (characters-4) - PopulationManager.cs:94: the wandering
  // race is the CLIMATE's People (Redguard deserts, Nord mountains);
  // it was hardcoded Breton. FACTION_RACES numbers -> texture keys.
  const populationRace = ({ 0: 'Nord', 2: 'Redguard', 3: 'Breton' })[dfLocation.climate?.people] ?? 'Breton';
  const personArchives = [...PERSON_TEXTURES[populationRace].male, ...PERSON_TEXTURES[populationRace].female, GUARD_TEXTURE];
  const personTex = new Map();
  if (populated) await Promise.all(personArchives.map(async (a) => personTex.set(a, await getTexture(a))));
  const personBatchOf = new Map();   // person -> batch
  const population = !populated ? null : new TownPopulation(cityNav, {
    totalBlocks: loc.width * loc.height,
    race: populationRace,
    // AUDIT 23 (characters-5) - MobilePersonNPC.cs:214: the NAME bank
    // is the REGION's (MapsFile.RegionRaces), not the billboard race.
    nameBank: getNameBankOfRegion(dfLocation.regionIndex),
    makePerson: (archive, guard) => {
      const person = new MobilePerson(cityNav, {
        archive, guard,
        // audit 2026-08-17: identity re-rolls per spawn - resolve the
        // texture by the person's LIVE archive, never the creation one
        frameCount: (rec, a) => personTex.get(a).getFrameCount(rec),
        collider,
        groundY: (x, z) => collider.heightAt(x, z),
      });
      personBatchOf.set(person, renderer.createBillboardBatch(archive, 0, { w: 1, h: 1 }, [[0, 0, 0]]));
      return person;
    },
  });
  let _lastPlayerPos = null, _playerStill = false;

  const lightAnimator = new CityLightAnimator(cityLights.length, CITY_LIGHT_RANGE);
  const nightAmbientFloor = new Float32Array([0.25, 0.25, 0.25]);

  status(`${locationName} - ${loc.blocks.length} blocks, ${drawList.length} draws`);
  console.log(
    `scene: ${loc.blocks.length} blocks, ${drawList.length} placements, ` +
    `${gpuMeshes.size} meshes, ${renderer.textures.size} textures, ${flatCount} flats in ${billboardBatches.length} batches, ${cityLights.length} lights, ` +
    `ground ${groundArchive}, climate ${climateBase}, season ${season}, ${texRemap.size} swaps, ${renderer.emissionTextures.size} window masks`
  );

  let frames = 0;
  const ambience = new AmbientEffects(EXTERIOR_AMBIENT_WAITS);   // A3
  let last = performance.now();
  const lookGate = makeLookGate(canvas);
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    lookGate(townTalk.overlayActive || (modes?.overlayHeld ?? false));   // a window up frees the cursor; closing re-locks

    // Modal frame (worldModes.js): interior/dungeon consume the frame
    // entirely - none of the exterior sky/weather/light path runs.
    // AUDIT 21 F1: THE MUSIC CONTEXT IS FED BEFORE THE MODAL RETURN.
    // worldModes.frame() consumes the frame and returns TRUE for interior
    // and dungeon; musicContext() returns null ONLY for exterior. They are
    // the same predicate, so with the update below the early return it ran
    // exclusively on frames where the overlay was guaranteed to be null -
    // entering a tavern kept the street song, entering a dungeon kept the
    // sunny outdoor track, and when that song ended nothing fed `songEnded`
    // so it fell silent for the rest of the visit. The whole interior and
    // dungeon music path was dead code in this host.
    musicDirector.update({
      inside: false,
      inLocationRect: _musicInLocationRect(),
      locationType: _musicLocationType(),
      locationIndex: _musicLocationIndex(),
      weather,
      night: isNight(minuteNow()),
      gameDays: gameDaysNow(),
      // UpdatePlayerMusicArrested (:568-571). Checked FIRST in
      // AssignPlaylist and overrides the environment entirely.
      arrested: Boolean(playerEntity.arrested),
    }, modes?.musicContext?.() ?? null);

    if (modes.frame(dt, now)) {
      requestAnimationFrame(frame);
      return;
    }


    const fwd = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
    const right = [-Math.cos(cam.yaw), 0, Math.sin(cam.yaw)];   // camera-right = up x back (lookAt handedness): D must move SCREEN-right - the +cos/-sin vector was screen-LEFT (A/D felt swapped)
    if (walkMode) {
      // Grounded movement: verbatim speeds in the motor, Space edge-jumps.
      const jumpHeld = keys.has('Space');
      const crouchHeld = keys.has('KeyX');   // P12 host parity (audit F4)
      const _overlayHeld = (modes?.dungeonCtx?.uiOverlayActive ?? false) || townTalk.overlayActive;   // chargen/windows/talk hold the motor - typing must not walk the player
      // AUDIT 18 F9: the player's world clock, HELD by the same gate.
      // It ran only inside a dungeon before F8 moved it here; F8 then
      // ran it unconditionally, which is the U7 bug shape inverted -
      // DFU stops the clock outright under a paused window. PauseGame
      // (GameManager.cs:600-610) sets Time.timeScale = 0, and
      // WorldTime.Update (:60-69) advances the calendar by
      // `Time.deltaTime * TimeScale`, so a PauseWhileOpen window
      // freezes game time entirely: no magic round, no disease day, no
      // fatigue, no skill advancement. Open the char sheet and the
      // motor already held here - the clock did not, so a disease
      // aged while the game was paused.
      if (!_overlayHeld) playerTicker.tick(dt * timeScaleMult, {
        // AUDIT 23 (entity-2): playerMotor.IsRunning && !IsStandingStill
        // (PlayerEntity.cs:408) - `player.running` never existed, so the
        // 88/min running drain was dead above ground. C6: the jump edge.
        running: player.isRunning && !player.standing,
        swimming: player.swimming,
        jumped: player.jumped,
      });
      // AUDIT 18 HOST GAP: levitate/waterWalking/slowFall were written
      // ONLY inside worldModes' dungeon branch and never cleared, so
      // leaving a dungeon while levitating stranded the player in the
      // motor's no-gravity branch forever. The EFFECT owns the flag
      // (Levitate.cs:131/:136); swimming is false outdoors (there is
      // no blockWaterLevel - PlayerEnterExit.IsPlayerSwimming).
      applyMotorEffectFlags(player, playerEntity);
      if (!_overlayHeld) player.update(dt, {
        forward: (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0),
        strafe: (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0),
        run: keys.has('ShiftLeft'),
        sneak: keys.has('AltLeft'),   // P15: DFU's default Sneak binding (LeftAlt), held
        jump: jumpHeld,   // P14: HELD, verbatim (the 0.1 s grounded gate owns re-fire)
        crouch: crouchHeld && !latch.crouch,
      }, cam.yaw);
      latch.crouch = crouchHeld;
      // C9: ReadyWeapon (Z) - the sheathe toggle, host parity.
      const zNowW = keys.has('KeyZ');
      if (zNowW && !zPrevW) weaponRig.toggleSheath();
      zPrevW = zNowW;
      // P14 fall damage (host parity; the outdoor-water exemption is
      // FLAGGED here exactly as in world.js - no tile lookup yet).
      applyFallLanding(playerEntity, player.landedFallDistance, { sound: (id) => audio.playOneShot(id) });
      // FS-slice: PlayerFootsteps - the exterior stride.
      {
        const _step = footsteps.update(player.pos, {
          grounded: player.grounded, swimming: player.swimming, levitating: player.levitating,
          standingStill: !keys.has('KeyW') && !keys.has('KeyS') && !keys.has('KeyA') && !keys.has('KeyD'),
          halfSpeed: player.movingLessThanHalfSpeed,
        }, pickFootstepSet({ inside: false, winter: season === SEASON.Winter, climateIndex: locClimateIndex }));
        if (_step) audio.playOneShot(_step.clip, _step.volume);
      }
      cam.pos = player.eye;
      const useHeld = keys.has('KeyE');
      if (useHeld && !latch.use && !modes.transitioning) {
        // T3b: a townsperson under the ray wins the activation (the
        // PlayerActivate nearest-hit order); G3: a guard corpse next
        // (loot pickup on the dungeon's S2 shape); doors otherwise.
        const useFwd = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
        if (!townTalk.tryActivate(cam.pos, useFwd, _livePersons)) {
          const lootKey = pickActivatable(cam.pos, useFwd, cityGuards.lootTargets(), collider);
          const dropKey = lootKey ? null : pickActivatable(cam.pos, useFwd, droppedLoot.lootTargets(), collider);
          if (lootKey) { cityGuards.takeLoot(lootKey, (l) => townTalk.say(l)); surfacePlayer(); }
          else if (dropKey && inventoryArtLoaded()) {
            // U8e: a pile under the ray opens the inventory WITH the
            // pile as the remote target (Remove defaults - the OnPush law)
            const pile = droppedLoot.pileFor(dropKey);
            townTalk.showOverlay(new NativeInventoryWindow({
              items: () => (playerEntity.items ??= []),
              onClose: () => droppedLoot.releaseEmptied(),   // AUDIT 17e F28: DFU frees the container on window close
        entity: playerEntity,
              loot: { items: () => pile.items },
              icons: { getTexture, uploadRecord, textures: renderer.textures },
              rows: (id) => townTalk.lines(id),   // U25: the real item info + use text (TEXT.RSC)
              nowMinute: () => Math.floor(playerTicker.classicMinutes),
              onDrop: (items) => droppedLoot.dropPile(items, dropFeet()),
            }));
          }
          else modes.tryEnter().catch((e) => console.error(e));
        }
      }
      latch.use = useHeld;
      // V toggles first/third person (edge-latched like jump/use);
      // the rig builds lazily on first entry into third person.
      const viewHeld = keys.has('KeyV');
      if (viewHeld && !latch.view) {
        tpMode = !tpMode;
        if (tpMode && !rig) buildRig().catch((e) => console.error(e));
      }
      latch.view = viewHeld;
    } else {
      const speed = (keys.has('ShiftLeft') ? 120 : 30) * dt;
      if (keys.has('KeyW')) for (let a = 0; a < 3; a++) cam.pos[a] += fwd[a] * speed;
      if (keys.has('KeyS')) for (let a = 0; a < 3; a++) cam.pos[a] -= fwd[a] * speed;
      if (keys.has('KeyA')) for (let a = 0; a < 3; a++) cam.pos[a] -= right[a] * speed;
      if (keys.has('KeyD')) for (let a = 0; a < 3; a++) cam.pos[a] += right[a] * speed;
    }

    // Shot vantage scales with the location extent.
    const riding = tpMode && walkMode && !!rig;
    const TP_DIST = 3.2;   // third-person pull-back along the view ray (camera-terrain clip: open, noted in the arc)
    const target = shotMode && !walkMode
      ? [extentX * 0.46, 6, extentZ * 0.5]
      : [cam.pos[0] + fwd[0], cam.pos[1] + fwd[1], cam.pos[2] + fwd[2]];
    const eye = shotMode && !walkMode
      ? [extentX * 0.565, 11, extentZ * 0.72]
      : riding
        ? [cam.pos[0] - fwd[0] * TP_DIST, cam.pos[1] - fwd[1] * TP_DIST, cam.pos[2] - fwd[2] * TP_DIST]
        : cam.pos;
    const proj = perspective(
      Math.PI / 3,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      Math.max(2000, extentX * 4)
    );
    const view = lookAt(eye, target, [0, 1, 0]);

    // World clock (R5): sun direction/intensity and ambient follow the time
    // of day; the sun is off at night leaving the 0.25 ambient floor.
    const minute = minuteNow();
    // A3: the exterior ambience (WeatherAmbientEffects 5/25).
    audio.setListener(eye, [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]]);
    ambience.setPreset(presetForExterior(weather, isNight(minute)));
    ambience.update(dt, { playerPos: eye });
    animalAmbience.update(dt, eye);   // A4: town animal barks (PlayRandomlyIfPlayerNear)
    // Storm lightning: verbatim frame-strobe multiplier on the sun (2x
    // during a flash frame); ?flashtest pins it on for shots.
    const flash = params.has('flashtest') ? 2 : (lightning ? lightning.tick(dt) : 1);
    renderer.setLighting(
      exteriorAmbient(minute, 1, weatherSun), sunScale(minute) * weatherSun * flash,   // AUDIT 23 (wts-2): ambient rides the weather scale too
      new Float32Array(SUN_RIG_COLOR));
    // R12: the player-following indirect point light (SunlightRig) -
    // intensity x the daylight curve, weather-dimmed with the rig,
    // off at night; positioned at the player (the eye here - the
    // 0.8 controller-center offset is <1% of the 150 range).
    {
      const iScale = indirectLightScale(minute) * weatherSun;
      renderer.setIndirectLight(eye, INDIRECT_LIGHT_RANGE, new Float32Array([
        INDIRECT_LIGHT_COLOR[0] * iScale, INDIRECT_LIGHT_COLOR[1] * iScale, INDIRECT_LIGHT_COLOR[2] * iScale,
      ]));
    }
    renderer.setWindowEmission(windowEmissionRGB(
      params.has('window') ? params.get('window')
        : (windowStyleForWeather(weather) ?? windowStyleForTime(minute))));
    // DaggerfallSky.cs:363-367 - a non-Normal WeatherStyle (every rain,
    // thunder and snow) disables the clear night sky, so the DAY sky at
    // frame 0 is drawn instead. weatherSkyOffset IS the WeatherStyle
    // (Rain1 4 / Rain2 5 / Snow1 6 / Snow2 7; Normal is 0).
    // AUDIT 23 (wts-1) - DaggerfallSky.cs:354-357: the Normal-weather
    // arm adds the CALENDAR season to SkyBase (Fall 0 / Spring 1 /
    // Summer 2 / Winter 3); the rain/snow variants keep their boot
    // roll. One clock, so the season reads the world date.
    sky.use(dfLocation.climate.skyBase + (weatherSkyOffset === 0
      ? seasonValue(dateFromClassicMinutes(playerTicker.classicMinutes)) : weatherSkyOffset), minute, weatherSkyOffset === 0);
    // Weather fog, colored by the live sky horizon fill (fills DFU's
    // fogColor TODO); heavy fog also swallows the sky.
    // Verbatim: fog is never disabled (SetFog keeps RenderSettings.fog on);
    // Sunny/Overcast ARE linear fog to 2400 - the classic distance haze.
    // DaggerfallSky.SetSkyFogColor (:318-325): anything denser than
    // heavy rain fogs to Color.gray, not to the sky tint.
    const fogColor = outdoorFogColor(weatherFog, sky.renderer.clearColor);
    renderer.setFog(weatherFog.mode,
      weatherFog.density, weatherFog.start, weatherFog.end, fogColor);
    sky.renderer.fogColor = fogColor;
    sky.renderer.fogMix = weatherFog.excludeSky ? 0 : 1 - fogFactor(weatherFog, 800);

    // City lanterns: on 17:00-08:00 (IsCityLightsOn), each flickering
    // verbatim DaggerfallLight (14 ticks/s toward random range targets).
    const lightsOn = lightsOnAt(minute);
    if (lightsOn) lightAnimator.tick(dt);
    renderer.setPointLights(
      lightsOn
        ? nearestLights(cityLights, eye, 16, lightAnimator.ranges)
        : new Float32Array(0),
      CITY_LIGHT_COLOR_F32
    );
    renderer.beginFrame(proj, view, sunDirection(minute));
    {
      const dx = target[0] - eye[0], dy = target[1] - eye[1], dz = target[2] - eye[2];
      const horiz = Math.hypot(dx, dz) || 1e-6;
      sky.draw(Math.atan2(dx, dz), Math.atan2(dy, horiz), Math.PI / 3,
        canvas.clientWidth / canvas.clientHeight);
    }
    renderer.drawTerrain(groundSurface, identityMatrix,
      renderer.tileArrays.get(groundArchive), tilemapTex, 6.4);
    for (const d of drawList) renderer.drawMesh(d.mesh, d.matrix, texRemap);
    if (rig && (riding || params.has('rig'))) {
      if (riding) {
        // Gait from live input over the SAME keys the motor reads;
        // airborne keeps the last grounded gait's look via stand.
        const mvF = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
        const mvS = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
        rig.setGait((mvF || mvS) ? (keys.has('ShiftLeft') ? 2 : 1) : 3);
      } else rig.setGait(1);   // parked probe rig: the slice-2 walking-in-place semantics
      rig.update(dt);
      const s = rig.scale;
      let px, py, yawDeg;
      if (riding) {
        // Ride the motor: FEET position verbatim (jumps carry the rig),
        // facing = camera yaw (model +z is the body's front).
        px = player.pos[0]; py = player.pos[1]; yawDeg = cam.yaw * 180 / Math.PI;
        rigPos = [px, 0, player.pos[2]];
      } else {
        if (!rigPos) {
          if (params.has('rigNear')) {   // probe affordance: park at the view ray's GROUND intersection so the 9x texel grid is screen-measurable and centered
            const f = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]];
            const fl = Math.hypot(f[0], f[1], f[2]) || 1;
            const d = [f[0] / fl, f[1] / fl, f[2] / fl];
            const t = 24;   // fixed: deep enough that a grounded figure fits the frustum below a high near-horizontal vantage
            rigPos = [eye[0] + d[0] * t, 0, eye[2] + d[2] * t];
          } else { const p = player.pos; rigPos = [p[0] + 2, 0, p[2] + 3]; }   // FIXED world placement, captured once at first frame
        }
        px = rigPos[0]; yawDeg = 0;
        py = collider.heightAt(rigPos[0], rigPos[2]);   // grounded through the SAME contract the player stands on - real terrain inherits for free (slice 3)
      }
      const gy = py;
      rigMat = trs(px, gy - rig.liveFootY * s, rigPos[2], 0, yawDeg, 0, s, s, s);   // live support point: feet kiss the ground every frame
      // THE CHARACTER PIXELIZE PASS: shared implementation (C8 E1
      // extraction of slice 4 - characterSprite.js), identical math.
      const diag = drawCharacterSprite(renderer, canvas, rig, rigMat, proj, view, eye);
      if (params.has('shot')) {
        const { center, halfH, pw, ph } = diag;
        const pv = multiply(proj, view);
        const prj = (x, y, z) => { const w = pv[3]*x + pv[7]*y + pv[11]*z + pv[15]; return [ (pv[0]*x + pv[4]*y + pv[8]*z + pv[12]) / w, (pv[1]*x + pv[5]*y + pv[9]*z + pv[13]) / w ]; };
        const cN = prj(center[0], center[1], center[2]);
        const tN = prj(center[0], center[1] + halfH, center[2]);
        const W2 = canvas.clientWidth / 2, H2 = canvas.clientHeight / 2;
        window.__rigGround = { ty: rigMat[13], gy, footY: rig.liveFootY, s, pw, ph,
          scrX: cN[0] * W2 + W2, scrY: H2 - cN[1] * H2, scrHalfHpx: Math.abs((tN[1] - cN[1]) * H2) };
      }
    }
    // Classic Daggerfall billboards rotate about Y only: right from the view,
    // up stays world-Y.
    const camRight = new Float32Array([Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)]);
    if (shotMode) {
      const dx = target[0] - eye[0];
      const dz = target[2] - eye[2];
      const l = Math.hypot(dx, dz) || 1;
      camRight[0] = -dz / l;
      camRight[2] = dx / l;
    }
    // C13: exterior arrows fly with the scene meshes (lost on
    // geometry, as DFU misses are).
    arrows.update(dt);
    arrows.draw(renderer, texRemap);
    renderer.drawBillboards(billboardBatches, camRight, new Float32Array([0, 1, 0]));
    if (magic.batches().length) renderer.drawBillboards(magic.batches(), camRight, new Float32Array([0, 1, 0]));   // M2: spell missiles in flight
    // T1: the wandering townsfolk - population ticks at 10Hz, the
    // politeness idle gate (still + near + SHEATHED + visible; no
    // exterior foes), daytime only; live persons render as C11-style
    // mobile batches on the flats' axis.
    if (walkMode) {
      _playerStill = _lastPlayerPos !== null &&
        Math.hypot(cam.pos[0] - _lastPlayerPos[0], cam.pos[2] - _lastPlayerPos[2]) < 0.001;
      _lastPlayerPos = [cam.pos[0], cam.pos[1], cam.pos[2]];
      // audit 2026-08-17: DFU pauses the sim under UI windows - the
      // population freezes (dt 0 still returns frames for drawing)
      // while the talk overlay is up, so nobody walks away mid-talk.
      const popDt = townTalk.overlayActive ? 0 : dt;
      const live = !population ? [] : population.update(popDt, cam.pos, cam.yaw, eye, !isNight(minute), (person) => {
        const pd = Math.hypot(person.pos[0] - cam.pos[0], person.pos[2] - cam.pos[2]);
        return _playerStill && pd < 2.5 && !!weaponRig.playerWeapon.sheathed && !isInvisible(playerEntity);
      });
      _livePersons = live.map(({ person }) => ({ person, pos: person.pos }));   // T3b: the activation ray's targets
      const personBatches = [];
      for (const { person, out } of live) {
        const batch = personBatchOf.get(person);
        batch.archive = person.archive;   // audit 2026-08-17: identity re-rolls per spawn - re-point the batch
        const t = personTex.get(person.archive);
        const rkey = `${out.record}#${out.frame}`;
        if (!renderer.textures.has(`${person.archive}_${rkey}`)) uploadRecordFrame(person.archive, out.record, out.frame);
        const sz = scaledBillboardSize(t.getSize(out.record), t.getScale(out.record));
        batch.record = rkey;
        batch.size = { w: out.flip ? -sz.w : sz.w, h: sz.h };
        batch.origin = [person.pos[0], person.pos[1], person.pos[2]];
        personBatches.push(batch);
      }
      // G1: the guards drive + draw on the same flats' axis; the sim
      // freezes with the population under the talk overlay.
      const guardBatches = cityGuards.update(townTalk.overlayActive ? 0 : dt,
        walkMode ? player.pos : cam.pos, eye, { playerInvisible: isInvisible(playerEntity) });
      personBatches.push(...guardBatches);
      personBatches.push(...droppedLoot.batches());   // U8e: the ground piles
      if (personBatches.length) renderer.drawBillboards(personBatches, camRight, new Float32Array([0, 1, 0]));
    }
    if (precip) {
      precip.draw(precipMode, proj, view, new Float32Array(eye), camRight, now / 1000);
    }
    // C9: the exterior FP weapon (first-person walk only - the V
    // third-person view has no FP overlay). Same residuals as the
    // world host: no bashables in melee reach; bows consume + tally
    // and the loose is VISIBLE now (C13).
    if (walkMode && !tpMode) {
      // M2: the armed click's cast fires with the LIVE look; missiles
      // fly through this host's world every walk frame.
      if ((modes?.mode ?? 'exterior') === 'exterior') {
        const _mfwd = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
        magic.firePending([...cam.pos], _mfwd);
        magic.update(dt, player.pos);
      }
      // U8h/AUDIT 17e F17: the worn-weapon bind moved INTO createWeaponRig
      // so all four hosts inherit it (the interior host was missing it).
      for (const ev of weaponRig.frame(dt)) {
        // AUDIT 23 (combat-2): the bow machine's frame-4 loose sound.
        if (ev === 'bowSound') { audio.playOneShot(SOUND.ArrowShoot, 1.1); continue; }
        if (ev !== 'hit') continue;
        if (weaponTypeForItem(weaponRig.playerWeapon.weapon) === WEAPON_TYPES.Bow) {
          if (removeOne(playerEntity.items, 131)) {
            // AUDIT 23 (C14: hosts-4 = combat-5) - WeaponManager.cs
            // :419-436: the swing costs its fatigue whatever it hits,
            // and a BOW always takes the FULL tally arm (Archery AND
            // CriticalStrike) - this arm tallied Archery alone, free.
            drainExteriorFatigue(SWING_WEAPON_FATIGUE_LOSS);
            tallySwingSkills(playerEntity, weaponRig.playerWeapon.weapon);
            arrows.fire(eye, fwd);
          }
          continue;
        }
        // C14: the melee swing's fatigue, unconditional - it lived
        // behind cityGuards' no-live-guards early return.
        drainExteriorFatigue(SWING_WEAPON_FATIGUE_LOSS);
        // G1: melee swings resolve against live guards (reach + LOS
        // inside resolveHit); a landed hit tallies the weapon skill.
        // G4: no guard hit -> WANDERING townsfolk (civilian one-hit
        // Murder + response; wandering guard NPC -> Assault +
        // conversion with the swing carried onto the fresh foe).
        const guardHitSound = (g) => audio.play3d(hitSoundFor(weaponRig.playerWeapon.weapon), g.ai.feet, 1.1, { maxDistance: 16 });
        // AUDIT 23 (combat-4): the host-side WEAPON_SKILL tallies are
        // GONE - cityGuards.resolvePlayerHit already runs DFU's tally
        // arm (tallySwingSkills), so every connecting swing was
        // double-counted, keyed by the display-name rot AUDIT 18
        // removed elsewhere.
        if (!cityGuards.resolvePlayerHit(weaponRig.playerWeapon, eye, fwd, player.pos, makeInView(proj, view, multiply), guardHitSound)) {
          cityGuards.resolveCivilianHit(weaponRig.playerWeapon, eye, fwd, player.pos, _guardPool(),
            { onMurder: () => _crimeResponse(), onHitSound: guardHitSound }).then((r) => {
            if (r?.carriedHit) tallySwingSkills(playerEntity, weaponRig.playerWeapon.weapon);
            if (r) surfacePlayer();
            // AUDIT 23 (C9) - WeaponManager.cs:423-424: the no-enemy
            // swing sound at the hit frame (the rig's entry whoosh is
            // gone); a swing that found neither guard nor civilian.
            else audio.playOneShot(swingSoundFor(weaponRig.playerWeapon.weapon), 1.1);
          }).catch((e) => console.error('[civil]', e));
        }
      }
      weaponRig.draw();
    }
    // AUDIT 21 (hosts lane, F7): THE HUD, which this host did not have.
    //
    // ?world and ?exterior drew no status bar at all - no health, no fatigue,
    // no magicka, no compass. Guards can hurt you here, falls can hurt you,
    // fatigue drains every classic minute and diseases drain attributes, and
    // you could see none of it. Walk into the dungeon and the whole classic
    // HUD appears; walk out and it vanishes.
    //
    // ui/hud.js was already host-agnostic - drawHud(renderer, canvas, art,
    // vitals, heading01) - so this is the art loaded once and drawn last,
    // over the viewmodel, exactly as dungeonContext draws it. Under the talk
    // layer, because a talk window is a modal above the vitals.
    if (hudArt) {
      const _hfw = [-view[2], -view[10]];
      drawHud(renderer, canvas, hudArt, playerEntity,
        ((Math.atan2(_hfw[0], _hfw[1]) / (Math.PI * 2)) % 1 + 1) % 1);
    }
    townTalk.frame(dt);   // T3b: HUD lines + the talk overlay, above everything

    frames++;
    if (shotMode) window.__frame++;   // T1: probes frame-sync (the process doctrine - sleeps sample stale state). AUDIT 17e F37: INCREMENT - assigning `frames` undid worldModes' modal-frame increments, so the counter ran backwards after an overlay and frame-synced probes stalled.
    if (shotMode && frames === 5) window.__shotReady = true;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
