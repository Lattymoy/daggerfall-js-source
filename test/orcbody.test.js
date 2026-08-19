// The orc line + the rig's build spec.
//
// The load-bearing assertion in this file is the FIRST one: adding
// `opts.build` to buildNeutralBody must not move a single vertex for
// any caller that does not pass it. raceCharacter, engineRig and
// villagerRender all call the rig with no build, and the villager
// payload is packed as a DELTA against the base face list - so a
// silent shift here would corrupt 25 villagers and every race body at
// once, in a way no orc test would ever catch.

import test from 'node:test';
import assert from 'node:assert';
import { buildNeutralBody, BUILD_IDENTITY, BUILD_MIN, BUILD_MAX } from '../src/characters/neutralBody.js';
import { ORC_DESIGNS, ORC_RAMPS, orcOpts, orcDesignFor } from '../src/characters/orcBody.js';
import { buildTusks, buildBrow, IVORY_RAMP } from '../src/characters/pieces/orcHead.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';

// Synthetic ramps - the geometry assertions are palette-independent, so
// these tests run without ARENA2.
const R = (a, b) => [[a, a, a], [b, b, b], [a, b, a], [b, a, b], [a, a, b], [b, b, a]];
const RAMPS = { skin: R(40, 200), boot: R(20, 120) };
const dump = (f) => JSON.stringify(f);

test('build spec is inert by default: no opts, {} and IDENTITY all agree', () => {
  const base = dump(buildNeutralBody(RAMPS));
  assert.equal(dump(buildNeutralBody(RAMPS, {})), base, 'empty opts moved the rig');
  assert.equal(dump(buildNeutralBody(RAMPS, { build: {} })), base, 'empty build moved the rig');
  assert.equal(dump(buildNeutralBody(RAMPS, { build: { ...BUILD_IDENTITY } })), base, 'identity build moved the rig');
});

test('a partial build leaves the unnamed parts untouched', () => {
  // Only `jaw` is named, so every other key must still be identity -
  // a spread bug that dropped the defaults would fail here.
  const only = buildNeutralBody(RAMPS, { build: { jaw: 1.3 } });
  const full = buildNeutralBody(RAMPS, { build: { ...BUILD_IDENTITY, jaw: 1.3 } });
  assert.equal(dump(only), dump(full));
});

test('build changes geometry without changing the face list length', () => {
  // The villager delta pack and any future orc delta ride a shared face
  // list, so a build that adds or drops faces breaks the packing.
  const base = buildNeutralBody(RAMPS);
  for (const d of ORC_DESIGNS) {
    const f = buildNeutralBody(RAMPS, { build: d.build });
    assert.equal(f.length, base.length, `${d.name} changed the face count`);
    assert.notEqual(dump(f), dump(base), `${d.name} did not change the geometry at all`);
  }
});

test('out-of-band and junk build values clamp instead of tearing', () => {
  const hi = dump(buildNeutralBody(RAMPS, { build: { torso: 99 } }));
  assert.equal(hi, dump(buildNeutralBody(RAMPS, { build: { torso: BUILD_MAX } })), 'high value did not clamp');
  const lo = dump(buildNeutralBody(RAMPS, { build: { torso: -5 } }));
  assert.equal(lo, dump(buildNeutralBody(RAMPS, { build: { torso: BUILD_MIN } })), 'low value did not clamp');
  const base = dump(buildNeutralBody(RAMPS));
  for (const junk of [NaN, Infinity, undefined, null, 'wide']) {
    assert.equal(dump(buildNeutralBody(RAMPS, { build: { torso: junk } })), base, `${String(junk)} was not rejected`);
  }
});

test('every build value the orc line ships is inside the clamp band', () => {
  // If a design ever needs a value outside the band it is a different
  // creature and wants its own geometry, not a bigger multiplier.
  for (const d of ORC_DESIGNS) {
    for (const [k, v] of Object.entries(d.build)) {
      assert.ok(k in BUILD_IDENTITY, `${d.name} names an unknown build key: ${k}`);
      assert.ok(v >= BUILD_MIN && v <= BUILD_MAX, `${d.name}.${k} = ${v} is outside ${BUILD_MIN}..${BUILD_MAX}`);
    }
  }
});

