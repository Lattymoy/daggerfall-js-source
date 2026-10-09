// ORG2 (2026-10-09, Mac: "Graphic settings needs its own tab, etc. I really need you to go all in"): ONE SETTINGS
// SCREEN FOR EVERY OPTION. Settings (DFU's 171 keys) and the Features home (the port's rows and the mods) were two doors
// over one subject; one map (ui/settingsMap.js) now places everything in a TAB, then a SECTION, and the screen draws
// every option as a row of one shape. These pins hold the map total and disjoint over all three kinds of option, the
// words every message uses for where a switch lives, the Graphics tab's quality preset, and one tab's restore.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import '../src/world/landView.js';   // RF4: the lanes register themselves
import '../src/world/outdoors.js';
import '../src/systems/featureLanes.js';
import { FEATURES, featureForControl, resolveControl } from '../src/systems/features.js';
import { CATEGORIES, CATEGORY_IDS, whereIs, optionPath, isSettingItem, keysOf } from '../src/ui/settingsMap.js';
import { GRAPHICS_PRESETS, PRESET_ROWS, presetNow } from '../src/systems/graphicsPresets.js';
import { ALL_KEYS, DEFAULTS, effectiveSettings, setValue, _resetForTests as resetSettings } from '../src/systems/settings.js';
import { getPref, setPref, PREF_DEFAULTS, _resetForTests as resetPrefs } from '../src/systems/uiPrefs.js';
import { _resetModSettings } from '../src/systems/modSettings.js';
import { _resetRenderScaleDoor } from '../src/systems/renderScale.js';
import { restAloneText } from '../src/systems/partyRestLaw.js';
import { tileStates, defaultSegment, applyGraphicsPreset, portPool, restoreTabDefaults } from '../src/ui/enhancedMenu.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const fresh = () => { resetPrefs(); resetSettings(); _resetModSettings(); _resetRenderScaleDoor(); };
const row = (id) => FEATURES.find((f) => f.id === id);
/** A preset row's value as its bar stands - the tier under the bar's segment. */
const valueOf = (id) => { const c = resolveControl(row(id)); return c.tiers[tileStates(row(id)).at][0]; };

/** Just enough of a document for the port's row builders: elements that take children, classes, data and attributes. */
function fakeDocument() {
  const make = (tag) => {
    const n = {
      tag, children: [], className: '', textContent: '', title: '', type: '', disabled: false, style: {}, dataset: {}, attrs: {},
      append(...cs) { for (const c of cs) n.children.push(c); }, prepend(...cs) { n.children.unshift(...cs); },
      setAttribute(k, v) { n.attrs[k] = v; }, addEventListener() {}, querySelectorAll: () => [],
      classList: {
        add: (c) => { n.className = `${n.className} ${c}`.trim(); },
        toggle: (c, on) => { const has = n.className.split(/\s+/).includes(c); if (on ?? !has) { if (!has) n.classList.add(c); } else n.className = n.className.split(/\s+/).filter((x) => x !== c).join(' '); },
        contains: (c) => n.className.split(/\s+/).includes(c),
      },
    };
    return n;
  };
  return { createElement: make, createTextNode: (t) => ({ textContent: t }), querySelectorAll: () => [], getElementById: () => null };
}
/** Run `fn` with a document and a window that is a touch device, so every port row the builders know is built. */
function withRows(fn) {
  globalThis.document = fakeDocument();
  globalThis.window = { location: { search: '?touch=1' }, navigator: { maxTouchPoints: 5 }, ontouchstart: null, matchMedia: () => ({ matches: true }) };
  try { return fn(); } finally { delete globalThis.document; delete globalThis.window; }
}

const SPECIAL = ['preset:graphics', 'link:overhauls', 'bindings', 'mods-index'];
const CARDS = ['card:morrowind', 'card:packs', 'card:peerSprites', 'card:nightSounds'];

