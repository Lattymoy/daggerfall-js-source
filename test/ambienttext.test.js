import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AMBIENT_TEXTS, AMBIENT_TEXT_SECTION, AMBIENT_TEXT_VENDOR, CLIMATE_KEYS,
  ambientTextKey, climateKey, createAmbientText, hasAmbientText,
  readAmbientTextSettings, weatherKey, weatherKeyForWeather,
  setAmbientTextHost, tickAmbientText,
} from '../src/systems/ambientText.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';
import { LOCATION_TYPES, DUNGEON_TYPES } from '../src/formats/mapsFile.js';
import { WEATHER_TYPES, weatherFlags } from '../src/world/weather.js';

// ═══ AMBIENT TEXT 1.8 - Regnier (AT1/AT2) ═════════════════════════
//
// The mod is forty lines of arithmetic around 918 lines of the
// author's prose, so the pins here are aimed at the arithmetic AND at
// the reach: a key law that cannot reach a line the author wrote is
// the same bug as a wrong interval, and only one of the two is visible
// in a diff.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const vendor = (p) => JSON.parse(read(`vendor/ambient-text/${p}`));

/** A rolls() that hands back a queued list of [0, 1) values and then
 *  throws - a test that rolls more than it planned is a test that has
 *  stopped describing the mod. */
const queue = (...vals) => {
  const q = [...vals];
  return () => {
    if (!q.length) throw new Error('rolls(): the queue ran dry - the port rolled more times than the IL does');
    return q.shift();
  };
};
/** The [0, 1) value that makes Random.Range(0, n) return `i`. */
const pick = (i, n) => (i + 0.5) / n;

const SETTINGS = { textChance: 33, stdInterval: 200, postTextInterval: 500, textDisplayTime: 3 };

function mod({ rolls, settings = SETTINGS, where = () => ({}), say = () => {}, ...rest } = {}) {
  return createAmbientText({ settings: () => settings, rolls, where, say, ...rest });
}

// ── The vendored files, and the port's restatement of them ─────────

test('AT0: the settings entry IS the mod’s modsettings - section, names, bounds and defaults', () => {
  const ship = vendor('modsettings.json');
  assert.equal(ship.Sections.length, 1, 'the mod ships one section');
  assert.equal(ship.Sections[0].Name, AMBIENT_TEXT_SECTION);
  const keys = MOD_SETTINGS[AMBIENT_TEXT_VENDOR].keys;
  // Derived from the shipped file, so a hand-typed bound cannot drift:
  // every key the mod ships is restated with ITS numbers.
  for (const k of ship.Sections[0].Keys) {
    const here = keys[k.Name];
    assert.ok(here, `modsettings ships ${k.Name} and the port does not carry it`);
    assert.equal(here.default, k.Value, `${k.Name}: default`);
    assert.equal(here.min, k.Min, `${k.Name}: min`);
    assert.equal(here.max, k.Max, `${k.Name}: max`);
    assert.equal(here.description, k.Description, `${k.Name}: the description is the author’s, verbatim`);
  }
  // ...and the port carries NOTHING the mod does not, beyond its own
  // Enabled (DFU enables a mod by listing it; the port has no list).
  const shipped = new Set(ship.Sections[0].Keys.map((k) => k.Name));
  for (const k of Object.keys(keys)) {
    assert.ok(k === 'Enabled' || shipped.has(k), `the port invented a switch the mod has no key for: ${k}`);
  }
  assert.equal(keys.Enabled.default, true, 'MO1: every mod ships enabled');
});

test('AT1: LoadSettings reads the mod’s four keys, and `interval` lands in stdInterval', () => {
  // IL 0x5a20: GetInt("AmbientText", "textChance"/"interval"/
  // "postTextInterval"/"textDisplayTime"). The field the mod calls
  // `stdInterval` is the setting it calls `interval`, and the pane
  // shows the player the author's name for it.
  const s = readAmbientTextSettings((k) => ({ textChance: 7, interval: 61, postTextInterval: 599, textDisplayTime: 9 })[k]);
  assert.deepEqual(s, { textChance: 7, stdInterval: 61, postTextInterval: 599, textDisplayTime: 9 });
});

