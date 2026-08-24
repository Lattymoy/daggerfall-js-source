// V1 - THE INFECTION HALF. VampirismInfection.cs and
// LycanthropyInfection.cs: the two diseases that end by replacing the
// player's race.
//
// Everything pinned here was mutation-proven against the module, and
// the mutants that survived are recorded beside the pin that should
// have caught them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  INFECTION, LYCANTHROPY_TYPES, VAMPIRE_CLANS,
  LYCANTHROPY_DREAM_VIDEO, VAMPIRE_DREAM_VIDEO, VAMPIRE_DEATH_VIDEO,
  DEATH_IS_NOT_ETERNAL_TEXT_ID, DREAM_AFTER_DAYS, TURN_AFTER_DAYS,
  createInfection, startInfection, infectionAccepted, liveInfection,
  infectionStep, markDreamPlayed, deployInfection, runInfections,
  setInfectionHost, vampireClanForFaction, vampireTurnRaiseSeconds,
  isLycanthropyInfection,
} from '../src/systems/infection.js';
import {
  PERMANENT_DISEASE_VALUE, COMPLETED_DISEASE_VALUE,
  diseaseCount, updateDiseases, startDisease, DISEASES,
} from '../src/systems/diseases.js';
import { runMagicRoundsFor, MINUTES_PER_DAY } from '../src/systems/worldTick.js';

const P = (level = 5) => ({ isPlayer: true, level, activeEffects: [] });
const noSinks = { hurt: () => {}, drainFatigue: () => {}, drainMagicka: () => {} };

// ---------------------------------------------------------------
// 1. THE TWO GATES, both off by one
// ---------------------------------------------------------------

test('infection: the dream waits a FULL day and the turn waits a FOURTH', () => {
  // ProgressDisease :121 `daysPast > 0` and :131 `daysPast > 3`. DFU's
  // own comment reads "Show dream after 1 day has passed, progress to
  // full-blown vampirism after 3 days have passed" and BOTH halves of
  // it are a day out from what the code does.
  assert.equal(DREAM_AFTER_DAYS, 0);
  assert.equal(TURN_AFTER_DAYS, 3);

  const e = createInfection(INFECTION.Werewolf, { day: 100 });
  // the day it is caught: nothing, however many rounds run
  assert.equal(infectionStep(e, 100).kind, 'idle');
  // the next day: the dream, not the turn
  assert.equal(infectionStep(e, 101).kind, 'dream');
  // MUTATION: `daysPast >= DREAM_AFTER_DAYS` makes day 100 dream.
  // MUTATION: DREAM_AFTER_DAYS = 1 makes day 101 idle.

  markDreamPlayed(e);
  // three days past is still NOT the turn - this is the off-by-one
  // that a plain reading of DFU's comment gets wrong
  assert.equal(infectionStep(e, 103).kind, 'idle');
  assert.equal(infectionStep(e, 104).kind, 'deploy');
  // MUTATION: `daysPast >= TURN_AFTER_DAYS` turns the player on day 103.
});

test('infection: the turn needs the dream PLAYED, not merely scheduled', () => {
  // The flag is set from the video's OnClose (:143-146), and the
  // window is modal - so a dream left open holds the infection at the
  // gate for ever. Scheduling it is not enough.
  const e = createInfection(INFECTION.Vampirism, { day: 0 });
  assert.equal(infectionStep(e, 1).kind, 'dream');
  e.dreamScheduled = true;                       // pushed, never dismissed
  assert.equal(infectionStep(e, 1).kind, 'idle');   // and not scheduled twice
  assert.equal(infectionStep(e, 400).kind, 'idle', 'a year later, still nothing');
  // MUTATION: dropping `&& entry.dreamPlayed` from the second gate
  // turns a player who never watched the dream on day 4.
  markDreamPlayed(e);
  assert.equal(infectionStep(e, 400).kind, 'death');
  // WarningDreamVideoCompleted sets ONE flag and DFU never clears the
  // other; both bar the first gate from here on.
  assert.equal(e.dreamScheduled, true);
  assert.equal(e.dreamPlayed, true);
});

