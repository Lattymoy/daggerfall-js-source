// AUDIT 24 (the full-codebase parity sweep), the second systems wave.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { SOCIAL_GROUPS, SOCIAL_GROUP_COUNT } from '../src/formats/factionFile.js';
import { createRandomWeapon } from '../src/systems/loot.js';
import { mintCondition } from '../src/systems/itemTemplates.js';
import { dateString, daySuffix } from '../src/systems/gameDate.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { checkBuildingTypeInSkipList } from '../src/systems/topicTree.js';
import { MAGIC_ONLY_KEYS } from '../src/systems/effects.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('audit24 systems: DateString is dayName the Nth of month, and carries no year', () => {
  // DaggerfallDateTime.DateString (:417-422) formats
  // dateFormatString '{0} the {1}{2} of {3:00}' - the {3:00} spec
  // lands on the STRING MonthName and string.Format drops it, the
  // same quirk DateTimeString already carries.
  const d = { year: 405, month: 0, day: 3, hour: 13, minute: 30, second: 0 };
  assert.equal(dateString(d), 'Middas the 4th of Morning Star');
  assert.equal(daySuffix(1), 'st');
  assert.equal(daySuffix(22), 'nd');
  assert.equal(daySuffix(23), 'rd');
  assert.equal(daySuffix(4), 'th');
  assert.equal(dateString({ ...d, day: 0 }), 'Sundas the 1st of Morning Star');
  assert.equal(/3E/.test(dateString(d)), false, 'DateString has no year slot at all');
});

test('audit24 systems: SupernaturalBeings reputation is DROPPED on load, as DFU drops it', () => {
  // GetSaveData writes all eleven (SerializablePlayer.cs:158) but
  // RestoreSaveData assigns 0,1,2,3,4,5,7,8,9,10 and never index 6
  // (:321-330). A bug of DFU's, reproduced rather than fixed.
  const live = { items: [], stats: {}, skills: 30 };
  live.sGroupReputations = Array.from({ length: SOCIAL_GROUP_COUNT }, (_, i) => i * 3);
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(live, {})));
  assert.equal(snap.sGroupReputations[SOCIAL_GROUPS.SupernaturalBeings], 18,
    'the SAVE still writes it - that half DFU does do');
  const fresh = { items: [], stats: {}, sGroupReputations: new Array(SOCIAL_GROUP_COUNT).fill(0) };
  restorePlayer(fresh, snap);
  assert.equal(fresh.sGroupReputations[SOCIAL_GROUPS.SupernaturalBeings], 0, 'index 6 is never assigned');
  assert.equal(fresh.sGroupReputations[SOCIAL_GROUPS.GuildMembers], 21, 'index 7 restores as normal');
  assert.equal(fresh.sGroupReputations[SOCIAL_GROUPS.Commoners], 0);
  assert.equal(fresh.sGroupReputations[SOCIAL_GROUPS.Merchants], 3);
});

test('audit24 systems: a looted arrow stack arrives at ZERO condition', () => {
  // CreateRandomWeapon's arrow branch makes three writes
  // (ItemBuilder.cs:395-398): the stack, currentCondition = 0
  // ("classic does it") and nativeMaterialValue = 0. maxCondition
  // stays the template's hitPoints - the branch never runs
  // ApplyWeaponMaterial.
  let arrow = null;
  for (let i = 0; i < 40 && !arrow; i++) {
    const seq = [18 / 19, 0.5];
    let n = 0;
    const it = createRandomWeapon(1, () => seq[Math.min(n++, seq.length - 1)]);
    if (it.templateIndex === 131) arrow = it;
  }
  assert.ok(arrow, 'slot 18 is the arrow slot');
  assert.equal(arrow.currentCondition, 0);
  assert.equal(arrow.maxCondition, 1, "the Arrow template's hitPoints");
  // ...and the loot pile's mintCondition must leave it alone
  mintCondition(arrow);
  assert.equal(arrow.currentCondition, 0, 'the mint sees maxCondition set and returns early');
});

test('audit24 systems: the BuildingTypes tail exists, so the skip list is really seventeen', () => {
  // DFLocation.cs:133-139. CheckBuildingTypeInSkipList
  // (TalkManager.cs:2919-2938) names AllValid and Special1-4 by hand;
  // without them on the enum, five of its entries were `undefined`.
  assert.equal(BUILDING_TYPES.Special1, 0x74);
  assert.equal(BUILDING_TYPES.Special2, 0xdf);
  assert.equal(BUILDING_TYPES.Special3, 0xf9);
  assert.equal(BUILDING_TYPES.Special4, 0xfa);
  assert.equal(BUILDING_TYPES.AnyShop, 0xfffd);
  assert.equal(BUILDING_TYPES.AnyHouse, 0xfffe);
  assert.equal(BUILDING_TYPES.AllValid, 0xffff);
  for (const t of [0xffff, 0x74, 0xdf, 0xf9, 0xfa]) {
    assert.equal(checkBuildingTypeInSkipList(t), true, `${t} is in the skip list`);
  }
  assert.equal(checkBuildingTypeInSkipList(undefined), false, 'and `undefined` is not a member of it');
  assert.equal(checkBuildingTypeInSkipList(BUILDING_TYPES.Tavern), false);
  assert.equal(checkBuildingTypeInSkipList(BUILDING_TYPES.Palace), true);
});