test('AT1: the vendored table is the mod’s own, unrewritten', () => {
  const ship = vendor('ambientTexts.json');
  assert.equal(Object.keys(ship).length, 918, 'the bundle carries 918 lines');
  assert.deepEqual(Object.keys(AMBIENT_TEXTS).sort(), Object.keys(ship).sort(), 'the module reads the vendored file');
  assert.equal(AMBIENT_TEXTS.NoneDesert0, 'Your feet slide in the sand.');
  assert.equal(AMBIENT_TEXTS.Crypt0, ship.Crypt0);
  // Every value is a real line - the mod's IsNullOrWhiteSpace arm is a
  // guard, not a feature of the table.
  for (const [k, v] of Object.entries(AMBIENT_TEXTS)) {
    assert.equal(typeof v, 'string', `${k} is not a line`);
    assert.ok(v.trim().length, `${k} is blank`);
  }
});

// ── THE REACH: the key law against the author's own keys ───────────

test('AT1: EVERY line in the table is reachable by the key the mod builds', () => {
  // THE PIN THAT MATTERS. A key law that cannot spell one of the
  // author's 918 keys does not crash and does not show in a diff - it
  // just silently never says that line. So the reachable set is
  // GENERATED from ambientTextKey over every input it can be handed,
  // and the table must fit inside it. Change a separator, drop the
  // climate tail, mis-spell an enum name, and this goes red naming the
  // lines that fell out of reach.
  const reachable = new Set();
  for (const dungeonType of Object.values(DUNGEON_TYPES)) {
    for (let index = 0; index < 10; index++) reachable.add(ambientTextKey({ insideDungeon: true, dungeonType, index }));
  }
  for (const locationType of Object.values(LOCATION_TYPES)) {
    for (const inLocationRect of [true, false]) {
      for (const climateIndex of [223, ...Array.from({ length: 9 }, (_, i) => 224 + i)]) {
        for (const isDay of [true, false]) {
          for (const weather of WEATHER_TYPES) {
            for (let tail = 0; tail < 3; tail++) {
              for (let index = 0; index < 10; index++) {
                reachable.add(ambientTextKey({ inLocationRect, locationType, climateIndex, isDay, weather, tail, index }));
              }
            }
          }
        }
      }
    }
  }
  const lost = Object.keys(AMBIENT_TEXTS).filter((k) => !reachable.has(k));
  assert.deepEqual(lost, [], 'these lines the author wrote can never be said:');
});

test('AT1: the table is SPARSE, and the port does not fill it', () => {
  // 233 families x 10 would be 2330; there are 918. The gaps ARE the
  // author's frequency curve - a family with one line speaks rarely.
  // A port that picked "from the keys that exist" would flatten it.
  const families = new Set(Object.keys(AMBIENT_TEXTS).map((k) => k.replace(/\d$/, '')));
  assert.equal(families.size, 233);
  assert.ok(Object.keys(AMBIENT_TEXTS).length < families.size * 10, 'the table is no longer sparse - did something fill it?');
  assert.equal(hasAmbientText('ReligionTempleDay0'), true);
  assert.equal(hasAmbientText('HomeYourShipsDayCloudy0'), false, 'a family the author left short must stay short');
  // ...and the miss is answered with silence, not a neighbour.
  const m = mod({ rolls: queue(pick(4, 10), pick(2, 3)), where: () => ({ inLocationRect: true, locationType: LOCATION_TYPES.HomeYourShips, isDay: true, weather: 'overcast' }) });
  assert.equal(m.selectAmbientText(), null);
});

// ── ClimateKey, WeatherKey ─────────────────────────────────────────

test('AT1: ClimateKey is the switch over CurrentClimateIndex - 224, Ocean the default', () => {
  // IL 0x5d78's nine arms, in order. MapsFile.Climates starts at Ocean
  // 223, so Ocean is NOT an arm - it falls through with everything else.
  assert.deepEqual([...CLIMATE_KEYS],
    ['Desert', 'Desert', 'Mountains', 'Swamp', 'Swamp', 'Desert', 'Woods', 'Woods', 'Woods']);
  assert.deepEqual(Array.from({ length: 9 }, (_, i) => climateKey(224 + i)), [...CLIMATE_KEYS]);
  assert.equal(climateKey(223), 'Ocean', 'Ocean is the DEFAULT arm, one below the subtrahend');
  assert.equal(climateKey(233), 'Ocean', 'and so is anything above the ninth');
  assert.equal(climateKey(0), 'Ocean');
  assert.equal(climateKey(-1), 'Ocean', 'a negative offset must not index backwards into the table');
});

