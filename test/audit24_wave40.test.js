// AUDIT 24, wave 40: the second live crash out of the deployed build -
//     TypeError: can't access property "glyphWidth", s is undefined
// Open the character sheet, press LOGBOOK, and the scene died. Every
// time, on every host that has quests.
//
// CharSheet.draw forwards its own four arguments straight through to a
// pushed child (charsheet.js:240), and townTalk hands it
// `(renderer, canvas, font, hudScale)`. Every window in src/ui takes
// that shape - except QuestJournalWindow, whose fourth parameter was
// `largeFont = null`. A number is not nullish, so `largeFont ?? font`
// picked the SCALE, and measureText was handed `3 .fnt` - undefined.
//
// Nothing in the tree had ever passed a real font there. The parameter
// existed only to be filled by mistake.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { QuestJournalWindow, preloadQuestJournalArt, questJournalLargeFont } from '../src/ui/questJournal.js';
import { PlayerHistoryWindow } from '../src/ui/playerHistory.js';
import { CharSheet, NAV_BUTTONS } from '../src/ui/charsheet.js';
import { measureText } from '../src/ui/text.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

// Mutation campaign: 13 reintroductions, 13 killed. The `largeFont`
// parameter coming back (the shipped bug); the title reading a fourth
// argument instead of the warm; the wrong font file FETCHED; the warm
// never running, never stored, or rethrowing on a missing file; the
// sheet's forward dropping its fourth argument; the history window
// growing a font parameter of its own; the journal growing a FIFTH
// parameter; charSheetNav dropping the preload; and the logbook
// falling out of NAV_BUTTONS.
// Two of those thirteen only became kills after the pins were rebuilt,
// and both failures were the same mistake in different clothes:
//   - `assert.match(src, /FONT0000\.FNT/)` was satisfied by the WARNING
//     STRING, so swapping the fetch to FONT0003 left it green. The pin
//     drives the preload and reads what it asked for now.
//   - the fallback pin ran after a successful warm, so `if (!_largeFont)`
//     skipped the fetch and the throwing path was never reached. It
//     imports a FRESH module instance now. A FIXTURE THAT CANNOT REACH
//     THE STATE A LINE GUARDS IS NOT A TEST OF THAT LINE.
// One EQUIVALENT mutant, recorded rather than dressed up: `!_largeFont`
// spelled `_largeFont == null` survives, and should.
const UI_DIR = new URL('../src/ui/', import.meta.url);

/** A font wrapper of the shape townTalk builds and hands down. */
const FONT = { fnt: { fixedWidth: 6, fixedHeight: 7, glyphWidth: () => 5 }, tex: 'atlas' };
const RENDERER = { drawScreenQuad() {}, uploadTexture() { return 'atlas'; }, textures: new Map() };
const CANVAS = { width: 1280, height: 800 };
/** hudScale's real output at 1280x800 - the value that got through. */
const HUD_SCALE = 3;

test('audit24 wave40: the crashing call really does crash, and the shipped one does not', () => {
  // The bug reintroduced with the one edit that caused it: a fourth
  // parameter that shadows the font.
  const crashing = {
    draw(renderer, canvas, font, largeFont = null) {
      const tf = largeFont ?? font;
      return measureText(tf.fnt, 'ACTIVE QUESTS');
    },
  };
  assert.throws(() => crashing.draw(RENDERER, CANVAS, FONT, HUD_SCALE), (err) => {
    assert.ok(err instanceof TypeError);
    assert.match(err.message, /glyphWidth/, 'the property the deployed build named');
    return true;
  }, 'a number is not nullish, so ?? keeps it');
  // and it is fine when the fourth argument is absent, which is why it
  // survived every test that called it directly
  assert.doesNotThrow(() => crashing.draw(RENDERER, CANVAS, FONT));

  // The shipped window takes the same call and lives.
  const w = new QuestJournalWindow({ questMessages: () => [], notebook: () => null });
  assert.doesNotThrow(() => w.draw(RENDERER, CANVAS, FONT, HUD_SCALE));
  assert.doesNotThrow(() => w.draw(RENDERER, CANVAS, FONT), 'and with three, as its siblings are called');
});

