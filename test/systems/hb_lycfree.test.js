// HB-LYCFREE (2026-09-30, Mac: "Lycanthropy costs to cast from hotbar when it shouldnt. Also want to make the hotbar
// the default on option."): TWO THINGS.
//
//   - THE CURSE'S SPELL IS FREE FROM THE BAR AS FROM THE BOOK. The book readies the lycanthrope's Lycanthropy spell with DFU's
//     noSpellPointCost (DaggerfallSpellBookWindow's cast: `noSpellPointCost = spellSettings.Tag ==
//     PlayerEntity.lycanthropySpellTag`), and the port's two books pass it (`{ noSpellPointCost }` -> readySpell's
//     `free`). The hotbar's spell key, and the diamond's spell key under it, went to the engine without it, so the same
//     spell cost its flat 5 spell points from the bar and was refused at 0. Driven through the REAL cast engine
//     (createPlayerMagic) and the REAL hotbar model, as test/systems/qs6_spellslot.test.js drives the spell slot.
//   - THE HOTBAR IS THE DEFAULT. The Quick slots row's shelf default and its lane's default are Hotbar; a stored
//     Diamond or Off is the player's own answer and stays (PREF1's shelf stores only what differs from the default).
//     A shelf from before (rev 1) that chose Off stored `quickslots: false` alone, so it is read as Off once more.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as HB from '../../src/systems/quickslots.js';
import { createPlayerMagic } from '../../src/scenes/hostMagic.js';
import { calculateCastCost } from '../../src/systems/spellcost.js';
import { LYCANTHROPY_SPELL_TAG, LYCANTHROPY_SPELL_ID } from '../../src/systems/lycanthropy.js';
import { getPref, setPref, _resetForTests, loadPrefs, PREF_DEFAULTS, overridesOf } from '../../src/systems/uiPrefs.js';
import { quickSlotsRead, quickSlotsWrite, QUICK_SLOTS_DEFAULT } from '../../src/systems/featureLanes.js';
import { FEATURES } from '../../src/systems/features.js';
import { hotbarMode } from '../../src/ui/enhanced/enhancedHotbar.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

// ── the fixtures ─────────────────────────────────────────────────────

const fx = (type, subType = 0, mag = 20) => ({
  type, subType,
  magnitudeBaseLow: mag, magnitudeBaseHigh: mag, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
  durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 100, chanceMod: 0, chancePerLevel: 1,
});
/** A CasterOnly spell, so the ready casts on the spot and the spend is visible at the press (SetReadySpell :350-351).
 *  Heal Health stands in for MorphSelf: the price is the tag's law, not the effect's, and a headless run has no
 *  SPELLS.STD for grantLycanthropySpell to read. The fields beside it are the ones grantLycanthropySpell adds. */
const lycSpell = () => ({ name: 'Lycanthropy', index: LYCANTHROPY_SPELL_ID, element: 4, rangeType: 0, effects: [fx(10, 8)],
  tag: LYCANTHROPY_SPELL_TAG, custom: true, minimumCastingCost: true });
const balm = () => ({ name: 'Balyna\'s Balm', index: 90, element: 4, rangeType: 0, effects: [fx(10, 8)] });

/** The player, and a REAL cast engine over them - test/systems/qs6_spellslot.test.js's rig. */
function rig({ spells = [], magicka = 100, maxMagicka = 100 } = {}) {
  const said = [];
  const player = {
    isPlayer: true, level: 5, career: {}, activeEffects: [], stats: {}, skills: {},
    magicka, maxMagicka, health: 50, maxHealth: 50, items: [{ group: 'MiscItems', templateIndex: 3, name: 'Spellbook' }], spells,
    equip: { slots: {} },
  };
  const magic = createPlayerMagic({
    renderer: { createBillboardBatch: () => ({ origin: null }), destroyBillboardBatch: () => {} },
    audio: { playOneShot() {}, play3d() {}, playOneShotId() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }),
    uploadRecord() {}, uploadRecordFrame() {},
    collider: { raycast: () => Infinity },
    playerEntity: player,
    playerSinks: { hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say: (l) => said.push(l) },
    say: (l) => said.push(l),
    surfacePlayer() {},
    foes: () => [],
    foeSinks: () => ({ hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} }),
    absorbCtx: () => ({ inside: true, day: false }),
    rolls: () => 0.5,
  });
  return { player, magic, said };
}

