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
// The record: bible/10-UI/UI-Arc.md PROFILE-MENU / PLUS-MENU / PLUS-SITE, and its AUDIT (the pins it added say so).
// Mutants: tools/mutants/plus_menu_site.json.
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
  assert.equal(grid.className, 'acctgrid acctgrid2', 'two columns, both with something in them');
  const [deeds, kept] = grid.children;
  assert.deepEqual(heads(deeds.all), ['Record', 'Characters'], 'what they have done, in the first column');
  assert.deepEqual(heads(kept.all), ['Wardrobe', 'Account'], 'what they wear and what the account is, in the second');
  // the plate: the portrait, the heading the Renown pins read (RENOWN1), what is worn
  const [well, ident] = plate.children;
  assert.ok(has(well, 'acctportrait') && has(well.children[0], 'acctsilhouette'), 'no face handed in: the silhouette');
  assert.equal(ident.children[0].tag, 'h3');
  assert.deepEqual(ident.children[0].children.map((c) => [c.className, c.textContent]), [['acctrenown', '10'], ['acctname', 'Nystul']]);
  // nothing to tell (a service from before the record, or the offline fallback's stored session): no Record, no
  // Characters, no Wardrobe - the Account stands alone, and in ONE column (AUDIT P2: an empty left one stood beside it)
  const bare = draw({ account: { id: 'p2', name: 'Theod', handle: 'Theod', kind: 'linked', playedS: 60 } });
  assert.deepEqual(heads(bare.all()), ['Account'], 'no heading over an empty box (ACC1e)');
  const bareGrid = bare.card.root.children[1];
  assert.deepEqual([bareGrid.className, bareGrid.children.length], ['acctgrid', 1], 'one column, not two with one empty');
  // a NEW GUEST as the service answers one today (records at zero, no Renown yet, Marks not a guest's): the Record
  // with its zeros, and the guest's note inside the Account it is about
  const guest = draw({ account: { id: 'p3', name: 'Theod Gwyn', guestName: 'Theod Gwyn', handle: null, kind: 'guest', registeredAt: null,
    playedS: 600, duels: { wins: 0, losses: 0 }, gates: { closed: 0 }, raids: { defended: 0 }, serpents: { slain: 0 }, renown: [], marks: null } });
  assert.deepEqual(heads(guest.all()), ['Record', 'Account']);
  const acct = guest.all().find((n) => n.tag === 'section' && n.children[0]?.textContent === 'Account');
  assert.ok(acct.all.some((n) => n.className === 'meta' && /keeps everything this account already has/.test(n.textContent)), 'the note is the Account\'s');
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
  // the share rounds to the nearest whole - two of three is 67%, not 66%
  const third = draw({ account: { ...ACCOUNT, duels: { wins: 2, losses: 1 } } }).all().find((n) => has(n, 'acctrecord')).children[0].children[2];
  assert.equal(third.title, '67% of duels won');
  // no duels fought: the words, and no bar to draw a share of nothing
  const none = draw({ account: { ...ACCOUNT, duels: { wins: 0, losses: 0 } } });
  assert.equal(none.all().find((n) => has(n, 'acctrecord')).children[0].children.length, 2);
  // the Account: the facts ACC4 pins, in the plain list
  const facts = all().find((n) => n.className === 'acctfacts');
  assert.deepEqual(facts.children.map((li) => li.children[0].textContent), ['Username', 'Kind', 'Registered', 'Time played']);
});

