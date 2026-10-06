// HUD-CLASS (AUDIT 2026-10-05, the audit of the field fixes - POISE-BOX was the owner's screenshot, "enemies seem to
// have this black transparent bar"): EVERY CLASS THE HUD WRITES IS ITS OWN. Every module under src/ui may lay a sheet
// in the one game document, and the windows' sheet (ui/enhancedStyle.js) names its components with bare words - .side
// (a column on --ink), .empty (a dashed box, 26px of padding, 16px under it). A HUD element wearing one of those words
// wears the component: the poise track's idle 'empty' stood a 54 px box under every foe's health (POISE-BOX), the
// status widget beside the diamond wore the --ink ground as a dark box behind its tiles ('side'), the empty spell
// socket and an empty gun battery took the 16px margin (the caption 16px taller; the battery's row 36 -> 52px) - all
// measured in Chromium, and gone with the words made the widgets' own (stat-<state>, qspell-empty, gun-empty).
// POISE-BOX's pin read one track's classes against source text; this one reads RULES and WRITES (test/sheetRules.mjs):
// every sheet the game injects, every class word the HUD's two modules write - a helper's at its callers, a word the
// data chooses at the producer that mints it - and holds that no rule from outside the HUD styles one of them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { uiSheetRules, rulesOf, compounds, collisions, classWrites, classWriters, mintedFor, HOLE } from './sheetRules.mjs';
import { chunkFrame } from '../src/ui/barLoss.js';
import { SHIP_CLASSES } from '../src/systems/naval/navalShips.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const HUD = ['src/ui/enhancedHud.js', 'src/ui/navalHud.js'];

// THE HOLES: a class word the HUD fills from data - the poise track's state was one ('empty'). Each bare one is named
// here with what its producer mints, read from that producer; a new one fails the pin until it is named (or wears a
// prefix of its own, as poise-<state> does).
const chunks = [...new Set([0, 1, 2, 3, 4, 5, 6, 7].map((n) => chunkFrame(n).cls))];
const factions = [...new Set(SHIP_CLASSES.map((c) => c.faction))];
const HOLES = {
  'src/ui/enhancedHud.js': {
    'statTile:t.kind': mintedFor('src/ui/hudStatus.js', 'kind'),   // a status tile's kind (hudStatus.js statusTiles)
    'dropChunk:cls': chunks,   // the bitten span's frame (barLoss.js chunkFrame)
  },
  'src/ui/navalHud.js': {
    'cardLoss:frame': chunks,
    'drawNavalHud:c': mintedFor('src/ui/navalHud.js', 'chips', { within: 'navalHudText' }),   // the plate's chips
    'drawNavalHud:t.card.faction': factions,   // her class's (navalShips.js SHIP_CLASSES; a raider is a pirate)
    'drawNavalTags:t.faction': factions,
    'drawNavalHud:t.card.stateKind': mintedFor('src/ui/navalHud.js', 'kind', { within: 'cardState' }),
    'drawNavalHud:c.kind': mintedFor('src/ui/navalHud.js', 'kind', { within: 'fightCard' }),
    'drawCrewLines:p.kind': ['shout', 'sing'],   // the write's own guard (pinned below)
  },
};

/** The words the HUD writes - its literal words and every hole's values - and the ones it alone writes. */
function hudWords() {
  const words = new Set();
  for (const f of HUD) {
    for (const w of classWrites(f).words.keys()) words.add(w);
    for (const vs of Object.values(HOLES[f])) for (const w of vs) words.add(w);
  }
  const elsewhere = new Set();
  for (const f of classWriters()) if (!HUD.includes(f)) for (const w of classWrites(f).words.keys()) elsewhere.add(w);
  return { words, own: new Set([...words].filter((w) => !elsewhere.has(w))) };
}

