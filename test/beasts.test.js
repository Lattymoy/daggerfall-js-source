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

test('beasts: a design collapses exactly what it does not use', () => {
  // This read "every group is always collapsed" and the werebeasts broke
  // it correctly: they keep the man's body and replace only his skull.
  // The rule is not "collapse everything", it is "collapse what the
  // piece replaces" — and a full beast replaces all of it.
  assert.deepEqual(ALL_GROUPS.sort(), ['armL', 'armR', 'body', 'head', 'legL', 'legR']);
  for (const d of BEAST_DESIGNS) {
    const groups = d.collapse || ALL_GROUPS;
    if (d.beast) {
      assert.deepEqual(groups, ALL_GROUPS, `${d.name} is a whole animal but keeps part of a man`);
    } else {
      assert.ok(d.beastHead, `${d.name} collapses ${groups} and puts nothing in its place`);
      assert.ok(groups.includes('head'), `${d.name} has a beast head over a human one`);
    }
  }
  const src = readFileSync(new URL('../src/characters/paperdollPayload.js', import.meta.url), 'utf8');
  assert.ok(/collapseGroups\(bf, d\.collapse \|\| ALL_GROUPS/.test(src), 'the payload ignores a design\'s collapse list');
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

// ── THE WEREBEASTS: A MAN WITH THE WRONG HEAD ────────────────────
// A Daggerfall werewolf is not a wolf on four legs. The rig keeps its
// arms, its legs and its stance, and only the SKULL is replaced — which
// makes this the narrowest collapse in the project, one group of six,
// where the full beasts take all of them.

test('werebeasts: they collapse only the head, and keep the man', () => {
  for (const d of BEAST_DESIGNS.filter((x) => x.beastHead)) {
    assert.deepEqual(d.collapse, ['head'], `${d.name} collapses more than its skull`);
    assert.ok(!d.beast, `${d.name} has a full beast body — it walks upright`);
    assert.ok(d.build && Object.keys(d.build).length, `${d.name} has no build — it kept a man's body`);
  }
});

test('werebeasts: heavier than the man they were', () => {
  for (const d of BEAST_DESIGNS.filter((x) => x.beastHead)) {
    assert.ok(d.build.torso > 1.1, `${d.name} is no broader than a man`);
    assert.ok(d.build.hand > 1.2, `${d.name} has a man's hands`);
  }
  // And a boar is blunter and broader than a wolf, or they are one enemy.
  const wolf = BEAST_DESIGNS.find((d) => d.name === 'Werewolf');
  const boar = BEAST_DESIGNS.find((d) => d.name === 'Wereboar');
  assert.ok(boar.build.torso > wolf.build.torso, 'the boar is no broader than the wolf');
  assert.ok(boar.beastHead.depth > wolf.beastHead.depth, 'the boar has no blunter a muzzle');
  assert.ok(boar.beastHead.tusks > 0 && wolf.beastHead.tusks === 0, 'tusks are what tell them apart');
});

test('beasts: every pelt survives the background it stands on', () => {
  // THE SECOND TIME CONTRAST HAS BITTEN. A wereboar's bristle resolved
  // to a mean of 58 against a viewer background of about 20, and it read
  // NARROWER than a werewolf despite being measurably wider — the edges
  // went into the dark. A design nobody can see the shape of has said
  // nothing, however carefully it was built.
  const pal = {
    get: (i) => {
      const B = [[200,200,200],[186,176,160],[178,132,84],[214,158,170],[206,176,128],[150,148,172],
                 [120,160,214],[236,236,232],[140,200,200],[206,194,96],[150,196,120],[176,108,66],
                 [190,202,110],[170,150,200],[236,206,140],[222,108,66]];
      const idx = Math.max(0, Math.min(255, i | 0));
      const [r, g, b] = B[(idx >> 4) & 15];
      const k = 1 - (idx & 15) / 15;
      const f = 0.24 + k * 0.86;
      return { r: Math.round(r * f), g: Math.round(g * f), b: Math.round(b * f) };
    },
  };
  for (const [name, [a, b]] of Object.entries(BEAST_RAMPS)) {
    let sum = 0;
    let n = 0;
    for (let i = b; i >= a; i--) {
      const c = pal.get(i);
      sum += (c.r + c.g + c.b) / 3;
      n++;
    }
    const mean = sum / n;
    assert.ok(mean > 70, `${name} means ${mean.toFixed(0)} — it loses its silhouette against the dark`);
  }
});
