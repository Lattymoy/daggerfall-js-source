// FONT3 (2026-10-02, Mac: "So I want to improve the readability of our ingame font as im recieving a lot of
// complaints, additionally we need to ensure everything recieves our enhanced font"). The laws, pinned:
//   - THE READING PAIR rides the one trio (weight 500, half a pixel of tracking), and the enhanced body wears it;
//   - THE FLOOR: no enhanced sheet sets text under 11px (a decorative glyph and an SVG's own units aside);
//   - THE DIM IS READABLE: the pixel skin's #7d7460 is never a text colour, and --dim clears 5.5:1 on the panels, under the mid tone (AUDIT FONT3 C2);
//   - ONE FACE: the menu-era tokens name the pixel stack in the game's sheet, and the surfaces the audit found
//     (the death screen, the gate's ground warning, the prison countdown, a draw list's words, the pad prompt bar,
//     the opening film, the two inline cards, the asset picker) are in it - the recovery code alone stays plain.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PIXEL_FONT_CSS, PIXEL_READ_CSS, PIXEL_STACK, PIXEL_FAMILIES, PIXELIFY_FIVE_FACE } from '../src/ui/pixelifyFive.js';
import { ENHANCED_CSS, ENHANCED_TOKENS } from '../src/ui/enhancedStyle.js';
import { PLUS_CSS } from '../src/ui/enhancedPlusStyle.js';
import { DEATH_CSS } from '../src/ui/enhancedDeath.js';
import { TEXT_LAYER_CSS, TEXT_LAYER_FIT, drawEnhancedTextLayer, hideEnhancedTextLayer } from '../src/ui/enhancedTextLayer.js';
import { PrisonScreenWindow, ENHANCED_PRISON_DAYS_ID } from '../src/ui/prisonScreen.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const ruleOf = (css, sel) => {
  const i = css.indexOf(`${sel} {`);
  return i < 0 ? null : css.slice(i, css.indexOf('}', i) + 1);
};

test('FONT3: the reading pair rides the one trio, after the stack, so a rule that says its own weight after it keeps it', () => {
  assert.equal(PIXEL_READ_CSS, 'font-weight: 500; letter-spacing: 0.5px;');
  assert.ok(PIXEL_FONT_CSS.startsWith(`font-family: ${PIXEL_STACK};`), 'the stack first');
  assert.ok(PIXEL_FONT_CSS.trimEnd().endsWith(PIXEL_READ_CSS), 'the pair last');
  assert.equal(PIXEL_STACK, `${PIXEL_FAMILIES}, monospace`, 'the families are the stack\'s own head');
  // the touch layer was the one place a weight stood BEFORE the trio - turned round, or the entry field's 600 is lost
  const touch = read('src/ui/touch.js');
  assert.match(touch, /`\$\{PIXEL_FONT_CSS\}font-weight:500;font-size:15px;`/);
  assert.match(touch, /`\$\{PIXEL_FONT_CSS\}font-weight:600;font-size:18px;`/);
  // the request already carries 500 - nothing new is fetched for the pair
  assert.match(read('src/ui/enhancedStyle.js'), /FONT_PIXEL_DATA = 'Pixelify\+Sans:wght@400;500'/);
});

test('FONT3: the enhanced body wears the whole trio, and the menu-era tokens name the pixel stack in the game\'s sheet alone', () => {
  const body = /\nbody \{([^}]*)\}/.exec(ENHANCED_CSS)[1];
  assert.ok(body.includes(PIXEL_FONT_CSS), 'the trio and the reading pair on the body');
  assert.doesNotMatch(body, /var\(--data\)|antialiased/, 'not the launcher face, not smoothed');
  assert.ok(ENHANCED_CSS.includes(`:root { --data: ${PIXEL_STACK}; --display: ${PIXEL_STACK}; --brand: 'Jacquard 12', ${PIXEL_STACK}; }`));
  assert.ok(ENHANCED_CSS.indexOf('--data: ' + PIXEL_STACK) > ENHANCED_CSS.indexOf(ENHANCED_TOKENS), 'after the tokens, so it wins');
  assert.match(ENHANCED_TOKENS, /--data: 'Barlow Semi Condensed'/, 'the landing page\'s block keeps its own values');
  assert.match(ENHANCED_CSS, /\nselect, input, textarea \{ font: inherit; \}/, 'a form control takes the face');
});

