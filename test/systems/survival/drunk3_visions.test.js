// DRUNK3 (2026-10-17, asked for: "an impairment to the characters judgement. For example, seeing a dragonling as a bat,
// or an elite zombie as a rat") - THE DRINK, MISJUDGED (src/systems/survival/drunkVisions.js). Pinned here: the table (the
// user's two examples, exact), the pool (small things with a sprite, never the foe's own kind), people never touched, the
// chance (nothing short of Very drunk, 0.4 at the line and 0.8 at the endurance), the decision (stable per foe, rerolled
// by the next binge), the draw helper (the illusion's record and a frame held to its own count, the real foe until the
// illusion's texture has loaded) the 3D body (a foe seen as another is offered to no Morrowind body) and the two hosts' seams.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  ILLUSIONS, HARMLESS, ILLUSION_CHANCE, illusionChance, pickIllusion, visionRoll, createDrunkVisions, createVisionDraw,
} from '../../../src/systems/survival/drunkVisions.js';
import { MOBILE_TYPES as M } from '../../../src/characters/mobile/mobileTypes.js';
import { ENEMY_BASICS } from '../../../src/characters/enemy/enemyBasics.js';
import { creatureLook } from '../../../src/characters/creatureBodies.js';
import { isBodyFoe } from '../../../src/characters/foeBodies.js';

const SOBER = Object.freeze({ band: 'sober', share: 0 });
const DRUNK = (share) => ({ band: 'drunk', share });
const VERY = (share) => ({ band: 'veryDrunk', share });
/** A runtime reading a state we set, with no hold on the read (ttl 0) and dice from a list (the last one repeats). */
const visionsAt = (get, rolls = [0, 0]) => {
  let i = 0;
  return createDrunkVisions({ state: get, ttl: 0, now: () => 0, rng: () => rolls[Math.min(i++, rolls.length - 1)] });
};
const foe = (mobileType, extra = {}) => ({ mobileType, gender: 'male', entity: {}, ...extra });
const flush = () => new Promise((r) => setTimeout(r, 0));

test('DRUNK3: the table - the dragonlings are a giant bat and the zombie a rat, nothing else is in it', () => {
  assert.deepEqual({ ...ILLUSIONS }, { [M.Dragonling]: M.GiantBat, [M.Dragonling_Alternate]: M.GiantBat, [M.Zombie]: M.Rat });
  assert.deepEqual({ ...ILLUSIONS }, { 34: 3, 40: 3, 17: 0 });
  assert.ok(Object.isFrozen(ILLUSIONS) && Object.isFrozen(HARMLESS), 'frozen tables');
  // the user's two examples are used whatever the dice say
  for (const roll of [0, 0.3, 0.5, 0.99, NaN]) {
    assert.equal(pickIllusion(M.Dragonling, roll), M.GiantBat);
    assert.equal(pickIllusion(M.Dragonling_Alternate, roll), M.GiantBat);
    assert.equal(pickIllusion(M.Zombie, roll), M.Rat);
  }
});

test('DRUNK3: the pool - small things that look harmless, each with a sprite; every other creature draws from it and never as its own kind', () => {
  assert.deepEqual([...HARMLESS], [M.Rat, M.GiantBat, M.Imp]);
  for (const id of HARMLESS) assert.ok(ENEMY_BASICS[id].maleTexture > 0, `${id} has a sprite`);
  for (let t = 0; t <= 42; t++) {
    for (const roll of [0, 0.2, 0.34, 0.5, 0.67, 0.99, 1]) {
      const seen = pickIllusion(t, roll);
      if (t === M.Horse_Invalid) { assert.equal(seen, null, 'a horse is no foe'); continue; }
      assert.notEqual(seen, null, `creature ${t} is seen as something`);
      assert.notEqual(seen, t, `creature ${t} is never seen as itself`);
      if (!(t in ILLUSIONS)) assert.ok(HARMLESS.includes(seen), `creature ${t} is seen from the pool`);
    }
  }
  // the pick walks the pool: a lich takes all three over the dice's range, a rat only the other two
  assert.deepEqual([0, 0.4, 0.8].map((r) => pickIllusion(M.Lich, r)), [M.Rat, M.GiantBat, M.Imp]);
  assert.deepEqual([0, 0.99].map((r) => pickIllusion(M.Rat, r)), [M.GiantBat, M.Imp]);
  assert.equal(pickIllusion(128, 0), null, 'a class mobile is no creature');
  assert.equal(pickIllusion(146, 0), null);
});

