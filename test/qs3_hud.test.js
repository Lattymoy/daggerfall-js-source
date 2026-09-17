// QS3 - THE QUICKSLOT DIAMOND ON THE ENHANCED HUD.
//
// Mac's reference is the Demon's Souls remake's bottom-left diamond:
// the off hand left, the weapon right, two consumables above and below,
// item art in each cell, a durability strip on the hands, a count on
// the consumables and the key that presses each at the outer point.
//
// Three things are pinned here and the third is the one that keeps the
// other two honest:
//   - the PAD GLYPHS (ui/padGlyphs.js) - our own pixel buttons, pure
//     and renderable in node, so the bitmaps and the SVG they become
//     are checkable rather than looked at;
//   - the TAG LAW (ui/quickslotTags.js) - which of a key name, a pad
//     glyph or NOTHING each corner says;
//   - the DOM and the sheet, driven through the same document fake the
//     AUDIT 64 HUD pins use, so the states (sheathed, ghost, socket,
//     the count, the tag text) are executed rather than described.
//
// The LAYOUT is not measured here - node has no layout engine, and a
// pin that reads a number off a fake box is a pin on the fake. The
// boxes were measured in Chromium (tools/qs3Probe.mjs) and what stands
// in this file is the CSS the measurement was taken over, by source
// regex, so a change to a rule fails here and can be re-measured there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PAD_GLYPHS, PAD_FAMILIES, GLYPH_SIZE, padFamilyOf, padFamily, setPadFamily,
  unityButtonGlyph, glyphSvg, _clearGlyphCache,
} from '../src/ui/padGlyphs.js';
import { quickslotTag, quickslotOffTag, torchTag, tagKey, CELL_ACTIONS, tagText } from '../src/ui/quickslotTags.js';
import { createBindings, setBinding } from '../src/systems/inputActions.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const HUD = read('src/ui/enhancedHud.js');
const CSS = read('src/ui/enhancedStyle.js');

const CODES = Array.from({ length: 10 }, (_, i) => `JoystickButton${i}`);

