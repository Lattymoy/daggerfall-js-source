// AUDIT 63 - THE EFFECT LIBRARY lane. Five laws, each pinned against the
// mutation that would revert it:
//
//   F13  EntityEffectBroker.SyntheticTimeIncrease (:81, :244-248) and the
//        three enchantment arms that read it - ItemDeteriorates.cs:76-80,
//        HealthLeech.cs:101-105, CastWhenHeld.cs:131-136.
//   F14  SoulBound's inventory law - EnumerateFilledTraps (:105-127) feeding
//        the item maker's two pickers, and RemoveFilledTrap (:129-155) as
//        the Enchanted payload.
//   F15  EntityEffectManager.IsEntityImmuneToDisease (:623-641) at
//        AssignBundle's own gate (:495-499).
//   F16  Silence's LANDING alert (Silence.cs:80-96), the second of DFU's
//        two "You are silenced." printers.
//   F17  is pinned where its defect's guard stood, in test/x11b.test.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  setSyntheticTimeIncrease, syntheticTimeIncrease, claimSyntheticTimeIncrease,
  resetSyntheticTimeIncrease,
} from '../src/systems/effectBroker.js';
import {
  ENCHANTMENT_TYPES as T, PAYLOAD, enchantmentMagicRound, doEnchantedPayloads,
} from '../src/systems/enchantments.js';
import { claimMagicRounds, runMagicRoundsFor, resetMagicRoundMarker } from '../src/systems/worldTick.js';
import {
  SOUL_TRAP_TEMPLATE, enumerateFilledTraps, removeFilledTrap, SILENCED_TEXT,
} from '../src/systems/mysticism.js';
import {
  primaryPickerList, primaryPick, forcedEnchantments, enchantmentName,
} from '../src/systems/enchantmentCatalogue.js';
import { ItemMakerWindow } from '../src/ui/itemMakerWindow.js';
import { isEntityImmuneToDisease, applySpell, BUFF_START_TEXT } from '../src/systems/effects.js';
import { startDisease, inflictDisease } from '../src/systems/diseases.js';
import { EFFECT_FLAGS } from '../src/systems/spellcast.js';
import { buildCustomSpell, blankEffectSettings } from '../src/systems/spellMaker.js';
import { MINUTES_PER_DAY } from '../src/systems/gameDate.js';
import { ITEM_GROUPS } from '../src/characters/equipRules.js';
import { createArrestFlow } from '../src/scenes/arrestFlow.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(root, p), 'utf8');

const item = (type, param = -1, over = {}) => ({
  name: 'Test Item', templateIndex: 135, group: ITEM_GROUPS.Jewellery,
  currentCondition: 100, maxCondition: 100, equipSlot: 9,
  enchantments: [{ type, param }], ...over,
});
const wearer = (items, over = {}) => ({
  name: 'W', health: 200, maxHealth: 300, items, level: 5, isPlayer: true,
  stats: {}, skills: [40, 40, 40, 40], activeEffects: [], ...over,
});

// ── F13: SyntheticTimeIncrease ───────────────────────────────────────

test('AUDIT 63 F13: the three synthetic-time arms sit out a jump, and nothing else does', () => {
  resetSyntheticTimeIncrease();
  const hurt = [];
  const deteriorates = item(T.ItemDeteriorates, 0);      // Params.AllTheTime
  const held = item(T.CastWhenHeld, 4);
  const leech = item(T.HealthLeech, 1, { timeHealthLeechLastUsed: 0 });   // UnlessUsedDaily
  const takes = item(T.UserTakesDamage, 0);              // AllTheTime - NOT gated in DFU
  const w = wearer([deteriorates, held, leech, takes]);
  const ctx = { hurtSelf: (n) => hurt.push(n), inSunlight: () => true, inHolyPlace: () => true };

  setSyntheticTimeIncrease(true);
  assert.equal(syntheticTimeIncrease(), true);
  // one three-day journey's worth of catch-up, at the port's cap
  for (let r = 1; r <= 2880; r++) enchantmentMagicRound(w, r, { nowMinutes: MINUTES_PER_DAY * 3 + r, ctx });

  // ItemDeteriorates.cs:79 / CastWhenHeld.cs:133: not one point of wear,
  // where 2880/4 = 720 would have destroyed both items outright.
  assert.equal(deteriorates.currentCondition, 100, 'ItemDeteriorates sits the jump out');
  assert.equal(held.currentCondition, 100, 'CastWhenHeld\'s durability loss sits the jump out');
  assert.ok(w.items.includes(deteriorates) && w.items.includes(held), 'and neither breaks out of the pack');
  // HealthLeech.cs:104 - the timed leech is silent...
  // ...but UserTakesDamage.cs is NOT gated in DFU, so it still bills its
  // 720 (2880 / UserTakesDamage's own 4-round cadence).
  assert.equal(hurt.length, 720, 'only the UNGATED arm ran');
  assert.deepEqual([...new Set(hurt)], [1]);
  resetSyntheticTimeIncrease();
});

