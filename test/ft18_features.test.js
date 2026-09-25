// FT18 (2026-09-25, Mac: "Add option to set all mods/enhancements off", "Add search bar to mods/enhancements in the
// ingame pause menu", "Lets do a comprehensive reorganize and consolidation of our mod/enhancements. Determine toggles
// that dont need to exist anymore or ways to clean up"). The Features home, reorganized:
//   - TEN ROWS ARE FOUR. Grass (density + style), wind (sway + wisps), quick slots (the diamond + quickbar-or-hotbar)
//     and blood (marks + overkill + lens + gore): one bar each, the rest PARTS in the tile's drawer. No key, default
//     or consumer changed - the rows that are gone are declared on the row that covers them (`also`).
//   - TWO GROUPS MORE: Interface (what is drawn over the world) and Sound (what you hear).
//   - ALL OFF, AND RESTORE: every switch to Off, a row with no Off to Daggerfall's own (`classic`), kept so Restore
//     can put it back; a choice with neither stays, and online the room's rows are not touched.
//   - THE SEARCH: words over the title, the note, the labels, the parts and a mod's author.
//   - AND WHAT THE AUDIT FOUND: the outdoors bar's Off did not say Off (so the tile never read off); the Morrowind
//     card printed "null" (a moved key's row appended bare); Weapon Sheathing's tile never rebuilt the holster its
//     effect line promised.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEATURES, GROUPS, GROUP_ORDER, checkFeature, checkFeatures, resolveControl, featureSearchText, matchesFeatureQuery, FEATURE_PREF_DEFAULTS } from '../src/systems/features.js';
import '../src/world/landView.js';
import '../src/world/outdoors.js';
import { WIND_PARTS, windRead, windWrite, quickSlotsRead, quickSlotsWrite, BLOOD_PARTS, bloodRead, bloodWrite } from '../src/systems/featureLanes.js';
import { OUTDOORS_TIERS } from '../src/world/outdoors.js';
import { getPref, setPref, _resetForTests as resetPrefs } from '../src/systems/uiPrefs.js';
import { _resetForTests as resetSettings } from '../src/systems/settings.js';
import { _resetModSettings } from '../src/systems/modSettings.js';
import { tileStates, classicSegment, allOffPlan, featuresAllOff, featuresRestore, featureTile, barReading, FEATURES_RESTORE_PREF, ALL_OFF_ASK } from '../src/ui/enhancedMenu.js';
import { renderScaleSetting, _resetRenderScaleDoor } from '../src/systems/renderScale.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const row = (id) => FEATURES.find((f) => f.id === id);
const fresh = () => { resetPrefs(); resetSettings(); _resetModSettings(); };
const label = (id) => { const st = tileStates(row(id)); return st.labels[st.at]; };

test('FT18: two groups more - Interface and Sound - and every moved row stands where it is looked for (mutant: a group dropped from the order)', () => {
  assert.deepEqual(GROUP_ORDER, ['sight', 'interface', 'sound', 'world', 'loot', 'combat', 'character']);
  assert.equal(GROUPS.interface.label, 'Interface');
  assert.equal(GROUPS.sound.label, 'Sound');
  for (const g of GROUP_ORDER) assert.ok(FEATURES.some((f) => f.group === g), `${g} is not an empty heading`);
  const at = Object.fromEntries(FEATURES.map((f) => [f.id, f.group]));
  for (const id of ['enhanced-map', 'quick-slots', 'mod-world-tooltips', 'mod-ambient-text', 'near-death-warning', 'choose-guild-jobs']) assert.equal(at[id], 'interface', id);
  for (const id of ['enhanced-sounds', 'mod-immersive-footsteps', 'combat-voices']) assert.equal(at[id], 'sound', id);
  for (const id of ['mod-seasons-iliac-bay', 'mod-eye-of-the-beholder', 'grass', 'wind']) assert.equal(at[id], 'sight', id);
  assert.equal(at['town-watch'], 'world');
  assert.equal(at.blood, 'combat');
  assert.deepEqual(checkFeatures(FEATURES), []);
});

