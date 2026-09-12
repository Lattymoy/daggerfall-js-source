// MENU: the settings screen's pins - the map, the copy and the law.
// FD1/SO1 (2026-09-11): the keyed native screen (ui/settingsWindow.js)
// and its launcher are gone; the enhanced menu's Settings pane is THE
// settings screen under both skins, and its pins follow T5 below.
//
// The laws here are the ones the design workflow's nine critiques
// established by MEASUREMENT against this codebase - each of these
// caught a real defect in one of the three candidate designs before a
// line was written.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_KEYS, tierOf, LIVE, DEFAULTS, effectiveSettings, _resetForTests } from '../src/systems/settings.js';
import { CATEGORIES, CATEGORY_IDS, keysOf, categoryOf } from '../src/ui/settingsMap.js';
import { LABELS, labelOf, helpOf, READOUT, INSTEAD } from '../src/ui/settingsCopy.js';
import { widgetFor, formatValue, stepValue, NUMBER_LAW, ENUM_LAW, COLOUR_KEYS } from '../src/ui/settingsLaw.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(root, 'src', f), 'utf8');

test('MENU T1: the category map is TOTAL and DISJOINT over the store', () => {
  const seen = new Map();
  for (const cat of CATEGORY_IDS) {
    for (const k of keysOf(cat)) {
      assert.ok(ALL_KEYS.includes(k), `${k} is mapped but is not a store key`);
      assert.ok(!seen.has(k), `${k} is in both ${seen.get(k)} and ${cat}`);
      seen.set(k, cat);
    }
  }
  for (const k of ALL_KEYS) assert.ok(seen.has(k), `${k} has no category - it would vanish from the screen`);
  assert.equal(seen.size, 171);
  // the shape the design settled on, so a re-bake that renames a key
  // fails the build rather than quietly dropping a row
  // SO1: ENHANCED is a category with no store key - its rows are the port's own
  assert.deepEqual(CATEGORY_IDS.map((c) => keysOf(c).length), [0, 21, 16, 5, 66, 37, 19, 7]);
  assert.deepEqual(CATEGORY_IDS, ['enhanced', 'game', 'controls', 'audio', 'video', 'interface', 'accessibility', 'mods']);
});

test('MENU T2: no player ever reads a raw ini identifier', () => {
  for (const k of ALL_KEYS) {
    const label = labelOf(k);
    assert.ok(label && label.length <= 26, `${k}: label "${label}" is missing or over 26 chars`);
    assert.match(label, /^[\x20-\x7E]+$/, `${k}: label must be plain ASCII (the font has no glyph below 33)`);
    // the rule is about IDENTIFIERS, not about words: "Fullscreen" is
    // both the ini key and the right English, and that is fine. What
    // must never survive is camelCase or an underscore.
    assert.ok(!/[a-z][A-Z]/.test(label), `${k}: "${label}" is still camelCase`);
    assert.ok(!label.includes('_'), `${k}: "${label}" still carries an identifier underscore`);
  }
  // the words this screen must never say about the port's own gaps
  const banned = /unsupported|broken|missing|not implemented|n\/a/i;
  for (const s of [...Object.values(LABELS), ...Object.values(READOUT), ...Object.values(INSTEAD),
    ...CATEGORIES.map((c) => c.blurb), ...CATEGORIES.map((c) => c.title)]) {
    assert.ok(!banned.test(s), `discouraging word in copy: "${s}"`);
    assert.match(s, /^[\x20-\x7E]+$/, `non-ASCII in copy: "${s}"`);
  }
});

