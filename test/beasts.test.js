// THE BEASTS — Giant Rat, Grizzly Bear, Sabertooth Tiger.
//
// The first enemies in this project with no human in them at all. Every
// other design is a person underneath: an orc is a person scaled, a
// skeleton a person stripped, a lich a person in robes, and even the
// centaur is a person from the waist up. These collapse the rig's WHOLE
// body — all six groups, using the mechanism the centaur needed for two
// — and what the player sees is entirely the piece.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { BEAST_DESIGNS, beastOpts, BEAST_RAMPS, ALL_GROUPS } from '../src/characters/beasts.js';
import { buildBeastBody } from '../src/characters/pieces/beastBody.js';

const pal = { get: (i) => ({ r: (i * 7) & 255, g: (i * 5) & 255, b: (i * 3) & 255 }) };

test('beasts: every group of the human rig is collapsed', () => {
  // Miss one and a human arm hangs inside a bear.
  assert.deepEqual(ALL_GROUPS.sort(), ['armL', 'armR', 'body', 'head', 'legL', 'legR']);
  const src = readFileSync(new URL('../src/characters/paperdollPayload.js', import.meta.url), 'utf8');
  assert.ok(/collapseGroups\(bf, ALL_GROUPS/.test(src), 'the beasts do not collapse the whole rig');
});

test('beasts: they stand on the ground, and not through it', () => {
  for (const d of BEAST_DESIGNS) {
    const f = buildBeastBody(undefined, d.beast);
    let lo = 9;
    let hi = -9;
    for (const q of f) for (let i = 1; i < 12; i += 3) { lo = Math.min(lo, q.p[i]); hi = Math.max(hi, q.p[i]); }
    assert.ok(lo >= 0, `${d.name} sinks ${(-lo).toFixed(2)} below the floor`);
    assert.ok(lo < 0.05, `${d.name} floats ${lo.toFixed(2)} above it`);
    assert.ok(hi > 0.15, `${d.name} is only ${hi.toFixed(2)} tall`);
  }
});

test('beasts: one builder, three animals that are not each other', () => {
  // A rat is long and low, a bear is a mountain on short legs, a tiger
  // is longer again. If those collapse to one shape the parameters are
  // decoration.
  const size = (d) => {
    const f = buildBeastBody(undefined, d.beast);
    let lo = [9, 9, 9];
    let hi = [-9, -9, -9];
    for (const q of f) for (let i = 0; i < 12; i += 3) for (let k = 0; k < 3; k++) {
      const v = q.p[i + k];
      if (v < lo[k]) lo[k] = v;
      if (v > hi[k]) hi[k] = v;
    }
    return { h: hi[1], len: hi[2] - lo[2], w: hi[0] - lo[0] };
  };
  const rat = size(BEAST_DESIGNS.find((d) => d.name === 'Giant Rat'));
  const bear = size(BEAST_DESIGNS.find((d) => d.name === 'Grizzly Bear'));
  const tiger = size(BEAST_DESIGNS.find((d) => d.name === 'Sabertooth Tiger'));
  assert.ok(rat.h < bear.h * 0.5, 'the rat is not markedly lower than the bear');
  assert.ok(bear.w > tiger.w, 'the bear is not broader than the cat');
  assert.ok(tiger.len > bear.len, 'the cat is not longer than the bear');
});

test('beasts: the piece is what the player sees, so it must exist', () => {
  // The whole animal IS the piece. Adding `beast` to PIECE_KINDS without
  // building a table for the line left three animals rendering as
  // NOTHING — the rig under them is collapsed, so there was not even a
  // man left to see. The tables are keyed by line now.
  const src = readFileSync(new URL('../src/tools/paperdollViewer.js', import.meta.url), 'utf8');
  assert.ok(/pieceTables = \{/.test(src), 'piece tables are not keyed by line');
  for (const line of ['orc', 'undead', 'class', 'atronach', 'beast']) {
    assert.ok(new RegExp(`${line}: buildPieces\\(`).test(src), `the ${line} line has no piece table`);
  }
});

test('beasts: legal ramps, and a pelt each', () => {
  const seen = new Set();
  for (const d of BEAST_DESIGNS) {
    const span = BEAST_RAMPS[d.pelt];
    assert.ok(span, `${d.name} has no pelt`);
    assert.ok(span[1] > span[0] && span[0] >= 0 && span[1] <= 255, `${d.name}'s pelt leaves the palette`);
    assert.ok(!seen.has(d.pelt), `${d.name} shares a pelt — three brown animals is one animal`);
    seen.add(d.pelt);
    const { ramps } = beastOpts(d, pal);
    assert.ok(ramps.skin.length > 2, `${d.name} resolved to no colours`);
  }
});
