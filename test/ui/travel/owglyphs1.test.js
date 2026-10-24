// OW-GLYPHS (2026-10-12, Mac: "give all the symbols the red dots (monsters and dungeons), green dots, logging nodes etc
// fitting symbols"): the Overworld's marks by what they are - a band a skull, a dungeon an arch, a player a bust (a crowd
// two), a party on the road its pack, a profession's nodes by their work - in the colours the dots had, no bigger than
// a label's room allows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { skullGlyph, dungeonGlyph, personGlyph, crowdGlyph, packGlyph, gatherGlyph, crossGlyph, TV_CROSS_R, TV_CROSS_GOLD } from '../../../src/ui/travel/travelViewHud.js';
import { NODE_MARK_CSS } from '../../../src/ui/nodeMarks.js';

/** A canvas that records each call and the box every point it is handed lies in. */
function rec(fill = '#123456') {
  const calls = [], box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const pt = (x, y, r = 0) => { box.x0 = Math.min(box.x0, x - r); box.x1 = Math.max(box.x1, x + r); box.y0 = Math.min(box.y0, y - r); box.y1 = Math.max(box.y1, y + r); };
  const t = { fillStyle: fill, strokeStyle: '#000', lineWidth: 1 };
  const g = new Proxy(t, {
    get: (o, k) => (k in o ? o[k] : (...a) => {
      calls.push([k, ...a, k === 'fill' ? o.fillStyle : k === 'stroke' ? o.strokeStyle : undefined]);
      if (k === 'moveTo' || k === 'lineTo') pt(a[0], a[1]);
      if (k === 'quadraticCurveTo') { pt(a[0], a[1]); pt(a[2], a[3]); }
      if (k === 'arc') pt(a[0], a[1], a[2]);
      if (k === 'ellipse') { pt(a[0] - a[2], a[1] - a[3]); pt(a[0] + a[2], a[1] + a[3]); }
      if (k === 'fillRect' || k === 'rect') { pt(a[0], a[1]); pt(a[0] + a[2], a[1] + a[3]); }
    }),
    set: (o, k, v) => { o[k] = v; return true; },
  });
  return { g, calls, box, t };
}
const GLYPHS = {
  skull: (g) => skullGlyph(g, 0, 0), dungeon: (g) => dungeonGlyph(g, 0, 0), person: (g) => personGlyph(g, 0, 0), crowd: (g) => crowdGlyph(g, 0, 0), pack: (g) => packGlyph(g, 0, 0),
  ...Object.fromEntries(Object.keys(NODE_MARK_CSS).map((p) => [p, (g) => gatherGlyph(g, 0, 0, p, NODE_MARK_CSS[p])])),
};

test('OW-GLYPHS: every glyph stands about its point, within the dots\' room (a label under it at +7 and a name over it at -8 keep their places)', () => {
  for (const [name, draw] of Object.entries(GLYPHS)) {
    const { g, box } = rec();
    draw(g);
    assert.ok(box.x0 >= -8.5 && box.x1 <= 8.5, `${name}: ${box.x0}..${box.x1} across`);
    assert.ok(box.y0 >= -8 && box.y1 <= 7, `${name}: ${box.y0}..${box.y1} down`);
  }
});

test('OW-GLYPHS: each is drawn in the colour it is handed, on the marks\' black edge, and leaves the brush as it found it', () => {
  for (const [name, draw] of Object.entries(GLYPHS)) {
    const fill = NODE_MARK_CSS[name] ?? '#e0503c';
    const { g, calls, t } = rec(fill);
    draw(g);
    const painted = calls.filter((c) => c[0] === 'fill' || c[0] === 'stroke').map((c) => c.at(-1));
    assert.ok(painted.includes(fill), `${name}: in its colour`);
    assert.ok(painted.includes('#000'), `${name}: the black edge`);
    assert.deepEqual([t.fillStyle, t.strokeStyle, t.lineWidth], [fill, '#000', 1], `${name}: the brush handed back`);
  }
});