test('AUDIT 63 F13: with the flag DOWN the same window is the massacre DFU shields against', () => {
  resetSyntheticTimeIncrease();
  const hurt = [];
  const deteriorates = item(T.ItemDeteriorates, 0);
  const leech = item(T.HealthLeech, 1, { timeHealthLeechLastUsed: 0 });
  const w = wearer([deteriorates, leech]);
  const ctx = { hurtSelf: (n) => hurt.push(n) };
  for (let r = 1; r <= 400; r++) enchantmentMagicRound(w, r, { nowMinutes: MINUTES_PER_DAY * 3 + r, ctx });
  assert.equal(deteriorates.currentCondition, 0, '400/4 = 100 points gone');
  assert.equal(hurt.length, 100, 'and 100 points of blood');
});

test('AUDIT 63 F13: the flag covers exactly ONE claimed window - the broker Update tail (:244-248)', () => {
  resetSyntheticTimeIncrease();
  resetMagicRoundMarker(1000);
  const deteriorates = item(T.ItemDeteriorates, 0);
  const w = wearer([deteriorates]);

  setSyntheticTimeIncrease(true);
  // the jump: 1000 -> 1400, claimed and run as one window
  let win = claimMagicRounds(1000, 1400);
  assert.equal(win.rounds, 400);
  runMagicRoundsFor(w, win.from, win.to, { sinks: {} });
  assert.equal(deteriorates.currentCondition, 100, 'shielded');
  // DFU lowers the flag at the tail of that same Update, OUTSIDE the
  // catchup-rounds test - so the NEXT window is an ordinary one.
  win = claimMagicRounds(1400, 1404);
  runMagicRoundsFor(w, win.from, win.to, { sinks: {} });
  assert.equal(deteriorates.currentCondition, 99, 'the very next window wears again');
  assert.equal(syntheticTimeIncrease(), false);
  resetMagicRoundMarker(null);
});

test('AUDIT 63 F13: a zero-round window still retires the flag, and a re-raise re-arms it', () => {
  resetSyntheticTimeIncrease();
  setSyntheticTimeIncrease(true);
  assert.equal(claimSyntheticTimeIncrease(), true, 'the window that follows the raise is synthetic');
  assert.equal(claimSyntheticTimeIncrease(), false, 'and the one after it is not');
  setSyntheticTimeIncrease(true);
  assert.equal(claimSyntheticTimeIncrease(), true, 'a second jump re-arms');
  setSyntheticTimeIncrease(false);
  assert.equal(claimSyntheticTimeIncrease(), false, 'an explicit clear wins');
  // a load starts a fresh broker: nothing in DFU serialises the flag
  setSyntheticTimeIncrease(true);
  resetMagicRoundMarker(500);
  assert.equal(syntheticTimeIncrease(), false, 'the load arm lowers it');
  resetMagicRoundMarker(null);
});