test('AT1: WeatherKey is an if/else ladder, and its order is what makes a storm Rainy', () => {
  // IL 0x5d20: Clear, then raining||storming -> Rainy, then snowing ->
  // Snowy, then overcast -> Cloudy. A storm is ALSO overcast, so the
  // order is load-bearing.
  assert.equal(weatherKey({ raining: true, storming: true, snowing: false, overcast: true }), 'Rainy');
  assert.equal(weatherKey({ raining: false, storming: true, snowing: false, overcast: true }), 'Rainy', 'storming alone still reads Rainy');
  assert.equal(weatherKey({ raining: false, storming: false, snowing: true, overcast: true }), 'Snowy', 'snow is ALSO overcast - Snowy wins');
  assert.equal(weatherKey({ raining: false, storming: false, snowing: false, overcast: true }), 'Cloudy');
  assert.equal(weatherKey({ raining: false, storming: false, snowing: false, overcast: false }), 'Clear');
});

test('AT1: the port’s weather words reach WeatherKey through SetWeather’s own flags', () => {
  // WeatherManager.cs:442-473 is the derivation: what a word leaves set
  // is what the mod reads. Two of these look wrong and are not.
  assert.equal(weatherKeyForWeather('sunny'), 'Clear');
  assert.equal(weatherKeyForWeather('cloudy'), 'Clear', 'DFU’s Cloudy case is a literal TODO and sets no flag');
  assert.equal(weatherKeyForWeather('overcast'), 'Cloudy');
  assert.equal(weatherKeyForWeather('fog'), 'Cloudy', 'SetRainOvercast picks a RAIN SKY and sets IsOvercast; IsRaining is StartRaining’s alone');
  assert.equal(weatherKeyForWeather('rain'), 'Rainy');
  assert.equal(weatherKeyForWeather('thunder'), 'Rainy');
  assert.equal(weatherKeyForWeather('snow'), 'Snowy');
  assert.equal(weatherKeyForWeather('sandstorm'), 'Cloudy', 'WEATHER2d’s own eighth word - DFU has no case, and the port answers overcast once');
  // Every word the port can be in answers with one of the mod's four.
  for (const w of WEATHER_TYPES) assert.ok(['Clear', 'Rainy', 'Snowy', 'Cloudy'].includes(weatherKeyForWeather(w)), w);
  assert.equal(weatherFlags('thunder').storming, true);
  assert.equal(weatherFlags('fog').raining, false);
});

// ── SelectAmbientText ──────────────────────────────────────────────

test('AT1: underground the key is the DUNGEON’s type and nothing else', () => {
  assert.equal(ambientTextKey({ insideDungeon: true, dungeonType: DUNGEON_TYPES.Crypt, index: 0 }), 'Crypt0');
  assert.equal(ambientTextKey({ insideDungeon: true, dungeonType: DUNGEON_TYPES.VolcanicCaves, index: 9 }), 'VolcanicCaves9');
  // The location, the hour and the sky are not consulted at all.
  assert.equal(
    ambientTextKey({ insideDungeon: true, dungeonType: DUNGEON_TYPES.Cemetery, index: 4, inLocationRect: true, locationType: LOCATION_TYPES.TownCity, isDay: false, weather: 'snow', tail: 2 }),
    'Cemetery4');
  // C#'s enum.ToString() prints the NUMBER for a value the enum does
  // not declare, and the key simply misses. That is the mod's, not a hole.
  assert.equal(ambientTextKey({ insideDungeon: true, dungeonType: 99, index: 1 }), '991');
});

