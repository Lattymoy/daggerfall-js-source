// GRIM1 (2026-10-09, Discord: CLEM - "Grimoir UI is almost amazing ... I want some of the features of enhanced+ just
// not the overall look of it"; Skibbster - "More support for grimoire and classic UI in general") - DFO GRIMOIRE: the
// enhanced skin, every window and feature it carries, dressed in GrimoireUI's own art (ui/grimoireDress.js,
// ui/grimoireArt.js). The browser half - the dress worn on the front door, the pack, the books, the Ascend, the HUD's
// vials - is tools/grimoireDressProbe.mjs (no ARENA2).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OVERHAUL_PANELS, currentOption } from '../../src/systems/overhauls.js';
import { getPref, setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import {
  plusDress, inkColour, woodColour, washColour, lineColour, inkCss, sayRule, kitCss, varsOut, learnSheetVars, rosterCss, faceCss, G,
  INK_ROOTS, WOOD_ROOTS, PRESS_ROOTS, EXIT_WORDS, GRIMOIRE_STACK, GRIMOIRE_PAGES, GRIMOIRE_BACKDROPS, GRIMOIRE_VITALS,
  grimoirePages, grimoireBackdrop, grimoireVitals, DESK_BOOK, BOOK_SPINE, parseColour, GRIM_YELLOW, snapSize,
  GRIMOIRE_SPELLBOOKS, grimoireSpellbook, bookSound, BOOK_BEAT_MS, UNROLL_SEL, DIAL_WORD, ATTRIBUTE_WORD, VITAL_WORD,
} from '../../src/ui/grimoireDress.js';
import { GRIMOIRE_CROPS, GRIMOIRE_SIZES, TEAR_LUMA, FRAME_ART, grimoireGrid, DIAL_ICONS, dialIconBox, dialIconSize, dialRows, dialArtName, NATIVE, VIAL_CUT } from '../../src/ui/grimoireArt.js';
import { applyPlusTheme, REFORGE_CSS } from '../../src/ui/enhanced/enhancedPlusStyle.js';
import { FRAME_ROLES } from '../../src/ui/enhanced/enhancedFrame.js';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url));
const manifest = JSON.parse(rd('vendor/grimoire-ui/grimoire-ui.files.json').toString('utf8'));
beforeEach(() => _resetForTests());

/** [r, g, b, a] of an `hsl(H S% L% / A)` the ink writes. */
const hslOf = (s) => { const m = /hsl\((\d+) (\d+)% (\d+)%(?: \/ ([\d.]+))?\)/.exec(s); return m && { h: +m[1], s: +m[2] / 100, l: +m[3] / 100, a: m[4] == null ? 1 : +m[4] }; };

test('GRIM1: DFO Grimoire is the UI panel\'s fourth look - the ENHANCED skin with the grimoire dress; wearing it lands both on the shelf and reloads, Enhanced Plus takes the dress off again, and each reads as the look in use only with its own dress (mutants: the dress not written; Enhanced Plus reading as in use under the dress)', () => {
  const ui = OVERHAUL_PANELS.find((p) => p.id === 'ui');
  const grim = ui.options.find((o) => o.id === 'dfo-grimoire');
  const plusLook = ui.options.find((o) => o.id === 'enhanced-plus');
  assert.equal(grim.name, 'DFO Grimoire');
  assert.equal(grim.skin, 'enhanced');
  assert.equal(grim.dress, 'grimoire');
  assert.equal(grim.vendor, 'grimoire-ui', 'the art is GrimoireUI\'s: the credits reach the pack through the look');
  assert.match(grim.by, /LordSquacquerone/);
  assert.equal(currentOption(ui), plusLook, 'a fresh shelf: Enhanced Plus');
  const r = grim.apply();
  assert.equal(r.reload, true);
  assert.equal(getPref('skin'), 'enhanced');
  assert.equal(getPref('plusDress'), 'grimoire');
  assert.equal(new URL(r.url).searchParams.get('dress'), null, 'the shelf took it - the URL carries nothing');
  assert.equal(currentOption(ui), grim);
  assert.equal(plusLook.isOn(), false, 'Enhanced Plus is not in use under the dress');
  plusLook.apply();
  assert.equal(getPref('plusDress'), 'none');
  assert.equal(currentOption(ui), plusLook);
});

test('GRIM1: a shelf that refuses the write carries the dress on the URL (SKIN-CARRY\'s law), and `?dress=` answers for the page load over the shelf (mutants: the carry dropped; the override ignored)', () => {
  const ui = OVERHAUL_PANELS.find((p) => p.id === 'ui');
  const grim = ui.options.find((o) => o.id === 'dfo-grimoire');
  globalThis.localStorage = { getItem: () => null, setItem: () => { throw new Error('blocked'); } };
  try {
    _resetForTests();
    const u = new URL(grim.apply().url);
    assert.equal(u.searchParams.get('dress'), 'grimoire');
    assert.equal(u.searchParams.get('skin'), 'enhanced');
  } finally { delete globalThis.localStorage; }
  _resetForTests();
  assert.equal(plusDress('?dress=grimoire'), 'grimoire');
  assert.equal(plusDress('?dress=none'), 'none');
  setPref('plusDress', 'grimoire');
  assert.equal(plusDress(''), 'grimoire');
  assert.equal(plusDress('?dress=none'), 'none', 'the URL outranks the shelf');
  assert.equal(plusDress('?dress=bogus'), 'grimoire', 'a typo is not an instruction');
});

test('GRIM1: under the dress the Plus colour stands at Slate on the page and the player\'s own colour stays on the shelf, unworn - so a Stone chosen for Enhanced Plus never bleeds into the Grimoire (mutants: the theme worn under the dress; the shelf overwritten)', () => {
  setPref('plusTheme', 'stone');
  setPref('plusDress', 'grimoire');
  const doc = { documentElement: { dataset: {}, style: { setProperty() {} } }, head: null };
  applyPlusTheme(doc);
  assert.equal(doc.documentElement.dataset.plusTheme, 'slate');
  assert.equal(getPref('plusTheme'), 'stone');
  setPref('plusDress', 'none');
  applyPlusTheme(doc);
  assert.equal(doc.documentElement.dataset.plusTheme, 'stone');
});

test('GRIM1: the card\'s own choices - the page (cream or the tan scroll), the backdrop (the desk or the map), the vitals (upright vials or a row) - default to the pack\'s own and read a bad value as the default (mutants: a default moved; a bad value kept)', () => {
  assert.deepEqual(Object.keys(GRIMOIRE_PAGES), ['cream', 'scroll']);
  assert.deepEqual(Object.keys(GRIMOIRE_BACKDROPS), ['desk', 'map']);
  assert.deepEqual(Object.keys(GRIMOIRE_VITALS), ['upright', 'row']);
  assert.deepEqual([grimoirePages(), grimoireBackdrop(), grimoireVitals()], ['cream', 'desk', 'upright']);
  setPref('grimoirePages', 'vellum'); setPref('grimoireBackdrop', 'moon'); setPref('grimoireVitals', 'sideways');
  assert.deepEqual([grimoirePages(), grimoireBackdrop(), grimoireVitals()], ['cream', 'desk', 'upright']);
  setPref('grimoirePages', 'scroll'); setPref('grimoireBackdrop', 'map'); setPref('grimoireVitals', 'row');
  assert.deepEqual([grimoirePages(), grimoireBackdrop(), grimoireVitals()], ['scroll', 'map', 'row']);
});