/** The bar's spell key, with the host's own door behind it (world.js / exterior.js / dungeonContext.js quickSpell). */
const pressBar = (i, r) => HB.hotbarPress(i, {
  entity: r.player,
  doors: { quickSpell: () => HB.spellQuickslotPress({ entity: r.player, magic: r.magic, say: (l) => r.said.push(l) }) },
  say: (l) => r.said.push(l),
});

const reset = () => { HB.clearQuickslots(); HB.resetQuickslotHolds(); };

// ── THE CURSE'S SPELL ────────────────────────────────────────────────

test('HB-LYCFREE: the Lycanthropy spell cast from the hotbar spends no spell points, as it spends none from the book; any other spell from the bar still pays (mutants: the bar\'s ready without the free flag; every bar spell free)', () => {
  reset();
  const lyc = lycSpell();
  const r = rig({ spells: [balm(), lyc], magicka: 200, maxMagicka: 200 });   // the Balm's 110 within reach
  const price = calculateCastCost(lyc, r.player).sp;
  assert.ok(price > 0, 'the spell HAS a price the engine would charge - the fixture reproduces the report');

  assert.equal(HB.setHotbarSlot(0, HB.hotbarEntryForSpell(lyc)), true);
  const out = pressBar(0, r);
  assert.equal(out.kind, 'spell', 'the press cast, flashed as a cast');
  assert.equal(r.player.magicka, 200, 'the curse\'s spell took nothing from the pool');
  assert.ok(!r.said.includes('You don\'t have the spell points.'));

  // A spell that is not the curse's is priced as ever from the same bar.
  assert.equal(HB.setHotbarSlot(1, HB.hotbarEntryForSpell(r.player.spells[0])), true);
  pressBar(1, r);
  assert.equal(r.player.magicka, 200 - calculateCastCost(r.player.spells[0], r.player).sp, 'Balyna\'s Balm paid its price');
});

test('HB-LYCFREE: with an empty pool the Lycanthropy spell still casts from the hotbar - the refusal was the report\'s other face (mutant: the cost gate run on a free ready)', () => {
  reset();
  const lyc = lycSpell();
  const r = rig({ spells: [lyc], magicka: 0 });
  HB.setHotbarSlot(0, HB.hotbarEntryForSpell(lyc));
  const out = pressBar(0, r);
  assert.equal(out.kind, 'spell');
  assert.ok(!r.said.includes('You don\'t have the spell points.'), 'no refusal in DFU\'s words');
  assert.equal(r.player.magicka, 0);
});

test('HB-LYCFREE: the diamond\'s spell key readies the Lycanthropy spell free too - the one performer both bars reach (mutant: only the hotbar branch passing the flag)', () => {
  reset();
  const lyc = lycSpell();
  const r = rig({ spells: [lyc], magicka: 0 });
  HB.setSpellQuickslot(lyc);
  HB.spellQuickslotPress({ entity: r.player, magic: r.magic, say: (l) => r.said.push(l) });
  assert.ok(!r.said.includes('You don\'t have the spell points.'));
  assert.equal(r.player.magicka, 0);
});

test('HB-LYCFREE: the free flag is keyed on the TAG, the books\' own test - one law, the books\' and the bar\'s', () => {
  const q = read('src/systems/quickslots.js');
  assert.match(q, /const freeReady = \(sp\) => \(\{ free: sp\?\.tag === LYCANTHROPY_SPELL_TAG \}\);/);
  assert.equal((q.match(/magic\?\.readySpell\?\.\(r\.spell, freeReady\(r\.spell\)\)/g) ?? []).length, 2, 'both arms of the press');
  assert.equal((q.match(/magic\?\.readySpell\?\.\(r\.spell\)/g) ?? []).length, 0, 'no priced ready of the slot\'s spell left');
  for (const f of ['src/ui/enhanced/enhancedSpellbook.js', 'src/ui/spellbookWindow.js']) assert.match(read(f), /noSpellPointCost: [a-z.?]*spell\??\.tag === LYCANTHROPY_SPELL_TAG/, f);
});

// ── THE DEFAULT ──────────────────────────────────────────────────────

