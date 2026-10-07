// PROFILE-MENU, PLUS-MENU, PLUS-SITE (2026-10-07, Mac: "I want to organize and detail the player profile (the top right
// icon section), give the main menu the enhanced plus UI treatment and do the same thing for our website. A proper
// detailed overhaul").
//
//   - PROFILE-MENU: the account card the corner portrait opens is a PROFILE signed in - a plate (the portrait, the name
//     with its Renown, the title and glyphs worn, the character), then the Record (a tile a deed, the duels' share won
//     drawn), the Characters (each Renown with the way to its next level drawn), the Wardrobe and the Account - each a
//     section under its own head, none drawn empty, none saying a fact twice (ui/enhancedAccount.js).
//   - PLUS-MENU: the front door's doors and the System tab's list play the kit's BUTTON role - stone slabs, brass under
//     the pointer, every Plus colour's ground - at the box they were (ui/enhancedPlusStyle.js MENU_CSS).
//   - PLUS-SITE: the website wears the kit's roles in the kit's tones, cut without a picture and injected at serve and
//     build (ui/enhancedFrame.js siteKitCss, scripts/landingHtml.mjs).
//
// The record: bible/10-UI/UI-Arc.md PROFILE-MENU / PLUS-MENU / PLUS-SITE. Mutants: tools/mutants/plus_menu_site.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { accountCard } from '../src/ui/enhancedAccount.js';
import { AccountFlow } from '../src/ui/accountFlow.js';
import { renownXpFor } from '../src/net/renown.js';
import { FRAME_ROLES, FRAME_TONES, SITE_ROLES, SITE_KIT_CSS, SITE_FITTING } from '../src/ui/enhancedFrame.js';
import { PLUS_CSS, MENU_CSS } from '../src/ui/enhancedPlusStyle.js';
import { ENHANCED_CSS } from '../src/ui/enhancedStyle.js';
import { transformLanding } from '../scripts/landingHtml.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** The card's document: nodes with a class, children, attributes and a title - and an SVG door, so a glyph draws. */
function fakeDoc() {
  const mk = (tag) => {
    const n = {
      tag, className: '', title: '', type: null, value: 0, max: 0, disabled: false, children: [], attrs: {},
      append: (...k) => n.children.push(...k.filter(Boolean)),
      setAttribute(k, v) { n.attrs[k] = String(v); },
      get all() { return [n, ...n.children.flatMap((c) => c.all ?? [c])]; },
    };
    Object.defineProperty(n, 'textContent', { get() { return n._txt ?? null; }, set(v) { n._txt = v; if (v === '') n.children.length = 0; } });
    return n;
  };
  return { createElement: mk, createElementNS: (_ns, tag) => mk(tag) };
}
const storage = { getItem: () => null, setItem() {}, removeItem() {} };
const ACCOUNT = {
  id: 'p1', name: 'Nystul', handle: 'Nystul', kind: 'linked', registeredAt: 1758400000, playedS: 47 * 3600 + 1500,
  duels: { wins: 14, losses: 6 }, gates: { closed: 3 }, raids: { defended: 7 }, serpents: { slain: 1 }, marks: 1240,
  renown: [{ character: 'c1', name: 'Mara Venn', level: 10, xp: renownXpFor(10) + 490 }, { character: 'c2', name: 'Old Hand', level: 50, xp: renownXpFor(50) }],
};
function draw({ account = ACCOUNT, wardrobe = null, face = null, character = null, stage = 'in' } = {}) {
  const flow = AccountFlow({ io: { fetch: async () => { throw new Error('no network'); } }, storage });
  flow.stage = stage;
  flow.account = account;
  flow.wardrobe = wardrobe;
  const card = accountCard(fakeDoc(), flow, { face, character });
  card.paint();
  return { flow, card, all: () => card.root.all };
}
const cls = (n) => String(n.className ?? '').split(/\s+/);
const has = (n, c) => cls(n).includes(c);
const heads = (all) => all.filter((n) => has(n, 'acctsechead')).map((n) => n.textContent);

// ── PROFILE-MENU ────────────────────────────────────────────────────

