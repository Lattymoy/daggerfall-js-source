// AUDIT MERGE-PLUS, LENS D (2026-09-26, the pre-merge audit of the Enhanced Plus UI - PLUS-ONLY, RARITY-UI, SIGIL-UI
// and PLUS-DRESS - measured in Chromium: computed styles under forced states, contrast sampled off the pixels, the real
// Pixelify face at 320px). Eight findings, each fixed in the merge; a stylesheet cannot be driven in node, so each is
// pinned where the CASCADE decides it - which rule comes later, at what weight, with what in it - and where a colour
// is the finding, by the arithmetic of the contrast itself.
//
//   D1  the tier's frame (laid after the kit, and outranking it) hid every passing state on the same frame: the
//       reorder's insertion mark, the picked socket, the hotbar's strike, refusal and drop target, the refused drag.
//   D2  a worn pair's 28px border-box tile took the tier's 2px frame, and its 28px icon cap painted over two edges.
//   D3  on Stone, the lane's newer surfaces (in the window and panel roles now) are a light grey their dim words were
//       never chosen for - the F-menu's Cancel read at 2.3:1, a refused row's reason at 4.1:1.
//   D4  the warn role held its edge only in part: the pressable's sunk stone won on the duel's press at the same
//       weight, and a lane's native `background` shorthand wiped the lit band (Leave at rest, Challenge under the
//       pointer).
//   D5  the corner rune was a mask over the teal, and a masked glyph's drop shadow is clipped by its own mask: its
//       outline never drew.
//   D6  markItemFrame marks the loot window's, the shop's, the trade's rows and the drag ghost with the sigil, and
//       no rule drew the rune on any of them.
//   D7  "Enhanced Plus" took a 320px settings row and cut its label to "Interf".
//   D8  the Interface Style help still said "Enhanced is these screens" (the help went with its row when MENU-TOGGLE
//       retired the menu's skin toggle), and the UI panel's card lost the emblem colour its old id carried.
//
// tools/mutants/auditmergeplus_ui.json puts each back, and every one dies here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ITEM_FRAME_CSS, PLUS_CSS, ONLINE_DRESS_CSS, STONE_DIM, STONE_WORD, STONE_AMBER, STONE_RED } from '../src/ui/enhancedPlusStyle.js';
import { FRAME_CSS, FRAME_ROLES, PLUS_THEMES } from '../src/ui/enhancedFrame.js';
import { ENHANCED_CSS } from '../src/ui/enhancedStyle.js';
import { SIGIL_RUNE_TILE_URL } from '../src/ui/sigilRune.js';
import { SKIN_NAMES } from '../src/systems/uiSkin.js';
import { OVERHAUL_PANELS } from '../src/systems/overhauls.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
/** A sheet as rules, in order: each rule's selectors (trimmed) and its body. Comments out first; a rule inside an
 *  @media is read as a rule (its media is not what these pins are about). */