test('DRUNK3: people are never transformed - a class foe, an orc, a vampire, a werewolf', () => {
  const v = visionsAt(() => VERY(1), [0, 0]);   // the dice always say yes
  assert.equal(v.seenAs(foe(M.Zombie)), M.Rat, 'control: a zombie is seen as a rat');
  for (const f of [
    foe(M.Mage, { entity: { isClass: true } }), foe(M.Knight_CityWatch, { entity: { isClass: true } }), foe(M.Warrior),
    foe(M.Orc), foe(M.OrcSergeant), foe(M.OrcShaman), foe(M.OrcWarlord), foe(M.Vampire), foe(M.VampireAncient), foe(M.Werewolf),
    foe(M.Lich, { entity: { isClass: true } }),   // whatever its mobile, a class entity is a person
  ]) assert.equal(v.seenAs(f), null, `mobile ${f.mobileType} is a person`);
});

test('DRUNK3: the chance - nothing sober or merely drunk, 0.4 at the Very drunk line and 0.8 at the endurance', () => {
  assert.equal(illusionChance(SOBER), 0);
  assert.equal(illusionChance(DRUNK(0)), 0);
  assert.equal(illusionChance(DRUNK(1)), 0, 'merely drunk, however deep, sees true');
  assert.equal(illusionChance(VERY(0)), 0.4);
  assert.equal(illusionChance(VERY(1)), 0.8);
  assert.ok(Math.abs(illusionChance(VERY(0.5)) - 0.6) < 1e-12);
  assert.deepEqual({ ...ILLUSION_CHANCE }, { base: 0.4, add: 0.4 });
  assert.equal(illusionChance(null), 0);
  assert.equal(illusionChance(VERY(7)), 0.8, 'a share past the endurance is held to it');
  assert.equal(illusionChance(VERY(NaN)), 0.4);
});

test('DRUNK3: the dice meet the chance at its edge - a roll under it is seen as another, a roll on it is not', () => {
  for (const [state, edge] of [[VERY(0), 0.4], [VERY(1), 0.8]]) {
    assert.equal(visionsAt(() => state, [edge - 1e-9, 0]).seenAs(foe(M.Zombie)), M.Rat, `just under ${edge}`);
    assert.equal(visionsAt(() => state, [edge, 0]).seenAs(foe(M.Zombie)), null, `on ${edge}`);
    assert.equal(visionsAt(() => state, [0.99, 0]).seenAs(foe(M.Zombie)), null, 'a high roll');
  }
  // sober or drunk: the dice never matter
  assert.equal(visionsAt(() => SOBER, [0, 0]).seenAs(foe(M.Zombie)), null);
  assert.equal(visionsAt(() => DRUNK(1), [0, 0]).seenAs(foe(M.Zombie)), null);
  // the second die picks from the pool, for a creature the table does not name
  assert.equal(visionsAt(() => VERY(1), [0, 0.5]).seenAs(foe(M.Lich)), M.GiantBat);
});

