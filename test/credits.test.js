import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CREDITS } from '../src/ui/credits.js';
import { FEATURES, WINDMILLS_KEY } from '../src/systems/features.js';   // WM3: the Features home, and the Windmills switch's declaration

// CR1 - THE CREDITS (Mac, 2026-08-30: "as we integrate these I really
// want to give credit to the mod developer who created it").
//
// The rule these pins enforce: nothing is vendored without a credit ON
// THE SCREEN, and no credit names a folder that is not there. A README
// credits the author to whoever reads the repo; the About pane credits
// them to whoever plays, and a modder's name belongs in front of the
// player.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const rows = [...CREDITS.builtOn, ...CREDITS.mods];

test('CR1: every vendored folder is credited, and every credited folder exists with a README naming the same author', () => {
  const folders = readdirSync(join(root, 'vendor'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  const credited = rows.flatMap((r) => r.vendor ?? []);
  for (const f of folders) assert.ok(credited.includes(f), `vendor/${f} has no credit on the About screen`);
  for (const r of rows) {
    for (const f of r.vendor ?? []) {
      assert.ok(folders.includes(f), `"${r.title}" credits vendor/${f}, which does not exist`);
      assert.ok(existsSync(join(root, 'vendor', f, 'README.md')), `vendor/${f} has no README`);
      const readme = read(`vendor/${f}/README.md`);
      // The author the screen names is the author the README names.
      // Surname/handle match: "Kamer", "Interkarma".
      const key = r.author.match(/\(([^)]+)\)/)?.[1] ?? r.author.split(/\s+/)[0];
      assert.match(readme, new RegExp(key), `vendor/${f}/README.md does not name ${key}`);
    }
  }
});

test('CR1: a mod row carries what a modder is owed - title, author, what it is, the terms it is carried under', () => {
  assert.ok(CREDITS.mods.length >= 1, 'no mods credited');
  for (const m of CREDITS.mods) {
    for (const k of ['title', 'author', 'what', 'terms', 'vendor']) assert.ok(m[k], `mod "${m.title}" lacks ${k}`);
    assert.match(m.terms, /permission/i, 'a mod is carried with permission or not at all');
    assert.ok(m.vendor.length >= 1);
    // No invented contact: it is the manifest's own words or absent.
    if (m.contact) assert.doesNotMatch(m.contact, /^https?:/, 'a contact is a name from the manifest, not a guessed URL');
  }
  const kamer = CREDITS.mods.find((m) => m.author === 'Kamer');
  assert.ok(kamer, 'Windmills of Daggerfall is not credited');
  assert.equal(kamer.title, 'Windmills of Daggerfall');
  assert.equal(kamer.version, '2.0');
  assert.deepEqual([...kamer.vendor], ['windmills-kamer']);
  // His manifest (WindMills.dfmod.json, not vendored - it is Unity's
  // format): ModAuthor "Kamer", ModVersion "2.0", ContactInfo "DFU
  // Discord". The screen says what the manifest says.
  assert.equal(kamer.contact, 'DFU Discord');
});

test('CR1: the About pane renders the table, mods under their own heading, through the one module', () => {
  const menu = read('src/ui/enhancedMenu.js');
  assert.match(menu, /import \{ CREDITS \} from '\.\/credits\.js'/);
  assert.match(menu, /function paneAbout\(body\) \{[\s\S]*?body\.append\(creditsCard\(\)\);/, 'About does not show the credits');
  assert.match(menu, /group\('Built on', CREDITS\.builtOn\);\s*\n\s*group\('Mods', CREDITS\.mods\);/, 'the two groups are not both rendered, in that order');
  // The renderer knows the SHAPE and no work by name.
  const fn = menu.slice(menu.indexOf('function creditsCard()'), menu.indexOf('// ── SHELL'));
  for (const r of rows) assert.doesNotMatch(fn, new RegExp(r.author.split(/\s+/)[0]), 'a credit is hard-coded in the renderer');
  // Every field a row can carry reaches the screen.
  for (const k of ['title', 'version', 'author', 'what', 'terms', 'contact', 'link']) assert.match(fn, new RegExp(`r\\.${k}\\b`), `renderer ignores ${k}`);
  assert.match(read('src/ui/enhancedStyle.js'), /\.credit-by \{ color: var\(--brass\)/, 'the author\'s name is not set in the skin\'s brass');
});

// ═══ WM3: A CREDITED MOD IS A MOD THE PLAYER CAN FIND ═════════════
//
// (2026-09-15, Mac: "the windmills of daggerfall is missing from
// credits and the feature menu.")
//
// The credit was there and the gate above proves it. The FEATURES
// screen was not, and the reason is worth keeping: `features.js`
// builds a mod's tile out of the vendor's own `Enabled` setting key
// (`modFeature`), so a pack with no shipped settings file could not
// have a row, and the page said so - "Windmills (Kamer) has no switch
// and so no row - a row needs a control." True of the machinery, and
// the wrong answer: it made the mod unfindable and un-turn-off-able,
// and FT14 turned that from a quirk into a disappearance when it
// retired the Mods pane, which had been the one surface listing every
// vendored pack whether or not it had a knob.
//
// So the rule the pin above states for the CREDITS is stated here for
// the FEATURES home, and it is derived from `CREDITS.mods` rather than
// from a list: a work the About page calls a mod is a work the player
// can find and switch. `builtOn` is deliberately exempt - Daggerfall
// itself and a font are not features.
test('WM3: every mod on the credits screen has a row on the Features home', () => {
  // A vendor is REACHABLE from a row when the row's own control names
  // it, or when a condensed row names it in `also` (FT2/FT4 - Dynamic
  // Skies rides the outdoors row and has no tile of its own), or when
  // a prefs row is declared for it by id.
  const named = new Set();
  for (const f of FEATURES) {
    // `also` hangs off the CONTROL, not the row (FT2's shape), which is
    // where Dynamic Skies lives: the outdoors switch writes the pack's
    // Enabled key beside its own.
    for (const c of [f.control, ...(f.control?.also ?? []), ...(f.also ?? [])]) {
      if (c?.store === 'mods' && c.vendor) named.add(c.vendor);
    }
    const m = /^mod-(.+)$/.exec(f.id ?? '');
    if (m) named.add(m[1]);
  }
  const missing = CREDITS.mods
    .flatMap((r) => (r.vendor ?? []).map((v) => [r.title, v]))
    .filter(([, v]) => !named.has(v) && !named.has(v.toLowerCase()));
  assert.deepEqual(missing.map(([t, v]) => `${t} (vendor/${v})`), [],
    'these mods are credited on the About page and have no row on the Features home, so a player\n'
    + 'can read the author\'s name and still not find - or turn off - what they made:');
  // ...and the population, so a rewording cannot empty the gate.
  assert.ok(CREDITS.mods.length >= 9, `the credited mods are still here: ${CREDITS.mods.length}`);
});

test('WM3: the Windmills row is a real switch the mill draw reads', () => {
  const row = FEATURES.find((f) => f.id === 'mod-windmills-kamer');
  assert.ok(row, 'the pack has a row');
  assert.equal(row.title, 'Windmills of Daggerfall by Kamer', 'the author\'s name is ON the row');
  assert.deepEqual([...row.kinds], ['mod']);
  assert.equal(row.control.store, 'prefs');
  assert.equal(row.control.key, WINDMILLS_KEY);
  assert.equal(row.control.initial, true, 'on by default - the mills were standing before the switch existed');
  // the switch is READ where the mills are drawn, and the skin is the
  // other half of the gate (a switch cannot put a departure on classic)
  assert.match(read('src/world/rmbLayout.js'), /if \(mills\.length && enhanced && windmills\) \{/);
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(read(host), /layoutLocation\(dfLocation, maps, blocks, \{ enhanced: isEnhanced\(\), windmills: windmillsOn\(\) \}\)/,
      `${host}: the host passes the switch (THE FOUR HOSTS - both exterior hosts lay out a location)`);
  }
  assert.match(read('src/world/locationLayout.js'), /layoutRmbBlock\(dfBlock, \{ enhanced, windmills \}\)/, 'and it rides through the location layout');
});
