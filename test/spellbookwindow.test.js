// U42: THE CLASSIC SPELLBOOK - the art window that retires U4's keyed
// overlay, the last text stand-in on the daily loop. These pins are
// DaggerfallSpellBookWindow.cs's own laws: the layout table, the row
// text with its live cost and its desaturation band, the selection
// and the two arrows, delete (with the curse-tag refusals and the
// close-on-either-answer quirk), swap with its force-one-row step,
// sort's two passes, rename's copy-on-write, the effect labels, the
// three icons, and the whole BUY mode - the offer's filter and sort,
// the x4 price with its Witches Festival halving, the trade ladder
// and what Yes actually spends.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SpellbookWindow, SPELLBOOK_RECTS, SPELLBOOK_LAYOUT, DESATURATION,
  VAMPIRE_SPELL_TAG, LYCANTHROPY_SPELL_TAG, CANNOT_DELETE_VAMP, CANNOT_DELETE_WERE,
  DELETE_SPELL_PROMPT, SORT_SPELLS_PROMPT, NO_SPELLBOOK_TEXT_ID,
  ENTER_SPELL_NAME, EFFECT_NOT_FOUND, SELECT_ICON_TIP,
  spellEffects, spellRowText, spellPointCost, _setSpellbookArtForTests,
} from '../src/ui/spellbookWindow.js';
import {
  SPELL_ICON_COUNT, SPELL_ICON_ROW_COUNT, TARGET_ICON_W, ELEMENT_ICON_W, ICON_H,
  spellIconRect, targetIconRect, elementIconRect, _setSpellIconsForTests,
} from '../src/ui/spellIcons.js';
import { HOLIDAYS, getHolidayId } from '../src/systems/holidays.js';
import { calculateTradePrice } from '../src/systems/shopStock.js';
import { SPELLBOOK_TEMPLATE_INDEX, MAX_SPELL_NAME } from '../src/systems/spellMaker.js';
import { LETTER_OF_CREDIT_TEMPLATE } from '../src/systems/inventory.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { cureOfferMessageOffset } from '../src/systems/guildServiceActions.js';
import { TARGET_DESCRIPTIONS, ELEMENT_DESCRIPTIONS } from '../src/ui/spellIcons.js';
import { audio } from '../src/systems/audio.js';
import { SOUND } from '../src/systems/soundClips.js';
import { FNT_ASCII_START } from '../src/formats/fntFile.js';

const PX = SPELLBOOK_LAYOUT.x, PY = SPELLBOOK_LAYOUT.y;

function recorder() {
  const quads = [];
  return {
    quads,
    uploadTexture: () => 'tex', releaseTexture: () => {},
    drawScreenQuad: (tex, rect, uv, color, opts) => quads.push({ tex, ...rect, uv, color, opts }),
  };
}
const font = (w = 4, h = 6) => ({ fnt: { fixedHeight: h, fixedWidth: w, glyphWidth: () => w } });
const canvas = { width: 320, height: 200 };   // scale 1, no letterbox

/** A glyph-recording font (the port's own drawSpy idiom): drawText
 *  asks glyphWidth for every drawn character, so the painted STRINGS
 *  come back through it. shadowText draws each label TWICE - the
 *  shadow pass and the colour pass - so a label appears twice in the
 *  tape; `drawn` is joined and searched, never counted. */
function spyFont() {
  const chars = [];
  return {
    chars,
    get drawn() { return chars.join(''); },
    fnt: {
      fixedHeight: 6, fixedWidth: 4,
      glyphWidth: (gi) => { chars.push(String.fromCharCode(gi + FNT_ASCII_START)); return 4; },
    },
  };
}

/** The UI-sound spy the port already uses (test/uisounds.test.js). */
function withSounds(fn) {
  const played = [];
  const orig = audio.playOneShot;
  audio.playOneShot = (i) => { played.push(i); return 0.1; };
  try { fn(played); } finally { audio.playOneShot = orig; }
}

const mountArt = () => {
  _setSpellbookArtForTests({ base: { tex: 'spbk00', w: 320, h: 200 }, buy: { tex: 'spbk01', w: 320, h: 200 } });
  _setSpellIconsForTests({
    icons: { tex: 'icon00', w: 320, h: 64 },
    mask: { tex: 'mask04', w: 40, h: 80 },
  });
};
const unmountArt = () => { _setSpellbookArtForTests(null); _setSpellIconsForTests(null); };

/** A classic record's shape, as formats/spellsStd reads it: three
 *  effect slots with type -1 for the empty ones. */
const effect = (type, subType) => ({ type, subType });
const EMPTY = effect(-1, -1);
const spell = (name, cost, over = {}) => ({
  name, cost, index: 1, icon: 3, element: 0, rangeType: 2,
  effects: [effect(4, 0), EMPTY, EMPTY], ...over,
});

/** The window over a book, with the deps a cast-mode host gives it. */
function book(...spells) {
  const entity = { name: 'Nyra Sunborn', magicka: 20, maxMagicka: 40, spells, items: [], stats: { personality: 50 } };
  const readied = [];
  const w = new SpellbookWindow({
    spells: () => entity.spells,
    entity,
    castCost: (sp) => sp.cost,
    onReady: (sp, opts) => readied.push([sp, opts]),
    rows: () => [],
  });
  return { entity, w, readied };
}

// ── the layout ────────────────────────────────────────────────────

test('U42 layout: the rects are DaggerfallSpellBookWindow.cs:39-54 verbatim', () => {
  assert.deepEqual(SPELLBOOK_RECTS.main, [0, 0, 259, 164]);
  assert.deepEqual(SPELLBOOK_RECTS.list, [5, 13, 110, 130]);
  assert.deepEqual(SPELLBOOK_RECTS.deleteOrBuy, [3, 152, 38, 9]);
  assert.deepEqual(SPELLBOOK_RECTS.up, [48, 152, 38, 9]);
  assert.deepEqual(SPELLBOOK_RECTS.sort, [90, 152, 38, 9]);
  assert.deepEqual(SPELLBOOK_RECTS.down, [132, 152, 38, 9]);
  assert.deepEqual(SPELLBOOK_RECTS.upArrow, [121, 11, 9, 16]);
  assert.deepEqual(SPELLBOOK_RECTS.downArrow, [121, 132, 9, 16]);
  assert.deepEqual(SPELLBOOK_RECTS.exit, [216, 149, 43, 15]);
  assert.deepEqual(SPELLBOOK_RECTS.scrollBar, [122, 28, 7, 103]);
  assert.deepEqual(SPELLBOOK_RECTS.spellIcon, [149.25, 14, 16, 16], 'the quarter pixel is DFU\'s own');
  assert.deepEqual(SPELLBOOK_RECTS.targetIcon, [182, 14, 25, 16], 'a 24-wide icon stretched one pixel');
  assert.deepEqual(SPELLBOOK_RECTS.elementIcon, [223, 14, 16, 16]);
  assert.deepEqual(SPELLBOOK_RECTS.effect, [[138, 40, 118, 28], [138, 78, 118, 28], [138, 116, 118, 28]]);
  assert.deepEqual(SPELLBOOK_LAYOUT.labels,
    { name: [123, 2], points: [214, 2], cost: [76, 154], gold: [116, 154] });
  // mainPanel is Center/Middle on the 320x200 native panel (:333-334)
  assert.equal(PX, 30.5, 'a 259-wide panel centres on a HALF pixel');
  assert.equal(PY, 18);
  assert.equal(SPELLBOOK_LAYOUT.rowsDisplayed, 16, 'spellsListBox.RowsDisplayed (:341)');
  assert.deepEqual(SPELLBOOK_LAYOUT.effectLabelRows, [5, 17], 'the two label rows inside a panel (:497-500)');
  assert.equal(SPELLBOOK_LAYOUT.effectLabelMaxChars, 24, 'TextLabel.MaxCharacters (:487)');
});