test('DRUNK3: the decision is stable - a foe is seen the same every frame, whatever the dice or the share do after', () => {
  let state = VERY(0.5);
  const v = visionsAt(() => state, [0.1, 0.1, 0.9, 0.9, 0.9, 0.9]);   // the foe is dealt 0.1/0.1; the dice then say no
  const a = foe(M.Zombie), b = foe(M.Zombie);
  assert.equal(v.seenAs(a), M.Rat);
  assert.equal(v.seenAs(b), null, 'b was dealt 0.9: not seen');
  for (let i = 0; i < 60; i++) {
    state = VERY(i / 59);   // the drink deepens (and the chance with it) - a foe decided is a foe decided
    assert.equal(v.seenAs(a), M.Rat);
    assert.equal(v.seenAs(b), null);
  }
  // a foe with a number is dealt by a hash of it: the same in any runtime, the same on any call
  const numbered = foe(M.Lich, { seq: 12 });
  const first = visionsAt(() => VERY(1), [0.99]).seenAs(numbered), second = visionsAt(() => VERY(1), [0]).seenAs(foe(M.Lich, { seq: 12 }));
  assert.equal(first, second, 'the hash, not the rng, deals a numbered foe');
  assert.equal(visionRoll(12, M.Lich, 0, 0), visionRoll(12, M.Lich, 0, 0));
  assert.ok(visionRoll(12, M.Lich, 0, 0) >= 0 && visionRoll(12, M.Lich, 0, 0) < 1);
  assert.notEqual(visionRoll(12, M.Lich, 0, 0), visionRoll(13, M.Lich, 0, 0), 'another foe');
  assert.notEqual(visionRoll(12, M.Lich, 0, 0), visionRoll(12, M.Lich, 1, 0), 'the next binge');
  assert.notEqual(visionRoll(12, M.Lich, 0, 0), visionRoll(12, M.Lich, 0, 1), 'the second die');
  assert.notEqual(visionRoll(12, M.Lich, 0, 0), visionRoll(12, M.Zombie, 0, 0), 'another kind with the same number');
  // across many numbered foes the chance is kept: about 0.8 of them are seen at the endurance
  const vv = visionsAt(() => VERY(1));
  let seen = 0;
  for (let i = 1; i <= 2000; i++) if (vv.seenAs(foe(M.Lich, { seq: i })) != null) seen++;
  assert.ok(seen > 1500 && seen < 1700, `about 80% seen at the endurance (${seen}/2000)`);
});

test('DRUNK3: sobering ends the binge - the next one deals the dice again, and a foe is not re-dealt while still Very drunk', () => {
  let state = VERY(1);
  const v = visionsAt(() => state, [0.1, 0, 0.9, 0.9]);
  const z = foe(M.Zombie);
  assert.equal(v.seenAs(z), M.Rat);
  state = DRUNK(0.9);   // below Very drunk: nothing is seen
  assert.equal(v.seenAs(z), null);
  state = VERY(1);      // a new binge: dealt again (0.9: not seen)
  assert.equal(v.seenAs(z), null, 'the next binge rerolls');
  assert.equal(v.seenAs(z), null, '...and holds');
  // a numbered foe is dealt a new hash in the next binge
  let st = VERY(0);
  const w = visionsAt(() => st);
  const rolled = [];
  const lich = foe(M.Lich, { seq: 7 });
  for (let n = 0; n < 40; n++) {
    st = VERY(0); const again = w.seenAs(lich);
    assert.equal(w.seenAs(lich), again, 'held within the binge');
    rolled.push(again != null);
    st = SOBER; w.seenAs(lich);
  }
  assert.ok(rolled.some((x) => x) && rolled.some((x) => !x), 'across binges the same numbered foe is sometimes seen as another and sometimes not');
});

test('AUDIT DRUNK2: the band told to the visions (note) turns the binge with no foe drawn - and drops a read it was holding', () => {
  let state = SOBER, t = 0;
  const v = createDrunkVisions({ state: () => state, now: () => t, ttl: 100, rng: () => 0 });
  assert.equal(v.binge, 0);
  v.note('veryDrunk');
  assert.equal(v.binge, 0, 'into the band: the binge is under way, not over');
  v.note('veryDrunk');
  assert.equal(v.binge, 0, 'told again, nothing');
  v.note('sober');
  assert.equal(v.binge, 1, 'out of it: over - nothing was drawn');
  v.note('drunk');
  assert.equal(v.binge, 1, 'Drunk is no binge to end');
  v.note('veryDrunk'); v.note('drunk');
  assert.equal(v.binge, 2);
  // a read held (ttl) when the band is told is not believed over it: the zombie of a new binge is dealt anew
  state = VERY(1);
  const z = foe(M.Zombie);
  assert.equal(v.seenAs(z), M.Rat);   // reads Very drunk, held till t = 100
  state = SOBER;
  v.note('sober');   // the feel heard the band drop (it asks no ttl): the next ask reads again
  assert.equal(v.seenAs(z), null, 'sober at once, the held very-drunk read dropped');
  assert.equal(v.binge, 3);
  // the on-demand check still works with no feel at all
  state = VERY(1); t = 500;
  assert.equal(v.seenAs(z), M.Rat);
  state = SOBER; t = 700;
  v.seenAs(z);
  assert.equal(v.binge, 4);
});