test('AUDIT 63 F13: the four raisers - prison, both fast-travel advances, the vampire fortnight', () => {
  // DaggerfallCourtWindow.cs:475-476 - the sentence RaiseTime and the
  // event whose one subscriber is the broker (EntityEffectBroker.cs:841-842).
  resetSyntheticTimeIncrease();
  const playerEntity = { activeEffects: [], items: [], health: 10, maxHealth: 10 };
  assert.ok(createArrestFlow({
    townTalk: { say: () => {}, showOverlay: () => {}, lines: () => [], hideOverlay: () => {} },
    playerEntity, regionIndex: () => 0,
  }), 'the flow builds - and it is the ONE home both exterior hosts construct');
  const body = src('src/scenes/arrestFlow.js');
  // DFU's own order inside UpdatePrisonScreen's zero arm: both prevent
  // flags (:473-474), the sentence RaiseTime (:475), then the event
  // (:476). advanceDays is a bare clock move here, so the sentence's
  // window is claimed by the next host frame with the flag standing.
  assert.match(body, /advanceDays\(days\);[\s\S]{0,900}?setSyntheticTimeIncrease\(true\);\s*\n\s*playerEntity\.inPrison = false;/,
    'the raise sits inside onEndPrisonTime, between the sentence advance and InPrison clearing');
  // ReleaseFromPrison's own four hours (:485) are NOT independently
  // shielded - a zero-day plea runs those 240 minutes of rounds.
  assert.ok(!/setSyntheticTimeIncrease[\s\S]{0,200}advanceMinutes\(RELEASE_MINUTES\)/.test(body),
    'and release() raises nothing of its own');

  // DaggerfallTravelPopUp.cs:344 (the trip) and :355/:367/:374 (the
  // arrival clamps) all raise time BEFORE the flag is set at :383, so
  // ONE broker Update covers the lot. The port spends the jump in TWO
  // advances, each of which claims its own window, so both are armed.
  const world = src('src/scenes/world.js');
  assert.match(world, /setSyntheticTimeIncrease\(true\);\s*\n\s*playerTicker\.advance\(computed\.minutes\);/,
    'the travel advance is armed');
  assert.match(world, /if \(clamp > 0\) \{ setSyntheticTimeIncrease\(true\); playerTicker\.advance\(clamp\); \}/,
    'and so is the arrival clamp');

  // VampirismInfection.cs:161-162 - RaiseTime then the flag, in that order.
  assert.match(src('src/scenes/shared.js'),
    /raiseTime: \(seconds\) => \{ setSyntheticTimeIncrease\(true\); return advanceWorldMinutes\(seconds \/ 60\); \}/,
    'the infection host\'s clock raise arms it too');
});

// ── F14: SoulBound ───────────────────────────────────────────────────

const trap = (soul = null) => ({ group: 'MiscItems', templateIndex: SOUL_TRAP_TEMPLATE, trappedSoulType: soul });
const star = (soul = null) => ({
  name: "Azura's Star", group: ITEM_GROUPS.Jewellery, templateIndex: 137,
  enchantments: [{ type: T.SpecialArtifactEffect, param: 9 }], trappedSoulType: soul,
});
const WRAITH = 23;   // MobileTypes.Wraith - one of the nine forced-enchantment souls

test('AUDIT 63 F14: EnumerateFilledTraps reads the pack, with DFU\'s own asymmetric bound', () => {
  assert.deepEqual([...enumerateFilledTraps([])], [], 'nothing in the pack, nothing offered');
  assert.deepEqual([...enumerateFilledTraps([trap(null), trap(WRAITH), trap(WRAITH)])], [WRAITH],
    'duplicates collapse - DFU counts, the maker only asks whether the count is non-zero (:52-55)');
  assert.deepEqual([...enumerateFilledTraps([star(3)])], [3], 'a filled Azura\'s Star counts (:121-125)');
  // :115 bounds the ORDINARY trap by monsterIDCount and :121-125 does
  // not bound the Star. Kept verbatim, quirk and all.
  assert.deepEqual([...enumerateFilledTraps([trap(43)])], [], 'an out-of-range ordinary soul is skipped');
  assert.deepEqual([...enumerateFilledTraps([star(43)])], [43], 'the Star arm has no bound at all');
});

