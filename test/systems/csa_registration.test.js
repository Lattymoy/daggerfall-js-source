// COME SAIL AWAY 2.1 (RedRoryOTheGlen), THE REGISTRATION: the settings restated key for key, the
// three keys the mod never read, and the switch's Features row, credit and online lane. OWN-WORK4: the
// vendored files are retired - the settings the mod shipped are held here as the table
// they were, so a changed key, kind, range or default still fails; the assertions about the files' own text went.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOD_SETTINGS, modSetting } from '../../src/systems/modSettings.js';
import { FEATURES, MOD_CURATED } from '../../src/systems/features.js';
import { ONLINE_PLAYERS_OWN_MODS, ONLINE_ROOM_MOD_KEYS, onlineForcedModSetting } from '../../src/systems/online/onlineLane.js';
import { isBoatEffectBundle } from '../../src/world/deepWater/deepWaterSwim.js';

const V = 'come-sail-away';
const DEF = MOD_SETTINGS[V];

/** Come Sail Away 2.1's modsettings.json, in its order: `[section.key, kind, default, min, max | options, { description }]`,
 *  its four spacers `['spacer', name]`. */
const SHIPPED = Object.freeze([
["Controls.Disembark","text","C"],
["Controls.ToggleSail","text","Space"],
["Controls.ToggleLight","text","Period"],
["Controls.IncreaseTimeScale","text","KeypadPlus"],
["Controls.DecreaseTimeScale","text","KeypadMinus"],
["Controls.ResetTimeScale","text","KeypadEnter"],
["Controls.TrimRight","text","RightBracket"],
["Controls.TrimLeft","text","LeftBracket"],
["Controls.TrimModifier","text","Backslash"],
["Controls.PortLocationSearchRange","int",3,1,10,{"description":"How far from the player's current location a port can be detected"}],
["spacer","---"],
["WindDirectionWidget.Enable","toggle",true],
["WindDirectionWidget.Position","tuple",[0.5,0.5]],
["WindDirectionWidget.Scale","float",1,0,2],
["WindDirectionWidget.ScalingMode","choice",0,["DoNotScale","ScreenHeight","ScreenDimensions"]],
["WindDirectionWidget.Color","color","#ffffffff"],
["Waves.Enable","toggle",true],
["Waves.Distance","int",2,1,4],
["Waves.Length","float",1.5,0,2],
["Waves.Fade","float",0.8,0,1],
["Waves.Speed","int",100,0,200],
["spacer","----"],
["Cargo.CargoThreshold","int",500,0,2000],
["Cargo.PlayerCarriedWeight","toggle",true],
["Cargo.CartCarriedWeight","toggle",true],
["Cargo.PlayerWeight","toggle",true],
["Cargo.CartItem","toggle",false],
["Cargo.HorseItem","toggle",false],
["spacer","-"],
["Audio.SoundVolume","float",0.5,0,1],
["spacer","--"],
["Handling.OarMoveSpeed","float",1,0,10],
["Handling.OarMoveAcceleration","float",1,0,10],
["Handling.OarTurnSpeed","float",1,0,10],
["Handling.OarTurnAcceleration","float",1,0,10],
["Handling.SailMoveSpeed","float",1,0,10],
["Handling.SailMoveAcceleration","float",1,0,10],
["Handling.SailTurnSpeed","float",1,0,10],
["Handling.SailTurnAcceleration","float",1,0,10],
["Handling.BadTack","toggle",false],
["Handling.BadTackMultiplier","float",0.8,0,1],
["SailingAssist.AutoTrimming","toggle",true],
["SailingAssist.AutoStowSquareSails","toggle",true],
["SailingAssist.AutoStowGaffSails","toggle",true],
["Compatibility.AnimatedWaterVertexWaves","toggle",false,{"retired":true}],
["Compatibility.PersistentDungeonBoats","toggle",false],
["Map.RestrictPositionReadingTime","toggle",true,{"description":"Position can only be viewed around midday and midnight"}],
["Map.RestrictPositionReadingWeather","toggle",true,{"description":"Position can only be viewed in Sunny or Cloudy weather"}],
["Map.ClickRangeThreshold","int",5,1,10],
["Map.PositionLineThickness","int",2,0,5,{"description":"Additional pixels on each side of the position line"}],
["Map.MarkerThickness","int",2,1,5,{"description":"Additional pixels around the map marker"}],
["Map.MarkerOutlineThickness","int",2,0,5,{"description":"Thickness of the marker outline in pixels"}],
["Map.BackdropOpacity","int",50,0,100],
["Debug.ShowValues","toggle",false]
]);

/** The shipped defaults the port moves, each a DEPARTURE recorded where it is declared (systems/modSettings.js):
 *  KEEP-BOATS keeps a boat placed in a dungeon, and her hold, when the player leaves it. */
const DEPARTED = Object.freeze({ 'Compatibility.PersistentDungeonBoats': true });

