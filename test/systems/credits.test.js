import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { FEATURES, WINDMILLS_KEY } from '../../src/systems/features.js';   // WM3: the Features home, and the Windmills switch's declaration
import { OVERHAUL_PANELS } from '../../src/systems/overhauls.js';
import { UI_PACKS } from '../../src/systems/uiPack.js';
import { ENVIRONMENT_PACK_MODS } from '../../src/systems/vanillaEnhanced/vanillaEnhancedPack.js';   // ALIKR1 / SNOWFALL1: the shipped environment packs
import * as introCue from '../../src/ui/intro/introCue.js';
import { hostText } from '../hostText.mjs';   // HOST-SPLIT 2: the world host whole
import { retiredKeys } from '../ownWork.mjs';   // OWN-WORK1: the keys Own-Work.md records as retired

// CREDITS-OUT (2026-11-01, the owner: "Remove all mentions of DFU, Interkarma and the nexus community. No more
// credits along with removing their logos from the intro."). CR1's credits sweep is now a PROVENANCE sweep: nothing
// is vendored without a README that records where it came from and on what terms, and the notices a licence
// requires travel in LICENSE and the build - never on a screen.

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => hostText(p);

/** A README's two facts: where the work came from, and the terms it is carried under. */
const SOURCE = /\b(by|from|made for|Author|github\.com|commit)\b/i;
const TERMS = /\b(MIT|licen[cs]e|Open Font License|permission|own work|own drawing)\b/i;

/** The vendor folders under `dir` whose README is missing, or does not record its source or its terms. */
function provenanceGaps(dir) {
  const gaps = [];
  for (const d of readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
    const p = join(dir, d.name, 'README.md');
    if (!existsSync(p)) { gaps.push(`${d.name}: no README`); continue; }
    const text = readFileSync(p, 'utf8');
    if (!SOURCE.test(text)) gaps.push(`${d.name}: no source`);
    if (!TERMS.test(text)) gaps.push(`${d.name}: no terms`);
    if (/Open Font License/.test(text) && !existsSync(join(dir, d.name, 'OFL.txt'))) gaps.push(`${d.name}: no OFL.txt beside it`);
  }
  return gaps;
}

test('PROVENANCE: every vendored folder has a README recording its source and its terms (an OFL work its OFL.txt)', () => {
  const vendor = join(root, 'vendor');
  assert.ok(readdirSync(vendor).length >= 10, 'the sweep reads a real tree');
  assert.deepEqual(provenanceGaps(vendor), []);
});