test('GRIM1: THE INK - a light word becomes the pack\'s brown ink, darker the brighter it was; gold and yellow its red; a hue keeps its hue as ink; a dark word stands. On the wood a grey word warms to its tan; a dark ground becomes a faint wash; a dark edge a brown line (mutants: the ink lightened; gold kept gold; a dark word inked)', () => {
  const bone = hslOf(inkColour('#e9e4d9')), dim = hslOf(inkColour('#9c937d'));
  assert.ok(bone.l <= 0.12 && dim.l <= 0.21 && bone.l < dim.l, `bone ${bone.l}, dim ${dim.l}`);
  assert.equal(bone.h, 26);
  assert.equal(inkColour('rgb(243,239,44)'), GRIM_YELLOW, 'Daggerfall\'s yellow stays its yellow on a page, as the pack writes a value');
  const brass = hslOf(inkColour('#f3cf86'));
  assert.deepEqual([brass.h, brass.l], [5, 0.29], 'Plus\'s brass is the pack\'s red');
  assert.deepEqual([snapSize(12), snapSize(20), snapSize(21), snapSize(26), snapSize(46)], [16, 16, 32, 32, 48], 'every size on the face\'s 16px grid');
  const green = hslOf(inkColour('#6fcf8a'));
  assert.ok(green.h > 120 && green.h < 150 && green.l <= 0.25 && green.l >= 0.15, 'a gain stays green, in ink - INK-READ: deepened only as far as it reads at 4.5:1');
  assert.equal(inkColour('#0e1013'), null, 'a dark word stands');
  assert.equal(inkColour('rgba(255,255,255,0)'), null, 'a clear one too');
  const half = hslOf(inkColour('rgba(233,228,217,0.5)'));
  assert.equal(half.a, 0.5, 'the alpha is the word\'s own');
  const tan = hslOf(woodColour('#9c937d'));
  assert.ok(tan.l >= 0.66 && tan.h === 40, `the wood's tan: ${JSON.stringify(tan)}`);
  assert.equal(woodColour('rgb(243,239,44)'), null, 'a hue stands on the wood');
  const wash = hslOf(washColour('rgba(12,14,18,0.93)'));
  assert.ok(wash.a <= 0.2 && wash.l > 0.25, 'a dark ground is a faint brown wash, never a slab');
  assert.equal(washColour('#e9e4d9'), null);
  const line = hslOf(lineColour('#050608'));
  assert.ok(line.l < 0.2 && line.h === 26);
  assert.deepEqual(parseColour('#abc'), [170, 187, 204, 1]);
  assert.deepEqual(parseColour('rgba(1, 2, 3, 0.5)'), [1, 2, 3, 0.5]);
});