test('AUDIT AT F1: underground the TAIL ROLL IS NEVER SPENT - the dungeon arm skips it', () => {
  // The dungeon arm (IL_002e..IL_005d) formats its key and jumps
  // straight to Contains at IL_013b; `Random.Range(0, 3)` is at
  // IL_00ad, inside the ELSE branch. The port rolled it either way -
  // invisible under Math.random, and still a different number of draws
  // from the same stream, which is the thing a seeded replay counts.
  //
  // Pinned by the QUEUE, which throws when something rolls more than it
  // planned: underground the mod gets exactly ONE roll (the index), and
  // above ground exactly two (the index and the tail).
  const under = mod({ rolls: queue(pick(3, 10)), where: () => ({ insideDungeon: true, dungeonType: DUNGEON_TYPES.Crypt }) });
  assert.equal(under.selectAmbientText(), AMBIENT_TEXTS.Crypt3, 'one roll underground, and it is the index');
  const over = mod({ rolls: queue(pick(3, 10), pick(0, 3)), where: () => ({ inLocationRect: false, climateIndex: 224 }) });
  assert.equal(over.selectAmbientText(), AMBIENT_TEXTS.NoneDesert3, 'two above ground - the index and the tail');
  // ...and the miss path spends the same rolls as the hit path, because
  // the roll sits above the Contains test in both.
  const missUnder = mod({ rolls: queue(pick(3, 10)), where: () => ({ insideDungeon: true, dungeonType: 99 }) });
  assert.equal(missUnder.selectAmbientText(), null, 'a dungeon type the enum does not declare still spends one roll and no more');
});

test('AT1: above ground the family is the location rect’s type, and the tail roll picks the register', () => {
  const where = { inLocationRect: true, locationType: LOCATION_TYPES.TownVillage, climateIndex: 231, isDay: false, weather: 'rain' };
  assert.equal(ambientTextKey({ ...where, tail: 0, index: 2 }), 'TownVillageWoods2');
  assert.equal(ambientTextKey({ ...where, tail: 1, index: 2 }), 'TownVillageNight2');
  assert.equal(ambientTextKey({ ...where, tail: 2, index: 2 }), 'TownVillageNightRainy2');
  assert.equal(ambientTextKey({ ...where, isDay: true, tail: 1, index: 7 }), 'TownVillageDay7');
});

test('AT1: the tail roll spans all THREE registers - Random.Range(0, 3), not two', () => {
  // The three arms above are pinned with `tail` handed in; this pins
  // the ROLL that picks it, which is a different law. A roll near 1
  // must reach the time-and-weather form, and a roll at 0 the climate.
  const where = () => ({ inLocationRect: true, locationType: LOCATION_TYPES.TownCity, climateIndex: 224, isDay: true, weather: 'rain' });
  const one = (tailRoll) => mod({ rolls: queue(pick(2, 10), tailRoll), where }).selectAmbientText();
  assert.ok(AMBIENT_TEXTS.TownCityDesert2 && AMBIENT_TEXTS.TownCityDay2 && AMBIENT_TEXTS.TownCityDayRainy2, 'the three fixtures are lines the author wrote');
  assert.equal(one(0.0), AMBIENT_TEXTS.TownCityDesert2, 'roll 0 -> the climate');
  assert.equal(one(0.5), AMBIENT_TEXTS.TownCityDay2, 'roll 0.5 -> the hour');
  assert.equal(one(0.999), AMBIENT_TEXTS.TownCityDayRainy2, 'roll 0.999 -> the hour AND the sky; a Range(0, 2) can never get here');
});

test('AT1: outside every location rect the family is None - the map pixel’s location is NOT consulted', () => {
  // IsPlayerInLocationRect is the gate (IL_0070). A player standing on
  // a pixel that carries a city, but outside its rect, is in open
  // country and gets `None` - which is DFRegion.LocationTypes.None,
  // 0xffff, and spells itself "None" because the enum declares it.
  assert.equal(LOCATION_TYPES.None, 0xffff);
  assert.equal(ambientTextKey({ inLocationRect: false, locationType: LOCATION_TYPES.TownCity, climateIndex: 224, tail: 0, index: 0 }), 'NoneDesert0');
  assert.equal(ambientTextKey({ inLocationRect: true, locationType: LOCATION_TYPES.TownCity, climateIndex: 224, tail: 0, index: 0 }), 'TownCityDesert0');
});