test('FT18: ten rows are four, and nothing they offered is lost - every key, default and online answer is still declared (mutant: a covered pref left undeclared)', () => {
  for (const gone of ['grass-density', 'grass-style', 'wind-wisps', 'flora-sway', 'quickslot-diamond', 'quickbar-style', 'blood-marks', 'blood-overkill', 'blood-screen', 'blood-gore']) {
    assert.equal(row(gone), undefined, `${gone} is condensed`);
  }
  assert.equal(FEATURES.length, 53);   // PERF-SCALE's render scale (2026-09-25) is the one row added since
  const want = { grassDensity: 1, grassStyle: 'pixel', floraSway: true, windWisps: true, quickbarStyle: 'quickbar', quickslots: true,
    'blood-gore': 'normal', 'blood-marks': true, 'blood-overkill': true, 'blood-screen': true };
  for (const [k, v] of Object.entries(want)) assert.equal(FEATURE_PREF_DEFAULTS[k], v, `${k} keeps its default`);
  assert.deepEqual(row('grass').control.parts.map((p) => p.key), ['grassStyle']);
  assert.deepEqual(row('wind').control.parts.map((p) => p.key), ['floraSway', 'windWisps']);
  assert.deepEqual(row('blood').control.parts.map((p) => p.key), ['blood-marks', 'blood-overkill', 'blood-screen']);
  assert.equal(row('quick-slots').control.parts, undefined, 'three states on one bar need no drawer');
});

test('FT18: the laws of a condensed row - a covered pref declares itself, a part is the row\'s own key, a classic value is one of the row\'s (mutant: any check dropped)', () => {
  const base = { id: 'x', title: 'X', note: 'n', group: 'sight', kinds: ['enhanced'] };
  const ok = { ...base, control: { store: 'prefs', key: 'floraSway', initial: true, online: 'player', also: [{ store: 'prefs', key: 'windWisps', initial: true, online: 'player' }], parts: [{ key: 'windWisps', label: 'W' }] } };
  assert.deepEqual(checkFeature(ok), []);
  assert.deepEqual(checkFeature({ ...base, control: { ...ok.control, also: [{ store: 'prefs', key: 'windWisps', online: 'player' }] } }),
    ["also: the covered pref 'windWisps' declares its initial value"]);
  assert.deepEqual(checkFeature({ ...base, control: { ...ok.control, also: [{ store: 'prefs', key: 'windWisps', initial: true }] } }),
    ["also: the covered pref 'windWisps' declares its online answer"]);
  assert.deepEqual(checkFeature({ ...base, control: { ...ok.control, parts: [{ key: 'grassStyle', label: 'S' }] } }),
    ["part 'grassStyle' is not the row's key or one it covers"]);
  assert.deepEqual(checkFeature({ ...base, control: { ...ok.control, parts: [{ key: 'windWisps' }] } }), ["part 'windWisps' has no label"]);
  assert.deepEqual(checkFeature({ ...base, control: { ...ok.control, parts: [] } }), ['parts is not a list']);
  const tiered = { store: 'prefs', key: 'grassDensity', initial: 1, online: 'player', tiers: [[1, 'Full'], [0, 'Off']] };
  assert.deepEqual(checkFeature({ ...base, control: { ...tiered, classic: 0 } }), []);
  assert.deepEqual(checkFeature({ ...base, control: { ...tiered, classic: 7 } }), ["classic '7' is not one of the row's values"]);
  assert.deepEqual(checkFeature({ ...base, kinds: ['classic'], control: { store: 'settings', key: 'Video/RandomDungeonTextures', classic: 0 } }), []);
  assert.deepEqual(checkFeature({ ...base, kinds: ['classic'], control: { store: 'settings', key: 'Video/RandomDungeonTextures', classic: 'Classic' } }), ["classic 'Classic' is not one of the row's values"]);
});

test('FT18: the wind\'s bar is both - Off turns both off, On both on, and either on reads On (mutant: the read as one key, or the write as one)', () => {
  fresh();
  assert.equal(windRead(), true);
  windWrite(false);
  assert.deepEqual(WIND_PARTS.map((k) => getPref(k)), [false, false]);
  assert.equal(windRead(), false);
  setPref('windWisps', true);
  assert.equal(windRead(), true, 'a tile that read Off with the wisps still blowing would be a lie');
  windWrite(true);
  assert.deepEqual(WIND_PARTS.map((k) => getPref(k)), [true, true]);
  assert.equal(label('wind'), 'On');
  const st = tileStates(row('wind'));
  st.set(st.labels.indexOf('Off'));
  assert.deepEqual(WIND_PARTS.map((k) => getPref(k)), [false, false], 'the tile\'s Off is the lane\'s');
  fresh();
});