test('PROFILE-MENU: the plate wears the corner mark\'s portrait - a face handed in, or one that lands later, drawn once and moved, never asked twice - the title worn in its own colour\'s class, only the glyphs shown, and whose face it is (mutants: a hidden glyph drawn; the late face never drawn; the title\'s class dropped)', async () => {
  const canvas = { tag: 'canvas', className: '', children: [], get all() { return [canvas]; } };
  // AUDIT P7: THE SHAPE THE PRODUCER MINTS - loadFace is async, so the door hands a promise, never a bare canvas
  const now = draw({ face: Promise.resolve(canvas), character: 'Playing Mara Venn · level 12', wardrobe: { titles: ['founder'], title: 'founder', glyphs: ['sprout', 'dev'], glyphsOff: ['dev'] } });
  await new Promise((r) => setTimeout(r, 0));
  const well = now.all().find((n) => has(n, 'acctportrait'));
  assert.deepEqual([well.className, well.children[0], well.attrs['aria-hidden']], ['acctportrait hasface', canvas, 'true'], 'the face, a picture a reader is not told about');
  const worn = now.all().find((n) => has(n, 'acctworn'));
  assert.equal(worn.children[0].className, 'acctworntitle tl-founder');
  assert.equal(worn.children[0].children[0].textContent, 'Founder');
  assert.deepEqual(worn.children.slice(1).map((c) => [c.className, c.title]), [['acctglyph gl-sprout', 'New account']], 'the hidden glyph is not worn; a shown one is named');
  assert.equal(now.all().find((n) => has(n, 'acctcharline')).textContent, 'Playing Mara Venn · level 12');
  // the face as a promise: the silhouette, then the face on the card that follows
  let land;
  const later = draw({ face: new Promise((r) => { land = r; }) });
  assert.ok(has(later.all().find((n) => has(n, 'acctportrait')).children[0], 'acctsilhouette'));
  land(canvas);
  await new Promise((r) => setTimeout(r, 0));
  const landed = later.all().find((n) => has(n, 'acctportrait'));
  assert.deepEqual([landed.className, landed.children[0]], ['acctportrait hasface', canvas], 'the face landed and the card drew it');
  // a bare canvas is no shape the door hands: it draws the silhouette (the branch for it is gone - AUDIT P7)
  assert.ok(has(draw({ face: canvas }).all().find((n) => has(n, 'acctportrait')).children[0], 'acctsilhouette'));
  // nothing worn, nothing said
  assert.ok(!draw().all().some((n) => has(n, 'acctworn') || has(n, 'acctcharline')));
});