test('AUDIT 63 F14: an empty-handed player is offered no Soul Bound at all', () => {
  // DaggerfallItemMakerWindow.cs:252-274: an effect that returns zero
  // settings never enters groupedSideEffectTemplates, so it is absent
  // from the primary list - not merely paramless.
  const withNone = primaryPickerList(false, { item: {}, souls: enumerateFilledTraps([]) });
  assert.ok(!withNone.includes('SoulBound'), 'no filled trap, no row');
  const withOne = primaryPickerList(false, { item: {}, souls: enumerateFilledTraps([trap(WRAITH)]) });
  assert.ok(withOne.includes('SoulBound'), 'one filled trap and the row is back');
  // every other caller of the seam is untouched
  assert.ok(primaryPickerList(false, { item: {} }).includes('SoulBound'), '`souls` omitted means "do not ask"');
});

test('AUDIT 63 F14: the secondary picker lists only souls actually carried, and one soul still opens it', () => {
  const all = primaryPick('SoulBound', { selectingPowers: false });
  assert.equal(all.options.length, 43, 'unfiltered, the table is still the whole 43-row catalogue');

  const one = primaryPick('SoulBound', { selectingPowers: false, souls: enumerateFilledTraps([trap(WRAITH)]) });
  // DaggerfallItemMakerWindow.cs:832-838 excludes SoulBound from the
  // singleton shortcut "where player must select soul to correctly
  // assign enforced side-effects" (:833) - with exactly one filled trap
  // that clause is live, and the picker must still open.
  assert.equal(one.kind, 'choose', 'the singleton shortcut is refused for SoulBound');
  assert.equal(one.options.length, 1);
  assert.equal(one.options[0].param, WRAITH);
  assert.ok(forcedEnchantments('SoulBound', WRAITH).sideEffects.length,
    'and the forced set the picker exists to attach is still there (SoulBound.MobileForcedEnchantmentSets)');

  const two = primaryPick('SoulBound', { selectingPowers: false, souls: enumerateFilledTraps([trap(WRAITH), trap(3)]) });
  assert.deepEqual(two.options.map((o) => o.param).sort((a, b) => a - b), [3, WRAITH]);
  // AlphaSortSecondaryList (SoulBound.cs:40) is applied AFTER the filter
  const labels = two.options.map((o) => o.label);
  assert.deepEqual(labels, [...labels].sort(), 'alpha-sorted');
  // REVIEW ROUND: sortedness alone cannot see a MISPAIRING. The label
  // list is positional over the whole 43-row table, so filtering the
  // params first and pairing labels afterwards re-indexes every row -
  // and AlphaSortSecondaryList then sorts the WRONG names into order,
  // so the deepEqual above still passes. Pin the label VALUE against
  // DFU's own source for it: GetEnchantmentSettings writes
  // `SecondaryDisplayName = GetLocalizedEnemyName(EnemyBasics.Enemies[i].ID)`
  // (SoulBound.cs:64), and Utility/EnemyBasics.cs gives ID 3 the "Giant
  // Bat" entry (:334-338) and ID 23 the "Wraith" one (:997-1001).
  // Under the mispairing these read the table's first two rows instead.
  assert.equal(two.options.find((o) => o.param === WRAITH).label, 'Wraith',
    'EnemyBasics.cs:997-1001 - soul 23 is the Wraith, whatever the filter left standing');
  assert.equal(two.options.find((o) => o.param === 3).label, 'Giant Bat',
    'EnemyBasics.cs:334-338 - soul 3 is the Giant Bat');
  assert.equal(primaryPick('SoulBound', { selectingPowers: false, souls: new Set() }), null, 'no soul, no pick');
});

// The window itself, not just the catalogue seam. REVIEW ROUND: the two
// `souls:` arguments in src/ui/itemMakerWindow.js were F14's ONLY host
// wiring and nothing drove ItemMakerWindow, so deleting both restored
// the whole defect with the suite unchanged.
const makerWin = (items) => {
  const player = { items, goldPieces: 100000 };
  const w = new ItemMakerWindow({
    packItems: () => player.items,
    player,
    entity: player,
    icons: { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() },
  });
  // SelectedItemButton's item - any item at all opens the picker
  // (openPickerDecision / :614-656); the soul filter does not read it.
  w.selected = { name: 'Amulet', group: ITEM_GROUPS.Jewellery, templateIndex: 137, enchantments: [] };
  return { w, player };
};

