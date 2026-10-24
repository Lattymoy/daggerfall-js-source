// MOD-ORDER (2026-10-22) - THE TEXTURE MODS' LOAD ORDER, SET BY HAND.
//
// DFU's mod window moves a mod one place up or down (ModLoaderInterfaceWindow.cs IncreaseLoadOrderButton_OnMouseClick /
// DecreaseLoadOrderButton_OnMouseClick) and keeps each mod's place as its LoadPriority (SaveAndCloseButton_OnMouseClick:
// `mod.LoadPriority = i`, then SortMods). The port had no mod window, so its order was always AutoSortMods' over the
// listing by file name (VE1), and a player could not put one mod over another: a player asked for it on the Discord, and
// DREAM's Mod Compatibility Patch must load after DREAM. The packs card now moves a mod up and down; the order is kept on
// the prefs shelf (`dfmodOrder`), AutoSortMods still loads a mod after its base, and "Sort automatically" is DFU's
// AutoSortMods again. bible/07-Rendering/Vanilla-Enhanced.md MOD-ORDER; the mutants are tools/mutants/modorder.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  setDfmodSources, attachedDfmods, dfmodLoadOrder, dfmodFileName, buildDfmodIndex, noteDfmodAttached, dfmodGeneration,
  dfmodCanMove, moveDfmod, dfmodOrderSetByHand, sortDfmodsAutomatically, DFMOD_ORDER_PREF, DFMOD_OFF_PREF, DFMOD_SHIPPED_PREF,
  _resetDfmodForTests,
} from '../../src/systems/dfmodTextures.js';
import { installVanillaEnhancedPack } from '../../src/systems/vanillaEnhanced/vanillaEnhancedPack.js';
import { VE_BASE_GUID } from '../../src/systems/vanillaEnhanced/vanillaEnhanced.js';
import { preloadTextureRecord, clearTextureReplacements } from '../../src/systems/textureReplacement.js';
import { setValue } from '../../src/systems/settings/settings.js';
import { getPref, setPref } from '../../src/systems/uiPrefs.js';

const src = (rel) => readFileSync(new URL(`../../src/${rel}`, import.meta.url), 'utf8');
const enc = (t) => new TextEncoder().encode(t);

/** A fake bundle in unityBundleClient's shape (ve1_vanillaEnhanced.test.js's, without arrays): textures
 *  `[name, w, h]`, the manifest carrying `deps` as ModInfo.Dependencies. */
function fakeMod(title, { deps = [], textures = [], guid = title } = {}) {
  const manifest = JSON.stringify({
    ModTitle: title, ModVersion: '1.0', ModAuthor: 'an author', GUID: guid,
    Dependencies: deps.map(([Name, IsOptional = false, IsPeer = false]) => ({ Name, IsOptional, IsPeer })),
  });
  return {
    textAssets: [{ name: `${title}.dfmod`, bytes: enc(manifest), get text() { return manifest; } }],
    textures: textures.map(([name, w, h]) => ({ name, width: w, height: h, format: 4 })),
    arrays: [],
    rgba: async (name) => { const t = textures.find((x) => x[0] === name); return t ? { width: t[1], height: t[2], data: new Uint8Array(t[1] * t[2] * 4).fill(200) } : null; },
    layers: async () => null,
    close() {},
  };
}

/** The mods registered as a boot registers them from the store (indexed as an attach indexes them); `shipped` puts the
 *  port's own pack in the door first and attaches each mod as the packs card does. */
async function register(mods, { shipped = false } = {}) {
  _resetDfmodForTests();
  if (shipped) {
    installVanillaEnhancedPack();
    for (const [k, b] of Object.entries(mods)) noteDfmodAttached(k, buildDfmodIndex(b));
  }
  await setDfmodSources(Object.keys(mods), async (k) => (mods[k] ? enc(k) : null), {
    open: async (bytes) => mods[new TextDecoder().decode(bytes)], background: false,
  });
}
const names = () => attachedDfmods().map((m) => m.fileName);

function fresh() {
  setValue('Enhancements', 'AssetInjection', 'True');
  setPref(DFMOD_OFF_PREF, []);
  setPref(DFMOD_SHIPPED_PREF, {});
  setPref(DFMOD_ORDER_PREF, []);
  clearTextureReplacements();
}

const A = 'dfmod/a.dfmod', B = 'dfmod/b.dfmod', C = 'dfmod/c.dfmod';