test('U42 strings: every one is DFU\'s own en text, character for character', () => {
  // U4 recorded that "the classic en string table is not in the source
  // snapshot" and U42 inherited the claim, writing its own prose. The
  // table IS in the snapshot - StreamingAssets/Text/Master
  // Localization CSV Files/Internal_Strings.csv - so these are pinned
  // as LITERALS rather than through the constants, which would let a
  // rewrite move both sides at once.
  assert.equal(CANNOT_DELETE_VAMP, 'Cannot delete special vampire spells.');      // :850
  assert.equal(CANNOT_DELETE_WERE, 'Cannot delete special lycanthropy spell.');   // :851
  assert.equal(DELETE_SPELL_PROMPT, 'Do you want to delete this spell?');         // :956
  assert.equal(SORT_SPELLS_PROMPT, 'Do you want to sort spells?');                // :957
  assert.equal(ENTER_SPELL_NAME, 'Enter spell name : ');   // :954 + the window's own " " (:934)
  assert.equal(EFFECT_NOT_FOUND, '<effect not found>');                           // :958
  assert.equal(SELECT_ICON_TIP, 'Select icon');                                   // :950
  // sentence case, and NO hyphen in the elements (:940-949)
  assert.deepEqual([...TARGET_DESCRIPTIONS],
    ['Caster only', 'By touch', 'Single target at range', 'Area around caster', 'Area at range']);
  assert.deepEqual([...ELEMENT_DESCRIPTIONS],
    ['Fire based', 'Cold based', 'Poison based', 'Shock based', 'Magic based']);
});

// ── the list ──────────────────────────────────────────────────────

test('U42 list: "{cost} - {name}", recomputed live, and the unaffordable rows desaturate', () => {
  // PopulateSpellsList (:254-281). The cost is recomputed on every
  // refresh because it rides the caster's skills, and a spell the
  // player cannot currently pay for lerps 75% toward grey.
  const { entity, w } = book(spell('Frostbite', 12), spell('Wildfire', 33));
  assert.deepEqual(w._rows.map((r) => r.text), ['12 - Frostbite', '33 - Wildfire']);
  assert.deepEqual(w._rows.map((r) => r.dim), [false, true], 'magicka 20 cannot pay 33');
  entity.magicka = 40;
  w.refreshSpellsList(true);
  assert.deepEqual(w._rows.map((r) => r.dim), [false, false], 'the band moves with the caster');
  assert.equal(spellRowText(spell('X', 0), 7), '7 - X');
  assert.equal(DESATURATION, 0.75);
});

test('U42 list: the lycanthropy spell reads 0 even though classic shows a cost', () => {
  // PopulateSpellsList (:262-265) - "Lycanthropy is a free spell".
  const { w } = book(spell('Wereform', 99, { tag: LYCANTHROPY_SPELL_TAG }));
  assert.equal(w._rows[0].text, '0 - Wereform');
  assert.equal(spellPointCost({ tag: LYCANTHROPY_SPELL_TAG, cost: 99 }, (sp) => sp.cost), 0);
  assert.equal(spellPointCost({ cost: 99 }, (sp) => sp.cost), 99, 'and no other spell is free');
});

test('U42 list: SetDefaults selects the first spell, or none at all', () => {
  const { w } = book(spell('A', 1), spell('B', 1));
  assert.equal(w.selectedIndex, 0);
  assert.equal(w.selected.name, 'A');
  const empty = book();
  assert.equal(empty.w.selectedIndex, -1, 'SelectNone on an empty book (:196-199)');
  assert.equal(empty.w.selected, null);
});

test('U42 list: the arrows clamp at both ends and scroll the window to follow', () => {
  const many = Array.from({ length: 20 }, (_, i) => spell(`S${i}`, 1));
  const { w } = book(...many);
  w.selectPrevious();
  assert.equal(w.selectedIndex, 0, 'up at the head is a no-op');
  for (let i = 0; i < 19; i++) w.selectNext();
  assert.equal(w.selectedIndex, 19);
  assert.equal(w.scrollIndex, 4, '20 rows, 16 displayed: the last row scrolls the list to 4');
  w.selectNext();
  assert.equal(w.selectedIndex, 19, 'down at the tail is a no-op');
  for (let i = 0; i < 19; i++) w.selectPrevious();
  assert.equal(w.selectedIndex, 0);
  assert.equal(w.scrollIndex, 0, 'and the window follows back up');
  // the wheel scrolls WITHOUT moving the selection, and clamps
  w.wheel(1);
  assert.equal(w.scrollIndex, 1);
  assert.equal(w.selectedIndex, 0);
  for (let i = 0; i < 20; i++) w.wheel(1);
  assert.equal(w.scrollIndex, 4, 'clamped at count - rowsDisplayed');
  for (let i = 0; i < 20; i++) w.wheel(-1);
  assert.equal(w.scrollIndex, 0);
});

test('U42 list: the scroll clause is INSIDE the movement guard, and nudges by ONE', () => {
  // ListBox.SelectPrevious (:709-724) / SelectNext (:726-741). Both
  // details are reachable only because the wheel moves scrollIndex
  // without moving the selection (SpellsListBox_OnMouseScroll,
  // :793-796), which is the state a guard-outside version corrupts.
  const many = Array.from({ length: 40 }, (_, i) => spell(`S${i}`, 1));
  const a = book(...many);
  a.w.wheel(1); a.w.wheel(1); a.w.wheel(1); a.w.wheel(1); a.w.wheel(1);
  assert.deepEqual([a.w.selectedIndex, a.w.scrollIndex], [0, 5], 'wheeled away from the selection');
  a.w.selectPrevious();
  assert.deepEqual([a.w.selectedIndex, a.w.scrollIndex], [0, 5],
    'Up at the HEAD moves nothing at all - the scroll clause is inside the guard');

  // The tail case needs the selection BELOW the visible band, or the
  // scroll clause has nothing to do either way: wheel back to the top
  // with the last row still selected, then press Down.
  const b = book(...many);
  b.w.selectedIndex = 39;
  b.w.scrollIndex = 0;
  b.w.selectNext();
  assert.deepEqual([b.w.selectedIndex, b.w.scrollIndex], [39, 0],
    'Down at the TAIL moves nothing either - not even the scroll');

  // ...and when it does move, it nudges by one rather than snapping
  const c = book(...many);
  c.w.selectedIndex = 25; c.w.scrollIndex = 0;
  c.w.selectNext();
  assert.deepEqual([c.w.selectedIndex, c.w.scrollIndex], [26, 1],
    'one row, not selectedIndex - rowsDisplayed + 1');
});

// ── delete ────────────────────────────────────────────────────────

test('U42 delete: the prompt arms, and EITHER answer closes the book', () => {
  // DeleteButton_OnMouseClick (:811-838) + DeleteSpellConfirm
  // (:840-852). The CloseWindow() sits OUTSIDE the Yes arm, so No
  // puts you back in the world too - kept, quirk and all.
  const a = book(spell('A', 5), spell('B', 5));
  a.w.deleteButton();
  assert.equal(a.w.top, 'delete');
  assert.deepEqual(a.w._boxRows(), [DELETE_SPELL_PROMPT]);
  assert.equal(a.entity.spells.length, 2, 'nothing deleted yet');
  a.w.confirmDelete(false);
  assert.equal(a.entity.spells.length, 2, 'No deletes nothing');
  assert.equal(a.w.done, true, '...and still closes the book (:851)');

  const b = book(spell('A', 5), spell('B', 5));
  b.w.deleteButton();
  b.w.confirmDelete(true);
  assert.deepEqual(b.entity.spells.map((s) => s.name), ['B'], 'Yes removes the SELECTED spell IN PLACE');
  assert.equal(b.w.done, true);

  const empty = book();
  empty.w.deleteButton();
  assert.equal(empty.w.top, null, 'SelectedIndex == -1 refuses to arm (:813-814)');
});