test('HUD-CLASS: the walker reads a sheet\'s rules and nothing else - an at-rule\'s nest, a hole glued into a compound or standing for rules or declarations, a selector built entire, a data URI\'s semicolon - and markup and code read as nothing; a rule styles the HUD from outside where every compound could stand on the HUD\'s own elements and none names a class the HUD alone writes (mutants: the field\'s words bare)', () => {
  const sheet = `/* a { b: c } in a comment */
${HOLE}
.a, .b > .c::before { color: red; }
#${HOLE}.on { display: flex; }
.d { ${HOLE} font-size: 13px; background: url("data:image/svg+xml;utf8,<svg/>"); }
@media (max-width: 640px) { .e .f:hover { display: none; } }
@keyframes k { from { opacity: 0; } to { opacity: 1; } }
${HOLE} { width: 0; }`;
  assert.deepEqual(rulesOf(sheet).map((r) => [r.sel, r.at]), [['.a, .b > .c::before', []], [`#${HOLE}.on`, []], ['.d', []], ['.e .f:hover', ['@media (max-width: 640px)']], [HOLE, []]]);
  assert.equal(rulesOf('if (b.empty) { return 1; }'), null, 'code is not a sheet');
  assert.equal(rulesOf('<div class="hud-stat side">x</div>'), null, 'nor is markup');
  assert.equal(rulesOf('const o = { side: 1 };'), null);
  assert.deepEqual(compounds('.shell:not(.wizard) > .side::before'), ['.shell', '.side']);
  const words = new Set(['side', 'empty', 'on', 'hud-stat']), own = new Set(['hud-stat']);
  const rule = (sel, at = []) => ({ where: 'x', sel, body: 'b: c;', at });
  const hit = (sel, at) => collisions([rule(sel, at)], words, own).length;
  assert.equal(hit('.side'), 1, 'a bare component');
  assert.equal(hit('.empty, .other'), 1, 'one selector of a list');
  assert.equal(hit('.side::before'), 1, 'its pseudo-element');
  assert.equal(hit('.side', ['@media (pointer: coarse)']), 1, 'under a media query');
  assert.equal(hit('body.touch .side'), 1, 'under a mode the page is in');
  assert.equal(hit('div > .on'), 1, 'under a bare tag, which a HUD element may be');
  assert.equal(hit('.on.side'), 1, 'a compound of the HUD\'s shared words alone');
  assert.equal(hit('.shell .side'), 0, 'under a window\'s element, never the HUD\'s');
  assert.equal(hit('#hud-layout-banner .on'), 0, 'under an id');
  assert.equal(hit('#x.on'), 0, 'an id\'s');
  assert.equal(hit('.side.wide'), 0, 'wanting a class the HUD never writes');
  assert.equal(hit('.hud-stat.side'), 0, 'the HUD\'s own rule');
  assert.equal(hit('.hud-stat .on'), 0, 'inside the HUD\'s own element, aimed at it');
});

test('HUD-CLASS: every sheet the game injects is read - the 65 a module exports, evaluated as the game lays them (a selector built from a list read as built), and the literals of the ones no module exports; none that looks like CSS goes unread, and none builds a selector no evaluated sheet carries (mutants: the layout editor\'s sheet unexported)', async () => {
  const { rules, unread, uncomputed, evaluated } = await uiSheetRules();
  assert.deepEqual(unread, [], 'a literal that looks like a sheet the walker could not read');
  assert.deepEqual(uncomputed, [], 'a sheet whose selectors are built where it is laid, and so never read');
  assert.ok(evaluated >= 65 && rules.length > 12000, `${evaluated} sheets, ${rules.length} rules`);
  const has = (where, sel) => rules.some((r) => r.where === where && r.sel === sel);
  assert.ok(has('src/ui/enhancedStyle.js ENHANCED_CSS', '.side') && has('src/ui/enhancedStyle.js ENHANCED_CSS', '.empty'), 'the windows\' bare components - what took the HUD\'s words');
  assert.ok(has('src/ui/enhancedStyle.js ENHANCED_CSS', '.hud-stat.stat-side') && has('src/ui/enhancedStyle.js ENHANCED_CSS', '.hud-qspell.qspell-empty'));
  assert.ok(has('src/ui/navalHud.js NAVAL_HUD_CSS', '.dfnaval-gun.gun-empty'));
  assert.ok(rules.some((r) => r.where === 'src/ui/hudLayout.js HUD_LAYOUT_CSS' && r.sel.split(',\n').includes('.qtrack[data-hm]')), 'the layout editor\'s rule, its selectors built from the pieces');
  assert.ok(rules.some((r) => r.where.startsWith('src/ui/plusPad.js:') && r.sel === `#${HOLE}.on`), 'a sheet no module exports, read from its literal (an id\'s rule)');
});

