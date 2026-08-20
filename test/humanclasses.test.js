// THE HUMAN CLASS ENEMIES — Mage, Sorcerer, Battlemage, Bard, Thief.
//
// Collectively the commonest thing in a Daggerfall dungeon (mapChance 3,
// 3, 2, 2, 2) and the last large group the player meets that had no rig.
// They are just PEOPLE: no geometry, no new mechanism, a human build
// barely touched and everything said with clothing.
//
// THE LOAD-BEARING PIN IS THAT THEY SCALE. Every other design carries a
// level and a damage band out of ENEMY_BASICS; these carry neither,
// because Daggerfall builds them to whoever walks in. A made-up number
// would be a lie about the game's own rules, so `null` is the assertion.
import test from 'node:test';
import assert from 'node:assert';
import { CLASS_DESIGNS, classOpts, CLASS_RAMPS } from '../src/characters/humanClasses.js';
import { buildNeutralBody, BUILD_IDENTITY } from '../src/characters/neutralBody.js';

const pal = { get: (i) => ({ r: (i * 7) & 255, g: (i * 5) & 255, b: (i * 3) & 255 }) };

test('classes: they scale with the player, and say so', () => {
  for (const d of CLASS_DESIGNS) {
    assert.equal(d.level, null, `${d.name} claims a level — these are built to the player`);
    assert.equal(d.damage, null, `${d.name} claims a damage band`);
  }
});

test('classes: every build key is one the rig actually has', () => {
  for (const d of CLASS_DESIGNS) {
    for (const k of Object.keys(d.build)) {
      assert.ok(k in BUILD_IDENTITY, `${d.name} invents build key "${k}"`);
    }
  }
});

test('classes: they are people — near-human, and no geometry', () => {
  for (const d of CLASS_DESIGNS) {
    assert.ok(!d.bones && !d.horse, `${d.name} carries geometry — it is a person`);
    for (const [k, v] of Object.entries(d.build)) {
      assert.ok(v >= 0.9 && v <= 1.15, `${d.name} ${k}=${v} is not a person's build`);
    }
  }
});

test('classes: every zone and drape material is declared', () => {
  for (const d of CLASS_DESIGNS) {
    for (const z of d.zones) assert.ok(d.mats[z.mat], `${d.name} uses "${z.mat}" undeclared`);
    if (d.drape) assert.ok(d.mats[d.drape.mat], `${d.name} wears "${d.drape.mat}" undeclared`);
  }
});

test('classes: they ride the base face list, so they ship as deltas', () => {
  const base = buildNeutralBody({ skin: [[10, 10, 10], [200, 200, 200]], boot: [[5, 5, 5], [90, 90, 90]] });
  for (const d of CLASS_DESIGNS) {
    const { ramps, opts } = classOpts(d, pal);
    assert.equal(buildNeutralBody(ramps, opts).length, base.length, `${d.name} changes the face count`);
  }
});

test('battlemage: his robe clears his plate', () => {
  // ROBES OVER PLATE is the case that was clipping until the drape
  // learned to clear what is under it. He was built AFTER that fix,
  // which is the only honest way to check it holds for a design it was
  // not written against.
  const CLEARANCE = 1.06;
  const fit = (d) => {
    const b = d.build;
    const girth = (b.torso ?? 1) * 0.75 + (b.shoulder ?? 1) * 0.25;
    let under = 0;
    for (const z of d.zones || []) {
      if (!z.groups.includes('body')) continue;
      under = Math.max(under, z.th || 0);
    }
    return girth * CLEARANCE + under * 2.2;
  };
  const bm = CLASS_DESIGNS.find((d) => d.name === 'Battlemage');
  const plate = Math.max(...bm.zones.filter((z) => z.groups.includes('body')).map((z) => z.th));
  assert.ok(plate > 0.02, 'the battlemage is not actually wearing plate');
  assert.ok(fit(bm) > bm.build.torso + plate * 2, 'his cloak sits inside his cuirass');
  // And a mage in the same body without plate must get a tighter fit,
  // or the clearance term is not reading the armour at all.
  const mage = CLASS_DESIGNS.find((d) => d.name === 'Mage');
  assert.ok(fit(bm) > fit(mage), 'plate does not push the cloak out');
});

test('classes: the ramps are ART_PAL spans, light to dark', () => {
  for (const [name, span] of Object.entries(CLASS_RAMPS)) {
    assert.equal(span.length, 2, `${name} is not a [first,last] span`);
    assert.ok(span[1] > span[0], `${name} runs backwards`);
    assert.ok(span[0] >= 0 && span[1] <= 255, `${name} leaves the palette`);
  }
});
