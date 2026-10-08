// CARDS-BAY (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 21): THE DECK OF THE ILIAC BAY - the four crowns
// as the suits, their royals as the courts, the seals as the aces, every picture painted from paths (the art is ours).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SUIT_CROWNS, courtOf, cardTitle, rankLabel, PIP_LAYOUT, paintFace, paintBack, paintCharge, RANK_JACK, RANK_KING, RANK_ACE,
} from '../src/render/cardFaces.js';
import { CROWN_LORE } from '../src/systems/naval/navalShips.js';
import { parseCard, SUITS } from '../src/net/cardLaw.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** A 2D context that records what is painted: every fill's colour, every text, every path step. */
function recorder() {
  const log = { fills: [], texts: [], paths: 0, rotations: 0 };
  let fillStyle = '#000';
  const ctx = new Proxy({}, {
    get(_, k) {
      if (k === 'fillStyle') return fillStyle;
      if (k === 'measureText') return (t) => ({ width: String(t).length * 7 });
      if (k === 'fill' || k === 'fillRect') return () => log.fills.push(fillStyle);
      if (k === 'fillText') return (t) => log.texts.push([String(t), fillStyle]);
      if (k === 'rotate') return () => { log.rotations++; };
      if (['moveTo', 'lineTo', 'arc', 'ellipse', 'quadraticCurveTo', 'rect'].includes(k)) return () => { log.paths++; };
      return () => {};
    },
    set(_, k, v) { if (k === 'fillStyle') fillStyle = v; return true; },
  });
  return { ctx, log };
}

test('CARDS-BAY the suits are the Bay\'s four crowns, each its own charge and colour', () => {
  assert.equal(SUITS, 'cdhs', 'cardLaw\'s suit order the table reads');
  assert.deepEqual(SUIT_CROWNS.map((s) => [s.crown, s.charge]), [['Orsinium', 'axe'], ['Sentinel', 'sun'], ['Wayrest', 'rose'], ['Daggerfall', 'dagger']]);
  assert.equal(new Set(SUIT_CROWNS.map((s) => s.colour)).size, 4, 'a four-colour deck - no two crowns share an ink');
  assert.ok(Object.isFrozen(SUIT_CROWNS) && SUIT_CROWNS.every((s) => Object.isFrozen(s) && Object.isFrozen(s.courts)));
});

test('CARDS-BAY the courts are the crowns\' own royals - the game\'s names, never a made-up one', () => {
  const named = SUIT_CROWNS.flatMap((s) => s.courts.filter((c) => c.name).map((c) => [s.crown, c.name]));
  for (const [crown, name] of named) {
    if (crown === 'Orsinium') assert.match(read('src/systems/lootRarity.js'), new RegExp(`King ${name}`), `${name} is the game's king of Orsinium`);
    else assert.ok(CROWN_LORE[crown].royals.includes(name), `${name} is one of ${crown}'s royals on the port's roll`);
  }
  assert.deepEqual(['Kc', 'Qd', 'Jh', 'Ks', 'Qs', 'Js', 'Qc'].map((t) => cardTitle(parseCard(t))), [
    'Gortwog, King of Orsinium', 'Akorithi, Queen of Sentinel', 'Helseth, Prince of Wayrest',
    'Gothryd, King of Daggerfall', 'Aubk-i, Queen of Daggerfall', 'Nulfaga, Mage of Daggerfall', 'The Queen of Orsinium',
  ]);
  assert.deepEqual(['Ah', '7d', 'Tc'].map((t) => cardTitle(parseCard(t))), ['The Seal of Wayrest', '7 of Sentinel', '10 of Orsinium']);
  assert.equal(cardTitle(-1), 'A card face down');
  assert.equal(courtOf(parseCard('Ts')), null, 'a pip is no court');
  assert.equal(courtOf(parseCard('As')), null, 'nor is the seal');
  assert.equal(courtOf(parseCard('Js')).head, 'hood', 'the mage\'s hood');
  assert.deepEqual(SUIT_CROWNS.map((s) => s.courts[RANK_KING - RANK_JACK].head), ['crown', 'crown', 'crown', 'crown']);
  assert.deepEqual([rankLabel(8), rankLabel(RANK_JACK), rankLabel(RANK_ACE), rankLabel(0)], ['10', 'J', 'A', '2'], 'the poker player\'s own letters');
});

