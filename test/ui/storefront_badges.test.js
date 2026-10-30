// STOREFRONT (2026-10-29; bible/06-Systems/Storefront.md sections 6 and 8, Battle-Pass.md section 3): the new cosmetic
// vocabulary's art and words on the client - the titles' colours and plates, each plate's painter, the glyphs, the
// portraits and the three auras' looks, run in the shader's own code.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TITLES, GLYPHS, AURAS, ICONS } from '../../src/net/identityToken.js';
import { SHOP_WARE_NAME } from '../../src/net/shopLaw.js';
import {
  TITLE_TEXT, AURA_TEXT, TITLE_RGBA, TITLE_GRADIENT, TITLE_EDGE, TITLE_FLAME, AURA_PAINT, GLYPH_PATH, GLYPH_MARK, GLYPH_RGBA, GLYPH_STROKE,
  GLYPH_DETAIL, FONT_GLYPH_MIN, FONT_GLYPH_MAX, titleBadge, titlePaint, glyphBadges, glyphArtNode, glyphDetails, cssRgba,
  DAEDRIC_CRIMSON, AETHERIUM_BLUE, DWEMER_BRASS,
} from '../../src/ui/playerBadge.js';
import { flameSheetPixels, flameFramePixels, PLATE_PAINTERS } from '../../src/ui/titleFlame.js';
import { ICON_TEXT, ICON_ART, ICON_MATERIALS, profileIconNode } from '../../src/ui/profileIcons.js';
import { EMBLEM_ART, effectEmblemNode } from '../../src/ui/effectEmblems.js';   // AUDIT-STOREFRONT
import { wareArtNode } from '../../src/ui/wareArt.js';
import { EFFECTS } from '../../src/net/effectLaw.js';
import { effectName } from '../../src/ui/effectText.js';
import { SHOP_WARES } from '../../src/net/shopLaw.js';
import { PASS_ALL_GRANTS } from '../../src/net/battlePassLaw.js';
import { GLYPH_LABEL } from '../../src/ui/enhanced/enhancedAccount.js';
import {
  AURA_LOOK, AURA_FS, AURA_GROUND_R, auraPrograms, DOMINION_R, DOMINION_BAND_M, DOMINION_RUNES, DOMINION_SCRIPT, DOMINION_RGB, dominionRatesWhole,
  dominionRuneAt, HELIX_R, HELIX_H, HELIX_RGB, GILDED_RGB, helixRatesWhole, helixStrandAt,
} from '../../src/render/auraRing.js';
import { glslFunctions, GlslDiscard } from '../glsl.mjs';

const NEW_TITLES = ['dawnbringer', 'voidwalker', 'eternalchampion', 'tremorborn', 'heartwaker', 'numidiumecho'];   // PIN MOVED (AURUM): Season One's six titles three
const PLATES = ['dawnbringer', 'voidwalker', 'eternalchampion', 'heartwaker', 'numidiumecho'];
const NEW_GLYPHS = ['oblivion', 'gatesigil', 'gearcrown', 'tonalfork', 'cog'];
const NEW_ICONS = ['aetherium', 'lexicon', 'gearheart', 'gatefire', 'aurbis', 'elderscroll', 'azurastar', 'redmountain', 'hourglass', 'sanguinerose', 'whitegold'];   // PIN MOVED (AURUM): Season One's three, no figure among them, and the daily wares' eight
/** Every shape of a drawing, its children's too (an animation among them), each `[tag, attrs]`. */
const shapesOf = (/** @type {any[]} */ list, moved = false) => list.flatMap(([tag, a = {}, kids = []]) => [[tag, a, moved || !!a.transform], ...shapesOf(kids, moved || !!a.transform)]);
const MOTION = new Set(['animate', 'animateTransform', 'animateMotion', 'set']);
/** A path's points, its commands absolute or relative (an arc's end, a curve's controls and end). */
function pathPoints(/** @type {string} */ d) {
  const toks = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [], pts = [];
  let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0;
  const n = () => Number(toks[i++]);
  const ARGS = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
    const C = cmd.toUpperCase(), rel = cmd !== C;
    if (C === 'Z') { x = sx; y = sy; continue; }
    const a = Array.from({ length: ARGS[C] }, n);
    const ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === 'H') x = ox + a[0];
    else if (C === 'V') y = oy + a[0];
    else if (C === 'A') { x = ox + a[5]; y = oy + a[6]; }
    else { for (let k = 0; k + 1 < a.length - 2; k += 2) pts.push([ox + a[k], oy + a[k + 1]]); x = ox + a[a.length - 2]; y = oy + a[a.length - 1]; }
    pts.push([x, y]);
    if (C === 'M') { sx = x; sy = y; cmd = rel ? 'l' : 'L'; }
  }
  return pts;
}
const NEW_AURAS = ['dominion', 'aetherium', 'gildedcoil'];
const apart = (a, b) => Math.hypot(...[0, 1, 2].map((i) => (a[i] - b[i]) * 255));
const TAU = Math.PI * 2;

// ── THE TITLES ────────────────────────────────────────────────────────