test('AT1: lastIndex is written ONLY on a hit, so a run of misses does not narrow the next roll', () => {
  // IL_0148 sits INSIDE the Contains arm. The do/while refuses the
  // index that last SPOKE, not the index last rolled.
  const hit = { inLocationRect: false, climateIndex: 224 };            // NoneDesert*
  const miss = { inLocationRect: true, locationType: LOCATION_TYPES.HomeYourShips, isDay: true, weather: 'overcast' };
  let where = miss;
  const m = mod({ rolls: queue(pick(3, 10), pick(2, 3), pick(3, 10), pick(0, 3)), where: () => where });
  assert.equal(m.state.lastIndex, -1, '.ctor: lastIndex starts at -1, so the first roll can be anything');
  assert.equal(m.selectAmbientText(), null);
  assert.equal(m.state.lastIndex, -1, 'a miss leaves it alone');
  where = hit;
  assert.equal(m.selectAmbientText(), AMBIENT_TEXTS.NoneDesert3, 'and 3 is still available after the miss rolled it');
  assert.equal(m.state.lastIndex, 3);
});

test('AT1: the do/while re-rolls until the index differs from the one that last spoke', () => {
  const where = () => ({ inLocationRect: false, climateIndex: 224 });   // NoneDesert*
  // First: index 5 (a line the author wrote), tail 0 -> NoneDesert5.
  // Then: 5 refused twice, 6 accepted.
  const m = mod({ rolls: queue(pick(5, 10), pick(0, 3), pick(5, 10), pick(5, 10), pick(6, 10), pick(0, 3)), where });
  assert.equal(m.selectAmbientText(), AMBIENT_TEXTS.NoneDesert5);
  assert.equal(m.state.lastIndex, 5);
  assert.equal(m.selectAmbientText(), AMBIENT_TEXTS.NoneDesert6);
  assert.equal(m.state.lastIndex, 6);
});

// ── Update ─────────────────────────────────────────────────────────

const outside = () => ({ inLocationRect: false, climateIndex: 224 });

/** Start, then a tick at `t`. `rolls` covers the chance roll, the
 *  index and the tail, in that order. */
function running(opts = {}) {
  const m = mod({ where: outside, ...opts });
  m.update(0);           // the first update arms the clock (Start)
  return m;
}

test('AT2: Start arms the clock, so the earliest line is one whole interval in', () => {
  const said = [];
  const m = running({ rolls: queue(0, pick(1, 10), pick(0, 3)), say: (t, s) => said.push([t, s]) });
  assert.equal(m.state.tickTimeInterval, 200, 'Start sets tickTimeInterval = stdInterval');
  assert.equal(m.update(200), null, 'the comparison is STRICTLY greater - 200 is not yet past 200');
  assert.deepEqual(said, []);
  assert.equal(m.update(200.001), AMBIENT_TEXTS.NoneDesert1);
  assert.deepEqual(said, [[AMBIENT_TEXTS.NoneDesert1, 3]], 'AddHUDText(text, textDisplayTime)');
});

test('AT2: a line arms the POST-TEXT interval, and a silent tick re-arms the standard one', () => {
  const m = running({ rolls: queue(0, pick(1, 10), pick(0, 3), 0.99) });
  assert.ok(m.update(201));
  assert.equal(m.state.tickTimeInterval, 500, 'postTextInterval');
  assert.equal(m.update(500), null, 'and the next tick is 500 away, not 200');
  assert.equal(m.update(702), null, 'the chance roll failed');
  assert.equal(m.state.tickTimeInterval, 200, 'a tick that said nothing re-arms stdInterval');
});

test('AT2: the chance roll is Dice100.SuccessRoll(textChance) - floor(roll * 100) < chance', () => {
  const at = (roll) => running({ rolls: queue(roll, pick(1, 10), pick(0, 3)) }).update(201);
  assert.ok(at(0.32), '32 < 33');
  assert.equal(at(0.33), null, '33 is not < 33');
  assert.equal(at(0.999), null);
});

test('AT2: inside a building the mod returns BEFORE the clock, so the interval keeps running', () => {
  // IL_002d jumps to the method's `ret` without touching lastTickTime.
  // Step out of a shop after an hour and the world greets you on the
  // first frame - that is the mod's, and it is why the port's `enabled`
  // gate returns the same way rather than resetting the clock.
  let inside = true;
  const m = mod({ rolls: queue(0, pick(1, 10), pick(0, 3)), where: outside, insideBuilding: () => inside });
  m.update(0);
  assert.equal(m.update(3600), null, 'an hour indoors says nothing');
  assert.equal(m.state.lastTickTime, 0, 'and banks the whole hour');
  inside = false;
  assert.equal(m.update(3600.001), AMBIENT_TEXTS.NoneDesert1, 'the first frame outside speaks');
});

