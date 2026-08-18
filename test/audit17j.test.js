// AUDIT 17j - the parity pass over U14 (the pointer path) and U15 (the
// classic wizard order + the random-name button), read against DFU's
// DaggerfallStartNewGameWizard handler table and CreateCharNameSelect
// rather than against the port's own STATES order.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ChargenFlow, NAME_MAX_CHARACTERS } from '../src/ui/chargen.js';
import { srand } from '../src/formats/dfRandom.js';
import { SKILLS } from '../src/systems/skills.js';

const CAREER = {
  name: 'Mage', hitPointsPerLevel: 8, advancementMultiplier: 1,
  strength: 40, intelligence: 60, willpower: 72, agility: 48,
  endurance: 52, personality: 55, speed: 48, luck: 57,
  primarySkills: [SKILLS.Mysticism, SKILLS.Alteration, SKILLS.Thaumaturgy],
  majorSkills: [SKILLS.Illusion, SKILLS.Destruction, SKILLS.Restoration],
  minorSkills: [SKILLS.Medical, SKILLS.ShortBlade, SKILLS.BluntWeapon, SKILLS.Dragonish, SKILLS.Daedric, SKILLS.Dodging],
};
const flow = () => new ChargenFlow([{ name: 'Mage', career: CAREER }], () => 0);
/** race -> gender -> U18's class method -> class -> (no biography
 *  set) -> name */
const toName = (f) => { f.input('confirm'); f.input('confirm'); f.input('confirm'); f.input('confirm'); return f; };

test('17j F1: entering the name screen RESEEDS, so the random button is not deterministic', () => {
  // CreateCharNameSelect.cs:123-126 - ShowRandomButton runs on Setup
  // AND every OnPush, and reseeds DFRandom from a fresh System.Random
  // ("better than starting with a seed of 0 every time"). The port
  // never did, and DFRandom is a GLOBAL whose last srand before
  // chargen is the dungeon's locationId - so two boots of the same
  // location handed the same race and gender the same name.
  const seeds = [11, 22, 33];
  const names = seeds.map((seed) => {
    const f = flow();
    f.seedRandom = () => seed;      // the injected engine draw
    srand(41521);                   // the locationId every boot shares
    toName(f);
    f.applyHit({ randomName: true });
    return f.name;
  });
  assert.equal(new Set(names).size, 3, 'a different engine draw must give a different name');

  // and the reseed is what does it: hold the draw fixed and the SAME
  // name comes back, which is exactly the old behaviour.
  const held = seeds.map(() => {
    const f = flow();
    f.seedRandom = () => 7;
    srand(41521);
    toName(f);
    f.applyHit({ randomName: true });
    return f.name;
  });
  assert.equal(new Set(held).size, 1, 'the draw is the only source of variation');
});

test('17j F1: the reseed happens on EVERY entry, not just the first', () => {
  // DFU pushes the window again when the face screen cancels, and
  // OnPush reseeds again.
  const f = flow();
  let draw = 0;
  f.seedRandom = () => { draw += 1; return draw * 1000; };
  toName(f);
  assert.equal(draw, 1);
  f.input('confirm');                 // name is empty -> AcceptName is inert
  f.name = 'Held';
  f.input('confirm');                 // -> face
  assert.equal(f.state, 'face');
  f.input('back');                    // -> name again
  assert.equal(f.state, 'name');
  assert.equal(draw, 2, 're-entry reseeds, as OnPush does');
});

test('17j F2: the class screen cancels to RACE, skipping gender', () => {
  // ClassSelectWindow_OnClose (:353-370) - the cancel arm is
  // SetRaceSelectWindow, not the screen before it.
  const f = flow();
  f.input('confirm'); f.input('confirm'); f.input('confirm');   // U18: through the method screen
  assert.equal(f.state, 'class');
  f.input('back');
  assert.equal(f.state, 'race');
  assert.equal(f.raceConfirm, null, 'and the open description box closes with it');
});

