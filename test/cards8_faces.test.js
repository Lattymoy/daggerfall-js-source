// CARDS8 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md sections 6.2 and 9): THE FACES OF ILIAC HAND - Mac: "Painted
// in code", the way the Hold'em deck is. Every emblem a glyph of our own paths, the frame in the loot's tier colour,
// the frame's window in the kind's shape, the gem and the shield only where the kind has them (the art is ours).
// AUDIT CARDS-5 (lane B): the pins read GEOMETRY now, not only that a thing was painted. The recorder below keeps the
// transform and every path's points, so a pin can say where the shield and the gem are, what ground each word is
// written on, whose glyph a card painted and whether the rules stayed in their box. The sizes are the game's: the
// Collections grid's 78 x 112 tile (TILE MODE), the pressed card's large view (260 x 371) and 350 x 500.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  EMBLEM_PAINTERS, EMBLEM_KEYS, paintIliacCard, paintIliacBack, wrapCardText, ILIAC_CARD_ASPECT, KIND_ART, TIER_FRAMES,
  iliacLayout, COST_GEM, POWER_SHIELD, ILIAC_INKS, ILIAC_TILE_MAX_H,
} from '../src/render/iliacCardFaces.js';
import { paintBack, STOCK } from '../src/render/cardFaces.js';
import { RARITIES, RARITY_ORDER } from '../src/systems/lootRarity.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** The first set's emblems, then AUDIT CARDS-5's fourteen - EMBLEM_KEYS in its order. */
const EMBLEMS_34 = ['beast', 'undead', 'ghost', 'vampire', 'lich', 'were', 'orc', 'giant', 'centaur', 'harpy', 'nymph',
  'dreugh', 'daedra', 'atronach', 'dragon', 'knight', 'mage', 'thief', 'assassin', 'priest', 'warrior', 'noble', 'prince',
  'artifact', 'fire', 'frost', 'shock', 'heal', 'shadow', 'city', 'desert', 'fortress', 'dungeon', 'sea'];
const EMBLEMS_NEW = ['razor', 'staff', 'book', 'claymore', 'rose', 'daedric', 'scorpion', 'bat', 'boar', 'tree', 'gargoyle', 'banish', 'recall', 'sun'];
const EMBLEMS_CARDS9 = ['gate', 'serpent', 'gear'];   // CARDS9: the bosses' own
const EMBLEMS = [...EMBLEMS_34, ...EMBLEMS_NEW, ...EMBLEMS_CARDS9];
const KINDS = ['unit', 'spell', 'prince', 'location'];
/**
 * Each glyph's measure as drawn - its path segments / fills / strokes. A detail lost (the skull's sockets, the
 * crescent's bite) changes it; a deliberate redraw of a glyph updates its entry here, beside the picture it was looked at in.
 */
const GLYPH_MEASURE = Object.freeze({beast: '14/1/0', undead: '23/1/0', ghost: '14/1/0', vampire: '16/4/0', lich: '30/2/0', were: '31/1/0', orc: '24/4/0', giant: '21/2/0', centaur: '33/2/1', harpy: '56/4/1', nymph: '12/4/0', dreugh: '22/4/1', daedra: '27/3/0', atronach: '26/2/2', dragon: '31/2/0', knight: '36/1/0', mage: '17/2/0', thief: '16/2/0', assassin: '17/5/0', priest: '21/1/1', warrior: '30/2/0', noble: '23/1/0', prince: '13/2/0', artifact: '28/2/1', fire: '14/1/0', frost: '60/0/1', shock: '7/1/0', heal: '17/1/1', shadow: '13/1/1', city: '35/1/0', desert: '26/3/1', fortress: '51/1/0', dungeon: '37/2/1', sea: '15/1/1', razor: '15/2/0', staff: '17/2/2', book: '47/3/2', claymore: '23/2/0', rose: '27/2/1', daedric: '23/3/1', scorpion: '56/5/1', bat: '25/1/0', boar: '45/3/0', tree: '42/2/2', gargoyle: '53/1/0', banish: '28/1/2', recall: '91/1/2', sun: '42/2/0', gate: '38/3/0', serpent: '35/3/1', gear: '68/2/0'});
const TILE = [78, 112], LARGE = [260, 371], FULL = [350, 500];
const SIZES = [TILE, LARGE, FULL];

/**
 * A 2D context that records what is painted, in order: every call with its arguments (numbers rounded), every fill
 * and stroke with the colour it was made in and the points of its path in card space (the transform applied), every
 * text with its ink, font, place and the maxWidth it was held to. save/restore keep the styles as a canvas does. A
 * text is measured `charW` a letter, or (by default) `k` of its font's size a letter.
 */