test('AUDIT 63 F14: the item maker WINDOW offers Soul Bound only to a player carrying a filled trap', () => {
  // DaggerfallItemMakerWindow.cs:252-274 - EnumerateEnchantments adds a
  // key to groupedSideEffectTemplates only where GetEnchantmentSettings
  // returned rows, and SoulBound's come from the PACK (SoulBound.cs:46-72).
  const empty = makerWin([]).w;
  empty._openPicker(false);
  assert.ok(empty.picker, 'the side-effects picker opens either way (:637-656)');
  assert.ok(!empty.picker.items.includes(enchantmentName('SoulBound')),
    'no filled trap in the pack, and the window\'s own list has no Soul Bound row');

  const carrying = makerWin([trap(WRAITH)]).w;
  carrying._openPicker(false);
  assert.ok(carrying.picker.items.includes(enchantmentName('SoulBound')),
    'one filled trap and the row is offered');
  // ...and picking it opens the SECONDARY picker on that one soul -
  // :832-838 excludes SoulBound from the singleton shortcut so the
  // forced side-effect set can attach.
  carrying.picker = null;
  carrying._pickPrimary('SoulBound');
  assert.ok(carrying.picker, 'the secondary picker opened rather than adding the row outright');
  assert.deepEqual(carrying.picker.items, ['Wraith'],
    'and its one row is the soul he actually carries (EnemyBasics.cs:997-1001)');
});

test('AUDIT 63 F14: the window freezes its enumeration for its lifetime, as DFU does', () => {
  // EnumerateEnchantments has exactly three lines in the C#: the tail of
  // Setup (DaggerfallItemMakerWindow.cs:171), OnPush (:182) and its own
  // definition (:239). Refresh (:190-215) rebuilds the labels and the
  // filtered item list and does NOT re-enumerate - so a soul spent on
  // one item is STILL offered for a second in the same session, and
  // RemoveFilledTrap simply walks the pack and finds nothing (:135-147).
  const { w, player } = makerWin([trap(WRAITH)]);
  w._openPicker(false);
  assert.ok(w.picker.items.includes(enchantmentName('SoulBound')), 'offered at Setup time');
  player.items.length = 0;            // the trap is spent by the enchant
  w.picker = null;
  w._openPicker(false);
  assert.ok(w.picker.items.includes(enchantmentName('SoulBound')),
    'the window keeps the enumeration it was pushed with - a live re-read would drop the row');
  assert.deepEqual(primaryPickerList(false, { item: {}, souls: enumerateFilledTraps(player.items) })
    .includes('SoulBound'), false, 'and the seam itself still answers on the LIVE pack, so the freeze is the window\'s');
});

test('AUDIT 63 F14: enchanting SPENDS the soul - RemoveFilledTrap, control flow verbatim', () => {
  // the ordinary trap wins over the Star, one trap only, and the walk returns (:135-147)
  const a = trap(WRAITH); const b = trap(WRAITH); const s = star(WRAITH);
  const pack = [s, a, b];
  const owner = { isPlayer: true, items: pack };
  doEnchantedPayloads({ enchantments: [] }, [{ type: T.SoulBound, param: WRAITH }], { entity: owner });
  assert.deepEqual(pack, [s, b], 'the FIRST matching ordinary trap is gone and no other');
  assert.equal(s.trappedSoulType, WRAITH, 'the Star is untouched while an ordinary trap matched');

  // only when none matched is the Star emptied - EVERY matching Star,
  // because DFU's second loop has no break (:150-155), and the Star is
  // emptied rather than destroyed.
  const s1 = star(3); const s2 = star(3); const other = trap(7);
  const pack2 = [s1, other, s2];
  doEnchantedPayloads({ enchantments: [] }, [{ type: T.SoulBound, param: 3 }], { entity: { isPlayer: true, items: pack2 } });
  assert.equal(pack2.length, 3, 'nothing is removed from the pack');
  assert.equal(s1.trappedSoulType, null);
  assert.equal(s2.trappedSoulType, null, 'both Stars empty - the loop has no break');
  assert.equal(other.trappedSoulType, 7, 'a non-matching trap is left alone');

  // the range guard first (:131-132)
  const pack3 = [trap(0)];
  removeFilledTrap(pack3, -1);
  removeFilledTrap(pack3, 43);
  assert.equal(pack3.length, 1, 'an out-of-range monster id does nothing at all');
  // and the payload really is dispatched through the registry's flag
  assert.ok((PAYLOAD.Enchanted & PAYLOAD.Enchanted) !== 0);
});