test('HB-LYCFREE: the hotbar is the default - the shelf\'s, the lane\'s and the row\'s own, and a fresh shelf reads it (mutants: the lane left at Diamond; the shelf left at quickbar)', () => {
  _resetForTests();
  globalThis.localStorage?.clear?.();
  const row = FEATURES.find((f) => f.id === 'quick-slots');
  assert.equal(row.control.initial, 'hotbar');
  assert.equal(PREF_DEFAULTS.quickbarStyle, 'hotbar');
  assert.equal(QUICK_SLOTS_DEFAULT, 'hotbar');
  assert.equal(getPref('quickbarStyle'), 'hotbar');
  assert.equal(hotbarMode(), true);
  assert.equal(quickSlotsRead(), 'hotbar');
});

test('HB-LYCFREE: Diamond and Off are still the player\'s to choose, and are kept as choices; Hotbar is the default and stores nothing (mutant: Diamond written as the default so the shelf drops it)', () => {
  _resetForTests();
  quickSlotsWrite('diamond');
  assert.equal(quickSlotsRead(), 'diamond');
  // DIAMOND-HB (PIN MOVED): Diamond is the hotbar's four now, its own style ('diamond'), not QS's 'quickbar'
  assert.equal(overridesOf({ ...PREF_DEFAULTS, quickbarStyle: getPref('quickbarStyle') }).quickbarStyle, 'diamond', 'the choice is on the shelf');
  quickSlotsWrite('off');
  assert.equal(quickSlotsRead(), 'off');
  quickSlotsWrite('hotbar');
  assert.equal(quickSlotsRead(), 'hotbar');
  assert.equal(overridesOf({ ...PREF_DEFAULTS, quickbarStyle: 'hotbar' }).quickbarStyle, undefined, 'the default is not a choice');
  setPref('quickbarStyle', 'hotbar'); setPref('quickslots', true);
});

// ── THE SHELVES FROM BEFORE ──────────────────────────────────────────

const KEY = 'dagger.ui.v1';
/** A storage over one shelf, loaded as a boot loads it (test/systems/pref1_shelf.test.js's shape). */
function withShelf(blob, fn) {
  const store = new Map(blob ? [[KEY, JSON.stringify(blob)]] : []);
  const was = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  try { _resetForTests(); loadPrefs(); return fn(() => JSON.parse(store.get(KEY) ?? '{}')); }
  finally { globalThis.localStorage = was; _resetForTests(); }
}

test('HB-LYCFREE: a rev-1 shelf that turned the quick slots Off stays Off; one that never chose, or chose Diamond, gets the hotbar (mutants: the migration dropped; it run on any shelf without the style)', () => {
  withShelf({ quickslots: false, _rev: 1 }, () => assert.equal(quickSlotsRead(), 'off', 'the player\'s Off, kept'));
  withShelf({ showFps: true, _rev: 1 }, () => assert.equal(quickSlotsRead(), 'hotbar', 'never chose: the new default'));
  withShelf({ skin: 'enhanced' }, () => assert.equal(quickSlotsRead(), 'hotbar', 'an unstamped shelf without an Off: the default'));
  withShelf(null, () => assert.equal(quickSlotsRead(), 'hotbar', 'no shelf at all: the default'));
});

test('HB-LYCFREE: the kept Off is written as a choice at the next save, and a rev-2 shelf is trusted whole - the Hotbar chosen after it is never taken back (mutant: the migration read on a rev-2 shelf)', () => {
  withShelf({ quickslots: false, _rev: 1 }, (shelf) => {
    setPref('showFps', true);   // any save
    assert.deepEqual([shelf()._rev, shelf().quickbarStyle, shelf().quickslots], [2, 'quickbar', false], 'stamped rev 2 with the Off spelt out');
  });
  withShelf({ quickslots: false, _rev: 2 }, () => assert.equal(quickSlotsRead(), 'hotbar', 'rev 2: `quickslots: false` under the default style is the hotbar'));
  withShelf({ quickslots: false, _rev: 1 }, (shelf) => {
    quickSlotsWrite('hotbar');
    assert.equal(shelf()._rev, 2);
    _resetForTests(); loadPrefs();
    assert.equal(quickSlotsRead(), 'hotbar', 'the reload keeps the Hotbar the player just chose');
  });
});
