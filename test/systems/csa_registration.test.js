// CSA-A (2026-09-27) - COME SAIL AWAY 2.1 (RedRoryOTheGlen), THE
// REGISTRATION against the shipped files (vendor/come-sail-away/, the
// bundle's text assets verbatim and its assembly byte for byte): the
// manifest, the settings restated key for key, the three keys the assembly
// never names, the item templates as DFU's parser reads them, and the
// switch's Features row, credit and online lane.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { MOD_SETTINGS, modSetting } from '../../src/systems/modSettings.js';
import { FEATURES, MOD_CURATED } from '../../src/systems/features.js';
import { CREDITS } from '../../src/ui/credits.js';
import { ONLINE_PLAYERS_OWN_MODS, ONLINE_ROOM_MOD_KEYS, onlineForcedModSetting } from '../../src/systems/online/onlineLane.js';
import { userStrings } from '../../tools/lib/clrUserStrings.mjs';

const V = 'come-sail-away';
const DIR = new URL('../../vendor/come-sail-away/', import.meta.url);
const bytes = (f) => readFileSync(new URL(f, DIR));
const text = (f) => bytes(f).toString('utf8');
const DEF = MOD_SETTINGS[V];

/** The shipped modsettings.json's sections, keys in file order. */
const SHIPPED = JSON.parse(text('modsettings.json')).Sections;
const kind = (k) => k.$type.split(',')[0].split('.').pop();

test('CSA-A: the vendored manifest is the bundle\'s own - the title, version, author, DFU version, GUID and the 336 files it was built from', () => {
  const mf = JSON.parse(text('come-sail-away.dfmod.json'));
  assert.equal(mf.ModTitle, 'Come Sail Away');
  assert.equal(mf.ModVersion, '2.1');
  assert.equal(mf.ModAuthor, 'RedRoryOTheGlen');
  assert.equal(mf.DFUnity_Version, '1.1.1');
  assert.equal(mf.GUID, 'dbe3e8ff-9059-45f1-a8be-732bb6000df7');
  assert.equal(mf.ModDescription, 'Adds a usable boat and sailing mechanics.');
  assert.equal(mf.Files.length, 336);
  assert.deepEqual(mf.Files.filter((f) => f.endsWith('.cs')).map((f) => f.split('/').pop()).sort(),
    ['ApplyGameTextures.cs', 'ComeSailAway.cs', 'FixSkinnedNormals.cs', 'ItemBoatDeed.cs', 'ItemBoatParts.cs', 'RudderAnimationEventListener.cs', 'WaterWalkingSilent.cs']);
  assert.equal(createHash('sha256').update(bytes('Come Sail Away.dll')).digest('hex'),
    '5ffe546383201ec9faf1442f521599122fd33103cfc0ec8acbffc10354e2bdf5', 'the assembly is the bundle\'s, byte for byte');
});

/** The shipped defaults the port moves, each a DEPARTURE recorded where it is declared (systems/modSettings.js):
 *  KEEP-BOATS (2026-09-30) keeps a boat placed in a dungeon, and her hold, when the player leaves it. */
const DEPARTED = Object.freeze({ 'Compatibility.PersistentDungeonBoats': true });

test('CSA-A: every shipped key is declared - its section and name joined with a dot, its kind, range, default and options as shipped, the six descriptions the mod wrote verbatim - and nothing else is, but the port\'s Enabled (mutants: a default moved, a key dropped)', () => {
  assert.equal(DEF.title, 'Come Sail Away');
  assert.equal(DEF.author, 'RedRoryOTheGlen');
  assert.equal(DEF.keys.Enabled.default, true, 'MO1: on by default');
  const shipped = [];
  let written = 0;
  // PLAIN-TEXT (2026-10-19): the one line of the mod's that spoke of "the player", said to the player - its words, exactly
  const PLAIN = { 'Controls.PortLocationSearchRange': 'How far from you a port can be found' };
  for (const s of SHIPPED) {
    if (/^-+$/.test(s.Name)) { assert.equal(s.Keys.length, 0, `the spacer "${s.Name}" carries no keys`); continue; }
    for (const k of s.Keys) {
      const name = `${s.Name}.${k.Name}`;
      shipped.push(name);
      const d = DEF.keys[name];
      assert.ok(d, `${name} is declared`);
      switch (kind(k)) {
        case 'ToggleKey': assert.equal(d.default, name in DEPARTED ? DEPARTED[name] : k.Value, name); break;
        case 'TextKey': assert.equal(d.text, true, name); assert.equal(d.default, k.Value, name); break;
        case 'SliderIntKey': assert.deepEqual([d.default, d.min, d.max, !!d.float], [k.Value, k.Min, k.Max, false], name); break;
        case 'SliderFloatKey': assert.deepEqual([d.default, d.min, d.max, d.float], [k.Value, k.Min, k.Max, true], name); break;
        case 'TupleFloatKey': assert.equal(d.tuple, 'float', name); assert.deepEqual([...d.default], [k.Value.First, k.Value.Second], name); break;
        case 'MultipleChoiceKey': assert.deepEqual([...d.options], k.Options, name); assert.equal(d.default, k.Value, name); break;
        case 'ColorKey': {
          const hex = [k.Value.r, k.Value.g, k.Value.b, k.Value.a].map((c) => c.toString(16).padStart(2, '0')).join('');
          assert.equal(d.color, true, name); assert.equal(d.default, `#${hex}`, name); break;
        }
        default: assert.fail(`${name}: a key kind the registry does not restate (${kind(k)})`);
      }
      if (k.Description) { assert.equal(d.description, PLAIN[name] ?? k.Description, `${name}: the mod's own words, or their plain rewording`); written += 1; }
      else assert.ok(d.description, `${name}: the port writes the line the mod left empty`);
    }
  }
  assert.equal(written, 6, 'PortLocationSearchRange and five of Map\'s');
  assert.equal(shipped.length, 50);
  assert.deepEqual(Object.keys(DEF.keys), ['Enabled', ...shipped], 'the registry is the file, in the file\'s order, and nothing more');
  assert.equal(modSetting(V, 'Waves.Speed'), 100);
  assert.equal(modSetting(V, 'Controls.ToggleSail'), 'Space');
});