test('AUDIT AT F5: a quiet frame reads ONE flag - the world is not rebuilt to learn a boolean', () => {
  // DFU's Update reads `pee.IsPlayerInsideBuilding` (IL_0028) and asks
  // PlayerGPS nothing until SelectAmbientText. The port had that flag
  // as a field of `where()`, so every quiet frame of the shipping host
  // paid for a location-rect test, a CLIMATE.PAK lookup, the weather
  // word and the hour to learn it - measured at 100 builds per 100
  // frames. Pinned by COUNT, from both sides: the cheap reader runs
  // every frame, and the context is built only when a key is.
  let flags = 0, worlds = 0;
  const m = mod({
    rolls: queue(0, pick(1, 10), pick(0, 3)),
    insideBuilding: () => { flags++; return false; },
    where: () => { worlds++; return outside(); },
  });
  m.update(0);
  for (let i = 1; i <= 100; i++) m.update(i / 60);   // 100 quiet frames - no interval crossed
  assert.equal(worlds, 0, 'a quiet frame must not build the world');
  assert.equal(flags, 100, 'and must read the one flag, every frame, as DFU does');
  assert.ok(m.update(201), 'the tick that speaks');
  assert.equal(worlds, 1, 'the world is built ONCE, where the key is');
});

test('AUDIT AT F6: Start is a lifecycle call - the port\u2019s own switch must not gate it', () => {
  // A game booted with the mod OFF armed no clock, so turning it on
  // started one from that moment and the first line came a whole
  // interval later - while a game booted with it ON, toggled off and
  // back, spoke at once. One switch, two behaviours, decided by
  // history. DFU has no such switch: a mod that is off was never
  // loaded, and `Start` runs the moment the component exists.
  let on = false;
  const m = mod({ rolls: queue(0, pick(1, 10), pick(0, 3)), where: outside, enabled: () => on });
  m.update(0);
  assert.equal(m.state.started, true, 'the clock is armed by the HOST claiming it, not by the switch');
  assert.equal(m.state.lastTickTime, 0);
  assert.equal(m.update(3600), null, 'off says nothing');
  on = true;
  assert.equal(m.update(3600.001), AMBIENT_TEXTS.NoneDesert1,
    'and the clock that ran while it was off is the clock it comes back to - "takes effect at once", both ways round');
});

test('AT2: a paused game and an unclaimed host both say nothing, and neither spends a roll', () => {
  const m = mod({ rolls: queue(), where: outside, paused: () => true });
  m.update(0);
  assert.equal(m.update(9999), null);
  const n = mod({ rolls: queue(), where: outside, ready: () => false });
  n.update(0);
  assert.equal(n.update(9999), null);
  const off = mod({ rolls: queue(), where: outside, enabled: () => false });
  off.update(0);
  assert.equal(off.update(9999), null);
});

test('AT2: a blank line is treated as no line - IsNullOrWhiteSpace, and the post-text interval is NOT armed', () => {
  // The author's own table carries no blank line (pinned above), so the
  // guard is driven through the `texts` seam - the static Hashtable a
  // test cannot otherwise reach.
  const blank = createAmbientText({
    settings: () => SETTINGS, where: outside, texts: { NoneDesert1: '   ' },
    rolls: queue(0, pick(1, 10), pick(0, 3)),
    say: () => { throw new Error('a blank line reached the HUD'); },
  });
  blank.update(0);
  assert.equal(blank.update(201), null);
  assert.equal(blank.state.tickTimeInterval, 200, 'the POST-TEXT interval is armed by a SAID line, not by a rolled one');
  assert.equal(blank.state.lastIndex, 1, 'though the roll HIT the table, so lastIndex moved - the guard is downstream of Contains');
});