const rules = (css) => [...css.replace(/\/\*[^]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map((m, i) => ({ i, sels: m[1].split(',').map((s) => s.trim()), body: m[2] }));
/** The LAST rule naming `sel` whose body says `prop` (the one the cascade reads at that weight), or null. */
const ruleFor = (list, sel, prop) => list.filter((r) => r.sels.includes(sel) && new RegExp(`(?:^|[\\s;])${prop}:`).test(r.body)).at(-1) ?? null;
/** A selector's weight, [ids, classes/attributes/pseudo-classes, types/pseudo-elements] - enough of the law for the
 *  selectors these sheets write (`:not()` weighs its argument). */
function weight(sel) {
  let a = 0, b = 0, c = 0;
  let s = sel.replace(/:not\(([^()]*)\)/g, (_, inner) => { const [x, y, z] = weight(inner); a += x; b += y; c += z; return ' '; });
  s = s.replace(/::[\w-]+/g, () => { c++; return ' '; });
  s = s.replace(/#[\w-]+/g, () => { a++; return ' '; });
  s = s.replace(/\[[^\]]*\]/g, () => { b++; return ' '; });
  s = s.replace(/\.[\w-]+/g, () => { b++; return ' '; });
  s = s.replace(/:[\w-]+/g, () => { b++; return ' '; });
  for (const t of s.replace(/[>+~]/g, ' ').split(/\s+/)) if (/^[a-z][\w-]*$/i.test(t)) c++;
  return [a, b, c];
}
const atLeast = (x, y) => x[0] !== y[0] ? x[0] > y[0] : x[1] !== y[1] ? x[1] > y[1] : x[2] >= y[2];
/** `state` wins over `over` for `prop`: it comes later in the sheet and weighs at least as much. */
function outranks(list, state, over, prop) {
  const s = ruleFor(list, state, prop), o = ruleFor(list, over, prop);
  assert.ok(s, `${state} says ${prop}`);
  assert.ok(o, `${over} says ${prop}`);
  assert.ok(s.i > o.i, `${state} comes after ${over}`);
  assert.ok(atLeast(weight(state), weight(over)), `${state} (${weight(state)}) weighs at least ${over} (${weight(over)})`);
  return s.body;
}

// ── contrast (WCAG's own arithmetic, test/soc5_interact.test.js's C12 model) ──
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const mix = (a, b, alpha) => a.map((v, i) => alpha * v + (1 - alpha) * b[i]);

test('AUDIT MERGE-PLUS D1 a tier never hides a state: the reorder\'s insertion mark, the picked socket and a socket as a drop target, the hotbar\'s strike, refusal and drop target, and the refused drag each come after the tier\'s frame at its weight or more, in the state\'s own colour (mutants: the insertion mark lost on a tier, the hotbar\'s refusal under the tier, the refused ghost gold)', () => {
  const list = rules(PLUS_CSS);
  const T = '.pack-shell .pack-dock .itemrow[data-rarity]';
  for (const over of [T, `${T}:hover`, `${T}.on`]) {
    const body = outranks(list, `${T}.dragover`, over, 'box-shadow');
    assert.match(body, /inset 0 2px 0 #c08a3e/, 'the kit\'s insertion mark, brass');
  }
  const S = '.pack-shell .wornsock[data-rarity]';
  for (const over of [S, `${S}:hover`]) {
    outranks(list, `${S}.on`, over, 'box-shadow');
    outranks(list, `${S}.dragover`, over, 'box-shadow');
  }
  assert.match(outranks(list, `${S}.on`, S, 'border-color'), /border-color: var\(--rar-hi\)/, 'picked: the tier lit on every edge');
  for (const over of ['.hb .hb-slot[data-rarity] .hb-frame', '.hb .hb-slot.hb-active[data-rarity] .hb-frame']) {
    assert.match(outranks(list, '.hb .hb-slot[data-rarity].hb-strike .hb-frame', over, 'border-color'), /#f3cf86 #c08a3e #7a5424 #f3cf86/, 'the strike: brass');
    assert.match(outranks(list, '.hb .hb-slot[data-rarity].hb-deny .hb-frame', over, 'border-color'), /var\(--blood, #8c3a32\)/, 'a refusal: blood');
    assert.match(outranks(list, '.hb .hb-slot[data-rarity].dragover .hb-frame', over, 'border-color'), /var\(--verdigris, #4e7f72\)/, 'a drop target: verdigris');
  }
  assert.match(outranks(list, '.dragghost.refused[data-rarity] .tile', '.dragghost[data-rarity] .tile', 'border-color'), /var\(--blood, #8c3a32\)/);
  outranks(list, '.dragghost.refused[data-rarity] .tile.has-icon', '.dragghost[data-rarity] .tile.has-icon', 'border-color');
  // the finding itself, in weights: the kit's own states lose to the tier (which is why they are said again)
  assert.ok(!atLeast(weight('.hb-slot.hb-deny .hb-frame'), weight('.hb .hb-slot[data-rarity] .hb-frame')));
  assert.ok(!atLeast(weight('.pack-shell .itemrow.dragover'), weight(T)));
});

test('AUDIT MERGE-PLUS D2 a list\'s picture keeps its icon inside the tier\'s 2px frame: a worn pair\'s 28px cap is met by a 100% cap on every tiered list picture, later and at its weight (mutants: the cap left at 28px)', () => {
  const list = rules(PLUS_CSS);
  const pair = '.pack-shell .wornpair > .wornrow .tile img';
  const caps = list.filter((r) => r.sels.includes(pair)).map((r) => /max-width: (\d+)px;/.exec(r.body)?.[1]);
  assert.deepEqual(caps, ['28', '30'], 'the pair\'s own caps (its 28px tile, and its 34px one where the pair has room), which the frame shrank each box under');
  for (const sel of ['.pack-shell .loot-win .itemrow[data-rarity] .tile img',
    '.trade-shell .itemrow[data-rarity] .tile img', '.ptrade-shell .itemrow[data-rarity] .tile img']) {
    const r = ruleFor(list, sel, 'max-width');
    assert.ok(r && /max-width: 100%; max-height: 100%;/.test(r.body), sel);
  }
  // UI1b: a worn panel's picture wears no frame (the panel is the frame), and a fitted picture carries its own caps -
  // max 100% in its style (ui/textureCanvas.js fittedImg), over any the sheet sets
  assert.ok(!ruleFor(list, '.pack-shell .wornrow[data-rarity] .tile', 'border'), 'the worn tile unframed');
  assert.match(read('src/ui/textureCanvas.js'), /maxWidth: '100%', maxHeight: '100%', objectFit: 'contain'/);
});

test('AUDIT MERGE-PLUS D3 Stone\'s light ground: the lane\'s six surfaces the dress moved into the window and panel roles carry a Stone dim word, and the refusal\'s, the note\'s, the amber and the red words are lifted - each 4.5:1 or better over Stone\'s panel and ground, a refused row\'s reason at the disabled opacity over Stone\'s press; the old words read 2.3:1 and 3.5:1 there (mutants: the Stone dim word unset, the reason left at the old grey)', () => {
  const st = PLUS_THEMES.stone;
  const panel = hex(st.panel), ground = hex(st.ground), press = hex(st.button);
  for (const [name, c] of Object.entries({ STONE_DIM, STONE_WORD, STONE_AMBER, STONE_RED })) {
    for (const [under, g] of [['panel', panel], ['ground', ground]]) assert.ok(ratio(hex(c), g) >= 4.5, `${name} ${c} over Stone's ${under}: ${ratio(hex(c), g).toFixed(2)}:1`);
  }
  // a refused row: the press at .75 over the card, the reason at .75 over the same (C12's model, on Stone)
  const why = (c) => ratio(mix(hex(c), panel, 0.75), mix(press, panel, 0.75));
  assert.ok(why(STONE_WORD) >= 4.5, `the reason reads ${why(STONE_WORD).toFixed(2)}:1 on Stone`);
  assert.ok(why('#c8c2b4') < 4.5 && ratio(hex('#8b8578'), panel) < 3, 'and the old words did not - what this pin is for');
  // the six, and exactly the six the dress moved (the older lane surfaces stood in the roles before it)
  const six = ['body .dfdecor-card', 'body .dfpage-card', 'body .dfpeer-card', 'body .dfsocial-toast', 'body .dfduel-toast', 'body .dfdecor-bar'];
  for (const s of six) assert.ok(FRAME_ROLES.window.includes(s) || FRAME_ROLES.panel.includes(s), `${s} is in a role`);
  const list = rules(ONLINE_DRESS_CSS);
  for (const s of six) {
    const r = ruleFor(list, `:root[data-plus-theme="stone"] ${s}`, '--dim');
    assert.ok(r && r.body.includes(`--dim: ${STONE_DIM};`), `${s}: Stone's dim word, for everything inside to inherit`);
  }
  for (const s of ['body .dfpeer-why', 'body .dfpeer-btn[disabled]:hover .dfpeer-why', 'body .dfpage-note', 'body .dfduel-sub']) {
    const sel = `:root[data-plus-theme="stone"] ${s}`;
    assert.ok(ruleFor(list, sel, 'color')?.body.includes(`color: ${STONE_WORD};`), s);
    assert.ok(atLeast(weight(sel), weight(s.replace('body ', ''))), `${s} outweighs the lane's own rule`);
  }
  assert.ok(ruleFor(list, ':root[data-plus-theme="stone"] body .dfdecor-bar-why', 'color')?.body.includes(STONE_AMBER));
  assert.ok(ruleFor(list, ':root[data-plus-theme="stone"] body .dfdecor-row.dim .dfdecor-row-price', 'color')?.body.includes(STONE_RED));
  assert.ok(PLUS_CSS.indexOf(':root[data-plus-theme="stone"] body .dfpeer-card') > PLUS_CSS.indexOf('/* PLUS2: Stone */'), 'after the theme\'s own paint');
});

test('AUDIT MERGE-PLUS D4 the warn role holds all its states: the lit band is said in the warn\'s own rest and hover (a native shorthand wiped it), and the sunk blood edge comes after the pressable\'s sunk stone, which weighs the same on the duel (mutants: the blood edge before the stone, the band left to the kit)', () => {
  const list = rules(FRAME_CSS);
  for (const sel of ['body .dfsocial-btn.warn', 'body .dfprofile-duel']) {
    assert.match(ruleFor(list, sel, 'border-color').body, /background-image: linear-gradient\(180deg, rgba\(255,255,255,0\.08\) 0 2px/, `${sel} at rest keeps the band`);
    assert.match(ruleFor(list, `${sel}:hover:not(:disabled)`, 'border-color').body, /background-image: linear-gradient/, `${sel} under the pointer`);
  }
  const duel = 'body .dfprofile-duel:active:not(:disabled)';
  const sunk = list.filter((r) => r.sels.includes(duel));
  const blood = sunk.find((r) => /border-color: #3d0d0a/.test(r.body));
  const stone = sunk.find((r) => /translate: 1px 1px/.test(r.body));
  assert.ok(blood && stone, 'the duel is both a press and a warn');
  assert.ok(blood.i > stone.i, 'the blood edge is the later of the two, so it is the one the held duel wears');
  // the natives the band had lost to
  assert.match(read('src/ui/profileWindow.js'), /\.dfprofile-duel:hover:not\(\[disabled\]\) \{ background: #b8483f;/);
  assert.match(read('src/ui/socialPanel.js'), /\.dfsocial-btn\.warn \{ background: #6b2f28; \}/);
});

test('AUDIT MERGE-PLUS D5 + D6 the corner rune is a picture with its outline drawn in - no mask to clip it, no filter the mask ate - and it is drawn on every picture markItemFrame marks: the loot window\'s, the shop\'s and the trade\'s rows and the carried tile, as on the grid, the shelf, the worn rows, the hotbar and the diamond (mutants: the rune a mask again, the list rows bare)', () => {
  const list = rules(ITEM_FRAME_CSS);
  const rune = list.find((r) => r.sels.includes('.pack-shell .pack-dock .itemrow[data-sigil]::after') && /content: ''/.test(r.body));
  assert.ok(rune, 'the rune\'s rule');
  assert.ok(rune.body.includes(`background: ${SIGIL_RUNE_TILE_URL} center / contain no-repeat;`));
  assert.doesNotMatch(rune.body, /mask|filter/, 'nothing a mask could clip');
  for (const sel of ['.pack-shell .loot-win .itemrow[data-sigil] .tile::after', '.trade-shell .itemrow[data-sigil] .tile::after',
    '.ptrade-shell .itemrow[data-sigil] .tile::after', '.dragghost[data-sigil] .tile::after',
    '.pack-shell .wornsock[data-sigil]::after', '.pack-shell .equipped .wornrow[data-sigil]::after', '.hb .hb-slot[data-sigil]::before',   // UI1b: the worn panel's own corner
    '.hud-qdiamond .hud-qcell[data-sigil]:not(.socket) .hud-qbody::after']) {
    assert.ok(rune.sels.includes(sel), `${sel} wears the rune`);
    assert.ok(ruleFor(list, sel, 'animation')?.body.includes('animation: none'), `${sel} is still under reduced motion`);
  }
  assert.ok(ruleFor(list, '.dragghost[data-sigil] .tile', 'position')?.body.includes('position: relative'), 'the ghost\'s tile holds the corner');
  assert.ok(ruleFor(list, '.trade-shell .itemrow .tile', 'position')?.body.includes('position: relative'));
  const inv = read('src/ui/enhancedInventory.js');
  assert.match(inv, /ghost = markItemFrame\(el\('div', 'dragghost'\), item\);/, 'the ghost is marked');
  assert.match(inv, /if \(validSigil\(item\?\.sigil\)\) node\.dataset\.sigil = '';/, 'and the mark is the sigil\'s');
});

test('AUDIT MERGE-PLUS D7 a settings label is never cut for its value: in the settings\' rows (the main menu\'s panes, the pause menu\'s) the label keeps its longest word and the value\'s cell may shrink, so a long value wraps in its button - and the wizard\'s rows, which ellipsize, are not these (mutants: the label left to collapse)', () => {
  const list = rules(ENHANCED_CSS);
  const main = ruleFor(list, '.panes .row > .row-main', 'min-width');
  assert.ok(main && main.sels.includes('.px-setwrap .row > .row-main') && /min-width: min-content;/.test(main.body));
  outranks(list, '.panes .row > .row-main', '.row-main', 'min-width');
  const ctl = ruleFor(list, '.panes .row > .ctl', 'flex-shrink');
  assert.ok(ctl && ctl.sels.includes('.px-setwrap .row > .ctl') && /flex-shrink: 1;/.test(ctl.body));
  assert.ok(atLeast(weight('.panes .row > .ctl'), weight('.ctl')) && ctl.i > ruleFor(list, '.ctl', 'flex').i, 'over the base cell\'s `flex: 0 0 auto`');
  assert.ok(!main.sels.some((s) => s.includes('wizard')) && !ctl.sels.some((s) => s.includes('wizard')));
  assert.match(read('src/ui/enhancedMenu.js'), /const panes = el\('div', 'panes'\);[\s\S]{0,4000}?el\('div', 'list'\)/, 'the settings\' rows stand in .panes');
  assert.ok(SKIN_NAMES.enhanced.length > 'Enhanced'.length, 'the name that found it');
});

test('AUDIT MERGE-PLUS D8 the Interface Style help that said the retired word is gone with its row (MENU-TOGGLE), and the UI panel\'s enhanced card (enhanced-plus since PLUS-ONLY) keeps the emblem colour the retired id carried (mutants: the card\'s emblem plain)', () => {
  const menu = read('src/ui/enhancedMenu.js');
  assert.doesNotMatch(menu, /'ui:skin'|Enhanced is these screens/, 'no help for a row that is not there');
  const ui = OVERHAUL_PANELS.find((p) => p.id === 'ui');
  const ids = ui.options.map((o) => o.id);
  assert.ok(ids.includes('enhanced-plus') && !ids.includes('enhanced'), `the UI panel's ids: ${ids.join(', ')}`);
  assert.deepEqual(ui.options.map((o) => o.name), [SKIN_NAMES.classic, SKIN_NAMES.enhanced, 'GrimoireUI'], 'the three looks, by their own names');
  const rule = ruleFor(rules(ENHANCED_CSS), '.look-pic[data-look="enhanced-plus"] .look-emblem', 'color');
  assert.ok(rule && rule.sels.includes('.look-pic[data-look="enhanced"] .look-emblem') && /var\(--verdigris\)/.test(rule.body), 'the sound panel\'s Enhanced keeps it too');
});