test('OW-GLYPHS: the shapes are their own - a skull\'s two eyes, a crowd\'s two heads, Logging\'s pine not Mining\'s pick, and a work with no glyph keeps the diamond', () => {
  const arcs = (draw) => { const r = rec(); draw(r.g); return r.calls.filter((c) => c[0] === 'arc').length; };
  assert.equal(arcs(GLYPHS.skull), 3, 'the cranium and two eyes');
  assert.equal(arcs(GLYPHS.person), 1, 'one head');
  assert.equal(arcs(GLYPHS.crowd), 2, 'two heads');
  const sig = (p) => { const r = rec(); gatherGlyph(r.g, 0, 0, p, '#fff'); return r.calls.map((c) => c[0]).join(','); };
  const all = Object.keys(NODE_MARK_CSS).map(sig);
  assert.equal(new Set(all).size, all.length, 'five works, five shapes');
  const d = rec(); gatherGlyph(d.g, 0, 0, 'tinkering', '#fff');
  assert.equal(d.calls.filter((c) => c[0] === 'lineTo').length, 3, 'GATHER-OW\'s diamond');
});

test('OW-GLYPHS: the readout draws each look by its glyph (by source)', () => {
  const hud = readFileSync(new URL('../../../src/ui/travel/travelViewHud.js', import.meta.url), 'utf8');
  assert.match(hud, /look === 'gather'\) \{[^\n]*\n\s*gatherGlyph\(g, x, y, \(m\.kind \?\? ''\)\.split\(' '\)\[1\] \?\? '', color\);/);
  assert.match(hud, /look === 'band' \|\| look === 'raider'\) \{[^\n]*\n\s*skullGlyph\(g, x, y\);/);
  assert.match(hud, /look === 'lair' \|\| \(\(look === 'far' \|\| look === 'place'\) && \/\\bdungeon\\b\/\.test\(m\.kind \?\? ''\)\)\) \{[^\n]*\n\s*dungeonGlyph\(g, x, y\);/);   // OW-DUNGEON-DOT: a found dungeon's plate in the grid too
  assert.match(hud, /look === 'party' \|\| look === 'traveller'\) \{[^\n]*\n\s*if \(\/\\bcrowd\\b\/\.test\(m\.kind \?\? ''\)\) crowdGlyph\(g, x, y\); else personGlyph\(g, x, y\);/);
  // the ships, the held arrows and the hubs' wheels are drawn before - a party at sea keeps its sail, a far town its wheel
  const at = (re) => hud.search(re);
  assert.ok(at(/else if \(isShipKind\(m\)\)/) < at(/look === 'party' \|\| look === 'traveller'/));
  assert.ok(at(/\(look === 'place' \|\| look === 'far'\) && m\.hub/) < at(/look === 'lair' \|\| \(\(look === 'far'/));
});

test('OW-CROSS (Mac: "where you click a cross mark not a circle"): the spot a click walks to and a journey\'s place are an X - no circle, gold on the black rim, its shadow under it, the brush handed back', () => {
  for (const r of [TV_CROSS_R, TV_CROSS_R + 0.5]) {
    const { g, calls, box, t } = rec('#4e7f72');
    crossGlyph(g, 0, 0, r);
    assert.equal(calls.filter((c) => c[0] === 'arc').length, 0, 'never a circle');
    assert.equal(calls.filter((c) => c[0] === 'ellipse').length, 1, 'its shadow');
    const strokes = calls.filter((c) => c[0] === 'stroke').map((c) => c.at(-1));
    assert.deepEqual(strokes.slice(0, 2), ['#000', TV_CROSS_GOLD], 'the rim, then the gold');
    assert.deepEqual(calls.filter((c) => c[0] === 'moveTo').slice(0, 2).map((c) => [c[1], c[2]]), [[-r, -r], [r, -r]], 'two arms crossed');
    assert.ok(box.y0 >= -8 && box.y1 <= 7.5 && box.x0 >= -9 && box.x1 <= 9, `within the dots' room (its shadow brushing a label's top): ${JSON.stringify(box)}`);
    assert.deepEqual([t.fillStyle, t.strokeStyle, t.lineWidth, t.lineCap], ['#4e7f72', '#000', 1, 'butt']);
  }
  const hud = readFileSync(new URL('../../../src/ui/travel/travelViewHud.js', import.meta.url), 'utf8');
  assert.match(hud, /look === 'target' \|\| look === 'dest'\) \{[^\n]*\n\s*crossGlyph\(g, x, y, look === 'dest' \? TV_CROSS_R \+ 0\.5 : TV_CROSS_R\);/);
});
