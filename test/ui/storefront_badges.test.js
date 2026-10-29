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
import { wareArtNode, SEASON_WARE_ART } from '../../src/ui/wareArt.js';
import { EFFECTS } from '../../src/net/effectLaw.js';
import { effectName } from '../../src/ui/effectText.js';
import { SHOP_WARES } from '../../src/net/shopLaw.js';
import { PASS_REWARDS, PASS_DELUXE } from '../../src/net/battlePassLaw.js';
import { GLYPH_LABEL } from '../../src/ui/enhanced/enhancedAccount.js';
import {
  AURA_LOOK, AURA_FS, AURA_GROUND_R, auraPrograms, DOMINION_R, DOMINION_BAND_M, DOMINION_RUNES, DOMINION_SCRIPT, DOMINION_RGB, dominionRatesWhole,
  dominionRuneAt, HELIX_R, HELIX_H, HELIX_RGB, GILDED_RGB, helixRatesWhole, helixStrandAt,
} from '../../src/render/auraRing.js';
import { glslFunctions } from '../glsl.mjs';

const NEW_TITLES = ['dawnbringer', 'voidwalker', 'eternalchampion', 'brassbound', 'tremorborn', 'tonalarchitect', 'brasswright', 'heartwaker', 'numidiumecho'];
const PLATES = ['dawnbringer', 'voidwalker', 'eternalchampion', 'heartwaker', 'numidiumecho'];
const NEW_GLYPHS = ['oblivion', 'gatesigil', 'gearcrown', 'tonalfork', 'cog'];
const NEW_ICONS = ['centurion', 'aetherium', 'lexicon', 'spider', 'sphere', 'colossus', 'gearheart', 'numidium'];
const NEW_AURAS = ['dominion', 'aetherium', 'gildedcoil'];
const apart = (a, b) => Math.hypot(...[0, 1, 2].map((i) => (a[i] - b[i]) * 255));
const TAU = Math.PI * 2;

// ── THE TITLES ────────────────────────────────────────────────────────