test('17j F3: the name screen can be backed out of, and DISCARDS the biography', () => {
  // NameSelectWindow_OnClose (:483-493) cancels to SetChooseBioWindow,
  // which builds a fresh CreateCharBiography over a fresh BiogFile -
  // so the questions restart and the answers so far are dropped. The
  // discard is load-bearing: answerBiography APPENDS, so re-answering
  // without it would apply every effect twice.
  const f = flow();
  f.biogFor = () => ({ questions: [{ text: 'Q1', answers: [{ effects: [{ type: 'gold', amount: 100 }] }] }] });
  f.input('confirm'); f.input('confirm'); f.input('confirm');   // -> class (U18: via the method screen)
  f.input('confirm');                        // -> U19's bio-method screen
  f.input('down'); f.input('confirm');       // answer questions -> biography
  assert.equal(f.state, 'biography');
  f.answerBiography(0);
  assert.equal(f.state, 'name');
  assert.equal(f.biographyEffects.length, 1);

  f.input('back');
  // U19: SetChooseBioWindow IS a screen now - the method choice
  assert.equal(f.state, 'bioMethod', 'back lands on the bio-method screen (SetChooseBioWindow)');
  f.input('down'); f.input('confirm');       // back through the questions arm
  assert.equal(f.state, 'biography');
  assert.equal(f.biogQuestionIndex, 0, 'and they restart');
  assert.deepEqual(f.biographyEffects, [], 'the answers so far are DISCARDED, or they would double-apply');
});

test('17j F3: with no question set for the class, the name cancel is inert', () => {
  const f = toName(flow());          // biogFor is null - no biography screen exists
  assert.equal(f.state, 'name');
  f.input('back');
  assert.equal(f.state, 'name', 'there is no screen behind it to reach');
});

test('17j F4: changing race or gender EMPTIES the name box', () => {
  // SetRaceTemplate / SetGender (:142-161). Reachable now that F2 and
  // F3 give the wizard real back navigation.
  const f = flow();
  toName(f);
  f.name = 'Vanus Galerion';
  f.input('confirm');                       // -> face
  f.input('back');                          // -> name, nothing changed
  assert.equal(f.name, 'Vanus Galerion', 'an unchanged race and gender keep the name');

  f.input('back');                          // name cancel is inert (no biography)
  f.state = 'gender';
  f.input('up');                             // flip the gender
  f.input('confirm'); f.input('confirm'); f.input('confirm');    // -> method -> class -> name
  assert.equal(f.state, 'name');
  assert.equal(f.name, '', 'a changed gender empties the box');

  const g = flow();
  toName(g);
  g.name = 'Vanus Galerion';
  g.state = 'race';
  g.raceIndex = 3;                           // a different province
  g.input('confirm'); g.input('confirm'); g.input('confirm'); g.input('confirm');
  assert.equal(g.name, '', 'a changed race empties it too');
});

test('17j F4: the FIRST entry never clears, because DFU guards on the previous template', () => {
  // SetRaceTemplate: `if (this.raceTemplate != null)`. A name typed
  // before the first push does not exist in DFU, but the guard is why
  // the port must remember null rather than a default race id.
  const f = flow();
  f.raceIndex = 5;
  toName(f);
  assert.equal(f._nameRaceId, f.race.id);
  assert.equal(f._nameGender, f.gender);
});

test('17j F5: the name box holds 31 characters, TextBox\'s default', () => {
  // CreateCharNameSelect never sets MaxCharacters, so it keeps the
  // class default (TextBox.cs:26). The port capped at 16.
  assert.equal(NAME_MAX_CHARACTERS, 31);
  const f = toName(flow());
  for (let i = 0; i < 40; i++) f.input('char:a');
  assert.equal(f.name.length, 31);
});