test('CARDS-BAY the pips: n of them for an n, mirrored about the middle (the 7\'s odd pip above it), inside the box', () => {
  PIP_LAYOUT.forEach((pips, i) => {
    assert.equal(pips.length, i + 2, `the ${i + 2} has ${i + 2} pips`);
    for (const [x, y] of pips) assert.ok(Math.abs(x) <= 1 && Math.abs(y) <= 1);
    const key = (p) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`;
    const set = new Set(pips.map(key));
    assert.equal(set.size, pips.length, 'no two pips on one spot');
    const odd = i + 2 === 7 ? [[0, -0.5]] : [];
    for (const [x, y] of pips) if (!odd.some((o) => o[0] === x && o[1] === y)) assert.ok(set.has(key([-x, -y])), `the ${i + 2} turns end for end`);
  });
});

test('CARDS-BAY every face is painted in its crown\'s ink from paths - no glyph stands for a charge', () => {
  for (let c = 0; c < 52; c++) {
    const { ctx, log } = recorder();
    paintFace(ctx, c, 128, 180);
    const ink = SUIT_CROWNS[Math.floor(c / 13)].colour;
    assert.ok(log.fills.filter((f) => f === ink).length >= 3, `card ${c} is inked in its crown's colour`);
    assert.ok(log.paths > 20, `card ${c} is drawn, not written`);
    for (const [t] of log.texts) assert.match(t, /^(10|[2-9JQKA]|[A-Z-]+)$/, `card ${c} writes only its rank and a name, never a suit glyph (${t})`);
  }
  const queen = recorder(); paintFace(queen.ctx, parseCard('Qh'), 128, 180);
  assert.ok(queen.log.texts.some(([t]) => t === 'BARENZIAH'), 'the court writes its royal\'s name');
  const ace = recorder(); paintFace(ace.ctx, parseCard('As'), 128, 180);
  assert.ok(ace.log.texts.some(([t]) => t === 'DAGGERFALL'), 'the seal writes its crown');
  const six = recorder(); paintFace(six.ctx, parseCard('6c'), 128, 180);
  assert.equal(six.log.rotations, 1 + 2, 'the lower corner and the two lower pips paint upside down');
});

test('CARDS-BAY the back is the Bay\'s medallion: all four charges round it', () => {
  const charges = [];
  const { ctx } = recorder();
  const src = read('src/render/cardFaces.js');
  // every charge paints, and the back calls on all four
  for (const s of SUIT_CROWNS) { const r = recorder(); paintCharge(r.ctx, s.charge, 20, s.colour); assert.ok(r.log.paths >= 4, `${s.charge} has a shape`); charges.push(s.charge); }
  paintBack(ctx, 128, 180);
  assert.match(src, /for \(const \[s, x, y\] of \[\[3, 0, -1\], \[2, 1, 0\], \[1, 0, 1\], \[0, -1, 0\]\]\)/, 'Daggerfall north, Wayrest east, Sentinel south, Orsinium west');
  assert.deepEqual(charges, ['axe', 'sun', 'rose', 'dagger']);
});

test('CARDS-BAY the art is ours: no ARENA2 read, and the panel and the cloth share one painter', () => {
  const src = read('src/render/cardFaces.js');
  assert.doesNotMatch(src, /^import .*(textureFile|imgFile|cifRci|arena2|loadTexture)/im, 'the deck reads no game file');
  assert.match(read('src/render/cardTableDraw.js'), /import \{ paintFace, paintBack, STOCK \} from '\.\/cardFaces\.js';/);
  assert.match(read('src/ui/cardTableHud.js'), /import \{ SUIT_CROWNS, rankLabel, cardTitle, paintFace, paintBack \} from '\.\.\/render\/cardFaces\.js';/);
  assert.doesNotMatch(read('src/ui/cardTableHud.js') + read('src/render/cardTableDraw.js'), /[♣♦♥♠]/, 'the old suits are gone');
});

test('CARDS-BAY the panel paints each card with the cloth\'s own painter, at its little size; a page with no canvas writes the words', async () => {
  const { createCardTableHud, PANEL_CARD_W, PANEL_CARD_H } = await import('../src/ui/cardTableHud.js');
  const { fakeDoc } = await import('./decorFakes.mjs');
  const doc = fakeDoc();
  const painted = [];
  const make = doc.createElement;
  doc.createElement = (tag) => { const n = make(tag); if (tag === 'canvas') { const r = recorder(); n.getContext = () => r.ctx; painted.push(r.log); } return n; };
  const hud = createCardTableHud({ onPress: () => {}, doc });
  const card = (t) => ({ card: parseCard(t), text: t, colour: '#000', title: cardTitle(parseCard(t)) });
  hud.render({ phase: 'playing', title: 'T', note: null, seats: [{ name: 'Ann', you: true, stack: 1, bet: 0, button: false, state: '', cards: [card('Ks'), { card: -1, text: '', colour: null, title: 'A card face down', back: true }] }], pot: 0, board: [card('Ah')], street: null, message: '', log: [], actions: [] });
  assert.equal(painted.length, 3, 'three cards, three little canvases');
  assert.ok(painted.every((l) => l.paths > 20), 'each one drawn');
  const spans = [];
  const walk = (n) => { if (n.className?.startsWith?.('card')) spans.push(n); for (const c of n.children ?? []) walk(c); };
  walk(hud.root);
  assert.ok(spans.filter((n) => n.className.includes('painted')).length === 3);
  assert.ok(spans.some((n) => n.title === 'Gothryd, King of Daggerfall'), 'the hover names the royal');
  assert.deepEqual([PANEL_CARD_W, PANEL_CARD_H], [32, 45]);
});