test('the four designs match their ENEMY_BASICS rows', () => {
  // The designs quote level and damage from the table; if the table is
  // regenerated and a row moves, this fails rather than leaving a
  // silhouette tuned to a stat the enemy no longer has.
  assert.equal(ORC_DESIGNS.length, 4);
  for (const d of ORC_DESIGNS) {
    const e = ENEMY_BASICS[String(d.id)];
    assert.ok(e, `${d.name} has no ENEMY_BASICS row at id ${d.id}`);
    assert.equal(e.level, d.level, `${d.name} level drifted from the table`);
    assert.equal(e.minDamage, d.damage[0], `${d.name} minDamage drifted from the table`);
    assert.equal(e.maxDamage, d.damage[1], `${d.name} maxDamage drifted from the table`);
    assert.equal(e.team, 'Orcs', `${d.name} is not on the Orcs team`);
  }
});

test('the line covers exactly the four orc MobileTypes', () => {
  const ids = ORC_DESIGNS.map((d) => d.id).sort((a, b) => a - b);
  assert.deepEqual(ids, [MOBILE_TYPES.Orc, MOBILE_TYPES.OrcSergeant, MOBILE_TYPES.OrcShaman, MOBILE_TYPES.OrcWarlord].sort((a, b) => a - b));
  assert.equal(orcDesignFor(MOBILE_TYPES.OrcWarlord).name, 'Orc Warlord');
  assert.equal(orcDesignFor(9999), null);
});

test('rank escalates the silhouette monotonically where it should', () => {
  // The shaman is deliberately OFF this curve (it is the caster, and
  // its chanceForAttack2 is the lowest in the line), so the melee three
  // are what must escalate: Orc -> Sergeant -> Warlord.
  const melee = [MOBILE_TYPES.Orc, MOBILE_TYPES.OrcSergeant, MOBILE_TYPES.OrcWarlord].map(orcDesignFor);
  for (const key of ['torso', 'shoulder', 'arm', 'neck', 'leg']) {
    for (let i = 0; i + 1 < melee.length; i++) {
      assert.ok(melee[i + 1].build[key] > melee[i].build[key],
        `${key} does not grow from ${melee[i].name} to ${melee[i + 1].name}`);
    }
  }
  const shaman = orcDesignFor(MOBILE_TYPES.OrcShaman);
  assert.ok(shaman.build.torso < melee[0].build.torso, 'the caster should be lighter than the baseline brawler');
  assert.ok(shaman.tusk.size > melee[0].tusk.size, 'the oldest orc should carry the longest tusks');
});

test('orcOpts resolves every named material out of the palette', () => {
  // Fake DFPalette: get(i) -> a distinct colour per index, so a missing
  // or misordered span is visible.
  const pal = { get: (i) => ({ r: i, g: 255 - i, b: (i * 7) % 256 }) };
  for (const d of ORC_DESIGNS) {
    const { ramps, opts, hide } = orcOpts(d, pal);
    assert.ok(Array.isArray(hide) && hide.length > 1, `${d.name} hide ramp is empty`);
    // dark -> light: the rig indexes by lighting intensity, so the span
    // must come out reversed relative to the ART_PAL index order.
    const [a, b] = ORC_RAMPS[d.hideRamp];
    assert.equal(hide.length, b - a + 1, `${d.name} hide ramp is the wrong length`);
    assert.equal(hide[0][0], b, `${d.name} hide ramp is not dark -> light`);
    for (const name of Object.keys(d.mats)) {
      assert.ok(opts.mats[name]?.length, `${d.name} left material "${name}" unresolved`);
    }
    // every zone's material must exist in mats, or the zone paints skin
    for (const z of opts.clothZones) {
      assert.ok(opts.mats[z.mat], `${d.name} zone references undefined material "${z.mat}"`);
    }
    assert.ok(ramps.skin && ramps.boot, `${d.name} did not resolve base ramps`);
    // the design must actually reach the rig
    assert.doesNotThrow(() => buildNeutralBody(ramps, opts), `${d.name} failed to build`);
  }
});