test('ORG2: the map is TOTAL and DISJOINT over every option - each of DFU\'s keys, each Features row and each of the port\'s own rows stands in exactly one section of one tab (mutant: a row dropped, or placed twice)', () => {
  const seen = new Map();
  for (const t of CATEGORIES) {
    assert.ok(t.title && t.blurb && t.sections.length, `${t.id} has a title, a line and sections`);
    assert.equal(new Set(t.sections.map((s) => s.id)).size, t.sections.length, `${t.id}'s sections are named once`);
    for (const s of t.sections) {
      assert.ok(s.title && s.blurb && s.items.length, `${t.id}/${s.id} has a title, a line and something in it`);
      for (const item of s.items) {
        assert.ok(!seen.has(item), `${item} stands in ${seen.get(item)} and in ${t.id}/${s.id}`);
        seen.set(item, `${t.id}/${s.id}`);
      }
    }
  }
  const pool = withRows(() => portPool());
  for (const item of seen.keys()) {
    if (isSettingItem(item)) assert.ok(ALL_KEYS.includes(item), `${item} is mapped but is not one of DFU's keys`);
    else if (item.startsWith('feat:')) assert.ok(row(item.slice(5)), `${item} is mapped but is no Features row`);
    else if (item.startsWith('port:')) assert.ok(pool.has(item.slice(5)), `${item} is mapped but no builder draws it`);
    else assert.ok(CARDS.includes(item) || SPECIAL.includes(item), `${item} is a piece the screen does not know`);
  }
  for (const k of ALL_KEYS) assert.ok(seen.has(k), `${k} has no place - it would vanish from the screen`);
  for (const f of FEATURES) assert.ok(seen.has(`feat:${f.id}`), `${f.id} has no place - it would vanish from the screen`);
  assert.ok(pool.size >= 15, `the builders drew the port's rows (${pool.size})`);
  for (const id of pool.keys()) assert.ok(seen.has(`port:${id}`), `the port's row ${id} has no place - it would vanish from the screen`);
  for (const item of [...SPECIAL, ...CARDS]) assert.ok(seen.has(item), `${item} has a place`);
  assert.equal(CATEGORY_IDS.reduce((n, c) => n + keysOf(c).length, 0), 171);
});

test('ORG2: Graphics leads, with the preset at its head, and the tabs a player looks for in the order they look (mutant: the preset or a tab moved)', () => {
  assert.deepEqual(CATEGORY_IDS, ['graphics', 'gameplay', 'combat', 'world', 'interface', 'audio', 'controls', 'accessibility', 'mods']);
  const g = CATEGORIES[0];
  assert.deepEqual(g.sections[0].items, ['preset:graphics'], 'Quality first, the preset alone in it');
  for (const id of PRESET_ROWS) assert.equal(whereIs(`feat:${id}`)?.tab.id, 'graphics', `${id}, a row the preset sets, is on the same tab`);
  assert.equal(whereIs('feat:render-scale')?.section.id, 'display', 'the picture\'s resolution is a choice of its own, under Display');
  for (const k of ['Video/FieldOfView', 'Video/TargetFrameRate', 'Video/VSync']) assert.equal(whereIs(k)?.section.id, 'display', k);
  assert.equal(whereIs('bindings')?.tab.id, 'controls');
  assert.equal(whereIs('mods-index')?.tab.id, 'mods');
});

test('ORG2: a key a Features row owns stands in that row\'s own section - so FT13\'s "drawn by the row, never twice" is true on the page too (mutant: a moved key filed elsewhere)', () => {
  let n = 0;
  for (const k of ALL_KEYS) {
    const f = featureForControl('settings', k);
    if (!f) continue;
    n++;
    assert.equal(whereIs(k)?.section, whereIs(`feat:${f.id}`)?.section, `${k} stands beside ${f.id}`);
  }
  assert.ok(n >= 10, `the rows own keys (${n})`);
});