test('MENU T4: the widget law is total, and a blocked row never shows a stored value', () => {
  const kinds = new Set(['switch', 'enum', 'number', 'colour', 'text', 'blocked']);
  for (const k of ALL_KEYS) assert.ok(kinds.has(widgetFor(k)), `${k}: no widget kind`);
  // an unavailable key must resolve to 'blocked' and NOTHING else -
  // otherwise the screen offers a control that cannot move
  for (const k of ALL_KEYS) {
    if (tierOf(k) === 'unavailable') {
      assert.equal(widgetFor(k), 'blocked', `${k} is unavailable but drew an operable widget`);
      assert.ok(READOUT[k], `${k} has no readout - it would print its stored value`);
      assert.ok(INSTEAD[k], `${k} has no "instead" sentence`);
    }
  }
  // THE HONESTY CASE: EnhancedCombatAI stores DFU's True while this
  // port runs the classic path. Printing "On" would be a lie.
  assert.equal(formatValue('Enhancements/EnhancedCombatAI', 'True'), 'classic');
  // enums are DFU's names in DFU's order
  for (const [k, law] of Object.entries(ENUM_LAW)) {
    assert.ok(law.values.length >= 2 && law.cite, `${k}: enum needs values and a citation`);
    assert.ok(ALL_KEYS.includes(k), `${k}: enum law names a key the store lacks`);
  }
  for (const k of COLOUR_KEYS) {
    const [s, kk] = k.split('/');
    assert.match(DEFAULTS[s][kk], /^[0-9A-F]{8}$/i, `${k}: colour default must be RRGGBBAA`);
  }
});

test('MENU T5: a slider never offers travel its consumer ignores', () => {
  // The range-equals-clamp law: a slider whose last three quarters did
  // nothing would be the same lie as an inoperable control. It used to
  // be stated over MouseLookSensitivity, which ran to 4.0 here against
  // DFU's 16.0 because lookSettings.js clamped there; ROAD-G G6 built
  // DFU's own sensitivity slider and widened the clamp instead, so
  // that row is DFU's range now and this pin reads the agreement
  // rather than a narrowing.
  for (const [key, law] of Object.entries(NUMBER_LAW)) {
    assert.ok(law.min < law.max, `${key}: empty range`);
    assert.ok(law.step > 0 && law.coarse >= law.step, `${key}: bad step`);
    assert.ok(law.source, `${key}: a range with no stated source is an invention`);
    if (!LIVE[key]) continue;
    const consumer = readFileSync(join(root, LIVE[key]), 'utf8');
    const re = new RegExp(`get(?:Int|Float)\\('${key.split('/')[0]}',\\s*'${key.split('/')[1]}',\\s*([\\d.]+),\\s*([\\d.]+)\\)`);
    const m = consumer.match(re);
    if (!m) continue;   // the consumer may read it via a named constant
    assert.equal(Number(m[1]), law.min, `${key}: the screen offers min ${law.min}, the consumer clamps at ${m[1]}`);
    assert.equal(Number(m[2]), law.max, `${key}: the screen offers max ${law.max}, the consumer clamps at ${m[2]}`);
  }
  // stepping never escapes the range
  for (const [key, law] of Object.entries(NUMBER_LAW)) {
    let v = String(law.min);
    for (let i = 0; i < 200; i++) v = stepValue(key, v, +1, true);
    assert.ok(Number(v) <= law.max, `${key}: stepping up escaped the max`);
    for (let i = 0; i < 200; i++) v = stepValue(key, v, -1, true);
    assert.ok(Number(v) >= law.min, `${key}: stepping down escaped the min`);
  }
});

// ── FD1 + SO1 (2026-09-11): ONE SETTINGS SCREEN, ORGANISED ──────────
// Mac: "Remove the classic Manager screen and instead use the enhanced
// menu for both enhanced and classic ... a comprehensive organization
// of all the settings options, and settings audit ensuring proper
// organization and bloat reduction."