test('DRUNK3: the drink is read at most once a ttl - a frame of foes costs one read', () => {
  let reads = 0, t = 0;
  const v = createDrunkVisions({ state: () => { reads++; return VERY(0); }, now: () => t, ttl: 100, rng: () => 0 });
  for (let i = 0; i < 30; i++) v.seenAs(foe(M.Zombie));
  assert.equal(reads, 1);
  t = 99; v.seenAs(foe(M.Zombie));
  assert.equal(reads, 1);
  t = 100; v.seenAs(foe(M.Zombie));
  assert.equal(reads, 2);
});

test('DRUNK3: a dead foe, or no foe, is seen as it is', () => {
  const v = visionsAt(() => VERY(1));
  assert.equal(v.seenAs(foe(M.Zombie, { dead: true })), null);
  assert.equal(v.seenAs(null), null);
  assert.equal(v.seenAs(foe(39)), null, 'the invalid horse');
});

/** A texture with `counts[record]` frames (-1 for a record it lacks, as textureFile answers). */
const fakeTexture = (counts) => ({ getFrameCount: (r) => counts[r] ?? -1 });
const REAL = Object.freeze({ tag: 'the real foe texture' });

test('DRUNK3: the draw helper - the illusion\'s archive, record kept, the frame held to its own count', async () => {
  const bat = fakeTexture({ 0: 4, 1: 4, 5: 3, 15: 2 });
  const asked = [];
  const draw = createVisionDraw({ seenAs: () => M.GiantBat });
  const getTexture = (a) => { asked.push(a); return Promise.resolve(bat); };
  // the first frame: the texture is not loaded, the real foe is drawn
  let d = draw(foe(M.Dragonling), 289, REAL, { record: 5, frame: 4, flip: true }, getTexture);
  assert.deepEqual({ ...d }, { archive: 289, tex: REAL, record: 5, frame: 4, flip: true, seen: false });
  await flush();
  assert.deepEqual(asked, [ENEMY_BASICS[M.GiantBat].maleTexture]);
  // the bat's attack record has three frames: the dragonling's fifth is held to the bat's last
  d = draw(foe(M.Dragonling), 289, REAL, { record: 5, frame: 4, flip: true }, getTexture);
  assert.deepEqual({ ...d }, { archive: 258, tex: bat, record: 5, frame: 2, flip: true, seen: true });
  d = draw(foe(M.Dragonling), 289, REAL, { record: 5, frame: 2, flip: true }, getTexture);
  assert.equal(d.frame, 2, 'a frame the illusion has is kept');
  d = draw(foe(M.Dragonling), 289, REAL, { record: 5, frame: 3, flip: true }, getTexture);
  assert.equal(d.frame, 2, 'one past the last is held to the last');
  d = draw(foe(M.Dragonling), 289, REAL, { record: 5, frame: 0, flip: true }, getTexture);
  assert.equal(d.frame, 0);
  d = draw(foe(M.Dragonling), 289, REAL, { record: 15, frame: 1, flip: true }, getTexture);
  assert.deepEqual({ ...d }, { archive: 258, tex: bat, record: 15, frame: 1, flip: true, seen: true });
  d = draw(foe(M.Dragonling), 289, REAL, { record: 15, frame: 3, flip: true }, getTexture);
  assert.equal(d.frame, 1, 'two frames: three is held to one');
  // never a frame the file would answer with an empty bitmap
  for (const frame of [-3, NaN, undefined]) assert.equal(draw(foe(M.Dragonling), 289, REAL, { record: 0, frame }, getTexture).frame, 0);
  // the record the illusion lacks falls back to its first
  d = draw(foe(M.Dragonling), 289, REAL, { record: 22, frame: 3, flip: true }, getTexture);
  assert.deepEqual({ ...d }, { archive: 258, tex: bat, record: 0, frame: 3, flip: true, seen: true });
  d = draw(foe(M.Dragonling), 289, REAL, { record: 22, frame: 9, flip: true }, getTexture);
  assert.equal(d.frame, 3, 'and its frame is held to the first record\'s count');
  assert.equal(asked.length, 1, 'the texture is asked for once');
});