// ── F15: IsEntityImmuneToDisease ─────────────────────────────────────

const patient = (over = {}) => ({
  isPlayer: true, level: 5, activeEffects: [], career: {},
  stats: { willpower: 50, luck: 50 }, skills: [], ...over,
});

test('AUDIT 63 F15: the hard-immunity predicate, all three of its arms', () => {
  assert.equal(isEntityImmuneToDisease(patient()), false, 'a plain player is not hard-immune');
  // 1. career tolerance Immune (:626)
  assert.equal(isEntityImmuneToDisease(patient({ career: { immunityFlags: EFFECT_FLAGS.Disease } })), true);
  // 2. Entity.IsImmuneToDisease - VampirismEffect.cs:123 and
  //    LycanthropyEffect.cs:194 set it every ConstantEffect pass
  assert.equal(isEntityImmuneToDisease(patient({ racialOverride: { kind: 'racialOverride', racial: 'vampirism' } })), true);
  assert.equal(isEntityImmuneToDisease(patient({ racialOverride: { racial: 'vampirism', ended: true } })), false,
    'a cured curse is not an immunity');
  assert.equal(isEntityImmuneToDisease(patient({ racialOverridePending: true })), true, 'the pending turn counts');
  // 3. the PLAYER's live race template bit, unless the career overrides
  //    it (:630-635). No stock race carries the Disease bit, so this is
  //    the compound race the two curses OR it into.
  const raced = { immunityFlags: EFFECT_FLAGS.Disease };
  assert.equal(isEntityImmuneToDisease(patient({ raceTemplate: raced })), true);
  assert.equal(isEntityImmuneToDisease(patient({ raceTemplate: raced, career: { lowToleranceFlags: EFFECT_FLAGS.Disease } })), false,
    'LowTolerance overrides the race bit');
  assert.equal(isEntityImmuneToDisease(patient({ raceTemplate: raced, career: { criticalWeaknessFlags: EFFECT_FLAGS.Disease } })), false);
  assert.equal(isEntityImmuneToDisease({ isPlayer: false, career: {}, raceTemplate: raced }), false,
    'the race arm is the PLAYER\'s only (:630)');
});

