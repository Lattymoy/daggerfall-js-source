// PX23 - THE SPELLBOOK'S ONE DOOR, AND THE ENHANCED BOOK.
//
// Mac's call, off the arc's own board: the spellbook next. It was the
// fifth window four hosts built by hand, and the last classic canvas
// window either enhanced screen still pushed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bookModel, effectWords } from '../src/ui/enhancedSpellbook.js';
import {
  spellPointCost, EFFECT_NOT_FOUND,
  CANNOT_DELETE_VAMP, CANNOT_DELETE_WERE,
  VAMPIRE_SPELL_TAG, LYCANTHROPY_SPELL_TAG,
} from '../src/ui/spellbookWindow.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('PX23 door: four hosts collapse to ONE seam, and the BUY window is not it', () => {
  // The board's own grep, re-run as a pin: nothing but the door and the
  // merchant's shop may construct a SpellbookWindow.
  const builders = ['src/scenes/dungeonContext.js', 'src/scenes/exterior.js', 'src/scenes/world.js', 'src/scenes/worldModes.js']
    .flatMap((f) => [...read(f).matchAll(/new SpellbookWindow\(/g)].map(() => f));
  assert.deepEqual(builders, ['src/scenes/worldModes.js'],
    'only the spell merchant builds its own - the player book goes through the door');
  // ...and that one is the BUY window, with its own deps. It looks like
  // a duplicate from a distance and is a different question.
  const wm = read('src/scenes/worldModes.js');
  const buy = wm.slice(wm.indexOf('new SpellbookWindow('), wm.indexOf('new SpellbookWindow(') + 700);
  assert.match(buy, /buyMode: true/);
  for (const dep of ['offered:', 'buildingQuality:', 'shopName:', 'skills:']) assert.ok(buy.includes(dep), dep);
  // Every host now hands the door only what THAT host knows - and the
  // rows seam is the one thing that differed between them.
  for (const f of ['src/scenes/dungeonContext.js', 'src/scenes/exterior.js', 'src/scenes/world.js', 'src/scenes/worldModes.js']) {
    const s = read(f);
    assert.match(s, /createSpellbookWindow\(\{/, `${f} goes through the door`);
    assert.match(s, /rows: \(id\) =>/, `${f} keeps its own TEXT.RSC reach`);
    // The latch moved into the door for the PLAYER's book. worldModes
    // keeps one, and it is the BUY window's - a shop needs to know what
    // you already own to grey out what you have.
    const latches = (s.match(/spells: \(\) => \(playerEntity\.spells \?\?= \[\]\)/g) ?? []).length;
    assert.equal(latches, f.endsWith('worldModes.js') ? 1 : 0, `${f}: only the buy window still latches`);
  }
  // The door owns the shared four, including the latch and the free cast.
  const door = read('src/ui/spellbookDoor.js');
  assert.match(door, /spells: \(\) => \(entity\.spells \?\?= \[\]\)/);
  assert.match(door, /onReady: \(sp, \{ noSpellPointCost \} = \{\} \) =>|onReady: \(sp, \{ noSpellPointCost \} = \{\}\) =>/);
  assert.match(door, /export function spellbookDoorReady\(\)/);
  assert.match(door, /return isEnhanced\(\) \|\| spellbookArtLoaded\(\);/, 'the readiness gate differs by skin, as charSheetDoor\'s does');
});

test('PX23 book: it borrows every law and invents none', () => {
  // The free-cast quirk is the CLASSIC's (spellPointCost), not a second
  // reading of it: a lycanthropy spell costs 0 in both books.
  const spells = [
    { name: 'Free Action', effects: [{ type: 1, subType: 0 }], cost: 12 },
    { name: 'Nightstalker', tag: LYCANTHROPY_SPELL_TAG, effects: [{ type: 1, subType: 0 }], cost: 40 },
    { name: 'Vampiric Touch', tag: VAMPIRE_SPELL_TAG, effects: [], cost: 25 },
  ];
  const rows = bookModel(spells, (sp) => sp.cost);
  assert.deepEqual(rows.map((r) => r.cost), [12, 0, 25]);
  assert.equal(rows[1].cost, spellPointCost(spells[1], (sp) => sp.cost));
  // The two refusals are the classic's own WORDS, imported not retyped.
  assert.equal(rows[0].undeletable, null);
  assert.equal(rows[1].undeletable, CANNOT_DELETE_WERE);
  assert.equal(rows[2].undeletable, CANNOT_DELETE_VAMP);
  // The effects filter drops the empty slots, and an unknown key gets
  // the classic's fallback rather than a blank.
  assert.deepEqual(effectWords({ type: 999, subType: 0 }), { group: EFFECT_NOT_FOUND, subgroup: '999,0' });
  assert.equal(effectWords(null), null);
  assert.equal(rows[2].effects.length, 0);
  assert.ok(rows[0].effects[0].group.length > 0);
  // ...and the source of the naming is the classic book's own module.
  const book = read('src/ui/enhancedSpellbook.js');
  assert.match(book, /from '\.\.\/systems\/spellEffects\.js'/, 'the same effectByKey spellbookWindow.js:120 uses');
  assert.match(book, /spellEffects, spellPointCost, EFFECT_NOT_FOUND,/, 'the laws are imported, not rewritten');
  assert.doesNotMatch(book, /tag === 'lycanthrope'|tag === 'vampire'/, 'the tags are constants, never typed');
});

test('PX23 book: the pixel family\'s own bones, and no invented furniture', () => {
  const book = read('src/ui/enhancedSpellbook.js');
  const css = read('src/ui/enhancedStyle.js');
  // The journal's bones a fifth time - the same classes PX4 gave the
  // quest page, so one structure learned once is the whole window's.
  for (const cls of ['px-journal', 'px-qrail', 'px-qdetail', 'px-qname', 'px-qwing']) {
    assert.ok(book.includes(cls), `${cls} is the journal's own`);
  }
  // The divider is the pause window's, gem-word-gem, not one invented here.
  assert.match(book, /d\.append\(el\('span', 'px-gem'\), el\('span', 'px-divword', word\), el\('span', 'px-gem'\)\);/);
  assert.match(read('src/ui/enhancedMenu.js'), /d\.append\(el\('span', 'px-gem'\), el\('span', 'px-divword', word\), el\('span', 'px-gem'\)\);/,
    'and it matches the window it was borrowed from');
  // The head is the pack's three zones (PX19/PX21d), centred.
  // PX24: the head is the FAMILY's now - shared with the chronicle
  // rather than scoped to this one window, which is what that slice's
  // first render caught.
  assert.match(css, /\.sb-shell \.sb-top, \.cr-shell \.sb-top \{ display: grid; grid-template-columns: 1fr auto 1fr;/);
  // The cost rides the rail row, right-aligned in brass - the classic's
  // "cost - name" as a column, which reads better than a prefix.
  assert.match(css, /\.sb-shell \.sb-cost, \.cr-shell \.sb-cost \{ margin-left: auto; color: var\(--brass\);/);
  assert.match(book, /b\.append\(el\('span', 'sb-cost', String\(r\.cost\)\)\);/);
});
