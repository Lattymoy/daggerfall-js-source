// ORG1 (2026-10-09, Mac: "I want to reorganize settings and features to not be horrible to scroll through. Proper
// organization and detail"). The Features home was 96 tiles under seven thin headings in one 8,000-pixel scroll, and
// Settings > Interface forty rows in one run. Now:
//   - FEATURES shows ONE GROUP at a time from a rail of groups (All shows every one), each group under a line of what it
//     holds and cut into SECTIONS with a line each (systems/features.js FEATURE_SECTIONS - the order there is the
//     tiles' order). The search still reaches every tile. The cards a player attaches files through (the Morrowind
//     assets, the packs, DFU's mod system) are a page of their own in that rail, not a screen of cards around every group.
//   - SETTINGS cuts each category into SECTIONS (ui/settingsMap.js CATEGORY_SECTIONS), each under a head with a count
//     and a line, with a strip of their names that stays at the top of a long page; the category card indexes them;
//     the pause's condensed list is one pass per category under the same sections; a DFU row carries its own line.
// Both maps are TOTAL AND DISJOINT, as the settings map always was: a row added without a place fails here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEATURES, GROUPS, GROUP_ORDER, FEATURE_SECTIONS, featureSections, sectionOfFeature, filterFeatures } from '../src/systems/features.js';
import { CATEGORIES, CATEGORY_KEYS, CATEGORY_SECTIONS, sectionOfKey } from '../src/ui/settingsMap.js';
import { sectionedRows } from '../src/ui/enhancedMenu.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const fnOf = (src, head) => { const at = src.indexOf(head); assert.ok(at >= 0, head); return src.slice(at, src.indexOf('\n}\n', at) + 3); };

test('ORG1 features map: every row stands in exactly one section of its own group, each group and section says what it holds (mutant: a row dropped, doubled or filed under another group)', () => {
  const seen = new Map();
  for (const g of GROUP_ORDER) {
    assert.ok(GROUPS[g].blurb?.length > 20, `${g} says what it holds`);
    const secs = FEATURE_SECTIONS[g];
    assert.ok(Array.isArray(secs) && secs.length >= 1, `${g} has sections`);
    assert.equal(new Set(secs.map((s) => s.id)).size, secs.length, `${g}'s section ids are distinct`);
    for (const s of secs) {
      assert.ok(s.label && s.blurb?.length > 10, `${g}/${s.id} has a label and a line`);
      for (const id of s.ids) {
        assert.ok(!seen.has(id), `${id} is in ${seen.get(id)} and ${g}/${s.id}`);
        seen.set(id, `${g}/${s.id}`);
        const f = FEATURES.find((x) => x.id === id);
        assert.ok(f, `${g}/${s.id} names ${id}, which is no row`);
        assert.equal(f.group, g, `${id} is a ${f.group} row filed under ${g}`);
      }
    }
  }
  assert.deepEqual(FEATURES.filter((f) => !seen.has(f.id)).map((f) => f.id), [], 'every row has a section');
  assert.equal(seen.size, FEATURES.length);
  // a group large enough to scroll is cut; a small one may be its own heading
  for (const g of GROUP_ORDER) if (FEATURES.filter((f) => f.group === g).length > 8) assert.ok(FEATURE_SECTIONS[g].length >= 2, `${g} is cut into sections`);
});

test('ORG1 featureSections: a group\'s rows in its sections\' order, an emptied section left out, a row the map lost still drawn (mutant: registry order, or the stray dropped)', () => {
  const world = featureSections('world', FEATURES);
  assert.deepEqual(world.map((x) => x.section.id), FEATURE_SECTIONS.world.map((s) => s.id));
  assert.deepEqual(world.flatMap((x) => x.items.map((f) => f.id)), FEATURE_SECTIONS.world.flatMap((s) => s.ids), 'the map\'s order is the page\'s');
  const classic = featureSections('world', filterFeatures(FEATURES, 'classic'));
  assert.ok(classic.length < world.length && classic.every((x) => x.items.length), 'the kind filter leaves no empty head');
  const stray = { id: 'zz-stray', group: 'sound', title: 'Stray' };
  const sound = featureSections('sound', [...FEATURES, stray]);
  assert.equal(sound.at(-1).section.id, 'more');
  assert.deepEqual(sound.at(-1).items, [stray]);
  assert.equal(sectionOfFeature(FEATURES.find((f) => f.id === 'smaller-dungeons')).id, 'dungeons');
});