test('HUD-CLASS: every class the HUD writes is read - at its helpers\' callers, through a callback\'s host, a for-of\'s array - and every word the data chooses is named with what its producer mints: no bare hole unnamed, none named that is gone (mutants: the poise state bare again; the crew line\'s guard dropped)', () => {
  const ehud = classWrites('src/ui/enhancedHud.js'), naval = classWrites('src/ui/navalHud.js');
  for (const w of ['hud-stat', 'stat-side', 'stat-tight', 'stat-noroom', 'hud-qspell', 'qspell-empty', 'hud-qwear', 'hud-qstop', 'hud-qcell']) assert.ok(ehud.words.has(w), w);
  for (const w of ['side', 'tight', 'noroom', 'empty']) assert.equal(ehud.words.has(w), false, `the bare '${w}'`);
  for (const w of ['dfnaval-gun', 'gun-empty', 'port', 'starboard', 'dfnaval-say', 'mate', 'target', 'dfnaval-track', 'hull', 'sail']) assert.ok(naval.words.has(w), w);
  assert.equal(naval.words.has('empty'), false);
  assert.ok(ehud.holes.some((h) => h.key === 'drawEnhancedHud:p.state' && h.prefix === 'poise-' && !h.bare), 'the poise state wears its own prefix');
  for (const f of HUD) {
    const bare = classWrites(f).holes.filter((h) => h.bare).map((h) => h.key).sort();
    assert.deepEqual(bare, Object.keys(HOLES[f]).sort(), `${f}: the words its data chooses, each named with its producer`);
  }
  assert.deepEqual(HOLES['src/ui/enhancedHud.js']['statTile:t.kind'], ['buff', 'danger', 'debuff', 'more', 'set', 'warn']);
  assert.deepEqual(chunks, ['fa', 'fb']);
  assert.deepEqual(factions, ['pirate', 'merchant', 'navy']);
  assert.deepEqual(HOLES['src/ui/navalHud.js']['drawNavalHud:c'], ['brace', 'fire', 'mend', 'repair', 'wreck']);
  assert.deepEqual(HOLES['src/ui/navalHud.js']['drawNavalHud:t.card.stateKind'], ['board', 'friendly', 'hostile', 'sinking']);
  assert.deepEqual(HOLES['src/ui/navalHud.js']['drawNavalHud:c.kind'], ['board', 'sinking']);
  assert.match(rd('src/ui/navalHud.js'), /p\.kind === 'sing' \|\| p\.kind === 'shout' \? `dfnaval-say \$\{p\.kind\}` : 'dfnaval-say'/, 'the crew line\'s word is one of the two its guard lets through');
});

test('HUD-CLASS: NO RULE IN ANY SHEET STYLES A CLASS THE HUD WRITES FROM OUTSIDE THE HUD - and the law bites on the real sheets: given the field\'s bare words back, it finds the windows\' .side and .empty (mutants: the status widget\'s side, the socket\'s and the battery\'s empty bare again; a bare .on rule; a tile kind, a chunk frame, a chip, a card state and a faction minted as a component\'s word)', async () => {
  const { rules } = await uiSheetRules();
  const { words, own } = hudWords();
  assert.deepEqual(collisions(rules, words, own), [], 'a rule from outside the HUD styles a class the HUD writes');
  // the positive control: the words the field fixes took away
  const back = collisions(rules, new Set([...words, 'side', 'empty']), own);
  assert.ok(back.some((c) => c.startsWith('src/ui/enhancedStyle.js ENHANCED_CSS .side {')), back.join('\n'));
  assert.ok(back.some((c) => c.startsWith('src/ui/enhancedStyle.js ENHANCED_CSS .empty {')), back.join('\n'));
});