function recorder({ charW = null, k = 0.55 } = {}) {
  const log = { calls: [], fills: [], strokes: [], texts: [], paths: 0, shapes: [], txt: [], clips: [] };
  const state = { fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '10px serif', globalAlpha: 1, textAlign: 'start', textBaseline: 'alphabetic', lineCap: 'butt', lineJoin: 'miter' };
  let m = [1, 0, 0, 1, 0, 0], subs = [], cur = null, seq = 0;
  const stack = [];
  const round = (a) => (typeof a === 'number' ? Math.round(a * 1000) / 1000 : a);
  const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
  const tp = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const px = () => Number(/([\d.]+)px/.exec(state.font)?.[1] ?? 10);
  const measure = (t) => String(t).length * (charW ?? px() * k);
  const last = () => (cur && cur.length ? cur[cur.length - 1] : null);
  const to = (pt) => { if (!cur) { cur = []; subs.push(cur); } cur.push(pt); };
  const ops = {
    save() { stack.push([m.slice(), { ...state }]); },
    restore() { const s = stack.pop(); if (s) { m = s[0]; Object.assign(state, s[1]); } },
    translate(x, y) { m = mul(m, [1, 0, 0, 1, x, y]); },
    scale(x, y) { m = mul(m, [x, 0, 0, y, 0, 0]); },
    rotate(a) { m = mul(m, [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]); },
    beginPath() { subs = []; cur = null; },
    moveTo(x, y) { cur = [tp(x, y)]; subs.push(cur); },
    lineTo(x, y) { to(tp(x, y)); },
    closePath() {},
    quadraticCurveTo(cx, cy, x, y) {
      const p0 = last(), c = tp(cx, cy), p1 = tp(x, y);
      if (!p0) { to(p1); return; }
      for (const t of [0.25, 0.5, 0.75, 1]) to([(1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1]]);
    },
    arc(x, y, r, a0, a1, ccw = false) {
      const T = Math.PI * 2;
      let sweep;
      if (!ccw) sweep = a1 - a0 >= T ? T : ((a1 - a0) % T + T) % T;
      else sweep = a0 - a1 >= T ? -T : -((((a0 - a1) % T) + T) % T);
      for (let i = 0; i <= 24; i++) { const a = a0 + (sweep * i) / 24; to(tp(x + Math.cos(a) * r, y + Math.sin(a) * r)); }
    },
    fill() { log.shapes.push({ op: 'fill', seq: seq++, style: state.fillStyle, alpha: state.globalAlpha, subs: subs.map((s) => s.slice()) }); },
    stroke() { log.shapes.push({ op: 'stroke', seq: seq++, style: state.strokeStyle, width: state.lineWidth, alpha: state.globalAlpha, subs: subs.map((s) => s.slice()) }); },
    fillRect(x, y, w, h) { log.shapes.push({ op: 'fill', seq: seq++, style: state.fillStyle, alpha: state.globalAlpha, subs: [[tp(x, y), tp(x + w, y), tp(x + w, y + h), tp(x, y + h)]] }); },
    clip() { log.clips.push(subs.map((s) => s.slice())); },
    fillText(t, x, y, mw) {
      const [X, Y] = tp(x, y);
      log.txt.push({ t: String(t), seq: seq++, style: state.fillStyle, font: state.font, px: px(), x: X, y: Y, mw, w: measure(t), align: state.textAlign, baseline: state.textBaseline });
    },
  };
  const ctx = new Proxy({}, {
    get(_, key) {
      if (key in state) return state[key];
      if (key === 'measureText') return (t) => ({ width: measure(t) });
      return (...args) => {
        log.calls.push([key, ...args.map(round)]);
        if (key === 'fill' || key === 'fillRect') log.fills.push(state.fillStyle);
        if (key === 'stroke' || key === 'strokeRect') log.strokes.push([state.strokeStyle, state.lineWidth]);
        if (key === 'fillText') log.texts.push([String(args[0]), state.fillStyle]);
        if (['moveTo', 'lineTo', 'arc', 'quadraticCurveTo'].includes(key)) log.paths++;
        ops[key]?.(...args);
      };
    },
    set(_, key, v) { state[key] = v; log.calls.push(['set', key, v]); return true; },
  });
  return { ctx, log };
}