test('audit24 wave40: EVERY window a character sheet can push survives the forward', () => {
  // The real gate. CharSheet.draw hands the child whatever townTalk
  // handed the sheet, so any window reachable through the four
  // navigation buttons must take (renderer, canvas, font, scale).
  assert.deepEqual([...NAV_BUTTONS], ['inventory', 'spellbook', 'logbook', 'history']);

  const entity = {
    name: 'Test', level: 3, gold: 100, health: 40, maxHealth: 50,
    stats: {}, skills: new Array(35).fill(20), skillUses: new Array(35).fill(0),
    items: [], spells: [], factionRep: null, biography: {},
  };
  const children = {
    logbook: () => new QuestJournalWindow({ questMessages: () => [], notebook: () => null }),
    history: () => new PlayerHistoryWindow(entity),
  };
  for (const [name, make] of Object.entries(children)) {
    const sheet = new CharSheet(entity, children);
    assert.equal(sheet._open(name), true, `${name} opens`);
    assert.ok(sheet.child, `${name} became the child`);
    // exactly the call townTalk.frame makes on the overlay, forwarded
    assert.doesNotThrow(() => sheet.draw(RENDERER, CANVAS, FONT, HUD_SCALE),
      `${name}: the pushed window crashed on the sheet's forward`);
  }

  // and the forward itself is still a straight pass-through - if it
  // ever stops being one, this gate stops meaning anything
  assert.match(rd('src/ui/charsheet.js'),
    /if \(this\.child\) return this\.child\.draw\(renderer, canvas, font, s\);/);
});

test('audit24 wave40: no window declares a fourth parameter that is not the scale', () => {
  // The rule that makes the collision impossible rather than merely
  // absent. A window may take three arguments and ignore the rest, or
  // four where the fourth is the scale. Anything else is a slot the
  // sheet's forward will fill with a number.
  const offenders = [];
  let seen = 0;
  for (const file of readdirSync(UI_DIR).filter((f) => f.endsWith('.js'))) {
    const src = readFileSync(new URL(file, UI_DIR), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    for (const m of src.matchAll(/^ {2}draw\(([^)]*)\)/gm)) {
      seen++;
      const params = m[1].split(',').map((p) => p.trim().split('=')[0].trim()).filter(Boolean);
      if (params.length < 4) continue;
      if (params.length > 4) { offenders.push(`${file}: draw takes ${params.length}`); continue; }
      if (!['s', 'scale'].includes(params[3])) offenders.push(`${file}: 4th param is \`${params[3]}\``);
    }
  }
  assert.ok(seen >= 20, `the sweep found ${seen} draw methods, so it is looking at the right files`);
  assert.deepEqual(offenders, [], 'a fourth parameter that is not the scale');
});

test('audit24 wave40: the large font is a module warm, and it is the one DFU names', () => {
  // DaggerfallQuestJournalWindow.cs:161-163 builds the title label with
  // `Font = DaggerfallUI.LargeFont`, and DaggerfallUI.cs:153 is
  // `LargeFont => GetFont(FontName.FONT0000)`. The port had that law
  // written as a draw parameter no caller ever passed, so the title has
  // always drawn in the host font. It loads beside the art now.
  const src = rd('src/ui/questJournal.js');
  assert.match(src, /const tf = _largeFont \?\? font;/);
  assert.doesNotMatch(src, /draw\([^)]*largeFont/, 'and not as a draw parameter any more');
  assert.doesNotMatch(src, /draw\(renderer, canvas, font, /, 'the signature is three, like its native-panel siblings');
  assert.match(rd('src/ui/charSheetNav.js'), /preloadQuestJournalArt\(artDeps\)/);
});

test('audit24 wave40: the warm is DRIVEN, not merely written down', async () => {
  // Asserting the string 'FONT0000.FNT' appears in the file is worth
  // nothing: the warning message contains it too, so swapping the
  // FETCH to another font left the pin green. Run the preload and see
  // what it actually asks for.
  const asked = [];
  const deps = {
    renderer: RENDERER,
    fetchBytes: async (name) => { asked.push(name); return new Uint8Array(4 + 240 * 4); },
  };
  await preloadQuestJournalArt(deps);
  assert.ok(asked.includes('FONT0000.FNT'),
    `the preload fetched ${JSON.stringify(asked)} - DaggerfallUI.cs:153 says LargeFont is FONT0000`);
  assert.ok(questJournalLargeFont(), 'and kept it');

  // A missing font must fall back, never throw - the sheet has to open
  // on a host whose ARENA2 is short a file. This needs a FRESH module:
  // the warm above already filled `_largeFont`, and the guard would
  // skip the fetch entirely, so the throwing path would never be
  // reached and the pin would pass on a mutant that rethrows.
  const fresh = await import(`../src/ui/questJournal.js?fallback=${Date.now()}`);
  const boom = { renderer: RENDERER, fetchBytes: async () => { throw new Error('no such file'); } };
  await assert.doesNotReject(() => fresh.preloadQuestJournalArt(boom));
  assert.equal(fresh.questJournalLargeFont(), null, 'and it really did fail to load');
  // the window still draws, in the host font
  const w = new fresh.QuestJournalWindow({ questMessages: () => [], notebook: () => null });
  assert.doesNotThrow(() => w.draw(RENDERER, CANVAS, FONT, HUD_SCALE));
});