test('infection: the strain picks the dream video, and only vampirism dies first', () => {
  const vamp = createInfection(INFECTION.Vampirism, { day: 0 });
  const wolf = createInfection(INFECTION.Werewolf, { day: 0 });
  const boar = createInfection(INFECTION.Wereboar, { day: 0 });
  assert.equal(infectionStep(vamp, 1).video, VAMPIRE_DREAM_VIDEO);
  assert.equal(infectionStep(wolf, 1).video, LYCANTHROPY_DREAM_VIDEO);
  assert.equal(infectionStep(boar, 1).video, LYCANTHROPY_DREAM_VIDEO);
  assert.notEqual(VAMPIRE_DREAM_VIDEO, LYCANTHROPY_DREAM_VIDEO);

  // Lycanthropy turns AT the gate; vampirism plays a fake death first
  // and turns on ITS close, so the tick answers 'death' and then has
  // nothing more to say until the video is dismissed.
  for (const e of [vamp, wolf, boar]) markDreamPlayed(e);
  assert.deepEqual(infectionStep(wolf, 4), { kind: 'deploy' });
  assert.deepEqual(infectionStep(vamp, 4), { kind: 'death', video: VAMPIRE_DEATH_VIDEO });
  vamp.deathScheduled = true;                     // fakeDeathVideoPlayed, set at PUSH
  assert.deepEqual(infectionStep(vamp, 4), { kind: 'idle' });
  assert.deepEqual(infectionStep(vamp, 99), { kind: 'idle' }, 'the turn hangs off the close, not the clock');
  // MUTATION: answering 'deploy' for a vampire whose death video is
  // already scheduled turns a player who closed nothing.
});

// ---------------------------------------------------------------
// 2. THE CANCELS
// ---------------------------------------------------------------

test('infection: BecomeIncumbent cancels - the override, the duplicate, the OPPOSING strain only', () => {
  // :65-72 / :39-58.
  const turned = { ...P(), racialOverride: { key: 'Vampirism' } };
  assert.equal(infectionAccepted(turned, INFECTION.Werewolf), false, 'a vampire cannot catch lycanthropy');

  const p = P();
  assert.equal(startInfection(p, INFECTION.Werewolf, { day: 0 })?.infection, INFECTION.Werewolf);
  // the same strain twice: AddState ends the DUPLICATE, so the clock
  // is NOT restarted - a second bite buys no extra days
  assert.equal(infectionAccepted(p, INFECTION.Werewolf), false);
  assert.equal(startInfection(p, INFECTION.Werewolf, { day: 50 }), null);
  assert.equal(p.activeEffects[0].startingDay, 0, 'the original clock survived');
  // the OPPOSING strain
  assert.equal(infectionAccepted(p, INFECTION.Wereboar), false);
  // ...but vampirism is NOT a lycanthropy strain, so it is not opposed:
  // a player can be four days from two different fates at once
  assert.equal(infectionAccepted(p, INFECTION.Vampirism), true);
  // MUTATION: testing `live.length` instead of the strain bars the
  // vampire bite too, and this pin fails.
  assert.equal(isLycanthropyInfection(INFECTION.Vampirism), false);
  assert.equal(isLycanthropyInfection(INFECTION.Wereboar), true);
});

test('infection: the level-1 and non-player gates are DiseaseEffect.Start, reached through base.Start', () => {
  // :84-93 - VampirismInfection.Start calls base FIRST, so its own
  // bookkeeping runs on an already-ended disease.
  assert.equal(startInfection(P(1), INFECTION.Vampirism, {}), null);
  assert.equal(startInfection({ isPlayer: false, level: 20, activeEffects: [] }, INFECTION.Werewolf, {}), null);
  assert.notEqual(startInfection(P(2), INFECTION.Vampirism, {}), null, 'level 2 is the floor, not level 3');
});

// ---------------------------------------------------------------
// 3. IT IS A DISEASE - which is the Ledger correction
// ---------------------------------------------------------------

test('infection: an infection IS a disease bundle, so the temple already counts and cures it', () => {
  // The Ledger row that opened this arc said the cure-disease count is
  // short by one until a vampirism timer lands. It is not:
  // GetDiseaseCount (:1489-1499) counts every bundle of type Disease
  // and an infection is one. `TimeToBecomeVampireOrWerebeast` is a
  // CLASSIC .SAV field (CharacterRecord.cs:242) that nothing in DFU
  // sets, so its +1 prices an IMPORTED character only.
  const p = P();
  const e = startInfection(p, INFECTION.Vampirism, { day: 0 });
  assert.equal(e.kind, 'disease');
  assert.equal(e.disease, null);                        // classicDiseaseType None
  assert.equal(e.daysOfSymptomsLeft, PERMANENT_DISEASE_VALUE);
  assert.equal(diseaseCount(p), 1);
  startDisease(p, DISEASES.Plague, 0);
  assert.equal(diseaseCount(p), 2, 'and it counts ALONGSIDE an ordinary disease');

  // ...and the moment the player turns, there is nothing left to cure
  deployInfection(e, p);
  assert.equal(e.daysOfSymptomsLeft, COMPLETED_DISEASE_VALUE);
  assert.equal(diseaseCount(p), 1);
});