test('GRIM1: a rule re-said - the face for everywhere (the pack\'s Alagard over the pixel face, no capitals, no spacing), the ink and the wash for a page, the tan for the wood and the desk; a pseudo-element keeps its place after the scope, and Plus\'s diamonds go (mutants: the face left Pixelify; the scope spliced after ::before; the diamond kept)', () => {
  const css = inkCss(`.x { color: #e9e4d9; background: rgba(12,14,18,0.9); font-family: 'Pixelify Five', 'Pixelify Sans', monospace;
    text-transform: uppercase; letter-spacing: 0.16em; }
.y::before { content: '\\25c6'; color: rgb(243,239,44); }
@keyframes k { from { color: #fff; } }
@media (max-width: 10px) { .z { color: #fff; } }`);
  assert.match(css, new RegExp(`${G.replace(/[[\]()]/g, '\\$&')} \\.x \\{ font-family: ${GRIMOIRE_STACK.replace(/[()]/g, '\\$&')}`));
  assert.match(css, /text-transform: none/);
  assert.match(css, /letter-spacing: 0[;\s}]/, 'a part-pixel of tracking goes - it moves every letter off the grid');
  assert.match(css, /-webkit-font-smoothing: none/, 'the face stays pixelated');
  assert.match(css, /\.x:is\(\[data-grim="ink"\], \[data-grim="ink"\] \*\):not\(\[data-grim="wood"\], \[data-grim="wood"\] \*\) \{ color: hsl\(26 /);
  assert.match(css, /:not\(\[data-grim\]\) \{ background: hsl\(30 45% 32% \/ 0\.144\)/, 'the wash never paints a surface itself');
  assert.match(css, /\.x:is\(\[data-grim="wood"\], \[data-grim="wood"\] \*\) \{ color: hsl\(40 /);
  assert.match(css, /\.x:is\(\[data-grim-desk\] \*\):not\(\[data-grim\], \[data-grim\] \*\) \{ color: hsl\(40 /);
  assert.match(css, /\.y:is\(\[data-grim="ink"\][^{]*\)::before \{ color: #f4e04c; text-shadow: /, 'a value in yellow carries its hard edge');
  assert.match(inkCss('.z.on { color: rgb(243,239,44); }'), /\.z\.on:is[^{]*\{ color: hsl\(5 80% 29%\)/, 'a CHOSEN word is the pack\'s red');
  assert.match(css, /\.y::before \{ content: none \}/);
  assert.doesNotMatch(css, /@keyframes/, 'a keyframe is a moment of an animation, never a page');
  assert.match(css, /@media \(max-width: 10px\) \{\n[^}]*\.z/);
  assert.equal(sayRule('color: var(--bone)').ink, 'color: hsl(26 60% 9%)', 'the sheet\'s own vars are read as their colours');
  assert.equal(sayRule('content: \'\\25c6 \' / \'\'').face, '', 'a diamond with its own alt text is a label, kept');
});

test('GRIM1: THE KIT covers every role the enhanced kit dresses - every window, panel, press, tile, chip, well, band and tab under the dress\'s scope - and names nothing of Plus\'s dress: no pixel face, no brass corner fitting (mutants: a role left to Plus; the pixel face in the kit)', () => {
  const kit = kitCss();
  for (const role of ['window', 'panel', 'button', 'primary', 'warn', 'tile', 'chip', 'well', 'header', 'footer', 'tabs']) {
    for (const sel of FRAME_ROLES[role]) assert.ok(kit.includes(`${G} ${sel}`), `${role}: ${sel}`);
  }
  assert.doesNotMatch(kit + rosterCss() + faceCss('x'), /Pixelify/);
  for (const n of ['vialHealthTube', 'vialMagickaTube', 'vialFatigueTube', 'vialHealthUp', 'vialHealthUpEmpty', 'vialHealthTubeEmpty', 'vialCork', 'cubby', 'frame', 'page', 'scroll', 'wood', 'sideScroll', 'exit', 'bookL', 'bookR', 'stone', 'plate', 'plateOn', 'spbk']) {   // GRIM6: the front door's desk is the pack's painting itself now, not the grid cut
    assert.ok((kit + rosterCss()).includes(`--grim-${n}`), `the kit paints with ${n}`);
  }
  assert.ok(INK_ROOTS.includes('.px-win') && INK_ROOTS.includes('.notice'), 'windows and notes are pages');
  assert.ok(WOOD_ROOTS.includes('.pack-shell .itemrow') && WOOD_ROOTS.includes('.px-win .px-tabs'), 'shelf boxes and bands are wood');
  assert.ok(!PRESS_ROOTS.some((s) => /doorbtn/.test(s)), 'the front door\'s doors are written on the book, not stamped as presses');
  assert.ok(EXIT_WORDS.test(' Close ') && EXIT_WORDS.test('Exit') && !EXIT_WORDS.test('Close account'));
});

test('GRIM1: THE VITALS stay true to the pack - its three vials (MAIN03I0-05I0: fatigue green, health red, magicka blue), upright in the corner by default in Daggerfall\'s own order, health, fatigue, magicka (mutants: a vial swapped; the order lost)', () => {
  assert.deepEqual([GRIMOIRE_CROPS.vialFatigue.img, GRIMOIRE_CROPS.vialHealth.img, GRIMOIRE_CROPS.vialMagicka.img], ['MAIN03I0', 'MAIN04I0', 'MAIN05I0']);
  const kit = kitCss() + rosterCss();
  assert.match(kit, /\[data-grim-vitals="upright"\] \.hud-health \{ order: 1; \}/);
  assert.match(kit, /\[data-grim-vitals="upright"\] \.hud-fatigue \{ order: 2; \}/);
  assert.match(kit, /\[data-grim-vitals="upright"\] \.hud-magicka \{ order: 3; \}/);
  assert.match(kit, /\.hud-magicka \.hud-fill \{ background: var\(--grim-vialCork,[^}]*var\(--grim-vialMagickaTube,/);
  assert.match(kit, /\.hud-vital::before, [^{]*\.hud-vital::after \{ display: none; \}/, 'no brass clasps');
});

test('GRIM1: every crop is cut from a picture the pack shipped, inside that picture - the sizes read off the PNGs themselves - and the front door\'s book and the books\' spine sit where the desk picture paints them (mutants: a box past its picture; a size misread)', () => {
  const listed = new Set(manifest.Files.map((f) => f.replace(/^StreamingAssets\/Textures\//, '')));
  const pngSize = (buf) => [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  for (const [img, size] of Object.entries(GRIMOIRE_SIZES)) {
    assert.ok(listed.has(`Img/${img}.IMG.png`), `${img} ships in the pack`);
    assert.deepEqual(pngSize(rd(`public/art/grimoire-ui/Img/${img}.IMG.png`)), size, img);
  }
  for (const [name, c] of Object.entries(GRIMOIRE_CROPS)) {
    const [w, h] = GRIMOIRE_SIZES[c.img];
    const [x, y, bw, bh] = c.box;
    assert.ok(x >= 0 && y >= 0 && x + bw <= w && y + bh <= h && bw > 0 && bh > 0, `${name}: [${c.box}] inside ${c.img} ${w}x${h}`);
  }
  assert.ok(TEAR_LUMA.lo < TEAR_LUMA.hi && FRAME_ART.band > FRAME_ART.margin);
  assert.ok(DESK_BOOK.x + DESK_BOOK.w <= 1 && DESK_BOOK.y + DESK_BOOK.h <= 1);
  assert.ok(Math.abs(BOOK_SPINE - 0.5) < 0.02, 'the painted book opens near its middle');
});

test('GRIM3: ONE PIXEL GRID - a window\'s art at one fixed scale on every screen (whole device pixels), a full screen\'s at the screen read as 480 x 300 of the game\'s pixels (2..8), the desk at the biggest whole scale it fits; the spellbook can be GrimoireUI\'s own; the compass is the pack\'s own strip under its dome (mutants: a part-pixel scale; the cover rounded down; the spellbook choice lost)', () => {
  assert.deepEqual(grimoireGrid(1440, 900), { gp: 3, gq: 2, gk: 1, gs: 3, cover: 5, fit: 4 });
  assert.deepEqual(grimoireGrid(2560, 1440), { gp: 3, gq: 2, gk: 1, gs: 5, cover: 8, fit: 7 }, 'a window is drawn at the same scale on every screen; only a full screen grows');
  assert.deepEqual(grimoireGrid(3840, 2160, 2), { gp: 6, gq: 4, gk: 2, gs: 7, cover: 12, fit: 10 }, 'in whole device pixels');
  assert.equal(grimoireGrid(320, 200).gs, 2, 'never under 2');
  for (const [w, h] of [[1366, 768], [2560, 1440], [1280, 720]]) {
    const g = grimoireGrid(w, h);
    assert.ok(Number.isInteger(g.gs) && Number.isInteger(g.cover) && g.cover * 320 >= w && g.cover * 200 >= h && g.fit * 320 <= w && g.fit * 200 <= h, `${w}x${h}`);
  }
  assert.deepEqual(Object.keys(GRIMOIRE_SPELLBOOKS), ['book', 'pack']);
  assert.equal(grimoireSpellbook(), 'book');
  setPref('grimoireSpellbook', 'scroll');
  assert.equal(grimoireSpellbook(), 'book', 'a bad value reads as the default');
  setPref('grimoireSpellbook', 'pack');
  assert.equal(grimoireSpellbook(), 'pack');
  const css = kitCss() + rosterCss();
  assert.match(css, /\[data-grim-spellbook="pack"\] \.sb-shell > \.px-win \{[^}]*--grim-spbk/);
  assert.match(css, /\.hud-compass::after \{[^}]*COMPBOX[^}]*scaleY\(-1\)/);
  assert.match(css, /\.hud-vital \.hud-ghost, [^{]*\{[^}]*filter: brightness\(0\.5\)/, 'what a bar lost drains away as its own liquid, darkened');
  assert.doesNotMatch(css, /grim-spark|grim-fuse/, 'no fuse, no spark');
  assert.match(css, /\[data-grim-unroll="open"\] \{ animation: grim-unroll/);
  assert.match(css, /\[data-grim-unroll="closing"\] \{ animation: grim-unroll [^}]*reverse/, 'and rolls shut as it closes');
  for (const sel of ['.rest-win', '.dlg-win', '.port-win.size-narrow', '.sb-ask > .card']) assert.ok(UNROLL_SEL.includes(sel), `${sel} is a scroll that opens and shuts`);
  // the book's noises (a player: "I REQUIRE the little book noises to stay INTACT" - the spellbook's): a book opened
  // opens, the same book re-drawn is not opened again, a book drawn long after the last was taken away is opened again
  const was = { kind: 'k', tab: 'Stats', row: 'Character', goneAt: 1000 };
  assert.equal(bookSound(null, { kind: 'k', tab: 'Stats', row: 'Character' }, 1000), 'open');
  assert.equal(bookSound(was, { kind: 'k', tab: 'Family', row: 'Tree' }, 1010), 'turn');
  assert.equal(bookSound(was, { kind: 'k', tab: 'Stats', row: 'Skills' }, 1010), 'turn');
  assert.equal(bookSound(was, { kind: 'k', tab: 'Stats', row: 'Character' }, 1010), null);
  assert.equal(bookSound(was, { kind: 'k', tab: 'Stats', row: 'Character' }, 1000 + BOOK_BEAT_MS + 1), 'open');
  assert.equal(bookSound(was, { kind: 'other', tab: 'Stats', row: 'Character' }, 1010), 'open', 'another book is opened, not turned');
});

test('GRIM4: THE DIAL\'S SYMBOLS are the pack\'s own paintings, each cut inside the picture it comes from - the helm off the map, the spellbook off the spellmaker\'s desk on the game\'s own grid (every pixel wholly in or out, drawn one CSS pixel to each), the map whole, the chest off the Save Game plate pulled in off its plate and lifted in sharpened doublings - and a door is its symbol by its own word (mutants: an outline past its picture; the book resampled; a door left a word)', () => {
  assert.deepEqual(Object.keys(DIAL_ICONS), ['skills', 'magic', 'map', 'items']);
  for (const [name, c] of Object.entries(DIAL_ICONS)) {
    if (c.file) continue;   // GRIM6: the chest ships as its own picture (below)
    const [w, h] = GRIMOIRE_SIZES[c.img];
    const [x, y, bw, bh] = dialIconBox(name);
    assert.ok(x >= 0 && y >= 0 && x + bw <= w && y + bh <= h && bw > 0 && bh > 0, `${name}: [${x},${y},${bw},${bh}] inside ${c.img} ${w}x${h}`);
    for (const [px, py] of c.poly ?? []) assert.ok(px >= x && px <= x + bw && py >= y && py <= y + bh, `${name}: an outline point inside its box`);
    assert.equal(dialArtName(name), `dial${name[0].toUpperCase()}${name.slice(1)}`);
  }
  assert.equal(DIAL_ICONS.map.poly, null, 'the map is the whole painting, its torn edge its own');
  // GRIM6: the chest is the pack's own, brought up x4 ahead of time and shipped (public/art/grimoire-dial-chest.png), its
  // size read off the PNG itself - drawn DOWN to the dial's size, as the helm and the book are
  const png = rd('public/art/grimoire-dial-chest.png');
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [...DIAL_ICONS.items.size], 'the shipped chest is the size its record says');
  assert.ok(DIAL_ICONS.items.size[1] > DIAL_ICONS.items.h, 'drawn down, never up');
  // the book on its own grid: a row of spans for every one of its rows, each inside it and in order, the book whole
  const book = DIAL_ICONS.magic, [, , cw, ch] = book.cells, rows = dialRows('magic');
  assert.equal(rows.length, ch);
  assert.deepEqual(dialIconSize('magic'), [cw, ch], 'one CSS pixel to each of the game\'s - never resampled');
  assert.deepEqual(dialIconBox('magic'), book.cells.map((v) => v * NATIVE));
  let filled = 0;
  rows.forEach((spans, i) => {
    assert.ok(spans.length >= 1, `row ${i} holds the book`);
    let last = -1;
    for (const [a, b] of spans) { assert.ok(a > last && b > a && b <= cw, `row ${i}: [${a}, ${b}) in order, inside`); last = b; filled += b - a; }
  });
  assert.ok(filled > cw * ch * 0.6, 'the book fills most of its box');
  assert.equal(dialIconSize('skills')[1], DIAL_ICONS.skills.h);
  // a door is its symbol by its word, whatever direction a host hangs it on
  for (const [word, k] of [['Skills', 'skills'], ['◇◆Items', 'items'], ['Map', 'map'], ['Magic', 'magic']]) assert.equal(DIAL_WORD.exec(word)?.[1].toLowerCase(), k);
  assert.equal(DIAL_WORD.exec('Rest'), null);
  const css = kitCss();
  for (const k of Object.keys(DIAL_ICONS)) assert.match(css, new RegExp(`\\[data-grim-icon="${k}"\\] \\.px-c \\{[^}]*--grim-${dialArtName(k)}`), `${k} is drawn`);
  assert.match(css, /\[data-grim-icon="magic"\] \.px-c \{[^}]*image-rendering: pixelated/, 'the book\'s pixels stay square');
  assert.match(css, /\.px-arm\[data-grim-icon\] \{[^}]*font-size: 0 !important/, 'the word stays for a reader, unseen');
  assert.match(css, /\.px-arm\[data-grim-icon\] \.px-c \{ visibility: visible !important/, 'the symbol shows where Plus\'s diamond was hidden');
});

test('GRIM4: THE BARS - the foe\'s and the boss\'s are the player\'s own whole vial (never a run of tube); the sheet\'s and the Ascend\'s Health, Fatigue and Magicka are the HUD\'s vials at the HUD\'s size; an attribute\'s bar is a skill\'s bar; a page leaves room for a bar\'s outline at its left; a long skill list is spread down its page (mutants: the foe a repeated tube; an attribute a vial; the page padding lost)', () => {
  const css = kitCss() + rosterCss();
  assert.match(css, /\.hud-foe \.hud-foetrack \{ width: calc\(86 \* var\(--gq[^}]*--grim-vialHealthEmpty/);
  assert.match(css, /\.hud-foe \.hud-foetrack \.hud-fill \{ background: var\(--grim-vialHealth,[^}]*86 \* var\(--gq/);
  assert.match(css, /\.wb-boss-track \{[^}]*--grim-vialHealthEmpty/);
  assert.match(css, /\.wb-boss-fill \{ background: var\(--grim-vialHealth,/);
  assert.match(css, /\.wb-boss-track::before, [^{]*\{ display: none !important; \}/, 'Plus\'s brass end caps go');
  assert.match(css, /\.px-mrow\[data-grim-meter="vital"\] \.px-fill\.blood \{ background: var\(--grim-vialHealthHead,/);
  assert.match(css, /\.px-mrow\[data-grim-meter="vital"\] \.px-fill\.verdigris \{ background: var\(--grim-vialMagickaHead,/);
  assert.match(css, /\.px-mrow\[data-grim-meter="attr"\] \.px-meter \{ height: calc\(3 \* var\(--gq/, 'an attribute: the skill bar\'s thin groove');
  // PAGE-CENTRE (2026-10-12): the right-hand page's outer side takes the gutter's extra width, so its writing stands centred
  assert.match(css, /\.px-journal > \.px-qdetail \{[^}]*padding: calc\(2 \* var\(--gp, 3px\)\) calc\(calc\(2 \* var\(--gp, 3px\)\) \+ calc\(18 \* var\(--gp, 3px\)\)\) calc\(1 \* var\(--gp, 3px\)\) calc\(2 \* var\(--gp, 3px\)\)/);
  assert.match(css, /\.lv-ribbon:has\(\.lv-sk:nth-child\(15\)\) \{ grid-template-columns: 1fr; grid-auto-rows: minmax\(min-content, 1fr\); align-content: stretch; \}/);
  for (const w of ['Strength', 'intelligence', 'Luck']) assert.ok(ATTRIBUTE_WORD.test(w), w);
  for (const w of ['Health', 'Fatigue', 'Magicka']) { assert.ok(VITAL_WORD.test(w), w); assert.ok(!ATTRIBUTE_WORD.test(w), w); }
  assert.ok(!ATTRIBUTE_WORD.test('Strength of arms') && !VITAL_WORD.test('Health potion'), 'the whole word, never a part of one');
});

test('GRIM4: READABLE - the compass is the pack\'s own strip and dome at the pack\'s resolution, drawn smooth (never the game-grid cut stretched by two and a half); the revenant\'s card is written flat in ink; the overworld\'s counts are ink at the face\'s size; the pace steps are drawn bars, the same breath either side of the number (mutants: the compass pixelated; the shadow kept under the card\'s words; a step lettered)', () => {
  const css = kitCss();
  assert.match(css, /\.hud-compass \.hud-strip \{[^}]*image-rendering: auto;[^}]*COMPASS\.IMG\.png/);
  assert.doesNotMatch(css, /\.hud-strip \{[^}]*--grim-compass,/, 'not the cut on the game\'s grid');
  assert.match(css, /\.rvncard, [^{]*\.rvncard :not\(\.rvncard-rank, \.rvncard-mood\) \{ text-shadow: none !important; \}/);
  assert.match(css, /\.rvncard \.rvncard-name \{ color: #2b1a0c !important;/);
  assert.match(css, /\.tview-filter \.tview-fnum \{ font-size: 16px !important;[^}]*color: #5b3b1f !important/);
  assert.match(css, /:is\(\.tview-pace-step, \.travelpanel-pace-step, \.pbox-pace-step\) \{[^}]*font-size: 0 !important/);
  assert.match(css, /:is\(\.tview-pace-row, \.travelpanel-pace-row, \.pbox-pace-row\) \{ grid-template-columns: 1fr 24px 66px 24px; column-gap: 6px; \}/);
});

test('GRIM5: THE LAST PIXELS - the sheet\'s vitals are the HUD\'s vial drawn to the row\'s length (its own head, its body\'s own course from shoulder to foot, its own foot at the glass\'s end however little the liquid fills); the how-many question on one line; the purse on the plank\'s middle line and the carry\'s bar a bar; the Ascend\'s ledger without rules, its points in the figures\' column a line under them, the figure in its box\'s middle (mutants: the foot laid at the liquid\'s end; "of N" lifted; the purse on the press\'s baseline; the rules back; the points centred under the page)', () => {
  const css = kitCss() + rosterCss();
  assert.ok(VIAL_CUT.tubeFrom < VIAL_CUT.footFrom && VIAL_CUT.footFrom < 86 && VIAL_CUT.bodyLen > 86, 'a head, a foot inside the vial, and a body longer than it');
  assert.match(css, /\.px-mrow\[data-grim-meter="vital"\] \.px-meter \{ width: 100% !important; container-type: inline-size;/);
  assert.match(css, /\.px-mrow\[data-grim-meter="vital"\] \.px-fill \{ position: relative; background: var\(--grim-vialFatigueHead,[^}]*--grim-vialFatigueFoot, none\) calc\(100cqw - calc\(10 \* var\(--gq[^}]*--grim-vialFatigueBody, none\)/, 'the liquid\'s foot at the glass\'s end');
  assert.match(css, /\.px-meter \{ width: 100% !important;[^}]*--grim-vialFatigueFootEmpty, none\) 100% 0/, 'the empty glass\'s foot at its own end');
  assert.match(css, /\.qtyfield > span \{ margin: 0 !important; padding: 0 !important; line-height: 20px; align-self: center; \}/);
  assert.match(css, /\.pack-shell \.packgold \{ align-items: center; \}/);
  assert.match(css, /\.pack-shell \.packcarry \.px-meter \{ flex: 0 0 auto; width: calc\(60 \* var\(--gq/);
  assert.doesNotMatch(css, /\.lv-star \{[^}]*border-bottom: 1px dotted/, 'no rule under an attribute');
  assert.match(css, /\.lv-plate \{ grid-column: 2; grid-row: 4; justify-self: stretch;[^}]*grid-template-columns: minmax\(0, 1fr\) auto 2\.2em;/, 'the points on the ledger\'s own columns');
  assert.match(css, /\.lv-plate > \.lv-count \{ grid-column: 2; grid-row: 1;/, 'the box in the figures\' column');
  assert.match(css, /\.lv-count \{ font-size: 32px !important; line-height: 32px; padding: 7px 10px 3px 12px;/);
});

test('GRIM6: the front door\'s desk is the pack\'s painting at its own resolution, drawn smooth; the settings never jump (Plus\'s ground out of the page); the held map\'s Find me gone; a slot\'s word inside its shelf box; the chat\'s words in ink on its page and outlined over the world; the points the ledger\'s own size in the figures\' column (mutants: the desk the grid cut again; the ground kept; a slot\'s word on the frame; the typed word white; the points at 48)', () => {
  const css = kitCss() + rosterCss();
  assert.match(css, /\.px-home:not\(\.px-over\):not\(\.lv-sky\)::before \{[^}]*BIOG00I0\.IMG\.png"\) var\(--gbx\) var\(--gby\) \/ var\(--gbw\) var\(--gbh\) no-repeat; image-rendering: auto; \}/);
  assert.match(css, /\.px-ground \{ display: none !important; \}/);
  assert.match(css, /\.hmroot\[data-hm-sheet="automap"\] \.hmfindme \{ display: none !important; \}/, 'Find me goes on the dungeon\'s sheet alone (FINDME-SHEET)');
  assert.doesNotMatch(css, /[^\]] \.hmfindme \{ display: none/, 'never off the world map\'s and the town\'s');
  assert.match(readFileSync(new URL('../../src/ui/heldMap.js', import.meta.url), 'utf8'), /root\.dataset\.hmSheet = this\._slot\?\.live \?\? '';/, 'the map\'s root says which sheet is up');
  assert.match(css, /\.pack-shell \.equipped \.wornrow \{ padding: calc\(5 \* var\(--gq[^}]*overflow: hidden; \}/);
  assert.match(css, /body \.dfchat-input \{ color: #2b1a0c !important; -webkit-text-fill-color: #2b1a0c !important;/);
  // NAME-INK (2026-10-11, Mac: "the color was the problem not the font"): a name in a colour of its own on the page, never the words' ink
  assert.match(css, /\.dfchat-box :is\(\.dfchat-name, \.dfchat-who-name\) \{ color: #7a170c !important; filter: none !important; \}/);
  assert.match(css, /\.dfchat-peek, [^{]*\.dfchat-peek \* \{\n  text-shadow: -1px 0 0 #120804/);
  assert.match(css, /\.lv-count \{ font-size: 32px !important; line-height: 32px;/);
  assert.match(css, /\.lv-plate > \.lv-count \{ grid-column: 2; grid-row: 1; justify-self: end; margin-right: -12px !important; \}/);
});

test('TURN1 + FLIP-FIT: the compass turns over in the HUD editor (Alt+U) - the press shows only under the dress, turned the box stands the way the pack painted it and the strip\'s letters rise to the needle, the turn kept in the layout; the pack card\'s Stats side held to the card\'s width (mutants: the press hidden under the dress; the box left hanging when turned; the turn not saved; the back free to grow)', async () => {
  const css = kitCss() + rosterCss();
  const hl = await import('../../src/ui/hud/hudLayout.js');
  const src = readFileSync(new URL('../../src/ui/hud/hudLayout.js', import.meta.url), 'utf8');
  assert.equal(hl.HUD_PIECES.find((p) => p.id === 'compass')?.turn, true, 'the compass is a piece that turns');
  assert.match(hl.HUD_LAYOUT_CSS, /i\[data-hm-handle="turn"\] \{ display: none;/, 'no press where a dress draws no top and bottom');
  assert.match(css, /#hud-layout-handles i\[data-hm-handle="turn"\] \{ display: block; \}/, 'the press under the dress');
  assert.match(css, /\.hud-compass\[data-hm-turn\]::after \{ transform: none; \}/, 'turned: the box as painted');
  assert.match(css, /\.hud-compass\[data-hm-turn\] \.hud-strip \{ top: var\(--gcm\); bottom: calc\(2 \* var\(--gcm\)\);\s+background-position-y: calc\(0\.5 \* var\(--gcm\)\); \}/, 'the letters mirrored to the needle');
  assert.match(src, /if \(o\?\.t\) v\.t = true;/, 'the turn kept');
  assert.match(src, /if \(mode === 'turn'\) \{ const nx = \{ \.\.\.o, t: !o\.t \};/, 'the press turns it');
  assert.match(css, /\.pack-shell \.statflip-inner \{ grid-template-columns: minmax\(0, 1fr\) !important;/, 'one track, never past the card');
  assert.match(css, /\.pack-shell \.statflip-back \{ overflow: hidden !important; \}/);
});

// INK-TONES (2026-10-10, a player: "make the fonts better visible ... the blue and Mora's Mantle ones ... don't make them
// totally different") and PACK-ROOM (the same day: the worn map's flanks broke a pair's names a letter at a time).
test('INK-TONES: a rarity\'s, a set\'s and the sigil\'s words are their own colour deepened into the ink on the page - the tier\'s tone as the loot plaque writes it, a set\'s and the sigil\'s own colour mixed down with the ink (each set keeps its hue), a tier not yet awake in ink, never faded; every set colour then reads at 4.5:1 or better on the cream page. PACK-ROOM: the goods give 40px back and the figure stands at most 210px wide (mutants: a rarity left pale; the set\'s ink not mixed from its own colour; the faded tier back; the old columns)', async () => {
  const { RARITY_INK, SET_INK, SIGIL_INK, grimoireKitCss } = await import('../../src/ui/grimoireDress.js');
  const css = kitCss();
  assert.deepEqual(Object.keys(RARITY_INK), ['magic', 'rare', 'legendary', 'aetheric', 'artifact', 'gilded']);
  for (const [k, c] of Object.entries(RARITY_INK)) assert.ok(css.includes(`.card[data-rarity="${k}"] > ul.rarity > li:first-child, `) && css.includes(`{ color: ${c} !important; text-shadow: none !important; }`), k);
  assert.match(SET_INK, /^color-mix\(in srgb, var\(--set, #[0-9a-f]{6}\) 40%, #120a04\)$/, 'mixed from the set\'s OWN colour');
  assert.match(SIGIL_INK, /^color-mix\(in srgb, var\(--sigil, #[0-9a-f]{6}\) 35%, #120a04\)$/);
  assert.ok(css.includes(`:is(.setline-name, .setline-count, .set-name, .set-count, .set-tier.awake .set-tier-name) { color: ${SET_INK} !important;`));
  assert.ok(css.includes(`:is(.sigil-word, .sigil-stage, .sigil-progress, p.sigil-progress) { color: ${SIGIL_INK} !important;`));
  assert.match(css, /\.set-tier:not\(\.awake\) \{ opacity: 1 !important; \}/);
  // the mix the browser makes, by hand: every set's colour at 40% into the ink, against the cream page
  const sets = [...readFileSync(new URL('../../src/systems/sigil/sigilSets.js', import.meta.url), 'utf8').matchAll(/colour: '(#[0-9a-fA-F]{6})'/g)].map((m) => m[1]);
  assert.ok(sets.length >= 5, 'the sets\' colours were read');
  const ch = (h, i) => parseInt(h.slice(i, i + 2), 16);
  const lum = (rgb) => rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const page = lum([0xe3, 0xc9, 0x95]);
  const inked = (hex, t) => [1, 3, 5].map((i, j) => ch(hex, i) * t + [0x12, 0x0a, 0x04][j] * (1 - t));
  for (const c of sets) assert.ok((page + 0.05) / (lum(inked(c, 0.4)) + 0.05) >= 4.5, `${c} reads on the page`);
  assert.ok((page + 0.05) / (lum(inked('#72f0d8', 0.35)) + 0.05) >= 4.5, 'the sigil\'s teal reads on the page');
  const all = grimoireKitCss();
  assert.match(all, /grid-template-columns: 132px minmax\(0, 1fr\) minmax\(230px, 290px\);/);
  assert.match(all, /\.pack-shell \.wornmap-doll\.hasart \{ max-width: 210px; \}/);
});

// DESK-FILL (2026-10-10, Mac, of the front door as an earlier build drew it: "it looks way better use this one").
test('DESK-FILL: the front door\'s desk is the WHOLE desk as big as the screen holds it - the exact fit, never rounded down to a whole number (mutants: the floored scale back; the cover scale, cropping the candle or the quill)', async () => {
  const { deskScale } = await import('../../src/ui/grimoireArt.js');
  assert.ok(Math.abs(deskScale(1985, 947) - 947 / 200) < 1e-9, 'a wide screen: the desk fills its height');
  assert.ok(Math.abs(deskScale(1280, 1024) - 4) < 1e-9, 'a tall one: its width');
  for (const [w, h] of [[1985, 947], [1366, 768], [2560, 1440], [1280, 1024], [3440, 1440]]) {
    const s = deskScale(w, h);
    assert.ok(320 * s <= w + 1e-9 && 200 * s <= h + 1e-9, `${w}x${h}: the whole desk is on the screen`);
    assert.ok(Math.abs(320 * s - w) < 1e-6 || Math.abs(200 * s - h) < 1e-6, `${w}x${h}: and it touches two edges`);
  }
  assert.equal(deskScale(200, 100), 1, 'never under one CSS pixel to each of its own');
  const src = readFileSync(new URL('../../src/ui/grimoireArt.js', import.meta.url), 'utf8');
  assert.match(src, /setProperty\('--gd', `\$\{deskScale\(win\.innerWidth, win\.innerHeight\)\}px`\)/, 'the root wears it');
});

// DESK-HD (2026-10-10, Mac: "the background is still blurry as hell ... use this one").
test('DESK-HD: the front door stands on the detailed desk (public/art/grimoire-desk.jpg), as big as the screen holds it, no second vignette laid over its own dark edges, the pack\'s BIOG00I0 under it only as the fallback (mutants: the blocky pack desk back on top; the file missing; the vignette doubled)', async () => {
  const { GRIMOIRE_DESK_FILE, grimoireDeskUrl } = await import('../../src/ui/grimoireArt.js');
  const { grimoireKitCss } = await import('../../src/ui/grimoireDress.js');
  const buf = readFileSync(new URL(`../../public/art/${GRIMOIRE_DESK_FILE}`, import.meta.url));
  assert.equal(buf[0], 0xff, 'a JPEG'); assert.equal(buf[1], 0xd8);
  assert.ok(buf.length > 100_000, 'the detailed painting, not a stand-in');
  const css = grimoireKitCss();
  const at = css.indexOf('.px-home:not(.px-over):not(.lv-sky)::before { content: \'\'; position: absolute; inset: 0; pointer-events: none;');
  assert.ok(at > 0);
  const rule = css.slice(at, css.indexOf('}', at));
  assert.ok(rule.includes(`url("${grimoireDeskUrl()}") var(--gbx) var(--gby) / var(--gbw) var(--gbh) no-repeat,`), 'the painting first');
  assert.ok(rule.indexOf(grimoireDeskUrl()) < rule.indexOf('BIOG00I0'), 'the pack\'s desk only under it');
  assert.ok(!/radial-gradient|linear-gradient/.test(rule), 'its own dark edges, never a second vignette');
});

// WOOD-HD (2026-10-10, Mac: "can every board wood background in DFO Grimoire UI in ALL windows and frames look like this
// that has that blurred wood?").
test('WOOD-HD: every board of the dress - a window\'s body and bars, a pane, a chip, a tab plate, a plank and the frame\'s rim - is the one `wood` tile, now the soft desk wood (public/art/grimoire-wood.jpg) at 100 x 189 of the game\'s pixels, built at the screen\'s own device pixels so it is laid one to one (mutants: the pack\'s pixel planks back; the tile at its old size; the frame keeping the old wood)', async () => {
  const { GRIMOIRE_WOOD_FILE, WOOD_TILE, nativeSize } = await import('../../src/ui/grimoireArt.js');
  const buf = readFileSync(new URL(`../../public/art/${GRIMOIRE_WOOD_FILE}`, import.meta.url));
  assert.equal(buf[0], 0xff); assert.equal(buf[1], 0xd8);
  assert.deepEqual(WOOD_TILE, [100, 189]);
  assert.deepEqual(nativeSize('wood'), [100, 189], 'the boards lay the tile at its own size');
  const css = kitCss();
  assert.ok(css.includes(`var(--grim-wood, none) 0 0 / calc(100 * var(--gp, 3px)) auto repeat`), 'every board through the one tile');
  const src = readFileSync(new URL('../../src/ui/grimoireArt.js', import.meta.url), 'utf8');
  assert.match(src, /out\.wood = resample\(doc, cut\(doc, woodPic, \[0, 0, woodPic\.width, woodPic\.height\]\), WOOD_TILE\[0\] \* gpx, WOOD_TILE\[1\] \* gpx\);/, 'at the device pixels it is drawn at');
  assert.match(src, /const gpx = Math\.max\(2, Math\.round\(3 \* \(doc\.defaultView\?\.devicePixelRatio \|\| 1\)\)\);/, 'the grid\'s own --gp');
  assert.match(src, /out\.frame = frame\(doc, frameWood, out\.tear\);/, 'the frame\'s rim too');
});

test('INK-VARS / INK-FIELDS (2026-10-11, the Social panel on the page: "those fonts need to be made readable"): a var WITH A FALLBACK is read as its colour - the fallback alone was re-said, so --dim and --bone still drew grey and bone on the parchment; a sheet\'s own var is read as the one colour the sheets give it, a per-kind var never; every field types in ink, focused too; a name\'s own colour, a dead press and its reason are deepened to read on the scroll (mutants: the fallback re-said in place; a two-coloured var pinned; the field left to the wood)', () => {
  assert.equal(sayRule('color: var(--dim, #9a9486)').ink, 'color: hsl(26 60% 17%)', 'var(--dim, …) is --dim\'s colour, inked - never var(--dim, <ink>)');
  assert.equal(sayRule('color: var(--bone, #e9e4d9)').ink, 'color: hsl(26 60% 9%)');
  assert.equal(varsOut('var(--nope, rgba(1, 2, 3, 0.5))'), 'var(--nope, rgba(1, 2, 3, 0.5))', 'an unknown var keeps its place and its fallback');
  learnSheetVars('.w { --inkvars-one: #b9ab93; } .k1 { --inkvars-two: #6f9ee8; } .k2 { --inkvars-two: #e4c34f; } :root[data-plus-theme="stone"] .w { --inkvars-one: #ffffff; }');
  assert.equal(varsOut('var(--inkvars-one)'), '#b9ab93', 'a sheet\'s own var is its one colour (a Plus colour\'s re-definition is not read)');
  assert.equal(varsOut('var(--inkvars-two, #fff)'), 'var(--inkvars-two, #fff)', 'a var with a colour per kind is the element\'s own - never pinned');
  assert.ok(!/var\(--dim/.test(inkCss('.dfsocial-sub { color: var(--dim, #9a9486); }')), 'the Social panel\'s grey is ink on the page');
  const kit = kitCss();
  assert.match(kit, /body \.dfsocial-field:focus[^{]*\{ color: #2b1a0c !important; -webkit-text-fill-color: #2b1a0c !important;/, 'a field is ink, focused too');
  assert.match(kit, /\.hmsearch input:focus/, 'the map\'s Find a place among them (its yellow on focus)');
  assert.match(kit, /\.dfsocial :is\(\.dfsocial-name, \.dfsocial-subject\)\[style\*="color"\] \{ filter: brightness\(0\.3\)/);
  assert.match(kit, /\[data-grim-on="page"\]:is\(:disabled, \[disabled\]\) \{ opacity: 1 !important; color: #5b3b1f !important;/);
  assert.match(kit, /\[data-grim-on="page"\] \[class\$="-why"\] \{ color: #5b3b1f !important;/);
  assert.match(kit, /\[data-rarity="aetheric"\] \.broker-name/, 'the Broker\'s names in their tier\'s ink');
});

test('FOE-PLATE / VIAL-LONG (2026-10-11: the foe\'s and the boss\'s bars, the loss animation, Alt+U\'s sizes and lengths): no drain on any bar; the foe\'s and the boss\'s glass drawn out at any length with nothing behind it and no thicker; the upright vials lengthen as height; the editor\'s length handle measured, never assumed, and a size kept on the screen; the boss bar has a length (mutants: the ghost drawn; the plank laid; the vial stretched; the length forced across a stood bar)', async () => {
  const css = rosterCss();
  assert.match(css, /:is\(\.hud-vital, \.hud-foe, \.hud-breath\) \.hud-ghost, [^{]*\.hud-chunk, [^{]*\.wb-boss-ghost \{ display: none !important; \}/, 'what a blow takes is gone at once');
  assert.match(css, /\{ --grim-foe-h: clamp\(13px, 1\.75vh, 48px\); --grim-boss-h: clamp\(18px, 2\.45vh, 64px\);/, 'BAR-SCREEN: the two bars are the screen\'s size, not a pixel count');
  assert.match(css, /\.hud \.hud-foe \.hud-foetrack \{ width: var\(--grim-foe-w\); height: var\(--grim-foe-h\);/);
  assert.match(css, /\.hud \.hud-foe\[data-hm-len\] \.hud-foetrack \{ width: calc\(var\(--grim-foe-w\) \* var\(--hml, 1\)\) !important; \}/, 'the editor\'s length from the same base');
  assert.match(css, /\.hud-foe \.hud-foetrack \{[^}]*calc\(28 \* var\(--gfoe/, 'the vial drawn at the bar\'s own measure');
  assert.match(css, /body:has\(> \.wb-boss-bar:not\(\[data-hm-ghost\]\):is\(:not\(\[style\*="display: none"\]\), \[data-hm-dummy\]\)\)/, 'the editor\'s stand-in for a boss never pushes the foe\'s preview down');
  assert.match(css, /\.hud-foe\[data-hm-dummy\]:not\(\.on\) \.hud-foename \{ overflow: visible; min-height: 20px;/, 'the preview\'s label is not clipped away');
  assert.match(css, /\.hud \.hud-foe \.hud-foetrack \{[^}]*var\(--grim-vialHealthHeadEmpty/, 'the glass drawn out: its own head...');
  assert.match(css, /\.hud \.hud-foe \.hud-foetrack \.hud-fill \{[^}]*calc\(100cqw - /, '...and its foot at the track\'s end, whatever the length');
  assert.doesNotMatch(css.slice(css.indexOf('FOE-PLATE')), /\.hud-foe \{[^}]*background|\.wb-boss-bar \{[^}]*background/, 'nothing behind either bar');
  assert.match(css, /\.wb-boss-track \{[^}]*height: var\(--grim-boss-h\);/, 'the boss\'s glass the screen\'s measure too');
  assert.match(css, /\.wb-boss-bar\[data-hm-len\] \{ width: calc\(var\(--grim-boss-w\) \* var\(--hml, 1\)\) !important; \}/);
  assert.match(css, /data-grim-vitals="upright"\] \.hud \.hud-bars, [^{]*\{ --hm-len-axis: y; \}/, 'the stood vials\' length runs up');
  assert.match(css, /\.hud-health\[data-hm-len\] \.hud-fill \{ background: var\(--grim-vialHealthUpFoot/, 'and a taller vial is drawn out from its foot');
  const { HUD_LAYOUT_CSS, HUD_PIECES } = await import('../../src/ui/hud/hudLayout.js');
  assert.equal(HUD_PIECES.find((p) => p.id === 'boss').len, true, 'the boss bar has a length');
  assert.match(HUD_LAYOUT_CSS, /\.wb-boss-bar\[data-hm-len\] \{ width: calc\(460px \* var\(--hml, 1\)\)/);
  assert.match(HUD_LAYOUT_CSS, /i\[data-hm-handle="len"\]\[data-axis="y"\]/, 'the handle on the top edge of a stood bar');
  const src = readFileSync(new URL('../../src/ui/hud/hudLayout.js', import.meta.url), 'utf8');
  assert.match(src, /per = \(axis === 'y' \? a\.top - b\.top : b\.right - a\.right\)/, 'the handle\'s travel per length is measured');
  assert.match(src, /else want = keepOnScreen\(want\);/, 'a size or a length never carries a piece off the screen');
  const art = readFileSync(new URL('../../src/ui/grimoireArt.js', import.meta.url), 'utf8');
  assert.match(art, /\[`\$\{name\}UpHead`\]: v\.upHead/, 'the upright vial\'s own pieces are cut');
});

test('GRIM-FIELD (2026-10-11, the DFO Grimoire bug thread): the Controls head sticks as ONE line over the book\'s short scroll; a chosen chip says so over its shelf-box picture; a setting\'s words are a scroll BESIDE the book in game (out of the page column\'s clip, slid in only as far as the screen asks) and the held-out scroll in the front door\'s column; Find me off the dungeon\'s sheet alone (mutants: the head\'s sentence kept, the inset shadow trusted, the sheet left in the column)', () => {
  const css = rosterCss();
  assert.match(css, /\.ctl-head:not\(\.ctl-asking\) > p\.meta \{ display: none !important; \}/, 'the head\'s sentence is the intro\'s own law - said there');
  assert.match(readFileSync(new URL('../../src/ui/enhanced/enhancedControls.js', import.meta.url), 'utf8'), /ctl-intro-law/, '...and the intro still says it');
  assert.match(css, /@media \(any-pointer: fine\) \{\n\s+:root\[data-plus-dress="grimoire"\] \.px-journal \.ctl-row \{ padding-top: 3px !important;/, 'a key\'s row a line where there is no thumb');
  assert.match(css, /\[aria-pressed="true"\][^{]*\{ color: #fff27a !important; outline: 2px solid #d8b04a !important; outline-offset: -3px;/, 'the chosen chip\'s mark stands OVER the picture');
  assert.match(css, /\.px-setwrap \.panes \{ position: static !important; \}/, 'the page column is no longer the sheet\'s anchor');
  assert.match(css, /\.px-setwrap \.detail\.open \{ display: flex;[^}]*left: min\(calc\(100% \+ calc\(13 \* var\(--gp, 3px\)\) \+ 12px\), calc\(\(100% \+ 100vw\) \/ 2 - var\(--grim-sw\)/, 'beside the book, or slid in to stay whole');
  assert.match(css, /\.px-setwrap \.detail\.open \{[^}]*border-image: var\(--grim-sideScroll, none\)/, 'the picker\'s scroll, as the item scrolls are');
  assert.match(css, /\.shell \.detail > :is\(\.dcard, \.card\) \{[^}]*border-image: var\(--grim-sideScroll, none\)/, 'the front door\'s column holds the same scroll');
  assert.ok(UNROLL_SEL.includes('.px-setwrap .detail.open'), 'it unrolls and rolls shut');
});

test('PAGE-CENTRE + SCRY-FIT + NO-BAR (2026-10-12): the right-hand page centred; a Reforge row sizes its price and press to their words and reads at 4.5:1 on the page; no red bar down a chosen row', () => {
  const css = kitCss() + rosterCss();
  assert.match(css, /\.reforge-shell \.broker-offer \.broker-price \{ color: #2b1a0c !important;/, 'a price in ink');
  assert.match(css, /\.reforge-shell \.broker-offer\.scry-row \.broker-name \{ color: #7a170c !important;/, 'a family in the deep red');
  assert.match(css, /\.reforge-shell \.broker-buy\[data-grim-on="page"\]:is\(:disabled, \[disabled\]\) \{ color: #4f3218 !important; font-style: italic; \}/, 'a press that cannot, its reason in the soft ink, never faded');
  assert.doesNotMatch(css, /inset 3px 0 0 #8e1a10/, 'no red bar down a chosen row');
  assert.match(REFORGE_CSS, /\.reforge-shell \.broker-offer\.scry-row \{ grid-template-columns: minmax\(0, 1fr\) max-content minmax\(112px, max-content\); \}/);
  assert.match(REFORGE_CSS, /\.reforge-shell \.broker-offer\.scry-row > \.broker-offer-body \{ grid-column: 1; \}/);
});