test('U42 delete: the two curse tags refuse BEFORE the prompt', () => {
  // :816-831 - "there's no way to get them back". A plain message,
  // no YesNo, nothing removed, and the book stays OPEN.
  const { entity, w } = book(
    spell('Bat Form', 5, { tag: VAMPIRE_SPELL_TAG }),
    spell('Howl', 5, { tag: LYCANTHROPY_SPELL_TAG }),
  );
  w.deleteButton();
  assert.equal(w.top, 'note');
  assert.deepEqual(w._boxRows(), [CANNOT_DELETE_VAMP]);
  assert.equal(w.done, false, 'a refusal is not a close');
  w.top = null;
  w.selectNext();
  w.deleteButton();
  assert.deepEqual(w._boxRows(), [CANNOT_DELETE_WERE]);
  assert.equal(entity.spells.length, 2);
});

// ── swap and sort ─────────────────────────────────────────────────

test('U42 swap: in place, bounds-guarded, cursor follows, and one more row is forced into view', () => {
  // SwapButton_OnMouseClick (:872-897).
  const { entity, w } = book(spell('A', 5), spell('B', 5), spell('C', 5));
  w.swap(-1);
  assert.deepEqual(entity.spells.map((s) => s.name), ['A', 'B', 'C'], 'up at the head is a no-op');
  w.swap(1);
  assert.deepEqual(entity.spells.map((s) => s.name), ['B', 'A', 'C']);
  assert.equal(w.selectedIndex, 1, 'the selection rides the moved spell (SelectNext)');
  w.swap(1); w.swap(1);
  assert.deepEqual(entity.spells.map((s) => s.name), ['B', 'C', 'A'], 'down at the tail is a no-op');
  assert.equal(w.selectedIndex, 2);
  w.swap(-1);
  assert.deepEqual(entity.spells.map((s) => s.name), ['B', 'A', 'C']);
  assert.equal(w.selectedIndex, 1);
});

test('U42 swap: the force-reveal step - the row after the selection is scrolled into view', () => {
  // ":882-884 // Force revealing one item ahead" - when the swap
  // lands the selection on the LAST visible row, the list scrolls
  // one further so the player can see where the spell is going.
  const many = Array.from({ length: 20 }, (_, i) => spell(`S${i}`, 1));
  const { w } = book(...many);
  for (let i = 0; i < 15; i++) w.selectNext();
  assert.deepEqual([w.selectedIndex, w.scrollIndex], [15, 0], 'row 15 is the last VISIBLE row');
  w.swap(1);
  assert.equal(w.selectedIndex, 16);
  assert.equal(w.scrollIndex, 2, 'selectNext scrolled to 1, then the force step made it 2');
  // ...and the same at the top edge, going up. The list has to be
  // long enough that scrollIndex 5 is not ALREADY the clamp, or the
  // force step has nothing to prove.
  const longer = book(...Array.from({ length: 40 }, (_, i) => spell(`L${i}`, 1)));
  longer.w.scrollIndex = 5; longer.w.selectedIndex = 6;
  longer.w.swap(-1);
  assert.equal(longer.w.selectedIndex, 5);
  assert.equal(longer.w.scrollIndex, 4, 'the selection landed ON scrollIndex, so it scrolled one more up');
});

test('U42 sort: alphabetical, then point cost only if the alpha pass changed nothing', () => {
  // SortSpellsConfirm_OnButtonClick (:907-925), SequenceEqual arm and
  // all - and the CloseWindow() outside the Yes arm again.
  const a = book(spell('Wildfire', 30), spell('Arc Bolt', 20), spell('Frost', 10));
  a.w.confirmSort(false);
  assert.deepEqual(a.entity.spells.map((s) => s.name), ['Wildfire', 'Arc Bolt', 'Frost'], 'No sorts nothing');
  assert.equal(a.w.done, true, 'and closes anyway');

  const b = book(spell('Wildfire', 30), spell('Arc Bolt', 20), spell('Frost', 10));
  b.w.confirmSort(true);
  assert.deepEqual(b.entity.spells.map((s) => s.name), ['Arc Bolt', 'Frost', 'Wildfire'], 'first pass: alpha');

  const c = book(spell('Arc Bolt', 20), spell('Frost', 10), spell('Wildfire', 30));
  c.w.confirmSort(true);
  assert.deepEqual(c.entity.spells.map((s) => s.name), ['Frost', 'Arc Bolt', 'Wildfire'],
    'already alphabetical: the SequenceEqual arm re-sorts by point cost');
});

test('U42: every mutation lands on the player\'s OWN array - the save envelope sees it', () => {
  // PlayerEntity.GetSpells() is the book itself and save.js:142 maps
  // that array in order. This pin fails if the window ever copies.
  const { entity, w } = book(spell('B', 5, { index: 7 }), spell('A', 5, { index: 9 }));
  const arr = entity.spells;
  w.confirmSort(true);
  assert.equal(entity.spells, arr, 'sort kept the array identity');
  assert.deepEqual(entity.spells.map((s) => s.index), [9, 7]);
  const d = book(spell('A', 5, { index: 1 }), spell('B', 5, { index: 2 }));
  const arr2 = d.entity.spells;
  d.w.swap(1);
  assert.equal(d.entity.spells, arr2);
  d.w.confirmDelete.call(Object.assign(d.w, { deleteSpellIndex: 0 }), true);
  assert.equal(d.entity.spells, arr2, 'and delete splices rather than replacing');
});

// ── rename ────────────────────────────────────────────────────────

test('U42 rename: a COPY takes the new name, marked custom so the save carries it', () => {
  // RenameSpellPromptHandler (:937-950). DFU's EffectBundleSettings
  // is a struct, so GetSpell/SetSpell is a copy-then-write; the
  // port's records are shared objects, so the copy is explicit. The
  // `custom` flag is what save.js:142 reads to store the whole
  // record instead of a bare SPELLS.STD index.
  const shared = spell('Fireball', 20, { index: 12 });
  const { entity, w } = book(shared);
  w.renameButton();
  assert.equal(w.top, 'rename');
  assert.equal(w.renameText, 'Fireball', 'the field opens holding the current name');
  w.renameText = 'Nyra\'s Kindling';
  w.confirmRename();
  assert.equal(entity.spells[0].name, 'Nyra\'s Kindling');
  assert.equal(entity.spells[0].custom, true, 'so the envelope stores the record, not the index');
  assert.equal(shared.name, 'Fireball', 'the SHARED SPELLS.STD record is untouched');
  assert.notEqual(entity.spells[0], shared);
  assert.equal(w._rows[0].text, '20 - Nyra\'s Kindling', 'and the list refreshed');
});

test('U42 rename: the renamed COPY survives the save envelope', () => {
  // The `custom` flag is not decoration - save.js:142 stores the whole
  // record for a custom spell and a bare SPELLS.STD index for every
  // other, so without it a reload would hand back the ORIGINAL name.
  // This drives the real envelope rather than asserting the flag.
  const { entity, w } = book(spell('Fireball', 20, { index: 12 }));
  w.renameButton();
  w.renameText = 'Probe Spell';
  w.confirmRename();
  const snap = snapshotPlayer(entity, {});
  assert.equal(typeof snap.spells[0], 'object', 'a custom record is stored WHOLE, not as an index');
  assert.equal(snap.spells[0].name, 'Probe Spell');
  const reloaded = { items: [] };
  // the SHARED map still holds the original, as a reload would
  restorePlayer(reloaded, snap, new Map([[12, spell('Fireball', 20, { index: 12 })]]));
  assert.equal(reloaded.spells[0].name, 'Probe Spell', 'and comes back renamed');
});

test('U42 rename: an EMPTY answer changes nothing, but spaces are a name (:943-944)', () => {
  // "Must not be blank" is string.IsNullOrEmpty on the RAW input, so
  // classic accepts a name of three spaces. Trimming would be the
  // port being quietly stricter than the game.
  const empty = book(spell('Fireball', 20));
  empty.w.renameButton();
  empty.w.renameText = '';
  empty.w.confirmRename();
  assert.equal(empty.entity.spells[0].name, 'Fireball');
  assert.equal(empty.w.top, null, 'the prompt still closes');
  const spaces = book(spell('Fireball', 20));
  spaces.w.renameButton();
  spaces.w.renameText = '   ';
  spaces.w.confirmRename();
  assert.equal(spaces.entity.spells[0].name, '   ', 'a name of spaces is legal in classic');
});

