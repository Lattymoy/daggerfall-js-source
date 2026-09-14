// FT0 - THE FEATURES HOME (2026-09-14, Mac: "merging mods, certain
// setting toggles and enhanced pane toggles into one universal place
// to toggle enhanceable features ... 1 home which each selection given
// 1 of 3 [labels] ... color coded labels that can be filtered ... some
// toggles can be condensed and receive 2 labels").
//
// The registry is the law: a row names a store and a key the store
// really has, wears one or more of three kinds, and the filter shows a
// two-kind row under both. Empty at FT0 - bible/10-UI/Features-Arc.md
// is the work list and rows arrive one audited slice at a time.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FEATURES, KINDS, KIND_ORDER, STORES, checkFeature, checkFeatures, filterFeatures, featureCounts, resolveControl,
} from '../src/systems/features.js';
import '../src/world/landView.js';   // RF4: the lanes register themselves; the checks read them
import '../src/world/outdoors.js';
import { PREF_DEFAULTS } from '../src/systems/uiPrefs.js';
import { ALL_KEYS } from '../src/systems/settings.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

// Fixtures built over REAL keys of each store, so a pin here fails if
// the store loses the key (the shape-the-producer-mints law).
const prefsRow = { id: 'p', title: 'P', note: 'n', kinds: ['enhanced'], control: { store: 'prefs', key: 'enhancedAI', initial: false, online: true } };   // RF4: a prefs row declares its switch
const settingsRow = { id: 's', title: 'S', note: 'n', kinds: ['classic'], control: { store: 'settings', key: 'Experimental/SmallerDungeons' } };
const modRow = { id: 'm', title: 'M', note: 'n', kinds: ['mod'], control: { store: 'mods', vendor: 'dynamic-skies', key: 'Enabled' } };
const bothRow = { id: 'b', title: 'B', note: 'n', kinds: ['enhanced', 'mod'], control: { store: 'prefs', key: 'enhancedEnvironments', initial: true, online: true } };

test('FT0: three kinds in label order, three stores, and the registry is empty and sound', () => {
  assert.deepEqual(KIND_ORDER, ['enhanced', 'mod', 'classic']);
  assert.deepEqual(KIND_ORDER.map((k) => KINDS[k].label), ['Enhanced', 'Mod Authored', 'DFU Classic'], "Mac's three labels");
  assert.deepEqual(STORES, ['prefs', 'settings', 'mods']);
  assert.deepEqual(FEATURES.map((f) => f.id), ['smaller-dungeons', 'land-view-distance', 'enhanced-environments', 'enhanced-ai', 'enhanced-water', 'grass-density', 'cloud-quality', 'enhanced-combat-visuals', 'loot-rarity', 'mod-seasons-iliac-bay', 'mod-roads-hazelnut', 'mod-meanermonsters', 'mod-pcaao', 'mod-unleveledloot', 'mod-weapon-widget', 'mod-handheld-torches', 'enemy-infighting', 'varied-dungeon-monsters', 'torches-from-items', 'combat-voices', 'near-death-warning', 'bows-left-hand', 'choose-guild-jobs', 'dungeon-wall-style'], 'FT0 shipped the home empty; FT1, FT2, FT4-FT11 moved rows in (one slice at a time); LR1 added the first row built in house');
  assert.deepEqual(checkFeatures(FEATURES), []);
});

test('FT0: a sound row passes for each store, and the fixtures ride real keys', () => {
  assert.ok(Object.hasOwn(PREF_DEFAULTS, 'enhancedAI') && Object.hasOwn(PREF_DEFAULTS, 'enhancedEnvironments'), 'RF4: the shelf derives them from the rows');
  assert.equal(typeof resolveControl, 'function');
  assert.ok(ALL_KEYS.includes('Experimental/SmallerDungeons'));
  assert.ok(MOD_SETTINGS['dynamic-skies'].keys.Enabled);
  for (const f of [prefsRow, settingsRow, modRow, bothRow]) assert.deepEqual(checkFeature(f), [], f.id);
  assert.deepEqual(checkFeatures([prefsRow, settingsRow, modRow, bothRow]), []);
});

