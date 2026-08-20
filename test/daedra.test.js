// THE DAEDRA — Frost, Fire, Daedroth, Lord, Seducer.
//
// All five are minMetalToHit 5: daedric weapons or nothing, which is
// what marks them as a class in the game's own terms rather than ours.
//
// THE POINT OF THIS FILE IS HOW LITTLE IT COST. A Daedroth is the
// werewolf's design exactly — collapse the skull, put a beast head on
// it. A Fire Daedra is the fire atronach's additive blend. A Frost
// Daedra is the ice atronach's transparency at a different density. The
// only new geometry across five enemies is a pair of horns. That is what
// a mechanism is for after enough of it exists.
import test from 'node:test';
import assert from 'node:assert';
import { DAEDRA_DESIGNS, daedraOpts, DAEDRA_RAMPS } from '../src/characters/daedra.js';
import { buildNeutralBody, BUILD_IDENTITY } from '../src/characters/neutralBody.js';

const pal = { get: (i) => ({ r: (i * 7) & 255, g: (i * 5) & 255, b: (i * 3) & 255 }) };

test('daedra: they reuse what exists rather than inventing', () => {
  const byName = (n) => DAEDRA_DESIGNS.find((d) => d.name === n);
  // The werewolf's mechanism, unchanged.
  const droth = byName('Daedroth');
  assert.deepEqual(droth.collapse, ['head'], 'the daedroth does not use the werebeast collapse');
  assert.ok(droth.beastHead.ears === 0, 'a lizard has ears — leaving them on makes it a strange dog');
  assert.ok(droth.beastHead.snout > 0.2, 'a crocodile head needs a longer muzzle than a wolf');
  // The atronachs' material modes, unchanged.
  assert.ok(byName('Fire Daedra').spectral.additive, 'the fire daedra does not burn');
  assert.ok(byName('Frost Daedra').spectral && !byName('Frost Daedra').spectral.additive, 'frost is not see-through');
  // And denser than the atronach it borrows from: a daedra is a THING,
  // not a substance.
  assert.ok(byName('Frost Daedra').spectral.opacity > 0.7, 'the frost daedra is a mist');
});

test('daedra: only the lord and the seducer have horns, and his are bigger', () => {
  const horned = DAEDRA_DESIGNS.filter((d) => d.horns).map((d) => d.name);
  assert.deepEqual(horned.sort(), ['Daedra Lord', 'Daedra Seducer']);
  const lord = DAEDRA_DESIGNS.find((d) => d.name === 'Daedra Lord');
  const sed = DAEDRA_DESIGNS.find((d) => d.name === 'Daedra Seducer');
  assert.ok(lord.horns.len > sed.horns.len * 2, 'the seducer is as horned as the lord');
});

test('daedra: the lord is the broadest and the seducer the slightest', () => {
  const w = (n) => DAEDRA_DESIGNS.find((d) => d.name === n).build.shoulder;
  const all = DAEDRA_DESIGNS.map((d) => d.build.shoulder);
  assert.equal(w('Daedra Lord'), Math.max(...all), 'the lord is not the broadest');
  assert.equal(w('Daedra Seducer'), Math.min(...all), 'the seducer is not the slightest');
});

test('daedra: a garment that swallows its wearer is the wrong garment', () => {
  // The lord had a Formal Cloak, and on a 1.3 torso with a 1.42 shoulder
  // the drape fit scaled it to 1.49 — a tent that hid the plate, the
  // gold band and the horns, leaving a grey slab with a small head. The
  // FIT was doing exactly what it should; the garment was wrong for the
  // wearer. His authority is his mass and his horns.
  const lord = DAEDRA_DESIGNS.find((d) => d.name === 'Daedra Lord');
  assert.equal(lord.drape, null, 'the lord is back under a cloak that hides him');
  // Anything that DOES wear one must be slight enough to still be seen.
  for (const d of DAEDRA_DESIGNS.filter((x) => x.drape)) {
    assert.ok(d.build.shoulder < 1.1, `${d.name} wears a drape on a ${d.build.shoulder} shoulder — it will vanish inside it`);
  }
});

test('daedra: legal keys, declared materials, base face list', () => {
  const base = buildNeutralBody({ skin: [[10, 10, 10], [200, 200, 200]], boot: [[5, 5, 5], [90, 90, 90]] });
  for (const d of DAEDRA_DESIGNS) {
    for (const k of Object.keys(d.build)) assert.ok(k in BUILD_IDENTITY, `${d.name} invents "${k}"`);
    for (const z of d.zones) assert.ok(d.mats[z.mat], `${d.name} uses "${z.mat}" undeclared`);
    if (d.drape) assert.ok(d.mats[d.drape.mat], `${d.name} wears "${d.drape.mat}" undeclared`);
    const { ramps, opts } = daedraOpts(d, pal);
    assert.equal(buildNeutralBody(ramps, opts).length, base.length, `${d.name} changes the face count`);
  }
});

test('daedra: the ramps are ART_PAL spans, light to dark', () => {
  for (const [name, span] of Object.entries(DAEDRA_RAMPS)) {
    assert.equal(span.length, 2, `${name} is not a [first,last] span`);
    assert.ok(span[1] > span[0], `${name} runs backwards`);
    assert.ok(span[0] >= 0 && span[1] <= 255, `${name} leaves the palette`);
  }
});