test('tusks and brow produce sane, head-tagged geometry', () => {
  for (const d of ORC_DESIGNS) {
    const tusks = buildTusks(IVORY_RAMP, { jaw: d.build.jaw, size: d.tusk.size });
    const brow = buildBrow(IVORY_RAMP, { skull: d.build.skull, jut: d.brow.jut });
    for (const [nm, pieces] of [['tusks', tusks], ['brow', brow]]) {
      assert.ok(pieces.length > 0, `${d.name} ${nm} built nothing`);
      for (const f of pieces) {
        assert.equal(f.g, 'head', `${d.name} ${nm} face is not tagged head`);
        assert.equal(f.p.length, 12, `${d.name} ${nm} face is not a quad`);
        assert.ok(f.p.every(Number.isFinite), `${d.name} ${nm} produced a non-finite vertex`);
        assert.ok(f.n.every(Number.isFinite), `${d.name} ${nm} produced a non-finite normal`);
        assert.ok(Array.isArray(f.c) && f.c.length === 3, `${d.name} ${nm} face is unshaded`);
      }
    }
    // Tusks are a mirrored pair, so their x must straddle zero.
    const xs = tusks.flatMap((f) => [f.p[0], f.p[3], f.p[6], f.p[9]]);
    assert.ok(Math.min(...xs) < 0 && Math.max(...xs) > 0, `${d.name} tusks are not a mirrored pair`);
  }
});

test('a bigger tusk grows from the same socket', () => {
  // Size scales length and thickness; it must NOT walk the root down
  // the chin, or a warlord's tusks sprout from its throat.
  const small = buildTusks(IVORY_RAMP, { jaw: 1.3, size: 1.0 });
  const big = buildTusks(IVORY_RAMP, { jaw: 1.3, size: 1.3 });
  const lowest = (fs) => Math.min(...fs.flatMap((f) => [f.p[1], f.p[4], f.p[7], f.p[10]]));
  const highest = (fs) => Math.max(...fs.flatMap((f) => [f.p[1], f.p[4], f.p[7], f.p[10]]));
  assert.ok(Math.abs(lowest(small) - lowest(big)) < 1e-9, 'the tusk root moved with size');
  assert.ok(highest(big) > highest(small), 'the bigger tusk is not actually longer');
});

test('tusks track the jaw they are anchored to', () => {
  const narrow = buildTusks(IVORY_RAMP, { jaw: 1.0, size: 1 });
  const wide = buildTusks(IVORY_RAMP, { jaw: 1.4, size: 1 });
  const spread = (fs) => Math.max(...fs.flatMap((f) => [f.p[0], f.p[3], f.p[6], f.p[9]]));
  assert.ok(spread(wide) > spread(narrow), 'tusks did not widen with the jaw');
});

test('every orc leg is covered end to end - no bare shin', () => {
  // Mac's catch on the first pass: thigh zone + boot zone left y 0.12
  // to 0.70 (lower calf, calf belly, below-knee, kneecap, knee joint,
  // lower thigh) as bare skin under armour on both armoured tiers.
  // The rig's leg profile runs ankle 0.10 -> upper thigh 0.95, so any
  // uncovered band inside that range is a hole.
  const ANKLE = 0.10, THIGH_TOP = 0.95;
  for (const d of ORC_DESIGNS) {
    const legZones = d.zones.filter((z) => z.leg)
      .map((z) => [z.yLo, z.yHi]).sort((a, b) => a[0] - b[0]);
    assert.ok(legZones.length, `${d.name} has no leg zones at all`);
    assert.ok(legZones[0][0] <= ANKLE, `${d.name} leaves the ankle bare (starts at ${legZones[0][0]})`);
    let reach = legZones[0][1];
    for (const [lo, hi] of legZones.slice(1)) {
      assert.ok(lo <= reach, `${d.name} has a bare band from ${reach} to ${lo}`);
      reach = Math.max(reach, hi);
    }
    assert.ok(reach >= THIGH_TOP, `${d.name} leaves the upper thigh bare (reaches ${reach})`);
  }
});

test('no leg-zone seam lands on the knee', () => {
  // The kneecap is at 0.50 and the joint pinch at 0.55. A zone EDGE in
  // that neighbourhood is a seam sitting on the one part of the leg
  // that bends, so every boundary must clear it - the knee belongs
  // inside a single zone, which is where buildGreaves puts its poleyn.
  const KNEE_LO = 0.44, KNEE_HI = 0.58;
  for (const d of ORC_DESIGNS) {
    for (const z of d.zones.filter((x) => x.leg)) {
      for (const edge of [z.yLo, z.yHi]) {
        if (edge <= 0 || edge >= 1) continue;   // the ends of the leg are not seams
        assert.ok(edge < KNEE_LO || edge > KNEE_HI,
          `${d.name} puts a leg-zone edge at ${edge}, on the knee`);
      }
    }
  }
});