test('FT0: every law of the row fails under a one-field mutation', () => {
  const mut = (f, patch) => checkFeature({ ...f, ...patch });
  assert.deepEqual(mut(prefsRow, { id: '' }), ['no id']);
  assert.deepEqual(mut(prefsRow, { title: '' }), ['no title']);
  assert.deepEqual(mut(prefsRow, { kinds: [] }), ['no kinds']);
  assert.deepEqual(mut(prefsRow, { kinds: ['vendored'] }), ["unknown kind 'vendored'"]);
  assert.deepEqual(mut(prefsRow, { kinds: ['enhanced', 'enhanced'] }), ['a kind repeated']);
  assert.deepEqual(mut(prefsRow, { control: null }), ['no control']);
  assert.deepEqual(mut(prefsRow, { control: { store: 'ini', key: 'enhancedAI' } }), ["unknown store 'ini'"]);
  // RF4: a prefs row IS the shelf's declaration of its key, so a typo is a new key - what a row cannot do is stay silent on its default or its online answer
  assert.deepEqual(mut(prefsRow, { control: { store: 'prefs', key: 'enhancedAI', online: true } }), ['a prefs row declares its initial value']);
  assert.deepEqual(mut(prefsRow, { control: { store: 'prefs', key: 'enhancedAI', initial: false } }), ["a prefs row declares its online answer: true, false or 'player'"]);
  assert.deepEqual(mut(prefsRow, { control: { store: 'prefs', key: 'enhancedAI', initial: false, online: 'maybe' } }), ["a prefs row declares its online answer: true, false or 'player'"]);
  assert.deepEqual(mut(prefsRow, { control: { store: 'prefs', key: 'enhancedAI', initial: false, online: 'player', lane: 'nope' } }), ["lane 'nope' is not registered"]);
  assert.deepEqual(mut(prefsRow, { control: { store: 'prefs', key: '' } }), ["prefs has no key ''"], 'an empty key is no key');
  assert.deepEqual(mut(settingsRow, { control: { store: 'settings', key: 'Experimental/SmallerDungeon' } }), ["settings has no key 'Experimental/SmallerDungeon'"]);
  assert.deepEqual(mut(modRow, { control: { store: 'mods', vendor: 'dynamic-sky', key: 'Enabled' } }), ["mods has no key 'dynamic-sky/Enabled'"]);
  assert.deepEqual(mut(modRow, { control: { store: 'mods', vendor: 'dynamic-skies', key: 'Enable' } }), ["mods has no key 'dynamic-skies/Enable'"]);
  // a choice row's tiers must include the pref's default, or the row opens on a value it cannot name
  const tiers = [[3, 'Classic'], [5, 'Far']];
  assert.deepEqual(mut(prefsRow, { control: { store: 'prefs', key: 'landViewDistance', initial: 5, online: 'player', tiers } }), []);
  assert.deepEqual(mut(prefsRow, { control: { store: 'prefs', key: 'landViewDistance', initial: 5, online: 'player', tiers: [[3, 'Classic'], [6, 'Farther']] } }), ['tiers do not include the default 5']);
  assert.deepEqual(mut(prefsRow, { control: { store: 'prefs', key: 'landViewDistance', initial: 5, online: 'player', tiers: [] } }), ['tiers is not a list']);
  assert.deepEqual(checkFeature(null), ['not an object']);
});

test('FT0: the list refuses a repeated id and two rows over one switch', () => {
  assert.deepEqual(checkFeatures([prefsRow, { ...settingsRow, id: 'p' }]), ['p: id repeated']);
  assert.deepEqual(checkFeatures([prefsRow, { ...prefsRow, id: 'p2' }]), ['p2: control repeated (prefs::enhancedAI)']);
  assert.deepEqual(checkFeatures([modRow, { ...modRow, id: 'm2' }]), ['m2: control repeated (mods:dynamic-skies:Enabled)']);
  assert.deepEqual(checkFeatures([settingsRow, { ...prefsRow, control: { ...prefsRow.control, also: [settingsRow.control] } }]), ['p: control repeated (settings::Experimental/SmallerDungeons)'], 'FT2: a covered control is a control - two rows cannot both own a key');
  assert.deepEqual(checkFeatures([{ id: 'x', title: 'X', kinds: ['nope'], control: { store: 'prefs', key: 'zzz' } }]),
    ["x: unknown kind 'nope'", 'x: a prefs row declares its initial value', "x: a prefs row declares its online answer: true, false or 'player'"], 'every problem, prefixed by the row');
});

test('FT0: the filter shows a two-kind row under both kinds, and the counts say so', () => {
  const list = [prefsRow, settingsRow, modRow, bothRow];
  assert.deepEqual(filterFeatures(list, null).map((f) => f.id), ['p', 's', 'm', 'b'], 'All');
  assert.deepEqual(filterFeatures(list, 'enhanced').map((f) => f.id), ['p', 'b']);
  assert.deepEqual(filterFeatures(list, 'mod').map((f) => f.id), ['m', 'b'], "Mac's condensed row wears both labels");
  assert.deepEqual(filterFeatures(list, 'classic').map((f) => f.id), ['s']);
  assert.notEqual(filterFeatures(list, null), list, 'a copy, never the frozen list itself');
  assert.deepEqual(featureCounts(list), { all: 4, enhanced: 2, mod: 2, classic: 1 });
  assert.deepEqual(featureCounts([]), { all: 0, enhanced: 0, mod: 0, classic: 0 });
});