test('U42 rename: the field caps at TextBox.maxCharacters', () => {
  // TextBox.cs:26, :425 - 31, the same constant the spell maker's own
  // name box reads out of systems/spellMaker.js.
  const { w } = book(spell('Fireball', 20));
  w.renameButton();
  w.renameText = '';
  for (let i = 0; i < 50; i++) w.input('KeyA', { key: 'a' });
  assert.equal(w.renameText.length, MAX_SPELL_NAME, `capped at ${MAX_SPELL_NAME}`);
});

// ── the selection's panels ────────────────────────────────────────

test('U42 effects: the labels are the effect template\'s group and subgroup', () => {
  // SetEffectLabels (:620-645), including the not-found pair: the
  // first label says so and the SECOND carries the raw key.
  const { w } = book(spell('Mix', 10, {
    effects: [effect(4, 0), effect(99, 99), EMPTY],
  }));
  const [g0, s0] = w.effectLabels(0);
  assert.ok(g0.length, `slot 0 resolves a group (got ${JSON.stringify([g0, s0])})`);
  const [g1, s1] = w.effectLabels(1);
  assert.equal(g1, '<effect not found>', 'effectNotFoundError, verbatim');
  assert.equal(s1, '99,99', 'the raw key is the second row');
  // -1 and 255 are the SAME "no subtype": a SPELLS.STD record reads
  // the byte signed, the maker copies the catalog's 255, and the
  // effect table is keyed on 255. Both must resolve.
  // ...and the table the labels read is the BROKER's registry, not
  // the spell MAKER's offer list: MorphSelf (29,255) carries a classic
  // key with AllowedCraftingStations = None, so a spellbook holding
  // one printed "<effect not found>" while the maker's catalogue was
  // the only lookup.
  const morph = book(spell('Wereform', 10, { effects: [effect(29, 255), EMPTY, EMPTY] }));
  assert.deepEqual(morph.w.effectLabels(0), ['Morph Self', ''],
    'a registry-only effect is NAMED, not reported missing');
  const stock = book(spell('Free Action', 10, { effects: [effect(26, -1), EMPTY, EMPTY] }));
  const made = book(spell('Free Action', 10, { effects: [effect(26, 255), EMPTY, EMPTY] }));
  assert.deepEqual(stock.w.effectLabels(0), made.w.effectLabels(0));
  assert.notEqual(stock.w.effectLabels(0)[0], 'Effect not found',
    'a signed -1 subtype must not print as not-found');
  assert.deepEqual(w.effectLabels(2), ['', ''], 'an empty slot clears both labels');
  // spellEffects drops the type -1 sentinels the reader leaves behind
  assert.equal(spellEffects(w.selected).length, 2);
  assert.equal(spellEffects(null).length, 0);
});

test('U42 icons: the three sheets are cut by enum order, top-down', () => {
  // SpellIconCollection.cs :394-476. ICON00I0 is 20 icons per row and
  // each is atlas.width / 20 square; MASK04I0 stacks the five 24x16
  // TARGET icons down the left and the five 16x16 ELEMENT icons down
  // the right at x=24.
  mountArt();
  try {
    assert.deepEqual(spellIconRect(0), [0, 0, 16, 16]);
    assert.deepEqual(spellIconRect(19), [19 * 16, 0, 16, 16], 'the last icon of row 0');
    assert.deepEqual(spellIconRect(20), [0, 16, 16, 16], 'row 1 starts over at x=0');
    // GetSpellIcon (:151-157) answers NULL outside [0, Count) and the
    // panel shows its black background. The `% count` wrap is
    // SpellMakerWindow.SetIcon's law, applied at MINT time in
    // systems/spellMaker.js - not the collection's.
    assert.equal(spellIconRect(SPELL_ICON_COUNT), null, 'off the end is null, not a wrap');
    assert.equal(spellIconRect(-1), null, '...and so is below the start');
    assert.deepEqual(spellIconRect(SPELL_ICON_COUNT - 1), [8 * 16, 3 * 16, 16, 16], 'the last real icon');
    assert.equal(SPELL_ICON_ROW_COUNT, 20);
    assert.equal(SPELL_ICON_COUNT, 69);
    for (let i = 0; i < 5; i++) {
      assert.deepEqual(targetIconRect(i), [0, i * ICON_H, TARGET_ICON_W, ICON_H]);
      assert.deepEqual(elementIconRect(i), [TARGET_ICON_W, i * ICON_H, ELEMENT_ICON_W, ICON_H]);
    }
    assert.deepEqual(targetIconRect(99), targetIconRect(4), 'out of range clamps rather than reading off the sheet');
  } finally { unmountArt(); }
  // The icon size is DERIVED from the atlas width (:408-409), not
  // assumed - a wider replacement sheet cuts wider icons.
  _setSpellIconsForTests({ icons: { tex: 'big', w: 640, h: 128 }, mask: { tex: 'mask04', w: 40, h: 80 } });
  try {
    assert.deepEqual(spellIconRect(0), [0, 0, 32, 32], 'a 640-wide atlas is 32px icons');
    assert.deepEqual(spellIconRect(20), [0, 32, 32, 32]);
  } finally { unmountArt(); }
});

// ── the draw ──────────────────────────────────────────────────────

test('U42 draw: the panel, the rows, the three icons and the labels land on their rects', () => {
  mountArt();
  try {
    const { w } = book(spell('Frostbite', 12, { icon: 3, rangeType: 2, element: 1 }), spell('Wildfire', 33));
    const r = recorder();
    w.draw(r, canvas, font());
    const panel = r.quads.find((q) => q.tex === 'spbk00');
    assert.ok(panel, 'SPBK00I0 is the cast-mode background');
    assert.deepEqual([panel.x, panel.y, panel.w, panel.h], [PX, PY, 259, 164]);

    // the icons are cut out of the two sheets onto their own rects
    const icon = r.quads.find((q) => q.tex === 'icon00');
    assert.ok(icon, 'the spell icon is drawn');
    assert.deepEqual([icon.x, icon.y, icon.w, icon.h], [PX + 149.25, PY + 14, 16, 16]);
    assert.deepEqual([icon.uv.u0, icon.uv.v0], [3 * 16 / 320, 0], 'icon 3 is row 0, column 3');
    const mask = r.quads.filter((q) => q.tex === 'mask04');
    assert.equal(mask.length, 2, 'the target and element icons share MASK04I0');
    assert.deepEqual([mask[0].x, mask[0].y, mask[0].w, mask[0].h], [PX + 182, PY + 14, 25, 16]);
    assert.deepEqual([mask[1].x, mask[1].y, mask[1].w, mask[1].h], [PX + 223, PY + 14, 16, 16]);
    // ...over BLACK panels, so an unknown icon reads as a square
    const black = r.quads.filter((q) => q.tex === null && q.color && q.color[3] === 1
      && q.color[0] === 0 && q.color[1] === 0 && q.color[2] === 0);
    assert.equal(black.length, 3, 'SetupIcons paints all three BackgroundColor = Color.black (:429-455)');
  } finally { unmountArt(); }
});

test('U42 draw: the rows read "{cost} - {name}" and the SELECTED one is the dark red', () => {
  mountArt();
  try {
    const { w } = book(spell('Frostbite', 12), spell('Wildfire', 33));
    const f = spyFont();
    const r = recorder();
    w.draw(r, canvas, f);
    // drawText SKIPS the space glyph (code < FNT_ASCII_START, :80-87),
    // so the tape carries the printable characters only.
    const painted = f.drawn;
    assert.ok(painted.includes('12-Frostbite'), `the first row is painted (got ${painted.slice(0, 80)})`);
    assert.ok(painted.includes('33-Wildfire'));
    assert.ok(painted.includes('20/40'), 'and the spell-point label');
    // DecideTextColor gives the SELECTED row selectedShadowPosition =
    // Vector2.zero (ListBox.cs:369-376), so it draws FLAT while every
    // other row gets the shadow pass. shadowText measures once and
    // draws twice; a flat drawText walks the string once.
    const times = (needle) => painted.split(needle).length - 1;
    assert.equal(times('12-Frostbite'), 1, 'the selected row is drawn ONCE - no shadow pass');
    assert.equal(times('33-Wildfire'), 3, 'an unselected row measures once and draws twice');
  } finally { unmountArt(); }
});

