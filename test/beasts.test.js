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
import * as wingsMod from '../src/characters/pieces/wings.js';
import * as arachMod from '../src/characters/pieces/arachnid.js';

const pal = { get: (i) => ({ r: (i * 7) & 255, g: (i * 5) & 255, b: (i * 3) & 255 }) };

test('beasts: a design collapses exactly what it does not use', () => {
  // This read "every group is always collapsed" and the werebeasts broke
  // it correctly: they keep the man's body and replace only his skull.
  // The rule is not "collapse everything", it is "collapse what the
  // piece replaces" — and a full beast replaces all of it.
  assert.deepEqual(ALL_GROUPS.sort(), ['armL', 'armR', 'body', 'head', 'legL', 'legR']);
  for (const d of BEAST_DESIGNS) {
    const groups = d.collapse || ALL_GROUPS;
    // THE RULE, FINALLY STATED PLAINLY. This has been rewritten three
    // times because each time I described the KINDS I knew — whole
    // beasts, then arachnids, then werebeasts — and the next design was
    // a kind I had not thought of. The imp is the fourth: it collapses
    // NOTHING, being a small man who happens to have wings.
    //
    // What is actually true, and was true all along: a group is
    // collapsed exactly when something replaces it. Nothing else.
    // FIFTH COUNTEREXAMPLE, and the rule finally generalises instead of
    // growing another branch: a lamia replaces her LEGS with a fish
    // tail. So the expectation is not a list of design kinds at all —
    // it is whatever the design says it replaces, and the check is that
    // it replaces something for everything it collapses.
    // A `fish` is a WHOLE BODY on a slaughterfish and a TAIL on a lamia,
    // and what tells them apart is the design's own collapse list — the
    // lamia names her legs, the fish names nothing and takes everything.
    const partial = Array.isArray(d.collapse) && d.collapse.length > 0 && d.collapse.length < ALL_GROUPS.length;
    const replacesBody = !!(d.beast || d.arachnid || (d.fish && !partial));
    const replacesHead = !!d.beastHead;
    const replacesLegs = !!d.fish && !replacesBody;
    const expected = replacesBody
      ? ALL_GROUPS
      : replacesHead
        ? ['head']
        : replacesLegs
          ? ['legL', 'legR']
          : [];
    assert.deepEqual(
      groups,
      expected,
      `${d.name} collapses ${JSON.stringify(groups)} but replaces ${replacesBody ? 'its whole body' : replacesHead ? 'its head' : 'nothing'}`,
    );
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
    // A SHARED PELT IS ONLY A PROBLEM WHERE THE SHAPES ALSO MATCH. Three
    // brown quadrupeds would be one animal; a slaughterfish and a
    // lamia's tail SHOULD be the same scales, because they are the same
    // material on two different bodies. The pin is on the pair, not on
    // the colour.
    const whole = !Array.isArray(d.collapse) || d.collapse.length === ALL_GROUPS.length;
    const shape = d.beast
      ? 'quad'
      : d.arachnid
        ? 'arach'
        : d.fish
          ? whole
            ? 'fish'
            : 'fishtail' // a lamia's tail is the same scales on a different animal
          : d.wings
            ? 'wing'
            : 'were';
    const key = d.pelt + ':' + shape;
    assert.ok(!seen.has(key), `${d.name} is another ${shape} in ${d.pelt} — that is one animal twice`);
    seen.add(key);
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
    // THE FLOOR WAS SET BY THE THING THAT FAILED, not by the thing that
    // has to pass. A wereboar at 58 was invisible so the gate went to
    // 70 — and a spider at 100 was ALSO invisible, because it is a small
    // body on thin legs with a fraction of the area to be seen with.
    // Area and brightness trade off, and 70 only ever protected the big
    // ones.
    assert.ok(mean > 95, `${name} means ${mean.toFixed(0)} — it loses its silhouette against the dark`);
  }
});

// ── WINGS: THE LAST BODY PLAN ────────────────────────────────────
// `behaviour: Flying` is the one category in ENEMY_BASICS that is
// neither foot nor fin, and a wing is a MEMBRANE ON FINGERS — what the
// eye reads is the sheet between the bones, not the bones. It cannot be
// made out of the boxes everything else here is.