test('FONT3: the recovery code is the one word named outside the pixel face - its alphabet keeps B/8, G/6, S/5 apart', () => {
  const code = ruleOf(ENHANCED_CSS, '.card .acctcode code');
  assert.match(code, /font-family: 'Barlow Semi Condensed', system-ui, sans-serif; -webkit-font-smoothing: antialiased;/);
  assert.doesNotMatch(code, /var\(--data\)/, 'never the token, which is the pixel stack in this sheet');
  assert.match(read('server-account/src/password.js'), /CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'/, 'the alphabet the reason rests on');
});

// THE FLOOR. Every sheet an enhanced surface lays; the number is the one the codemod held them to.
const FLOOR_SHEETS = ['src/ui/enhancedStyle.js', 'src/ui/enhancedPlusStyle.js', 'src/ui/chatPanel.js', 'src/ui/socialPanel.js',
  'src/ui/partyPanel.js', 'src/ui/socialMenu.js', 'src/ui/decorPanel.js', 'src/ui/enhancedDialogStyle.js', 'src/ui/enhancedHelm.js',
  'src/ui/enhancedHotbar.js', 'src/ui/enhancedPortStyle.js', 'src/ui/nameLayer.js', 'src/ui/navalHud.js', 'src/ui/navalPlunderWindow.js',
  'src/ui/pageWindow.js', 'src/ui/pickupFeed.js', 'src/ui/plusPadBinds.js', 'src/ui/profActStyle.js', 'src/ui/profStationStyle.js',
  'src/ui/profileWindow.js', 'src/ui/travelViewHud.js', 'src/ui/enhancedDeath.js', 'src/ui/enhancedPlayerTrade.js', 'src/ui/plusPad.js',
  'src/ui/enhancedFrame.js', 'src/ui/introScreen.js',   // AUDIT FONT3 C3: the film's words are the pixel face too
  'src/ui/waypointMenu.js', 'src/ui/travelPaceControls.js'];   // WAYPOINTS and PACE-DIALS (2026-10-06): the right-click menu and the pace box lay sheets of their own
// a ◆, a rarity pip, the emblem's word, an SVG's own units - and (AUDIT FONT3 C3) the effect words and rounds INSIDE a
// 16px effect icon (the party card's and the crew's), which are the icon's own marks at the icon's own scale
const GLYPH_ONLY = /::?before|::?after|insignia-word|provlabel|dfparty-fx[wr]|dfnaval-crew-fxe/;
test('FONT3: THE FLOOR - no enhanced sheet sets text under 11px, a size the face greys out (mutants: FONT3-FLOOR)', () => {
  const under = [];
  for (const f of FLOOR_SHEETS) {
    const src = read(f).replace(/\$\{[^{}]*\}/g, (m) => '$' + 'X'.repeat(m.length - 1));
    for (const m of src.matchAll(/font-size:\s*(?:calc\()?([\d.]+)px/g)) {
      const v = Number(m[1]);
      if (v >= 11) continue;   // AUDIT FONT3 C3: a 7px word was under the floor and under the pin's old `v < 8` skip
      const open = src.lastIndexOf('{', m.index);
      const sel = src.slice(Math.max(src.lastIndexOf('}', open), src.lastIndexOf('`', open)) + 1, open);
      if (!GLYPH_ONLY.test(sel)) under.push(`${f}:${src.slice(0, m.index).split('\n').length} ${v}px ${sel.trim().slice(-60)}`);
    }
  }
  assert.deepEqual(under, [], 'every one of these renders under the floor');
});

const lum = (hex) => {
  const c = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
test('FONT3: THE DIM IS READABLE - #7d7460 is a rule\'s colour, never a word\'s, and --dim clears 5.5:1 on the slate panel', () => {
  for (const f of FLOOR_SHEETS) {
    assert.doesNotMatch(read(f), /(?<![-\w])color:\s*#7d7460/, `${f}: a word at 3.7:1`);
    assert.doesNotMatch(read(f), /#8b8578\)/, `${f}: a --dim fallback that disagrees with the token`);
  }
  const dim = /--dim: (#[0-9a-f]{6});/.exec(ENHANCED_TOKENS)[1];
  assert.ok(contrast(dim, '#171b21') >= 5.5, `--dim ${dim} at ${contrast(dim, '#171b21').toFixed(2)}:1`);
  // AUDIT FONT3 C2: FONT3 lifted it to #a39d8f, 6.40:1 against the mid tone's 6.57 - the dim and the mid read as one
  assert.ok(contrast('#a89f88', '#171b21') - contrast(dim, '#171b21') > 0.5, 'the dim stays a step under the mid');
  assert.ok(contrast('#9c937d', '#171b21') >= 5.5, 'the pixel skin\'s dim word');
  assert.ok(contrast('#9c937d', '#171b21') < contrast('#a89f88', '#171b21'), '...and still under the mid tone, so the order holds');
});

test('FONT3: ONE FACE - the death screen\'s words, the gate\'s ground warning, the pad prompt bar, the opening film', () => {
  assert.match(ruleOf(DEATH_CSS, '.dth-title'), new RegExp(`font-family: ${PIXEL_STACK.replace(/[()]/g, '\\$&')};`));
  assert.match(ruleOf(DEATH_CSS, '.dth-line'), new RegExp(`font-family: ${PIXEL_STACK.replace(/[()]/g, '\\$&')};`));
  assert.doesNotMatch(DEATH_CSS, /Cormorant/);
  assert.ok(ruleOf(PLUS_CSS, 'body .wb-ground-warn').includes(PIXEL_FONT_CSS), 'the one gate surface the dress had not reached');
  for (const s of ['body .wb-boss-bar', 'body .wb-gate-banner', 'body .wb-marks-card', 'body .wb-dmg-chart']) {
    assert.doesNotMatch(ruleOf(PLUS_CSS, s), /font-weight: 400/, `${s}: the reading weight is not undone`);
  }
  const pad = read('src/ui/plusPad.js');
  assert.doesNotMatch(pad, /var\(--pixel-font/, 'a variable nothing declares');
  assert.match(pad, /\$\{PIXEL_FONT_CSS\} font-size: 13px; line-height: 1;/);
  const intro = read('src/ui/introScreen.js');
  assert.match(intro, /const STYLE = `\$\{PIXELIFY_FIVE_FACE\}\n#intro\{[^}]*\$\{PIXEL_FONT_CSS\}/);
  assert.doesNotMatch(/const STYLE = `[\s\S]*?`;/.exec(intro)[0], /Georgia|system-ui/, 'no other face left in the film\'s sheet');
  assert.match(intro, /injectEnhancedFonts\(doc\);/);
  // the two inline-only cards name the face first and load nothing for it
  assert.match(read('src/ui/charSheetDoor.js'), /font:500 20px\/1\.6 \$\{PIXEL_FAMILIES\},system-ui,sans-serif;/);
  assert.match(read('src/ui/enhancedChunk.js'), /font:500 14px\/1\.5 \$\{PIXEL_FAMILIES\},system-ui,sans-serif;/);
  assert.match(read('src/scenes/dataSource.js'), /const face = isEnhanced\(\) \? `\$\{PIXEL_FONT_CSS\}font-size:14px;` : 'font:14px monospace;-webkit-font-smoothing:antialiased;letter-spacing:normal;';/);
});

test('FONT3: the dungeon\'s readied-spell line is the classic skin\'s - the enhanced HUD already names the spell', () => {
  assert.match(read('src/scenes/dungeonContext.js'), /if \(hudFont && magic\.readied\(\) && !isEnhanced\(\)\) \{/);
});

// ── a document just real enough for the two DOM arms ──
function fakeDoc() {
  const doc = { head: null, body: null, byId: new Map() };
  const node = (tag) => {
    const n = { tag, children: [], attrs: {}, className: '', id: '', textContent: '',
      style: { _p: {}, display: '', cssText: '', setProperty(k, v) { this._p[k] = v; } },
      append(...cs) { for (const c of cs) { n.children.push(c); if (c.id) doc.byId.set(c.id, c); } },
      setAttribute(k, v) { n.attrs[k] = String(v); } };
    return n;
  };
  doc.createElement = node;
  doc.head = node('head'); doc.body = node('body');
  doc.getElementById = (id) => doc.byId.get(id) ?? [...doc.head.children, ...doc.body.children].find((c) => c.id === id) ?? null;
  return doc;
}

test('FONT3: a draw list\'s words - one layer per id, a line per text at its own top-left, moved and hidden, never rebuilt', () => {
  const doc = fakeDoc();
  const canvas = { width: 2560, height: 1600, clientWidth: 1280 };   // dpr 2
  const items = [
    { text: 'LMB click to place a marker', x: 0, y: 0, cell: 21, color: [1, 1, 1, 1], shadow: [0, 0, 0, 1], shadowPos: [3, 3] },
    { text: 'Current marker color is Red', x: 0, y: 1580, cell: 21, color: [0.5, 0.5, 0.5, 1], shadow: [0, 0, 0, 1], shadowPos: [3, 3] },
  ];
  const root = drawEnhancedTextLayer('t-layer', items, canvas, doc);
  assert.equal(root.className, 'etl-layer');
  assert.ok(doc.head.children.some((s) => s.textContent === TEXT_LAYER_CSS), 'its own sheet');
  assert.ok(TEXT_LAYER_CSS.startsWith(PIXELIFY_FIVE_FACE) && TEXT_LAYER_CSS.includes(PIXEL_FONT_CSS), 'the five and the trio');
  assert.equal(root.children.length, 2);
  assert.equal(root.children[0].textContent, 'LMB click to place a marker');
  assert.match(root.children[1].style.cssText, /translate\(0\.0px, 790\.0px\)/, 'device pixels back to CSS pixels');
  assert.match(root.children[0].style.cssText, new RegExp(`font-size: ${((21 * TEXT_LAYER_FIT) / 2).toFixed(1)}px`));
  assert.match(root.children[0].style.cssText, /text-shadow: 1\.5px 1\.5px 0 rgba\(0, 0, 0, 1\)/);
  const first = root.children[0];
  drawEnhancedTextLayer('t-layer', items.slice(0, 1), canvas, doc);
  assert.equal(root.children[0], first, 'moved, not rebuilt');
  assert.equal(root.children[1].style.display, 'none', 'a line the list dropped is hidden');
  hideEnhancedTextLayer('t-layer');
  assert.equal(root.style.display, 'none', 'the window\'s dispose takes the layer down');
  // world.js: the map's list names the layer, the window's dispose hides it
  const world = read('src/scenes/world.js');
  assert.match(world, /if \(draws\) csaDrawList\(draws, CSA_MAP_TEXT_LAYER\);/);
  assert.match(world, /dispose\(\) \{ if \(_csaMapWindow === win\) _csaMapWindow = null; hideEnhancedTextLayer\(CSA_MAP_TEXT_LAYER\); \}/);
  assert.match(world, /const words = layerId && isEnhanced\(\) && typeof document !== 'undefined' \? \[\] : null;/);
});

test('FONT3: the prison countdown - the mid-screen label\'s DOM face under the enhanced skin, taken down by dispose', () => {
  const doc = fakeDoc();
  const had = globalThis.document;
  globalThis.document = doc;
  try {
    const w = new PrisonScreenWindow({ daysInPrison: 3 });
    const texts = [];
    const renderer = { drawScreenQuad() {}, uploadTexture: () => ({}) };
    w.draw(renderer, { width: 1280, height: 800, clientWidth: 1280 }, { fnt: { fixedHeight: 7 } });
    const label = doc.getElementById(ENHANCED_PRISON_DAYS_ID);
    assert.ok(label, 'the label is mounted');
    assert.equal(label.className, 'hudmid');
    assert.equal(label.textContent, w.label);
    assert.ok(Number.parseFloat(label.style._p['--hudmid-top']) > 0, 'at the label\'s own native row');
    assert.deepEqual(texts, [], 'and no bitmap text');
    w.dispose();
    assert.equal(label.style.display, 'none', 'a DOM line stays painted until it is told');
  } finally {
    if (had === undefined) delete globalThis.document; else globalThis.document = had;
  }
});