test('FT0: Features is on every rail and both dispatch tables, and the pane is the registry over the three builders', () => {
  const menu = read('src/ui/enhancedMenu.js');
  for (const rail of ['SECTIONS_BOOT', 'SECTIONS_CLASSIC', 'SECTIONS_PAUSE']) {
    const m = new RegExp(`const ${rail} = \\[([^\\]]*)\\]`).exec(menu);
    assert.ok(m, rail);
    const list = m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
    assert.ok(list.includes('Features'), `${rail} carries Features`);
    assert.equal(list.indexOf('Features'), list.indexOf('Mods') - 1, `${rail}: beside Mods, whose rows it inherits`);
  }
  assert.match(menu, /\['features', 'Features'\],/, 'the pause system rail (SYSTEM_PANES)');
  assert.equal((menu.match(/features: paneFeatures,/g) ?? []).length, 2, 'both dispatch tables (boot and pause)');
  assert.match(menu, /import \{ FEATURES, KINDS, KIND_ORDER, filterFeatures, featureCounts, featureForControl, resolveControl \} from '\.\.\/systems\/features\.js';/);
  assert.match(menu, /function paneFeatures\(body\) \{[\s\S]*?featureCounts\(FEATURES\)[\s\S]*?chip\(null, 'All', counts\.all\)[\s\S]*?for \(const k of KIND_ORDER\) chips\.append\(chip\(k, KINDS\[k\]\.label, counts\[k\]\)\)/, 'All then the three kind chips, with counts');
  assert.match(menu, /if \(!FEATURES\.length\) \{\s*body\.append\(empty\('Nothing here yet'/, 'an empty registry says so - the rail-hole law - rather than hiding the section');
  assert.match(menu, /const rows = filterFeatures\(FEATURES, featureKind\);/);
  // the three builders: a row is the row its store already draws, dressed
  assert.match(menu, /function featureRow\(f\) \{[\s\S]*?c\.tiers \? choiceRow\(c\.key, f\.title, f\.note, c\.tiers, \{ home: true, read: c\.read, write: c\.write \}\) : prefRow\(c\.key, f\.title, f\.note, \{ home: true \}\)[\s\S]*?settingRow\(c\.key, \{ compact: true, home: true \}\)[\s\S]*?modRow\(c\.vendor, c\.key, MOD_SETTINGS\[c\.vendor\]\.keys\[c\.key\], \{ name: f\.title, note: f\.note, home: true \}\)/);
  assert.match(menu, /main\.prepend\(kindTags\(f\.kinds\)\);/, 'every row wears its labels');
  assert.match(menu, /function kindTags\(kinds\) \{[\s\S]*?for \(const k of KIND_ORDER\) if \(kinds\.includes\(k\)\)/, 'labels in KIND_ORDER, whatever order the row lists them');
  // modRow was lifted out of paneMods, which still draws through it - one row, two homes
  assert.match(menu, /^function modRow\(vendor, key, def, \{ name = null, note = null, home = false \} = \{\}\) \{/m);
  assert.match(menu, /for \(const \[key, def\] of Object\.entries\(mod\.keys\)\) put\(mc, modRow\(vendor, key, def\)\);/, 'the Mods pane draws the same row (FT13: and nothing for a switch that lives on the home)');
  assert.match(menu, /let featureKind = null;/, 'the chip is per-mount state like the rest');
});

test('FT0: the three kinds have three colours, all the skin\'s own tokens', () => {
  const css = read('src/ui/enhancedStyle.js');
  for (const [k, tok] of [['enhanced', '--brass'], ['mod', '--verdigris'], ['classic', '--bone']]) {
    assert.match(css, new RegExp(`\\.kind\\.${k} \\{ color: var\\(${tok}\\);`), `${k} wears ${tok}`);
    assert.match(css, new RegExp(`\\.chip\\.${k}\\.on \\{ color: var\\(${tok}\\);`), `${k}'s chip lights the same colour`);
  }
  assert.match(css, /\.chips \{ display: flex; flex-wrap: wrap;/, 'the chip row wraps on a phone');
  assert.match(css, /\.kinds \{ display: flex; flex-wrap: wrap;/, 'so do the labels');
});