test('ORG1 settings map: every key of a category stands in exactly one of its sections, and each says what it holds (mutant: a key dropped or doubled)', () => {
  for (const cat of CATEGORIES) {
    const secs = CATEGORY_SECTIONS[cat.id];
    assert.ok(Array.isArray(secs) && secs.length >= 1, `${cat.id} has sections`);
    assert.equal(new Set(secs.map((s) => s.id)).size, secs.length, `${cat.id}'s section ids are distinct`);
    const placed = secs.flatMap((s) => s.keys);
    assert.equal(new Set(placed).size, placed.length, `${cat.id}: a key in two sections`);
    assert.deepEqual([...placed].sort(), [...CATEGORY_KEYS[cat.id]].sort(), `${cat.id}: the sections hold the category's keys, all and only`);
    for (const s of secs) assert.ok(s.title && s.blurb?.length > 5, `${cat.id}/${s.id} has a title and a line`);
  }
  assert.equal(sectionOfKey('interface', 'GUI/ToolTipDelayInSeconds').id, 'tooltips');
  assert.equal(sectionOfKey('interface', 'Controls/SoundVolume'), null, 'a key answers in its own category only');
});

test('ORG1 sectionedRows: rows under their sections\' heads in the map\'s order, the port\'s first, a strip of names on a long page, one section no heads (mutant: no heads, the map\'s order lost, or the strip on every page)', () => {
  const fakeEl = (tag) => {
    const n = { tag, children: [], className: '', textContent: '', dataset: {}, attrs: {}, id: '',
      append(...cs) { for (const c of cs) n.children.push(c); }, setAttribute(k, v) { n.attrs[k] = v; } };
    return n;
  };
  globalThis.document = { createElement: fakeEl, createTextNode: (t) => ({ textContent: t }) };
  try {
    const row = (key, section) => ({ tag: 'div', className: 'row', dataset: { ...(key ? { key } : {}), ...(section ? { section } : {}) }, children: [] });
    const rows = [row(null, 'hud'), row('Map/AutomapTavernColor'), row('GUI/ToolTipTextColor'), row('GUI/Crosshair'), row('GUI/EnableToolTips'), row(null, 'prompts')];
    const out = sectionedRows('interface', rows, { jump: true });
    const kinds = out.map((n) => (n.className === 'row' ? (n.dataset.key ?? `port:${n.dataset.section}`) : n.className));
    assert.deepEqual(kinds, ['sec-jump', 'sec-head', 'port:hud', 'GUI/Crosshair', 'sec-head', 'GUI/EnableToolTips', 'GUI/ToolTipTextColor',
      'sec-head', 'port:prompts', 'sec-head', 'Map/AutomapTavernColor']);
    const titles = out.filter((n) => n.className === 'sec-head').map((h) => h.children[0].children[0].textContent);
    assert.deepEqual(titles, ['HUD', 'Tooltips', 'Messages & prompts', 'Town map']);
    assert.equal(out[1].id, 'sec-interface-hud', 'a head is the strip\'s anchor');
    assert.deepEqual(out[0].children.map((b) => b.textContent), titles, 'the strip names the heads');
    const two = sectionedRows('interface', [row('GUI/Crosshair'), row('GUI/EnableToolTips')], { jump: true });
    assert.ok(!two.some((n) => n.className === 'sec-jump'), 'two sections need no strip');
    const one = [row('GUI/Crosshair'), row('GUI/EnableVitalsIndicators')];
    assert.deepEqual(sectionedRows('interface', one, { jump: true }), one, 'one section is its own heading');
    const small = sectionedRows('interface', rows, { jump: true, small: true });
    assert.ok(small.filter((n) => n.className === 'sec-head small').length === 4 && small.every((n) => !n.id), 'the pause\'s heads are small and anchor nothing');
  } finally { delete globalThis.document; }
});

