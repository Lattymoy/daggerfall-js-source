// The villager designs (the voxel roster) against the table the game
// actually spawns from. These designs are FULLY REDESIGNED rather than
// traced from the classic sprites - but the ROSTER is not ours to
// choose, and an archive with no design spawns a villager with none.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VILLAGER_DESIGNS, RAMPS, BUILDS, RACE_TONE, designForArchive, designOpts, designDrape, villagerDelta } from '../src/characters/villagerDesigns.js';
import { DRAPED_NAMES } from '../src/characters/pieces/draped.js';
import { HAIR_RAMPS } from '../src/characters/pieces/hair.js';
import { PALETTES } from '../src/characters/palettes.js';
import { buildNeutralBody } from '../src/characters/neutralBody.js';
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

test('villagers: base + delta reproduces the full build, face for face', { skip: skipReal }, () => {
  // The viewer ships each villager as a DELTA over the bare body rather
  // than 25 whole bodies. If the delta misses a face, that face keeps
  // the bare body's colour and the villager wears a patch of its own
  // skin - which is exactly the kind of thing that looks like a shading
  // bug rather than a data bug.
  const pal = new DFPalette();
  pal.load(readFileSync(join(ARENA2, 'ART_PAL.COL')), 'ART_PAL.COL');
  const ramps = { skin: [[80, 60, 45], [205, 156, 119]], boot: [[40, 32, 24], [120, 96, 72]] };
  const base = buildNeutralBody(ramps, {});
  for (const d of VILLAGER_DESIGNS) {
    const full = buildNeutralBody(ramps, designOpts(d, pal));
    assert.equal(full.length, base.length, `${d.name}: zones must not add or drop faces`);
    const delta = villagerDelta(base, full);
    assert.ok(delta.idx.length > 0, `${d.name}: a design that changes nothing is not a design`);
    assert.equal(delta.P.length, delta.idx.length * 12);
    assert.equal(delta.C.length, delta.idx.length * 3);

    // rebuild from base + delta and compare against the full build
    const touched = new Set(delta.idx);
    for (let k = 0; k < delta.idx.length; k++) {
      const i = delta.idx[k], f = full[i];
      for (let c = 0; c < 12; c++) {
        assert.equal(delta.P[k * 12 + c], Math.round(f.p[c] * 1000), `${d.name}: face ${i} corner ${c}`);
      }
      assert.deepEqual([delta.C[k * 3], delta.C[k * 3 + 1], delta.C[k * 3 + 2]], [...f.c], `${d.name}: face ${i} colour`);
    }
    // and every face NOT in the delta must genuinely be unchanged
    for (let i = 0; i < full.length; i++) {
      if (touched.has(i)) continue;
      assert.deepEqual([...full[i].c], [...base[i].c], `${d.name}: face ${i} recoloured but absent from the delta`);
      for (let c = 0; c < 12; c++) {
        assert.ok(Math.abs(full[i].p[c] - base[i].p[c]) <= 1e-6, `${d.name}: face ${i} moved but absent from the delta`);
      }
    }
  }
});


test('villagers: hanging cloth names a real draped garment, dyed from the design own ramps', () => {
  // WHY THIS EXISTS: a skirt was ONCE a cloth zone spanning
  // [body, legL, legR]. It cannot be. `displace` pushes a group's
  // faces out from THAT GROUP's centre, so a zone naming both legs
  // thickens each leg separately and renders a tunic plus shorts,
  // never a gown. Hanging cloth belongs to pieces/draped.js, whose
  // standoff grid clothSim.js swings. This pin fails if a design ever
  // goes back to describing a gown as a zone.
  for (const d of VILLAGER_DESIGNS) {
    for (const z of [...d.zones, ...(d.armor ?? [])]) {
      const legs = z.groups.filter((g) => g === 'legL' || g === 'legR').length;
      assert.ok(!(z.groups.includes('body') && legs > 0),
        `${d.archive} ${d.name}: a zone spans the torso and the legs - that is hanging cloth, use drape`);
    }
  }

  let draped = 0;
  for (const d of VILLAGER_DESIGNS) {
    if (!d.drape) continue;
    draped++;
    assert.ok(DRAPED_NAMES.includes(d.drape.name),
      `${d.archive} ${d.name}: "${d.drape.name}" is not a garment draped.js can build`);
    assert.ok(Object.prototype.hasOwnProperty.call(d.mats, d.drape.mat),
      `${d.archive} ${d.name}: drape material "${d.drape.mat}" is not in this design's mats`);
  }
  assert.ok(draped > 0, 'at least one villager wears hanging cloth');
});