test('CSA-A: the assembly names every section and every key it reads - and never BadTack, BadTackMultiplier or AutoStowGaffSails, which ship and do nothing (its #US heap: an ldstr is the only way a method names a string)', () => {
  const heap = new Set(userStrings(bytes('Come Sail Away.dll')));
  assert.ok(heap.size > 200, `the heap read (${heap.size} strings)`);
  const UNREAD = ['Handling.BadTack', 'Handling.BadTackMultiplier', 'SailingAssist.AutoStowGaffSails'];
  for (const s of SHIPPED) {
    if (!s.Keys.length) continue;
    assert.ok(heap.has(s.Name), `the assembly names the section ${s.Name}`);
    for (const k of s.Keys) {
      const name = `${s.Name}.${k.Name}`;
      assert.equal(heap.has(k.Name), !UNREAD.includes(name), `${name} ${UNREAD.includes(name) ? 'is never named' : 'is named'}`);
    }
  }
  for (const k of UNREAD) assert.equal(DEF.keys[k].description, 'Has no effect: the mod never uses this setting.', `${k} says so`);
  // what Deep Waters' swim already waits for (world/deepWater/deepWaterSwim.js isBoatEffectBundle)
  assert.ok(heap.has('I\'m On A Boat'), 'the boat\'s effect bundle is named as Iliac Puddle No More looks for it');
});

test('CSA-A: the item templates are the bundle\'s text verbatim, trailing comma and all - DFU\'s parser takes it (fsJsonParser stops at the bracket after one comma), a strict one does not', () => {
  const raw = text('ItemTemplates.json');
  assert.throws(() => JSON.parse(raw), SyntaxError, 'the author\'s comma is kept');
  const rows = JSON.parse(raw.replace(/,(\s*)\]\s*$/, '$1]'));
  assert.deepEqual(rows.map((r) => [r.index, r.name, r.baseWeight, r.basePrice, r.playerTextureArchive, r.playerTextureRecord]),
    [[1320, 'Parts of', 120, 4000, 212, 11], [1321, 'Deed to', 0.5, 6000, 209, 5]]);
});

test('CSA-A: the switch has its Features row, its credit and its online lane - a boat is the player\'s own, like a wagon, so every key is the player\'s online', () => {
  const row = FEATURES.find((f) => f.control?.vendor === V);
  assert.ok(row, 'a Features row');
  assert.equal(row.group, 'world');
  assert.equal(row.title, 'Come Sail Away by RedRoryOTheGlen');
  assert.equal(row.effect, 'Takes effect when the game next loads.', 'the templates merge at load');
  assert.deepEqual([...MOD_CURATED[V]], ['SailingAssist.AutoTrimming', 'WindDirectionWidget.Enable', 'Waves.Enable', 'Audio.SoundVolume'], 'the four a player reaches for first');
  const credit = CREDITS.mods.find((m) => m.vendor?.includes(V));
  assert.ok(credit, 'a credit');
  assert.deepEqual([credit.title, credit.version, credit.author], ['Come Sail Away', '2.1', 'RedRoryOTheGlen']);
  assert.equal(credit.link, 'https://www.nexusmods.com/daggerfallunity/mods/1131');
  assert.ok(ONLINE_PLAYERS_OWN_MODS.includes(V));
  assert.equal(ONLINE_ROOM_MOD_KEYS[V], undefined);
  for (const key of Object.keys(DEF.keys)) assert.equal(onlineForcedModSetting(V, key, '?online=1'), undefined, `${key} is the player's online`);
});
