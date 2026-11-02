// PX23 - THE SPELLBOOK'S ONE DOOR, AND THE ENHANCED BOOK.
//
// Mac's call, off the arc's own board: the spellbook next. It was the
// fifth window four hosts built by hand, and the last classic canvas
// window either enhanced screen still pushed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bookModel, effectWords } from '../../../src/ui/enhanced/enhancedSpellbook.js';
import {
  spellPointCost, EFFECT_NOT_FOUND,
  CANNOT_DELETE_VAMP, CANNOT_DELETE_WERE,
  VAMPIRE_SPELL_TAG, LYCANTHROPY_SPELL_TAG,
} from '../../../src/ui/spellbookWindow.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

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
  // the WHOLE call, to its `{ buyMode: true })` - a fixed character window lost a dep the day a line above it grew
  // (RESURRECT1's shelf entry)
  const buy = wm.slice(wm.indexOf('new SpellbookWindow('), wm.indexOf('{ buyMode: true });', wm.indexOf('new SpellbookWindow(')) + 19);
  assert.match(buy, /buyMode: true/);
  for (const dep of ['offered:', 'buildingQuality:', 'shopName:', 'skills:']) assert.ok(buy.includes(dep), dep);
  // Every host now hands the door only what THAT host knows - and the
  // rows seam is the one thing that differed between them.
  for (const f of ['src/scenes/dungeonContext.js', 'src/scenes/exterior.js', 'src/scenes/world.js', 'src/scenes/worldModes.js']) {
    const s = read(f);
    assert.match(s, /createSpellbookWindow\(\{/, `${f} goes through the door`);
    // ROAD A7 MOVED THIS PIN: the painting flow widened the rows seam
    // with the dfRand variant pick in the three hosts that hang
    // paintings; dungeons hang none, so dungeonContext keeps (id).
    assert.match(s, /rows: \(id(?:, pick)?\) =>/, `${f} keeps its own TEXT.RSC reach`);
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
  const book = read('src/ui/enhanced/enhancedSpellbook.js');
  assert.match(book, /from '\.\.\/\.\.\/systems\/spell\/spellEffects\.js'/, 'the same effectByKey spellbookWindow.js:"const template = effectByKey(key);" uses');
  assert.match(book, /spellEffects, spellPointCost, effectNotFoundText,/, 'the laws are imported, not rewritten');
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
  const src = read('src/ui/enhanced/enhancedSpellbook.js');
  assert.match(src, /deleteSpellPrompt\(\)/, 'the prompt is the classic\'s own string, imported');
  assert.doesNotMatch(src, /'Do you want to delete this spell\?'/, 'and never retyped');
  assert.match(src, /^let deleting = null;/m, 'deleteSpellIndex, by another name');
  // THE PRESS ARMS, IT DOES NOT DELETE.
  const del = src.slice(src.indexOf("const del = el('button', 'act', 'Delete');"));
  const arm = del.slice(0, del.indexOf('acts.append(del);'));
  assert.match(arm, /deleting = sel\.i;/);
  assert.doesNotMatch(arm, /splice/, 'the Delete button must not touch the array');
  // ...and the two refusals still answer FIRST, as they do in DFU.
  assert.ok(arm.indexOf('sel.undeletable') < arm.indexOf('deleting = sel.i;'));
  // ONLY YES SPLICES, and BOTH answers dismiss the CARD, not the book.
  //
  // AUDIT-39r: THIS PIN MOVED, DELIBERATELY. The first version read
  // the CloseWindow() at :851 as "either answer ends the book" and
  // demanded onExit() in both arms. That call is
  // UserInterfaceWindow.CloseWindow (:127-132) -> PopWindow ->
  // RemoveWindow (UserInterfaceManager.cs:190-199), which pops
  // TopWindow - the YesNo box mb.Show() pushed, since
  // DaggerfallMessageBox.ActivateButton (:479-484) only raises the
  // event. The spellbook stays, which is why the Yes arm bothers with
  // RefreshSpellsList(true) and UpdateSelection().
  const confirm = src.slice(src.indexOf('function confirmDelete(yes) {'));
  const bodyOf = confirm.slice(0, confirm.indexOf('\n}'));
  assert.match(bodyOf, /if \(yes && deleting !== null\)/, 'only Yes splices');
  assert.match(bodyOf, /list\.splice\(deleting, 1\);/);
  assert.match(bodyOf, /deleting = null;\n\s*render\(\);/, 'both answers redraw the book that stays');
  assert.doesNotMatch(bodyOf, /onExit/, 'no answer to this box closes the spellbook');
  assert.equal((src.match(/\.splice\(/g) ?? []).length, 1, 'exactly one splice in the whole file, and it is this one');
  // The box is MODAL, as a PUSHED DaggerfallMessageBox is: the window
  // under the scrim is disabled outright, so Ready cannot ready a
  // spell and a rail row cannot silently drop the question.
  const scrim = src.slice(src.indexOf('if (deleting !== null) {', src.indexOf('win.append(body);')));
  assert.match(scrim, /win\.querySelectorAll\('button, input'\)\) b\.disabled = true;/,
    'every control beneath the prompt goes dead');
  assert.match(scrim, /win\.append\(deleteScrim\(\)\);/, 'and the prompt is drawn OVER the window');
  assert.match(read('src/ui/enhanced/enhancedStyle.js'), /\.sb-shell \.sb-ask \{ position: absolute; inset: 0;/,
    'the scrim is a scrim, not a card parked in the detail column');
  // ...and it answers to the same two keys the classic window does
  // (spellbookWindow.js KeyY/KeyN), which the first version had not:
  // Escape was its only answer and nothing at all was Yes.
  const onKey = src.slice(src.indexOf('function onKey(e)'));
  assert.ok(onKey.indexOf('if (deleting !== null) {') < onKey.indexOf("e.key === 'ArrowDown'"),
    'the arrows must not walk the rail while the box is up');
  const gate = onKey.slice(onKey.indexOf('if (deleting !== null) {'), onKey.indexOf("e.key === 'ArrowDown'"));
  assert.match(gate, /e\.code === 'KeyY'/, 'Y answers Yes');
  assert.match(gate, /e\.code === 'KeyN'/, 'N answers No');
  assert.match(gate, /overlayAction\(e\) === 'back'/, 'and Escape is the No the classic window reads');
  assert.match(gate, /confirmDelete\(yes\);/, 'both keys land on the one handler the buttons use');
  // and the classic window it is now level with reads the same law.
  const classic = read('src/ui/spellbookWindow.js');
  assert.match(classic, /this\.deleteSpellIndex = this\.selectedIndex;\n\s*this\.top = 'delete';/);
  assert.match(classic, /confirmDelete\(yes\) \{\n\s*if \(yes && this\.deleteSpellIndex !== -1\)/);
  const classicConfirm = classic.slice(classic.indexOf('confirmDelete(yes) {'));
  assert.doesNotMatch(classicConfirm.slice(0, classicConfirm.indexOf('\n  }')), /this\._close\(\)/,
    'the classic book carried the same misreading and no longer does');
});

test('PX23 book: the pixel family\'s own bones, and no invented furniture', () => {
  const book = read('src/ui/enhanced/enhancedSpellbook.js');
  const css = read('src/ui/enhanced/enhancedStyle.js');
  // The journal's bones a fifth time - the same classes PX4 gave the
  // quest page, so one structure learned once is the whole window's.
  for (const cls of ['px-journal', 'px-qrail', 'px-qdetail', 'px-qname', 'px-qwing']) {
    assert.ok(book.includes(cls), `${cls} is the journal's own`);
  }
  // The divider is the pause window's, gem-word-gem, not one invented here.
  assert.match(book, /d\.append\(el\('span', 'px-gem'\), el\('span', 'px-divword', word\), el\('span', 'px-gem'\)\);/);
  assert.match(read('src/ui/enhanced/enhancedMenu.js'), /d\.append\(el\('span', 'px-gem'\), el\('span', 'px-divword', word\), el\('span', 'px-gem'\)\);/,
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
import { effectWords as ew, spellFrame } from '../../../src/ui/enhanced/enhancedSpellbook.js';
import { TARGET_DESCRIPTIONS, ELEMENT_DESCRIPTIONS } from '../../../src/ui/spell/spellIcons.js';

test('PX23b: an effect carries magnitude, duration and chance - and the first draft read none', () => {
  // spellEffects hands back the effect RECORDS; the cast engine
  // resolves a live effect from exactly these eleven fields.
  //
  // SB-FX: THIS PIN MOVED, DELIBERATELY. It asserted '8-20 +2/level' and
  // '6 +1/level rounds' for a Continuous Damage Health record and
  // '40% +2/level' for a chance that effect does not have: it read
  // magnitudeLevelBase (MagnitudePlusMin) as a per-level step, and its
  // literals held ZEROS in the fields no producer zeroes, so "a field
  // that is not 0 is a component" passed here and nowhere in the game
  // (the SB-FX pins below are built from the producers). The law it was
  // written for stands: the record's numbers are read - all eleven, as
  // ClassicEffectRecordToEffectSettings reads them - and a component
  // appears only when the effect HAS it, by the effect's support flags.
  const rec = (type, subType) => ({ type, subType,
    durationBase: 6, durationMod: 1, durationPerLevel: 2, chanceBase: 40, chanceMod: 2, chancePerLevel: 3,
    magnitudeBaseLow: 8, magnitudeBaseHigh: 20, magnitudeLevelBase: 2, magnitudeLevelHigh: 5, magnitudePerLevel: 4 });
  const e = ew(rec(1, 0));   // Continuous Damage Health: duration and magnitude, no chance
  assert.deepEqual(e.parts, ['Duration: 6 + 1 per 2 level(s)', 'Magnitude: 8 - 20 + 2 - 5 per 4 level(s)']);
  assert.deepEqual(ew(rec(0, -1)).parts, ['Duration: 6 + 1 per 2 level(s)', 'Chance: 40 + 2 per 3 level(s)'],
    'Paralyze, its subType the signed byte a record reads: duration and chance, no magnitude');
  assert.deepEqual(ew(rec(26, 255)).parts, ['Duration: 6 + 1 per 2 level(s)'], 'Free Action: duration alone');
  assert.deepEqual(ew(rec(43, 255)).parts, [], 'Teleport supports none - its name alone, whatever its fields hold');
  // A per-level divisor the record leaves at 0 reads as DFU floors it, at 1.
  assert.deepEqual(ew({ ...rec(4, 0), magnitudePerLevel: 0 }).parts, ['Magnitude: 8 - 20 + 2 - 5 per 1 level(s)']);
  // ...and the names still come from the classic's own key lookup.
  assert.ok(e.group.length > 0);
  const src = read('src/ui/enhanced/enhancedSpellbook.js');
  assert.match(src, /const s = classicEffectSettings\(effect\);/, 'the record is read as DFU instantiates it, not just its type');
});

test('PX23b: the two icons the classic only shows on HOVER are printed as words', () => {
  // spellbookWindow.js:"this.tip.show(TARGET_DESCRIPTIONS[spell.rangeType] ?? null, vx, vy)"/spellbookWindow.js:"this.tip.show(ELEMENT_DESCRIPTIONS[spell.element] ?? null, vx, vy)" pushes TARGET_DESCRIPTIONS and
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
  const src = read('src/ui/enhanced/enhancedSpellbook.js');
  assert.match(src, /from '\.\.\/spell\/spellIcons\.js'/, 'the words are imported, never retyped');
  assert.doesNotMatch(src, /'Caster only'|'Fire based'/);
});

test('PX23b: RENAME comes back, and the book says when you cannot afford a spell', () => {
  const src = read('src/ui/enhanced/enhancedSpellbook.js');
  // The classic asks "Enter spell name : " (:934); the first draft
  // dropped it - a prettier window that can do less.
  assert.match(src, /enterSpellNameLabel\(\)/);
  // AUDIT 68 S31-enhanced-rename-mutates-shared-spell: MOVED, deliberately - this pinned
  // `sel.spell.name = name`, a write into the shared (or frozen RRI) record; the edit is the classic's copy now.
  assert.match(src, /if \(name\) editBookSpell\(deps\.spells\?\.\(\), sel\.i, \{ name \}\);/);
  assert.match(src, /^let renaming = null;/m, 'the edit survives a re-render');
  assert.match(src, /renaming = null;/, 'and a new pick abandons it');
  // AFFORDABILITY: the question a player opens the book with, which the
  // classic answers only by failing at the cast.
  assert.match(src, /const short = Number\.isFinite\(magicka\) && sel\.cost > magicka;/);
  assert.match(src, /Not enough magicka/);
  assert.match(read('src/ui/enhanced/enhancedStyle.js'), /\.sb-shell \.sb-rename input \{[\s\S]{0,120}min-height: 44px;/);
});

// ── SB-FX (2026-10-14, a player on Discord: "The spell details panel in the Spellbook shows placeholder values
// instead of what the spell actually does") ─────────────────────────────────────────────────────────────────────────
// Built from the PRODUCER, not a literal: the spell the real SpellMakerWindow inscribes, through its own clicks and
// its own typed spinner field, then saved and restored the way a player's book is.
import { SpellMakerWindow, SPELL_MAKER_RECTS, EDITOR_RECTS } from '../../../src/ui/spell/spellMakerWindow.js';
import { SPELLBOOK_TEMPLATE_INDEX } from '../../../src/systems/spell/spellMaker.js';
import { spellMakerGroups, spellMakerSubgroups, SPELL_MAKER_EFFECTS } from '../../../src/systems/spell/spellEffects.js';
import { snapshotPlayer, restorePlayer } from '../../../src/systems/save/save.js';
import { readSpellsStd } from '../../../src/formats/spellsStd.js';
import { join } from 'node:path';

/** A spell made at the maker, as a player makes one: each effect picked from the two lists, its settings typed into
 *  the editor's fields (the enhanced port's door - ui/enhanced/enhancedPorts.js spellEditorView's `set`), the editor shut, a
 *  target and an element pressed, a name, Buy. Answers the record the book is handed. */
function madeSpell(effects, { target, element, name }) {
  const entity = { name: 'S', level: 1, stats: {}, skills: [50], maxMagicka: 40, goldPieces: 100000,
    items: [{ group: 'MiscItems', templateIndex: SPELLBOOK_TEMPLATE_INDEX }], spells: [] };
  const w = new SpellMakerWindow({ entity });
  const press = ([x, y]) => w.click(x + 1, y + 1);
  for (const [group, subgroup, settings] of effects) {
    press(SPELL_MAKER_RECTS.addEffect);
    w.picker.selectedIndex = spellMakerGroups().indexOf(group);
    w.picker.input('Enter');
    if (subgroup) {
      w.picker.selectedIndex = spellMakerSubgroups(group).findIndex((e) => e.subgroup === subgroup);
      w.picker.input('Enter');
    }
    assert.ok(w.editor, `${group} ${subgroup}: the editor opened`);
    for (const [field, v] of settings) w.editor.setValue(field, v);
    press(EDITOR_RECTS.exit);
    assert.equal(w.editor, null, 'and shut');
  }
  press(SPELL_MAKER_RECTS[target]);
  press(SPELL_MAKER_RECTS[element]);
  w.name = name;
  press(SPELL_MAKER_RECTS.buySpell);
  assert.equal(entity.spells.length, 1, 'the spell was inscribed');
  return { entity, spell: entity.spells[0] };
}

test('SB-FX: the book reads the spell the SPELL MAKER inscribed - its own settings, and only the parts its effects support', () => {
  // The player's spell: By Touch, Shock based, Damage Health - and a Paralyze beside it, for the two components
  // Damage Health does not have. Every value is one the maker's floor of 1 cannot fake.
  const { entity, spell } = madeSpell([
    ['Damage', 'Health', [['magnitudeBaseHigh', 12], ['magnitudeBaseLow', 4], ['magnitudeLevelHigh', 6], ['magnitudeLevelBase', 2],
      ['magnitudePerLevel', 3], ['durationBase', 20], ['chanceBase', 50]]],
    ['Paralyze', null, [['durationBase', 5], ['durationMod', 2], ['durationPerLevel', 3],
      ['chanceBase', 30], ['chanceMod', 4], ['chancePerLevel', 2], ['magnitudeBaseHigh', 9]]],
  ], { target: 'byTouch', element: 'shockBased', name: 'Spark' });
  // THE PRODUCER'S SHAPE, which is why reading a field's value for "has it" can never work: a greyed-out spinner
  // takes no value (DaggerfallEffectSettingsEditorWindow.InitControlState) and keeps the maker's floor of 1
  // (blankEffectSettings - DefaultEffectSettings' "1 + 1 per level"), so Damage Health is inscribed holding a
  // duration and a chance of 1 + 1 per 1 level, and Paralyze a magnitude of 1 - 1 + 1 - 1.
  assert.deepEqual([spell.rangeType, spell.element], [1, 3]);
  const [dmg, para] = spell.effects;
  assert.deepEqual([dmg.type, dmg.subType, dmg.durationBase, dmg.durationMod, dmg.chanceBase, dmg.chanceMod], [4, 0, 1, 1, 1, 1]);
  assert.deepEqual([para.type, para.subType, para.magnitudeBaseLow, para.magnitudeBaseHigh, para.magnitudeLevelBase], [0, 255, 1, 1, 1]);
  // THE BOOK SAYS WHAT THE SPELL DOES. Each part is the component's header row of DFU's own spellbook description
  // (DaggerfallSpellBookWindow.ShowEffectPopup's SpellBookDescription - TEXT.RSC 1212 for Damage Health,
  // 1202 for Paralyze), over the settings ClassicEffectRecordToEffectSettings gives the effect - and a component
  // the effect does not support (SupportDuration / SupportChance / SupportMagnitude) is not printed at all.
  const want = [
    ['Magnitude: 4 - 12 + 2 - 6 per 3 level(s)'],
    ['Duration: 5 + 2 per 3 level(s)', 'Chance: 30 + 4 per 2 level(s)'],
  ];
  const [row] = bookModel(entity.spells, () => 0);
  assert.deepEqual(row.effects.map((e) => [e.group, e.subgroup]), [['Damage', 'Health'], ['Paralyze', '']]);
  assert.deepEqual(row.effects.map((e) => e.parts), want);
  // ...and the book a SAVE brings back says the same: a made spell travels whole (systems/save/save.js snapshotPlayer).
  const back = { name: 'S' };
  restorePlayer(back, JSON.parse(JSON.stringify(snapshotPlayer(entity))), new Map());
  assert.deepEqual(back.spells[0].effects, spell.effects, 'the settings round-trip');
  assert.deepEqual(bookModel(back.spells, () => 0)[0].effects.map((e) => e.parts), want);
});

test('SB-FX: on the real SPELLS.STD every stock effect reads its supported components alone, with the record\'s own numbers', (t) => {
  // The stock records are the book's other producer, and they carry the same 1s: all 99 effect slots in the file
  // hold 1 + 1 per 1 level in a component their effect does not support.
  if (!process.env.ARENA2_PATH) return t.skip('ARENA2_PATH not set');
  const spells = readSpellsStd(new Uint8Array(readFileSync(join(process.env.ARENA2_PATH, 'SPELLS.STD'))));
  const shock = spells.find((s) => s.index === 8);
  assert.equal(shock.name, 'Shock');
  assert.deepEqual(effectWords(shock.effects[0]).parts, ['Magnitude: 1 - 20 + 1 - 4 per 1 level(s)']);
  let n = 0;
  for (const sp of spells) {
    for (const e of sp.effects.filter((x) => x.type >= 0)) {
      const tpl = SPELL_MAKER_EFFECTS.find((x) => x.key === `${e.type},${e.subType & 0xff}`);
      if (!tpl) continue;
      const parts = effectWords(e).parts;
      const has = ['duration', 'chance', 'magnitude'].filter((c) => tpl[c]);
      assert.deepEqual(parts.map((p) => p.split(':')[0].toLowerCase()), has, `${sp.name} ${tpl.key}`);
      n++;
    }
  }
  assert.ok(n > 90, `the whole file was read (${n})`);
});
