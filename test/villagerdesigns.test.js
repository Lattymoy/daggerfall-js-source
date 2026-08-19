// The villager designs (the voxel roster) against the table the game
// actually spawns from. These designs are FULLY REDESIGNED rather than
// traced from the classic sprites - but the ROSTER is not ours to
// choose, and an archive with no design spawns a villager with none.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VILLAGER_DESIGNS, RAMPS, BUILDS, designForArchive, designOpts } from '../src/characters/villagerDesigns.js';
import { PERSON_TEXTURES, GUARD_TEXTURE } from '../src/characters/mobilePerson.js';
import { DFPalette } from '../src/formats/dfPalette.js';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

const allArchives = [
  ...Object.values(PERSON_TEXTURES).flatMap((g) => [...g.male, ...g.female]),
  GUARD_TEXTURE,
];

test('villagers: every archive SetPerson can spawn has exactly one design', () => {
  // The drift guard. PERSON_TEXTURES is 3 races x 2 genders x 4, plus
  // the guard; if that table grows a row, this fails until the design
  // exists rather than shipping a blank townsperson.
  assert.equal(allArchives.length, 25);
  const designed = VILLAGER_DESIGNS.map((d) => d.archive);
  assert.equal(new Set(designed).size, designed.length, 'no archive is designed twice');
  assert.deepEqual([...designed].sort((a, b) => a - b), [...allArchives].sort((a, b) => a - b));
  for (const a of allArchives) assert.ok(designForArchive(a), `archive ${a} has no design`);
  assert.equal(designForArchive(999), null, 'an unknown archive answers null, not undefined');
});

test('villagers: race and gender match the table each archive comes from', () => {
  // The label rides along for readability - so it must not lie.
  for (const [race, genders] of Object.entries(PERSON_TEXTURES)) {
    for (const [gender, arcs] of Object.entries(genders)) {
      for (const a of arcs) {
        const d = designForArchive(a);
        assert.equal(d.race, race, `archive ${a}`);
        assert.equal(d.gender, gender, `archive ${a}`);
      }
    }
  }
  assert.equal(designForArchive(GUARD_TEXTURE).race, 'Guard');
});

test('villagers: every material a zone names is defined, and every ramp is a real palette span', () => {
  // A zone tagged with a material the design never defines falls
  // through to skin at build time - a villager wearing their own body
  // colour, which reads as a bug rather than a garment.
  for (const d of VILLAGER_DESIGNS) {
    const zones = [...d.zones, ...(d.armor ?? [])];
    assert.ok(zones.length > 0, `${d.name} has no zones`);
    for (const z of zones) {
      assert.ok(d.mats[z.mat], `${d.name}: zone material '${z.mat}' is not defined`);
      assert.ok(Array.isArray(z.groups) && z.groups.length, `${d.name}: a zone has no groups`);
      assert.ok(z.yHi > z.yLo, `${d.name}: a zone band is inverted`);
    }
    for (const [name, span] of Object.entries(d.mats)) {
      assert.equal(span.length, 2, `${d.name}.${name}`);
      const [a, b] = span;
      assert.ok(a >= 0 && b <= 255 && b > a, `${d.name}.${name} is not a palette span`);
      assert.ok(Object.values(RAMPS).some((r) => r[0] === a && r[1] === b),
        `${d.name}.${name} is a hand-rolled span - use a named RAMPS entry`);
    }
    assert.ok(BUILDS[d.build], `${d.name}: unknown build '${d.build}'`);
    assert.ok(['brown', 'black', 'blonde'].includes(d.hair.ramp), `${d.name}: unknown hair ramp`);
  }
});

test('villagers: designOpts resolves spans into dark-to-light RGB ramps', () => {
  // The rig indexes a ramp by lighting intensity (neutralBody's
  // `shade(ramp, it)`), so step 0 must be the SHADOW - and the engine's
  // own rampOf sorts by luminance ASCENDING, which is the convention
  // these designs have to meet.
  //
  // ART_PAL blocks run LIGHT -> DARK as the index rises (flesh 34 is
  // lum 165, flesh 44 is lum 71), so designOpts walks each span
  // BACKWARDS. The stand-in palette has to model that direction or the
  // test asserts the opposite of the truth - which is exactly what the
  // first draft of this pin did.
  const fakePal = { get: (i) => ({ r: 255 - i, g: 255 - i, b: 255 - i }) };
  const d = designForArchive(381);
  const opts = designOpts(d, fakePal);
  assert.ok(opts.clothZones.length > 0);
  assert.deepEqual(opts.armorZones, [], 'a cloth villager has no armour zones');
  for (const [name, ramp] of Object.entries(opts.mats)) {
    assert.ok(ramp.length > 1, name);
    const first = ramp[0][0], last = ramp[ramp.length - 1][0];
    assert.ok(last > first, `${name}: ramp must run dark -> light`);
  }
  // the guard is the one design carrying armour over cloth
  const guard = designOpts(designForArchive(GUARD_TEXTURE), fakePal);
  assert.equal(guard.armorZones.length, 4);
  assert.ok(guard.armorZones.every((z) => z.th >= 0.02), 'armour is thicker than cloth');
  assert.ok(guard.clothZones.every((z) => z.th < 0.02), 'the gambeson sits under it');
});

test('villagers: every design ramp runs dark -> light on the REAL palette', { skip: skipReal }, () => {
  // The stand-in above proves the reversal; this proves the spans are
  // real ART_PAL ramps and not merely well-formed pairs.
  const pal = new DFPalette();
  pal.load(readFileSync(join(ARENA2, 'ART_PAL.COL')), 'ART_PAL.COL');
  const lum = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;
  for (const d of VILLAGER_DESIGNS) {
    for (const [name, ramp] of Object.entries(designOpts(d, pal).mats)) {
      assert.ok(ramp.length >= 8, `${d.name}.${name}: too few steps to shade with`);
      assert.ok(lum(ramp[ramp.length - 1]) > lum(ramp[0]) + 40,
        `${d.name}.${name}: not a usable ramp (shadow ${lum(ramp[0]).toFixed(0)} -> light ${lum(ramp[ramp.length - 1]).toFixed(0)})`);
      // HUE COHERENCE. Luminance alone is not enough: ART_PAL block 1
      // is monotone in BRIGHTNESS but alternates gold (206,159,73)
      // with neutral grey (165,156,156), so a garment cut from it
      // shades in speckles. The colour proof showed that immediately
      // where the numbers did not.
      //
      // The measure is OSCILLATION, not spread. Total spread fails to
      // separate them - madder legitimately shifts more (0.27) than the
      // bad block does (0.16) as it darkens. What marks a real ramp is
      // that its hue moves SMOOTHLY: total variation over net change is
      // ~1 for a clean ramp and blows up for a zigzag. Calibrated on
      // the real palette - every good ramp scores <= 17, the mixed
      // block scores 34.
      for (let ch = 0; ch < 3; ch++) {
        const c = ramp.map((rgb) => rgb[ch] / Math.max(1, rgb[0] + rgb[1] + rgb[2]));
        let tv = 0;
        for (let i = 1; i < c.length; i++) tv += Math.abs(c[i] - c[i - 1]);
        const net = Math.abs(c[c.length - 1] - c[0]);
        const wobble = tv / Math.max(net, 0.02);
        assert.ok(wobble < 25,
          `${d.name}.${name}: hue OSCILLATES across the ramp (channel ${ch} wobble ${wobble.toFixed(1)}) - a mixed palette block, not a ramp`);
      }
    }
  }
});