test('infection: UpdateDisease is overridden and does NOT call base', () => {
  // :99-103 in both. classicDiseaseType is None, so there is no
  // DiseaseData row - the daily damage walk would read DISEASE_DATA
  // [null] and throw on the first day.
  const p = P();
  const e = startInfection(p, INFECTION.Wereboar, { day: 0 });
  updateDiseases(p, 9, noSinks, () => 0.5);            // nine days at once
  assert.deepEqual(e.statMods, {}, 'a permanent no-effect disease damages nothing');
  assert.equal(e.daysOfSymptomsLeft, PERMANENT_DISEASE_VALUE, 'and never counts down');
  assert.equal(e.incubationOver, undefined, 'the base walk did not touch it');
  // MUTATION: dropping the `if (entry.infection) return;` arm in
  // diseases.js throws here.
});

// ---------------------------------------------------------------
// 4. THE CLAN
// ---------------------------------------------------------------

test('infection: GetVampireClan reads the region faction vam column, and DEFAULTS TO LYREZI', () => {
  // :400-427. The enum's values ARE the clan factions' own ids, so
  // the nine-arm switch is an identity read - but the tail is the
  // part worth pinning: "The Lyrezi are the default like in classic".
  assert.equal(vampireClanForFaction({ vam: 152 }), VAMPIRE_CLANS.Thrafey);
  assert.equal(vampireClanForFaction({ vam: 158 }), VAMPIRE_CLANS.Selenu);
  assert.equal(vampireClanForFaction({ vam: 0 }), VAMPIRE_CLANS.Lyrezi);
  assert.equal(vampireClanForFaction({ vam: 999 }), VAMPIRE_CLANS.Lyrezi);
  assert.equal(vampireClanForFaction(null), VAMPIRE_CLANS.Lyrezi, 'a region with no Province record still turns you');
  // MUTATION: returning VAMPIRE_CLANS.None on the default arm - which
  // is the reading a person gives the switch, since None is in the
  // enum - leaves a clanless vampire with no spells.
  assert.notEqual(VAMPIRE_CLANS.Lyrezi, VAMPIRE_CLANS.None);
});

test('infection: the clan is read from where it was CAUGHT, at the moment of the turn', () => {
  // :89-91 - "Think classic uses current region at time of turning,
  // this will use current region at time of infection."
  const p = P();
  const e = startInfection(p, INFECTION.Vampirism, { day: 0, regionIndex: 17 });
  assert.equal(e.regionIndex, 17);
  markDreamPlayed(e);
  const asked = [];
  const pending = deployInfection(e, p, { clanOf: (r) => { asked.push(r); return VAMPIRE_CLANS.Haarvenu; } });
  assert.deepEqual(asked, [17]);
  assert.equal(pending.clan, VAMPIRE_CLANS.Haarvenu);
  assert.equal(pending.lycanthropy, LYCANTHROPY_TYPES.None);
  // a lycanthrope carries a strain and no clan
  const q = P();
  const w = startInfection(q, INFECTION.Wereboar, { day: 0 });
  const wp = deployInfection(w, q, {});
  assert.equal(wp.lycanthropy, LYCANTHROPY_TYPES.Wereboar);
  assert.equal(wp.clan, VAMPIRE_CLANS.None);
});

// ---------------------------------------------------------------
// 5. THE CLOCK RAISE - a SIGNED term
// ---------------------------------------------------------------

test('infection: the vampire turn raises the clock by a signed fortnight, landing at 19:00 always', () => {
  // :160 - `(2 * SecondsPerWeek) + (DuskHour + 1 - Hour) * 3600`.
  const twoWeeks = 2 * 7 * 86400;
  assert.equal(vampireTurnRaiseSeconds(19), twoWeeks, 'turning AT 19:00 is the only exact fortnight');
  assert.ok(vampireTurnRaiseSeconds(22) < twoWeeks, 'turning at 22:00 lands three hours EARLY');
  assert.equal(vampireTurnRaiseSeconds(22), twoWeeks - 3 * 3600);
  assert.ok(vampireTurnRaiseSeconds(3) > twoWeeks);
  // MUTATION: Math.abs() on the hour term, or clamping it at zero,
  // both pass a "roughly two weeks" pin and fail this one.
  for (let hour = 0; hour < 24; hour++) {
    const landed = (hour + vampireTurnRaiseSeconds(hour) / 3600) % 24;
    assert.equal(landed, 19, `a turn begun at ${hour}:00 still wakes at dusk`);
  }
});