test('PROVENANCE: the sweep fails a folder with no README, a README with no terms, and an OFL work without its licence', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prov-'));
  try {
    const put = (name, text) => { mkdirSync(join(dir, name)); if (text !== null) writeFileSync(join(dir, name, 'README.md'), text); };
    put('good', 'A table by its author, under the MIT License.');
    put('bare', null);
    put('termless', 'A table from its author.');
    put('font', 'One glyph by its authors, under the SIL Open Font License 1.1.');
    assert.deepEqual(provenanceGaps(dir).sort(), ['bare: no README', 'font: no OFL.txt beside it', 'termless: no terms']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('LEGAL: the notices the MIT and OFL licences require ship as plain files in the build, and nothing shows them', () => {
  const licence = readFileSync(join(root, 'LICENSE'), 'utf8');
  assert.match(licence, /Copyright \(c\) 2009-2023 Daggerfall Workshop/, 'the vendored MIT data\'s notice');
  assert.ok(existsSync(join(root, 'vendor/silkscreen-five/OFL.txt')));
  const vite = readFileSync(join(root, 'vite.config.js'), 'utf8');
  assert.match(vite, /this\.emitFile\(\{ type: 'asset', fileName: 'LICENSE\.txt', source: readFileSync\('LICENSE', 'utf8'\) \}\);/);
  assert.match(vite, /this\.emitFile\(\{ type: 'asset', fileName: 'OFL-Silkscreen\.txt', source: readFileSync\('vendor\/silkscreen-five\/OFL\.txt', 'utf8'\) \}\);/);
  assert.match(vite, /noImportedTopLevelAwait\(\), licenceFiles\(\)\]/, 'the plugin is in the build');
  for (const p of ['src/ui/enhanced/enhancedMenu.js', 'index.html', 'src/ui/settings/settingsMap.js']) {
    assert.doesNotMatch(readFileSync(join(root, p), 'utf8'), /LICENSE\.txt|OFL-Silkscreen/, `${p} does not link the licences`);
  }
});

test('CREDITS-OUT: no screen credits anyone - the module, the About pane\'s card, the intro\'s logo cards and their words are gone', () => {
  assert.equal(existsSync(join(root, 'src/ui/credits.js')), false);
  for (const f of ['src/assets/intro/interkarma.webp', 'src/assets/intro/nexus.webp']) assert.equal(existsSync(join(root, f)), false, f);
  const menu = read('src/ui/enhanced/enhancedMenu.js');
  assert.doesNotMatch(menu, /creditsCard|credits\.js|menu\.credits\./);
  assert.match(menu, /function paneAbout\(body\) \{[\s\S]*?body\.append\(c\);\n {2}body\.append\(empty\(t\('menu\.about\.exit'/, 'About: the card, then Exit');
  assert.equal(introCue.INTRO_CREDITS, undefined);
  assert.equal(introCue.introCreditOpacity, undefined);
  const intro = read('src/ui/intro/introScreen.js');
  assert.doesNotMatch(intro, /intro-credit|interkarma|nexus/i);
  const en = readFileSync(join(root, 'locales/en/Port_Strings.csv'), 'utf8');
  assert.doesNotMatch(en, /^(credits|menu\.credits)\.|^menu\.intro\.credit|^menu\.ovh\.addonBy/m, 'no credit key is left');
});

test('CREDITS-OUT: no string a player reads names Daggerfall Unity, DFU, Interkarma or Nexus - in English or any language', () => {
  const NAMED = /Daggerfall\s*Unity|\bDFU\b|Interkarma|Nexus/i;
  for (const dir of readdirSync(join(root, 'locales'), { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const p = join(root, 'locales', dir.name, 'Port_Strings.csv');
    if (!existsSync(p)) continue;
    const hits = readFileSync(p, 'utf8').split('\n').filter((l) => NAMED.test(l.slice(l.indexOf(',') + 1)));
    assert.deepEqual(hits, [], `${dir.name}: a translation names them`);
  }
  for (const p of ['index.html', 'README.md']) assert.doesNotMatch(readFileSync(join(root, p), 'utf8'), NAMED, p);
});

test('OWN-WORK1: a key Own-Work.md records as retired has no folder left in vendor/', () => {
  const retired = retiredKeys();
  assert.ok(retired.size >= 30, `only ${retired.size} retired keys`);
  const folders = readdirSync(join(root, 'vendor'));
  assert.deepEqual([...retired].filter((k) => folders.includes(k)), [], 'retired and still vendored');
});

// ═══ WM3: A MOD IS A MOD THE PLAYER CAN FIND ═════════════════════
//
// (2026-09-15, Mac: "the windmills of daggerfall is missing from
// credits and the feature menu.") `features.js` builds a mod's tile out
// of the vendor's own `Enabled` key, so a pack with no settings file
// had no row, and FT14 made that a disappearance. The rule was derived
// from the credits; CREDITS-OUT derives it from the record instead: every
// vendored folder and every key Own-Work.md retired is a mod the player
// can find and switch, but for the works that never were a switch.
const NOT_A_SWITCH = Object.freeze({
  'dfu-books': 'the reference\'s data', 'dfu-cursor': 'the reference\'s data', 'dfu-icons': 'the reference\'s data',
  'dfu-quests': 'the reference\'s data', 'dfu-settings': 'the reference\'s data', 'dfu-text': 'the reference\'s data',
  'silkscreen-five': 'a glyph', 'pixelify-glyphs': 'a glyph', 'raum-book': 'the book\'s look',
  'layered-armor': 'a look on the profile\'s Skin card', 'class-skins': 'a look on the profile\'s Skin card',
  'beautiful-villages': 'OWN-WORK3: our own town dress replaced it', 'beautiful-cities': 'OWN-WORK3: our own town dress replaced it',
  'vorbis-fsb-setups': 'two headers, gone with the clips',
  // ARENA1: the Arena of Daggerfall stands in the city in every game (Arena.md: "the arena is not a switch, it is the city")
  'daggerfall-arena': 'the arena is the city',
});

test('WM3: every vendored mod and every retired mod has a row on the Features home', () => {
  // A vendor is REACHABLE from a row when the row's own control names
  // it, or when a condensed row names it in `also` (FT2/FT4 - Dynamic
  // Skies rides the outdoors row and has no tile of its own), or when
  // a prefs row is declared for it by id.
  const named = new Set();
  for (const f of FEATURES) {
    for (const c of [f.control, ...(f.control?.also ?? []), ...(f.also ?? [])]) {
      if (c?.store === 'mods' && c.vendor) named.add(c.vendor);
    }
    const m = /^mod-(.+)$/.exec(f.id ?? '');
    if (m) named.add(m[1]);
  }
  // OVH2: ...or a look on the Overhauls screen is the pack (a UI pack is worn and put away there, not on Features)
  for (const p of OVERHAUL_PANELS) for (const o of p.options) if (o.pack && UI_PACKS[o.pack]?.vendor) named.add(UI_PACKS[o.pack].vendor);
  // VE4: ...and a texture look names the pack it wears (Vanilla Enhanced is worn and put away on the Texture panel)
  for (const p of OVERHAUL_PANELS) for (const o of p.options) if (o.vendor) named.add(o.vendor);
  // ALIKR1 / SNOWFALL1: ...and a pack shipped in the texture door is a switch of its own on the packs card
  for (const m of ENVIRONMENT_PACK_MODS) named.add(m.dir);   // OWN-WORK4: a pack is its directory's key
  // MUDEX1: MUDEX is Meaner Monsters' switch beside Daggerfall Enemy Expansion, so the Meaner Monsters row turns it off
  if (named.has('meanerMonsters') && named.has('daggerfall-enemy-expansion')) named.add('mudex');
  const folders = readdirSync(join(root, 'vendor'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  const mods = [...new Set([...folders, ...retiredKeys()])].filter((k) => !(k in NOT_A_SWITCH));
  const missing = mods.filter((k) => !named.has(k) && !named.has(k.toLowerCase()));
  assert.deepEqual(missing, [], 'these mods have no row on the Features home, so a player cannot find - or turn off - them');
  // ...and the population, so a rewording cannot empty the gate.
  assert.ok(mods.length >= 40, `the mods are still here: ${mods.length}`);
});

test('WM3: the Windmills row is a real switch the mill draw reads', () => {
  const row = FEATURES.find((f) => f.id === 'mod-windmills-kamer');
  assert.ok(row, 'the pack has a row');
  assert.equal(row.title, 'Windmills of Daggerfall', 'CREDITS-OUT: the mod\'s name alone, no author');
  assert.deepEqual([...row.kinds], ['mod']);
  assert.equal(row.control.store, 'prefs');
  assert.equal(row.control.key, WINDMILLS_KEY);
  assert.equal(row.control.initial, true, 'on by default - the mills were standing before the switch existed');
  // the switch is READ where the mills are drawn, and the skin is the
  // other half of the gate (a switch cannot put a departure on classic)
  assert.match(read('src/world/rmbLayout.js'), /if \(mills\.length && enhanced && windmills\) \{/);
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(read(host), /layoutLocation(?:Steps)?\(dfLocation, maps, blocks, \{ enhanced: isEnhanced\(\), windmills: windmillsOn\(\) \}\)/,   // PIN MOVED (IC-STUTTER): the streaming host's a block a step
      `${host}: the host passes the switch (THE FOUR HOSTS - both exterior hosts lay out a location)`);
  }
  assert.match(read('src/world/locationLayout.js'), /layoutRmbBlock\(dfBlock, \{ enhanced, windmills \}\)/, 'and it rides through the location layout');
});