test('FT18: the quick slots are one bar of three - Off hides the diamond and keeps its keys, Hotbar wins the read (mutant: the hotbar\'s precedence, or Off writing the style)', () => {
  fresh();
  assert.equal(quickSlotsRead(), 'diamond', 'the diamond by default, as QS and HB1 shipped');
  quickSlotsWrite('off');
  assert.deepEqual([getPref('quickslots'), getPref('quickbarStyle')], [false, 'quickbar']);
  assert.equal(quickSlotsRead(), 'off');
  quickSlotsWrite('hotbar');
  assert.equal(getPref('quickbarStyle'), 'hotbar');
  assert.equal(quickSlotsRead(), 'hotbar', 'while the hotbar is up the diamond is put away, whatever its switch says (HB1)');
  quickSlotsWrite('diamond');
  assert.deepEqual([getPref('quickslots'), getPref('quickbarStyle')], [true, 'quickbar']);
  assert.deepEqual(tileStates(row('quick-slots')).labels, ['Off', 'Diamond', 'Hotbar']);
  fresh();
});

test('FT18: blood has an Off at last - the three parts off, the amount kept; an amount from Off brings all three back (mutant: Off read from one part, or the parts left off)', () => {
  fresh();
  assert.equal(bloodRead(), 'normal');
  assert.deepEqual(tileStates(row('blood')).labels, ['Off', 'Light', 'Normal', 'Heavy', 'Abattoir']);
  bloodWrite('heavy');
  assert.equal(getPref('blood-gore'), 'heavy');
  bloodWrite('off');
  assert.deepEqual(BLOOD_PARTS.map((k) => getPref(k)), [false, false, false]);
  assert.equal(getPref('blood-gore'), 'heavy', 'Off keeps the amount');
  assert.equal(bloodRead(), 'off');
  setPref('blood-screen', true);
  assert.equal(bloodRead(), 'heavy', 'the lens alone is still blood');
  bloodWrite('off');
  bloodWrite('light');
  assert.deepEqual(BLOOD_PARTS.map((k) => getPref(k)), [true, true, true], 'one press answers "blood or no blood" both ways');
  assert.equal(getPref('blood-gore'), 'light');
  setPref('blood-marks', false);
  bloodWrite('normal');
  assert.equal(getPref('blood-marks'), false, 'a player who turned one part off keeps it off when the amount moves');
  bloodWrite('nonsense');
  assert.equal(getPref('blood-gore'), 'normal', 'an amount that is no tier writes nothing');
  fresh();
});

test('FT18: the search finds by any word - title, note, part, group or a mod\'s author - in any order, without accents or curly quotes (mutant: the note, the parts or the author left out)', () => {
  const ids = (q) => FEATURES.filter((f) => matchesFeatureQuery(f, q)).map((f) => f.id);
  assert.equal(ids('').length, FEATURES.length, 'an empty query finds everything');
  assert.deepEqual(ids('kamer'), ['mod-windmills-kamer', 'mod-world-of-daggerfall'], 'by the author');
  assert.deepEqual(ids('hotbar'), ['quick-slots'], 'by what a condensed row folded in');
  assert.deepEqual(ids('lens'), ['blood'], 'by a part');
  assert.ok(ids('sway').includes('wind'));
  assert.ok(ids('SOUND').includes('combat-voices'), 'by the group, whatever the case');
  assert.ok(ids('wall dungeon').includes('dungeon-wall-style'), 'every word, any order');
  assert.deepEqual(ids('kamer windmills'), ['mod-windmills-kamer'], 'EVERY word - World of Daggerfall is Kamer\'s too, and has no windmills');
  assert.deepEqual(ids('zzqq'), []);
  assert.ok(ids("daggerfall's").includes('dungeon-wall-style'), 'a straight quote finds a curly one');
  assert.match(featureSearchText(row('mod-pcaao')), /kirk\.o/);
});