test('PROFILE-MENU: every class the profile wears is the skin\'s, the title worn has its colour rule per title, the window widens for it and keeps clear of the foot, and a phone gives it the screen (mutants: the plate\'s title colourless; the window\'s width; the short screen\'s height; Close out of reach)', async () => {
  const css = src('src/ui/enhancedStyle.js');
  const worn = new Set();
  // every class, the gradient title's word among them (Shadow Fang's is a gradient), an SVG's too (its class is an
  // attribute) - each matched WHOLE against the composed sheet's rules (AUDIT P6: a prefix passed for its longer name,
  // `.acctworn` for `.acctworntitle`, and the comments counted)
  const face = { tag: 'canvas', className: '', children: [], get all() { return [face]; } };
  const card = draw({ face: Promise.resolve(face), wardrobe: { titles: ['shadowfang', 'disciple'], title: 'shadowfang', glyphs: ['sprout'], auras: ['dagonfire'] } });
  await new Promise((r) => setTimeout(r, 0));   // the face lands: `hasface` is walked too
  for (const n of card.all()) for (const c of [...cls(n), ...String(n.attrs?.class ?? '').split(/\s+/)]) if (c) worn.add(c);
  assert.ok(worn.has('acctglyphart') && worn.has('acctworn') && worn.has('hasface'), 'the walk sees the SVG, the line and the face');
  const rules = ENHANCED_CSS.replace(/\/\*[\s\S]*?\*\//g, ' ');
  assert.deepEqual([...worn].filter((c) => !new RegExp(`\\.${c}(?![\\w-])`).test(rules)), [], 'a class the skin has no rule for');
  assert.match(ENHANCED_CSS, /\.card \.acctworntitle\.tl-founder \{ color: (#[0-9a-f]{6}|rgba?\()/, 'the worn title\'s colour, walked out of the vocabulary');
  assert.match(css, /\.px-win\.px-acctwin:has\(\.card\.acct\.acctin\) \{ max-height: min\(720px, calc\(100dvh - clamp\(270px, 33vh, 400px\) - 84px\)\); \}/);
  assert.match(css, /\.px-win\.px-acctwin:has\(\.acctgrid2\) \{ width: min\(820px, 94vw\); \}/, 'wide only for two columns');
  // AUDIT P1: a short screen gives it the height - LATER than the rule above, at its weight, or 844x390 drew 36px
  const short = '@media (max-height: 560px) { .px-win.px-acctwin:has(.card.acct.acctin) { max-height: calc(100dvh - 20px); } }';
  assert.ok(css.indexOf(short) > css.indexOf('.px-win.px-acctwin:has(.card.acct.acctin) { max-height: min(720px'), 'the short screen\'s rule, after the window\'s');
  assert.match(css, /\.px-over \.px-win\.px-acctwin:has\(\.card\.acct\.acctin\) \{ max-height: min\(760px, 86dvh\); \}/, 'over a game: centred, the height the pause window has');
  // a phone gives it the screen - the stage AND the window
  assert.match(css, /@media \(max-width: 480px\) \{\n  \.px-stage\.px-acctstage \{ padding: max\(10px, env\(safe-area-inset-top\)\) 8px max\(10px, env\(safe-area-inset-bottom\)\); background: rgba\(8,10,15,0\.88\); \}\n  \.px-win\.px-acctwin, \.px-win\.px-acctwin:has\(\.card\.acct\.acctin\) \{ width: 100%; max-height: calc\(100dvh - 20px\); \}/);
  // two columns are the CARD's width's call - the card is the container the query reads, or it never matches
  assert.match(css, /\.card\.acctin \{ container-type: inline-size; \}/);
  assert.match(css, /@container \(min-width: 600px\) \{ \.card \.acctgrid\.acctgrid2 \{ grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\);/);
  assert.match(css, /\.card ul\.acctfacts\.acctrecord li:has\(\.acctbar\) \{ grid-column: 1 \/ -1; \}/, 'the duels\' tile takes the row');
  // AUDIT P4: Close in reach - the presses stand at the window's foot, the body's foot padding theirs
  assert.match(css, /\.px-win\.px-acctwin \.card\.acct\.acctin \.acts \{ position: sticky; bottom: 0; z-index: 1; padding-bottom: 20px;/);
  assert.match(css, /\.px-win\.px-acctwin:has\(\.card\.acct\.acctin\) \.px-body \{ padding-bottom: 0; \}/);
  // AUDIT P3: Stone's light ground lifts the profile's quiet words, as it lifts the hourglass's
  assert.match(css, /:root\[data-plus-theme="stone"\] \.px-acctwin \{ --dim: #e2dccd; --brass: #ffd98a;/);
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

test('PLUS-MENU: the doors are the kit\'s buttons, given the edge the role paints at the box they were, one width a column inside the stage, the diamonds standing but never read as words; a phone\'s at the tap floor (mutants: the doors out of the role; the edge without the padding given back; the sheet after the kit; the rail past a phone\'s stage; the diamonds named)', () => {
  assert.ok(FRAME_ROLES.button.includes('.px-menu .doorbtn'), 'a door is a button');
  // AUDIT M3: `.px-menu.px-compact` was named for the System tab's list, and nothing builds it - no dead selector stays
  assert.doesNotMatch(MENU_CSS, /px-compact/);
  assert.ok(!Object.values(FRAME_ROLES).flat().some((x) => x.includes('px-compact')));
  assert.ok(PLUS_CSS.indexOf(MENU_CSS) > 0 && PLUS_CSS.indexOf(MENU_CSS) < PLUS_CSS.indexOf('/* FRAME1: LAST'), 'before the kit, so the kit\'s paint wins');
  // THE BOX THEY WERE: the base door's padding, less the 2px edge the role paints
  const base = /\.px-menu button \{[^}]*padding: (\d+)px (\d+)px;/.exec(ENHANCED_CSS);
  const plus = /\.px-menu \.doorbtn \{ justify-content: space-between; border: 2px solid; padding: (\d+)px (\d+)px; \}/.exec(MENU_CSS);
  assert.ok(base && plus, 'both rules');
  assert.deepEqual([Number(plus[1]) + 2, Number(plus[2]) + 2], [Number(base[1]), Number(base[2])], 'a door is the box it was');
  // AUDIT M1: the stage's width, never the viewport's - 100vw - 32px ran 8px past a phone's stage and panned the door
  assert.match(MENU_CSS, /\.px-home \.px-menu \{ width: min\(384px, 100%\); align-items: stretch;/);
  assert.match(MENU_CSS, /\.px-menu \.doorbtn \.px-c \{ visibility: visible; color: #5a5446;/);
  assert.match(MENU_CSS, /\.px-menu \.doorbtn:hover \.px-c, \.px-menu \.doorbtn:focus-visible \.px-c \{ color: rgb\(243,239,44\);/, 'gold on the door under the pointer');
  // AUDIT M4: on Stone the dim diamond vanished - the lit stone at rest, and still the gold under the pointer
  assert.match(MENU_CSS, /:root\[data-plus-theme="stone"\] \.px-menu \.doorbtn:not\(:hover\):not\(:focus-visible\) \.px-c \{ color: #9a9079; \}/);
  assert.match(MENU_CSS, /@media \(max-width: 480px\) \{\n  \.px-home \.px-menu \{ gap: 6px; \}\n  \.px-menu \.doorbtn \{ padding: 2px 16px; min-height: 44px; font-size: 22px; \}/);
  assert.match(MENU_CSS, /\.px-home \.px-rule::before \{ background: linear-gradient\(90deg, transparent, #7a5424 45%, #f3cf86\); \}/, 'the rule under the wordmark gilt');
  // AUDIT M2: standing at rest, the diamonds would be every door's name - "◆ Continue ◆" - so each is hidden from a reader
  const menu = src('src/ui/enhancedMenu.js');
  const doorLoop = menu.slice(menu.indexOf("const b = el('button', `doorbtn door-${id}`);"), menu.indexOf('menu.append(b);', menu.indexOf("const b = el('button', `doorbtn door-${id}`);")));
  assert.match(doorLoop, /const dia = \(\) => \{ const d = el\('span', 'px-c', '\\u25c6'\); d\.setAttribute\('aria-hidden', 'true'\); return d; \};\n\s+b\.append\(dia\(\), document\.createTextNode\(label\), dia\(\)\);/);
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
  assert.deepEqual(SITE_ROLES.header, ['main > section > h2'], 'a section\'s name on its lit band');
  // the fittings are DRAWN: the window's ::before, laid absolute over its corners, eight layers a fitting, four fittings
  assert.match(SITE_KIT_CSS, new RegExp(`main > section::before \\{\\n  content: ''; position: absolute; inset: -${SITE_FITTING / 2 + 2}px; pointer-events: none;`));
  assert.equal((SITE_KIT_CSS.match(/no-repeat/g) ?? []).length, 32, 'rivet and ring, the lit and shaded edges, the body and the outline - at four corners');
  // what you press goes brass under the pointer and sinks while held
  assert.match(SITE_KIT_CSS, /\.plaque:hover,\n\.ask:hover,\n\.doorlinks a:hover,\n\.doorplaques \.plaque:first-child:hover,\n\.plaque:focus-visible,[^{]*\{ border-color: #f3cf86 #7a5424 #5c3f1a #c08a3e;/);
  assert.match(SITE_KIT_CSS, /\.plaque:active,\n\.ask:active,\n\.doorlinks a:active,\n\.doorplaques \.plaque:first-child:active \{ border-color: #25221b #7a7260 #9a9079 #3a352a; translate: 1px 1px;/);
});

test('PLUS-SITE: every box the page declares is one the kit paints - its edge and room the page\'s, its colour the kit\'s - and the question-and-answer lists stand a panel a pair (mutants: a section with no edge; a pair outside its panel)', () => {
  const landing = src('index.html');
  const css = landing.match(/<style>([\s\S]*?)<\/style>/)[1].replace(/\/\*[\s\S]*?\*\//g, '');
  const roles = Object.values(SITE_ROLES).flat();
  for (const [, sel] of css.matchAll(/(?:^|\n)\s*([^{}\n]+?) \{[^}]*border: \d+px solid;/g)) {
    assert.ok(roles.includes(sel.trim()) || sel.split(',').every((s) => roles.includes(s.trim())), `${sel.trim()} declares a box the kit does not paint`);
  }
  assert.match(css, /main > section \{ position: relative; border: 4px solid;/, 'a section is a window');
  assert.match(css, /\.doorlinks a \{ display: inline-flex; align-items: center; min-height: 44px;/, 'a section link is a thumb\'s target');
  assert.match(css, /\.cols > div, \.grid > div \{ border: 2px solid;/);
  assert.match(css, /\.step::before \{[^}]*width: 54px; height: 54px; border: 2px solid;/, 'the numeral in its socket');
  assert.match(css, /\.qa > div \{ display: grid; grid-template-columns: 220px 1fr;[^}]*border: 2px solid; \}/);
  for (const dl of landing.match(/<dl class="qa">[\s\S]*?<\/dl>/g)) {
    const pairs = dl.match(/<dt\b/g).length;
    assert.equal((dl.match(/<div><dt\b[^]*?<\/dd><\/div>/g) ?? []).length, pairs, 'every question in a panel with its answer');
  }
});
