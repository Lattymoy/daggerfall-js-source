// TO1 (2026-09-17, Mac: "This is the next daggerfall mod we are to
// implement 1:1", with "an enhanced version of the UI for enhanced
// mode" and "ensure the compatibility is sound with basic roads") -
// TRAVEL OPTIONS 1.11 (Hazelnut), against its own source.
//
// The arc of what is held here: the mod's SETTINGS as its own
// modsettings.json ships them, its WORDS as its own CSV ships them, the
// PATH GEOMETRY that decides where a followed road goes, the AUTOPILOT
// that walks it, the PORTS table, the MAP's five-texel page, the
// CONTROL PANEL's arithmetic, the POPUP's one decision, and the WIRING
// by source. The fixtures are the vendored files wherever there is one
// - the shape the producer mints, not a literal typed twice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

import {
  N, NE, E, SE, S, SW, W, NW, DIRECTIONS, sameCompass,
  MP_WORLD_UNITS, T_SIZE, P_SIZE, MID_LO, MID_HI, ANG_UNIT,
  LOC_PAUSE_OFF, LOC_PAUSE_NEAR, LOC_PAUSE_ENTER, MAX_CIRCUMNAVIGATION_ACCEL,
  mapPixelWorldOrigin, normalisedYaw, directionOfYaw, targetPixel, countSetBits,
  playerOnPath, playerOnPathAt, pathsDataPoint, roadsDataPoint, dataPoint, nextPathDirection,
  PATH_ROADS, PATH_TRACKS, PATH_KEYS,
} from '../src/systems/travelPaths.js';
import {
  TravelAutopilot, calculateYaw, rectContains, rectOf, rectCentre,
  ARRIVAL_BUFFER, OVERSHOOT_YAW_DEGREES,
} from '../src/systems/travelAutopilot.js';
import {
  readTravelOptionsSettings, createTravelOptions, travelSpeedMultiplier, avoidEncounterChance,
  locationTypeString, locationTypeName, locationRectsOf, locBorderCornerRects, circumnavigateTarget,
  START_ACCEL_VALUES, FOLLOW_KEYS, IGNORE_ENCOUNTERS_SECONDS, AVOID_ENCOUNTER_OFFSET, CLIMATE_OCEAN,
  TRAVEL_OPTIONS_VENDOR,
} from '../src/systems/travelOptions.js';
import { TRAVEL_OPTIONS_TEXT, format, localize, directionText } from '../src/systems/travelOptionsText.js';
// AUDIT-TO1: the two classes the port did not carry, pinned at the foot
import { registerCustomGuild, canAccessService } from '../src/systems/guildServices.js';
import { ENCHANTMENT_TYPES, enchantmentMagicRound } from '../src/systems/enchantments.js';
import { resetSyntheticTimeIncrease } from '../src/systems/effectBroker.js';
import { ITEM_GROUPS } from '../src/characters/equipRules.js';

/** audit63_effects.test.js's own two fixtures, which is where the
 *  synthetic-time half of this guard is already pinned. */
const item = (type, param = -1, over = {}) => ({
  name: 'Test Item', templateIndex: 135, group: ITEM_GROUPS.Jewellery,
  currentCondition: 100, maxCondition: 100, equipSlot: 9,
  enchantments: [{ type, param }], ...over,
});
const wearer = (items, over = {}) => ({
  name: 'W', health: 200, maxHealth: 300, items, level: 5, isPlayer: true,
  stats: {}, skills: [40, 40, 40, 40], activeEffects: [], ...over,
});
import { PORT_LOCATION_IDS, PORT_LOCATION_IDS_MAIN, PORT_LOCATION_IDS_EXTRAS, maskMapId, hasPort } from '../src/systems/travelPorts.js';
import {
  drawPath, drawLocation, drawMapSection, isLocationLarge, packColor, packRGBA, DOT_SCALE,
  ROAD_COLOR, TRACK_COLOR, JUNCTION_HERE_PT, JUNCTION_MAP_WIDTH, junctionDirectionIndex,
} from '../src/ui/travelPathsOverlay.js';
import {
  portsBarAnchors, portsFilterAllows, PORT_FILTER_POS, PORT_FILTER_MOVED,
  HORIZ_ARROW_POS, HORIZ_ARROW_MOVED, VERT_ARROW_POS, VERT_ARROW_MOVED, PORTS_SIZE,
  locationInfoRows, teleportCost, TELEPORT_RANK_FREE, TELEPORT_COST_PER_RANK,
  drawRegionPageWithPaths,
} from '../src/ui/travelMapOptions.js';
import { TravelControlUI, CONTROL_RECTS, fasterAcceleration, slowerAcceleration, MESSAGE_SECONDS, _setTravelControlArtForTests } from '../src/ui/travelControlUI.js';
import { TravelJunctionMap, JUNCTION_TEX_W, JUNCTION_TEX_H, filterModeName } from '../src/ui/travelJunctionMap.js';
import { etaText, distanceText } from '../src/ui/enhancedTravelControl.js';
import { POPUP_RECTS } from '../src/ui/travelPopUp.js';   // AUDIT-TO1 D3/D4: the camp-out and inns rects the wheel pins hover
// AUDIT-TO1 part 2: the pins for the sweep's confirmed findings
import { TravelPopUpWindow, isPlayerControlledTravel, enforceShipRestriction as enforceShipRestrictionPure, shipTravelRefusal as shipTravelRefusalPure } from '../src/ui/travelPopUp.js';
import { travelMapMarkedMapId, setTravelMapMarkedMapId, resetTravelMapState } from '../src/systems/travelMapState.js';
import { timeScale, setTimeScale, resetTimeScale, accelLimitOf, halfAccelLimitOf, MAX_TIME_SCALE } from '../src/systems/timeScale.js';
import { FIXED_DT, MAX_FRAME_DT } from '../src/player/motor.js';
import { MOD_SETTINGS, colorKeyRgba, colorKeyHex, isColorKey, modSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { mapPixelToWorldCoords } from '../src/world/streamingWorld.js';

const root = new URL('..', import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), 'utf8');
const VENDOR = 'vendor/travel-options/';

// ─── the vendored record ──────────────────────────────────────────────

test('TO1: the settings are the mod\'s own modsettings.json, key for key, type for type', () => {
  const shipped = JSON.parse(read(`${VENDOR}modsettings.json`));
  const ours = MOD_SETTINGS[TRAVEL_OPTIONS_VENDOR].keys;
  assert.equal(MOD_SETTINGS[TRAVEL_OPTIONS_VENDOR].author, 'Hazelnut');
  // the port's own Enabled in front, then the mod's, section-dot-name
  assert.equal(Object.keys(ours)[0], 'Enabled');
  assert.equal(ours.Enabled.default, true, 'MO1: every vendored mod ships on');
  let n = 0;
  for (const section of shipped.Sections) {
    for (const k of section.Keys) {
      n++;
      const key = `${section.Name}.${k.Name}`;
      const def = ours[key];
      assert.ok(def, `${key} is declared`);
      assert.equal(def.description, k.Description, `${key}'s description is the mod's own`);
      const kind = k.$type.split('.').pop();
      if (kind === 'ToggleKey') assert.equal(def.default, k.Value, `${key}'s default`);
      else if (kind === 'SliderIntKey') {
        assert.deepEqual([def.default, def.min, def.max], [k.Value, k.Min, k.Max], `${key}'s range`);
      } else if (kind === 'MultipleChoiceKey') {
        // AUDIT-TO1 I1: the ONE default the port ships differently, said
        // here so a second one cannot ride in quietly: the follow key
        // moves from F (SOC5's SocialInteract) to K, the one letter of
        // the mod's own six nothing in the port or a vendored mod answers
        // (G, O, X are Handheld Torches'). The options are the mod's.
        if (key === 'RoadsIntegration.FollowPathsKey') {
          assert.equal(k.Value, 1, 'the mod ships F (index 1) - if this moved, re-decide the departure');
          assert.equal(def.default, 3, 'the port ships K (index 3)');
          assert.equal(def.options[def.default], 'K');
          assert.equal(def.keyChoice, true, 'and declares itself a key choice for the HT4 walk');
        } else assert.equal(def.default, k.Value, `${key}'s default index`);
        assert.deepEqual([...def.options], k.Options, `${key}'s options`);
      } else if (kind === 'TextKey') {
        assert.equal(def.default, k.Value); assert.equal(def.text, true);
      } else if (kind === 'ColorKey') {
        assert.ok(isColorKey(def), `${key} is a ColorKey`);
        assert.deepEqual(colorKeyRgba(def.default), [k.Value.r, k.Value.g, k.Value.b, k.Value.a], `${key}'s colour`);
      } else assert.fail(`${key}: unknown kind ${kind}`);
    }
  }
  assert.equal(n, 51, 'the mod ships fifty-one keys across twelve sections');
  assert.equal(Object.keys(ours).length, n + 1, 'and the port declares them all, plus Enabled');
  // the five unnamed spacer sections carry no keys and are not declared
  assert.deepEqual(shipped.Sections.filter((s) => !s.Keys.length).map((s) => s.Name), ['__', '-', '_', '--', '.']);
});

test('TO1: the words are the mod\'s own CSV, entry for entry', () => {
  const csv = read(`${VENDOR}TravelOptionsModData.csv`);
  // Key,Value with quoted values that may carry newlines and commas
  // Key,Value, the values quoted and free to carry commas and NEWLINES
  // (the two help screens are whole pages). A key always starts a line.
  // ...and the shipped file's line endings are Windows'. The port's own
  // text is LF (ui/messageBox.js splits on it and a stray \r would draw
  // as a glyph), so the comparison normalises rather than carrying CRLF
  // into the module - the one thing about this table that is not byte
  // for byte, and it is stated here rather than left to be found.
  const rows = [...csv.matchAll(/(?:^|\n)([A-Za-z0-9]+),"((?:[^"]|"")*)"/g)]
    .map((m) => [m[1], m[2].replace(/""/g, '"').replace(/\r\n/g, '\n')]);
  assert.equal(rows.length, 44, 'the shipped table');
  for (const [k, v] of rows) {
    assert.equal(TRAVEL_OPTIONS_TEXT[k], v, `${k} is the mod's own text`);
    assert.equal(localize(k), v);
  }
  assert.equal(Object.keys(TRAVEL_OPTIONS_TEXT).length, rows.length, 'and nothing was invented');
  assert.equal(localize('NoSuchKey'), '', 'Localize answers empty for a key it does not carry (:1336-1341)');
  // C#'s composite format, positional
  assert.equal(format(TRAVEL_OPTIONS_TEXT.MsgNearLocation, 'town', 'Daggerfall'),
    'Paused the journey since a town called Daggerfall is nearby.');
  assert.equal(format(TRAVEL_OPTIONS_TEXT.MsgTargetCoords, 12, 34), 'Map coordinates: 12, 34.');
  assert.equal(format('{0} {9}', 'a'), 'a {9}', 'an index with no argument is left alone, never "undefined"');
  assert.equal(directionText(NE), 'NE');
  assert.equal(directionText(0), TRAVEL_OPTIONS_TEXT.DirectionNone);
});