test('U42 draw: the tooltip is drawn LAST, and an off-sheet icon draws NOTHING', () => {
  mountArt();
  try {
    const { w } = book(spell('Frostbite', 12, { icon: 3 }));
    // the tip, over everything else (DFU's final-component order)
    w.hover(PX + SPELLBOOK_RECTS.targetIcon[0] + 2, PY + SPELLBOOK_RECTS.targetIcon[1] + 2);
    w.tick(10);
    const f = spyFont();
    const r = recorder();
    w.draw(r, canvas, f);
    assert.ok(f.drawn.includes('Singletargetatrange'.slice(0, 6)), 'the tip text is painted');
    // an icon byte off the end of the sheet: GetSpellIcon answers null
    // and only the BLACK panel remains
    const bad = book(spell('Broken', 5, { icon: 200 }));
    const r2 = recorder();
    bad.w.draw(r2, canvas, font());
    assert.equal(r2.quads.some((q) => q.tex === 'icon00'), false, 'nothing is cut from the atlas');
    assert.ok(r2.quads.some((q) => q.tex === null && q.w === 16 && q.h === 16),
      'and the black panel is still there');
  } finally { unmountArt(); }
});

test('U42 draw: no art draws a plate rather than nothing (the U8 idiom)', () => {
  const { w } = book(spell('A', 1));
  const r = recorder();
  w.draw(r, canvas, font());
  const plate = r.quads.find((q) => q.tex === null && q.w === 259 && q.h === 164);
  assert.ok(plate, 'the window still has a body without SPBK00I0');
});

test('U42 sounds: OnPush/OnPop per mode, and the page turn plays ONCE', () => {
  // OnPush (:168-175) / OnPop (:178-183): the book opens and shuts
  // with a page turn, the shop with a button click. AddButton sets no
  // ClickSound (DaggerfallUI.cs:981-998) and editSpellBook plays in
  // the CONFIRM handlers only (:848, :921) - so arming a prompt is
  // silent and the arrow buttons, which DFU does sound (:801, :807),
  // are not.
  withSounds((played) => {
    const { w } = book(spell('A', 5), spell('B', 5));
    assert.deepEqual(played, [SOUND.OpenBook], 'the book opens with a page turn');
    played.length = 0;
    w.input('KeyL');
    assert.deepEqual(played, [], 'arming the delete prompt is SILENT');
    w.input('KeyY');
    assert.deepEqual(played, [SOUND.ButtonClick, SOUND.PageTurn, SOUND.PageTurn],
      'the box answers, the edit turns a page, and the close turns another');
  });
  withSounds((played) => {
    const { w } = book(spell('A', 5), spell('B', 5));
    played.length = 0;
    w.input('KeyS');
    assert.deepEqual(played, [], 'arming the sort prompt is SILENT too');
    played.length = 0;
    w.click(PX + SPELLBOOK_RECTS.sort[0] + 1, PY + SPELLBOOK_RECTS.sort[1] + 1);
    assert.deepEqual(played, [], '...and so is clicking the button');
  });
  withSounds((played) => {
    const { w } = book(spell('A', 5), spell('B', 5));
    played.length = 0;
    w.click(PX + SPELLBOOK_RECTS.downArrow[0] + 1, PY + SPELLBOOK_RECTS.downArrow[1] + 1);
    assert.deepEqual(played, [SOUND.PageTurn], 'the ARROW buttons really do sound (:801, :807)');
  });
  withSounds((played) => {
    shop([spell('Arc Bolt', 20)]);
    assert.deepEqual(played, [SOUND.ButtonClick], 'the shop opens with a click, not a page turn');
  });
});

// ── the seams ─────────────────────────────────────────────────────

test('U42 keys: L/U/S/D/B/E are DialogShortcuts\' own spellbook bindings', () => {
  // Text/DialogShortcuts.txt :99-105.
  const { entity, w } = book(spell('A', 5), spell('B', 5));
  w.input('KeyS');
  assert.equal(w.top, 'sort', 'S arms the sort prompt');
  w.input('KeyN');
  assert.equal(w.done, true);

  const b = book(spell('A', 5), spell('B', 5));
  b.w.input('KeyL');
  assert.equal(b.w.top, 'delete', 'L arms the delete prompt');
  b.w.input('KeyY');
  assert.deepEqual(b.entity.spells.map((s) => s.name), ['B']);

  const c = book(spell('A', 5), spell('B', 5));
  c.w.input('KeyD');
  assert.deepEqual(c.entity.spells.map((s) => s.name), ['B', 'A'], 'D swaps DOWN');
  c.w.input('KeyU');
  assert.deepEqual(c.entity.spells.map((s) => s.name), ['A', 'B'], 'U swaps UP');
  c.w.input('KeyE');
  assert.equal(c.w.done, true, 'E exits');
  assert.equal(entity.spells.length, 2);
});

test('U42 keys: Enter readies the selection and drops to the HUD; the free rider rides', () => {
  // SpellsListBox_OnUseSelectedItem (:770-784).
  const { w, readied } = book(spell('Frostbite', 12));
  w.input('Enter');
  assert.equal(readied.length, 1);
  assert.equal(readied[0][0].name, 'Frostbite');
  assert.equal(readied[0][1].noSpellPointCost, false);
  assert.equal(w.done, true, 'PopToHUD');

  const l = book(spell('Wereform', 0, { tag: LYCANTHROPY_SPELL_TAG }));
  l.w.input('Enter');
  assert.equal(l.readied[0][1].noSpellPointCost, true, 'lycanthropes cast for free (:776-777)');
});

test('U42 keys: a pushed box swallows everything except its own answers', () => {
  const { entity, w } = book(spell('A', 5), spell('B', 5));
  w.input('KeyL');
  w.input('ArrowDown');
  assert.equal(w.top, 'delete', 'arrows do not leak through the box');
  assert.equal(w.selectedIndex, 0);
  assert.equal(entity.spells.length, 2);
  w.input('KeyN');
  assert.equal(w.top, null);
});

test('U42 keys: a click-anywhere box closes on the next key, and does not close the book', () => {
  // DaggerfallMessageBox.ClickAnywhereToClose (:605-608) - the
  // curse refusals and the effect popups are dismissed by ANY input,
  // and dismissing one puts you back in the book, not the world.
  const { w } = book(spell('Bat Form', 5, { tag: VAMPIRE_SPELL_TAG }));
  w.deleteButton();
  assert.equal(w.top, 'note');
  w.input('ArrowDown');
  assert.equal(w.top, null, 'any key dismisses it');
  assert.equal(w.done, false, 'and the book is still open');
  assert.equal(w.selectedIndex, 0, 'the dismissing key did not also move the selection');
});

test('U42 keys: B is the BUY hotkey, and only in buy mode', () => {
  // DialogShortcuts.txt:104 - SpellbookBuy, B. The buy tests reach
  // buyButton through Enter and the button rect; this is the hotkey
  // itself, which nothing else exercised.
  const { w } = shop([spell('Arc Bolt', 20)]);
  w.input('KeyB');
  assert.equal(w.top, 'trade', 'B opens the trade box');
  // and in CAST mode there is no buy button at all (:390-417), so B
  // must not reach one
  const cast = book(spell('Arc Bolt', 20));
  cast.w.input('KeyB');
  assert.equal(cast.w.top, null, 'B does nothing in the player\'s own book');
  assert.equal(cast.w.done, false);
});