test('FT18: All off - every switch to Off, a row with no Off to Daggerfall\'s own, a choice left alone - and Restore puts back exactly what was (mutant: the classic value ignored, a choice moved, or the keep lost)', () => {
  fresh();
  globalThis.location = { search: '' };
  try {
    // a player's own setup: blood heavy, the hotbar up, the wall style Random, land view at the enhanced reach
    tileStates(row('blood')).set(3);
    tileStates(row('quick-slots')).set(2);
    tileStates(row('dungeon-wall-style')).set(3);
    tileStates(row('cloud-quality')).set(2);
    tileStates(row('render-scale')).set(4);   // AUDIT BRANCH-0925 PS-A1: the world drawn at half the window's pixels
    _resetRenderScaleDoor();
    assert.equal(renderScaleSetting(), 0.5);
    const before = Object.fromEntries(FEATURES.map((f) => [f.id, tileStates(f) && label(f.id)]));
    assert.equal(before['dungeon-wall-style'], 'Random');
    // the plan: the land view goes to Daggerfall's 3, the walls to Classic, the clouds (a choice) nowhere
    assert.equal(classicSegment(row('land-view-distance'), tileStates(row('land-view-distance'))), tileStates(row('land-view-distance')).labels.findIndex((l) => /\(3\)/.test(l)));
    assert.equal(classicSegment(row('dungeon-wall-style'), tileStates(row('dungeon-wall-style'))), 0);
    assert.equal(classicSegment(row('cloud-quality'), tileStates(row('cloud-quality'))), -1);
    assert.equal(classicSegment(row('render-scale'), tileStates(row('render-scale'))), 0, 'AUDIT BRANCH-0925 PS-A1: the render scale has no Off - Daggerfall\'s own frame is the whole window, 100%');
    assert.equal(classicSegment(row('grass'), tileStates(row('grass'))), 3, 'the Off that SAYS Off, wherever it stands');
    assert.ok(!allOffPlan().some((m) => m.f.id === 'cloud-quality'));

    const n = featuresAllOff();
    assert.ok(n > 30, `it moved ${n} tiles`);
    for (const f of FEATURES) {
      const st = tileStates(f);
      if (!st) continue;
      const to = classicSegment(f, st);
      if (to >= 0) assert.equal(st.at, to, `${f.id} is off`);
    }
    assert.equal(label('cloud-quality'), 'High', 'a choice keeps what it was');
    assert.equal(getPref('grassStyle'), 'pixel', 'and so does a choice in a drawer');
    assert.equal(label('dungeon-wall-style'), 'Classic');
    assert.deepEqual([label('render-scale'), getPref('renderScale'), renderScaleSetting()], ['100%', 1, 1], 'the world drawn at the window\'s own size again - the renderer reads 100%');
    assert.equal(label('enhanced-environments'), 'Off', 'the outdoors bar says Off now, so All off can find it');
    assert.deepEqual(BLOOD_PARTS.map((k) => getPref(k)), [false, false, false]);
    const keep = getPref(FEATURES_RESTORE_PREF);
    assert.equal(keep.blood, 'Heavy');
    assert.equal(keep['quick-slots'], 'Hotbar');
    assert.equal(keep['render-scale'], '50%');

    // a second press keeps the FIRST press's values - even for a tile turned back on in between
    tileStates(row('blood')).set(1);
    featuresAllOff();
    assert.equal(getPref(FEATURES_RESTORE_PREF).blood, 'Heavy', 'not the Light pressed between the two');
    assert.equal(label('blood'), 'Off');

    featuresRestore();
    for (const f of FEATURES) if (before[f.id]) assert.equal(label(f.id), before[f.id], `${f.id} is back`);
    assert.equal(renderScaleSetting(), 0.5, 'and the render scale with them');
    assert.equal(getPref(FEATURES_RESTORE_PREF), null, 'the keep is spent');
  } finally { delete globalThis.location; fresh(); _resetRenderScaleDoor(); }
});

test('FT18: online, All off leaves the room\'s rows as the room has them (mutant: the lock ignored)', () => {
  fresh();
  globalThis.location = { search: '?online=1' };
  try {
    const locked = FEATURES.filter((f) => tileStates(f)?.locked).map((f) => f.id);
    assert.ok(locked.includes('loot-rarity') && locked.includes('weather-events'), locked.join(', '));
    featuresAllOff();
    assert.equal(getPref('lootRarity'), true, 'forced on online, and untouched');
    assert.ok(!Object.hasOwn(getPref(FEATURES_RESTORE_PREF) ?? {}, 'loot-rarity'), 'and not kept - nothing to restore');
    assert.match(ALL_OFF_ASK, /online the rows the room decides stay on/);
  } finally { delete globalThis.location; fresh(); }
});

test('FT18: the outdoors bar is a switch - its Off says Off - so its tile reads off and takes the Off fill (mutant: the long label back)', () => {
  assert.deepEqual(OUTDOORS_TIERS.map(([, l]) => l), ['Off', 'Port sky', 'Dynamic Skies']);
  fresh();
  const st = tileStates(row('enhanced-environments'));
  st.set(0);
  const r = barReading(tileStates(row('enhanced-environments')));
  assert.equal(r.switch, true);
  assert.equal(r.on, false);
  fresh();
});