test('ORG2: optionPath names where an item lives, and every message that sends a player to a switch reads it (mutant: a path hard-coded, or the section dropped)', () => {
  assert.equal(optionPath('feat:grass'), 'Settings › Graphics › Plants, trees & wind');
  assert.equal(optionPath('feat:grass', { section: false }), 'Settings › Graphics');
  assert.equal(optionPath('bindings'), 'Settings › Controls › Key bindings');
  assert.equal(optionPath('no-such-item'), 'Settings', 'an item with no place still names the door');
  assert.equal(restAloneText(false), `You rest on your own. Turn on "Rest with my party" (${optionPath('card:peerSprites')}) to rest with them.`);
  for (const [file, item] of [['src/ui/holdingsPages.js', 'feat:mod-horse-cart-and-cargo'], ['src/ui/shotsPane.js', 'feat:loading-screen'],
    ['src/ui/familyPages.js', 'feat:mod-project-legacy'], ['src/ui/familyPages.js', 'feat:living-world'], ['src/scenes/fleetHost.js', 'feat:naval-combat'],
    ['src/scenes/dataSource.js', 'feat:modded-lighting'], ['src/systems/vanillaEnhanced.js', 'card:packs'], ['src/systems/partyRestLaw.js', 'card:peerSprites']]) {
    assert.ok(read(file).includes(`optionPath('${item}')`), `${file} names ${item} by the map`);
    assert.ok(whereIs(item), `${item} has a place to name`);
  }
  for (const file of ['src/systems/vanillaEnhanced.js', 'src/scenes/dataSource.js', 'src/systems/partyRestLaw.js']) {
    assert.doesNotMatch(read(file), /foot of Features|in Features &rarr;|\(Features, /, `${file} sends no one to a door that is gone`);
  }
});

test('ORG2: the graphics preset - High is how the game ships, every value is one of its row\'s own tiers, the four stand in order, and a preset written reads back as itself through the rows\' own doors (mutant: a value off its row, High off the defaults, or a lane\'s second store left behind)', () => {
  assert.deepEqual(GRAPHICS_PRESETS.map((p) => p.id), ['low', 'medium', 'high', 'ultra']);
  for (const id of PRESET_ROWS) {
    const c = resolveControl(row(id));
    assert.ok(c?.tiers, `${id} is a row with tiers`);
    for (const p of GRAPHICS_PRESETS) assert.ok(c.tiers.some(([v]) => String(v) === String(p.values[id])), `${p.id}'s ${id} is one of the row's own values`);
  }
  const view = GRAPHICS_PRESETS.map((p) => p.values['land-view-distance']);
  assert.deepEqual([...view].sort((a, b) => a - b), view, 'the further the preset, the further you see');
  assert.equal(new Set(GRAPHICS_PRESETS.map((p) => JSON.stringify(p.values))).size, 4, 'four different choices');
  fresh();
  try {
    globalThis.location = { search: '' };
    const high = GRAPHICS_PRESETS.find((p) => p.id === 'high');
    for (const id of PRESET_ROWS) {
      const st = tileStates(row(id));
      assert.equal(defaultSegment(row(id), st), st.at, `${id} stands at its default on a fresh shelf`);
      assert.equal(String(valueOf(id)), String(high.values[id]), `High is ${id}'s default`);
    }
    assert.equal(presetNow(valueOf)?.id, 'high', 'a player who never touched them reads High, not Custom');
    for (const p of GRAPHICS_PRESETS) {
      applyGraphicsPreset(p);
      assert.equal(presetNow(valueOf)?.id, p.id, `${p.id} reads back as itself`);
      for (const id of PRESET_ROWS) assert.equal(String(valueOf(id)), String(p.values[id]), `${p.id} set ${id}`);
    }
    applyGraphicsPreset(GRAPHICS_PRESETS[0]);
    assert.equal(String(effectiveSettings().Experimental.TerrainDistance), '3', 'land view\'s lane wrote DFU\'s TerrainDistance with it - the row\'s own door');
    tileStates(row('water-quality')).set(0);   // Full water on Low's mix
    assert.equal(presetNow(valueOf), null, 'a mix of the player\'s own is Custom');
  } finally { delete globalThis.location; fresh(); }
});

test('ORG2: a tab restores its own defaults and leaves every other tab as it is - its DFU keys, its Features rows and its port rows (mutant: one kind left, or another tab restored)', () => {
  fresh();
  try {
    globalThis.location = { search: '' };
    const graphics = CATEGORIES.find((c) => c.id === 'graphics');
    setValue('Video', 'FieldOfView', 90);
    setValue('Controls', 'SoundVolume', 0.25);   // Audio's
    tileStates(row('grass')).set(2);
    tileStates(row('quick-slots')).set(1);   // Interface's
    setPref('showFps', true);
    const quick = tileStates(row('quick-slots')).at;
    withRows(() => restoreTabDefaults(graphics));
    assert.equal(String(effectiveSettings().Video.FieldOfView), String(DEFAULTS.Video.FieldOfView), 'the tab\'s DFU key');
    assert.equal(tileStates(row('grass')).at, defaultSegment(row('grass'), tileStates(row('grass'))), 'the tab\'s Features row');
    assert.equal(getPref('showFps'), PREF_DEFAULTS.showFps, 'the tab\'s port row');
    assert.equal(String(effectiveSettings().Controls.SoundVolume), '0.25', 'another tab\'s key is left');
    assert.equal(tileStates(row('quick-slots')).at, quick, 'and another tab\'s row');
  } finally { delete globalThis.location; fresh(); }
});

test('ORG2 by source: one screen - the rail is the tabs and counts what each draws, the search reads every tab, the filters and the actions sit over the rows, the pause window draws the same screen, and an old door named features lands on it', () => {
  const menu = read('src/ui/enhancedMenu.js');
  const pane = menu.slice(menu.indexOf('function paneSettings('), menu.indexOf('\n}\n', menu.indexOf('function paneSettings(')));
  assert.match(pane, /for \(const cat of CATEGORIES\) \{/, 'the rail is the map\'s tabs');
  assert.match(pane, /list\.append\(optionsToolbar\(body, \{ pause \}\), body\);\s*\n\s*paintOptionsBody\(body, \{ pause \}\);/, 'the toolbar over the body');
  const paint = menu.slice(menu.indexOf('function paintOptionsBody('), menu.indexOf('\n}\n', menu.indexOf('function paintOptionsBody(')));
  assert.match(paint, /if \(q\) \{\s*\n\s*let found = 0;\s*\n\s*for \(const tab of CATEGORIES\) \{/, 'a search reads every tab, not the open one');
  assert.match(paint, /body\.append\(sectionHead\(tab, s, nodes\.filter\(isOptionNode\)\.length, \{ path: true \}\), \.\.\.nodes\);/, 'and says where each find lives');
  assert.match(paint, /if \(sections\.length >= 3 && !pause\) \{\s*\n\s*const strip = el\('nav', 'sec-jump'\);/, 'a long tab has a jump strip');
  assert.match(menu, /if \(item === 'preset:graphics'\) return \[graphicsPresetRow\(\)\];/);
  assert.match(menu, /if \(item === 'mods-index'\) return modsIndexRows\(\);/);
  assert.match(menu, /if \(optFilter !== 'all'\) \{\s*\n\s*if \(optFilter === 'changed' \? !itemChanged\(item, pool\) : !itemKinds\(item\)\.includes\(optFilter\)\) return \[\];/, 'the filters pass an item or draw nothing of it');
  assert.match(menu, /const mark = \(n\) => \{ if \(n && itemChanged\(item, pool\)\) n\.classList\.add\('changed'\); return n; \};/, 'a changed row says so');
  assert.match(menu, /if \(id === 'features'\) id = 'settings';/);
  assert.match(menu, /paneSettings\(detail, \{ pause: true \}\);/);
  // the preset writes through the rows' own states, so a row the room decides is left as it is
  const apply = menu.slice(menu.indexOf('export function applyGraphicsPreset('), menu.indexOf('\n}\n', menu.indexOf('export function applyGraphicsPreset(')));
  assert.match(apply, /if \(!st \|\| st\.locked \|\| !c\?\.tiers\) continue;/);
  assert.match(apply, /if \(i >= 0 && i !== st\.at\) st\.set\(i\);/);
  // one tab's restore leaves what the room decides, and the All off keep for Restore
  const restore = menu.slice(menu.indexOf('export function restoreTabDefaults('), menu.indexOf('\n}\n', menu.indexOf('export function restoreTabDefaults(')));
  assert.match(restore, /if \(onlineForcedSetting\(sec, k\) !== undefined\) continue;/);
  assert.match(restore, /\{ spendKeep: false \}/);
  assert.match(restore, /onlineForcedPref\(pref\) === undefined\) setPref\(pref, PREF_DEFAULTS\[pref\]\);/);
});