test('U42 effects: a long label is CLIPPED at MaxCharacters, not wrapped', () => {
  // TextLabel.MaxCharacters = 24 (:489). The constant is pinned in the
  // layout test; this drives the clip the draw actually performs.
  mountArt();
  try {
    const MAX = SPELLBOOK_LAYOUT.effectLabelMaxChars;
    const { w } = book(spell('Long', 5));
    // one panel only, so the tape is not three clipped labels running
    // together into a longer string than any of them
    w.effectLabels = (slot) => (slot === 0 ? ['A'.repeat(40), ''] : ['', '']);
    const f = spyFont();
    w.draw(recorder(), canvas, f);
    // shadowText measures once and draws twice, so a painted label
    // walks the tape three times
    const painted = (f.drawn.match(/A/g) ?? []).length;
    assert.equal(painted, MAX * 3, `24 characters painted three times, not 40 (got ${painted})`);
  } finally { unmountArt(); }
});

test('U42 tooltips: the three icon panels answer, exactly as SetupIcons wires them', () => {
  // SetupIcons points all three panels at the shared defaultToolTip
  // (:436, :448, :454): the spell icon's text is the STATIC selectIcon
  // - it names the picker the click opens - and the other two are
  // recomputed per selection by UpdateSelection (:571, :574).
  const { w } = book(spell('Frostbite', 12, { rangeType: 2, element: 1 }));
  const at = (rect) => {
    w.hover(PX + rect[0] + 2, PY + rect[1] + 2);
    w.tick(10);   // past the rest delay
    return w.tip.text;
  };
  assert.equal(at(SPELLBOOK_RECTS.targetIcon), TARGET_DESCRIPTIONS[2]);
  assert.equal(at(SPELLBOOK_RECTS.elementIcon), ELEMENT_DESCRIPTIONS[1]);
  assert.equal(at(SPELLBOOK_RECTS.spellIcon), 'Select icon', 'the icon panel names its PICKER');
  // ...and NOT in buy mode: the port gates the icon panel's picker to
  // cast mode (DFU wires it in both and then indexes the PLAYER's book
  // with the OFFER's index), so a tip naming an unreachable picker
  // would advertise the bug the port declines to port.
  const s = shop([spell('Arc Bolt', 20, { rangeType: 2, element: 1 })]);
  s.w.hover(PX + SPELLBOOK_RECTS.spellIcon[0] + 2, PY + SPELLBOOK_RECTS.spellIcon[1] + 2);
  s.w.tick(10);
  assert.equal(s.w.tip.text, null, 'no picker tip over the guild\'s offer');
  s.w.hover(PX + SPELLBOOK_RECTS.targetIcon[0] + 2, PY + SPELLBOOK_RECTS.targetIcon[1] + 2);
  s.w.tick(10);
  assert.equal(s.w.tip.text, TARGET_DESCRIPTIONS[2], 'but the other two still answer');
  // the description follows the SELECTION, it is not baked
  w.deps.spells().push(spell('Shock', 9, { rangeType: 4, element: 3 }));
  w.refreshSpellsList(true);
  w.selectNext();
  assert.equal(at(SPELLBOOK_RECTS.targetIcon), TARGET_DESCRIPTIONS[4]);
  assert.equal(at(SPELLBOOK_RECTS.elementIcon), ELEMENT_DESCRIPTIONS[3]);
  // off the panels, and behind a pushed box, there is nothing
  w.hover(PX + 60, PY + 60); w.tick(10);
  assert.equal(w.tip.text, null);
  w.deleteButton();
  assert.equal(at(SPELLBOOK_RECTS.targetIcon), null, 'a pushed box hides the tip');
});

test('U42 clicks: every button hits through the half-pixel panel offset', () => {
  const hit = (rect, dx = 1, dy = 1) => [PX + rect[0] + dx, PY + rect[1] + dy];
  const a = book(spell('A', 5), spell('B', 5));
  a.w.click(...hit(SPELLBOOK_RECTS.exit));
  assert.equal(a.w.done, true, 'EXIT closes');

  const b = book(spell('A', 5), spell('B', 5));
  b.w.click(...hit(SPELLBOOK_RECTS.down));
  assert.deepEqual(b.entity.spells.map((s) => s.name), ['B', 'A'], 'the DOWN button swaps');
  b.w.click(...hit(SPELLBOOK_RECTS.up));
  assert.deepEqual(b.entity.spells.map((s) => s.name), ['A', 'B'], 'and UP swaps back');
  b.w.click(...hit(SPELLBOOK_RECTS.sort));
  assert.equal(b.w.top, 'sort');
  b.w.top = null;
  b.w.click(...hit(SPELLBOOK_RECTS.deleteOrBuy));
  assert.equal(b.w.top, 'delete', 'the bottom-left button is DELETE in cast mode');
  b.w.top = null;

  const c = book(spell('A', 5), spell('B', 5));
  c.w.click(...hit(SPELLBOOK_RECTS.downArrow));
  assert.equal(c.w.selectedIndex, 1, 'the down ARROW selects, it does not swap');
  c.w.click(...hit(SPELLBOOK_RECTS.upArrow));
  assert.equal(c.w.selectedIndex, 0);
  assert.deepEqual(c.entity.spells.map((s) => s.name), ['A', 'B'], 'and nothing moved');
  // the name label opens the rename prompt (:925-935)
  c.w.click(PX + SPELLBOOK_LAYOUT.labels.name[0] + 2, PY + SPELLBOOK_LAYOUT.labels.name[1] + 2);
  assert.equal(c.w.top, 'rename');
});

test('U42 clicks: a list row selects, and the SELECTED row readies', () => {
  const { w, readied } = book(spell('A', 5), spell('B', 5), spell('C', 5));
  w._font = font();
  const [lx, ly] = SPELLBOOK_RECTS.list;
  const rowY = (i) => PY + ly + i * (6 + SPELLBOOK_LAYOUT.rowSpacing) + 1;
  w.click(PX + lx + 4, rowY(2));
  assert.equal(w.selectedIndex, 2, 'the third visible row');
  assert.equal(readied.length, 0, 'a first click only selects');
  w.click(PX + lx + 4, rowY(2));
  assert.equal(readied[0][0].name, 'C', 'clicking the SELECTED row uses it');
});

test('U42: the CAST binding toggles the book closed, as does Escape', () => {
  // Update (:205-214): the window closes on the SAME key that opened
  // it - InputManager.Actions.CastSpell.
  const a = book(spell('A', 5));
  a.w.input('Escape');
  assert.equal(a.w.done, true);
  const b = book(spell('A', 5));
  b.w.input('Backspace');   // the CastSpell default (InputManager.SetupDefaults)
  assert.equal(b.w.done, true, 'the toggle-closed binding is the cast key');
});

// ── BUY MODE ──────────────────────────────────────────────────────

/** A guild's spellbook: the shop side of the same window. */
function shop(offered, over = {}) {
  const entity = {
    name: 'Nyra Sunborn', magicka: 20, maxMagicka: 40, spells: [], stats: { personality: 50 },
    items: [{ group: 'MiscItems', templateIndex: SPELLBOOK_TEMPLATE_INDEX },
      { group: 'Currency', stackCount: 5000 }],
  };
  const w = new SpellbookWindow({
    spells: () => entity.spells,
    entity,
    castCost: (sp) => sp.cost,
    offered: () => offered,
    buildingQuality: () => 10,
    shopName: () => 'The Mages Guild',
    skills: () => ({ mercantile: 30, personality: 50 }),
    classicMinutes: () => 0,
    rows: (id) => [{ text: `[${id}] %a gold, %pct.`, center: true }],
    ...over,
  }, { buyMode: true });
  return { entity, w };
}

test('U42 buy: the offer drops the "!" internals and sorts by name', () => {
  // LoadSpellsForSale (:283-323).
  const { w } = shop([spell('Wildfire', 30), spell('!Debug Nuke', 1), spell('Arc Bolt', 20)]);
  assert.deepEqual(w._rows.map((r) => r.spell.name), ['Arc Bolt', 'Wildfire']);
  assert.deepEqual(w._rows.map((r) => r.dim), [false, false],
    'buy mode passes NULL available points, so nothing desaturates (:230-233)');
});

