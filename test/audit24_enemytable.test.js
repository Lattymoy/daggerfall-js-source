// AUDIT 24 (the full-codebase parity sweep), wave 23: THE GENERATOR
// GATE.
//
// src/characters/enemyBasics.js is 3025 lines of MobileEnemy records
// GENERATED from EnemyBasics.cs. That is better than a hand
// transcription, but only while somebody re-runs the generator: the
// tool asserted C3 parity when a human invoked it, and nothing
// invoked it in CI. So a column the extraction never looked at was
// invisible from BOTH sides - absent from the port, and absent from
// every pin, because every pin read the port.
//
// SoulPts is that column. It is on the struct
// (DaggerfallUnityStructs.cs:216, "Number of enchantment points in a
// trapped soul of this enemy"), 32 of the 62 entries set it, and
// ItemBuilder.cs:303 mints a filled soul trap as
// `newItem.value = 5000 + mobileEnemy.SoulPts`.
//
// This gate re-extracts from the vendored source with the SAME pure
// function the generator uses and deep-equals the checked-in module.
// The DFU tree is gitignored, so it skips where it is absent - the
// charter the ARENA2-backed and LootTables pins already run under.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { ENCOUNTER_TABLES } from '../src/systems/encounters.js';
import { RACE_TEMPLATES } from '../src/systems/races.js';
import { GROUP_TEMPLATE_INDICES } from '../src/systems/itemTemplatesData.js';
import { ITEM_GROUPS } from '../src/systems/loot.js';
import { ENCOUNTER_TABLES as ENCOUNTER_TABLES_SRC } from '../src/characters/encounterTables.js';
import { extractEnemyBasics, sliceEnemyTable } from '../tools/extractEnemyBasics.lib.mjs';

const ENEMY_CS = new URL('../tools/parity/dfu/Assets/Scripts/Utility/EnemyBasics.cs', import.meta.url);
const SOUND_CS = new URL('../tools/parity/dfu/Assets/Scripts/SoundClips.cs', import.meta.url);
const ENCOUNTERS_CS = new URL('../tools/parity/dfu/Assets/Scripts/Utility/RandomEncounters.cs', import.meta.url);
const ENUMS_CS = new URL('../tools/parity/dfu/Assets/Scripts/DaggerfallUnityEnums.cs', import.meta.url);
const noDfu = !existsSync(ENEMY_CS) || !existsSync(SOUND_CS);
const noEnc = !existsSync(ENCOUNTERS_CS) || !existsSync(ENUMS_CS);

test('audit24 wave23: ENEMY_BASICS is what the extractor produces from EnemyBasics.cs TODAY', { skip: noDfu }, () => {
  const fresh = extractEnemyBasics(readFileSync(ENEMY_CS, 'utf8'), readFileSync(SOUND_CS, 'utf8'));
  assert.equal(Object.keys(fresh).length, 62, 'the source still holds 62 MobileEnemy records');
  assert.deepEqual(Object.keys(ENEMY_BASICS).sort(), Object.keys(fresh).sort());
  for (const id of Object.keys(fresh)) {
    assert.deepEqual(ENEMY_BASICS[id], fresh[id], `enemy ${id} matches the source`);
  }
});

