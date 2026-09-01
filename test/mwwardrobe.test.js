// NPC3b: THE TOWNSFOLK WARDROBE.
//
// Mac: "just give them a random assortment of clothing depending on
// what they are." Every word of that is a law here: the clothes are
// an INVENTION (Daggerfall paints them into the sprite and gives a
// citizen no equipment), "what they are" is DFU's own social group,
// and "random" means STABLE - an NPC whose shirt changed while you
// watched would be worse than the sprite it replaced.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  personaFor, wardrobeTier, wardrobeBudget, PERSONAS_PER_TIER, WARDROBE_TIERS,
} from '../src/characters/mwWardrobe.js';
import { townPersonIdentity, townMwBodyOpts } from '../src/characters/townMwBody.js';
import { SOCIAL_GROUPS } from '../src/formats/factionFile.js';
import { PERSON_TEXTURES } from '../src/characters/mobilePerson.js';
import { CLOTHING_NAME } from '../src/formats/mwItemMap.js';
import { MAX_BODIES } from '../src/characters/mwActorBody.js';

test('NPC3b: an outfit is STABLE - the same person wears the same clothes forever', () => {
  // The failure this forbids: clothes that re-roll per frame.
  for (const seed of [0, 1, 7, -12345, 99999, 2 ** 30]) {
    const a = personaFor(seed, SOCIAL_GROUPS.Commoners, false);
    const b = personaFor(seed, SOCIAL_GROUPS.Commoners, false);
    assert.deepEqual(a, b, 'one person got two outfits');
  }
  // ...and different people do NOT all wear the same thing.
  const looks = new Set();
  for (let s = 0; s < 200; s++) looks.add(personaFor(s, SOCIAL_GROUPS.Commoners, false).persona);
  assert.equal(looks.size, PERSONAS_PER_TIER, 'the crowd does not use its whole wardrobe');
  // GOLDEN VALUES, because "call it twice and compare" only proves
  // agreement within one millisecond - a mutation that mixed Date.now()
  // into the pick SURVIVED that check. A seed's outfit is a fixed
  // function of the seed and nothing else, forever.
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((n) => personaFor(n, SOCIAL_GROUPS.Commoners, false).persona),
    [0, 1, 2, 3, 4, 5].map((n) => personaFor(n, SOCIAL_GROUPS.Commoners, false).persona));
  const golden = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => personaFor(n, SOCIAL_GROUPS.Commoners, false).persona);
  assert.deepEqual(golden, [2, 3, 3, 3, 0, 3, 2, 1],
    'the seed no longer decides the outfit on its own - something outside it is leaking in');
  // ...and the crowd really spreads. MEASURED over the seed sequence
  // the exterior host actually assigns (an accumulating golden-ratio
  // step): every persona gets a real share, so nobody ships a town
  // where three people in four wear the same shirt.
  let seed = 0;
  const share = new Array(PERSONAS_PER_TIER).fill(0);
  for (let i = 0; i < 400; i++) { seed = (seed + 0x9e3779b9) | 0; share[personaFor(seed, SOCIAL_GROUPS.Commoners, false).persona]++; }
  for (const n of share) assert.ok(n > 400 / PERSONAS_PER_TIER / 2, `a persona got only ${n} of 400 - the spread has degenerated`);
  // ...and the FACE varies with the outfit, or a crowd is one face in
  // four shirts (a mutation pinning faceIndex to 0 survived this too).
  const faces = new Set();
  for (let n = 0; n < 200; n++) faces.add(personaFor(n, SOCIAL_GROUPS.Commoners, false).faceIndex);
  assert.equal(faces.size, PERSONAS_PER_TIER, 'the whole crowd wears one face');
  assert.equal(personaFor(9, SOCIAL_GROUPS.Nobility, true).faceIndex,
    personaFor(9, SOCIAL_GROUPS.Nobility, true).persona, 'the face must ride the persona');
});

test('NPC3b: "what they are" is the social group - a noble is not dressed as a beggar', () => {
  const namesOf = (sg, female = false) => personaFor(11, sg, female).worn.map((w) => w.name);
  // Every tier dresses from its own rack.
  const commoner = new Set();
  const noble = new Set();
  for (let s = 0; s < 60; s++) {
    for (const n of personaFor(s, SOCIAL_GROUPS.Commoners, false).worn) commoner.add(n.name);
    for (const n of personaFor(s, SOCIAL_GROUPS.Nobility, false).worn) noble.add(n.name);
  }
  assert.ok(noble.has('Dwynnen Surcoat') || noble.has('Formal Tunic'), 'nobility has nothing formal to wear');
  assert.ok(!commoner.has('Dwynnen Surcoat'), 'a commoner is wearing a noble’s surcoat');
  assert.ok(commoner.has('Short Shirt') || commoner.has('Peasant Blouse') || commoner.has('Casual Dress'),
    'a commoner has nothing plain to wear');
  // A scholar wears robes; the underworld does not dress for dinner.
  assert.ok(namesOf(SOCIAL_GROUPS.Scholars).some((n) => /Robes|Tunic/.test(n)));
  // An unnamed or unmapped group dresses as a commoner - the honest
  // default rather than a hole.
  assert.equal(wardrobeTier(SOCIAL_GROUPS.SupernaturalBeings), SOCIAL_GROUPS.Commoners);
  assert.equal(wardrobeTier(SOCIAL_GROUPS.None), SOCIAL_GROUPS.Commoners);
  assert.equal(wardrobeTier(SOCIAL_GROUPS.Nobility), SOCIAL_GROUPS.Nobility);
});