test('AUDIT AT F3: WeatherManager\u2019s four flags have ONE derivation, and it has more than one reader', () => {
  // ONE DFU MEMBER, ONE EXPORT. AT1 wrote `weatherFlags` for this mod's
  // WeatherKey and its record said the Daedra-summoning arm's inline
  // pair had been folded into it. IT HAD NOT - the arm kept spelling
  // `{ raining: sky === rain, storming: sky === thunder }` off the
  // weather enum, so the tree carried two readings of the same DFU
  // member and the Ledger said it carried one. The audit paid it.
  //
  // Derived, not listed: any module that builds an object with these
  // key names is deriving the flags a second time, wherever it lives.
  const files = [];
  const walk = (dir) => {
    for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
      if (e.isDirectory()) walk(`${dir}/${e.name}`);
      else if (e.name.endsWith('.js')) files.push(`${dir}/${e.name}`);
    }
  };
  walk('src');
  const second = files.filter((f) => f !== 'src/world/weather.js')
    .filter((f) => /\b(raining|storming|snowing)\s*:\s*[^,}\n]*(WEATHER_ENUM|'rain'|'thunder'|'snow'|=== *rain|=== *thunder)/.test(read(f)));
  assert.deepEqual(second, [], 'these derive WeatherManager\u2019s flags a second time - read world/weather.js weatherFlags instead:');
  // ...and the one home is not a home with nobody in it.
  const readers = files.filter((f) => f !== 'src/world/weather.js' && /weatherFlags\(/.test(read(f)));
  assert.ok(readers.length >= 2, `weatherFlags has ${readers.length} reader(s) - the extraction only pays once something else reads it`);
  assert.ok(readers.includes('src/scenes/worldModes.js'), 'the summoning arm is not reading the one home');
  assert.ok(readers.includes('src/systems/ambientText.js'), 'WeatherKey is not reading the one home');
});

// ── THE SHIPPED SINGLETON ──────────────────────────────────────────

test('AUDIT AT F-SING: the SHIPPED mod runs - the slot, the tick and the HUD, driven', () => {
  // THE HOLE THIS PIN EXISTS FOR. Every pin above builds its own
  // component with `createAmbientText`; the thing a player actually
  // gets is the module-level singleton behind `setAmbientTextHost` and
  // `tickAmbientText`, and NOTHING drove it. Two mutations proved the
  // cost: `tickAmbientText = () => null` and the singleton's `say`
  // rewritten to a no-op both left all 21 pins green - the mod could
  // be completely dead in the shipping build and the gate would say so
  // was fine. The hosts were pinned by their SOURCE TEXT, which cannot
  // tell a wired seam from a spelled one.
  //
  // So this drives the real one, end to end: a host claims the slot,
  // the tick runs on the wall clock the shipped path uses, and a line
  // the author wrote comes back out of the host's own `say`.
  const said = [];
  let inside = false;
  setAmbientTextHost({
    paused: () => false,
    insideBuilding: () => inside,
    say: (text, seconds) => said.push([text, seconds]),
    where: () => ({ insideDungeon: true, dungeonType: DUNGEON_TYPES.Crypt }),
  });
  try {
    // The first tick is Start; nothing is said and the clock is armed
    // AT that timestamp, whatever the wall clock happens to read.
    assert.equal(tickAmbientText(0), null, 'Start says nothing');
    // The mod ships textChance 33, interval 200. Drive enough intervals
    // that the chance roll cannot plausibly miss every one: 400 ticks at
    // 33% is a miss run of 400, which is ~1 in 10^70.
    let t = 0;
    for (let i = 0; i < 400; i++) { t += 201; tickAmbientText(t); }
    assert.ok(said.length > 0, 'the SHIPPED tick never reached the SHIPPED HUD seam');
    for (const [text, seconds] of said) {
      assert.equal(typeof text, 'string');
      assert.ok(text.trim().length, 'a blank line reached the HUD');
      assert.ok(Object.values(AMBIENT_TEXTS).includes(text), 'the line is one the author wrote');
      assert.match(text, /^\w/, 'and it is prose, not a key');
      assert.equal(seconds, MOD_SETTINGS[AMBIENT_TEXT_VENDOR].keys.textDisplayTime.default,
        'AddHUDText carries the mod\u2019s own textDisplayTime');
    }
    // Underground the family is the dungeon's, so every line said above
    // must be a Crypt line - the singleton really is reading the host's
    // `where`, not a default.
    for (const [text] of said) {
      const keys = Object.keys(AMBIENT_TEXTS).filter((k) => AMBIENT_TEXTS[k] === text);
      assert.ok(keys.some((k) => /^Crypt\d$/.test(k)), `"${text}" is not a Crypt line - the host's where() is not being read`);
    }
    // ...and the building flag really silences the shipped path.
    const before = said.length;
    inside = true;
    for (let i = 0; i < 200; i++) { t += 201; tickAmbientText(t); }
    assert.equal(said.length, before, 'the shipped tick speaks inside a building');
  } finally {
    setAmbientTextHost(null);
  }
  // An unclaimed slot is silent and costs nothing.
  assert.equal(tickAmbientText(1e9), null, 'a released slot still speaks');
});