test('FD1: the launcher and the keyed settings window are gone, nothing imports them, and ShowOptionsAtStart is stored (mutant: the gate left in main.js)', () => {
  for (const f of ['src/scenes/launcherScene.js', 'src/ui/settingsWindow.js', 'src/ui/settingsMetrics.js', 'src/ui/colorPicker.js', 'tools/settingsProbe.mjs']) {
    assert.throws(() => readFileSync(join(root, f)), `${f} must be gone`);
  }
  const main = src('main.js');
  assert.doesNotMatch(main, /runLauncher\(|getBool\('GUI', 'ShowOptionsAtStart'\)|import\('\.\/scenes\/launcherScene/, 'main.js no longer raises the wizard');
  assert.doesNotMatch(main, /isEnhanced\(\)/, 'the door is one door: no skin fork in front of it');
  assert.equal(tierOf('GUI/ShowOptionsAtStart'), 'stored', 'read by nothing now - written back as DFU would');
  assert.equal(LIVE['GUI/ShowOptionsAtStart'], undefined);
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : d.name.endsWith('.js') ? [join(dir, d.name)] : []));
  for (const f of walk(join(root, 'src'))) {
    assert.doesNotMatch(readFileSync(f, 'utf8'), /from '[^']*(?:settingsWindow|launcherScene|settingsMetrics|colorPicker)\.js'|import\('[^']*(?:settingsWindow|launcherScene|settingsMetrics|colorPicker)\.js'\)/, `${f} still imports a deleted module`);
  }
});