test('U42 buy: the price is the casting cost x4 through CalculateTradePrice', () => {
  // UpdateSelection's buy arm (:519-536) + GetTradePrice (:685-688).
  const { w } = shop([spell('Arc Bolt', 20)]);
  const price = w.tradePrice();
  assert.equal(w.presentedCost, 80, 'the casting cost x4');
  assert.equal(price, calculateTradePrice(80, 10, { mercantile: 30, personality: 50 }, false));
  assert.ok(price > 0);
});

test('U42 buy: Witches Festival halves the presented cost, with a floor of one', () => {
  // :525-532. The holiday is read with regionIndex 0, verbatim.
  let minutes = 0;
  const { w } = shop([spell('Arc Bolt', 20)], { classicMinutes: () => minutes });
  w._updatePresentedCost();
  const plain = w.presentedCost;
  assert.equal(plain, 80);
  // find the Witches Festival on the classic calendar
  let festival = null;
  for (let day = 0; day < 360 && festival === null; day++) {
    if (getHolidayId(day * 1440, 0) === HOLIDAYS.Witches_Festival) festival = day * 1440;
  }
  assert.notEqual(festival, null, 'the calendar has a Witches Festival');
  minutes = festival;
  w._updatePresentedCost();
  assert.equal(w.presentedCost, 40, 'halved by a SHIFT, not a divide');
  // the floor: a spell whose x4 cost is 1 still costs 1
  const cheap = shop([spell('Spark', 0)], { classicMinutes: () => festival });
  cheap.w.presentedCost = 1;
  cheap.w._updatePresentedCost();
  assert.equal(cheap.w.presentedCost, 1, '0 >> 1 is 0, which the floor lifts back to 1');
});

test('U42 buy: the ladder is spellbook, then gold, then the haggle line', () => {
  // BuyButton_OnMouseClick (:975-1013), in DFU's exact order.
  const noBook = shop([spell('Arc Bolt', 20)]);
  noBook.entity.items = [{ group: 'Currency', stackCount: 5000 }];
  noBook.w.buyButton();
  assert.equal(noBook.w.top, 'noSpellbook');
  assert.ok(noBook.w._boxRows()[0].text.startsWith(`[${NO_SPELLBOOK_TEXT_ID}]`), 'record 1703');

  const broke = shop([spell('Arc Bolt', 20)]);
  broke.entity.items = [{ group: 'MiscItems', templateIndex: SPELLBOOK_TEMPLATE_INDEX },
    { group: 'Currency', stackCount: 1 }];
  broke.w.buyButton();
  assert.equal(broke.w.top, 'notEnoughGold');
  assert.ok(broke.w._boxRows()[0].text.startsWith('[454]'), 'record 454');
  // ...and the gate is the TRADE price (:982), not the presented cost.
  // With a purse BETWEEN the two the shop still sells, because the
  // trade price is what it is actually asking.
  const between = shop([spell('Arc Bolt', 20)]);
  const price = between.w.tradePrice();
  assert.ok(price < between.w.presentedCost, 'quality 10 discounts the sticker');
  between.entity.items = [{ group: 'MiscItems', templateIndex: SPELLBOOK_TEMPLATE_INDEX },
    { group: 'Currency', stackCount: price }];
  between.w.buyButton();
  assert.equal(between.w.top, 'trade', 'exactly the asking price is enough');

  const ok = shop([spell('Arc Bolt', 20)]);
  ok.w.buyButton();
  assert.equal(ok.w.top, 'trade');
  const row = ok.w._boxRows()[0].text;
  assert.ok(/^\[26[012]\]/.test(row), `the haggle record is 260 + offset (got ${row})`);
  assert.ok(/\d+ gold/.test(row), '%a expanded to the price');
  assert.ok(row.includes('Nyra'), '%pct is the player\'s FIRST name here (:719-722)');
});

test('U42 buy: the haggle offset is DRIVEN by the price the shop asks', () => {
  // :984-990, through the window rather than re-implemented beside it:
  // the shop's QUALITY is what moves the trade price, so each quality
  // below drives buyButton() and reads the offset the window chose.
  // The bands themselves are cureOfferMessageOffset's ONE home
  // (guildServiceActions.js), which the temple and the trade window
  // already share - so this also pins that the window did not grow a
  // second copy of the comparison.
  const seen = new Map();
  for (const quality of [1, 5, 10, 15, 20]) {
    const { w } = shop([spell('Arc Bolt', 20)], { buildingQuality: () => quality });
    const price = w.tradePrice();
    w.buyButton();
    assert.equal(w.top, 'trade', `quality ${quality} reaches the trade box`);
    assert.equal(w._tradeOffset, cureOfferMessageOffset(w.presentedCost, price),
      `quality ${quality}: the offset is the shared band law`);
    assert.equal(w._boxRows()[0].text.startsWith(`[${260 + w._tradeOffset}]`), true,
      `quality ${quality}: the record is 260 + that offset`);
    seen.set(w._tradeOffset, (seen.get(w._tradeOffset) ?? 0) + 1);
  }
  assert.ok(seen.size >= 2, `the quality range spans more than one band (saw ${[...seen.keys()].join(',')})`);
  // and the boundaries themselves, at the one home
  assert.equal(cureOfferMessageOffset(80, 10), 0, 'a bargain gets the surly record');
  assert.equal(cureOfferMessageOffset(80, 40), 1, '80 >> 1 = 40, so 40 is the middle band');
  assert.equal(cureOfferMessageOffset(80, 39), 0, '...and 39 is not');
  assert.equal(cureOfferMessageOffset(80, 60), 2, '80 - (80 >> 2) = 60 is the friendliest');
  assert.equal(cureOfferMessageOffset(80, 59), 1, '...and 59 is not');
  const src = readFileSync(new URL('../src/ui/spellbookWindow.js', import.meta.url), 'utf8');
  assert.equal(/presentedCost >> 1 <=/.test(src), false, 'the window does not re-implement the bands');
});

test('U42 buy: Yes deducts through DeductGoldAmount, adds the spell, and closes', () => {
  // ConfirmTrade_OnButtonClick (:1015-1029) - the close is outside
  // the Yes arm here as well.
  const { entity, w } = shop([spell('Arc Bolt', 20)]);
  const price = w.tradePrice();
  w.buyButton();
  w.confirmTrade(true);
  assert.equal(entity.spells.length, 1);
  assert.equal(entity.spells[0].name, 'Arc Bolt');
  assert.notEqual(entity.spells[0], w._rows[0].spell, 'the book gets a COPY, not the shelf record');
  assert.equal(entity.items.find((i) => i.group === 'Currency').stackCount, 5000 - price);
  assert.equal(w.done, true);

  const no = shop([spell('Arc Bolt', 20)]);
  no.w.buyButton();
  no.w.confirmTrade(false);
  assert.equal(no.entity.spells.length, 0, 'No buys nothing');
  assert.equal(no.entity.items.find((i) => i.group === 'Currency').stackCount, 5000);
  assert.equal(no.w.done, true, '...and closes anyway');
});

test('U42 buy: a letter of credit is legal tender at the counter', () => {
  // GetGoldAmount (:1313-1316) is coins PLUS paper, which is what
  // the gate reads (:982) - so a character with one coin and a fat
  // letter can buy a spell.
  const { entity, w } = shop([spell('Arc Bolt', 20)]);
  entity.items = [{ group: 'MiscItems', templateIndex: SPELLBOOK_TEMPLATE_INDEX },
    { group: 'Currency', stackCount: 1 },
    { group: 'UselessItems2', templateIndex: LETTER_OF_CREDIT_TEMPLATE, value: 5000 }];
  const price = w.tradePrice();
  w.buyButton();
  assert.equal(w.top, 'trade', 'the letter covers the price');
  // ...and it is really SPENT - DeductGoldAmount takes the purse
  // first, then writes the remainder back onto the letter.
  // ...and it is really SPENT. DeductGoldAmount's order is DFU's: a
  // purse that cannot cover the payment is left alone and the LETTERS
  // are spent first, whole ones then part of the last, with the
  // remainder written back onto it (PlayerEntity.cs:1331-1341).
  w.confirmTrade(true);
  assert.equal(entity.items.find((i) => i.templateIndex === LETTER_OF_CREDIT_TEMPLATE).value, 5000 - price,
    'the letter carries the whole price');
  assert.equal(entity.items.find((i) => i.group === 'Currency').stackCount, 1, 'and the coin is untouched');
  assert.equal(entity.spells.length, 1, 'the spell is bought');
});