test('PROFILE-MENU: signed in, the card is a profile - the plate first, then the Record, the Characters, the Wardrobe and the Account, in two columns, each under its head; signed out it is the card it was (mutants: the sections out of order; a section drawn empty; the plate on a form)', () => {
  const { card, all } = draw({ wardrobe: { titles: ['disciple'], title: 'disciple', glyphs: ['sprout'] } });
  assert.equal(card.root.className, 'card acct acctin', 'the profile\'s own class, so the window widens for it');
  const [plate, grid] = card.root.children;
  assert.ok(has(plate, 'acctplate') && has(grid, 'acctgrid'), 'the plate, then the sections');
  const [deeds, kept] = grid.children;
  assert.deepEqual(heads(deeds.all), ['Record', 'Characters'], 'what they have done, in the first column');
  assert.deepEqual(heads(kept.all), ['Wardrobe', 'Account'], 'what they wear and what the account is, in the second');
  // the plate: the portrait, the heading the Renown pins read (RENOWN1), what is worn
  const [well, ident] = plate.children;
  assert.ok(has(well, 'acctportrait') && has(well.children[0], 'acctsilhouette'), 'no face handed in: the silhouette');
  assert.equal(ident.children[0].tag, 'h3');
  assert.deepEqual(ident.children[0].children.map((c) => [c.className, c.textContent]), [['acctrenown', '10'], ['acctname', 'Nystul']]);
  // nothing to tell: no Record, no Characters, no Wardrobe - the Account stands alone
  const bare = draw({ account: { id: 'p2', name: 'Theod', handle: 'Theod', kind: 'linked', playedS: 60 } });
  assert.deepEqual(heads(bare.all()), ['Account'], 'no heading over an empty box (ACC1e)');
  // a form is the card it was: no plate, no profile class
  const form = draw({ stage: 'login', account: null });
  assert.equal(form.card.root.className, 'card acct');
  assert.ok(!form.all().some((n) => has(n, 'acctplate') || has(n, 'acctsec')));
});

test('PROFILE-MENU: the Record is a tile a deed, the duels with their share won drawn; each character\'s Renown drawn to its next level, a full bar at the cap; the Account keeps its facts and the Patreon link (mutants: the bar the losses\' share; the bar\'s max the level\'s whole; the cap an empty bar)', () => {
  const { all } = draw();
  const record = all().find((n) => has(n, 'acctrecord'));
  assert.deepEqual(record.children.map((li) => li.children.slice(0, 2).map((c) => c.textContent)), [
    ['Duels', '14 won, 6 lost (K/D 2.33)'], ['Breaches closed', '3'], ['Towns defended', '7'], ['Serpents slain', '1'], ['Silver', '1,240 silver'],
  ]);
  const duelBar = record.children[0].children[2];
  assert.equal(duelBar.tag, 'progress');
  assert.deepEqual([duelBar.value, duelBar.max, duelBar.title], [14, 20, '70% of duels won']);
  assert.equal(duelBar.attrs['aria-label'], '70% of duels won', 'said to a reader that cannot see it');
  assert.equal(record.children[1].children.length, 2, 'a count is a figure, no bar');
  const chars = all().find((n) => has(n, 'acctchars'));
  const [mara, old] = chars.children.map((li) => li.children[2]);
  assert.deepEqual([mara.value, mara.max, mara.title], [490, renownXpFor(11) - renownXpFor(10), `490 / ${(renownXpFor(11) - renownXpFor(10)).toLocaleString('en-US')} XP to Renown 11`]);
  assert.deepEqual([old.value, old.max], [1, 1], 'the highest there is: full');
  // no duels fought: the words, and no bar to draw a share of nothing
  const none = draw({ account: { ...ACCOUNT, duels: { wins: 0, losses: 0 } } });
  assert.equal(none.all().find((n) => has(n, 'acctrecord')).children[0].children.length, 2);
  // the Account: the facts ACC4 pins, in the plain list
  const facts = all().find((n) => n.className === 'acctfacts');
  assert.deepEqual(facts.children.map((li) => li.children[0].textContent), ['Username', 'Kind', 'Registered', 'Time played']);
});

test('PROFILE-MENU: the plate wears the corner mark\'s portrait - a face handed in, or one that lands later, drawn once and moved, never asked twice - the title worn in its own colour\'s class, only the glyphs shown, and whose face it is (mutants: a hidden glyph drawn; the late face never drawn; the title\'s class dropped)', async () => {
  const canvas = { tag: 'canvas', className: '', children: [], get all() { return [canvas]; } };
  const now = draw({ face: canvas, character: 'Playing Mara Venn · level 12', wardrobe: { titles: ['founder'], title: 'founder', glyphs: ['sprout', 'dev'], glyphsOff: ['dev'] } });
  const well = now.all().find((n) => has(n, 'acctportrait'));
  assert.deepEqual([well.className, well.children[0]], ['acctportrait hasface', canvas]);
  const worn = now.all().find((n) => has(n, 'acctworn'));
  assert.equal(worn.children[0].className, 'acctworntitle tl-founder');
  assert.equal(worn.children[0].children[0].textContent, 'Founder');
  assert.deepEqual(worn.children.slice(1).map((c) => c.className), ['acctglyph gl-sprout'], 'the hidden glyph is not worn');
  assert.equal(now.all().find((n) => has(n, 'acctcharline')).textContent, 'Playing Mara Venn · level 12');
  // the face as a promise: the silhouette, then the face on the card that follows
  let land;
  const later = draw({ face: new Promise((r) => { land = r; }) });
  assert.ok(has(later.all().find((n) => has(n, 'acctportrait')).children[0], 'acctsilhouette'));
  land(canvas);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(later.all().find((n) => has(n, 'acctportrait')).children[0], canvas, 'the face landed and the card drew it');
  // nothing worn, nothing said
  assert.ok(!draw().all().some((n) => has(n, 'acctworn') || has(n, 'acctcharline')));
});