test('NPC3b: men wear men’s clothing and women wear women’s - the table splits at 184', () => {
  // Daggerfall's clothing is two ranges: men's 141-183, women's
  // 184-216. Dressing a man in an evening gown is the failure.
  for (const tier of WARDROBE_TIERS) {
    for (let s = 0; s < 40; s++) {
      for (const w of personaFor(s, tier, false).worn) {
        assert.ok(w.templateIndex >= 141 && w.templateIndex <= 183, `a man wears ${w.name} (${w.templateIndex})`);
      }
      for (const w of personaFor(s, tier, true).worn) {
        assert.ok(w.templateIndex >= 184 && w.templateIndex <= 216, `a woman wears ${w.name} (${w.templateIndex})`);
      }
    }
  }
  // Every piece is a REAL template the item map can resolve, in the
  // shape composeWornArmor wants.
  for (const tier of WARDROBE_TIERS) {
    for (const female of [false, true]) {
      for (const w of personaFor(3, tier, female).worn) {
        assert.equal(w.kind, 'clothing');
        assert.equal(w.name, CLOTHING_NAME[w.templateIndex], 'the name and the template disagree');
      }
    }
  }
});

test('NPC3b: the wardrobe is a BUDGET - every outfit is a cached body', () => {
  // The size of this table is a memory decision, not a taste one.
  assert.equal(wardrobeBudget(), WARDROBE_TIERS.length * 2 * PERSONAS_PER_TIER);
  assert.equal(wardrobeBudget(), 40);
  // A region's wandering crowd is 3 races x 2 sexes x 4 personas = 24;
  // a dungeon's foes and the 18 distinct creatures share the same
  // cache. The cap must hold them at once or the crowd thrashes.
  const crowd = Object.keys(PERSON_TEXTURES).length * 2 * PERSONAS_PER_TIER;
  assert.equal(crowd, 24);
  assert.ok(MAX_BODIES >= crowd + 40, `the cap (${MAX_BODIES}) cannot hold a crowd plus a dungeon`);
});

test('NPC3b: race and sex are READ, not invented - PERSON_TEXTURES is the real table', () => {
  // raceOfArchive calls itself "a deterministic spread ... until that
  // table is wired". It was wired all along, one module over.
  assert.deepEqual(townPersonIdentity(385), { race: 'Breton', female: false });
  assert.deepEqual(townPersonIdentity(453), { race: 'Breton', female: true });
  assert.deepEqual(townPersonIdentity(381), { race: 'Redguard', female: false });
  assert.deepEqual(townPersonIdentity(398), { race: 'Redguard', female: true });
  assert.deepEqual(townPersonIdentity(387), { race: 'Nord', female: false });
  assert.deepEqual(townPersonIdentity(452), { race: 'Nord', female: true });
  // Every archive the spawn table can produce resolves...
  for (const [race, sexes] of Object.entries(PERSON_TEXTURES)) {
    for (const a of sexes.male) assert.deepEqual(townPersonIdentity(a), { race, female: false });
    for (const a of sexes.female) assert.deepEqual(townPersonIdentity(a), { race, female: true });
  }
  // ...and one it cannot (a guard's own 399) answers null, so the
  // caller keeps its sprite rather than guessing a race.
  assert.equal(townPersonIdentity(399), null);
  assert.equal(townMwBodyOpts(399, 1), null);
  // The whole opts object carries the read identity and the invented
  // clothes together.
  const o = townMwBodyOpts(453, 42);
  assert.equal(o.race, 'breton');
  assert.equal(o.female, true);
  assert.equal(o.weapon, null, 'a townsperson carries no weapon');
  assert.ok(o.worn.length >= 2, 'a townsperson must not be nude - that is why this exists');
});

test('NPC3b: the crowd never spends a draw from DFU’s shared PRNG', () => {
  // srand/rand is ONE stream that names, loot and quests pull from.
  // A draw spent on a shirt would shift every later roll in the game.
  const w = readFileSync('src/characters/mwWardrobe.js', 'utf8');
  // COMMENTS STRIPPED FIRST: the first cut of this pin matched its own
  // prose explaining that srand is not used, which is a word-scan
  // failing exactly the way MW-D23's did.
  const code = w.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.ok(!/\bMath\.random\b|\bsrand\b|\brand\(/.test(code), 'the wardrobe rolls dice instead of hashing a seed');
  assert.match(w, /function spread\(seed\)/, 'there is no self-contained spread');
  const ext = readFileSync('src/scenes/exterior.js', 'utf8');
  assert.match(ext, /person\._mwSeed \?\?= \(_mwTownSeed = \(_mwTownSeed \+ 0x9e3779b9\) \| 0\);/,
    'the per-person seed is not assigned once');
  // ...and the body draws INSTEAD of the billboard, sprite below.
  assert.match(ext, /if \(_drawMwTownsperson\(person, popDt, proj, view, eye\)\) continue;/);
  const seam = ext.indexOf('if (_drawMwTownsperson(');
  const push = ext.indexOf('personBatches.push(batch);');
  assert.ok(seam > 0 && push > seam, 'the sprite must remain the fallback BELOW the body');
});