test('villagers: designDrape resolves to a dark-to-light ramp, or null', { skip: skipReal }, () => {
  // DFPalette's constructor takes NO bytes - an unloaded one is all
  // red, where every index has the same luminance and this test's own
  // ordering check would read as a design fault.
  const pal = new DFPalette();
  pal.load(readFileSync(join(ARENA2, 'ART_PAL.COL')), 'ART_PAL.COL');
  const lum = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;
  let seen = 0;
  for (const d of VILLAGER_DESIGNS) {
    const dr = designDrape(d, pal);
    if (!d.drape) { assert.equal(dr, null, `${d.archive} wears no drape`); continue; }
    seen++;
    assert.equal(dr.name, d.drape.name);
    // shadePiece indexes by lighting intensity, so ramp[0] is the shadow.
    assert.ok(dr.ramp.length >= 2, `${d.archive}: drape ramp has steps`);
    assert.ok(lum(dr.ramp[0]) < lum(dr.ramp[dr.ramp.length - 1]),
      `${d.archive}: drape ramp[0] must be the SHADOW, not the highlight`);
    // and it is the design's own dye, not draped.js's built-in colour.
    const [a, b] = d.mats[d.drape.mat];
    assert.equal(dr.ramp.length, b - a + 1);
    const first = pal.get(b);
    assert.deepEqual(dr.ramp[0], [first.r, first.g, first.b]);
  }
  assert.equal(seen, VILLAGER_DESIGNS.filter((d) => d.drape).length);
});


test('villagers: every design names a hair style, a hair colour and a skin tone the editor can build', () => {
  // The editor DRIVES its hairstyle, hair-colour and skin-tone
  // controls off these fields, so a name it cannot resolve is a
  // villager silently wearing the last one's look. That is how the
  // guard - race 'Guard', which is not a playable race - inherited the
  // skin tone of whoever was selected before them.
  const STYLES = ['short', 'buzz', 'medium', 'long', 'ponytail', 'topknot', 'mohawk', 'bald'];
  const TONES = PALETTES.human.map((e) => e.name);
  for (const d of VILLAGER_DESIGNS) {
    assert.ok(STYLES.includes(d.hair.style), `${d.archive} ${d.name}: hairstyle "${d.hair.style}" is not one hair.js builds`);
    assert.ok(HAIR_RAMPS[d.hair.ramp], `${d.archive} ${d.name}: hair colour "${d.hair.ramp}" is not in HAIR_RAMPS`);
    const tone = RACE_TONE[d.race];
    assert.ok(tone, `${d.archive} ${d.name}: race "${d.race}" has no skin tone - the editor would keep the previous villager's`);
    assert.ok(TONES.includes(tone), `${d.archive} ${d.name}: tone "${tone}" is not in the human palette (${TONES.join(', ')})`);
  }
  // and no tone is defined for a race no design uses
  const used = new Set(VILLAGER_DESIGNS.map((d) => d.race));
  for (const r of Object.keys(RACE_TONE)) assert.ok(used.has(r), `RACE_TONE has a dead entry for "${r}"`);
});

test('villagers: a hood leaves the face open', { skip: skipReal }, () => {
  // A hood gated on HEIGHT alone paints the whole skull, face
  // included - the render came back with a green face. The fix is the
  // depth gate on displace; this pin is what proves the opening is
  // still there. Measured on the build, not on the zone literals: the
  // question is whether any face-front geometry got recoloured.
  const pal = new DFPalette();
  pal.load(readFileSync(join(ARENA2, 'ART_PAL.COL')), 'ART_PAL.COL');
  const ramps = { skin: [[92, 68, 50], [142, 105, 78], [186, 138, 104], [226, 181, 144]],
                  boot: [[38, 30, 22], [70, 56, 42], [104, 84, 62], [138, 112, 84]] };
  const base = buildNeutralBody(ramps, {});
  // The face: head faces below the brow whose centre sits forward.
  // 0.9 is neutralBody's HSCALE, applied after the zones.
  const isFace = (f) => {
    if (f.g !== 'head') return false;
    let y = 0, z = 0;
    for (let i = 0; i < 4; i++) { y += f.p[i*3+1] / 0.9; z += f.p[i*3+2]; }
    return (y / 4) < 1.90 && (z / 4) > 0.045;
  };
  const faceIdx = base.map((f, i) => (isFace(f) ? i : -1)).filter((i) => i >= 0);
  assert.ok(faceIdx.length > 4, 'the rig has a face to leave open');

  let hooded = 0;
  for (const d of VILLAGER_DESIGNS) {
    // the guard's CLOSED HELM covers the face on purpose
    if (d.race === 'Guard') continue;
    const wearsHood = d.zones.some((z) => z.groups.includes('head'));
    if (!wearsHood) continue;
    hooded++;
    const built = buildNeutralBody(ramps, designOpts(d, pal));
    for (const i of faceIdx) {
      const a = built[i], b = base[i];
      assert.ok(a.c[0] === b.c[0] && a.c[1] === b.c[1] && a.c[2] === b.c[2],
        `${d.archive} ${d.name}: the hood painted the face (head face ${i})`);
    }
  }
  assert.ok(hooded >= 8, `every hooded design checked (saw ${hooded})`);
});