test('DRUNK3: the draw helper draws the real foe when there is no illusion, no texture yet, no texture ever, or nothing to show', async () => {
  const real = { record: 7, frame: 2, flip: true };
  // no illusion: the foe as it is, the same object it gave
  let d = createVisionDraw({ seenAs: () => null })(foe(M.Zombie), 272, REAL, real, () => { throw new Error('no illusion, no texture asked'); });
  assert.deepEqual({ ...d }, { archive: 272, tex: REAL, record: 7, frame: 2, flip: true, seen: false });
  assert.equal(d.tex, REAL);
  // the texture still loading
  const draw = createVisionDraw({ seenAs: () => M.Rat });
  const never = () => new Promise(() => {});
  for (let i = 0; i < 3; i++) { d = draw(foe(M.Zombie), 272, REAL, real, never); await flush(); }
  assert.deepEqual({ ...d }, { archive: 272, tex: REAL, record: 7, frame: 2, flip: true, seen: false });
  // a load that fails is not asked again
  let calls = 0;
  const failing = createVisionDraw({ seenAs: () => M.Rat });
  const fail = () => { calls++; return Promise.reject(new Error('no such archive')); };
  for (let i = 0; i < 4; i++) { d = failing(foe(M.Zombie), 272, REAL, real, fail); await flush(); }
  assert.equal(d.seen, false);
  assert.equal(d.tex, REAL);
  assert.equal(calls, 1);
  // a "texture" that cannot count frames, a host with no getTexture, and an illusion with no frames at all
  const odd = createVisionDraw({ seenAs: () => M.Rat });
  d = odd(foe(M.Zombie), 272, REAL, real, () => Promise.resolve({})); await flush();
  assert.equal(odd(foe(M.Zombie), 272, REAL, real, () => Promise.resolve({})).seen, false);
  assert.equal(createVisionDraw({ seenAs: () => M.Rat })(foe(M.Zombie), 272, REAL, real, undefined).seen, false);
  const empty = createVisionDraw({ seenAs: () => M.Rat });
  const hollow = () => Promise.resolve(fakeTexture({}));
  empty(foe(M.Zombie), 272, REAL, real, hollow); await flush();
  assert.equal(empty(foe(M.Zombie), 272, REAL, real, hollow).seen, false, 'no record 0 either: the real foe');
  // the sober fast path: the foe's own draw through the real runtime
  const quiet = createVisionDraw(visionsAt(() => SOBER));
  assert.equal(quiet(foe(M.Zombie), 272, REAL, real, never).seen, false);
});

test('DRUNK3: the runtime and the draw together - a Very drunk player\'s zombie is a rat, an elite one a rat too, once the rat has loaded', async () => {
  const rat = fakeTexture({ 0: 5, 5: 5, 10: 2, 15: 2 });
  const draw = createVisionDraw(visionsAt(() => VERY(1), [0, 0]));
  const getTexture = (a) => { assert.equal(a, 255); return Promise.resolve(rat); };
  const elite = foe(M.Zombie, { entity: { eliteFoe: true } });
  draw(elite, 272, REAL, { record: 10, frame: 4, flip: true }, getTexture);
  await flush();
  const d = draw(elite, 272, REAL, { record: 10, frame: 4, flip: true }, getTexture);
  assert.deepEqual({ ...d }, { archive: 255, tex: rat, record: 10, frame: 1, flip: true, seen: true });
});