test('U42 buy: the bottom-left button is BUY, and the swap/sort/rename arms are gone', () => {
  const { entity, w } = shop([spell('Arc Bolt', 20), spell('Wildfire', 30)]);
  const hit = (rect) => [PX + rect[0] + 1, PY + rect[1] + 1];
  w.click(...hit(SPELLBOOK_RECTS.up));
  w.click(...hit(SPELLBOOK_RECTS.sort));
  w.click(...hit(SPELLBOOK_RECTS.down));
  assert.equal(w.top, null, 'none of the cast-mode buttons exist in buy mode (:390-417)');
  assert.equal(entity.spells.length, 0);
  w.click(...hit(SPELLBOOK_RECTS.deleteOrBuy));
  assert.equal(w.top, 'trade', 'the bottom-left button is BUY here');
  w.top = null;
  // Enter is a NO-OP in buy mode: OnUseSelectedItem is subscribed
  // only outside it (:357-360), where the shop wires
  // OnMouseDoubleClick instead. B and the BUY button are the paths.
  w.input('Enter');
  assert.equal(w.top, null, 'Enter neither buys nor readies in the shop');
  assert.equal(w.done, false, 'and certainly does not close the window');
});

test('U42 buy: SPBK01I0 is the background, and the cost/gold labels replace the points', () => {
  mountArt();
  try {
    const { w } = shop([spell('Arc Bolt', 20)]);
    const f = spyFont();
    const r = recorder();
    w.draw(r, canvas, f);
    assert.ok(r.quads.some((q) => q.tex === 'spbk01'), 'the buy-mode art');
    assert.equal(r.quads.some((q) => q.tex === 'spbk00'), false, 'and not the cast one');
    const painted = f.drawn;
    // spellCostLabel is the PRESENTED cost (:534) - casting cost x4 -
    // NOT GetTradePrice. The two are deliberately different: the
    // 260/261/262 ladder exists to compare one against the other.
    w.tradePrice();
    assert.notEqual(w.presentedCost, w.tradePrice(), 'the two numbers really do differ here');
    assert.ok(painted.includes(String(w.presentedCost)), 'the label is the presented cost');
    assert.equal(painted.includes(String(w.tradePrice())), false, 'and not the trade price');
    assert.ok(painted.includes('5000'), 'the gold label');
    assert.equal(painted.includes('20/40'), false, 'no spell-point label in buy mode (:477-482)');
  } finally { unmountArt(); }
});

// ── the hosts ─────────────────────────────────────────────────────

test('U42 / THE FOUR HOSTS: every host opens the book from ONE construction - the DOOR since PX23', () => {
  // U42's law is unchanged: four hosts, one construction each, the
  // player's OWN array by reference, the art warmed. What moved is
  // WHERE the construction lives. PX23 collapsed the four identical
  // builds into `ui/spellbookDoor.js` - the U52/U53 seam a fifth time -
  // so the host's one construction is now a call to the door, and the
  // laws the pin was guarding moved WITH it rather than being dropped.
  const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
  for (const host of ['scenes/world.js', 'scenes/exterior.js', 'scenes/dungeonContext.js', 'scenes/worldModes.js']) {
    const s = src(host);
    assert.ok(s.includes("from '../ui/spellbookDoor.js'"), `${host} takes the door`);
    assert.equal(s.includes('knownSpells'), false, `${host}: the interim known-list helper is gone`);
    assert.ok(s.includes('const makeSpellbookWindow = () =>'), `${host}: ONE construction`);
    assert.ok(/createSpellbookWindow\(\{/.test(s), `${host}: and it is the door's`);
    assert.ok(/preloadSpellbookArt\(/.test(s), `${host} warms SPBK00I0/01I0`);
  }
  // THE LAWS DID NOT VANISH, they moved one file: the door latches the
  // player's own array by reference, exactly as each host used to.
  const door = src('ui/spellbookDoor.js');
  assert.ok(/spells: \(\) => \(entity\.spells \?\?= \[\]\)/.test(door),
    "the door holds the player's OWN array, by reference");
  assert.ok(door.includes("from './spellbookWindow.js'"), 'and it is the classic window it builds on the classic skin');
  // and the keyed window is DELETED, not merely unimported
  assert.equal(src('ui/deathScreen.js').includes('SpellbookWindow'), false);
});

test('U42: BuySpells and BuySpellsMages are no longer FLAGGED nulls', () => {
  // DaggerfallGuildServicePopupWindow.cs:383-387 - one case falls into
  // the other and BOTH push the spellbook with buyMode true, which is
  // why they share a destination.
  const flow = readFileSync(new URL('../src/systems/guildServiceFlow.js', import.meta.url), 'utf8');
  assert.match(flow, /BuySpells: 'guildServiceSpellbook'/);
  assert.match(flow, /BuySpellsMages: 'guildServiceSpellbook'/);
  const modes = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
  assert.ok(modes.includes("destination === 'guildServiceSpellbook'"), 'the interior host runs the arm');
  assert.ok(/\{ buyMode: true \}/.test(modes), '...in BUY mode');
  assert.ok(/offered: \(\) => \[\.\.\.sbi\.values\(\)\]/.test(modes), 'over the whole of SPELLS.STD');
  // The popup's onService reads what openServiceFlow RETURNS and
  // answers "not available yet" on a null, so this arm hands the
  // window back as the repair arm does rather than mounting silently.
  assert.ok(/interiorOverlay = bookWin;\n      return bookWin;/.test(modes),
    'the arm mounts AND returns the window');
});

test('U42: the live probe surface exists on both exterior hosts, and castProbe reopens', () => {
  // The window's buttons are hit rects painted into SPBK00I0 and
  // selection is a colour swap, so nothing about it can be seen from
  // outside - tools/spellbookProbe.mjs reads its state back through
  // `__spellbook` instead of sleeping and hoping.
  for (const host of ['scenes/world.js', 'scenes/exterior.js']) {
    const s = readFileSync(new URL(`../src/${host}`, import.meta.url), 'utf8');
    assert.ok(s.includes('window.__spellbook = () =>'), `${host} carries the probe surface`);
    // PX23: the factory still HOLDS the live window; it just asks the
    // door for it. The probe reads the CLASSIC window's own fields
    // (buyMode, selectedIndex) and runs on the classic skin, where the
    // door hands back exactly that window.
    assert.ok(/_spellbook = createSpellbookWindow\(/.test(s), `${host}'s factory holds the live window`);
  }
  const probe = readFileSync(new URL('../tools/spellbookProbe.mjs', import.meta.url), 'utf8');
  assert.ok(probe.includes('__spellbook'), 'the probe reads that surface');
  assert.ok(probe.includes('30.5'), 'and clicks through the panel\'s half-pixel offset');
  // castProbe sorted the book then pressed Enter, which only worked
  // while the KEYED window stayed open through its confirmation.
  const cast = readFileSync(new URL('../tools/castProbe.mjs', import.meta.url), 'utf8');
  const sortLeg = cast.slice(cast.indexOf("await page.keyboard.press('s');"));
  const reopen = sortLeg.indexOf("await page.keyboard.press('Backspace');");
  const ready = sortLeg.indexOf("await page.keyboard.press('Enter');");
  assert.ok(reopen > 0 && reopen < ready, 'castProbe reopens the book before readying');
});