// ── THE FOUR HOSTS ─────────────────────────────────────────────────

test('AT2: the mod is ONE component, ticked by whoever owns the outermost motor - and all four hosts are named', () => {
  // THE FOUR HOSTS RULE: exterior.js, world.js, worldModes.js
  // (interiors), dungeonContext.js. Two are wired, two are deliberately
  // not, and the reason must be ON RECORD rather than inferred from a
  // missing line.
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const src = read(host);
    assert.match(src, /setAmbientTextHost\(\{/, `${host}: does not claim the mod`);
    // The tick is ABOVE the modal gate - the same law the holiday text
    // keeps - so ONE call covers exterior, interior and dungeon mode.
    const tick = src.indexOf('tickAmbientText();');
    const modal = src.indexOf('if (modes.frame(dt, now)) {');
    assert.ok(tick > 0 && modal > 0, `${host}: the tick or the modal gate moved`);
    assert.ok(tick < modal, `${host}: the tick fell BELOW the modal gate - interiors and dungeons would stop it`);
    assert.match(src, /dungeonType: inside\.dungeonType/, `${host}: the dungeon half of the key is not fed`);
    // AUDIT AT F5: the flag is its own reader off the mode, not a field
    // of the context - a quiet frame must not build the world.
    assert.match(src, /insideBuilding: \(\) => _mode\(\) === 'interior',/, `${host}: the one-flag reader is gone`);
    assert.doesNotMatch(src, /insideBuilding: inside\.insideBuilding/, `${host}: insideBuilding is back inside the context build`);
  }
  // The interior host and the dungeon host are NOT wired, by derivation:
  // neither owns the outermost motor.
  for (const host of ['src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) {
    assert.doesNotMatch(read(host), /tickAmbientText|setAmbientTextHost/,
      `${host}: a SECOND Update. The mod has one, and the host above this one already ran it this frame.`);
  }
  // ...and the standalone ?dungeon probe DOES own it, so it claims and ticks.
  const dungeon = read('src/scenes/dungeon.js');
  assert.match(dungeon, /tickAmbientText\(\);/);
  // Aimed INSIDE the claim, not at the file: this host says
  // `insideDungeon: true` twice for two different reasons, and a pin
  // that cannot tell them apart pins neither.
  const claim = dungeon.slice(dungeon.indexOf('setAmbientTextHost({'), dungeon.indexOf('const _frameToken'));
  assert.ok(claim.length > 20 && claim.length < 2000, 'the claim block moved');
  assert.match(claim, /insideDungeon: true/, 'the probe scene is always underground');
  assert.match(claim, /insideBuilding: \(\) => false/, 'AUDIT AT F5: the flag is its own reader, not a field of the context');
  assert.match(claim, /dungeonType: dfLocation\?\.mapTableData\?\.dungeonType \?\? 255/);
  // The interior host is the ONE seam both exterior hosts read the
  // dungeon type through (PlayerEnterExit.Dungeon.Summary.DungeonType).
  assert.match(read('src/scenes/worldModes.js'),
    /dungeonType: mode === 'dungeon' \? \(host\.currentLocation\?\.\(\)\?\.mapTableData\?\.dungeonType \?\? 255\) : 255/);
  // The HUD seam carries the mod's per-line display time.
  assert.match(read('src/scenes/dungeonContext.js'), /hudSay: \(t, delayInSeconds = undefined\) => hudText\.add\(t, delayInSeconds\)/);
});
