// CARDS8 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md sections 6.2 and 9): THE FACES OF ILIAC HAND - Mac: "Painted
// in code", the way the Hold'em deck is. Every emblem a glyph of our own paths, the frame in the loot's tier colour,
// the frame's window in the kind's shape, the gem and the shield only where the kind has them (the art is ours).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  EMBLEM_PAINTERS, paintIliacCard, paintIliacBack, wrapCardText, ILIAC_CARD_ASPECT, KIND_ART, TIER_FRAMES, iliacLayout,
  COST_GEM, POWER_SHIELD,
} from '../src/render/iliacCardFaces.js';
import { paintBack } from '../src/render/cardFaces.js';
import { RARITIES, RARITY_ORDER } from '../src/systems/lootRarity.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** The emblems the catalog's cards carry - every one must have its painter. */
const EMBLEMS = ['beast', 'insect', 'undead', 'ghost', 'vampire', 'lich', 'were', 'orc', 'giant', 'centaur', 'harpy', 'nymph',
  'dreugh', 'daedra', 'atronach', 'dragon', 'knight', 'mage', 'thief', 'assassin', 'priest', 'warrior', 'noble', 'prince',
  'artifact', 'fire', 'frost', 'shock', 'heal', 'shadow', 'city', 'desert', 'fortress', 'dungeon', 'sea'];
const KINDS = ['unit', 'spell', 'prince', 'location'];

/**
 * A 2D context that records what is painted, in order: every call with its arguments (numbers rounded), every fill
 * and stroke with the colour it was made in, every text.
 */
function recorder({ charW = 7 } = {}) {
  const log = { calls: [], fills: [], strokes: [], texts: [], paths: 0 };
  const state = { fillStyle: '#000', strokeStyle: '#000', lineWidth: 1 };
  const round = (a) => (typeof a === 'number' ? Math.round(a * 1000) / 1000 : a);
  const ctx = new Proxy({}, {
    get(_, k) {
      if (k in state) return state[k];
      if (k === 'measureText') return (t) => ({ width: String(t).length * charW });
      return (...args) => {
        log.calls.push([k, ...args.map(round)]);
        if (k === 'fill' || k === 'fillRect') log.fills.push(state.fillStyle);
        if (k === 'stroke' || k === 'strokeRect') log.strokes.push([state.strokeStyle, state.lineWidth]);
        if (k === 'fillText') log.texts.push([String(args[0]), state.fillStyle]);
        if (['moveTo', 'lineTo', 'arc', 'quadraticCurveTo'].includes(k)) log.paths++;
      };
    },
    set(_, k, v) { if (k in state) state[k] = v; log.calls.push(['set', k, v]); return true; },
  });
  return { ctx, log };
}

const sample = (kind, tier, extra = {}) => ({
  id: `t-${kind}-${tier}`, name: `A ${tier} ${kind}`, kind, cost: 3, power: kind === 'unit' || kind === 'prince' ? 5 : null, tier,
  tags: [], text: 'When played, add one power to every other unit you hold here.', emblem: kind === 'location' ? 'fortress' : 'undead',
  flavor: 'The bones remember.', ...extra,
});

test('CARDS8 every emblem the catalog carries has its own glyph, traced from paths and filled or stroked', () => {
  assert.deepEqual(Object.keys(EMBLEM_PAINTERS).sort(), [...EMBLEMS].sort(), 'one painter per emblem, no more and no fewer');
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
    seqs.set(e, JSON.stringify(log.calls));
  }
  assert.notEqual(seqs.get('undead'), seqs.get('lich'), 'the lich is more than the skull');
  assert.equal(new Set(seqs.values()).size, EMBLEMS.length, 'no two emblems paint alike');
});

test('CARDS8 the catalog\'s emblems all have a painter (when the catalog is in the tree)', async () => {
  if (!existsSync(new URL('../src/net/iliacCards.js', import.meta.url))) return;
  const cat = await import('../src/net/iliacCards.js');
  if (!cat.CARD_EMBLEMS) return;
  for (const e of cat.CARD_EMBLEMS) assert.ok(EMBLEM_PAINTERS[e], `the catalog's ${e} has a painter`);
});

test('CARDS8 every kind and tier paints at the binder\'s tile and at full size; the frame is the loot tier\'s colour', () => {
  assert.equal(ILIAC_CARD_ASPECT, 0.7);
  assert.deepEqual(Object.keys(TIER_FRAMES), [...RARITY_ORDER], 'a frame for every tier of the loot\'s ladder, in its order');
  assert.deepEqual(Object.keys(KIND_ART), KINDS);
  for (const kind of KINDS) {
    for (const tier of RARITY_ORDER) {
      for (const [w, h] of [[70, 100], [350, 500]]) {
        const { ctx, log } = recorder();
        assert.doesNotThrow(() => paintIliacCard(ctx, sample(kind, tier), w, h), `${kind} ${tier} at ${w}x${h}`);
        assert.equal(log.strokes[0][0], RARITIES[tier].colour, `${kind} ${tier}: the frame is RARITIES.${tier}.colour`);
        assert.ok(Math.abs(log.strokes[0][1] - TIER_FRAMES[tier].band * (h / 100)) < 1e-9, 'the rim scales with the card');
        assert.ok(log.texts.some(([t]) => t === `A ${tier} ${kind}`), 'the name is in its banner');
      }
    }
  }
  const rim = (tier) => { const { ctx, log } = recorder(); paintIliacCard(ctx, sample('unit', tier), 350, 500); return log; };
  const [common, legendary, artifact] = [rim('common'), rim('legendary'), rim('artifact')];
  assert.ok(legendary.strokes[0][1] > common.strokes[0][1], 'a higher tier\'s frame is heavier');
  assert.ok(legendary.fills.filter((f) => f === RARITIES.legendary.colour).length >= 8 + 1, 'a legendary frame is studded');
  assert.ok(artifact.strokes.some(([s]) => s === '#ffffff') && !legendary.strokes.some(([s]) => s === '#ffffff'), 'the inner glow line is the aetheric and the artifact\'s alone');
  const odd = recorder();
  assert.doesNotThrow(() => paintIliacCard(odd.ctx, { name: 'Gap', kind: 'nonsense', tier: 'nonsense', emblem: 'nonsense' }, 70, 100), 'a gap in the catalog shows, it does not throw');
  assert.equal(odd.log.strokes[0][0], RARITIES.common.colour);
});