test('FD1: both skins open on the enhanced door; classic collapses its game doors into BEGIN, which resolves into the classic sequence with the data gated first (mutant: Begin on the enhanced rail, or the classic rail keeping New Game)', () => {
  const menu = src('ui/enhancedMenu.js');
  assert.match(menu, /const SECTIONS_CLASSIC = \['Begin', 'Online', 'Settings', 'Controls', 'Mods', 'About'\];/);
  assert.match(menu, /const SECTIONS_BOOT = \['Continue', 'New Game', 'Load Game', 'Online', 'Test Room', 'Settings', 'Controls', 'Mods', 'About'\];/, 'the enhanced rail keeps its three doors and loses the Enhanced entry (SO1)');
  assert.match(menu, /sections = mode === 'pause' \? SECTIONS_PAUSE : isEnhanced\(\) \? SECTIONS_BOOT : SECTIONS_CLASSIC;/);
  assert.match(menu, /function paneBegin\(body\) \{[\s\S]*?onClick: \(\) => onAction\('begin'\)/);
  assert.match(menu, /begin: paneBegin,/, 'the dispatch knows it');
  const main = src('main.js');
  assert.match(main, /if \(params\.has\('begin'\)\) choice = 'begin';/, 'the URL door for the probes that pin classic geometry');
  assert.match(main, /choice = await runEnhancedMenu\(\);/);
  assert.match(main, /if \(choice !== 'begin'\) \{\s*\n\s*await ensureData\(\);/, 'the enhanced doors gate the data after the menu');
  const beginAt = main.indexOf("// FD1: BEGIN - the classic start sequence, data first.");
  assert.ok(beginAt > 0);
  const tail = main.slice(beginAt);
  const gate = tail.indexOf('await ensureData();'), splash = tail.indexOf("ANIM0001.VID"), menuAt = tail.indexOf('runMenu(canvas');
  assert.ok(gate > 0 && gate < splash && splash < menuAt, 'data, then the splash, then Daggerfall\'s own start window');
});

test('SO1: the settings pane is organised - the port\'s rows sit in the categories a player looks in, the live store keys lie flat, the two other tiers fold under counted headings remembered per category, and the sub-rail counts what works (mutant: a tier hidden, or the count the file\'s row count)', () => {
  const menu = src('ui/enhancedMenu.js');
  assert.doesNotMatch(menu, /function paneEnhanced\(/, 'the Enhanced pane is gone');
  assert.doesNotMatch(menu, /inertRow\(/, 'and the row about a removed feature with it');
  for (const fn of ['portRowsEnhanced', 'portRowsControls', 'portRowsInterface', 'morrowindCard', 'packsCard', 'categoryRows', 'tierGroup']) {
    assert.match(menu, new RegExp(`function ${fn}\\(`), `${fn} exists`);
  }
  assert.match(menu, /if \(catId === 'enhanced'\) return portRowsEnhanced\(opts\);\s*\n\s*if \(catId === 'controls'\) return portRowsControls\(opts\);\s*\n\s*if \(catId === 'interface'\) return portRowsInterface\(opts\);/);
  // the Enhanced category carries the port's departures, each a real pref
  const from = menu.indexOf('function portRowsEnhanced('); const pane = menu.slice(from, menu.indexOf('\n}', from));
  const prefs = src('systems/uiPrefs.js');
  for (const m of pane.matchAll(/(?:prefRow|choiceRow)\('(\w+)'/g)) assert.match(prefs, new RegExp(`\\n\\s*${m[1]}:`), `'${m[1]}' is a uiPrefs key`);
  for (const k of ['enhancedAI', 'enhancedEnvironments', 'grassDensity', 'cloudQuality', 'enhancedWater', 'enhancedCombatVisuals']) assert.match(pane, new RegExp(`(?:prefRow|choiceRow)\\('${k}'`), k);
  assert.match(pane, /if \(!pause\) out\.push\(outdoorsTestRow\(\)\);/, 'the outdoors test door, boot only');
  // the touch knobs under Controls, where a finger's device looks; the skin, the HUD size and the FPS counter under Interface
  const ctl = menu.slice(menu.indexOf('function portRowsControls('), menu.indexOf('function portRowsInterface('));
  assert.match(ctl, /if \(!isTouchDevice\(\)\) return out;/);
  for (const k of ['touchLookSensitivity', 'touchAnalogStick', 'touchGyroLook', 'touchHaptics', 'touchFullscreen']) assert.match(ctl, new RegExp(`'${k}'`), k);
  const ui = menu.slice(menu.indexOf('function portRowsInterface('), menu.indexOf('function portRows('));
  assert.match(ui, /if \(!pause\) out\.push\(skinRow\(\)\);/); assert.match(ui, /out\.push\(hudScaleRow\(\)\);/); assert.match(ui, /prefRow\('showFps'/);
  // the Mods page takes the assets and the packs
  const mods = menu.slice(menu.indexOf('function paneMods('), menu.indexOf('\n}', menu.indexOf('function paneMods(')));
  assert.match(mods, /body\.append\(morrowindCard\(\)\);[^\n]*\n\s*body\.append\(packsCard\(\)\);/);
  assert.match(menu, /await ds\.pickMusicFolder\(\); render\(\);/, 'the music pack is reachable without the launcher');
  assert.match(menu, /await ds\.pickTextureFolder\(\); render\(\);/);
  // tier is a group: live flat, the other two folded with a count, remembered on the shelf
  assert.match(menu, /for \(const key of keys\) if \(tierOf\(key\) === 'live'\) out\.push\(settingRow\(key\)\);/);
  assert.match(menu, /const TIER_GROUPS = Object\.freeze\(\[\s*\n\s*\['stored', 'Saved for later'/);
  assert.match(menu, /\['unavailable', 'Not available here'/);
  assert.match(menu, /const open = isOpen\(catId, tier\);[\s\S]*?headBtn\.onclick = \(\) => \{ setOpen\(catId, tier, !open\); render\(\); \};/, 'the fold is the shelf\'s open map');
  assert.match(menu, /el\('span', 'count', String\(keys\.length\)\)/, 'the heading counts');
  assert.match(menu, /if \(open\) \{\s*\n\s*const body = el\('div', 'group-body'\);/, 'a folded group draws no rows - and its heading still says how many');
  assert.match(menu, /b\.append\(el\('span', 'count', String\(liveCount\(cat\.id\)\)\)\);/, 'the sub-rail counts the rows that do something');
  assert.doesNotMatch(menu, /el\('div', 'legend'\)/, 'the dot legend went with the flat list');
  // the pause's condensed pane carries the reload-free port rows too
  assert.match(menu, /const port = portRows\(cat\.id, \{ pause: true \}\);/);
  assert.match(src('ui/enhancedStyle.js'), /\.group-head \{/);
  // the category the port's departures live in is the first, with no store key
  assert.equal(CATEGORIES[0].id, 'enhanced'); assert.deepEqual(keysOf('enhanced'), []);
  assert.equal(CATEGORIES.find((c) => c.id === 'mods').title, 'Data & Mods');
});