test('PROFILE-MENU: every class the profile wears is the skin\'s, the title worn has its colour rule per title, the window widens for it and keeps clear of the foot, and a phone gives it the screen (mutants: the plate\'s title colourless; the window\'s width)', () => {
  const css = src('src/ui/enhancedStyle.js');
  const worn = new Set();
  // every class, the gradient title's word among them (Shadow Fang's is a gradient): the source's rule, not only the walked one
  for (const n of draw({ wardrobe: { titles: ['shadowfang', 'disciple'], title: 'shadowfang', glyphs: ['sprout'], auras: ['dagonfire'] } }).all()) for (const c of cls(n)) if (c) worn.add(c);
  assert.deepEqual([...worn].filter((c) => !css.includes(`.${c}`) && !ENHANCED_CSS.includes(`.${c}`)), [], 'a class the skin has no rule for');
  assert.match(ENHANCED_CSS, /\.card \.acctworntitle\.tl-founder \{ color: (#[0-9a-f]{6}|rgba?\()/, 'the worn title\'s colour, walked out of the vocabulary');
  assert.match(css, /\.px-win\.px-acctwin:has\(\.card\.acct\.acctin\) \{ width: min\(820px, 94vw\); max-height: min\(720px, calc\(100dvh - clamp\(270px, 33vh, 400px\) - 84px\)\); \}/);
  assert.match(css, /@media \(max-width: 480px\) \{\n  \.px-stage\.px-acctstage \{ padding: max\(10px, env\(safe-area-inset-top\)\) 8px/);
  assert.match(css, /@container \(min-width: 600px\) \{ \.card \.acctgrid \{ grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\);/);
  assert.ok(FRAME_ROLES.panel.includes('.px-win .card.acctin ul.acctfacts.acctrecord li'), 'under Plus a deed\'s tile is a panel');
  // the card still brings no design language of its own (ACC1e)
  const js = src('src/ui/enhancedAccount.js').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[ \t])\/\/[^\n]*/gm, '$1');
  assert.doesNotMatch(js, /\.style\.|cssText|#[0-9a-fA-F]{6}/);
  // the door hands the card the mark's own character and face
  const menu = src('src/ui/enhancedMenu.js');
  assert.match(menu, /const save = profileCharacter\(\);\n  card = accountCard\(document, flow, \{/);
  assert.match(menu, /face: save \? loadFace\(save, \{ scale: 2, copy: true \}\) : null,\n    character: save \? `Playing \$\{characterLine\(save\)\}` : null,/);
});

// ── PLUS-MENU ───────────────────────────────────────────────────────

test('PLUS-MENU: the doors and the System list are the kit\'s buttons, given the edge the role paints at the box they were, one width a column, the diamonds standing; a phone\'s at the tap floor (mutants: the doors out of the role; the edge without the padding given back; the sheet after the kit)', () => {
  for (const sel of ['.px-menu .doorbtn', '.px-menu.px-compact button']) assert.ok(FRAME_ROLES.button.includes(sel), `${sel} is a button`);
  assert.ok(PLUS_CSS.indexOf(MENU_CSS) > 0 && PLUS_CSS.indexOf(MENU_CSS) < PLUS_CSS.indexOf('/* FRAME1: LAST'), 'before the kit, so the kit\'s paint wins');
  // THE BOX THEY WERE: the base door's padding, less the 2px edge the role paints
  const base = /\.px-menu button \{[^}]*padding: (\d+)px (\d+)px;/.exec(ENHANCED_CSS);
  const plus = /\.px-menu \.doorbtn \{ justify-content: space-between; border: 2px solid; padding: (\d+)px (\d+)px; \}/.exec(MENU_CSS);
  assert.ok(base && plus, 'both rules');
  assert.deepEqual([Number(plus[1]) + 2, Number(plus[2]) + 2], [Number(base[1]), Number(base[2])], 'a door is the box it was');
  const compactBase = /\.px-menu\.px-compact button \{[^}]*padding: (\d+)px (\d+)px; \}/.exec(ENHANCED_CSS);
  const compact = /\.px-menu\.px-compact button \{ justify-content: space-between; border: 2px solid; padding: (\d+)px (\d+)px; \}/.exec(MENU_CSS);
  assert.deepEqual([Number(compact[1]) + 2, Number(compact[2]) + 2], [Number(compactBase[1]), Number(compactBase[2])]);
  assert.match(MENU_CSS, /\.px-menu:not\(\.px-compact\) \{ width: min\(384px, calc\(100vw - 32px\)\); align-items: stretch;/);
  assert.match(MENU_CSS, /\.px-menu \.doorbtn \.px-c, \.px-menu\.px-compact button \.px-c \{ visibility: visible;/);
  assert.match(MENU_CSS, /@media \(max-width: 480px\) \{\n  \.px-menu:not\(\.px-compact\) \{ gap: 6px; \}\n  \.px-menu \.doorbtn \{ padding: 2px 16px; min-height: 44px;/);
  // every Plus colour dresses them: the theme rules are walked out of the same role list
  assert.match(PLUS_CSS, /:root\[data-plus-theme="stone"\] \.px-menu \.doorbtn/);
});

// ── PLUS-SITE ───────────────────────────────────────────────────────

test('PLUS-SITE: the site wears the kit - its roles in the game\'s own tones, cut with no picture, four brass fittings to a window, Play in brass - injected after the page\'s own sheet (mutants: the kit not injected; a url() in it; a fitting missing; Play plain stone)', () => {
  const out = transformLanding(src('index.html'), {});
  const kit = out.tags.find((t) => t.tag === 'style' && t.attrs.id === 'plus-kit');
  assert.ok(kit, 'the kit is injected');
  assert.equal(kit.children, SITE_KIT_CSS, 'verbatim');
  assert.equal(kit.injectTo, 'head', 'after the page\'s own sheet - it wins by order, as the kit does in the game');
  assert.doesNotMatch(SITE_KIT_CSS, /url\(/, 'a page that may carry no picture');
  for (const tone of ['outline', 'stoneHi', 'stoneLit', 'stoneDark', 'brassHi', 'brass', 'brassLo', 'brassDark', 'groundButton', 'groundPanel']) {
    assert.ok(SITE_KIT_CSS.includes(FRAME_TONES[tone]), `${tone}: the game's stone`);
  }
  for (const corner of ['left 0px top 0px', 'right 0px top 0px', 'left 0px bottom 0px', 'right 0px bottom 0px']) {
    assert.ok(SITE_KIT_CSS.includes(`${FRAME_TONES.outline}) ${corner} / ${SITE_FITTING}px ${SITE_FITTING}px no-repeat`), `the ${corner} fitting`);
  }
  assert.match(SITE_KIT_CSS, /\.doorplaques \.plaque:first-child \{ border-color: #f3cf86 #7a5424 #5c3f1a #c08a3e; background-color: #2a2217; \}/, 'Play, in brass');
  assert.deepEqual(SITE_ROLES.button, ['.plaque', '.ask', '.doorlinks a']);
  assert.deepEqual(SITE_ROLES.window, ['main > section']);
});

test('PLUS-SITE: every box the page declares is one the kit paints - its edge and room the page\'s, its colour the kit\'s - and the question-and-answer lists stand a panel a pair (mutants: a section with no edge; a pair outside its panel)', () => {
  const landing = src('index.html');
  const css = landing.match(/<style>([\s\S]*?)<\/style>/)[1].replace(/\/\*[\s\S]*?\*\//g, '');
  const roles = Object.values(SITE_ROLES).flat();
  for (const [, sel] of css.matchAll(/(?:^|\n)\s*([^{}\n]+?) \{[^}]*border: \d+px solid;/g)) {
    assert.ok(roles.includes(sel.trim()) || sel.split(',').every((s) => roles.includes(s.trim())), `${sel.trim()} declares a box the kit does not paint`);
  }
  assert.match(css, /main > section \{ position: relative; border: 4px solid;/, 'a section is a window');
  assert.match(css, /\.cols > div, \.grid > div \{ border: 2px solid;/);
  assert.match(css, /\.step::before \{[^}]*width: 54px; height: 54px; border: 2px solid;/, 'the numeral in its socket');
  assert.match(css, /\.qa > div \{ display: grid; grid-template-columns: 220px 1fr;[^}]*border: 2px solid; \}/);
  for (const dl of landing.match(/<dl class="qa">[\s\S]*?<\/dl>/g)) {
    const pairs = dl.match(/<dt\b/g).length;
    assert.equal((dl.match(/<div><dt\b[^]*?<\/dd><\/div>/g) ?? []).length, pairs, 'every question in a panel with its answer');
  }
});
