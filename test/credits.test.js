import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CREDITS } from '../src/ui/credits.js';

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