test('MOD-ORDER the law: the mods the player placed load first, in the order placed, and the rest after them by file name; AutoSortMods still loads a mod after its base; a place whose mod is gone holds nothing (mutants: the order ignored; the unplaced put first)', () => {
  const m = (name, deps = []) => ({ key: `dfmod/${name}.dfmod`, index: { deps } });
  const order = (mods, placed) => dfmodLoadOrder(mods, placed.map((n) => `dfmod/${n}.dfmod`)).map((x) => dfmodFileName(x.key));
  assert.deepEqual(order([m('c'), m('a'), m('b')], []), ['a', 'b', 'c'], 'nothing placed: DFU\'s listing by file name (VE1)');
  assert.deepEqual(order([m('a'), m('b'), m('c')], ['c', 'a']), ['c', 'a', 'b'], 'the placed in their order, then the rest');
  assert.deepEqual(order([m('a'), m('b'), m('c'), m('d')], ['d']), ['d', 'a', 'b', 'c'], 'the rest keep the listing\'s order among themselves');
  assert.deepEqual(order([m('a', [['c', false, false]]), m('b'), m('c')], ['a', 'b', 'c']), ['c', 'a', 'b'],
    'a base placed below its add-on still loads first: TopologicalSort runs over the order by hand');
  assert.deepEqual(order([m('a'), m('b')], ['gone', 'b']), ['b', 'a'], 'a removed mod\'s key holds no place');
  assert.deepEqual(dfmodLoadOrder([m('b'), m('a')]).map((x) => dfmodFileName(x.key)), ['a', 'b'], 'no order is the default one');
});

test('MOD-ORDER through the door: Move up puts a mod before its neighbour, the other is drawn over it at once, the order is kept on the prefs shelf and read back at the next boot; a mod attached later loads last; Sort automatically is DFU\'s AutoSortMods again (mutants: the move not saved; the doors not put back; the boot not reading the order; the sort not forgetting it)', async () => {
  fresh();
  const mods = {
    [A]: fakeMod('A', { textures: [['403_5-0', 4, 4]] }),
    [B]: fakeMod('B', { textures: [['403_5-0', 9, 9]] }),
    [C]: fakeMod('C', { textures: [['210_1-0', 2, 2]] }),
  };
  await register(mods);
  assert.deepEqual(names(), ['a', 'b', 'c']);
  assert.equal((await preloadTextureRecord(403, 5, 0)).width, 9, 'b loads after a, so its 403_5-0 is drawn');
  assert.equal(dfmodOrderSetByHand(), false, 'nothing moved: the automatic order');
  assert.equal(dfmodCanMove(A, -1), false, 'the first mod cannot move up');
  assert.equal(dfmodCanMove(C, 1), false, 'the last mod cannot move down');
  assert.equal(moveDfmod(C, 1), false);
  assert.equal(moveDfmod(A, 2), false, 'a move is one place: never two, though there is a mod two places down');
  assert.deepEqual(getPref(DFMOD_ORDER_PREF), [], 'a move that did nothing writes nothing');

  const gen = dfmodGeneration();
  assert.equal(dfmodCanMove(B, -1), true);
  assert.equal(moveDfmod(B, -1), true);
  assert.deepEqual(names(), ['b', 'a', 'c']);
  assert.deepEqual(getPref(DFMOD_ORDER_PREF), [B, A, C], 'the whole order, on the prefs shelf');
  assert.ok(dfmodGeneration() > gen, 'the doors are put back at once');
  assert.equal((await preloadTextureRecord(403, 5, 0)).width, 4, 'a now loads after b: its picture is drawn');
  assert.equal(dfmodOrderSetByHand(), true);

  // the next boot registers from the store and reads the order back
  await register(mods);
  assert.deepEqual(names(), ['b', 'a', 'c'], 'the order outlives a boot');
  assert.equal((await preloadTextureRecord(403, 5, 0)).width, 4);
  // a mod attached after the player set the order is not in it: it loads last, over the rest, until it is moved
  await register({ ...mods, 'dfmod/0.dfmod': fakeMod('Zero', { textures: [['403_5-0', 7, 7]] }) });
  assert.deepEqual(names(), ['b', 'a', 'c', '0']);
  assert.equal((await preloadTextureRecord(403, 5, 0)).width, 7);
  await register(mods);

  // Sort automatically: ModManager.AutoSortMods over the listing by file name - the order by hand is forgotten
  const before = dfmodGeneration();
  sortDfmodsAutomatically();
  assert.deepEqual(names(), ['a', 'b', 'c']);
  assert.deepEqual(getPref(DFMOD_ORDER_PREF), []);
  assert.ok(dfmodGeneration() > before, 'the doors are put back at once');
  assert.equal((await preloadTextureRecord(403, 5, 0)).width, 9);
  assert.equal(dfmodOrderSetByHand(), false);
  // an order by hand that equals the automatic one is not "set by hand": Sort automatically would change nothing
  moveDfmod(B, -1); moveDfmod(B, 1);
  assert.deepEqual(names(), ['a', 'b', 'c']);
  assert.equal(dfmodOrderSetByHand(), false);
});