test('STOREFRONT the titles: each its English words (the shop\'s own where it sells it), a colour 40 or more from every other title\'s, a gradient edged in black for the classic face; the five plates and no more, each its painter, its letters edged in its own ink and lit in its own glow (mutants: a colour shared; a plate\'s style no painter has; the Genesis ink on another plate)', () => {
  assert.deepEqual(TITLES.slice(-9), NEW_TITLES);
  assert.deepEqual(NEW_TITLES.map((k) => TITLE_TEXT[k]), ['Dawnbringer', 'Voidwalker', 'Eternal Champion', 'Brassbound', 'Tremor-Born', 'Tonal Architect', 'Brasswright', 'Heart-Waker', 'Echo of Numidium']);
  for (const k of ['dawnbringer', 'voidwalker', 'eternalchampion']) assert.equal(SHOP_WARE_NAME[`title:${k}`], TITLE_TEXT[k], `${k}: the receipt's word is the badge's`);
  for (const k of NEW_TITLES) {
    for (const o of TITLES.filter((x) => x !== k)) assert.ok(apart(TITLE_RGBA[k], TITLE_RGBA[o]) > 40, `${k} apart from the ${o}'s (${apart(TITLE_RGBA[k], TITLE_RGBA[o]).toFixed(0)})`);
    assert.equal(TITLE_GRADIENT[k].length, 3, `${k}: three stops`);
    assert.deepEqual([...TITLE_EDGE[k]], [0, 0, 0, 1], `${k}: edged in black`);
  }
  assert.deepEqual(NEW_TITLES.filter((k) => titleBadge({ title: k }).flame), PLATES, 'the name visuals and the pass\'s two on plates, the brass four in their gradient');
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
  assert.deepEqual(GLYPHS.slice(-5), NEW_GLYPHS);
  assert.deepEqual(NEW_GLYPHS.map((g) => GLYPH_LABEL[g]), ['Oblivion Sigil', 'Gate Sigil', 'Brass Crown', 'Tonal Fork', 'Dwemer Cog']);
  for (const g of ['oblivion', 'gatesigil', 'gearcrown']) assert.equal(SHOP_WARE_NAME[`glyph:${g}`], GLYPH_LABEL[g], `${g}: the receipt's word is the card's`);
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

test('STOREFRONT the portraits: Season One\'s eight, each its words, drawn as the festival\'s are - a round field in its two colours, its shapes clipped to it and the brass bezel - in the Rourken\'s brass and the aetherium\'s blue, every shape inside the field, every paint it names its own (mutants: a shape past the rim; a portrait with no blue; a paint named and never laid)', () => {
  assert.deepEqual(ICONS.slice(-8), NEW_ICONS);
  assert.deepEqual(NEW_ICONS.map((k) => ICON_TEXT[k]), ['Centurion Helm', 'Aetherium Shard', 'Dwemer Lexicon', 'Brass Spider', 'Dwarven Sphere', 'Brass Colossus', 'Gearheart', 'Numidium']);
  const doc = { createElementNS: (_ns, tag) => { const n = { tag, attrs: {}, children: [], setAttribute(k, v) { n.attrs[k] = v; }, append(...c) { n.children.push(...c); } }; return n; } };
  for (const k of NEW_ICONS) {
    const svg = profileIconNode(doc, k, 'px-icon', 48);
    // AUDIT-STOREFRONT (PIN MOVED: the owner, "The profile images leave a lot to be desired" - the shapes now ride in a
    // group clipped to the field, under the bezel, and their paints are ICON_MATERIALS laid in the svg's own defs)
    const [defs, field, pic, ...rim] = svg.children;
    assert.deepEqual([defs.tag, field.tag, pic.tag, pic.children.length], ['defs', 'circle', 'g', ICON_ART[k].shapes.length], `${k}: its defs, its field and its shapes`);
    assert.equal(ICON_ART[k].bezel, 'brass');
    assert.ok(rim.length > 0, `${k}: its bezel`);
    const laid = new Set(defs.children.map((c) => c.attrs.id));
    for (const n of [...pic.children, ...rim]) for (const v of Object.values(n.attrs)) for (const m of String(v).match(/url\(#[^)]+\)/g) ?? []) assert.ok(laid.has(m.slice(5, -1)), `${k}: ${m} laid`);
    assert.equal(svg.attrs['aria-label'], ICON_TEXT[k]);
    const paint = (v) => String(v ?? '').replace(/url\(#(\w+)\)/g, (_, m) => (ICON_MATERIALS[m]?.[2] ?? []).map((st) => st[1]).join(' '));
    const fills = ICON_ART[k].shapes.map(([, a]) => `${paint(a.fill)}${paint(a.stroke)}`).join(' ');
    assert.match(fills, /#3fb8ff|#9ff9fc|#7fe0ff/, `${k}: the aetherium's light`);
    assert.match(fills, /#c9963a|#a8751b|#e2b75a|#f3d78a/, `${k}: the brass`);
    for (const [tag, a] of ICON_ART[k].shapes) {
      const pts = [];
      if (tag === 'circle' || tag === 'ellipse') pts.push([a.cx - (a.r ?? a.rx), a.cy], [a.cx + (a.r ?? a.rx), a.cy], [a.cx, a.cy - (a.r ?? a.ry)], [a.cx, a.cy + (a.r ?? a.ry)]);
      else if (tag === 'rect') pts.push([a.x, a.y], [a.x + a.width, a.y + a.height]);
      else {
        assert.match(a.d, /^[MLQAVHZ0-9 .-]+$/, `${k}: absolute commands alone`);
        const nums = a.d.replace(/A\s*[\d.]+\s+[\d.]+\s+[\d.]+\s+[01]\s+[01]\s+/g, ' ').match(/[VH]?-?\d+(\.\d+)?/g);
        for (let i = 0; i + 1 < nums.length; i++) if (!/[VH]/.test(nums[i]) && !/[VH]/.test(nums[i + 1])) { pts.push([Number(nums[i]), Number(nums[i + 1])]); i++; }
      }
      for (const [x, y] of pts) assert.ok(Math.hypot(x - 32, y - 32) <= 31.5, `${k}: ${tag} inside the field at ${x},${y}`);
    }
  }
});

test('AUDIT-STOREFRONT every portrait, the festival\'s four and the season\'s eight: drawn lit - its shapes clipped to its field, inside it, in a bezel, every paint it names laid in its own defs under ids of its own, two drawings never sharing one (mutants: the clip dropped; a paint never laid; the bezel dropped; two drawings\' ids one)', () => {
  const doc = { createElementNS: (_ns, tag) => { const n = { tag, attrs: {}, children: [], setAttribute(k, v) { n.attrs[k] = v; }, append(...c) { n.children.push(...c); } }; return n; } };
  const ids = (svg) => svg.children[0].children.map((c) => c.attrs.id);
  for (const k of Object.keys(ICON_ART)) {
    const svg = profileIconNode(doc, k, 'px-icon', 48), [defs, , pic, ...rim] = svg.children;
    assert.ok(ICON_ART[k].bezel && rim.length >= 3, `${k}: in its bezel`);
    const clip = defs.children.find((c) => c.tag === 'clipPath');
    assert.equal(pic.attrs['clip-path'], `url(#${clip?.attrs.id})`, `${k}: its picture clipped to the field`);
    const laid = new Set(ids(svg));
    for (const n of [...pic.children, ...rim]) for (const v of Object.values(n.attrs)) for (const m of String(v).match(/url\(#[^)]+\)/g) ?? []) assert.ok(laid.has(m.slice(5, -1)), `${k}: ${m} laid`);
    const again = profileIconNode(doc, k, 'px-icon', 48);
    assert.equal(ids(again).filter((id) => laid.has(id)).length, 0, `${k}: a second drawing's ids its own`);
  }
});

test('AUDIT-STOREFRONT the effects\' emblems and every ware\'s picture: an emblem for every effect the law knows, each a round field, its shapes inside it, every paint it names its own; a picture for every piece a bundle gives and every reward the pass gives, a title its ribbon (mutants: an effect with no emblem; a glyph bare beside the medallions; a title unpictured)', () => {
  const doc = { createElementNS: (_ns, tag) => { const n = { tag, attrs: {}, style: {}, children: [], setAttribute(k, v) { n.attrs[k] = v; }, append(...c) { n.children.push(...c); } }; return n; } };
  assert.deepEqual(Object.keys(EMBLEM_ART).sort(), EFFECTS.map((e) => `${e.slot}:${e.key}`).sort(), 'an emblem an effect');
  for (const id of Object.keys(EMBLEM_ART)) {
    const [slot, key] = id.split(':'), svg = effectEmblemNode(doc, slot, key, 'x', 32);
    assert.equal(svg.attrs['aria-label'], effectName(slot, key));
    const [defs, pic] = svg.children, laid = new Set(defs.children.map((c) => c.attrs.id));
    for (const n of pic.children) for (const v of Object.values(n.attrs)) for (const m of String(v).match(/url\(#[^)]+\)/g) ?? []) assert.ok(laid.has(m.slice(5, -1)), `${id}: ${m} laid`);
  }
  assert.equal(effectEmblemNode(doc, 'kill', 'nope'), null);
  assert.equal(effectEmblemNode({}, 'kill', 'pyre'), null);
  const pieces = [...new Set(SHOP_WARES.filter((w) => w.kind === 'bundle').flatMap((w) => w.gives))];
  const rewards = [...new Set(Object.values(PASS_REWARDS).flat().map((r) => r.grant).concat(Object.values(PASS_DELUXE).flatMap((d) => d.grants)))];
  for (const id of [...pieces, ...rewards, 'boost:s1cog', 'boost:s1tonal', 'boost:s1heart', 'pass:s1premium', 'pass:s1deluxe']) {
    const art = wareArtNode(doc, id, 48, 'x');
    assert.ok(art && art.tag === 'svg', `${id}: its picture`);
    assert.equal(art.attrs['aria-hidden'], 'true', `${id}: the name beside it says it`);
    if (/^(glyph|aura|title):/.test(id) && !SEASON_WARE_ART[id]) assert.equal(art.children.at(-1).attrs.stroke, '#c9a55a', `${id}: in its medallion`);
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
  assert.deepEqual(AURAS.slice(-3), NEW_AURAS);
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