test('STOREFRONT the titles: each its English words (the shop\'s own where it sells it), a colour 40 or more from every other title\'s, a gradient edged in black for the classic face; the five plates and no more, each its painter, its letters edged in its own ink and lit in its own glow (mutants: a colour shared; a plate\'s style no painter has; the Genesis ink on another plate)', () => {
  assert.deepEqual(TITLES.slice(-7, -1) /* PIN MOVED (BLOOD-OF-COLDHARBOUR): Blood of Coldharbour joined the list last */, NEW_TITLES);
  assert.deepEqual(NEW_TITLES.map((k) => TITLE_TEXT[k]), ['Dawnbringer', 'Voidwalker', 'Eternal Champion', 'Tremor-Born', 'Heart-Waker', 'Echo of Numidium']);
  for (const k of ['dawnbringer', 'voidwalker', 'eternalchampion']) assert.equal(SHOP_WARE_NAME[`title:${k}`], TITLE_TEXT[k], `${k}: the receipt's word is the badge's`);
  for (const k of NEW_TITLES) {
    for (const o of TITLES.filter((x) => x !== k)) assert.ok(apart(TITLE_RGBA[k], TITLE_RGBA[o]) > 40, `${k} apart from the ${o}'s (${apart(TITLE_RGBA[k], TITLE_RGBA[o]).toFixed(0)})`);
    assert.equal(TITLE_GRADIENT[k].length, 3, `${k}: three stops`);
    assert.deepEqual([...TITLE_EDGE[k]], [0, 0, 0, 1], `${k}: edged in black`);
  }
  assert.deepEqual(NEW_TITLES.filter((k) => titleBadge({ title: k }).flame), PLATES, 'the name visuals and the pass\'s two on plates, Tremor-Born in its gradient');
  assert.deepEqual(PLATES.map((k) => TITLE_FLAME[k].style), ['rays', 'void', 'fire', 'pulse', 'gears']);
  assert.equal(TITLE_FLAME.genesis.style, 'fire');
  assert.deepEqual(Object.keys(PLATE_PAINTERS).sort(), ['fire', 'gears', 'pulse', 'rays', 'void'], 'one painter a style');
  for (const [k, spec] of Object.entries(TITLE_FLAME)) assert.ok(Object.hasOwn(PLATE_PAINTERS, spec.style), `${k}: a painter for its style`);
  const inks = Object.values(TITLE_FLAME).map((s) => s.ink);
  assert.equal(new Set(inks).size, inks.length, 'each plate its own ink');
  for (const k of PLATES) {
    const p = titlePaint(titleBadge({ title: k })), spec = TITLE_FLAME[k];
    assert.equal(p.backgroundImage, '', `${k}: the plate is the class's, never clipped into the letters`);
    assert.equal(p.color, cssRgba(TITLE_RGBA[k]));
    assert.ok(p.textShadow.startsWith(`0 1px 0 ${spec.ink}, `), `${k}: its own ink`);
    assert.ok(p.textShadow.endsWith(`rgba(${spec.glow.map((c) => Math.round(c * 255)).join(',')},.9)`), `${k}: its own glow`);
  }
  assert.equal(titlePaint(titleBadge({ title: 'genesis' })).textShadow, '0 1px 0 #0b0620, 1px 0 0 #0b0620, -1px 0 0 #0b0620, 0 -1px 0 #0b0620, 0 0 .35em rgba(143,91,255,.9)', 'Genesis as it was');
});

/** A plate's sheet and its lit pixels' colours. */
function sheetOf(k) {
  const spec = TITLE_FLAME[k], s = flameSheetPixels(spec), lit = [];
  for (let f = 0; f < spec.frames; f++) for (let y = 0; y < spec.h - 2; y++) for (let x = 0; x < spec.w; x++) {
    const i = ((f * spec.h + y) * spec.w + x) * 4;
    if (s.data[i + 3] > 128) lit.push([s.data[i], s.data[i + 1], s.data[i + 2]]);
  }
  return { spec, s, lit };
}