test('wings: fold moves the wing back rather than shrinking it', () => {
  const { buildWings } = wingsMod;
  const measure = (fold) => {
    const f = buildWings(undefined, { span: 0.6, at: 1.0, fold, fingers: 4, droop: 0.2 });
    let lo = [9, 9, 9];
    let hi = [-9, -9, -9];
    for (const q of f) for (let i = 0; i < 12; i += 3) for (let k = 0; k < 3; k++) {
      const v = q.p[i + k];
      if (v < lo[k]) lo[k] = v;
      if (v > hi[k]) hi[k] = v;
    }
    return { w: hi[0] - lo[0], d: hi[2] - lo[2] };
  };
  const open = measure(0.1);
  const shut = measure(0.85);
  assert.ok(shut.w < open.w * 0.6, 'folding does not draw the wing in');
  assert.ok(shut.d > open.d, 'folding does not put the wing BEHIND the animal — it is being shrunk instead');
  // And the face count must not change: it is one wing at two folds,
  // not two wings.
  const a = buildWings(undefined, { fold: 0.1 });
  const b = buildWings(undefined, { fold: 0.9 });
  assert.equal(a.length, b.length, 'a folded wing is a different piece from an open one');
});

test('wings: a giant bat is sized like a giant one', () => {
  // My first cut used a real bat's proportions and produced a flat strip
  // at ankle height that the viewer's own UI sat on top of. The word in
  // the name is doing work: this is an animal a man FIGHTS.
  const bat = BEAST_DESIGNS.find((d) => d.name === 'Giant Bat');
  assert.ok(bat.beast.back > 0.5, `a bat whose back is at ${bat.beast.back} is not giant`);
  assert.ok(bat.wings.span > 0.8, 'its wings do not span more than a man is wide');
  assert.ok(bat.wings.at > 0.6, 'its wings hang below a man\'s waist');
});

test('wings: the same piece serves a bat and an imp', () => {
  // An imp is a small man who happens to have a pair, at a fold nothing
  // like a bat's — which is the argument for fold being a NUMBER rather
  // than two pieces.
  const winged = BEAST_DESIGNS.filter((d) => d.wings);
  assert.ok(winged.length >= 2, 'only one design flies');
  const imp = BEAST_DESIGNS.find((d) => d.name === 'Imp');
  assert.deepEqual(imp.collapse, [], 'the imp collapses part of the rig — it is a person');
  assert.ok(!imp.beast && !imp.arachnid, 'the imp has a body that is not the rig');
  assert.ok(imp.build && imp.build.torso < 0.8, 'the imp is not small');
});

// ── WATER: A BODY THAT STANDS ON NOTHING ─────────────────────────
// A quadruped tapers nose to rump and stands on four legs. A fish
// tapers the same way and stands on NOTHING — which is not a leg length
// of zero, because that leaves a barrel lying on the floor.

test('water: the fish builder serves a whole fish and a lamia\'s tail', () => {
  // Its `from` is why: a tail that starts at a waist is the same
  // geometry as a fish that starts at a head, and the alternative was
  // two builders that differ by an offset.
  const fish = BEAST_DESIGNS.find((d) => d.name === 'Slaughterfish');
  const lamia = BEAST_DESIGNS.find((d) => d.name === 'Lamia');
  assert.ok(fish.fish && lamia.fish, 'the water designs do not share a builder');
  assert.equal(lamia.fish.from, 0, 'the lamia tail is offset by from rather than by its own length');
  assert.ok(fish.fish.jaw > 0 && !lamia.fish.jaw, 'a lamia has a fish jaw, or a slaughterfish has none');
});

test('lamia: her tail meets her waist', () => {
  // At 0.72 the tail hung BELOW the collapsed pelvis with daylight
  // between them — two animals in a stack rather than one thing.
  const lamia = BEAST_DESIGNS.find((d) => d.name === 'Lamia');
  assert.deepEqual(lamia.collapse, ['legL', 'legR'], 'the lamia keeps her legs');
  assert.ok(lamia.fish.at > 0.8, `tail slung at ${lamia.fish.at} leaves a gap at the waist`);
  assert.ok(lamia.hideRamp !== lamia.pelt, 'her skin is her scales — she is a fish all the way up');
});

test('dreugh: claws without a spider under it', () => {
  // Borrowing the arachnid builder for its CLAWS brought eight small
  // spider legs along: a crustacean standing on its own legs with a
  // spider's underneath. legPairs is why that is now a choice.
  const d = BEAST_DESIGNS.find((x) => x.name === 'Dreugh');
  assert.equal(d.claws.legPairs, 0, 'the dreugh has spider legs');
  assert.deepEqual(d.collapse, [], 'the dreugh collapses part of itself — it walks upright');
  const { buildArachnid } = arachMod;
  const legged = buildArachnid(undefined, { claws: 1 });
  const clawsOnly = buildArachnid(undefined, { claws: 1, legPairs: 0 });
  assert.ok(clawsOnly.length < legged.length / 2, 'legPairs 0 does not actually drop the legs');
});