test('audit24 wave23: the extraction reads every column EnemyBasics.cs actually sets', { skip: noDfu }, () => {
  // The real gate against a dropped column: enumerate the field names
  // the SOURCE assigns inside its MobileEnemy initialisers and check
  // that each one has somewhere to land. A new DFU column - or one the
  // extractor has always skipped - fails here rather than silently
  // never existing on this side.
  // through the LIBRARY's slicer, not a hand-rolled copy of it - the
  // first draft of this pin rolled its own and lost the `=== -1`
  // guard, so it scanned an empty string and passed everything.
  const table = sliceEnemyTable(readFileSync(ENEMY_CS, 'utf8'));
  const csFields = new Set();
  for (const [, f] of table.matchAll(/^\s{16}(\w+) = /gm)) csFields.add(f);
  assert.ok(csFields.size >= 25, `the scan found ${csFields.size} columns in the source - it must not be scanning nothing`);

  const portFields = new Set();
  for (const e of Object.values(ENEMY_BASICS)) for (const f of Object.keys(e)) portFields.add(f);
  const lower = (f) => f[0].toLowerCase() + f.slice(1);

  // KNOWN-DROPPED, each with the reason. Anything else is a bug.
  // Every boolean here is omitted only when FALSE - the C# struct
  // default - and every consumer reads it as `?? false`.
  const dropped = new Map([
    ['ID', 'the array index IS the key of the port object'],
    ['HasIdle', 'omitted when false'],
    ['HasRangedAttack1', 'omitted when false'],
    ['HasRangedAttack2', 'omitted when false'],
    ['HasSpellAnimation', 'omitted when false'],
    ['CanOpenDoors', 'omitted when false'],
    ['ParrySounds', 'omitted when false'],
    ['CastsMagic', 'omitted when false'],
    ['SeesThroughInvisibility', 'omitted when false'],
    ['NoShadow', 'omitted when false'],
    ['HasSeducerTransform1', 'omitted when false'],
    ['HasSeducerTransform2', 'omitted when false'],
    ['PrefersRanged', 'omitted when false'],
    ['PrefersNoise', 'omitted when false'],
  ]);

  const missing = [...csFields].filter((f) => !portFields.has(lower(f)) && !dropped.has(f));
  assert.deepEqual(missing, [], `EnemyBasics.cs sets these and the extraction drops them: ${missing.join(', ')}`);
});

test('audit24 wave23: SoulPts landed, with the values ItemBuilder reads', { skip: noDfu }, () => {
  // The column this gate was written to catch. Spot-check three the
  // C# names outright, then assert the population.
  assert.equal(ENEMY_BASICS['1'].soulPts, 1000, 'Imp - EnemyBasics.cs SoulPts = 1000');
  const withSouls = Object.values(ENEMY_BASICS).filter((e) => e.soulPts !== undefined);
  assert.equal(withSouls.length, 32, '32 of the 62 records carry soul points');
  const cs = readFileSync(ENEMY_CS, 'utf8');
  assert.equal((cs.match(/^\s*SoulPts = /gm) ?? []).length, 32, 'and the source sets it exactly 32 times');
  // an entry that does NOT set it takes the struct default of 0; the
  // port omits it, which every reader must treat as 0
  assert.equal(ENEMY_BASICS['0'].soulPts, undefined, 'the Rat has no soul (points)');
});

test('audit24 wave23: the eight columns the extraction had never looked at', { skip: noDfu }, () => {
  // Found by the gate above the moment it stopped scanning an empty
  // string. All eight have real DFU consumers; none has a port
  // consumer yet, which is exactly why nothing missed them.
  //
  //   BloodIndex               EnemyAttack.cs:332, WeaponManager.cs:572,
  //                            EnemyHealth.cs:52 - the TEXTURE.380 splash
  //   NoShadow, GlowColor      SetupDemoEnemy.cs:137-148 - the shadow
  //                            caster and the point light
  //   HasSeducerTransform1/2   DaggerfallMobileUnit.cs:850 - which
  //   SeducerTransform1/2Frames transform anim set the Lamia plays
  //   PrefersRanged            DaggerfallUnityStructs.cs:190 - the AI flag
  const withBlood = Object.entries(ENEMY_BASICS).filter(([, e]) => e.bloodIndex !== undefined);
  assert.equal(withBlood.length, 6, 'six enemies take a non-default blood splash');
  for (const [, e] of withBlood) assert.equal(e.bloodIndex, 2, 'and all six are index 2');

  assert.equal(Object.values(ENEMY_BASICS).filter((e) => e.noShadow).length, 7);
  assert.equal(Object.values(ENEMY_BASICS).filter((e) => e.prefersRanged).length, 1);
  assert.equal(Object.values(ENEMY_BASICS).filter((e) => e.hasSeducerTransform1).length, 1);
  assert.equal(Object.values(ENEMY_BASICS).filter((e) => e.hasSeducerTransform2).length, 1);
  assert.deepEqual(Object.values(ENEMY_BASICS).find((e) => e.seducerTransform1Frames)?.seducerTransform1Frames,
    [0, 1, 2, 3, 4, 5, 6, 7, 8]);

  // Unity's Color operator* scales EVERY channel including alpha, and
  // the 3-arg constructor leaves a = 1 - so `new Color(18, 68, 88) *
  // 0.1f` has alpha 0.1, not 1. (The channels are far outside 0..1;
  // that is DFU's own data, kept.)
  const daedroth = ENEMY_BASICS['25'];
  assert.deepEqual(daedroth.glowColor, { r: 18 * 0.1, g: 68 * 0.1, b: 88 * 0.1, a: 0.1 },
    'new Color(18, 68, 88) * 0.1f, alpha included');
  assert.equal(Object.values(ENEMY_BASICS).filter((e) => e.glowColor).length, 3, 'three enemies glow');
});