test('STOREFRONT the plates: each sheet whole, its gutter clear, the same on every machine, tiling round its strip and looping whole; Dawnbringer warm, Voidwalker violet, Eternal Champion crimson under a gold edge, Heart-Waker brass with the aetherium through it, Echo of Numidium brass with its teeth turning two a loop and a blue glow between (mutants: the gutter filled; a seam round the strip; a jump at the loop; the edge dropped; the teeth still)', () => {
  for (const k of PLATES) {
    const { spec, s, lit } = sheetOf(k), W = spec.w, H = spec.h;
    assert.equal(s.height, H * spec.frames);
    for (let f = 0; f < spec.frames; f++) for (let y = H - 2; y < H; y++) for (let x = 0; x < W; x++) assert.equal(s.data[((f * H + y) * W + x) * 4 + 3], 0, `${k}: the gutter clear`);
    assert.ok(lit.length > W * (H - 2) * spec.frames * 0.5, `${k}: a plate, not a scatter`);
    const one = new Uint8ClampedArray(s.data.length);
    flameFramePixels(spec, 5, one);
    const at = 5 * W * H * 4;
    assert.deepEqual([...one.slice(at, at + W * H * 4)], [...s.data.slice(at, at + W * H * 4)], `${k}: a frame painted alone is the sheet's`);
    const col = (a, b) => { let d = 0; for (let y = 0; y < H; y++) for (let c = 0; c < 4; c++) d += Math.abs(s.data[(y * W + a) * 4 + c] - s.data[(y * W + b) * 4 + c]); return d; };
    const mean = [...Array(W - 1).keys()].reduce((a, x) => a + col(x, x + 1), 0) / (W - 1);
    assert.ok(col(W - 1, 0) <= mean * 2, `${k}: seamless round the strip (${col(W - 1, 0)} against ${mean.toFixed(0)})`);
    const frame = (f) => s.data.subarray(f * W * H * 4, (f + 1) * W * H * 4);
    const step = (a, b) => frame(a).reduce((d, v, i) => d + Math.abs(v - frame(b)[i]), 0);
    const meanStep = [...Array(spec.frames - 1).keys()].reduce((a, f) => a + step(f, f + 1), 0) / (spec.frames - 1);
    assert.ok(step(spec.frames - 1, 0) <= meanStep * 1.5, `${k}: the loop closes as any two frames meet (${step(spec.frames - 1, 0)} against ${meanStep.toFixed(0)})`);
  }
  const share = (lit, f) => lit.filter(f).length / lit.length;
  assert.equal(share(sheetOf('dawnbringer').lit, ([r, , b]) => b > r), 0, 'Dawnbringer: gold and ember, never blue');
  assert.ok(share(sheetOf('voidwalker').lit, ([r, g, b]) => b > g && r > g) > 0.9, 'Voidwalker: violet');
  const champ = sheetOf('eternalchampion');
  assert.equal(share(champ.lit, ([r, , b]) => b > r), 0, 'Eternal Champion: crimson fire, never blue');
  for (let f = 0; f < champ.spec.frames; f += 6) for (let x = 0; x < champ.spec.w; x += 9) {
    const i = ((f * champ.spec.h) * champ.spec.w + x) * 4, [r, g, b] = champ.s.data.slice(i, i + 3);
    assert.ok(r > 200 && g > 150 && b < 200 && champ.s.data[i + 3] > 230, `the gold edge over the fire at ${x}, frame ${f}`);
  }
  const heart = sheetOf('heartwaker').lit;
  assert.ok(share(heart, ([r, , b]) => r > b + 40) > 0.5 && share(heart, ([r, , b]) => b > r) > 0.05, 'Heart-Waker: brass, the aetherium through it');
  const num = sheetOf('numidiumecho');
  assert.ok(share(num.lit, ([r, , b]) => b > r) > 0.05, 'Echo of Numidium: a blue glow between the teeth');
  const top = (f) => [...Array(num.spec.w).keys()].map((x) => num.s.data[((f * num.spec.h) * num.spec.w + x) * 4 + 3] > 0);
  const pitch = num.spec.w / num.spec.tongues, gaps = top(0).filter((on) => !on).length;
  assert.ok(gaps > num.spec.w * 0.3 && gaps < num.spec.w * 0.7, `teeth along the top, gaps between (${gaps})`);
  const shift = (num.spec.w * 2 / num.spec.tongues) * (6 / num.spec.frames);   // two teeth a loop: six frames on, a quarter of that
  const moved = top(6), still = top(0);
  const off = (d) => still.filter((on, x) => on !== moved[((x + Math.round(d)) % num.spec.w + num.spec.w) % num.spec.w]).length;
  assert.ok(off(-shift) < off(0) && off(-shift) <= 4, `the top teeth turned on by ${shift} px (${off(-shift)} against ${off(0)} still) - pitch ${pitch}`);
});

// ── THE GLYPHS ────────────────────────────────────────────────────────