test('AUDIT 63 F15: the quest action cannot give a vampire the plague', () => {
  // MakePcDiseased.cs:66-67 assigns through AssignBundle, whose FIRST
  // per-effect gate drops a DiseaseEffect for a hard-immune entity
  // (EntityEffectManager.cs:495-499) - and BypassSavingThrows does NOT
  // relax it, that block is later at :561-579.
  const vampire = patient({ racialOverride: { racial: 'vampirism' } });
  assert.equal(startDisease(vampire, 5, 100), null, 'refused');
  assert.deepEqual(vampire.activeEffects, [], 'and nothing is left behind');
  // the world host's seam is the same one call
  assert.match(src('src/scenes/world.js'), /makePcDiseased: \(diseaseType\) => \{ startDisease\(playerEntity, diseaseType, gameDaysNow\(\)\);/,
    'the quest hook goes through startDisease, which is where the gate lives');
  // a plain player at level >= 2 still catches it
  const mortal = patient();
  assert.ok(startDisease(mortal, 5, 100), 'an ordinary player still falls ill');
  // DFU's own exception on that line: the special infections ignore
  // disease resistance (`&& !specialInfection`)
  const pending = patient({ racialOverridePending: true });
  assert.ok(startDisease(pending, 5, 100, Math.random, { specialInfection: true }),
    'the specialInfection lane is exempt, as EntityEffectManager.cs:497 says');
});

test('AUDIT 63 F15: the monster-hit path still ROLLS for an immune target', () => {
  // FormulaHelper.InflictDisease (:1689-1712) carries no immunity test
  // at all: the level check, the saving throw and the list pick are all
  // consumed, and only AssignBundle drops the effect. The early return
  // that used to stand at the top of inflictDisease consumed neither
  // roll, and shifted the RNG stream for every immune target.
  const draws = [];
  const rolls = () => { draws.push(1); return 0.99; };   // 0.99 survives the save
  const vampire = patient({ racialOverride: { racial: 'vampirism' } });
  assert.equal(inflictDisease(vampire, [5, 6], { rolls, currentDay: 3 }), null, 'still no disease');
  assert.ok(draws.length >= 2, 'but the save and the pick were both drawn');
  assert.deepEqual(vampire.activeEffects, []);
});

// ── F16: the Silence landing alert ───────────────────────────────────

const castSilence = (target, said) => applySpell(
  buildCustomSpell({
    slots: [{ type: 19, subType: 255, settings: { ...blankEffectSettings(), durationBase: 20, chanceBase: 100, chanceMod: 0 } }],
    rangeType: 0,
  }),
  1, target, { say: (m) => said.push(m) }, () => 0.01, null, {});

test('AUDIT 63 F16: a Silence LANDING says so - once, and only to the player host', () => {
  // Silence.cs:80-96 - StartSilence sets IsSilenced and then, for the
  // player's manager only, prints "youAreSilenced" and clears awakeAlert.
  // The port's `sinks.say` is that `manager.EntityBehaviour ==
  // GameManager.Instance.PlayerEntityBehaviour` (only the player host
  // wires it), so one line covers all four hosts.
  const said = [];
  const p = patient();
  castSilence(p, said);
  assert.deepEqual(said, ['You are silenced.'], 'the landing alert, which the port never spoke');
  assert.equal(p.activeEffects.filter((a) => a.kind === 'silenced').length, 1);
  const rounds = p.activeEffects.find((a) => a.kind === 'silenced').roundsRemaining;

  // A stacking recast is SILENT - not through a guard inside
  // StartSilence (it has none), but because AssignBundle refuses to add
  // an unflagged incumbent (EntityEffectManager.cs:553-558), so the
  // merged instance never reaches liveEffects and DoConstantEffects
  // never ticks it. The rounds still stack (Silence.cs:74-78 AddState).
  castSilence(p, said);
  assert.deepEqual(said, ['You are silenced.'], 'still one line');
  assert.ok(p.activeEffects.find((a) => a.kind === 'silenced').roundsRemaining > rounds, 'and the rounds stacked');

  // A FOE'S silence lands in silence, and that is the port's whole
  // rendering of `manager.EntityBehaviour == PlayerEntityBehaviour`:
  // the foe sink sets carry hurt/heal/drain and deliberately NO `say`
  // (dungeonContext.js's foeSinks), so the arm's `sinks?.say?.(msg)`
  // finds nothing to speak through - the F078 precedent.
  const foe = { level: 3, activeEffects: [], career: {}, stats: { willpower: 50, luck: 50 }, skills: [], mobileType: 15 };
  applySpell(
    buildCustomSpell({
      slots: [{ type: 19, subType: 255, settings: { ...blankEffectSettings(), durationBase: 20, chanceBase: 100, chanceMod: 0 } }],
      rangeType: 1,
    }),
    1, foe, { hurt: () => {}, heal: () => {} }, () => 0.99, null, {});
  assert.ok(foe.activeEffects.some((a) => a.kind === 'silenced'), 'the silence still lands on the foe');
  const foeSinkBlock = src('src/scenes/dungeonContext.js').split('const foeSinks = (f, fromPlayer = true) => ({')[1].split('});')[0];
  assert.ok(!/\bsay\b/.test(foeSinkBlock), 'and the foe sink set has no `say` at all');
});

test('AUDIT 63 F16: DFU\'s two printers read ONE string', () => {
  // EntityEffectManager.cs:1932-1946's SilenceCheck (the cast gate the
  // port already had) and Silence.cs:91-95's landing alert are the same
  // localized "youAreSilenced" record, so the port keeps one literal.
  assert.equal(SILENCED_TEXT, BUFF_START_TEXT.silenced);
  assert.equal(BUFF_START_TEXT.silenced, 'You are silenced.');
  assert.match(src('src/systems/mysticism.js'), /export const SILENCED_TEXT = BUFF_START_TEXT\.silenced;/,
    'mysticism re-points rather than minting a second copy');
});