// ---------------------------------------------------------------
// 6. THE PASS, AND THE HOST SEAM
// ---------------------------------------------------------------

test('infection: runInfections pushes each video once and carries the lifecycle on its close', () => {
  setInfectionHost(null);
  const p = P();
  startInfection(p, INFECTION.Vampirism, { day: 0, regionIndex: 3 });
  const pushed = [];
  let close = null;
  const opts = {
    playVideo: (name, onClose) => { pushed.push(name); close = onClose; },
    raiseTime: () => {},
    messageBox: () => {},
  };
  assert.equal(runInfections(p, 1, opts).kind, 'dream');
  assert.deepEqual(pushed, [VAMPIRE_DREAM_VIDEO]);
  // still open on day 9: the window was PUSHED, so it is not pushed again
  assert.equal(runInfections(p, 9, opts).kind, 'idle');
  assert.deepEqual(pushed, [VAMPIRE_DREAM_VIDEO], 'no second dream');
  close();                                             // the player dismisses it
  assert.equal(runInfections(p, 9, opts).kind, 'death');
  assert.deepEqual(pushed, [VAMPIRE_DREAM_VIDEO, VAMPIRE_DEATH_VIDEO]);
  assert.equal(p.racialOverridePending, undefined, 'not turned while the death video runs');
  close();                                             // ...and the death video closes
  assert.equal(p.racialOverridePending.key, INFECTION.Vampirism);
  assert.equal(diseaseCount(p), 0);
});

test('infection: an unregistered host still runs the lifecycle - the video counts as watched', () => {
  setInfectionHost(null);
  const p = P();
  startInfection(p, INFECTION.Werewolf, { day: 0 });
  assert.equal(runInfections(p, 1).kind, 'dream');
  assert.equal(runInfections(p, 4).kind, 'deploy');
  assert.equal(p.racialOverridePending.lycanthropy, LYCANTHROPY_TYPES.Werewolf);
});

test('infection: the registered host supplies the video, the clock and the popup', () => {
  const raised = [], said = [];
  setInfectionHost({
    playVideo: (name, onClose) => onClose(),
    raiseTime: (s) => raised.push(s),
    messageBox: (id) => said.push(id),
    clanOf: () => VAMPIRE_CLANS.Montalion,
    hourNow: () => 22,
  });
  try {
    const p = P();
    startInfection(p, INFECTION.Vampirism, { day: 0, regionIndex: 1 });
    runInfections(p, 1);            // dream, watched
    runInfections(p, 4);            // death, watched -> the turn
    assert.deepEqual(raised, [vampireTurnRaiseSeconds(22)]);
    assert.deepEqual(said, [DEATH_IS_NOT_ETERNAL_TEXT_ID]);
    assert.equal(p.racialOverridePending.clan, VAMPIRE_CLANS.Montalion);
  } finally { setInfectionHost(null); }
});

test('infection: the magic round runs it, so every host that ticks gets the turn', () => {
  // The lifecycle used to have no caller at all. One home, in
  // worldTick's runMagicRoundsFor beside the disease pass.
  setInfectionHost(null);
  const p = P();
  startInfection(p, INFECTION.Wereboar, { day: 0 });
  const day = (d) => d * MINUTES_PER_DAY;
  runMagicRoundsFor(p, day(1) - 1, day(1), { sinks: noSinks });
  assert.equal(liveInfection(p).dreamPlayed, true, 'the dream played inside the round');
  runMagicRoundsFor(p, day(4) - 1, day(4), { sinks: noSinks });
  assert.equal(p.racialOverridePending.lycanthropy, LYCANTHROPY_TYPES.Wereboar);
  // MUTATION: deleting the runInfections line from runMagicRoundsFor
  // leaves the infection sitting for ever and this fails twice.
});

// ---------------------------------------------------------------
// 7. THE FOUR HOSTS
// ---------------------------------------------------------------

test('infection: all four hosts register the video seam, and the two dreams are in the diet', () => {
  const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
  for (const host of ['scenes/world.js', 'scenes/exterior.js', 'scenes/worldModes.js', 'scenes/dungeonContext.js']) {
    assert.ok(src(host).includes('wireInfectionVideos(renderer'), `${host} registers the infection host`);
  }
  // "Wire a video, and the pin makes you feed it" - dataSource's own
  // rule. Both dreams are named in src now, so both must be KEPT.
  const diet = src('scenes/dataSource.js');
  assert.ok(diet.includes("name === 'ANIM0002.VID'"));
  assert.ok(diet.includes("name === 'ANIM0004.VID'"));
  assert.ok(diet.includes("name === 'ANIM0012.VID'"), 'the fake death reuses D1 death video');
});