test('STOREFRONT the glyphs: each a path in its 16-unit box, a classic mark of its own inside the font, its label on the card, a colour, filled or stroked as drawn, its details inside the box and drawn over it (mutants: a mark another glyph has; a detail lost; the sigil filled)', () => {
  assert.deepEqual(GLYPHS.slice(-6, -1) /* PIN MOVED (BLOOD-OF-COLDHARBOUR): the Coldharbour rose joined the list last */, NEW_GLYPHS);
  assert.deepEqual(NEW_GLYPHS.map((g) => GLYPH_LABEL[g]), ['Oblivion Sigil', 'Gate Sigil', 'Brass Crown', 'Tonal Fork', 'Dwemer Cog']);
  for (const g of ['oblivion', 'gatesigil']) assert.equal(SHOP_WARE_NAME[`glyph:${g}`], GLYPH_LABEL[g], `${g}: the receipt's word is the card's`);   // PIN MOVED (PASS-PANELS): the Brass Crown a folio's now, no receipt names it
  const marks = Object.values(GLYPH_MARK);
  for (const g of NEW_GLYPHS) {
    const m = GLYPH_MARK[g];
    assert.ok(m.length === 1 && m.charCodeAt(0) >= FONT_GLYPH_MIN && m.charCodeAt(0) <= FONT_GLYPH_MAX, `${g}: one character the font has`);
    assert.equal(marks.filter((x) => x === m).length, 1, `${g}: no other glyph's mark`);
    for (const n of GLYPH_PATH[g].match(/-?\d+(\.\d+)?/g).map(Number)) assert.ok(n >= 0 && n <= 16, `${g}: inside its box (${n})`);
    assert.ok(Array.isArray(GLYPH_RGBA[g]));
    for (const d of glyphDetails(GLYPH_DETAIL[g])) for (const n of d.path.match(/-?\d+(\.\d+)?/g).map(Number)) assert.ok(n >= 0 && n <= 16, `${g}'s detail inside the box`);
  }
  assert.deepEqual(NEW_GLYPHS.map((g) => GLYPH_STROKE[g]), [true, false, false, true, false], 'the sigil and the fork stroked, the gate, the crown and the cog filled');
  assert.deepEqual(NEW_GLYPHS.map((g) => glyphDetails(GLYPH_DETAIL[g]).length), [2, 2, 1, 0, 1], 'the eye and its slit, the portal and its swirl, the gem, the hub');
  assert.equal(GLYPH_RGBA.gatesigil, DAEDRIC_CRIMSON);
  assert.equal(GLYPH_RGBA.cog, DWEMER_BRASS);
  const doc = { createElementNS: (_ns, tag) => { const n = { tag, attrs: {}, children: [], style: {}, setAttribute(k, v) { n.attrs[k] = v; }, append(...c) { n.children.push(...c); } }; return n; } };
  for (const g of NEW_GLYPHS) {
    const b = glyphBadges({ glyphs: [g] })[0];
    const svg = glyphArtNode(doc, b, 'x');
    assert.equal(svg.children[0].attrs.d, GLYPH_PATH[g]);
    assert.equal(svg.children.length, 1 + glyphDetails(GLYPH_DETAIL[g]).length, `${g}: its shape and its details`);
  }
});

// ── THE PORTRAITS ─────────────────────────────────────────────────────