test('FT18: a condensed tile opens its parts - switches as chips, a choice as a bar - each writing its own pref (mutant: the drawer never drawn, or a chip writing the row\'s key)', () => {
  const fakeEl = (tag) => {
    const n = { tag, children: [], className: '', textContent: '', title: '', style: {}, dataset: {}, attrs: {}, disabled: false,
      append(...cs) { for (const c of cs) n.children.push(c); }, setAttribute(k, v) { n.attrs[k] = v; } };
    return n;
  };
  const find = (n, cls, out = []) => {
    if (typeof n.className === 'string' && n.className.split(/\s+/).includes(cls)) out.push(n);
    for (const c of n.children ?? []) find(c, cls, out);
    return out;
  };
  const text = (n) => (n.textContent ?? '') + (n.children ?? []).map(text).join('');
  fresh();
  globalThis.document = { createElement: fakeEl, createTextNode: (t) => ({ textContent: t }), querySelectorAll: () => [] };
  try {
    let t = featureTile(row('blood'));
    const door = find(t, 'ft-tile-more')[0];
    assert.match(text(door), /Marks stay · Overkill · On the lens/, 'the door names what it opens');
    assert.equal(find(t, 'ft-tile-drawer').length, 0, 'shut until pressed');
    door.onclick({ stopPropagation() {} });
    t = featureTile(row('blood'));
    const chips = find(t, 'ft-mchip');
    assert.deepEqual(chips.map((c) => c.textContent), ['Marks stay', 'Overkill', 'On the lens']);
    chips[2].onclick();
    assert.equal(getPref('blood-screen'), false, 'the lens chip writes the lens');
    assert.equal(getPref('blood-gore'), 'normal', 'and nothing else');
    // a choice part is a bar
    find(featureTile(row('grass')), 'ft-tile-more')[0].onclick({ stopPropagation() {} });
    const g = featureTile(row('grass'));
    const bars = find(g, 'ft-seg');
    assert.equal(bars.length, 2, 'the density\'s bar and the style\'s');
    const smooth = find(bars[1], 'ft-segb').find((b) => b.textContent === 'Smooth');
    smooth.onclick({ stopPropagation() {} });
    assert.equal(getPref('grassStyle'), 'smooth');
    assert.equal(getPref('grassDensity'), 1);
    assert.equal(t.dataset.fid, 'blood', 'the search hides a tile by its id');
  } finally { delete globalThis.document; fresh(); }
});

test('FT18 by source: the pane\'s search filters in place and All off asks first; the query is per mount; the Morrowind card draws no bare row (mutant: a repaint on every key, the confirm skipped, or the null back)', () => {
  const menu = read('src/ui/enhancedMenu.js');
  const pane = menu.slice(menu.indexOf('function paneFeatures(body) {'), menu.indexOf('\n}', menu.indexOf('function paneFeatures(body) {')));
  assert.match(pane, /search\.type = 'search';/);
  assert.match(pane, /search\.oninput = \(\) => \{ featureQuery = search\.value; applyQuery\(\); \};/, 'typing filters, it does not repaint - the field keeps its keys');
  assert.match(pane, /const hit = matchesFeatureQuery\(f, featureQuery\); t\.hidden = !hit;/);
  assert.match(pane, /g\.head\.hidden = !n;\s*\n\s*g\.grid\.hidden = !n;/, 'a group left with nothing goes too');
  assert.match(pane, /none\.hidden = shown > 0;/, 'and an empty search says so');
  assert.match(pane, /\{ label: 'All off', onClick: \(\) => ask\('Turn Everything Off', ALL_OFF_ASK, 'All off', \(\) => \{ featuresAllOff\(\); \}\) \}/, 'All off is asked first');
  assert.match(pane, /\.\.\.\(kept && typeof kept === 'object' \? \[\{ label: 'Restore',/, 'Restore only while there is something to restore');
  assert.match(menu, /featureQuery = '';   \/\/ FT18: a fresh visit searches nothing/);
  // the menu's own key handler stands down for a text field, so typing in the search never walks the menu
  assert.match(menu, /if \(t && \(t\.tagName === 'INPUT' \|\| t\.tagName === 'TEXTAREA' \|\| t\.isContentEditable\)\) return;/);
  const card = menu.slice(menu.indexOf('function morrowindCard() {'), menu.indexOf('\n}', menu.indexOf('function morrowindCard() {')));
  const rows = [...card.matchAll(/mw\.append\(prefRow\(([\s\S]*?)\)\);/g)];
  assert.ok(rows.length >= 1);
  for (const m of rows) assert.match(m[1], /home: true/, 'a row the card draws is the card\'s own - a moved key\'s row is null');
  assert.doesNotMatch(card, /prefRow\('mwSheathing'/);
  const css = read('src/ui/enhancedStyle.js');
  assert.match(css, /\.ft-tile\[hidden\], \.ft-grid\[hidden\], \.ft-grouphead\[hidden\], \.ft-none\[hidden\] \{ display: none; \}/, 'a hidden tile is gone whatever its own display rule says');
  assert.match(read('src/systems/uiPrefs.js'), /featuresRestore: null,/, 'the keep is a pref: Restore survives a relaunch');
});