test('CARDS8 the kind is the frame: a location has no gem nor shield, a spell no shield, a unit and a prince both', () => {
  const paint = (kind) => { const { ctx, log } = recorder(); paintIliacCard(ctx, sample(kind, 'rare', { cost: 7, power: 9 }), 350, 500); return log; };
  for (const kind of KINDS) {
    const log = paint(kind);
    const gem = log.fills.includes(COST_GEM), shield = log.fills.includes(POWER_SHIELD);
    assert.equal(gem, kind !== 'location', `${kind}: ${kind === 'location' ? 'no' : 'a'} cost gem`);
    assert.equal(shield, kind === 'unit' || kind === 'prince', `${kind}: ${shield ? 'a' : 'no'} power shield`);
    assert.equal(log.texts.some(([t]) => t === '7'), gem, `${kind}: the cost is written only on a gem`);
    assert.equal(log.texts.some(([t]) => t === '9'), shield, `${kind}: the power is written only on a shield`);
  }
  const shapes = KINDS.map((k) => iliacLayout(k, 'common', 350, 500));
  assert.deepEqual(shapes.map((L) => L.shape), ['square', 'rounded', 'arch', 'landscape']);
  assert.equal(shapes[0].win.w, shapes[0].win.h, 'a unit\'s window is square');
  assert.ok(shapes[3].win.w > shapes[3].win.h * 1.3, 'a location\'s is a wide landscape');
  assert.ok(shapes[3].banner.y < shapes[3].win.y, 'its name rides above it, where the gem would be');
  assert.equal(shapes[3].gem, null); assert.equal(shapes[1].shield, null);
  for (const L of shapes) {
    assert.ok(L.win.y + L.win.h <= L.box.y, 'the window sits above the text');
    assert.ok(L.box.y + L.box.h <= 500 - L.p, 'the text box sits inside the panel');
  }
  const prince = paint('prince');
  assert.ok(prince.fills.includes(KIND_ART.prince.ink) && prince.fills.includes(KIND_ART.prince.ground), 'the prince\'s gold on Oblivion\'s ground');
});

test('CARDS8 the rules wrap by the context\'s own measure; the flavor in italics goes first when the box is full', () => {
  const { ctx } = recorder({ charW: 10 });
  assert.deepEqual(wrapCardText(ctx, 'aaa bbb ccc', 70), ['aaa bbb', 'ccc'], '7 letters at 10 a letter fill a 70 line');
  assert.deepEqual(wrapCardText(ctx, 'aaa bbb ccc', 69), ['aaa', 'bbb', 'ccc']);
  assert.deepEqual(wrapCardText(ctx, 'one\ntwo three', 200), ['one', 'two three'], 'a newline always breaks');
  assert.deepEqual(wrapCardText(ctx, 'abcdefghij', 40), ['abcd', 'efgh', 'ij'], 'a word wider than the line breaks by letters');
  assert.deepEqual(wrapCardText(ctx, '', 40), [''], 'no words, one empty line');
  for (const line of wrapCardText(ctx, 'The quick brown fox jumps over the lazy dog by the Iliac Bay', 90)) assert.ok(line.length * 10 <= 90, line);
  const roomy = recorder({ charW: 3 });
  paintIliacCard(roomy.ctx, sample('spell', 'magic', { text: 'Deal two.', flavor: 'Short.' }), 350, 500);
  const fl = roomy.log.calls.filter((c) => c[0] === 'set' && c[1] === 'font').map((c) => c[2]);
  assert.ok(fl.some((f) => /^italic /.test(f)) && roomy.log.texts.some(([t]) => t === 'Short.'), 'room to spare: the flavor, in italics');
  const full = recorder({ charW: 3 });
  paintIliacCard(full.ctx, sample('spell', 'magic', { text: 'word '.repeat(400), flavor: 'Never seen.' }), 350, 500);
  assert.ok(!full.log.texts.some(([t]) => t === 'Never seen.'), 'a full box drops the flavor');
  assert.ok(full.log.texts.some(([t]) => t.endsWith('…')), 'and cuts the rules off with an ellipsis');
});

test('CARDS8 the back is the Bay\'s compass rose - not the house deck\'s medallion', () => {
  const ours = recorder(), house = recorder();
  assert.doesNotThrow(() => paintIliacBack(ours.ctx, 70, 100));
  paintIliacBack(ours.ctx, 350, 500);
  paintBack(house.ctx, 350, 500);
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
});