test('CSA-A: every shipped key is declared - its section and name joined with a dot, its kind, range, default and options as shipped, the six descriptions the mod wrote in our own words - and nothing else is, but the port\'s Enabled', () => {
  assert.equal(DEF.title, 'Come Sail Away');
  assert.ok(!('author' in DEF), 'no author named: the game carries no credits');
  assert.equal(DEF.keys.Enabled.default, true, 'MO1: on by default');
  const shipped = [];
  let written = 0;
  // The six lines the mod wrote, each in our own words now - ours, exactly
  const PLAIN = {
    'Controls.PortLocationSearchRange': 'How many map squares away a port may be and still count as near you.',
    'Map.RestrictPositionReadingTime': 'The position reading works only near noon and near midnight.',
    'Map.RestrictPositionReadingWeather': 'The position reading works only under a clear or cloudy sky.',
    'Map.PositionLineThickness': 'How thick the red cross that marks your position is.',
    'Map.MarkerThickness': 'How large the markers you place are.',
    'Map.MarkerOutlineThickness': 'How thick the black edge around each marker is. 0 draws none.',
  };
  assert.equal(SHIPPED.filter((r) => r[0] === 'spacer').length, 4, 'four spacers, which carry no keys');
  for (const row of SHIPPED) {
    if (row[0] === 'spacer') continue;
    const [name, kind, value, a, b] = row;
    if (row.some((x) => x?.retired)) { assert.equal(DEF.keys[name], undefined, `${name}: OWN-AUDIT retired it (it named Animated Water)`); continue; }
    const description = row.find((x) => x && typeof x === 'object' && !Array.isArray(x))?.description;
    shipped.push(name);
    const d = DEF.keys[name];
    assert.ok(d, `${name} is declared`);
    switch (kind) {
      case 'toggle': assert.equal(d.default, name in DEPARTED ? DEPARTED[name] : value, name); break;
      case 'text': assert.equal(d.text, true, name); assert.equal(d.default, value, name); break;
      case 'int': assert.deepEqual([d.default, d.min, d.max, !!d.float], [value, a, b, false], name); break;
      case 'float': assert.deepEqual([d.default, d.min, d.max, d.float], [value, a, b, true], name); break;
      case 'tuple': assert.equal(d.tuple, 'float', name); assert.deepEqual([...d.default], value, name); break;
      case 'choice': assert.deepEqual([...d.options], a, name); assert.equal(d.default, value, name); break;
      case 'color': assert.equal(d.color, true, name); assert.equal(d.default, value, name); break;
      default: assert.fail(`${name}: a key kind the registry does not restate (${kind})`);
    }
    if (description) { assert.equal(d.description, PLAIN[name], `${name}: our own words in place of the mod's`); assert.notEqual(PLAIN[name], description); written += 1; }
    else assert.ok(d.description, `${name}: the port writes the line the mod left empty`);
  }
  assert.equal(written, 6, 'PortLocationSearchRange and five of Map\'s');
  assert.equal(shipped.length, 49, 'the fifty shipped, less the one OWN-AUDIT retired');
  assert.deepEqual(Object.keys(DEF.keys), ['Enabled', ...shipped], 'the registry is the table, in its order, and nothing more');
  assert.equal(modSetting(V, 'Waves.Speed'), 100);
  assert.equal(modSetting(V, 'Controls.ToggleSail'), 'Space');
});

test('CSA-A x OWN-AUDIT: BadTack, BadTackMultiplier and AutoStowGaffSails, which the mod shipped and never read, are ours and say what they do (comeSailAway/sailAssist.js) - and the boat\'s effect bundle is named as Iliac Puddle No More looks for it', () => {
  assert.deepEqual(['Handling.BadTack', 'Handling.BadTackMultiplier', 'SailingAssist.AutoStowGaffSails'].map((k) => DEF.keys[k].description), [
    'The sails lose speed the closer you sail to the wind.',
    'The share of sail speed kept when you sail close to the wind.',
    'Stow the gaff sails for you when the wind would push them back.',
  ]);
  // what Deep Waters' swim already waits for (world/deepWater/deepWaterSwim.js isBoatEffectBundle)
  assert.ok(isBoatEffectBundle("I'm On A Boat"));
});

test('CSA-A: the switch has its Features row and its online lane - a boat is the player\'s own, like a wagon, so every key is the player\'s online', () => {
  const row = FEATURES.find((f) => f.control?.vendor === V);
  assert.ok(row, 'a Features row');
  assert.equal(row.group, 'world');
  assert.equal(row.title, 'Come Sail Away', 'CREDITS-OUT: the mod\'s name alone');
  assert.equal(row.effect, 'Takes effect when the game next loads.', 'the templates merge at load');
  assert.deepEqual([...MOD_CURATED[V]], ['SailingAssist.AutoTrimming', 'Handling.BadTack', 'WindDirectionWidget.Enable', 'Waves.Enable', 'Audio.SoundVolume'], 'the four a player reaches for first, and OWN-AUDIT\'s bad tack');
  assert.ok(ONLINE_PLAYERS_OWN_MODS.includes(V));
  assert.equal(ONLINE_ROOM_MOD_KEYS[V], undefined);
  for (const key of Object.keys(DEF.keys)) assert.equal(onlineForcedModSetting(V, key, '?online=1'), undefined, `${key} is the player's online`);
});