test('MOD-ORDER a mod never moves above its base - the move that AutoSortMods would undo is not offered, and writes nothing; a move passes over a mod the list does not show (mutants: the undone move offered; the hidden mod not passed over)', async () => {
  fresh();
  const BASE = 'dfmod/zz base.dfmod', ADDON = 'dfmod/aa addon.dfmod', OTHER = 'dfmod/mm other.dfmod';
  await register({
    [BASE]: fakeMod('Base', { textures: [['403_5-0', 4, 4]] }),
    [ADDON]: fakeMod('Addon', { deps: [['zz base']], textures: [['403_5-0', 8, 8]] }),
    [OTHER]: fakeMod('Other', { textures: [['210_1-0', 2, 2]] }),
  });
  assert.deepEqual(names(), ['zz base', 'aa addon', 'mm other'], 'VE1: the add-on after its base');
  assert.equal(dfmodCanMove(ADDON, -1), false, 'above its own base: AutoSortMods would put it back');
  assert.equal(dfmodCanMove(BASE, 1), false, 'the same move from the base\'s side');
  assert.equal(moveDfmod(ADDON, -1), false);
  assert.deepEqual(getPref(DFMOD_ORDER_PREF), []);
  assert.equal(dfmodCanMove(OTHER, -1), true, 'a mod with no tie to the add-on moves past it');
  // the packs card lists the texture mods alone (the lighting mod has a section of its own): a move is past the
  // neighbour the player SEES, not past a mod the list hides
  const shown = [BASE, OTHER];
  assert.equal(moveDfmod(OTHER, -1, shown), true);
  assert.deepEqual(names(), ['mm other', 'zz base', 'aa addon'], 'past the base it sees, and so past the hidden add-on too');
});

test('MOD-ORDER one place a mod: a copy the player attaches over a shipped mod is kept in the order under the shipped mod\'s key, as AUDIT VE R3 keeps one switch - the next boot gives the copy that place, and with the copy removed the shipped mod has it (mutants: the copy\'s own key saved; the shipped key not read as the copy\'s place)', async () => {
  fresh();
  const COPY = 'dfmod/vanilla enhanced - base (1).dfmod';
  const BASE = 'dfmod/vanilla enhanced - base.dfmod';
  const DREAM = 'dfmod/dream.dfmod';
  const mods = { [DREAM]: fakeMod('DREAM'), [COPY]: fakeMod('Vanilla Enhanced - Base', { guid: VE_BASE_GUID }) };
  await register(mods, { shipped: true });
  const keys = () => attachedDfmods().map((m) => m.key);
  assert.ok(keys().includes(COPY) && !keys().includes(BASE), 'the copy shadows the shipped Base (AUDIT VE R9)');
  // bounded, never `while`: a mutant whose move answers true and moves nothing must fail here, not spin
  for (let n = keys().indexOf(COPY); n > 0; n--) assert.equal(moveDfmod(COPY, -1), true);
  assert.deepEqual(keys().slice(0, 2), [COPY, DREAM], 'the copy first, DREAM after it');
  const saved = getPref(DFMOD_ORDER_PREF);
  assert.equal(saved[0], BASE, 'saved under the shipped mod\'s key');
  assert.ok(!saved.includes(COPY));
  await register(mods, { shipped: true });
  assert.deepEqual(keys().slice(0, 2), [COPY, DREAM], 'the next boot: the shipped key is the copy\'s place');
  await register({ [DREAM]: mods[DREAM] }, { shipped: true });
  assert.deepEqual(keys().slice(0, 2), [BASE, DREAM], 'the copy removed: the shipped Base is read again, in the same place');
});

test('MOD-ORDER the packs card: Move up and Move down beside the switch, offered only where the move changes the order and past the mods the card shows; Sort automatically only while the order is set by hand; says what a move does', () => {
  const menu = src('ui/enhanced/enhancedMenu.js');
  assert.match(menu, /const shown = mods\.map\(\(m\) => m\.key\);/);
  assert.ok(menu.indexOf('const shown = mods.map') > menu.indexOf('mods = mods.filter((m) => !isIilMod(m));'), 'the list the card shows: the lighting mod taken out first');
  assert.match(menu, /\.\.\.\(dfmodCanMove\(m\.key, -1, shown\) \? \[\{ label: t\('menu\.packs\.moveUp', 'Move up'\), onClick: \(\) => \{ moveDfmod\(m\.key, -1, shown\); render\(\); \} \}\] : \[\]\),/);
  assert.match(menu, /\.\.\.\(dfmodCanMove\(m\.key, 1, shown\) \? \[\{ label: t\('menu\.packs\.moveDown', 'Move down'\), onClick: \(\) => \{ moveDfmod\(m\.key, 1, shown\); render\(\); \} \}\] : \[\]\),/);
  assert.match(menu, /\.\.\.\(dfmodOrderSetByHand\(\) \? \[\{ label: t\('menu\.packs\.autoSort', 'Sort automatically'\), onClick: \(\) => \{ sortDfmodsAutomatically\(\); render\(\); \} \}\] : \[\]\),/);
  assert.match(menu, /if \(mods\.length > 1\) c\.append\(el\('p', 'meta', t\('menu\.packs\.moveNote', 'Move a mod down to draw its textures over the mods above it\.'\)\)\);/);
});
