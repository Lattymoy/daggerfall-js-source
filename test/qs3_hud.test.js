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
  // it: a lit torch is the MOD's key, a swap weapon is QuickSwap, and a
  // shield or an empty socket has nothing to press at all.
  assert.deepEqual(CELL_ACTIONS, { main: 'ReadyWeapon', c1: 'QuickUse1', c2: 'QuickUse2', swap: 'QuickSwap' });
  assert.equal(quickslotOffTag('shield', key), null);
  assert.equal(quickslotOffTag('empty', key), null);
  assert.deepEqual(quickslotOffTag('swap', key), { kind: 'glyph', family: 'xbox', code: 'JoystickButton3' });
  assert.deepEqual(quickslotOffTag('torch', { ...key, readTorchKey: () => 'O' }), { kind: 'key', text: 'O' });
  // Handheld Torches binds a KeyCode name in its own settings, not an
  // InputManager action - so the torch cell is keyboard only and reads
  // the mod's store (HT4 moved its default to O).
  assert.equal(quickslotOffTag('torch', { ...key, readTorchKey: () => 'None' }), null, 'an unbound mod key is no tag either');
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
  // The four cells and the four tags.
  assert.match(HUD, /const cells = \{ c1: cellOf\('c1'\), off: cellOf\('off'\), main: cellOf\('main'\), c2: cellOf\('c2'\) \};/);
  assert.match(HUD, /\[\['c1', 'top'\], \['off', 'left'\], \['main', 'right'\], \['c2', 'bottom'\]\]/);
  for (const c of ['hud-qcell', 'hud-qframe', 'hud-qground', 'hud-qbody', 'hud-qicon', 'hud-qbar', 'hud-qcount', 'hud-qstag']) {
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
  assert.match(HUD, /cap\.append\(cornerWord, readied\);/);
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
  // vitals row's top edge is at 778 - 30 * scale on an 800px viewport
  // (748 at scale 1, 718 at 2 - tools/qs3Probe.mjs). At scale 1 the two
  // never meet, because the bars are centred and this is in a corner;
  // at 2 the bars are 1196px wide and the bottom cell stood in them.
  assert.match(CSS, /bottom: calc\(24px \+ 30px \* \(var\(--hud-scale\) - 1\) \+ env\(safe-area-inset-bottom, 0px\)\);/);
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
  assert.match(CSS, /\.hud-qbar \{ display: none; width: 36px; height: 4px;/);
  assert.match(CSS, /\.hud-qbarfill \{[^}]*background: var\(--brass\); \}/);
  assert.match(CSS, /\.hud-qcell\.worn \.hud-qbarfill \{ background: #d98074; \}/);
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
  assert.match(HUD, /if \(e && e\.pointerType != null && e\.pointerType !== 'touch' && e\.pointerType !== 'pen'\) return;/);
  // AUDIT QS F1: the CELL is the rhombus, so the hit test is the picture's.
  assert.match(CSS, /\.hud-qcell \{ position: absolute; width: var\(--qs-cell\); height: var\(--qs-cell\);\s*\n\s*clip-path: polygon\(50% 0, 100% 50%, 50% 100%, 0 50%\); \}/);
  assert.match(CSS, /\.hud \{ position: fixed; inset: 0; z-index: 4; pointer-events: none;/);
  assert.match(HUD, /cells\.c1\.cell\.addEventListener\('pointerdown', tap\(\(\) => liveOpts\.quickUse\?\.\(1\)\)\);/);
  assert.match(HUD, /cells\.c2\.cell\.addEventListener\('pointerdown', tap\(\(\) => liveOpts\.quickUse\?\.\(2\)\)\);/);
  assert.match(HUD, /if \(offKind === 'swap'\) liveOpts\.quickSwap\?\.\(\);/);
  // bound ONCE, in build - a frame binds nothing
  assert.equal((HUD.match(/addEventListener\(/g) ?? []).length, 3, 'three listeners, and they are these three');
  assert.doesNotMatch(HUD, /registerOverlay/, 'a readout still goes through no door');
  // The main cell takes no action at all - a tap on the weapon is not
  // a swing through the HUD and not a draw either.
  assert.doesNotMatch(HUD, /cells\.main\.cell\.addEventListener/);
});

test('QS3: drawHud forwards the sheathe state and the two phone doors', () => {
  const hud = read('src/ui/hud.js');
  // `weaponSheathed` has reached drawHud since AUDIT 28 W2 (the arrow
  // counter's gate) and was never passed on, so the enhanced skin could
  // not tell a drawn sword from a put-away one.
  assert.match(hud, /weaponSheathed: weaponSheathed,/);
  assert.match(hud, /quickUse: quickUse \?\? null,\s*\n\s*quickSwap: quickSwap \?\? null,/);
  assert.match(hud, /quickUse = null, quickSwap = null \} = \{\}\) \{/);
  // ...on ONE line, and the new keys BELOW the ones the bible cites by
  // line number: a split in this signature moved four Port-Status src
  // cites and test/citedrift.test.js caught every one of them.
  assert.match(hud, /readied = null, weapon = null, weaponSheathed = true, quickUse = null, quickSwap = null \} = \{\}\)/);
  // ...and the view is composed from it, with the entity drawHud
  // already hands over.
  assert.match(HUD, /quickslotView\(vitals, \{ weapon: opts\.weapon \?\? null, sheathed: opts\.weaponSheathed \?\? false \}\)/);
  // THE MODEL IS NOT RESTATED HERE. systems/quickslots.js owns what a
  // slot holds, what a ghost is and what the off hand shows.
  assert.match(HUD, /import \{ quickslotView, quickslotKey \} from '\.\.\/systems\/quickslots\.js';/);
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
  setAttribute() {}, removeAttribute(a) { this[a] = ''; }, remove() {},
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
  globalThis.document = { createElement: mkEl, getElementById: () => null, head: mkEl(), body: mkEl() };
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
    assert.equal(find(cell('main'), 'hud-qbarfill').style.width, '30.0%', '12 of 40');
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