const pts = (shape) => shape.subs.flat();
const bbox = (shape) => {
  const p = pts(shape);
  return { x0: Math.min(...p.map((q) => q[0])), y0: Math.min(...p.map((q) => q[1])), x1: Math.max(...p.map((q) => q[0])), y1: Math.max(...p.map((q) => q[1])) };
};
/** Even-odd point-in-path over every sub-path. */
const contains = (shape, [x, y]) => {
  let inside = false;
  for (const s of shape.subs) {
    for (let i = 0, j = s.length - 1; i < s.length; j = i++) {
      const [xi, yi] = s[i], [xj, yj] = s[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
};
/** The ground a point was painted on before `seq`: the last opaque fill in a plain colour that covers it. */
const groundAt = (log, seq, pt) => {
  const under = log.shapes.filter((s) => s.op === 'fill' && s.seq < seq && s.alpha === 1 && /^#/.test(s.style) && contains(s, pt));
  return under.at(-1)?.style ?? null;
};
const lum = (hex) => {
  const v = hex.match(/\w\w/g).map((x) => parseInt(x, 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
/** Inside a rectangle with its corners rounded r, kept `m` clear of its edge. */
const inRoundRect = ([x, y], rx, ry, rw, rh, r, m = 0) => {
  const x0 = rx + m, y0 = ry + m, x1 = rx + rw - m, y1 = ry + rh - m, rr = Math.max(0, r - m);
  if (x < x0 - 1e-6 || x > x1 + 1e-6 || y < y0 - 1e-6 || y > y1 + 1e-6) return false;
  const cx = Math.min(Math.max(x, x0 + rr), x1 - rr), cy = Math.min(Math.max(y, y0 + rr), y1 - rr);
  return Math.hypot(x - cx, y - cy) <= rr + 1e-6;
};
/** A text's role by its font: a digit on a gem or shield, the name, the flavor, or the rules. */
const role = (t) => (/^bold /.test(t.font) ? (/^\d+$/.test(t.t) ? 'digit' : 'name') : /^italic /.test(t.font) ? 'flavor' : 'rules');

const sample = (kind, tier, extra = {}) => ({
  id: `t-${kind}-${tier}`, name: `A ${tier} ${kind}`, kind, cost: 3, power: kind === 'unit' || kind === 'prince' ? 5 : null, tier,
  tags: [], text: 'When played, add one power to every other unit you hold here.', emblem: kind === 'location' ? 'fortress' : 'undead',
  flavor: 'The bones remember.', ...extra,
});
const paint = (card, w, h, opts) => { const r = recorder(opts); paintIliacCard(r.ctx, card, w, h); return { ...r, L: iliacLayout(KIND_ART[card.kind] ? card.kind : 'unit', RARITIES[card.tier] ? card.tier : 'common', w, h) }; };
const catalog = async () => {
  if (!existsSync(new URL('../src/net/iliacCards.js', import.meta.url))) return [];
  const cat = await import('../src/net/iliacCards.js');
  return [...(cat.ILIAC_CARDS ?? []), ...(cat.ILIAC_LOCATIONS ?? [])];
};

test('CARDS8 every emblem the catalog carries has its own glyph, traced from paths and filled or stroked', () => {
  assert.deepEqual([...EMBLEM_KEYS], EMBLEMS, 'EMBLEM_KEYS: the first 34, then the fourteen of AUDIT CARDS-5, in order');
  assert.ok(Object.isFrozen(EMBLEM_KEYS));
  assert.deepEqual(Object.keys(EMBLEM_PAINTERS), EMBLEMS, 'one painter per emblem, no more and no fewer');
  assert.ok(Object.isFrozen(EMBLEM_PAINTERS));
  const seqs = new Map();
  for (const e of EMBLEMS) {
    const { ctx, log } = recorder();
    assert.doesNotThrow(() => EMBLEM_PAINTERS[e](ctx, 50, 50, 80, '#123456'), `${e} paints`);
    assert.ok(log.fills.length + log.strokes.length > 0, `${e} fills or strokes`);
    assert.ok(log.paths >= 3, `${e} is drawn, not written`);
    assert.equal(log.texts.length, 0, `${e} writes no glyph`);
    assert.ok(log.fills.every((f) => f === '#123456') && log.strokes.every(([s]) => s === '#123456'), `${e} is in the ink it is handed`);
    const used = new Set(log.calls.map(([k]) => k));
    for (const k of used) assert.ok(['save', 'restore', 'translate', 'scale', 'rotate', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'quadraticCurveTo', 'arc', 'fill', 'stroke', 'set'].includes(k), `${e} uses only paths (${k})`);
    // the glyph stands in its box: 80 across about (50, 50), a little latitude for a stroke's round cap
    for (const s of log.shapes) {
      const b = bbox(s);
      assert.ok(b.x0 >= 50 - 44 && b.x1 <= 50 + 44 && b.y0 >= 50 - 44 && b.y1 <= 50 + 44, `${e} stays in its box (${JSON.stringify(b)})`);
    }
    const all = log.shapes.map(bbox);
    const ext = { x0: Math.min(...all.map((b) => b.x0)), x1: Math.max(...all.map((b) => b.x1)), y0: Math.min(...all.map((b) => b.y0)), y1: Math.max(...all.map((b) => b.y1)) };
    assert.ok(Math.max(ext.x1 - ext.x0, ext.y1 - ext.y0) >= 52 && Math.min(ext.x1 - ext.x0, ext.y1 - ext.y0) >= 28, `${e} fills its box - two thirds of it one way, a third the other`);
    seqs.set(e, JSON.stringify(log.calls));
  }
  assert.notEqual(seqs.get('undead'), seqs.get('lich'), 'the lich is more than the skull');
  for (const e of EMBLEMS) {
    const { ctx, log } = recorder(); EMBLEM_PAINTERS[e](ctx, 0, 0, 1, '#000');
    assert.equal(`${log.paths}/${log.fills.length}/${log.strokes.length}`, GLYPH_MEASURE[e], `${e} is drawn as it was drawn when it was looked at`);
  }
  assert.equal(new Set(seqs.values()).size, EMBLEMS.length, 'no two emblems paint alike');
  // B6: the harpy is a figure, wings raised either side - not one torn wing off to the right
  const h = recorder(); EMBLEM_PAINTERS.harpy(h.ctx, 0, 0, 100, '#000');
  const hb = h.log.shapes.map(bbox), hx0 = Math.min(...hb.map((b) => b.x0)), hx1 = Math.max(...hb.map((b) => b.x1));
  assert.ok(Math.abs(hx0 + hx1) < 3, 'the harpy is drawn full face, symmetric about its centre');
});

test('CARDS8 the catalog\'s emblems all have a painter (when the catalog is in the tree)', async () => {
  if (!existsSync(new URL('../src/net/iliacCards.js', import.meta.url))) return;
  const cat = await import('../src/net/iliacCards.js');
  for (const e of cat.CARD_EMBLEMS ?? []) assert.ok(EMBLEM_PAINTERS[e], `the catalog's ${e} has a painter`);
  for (const c of await catalog()) assert.ok(EMBLEM_PAINTERS[c.emblem], `${c.id}'s ${c.emblem} has a painter`);
});

test('CARDS8 every kind and tier paints at the grid\'s tile, the large view and full size; the frame is the loot tier\'s colour', () => {
  assert.equal(ILIAC_CARD_ASPECT, 0.7);
  assert.deepEqual(Object.keys(TIER_FRAMES), [...RARITY_ORDER], 'a frame for every tier of the loot\'s ladder, in its order');
  assert.deepEqual(Object.keys(KIND_ART), KINDS);
  for (const kind of KINDS) {
    for (const tier of RARITY_ORDER) {
      for (const [w, h] of SIZES) {
        const { log } = paint(sample(kind, tier), w, h);
        assert.equal(log.strokes[0][0], RARITIES[tier].colour, `${kind} ${tier}: the frame is RARITIES.${tier}.colour`);
        assert.ok(Math.abs(log.strokes[0][1] - TIER_FRAMES[tier].band * (h / 100)) < 1e-9, 'the rim scales with the card');
        assert.ok(log.txt.filter((t) => role(t) === 'name').map((t) => t.t).join(' ') === `A ${tier} ${kind}`, 'the name is in its banner');
      }
    }
  }
  const rim = (tier) => paint(sample('unit', tier), ...FULL).log;
  const [common, legendary, artifact] = [rim('common'), rim('legendary'), rim('artifact')];
  assert.ok(legendary.strokes[0][1] > common.strokes[0][1], 'a higher tier\'s frame is heavier');
  assert.ok(legendary.fills.filter((f) => f === RARITIES.legendary.colour).length >= 8 + 1, 'a legendary frame is studded');
  assert.ok(artifact.strokes.some(([s]) => s === '#ffffff') && !legendary.strokes.some(([s]) => s === '#ffffff'), 'the inner glow line is the aetheric and the artifact\'s alone');
  const odd = recorder();
  assert.doesNotThrow(() => paintIliacCard(odd.ctx, { name: 'Gap', kind: 'nonsense', tier: 'nonsense', emblem: 'nonsense' }, ...TILE), 'a gap in the catalog shows, it does not throw');
  assert.equal(odd.log.strokes[0][0], RARITIES.common.colour);
});

test('CARDS-5 B16: every rim is framed by a dark keyline; studs, the double rule and the glow stand where they belong', () => {
  for (const tier of RARITY_ORDER) {
    for (const [w, h] of SIZES) {
      const { log, L } = paint(sample('unit', tier), w, h), u = h / 100, colour = RARITIES[tier].colour, f = TIER_FRAMES[tier];
      const base = log.shapes[0];
      assert.equal(base.style, ILIAC_INKS.frame, 'the card is laid dark first');
      const bb = bbox(base);
      assert.ok(bb.x0 <= 0.01 && bb.y0 <= 0.01 && bb.x1 >= w - 0.01 && bb.y1 >= h - 0.01, 'the dark covers the whole card');
      const rimS = log.shapes.find((s) => s.op === 'stroke');
      assert.equal(rimS.style, colour);
      assert.ok(Math.abs(bbox(rimS).x0 - L.rim.mid) < 1e-6 && Math.abs(bbox(rimS).y1 - (h - L.rim.mid)) < 1e-6, 'the rim runs at its middle');
      assert.ok(Math.abs(L.rim.mid - (1 + f.band / 2) * u) < 1e-9 && Math.abs(L.rim.inner - (1 + f.band) * u) < 1e-9);
      const panel = log.shapes.find((s) => s.op === 'fill' && s.style === STOCK);
      assert.ok(panel && panel.seq > rimS.seq, 'the panel is laid on the stock');
      assert.ok(Math.abs(bbox(panel).x0 - L.p) < 1e-6 && Math.abs(bbox(panel).y1 - (h - L.p)) < 1e-6, 'the panel at its inset');
      assert.ok(L.p - L.rim.inner >= 1.2 * u - 1e-9, `${tier}: a dark keyline at least 1.2u between the rim and the panel`);
      assert.ok(L.p - L.rim.inner <= 2 * u, 'and not a gulf');
      // the studs: the tier's count, diamonds in its colour, each at its place on the rim's middle
      const studs = log.shapes.filter((s) => s.op === 'fill' && s.style === colour && s.subs.length === 1 && s.subs[0].length === 4);
      assert.equal(studs.length, f.studs, `${tier}: ${f.studs} studs`);
      assert.equal(L.studs.length, f.studs);
      studs.forEach((s, i) => {
        const b = bbox(s), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
        assert.ok(Math.abs(cx - L.studs[i][0]) < 1e-6 && Math.abs(cy - L.studs[i][1]) < 1e-6, `${tier} stud ${i} at its place`);
        assert.ok(Math.abs(Math.min(cx, cy, w - cx, h - cy) - L.rim.mid) < 1e-6, `${tier} stud ${i} is set in the rim`);
      });
      if (f.studs >= 4) {
        const m = L.rim.mid, at = (q, x, y) => Math.abs(q[0] - x) < 1e-9 && Math.abs(q[1] - y) < 1e-9;
        for (const [x, y] of [[m, m], [w - m, m], [m, h - m], [w - m, h - m]]) assert.ok(L.studs.slice(0, 4).some((q) => at(q, x, y)), `${tier}: a stud on the rim's corner (${x}, ${y})`);
      }
      if (f.studs === 8) {
        const sides = L.studs.slice(4).map(([x, y]) => (Math.abs(x - w / 2) < 1e-9 ? 'v' : Math.abs(y - h / 2) < 1e-9 ? 'h' : '?'));
        assert.deepEqual(sides, ['v', 'v', 'h', 'h'], 'the other four at the sides\' middles');
      }
      // the double rule: a coloured line edged dark, 1.1u inside the panel
      const dbl = log.shapes.filter((s) => s.op === 'stroke' && Math.abs(bbox(s).x0 - (L.p + 1.1 * u)) < 1e-6 && Math.abs(bbox(s).y1 - (h - L.p - 1.1 * u)) < 1e-6);
      assert.equal(dbl.length > 0, f.double, `${tier}: ${f.double ? 'a' : 'no'} double rule`);
      if (f.double) assert.deepEqual(dbl.map((s) => s.style), [ILIAC_INKS.frame, colour], 'the double rule: dark under, the tier\'s colour over');
      // the glow: a halo in the tier's colour at the panel's edge, a white shine down the rim's middle
      const halo = log.shapes.filter((s) => s.op === 'stroke' && s.style === colour && s.alpha < 1 && Math.abs(bbox(s).x0 - L.p) < 1e-6);
      const shine = log.shapes.filter((s) => s.op === 'stroke' && s.style === '#ffffff' && Math.abs(bbox(s).x0 - L.rim.mid) < 1e-6);
      assert.equal(halo.length === 1, f.glow, `${tier}: ${f.glow ? 'a' : 'no'} halo`);
      assert.equal(shine.length === 1, f.glow, `${tier}: ${f.glow ? 'a' : 'no'} shine on the rim`);
    }
  }
  const richness = (tier) => paint(sample('unit', tier), ...LARGE).log.shapes.length;
  assert.ok(richness('aetheric') > richness('magic') + 10, 'the aetheric is far richer than the magic');
});

test('CARDS8 the kind is the frame: a location has no gem nor shield, a spell no shield, a unit and a prince both', () => {
  for (const [w, h] of SIZES) {
    for (const kind of KINDS) {
      const { log } = paint(sample(kind, 'rare', { cost: 7, power: 9 }), w, h);
      const gem = log.fills.includes(COST_GEM), shield = log.fills.includes(POWER_SHIELD);
      assert.equal(gem, kind !== 'location', `${kind}: ${kind === 'location' ? 'no' : 'a'} cost gem`);
      assert.equal(shield, kind === 'unit' || kind === 'prince', `${kind}: ${shield ? 'a' : 'no'} power shield`);
      assert.equal(log.texts.some(([t]) => t === '7'), gem, `${kind}: the cost is written only on a gem`);
      assert.equal(log.texts.some(([t]) => t === '9'), shield, `${kind}: the power is written only on a shield`);
    }
  }
  const shapes = KINDS.map((k) => iliacLayout(k, 'common', ...FULL));
  assert.deepEqual(shapes.map((L) => L.shape), ['square', 'rounded', 'arch', 'landscape']);
  assert.equal(shapes[0].win.w, shapes[0].win.h, 'a unit\'s window is square');
  assert.ok(shapes[3].win.w > shapes[3].win.h * 1.3, 'a location\'s is a wide landscape');
  assert.ok(shapes[3].banner.y < shapes[3].win.y, 'its name rides above it, where the gem would be');
  assert.equal(shapes[3].gem, null); assert.equal(shapes[1].shield, null);
  for (const [w, h] of [LARGE, FULL]) {
    for (const k of KINDS) {
      const L = iliacLayout(k, 'artifact', w, h);
      assert.ok(L.win.y + L.win.h <= L.box.y, 'the window sits above the text');
      assert.ok(k === 'location' ? L.banner.y + L.banner.h <= L.win.y : L.win.y + L.win.h <= L.banner.y, 'the banner and the window do not cross');
      assert.ok(k === 'location' || L.banner.y + L.banner.h <= L.box.y, 'nor the banner and the box');
      assert.ok(L.box.y + L.box.h <= h - L.p, 'the text box sits inside the panel');
      assert.ok(L.box.x >= L.p && L.box.x + L.box.w <= w - L.p);
    }
  }
  const prince = paint(sample('prince', 'rare'), ...FULL).log;
  assert.ok(prince.fills.includes(KIND_ART.prince.ink) && prince.fills.includes(KIND_ART.prince.ground), 'the prince\'s gold on Oblivion\'s ground');
});

test('CARDS-5 B1: the gem sits top-left and the shield bottom-right, wholly inside the panel and clear of its corners', () => {
  for (const kind of ['unit', 'spell', 'prince']) {
    for (const tier of RARITY_ORDER) {
      for (const [w, h] of SIZES) {
        const { log, L } = paint(sample(kind, tier, { cost: 4, power: 6 }), w, h), u = h / 100;
        const gem = log.shapes.find((s) => s.op === 'fill' && s.style === COST_GEM);
        const gb = bbox(gem);
        for (const pt of pts(gem)) assert.ok(inRoundRect(pt, L.p, L.p, w - 2 * L.p, h - 2 * L.p, 2.5 * u, 0.5 * u), `${kind} ${tier} ${w}x${h}: the gem inside the panel`);
        assert.ok(gb.x1 < w / 2 && gb.y1 < h / 2 && gb.x0 < L.win.x + L.win.w / 2, 'the gem is top-left');
        assert.ok(gb.y0 <= L.win.y + 4 * u, 'up in the window\'s corner');
        const cost = log.txt.find((t) => t.t === '4' && role(t) === 'digit');
        assert.ok(contains(gem, [cost.x, cost.y]), 'the cost is written on its gem');
        if (!KIND_ART[kind].power) continue;
        const shield = log.shapes.find((s) => s.op === 'fill' && s.style === POWER_SHIELD);
        const sb = bbox(shield);
        for (const pt of pts(shield)) assert.ok(inRoundRect(pt, L.p, L.p, w - 2 * L.p, h - 2 * L.p, 2.5 * u, 1.2 * u), `${kind} ${tier} ${w}x${h}: the shield inside the panel, clear of its rounded corner (${pt})`);
        assert.ok(sb.x0 > w / 2 && sb.y0 > h / 2, 'the shield is bottom-right');
        assert.ok(sb.x1 >= w - L.p - 3 * u, 'against the right of the panel');
        if (L.tile) assert.ok(sb.y1 <= L.banner.y && sb.y0 >= L.win.y, 'on a tile, over the window\'s corner, above the banner');
        else {
          assert.ok(sb.y1 >= h - L.p - 3 * u, 'down at the foot of the panel');
          assert.ok(sb.y0 >= L.box.y, 'in the text box\'s corner');
        }
        assert.ok(sb.x1 - sb.x0 >= 10 * u && sb.y1 - sb.y0 >= 12 * u, 'a shield, not a speck');
        const power = log.txt.find((t) => t.t === '6' && role(t) === 'digit');
        assert.ok(contains(shield, [power.x, power.y]), 'the power is written on its shield');
        // the gem and the shield are a size larger on a tile
        if (L.tile) assert.ok(L.gem.r >= 7.5 * u && L.shield.hw >= 6.5 * u, 'a tile\'s gem and shield read at 112 tall');
      }
    }
  }
});

test('CARDS-5 B15 and the inks: every word is in its ink, on the ground it was meant for, and legible there', async () => {
  const cards = [...KINDS.flatMap((k) => RARITY_ORDER.map((t) => sample(k, t, { cost: 8, power: 10 }))), ...(await catalog()).slice(0, 40)];
  for (const card of cards) {
    for (const [w, h] of SIZES) {
      const { log, L } = paint(card, w, h);
      const colour = RARITIES[RARITIES[card.tier] ? card.tier : 'common'].colour;
      for (const t of log.txt) {
        const r = role(t);
        const probe = t.baseline === 'top' ? [t.x, t.y + t.px * 0.5] : [t.x, t.y];
        const ground = groundAt(log, t.seq, probe);
        const want = { name: [ILIAC_INKS.text, colour], rules: [ILIAC_INKS.text, ILIAC_INKS.box], flavor: [ILIAC_INKS.flavor, ILIAC_INKS.box] }[r]
          ?? [ILIAC_INKS.digit, t.t === String(card.cost) && contains(log.shapes.find((s) => s.style === COST_GEM), [t.x, t.y]) ? COST_GEM : POWER_SHIELD];
        assert.equal(t.style, want[0], `${card.id} ${w}x${h}: the ${r} "${t.t}" in its ink`);
        assert.equal(ground, want[1], `${card.id} ${w}x${h}: the ${r} "${t.t}" on its ground`);
        assert.notEqual(t.style, ground, 'never in the colour it sits on');
        assert.ok(contrast(t.style, ground) >= 4.5, `${card.id}: the ${r} reads at ${contrast(t.style, ground).toFixed(2)}:1`);
      }
      if (!L.gem) continue;
      // B15: the cost's em box is wholly below the gem's lit facet
      const lit = log.shapes.find((s) => s.op === 'fill' && s.style === ILIAC_INKS.gemLight);
      const cost = log.txt.find((t) => role(t) === 'digit' && contains(log.shapes.find((s) => s.style === COST_GEM), [t.x, t.y]));
      assert.ok(cost.y - cost.px / 2 >= bbox(lit).y1 - 1e-6, `${card.id} ${w}x${h}: the cost clear of the lit facet`);
      assert.ok(cost.y + cost.px / 2 <= L.gem.y + L.gem.r + 1e-6, 'and inside the gem');
      assert.ok(cost.px >= L.gem.r * 0.6, 'a digit, not a dot');
    }
  }
  assert.ok(contrast('#ffffff', COST_GEM) >= 4.5 && contrast('#ffffff', ILIAC_INKS.gemLight) < 4.5, 'the lit facet is no ground for the digit');
});

test('CARDS-5 the card paints ITS emblem: the very glyph EMBLEM_PAINTERS draws, centred and large in its window', () => {
  for (const e of EMBLEMS) {
    for (const kind of KINDS) {
      for (const [w, h] of SIZES) {
        const { log, L } = paint(sample(kind, 'magic', { emblem: e }), w, h);
        const solo = recorder();
        EMBLEM_PAINTERS[e](solo.ctx, L.emblem.cx, L.emblem.cy, L.emblem.size, KIND_ART[kind].ink);
        const glyph = JSON.stringify(solo.log.calls).slice(1, -1);
        assert.ok(JSON.stringify(log.calls).includes(glyph), `${kind} ${w}x${h} paints ${e}'s own glyph`);
      }
    }
  }
  for (const kind of KINDS) {
    for (const [w, h] of SIZES) {
      const L = iliacLayout(kind, 'rare', w, h), side = Math.min(L.win.w, L.win.h);
      assert.ok(Math.abs(L.emblem.cx - (L.win.x + L.win.w / 2)) < 1e-9, 'centred across its window');
      assert.ok(L.emblem.cy > L.win.y + L.win.h * 0.4 && L.emblem.cy < L.win.y + L.win.h * 0.6, 'and down it');
      assert.ok(L.emblem.size >= 0.75 * side && L.emblem.size <= 0.9 * side, `${kind} ${w}x${h}: large in its window`);
      const { log } = paint(sample(kind, 'rare'), w, h);
      const clip = log.clips[0].flat(), cb = { x0: Math.min(...clip.map((q) => q[0])), x1: Math.max(...clip.map((q) => q[0])), y0: Math.min(...clip.map((q) => q[1])), y1: Math.max(...clip.map((q) => q[1])) };
      assert.ok(Math.abs(cb.x0 - L.win.x) < 1e-6 && Math.abs(cb.y1 - (L.win.y + L.win.h)) < 1e-6 && Math.abs(cb.x1 - (L.win.x + L.win.w)) < 1e-6, 'the art is clipped to its window');
      const ground = log.shapes.find((s) => s.op === 'fill' && s.style === KIND_ART[kind].ground);
      assert.ok(Math.abs(bbox(ground).x0 - L.win.x) < 1e-6 && Math.abs(bbox(ground).y0 - L.win.y) < 1e-6, 'the kind\'s ground fills the window');
      const edge = log.shapes.filter((sh) => sh.op === 'stroke' && Math.abs(bbox(sh).x0 - L.win.x) < 1e-6 && Math.abs(bbox(sh).y1 - (L.win.y + L.win.h)) < 1e-6);
      assert.deepEqual(edge.map((sh) => sh.style), [ILIAC_INKS.frame, RARITIES.rare.colour], 'the window edged dark, then in the tier\'s colour');
      const u = h / 100;
      if (L.tile) assert.ok(L.win.h >= 55 * u, 'a tile\'s window is most of the card');
      else if (kind === 'location') assert.ok(L.win.w >= w - 2 * L.p - 4 * u && L.win.h >= 33 * u, 'a location\'s landscape runs the panel\'s width');
      else assert.ok(L.win.w >= 40 * u && L.win.h >= 40 * u, `a ${kind}'s window holds its picture large`);
    }
  }
  // the tile gives the picture the rules' room
  const tile = iliacLayout('unit', 'common', ...TILE), full = iliacLayout('unit', 'common', ...FULL);
  assert.ok(tile.emblem.size / TILE[1] >= 1.3 * (full.emblem.size / FULL[1]), 'a tile\'s emblem is far larger for its card');
  // a gap in the catalog shows its kind's picture; a prince's is the Daedric sigil, never Azura's moon and star
  for (const [kind, e] of [['unit', 'warrior'], ['spell', 'shock'], ['prince', 'daedric'], ['location', 'city']]) {
    const { log, L } = paint(sample(kind, 'common', { emblem: 'nonsense' }), ...FULL);
    const solo = recorder(); EMBLEM_PAINTERS[e](solo.ctx, L.emblem.cx, L.emblem.cy, L.emblem.size, KIND_ART[kind].ink);
    assert.ok(JSON.stringify(log.calls).includes(JSON.stringify(solo.log.calls).slice(1, -1)), `a ${kind} without an emblem shows ${e}`);
  }
});

test('CARDS-5: the prince\'s window is a pointed arch, the unit\'s square-cornered, the spell\'s rounded', () => {
  for (const [w, h] of SIZES) {
    const clipOf = (kind) => { const { log, L } = paint(sample(kind, 'rare'), w, h); return { p: log.clips[0].flat(), L }; };
    const arch = clipOf('prince'), { win } = arch.L, cx = win.x + win.w / 2;
    const top = arch.p.reduce((a, q) => (q[1] < a[1] ? q : a));
    assert.ok(Math.abs(top[0] - cx) < 1e-6 && Math.abs(top[1] - win.y) < 1e-6, 'the arch peaks at its middle');
    assert.ok(arch.p.every((q) => q[1] > win.y + win.h * 0.12 || Math.abs(q[0] - cx) < win.w * 0.4), 'no square shoulder: the top corners are cut away');
    assert.ok(arch.p.some((q) => Math.abs(q[0] - win.x) < 1e-6 && Math.abs(q[1] - (win.y + win.h)) < 1e-6), 'its foot is square');
    const sq = clipOf('unit'), u = h / 100;
    assert.ok(sq.p.some((q) => Math.hypot(q[0] - sq.L.win.x, q[1] - sq.L.win.y) < 0.8 * u), 'the unit\'s window has its corner');
    const sp = clipOf('spell');
    assert.ok(!sp.p.some((q) => Math.hypot(q[0] - sp.L.win.x, q[1] - sp.L.win.y) < 1.5 * u), 'the spell\'s window is rounded off');
  }
});

test('CARDS-5 B17: the name fits inside the banner\'s notches at every size, on two lines rather than over them', async () => {
  const cards = [...(await catalog()), sample('unit', 'rare', { name: 'Dark Brotherhood Assassin' }), sample('unit', 'legendary', { name: 'Mages Guild Archmagister' }),
    sample('spell', 'artifact', { name: 'Supercalifragilisticexpialidocious' }), sample('location', 'common', { name: 'Castle Daggerfall' })];
  for (const k of [0.5, 0.62]) {
    for (const card of cards) {
      for (const [w, h] of SIZES) {
        const { log, L } = paint(card, w, h, { k });
        const names = log.txt.filter((t) => role(t) === 'name'), nb = L.nameBox, b = L.banner;
        assert.ok(names.length >= 1 && names.length <= 2, `${card.name}: one line or two`);
        assert.equal(names.map((t) => t.t).join(' '), card.name, 'the whole name, words whole');
        assert.ok(nb.x >= b.x + L.notch + 0.5 * L.u - 1e-9 && nb.x + nb.w <= b.x + b.w - L.notch - 0.5 * L.u + 1e-9, 'the name\'s box keeps off the notches');
        for (const t of names) {
          const drawn = Math.min(t.w, t.mw ?? Infinity);
          assert.ok(drawn <= nb.w + 1e-6, `${card.name} ${w}x${h} k${k}: "${t.t}" ${drawn.toFixed(1)} in ${nb.w.toFixed(1)}`);
          assert.ok(Math.abs(t.x - (nb.x + nb.w / 2)) < 1e-6 && t.align === 'center', 'centred in the banner');
          assert.ok(t.y - t.px / 2 >= b.y - 1e-6 && t.y + t.px / 2 <= b.y + b.h + 1e-6, `"${t.t}" inside the banner, top to bottom`);
          if (L.tile) assert.ok(t.px >= 8, `${card.name}: a tile's name is at least 8 px (${t.px.toFixed(2)})`);
          else assert.ok(t.px >= 3.4 * L.u - 1e-9, 'a large face\'s name stays a name');
        }
        if (names.length === 2) assert.ok(names[1].y - names[0].y >= names[0].px * 0.95, 'the second line under the first, not on it');
      }
    }
  }
  // the name shrinks, and breaks, before it is squeezed
  const short = paint(sample('unit', 'rare', { name: 'Rat' }), ...LARGE).log.txt.find((t) => role(t) === 'name');
  const long = paint(sample('unit', 'rare', { name: 'Giant Scorpion Sergeant' }), ...LARGE, { k: 0.4 }).log.txt.find((t) => role(t) === 'name');
  assert.ok(short.px > long.px && !short.mw, 'a short name at its largest, a long one smaller');
  const db = paint(sample('unit', 'rare', { name: 'Dark Brotherhood Assassin' }), ...LARGE, { k: 0.6 }).log.txt.filter((t) => role(t) === 'name');
  assert.deepEqual(db.map((t) => t.t), ['Dark Brotherhood', 'Assassin'], 'the most even split of its words');
  assert.ok(db.every((t) => t.mw === undefined), 'two lines, neither squeezed');
  const word = paint(sample('unit', 'rare', { name: 'Supercalifragilisticexpialidocious' }), ...TILE).log.txt.filter((t) => role(t) === 'name');
  assert.equal(word.length, 1); assert.ok(word[0].mw > 0, 'one word too long is condensed to the banner, not run over it');
});

test('CARDS-5 B2: the rules stay in their box, the flavor beneath them, and only the lines beside the shield are narrowed', async () => {
  const cards = await catalog();
  for (const [w, h] of [LARGE, FULL]) {
    let shown = 0;
    for (const card of [...cards, ...KINDS.map((kd) => sample(kd, 'artifact'))]) {
      const { log, L } = paint(card, w, h, { k: 0.5 }), { box } = L;
      const rules = log.txt.filter((t) => role(t) === 'rules'), flavor = log.txt.filter((t) => role(t) === 'flavor');
      const sb = L.shield && bbox(log.shapes.find((s) => s.op === 'fill' && s.style === POWER_SHIELD));
      assert.ok(rules.length >= 1, `${card.id}: its rules are written`);
      for (const t of [...rules, ...flavor]) {
        const lh = t.px * 1.15;
        assert.ok(t.baseline === 'top' && t.align === 'center');
        assert.ok(t.y >= box.y - 1e-6 && t.y + lh <= box.y + box.h + 1e-6, `${card.id} ${w}x${h}: "${t.t}" inside the box, top to bottom`);
        assert.ok(t.x - t.w / 2 >= box.x - 1e-6 && t.x + t.w / 2 <= box.x + box.w + 1e-6, `${card.id}: "${t.t}" inside the box, side to side`);
        if (sb && t.y + lh > sb.y0) assert.ok(t.x + t.w / 2 <= sb.x0 + 1e-6, `${card.id}: "${t.t}" passes beside the shield, not under it`);
        assert.ok(t.px >= 3 * L.u - 1e-9, 'a word, not a smudge');
      }
      for (let i = 1; i < rules.length; i++) assert.ok(rules[i].y >= rules[i - 1].y + rules[i - 1].px * 1.15 - 1e-6, 'the rules\' lines in order, none on another');
      if (flavor.length) {
        shown++;
        const end = rules.at(-1).y + rules.at(-1).px * 1.15;
        for (const f of flavor) assert.ok(f.y >= end - 1e-6, `${card.id}: the flavor "${f.t}" under the rules, not over them`);
        assert.ok(flavor[0].px <= rules[0].px, 'the flavor no larger than the rules');
        assert.equal(flavor.map((t) => t.t).join(' ').replace(/\s+/g, ' '), String(card.flavor).replace(/\s+/g, ' '), 'the whole flavor, or none of it');
      }
      // the box is cleared only at the shield's corner: a line above it runs the box's width
      if (sb) assert.ok(sb.y0 > box.y + box.h * 0.35, 'the shield takes the box\'s corner, not its whole height');
    }
    if (cards.length) assert.ok(shown >= cards.length - 4, `${w}x${h}: the flavor is shown on all but a handful (${shown}/${cards.length})`);
  }
  // a short rule and a long flavor: the flavor shrinks to stay
  const long = paint(sample('unit', 'rare', { text: 'Reveal: draw a card.', flavor: 'They say the old roads of the Bay remember every traveller who ever walked them, and keep a toll.' }), ...LARGE, { k: 0.5 });
  const lf = long.log.txt.filter((t) => role(t) === 'flavor'), lr = long.log.txt.filter((t) => role(t) === 'rules');
  assert.ok(lf.length >= 2 && lf[0].px < 4.6 * long.L.u - 1e-9, 'a long flavor is shrunk, not dropped');
  assert.ok(Math.abs(lr[0].px - 5.2 * long.L.u) < 1e-9, 'and it is the flavor that gives way, not the rules: they keep their size');
  // and the lines beside the shield are narrower than those above it
  const many = paint(sample('unit', 'rare', { text: 'word '.repeat(30), flavor: '' }), ...LARGE, { k: 0.5 });
  const mr = many.log.txt.filter((t) => role(t) === 'rules'), msb = bbox(many.log.shapes.find((s) => s.style === POWER_SHIELD));
  const above = mr.filter((t) => t.y + t.px * 1.15 <= msb.y0), beside = mr.filter((t) => t.y + t.px * 1.15 > msb.y0);
  assert.ok(above.length && beside.length, 'some lines above the shield, some beside it');
  assert.ok(Math.max(...above.map((t) => t.w)) > Math.max(...beside.map((t) => t.w)), 'the lines beside the shield are narrowed');
  assert.ok(Math.max(...above.map((t) => t.w)) > many.L.box.w * 0.8, 'the lines above it run the box\'s width');
});

test('CARDS8 the rules wrap by the context\'s own measure; the flavor in italics goes first when the box is full', () => {
  const { ctx } = recorder({ charW: 10 });
  assert.deepEqual(wrapCardText(ctx, 'aaa bbb ccc', 70), ['aaa bbb', 'ccc'], '7 letters at 10 a letter fill a 70 line');
  assert.deepEqual(wrapCardText(ctx, 'aaa bbb ccc', 69), ['aaa', 'bbb', 'ccc']);
  assert.deepEqual(wrapCardText(ctx, 'one\ntwo three', 200), ['one', 'two three'], 'a newline always breaks');
  assert.deepEqual(wrapCardText(ctx, 'abcdefghij', 40), ['abcd', 'efgh', 'ij'], 'a word wider than the line breaks by letters');
  assert.deepEqual(wrapCardText(ctx, '', 40), [''], 'no words, one empty line');
  assert.deepEqual(wrapCardText(ctx, 'aaa bbb ccc ddd', (i) => (i === 0 ? 70 : 30)), ['aaa bbb', 'ccc', 'ddd'], 'a line\'s width may be its own');
  for (const line of wrapCardText(ctx, 'The quick brown fox jumps over the lazy dog by the Iliac Bay', 90)) assert.ok(line.length * 10 <= 90, line);
  const roomy = recorder({ charW: 3 });
  paintIliacCard(roomy.ctx, sample('spell', 'magic', { text: 'Deal two.', flavor: 'Short.' }), ...FULL);
  const fl = roomy.log.calls.filter((c) => c[0] === 'set' && c[1] === 'font').map((c) => c[2]);
  assert.ok(fl.some((f) => /^italic /.test(f)) && roomy.log.texts.some(([t]) => t === 'Short.'), 'room to spare: the flavor, in italics');
  for (const [w, h] of [LARGE, FULL]) {
    const full = paint(sample('unit', 'magic', { text: 'word '.repeat(400), flavor: 'Never seen.' }), w, h, { charW: 3 });
    assert.ok(!full.log.texts.some(([t]) => t === 'Never seen.'), 'a full box drops the flavor');
    const rules = full.log.txt.filter((t) => role(t) === 'rules');
    assert.ok(rules.at(-1).t.endsWith('…'), 'and cuts the rules off with an ellipsis');
    const { box } = full.L;
    assert.ok(rules.length >= 3 && rules.every((t) => t.y + t.px * 1.15 <= box.y + box.h + 1e-6), 'as many lines as the box holds, and no more');
    assert.ok(rules.every((t) => t.px === rules[0].px && t.px <= 3.6 * full.L.u + 1e-9), 'at the rules\' least size');
  }
});

test('CARDS-5 B3: TILE MODE - at the grid\'s 78 x 112 no rules and no flavor, the picture and the name take their room', async () => {
  assert.equal(ILIAC_TILE_MAX_H, 140);
  for (const kind of KINDS) {
    for (const tier of RARITY_ORDER) {
      for (const [w, h] of [TILE, [98, 140]]) {
        const { log, L } = paint(sample(kind, tier), w, h);
        assert.equal(L.tile, true); assert.equal(L.box, null, 'no text box on a tile');
        assert.ok(!log.txt.some((t) => role(t) === 'rules' || role(t) === 'flavor'), `${kind} ${tier}: a tile writes no rules and no flavor`);
        assert.ok(!log.fills.includes(ILIAC_INKS.box), 'nor paints their box');
        assert.ok(log.txt.filter((t) => role(t) === 'name').every((t) => t.px >= 7.2 * L.u - 1e-9), 'the name at least 7.2u');
        assert.ok(L.win.h >= 55 * L.u && L.win.w >= innerWidth(L, w) - 3 * L.u, 'the window takes the room');
        assert.ok(L.banner.h >= 16 * L.u, 'a banner for two lines of name');
        assert.ok(L.banner.y + L.banner.h <= h - L.p + 1e-9 && L.banner.x >= L.p && L.banner.x + L.banner.w <= w - L.p, 'the banner inside the panel');
        assert.ok(kind === 'location' ? L.banner.y + L.banner.h <= L.win.y : L.win.y + L.win.h <= L.banner.y, 'the banner and the window apart');
      }
    }
  }
  for (const c of await catalog()) {
    const { log } = paint(c, ...TILE);
    assert.ok(log.txt.every((t) => role(t) === 'name' || role(t) === 'digit'), `${c.id}: a tile writes its name and its numbers only`);
    assert.ok(log.txt.filter((t) => role(t) === 'name').every((t) => t.px >= 8), `${c.id}: its name at least 8 px`);
  }
  for (const [w, h] of [LARGE, FULL, [99, 141]]) assert.equal(iliacLayout('unit', 'common', w, h).tile, false, `${w}x${h} is a full face`);
  assert.ok(paint(sample('unit', 'common'), ...LARGE).log.txt.some((t) => role(t) === 'rules'), 'the large view writes the rules');
});
const innerWidth = (L, w) => w - 2 * L.p;

test('CARDS8 the back is the Bay\'s compass rose - not the house deck\'s medallion', () => {
  const ours = recorder(), house = recorder();
  assert.doesNotThrow(() => paintIliacBack(ours.ctx, ...TILE));
  for (const [w, h] of SIZES) {
    const r = recorder();
    paintIliacBack(r.ctx, w, h);
    const lit = r.log.shapes.filter((s) => s.op === 'fill' && s.style === ILIAC_INKS.gold && s.subs.length === 1 && s.subs[0].length === 3);
    const dark = r.log.shapes.filter((s) => s.op === 'fill' && s.style === ILIAC_INKS.goldDark && s.subs.length === 1 && s.subs[0].length === 3);
    assert.equal(lit.length, 8, 'the rose\'s eight points, each lit on one side');
    assert.equal(dark.length, 8, 'and shadowed on the other');
    for (const s of [...lit, ...dark]) {
      const b = bbox(s);
      assert.ok(b.x0 > 0 && b.x1 < w && b.y0 > 0 && b.y1 < h, 'the rose inside the card');
      assert.ok(Math.hypot(s.subs[0][0][0] - w / 2, s.subs[0][0][1] - h / 2) < 1e-6, 'each point springs from the card\'s centre');
    }
    const reach = Math.max(...lit.flatMap((s) => s.subs[0].map((q) => Math.hypot(q[0] - w / 2, q[1] - h / 2))));
    assert.ok(reach > Math.min(w, h) * 0.3, 'a rose that fills the back');
    const n = r.log.txt.find((t) => t.t === 'N');
    assert.ok(n && n.style === ILIAC_INKS.gold, 'north is marked, in gold');
    assert.ok(n.x === w / 2 && n.y > 0 && n.y < h / 2 - reach * 0.9, 'above the rose, inside the card');
    assert.equal(groundAt(r.log, n.seq, [n.x, n.y]), ILIAC_INKS.back, 'on the Bay\'s water');
    assert.ok(contrast(n.style, ILIAC_INKS.back) >= 4.5);
  }
  paintIliacBack(ours.ctx, ...FULL);
  paintBack(house.ctx, ...FULL);
  assert.ok(ours.log.paths > 100 && ours.log.fills.length > 10, 'the back is painted');
  assert.notEqual(JSON.stringify(ours.log.calls), JSON.stringify(house.log.calls), 'a collectible is never taken for a poker card face down');
  assert.ok(!ours.log.fills.includes('#5a1a22'), 'nor in its crimson');
});

test('CARDS8 the art is ours: the painter reads no game file', () => {
  const src = read('src/render/iliacCardFaces.js');
  const imports = [...src.matchAll(/^import .* from '([^']+)';/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ['../systems/lootRarity.js', './cardFaces.js'], 'the loot\'s tier colours and the house stock - nothing else');
  for (const spec of imports) assert.doesNotMatch(spec, /formats\/|texture|bsa|arena2|imgFile|cifRci|loader/i, `${spec} is no ARENA2 reader`);
  assert.doesNotMatch(src, /\b(drawImage|putImageData|createPattern|new Image)\b/, 'no raster is drawn - every face is paths');
  assert.doesNotMatch(src, /#[0-9a-f]{6}['"]?\s*,?\s*\/\/\s*(common|magic|rare|legendary|aetheric|artifact)\b/i, 'the tier colours are imported, never copied');
  for (const tier of RARITY_ORDER) assert.ok(!src.toLowerCase().includes(RARITIES[tier].colour.toLowerCase()), `${tier}'s hex is not copied in`);
  assert.match(src, /78 x 112/, 'the header names the grid\'s real tile (AUDIT CARDS-5 B18)');
  assert.doesNotMatch(src, /70 x 100/, 'not the tile it never was');
});