test('audit24 wave23: ENCOUNTER_TABLES is REBUILT from RandomEncounters.cs, all 900 cells', { skip: noEnc }, () => {
  // encounters.test.js spot-checks a handful of cells out of 45 x 20.
  // A wrong id in the middle of table 27 produces encounters, just the
  // wrong ones, for ever - the shape the LootTables and EnemyBasics
  // gates exist for.
  //
  // MobileTypes is an implicit-value enum, so the ids come from
  // counting members, not from literals.
  const enums = readFileSync(ENUMS_CS, 'utf8');
  const i = enums.indexOf('public enum MobileTypes');
  assert.ok(i > 0, 'MobileTypes must be findable');
  const body = enums.slice(enums.indexOf('{', i) + 1, enums.indexOf('}', i));
  const MT = {};
  let next = 0;
  for (const line of body.split('\n')) {
    const m = /^\s*([A-Za-z_]\w*)\s*(?:=\s*(-?\d+))?\s*,/.exec(line);
    if (!m) continue;
    const v = m[2] !== undefined ? Number(m[2]) : next;
    MT[m[1]] = v;
    next = v + 1;
  }
  assert.equal(Object.keys(MT).length, 62, 'the enum still names 62 mobiles');
  assert.equal(MT.Rat, 0);
  assert.equal(MT.Thief, 138, 'and the class block still starts at 128');

  const re = readFileSync(ENCOUNTERS_CS, 'utf8');
  const start = re.indexOf('public static RandomEncounterTable[] EncounterTables');
  assert.ok(start > 0);
  // LEDGER B, and the reason this gate must strip comments: the source
  // carries a commented-out `/* Cemetery - DF Unity version */` table
  // between index 18 and Underwater. Leave it in and every table from
  // 19 on shifts by one - which is exactly what the first run of this
  // rebuild reported, before the strip went in.
  const table = re.slice(start, re.indexOf('\n        };', start)).replace(/\/\*[\s\S]*?\*\//g, '');
  const fromSource = table.split('new RandomEncounterTable()').slice(1).map((b) => {
    const m = b.match(/Enemies = new MobileTypes\[\]\s*\{([\s\S]*?)\}/);
    assert.ok(m, 'every table block carries an Enemies array');
    return m[1].split(',').map((x) => x.trim()).filter(Boolean).map((x) => {
      const name = x.replace('MobileTypes.', '');
      assert.ok(name in MT, `unknown MobileTypes member ${name}`);
      return MT[name];
    });
  });

  assert.equal(fromSource.length, 45, '45 live tables once the dead Cemetery block is stripped');
  assert.equal(ENCOUNTER_TABLES.length, fromSource.length);
  for (let t = 0; t < fromSource.length; t++) {
    assert.equal(fromSource[t].length, 20, `table ${t} is a classic list of 20`);
    assert.deepEqual([...ENCOUNTER_TABLES[t]], fromSource[t], `encounter table ${t} matches the source`);
  }
});

test('audit24 wave23: there is exactly ONE encounter table', () => {
  // systems/encounters.js used to carry a second, hand-maintained copy
  // of all 900 cells beside the generated one in
  // characters/encounterTables.js. They were identical the day this
  // was found, which is the only day that was ever guaranteed - and
  // only one of them could be gated.
  assert.equal(ENCOUNTER_TABLES, ENCOUNTER_TABLES_SRC,
    'the same frozen array object, not two arrays that happen to agree');
  const src = readFileSync(new URL('../src/systems/encounters.js', import.meta.url), 'utf8');
  assert.match(src, /import \{ ENCOUNTER_TABLES \} from '\.\.\/characters\/encounterTables\.js';/);
  assert.match(src, /^export \{ ENCOUNTER_TABLES \};$/m);
  assert.doesNotMatch(src, /export const ENCOUNTER_TABLES = Object\.freeze\(\[/,
    'and no second literal has grown back');
});

// ---- the RACE TEMPLATES -------------------------------------------
// races.js DERIVES every paperdoll filename from a race's art index,
// on the strength of "one regular scheme". RaceTemplate.cs spells all
// seven filenames out per race, one literal at a time, which is
// exactly where a scheme goes to break. Rebuild and compare.

const RACE_CS = new URL('../tools/parity/dfu/Assets/Scripts/Game/Entities/RaceTemplate.cs', import.meta.url);
const noRace = !existsSync(RACE_CS);

test('audit24 wave23: RACE_TEMPLATES is REBUILT from RaceTemplate.cs, filename for filename', { skip: noRace }, () => {
  const cs = readFileSync(RACE_CS, 'utf8');
  const blocks = [...cs.matchAll(/public class (\w+) : RaceTemplate\s*\{[\s\S]*?public \1\(\)\s*\{([\s\S]*?)\n        \}/g)];
  const fromSource = new Map();
  for (const [, name, ctor] of blocks) {
    const str = (k) => { const m = ctor.match(new RegExp(`${k} = "([^"]+)"`)); return m ? m[1] : null; };
    const int = (k) => { const m = ctor.match(new RegExp(`${k} = (\\d+);`)); return m ? Number(m[1]) : null; };
    const flag = (k) => {
      const m = ctor.match(new RegExp(`${k} = DFCareer\\.EffectFlags\\.(\\w+);`));
      return m ? ({ Paralysis: 1, Magic: 2, Poison: 4, Fire: 8, Frost: 16, Shock: 32, Disease: 64 })[m[1]] : 0;
    };
    fromSource.set(name, {
      descriptionId: int('DescriptionID'),
      clipId: int('ClipID'),
      background: str('PaperDollBackground'),
      bodyMale: [str('PaperDollBodyMaleUnclothed'), str('PaperDollBodyMaleClothed')],
      bodyFemale: [str('PaperDollBodyFemaleUnclothed'), str('PaperDollBodyFemaleClothed')],
      headsMale: str('PaperDollHeadsMale'),
      headsFemale: str('PaperDollHeadsFemale'),
      resistanceFlags: flag('ResistanceFlags'),
      immunityFlags: flag('ImmunityFlags'),
      lowToleranceFlags: flag('LowToleranceFlags'),
      criticalWeaknessFlags: flag('CriticalWeaknessFlags'),
    });
  }
  // RaceTemplate.cs defines exactly the eight playable races as
  // subclasses. Exact, not >=, so a ninth arriving in a DFU update
  // fails here instead of being silently ignored.
  assert.equal(fromSource.size, 8, `found ${fromSource.size} RaceTemplate subclasses`);
  for (const r of RACE_TEMPLATES) {
    const cs_ = fromSource.get(r.key);
    assert.ok(cs_, `RaceTemplate.cs still defines ${r.key}`);
    assert.equal(r.descriptionId, cs_.descriptionId, `${r.key} DescriptionID`);
    assert.equal(r.clipId, cs_.clipId, `${r.key} ClipID`);
    assert.equal(r.background, cs_.background, `${r.key} PaperDollBackground`);
    assert.deepEqual([...r.bodyMale], cs_.bodyMale, `${r.key} male body art`);
    assert.deepEqual([...r.bodyFemale], cs_.bodyFemale, `${r.key} female body art`);
    assert.equal(r.headsMale, cs_.headsMale, `${r.key} male heads`);
    assert.equal(r.headsFemale, cs_.headsFemale, `${r.key} female heads`);
    assert.equal(r.resistanceFlags, cs_.resistanceFlags, `${r.key} ResistanceFlags`);
    assert.equal(r.immunityFlags, cs_.immunityFlags, `${r.key} ImmunityFlags`);
    assert.equal(r.lowToleranceFlags, cs_.lowToleranceFlags, `${r.key} LowToleranceFlags`);
    assert.equal(r.criticalWeaknessFlags, cs_.criticalWeaknessFlags, `${r.key} CriticalWeaknessFlags`);
  }
  assert.equal(RACE_TEMPLATES.length, 8, 'the eight playable races');
});

// ---- the ITEM GROUP -> TEMPLATE INDEX lists ------------------------
// GROUP_TEMPLATE_INDICES is extracted from ItemEnums.cs, and two of
// its rows are hand-added because the generator predates them. These
// lists decide what loot generation and shop stock can mint at all.

const ITEM_ENUMS_CS = new URL('../tools/parity/dfu/Assets/Scripts/Game/Items/ItemEnums.cs', import.meta.url);
const noItemEnums = !existsSync(ITEM_ENUMS_CS);

test('audit24 wave23: GROUP_TEMPLATE_INDICES is REBUILT from ItemEnums.cs', { skip: noItemEnums }, () => {
  const cs = readFileSync(ITEM_ENUMS_CS, 'utf8');
  // Every `public enum X { ... }` in the file, members resolved the
  // way C# resolves them: an explicit `= n` sets the value, a bare
  // member takes the previous plus one. `Deeds` is the reason - it is
  // implicit (0, 1, 2) where every other item group is explicit, and
  // the first draft of this gate skipped implicit enums outright and
  // then asserted Deeds must be present.
  const enums = new Map();
  for (const [, name, body] of cs.matchAll(/public enum (\w+)[^\n]*\n\s*\{([\s\S]*?)\n\s*\}/g)) {
    const members = [];
    let next = 0;
    for (const line of body.split('\n')) {
      const m = /^\s*([A-Za-z_]\w*)\s*(?:=\s*(-?(?:0x[0-9a-fA-F]+|\d+)))?\s*,/.exec(line);
      if (!m) continue;
      const v = m[2] !== undefined ? Number(m[2]) : next;
      members.push(v);
      next = v + 1;
    }
    if (members.length) enums.set(name, members);
  }
  assert.ok(enums.size >= 20, `found ${enums.size} enums in ItemEnums.cs`);

  for (const [group, list] of Object.entries(GROUP_TEMPLATE_INDICES)) {
    const src = enums.get(group);
    assert.ok(src, `ItemEnums.cs still declares enum ${group}`);
    assert.deepEqual([...list], src, `${group} template indices match ItemEnums.cs`);
  }
  // The two rows added by hand after the generator ran - the whole
  // reason this gate matters. Both are real enums in the source.
  assert.ok(enums.has('QuestItems'), 'QuestItems is an enum, not an invention');
  assert.ok(enums.has('Currency'), 'and so is Currency');
  // Books repeats one template index four times: the enum names four
  // Book0..3 members that all resolve to 277. Kept verbatim.
  assert.deepEqual([...GROUP_TEMPLATE_INDICES.Books], [277, 277, 277, 277]);
});

test('audit24 wave23: loot.js views the one item-group table, it does not copy it', () => {
  // Twelve of these rows used to be a second literal inside loot.js -
  // the same numbers, extracted from the same ItemEnums.cs, in a file
  // that already imported the first copy two lines above.
  for (const [k, row] of Object.entries(ITEM_GROUPS)) {
    assert.equal(row, GROUP_TEMPLATE_INDICES[k],
      `loot's ${k} is the SAME frozen array, not one that happens to agree`);
  }
  assert.equal(Object.keys(ITEM_GROUPS).length, 12);
  assert.doesNotMatch(readFileSync(new URL('../src/systems/loot.js', import.meta.url), 'utf8'),
    /PlantIngredients1: \[8, 9/, 'and no literal has grown back');
});
