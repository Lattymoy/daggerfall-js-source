// THE ATRONACHS — Fire, Ice, Iron, Flesh.
//
// The only group in ENEMY_BASICS whose members are STATISTICALLY
// IDENTICAL: all four are level 16, 5-15 damage, 25-130 health, armour
// 6. The game distinguishes them by element and by nothing else, which
// makes them a design problem with the numbers taken away — four things
// that fight the same have to look nothing alike, and the only tools are
// the shape of the body and what it is made of.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { ATRONACH_DESIGNS, atronachOpts, ATRONACH_RAMPS } from '../src/characters/atronachs.js';
import { buildNeutralBody, BUILD_IDENTITY } from '../src/characters/neutralBody.js';

const pal = { get: (i) => ({ r: (i * 7) & 255, g: (i * 5) & 255, b: (i * 3) & 255 }) };

test('atronachs: the game gives them the same numbers, so we give them different everything else', () => {
  assert.equal(ATRONACH_DESIGNS.length, 4);
  for (const d of ATRONACH_DESIGNS) {
    assert.equal(d.level, 16, `${d.name} disagrees with ENEMY_BASICS`);
    assert.deepEqual(d.damage, [5, 15], `${d.name} disagrees with ENEMY_BASICS`);
  }
  // No two may share a silhouette: identical stats plus identical build
  // would be one enemy wearing four names.
  const seen = new Map();
  for (const d of ATRONACH_DESIGNS) {
    const sig = JSON.stringify(Object.values(d.build));
    assert.ok(!seen.get(sig), `${d.name} is shaped exactly like ${seen.get(sig)}`);
    seen.set(sig, d.name);
  }
});

test('atronachs: three render modes across four designs', () => {
  // Fire ADDS light to what is behind it; ice subtracts itself from it;
  // iron and flesh do neither. If they ever collapse to one mode the
  // whole reason for building the material path is gone.
  const fire = ATRONACH_DESIGNS.find((d) => d.name === 'Fire Atronach');
  const ice = ATRONACH_DESIGNS.find((d) => d.name === 'Ice Atronach');
  const iron = ATRONACH_DESIGNS.find((d) => d.name === 'Iron Atronach');
  assert.ok(fire.spectral && fire.spectral.additive, 'fire does not add light — it is a painted man');
  assert.ok(ice.spectral && !ice.spectral.additive, 'ice is not see-through');
  assert.ok(!iron.spectral, 'iron is not solid');
  // Ice is PRESENT and merely see-through; a ghost is absent. It has to
  // sit denser than one or it is a blue ghost.
  assert.ok(ice.spectral.opacity > 0.5, `ice at ${ice.spectral.opacity} is a ghost, not a solid`);
});

test('atronachs: the additive blend does not outlive the fire', () => {
  // Same trap as the ghost's transparency: one material, shared by every
  // design. Leave it additive and the next orc glows.
  const src = readFileSync(new URL('../src/tools/paperdollViewer.js', import.meta.url), 'utf8');
  const blends = src.match(/mat\.blending = [^;]+;/g) || [];
  assert.ok(blends.length >= 2, 'blending is set but never reset');
  assert.ok(
    blends.some((b) => /NormalBlending;/.test(b) && !/additive/.test(b)),
    'nothing ever puts the blend back to normal',
  );
});

test('atronachs: iron is the heaviest and fire the lightest', () => {
  // Metal outweighs flame, or the builds are saying nothing.
  const w = (n) => ATRONACH_DESIGNS.find((d) => d.name === n).build.torso;
  assert.ok(w('Iron Atronach') > w('Flesh Atronach'), 'iron is no heavier than flesh');
  assert.ok(w('Flesh Atronach') > w('Fire Atronach'), 'flesh is no heavier than flame');
});

test('atronachs: legal keys, declared materials, base face list', () => {
  const base = buildNeutralBody({ skin: [[10, 10, 10], [200, 200, 200]], boot: [[5, 5, 5], [90, 90, 90]] });
  for (const d of ATRONACH_DESIGNS) {
    for (const k of Object.keys(d.build)) assert.ok(k in BUILD_IDENTITY, `${d.name} invents "${k}"`);
    for (const z of d.zones) assert.ok(d.mats[z.mat], `${d.name} uses "${z.mat}" undeclared`);
    const { ramps, opts } = atronachOpts(d, pal);
    assert.equal(buildNeutralBody(ramps, opts).length, base.length, `${d.name} changes the face count`);
  }
});

test('atronachs: the ramps are ART_PAL spans, light to dark', () => {
  for (const [name, span] of Object.entries(ATRONACH_RAMPS)) {
    assert.equal(span.length, 2, `${name} is not a [first,last] span`);
    assert.ok(span[1] > span[0], `${name} runs backwards`);
    assert.ok(span[0] >= 0 && span[1] <= 255, `${name} leaves the palette`);
  }
});
