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
  // PX23b: an entry carries its numbers too - here there are none.
  assert.deepEqual(effectWords({ type: 999, subType: 0 }), { group: EFFECT_NOT_FOUND, subgroup: '999,0', parts: [] });
  assert.equal(effectWords(null), null);
  assert.equal(rows[2].effects.length, 0);
  assert.ok(rows[0].effects[0].group.length > 0);
  // ...and the source of the naming is the classic book's own module.
  const book = read('src/ui/enhancedSpellbook.js');
  assert.match(book, /from '\.\.\/systems\/spellEffects\.js'/, 'the same effectByKey spellbookWindow.js:120 uses');
  assert.match(book, /spellEffects, spellPointCost, EFFECT_NOT_FOUND,/, 'the laws are imported, not rewritten');
  assert.doesNotMatch(book, /tag === 'lycanthrope'|tag === 'vampire'/, 'the tags are constants, never typed');
});

test('AUDIT 39: DELETE is two presses in BOTH books, and the words are the classic\'s', () => {
  // The enhanced book spliced `deps.spells()` - which spellbookDoor
  // hands over as `entity.spells` BY REFERENCE - on a single click,
  // while DFU's DeleteButton_OnMouseClick (:811-838) ends by parking
  // the row in deleteSpellIndex and raising a YesNo box on
  // "deleteSpell", and only DeleteSpellConfirm_OnButtonClick's Yes arm
  // (:840-852) deletes. The port's CLASSIC window carries all of that,
  // so the two skins disagreed about an unrecoverable act.
  const src = read('src/ui/enhancedSpellbook.js');
  assert.match(src, /DELETE_SPELL_PROMPT/, 'the prompt is the classic\'s own string, imported');
  assert.doesNotMatch(src, /'Do you want to delete this spell\?'/, 'and never retyped');
  assert.match(src, /^let deleting = null;/m, 'deleteSpellIndex, by another name');
  // THE PRESS ARMS, IT DOES NOT DELETE.
  const del = src.slice(src.indexOf("const del = el('button', 'act', 'Delete');"));
  const arm = del.slice(0, del.indexOf('acts.append(del);'));
  assert.match(arm, /deleting = sel\.i;/);
  assert.doesNotMatch(arm, /splice/, 'the Delete button must not touch the array');
  // ...and the two refusals still answer FIRST, as they do in DFU.
  assert.ok(arm.indexOf('sel.undeletable') < arm.indexOf('deleting = sel.i;'));
  // ONLY YES SPLICES, and the close is OUTSIDE the Yes arm (:851) -
  // which is what the port's classic confirmDelete does too.
  const card = del.slice(del.indexOf('if (deleting !== null) {'));
  const yes = card.slice(card.indexOf('yes.onclick'), card.indexOf('const no ='));
  assert.match(yes, /list\.splice\(deleting, 1\);/);
  assert.match(yes, /onExit\(\);/);
  assert.match(card, /no\.onclick = \(\) => \{ deleting = null; onExit\(\); \};/,
    'No deletes nothing and still closes');
  assert.equal((card.match(/splice/g) ?? []).length, 1, 'exactly one splice, on Yes');
  // The box is MODAL: Escape is its No, and the rail is dead under it.
  const onKey = src.slice(src.indexOf('function onKey(e)'));
  assert.ok(onKey.indexOf('if (deleting !== null) {') < onKey.indexOf("e.key === 'ArrowDown'"),
    'the arrows must not walk the rail while the box is up');
  // and the classic window it is now level with has not moved.
  const classic = read('src/ui/spellbookWindow.js');
  assert.match(classic, /this\.deleteSpellIndex = this\.selectedIndex;\n\s*this\.top = 'delete';/);
  assert.match(classic, /confirmDelete\(yes\) \{\n\s*if \(yes && this\.deleteSpellIndex !== -1\)/);
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

// ── PX23b: THE SAME LOVE (Mac: "revisit the spell UI") ────────────
// The chronicle's two lessons, applied here: an effect carries NUMBERS
// the first draft never read, and the classic can RENAME while the
// first draft could not.
import { effectWords as ew, spellFrame } from '../src/ui/enhancedSpellbook.js';
import { TARGET_DESCRIPTIONS, ELEMENT_DESCRIPTIONS } from '../src/ui/spellIcons.js';

test('PX23b: an effect carries magnitude, duration and chance - and the first draft read none', () => {
  // spellEffects hands back the effect RECORDS; systems/effects.js
  // reads exactly these fields (:446-454) to resolve a live effect.
  const e = ew({
    type: 1, subType: 0,
    magnitudeBaseLow: 8, magnitudeBaseHigh: 20, magnitudeLevelBase: 2,
    durationBase: 6, durationMod: 1, chanceBase: 0,
  });
  assert.deepEqual(e.parts, ['8-20 +2/level', '6 +1/level rounds']);
  // Each part appears only when the effect HAS it: a spell with no
  // magnitude should not read "0 to 0".
  assert.deepEqual(ew({ type: 1, subType: 0 }).parts, []);
  assert.deepEqual(ew({ type: 1, subType: 0, magnitudeBaseLow: 5, magnitudeBaseHigh: 5 }).parts, ['5']);
  assert.deepEqual(ew({ type: 1, subType: 0, chanceBase: 40, chanceMod: 2 }).parts, ['40% +2/level']);
  // ...and the names still come from the classic's own key lookup.
  assert.ok(e.group.length > 0);
  const src = read('src/ui/enhancedSpellbook.js');
  assert.match(src, /magnitudeBaseLow|durationBase|chanceBase/, 'the record is read, not just its type');
});

test('PX23b: the two icons the classic only shows on HOVER are printed as words', () => {
  // spellbookWindow.js:384/388 pushes TARGET_DESCRIPTIONS and
  // ELEMENT_DESCRIPTIONS into a tooltip. This window draws no icons -
  // it reads no ARENA2 - so it prints what they mean, which is more
  // than the classic tells you at a glance.
  assert.deepEqual(spellFrame({ rangeType: 4, element: 0 }),
    { target: TARGET_DESCRIPTIONS[4], element: ELEMENT_DESCRIPTIONS[0] });
  // A spell with NO rangeType is not "Caster only" by accident - the
  // absent field reads as absent, so the chip does not appear at all.
  assert.equal(spellFrame({}).target, null, 'no rangeType prints no chip');
  assert.equal(spellFrame({ rangeType: 0 }).target, TARGET_DESCRIPTIONS[0], 'an explicit 0 IS Caster only');
  assert.deepEqual(spellFrame({ rangeType: 99, element: 99 }), { target: null, element: null },
    'an index off the end is nothing, not a blank chip');
  const src = read('src/ui/enhancedSpellbook.js');
  assert.match(src, /from '\.\/spellIcons\.js'/, 'the words are imported, never retyped');
  assert.doesNotMatch(src, /'Caster only'|'Fire based'/);
});

test('PX23b: RENAME comes back, and the book says when you cannot afford a spell', () => {
  const src = read('src/ui/enhancedSpellbook.js');
  // The classic asks "Enter spell name : " (:934); the first draft
  // dropped it - a prettier window that can do less.
  assert.match(src, /ENTER_SPELL_NAME/);
  assert.match(src, /if \(name\) sel\.spell\.name = name;/);
  assert.match(src, /^let renaming = null;/m, 'the edit survives a re-render');
  assert.match(src, /renaming = null;/, 'and a new pick abandons it');
  // AFFORDABILITY: the question a player opens the book with, which the
  // classic answers only by failing at the cast.
  assert.match(src, /const short = Number\.isFinite\(magicka\) && sel\.cost > magicka;/);
  assert.match(src, /not enough magicka/);
  assert.match(read('src/ui/enhancedStyle.js'), /\.sb-shell \.sb-rename input \{[\s\S]{0,120}min-height: 44px;/);
});