test('ORG1 by source: the features home pages its groups, cuts them into sections, searches all of them and keeps the files on a page of their own; settings sections every list (mutant: the group rail, the sections or the one-pass pause list gone)', () => {
  const menu = read('src/ui/enhancedMenu.js');
  const pane = fnOf(menu, 'function paneFeatures(body) {');
  assert.match(pane, /const nav = el\('nav', 'ft-groups'\);/, 'the groups\' rail');
  assert.match(pane, /groupBtn\(null, 'All', rows\.length\);\n\s*for \(const g of groups\) groupBtn\(g, GROUPS\[g\]\.label,/, 'All, then each group with its count');
  assert.match(pane, /block\.append\(head, el\('p', 'ft-groupblurb', GROUPS\[g\]\.blurb\)\);/, 'a group says what it holds');
  assert.match(pane, /const cut = featureSections\(g, items\);/, 'cut into sections');
  assert.match(pane, /if \(section\.blurb\) sec\.append\(el\('p', 'ft-secblurb', section\.blurb\)\);/, 'each with its line');
  assert.match(pane, /G\.block\.hidden = !n \|\| \(!q && featureGroup !== null && G\.g !== featureGroup\);/, 'one group shown - every one while the search holds a word');
  assert.match(pane, /files\.append\(morrowindCard\(\)\);[^\n]*\n\s*modsFooter\(files\);/, 'the assets card and the footer\'s cards, on their own page');
  assert.equal((pane.match(/modsFooter\(/g) ?? []).length, 1, 'drawn once');
  assert.match(menu, /let featureGroup = GROUP_ORDER\[0\];/, 'the first group is what a first visit sees');
  assert.match(fnOf(menu, 'function paintRail(rail = document.getElementById(\'ft-rail\')) {'), /pair\('Found in',/, 'the rail says where a tile stands');
  // settings
  assert.match(fnOf(menu, 'function categoryRows(catId) {'), /const page = sectionedRows\(catId, out, \{ jump: true \}\);[\s\S]*?return page;/);
  const quick = fnOf(menu, 'function paneQuickSettings(pane) {');
  assert.match(quick, /for \(const r of sectionedRows\(cat\.id, rows, \{ small: true \}\)\) list\.append\(r\);/);
  assert.equal((quick.match(/for \(const cat of CATEGORIES\)/g) ?? []).length, 1, 'one pass - a category stands once');
  assert.match(fnOf(menu, 'function categoryCard() {'), /const dl = el\('dl', 'sec-index'\);/, 'the card indexes the sections');
  assert.match(menu, /row\.dataset\.key = key;/, 'a store row says its key');
  assert.match(menu, /if \(!compact\) \{ const help = helpOf\(key\); if \(help && help !== labelOf\(key\)\) main\.append\(el\('div', 'row-note', help\)\); \}/, 'and its own line');
  assert.match(menu, /const PORT_SECTION = Object\.freeze\(\{ game: 'quests', controls: 'controller', interface: 'hud' \}\);/, 'a port row with no section of its own stands in its category\'s');
  assert.match(fnOf(menu, 'function portRowsControls() {'), /for \(const r of out\.slice\(touchFrom\)\) inSection\('touch', r\);/, 'the finger\'s rows under Touchscreen');
  assert.match(fnOf(menu, 'function portRowsInterface({ pause = false } = {}) {'), /if \(!pause\) inSection\('prompts', out\.at\(-1\)\);/, 'the start video under Messages & prompts');
  for (const id of ['quests', 'controller', 'hud', 'touch', 'prompts']) assert.ok(Object.values(CATEGORY_SECTIONS).some((secs) => secs.some((s) => s.id === id)), `${id} is a section`);
  const css = read('src/ui/enhancedStyle.js');
  for (const c of ['ft-groups', 'ft-groupbtn', 'ft-sechead', 'ft-secblurb', 'ft-groupblurb', 'sec-jump', 'sec-head', 'sec-blurb', 'sec-index']) assert.ok(css.includes(`.${c} {`), `.${c} is styled`);
  assert.match(css, /\.sec-head \{[^}]*scroll-margin-top: 52px;/, 'a jump lands a head clear of the strip');
});