test('audit24 systems: the saving throw splits its element from its flag', () => {
  // GetEffectFlags (FormulaHelper.cs:1592-1623) never consults
  // AllowedElements; only GetElementType (:1630-1634) does.
  const fx = rd('src/systems/effects.js');
  assert.match(fx, /const saveFlag = \(\) => flag;/, 'the flag is the bundle element, always');
  assert.match(fx, /const savesAsMagic = \(e\) => MAGIC_ONLY_KEYS\.has/);
  // and the magic-only set is the real one, not a family guess
  for (const k of ['14,255', '25,255', '26,255', '27,255', '28,255', '30,255', '31,255']) {
    assert.ok(fx.includes(`'${k}'`), `${k} (levitate/slowfall/free action/jumping/climbing/water) is magic-only`);
  }
});

test('audit24 systems: the %di local-place separator is a comma and TWO spaces', () => {
  // QuestMCP.Direction's local arm builds
  // `locationName + GetLocalizedText("comma") + compass`, and
  // Internal_Strings id 424 is ',  ' - verified with cat -A on
  // Internal_Strings_en.asset:2046.
  const qm = rd('src/systems/quest/questMacros.js');
  assert.match(qm, /comma: ',  ',/, 'two spaces, not one');
  assert.equal(/comma: ', ',/.test(qm), false);
});

test('audit24 systems: GetBuildingNameForBuildingKey throws its two errors', () => {
  const tt = rd('src/systems/topicTree.js');
  assert.match(tt, /GetBuildingNameForBuildingKey\(\): No building with the queried key found/);
  assert.match(tt, /GetBuildingNameForBuildingKey\(\): More than one building with the queried key found/);
});

test('audit24 systems: both faction-gated actions go through GetFactionData, which throws', () => {
  // WhenNpcIsAvailable.cs:58 and WhenReputeWith.cs:57 are the same
  // line; Person.GetFactionData (Person.cs:848-856) throws on a
  // missing record. The port's `factionData &&` guard swallowed it.
  const ac = rd('src/systems/quest/actions.js');
  assert.equal((ac.match(/getFactionDataOrThrow\(world, factionID\)/g) ?? []).length, 2);
  assert.equal(/const factionData = world\.getFactionData\?\.\(factionID\);/.test(ac), false,
    'neither action reads the store directly any more');
  const pe = rd('src/systems/quest/person.js');
  assert.match(pe, /export function getFactionDataOrThrow/);
});

test('audit24 systems: %god falls back to the REGION temple before it rolls', () => {
  const qm = rd('src/systems/quest/questMacros.js');
  assert.match(qm, /REGION_TEMPLES\[w\?\.currentRegionIndex\?\.\(\)\] \?\? 0/);
  assert.match(qm, /factionId === 0 \|\| factionId === THE_FIGHTERS_GUILD/);
  assert.match(qm, /function templeDivine/);
  assert.equal(/divineOfTempleFaction/.test(qm), false, 'the unwired host seam is gone');
});

// The vendored DFU tree is gitignored, so this gate skips wherever it is
// absent - the same charter the ARENA2-backed pins run under.
const DFU_EFFECTS = new URL('../tools/parity/dfu/Assets/Scripts/Game/MagicAndEffects/Effects/', import.meta.url);
const noDfu = !existsSync(DFU_EFFECTS);

test('audit24 systems: MAGIC_ONLY_KEYS is REGENERATED from the effect classes, not guessed', { skip: noDfu }, () => {
  // The original defect was not a wrong key - it was a hand-picked list
  // of FAMILIES that missed seven buffs. The only pin that catches that
  // class of error is one that rebuilds the set from the source, so
  // this walks every effect class under Game/MagicAndEffects/Effects,
  // reads its `properties.AllowedElements`, and compares the whole set
  // both ways. ElementFlags_MagicOnly IS ElementTypes.Magic
  // (EntityEffectBroker.cs:47), so both spellings count.
  const files = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p2 = new URL(`${e.name}${e.isDirectory() ? '/' : ''}`, dir);
      if (e.isDirectory()) walk(p2);
      else if (e.name.endsWith('.cs')) files.push(p2);
    }
  };
  walk(DFU_EFFECTS);
  assert.ok(files.length > 100, `found ${files.length} effect classes`);

  const magicOnly = new Set();
  const keyed = new Set();
  // the two variant families key themselves in a loop over variantIndex
  const VARIANTS = { 'ElementalResistance.cs': [8, 5], 'PacifyEffect.cs': [33, 4] };
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const ae = /AllowedElements\s*=\s*([\w.]+)\s*;/.exec(src);
    const isMagicOnly = !!ae && (ae[1] === 'EntityEffectBroker.ElementFlags_MagicOnly' || ae[1] === 'ElementTypes.Magic');
    const name = f.pathname.split('/').pop();
    const add2 = (k) => { keyed.add(k); if (isMagicOnly) magicOnly.add(k); };
    for (const m of src.matchAll(/MakeClassicKey\((\d+),\s*(?:\(byte\))?(\d+)\)/g)) add2(`${m[1]},${m[2]}`);
    const v = VARIANTS[name];
    if (v) for (let i = 0; i < v[1]; i++) add2(`${v[0]},${i}`);
  }
  assert.ok(keyed.size > 80, `found ${keyed.size} classic-keyed effects`);
  const port = new Set(MAGIC_ONLY_KEYS);
  const extra = [...port].filter((k) => !magicOnly.has(k)).sort();
  const missing = [...magicOnly].filter((k) => !port.has(k)).sort();
  assert.deepEqual(extra, [], 'the port claims magic-only for effects whose AllowedElements is not Magic');
  assert.deepEqual(missing, [], 'the port misses effects whose AllowedElements IS Magic');
  // ...and the seven the hand-picked list had missed are in it
  for (const k of ['14,255', '25,255', '26,255', '27,255', '28,255', '30,255', '31,255']) {
    assert.ok(port.has(k), `${k} is magic-only`);
  }
});
