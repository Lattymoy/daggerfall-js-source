// THE UNDEAD LINE, on the mechanism the orc line proved.
//
// Two things must hold, and the first one bit while this was being
// written: a build spec's keys must be REAL. The rig spreads a spec over
// its own BUILD_IDENTITY keys, so an invented one is dropped in silence
// — `gut: 1.24` on the zombie would have shipped a corpse with a flat
// stomach and nothing anywhere to say why. It is a zone now, and this
// test is why nobody has to remember that again.
import test from 'node:test';
import assert from 'node:assert';
import { UNDEAD_DESIGNS, undeadOpts, UNDEAD_RAMPS } from '../src/characters/undeadBody.js';
import { buildNeutralBody, BUILD_IDENTITY } from '../src/characters/neutralBody.js';

const pal = { get: (i) => ({ r: (i * 7) & 255, g: (i * 5) & 255, b: (i * 3) & 255 }) };

test('undead: every build key is one the rig actually has', () => {
  for (const d of UNDEAD_DESIGNS) {
    for (const k of Object.keys(d.build)) {
      assert.ok(k in BUILD_IDENTITY, `${d.name} invents build key "${k}" — the rig will drop it silently`);
    }
  }
});

test('undead: every zone material is declared', () => {
  for (const d of UNDEAD_DESIGNS) {
    for (const z of d.zones) {
      assert.ok(d.mats[z.mat], `${d.name} uses material "${z.mat}" without declaring it`);
    }
  }
});

test('undead: they ride the base face list, adding and dropping none', () => {
  const base = buildNeutralBody({ skin: [[10, 10, 10], [200, 200, 200]], boot: [[5, 5, 5], [90, 90, 90]] });
  for (const d of UNDEAD_DESIGNS) {
    const { ramps, opts } = undeadOpts(d, pal);
    const f = buildNeutralBody(ramps, opts);
    assert.equal(f.length, base.length, `${d.name} changes the face count — it cannot ship as a delta`);
  }
});

test('undead: the zombie belly actually swells', () => {
  const z = UNDEAD_DESIGNS.find((d) => d.name === 'Zombie');
  const { ramps, opts } = undeadOpts(z, pal);
  const without = buildNeutralBody(ramps, { build: opts.build });
  const with_ = buildNeutralBody(ramps, opts);
  let moved = 0;
  for (let i = 0; i < without.length; i++) {
    for (let k = 0; k < 12; k++) {
      if (Math.abs(without[i].p[k] - with_[i].p[k]) > 1e-6) { moved++; break; }
    }
  }
  assert.ok(moved > 100, `only ${moved} faces move — the belly zone is not doing anything`);
});

test('undead: the ramps are index spans into ART_PAL, light to dark', () => {
  for (const [name, span] of Object.entries(UNDEAD_RAMPS)) {
    assert.equal(span.length, 2, `${name} is not a [first,last] span`);
    assert.ok(span[1] > span[0], `${name} runs backwards`);
    assert.ok(span[0] >= 0 && span[1] <= 255, `${name} leaves the palette`);
  }
});