test('TO1: the three vendored textures are the bundle\'s own pixels, byte for byte as this tree carries them', () => {
  // the BYTES are pinned in test/vendorIntegrity.test.js, which is the
  // house's one home for a vendored file's hash; what is held here is
  // that they are the right SHAPE and that the record says what they are.
  const png = (rel) => readFileSync(new URL(rel, root));
  const size = (b) => [b.readUInt32BE(16), b.readUInt32BE(20)];
  assert.deepEqual(size(png(`${VENDOR}Textures/TOcontrolUI.png`)), [320, 27], 'the control strip');
  assert.deepEqual(size(png(`${VENDOR}Textures/TOportsOff.png`)), [45, 11], 'the ports button, off');
  assert.deepEqual(size(png(`${VENDOR}Textures/TOportsOn.png`)), [45, 11], '...and on');
  assert.equal(createHash('sha256').update(png(`${VENDOR}Textures/TOcontrolUI.png`)).digest('hex').length, 64);
  // the README says they are RE-ENCODES and names the tool that makes them
  const readme = read(`${VENDOR}README.md`);
  assert.match(readme, /RE-ENCODES, not the author's own files/);
  assert.match(readme, /tools\/travelOptionsAssets\.mjs/);
  assert.match(read('tools/travelOptionsAssets.mjs'), /export function encodePng/);
  // and the manifest is the shipped one
  const manifest = JSON.parse(read(`${VENDOR}travel-options.dfmod.json`));
  assert.equal(manifest.ModTitle, 'TravelOptions');
  assert.equal(manifest.ModVersion, '1.11');
  assert.equal(manifest.GUID, '93f3ad1c-83cc-40ac-b762-96d2f47f2e05');
});

// ─── the settings, resolved ───────────────────────────────────────────

test('TO1: LoadSettings - the speed penalty is a multiplier, the fatigue floor is the setting PLUS ONE, and every roads arm is gated on Basic Roads', () => {
  const base = {
    'GeneralOptions.AllowTargetingMapCoordinates': true, 'GeneralOptions.AllowWeather': false,
    'GeneralOptions.AllowAnnoyingSounds': false, 'GeneralOptions.AllowRealGrass': false,
    'GeneralOptions.LocationPause': 1,
    'CautiousTravel.PlayerControlledCautiousTravel': true, 'CautiousTravel.SpeedPenalty': 20,
    'CautiousTravel.MaxChanceToAvoidEncounter': 95, 'CautiousTravel.HealthMinimumPercentage': 5,
    'CautiousTravel.FatigueMinimumValue': 5,
    'StopAtInnsTravel.PlayerControlledInnsTravel': false,
    'ShipTravel.OnlyFromPorts': true, 'ShipTravel.OnlyToPorts': false,
    'TimeAcceleration.DefaultStartingAcceleration': 4, 'TimeAcceleration.AlwaysUseStartingAcceleration': false,
    'TimeAcceleration.AccelerationLimit': 60,
    'Teleportation.EnablePaidTeleportation': false,
    'RoadsIntegration.Enable': true, 'RoadsIntegration.VariableSizeDots': true,
    'RoadsIntegration.FollowPathsKey': 1, 'RoadsIntegration.FollowPathsCustomKeyBind': '',
    'RoadsIntegration.EnableWaterways': true, 'RoadsIntegration.EnableStreamsToggle': true,
    'RoadsIntegration.MarkLocationColor': '#ffeb05ff',
    'FastTravelCostScaling.FastTravelCostScaleFactor': 1, 'FastTravelCostScaling.ShipTravelCostScaleFactor': 1,
    'RoadsJunctionMap.Enable': true, 'RoadsJunctionMap.PersistentMap': false,
    'RoadsJunctionMap.ToggleMapOffPaths': true, 'RoadsJunctionMap.ScreenSize': 75,
    'RoadsJunctionMap.ScreenPositionX': 235, 'RoadsJunctionMap.ScreenPositionY': 10,
    'RoadsJunctionMap.FilterMode': 0, 'RoadsJunctionMap.Circular': true,
    'RoadsJunctionMap.PlayerColor': '#ff0000ff', 'RoadsJunctionMap.Opaque': false,
    'RoadsJunctionMap.BackgroundColor': '#327f19ff',
  };
  for (const n of ['DungeonLabyrinth', 'DungeonKeep', 'DungeonRuin', 'Graveyard', 'Coven', 'Farm',
    'WealthyHome', 'PoorHome', 'Temple', 'Cult', 'Tavern', 'City', 'Hamlet', 'Village']) base[`LocationColours.${n}`] = '#010203ff';
  const reader = (over = {}, roads = { Enabled: true, RiversAndStreams: true }) => (vendor, key) => {
    if (vendor === 'roads-hazelnut') return roads[key];
    const bag = { ...base, ...over };
    assert.ok(key in bag, `the reader was asked for ${key}`);
    return bag[key];
  };

  const s = readTravelOptionsSettings(reader());
  assert.equal(s.cautiousTravelMultiplier, 0.8, ':211 - a 20% penalty is x0.8');
  assert.equal(s.recklessTravelMultiplier, 1);
  assert.equal(travelSpeedMultiplier(true, s), 0.8);
  assert.equal(travelSpeedMultiplier(false, s), 1);
  assert.equal(s.cautiousFatigueMin, 6, ':214 - the setting PLUS ONE');
  assert.equal(s.cautiousHealthMinPc, 5, '...and the health percentage is not');
  assert.equal(s.defaultStartingAccel, START_ACCEL_VALUES[4], ':221 - the CHOICE indexes the eleven values');
  assert.equal(s.defaultStartingAccel, 10);
  assert.equal(s.locationPause, LOC_PAUSE_NEAR);
  assert.equal(s.followKey, 'F', ':225-226 - index 1 of the six');
  assert.deepEqual(s.markLocationColor, [255, 235, 5, 255]);
  assert.deepEqual(s.locationColors[11], [1, 2, 3, 255], 'the fourteen ride GetPixelColorIndex\'s own order: 11 is City');
  assert.equal(s.locationColors.length, 14);

  // the custom bind, and its fallback
  assert.equal(readTravelOptionsSettings(reader({ 'RoadsIntegration.FollowPathsKey': 6, 'RoadsIntegration.FollowPathsCustomKeyBind': 'Slash' })).followKey, 'Slash');
  assert.equal(readTravelOptionsSettings(reader({ 'RoadsIntegration.FollowPathsKey': 6 })).followKey, 'F', ':297-300 - an unparseable custom bind is F');
  assert.equal(readTravelOptionsSettings(reader({ 'RoadsIntegration.FollowPathsKey': 0 })).followKey, 'None');

  // BASIC ROADS OFF: every roads arm falls, and so does the follow key
  const off = readTravelOptionsSettings(reader({}, { Enabled: false, RiversAndStreams: true }));
  assert.equal(off.roadsIntegration, false, ':316 - `settings.Enable && roadsModEnabled`');
  assert.equal(off.roadsJunctionMap, false);
  assert.equal(off.waterwaysEnabled, false);
  assert.equal(off.variableSizeDots, false);
  assert.equal(off.followKey, 'None', 'nothing to follow, so no key follows it');
  // ...and the waterways need the OTHER mod's own rivers switch too (:307, :321)
  assert.equal(readTravelOptionsSettings(reader({}, { Enabled: true, RiversAndStreams: false })).waterwaysEnabled, false);
  assert.equal(readTravelOptionsSettings(reader({}, { Enabled: true, RiversAndStreams: false })).streamsToggle, false);
});

test('TO1: the shipped defaults reach the game through the store', async () => {
  _resetModSettings();
  const s = readTravelOptionsSettings();
  assert.equal(s.cautiousTravel, true, 'the mod ships Player Controlled cautious ON');
  assert.equal(s.stopAtInnsTravel, false, '...and stop-at-inns OFF, so a walked trip is cautious or reckless-and-camping');
  assert.equal(s.shipTravelPortsOnly, true);
  assert.equal(s.accelerationLimit, 60);
  assert.equal(s.locationPause, LOC_PAUSE_OFF);
  assert.equal(modSetting(TRAVEL_OPTIONS_VENDOR, 'Enabled'), true);
  assert.equal(colorKeyHex(colorKeyRgba('D77727FF')), '#d77727ff', 'the mod\'s own preset spelling reads too');
  assert.deepEqual(colorKeyRgba('#c08a3e'), [192, 138, 62, 255], 'six digits take a FULL alpha, not a transparent one');
  assert.deepEqual(colorKeyRgba('#abc'), [170, 187, 204, 255], '...and three expand');
  assert.deepEqual(colorKeyRgba([1, 2, 3, 4]), [1, 2, 3, 4]);
  assert.equal(colorKeyRgba('not a colour'), null);
  assert.equal(colorKeyRgba('#12345'), null, 'five digits is not a spelling');
  // a value the store cannot read falls back to the DECLARED default
  const { setModSetting } = await import('../src/systems/modSettings.js');
  assert.equal(setModSetting(TRAVEL_OPTIONS_VENDOR, 'LocationColours.City', 'not a colour'), '#e3b490ff');
  assert.equal(setModSetting(TRAVEL_OPTIONS_VENDOR, 'LocationColours.City', 'A56446FF'), '#a56446ff');
  _resetModSettings();
});

// ─── the compass and the geometry ─────────────────────────────────────

test('TO1: the compass is Basic Roads\' own, and the port\'s road network uses the same eight bits', () => {
  assert.deepEqual([N, NE, E, SE, S, SW, W, NW], [128, 64, 32, 16, 8, 4, 2, 1]);
  assert.deepEqual([...DIRECTIONS], [128, 64, 32, 16, 8, 4, 2, 1]);
  assert.ok(sameCompass(), 'world/roadNetwork.js DIR carries the identical values - which is what lets his arrays drop in');
  assert.deepEqual(PATH_KEYS, ['roads', 'tracks', 'rivers', 'streams']);
  assert.equal(MP_WORLD_UNITS, 32768);
  assert.equal(T_SIZE, 256, 'one terrain tile of the 128 across a map pixel');
  assert.equal(P_SIZE, 512, 'a path is two tiles wide');
  assert.deepEqual([MID_LO, MID_HI], [16128, 16640]);
  assert.equal(ANG_UNIT, 22.5);
  assert.equal(MAX_CIRCUMNAVIGATION_ACCEL, 15);
  assert.deepEqual([LOC_PAUSE_OFF, LOC_PAUSE_NEAR, LOC_PAUSE_ENTER], [0, 1, 2]);
  assert.equal(AVOID_ENCOUNTER_OFFSET, 50, ':1200 - the CODE says 50 where the readme says 20');
  assert.equal(IGNORE_ENCOUNTERS_SECONDS, 15);
  assert.equal(CLIMATE_OCEAN, 223);
  assert.deepEqual([...FOLLOW_KEYS], ['None', 'F', 'G', 'K', 'O', 'X']);
});

test('TO1: mapPixelWorldOrigin is streamingWorld\'s own mapping, over the whole map', () => {
  for (const [x, y] of [[0, 0], [999, 499], [500, 250], [1, 498], [123, 45]]) {
    const a = mapPixelWorldOrigin(x, y);
    const b = mapPixelToWorldCoords(x, y);
    assert.deepEqual([a.x, a.z], [b.x, b.z], `${x},${y} - the leaf's restatement and the world's agree`);
  }
});

test('TO1: GetDirection\'s boundaries are the mod\'s, inclusive for the cardinals and exclusive for the diagonals', () => {
  assert.equal(directionOfYaw(0), N);
  assert.equal(directionOfYaw(360), N);
  assert.equal(directionOfYaw(22.5), N, 'the cardinals test >= and <=, so 22.5 exactly is N');
  assert.equal(directionOfYaw(22.6), NE);
  assert.equal(directionOfYaw(45), NE);
  assert.equal(directionOfYaw(67.5), E, '...and 67.5 exactly is E, not NE');
  assert.equal(directionOfYaw(90), E);
  assert.equal(directionOfYaw(135), SE);
  assert.equal(directionOfYaw(180), S);
  assert.equal(directionOfYaw(225), SW);
  assert.equal(directionOfYaw(270), W);
  assert.equal(directionOfYaw(315), NW);
  assert.equal(directionOfYaw(337.5), N);
  // every degree falls in some band
  for (let d = 0; d < 360; d += 0.5) assert.notEqual(directionOfYaw(d), 0, `${d} names a direction`);
  // the yaw normaliser, and its inversion
  assert.equal(normalisedYaw(-90), 270);
  assert.equal(normalisedYaw(450), 90);
  assert.equal(normalisedYaw(0, true), 180, 'the way you came');
  assert.equal(normalisedYaw(270, true), 90);
});

test('TO1: GetTargetPixel walks the map, and north is one LESS in y', () => {
  const at = (dir) => targetPixel(dir, 10, 10);
  assert.deepEqual(at(N), { x: 10, y: 9 });
  assert.deepEqual(at(NE), { x: 11, y: 9 });
  assert.deepEqual(at(E), { x: 11, y: 10 });
  assert.deepEqual(at(SE), { x: 11, y: 11 });
  assert.deepEqual(at(S), { x: 10, y: 11 });
  assert.deepEqual(at(SW), { x: 9, y: 11 });
  assert.deepEqual(at(W), { x: 9, y: 10 });
  assert.deepEqual(at(NW), { x: 9, y: 9 });
  assert.deepEqual(at(0), { x: 10, y: 10 }, ':842 - the default arm is THIS pixel, which is how BeginPathTravel spells "carry on into it"');
  assert.deepEqual(at(N | E), { x: 10, y: 10 }, '...and so is any mask that is not one of the eight');
  assert.equal(countSetBits(0), 0);
  assert.equal(countSetBits(N | S), 2);
  assert.equal(countSetBits(255), 8);
});

test('TO1: IsPlayerOnPath - the bands across the pixel, the diagonals, and the mod\'s own asymmetry', () => {
  const mid = MP_WORLD_UNITS / 2;
  // dead centre of a crossroads: on all four cardinals at once
  assert.equal(playerOnPath(N | E | S | W, mid, mid), N | E | S | W);
  // north of the middle band: still on N and S (S tests `< MidHi` only), not E or W
  assert.equal(playerOnPath(N | E | S | W, mid, MID_HI + 1000), N, 'past the band, only the edge it leads to');
  assert.equal(playerOnPath(N | E | S | W, mid, MID_LO - 1000), S);
  assert.equal(playerOnPath(N | E | S | W, MID_HI + 1000, mid), E);
  assert.equal(playerOnPath(N | E | S | W, MID_LO - 1000, mid), W);
  // a path bit that is not in the data is never answered
  assert.equal(playerOnPath(N, mid, mid), N);
  assert.equal(playerOnPath(0, mid, mid), 0, 'a pixel with no path answers nothing at all');
  // the NE/SW diagonal is |x - z| < P_SIZE; the NW/SE one is |x - (32768 - z)| < P_SIZE
  assert.equal(playerOnPath(NE | SW, mid, mid), NE | SW, 'the centre is on both halves of a diagonal');
  assert.equal(playerOnPath(NE, 20000, 20100), NE, 'near the x = z line');
  assert.equal(playerOnPath(NE, 20000, 24000), 0, 'and off it, nothing');
  assert.equal(playerOnPath(NW | SE, mid, mid), NW | SE, 'near the x = 32768 - z line');
  assert.equal(playerOnPath(NW | SE, 16000, 16800), NW,
    'and west of the middle only the NW half answers - SE asks for x > MidLo as well');
  // the world-position door agrees with the pixel-local one
  const o = mapPixelWorldOrigin(300, 200);
  assert.equal(playerOnPathAt(N | S, o.x + mid, o.z + mid, 300, 200), N | S);
});

test('TO1: the path data points - roads OR tracks for the walk, roads alone for the speed, and nothing off the map', () => {
  const net = { roads: new Uint8Array(1000 * 500), tracks: new Uint8Array(1000 * 500) };
  const at = (x, y) => x + y * 1000;
  net.roads[at(10, 10)] = N | S;
  net.tracks[at(10, 10)] = E;
  assert.equal(pathsDataPoint(net, 10, 10), N | S | E, ':808-814 - the OR is what makes a junction neither array has');
  assert.equal(roadsDataPoint(net, 10, 10), N | S, ':815-819 - the road half decides reckless or cautious');
  assert.equal(dataPoint(net, PATH_ROADS, 10, 10), N | S);
  assert.equal(dataPoint(net, PATH_TRACKS, 10, 10), E);
  // OFF THE MAP IS ZERO, not the neighbouring row. The mod indexes
  // `X + Y * MaxMapPixelX` with no check at all (:810), so x = -1 reads
  // the END of the row above and x = 1000 the START of the row below -
  // both real bytes. These are planted so the wrap would be SEEN.
  net.roads[at(999, 9)] = 255;    // what x = -1, y = 10 would wrap onto
  net.roads[at(0, 11)] = 255;     // what x = 1000, y = 10 would wrap onto
  assert.equal(pathsDataPoint(net, -1, 10), 0, 'off the map answers 0 where the mod would read another row');
  assert.equal(pathsDataPoint(net, 1000, 10), 0);
  assert.equal(pathsDataPoint(net, 10, 500), 0, '...and past the last row, where the mod would read past the array');
  assert.equal(pathsDataPoint(net, 10, -1), 0);
  assert.equal(pathsDataPoint(null, 10, 10), 0, 'and a network that has not loaded yet answers 0');
  assert.equal(dataPoint({ roads: net.roads }, 2, 10, 10), 0, 'a missing array (the generated fallback has no rivers) answers 0, never a crash');
});

test('TO1: SelectNextPath\'s straight-on pick, including the mod\'s own XOR-and-shift recovery', () => {
  // facing one of the two edges: take it
  assert.equal(nextPathDirection(N | S, N, S), N);
  assert.equal(nextPathDirection(N | S, S, N), S);
  // facing NEITHER: take the other edge, which is `paths ^ from`
  assert.equal(nextPathDirection(N | S, E, S), N, 'came from the south, so carry on north');
  assert.equal(nextPathDirection(E | W, N, W), E);
  // THE FACING SHORTCUT IS NOT THE RECOVERY WALK. Where the facing DOES
  // match an edge the mod takes it and the walk never runs, and the two
  // answer differently: at a pixel with N and E, facing E and having
  // come from N, the shortcut says E and `paths ^ from` says E too -
  // but facing N, the shortcut says N where the XOR would say E.
  assert.equal(nextPathDirection(N | W, N, E), N,
    'the facing wins outright - the recovery walk, asked the same question, answers W');
  assert.equal(nextPathDirection(N | E, E, N), E);
  // the from-direction is not one of the two: the search walks the compass
  const out = nextPathDirection(N | S, E, NE);
  assert.equal(countSetBits(out), 1, 'the walk narrows to one edge');
  assert.ok((N | S) & out, '...and it is one of the two this pixel has');
  // the value is RAW - the caller uses it twice and a leftover can still say "road"
  assert.equal(typeof nextPathDirection(255, E, NE), 'number');
});

// ─── the autopilot ────────────────────────────────────────────────────

test('TO1: CalculateYaw is the game\'s own compass - 0 north, 90 east', () => {
  assert.equal(calculateYaw(0, 0, 0, 100), 360,
    'due north answers 360, not 0 - the mod\'s `atan2(from - to) + 180` cannot reach zero, which is exactly why GetDirection\'s N arm tests `yaw >= 337.5 && yaw <= 360` as well as `>= 0`');
  assert.equal(directionOfYaw(calculateYaw(0, 0, 0, 100)), N, '...and that 360 still reads as north');
  assert.equal(calculateYaw(0, 0, 100, 0), 90, 'due east');
  assert.equal(calculateYaw(0, 0, 0, -100), 180, 'due south');
  assert.equal(calculateYaw(0, 0, -100, 0), 270, 'due west');
  assert.equal(Math.round(calculateYaw(0, 0, 100, 100)), 45, 'north-east');
  assert.equal(rectCentre(rectOf(0, 0, 100, 50)).x, 50);
  assert.equal(rectCentre(rectOf(0, 0, 101, 50)).x, 50, 'the centre TRUNCATES, as the mod casts it');
  assert.ok(rectContains(rectOf(0, 0, 10, 10), 0, 0), 'Unity\'s Rect.Contains is inclusive at the minimum');
  assert.ok(!rectContains(rectOf(0, 0, 10, 10), 10, 5), '...and exclusive at the maximum');
});

test('TO1: PlayerAutoPilot - the arrival buffer is the LOCATION constructor\'s alone, and the centre is taken before it', () => {
  const rect = rectOf(1000, 2000, 400, 400);
  const plain = new TravelAutopilot({ x: 5, y: 5 }, rect, 1);
  assert.deepEqual(plain.destinationWorldRect, { ...rect }, ':39-49 - a rect handed in is not grown');
  const grown = new TravelAutopilot({ x: 5, y: 5 }, rect, 1, { grow: true, isLocation: true });
  assert.equal(ARRIVAL_BUFFER, 800);
  assert.deepEqual(grown.destinationWorldRect, { xMin: 200, xMax: 2200, zMin: 1200, zMax: 3200 });
  assert.deepEqual(grown.destinationCentre, rectCentre(rect), ':62-73 - the centre is the LOCATION\'s, taken before the growth');
  assert.equal(grown.speedMultiplier, 1);
});

test('TO1: the autopilot walks - it re-aims on a pixel change, pushes forward every frame, and arrives inside the rect', () => {
  const dest = { x: 5, y: 5 };
  const o = mapPixelWorldOrigin(dest.x, dest.y);
  const rect = rectOf(o.x + 16000, o.z + 16000, 768, 768);
  const ap = new TravelAutopilot(dest, rect, 0.8);
  let arrived = false;
  ap.onArrival = () => { arrived = true; };

  // a frame two pixels west of the destination
  const start = mapPixelWorldOrigin(3, 5);
  let r = ap.update({ worldX: start.x + 16000, worldZ: start.z + 16000, mapPixelX: 3, mapPixelY: 5 });
  assert.equal(r.arrived, false);
  assert.equal(r.forward, 0.8, ':103 - ApplyVerticalForce(travelSpeedMultiplier)');
  assert.equal(r.pitch, 0, ':48 and :143 - the pitch is held at zero');
  assert.ok(r.yaw > 45 && r.yaw < 135, `heading east, not ${r.yaw}`);
  assert.equal(ap.inDestinationMapPixel, false);
  const aimed = r.yaw;

  // another frame in the SAME pixel: no re-aim
  r = ap.update({ worldX: start.x + 17000, worldZ: start.z + 16000, mapPixelX: 3, mapPixelY: 5 });
  assert.equal(r.yaw, aimed, ':88-95 - the yaw is re-taken only when the pixel under the player changed');

  // into the destination pixel, but not yet in the rect
  r = ap.update({ worldX: o.x + 1000, worldZ: o.z + 16000, mapPixelX: 5, mapPixelY: 5 });
  assert.equal(ap.inDestinationMapPixel, true);
  assert.equal(arrived, false, 'the pixel is not the rect');

  // and inside it
  r = ap.update({ worldX: o.x + 16100, worldZ: o.z + 16100, mapPixelX: 5, mapPixelY: 5 });
  assert.equal(arrived, true);
  assert.equal(r.arrived, true);
  assert.equal(r.forward, 0, 'the push stops with the journey');
});

test('TO1: the overshoot rule - a bearing that swings more than five degrees in one update counts as arrival', () => {
  assert.equal(OVERSHOOT_YAW_DEGREES, 5);
  const rect = rectOf(0, 0, 100, 100);
  const ap = new TravelAutopilot({ x: 0, y: 0 }, rect, 1);
  ap.inDestinationMapPixel = true;
  ap.yaw = calculateYaw(0, -1000, 50, 50);      // aimed at the centre from due south
  assert.equal(ap.isPlayerInArrivalRect(0, -1000), false, 'still short, the bearing has not moved');
  assert.equal(ap.isPlayerInArrivalRect(0, 5000), true, ':117-121 - shot past it, the bearing flipped');
});

// ─── the mod's own arithmetic ─────────────────────────────────────────

test('TO1: AttemptAvoidEncounter\'s chance, and the three dungeon words', () => {
  assert.equal(avoidEncounterChance(50, 40, 95), 40, 'luck + Stealth - 50');
  assert.equal(avoidEncounterChance(100, 100, 95), 95, '...capped by the setting');
  assert.equal(avoidEncounterChance(10, 10, 95), -30, 'and it may be hopeless');
  assert.equal(locationTypeString(LOCATION_TYPES.DungeonKeep), 'Keep');
  assert.equal(locationTypeString(LOCATION_TYPES.DungeonLabyrinth), 'Labyrinth');
  assert.equal(locationTypeString(LOCATION_TYPES.DungeonRuin), 'Ruin');
  assert.equal(locationTypeString(LOCATION_TYPES.TownCity, 'city'), 'city', 'everything else takes the macro');
  assert.equal(locationTypeString(LOCATION_TYPES.TownCity), 'city', '...and the port has one when the host hands none');
  assert.equal(locationTypeName(LOCATION_TYPES.TownHamlet), 'town');
});

test('TO1: SetLocationRects - the border ring is a tile wide, and a city\'s is one and a half', () => {
  const tileRect = { x: 10, y: 10, width: 20, height: 20 };
  const town = locationRectsOf(0, 0, tileRect, false);
  const city = locationRectsOf(0, 0, tileRect, true);
  assert.equal(town.aimForCentre, true, ':604 - a location centred in its pixel may be aimed at');
  assert.equal(locationRectsOf(0, 0, tileRect, false, true).aimForCentre, false, '...and one moved off-centre may not');
  // both rects share the same outer edge; the inner one is inset by the border
  assert.equal(town.locationBorderRect.xMin, 11 * T_SIZE, ':592 - the min edges are inset by one tile first');
  assert.equal(town.locationRect.xMin - town.locationBorderRect.xMin, 1 * T_SIZE);
  assert.equal(city.locationRect.xMin - city.locationBorderRect.xMin, 1.5 * T_SIZE);
  assert.ok(town.locationRect.xMax < town.locationBorderRect.xMax, 'the ring surrounds the town on every side');
  // the four corner rects tile the ring's corners
  const c = locBorderCornerRects(town.locationRect, town.locationBorderRect);
  assert.deepEqual([c.ne.xMin, c.ne.zMin], [town.locationRect.xMax, town.locationRect.zMax]);
  assert.deepEqual([c.sw.xMax, c.sw.zMax], [town.locationRect.xMin, town.locationRect.zMin]);
});

test('TO1: CircumnavigateLocation picks the next corner by where you stand and which way you face', () => {
  const t = locationRectsOf(0, 0, { x: 10, y: 10, width: 20, height: 20 }, false);
  const c = locBorderCornerRects(t.locationRect, t.locationBorderRect);
  const at = (rect) => [(rect.xMin + rect.xMax) / 2, (rect.zMin + rect.zMax) / 2];
  const [nex, nez] = at(c.ne);
  assert.equal(circumnavigateTarget(nex, nez, 90, t.locationRect, t.locationBorderRect, c), 'se', 'in the NE corner facing east: round to the SE');
  assert.equal(circumnavigateTarget(nex, nez, 300, t.locationRect, t.locationBorderRect, c), 'nw', '...facing north-west: the other way');
  const [swx, swz] = at(c.sw);
  assert.equal(circumnavigateTarget(swx, swz, 90, t.locationRect, t.locationBorderRect, c), 'se');
  // an EDGE rather than a corner
  const northEdge = [(t.locationRect.xMin + t.locationRect.xMax) / 2, (t.locationRect.zMax + t.locationBorderRect.zMax) / 2];
  assert.equal(circumnavigateTarget(northEdge[0], northEdge[1], 270, t.locationRect, t.locationBorderRect, c), 'nw');
  assert.equal(circumnavigateTarget(northEdge[0], northEdge[1], 90, t.locationRect, t.locationBorderRect, c), 'ne');
  // outside the ring entirely: the mod's bare `return`
  assert.equal(circumnavigateTarget(0, 0, 0, t.locationRect, t.locationBorderRect, c), null);
});

// ─── the ports ────────────────────────────────────────────────────────

test('TO1: the ports table is the mod\'s own, duplicates and all', () => {
  assert.equal(PORT_LOCATION_IDS.length, 417, 'the table as written');
  assert.equal(PORT_LOCATION_IDS_MAIN.length, 343);
  assert.equal(PORT_LOCATION_IDS_EXTRAS.length, 74, 'the "Extras allowing travel to" block');
  assert.equal(new Set(PORT_LOCATION_IDS).size, 378, '...of which 39 repeat ids already in the main block');
  assert.equal(maskMapId(0x40000000 | 199102), 199102, ':855-858 - the low twenty bits');
  assert.equal(hasPort(199102), true, 'Daggerfall\'s Whitecroft');
  assert.equal(hasPort(0x7FF00000 | 199102), true, '...whatever flags its MapId carries');
  assert.equal(hasPort(1), false);
  assert.equal(hasPort(null), false, 'a pixel with no location is not a port');
  assert.equal(hasPort(undefined), false);
  // the filter's own door
  assert.equal(portsFilterAllows(false, 1), true, 'with the filter off everything passes');
  assert.equal(portsFilterAllows(true, 1), false);
  assert.equal(portsFilterAllows(true, 199102), true);
});

// ─── the map's picture ────────────────────────────────────────────────

test('TO1: DrawPath - a crossroads reads as a cross and a diagonal runs unbroken across three pixels', () => {
  const W3 = 3, H3 = 3, w5 = W3 * DOT_SCALE;
  const buf = new Uint32Array(w5 * H3 * DOT_SCALE);
  const road = packColor(ROAD_COLOR);
  drawMapSection(buf, { originX: 0, originY: 0, width: W3, height: H3 }, {
    pathsAt: (x, y, t) => ((x === 1 && y === 1 && t === PATH_ROADS) ? (N | E | S | W) : 0),
    locationAt: () => null, colorOf: () => null,
  });
  const lit = (r, c) => buf[r * w5 + c] === road;
  // the centre cell's middle column and row are painted, the corners are not
  assert.ok(lit(7, 7), 'the pixel itself');
  assert.ok(lit(8, 7) && lit(9, 7), 'north, two texels up the buffer');
  assert.ok(lit(5, 7) && lit(6, 7), 'south');
  assert.ok(lit(7, 8) && lit(7, 9), 'east');
  assert.ok(lit(7, 5) && lit(7, 6), 'west');
  assert.ok(!lit(9, 9) && !lit(5, 5), 'and no diagonal was drawn');

  // NE/SW across three pixels: fifteen texels on the main diagonal
  const diag = new Uint32Array(buf.length);
  drawMapSection(diag, { originX: 0, originY: 0, width: W3, height: H3 }, {
    pathsAt: (x, y, t) => ((t === PATH_ROADS && x + y === 2) ? (NE | SW) : 0),
    locationAt: () => null, colorOf: () => null,
  });
  for (let i = 0; i < w5; i++) assert.equal(diag[i * w5 + i], road, `the diagonal is unbroken at ${i}`);

  // the four colours are the MOD's, not the port's relief
  assert.deepEqual([...ROAD_COLOR], [60, 60, 60, 255]);
  assert.deepEqual([...TRACK_COLOR], [160, 118, 74, 255]);
});

test('TO1: DrawLocation - a city fills its whole cell, a farm the middle of it, and a mark rings it', () => {
  const w5 = 5 * DOT_SCALE;
  const big = new Uint32Array(w5 * 5 * DOT_SCALE);
  const colour = packRGBA(9, 9, 9, 255);
  drawLocation(big, (2 * DOT_SCALE * w5) + (2 * DOT_SCALE), w5, colour, true);
  let n = 0; for (const v of big) if (v === colour) n++;
  assert.equal(n, 25, 'a large dot is the whole 5x5');
  const small = new Uint32Array(big.length);
  drawLocation(small, (2 * DOT_SCALE * w5) + (2 * DOT_SCALE), w5, colour, false);
  n = 0; for (const v of small) if (v === colour) n++;
  assert.equal(n, 9, 'a small dot is the middle 3x3');
  // IsLocationLarge: a city and a hamlet always, everything else only without VariableSizeDots
  assert.equal(isLocationLarge(LOCATION_TYPES.TownCity, false), true);
  assert.equal(isLocationLarge(LOCATION_TYPES.TownHamlet, false), true);
  assert.equal(isLocationLarge(LOCATION_TYPES.HomeFarms, false), false, 'VariableSizeDots ON: a farm is small');
  assert.equal(isLocationLarge(LOCATION_TYPES.HomeFarms, true), true, '...and OFF, everything is large');
  // the mark's ring, and the port's one departure: it is clamped to the buffer
  const marked = new Uint32Array(big.length);
  const mark = packRGBA(255, 235, 5, 255);
  drawLocation(marked, (2 * DOT_SCALE * w5) + (2 * DOT_SCALE), w5, colour, true, { highlight: true, markColor: mark });
  let ring = 0; for (const v of marked) if (v === mark) ring++;
  assert.ok(ring > 0, 'a ring is drawn');
  assert.doesNotThrow(() => drawLocation(marked, 0, w5, colour, true, { highlight: true, markColor: mark }),
    'and at the buffer\'s edge it clamps where the mod would run off the end');
});

test('TO1: the five-texel region page - paths under the dots, NO politic gate (the mod\'s own override), and rivers only with the mod\'s waterways', () => {
  const width = 8, height = 8, w5 = width * DOT_SCALE;
  const dots = new Uint32Array(w5 * height * DOT_SCALE);
  const outline = new Uint32Array(width * height);
  const colours = Array.from({ length: 14 }, (_, i) => packRGBA(i + 1, 0, 0, 255));
  const calls = [];
  drawRegionPageWithPaths(dots, outline, {
    originX: 0, originY: 0, width, height, scale: 1, selectedRegion: 3,
  }, {
    politicAt: (x) => (x === 4 ? 128 + 9 : 128 + 3),   // one column belongs to another province
    summaryAt: (x, y) => ((y === 2) ? { locationType: LOCATION_TYPES.TownCity, mapID: 7 } : null),
    discovered: () => true,
    colorIndexOf: () => 11,
    colors: colours,
    pathsAt: (x, y, t) => { calls.push(t); return (y === 4 && t === PATH_ROADS) ? (E | W) : 0; },
    showPaths: [true, true, false, false],
    onlyLargeDots: false,
    markedMapId: 7,
    markColor: [255, 235, 5, 255],
    outlineOn: true, outlineColor: 99,
  });
  assert.ok(dots.some((v) => v === packColor(ROAD_COLOR)), 'the road is drawn');
  assert.ok(dots.some((v) => v === colours[11]), 'and the city over it');
  // AUDIT-TO1 L6: NO containment. DFU's base page keeps `if (sampleRegion
  // != selectedRegion) continue;` and the port's classic page keeps it
  // too; the mod's override computes sampleRegion (TravelOptionsMapWindow
  // .cs:614) and never tests it - the one occurrence in the file - so a
  // discovered town of the NEIGHBOURING province inside the page rect is
  // plotted. This pinned the opposite for three days.
  const cell = (x, y) => dots[((height - y - 1) * DOT_SCALE * w5) + (x * DOT_SCALE) + (2 * w5) + 2];
  assert.notEqual(cell(3, 2), 0, 'this region\'s column has its dot');
  assert.notEqual(cell(4, 2), 0, 'and so does the neighbour\'s - the mod draws every discovered summary in the rect');
  assert.ok(outline.some((v) => v === 99), 'the outline buffer is filled at 1x, as the classic page fills it');
  // with the water flags down, the two water arrays are never even asked
  assert.ok(!calls.includes(2) && !calls.includes(3), 'rivers and streams are not read while their flags are down');
});

// ─── the junction map ─────────────────────────────────────────────────

test('TO1: the junction mini-map - twenty pixels square, the player at herePt, the facing pip beside it', () => {
  assert.equal(JUNCTION_MAP_WIDTH, 20);
  assert.equal(JUNCTION_TEX_W, 100);
  assert.equal(JUNCTION_TEX_H, 100);
  assert.equal(JUNCTION_HERE_PT, (10 * 20 * 25) - (3 * 20 * 5) + (10 * 5) + 2, ':181, the mod\'s own expression');
  assert.equal(junctionDirectionIndex(N), JUNCTION_HERE_PT + 100, 'north is a row of map pixels UP the buffer');
  assert.equal(junctionDirectionIndex(E), JUNCTION_HERE_PT + 1);
  assert.equal(junctionDirectionIndex(S), JUNCTION_HERE_PT - 100);
  assert.equal(junctionDirectionIndex(W), JUNCTION_HERE_PT - 1);
  assert.equal(junctionDirectionIndex(0), 0, 'and no facing writes nothing');

  const jm = new TravelJunctionMap({
    settings: () => ({ junctionMapCircular: true, playerColor: [255, 0, 0, 255], junctionMapSize: 75, junctionMapX: 235, junctionMapY: 10 }),
    pathsAt: (x, y, t) => ((t === PATH_ROADS && y === 250) ? (E | W) : 0),
    locationAt: () => null,
  });
  jm.draw({ x: 500, y: 250 }, E);
  const player = packRGBA(255, 0, 0, 255);
  assert.equal(jm.buf[JUNCTION_HERE_PT], player, 'the player is drawn OVER the road');
  assert.equal(jm.buf[junctionDirectionIndex(E)], player);
  assert.deepEqual(jm.rect(), [235, 10, 75, 75], ':344-347 - the three settings');
  // the redraw gate: only a CHANGE repaints a hundred-texel texture
  assert.equal(jm.update({ x: 500, y: 250 }, E), false);
  assert.equal(jm.update({ x: 500, y: 250 }, N), true);
  assert.equal(jm.update({ x: 501, y: 250 }, N), true);
  // the CIRCULAR crop: a corner of the square is dropped, the centre is not
  const square = new TravelJunctionMap({
    settings: () => ({ junctionMapCircular: false, playerColor: [255, 0, 0, 255] }),
    pathsAt: () => 255, locationAt: () => null,
  });
  square.draw({ x: 500, y: 250 }, 0);
  const round = new TravelJunctionMap({
    settings: () => ({ junctionMapCircular: true, playerColor: [255, 0, 0, 255] }),
    pathsAt: () => 255, locationAt: () => null,
  });
  round.draw({ x: 500, y: 250 }, 0);
  const corner = (2 * JUNCTION_TEX_W) + 2;
  assert.notEqual(square.buf[corner], 0, 'the square keeps its corners');
  assert.equal(round.buf[corner], 0, ':795-796 - the circle drops them');
  assert.notEqual(round.buf[(50 * JUNCTION_TEX_W) + 50], 0, '...and keeps the middle');
  let sq = 0, rd = 0;
  for (const v of square.buf) if (v) sq++;
  for (const v of round.buf) if (v) rd++;
  assert.ok(rd < sq * 0.9 && rd > sq * 0.7, `the disc is smaller than the square but not much smaller (${rd} of ${sq})`);
  assert.equal(filterModeName(0), 'nearest', 'Point');
  assert.equal(filterModeName(1), 'linear', 'Bilinear');
  assert.equal(filterModeName(2), 'linear', 'Trilinear, which a 100x100 HUD texture never samples');
});

// ─── the control panel ────────────────────────────────────────────────

test('TO1: TravelControlUI - the rects are the mod\'s, the limits round down to fives, and the spinner steps by one then five', () => {
  assert.deepEqual(CONTROL_RECTS.panel, [0, 0, 320, 27]);
  assert.deepEqual(CONTROL_RECTS.dest, [5, 14, 152, 7]);
  assert.deepEqual(CONTROL_RECTS.timeAccel, [163, 4]);
  assert.deepEqual(CONTROL_RECTS.map, [183, 3, 45, 21]);
  assert.deepEqual(CONTROL_RECTS.camp, [230, 3, 45, 21]);
  assert.deepEqual(CONTROL_RECTS.exit, [279, 3, 38, 21]);
  assert.equal(MESSAGE_SECONDS, 3);
  // :76-79 - (limit / 5) * 5 and (limit / 10) * 5
  assert.deepEqual([accelLimitOf(60), halfAccelLimitOf(60)], [60, 30]);
  assert.deepEqual([accelLimitOf(55), halfAccelLimitOf(55)], [55, 25]);
  assert.deepEqual([accelLimitOf(100), halfAccelLimitOf(100)], [100, 50]);
  assert.deepEqual([accelLimitOf(58), halfAccelLimitOf(58)], [55, 25],
    'the rounding is DOWN to a multiple of five, and the half is the same rounding of half the number - never half the rounded one');
  assert.deepEqual([accelLimitOf(37), halfAccelLimitOf(37)], [35, 15]);
  // :222-236
  assert.equal(fasterAcceleration(1, 60), 2, 'below five, by one');
  assert.equal(fasterAcceleration(4, 60), 5);
  assert.equal(fasterAcceleration(5, 60), 10, 'at five and above, by five');
  assert.equal(fasterAcceleration(58, 60), 60, '...and never past the limit');
  assert.equal(slowerAcceleration(10), 5);
  assert.equal(slowerAcceleration(5), 4, 'at five and below, by one');
  assert.equal(slowerAcceleration(1), 1, 'and never under one');
});

test('TO1: the panel shows, clamps, steps, messages and closes - and CAMP and EXIT are two different doors', () => {
  const seen = [];
  const ui = new TravelControlUI({
    defaultStartingAccel: 40, accelerationLimit: 60,
    onClose: () => seen.push('close'), onCancel: () => seen.push('cancel'),
    onTimeAccelerationChanged: (n) => seen.push(`accel:${n}`), onOpenMap: () => seen.push('map'),
  });
  ui.halfLimit = true;
  ui.show();
  assert.equal(ui.timeAcceleration, 30, ':186-193 - OnPush clamps into the limit in force');
  assert.equal(ui.isShowing, true);
  ui.faster();
  assert.equal(ui.timeAcceleration, 30, 'already at the half limit');
  ui.slower();
  assert.deepEqual(seen.filter((x) => x.startsWith('accel')), ['accel:30', 'accel:25']);
  ui.setDestinationName('Daggerfall');
  assert.equal(ui.destinationName, 'Daggerfall');
  ui.showMessage('hello');
  assert.equal(ui.message, 'hello');
  ui.tick(MESSAGE_SECONDS - 0.1);
  assert.equal(ui.message, 'hello', 'the message holds for three seconds of UNSCALED time');
  ui.tick(0.2);
  assert.equal(ui.message, '', '...and then clears itself');
  // CAMP stops the journey and keeps the destination; EXIT forgets it too
  ui.closeWindow();
  assert.deepEqual(seen.filter((x) => x === 'close' || x === 'cancel'), ['close']);
  ui.show();
  ui.cancelWindow();
  assert.deepEqual(seen.filter((x) => x === 'close' || x === 'cancel'), ['close', 'cancel', 'close'],
    'CancelWindow raises BOTH, as DFU\'s CancelWindow calls CloseWindow underneath');
  // the three buttons, by rect
  _setTravelControlArtForTests({ strip: null, spinner: null });
  ui.show();
  assert.equal(ui.click(190, 10), true); assert.equal(seen.at(-1), 'map');
  ui.show();
  assert.equal(ui.tooltipAt(190, 10), TRAVEL_OPTIONS_TEXT.TipMap);
  assert.equal(ui.tooltipAt(240, 10), TRAVEL_OPTIONS_TEXT.TipCamp);
  assert.equal(ui.tooltipAt(5, 5), null, 'and nothing else carries one');
  assert.equal(ui.click(10, 60), false, 'a click below the strip is not the panel\'s');
  _setTravelControlArtForTests(null);
});

test('TO1: the enhanced panel says what the strip had no room for', () => {
  assert.equal(etaText(135), '2h 15m');
  assert.equal(etaText(42), '42m');
  assert.equal(etaText(0), '');
  assert.equal(etaText(NaN), '');
  assert.equal(distanceText({ x: 10, y: 10 }, { x: 13, y: 14 }), '5 pixels out');
  assert.equal(distanceText({ x: 10, y: 10 }, { x: 11, y: 10 }), '1 pixel out');
  assert.equal(distanceText({ x: 10, y: 10 }, { x: 10, y: 10 }), 'arriving');
  assert.equal(distanceText(null, { x: 1, y: 1 }), '');
});

// ─── the time scale ───────────────────────────────────────────────────

test('TO1: the time scale is Unity\'s pair - the frame AND the fixed step, so the step COUNT does not grow', () => {
  assert.equal(timeScale(), 1, 'a session that is not travelling runs at one');
  assert.equal(setTimeScale(50), 50);
  assert.equal(timeScale(), 50);
  // Unity's own arithmetic: the REAL frame is clamped, then scaled
  const realFrame = 1 / 60;
  const steps = (scale) => {
    const frameDt = Math.min(realFrame, MAX_FRAME_DT) * scale;
    return frameDt / (FIXED_DT * scale);
  };
  assert.equal(steps(1), 1, 'one step a frame at real time');
  assert.equal(steps(50), 1, '...and one step a frame at fifty times, each covering fifty times the ground');
  assert.equal(setTimeScale(1e9), MAX_TIME_SCALE, 'a bad caller cannot ask for a step of a minute');
  assert.equal(setTimeScale(0), 0.01, '...nor stop the world');
  assert.equal(setTimeScale(NaN), 1);
  assert.equal(resetTimeScale(), 1);
  // the motor reads it itself, as Unity's physics reads the global clock
  const motor = read('src/player/motor.js');
  assert.match(motor, /import \{ timeScale \} from '\.\.\/systems\/timeScale\.js';/);
  assert.match(motor, /const step = FIXED_DT \* scale;/);
  assert.match(motor, /const frameDt = Math\.min\(dt, MAX_FRAME_DT\) \* scale;/,
    'MAX_FRAME_DT is Unity\'s maximumDeltaTime - an UNSCALED bound, applied before the scale');
});

// ─── the mod, driven ──────────────────────────────────────────────────

/** A mod over a table: a world of numbers the pins can move. */
function rig(over = {}) {
  const net = { roads: new Uint8Array(1000 * 500), tracks: new Uint8Array(1000 * 500), source: 'basic-roads' };
  const state = {
    pos: { x: mapPixelWorldOrigin(500, 250).x + 16384, z: mapPixelWorldOrigin(500, 250).z + 16384 },
    pixel: { x: 500, y: 250 }, yaw: 0, enemies: false, climate: 231, health: 50, maxHealth: 50,
    fatigue: 64 * 50, disease: 0, location: null, now: 0,
  };
  const said = [], boxed = [], scales = [];
  const ui = new TravelControlUI({ defaultStartingAccel: 10, accelerationLimit: 60 });
  const settings = readTravelOptionsSettings((vendor, key) => {
    if (vendor === 'roads-hazelnut') return key === 'Enabled' ? true : false;
    return modSetting(vendor, key);
  });
  const to = createTravelOptions({
    settings: { ...settings, ...over.settings },
    ui,
    roads: () => net,
    worldPos: () => state.pos,
    mapPixel: () => state.pixel,
    yaw: () => state.yaw,
    setFacing: () => {},
    currentLocation: () => state.location,
    hasCurrentLocation: () => !!state.location,
    localizedCurrentLocationName: () => state.location?.name ?? '',
    localizedLocationName: (s) => s?.name ?? '',
    climateIndex: () => state.climate,
    entity: () => ({ health: state.health, maxHealth: state.maxHealth, fatigue: state.fatigue, luck: 50, stealth: 50 }),
    enemiesNearby: () => state.enemies,
    diseaseCount: () => state.disease,
    say: (l) => said.push(l),
    messageBox: (l) => boxed.push(l),
    setTimeScale: (n) => scales.push(n),
    now: () => state.now,
    worldTimeNow: () => 0,
    roll100: () => over.roll ?? 100,
    pushWindow: (w) => w.show(),
    locationWorldRect: (s) => {
      const o = mapPixelWorldOrigin(s.pixel.x, s.pixel.y);
      return rectOf(o.x + 16000, o.z + 16000, 768, 768);
    },
    locationTileRect: () => null,
    ...over.deps,
  });
  return { to, ui, net, state, said, boxed, scales };
}

test('TO1: BeginTravel arms the journey, sets the scale and shows the panel; the arrival clears it', () => {
  const { to, ui, state, boxed, scales } = rig();
  to.beginTravel({ pixel: { x: 502, y: 250 }, name: 'Daggerfall', mapId: 199102 }, true);
  assert.equal(to.destinationName, 'Daggerfall');
  assert.equal(ui.destinationName, 'Daggerfall');
  assert.equal(ui.isShowing, true, ':533 - the panel is pushed');
  assert.equal(ui.halfLimit, false, ':464 - a named destination runs at the full limit');
  assert.deepEqual(scales, [10], ':524-526 - SetTimeScale(the panel\'s acceleration)');
  assert.equal(to.isTravelActive, true);
  assert.equal(to.isPathFollowing, false, 'a named destination is not a followed path');

  // walk into the destination rect
  const o = mapPixelWorldOrigin(502, 250);
  state.pixel = { x: 502, y: 250 };
  state.pos = { x: o.x + 16100, z: o.z + 16100 };
  to.update({ topWindowIsTravelUI: true, isPlayerOnHUD: false });
  to.update({ topWindowIsTravelUI: true, isPlayerOnHUD: false });
  assert.equal(to.destinationName, null, 'the journey is over');
  assert.equal(ui.isShowing, false);
  assert.deepEqual(boxed, [TRAVEL_OPTIONS_TEXT.MsgArrived]);
});

test('TO1: the Update loop stops for the sea, for a wound, for exhaustion and for enemies - in the mod\'s own order', () => {
  // the sea
  {
    const { to, ui, state, boxed } = rig();
    to.beginTravel({ pixel: { x: 900, y: 250 }, name: 'Nowhere' }, false);
    state.climate = CLIMATE_OCEAN;
    const r = to.update({ topWindowIsTravelUI: true });
    assert.equal(r.stopped, 'ocean');
    assert.equal(ui.isShowing, false);
    assert.deepEqual(boxed, [TRAVEL_OPTIONS_TEXT.MsgOcean]);
  }
  // health and fatigue, and ONLY while cautious
  {
    const { to, state, boxed } = rig();
    to.beginTravel({ pixel: { x: 900, y: 250 }, name: 'Nowhere' }, true);
    state.health = 1;   // 2% of 50, under the shipped 5%
    assert.equal(to.update({ topWindowIsTravelUI: true }).stopped, 'health');
    assert.deepEqual(boxed, [TRAVEL_OPTIONS_TEXT.MsgLowHealth]);
  }
  {
    const { to, state, boxed } = rig();
    to.beginTravel({ pixel: { x: 900, y: 250 }, name: 'Nowhere' }, true);
    state.fatigue = 64 * 5;   // under FatigueMultiplier * (5 + 1)
    assert.equal(to.update({ topWindowIsTravelUI: true }).stopped, 'fatigue');
    assert.deepEqual(boxed, [TRAVEL_OPTIONS_TEXT.MsgLowFatigue]);
  }
  {
    const { to, state } = rig();
    to.beginTravel({ pixel: { x: 900, y: 250 }, name: 'Nowhere' }, false);   // RECKLESS
    state.health = 1; state.fatigue = 0;
    assert.notEqual(to.update({ topWindowIsTravelUI: true }).stopped, 'health', ':1377 - the watch is cautious travel\'s alone');
  }
  // enemies: reckless says so, cautious rolls
  {
    const { to, state, boxed } = rig();
    to.beginTravel({ pixel: { x: 900, y: 250 }, name: 'Nowhere' }, false);
    state.enemies = true;
    assert.equal(to.update({ topWindowIsTravelUI: true }).stopped, 'enemies');
    assert.deepEqual(boxed, [TRAVEL_OPTIONS_TEXT.MsgEnemies]);
  }
  {
    const { to, ui, state, boxed } = rig({ roll: 100 });   // a roll of 100 fails a chance of 50
    to.beginTravel({ pixel: { x: 900, y: 250 }, name: 'Nowhere' }, true);
    state.enemies = true;
    to.update({ topWindowIsTravelUI: true });
    assert.deepEqual(boxed, [TRAVEL_OPTIONS_TEXT.MsgAvoidFail]);
    assert.equal(ui.isShowing, false);
  }
  {
    const { to, ui, state, boxed } = rig({ roll: 1 });   // ...and a roll of 1 beats it
    to.beginTravel({ pixel: { x: 900, y: 250 }, name: 'Nowhere' }, true);
    state.enemies = true;
    to.update({ topWindowIsTravelUI: true });
    assert.deepEqual(boxed, [], 'no box - the journey simply carries on');
    assert.equal(ui.isShowing, true, ':1206-1210 - the journey is begun again');
    assert.equal(ui.message, TRAVEL_OPTIONS_TEXT.MsgAvoidSuccess);
    assert.equal(to.state.ignoreEncounters, true);
    assert.equal(to.state.ignoreEncountersTime, IGNORE_ENCOUNTERS_SECONDS, 'fifteen seconds of UNSCALED time');
  }
});

test('TO1: another window stops the journey, and the game being paused stops everything else', () => {
  const { to, state } = rig();
  to.beginTravel({ pixel: { x: 900, y: 250 }, name: 'Nowhere' }, false);
  // paused (the travel map is open over it): the autopilot still runs and nothing else does
  state.enemies = true;
  const paused = to.update({ topWindowIsTravelUI: true, gamePaused: true });
  assert.equal(paused.stopped, undefined, ':1343-1345 - the early return');
  assert.ok(paused.drive, '...but the autopilot updated, which is what keeps the map from breaking');
  // another window entirely
  const other = to.update({ topWindowIsTravelUI: false, topWindowAllowsTravel: false, isPlayerOnHUD: false });
  assert.equal(other.interrupted, true);
  assert.equal(to.state.autopilot, null);
  assert.equal(to.destinationName, 'Nowhere', 'InterruptTravel keeps the destination - the map can offer to resume it');
});

test('TO1: the follow key - a road under the feet and a facing that matches begins a leg; nothing under the feet says so', () => {
  const { to, ui, net, state, said } = rig();
  const at = (x, y) => x + y * 1000;
  net.roads[at(500, 250)] = E | W;
  net.roads[at(501, 250)] = W;
  state.yaw = 90;   // due east
  assert.equal(to.followPath(), true);
  assert.equal(ui.isShowing, true);
  assert.equal(ui.destinationName, TRAVEL_OPTIONS_TEXT.MsgFollowRoad);
  assert.equal(ui.halfLimit, true, ':705 - a followed path runs at HALF the acceleration limit');
  assert.equal(to.road, true);
  assert.equal(to.destinationName, null, ':641 - a followed path has no named destination');
  assert.equal(to.isPathFollowing, true);

  // a TRACK is cautious and says so
  const b = rig();
  b.net.tracks[at(500, 250)] = E | W;
  b.state.yaw = 90;
  assert.equal(b.to.followPath(), true);
  assert.equal(b.ui.destinationName, TRAVEL_OPTIONS_TEXT.MsgFollowTrack);
  assert.equal(b.to.road, false);

  // FACING THE WAY YOU CAME still follows (:646-656), and it is a
  // SECOND question: the pixel carries ONE edge, east, and the player
  // faces west. The facing matches nothing, the reverse matches the
  // road, and the leg begins - into THIS pixel (GetTargetPixel(0)).
  const c = rig();
  c.net.roads[at(500, 250)] = E;
  c.state.yaw = 270;
  assert.equal(c.to.followPath(), true);
  assert.deepEqual(c.to.state.autopilot.destinationMapPixel, { x: 500, y: 250 }, ':653 - GetTargetPixel(0) is this pixel');

  // A FOLLOWED PATH FORGETS A NAMED DESTINATION (:641, :651). The two
  // are different journeys and the mod's own messages say which is
  // running - `isPathFollowing` is "showing AND no destination".
  const f = rig();
  f.net.roads[at(500, 250)] = E | W;
  f.state.yaw = 90;
  f.to.beginTravel({ pixel: { x: 900, y: 250 }, name: 'Sentinel' }, false);
  assert.equal(f.to.destinationName, 'Sentinel');
  f.to.followPath();
  assert.equal(f.to.destinationName, null, 'the named destination is dropped');
  assert.equal(f.to.isPathFollowing, true);

  // no path at all
  const d = rig();
  d.state.yaw = 90;
  assert.equal(d.to.followPath(), false);
  assert.deepEqual(d.said, [TRAVEL_OPTIONS_TEXT.MsgNoPath]);
  assert.equal(d.ui.isShowing, false);
  assert.deepEqual(said, [], 'and the first rig said nothing, because it found one');
});

test('TO1: a leg that arrives carries straight on at a two-way pixel and STOPS at a junction', () => {
  const at = (x, y) => x + y * 1000;
  // two ways out: carry on
  {
    const { to, ui, net, state } = rig();
    net.roads[at(500, 250)] = E | W;
    net.roads[at(501, 250)] = E | W;
    state.yaw = 90;
    to.followPath();
    state.pixel = { x: 501, y: 250 };
    to.selectNextPath();
    assert.equal(ui.isShowing, true, 'the journey did not stop');
    assert.equal(to.state.autopilot.destinationMapPixel.x, 502, 'and the next leg is the next pixel east');
  }
  // three ways out: a junction
  {
    const { to, ui, net, state, said } = rig();
    net.roads[at(500, 250)] = E | W;
    state.yaw = 90;
    to.followPath();
    net.roads[at(501, 250)] = E | W | N;
    state.pixel = { x: 501, y: 250 };
    to.selectNextPath();
    assert.equal(ui.isShowing, false, ':1057-1063 - a junction ends the journey');
    assert.deepEqual(said, [TRAVEL_OPTIONS_TEXT.MsgArrivedJunc]);
    assert.equal(to.junctionMapOn, true, '...and puts the mini-map up');
  }
});

test('TO1: the eight mod messages other mods send this one', () => {
  const { to, ui } = rig();
  assert.equal(to.messages.isTravelActive(), false);
  to.beginTravel({ pixel: { x: 900, y: 250 }, name: 'Nowhere' }, false);
  assert.equal(to.messages.isTravelActive(), true);
  assert.equal(to.messages.isPathFollowing(), false, 'a named destination is not path following');
  assert.equal(to.messages.isFollowingRoad(), false);
  to.messages.showMessage('hi');
  assert.equal(ui.message, 'hi');
  to.messages.pauseTravel();
  assert.equal(ui.isShowing, false);
  assert.equal(to.messages.hasPort(199102), true);
  assert.equal(to.messages.hasPort(1), false);
});

test('TO1: the help text names the follow key and the two bindings', () => {
  const { to } = rig({ deps: { binding: (a) => (a === 'TravelExit' ? 'V' : 'M') } });
  const help = to.helpText();
  assert.match(help, /^Travel Options Help/);
  assert.match(help, /K - Follow road or track/, 'the follow key is the setting\'s - K since AUDIT-TO1 I1');
  assert.match(help, /V - Exit travel/);
  assert.match(help, /M - Open travel map when stopped/);
  assert.ok(!help.includes('{0}'), 'every placeholder is filled');
});

// ─── the map and the popup ────────────────────────────────────────────

test('TO1: the ports button shuffles the arrow buttons when a region pages', () => {
  const still = portsBarAnchors(false);
  assert.deepEqual(still.ports, [...PORT_FILTER_POS]);
  assert.deepEqual(still.horizontalArrow, [...HORIZ_ARROW_POS]);
  assert.deepEqual(still.verticalArrow, [...VERT_ARROW_POS]);
  const moved = portsBarAnchors(true);
  assert.deepEqual(moved.ports, [...PORT_FILTER_MOVED], 'the ports button moves UP seven pixels');
  assert.deepEqual(moved.horizontalArrow, [...HORIZ_ARROW_MOVED], '...and both arrows DOWN eight');
  assert.deepEqual(moved.verticalArrow, [...VERT_ARROW_MOVED]);
  assert.deepEqual([...PORTS_SIZE], [45, 11], 'the texture\'s own size');
});

test('TO1: DisplayLocationInfo counts the named buildings and names the guild halls', () => {
  const name = (t) => `type${t}`;
  assert.equal(locationInfoRows(LOCATION_TYPES.Coven, [{ buildingType: 0 }], name), null, ':377-382 - a coven has nothing to know');
  assert.equal(locationInfoRows(LOCATION_TYPES.DungeonKeep, [{ buildingType: 0 }], name), null);
  assert.equal(locationInfoRows(LOCATION_TYPES.TownCity, [], name), null, 'and an undiscovered town answers nothing');
  const info = locationInfoRows(LOCATION_TYPES.TownCity, [
    { buildingType: 0, displayName: 'The Bitter Draught' },      // Alchemist
    { buildingType: 0, displayName: 'Another Alchemist' },
    { buildingType: 11, displayName: 'The Mages Guild' },        // GuildHall
    { buildingType: 11, displayName: 'The Mages Guild' },        // the same hall twice
    { buildingType: 11, displayName: 'Fighters Guild' },
    { buildingType: 17, displayName: 'a house' },                // House1 - not a NAMED building
  ], name);
  assert.equal(info.rows.length, 1, 'one counted type - the guild halls are named, not counted');
  assert.deepEqual(info.rows[0], { type: 0, name: 'type0', count: 2 });
  assert.equal(info.guilds, `${TRAVEL_OPTIONS_TEXT.MsgGuildHalls}Fighters Guild, Mages Guild`,
    'the halls are sorted, de-duplicated, and a leading "The " is dropped');
});

test('TO1: the teleport fee is (8 - rank) x 200, and free at the rank it was always free at', () => {
  assert.equal(TELEPORT_RANK_FREE, 8);
  assert.equal(TELEPORT_COST_PER_RANK, 200);
  assert.equal(teleportCost(1), 1400);
  assert.equal(teleportCost(7), 200);
  assert.equal(teleportCost(8), 0);
  assert.equal(teleportCost(9), 0);
});

test('TO1: IsPlayerControlledTravel - the whole decision, as a truth table', () => {
  const popUpFor = (toggles, settings) => ({
    ...toggles,
    _to: { settings: { cautiousTravel: false, stopAtInnsTravel: false, ...settings } },
    isPlayerControlledTravel() {
      const s = this._to?.settings;
      if (!s) return false;
      return (s.cautiousTravel || !this.speedCautious) && (s.stopAtInnsTravel || !this.sleepModeInn) && !this.travelShip;
    },
  });
  // the shipped defaults: cautious is the mod's, inns are not
  const shipped = { cautiousTravel: true, stopAtInnsTravel: false };
  assert.equal(popUpFor({ speedCautious: true, sleepModeInn: false, travelShip: false }, shipped).isPlayerControlledTravel(), true, 'cautious + camp out: walked');
  assert.equal(popUpFor({ speedCautious: false, sleepModeInn: false, travelShip: false }, shipped).isPlayerControlledTravel(), true, 'reckless + camp out: walked');
  assert.equal(popUpFor({ speedCautious: true, sleepModeInn: true, travelShip: false }, shipped).isPlayerControlledTravel(), false, 'inns are not the mod\'s, so this is fast travel');
  assert.equal(popUpFor({ speedCautious: false, sleepModeInn: false, travelShip: true }, shipped).isPlayerControlledTravel(), false, 'a ship is NEVER walked');
  // both off (the Freedom preset): only reckless, on foot, camping out
  const freedom = { cautiousTravel: false, stopAtInnsTravel: false };
  assert.equal(popUpFor({ speedCautious: true, sleepModeInn: false, travelShip: false }, freedom).isPlayerControlledTravel(), false);
  assert.equal(popUpFor({ speedCautious: false, sleepModeInn: false, travelShip: false }, freedom).isPlayerControlledTravel(), true,
    'the readme\'s "recklessly by foot/horse with camp out will ALWAYS initiate time accelerated travel"');
  // both on (Tedious): everything but a ship is walked
  const tedious = { cautiousTravel: true, stopAtInnsTravel: true };
  for (const cautious of [true, false]) {
    for (const inn of [true, false]) {
      assert.equal(popUpFor({ speedCautious: cautious, sleepModeInn: inn, travelShip: false }, tedious).isPlayerControlledTravel(), true);
    }
  }
  // and with the mod off there is no walked trip at all
  const modOff = popUpFor({ speedCautious: false, sleepModeInn: false, travelShip: false }, undefined);
  modOff._to = null;
  assert.equal(modOff.isPlayerControlledTravel(), false);
});

// ─── the wiring, by source ────────────────────────────────────────────

test('TO1: the wiring - one construction, the fork on the popup\'s word, the panel on the HUD layer, and the paths gated on HIS network', () => {
  const w = read('src/scenes/world.js');
  // the mod is built once, and only while its switch is on
  assert.equal((w.match(/createTravelOptions\(\{/g) || []).length, 1, 'ONE construction');
  assert.match(w, /const travelOptionsOn = modSetting\(TRAVEL_OPTIONS_VENDOR, 'Enabled'\);/);
  assert.match(w, /const travelOptions = travelOptionsOn \? createTravelOptions\(\{/);
  // the fork
  assert.match(w, /if \(opts\?\.playerControlled && beginAcceleratedTravel\(pick, opts, \{ estimateMinutes: computed\?\.minutes \?\? null \}\)\) return;[^\n]*\n\s*fastTravelTo\(pick, opts, computed\);/,
    'the walked trip is tried first (with the popup\'s estimate riding along - AUDIT-TO1 L5) and fast travel is the fallback');
  assert.match(w, /if \(!travelOptions \|\| sharedClockOn\(\)\) return false;/, 'online the journey stands down');
  // THE COMPATIBILITY CHECK Mac asked for: following is handed HIS network alone
  assert.match(w, /roads: \(\) => \{ const net = terrainGen\.roads\(\); return net\?\.source === 'basic-roads' \? net : null; \},/,
    'the port\'s own generated network is never followed');
  const client = read('src/world/terrainGenClient.js');
  assert.equal((client.match(/source: this\._roadsSource/g) || []).length, 3, 'the source rides every rebuild of the network object');
  assert.match(client, /this\._roadsSource = net\.source \?\? 'basic-roads';/);
  assert.match(client, /this\._roadsSource = 'generated';/);
  assert.equal((client.match(/source: /g) || []).length, 4,
    'AUDIT 58 F3 / BR3: three assembly sites plus the stats fallback - a field on ONE of them is silently inert on the path the game takes');
  // the panel is drawn on the HUD layer, never pushed as an overlay
  assert.match(w, /if \(travelControlUI\?\.isShowing\) travelControlUI\.tick\(dt\);/);
  assert.match(w, /if \(travelControlUI\?\.isShowing\) travelControlUI\.draw\(renderer, canvas, townTalk\.font\);/);
  assert.match(w, /drawEnhancedTravelControl\(\{/, 'and the enhanced lane gets its own');
  // AUDIT-TO1 F1: THE JUNCTION MAP OUTLIVES THE BAR - drawn off the mod's own
  // flag, in both lanes, OUTSIDE the panel's gate (the mod's HUD child, :358)
  assert.match(w, /const _junctionUp = !!\(travelJunctionMap && travelOptions\?\.junctionMapOn\);/);
  assert.match(w, /travelJunctionMap\.enabled = _junctionUp;/, 'the classic disc follows the flag, not the panel');
  assert.match(w, /if \(travelControlUI\?\.isShowing \|\| _junctionUp\) \{/, 'and the enhanced mount stays up for the disc alone');
  assert.match(w, /showing: !!travelControlUI\?\.isShowing,/);
  // AUDIT-TO1 A1: the HUD is the top window only when the panel is NOT up -
  // DFU's IsPlayerOnHUD over a pushed travel window (:533)
  assert.match(w, /isPlayerOnHUD: !townTalk\.overlayActive && !\(modes\?\.overlayHeld \?\? false\) && !travelControlUI\?\.isShowing,/,
    'the host expression that killed every journey on its first frame, corrected');
  assert.ok(!/showOverlay\(travelControlUI\)/.test(w), 'the panel is NEVER in the overlay slot - an overlay holds the motor and the clock');
  // its keys and its clicks
  assert.match(w, /if \(travelControlUI\?\.isShowing && travelControlUI\.input\(e\.code, e\)\) \{ e\.preventDefault\(\); return; \}/);
  assert.match(w, /if \(v && travelControlUI\.click\(v\[0\], v\[1\]\)\) return;/);
  // the frame's two scaled things, and only those two
  assert.match(w, /const travelScale = worldTimeScale\(\);/);
  assert.match(w, /playerTicker\.tick\(dt \* timeScaleMult \* travelScale,/, 'the calendar keeps up with the miles');
  assert.match(w, /player\.update\(dt, paralyzed \? \{/, 'the motor still takes the REAL frame - it scales itself');
  // the four hosts rule: named, and the reason
  assert.match(w, /THE FOUR HOSTS RULE/);
  assert.match(w, /\(\?exterior\) has no roads and no travel map and says so itself/);
  assert.match(w, /the mod's own follow key refuses indoors/, '...and the two indoor hosts are named with the reason');
});

test('TO1: the map and the popup carry the mod\'s own additions', () => {
  const m = read('src/ui/travelMapWindow.js');
  // the five-texel page, only with his roads integration on
  assert.match(m, /this\._dotsScale = DOT_SCALE;/);
  assert.match(m, /if \(this\._to\?\.settings\?\.roadsIntegration && this\.selectedRegion !== 61 && this\._dotsScale === DOT_SCALE\) \{/,
    'Cybiades is the mod\'s own exception (:582)');
  assert.match(m, /REGION_W \* this\._dotsScale, REGION_H \* this\._dotsScale/);
  // the ports filter reaches DISCOVERY, which is where the mod puts it
  assert.match(m, /if \(!portsFilterAllows\(this\.portsFilter, summary\?\.mapID \?\? summary\?\.mapId\)\) return false;/);
  // the middle click, the two keys, the coordinates click
  assert.match(m, /click\(vx, vy, right = false, middle = false\) \{/);
  assert.match(m, /if \(middle\) \{/);
  assert.match(m, /if \(code === 'KeyI' && this\.locationSelected\) \{ this\._displayLocationInfo\(\); return; \}/);
  // AUDIT-TO1 H1: the help is boxed in the window's own slot, a row a line
  assert.match(m, /if \(code === 'KeyH'\) \{\s*\n\s*const rows = this\.deps\.helpRows\?\.\(\);/);
  assert.match(m, /this\.infoBox = \{ rows: rows\.map\(\(t\) => \(\{ text: t, center: false \}\)\), anywhere: true \};/);
  assert.match(m, /this\._createCoordsPopUpWindow\(\);/);
  // the resume prompt and the teleport charge are ONE-SHOTS on the first tick
  assert.match(m, /if \(!this\._resumeAsked\) \{/);
  assert.match(m, /if \(!this\._teleportChargeDone && this\.teleportationTravel && this\._to\?\.settings\?\.teleportCost\) \{/);

  const p = read('src/ui/travelPopUp.js');
  assert.match(p, /isPlayerControlledTravel\(\) \{/);
  // AUDIT-TO1 C1: the fork is ONE pure law now, shared with the enhanced map
  assert.match(p, /return \(settings\.cautiousTravel \|\| !speedCautious\) && \(settings\.stopAtInnsTravel \|\| !sleepModeInn\) && !travelShip;/);
  assert.match(p, /isPlayerControlledTravel\(\) \{\s*\n\s*return isPlayerControlledTravel\(this\._to\?\.settings, this\);/, 'the method is the pure law over its own three toggles');
  const ov = read('src/ui/heldMap.js');
  assert.match(ov, /playerControlled: isPlayerControlledTravel\(st\.to\?\.settings, st\.opts\),/, 'and the DEFAULT skin commits the same word - the mod was unreachable from it before');
  assert.match(ov, /enforceShipRestriction\(st\.to\.settings, st\.opts, this\._shipCtx\(\)\)/, 'OnPush\'s guard on the default skin');
  assert.match(ov, /const refusal = shipTravelRefusal\(\{ settings, \.\.\.this\._shipCtx\(\) \}\);/, 'and the ship click\'s');
  assert.match(p, /if \(this\.coordsOnly \|\| this\.isPlayerControlledTravel\(\)\) \{/, 'the fork is in CallFastTravelGoldCheck, where the mod puts it');
  assert.match(p, /playerControlled: true,/);
  assert.match(p, /_scaleTripCost\(c0\)/);
  assert.match(p, /shipTravelRefusal\(\) \{/);
});

// ═══ AUDIT-TO1: the two classes the port did not carry ════════════════
//
// Travel Options ships EIGHT C# classes. TO1 carried five and the small
// service classes went unread; two of the three cost the player
// something, and both are behaviours the mod exists to provide rather
// than scaffolding it could drop.

test('AUDIT-TO1 F1: paid teleportation reaches a member of ANY rank, and only while the mod asks for it', () => {
  // MagesGuildTO.cs:9-17 is the whole class: `CanAccessService(Teleport)
  // => true`. The mod registers it, for the whole MagesGuild group, ONLY
  // when EnablePaidTeleportation is on (TravelOptionsMod.cs:331-336).
  // Without it the port answered DFU's own MagesGuild.cs:154 - rank >= 8
  // - and teleportation is FREE from rank 8 up, so the paid service the
  // port had already built (the cost formula, both boxes, the setting)
  // could never be reached by a player who would have paid for it.
  const guild = { name: 'MagesGuild' };
  const novice = { rank: 1, joined: true };
  const master = { rank: 8, joined: true };

  registerCustomGuild('MagesGuild', null);   // the mod off, or never built
  assert.equal(canAccessService(guild, novice, 'Teleport'), false, 'stock law: rank 8');
  assert.equal(canAccessService(guild, master, 'Teleport'), true);

  // ...and with the mod's own arm installed, exactly as createTravelOptions
  // installs it when settings.teleportCost is true.
  registerCustomGuild('MagesGuild', (_m, service) => (service === 'Teleport' ? true : undefined));
  assert.equal(canAccessService(guild, novice, 'Teleport'), true, 'the fee is reachable at rank 1');
  assert.equal(canAccessService(guild, master, 'Teleport'), true);

  // THE ARM DECLINES FOR EVERYTHING ELSE. MagesGuildTO overrides one
  // service and inherits the rest, so a registry that answered `false`
  // by default - or one that swallowed the switch - would quietly strip
  // the guild of its other six rank gates.
  assert.equal(canAccessService(guild, novice, 'BuyMagicItems'), false, 'still rank 3');
  assert.equal(canAccessService(guild, { rank: 3, joined: true }, 'BuyMagicItems'), true);
  assert.equal(canAccessService(guild, novice, 'DaedraSummoning'), false, 'still rank 6');
  assert.equal(canAccessService(guild, novice, 'Identify'), true, 'and the ungated ones stay open');

  // A NON-MEMBER never reaches the override, because GetGuild hands a
  // stranger guildNotMember before any subclass is asked (the comment
  // canAccessService opens with). The mod does not change that.
  assert.equal(canAccessService(guild, null, 'Teleport'), false, 'a stranger is still refused');
  registerCustomGuild('MagesGuild', null);

  // and the install itself is the mod's, on the mod's own setting
  const t = read('src/systems/travelOptions.js');
  assert.match(t, /registerCustomGuild\('MagesGuild', s0\.teleportCost/,
    'the registration is gated on EnablePaidTeleportation, as :331-336 gates it');
  assert.match(t, /\(_membership, service\) => \(service === 'Teleport' \? true : undefined\)/);
});

test('AUDIT-TO1 F2: a walked journey costs a Cast-When-Held item no durability at all', () => {
  // CastWhenHeldTO.cs:26-35 replaces DFU's CastWhenHeld outright
  // (RegisterEffectTemplate, :338 - UNCONDITIONALLY, behind no setting)
  // for one reason: its guard is `!SyntheticTimeIncrease && !
  // GetTravelControlUI().isShowing`. DFU's fast travel raises the
  // synthetic flag, so a classic trip costs a held enchantment nothing;
  // an accelerated journey is REAL time, raises no flag, and billed
  // every game minute it covered.
  resetSyntheticTimeIncrease();
  const rounds = 2880;   // one long crossing, at the port's catch-up cap

  // WITHOUT the panel: the stock law, and it is brutal - 2880/4 = 720
  // points, which destroys the item twice over.
  const bare = item(ENCHANTMENT_TYPES.CastWhenHeld, 4);
  const w1 = wearer([bare]);
  const noPanel = { hurtSelf: () => {}, travelUIShowing: () => false };
  for (let r = 1; r <= rounds; r++) enchantmentMagicRound(w1, r, { nowMinutes: r, ctx: noPanel });
  assert.ok(bare.currentCondition < 100, 'real time really does bill this arm');

  // WITH the panel up: not one point, which is the mod's behaviour and
  // the same answer a classic fast travel already gets.
  const worn = item(ENCHANTMENT_TYPES.CastWhenHeld, 4);
  const w2 = wearer([worn]);
  const panelUp = { hurtSelf: () => {}, travelUIShowing: () => true };
  for (let r = 1; r <= rounds; r++) enchantmentMagicRound(w2, r, { nowMinutes: r, ctx: panelUp });
  assert.equal(worn.currentCondition, 100, 'the journey costs the item nothing');
  assert.ok(w2.items.includes(worn), 'and it does not break out of the pack');

  // THE PANEL IS THE TEST, NOT THE CLOCK. A journey paused for camp sits
  // at a time scale of 1 with the panel still showing, and the mod still
  // charges it nothing - so a guard written on the time scale instead
  // would have wear resume the moment the player made camp.
  assert.equal(timeScale(), 1, 'the pin asserts this with the clock at rest');

  // the wiring: the world host is the only one that can run a journey,
  // and it reads the panel through a holder because the ctx is built
  // first (AUDIT 24 wave 37's temporal-dead-zone shape).
  const e = read('src/systems/enchantments.js');
  assert.match(e, /if \(ctx\?\.travelUIShowing\?\.\(\)\) return;/);
  const h = read('src/scenes/hostEnchant.js');
  assert.match(h, /travelUIShowing = \(\) => false,/, 'every host but one answers false');
  const w = read('src/scenes/world.js');
  assert.match(w, /travelUIShowing: \(\) => !!_travelUIHolder\.ui\?\.isShowing,/);
  assert.match(w, /_travelUIHolder\.ui = travelControlUI;/);
  resetSyntheticTimeIncrease();
});


// ═══ AUDIT-TO1 part 2: the sweep's confirmed findings, each pinned two ways ═══

test('AUDIT-TO1 A1: driven with the HOST\'s own flag expression, a journey survives its first frame - and with the old one it died on it', () => {
  // world.js handed `isPlayerOnHUD: !overlayActive && !overlayHeld` - the exact
  // complement of the `gamePaused` beside it - so every frame that reached the
  // "any other window" arm (:1040) took it. Every earlier journey pin passed
  // `isPlayerOnHUD: false` by hand. This one passes what the host passes NOW:
  // the panel standing in for DFU's pushed window (:533).
  const { to, ui } = rig();
  to.beginTravel({ pixel: { x: 900, y: 250 }, name: 'Nowhere' }, false);
  const host = () => ({ topWindowIsTravelUI: !!ui.isShowing, isPlayerOnHUD: !ui.isShowing, gamePaused: false });
  const r1 = to.update(host());
  const r2 = to.update(host());
  assert.equal(r1.interrupted, undefined, 'frame 1: not interrupted');
  assert.equal(r2.interrupted, undefined, 'frame 2: not interrupted');
  assert.ok(to.state.autopilot, 'the autopilot is alive');
  assert.equal(ui.isShowing, true, 'and the panel is still up');
  assert.ok(r2.drive && r2.drive.forward > 0, 'and the body is being pushed');
  // the old expression, for the record: dead on frame one
  const { to: old, ui: oldUi } = rig();
  old.beginTravel({ pixel: { x: 900, y: 250 }, name: 'Nowhere' }, false);
  const dead = old.update({ topWindowIsTravelUI: !!oldUi.isShowing, isPlayerOnHUD: true, gamePaused: false });
  assert.equal(dead.interrupted, true, 'the shipped mapping interrupted every journey on its first unpaused frame');
  assert.equal(old.state.autopilot, null);
});

test('AUDIT-TO1 M1: the mod DETACHES its enter-rect handler at the first interrupt under LocationPause "entered" - carried as written', () => {
  // TravelOptionsMod.cs:994-996 `-=` in InterruptTravel; :381 is the only `+=`.
  const { to, ui, boxed } = rig({ settings: { locationPause: LOC_PAUSE_ENTER } });
  to.beginTravel({ pixel: { x: 900, y: 250 }, name: 'Nowhere' }, false);
  to.onEnterLocationRect({ name: 'Tulanistead' });
  assert.equal(boxed.length, 1, 'the "entered" stop fires');
  assert.equal(ui.isShowing, false);
  to.resumeTravel();
  assert.equal(ui.isShowing, true, 'resume re-arms the autopilot and pushes the panel (:475-493 -> InitTravelUI)');
  to.interruptTravel();
  assert.equal(to.state.enterRectDetached, true, 'the handler is gone for the session');
  to.resumeTravel();
  to.onEnterLocationRect({ name: 'Tulanistead' });
  assert.equal(boxed.length, 1, 'and never fires again - the mod\'s own quirk');
  // ...and NOT under the other two pause modes
  const { to: near } = rig({ settings: { locationPause: 1 } });
  near.beginTravel({ pixel: { x: 900, y: 250 }, name: 'Nowhere' }, false);
  near.interruptTravel();
  assert.equal(near.state.enterRectDetached, false);
});

test('AUDIT-TO1 K1: InitTargetRect keeps the latched yaw - a re-aimed leg interrupted in the same update faces the way it walked', () => {
  const ap = new TravelAutopilot({ x: 1, y: 1 }, rectOf(0, 0, 10, 10), 1);
  ap.yaw = 90;
  ap.initTargetRect({ x: 2, y: 2 }, rectOf(100, 100, 10, 10), 1);
  assert.equal(ap.yaw, 90, 'PlayerAutoPilot.cs:40-50 never writes yawVector');
  assert.deepEqual(ap.mouseLookAtDestination(), { yaw: 90, pitch: 0 });
  assert.equal(ap.inDestinationMapPixel, false, 'and the rest of the re-init still happens');
  assert.equal(ap.lastPlayerMapPixel.x, Number.MAX_SAFE_INTEGER);
});

test('AUDIT-TO1 L5: the enhanced panel\'s ETA runs the popup\'s estimate down on the world clock, and a followed path has none', () => {
  let clock = 0;
  const { to } = rig({ deps: { worldTimeNow: () => clock } });
  assert.equal(to.minutesLeft, null, 'no journey, no estimate');
  to.beginTravel({ pixel: { x: 900, y: 250 }, name: 'Nowhere' }, false, 120);
  assert.equal(to.minutesLeft, 120);
  clock = 45;
  assert.equal(to.minutesLeft, 75);
  clock = 500;
  assert.equal(to.minutesLeft, 0, 'clamped - an overrun is "arriving", not owed');
  to.clearTravelDestination();
  assert.equal(to.minutesLeft, null);
  assert.equal(to.state.estimateMinutes, null, 'and the estimate itself is dropped, not merely hidden behind the null autopilot - a resume would otherwise run down a stale trip\'s number');
  // a followed path: no estimate to run down
  const { to: f, net, state } = rig({ deps: { worldTimeNow: () => 0 } });
  net.roads[500 + 250 * 1000] = 32; net.roads[501 + 250 * 1000] = 2; state.yaw = 90;
  assert.equal(f.followPath(), true);
  assert.equal(f.minutesLeft, null);
  assert.equal(etaText(75), '1h 15m');
});

/** The popup as the map window builds it, with the ports restriction on. */
function portsPopUp({ here = 1, dest = 199102, destPortsOnly = false, onShip = false, oceanPixels = 0 } = {}) {
  const w = new TravelPopUpWindow({ x: 230, y: 240 }, {
    getPlayerPixel: () => ({ x: 500, y: 250 }),
    getClimateIndex: () => 231,
    gold: () => 1000, goldPieces: () => 1000, diseaseCount: () => 0,
    travelOptions: () => ({ settings: { shipTravelPortsOnly: true, shipTravelDestinationPortsOnly: destPortsOnly, cautiousTravel: true, stopAtInnsTravel: false, recklessTravelMultiplier: 1, cautiousTravelMultiplier: 0.8 } }),
    currentLocationMapId: () => here,
    isOnShip: () => onShip,
    locationSummary: () => ({ mapID: dest }),
  });
  w.trip.oceanPixels = oceanPixels;
  return w;
}

test('AUDIT-TO1 D1: with the player\'s location handed over, the ship is refused inland and ALLOWED at a port - it refused at every quay before', () => {
  const inland = portsPopUp({ here: 1 });
  assert.equal(inland.isNotAtPort(), true);
  assert.equal(inland.shipTravelRefusal(), 'noport');
  const quay = portsPopUp({ here: 199102, dest: 199111 });   // two of the 378 harbours
  assert.equal(quay.isNotAtPort(), false, 'IsNotAtPort reads PlayerGPS.CurrentLocation (:85-89)');
  assert.equal(quay.shipTravelRefusal(), null, 'a port to a port sails');
  const wild = portsPopUp({ here: null, dest: 199111 });
  assert.equal(wild.isNotAtPort(), true, 'open wilderness is `!location.Loaded` - not a port');
});

test('AUDIT-TO1 D2/D3/D4: OnPush\'s guard runs at construction, and the wheel and the camp-out arms carry the mod\'s own checks', () => {
  // D2: a popup that cannot sail does not OPEN on the ship toggle (:53-67)
  const w = portsPopUp({ here: 1 });
  assert.equal(w.travelShip, true, 'DFU\'s own default before OnPush');
  w.enforceShipRestriction();
  assert.equal(w.travelShip, false, 'OnPush clears it - the map window calls this after Object.assign now');
  assert.equal(w.isPlayerControlledTravel(), false, 'cautious/inns with the shipped settings');
  // D4: the wheel over the transport pair is refused with the box, as the click is (:207-213)
  w.hover(163 + 54, 61 + 4);   // over the SHIP row
  w.wheel(1);
  assert.equal(w.travelShip, false, 'not toggled');
  assert.equal(w.top, 'noport', 'and the refusal box is up');
  w.top = null;
  // ...and at a port the same notch selects it
  const q = portsPopUp({ here: 199102, dest: 199111 });
  q.travelShip = false;
  q.hover(163 + 54, 61 + 4); q.wheel(1);
  assert.equal(q.travelShip, true);
  assert.equal(q.top, null);
  // D3: the camp-out CLICK clears the ship only when the trip cannot sail (:215-224)
  const c = portsPopUp({ here: 1 });
  c.travelShip = true;
  const [cx, cy, cw, ch] = POPUP_RECTS.campout;
  c.click(cx + cw / 2, cy + ch / 2);
  assert.equal(c.sleepModeInn, false);
  assert.equal(c.travelShip, false, 'the camp-out choice is the mod\'s way into a walked trip');
  const c2 = portsPopUp({ here: 199102, dest: 199111 });
  c2.travelShip = true;
  c2.click(cx + cw / 2, cy + ch / 2);
  assert.equal(c2.travelShip, true, 'at a port it stays');
  // D3 (wheel): unconditionally over CAMP OUT (:226-232), never over INNS
  const d = portsPopUp({ here: 199102, dest: 199111 });
  d.travelShip = true;
  d.hover(cx + cw / 2, cy + ch / 2); d.wheel(1);
  assert.equal(d.travelShip, false, 'the scroll arm clears it whether or not the trip could sail');
  const e = portsPopUp({ here: 199102, dest: 199111 });
  e.travelShip = true;
  const [ix, iy, iw, ih] = POPUP_RECTS.inns;
  e.hover(ix + iw / 2, iy + ih / 2); e.wheel(1);
  assert.equal(e.travelShip, true, 'a notch over INNS leaves the ship - `sender == campOutToggleButton`');
  // the pure laws the enhanced map runs
  const settings = { shipTravelPortsOnly: true, cautiousTravel: true, stopAtInnsTravel: false };
  assert.equal(isPlayerControlledTravel(settings, { speedCautious: true, sleepModeInn: false, travelShip: false }), true);
  assert.equal(isPlayerControlledTravel(settings, { speedCautious: true, sleepModeInn: true, travelShip: false }), false);
  assert.equal(isPlayerControlledTravel(settings, { speedCautious: false, sleepModeInn: false, travelShip: true }), false, 'a ship is never walked');
  const opts = { speedCautious: true, sleepModeInn: true, travelShip: true };
  enforceShipRestrictionPure(settings, opts, { currentLocationMapId: 1, isOnShip: false, destinationMapId: 199102, oceanPixels: 0 });
  assert.equal(opts.travelShip, false);
  assert.equal(shipTravelRefusalPure({ settings, currentLocationMapId: 199102, destinationMapId: 199111 }), null);
});

test('AUDIT-TO1 G4: the middle-click mark outlives the window, like the eight filters', () => {
  resetTravelMapState();
  assert.equal(travelMapMarkedMapId(), -1);
  setTravelMapMarkedMapId(199102);
  assert.equal(travelMapMarkedMapId(), 199102, 'a second window would read the same mark');
  setTravelMapMarkedMapId(NaN);
  assert.equal(travelMapMarkedMapId(), -1, 'not a number is no mark');
  setTravelMapMarkedMapId(7);
  resetTravelMapState();
  assert.equal(travelMapMarkedMapId(), -1, 'a new game forgets it');
  const m = read('src/ui/travelMapWindow.js');
  assert.match(m, /get: \(\) => travelMapMarkedMapId\(\),/, 'the window reads the store');
  assert.match(m, /set: \(v\) => setTravelMapMarkedMapId\(v\),/);
});

test('AUDIT-TO1 E1/E2/E3: the vendored art is UPLOADED before it is drawn, and the junction disc draws through a real quad', () => {
  const c = read('src/ui/travelControlUI.js');
  assert.match(c, /uploadTexture\?\.\('img', 'travelopts:TOcontrolUI', px, \{ mips: false, variant: '#travelopts' \}\)/, 'the strip becomes a texture');
  assert.match(c, /strip = tex \? \{ tex, w: px\.width, h: px\.height, key: 'TOcontrolUI' \} : null;/, 'in drawImg\'s own shape');
  assert.match(c, /if \(_art\?\.strip\?\.tex\) drawImg\(renderer, _art\.strip, m, x0, 0, pw, ph\);/);
  assert.ok(!/strip\.img/.test(c), 'the untextured shape is gone');
  const m = read('src/ui/travelMapWindow.js');
  assert.match(m, /uploadTexture\?\.\('img', `travelopts:\$\{name\}`, px, \{ mips: false, variant: '#travelopts' \}\)/, 'the two ports buttons too');
  assert.match(m, /return tex \? \{ tex, w: px\.width, h: px\.height \} : null;/);
  const j = read('src/ui/travelJunctionMap.js');
  assert.match(j, /renderer\.drawScreenQuad\?\.\(this\._tex, \{ x: m\.ox \+ x \* m\.s, y: m\.oy \+ y \* m\.s, w: w \* m\.s, h: h \* m\.s \}\);/,
    'no third argument: that slot is the SOURCE RECT, and `{ filter }` there fed NaN into uSrc');
  assert.match(j, /\{ smooth: filterModeName\(s\.junctionMapFilterMode \?\? 0\) === 'linear', mips: false, variant: '#travelto' \}/, 'the filter is set where the port sets one - at upload');
});

test('AUDIT-TO1 F1/L7: the junction disc outlives the bar on the enhanced lane, and a window over the HUD covers the panel', () => {
  const e = read('src/ui/enhancedTravelControl.js');
  assert.match(e, /const junctionOnly = !state\.showing && !!state\.junction\?\.on;/);
  assert.match(e, /if \(!state\.showing && !junctionOnly\) \{ hideEnhancedTravelControl\(\); return null; \}/, 'torn down only when BOTH are down');
  assert.match(e, /if \(state\.covered\) \{/);
  assert.match(e, /parts\.root\.style\.display = 'none';/);
  assert.match(e, /title="\$\{T\.TipMap\}"/, 'and the two tooltips the mod carries reach the DOM (H3)');
  const css = read('src/ui/enhancedStyle.js');
  assert.match(css, /\.travelpanel-bar\.hidden \{ display: none; \}/);
  const w = read('src/scenes/world.js');
  assert.match(w, /covered: townTalk\.hudCovered \|\| \(modes\?\.hudCovered \?\? false\) \|\| gamePaused\(\),\s*\n\s*destination: travelControlUI\?\.destinationName/);
  assert.match(w, /minutesLeft: travelOptions\?\.minutesLeft \?\? null,/);
});

test('AUDIT-TO1 B1/B2/B3: the location rects come off the BUILT terrain, and the mod\'s five Start subscriptions have callers', () => {
  const w = read('src/scenes/world.js');
  assert.ok(!/maps\.getLocationAt/.test(w), 'the method MapsFile never had is gone');
  assert.match(w, /const r = built\.get\(`\$\{pixel\.x\},\$\{pixel\.y\}`\)\?\.locationRect \?\? null;/, 'DaggerfallTerrain.MapData.locationRect, off the built record');
  assert.match(w, /tileRect: \{ x: r\.xMin, y: r\.yMin, width: r\.xMax - r\.xMin, height: r\.yMax - r\.yMin \},/);
  assert.match(w, /hasCustomPosition: hasCustomLocationPosition\(loc\),/);
  assert.match(w, /^      locationRect,\n/m, 'the built record keeps it');
  // the subscriptions
  assert.match(w, /travelOptions\.onMapPixelChanged\(playerTravelPixel\(\)\);/, 'PlayerGPS.OnMapPixelChanged');
  assert.match(w, /if \(_travelRegionSeen !== null && _region !== _travelRegionSeen\) travelOptions\.onRegionIndexChanged\(\);/, 'OnRegionIndexChanged');
  assert.match(w, /travelOptions\?\.onEnterLocationRect\(_musicLoc \? \{/, 'OnEnterLocationRect, on the rect edge');
  assert.match(w, /raiseOnEncounterEvent: \(\) => \{ travelOptions\?\.onEncounter\(\); modes\?\.raiseOnEncounterEvent\?\.\(\); \},/, 'GameManager.OnEncounter');
  assert.match(w, /if \(_isPlayersPixel && dfLocation\) travelOptions\?\.initLocationRects\(playerTravelPixel\(\)\);/, 'StreamingWorld.OnUpdateLocationGameObject');
  // the tile rect the C# reads is the terrain's own, extraClearance included
  const t = read('src/world/terrainTiles.js');
  assert.match(t, /const extraClearance = dfLocation\.mapTableData\.locationType === LOCATION_TYPE_TOWN_CITY \? 3 : 2;/);
});

test('AUDIT-TO1 G1/G2/G3/I2/I3/I4/I6/J1/K2/H1/H2: the host seams the sweep found dead, each wired and named', () => {
  const w = read('src/scenes/world.js');
  // G1: a load clears the destination and the scale
  assert.match(w, /async function worldQuickLoad\(\{ mostRecent = false, key = null \} = \{\}\) \{\s*\n\s*if \(_loading\) return;[\s\S]{0,700}?travelOptions\?\.clearTravelDestination\(\);\s*\n\s*if \(worldTimeScale\(\) !== 1\) resetTimeScale\(\);/);
  // G2: the scale's net above every gate, and an indoor mode ends the journey
  assert.match(w, /if \(travelControlUI\?\.isShowing && \(modes\?\.mode \?\? 'exterior'\) !== 'exterior'\) travelControlUI\.closeWindow\(\);\s*\n\s*if \(!travelControlUI\?\.isShowing && worldTimeScale\(\) !== 1\) resetTimeScale\(\);/);
  // I2: the strip's click router wants the freed cursor and the primary button
  assert.match(w, /if \(travelControlUI\?\.isShowing && !gamePaused\(\) && cursorActive\(\) && e\.button === 0 && !\(isEnhanced\(\) && typeof document !== 'undefined'\)\) \{/);
  // I3: the follow key stands down online, as the map's door does
  assert.match(w, /function travelFollowPressed\(\) \{[\s\S]{0,600}?if \(sharedClockOn\(\)\) return false;/);
  // I4: the coordinates door acts on its refusal, and the popup opens only where it is honoured
  assert.match(w, /if \(!beginAcceleratedTravel\(pick, opts, \{ coords: true \}\)\) townTalk\.say\('You cannot travel there now\.'\);/);
  assert.match(w, /coordsAllowed: \(\) => !!travelOptions && !sharedClockOn\(\),/);
  assert.match(read('src/ui/travelMapWindow.js'), /\(this\.deps\.coordsAllowed\?\.\(\) \?\? true\)/);
  // I6: the discovery store is read by the key its writers use
  assert.match(w, /return loc\?\.name \? discoveredBuildings\(`\$\{summary\.regionIndex\}:\$\{loc\.name\}`\) : \[\];/);
  assert.match(w, /discoveryLocationId: \(\) => `\$\{_questLoc\(\)\?\.regionIndex \?\? -1\}:\$\{_questLoc\(\)\?\.name \?\? ''\}`,/, 'the writer\'s own key shape');
  // J1: the two switches have readers
  assert.match(w, /\} else if \(precipShown && precip\) \{[\s\S]{0,2500}?if \(!_travelWeatherOff\) \{\s*\n\s*precip\.draw\(precipShown, proj, view/, 'the rain (the branch literal is W1/WX2/WEATHER2d\'s; the switch wraps the draw)');
  assert.match(w, /const _step = _travelSoundsOff \? null : footsteps\.update\(player\.pos, \{/, 'the classic stride: the component does not RUN (the one-gate line is BA1/IF1\'s literal)');
  assert.match(w, /paused: _overlayHeld \|\| _seasonHeld \|\| _travelSoundsOff, entity: playerEntity,/, 'the mod\'s stride');
  assert.match(w, /ridingVolumeScale: \(\) => \(_travelSoundsOff \? 0 : 1\),/, 'the riding loop');
  assert.match(read('src/player/mountRig.js'), /soundVolume: ridingVolumeScale\(\),/);
  // K2: the strafe is the player's own
  assert.ok(!/axes\.strafe = 0;/.test(w), 'ApplyVerticalForce writes the vertical axis alone');
  // H1: the help is boxed a row a line, in both doors
  assert.match(w, /townTalk\.showBox\(travelOptions\.helpText\(\)\.split\('\\n'\)\)/);
  assert.match(w, /helpRows: \(\) => \(travelOptions \? travelOptions\.helpText\(\)\.split\('\\n'\) : null\),/);
  // H2: the two bindings through their real accessors, `Key` stripped
  assert.match(w, /const code = action === 'TravelExit' \? sequenceString\(shortcutBinding\('TravelExit'\)\) : getBinding\(bindings\(\), action\);/);
  assert.match(w, /return String\(code \?\? ''\)\.replace\(\/\^Key\/, ''\);/);
  // G3: NO on the resume prompt leaves the map open
  const m = read('src/ui/travelMapWindow.js');
  assert.match(m, /if \(code === 'KeyN' \|\| code === 'Escape'\) \{ this\._click\(\); this\.top = null; \}\s*\n\s*return;\s*\n\s*\}\s*\n\s*\/\/ TO1 \(:477-497\): the teleport fee/);
  // D1: the two reads the popup needed
  assert.match(w, /currentLocationMapId: \(\) => _musicLoc\?\.mapTableData\?\.mapId \?\? null,/);
  assert.match(w, /isOnShip: \(\) => isOnShip\(playerEntity, playerEntity\.boardShipPosition \?\? null, playerTravelPixel\(\)\),/);
  assert.match(m, /currentLocationMapId: this\.deps\.currentLocationMapId,\s*\n\s*isOnShip: this\.deps\.isOnShip,/);
  assert.match(m, /this\.popUp\.enforceShipRestriction\(\);/, 'OnPush\'s guard has a caller');
  assert.equal((m.match(/this\.popUp\.enforceShipRestriction\(\);/g) || []).length, 2, 'at both construction sites');
  // I5: the popup's I, and the box drawn above it
  assert.match(read('src/ui/travelPopUp.js'), /if \(key === 'KeyI' && !this\.coordsOnly\) \{ this\.deps\.displayLocationInfo\?\.\(\); return; \}/);
  assert.match(m, /displayLocationInfo: \(\) => this\._displayLocationInfo\(\),/);
  assert.match(m, /this\.popUp\.draw\(renderer, canvas, font\);\s*\n[\s\S]{0,300}?if \(this\.infoBox\) \{\s*\n\s*this\._box = layoutMessageBox\(font, this\.infoBox\.rows, \[\]\);/);
  // C3: the fee on the default skin
  const ov = read('src/ui/heldMap.js');
  assert.match(ov, /const cost = teleportCost\(this\.deps\.magesGuildRank\?\.\(\) \?\? 0\);/);
  assert.match(ov, /if \(fee && !fee\.canPay\) \{ this\._beginClose\(null\); return; \}\s*\n\s*if \(fee && !fee\.paid\) \{ fee\.paid = true; this\.deps\.payTeleport\?\.\(fee\.cost\); \}/);
  // F2: the junction disc honours the map's filters
  assert.match(w, /const i = travelPixelColorIndex\(t, travelMapFilters\(\)\);/);
});

test('AUDIT-TO1 (mutant): a pixel carrying BOTH a road and a track shows the ROAD at the centre texel - the draw order is the law', () => {
  // tools/mutants/to1.json called `map-section-roads-under-tracks` equivalent
  // because the pin's fixture kept the two on disjoint pixels. Here they share
  // one, and the mod draws tracks FIRST so the road wins (:786-787).
  const buf = new Uint32Array(3 * 3 * DOT_SCALE * DOT_SCALE);
  drawMapSection(buf, { originX: 0, originY: 0, width: 3, height: 3 }, {
    pathsAt: (x, y, type) => (x === 1 && y === 1 ? 32 : 0),   // E on both layers
    locationAt: () => null, colorOf: () => null,
  });
  const w5 = 3 * DOT_SCALE;
  const centre = ((3 - 1 - 1) * DOT_SCALE * w5) + (1 * DOT_SCALE) + (2 * w5) + 2;
  assert.equal(buf[centre], packColor(ROAD_COLOR), 'the road is drawn over the track');
  assert.notEqual(buf[centre], packColor(TRACK_COLOR));
});