test('STOREFRONT the portraits (AURUM, the owner: "For profile icons no figures should be used. Ensure some are fully animated and go beyond with detail"): Season One\'s three and the daily wares\' eight, each its words, drawn in its field, its shapes clipped to it and its bezel; no figure among them; more than half of them move, and a still drawing (less motion) carries no motion at all (mutants: a figure kept; the motion kept for a still drawing; a shape outside the field)', () => {
  assert.deepEqual(ICONS.slice(4, 4 + NEW_ICONS.length), NEW_ICONS);   // PIN MOVED (GUILD-SHOP, at the merge of main): after the festival's four, the Guild Crest after them
  for (const gone of ['centurion', 'spider', 'sphere', 'colossus', 'numidium']) assert.ok(!ICONS.includes(gone) && !Object.hasOwn(ICON_ART, gone), `${gone}: a figure, gone`);
  assert.deepEqual(NEW_ICONS.map((k) => ICON_TEXT[k]), ['Aetherium Shard', 'Dwemer Lexicon', 'Gearheart', 'Gate of Flame', 'The Aurbis', 'Elder Scroll', 'Azura\'s Star', 'Red Mountain', 'Turning Hourglass', 'Sanguine Rose', 'White-Gold Tower']);
  const doc = { createElementNS: (_ns, tag) => { const n = { tag, attrs: {}, children: [], setAttribute(k, v) { n.attrs[k] = v; }, append(...c) { n.children.push(...c); } }; return n; } };
  const tree = (n) => [n, ...n.children.flatMap(tree)];
  const moving = NEW_ICONS.filter((k) => shapesOf(ICON_ART[k].shapes).some(([tag]) => MOTION.has(tag)));
  assert.deepEqual(moving, ['aetherium', 'lexicon', 'gearheart', 'gatefire', 'aurbis', 'elderscroll', 'azurastar', 'redmountain', 'hourglass'], 'the rose and the tower are still; the shard\'s stars twinkle');
  for (const k of NEW_ICONS) {
    const svg = profileIconNode(doc, k, 'px-icon', 48, { still: false });
    const [defs, field, pic, ...rim] = svg.children;
    assert.deepEqual([defs.tag, field.tag, pic.tag, pic.children.length], ['defs', 'circle', 'g', ICON_ART[k].shapes.length], `${k}: its defs, its field and its shapes`);
    assert.ok(['brass', 'gold', 'obsidian', 'silver'].includes(ICON_ART[k].bezel) && rim.length > 0, `${k}: its bezel`);
    const laid = new Set(tree(defs).map((c) => c.attrs.id).filter(Boolean));
    for (const n of [...tree(pic), ...rim.flatMap(tree)]) for (const v of Object.values(n.attrs)) for (const m of String(v).match(/url\(#[^)]+\)/g) ?? []) assert.ok(laid.has(m.slice(5, -1)), `${k}: ${m} laid`);
    assert.equal(svg.attrs['aria-label'], ICON_TEXT[k]);
    const still = profileIconNode(doc, k, 'px-icon', 48, { still: true });
    assert.equal(tree(still).filter((n) => MOTION.has(n.tag)).length, 0, `${k}: a still drawing moves nothing`);
    if (moving.includes(k)) assert.ok(tree(svg).some((n) => MOTION.has(n.tag)), `${k}: it moves`);
    for (const [tag, a, moved] of shapesOf(ICON_ART[k].shapes)) {
      if (MOTION.has(tag) || moved) continue;   // a motion's own path, and a shape in a group moved whole, are not places in the field
      const pts = [];
      if (tag === 'circle' || tag === 'ellipse') pts.push([a.cx - (a.r ?? a.rx), a.cy], [a.cx + (a.r ?? a.rx), a.cy], [a.cx, a.cy - (a.r ?? a.ry)], [a.cx, a.cy + (a.r ?? a.ry)]);
      else if (tag === 'path') pts.push(...pathPoints(a.d));
      for (const [x, y] of pts) assert.ok(Number.isFinite(x) && Number.isFinite(y), `${k}: ${tag} a number at ${x},${y}`);
      if (tag === 'rect' || !pts.length || (tag === 'circle' && a.cx === 0 && a.cy === 0)) continue;   // a field's wash fills the square; a mote placed by its motion
      const xs = pts.map(([x]) => x), ys = pts.map(([, y]) => y);   // the shape's box reaches into the field: never drawn wholly under the rim
      const nx = Math.min(Math.max(32, Math.min(...xs)), Math.max(...xs)), ny = Math.min(Math.max(32, Math.min(...ys)), Math.max(...ys));
      assert.ok(Math.hypot(nx - 32, ny - 32) <= 31.5, `${k}: ${tag} reaches into the field`);
    }
  }
});

test('AUDIT-STOREFRONT every portrait, the festival\'s four, the season\'s three and the daily wares\' eight: drawn lit - its shapes clipped to its field, inside it, in a bezel, every paint it names laid in its own defs under ids of its own, two drawings never sharing one (mutants: the clip dropped; a paint never laid; the bezel dropped; two drawings\' ids one)', () => {
  const doc = { createElementNS: (_ns, tag) => { const n = { tag, attrs: {}, children: [], setAttribute(k, v) { n.attrs[k] = v; }, append(...c) { n.children.push(...c); } }; return n; } };
  const ids = (svg) => svg.children[0].children.map((c) => c.attrs.id);
  for (const k of Object.keys(ICON_ART)) {
    const svg = profileIconNode(doc, k, 'px-icon', 48), [defs, , pic, ...rim] = svg.children;
    assert.ok(ICON_ART[k].bezel && rim.length >= 3, `${k}: in its bezel`);
    const clip = defs.children.find((c) => c.tag === 'clipPath' && pic.attrs['clip-path'] === `url(#${c.attrs.id})`);   // AURUM: a drawing may lay clips of its own
    assert.deepEqual([clip?.children[0]?.tag, clip?.children[0]?.attrs.r], ['circle', '31'], `${k}: its picture clipped to the field`);
    const deep = (n) => [n, ...n.children.flatMap(deep)];   // AURUM: a shape's children, a filter's and a clip's, laid and named too
    const laid = new Set(deep(defs).map((c) => c.attrs.id).filter(Boolean));
    for (const n of [...deep(pic), ...rim.flatMap(deep)]) for (const v of Object.values(n.attrs)) for (const m of String(v).match(/url\(#[^)]+\)/g) ?? []) assert.ok(laid.has(m.slice(5, -1)), `${k}: ${m} laid`);
    const again = profileIconNode(doc, k, 'px-icon', 48);
    assert.equal(ids(again).filter((id) => laid.has(id)).length, 0, `${k}: a second drawing's ids its own`);
  }
});

test('AUDIT-STOREFRONT the effects\' emblems and every ware\'s picture: an emblem for every effect the law knows, each a round field, its shapes inside it, every paint it names its own; a picture for every piece a bundle gives and every reward the pass gives, a title its ribbon (mutants: an effect with no emblem; a glyph bare beside the medallions; a title unpictured)', () => {
  const doc = { createElementNS: (_ns, tag) => { const n = { tag, attrs: {}, style: {}, children: [], setAttribute(k, v) { n.attrs[k] = v; }, append(...c) { n.children.push(...c); } }; return n; } };
  assert.deepEqual(Object.keys(EMBLEM_ART).sort(), EFFECTS.map((e) => `${e.slot}:${e.key}`).sort(), 'an emblem an effect');
  // PIN MOVED (AUDIT-STOREFRONT II, the owner: "the glyphs for the horse and the general art of those icons is so bad"):
  // drawn by the profile icons' engine - a bezel, every paint laid and its own, moving, and still for less motion
  const deep = (n) => [n, ...(n.children ?? []).flatMap(deep)];
  const MOTION = new Set(['animate', 'animateTransform', 'animateMotion', 'set']);
  for (const id of Object.keys(EMBLEM_ART)) {
    const [slot, key] = id.split(':'), svg = effectEmblemNode(doc, slot, key, 'x', 32, { still: false });
    assert.equal(svg.attrs['aria-label'], effectName(slot, key));
    const [defs, , pic, ...rim] = svg.children;
    assert.ok(EMBLEM_ART[id].bezel && rim.length >= 3, `${id}: in its bezel`);
    const laid = new Set(deep(defs).map((c) => c.attrs.id).filter(Boolean));
    for (const n of [...deep(pic), ...rim.flatMap(deep)]) for (const v of Object.values(n.attrs)) for (const m of String(v).match(/url\(#[^)]+\)/g) ?? []) assert.ok(laid.has(m.slice(5, -1)), `${id}: ${m} laid`);
    assert.ok(deep(pic).some((n) => MOTION.has(n.tag)), `${id}: it moves`);
    assert.equal(deep(effectEmblemNode(doc, slot, key, 'x', 32, { still: true })).filter((n) => MOTION.has(n.tag)).length, 0, `${id}: still for less motion`);
  }
  // each horse drawn whole - the one head and neck, its ears and its muzzle clear of the rim, in its frame
  const heads = Object.keys(EMBLEM_ART).filter((id) => id.startsWith('mount:')).map((id) => {
    const frame = EMBLEM_ART[id].shapes.find((sh) => sh[0] === 'g' && /scale/.test(sh[1].transform ?? ''));
    return { id, frame, head: frame?.[2].find((sh) => sh[0] === 'path' && sh[1].d.startsWith('M37 64'))?.[1].d };
  });
  assert.equal(heads.length, 4);
  assert.equal(new Set(heads.map((h) => h.head)).size, 1, 'one horse, dressed four ways');
  for (const { id, frame, head } of heads) {
    assert.ok(head, `${id}: its head`);
    const [, tx, ty, k] = /translate\(([\d.]+) ([\d.]+)\) scale\(([\d.]+)\)/.exec(frame[1].transform).map(Number);
    for (const [x, y] of [[35.4, 2.4], [42.6, 4.2], [8.6, 46.6]]) assert.ok(Math.hypot(tx + k * x - 32, ty + k * y - 32) < 28, `${id}: (${x}, ${y}) inside the rim`);
  }
  assert.equal(effectEmblemNode(doc, 'kill', 'nope'), null);
  assert.equal(effectEmblemNode({}, 'kill', 'pyre'), null);
  const pieces = [...new Set(SHOP_WARES.filter((w) => w.kind === 'bundle').flatMap((w) => w.gives))];
  const rewards = PASS_ALL_GRANTS;   // PIN MOVED (PASS-PANELS): every item a folio holds - no booster or pass is sold any more
  for (const id of [...pieces, ...rewards]) {
    const art = wareArtNode(doc, id, 48, 'x');
    assert.ok(art && art.tag === 'svg', `${id}: its picture`);
    assert.equal(art.attrs['aria-hidden'], 'true', `${id}: the name beside it says it`);
    if (/^(glyph|aura|title):/.test(id)) assert.ok(art.children.length >= 6 && art.children[2].children.length === 2, `${id}: in its medallion - its mark over the field, in the gold bezel`);   // PIN MOVED (AUDIT-STOREFRONT II): the icons' bezel
  }
  assert.equal(wareArtNode(doc, 'bundle:portalmaster'), null, 'a bundle is its pieces');
});

// ── THE AURAS ─────────────────────────────────────────────────────────

const run = (aura, kind, vP, { t = 13.7, kindle = 1 } = {}) => {
  const look = AURA_LOOK[aura];
  const f = glslFunctions(AURA_FS, {
    vP, vWorld: [0, 0, 0], vS: [0, 0, 0], uKind: kind, uAura: look.kind, uTime: t, uSeed: 0, uKindle: kindle, uRingR: look.ringR, uGroundR: AURA_GROUND_R,
    uFlameH: look.flameH, uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: [0, 1.2, 5], uAt: [0, 0, 0], uFocus: [0, 0, 0, 0],
    uResLit: Array(48).fill(0), dFdx: () => [0.001, 0, 0], dFdy: () => [0, 0.001, 0],
  });
  f.main();
  return f.globals.o;
};
const polar = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];

test('STOREFRONT the auras: each its words and its title\'s paint, a look of its own kind - the Dominion premultiplied, its black covering; the coils added whole, the coil about the body to past the crown - every rate whole over the clock, each look\'s program its own (mutants: a kind shared; the Dominion added; a rate off the clock)', () => {
  assert.deepEqual(AURAS.slice(-5, -2) /* PIN MOVED (BLOOD-OF-COLDHARBOUR): the Vampiric Haze joined the list last */, NEW_AURAS);   // PIN MOVED (the capstone): the Aetherium Wings after them
  assert.deepEqual(NEW_AURAS.map((a) => AURA_TEXT[a]), ['Daedric Dominion', 'Aetherium Coil', 'Gilded Coil']);
  assert.equal(SHOP_WARE_NAME['aura:dominion'], AURA_TEXT.dominion);
  assert.deepEqual(NEW_AURAS.map((a) => AURA_PAINT[a]), ['eternalchampion', 'heartwaker', 'numidiumecho'], 'each in the paint of the title it comes beside');
  assert.deepEqual(NEW_AURAS.map((a) => AURA_LOOK[a].kind), [16, 17, 18]);
  const kinds = Object.values(AURA_LOOK).map((l) => l.kind);
  assert.equal(new Set(kinds).size, kinds.length, 'no two looks one kind');
  assert.deepEqual({ ...AURA_LOOK.dominion }, { kind: 16, ringR: DOMINION_R, flameH: 1.5, glyphs: 0, shade: true });
  assert.deepEqual({ ...AURA_LOOK.aetherium }, { kind: 17, ringR: HELIX_R, flameH: HELIX_H, glyphs: 0 });
  assert.deepEqual({ ...AURA_LOOK.gildedcoil }, { kind: 18, ringR: HELIX_R, flameH: HELIX_H, glyphs: 0 });
  assert.ok(HELIX_R > 0.5 && HELIX_R < AURA_GROUND_R && HELIX_H > 1.9, 'the coil clear of the shoulders, past the crown');
  assert.equal(dominionRatesWhole(), true);
  assert.equal(helixRatesWhole(), true);
  assert.deepEqual([...DOMINION_RGB.crimson], [...DAEDRIC_CRIMSON.slice(0, 3)]);
  assert.deepEqual([...HELIX_RGB.blue], [...AETHERIUM_BLUE.slice(0, 3)]);
  assert.ok(GILDED_RGB.bright > HELIX_RGB.bright, 'the gilded the brighter');
  // THE VISUAL PASS: the ribbon's middle as the shader sums it (helixLook) - the gilded's gold, never past white
  const mid = (/** @type {any} */ p) => p.brass.map((/** @type {number} */ c, /** @type {number} */ i) => (c * 0.55 + p.shine[i] * 0.35) * p.bright);
  assert.ok(mid(GILDED_RGB)[0] <= 1.05 && mid(GILDED_RGB)[2] < 0.5 * mid(GILDED_RGB)[0], 'the gilded ribbon gold at its middle, not cream');
  assert.equal(new Set(DOMINION_SCRIPT).size, DOMINION_RUNES, 'every letter its own');
  assert.ok(DOMINION_SCRIPT.every((c) => c & 1), 'every letter on its stem');
  for (const k of [16, 17, 18]) {
    const [[vs, fs]] = auraPrograms(k);
    assert.ok(vs.includes(`const int uAura = ${k};`) && fs.includes(`const int uAura = ${k};`));
  }
});

test('STOREFRONT the Daedric Dominion, the shader RUN: a letter of its script lit crimson on its stem at the clock\'s own turn, dark between letters; its band black (it covers), the floor past its thorns untouched; nothing before it kindles; embers on its wall (mutants: the script still; the cover dropped; the stem not lit)', () => {
  for (const t of [3.1, 44.6, 101.9]) {
    for (const a of [0.4, 2.2, 4.9]) {
      // the letter at `a`, its middle (on its stem) and the gap after it
      const cell = TAU / DOMINION_RUNES, turn = a - TAU * t / 30, k = Math.floor(turn / cell + 0.5);
      const mid = TAU * t / 30 + k * cell, gap = mid + cell / 2;
      assert.equal(dominionRuneAt(mid, t), ((k % DOMINION_RUNES) + DOMINION_RUNES) % DOMINION_RUNES);
      const on = run('dominion', 0, polar(DOMINION_R, mid), { t }), off = run('dominion', 0, polar(DOMINION_R, gap), { t });
      assert.ok(on[0] > 0.3 && on[0] > on[1] * 2 && on[0] > on[2] * 2, `the stem crimson at ${t}, ${a} (${on.map((x) => x.toFixed(2))})`);
      assert.ok(off[0] < on[0] * 0.6, `dark between letters (${off[0].toFixed(2)} against ${on[0].toFixed(2)})`);
      assert.ok(on[3] > 0.85 && off[3] > 0.85, 'the band covers');
    }
  }
  const past = run('dominion', 0, polar(DOMINION_R + DOMINION_BAND_M + 0.42, 0.2));
  assert.ok(past[3] < 0.05 && past[0] < 0.05, `the floor past the thorns untouched (${past.map((x) => x.toFixed(2))})`);
  const cold = run('dominion', 0, polar(DOMINION_R, 0.4), { kindle: 0 });
  assert.deepEqual(cold.map((x) => Math.abs(x)), [0, 0, 0, 0], 'nothing before it kindles');
  // the first ember, where the shader's own hash puts it (dominionWall): lit there, and not a hand off it
  const fract = (x) => x - Math.floor(x), circ = TAU * DOMINION_R, et = 33.6;
  const h1 = fract(Math.sin(2.3) * 43758.5453), h2 = fract(Math.sin(5.9) * 24634.6345), mv = fract(et / 5 + h2);
  const eu = fract(h1 - 0.06 * Math.sin(TAU * (mv * 2 + h1)) / circ);
  assert.ok(mv > 0.1 && mv < 0.8, `an ember aloft (${mv.toFixed(2)})`);
  const ember = run('dominion', 1, [eu, mv], { t: et }), beside = run('dominion', 1, [fract(eu + 0.05), mv], { t: et });
  assert.ok(ember[0] > 0.2 && ember[0] > beside[0] + 0.15, `an ember rising off it (${ember[0].toFixed(2)} against ${beside[0].toFixed(2)})`);
});

test('STOREFRONT the coils, the shader RUN: the aetherium strand blue where the coil\'s law puts it at that height and clock, the brass half a turn round from it, dark between; its foot a ring of brass at the feet; the gilded\'s brass the brighter and golder; nothing before it kindles (mutants: the strand off its law; the brass on the strand; the coil still)', () => {
  for (const aura of ['aetherium', 'gildedcoil']) {
    for (const [v, t] of [[0.3, 7.1], [0.55, 40.2], [0.7, 93.4]]) {
      const u = helixStrandAt(v, t);
      const strand = run(aura, 1, [u, v], { t }), brass = run(aura, 1, [(u + 0.5) % 1, v], { t }), between = run(aura, 1, [(u + 0.25) % 1, v], { t });
      assert.ok(strand[2] > strand[0] && strand[2] > 0.35, `${aura}: the strand blue at ${v}, ${t} (${strand.map((x) => x.toFixed(2))})`);
      assert.ok(brass[0] > brass[2] && brass[0] > 0.3, `${aura}: the brass half a turn round (${brass.map((x) => x.toFixed(2))})`);
      assert.ok(between[0] + between[1] + between[2] < (strand[0] + strand[1] + strand[2]) * 0.3, `${aura}: dark between`);
    }
    const ring = run(aura, 0, polar(HELIX_R, 1.1)), inside = run(aura, 0, polar(HELIX_R * 0.6, 1.1));
    assert.ok(ring[0] > inside[0] + 0.2, `${aura}: its foot a ring of brass`);
    assert.deepEqual(run(aura, 1, [helixStrandAt(0.3, 7.1), 0.3], { t: 7.1, kindle: 0 }).slice(0, 3), [0, 0, 0], 'nothing before it kindles');
  }
  const v = 0.4, t = 21.3, u = (helixStrandAt(v, t) + 0.5) % 1;
  const plain = run('aetherium', 1, [u, v], { t }), gilded = run('gildedcoil', 1, [u, v], { t });
  assert.ok(gilded[0] + gilded[1] > (plain[0] + plain[1]) * 1.3 && gilded[1] / gilded[0] > plain[1] / plain[0], 'the gilded\'s brass the brighter and golder');
});

test('STOREFRONT no pow of a negative in the new auras (AUDIT STOREFRONT RENDER L5): GLSL leaves pow(x < 0, y) undefined (a driver\'s exp2/log2 answers NaN, and the evaluator\'s Math.pow would hide it) - the Daedric Dominion, the Aetherium Coil and the Gilded Coil, their grounds over the whole disc and their walls over the whole strip, at three clocks: the coils\' ring of light squared as a product (SHADOW-CLOAK\'s pin; mutants: the ring squared by pow)', () => {
  const FS = AURA_FS.replace(/\bpow\(/g, 'auraPowChk(').replace('out vec4 o;', 'out vec4 o;\nfloat powNeg = 0.0;\nfloat auraPowChk(float b, float e) { if (b < 0.0) powNeg = 1.0; return exp(e * log(max(abs(b), 1e-30))); }');
  assert.ok(FS.includes('float powNeg'), 'the guard took');
  const f = glslFunctions(FS, {
    vP: [0, 0], vWorld: [0, 0, 0], vS: [0, 0, 0], uKind: 0, uAura: 16, uTime: 0, uSeed: 0, uKindle: 1, uRingR: 1, uGroundR: AURA_GROUND_R, uFlameH: 1,
    uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: [0, 1.2, 5], uAt: [0, 0, 0], uFocus: [0, 0, 0, 0], uResLit: Array(48).fill(0), dFdx: () => [0.001, 0, 0], dFdy: () => [0, 0.001, 0],
  });
  let lit = 0;
  for (const aura of NEW_AURAS) for (const t of [3.1, 47.9, 102.4]) for (const kind of [0, 1]) for (let i = 0; i <= 30; i++) for (let j = 0; j <= 30; j++) {
    const look = AURA_LOOK[aura];
    const vP = kind ? [i / 30, j / 30] : polar(AURA_GROUND_R * i / 30, (j / 30) * TAU);
    Object.assign(f.globals, { vP, uKind: kind, uAura: look.kind, uRingR: look.ringR, uFlameH: look.flameH, uTime: t, powNeg: 0 });
    try { f.main(); lit++; } catch (e) { if (!(e instanceof GlslDiscard)) throw e; }
    assert.equal(f.globals.powNeg, 0, `${aura}, kind ${kind}, at ${vP.map((x) => x.toFixed(2))}, ${t}`);
  }
  assert.ok(lit > 5000, `the sweep drew (${lit})`);
});