test('17j F6: worldModes routes DUNGEON overlay clicks, as dungeon.js does', () => {
  // THE FOUR HOSTS RULE. dungeonContext exposes ONE overlayClick seam;
  // both hosts that mount a dungeon context must reach it. This is a
  // source sweep because the host needs a canvas and a GL context to
  // run - the same shape as the 17i construction sweep.
  const src = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('function pointerdown('));
  const body = fn.slice(0, fn.indexOf('\n  }\n'));
  // the whole condition, not its halves: a pin that matched only
  // `dungeonCtx?.uiOverlayActive` still passed when the mode test was
  // mutated away, because the text it looked for was still there.
  assert.match(body, /mode === 'dungeon' && dungeonCtx\?\.uiOverlayActive/,
    'the dungeon branch must test BOTH the mode and the overlay');
  assert.match(body, /dungeonCtx\.overlayClick/, 'and route to the ONE seam, not a second click path');
  assert.ok(body.indexOf('dungeonCtx.overlayClick') < body.indexOf("mode !== 'interior'"),
    'the dungeon branch must run BEFORE the interior gate that used to reject every dungeon click');
});


test('17j F7: re-entering STATS keeps the roll and the points spent', () => {
  // SetAddBonusStatsWindow (:227-246) rerolls only when the class
  // changed. The port rerolled on every entry, so backing up one
  // screen and coming forward threw away the whole distribution.
  let roll = 0;
  const f = new ChargenFlow([{ name: 'Mage', career: CAREER }], () => { roll += 0.01; return roll % 1; });
  toName(f);
  f.name = 'Vanus';
  f.input('confirm');                       // -> face
  f.input('confirm');                       // -> stats
  assert.equal(f.state, 'stats');
  const rolled = { ...f.stats };
  const pool = f.statPool;
  f.input('plus'); f.input('plus');          // spend two
  const spent = { ...f.stats };
  assert.equal(f.statPool, pool - 2);

  f.input('back');                           // -> face
  f.input('confirm');                        // -> stats again
  assert.deepEqual(f.stats, spent, 'the spend survives');
  assert.equal(f.statPool, pool - 2, 'and so does the pool');
  assert.notDeepEqual(f.stats, rolled, 'proving this is the SAME roll, not a fresh one');
});

test('17j F7: the Reroll button still forces a fresh roll', () => {
  let roll = 0;
  const f = new ChargenFlow([{ name: 'Mage', career: CAREER }], () => { roll += 0.017; return roll % 1; });
  toName(f);
  f.name = 'Vanus';
  f.input('confirm'); f.input('confirm');    // -> stats
  const before = { ...f.stats };
  f.input('reroll');
  assert.notDeepEqual(f.stats, before, 'the screen\'s own Reroll is not re-entry');
});

test('17j F7: changing the CLASS does reroll, as DFU\'s DFClass check does', () => {
  let roll = 0;
  const rolls = () => { roll += 0.013; return roll % 1; };
  const OTHER = { ...CAREER, name: 'Warrior', strength: 70, intelligence: 30 };
  const f = new ChargenFlow([{ name: 'Mage', career: CAREER }, { name: 'Warrior', career: OTHER }], rolls);
  toName(f);
  f.name = 'Vanus';
  f.input('confirm'); f.input('confirm');    // -> stats
  const asMage = { ...f.stats };

  f.state = 'class';
  f.input('down');                            // a different career
  assert.equal(f.classListIndex, 1, 'the LIST moves; the document takes it on confirm');
  f.input('confirm');                         // -> name (no biography set)
  f.input('confirm');                         // -> face
  f.input('confirm');                         // -> stats
  assert.notDeepEqual(f.stats, asMage, 'a new class gets a new roll');
});

test('17j F7: re-entering SKILLS keeps its spend too', () => {
  // CreateCharAddBonusSkills.SetCharacterDocument's isRestored arm
  // (:62-68) restores the document's skills instead of rolling.
  let roll = 0;
  const f = new ChargenFlow([{ name: 'Mage', career: CAREER }], () => { roll += 0.011; return roll % 1; });
  toName(f);
  f.name = 'Vanus';
  f.input('confirm'); f.input('confirm');    // -> stats
  while (f.statPool > 0) f.input('plus');
  f.input('confirm');                         // -> skills
  assert.equal(f.state, 'skills');
  const spentSkills = [...f.skills];
  const pools = { ...f.pools };

  f.input('back');                            // -> stats
  f.input('confirm');                         // -> skills again
  assert.deepEqual(f.skills, spentSkills, 'the skills survive the round trip');
  assert.deepEqual(f.pools, pools, 'and so do the three group pools');
});