test('DRUNK3: the 3D body - a foe the draw marks as seen-as-another has no Morrowind look and no body, a corpse and an unmarked foe do', async () => {
  const bat = fakeTexture({ 0: 4 });
  const draw = createVisionDraw(visionsAt(() => VERY(1), [0, 0]));
  const getTexture = () => Promise.resolve(bat);
  const zombie = foe(M.Zombie), lich = foe(M.Lich);
  assert.ok(creatureLook(zombie), 'control: a zombie stands in a bonewalker');
  assert.ok(isBodyFoe(zombie));
  draw(zombie, 272, REAL, { record: 0, frame: 0 }, getTexture);   // the first frame: the texture is loading, the real foe is drawn
  assert.equal(zombie._drunkSeen ?? false, false);
  assert.ok(isBodyFoe(zombie), 'still in its body while the illusion is not on screen');
  await flush();
  draw(zombie, 272, REAL, { record: 0, frame: 0 }, getTexture);
  assert.equal(zombie._drunkSeen, true);
  assert.equal(creatureLook(zombie), null, 'seen as a rat: no look');
  assert.equal(isBodyFoe(zombie), false, 'seen as a rat: not offered to the body lane');
  // the same foe dead is its own corpse's body
  zombie.dead = true;
  assert.ok(isBodyFoe(zombie), 'a corpse is a corpse');
  zombie.dead = false;
  // a person is never marked
  const mage = foe(M.Mage, { entity: { isClass: true } });
  draw(mage, 600, REAL, { record: 0, frame: 0 }, getTexture);
  assert.equal(mage._drunkSeen ?? false, false);
  assert.ok(isBodyFoe(mage));
  // the drink wears off: the mark lets go and the body comes back
  const sober = createVisionDraw(visionsAt(() => SOBER));
  sober(zombie, 272, REAL, { record: 0, frame: 0 }, getTexture);
  assert.equal(zombie._drunkSeen, false);
  assert.ok(creatureLook(zombie) && isBodyFoe(zombie), 'the body comes back');
  // a foe the draw never marked keeps its record untouched
  sober(lich, 272, REAL, { record: 0, frame: 0 }, getTexture);
  assert.equal('_drunkSeen' in lich, false);
});

test('DRUNK3: the hosts - the exterior pool and the dungeon draw what the seam answered (its archive, its record and frame, its texture\'s size) on the batch the renderer keys by archive, from the foe\'s real clock', () => {
  for (const [file, name, archive, tex] of [
    ['src/scenes/exteriorFoes.js', 'o', 'f.archive', 'f.tex'],
    ['src/scenes/dungeonContext.js', 'out', 'f.mobileArchive', 'f.mobileTex'],
  ]) {
    const src = readFileSync(new URL(`../../../${file}`, import.meta.url), 'utf8');
    assert.match(src, /import \{ foeVision \} from '\.\.\/systems\/survival\/drunkVisions\.js'/, `${file} imports the seam`);
    assert.ok(src.includes(`const ${name} = foeVision(f, ${archive}, ${tex}, f._mout, getTexture);`), `${file} asks the seam, with the foe's real clock`);
    assert.ok(src.includes('const rkey = `${' + name + '.record}#${' + name + '.frame}`;'), `${file}: the record carries the answered frame`);
    assert.ok(src.includes(`uploadRecordFrame(${name}.archive, ${name}.record, ${name}.frame)`), `${file} uploads the answered frame of the answered archive`);
    assert.ok(src.includes(`mobileBillboardSize(${name}.tex, ${name}.record)`), `${file} sizes the answered texture's record`);
    assert.ok(src.includes(`f.batch.archive = ${name}.archive`), `${file} puts the answered archive on the batch`);
  }
});