test('QS3 glyphs: ten buttons per family, every bitmap square and every pixel on or off', () => {
  // OUR OWN, drawn rather than licensed: every shipped glyph set is
  // somebody's trademark or somebody's font, and this skin has a
  // language of its own. The grid is a law rather than a per-glyph
  // fact, so a typo in one row is caught here and not on a screen.
  assert.deepEqual([...PAD_FAMILIES], ['xbox', 'ps']);
  for (const family of PAD_FAMILIES) {
    const set = PAD_GLYPHS[family];
    assert.deepEqual(Object.keys(set).sort(), [...CODES].sort(), `${family}: the ten standard-mapping buttons`);
    for (const [code, rows] of Object.entries(set)) {
      assert.equal(rows.length, GLYPH_SIZE, `${family}/${code}: ${rows.length} rows`);
      for (const row of rows) {
        assert.equal(row.length, GLYPH_SIZE, `${family}/${code}: a row of ${row.length}`);
        // '.' off, '#' the shape, 'o' the mark - no third state, and no
        // anti-aliasing anywhere in this language.
        assert.match(row, /^[.#o]+$/, `${family}/${code}: "${row}"`);
      }
      assert.ok(rows.some((r) => r.includes('#')), `${family}/${code} draws a shape`);
      assert.ok(rows.some((r) => r.includes('o')), `${family}/${code} draws a mark inside it`);
    }
    // The two families differ where the hardware does - the face
    // buttons and the bumpers - and agree where it does not.
    assert.notDeepEqual(PAD_GLYPHS.xbox.JoystickButton0, PAD_GLYPHS.ps.JoystickButton0, 'A is not Cross');
    assert.notDeepEqual(PAD_GLYPHS.xbox.JoystickButton4, PAD_GLYPHS.ps.JoystickButton4, 'LB is not L1');
    assert.deepEqual(PAD_GLYPHS.xbox.JoystickButton8, PAD_GLYPHS.ps.JoystickButton8, 'a left stick click is a left stick click');
  }
  // L3 and R3 are mirror images: which stick it is, is the only thing
  // the glyph has to say.
  assert.notDeepEqual(PAD_GLYPHS.xbox.JoystickButton8, PAD_GLYPHS.xbox.JoystickButton9);
});

test('QS3 glyphSvg: crisp rects on the bitmap\'s own grid, cached, and null for what is not a button', () => {
  _clearGlyphCache();
  const url = glyphSvg('xbox', 'JoystickButton0', { size: 12 });
  const svg = decodeURIComponent(url.replace('data:image/svg+xml;utf8,', ''));
  // NO CANVAS: a canvas needs a document, and a test that cannot read
  // what was drawn pins nothing.
  assert.match(svg, /shape-rendering="crispEdges"/);
  assert.match(svg, /viewBox="0 0 11 11"/, 'the rects are on the bitmap\'s own integer grid');
  assert.match(svg, /width="12" height="12"/);
  assert.ok(/<rect x="\d+" y="\d+" width="\d+" height="1" fill="#d8cfae"\/>/.test(svg), `rects: ${svg.slice(0, 200)}`);
  // Runs merge: the ring's top row is five lit pixels and ONE rect.
  assert.match(svg, /<rect x="3" y="0" width="5" height="1"/);
  assert.ok((svg.match(/<rect /g) ?? []).length < 11 * 11, 'runs merged, not a rect per pixel');
  // CACHED per family, code, size and colour - the HUD asks for the
  // same four glyphs sixty times a second.
  assert.equal(glyphSvg('xbox', 'JoystickButton0', { size: 12 }), url, 'the same answer, out of the cache');
  assert.notEqual(glyphSvg('xbox', 'JoystickButton0', { size: 24 }), url, 'a different size is a different glyph');
  assert.notEqual(glyphSvg('ps', 'JoystickButton0', { size: 12 }), url, 'and so is a different family');
  // The accent is the mark's colour and defaults to the shape's, so
  // nothing shipped depends on a second hue.
  const accented = glyphSvg('xbox', 'JoystickButton0', { size: 12, accent: '#c08a3e' });
  assert.match(decodeURIComponent(accented), /fill="#c08a3e"/);
  assert.equal(glyphSvg('xbox', 'JoystickButton10'), null);
  assert.equal(glyphSvg('xbox', 'KeyW'), null);
});

test('QS3 padFamilyOf: Sony by id, Xbox by default, and the live family clears with the pad', () => {
  assert.equal(padFamilyOf('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 02fd)'), 'xbox');
  assert.equal(padFamilyOf('Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)'), 'ps',
    'a DualShock 4 reports no name at all, only Sony\'s 054c');
  assert.equal(padFamilyOf('DualSense Wireless Controller'), 'ps');
  assert.equal(padFamilyOf('PlayStation 5 Controller'), 'ps');
  assert.equal(padFamilyOf(''), 'xbox', 'no id at all is the default, not a crash');
  assert.equal(padFamilyOf(null), 'xbox');
  assert.equal(padFamilyOf(undefined), 'xbox');
  // The module-global the HUD reads: written by the poller, cleared
  // when the pad goes, because a glyph for a pad nobody holds is a lie.
  setPadFamily(null);
  assert.equal(padFamily(), null);
  setPadFamily('ps'); assert.equal(padFamily(), 'ps');
  setPadFamily('nonsense'); assert.equal(padFamily(), null, 'only the two families it can draw');
  setPadFamily(null);
});

test('QS3 unityButtonGlyph: the ten and nothing else', () => {
  for (const code of CODES) for (const f of PAD_FAMILIES) assert.ok(unityButtonGlyph(f, code), `${f}/${code}`);
  // Unity NAMES twenty (KeyCodeList); the standard mapping reaches ten,
  // which is what STANDARD_TO_UNITY_BUTTON maps onto.
  for (const bad of ['JoystickButton10', 'JoystickButton19', 'JoystickAxis3Button0', 'KeyW', 'Mouse0', '', null, undefined, 7]) {
    assert.equal(unityButtonGlyph('xbox', bad), null, String(bad));
  }
  assert.equal(unityButtonGlyph('nonsense', 'JoystickButton0'), PAD_GLYPHS.xbox.JoystickButton0,
    'an unknown family falls back rather than drawing nothing');
});

test('QS3 the tag law: the pad while the pad is live, the key otherwise, and NOTHING when unbound', () => {
  const store = createBindings();
  setBinding(store, 'Digit1', 'QuickUse1');
  setBinding(store, 'JoystickButton2', 'QuickUse1', false);   // the secondary dict
  setBinding(store, 'Digit2', 'QuickUse2');
  setBinding(store, 'JoystickButton3', 'QuickSwap');          // a PAD-ONLY action
  const key = { bindings: store, controller: false, family: 'xbox' };
  const pad = { bindings: store, controller: true, family: 'xbox' };

  // The keyboard arm is `tagText`: the digit row shows its DIGIT (DFU's
  // GetButtonText says "A1", Alpha1, which on a corner chip reads as a
  // grid reference), the numpad its digit with the pad's prefix, and
  // every other key `buttonText` at its SHORT form.
  assert.deepEqual(quickslotTag('QuickUse1', key), { kind: 'key', text: '1' });
  assert.equal(tagText('Digit0'), '0');
  assert.equal(tagText('Numpad7'), 'KP7');
  assert.equal(tagText('KeyZ'), 'Z');
  assert.equal(tagText('ArrowLeft'), 'LEFT');
  // AUDIT QS F6: a combo is each half through the same law, joined tight
  // - never buttonText's '...' - and an action bound only to a pad AXIS
  // key reads as bound.
  assert.equal(tagText('ShiftLeft+Digit1'), 'LSHIFT+1');
  const axis = createBindings();
  setBinding(axis, 'JoystickAxis3+', 'QuickUse1');
  const axisTag = quickslotTag('QuickUse1', { bindings: axis, controller: true, family: 'xbox' });
  assert.equal(axisTag?.kind, 'key');
  assert.ok(axisTag.text.length > 0 && axisTag.text !== '...' && axisTag.text !== 'NONE');
  // ...and the pad's own button while the pad is the live device.
  assert.deepEqual(quickslotTag('QuickUse1', pad), { kind: 'glyph', family: 'xbox', code: 'JoystickButton2' });
  assert.deepEqual(quickslotTag('QuickUse1', { ...pad, family: 'ps' }), { kind: 'glyph', family: 'ps', code: 'JoystickButton2' });
  // A pad in hand and NO pad binding is still the keyboard key: a
  // corner that went blank when someone picked up a controller would
  // be worse than either answer.
  assert.deepEqual(quickslotTag('QuickUse2', pad), { kind: 'key', text: '2' });
  // An action bound ONLY to the pad shows its glyph either way -
  // there is no key to name.
  assert.deepEqual(quickslotTag('QuickSwap', key), { kind: 'glyph', family: 'xbox', code: 'JoystickButton3' });
  // UNBOUND IS NO TAG. `buttonText(null)` answers 'NONE' because
  // KeyCode.None.ToString() does, and a chip reading NONE tells a
  // player to press a key that does not exist.
  assert.equal(quickslotTag('ReadyWeapon', key), null);
  assert.equal(quickslotTag('QuickUse1', { bindings: null }), null, 'no store, no tag');
  assert.equal(quickslotTag(null, key), null);
  for (const t of [quickslotTag('ReadyWeapon', key), quickslotTag('QuickUse1', { bindings: null })]) {
    assert.notEqual(tagKey(t), 'k:NONE');
  }

  // WHICH TAG GOES WHERE. The off hand's is decided by what stands in
  // it: a swap weapon is QuickSwap, and every other state of the off hand
  // is QuickOffHand - QS4, the corner that had no key at all.
  assert.deepEqual(CELL_ACTIONS,
    { main: 'ReadyWeapon', c1: 'QuickUse1', c2: 'QuickUse2', swap: 'QuickSwap', off: 'QuickOffHand' });
  // QS4: EVERY STATE OF THE OFF CELL NAMES A KEY. A swap is the swap's;
  // a lit torch, a shield, an off-hand weapon and an empty socket are the
  // off hand's own press - the cell a player could not reach before.
  setBinding(store, 'Digit4', 'QuickOffHand');
  for (const kind of ['shield', 'empty', 'weapon', 'torch']) {
    assert.deepEqual(quickslotOffTag(kind, key), { kind: 'key', text: '4' }, `the ${kind} cell names its key`);
  }
  assert.deepEqual(quickslotOffTag('swap', key), { kind: 'glyph', family: 'xbox', code: 'JoystickButton3' });
  // The mod's own key is still a tag a caller can ask for - HT4 kept the
  // mod's keys, and this one still presses the same act.
  assert.deepEqual(torchTag(() => 'O'), { kind: 'key', text: 'O' });
  // Handheld Torches binds a KeyCode name in its own settings, not an
  // InputManager action - so the torch cell is keyboard only and reads
  // the mod's store (HT4 moved its default to O).
  assert.equal(torchTag(() => 'None'), null, 'an unbound mod key is no tag either');
  assert.deepEqual(torchTag(() => 'Alpha4'), { kind: 'key', text: '4' });
  assert.equal(torchTag(() => { throw new Error('no store'); }), null, 'a store that is not there is not a key');
  // The tag's string, which is what the HUD writes on.
  assert.equal(tagKey({ kind: 'key', text: '1' }), 'k:1');
  assert.equal(tagKey({ kind: 'glyph', family: 'ps', code: 'JoystickButton0' }), 'g:ps:JoystickButton0');
  assert.equal(tagKey(null), '');
});

test('QS3: the diamond is a block of its own on the HUD root, and the hand plaques are gone', () => {
  // ON `root`, not in `.hud-bottom`: the bottom column is CENTRED and
  // this is anchored to a corner, so a corner block inside it would
  // move whenever a bar beside it changed width.
  assert.match(HUD, /const quick = el\('div', 'hud-quick'\);/);
  assert.match(HUD, /quick\.append\(cap, diamond\);\s*\n\s*root\.append\(quick\);/);
  // QS6: the caption carries the spell chip between the mode word and
  // the readied one - the diamond's four corners are the hands and the
  // consumables, and a spell is in none of them.
  assert.match(HUD, /cap\.append\(cornerWord, spellChip, readied\);/);
  assert.ok(CSS.includes('.hud-qspell'), 'and the sheet dresses it');
  // The four cells and the four tags.
  assert.match(HUD, /const cells = \{ c1: cellOf\('c1'\), off: cellOf\('off'\), main: cellOf\('main'\), c2: cellOf\('c2'\) \};/);
  assert.match(HUD, /\[\['c1', 'top'\], \['off', 'left'\], \['main', 'right'\], \['c2', 'bottom'\]\]/);
  for (const c of ['hud-qcell', 'hud-qframe', 'hud-qground', 'hud-qbody', 'hud-qicon', 'hud-qwear', 'hud-qcount', 'hud-qstag']) {
    assert.ok(CSS.includes(`.${c}`), `the sheet carries .${c}`);
  }
  // PX30b's two plaques go ENTIRELY - the diamond says both of those
  // things and two more, in a place the eye already goes.
  assert.doesNotMatch(HUD, /hud-hands|hud-hand\b|hud-weapon\b|hud-handkind|hud-handname/);
  assert.doesNotMatch(CSS, /\.hud-hands|\.hud-hand \{|\.hud-hand\.on|\.hud-handkind|\.hud-handname/);
  // The readied SPELL survives as the caption's second chip, in the
  // brass border and the classic shadowed pair it always wore.
  assert.match(HUD, /const readied = el\('div', 'hud-readied'\);/);
  assert.match(HUD, /parts\.readied\.classList\.toggle\('on', !!readyName\);/);
  assert.match(CSS, /\.hud-readied \{ display: none;[\s\S]{0,200}border: 2px solid var\(--brass\); \}/);
  assert.match(CSS, /\.hud-readyname \{[^}]*color: rgb\(243,239,44\); text-shadow: 2px 2px 0 rgb\(93,77,12\); \}/);
  // THE MODE WORD LIVES IN THE BLOCK now - it stood at left 24 bottom
  // 24, which is exactly where the diamond goes. Its show/hide laws
  // are untouched; only its place changed.

  assert.match(CSS, /\.hud-modecorner \{ flex: 0 0 auto; \}/);
  assert.doesNotMatch(CSS, /\.hud-modecorner \{ position: absolute;/);
  assert.match(HUD, /if \(last\.reticle !== rk\) \{/, 'and the reticle key still guards it');
});

test('QS3: the sheet - clipped not rotated, one number for the geometry, and the socket', () => {
  // A 45-degree transform on a cell would rotate the sprite inside it,
  // and a rotated pixel sprite is a blurred one. Two stacked clipped
  // squares, and the content upright inside them.
  assert.match(CSS, /\.hud-qframe \{ position: absolute; inset: 0; background: rgba\(125,116,96,0\.55\);\s*\n\s*clip-path: polygon\(50% 0, 100% 50%, 50% 100%, 0 50%\); \}/);
  assert.match(CSS, /\.hud-qground \{ position: absolute; inset: 2px; background: rgba\(10,12,17,0\.75\);\s*\n\s*clip-path: polygon\(50% 0, 100% 50%, 50% 100%, 0 50%\); \}/);
  assert.doesNotMatch(CSS, /\.hud-qcell[^{]*\{[^}]*rotate\(/, 'nothing here is rotated');
  // THE GEOMETRY IS ONE NUMBER: box = 2 * cell puts the four cells edge
  // to edge, and every placement is (box - cell) / 2.
  assert.match(CSS, /--qs-cell: 84px; --qs-box: 172px;/);
  assert.match(CSS, /\.hud-qc1 \{ left: calc\(\(var\(--qs-box\) - var\(--qs-cell\)\) \/ 2\); top: 0; \}/);
  assert.match(CSS, /\.hud-qoff \{ left: 0; top: calc\(\(var\(--qs-box\) - var\(--qs-cell\)\) \/ 2\); \}/);
  assert.match(CSS, /\.hud-qmain \{ left: calc\(var\(--qs-box\) - var\(--qs-cell\)\);/);
  assert.match(CSS, /\.hud-qc2 \{[^}]*top: calc\(var\(--qs-box\) - var\(--qs-cell\)\); \}/);
  // The block's corner, and the HUD's own scale on it.
  assert.match(CSS, /\.hud-quick \{ position: absolute;\s*\n\s*left: calc\(24px \+ env\(safe-area-inset-left, 0px\)\);/);
  assert.match(CSS, /\.hud-quick \{[\s\S]{0,1100}?transform: scale\(var\(--hud-scale\)\); transform-origin: bottom left;/);
  // THE INSET GROWS WITH THE SCALE, and 30px is MEASURED rather than
  // chosen: `.hud-bottom` is bottom-anchored and grows upward, so the
  // vitals row's top edge is at 22 + 30 * scale from the bottom
  // (748 at scale 1, 718 at 2 on 800px - tools/qs3Probe.mjs). The bars
  // are centred and reach this corner past about scale 1.2, so the
  // block's bottom edge rides that line at EVERY scale - AUDIT QS: the
  // first draft stepped 30px per unit, cleared 2, and stood in the
  // magicka bar at 1.5. And 22px under the diamond holds the bottom tag.
  assert.match(CSS, /bottom: calc\(22px \+ 32px \* var\(--hud-scale\) \+ env\(safe-area-inset-bottom, 0px\)\);/);
  assert.match(CSS, /padding: 0 30px 22px; display: flex; flex-direction: column;/);
  // THE CAPTION IS CAPPED AT THE DIAMOND'S WIDTH and wraps: a readied
  // spell can be called anything, and an unbounded row made the block
  // 515px wide on a 430px phone - measured, with the whole block off
  // the right edge behind it.
  assert.match(CSS, /\.hud-qcap \{ display: flex; flex-wrap: wrap;[\s\S]{0,120}max-width: var\(--qs-box\); \}/);
  // TI2's fixed stick lives in this very corner - inset 36, radius 56,
  // so it owns x 36..148 - and the block steps clear of it by a class
  // the HUD toggles off the same pref the stick reads.
  assert.match(CSS, /\.hud-quick\.stickclear \{ left: calc\(156px \+ env\(safe-area-inset-left, 0px\)\); \}/);
  assert.match(HUD, /const fixedStick = getPref\('touchStickAnchor'\) === 'fixed';/);
  assert.match(HUD, /if \(last\.qstick !== fixedStick\) \{/, 'guarded, like every other write here');
  assert.match(HUD, /parts\.quick\.classList\.toggle\('stickclear', fixedStick\);/);
  // THE ICON: capped on both axes, never given a width, and pixelated -
  // a dagger is tall and narrow and a cuirass wide.
  assert.match(CSS, /\.hud-qicon \{ display: block; max-width: 44px; max-height: 44px; image-rendering: pixelated; \}/);
  // THE STRIP: 36x4 under the art, brass, and the health bar's red
  // below the worn line.
  // QS5: the durability gauge IS the cell's two lower edges - no strip
  // inside the art, and the old rules are gone with it.
  assert.doesNotMatch(CSS, /hud-qbar/, 'the strip under the sprite is gone from the sheet');
  assert.doesNotMatch(HUD, /hud-qbar/, '...and from the DOM');
  assert.match(CSS, /\.hud-qcell\.hasbar \.hud-qwear \{ display: block; \}/);
  assert.match(CSS, /\.hud-qwfill \{ fill: none; stroke: var\(--brass\); stroke-width: 5; \}/);
  assert.match(CSS, /\.hud-qcell\.worn \.hud-qwfill \{ stroke: #d98074; \}/);
  // The stroke is INSIDE the rhombus: the cell is clipped to that shape
  // and a stroke on the boundary loses its outer half.
  assert.match(HUD, /const WEAR_INSET = 44;/);
  assert.match(HUD, /gauge\.setAttribute\('shape-rendering', 'crispEdges'\);/);
  assert.match(HUD, /const SVG_NS = 'http:\/\/www\.w3\.org\/2000\/svg';/, 'an SVG node minted by createElement draws nothing');
  assert.match(HUD, /export const QUICK_WORN_PCT = 40;/);
  assert.match(HUD, /const worn = s\.condition < QUICK_WORN_PCT;/);
  // THE COUNT: tabular, and at zero it takes the classic shadowed pair
  // this UI has always used for what is urgent.
  assert.match(CSS, /\.hud-qcount \{[^}]*font-variant-numeric: tabular-nums;/);
  assert.match(CSS, /\.hud-qcell\.ghost \.hud-qcount \{ color: rgb\(243,239,44\); text-shadow: 2px 2px 0 rgb\(93,77,12\); \}/);
  // THE STATES.
  assert.match(CSS, /\.hud-qcell\.sheathed \{ opacity: 0\.5; \}/);
  assert.match(CSS, /\.hud-qcell\.ghost \.hud-qicon, \.hud-qcell\.ghost \.hud-qinit \{ filter: grayscale\(1\); opacity: 0\.4; \}/);
  // THE SOCKET - the arc's recorded departure from PX30b's "each plaque
  // only when filled". The SHAPE is the readout, and a diamond with a
  // corner missing is not a diamond.
  assert.match(CSS, /\.hud-qcell\.socket \.hud-qframe \{ background: rgba\(125,116,96,0\.35\); \}/);
  assert.match(CSS, /\.hud-qcell\.socket \.hud-qbody, \.hud-qcell\.socket \.hud-qcount \{ display: none; \}/);
  assert.match(HUD, /DEPARTURE 1 - AN EMPTY CELL IS A SOCKET, NOT AN ABSENCE/);
  // THE TAGS at the four outer points, and hidden when nothing is bound.
  for (const [cls, rule] of [['hud-qstop', /left: 50%; top: 0;/], ['hud-qsbottom', /left: 50%; top: 100%;/],
    ['hud-qsleft', /left: 0; top: 50%;/], ['hud-qsright', /left: 100%; top: 50%;/]]) {
    const at = CSS.indexOf(`.${cls} {`);
    assert.ok(at > 0, `.${cls} is placed`);
    assert.match(CSS.slice(at, CSS.indexOf('}', at)), rule);
  }
  assert.match(CSS, /\.hud-qstag \{ display: none; position: absolute;/);
  assert.match(CSS, /\.hud-qstag\.on \{ display: flex; \}/);
  // The narrow sheet shrinks the whole thing by the same one number...
  assert.match(CSS, /--qs-cell: 60px; --qs-box: 124px;/);
  // ...and lifts it over the touch layer's bottom-right button row.
  // ui/touch.js puts Jump, the sheathe, the mode cycle and the social
  // door there at edge 16, 48 tall; the leftmost starts at W - 280,
  // which is x 150 on a 430px phone - and the right tag reached it.
  // 76 is the number ui/partyPanel.js already uses to clear that
  // layer's other row.
  assert.match(CSS, /bottom: calc\(76px \+ 30px \* \(var\(--hud-scale\) - 1\) \+ env\(safe-area-inset-bottom, 0px\)\); \}/);
  assert.match(CSS, /\.hud-quick\.stickclear \{ left: calc\(160px \+ env\(safe-area-inset-left, 0px\)\); \}/);
});

test('QS3: the block is written only when it CHANGED, and a phone can press it', () => {
  // ONE SIGNATURE for twenty nodes - the file's own updated-not-rebuilt
  // law, applied to a block rather than twenty times over.
  assert.match(HUD, /if \(last\.quick === sig\) return;\s*\n\s*last\.quick = sig;/);
  assert.match(HUD, /\.\.\.\['main', 'off', 'c1', 'c2'\]\.map\(\(k\) => tagKey\(tags\[k\]\)\),/, 'the tags are in the signature');
  // ...and an ICON is requested only when the cell's ITEM changed, not
  // when a condition ticked.
  assert.match(HUD, /if \(last\[`\$\{slot\}Icon`\] === key\) return;/);
  assert.match(HUD, /onReady: \(\) => \{ last\[`\$\{slot\}Icon`\] = null; last\.quick = null; \}/,
    'a cold record marks the block dirty for the NEXT frame rather than rebuilding inside a render');
  // The icon is the inventory's own, out of the module both import -
  // NOT by importing that 2200-line window into the HUD.
  assert.match(HUD, /import \{ modelIconUrl \} from '\.\/itemIconUrl\.js';/);
  assert.doesNotMatch(HUD, /from '\.\/enhancedInventory\.js'/, 'the window is named in a comment and imported nowhere');
  assert.match(read('src/ui/enhancedInventory.js'), /import \{ modelIconUrl as modelIconUrlOf \} from '\.\/itemIconUrl\.js';/,
    'and the window still draws its tiles with it');
  assert.match(read('src/ui/enhancedInventory.js'), /const modelIconUrl = \(item, size\) => modelIconUrlOf\(item, size, deps\.fpArm\);/,
    'through its own injected rig, exactly as before');
  assert.doesNotMatch(read('src/ui/itemIconUrl.js'), /^import /m, 'the shared module imports nothing at all');
  // DEPARTURE 2: on a phone the cells are the only control for these
  // actions (AUDIT SOC C9's lesson). The `.hud` root stays unclickable.
  assert.match(CSS, /@media \(pointer: coarse\) and \(hover: none\) \{\s*\n\s*\.hud-qcell \{ pointer-events: auto; touch-action: none; \}/);
  // AUDIT QS F10: under the same touch-first pair a KEYBOARD chip hides and a pad's glyph stays.
  assert.match(CSS, /@media \(pointer: coarse\) and \(hover: none\) \{[^}]*\}[\s\S]*?\.hud-qstag\.key \{ display: none; \}\s*\n\}/);
  assert.match(HUD, /part\.tag\.classList\.toggle\('key', !!t && t\.kind === 'key'\);/);
  // AUDIT QS F8: the tap is a FINGER's - a mouse on a touchscreen machine is refused.
  assert.match(HUD, /const finger = \(e\) => !\(e && e\.pointerType != null && e\.pointerType !== 'touch' && e\.pointerType !== 'pen'\);/);
  // AUDIT QS F1: the CELL is the rhombus, so the hit test is the picture's.
  assert.match(CSS, /\.hud-qcell \{ position: absolute; width: var\(--qs-cell\); height: var\(--qs-cell\);\s*\n\s*clip-path: polygon\(50% 0, 100% 50%, 50% 100%, 0 50%\); \}/);
  assert.match(CSS, /\.hud \{ position: fixed; inset: 0; z-index: 4; pointer-events: none;/);
  // QS6: the two consumables and the spell chip take a HOLD as well as a
  // tap - the phone's own half of Mac's "hold the keybind to switch" -
  // and the off cell takes a tap alone, because what it offers is what
  // is in that hand rather than a list.
  assert.match(HUD, /bindHold\(cells\.c1\.cell, 'c1', \(\) => liveOpts\.quickUse\?\.\(1\)\);/);
  assert.match(HUD, /bindHold\(cells\.c2\.cell, 'c2', \(\) => liveOpts\.quickUse\?\.\(2\)\);/);
  assert.match(HUD, /bindHold\(spellChip, 'spell', \(\) => liveOpts\.quickSpell\?\.\(\)\);/);
  assert.match(HUD, /arm = setTimeout\(\(\) => \{ cycled = true; turn\(\); step = setInterval\(turn, QUICK_STEP_MS\); \}, QUICK_HOLD_MS\);/);
  assert.match(HUD, /if \(!held\) act\(\);/, 'a hold performs nothing on release - the choosing was the act');
  assert.match(HUD, /if \(offKind === 'swap'\) liveOpts\.quickSwap\?\.\(\);/);
  // bound ONCE, in build - a frame binds nothing
  // bound ONCE, in build - a frame binds nothing. QS6 made them FIVE
  // call sites, not five listeners: `bindHold` subscribes the four
  // edges a hold needs (down, up, cancel, leave) and is called three
  // times, and the off cell's tap is the fifth site.
  assert.equal((HUD.match(/addEventListener\(/g) ?? []).length, 5, 'five listener sites, and they are these five');
  assert.equal((HUD.match(/\bbindHold\(/g) ?? []).length, 3, 'bindHold is called for exactly three slots');
  for (const e of ['pointerdown', 'pointerup', 'pointercancel', 'pointerleave']) {
    assert.ok(HUD.includes(`addEventListener('${e}'`), `a hold hears ${e} - a finger that slides off must not fire the slot`);
  }
  assert.doesNotMatch(HUD, /registerOverlay/, 'a readout still goes through no door');
  // The main cell takes no action at all - a tap on the weapon is not
  // a swing through the HUD and not a draw either.
  assert.doesNotMatch(HUD, /cells\.main\.cell\.addEventListener/);
});

test('QS4: every host hands drawHud the diamond\'s three doors - a tap on a phone is a control only if the host gave one (mutant: a host that forwards none, so the cells are dead on the one platform the departure exists for)', () => {
  for (const p of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeonContext.js']) {
    assert.match(read(p), /quickUse: \(n\) => quickUse\(n\), quickSwap: \(\) => quickSwap\(\), quickOffHand: \(\) => quickOffHand\(\),/, `${p} hands the doors to drawHud`);
  }
  assert.match(read('src/scenes/worldModes.js'), /quickUse: \(n\) => interiorKeyCtx\.quickUse\(n\), quickSwap: \(\) => interiorKeyCtx\.quickSwap\(\),/,
    'the interior mode hands its OWN ctx\'s, because its rig is its own');
});

test('QS3: drawHud forwards the sheathe state and the two phone doors', () => {
  const hud = read('src/ui/hud.js');
  // `weaponSheathed` has reached drawHud since AUDIT 28 W2 (the arrow
  // counter's gate) and was never passed on, so the enhanced skin could
  // not tell a drawn sword from a put-away one.
  assert.match(hud, /weaponSheathed: weaponSheathed,/);
  assert.match(hud, /quickUse: quickUse \?\? null,\s*\n\s*quickSwap: quickSwap \?\? null,\s*\n\s*quickOffHand: quickOffHand \?\? null,[^\n]*\n\s*quickSpell: quickSpell \?\? null,/);
  assert.match(hud, /quickUse = null, quickSwap = null, quickOffHand = null, quickSpell = null \} = \{\}\) \{/);
  // ...on ONE line, and the new keys BELOW the ones the bible cites by
  // line number: a split in this signature moved four Port-Status src
  // cites and test/citedrift.test.js caught every one of them.
  assert.match(hud, /readied = null, weapon = null, weaponSheathed = true, quickUse = null, quickSwap = null, quickOffHand = null, quickSpell = null \} = \{\}\)/);
  // ...and the view is composed from it, with the entity drawHud
  // already hands over.
  assert.match(HUD, /quickslotView\(vitals, \{ weapon: opts\.weapon \?\? null, sheathed: opts\.weaponSheathed \?\? false,\s*\n\s*readiedIndex: opts\.readied\?\.index \?\? null \}\)/);   // QS6: and which spell is actually in hand
  // THE MODEL IS NOT RESTATED HERE. systems/quickslots.js owns what a
  // slot holds, what a ghost is and what the off hand shows.
  assert.match(HUD, /import \{ quickslotView, quickslotKey, cycleQuickslot, quickslotCycling, spellQuickslot,\s*\n\s*QUICK_HOLD_MS, QUICK_STEP_MS \} from '\.\.\/systems\/quickslots\.js';/);
  assert.doesNotMatch(HUD, /isShieldTemplate|lightSource/, 'the off hand\'s ladder is the model\'s, never a second copy');
  // The pad's family comes from the poller, and "the pad is live" from
  // GP1's own importable latch rather than the layer's local.
  assert.match(HUD, /import \{ controllerLook \} from '\.\.\/player\/lookFilter\.js';/);
  assert.match(HUD, /const controller = controllerLook\(\) && !!family;/);
  const gp = read('src/ui/gamepadInput.js');
  assert.match(gp, /setControllerLook\(usingController\);\s*\n\s*setPadFamily\(padFamilyOf\(pad\.id\)\);/);
  assert.match(gp, /setPadFamily\(null\);   \/\/ QS3: a glyph for a pad nobody is holding is a lie/);
  assert.match(gp, /dispose\(\) \{[^}]*setPadFamily\(null\);/);
});

// ── the states, executed ─────────────────────────────────────────
//
// The same document fake test/audit64_hud.test.js drives the enhanced
// overlay with. It answers layout with nothing, which is why no box is
// asserted on here - only what the module WROTE.
const mkEl = () => ({
  className: '', textContent: '', id: '', rel: '', href: '', src: '', alt: '', children: [], dataset: {},
  style: { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } },
  classList: {
    _s: new Set(),
    add(...c) { c.forEach((x) => this._s.add(x)); }, remove(...c) { c.forEach((x) => this._s.delete(x)); },
    toggle(c, on) { if (on) this._s.add(c); else this._s.delete(c); }, contains(c) { return this._s.has(c); },
  },
  // QS5: the wear gauge is SVG and writes through attributes, so the fake
  // RECORDS them - a setter that swallowed its argument would pin nothing.
  attrs: {},
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'class') this.className = String(v); },
  getAttribute(k) { return this.attrs[k]; },
  removeAttribute(a) { delete this.attrs[a]; this[a] = ''; }, remove() {},
  append(...c) { this.children.push(...c); }, appendChild(c) { this.children.push(c); return c; },
  replaceChildren(...c) { this.children = c; }, addEventListener(type, fn) { (this._on ??= {})[type] = fn; },
});

const find = (node, cls) => {
  if (String(node.className ?? '').split(/\s+/).includes(cls)) return node;
  for (const c of node.children ?? []) { const got = find(c, cls); if (got) return got; }
  return null;
};

test('QS3 the states, executed: the socket, the sheathed hand, the ghost\'s 0, and the tag chips', async () => {
  const prev = globalThis.document;
  // QS5: the fake MARKS the namespace, because an SVG node minted by
  // `createElement` is an unknown HTML element that draws nothing - a fake
  // that answered the same object either way could not tell the two apart.
  globalThis.document = {
    createElement: mkEl, createElementNS: (ns, tag) => Object.assign(mkEl(), { ns }),
    getElementById: () => null, head: mkEl(), body: mkEl(),
  };
  const { drawEnhancedHud, destroyEnhancedHud } = await import('../src/ui/enhancedHud.js');
  const { assignQuickslot, clearQuickslots } = await import('../src/systems/quickslots.js');
  const { setBindings } = await import('../src/ui/input.js');
  const { EQUIP_SLOTS } = await import('../src/characters/paperdoll.js');
  const store = createBindings();
  setBinding(store, 'Digit1', 'QuickUse1');
  setBinding(store, 'Digit2', 'QuickUse2');
  setBinding(store, 'KeyR', 'ReadyWeapon');
  setBindings(store);
  clearQuickslots();
  setPadFamily(null);
  try {
    const weapon = { group: 'Weapons', templateIndex: 121, name: 'Longsword', currentCondition: 12, maxCondition: 40 };
    const heal = { group: 'UselessItems1', templateIndex: 83, name: 'Glass Bottle', potionRecipeKey: 1, stackCount: 3, currentCondition: 1, maxCondition: 1 };
    const gone = { group: 'UselessItems1', templateIndex: 83, name: 'Glass Bottle', potionRecipeKey: 2, stackCount: 1, currentCondition: 1, maxCondition: 1 };
    assignQuickslot('c1', heal);
    assignQuickslot('c2', gone);
    const entity = {
      health: 40, maxHealth: 80, magicka: 0, maxMagicka: 10, fatigue: 100,
      items: [heal], equip: { slots: {} }, lightSource: null,
    };
    // NOTHING IN EITHER HAND, and one slot whose kind has left the pack.
    drawEnhancedHud(entity, 0, 0, { weapon: null, weaponSheathed: true });
    const root = document.body.children.find((n) => n.className === 'hud');
    assert.ok(root, 'the overlay was built');
    const quick = find(root, 'hud-quick');
    assert.ok(quick, 'the diamond block hangs off the root itself');
    const cell = (c) => find(quick, `hud-q${c}`);
    const has = (c, s) => cell(c).classList.contains(s);
    // EVERY CORNER IS STILL THERE - the departure this arc records.
    for (const c of ['main', 'off', 'c1', 'c2']) assert.ok(cell(c), `the ${c} cell exists whatever is in it`);
    assert.ok(has('main', 'socket'), 'an empty hand is a socket, not an absence');
    assert.ok(has('off', 'socket'), 'and so is an empty off hand');
    assert.ok(!has('c1', 'socket'), 'a filled slot is not');
    assert.equal(find(cell('c1'), 'hud-qcount').textContent, '3');
    // THE GHOST keeps its place and reads 0 - the whole point of a slot
    // that keeps its KIND when the pack runs out.
    assert.ok(has('c2', 'ghost'));
    assert.equal(find(cell('c2'), 'hud-qcount').textContent, '0');
    // The tags: the two bound keys, and nothing at all where nothing is.
    const tag = (at) => find(quick, `hud-qs${at}`);
    assert.equal(find(tag('top'), 'hud-qstext').textContent, '1');
    assert.equal(find(tag('bottom'), 'hud-qstext').textContent, '2');
    assert.ok(tag('right').classList.contains('on'), 'ReadyWeapon is bound, so the main corner speaks');
    assert.equal(find(tag('right'), 'hud-qstext').textContent, 'R');
    assert.ok(!tag('left').classList.contains('on'), 'an empty off hand has nothing to press');

    // NOW A WEAPON, SHEATHED, AND THE POTION DRUNK.
    heal.stackCount = 1;
    drawEnhancedHud(entity, 0, 0, { weapon, weaponSheathed: true });
    assert.ok(!has('main', 'socket'));
    assert.ok(has('main', 'sheathed'), 'a put-away weapon is half there');
    assert.ok(has('main', 'hasbar'), 'and it carries its durability');
    // QS5: the gauge is the cell's own lower edges, drained from the
    // bottom point outward - the dash hides what is GONE, so 30% of a
    // 62.2-unit half leaves 43.5 hidden at each side corner.
    assert.equal(find(cell('main'), 'hud-qwfill').attrs['stroke-dashoffset'], '43.5', '12 of 40');
    assert.equal(cell('main').children.filter((n) => n.className === 'hud-qwear').length, 1, 'one gauge per cell');
    assert.equal(find(cell('main'), 'hud-qwear').ns, 'http://www.w3.org/2000/svg', 'minted in the SVG namespace, or it draws nothing');
    // BOTH HALVES START AT THE BOTTOM POINT, which is what makes the two
    // drain together and leaves a stub at the point rather than a gap in
    // the middle of the V.
    for (const p of cell('main').children.find((n) => n.className === 'hud-qwear').children.filter((n) => n.className === 'hud-qwfill')) {
      assert.match(p.attrs.d, /^M 50 94 L (?:6|94) 50$/, 'a half runs from the point outward');
    }
    assert.ok(has('main', 'worn'), 'under 40% it takes the health bar\'s red');
    assert.equal(find(cell('c1'), 'hud-qcount').textContent, '1');
    // DRAWN: the same weapon, and only the class changed.
    drawEnhancedHud(entity, 0, 0, { weapon, weaponSheathed: false });
    assert.ok(!has('main', 'sheathed'));
    // THE PAD TAKES THE TAGS OVER. `controllerLook` is GP1's latch;
    // padFamily is what the poller wrote.
    const { setControllerLook } = await import('../src/player/lookFilter.js');
    setBinding(store, 'JoystickButton0', 'QuickUse1', false);
    setControllerLook(true);
    setPadFamily('ps');
    drawEnhancedHud(entity, 0, 0, { weapon, weaponSheathed: false });
    assert.equal(find(tag('top'), 'hud-qstext').textContent, '', 'the letter gives way');
    assert.match(find(tag('top'), 'hud-qsglyph').src, /^data:image\/svg\+xml/);
    assert.equal(find(tag('top'), 'hud-qsglyph').src, glyphSvg('ps', 'JoystickButton0', { size: 12 }));
    // ...and the mouse takes them back.
    setControllerLook(false);
    setPadFamily(null);
    drawEnhancedHud(entity, 0, 0, { weapon, weaponSheathed: false });
    assert.equal(find(tag('top'), 'hud-qstext').textContent, '1');
  } finally {
    destroyEnhancedHud();
    clearQuickslots();
    setBindings(null);
    setPadFamily(null);
    globalThis.document = prev;
  }
});

test('QS the switch: the features row hides the DIAMOND alone - the caption and the keys stand', () => {
  const HUD = read('src/ui/enhancedHud.js');
  const CSS = read('src/ui/enhancedStyle.js');
  // The read is the prefs shelf's, each frame, guarded on change like every other write here.
  assert.match(HUD, /const off = getPref\('quickslots'\) === false;/);
  assert.match(HUD, /parts\.quick\.classList\.toggle\('nodiamond', off\);/);
  assert.match(HUD, /if \(off\) return;/, 'off skips the cells and the tags, nothing else');
  // ...and the rule hides the diamond, not the block: the mode word lives in the caption.
  assert.match(CSS, /\.hud-quick\.nodiamond \.hud-qdiamond \{ display: none; \}/);
  assert.doesNotMatch(CSS, /\.hud-quick\.nodiamond \{ display: none/);
  // The row exists, on the prefs shelf, on by default, the player's own online.
  const F = read('src/systems/features.js');
  assert.match(F, /id: 'quickslot-diamond',[\s\S]*?control: Object\.freeze\(\{ store: 'prefs', key: 'quickslots', initial: true, online: 'player' \}\)/);
});

// AUDIT QS6 F3 + F4, both DRIVEN: two defects a source pin could not see.
//
//   F4  THE CELL'S CYCLING LAMP NEVER WENT OUT. It was written below the
//       block's signature guard, and when a hold ends nothing else about
//       the block changes - so the write was unreachable and the cell
//       stayed lit for the rest of the session.
//   F3  THE FINGER'S TIMERS OUTLIVED THE HUD. A hold still cycling when a
//       host tears the HUD down leaves a `setInterval` running against a
//       node no `pointerup` can ever reach again.
test('AUDIT QS6 F3/F4: the cycling lamp falls with the hold, and a finger mid-cycle does not outlive the HUD', async () => {
  const prev = globalThis.document;
  const prevSI = globalThis.setInterval, prevCI = globalThis.clearInterval;
  const prevST = globalThis.setTimeout, prevCT = globalThis.clearTimeout;
  globalThis.document = {
    createElement: mkEl, createElementNS: (ns, tag) => Object.assign(mkEl(), { ns }),
    getElementById: () => null, head: mkEl(), body: mkEl(),
  };
  // The timers are counted rather than run: what is pinned is that every
  // one this file starts is stopped, which is a balance and not a delay.
  let live = 0; const started = [];
  globalThis.setTimeout = (fn) => { live++; started.push(fn); return { id: live }; };
  globalThis.clearTimeout = (h) => { if (h) live--; };
  globalThis.setInterval = (fn) => { live++; started.push(fn); return { id: live }; };
  globalThis.clearInterval = (h) => { if (h) live--; };
  const { drawEnhancedHud, destroyEnhancedHud } = await import('../src/ui/enhancedHud.js');
  const q = await import('../src/systems/quickslots.js');
  const { setBindings } = await import('../src/ui/input.js');
  const store = createBindings();
  setBinding(store, 'Digit1', 'QuickUse1');
  setBinding(store, 'Digit3', 'QuickSpell');
  setBindings(store);
  q.clearQuickslots();
  q.resetQuickslotHolds();
  setPadFamily(null);
  try {
    const heal = { group: 'UselessItems1', templateIndex: 83, name: 'Glass Bottle', potionRecipeKey: 1, stackCount: 3, currentCondition: 1, maxCondition: 1 };
    const cure = { group: 'UselessItems1', templateIndex: 83, name: 'Glass Bottle', potionRecipeKey: 2, stackCount: 2, currentCondition: 1, maxCondition: 1 };
    const spark = { index: 5, name: 'Spark', rangeType: 2 };
    const entity = {
      health: 40, maxHealth: 80, magicka: 10, maxMagicka: 10, fatigue: 100,
      items: [heal, cure], spells: [spark, { index: 9, name: 'Shock', rangeType: 2 }],
      equip: { slots: {} }, lightSource: null,
    };
    q.assignQuickslot('c1', heal);
    const draw = (opts = {}) => drawEnhancedHud(entity, 0, 1 / 60, { weapon: null, weaponSheathed: true, ...opts });
    draw();
    const root = document.body.children.find((n) => n.className === 'hud');
    const quick = find(root, 'hud-quick');
    const c1 = find(quick, 'hud-qc1');
    assert.ok(!c1.classList.contains('cycling'), 'nothing is being cycled yet');

    // ── F4 ──────────────────────────────────────────────────────────
    q.cycleQuickslot('c1', { entity });
    assert.equal(q.quickslotCycling(), 'c1');
    draw();
    assert.ok(c1.classList.contains('cycling'), 'the cell a hold is turning wears the lamp');
    // The hold ends. NOTHING else about the block changes - which is
    // exactly why the write below the signature guard was unreachable.
    for (let t = 0; t <= q.QUICK_CYCLE_LINGER_MS + 40; t += 16) q.tickQuickslotHold(0.016, { isHeld: () => false, entity });
    assert.equal(q.quickslotCycling(), null, 'the model let the lamp fall');
    draw();
    assert.ok(!c1.classList.contains('cycling'), 'AND SO DID THE CELL - a lamp that cannot go out is a cell that lies');

    // ── the spell chip, on the same frames ───────────────────────────
    q.setSpellQuickslot(spark);
    draw({ readied: spark });
    const chip = find(root, 'hud-qspell');
    assert.ok(chip.classList.contains('on'), 'the chip is drawn once a spell is in the slot');
    assert.equal(find(chip, 'hud-qspname').textContent, 'Spark');
    assert.ok(chip.classList.contains('readied'), 'and lights for the spell actually in hand');
    assert.ok(!find(root, 'hud-readied').classList.contains('on'), 'so the generic readied chip stands down');
    // A spell readied from the BOOK is not the slot's: both stand.
    draw({ readied: { index: 9, name: 'Shock' } });
    assert.ok(!chip.classList.contains('readied'));
    assert.ok(find(root, 'hud-readied').classList.contains('on'));
    assert.equal(find(root, 'hud-readyname').textContent, 'Shock');

    // ── F3 ──────────────────────────────────────────────────────────
    const before = live;
    c1._on.pointerdown({ pointerType: 'touch', preventDefault() {} });
    assert.equal(live, before + 1, 'a finger down arms one timer');
    c1._on.pointerup({ pointerType: 'touch' });
    assert.equal(live, before, 'and lifting it stops that timer');
    // ...and the case the node cannot answer: torn down mid-cycle.
    c1._on.pointerdown({ pointerType: 'touch', preventDefault() {} });
    started.at(-1)();   // the arm fires: the hold begins cycling on an interval
    assert.ok(live > before, 'a cycling hold is holding timers');
    destroyEnhancedHud();
    assert.equal(live, 0, 'THE TEARDOWN STOPS THEM - a removed node can never deliver the pointerup that would');
  } finally {
    try { destroyEnhancedHud(); } catch { /* already gone */ }
    globalThis.document = prev;
    globalThis.setTimeout = prevST; globalThis.clearTimeout = prevCT;
    globalThis.setInterval = prevSI; globalThis.clearInterval = prevCI;
    q.clearQuickslots();
    q.resetQuickslotHolds();
  }
});
