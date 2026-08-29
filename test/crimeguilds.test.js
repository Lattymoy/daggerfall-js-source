// CG2 - THE CRIME-GUILD TALLY (2026-08-28).
//
// TallyCrimeGuildRequirements (PlayerEntity.cs:1271-1299) and
// HandleStartingCrimeGuildQuests (:1503-1522). Neither guild is joined
// by asking - G2 pinned that both throw NotImplementedException,
// because classic INVITES you - and this is how the invitation is
// earned: thefts count toward ten, murders toward fifteen, and crossing
// either stamps a clock three classic days out. When it runs down, and
// only while the player is outside, the initiation quest starts and the
// tally parks at InviteSent so it can never fire twice.
//
// The port had none of it, and the shape of the gap is the point:
// formats/characterRecord.js has parsed all four fields since the .SAV
// work and systems/classicSave.js imports every one onto the entity, so
// a player importing a classic save at nine thefts carried a tally
// nothing would ever read again. THE READER SHIPPED AND THE CONSUMER
// NEVER DID - the same shape as EW1's missing weight term and FD1's
// missing water exemption, three in a row now.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  tallyCrimeGuildRequirements, handleStartingCrimeGuildQuests,
  setCrimeGuildQuestHost, setCrimeGuildClock,
  INVITE_SENT, THIEVES_GUILD_TALLY_TARGET, DARK_BROTHERHOOD_TALLY_TARGET,
  CRIME_GUILD_LETTER_DELAY_MINUTES, THIEVES_GUILD_INITIATION_QUEST,
  DARK_BROTHERHOOD_INITIATION_QUEST, THIEVES_GUILD_FACTION_ID, DARK_BROTHERHOOD_FACTION_ID,
} from '../src/systems/crimeGuilds.js';
import { THIEVES_GUILD_FACTION_ID as COURT_TG } from '../src/systems/court.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const NOW = 100000;
/** A brand-new entity: NO crime-guild fields at all, which is what the
 *  port actually mints (systems/save.js reads every persistent field
 *  with its own `?? 0` rather than declaring defaults). */
const fresh = () => ({});

test('CG2: a FRESH entity tallies - the undefined-vs-zero trap', () => {
  // THE BUG THIS PIN EXISTS FOR, caught while writing the module.
  // PlayerEntity.cs:90-93 declares all four fields zero, so DFU's gate
  // reads `timeForThievesGuildLetter == 0`. Ported literally as
  // `=== 0` against a port entity that carries UNDEFINED, the gate is
  // false and the tally can never advance - the Thieves Guild would
  // have been unreachable in any new game, and reachable only from a
  // classic import that supplied the zeros.
  setCrimeGuildClock(() => NOW);
  const e = fresh();
  for (let i = 0; i < THIEVES_GUILD_TALLY_TARGET; i++) tallyCrimeGuildRequirements(e, true, 1);
  assert.equal(e.thievesGuildRequirementTally, THIEVES_GUILD_TALLY_TARGET);
  // THE LITERAL, not `NOW + CRIME_GUILD_LETTER_DELAY_MINUTES`. The
  // campaign killed the first version of this line: an expectation
  // built from the same constant the code adds moves WITH the constant,
  // so 4320 -> 4321 satisfied it. 4320 classic minutes is three
  // classic days (:1282) and is asserted as itself.
  assert.equal(e.timeForThievesGuildLetter, NOW + 4320,
    'the letter is stamped 4320 classic minutes - three days - out');
  assert.equal(CRIME_GUILD_LETTER_DELAY_MINUTES, 4320);
});

test('CG2: the thresholds are ten thefts and fifteen murders, by DFU\'s weights', () => {
  setCrimeGuildClock(() => NOW);
  // nine thefts is not enough, the tenth arms it
  const t = fresh();
  for (let i = 0; i < 9; i++) tallyCrimeGuildRequirements(t, true, 1);
  assert.equal(t.timeForThievesGuildLetter ?? 0, 0, 'nine thefts, no letter');
  assert.equal(tallyCrimeGuildRequirements(t, true, 1), true, 'the tenth arms it');
  assert.ok(t.timeForThievesGuildLetter > 0);
  // murders: a CIVILIAN is 5 and a GUARD is 1, so three civilians arm
  // the Brotherhood where it takes fifteen watchmen
  const civ = fresh();
  for (let i = 0; i < 3; i++) tallyCrimeGuildRequirements(civ, false, 5);
  assert.equal(civ.darkBrotherhoodRequirementTally, DARK_BROTHERHOOD_TALLY_TARGET);
  assert.ok(civ.timeForDarkBrotherhoodLetter > 0, 'three murdered civilians');
  const watch = fresh();
  for (let i = 0; i < 14; i++) tallyCrimeGuildRequirements(watch, false, 1);
  assert.equal(watch.timeForDarkBrotherhoodLetter ?? 0, 0, 'fourteen dead watchmen is not enough');
  tallyCrimeGuildRequirements(watch, false, 1);
  assert.ok(watch.timeForDarkBrotherhoodLetter > 0, 'the fifteenth is');
  // and the two tallies are INDEPENDENT - a thief is not a murderer
  assert.equal(t.darkBrotherhoodRequirementTally ?? 0, 0);
  assert.equal(civ.thievesGuildRequirementTally ?? 0, 0);
});

test('CG2: a letter in flight FREEZES its tally - the gates are pre-conditions', () => {
  // :1275/:1288 gate the WHOLE block, not just the stamp. Once the
  // clock is set, further crimes of that kind take nothing at all - a
  // player who keeps stealing while waiting neither shortens the wait
  // nor pushes the tally higher, so the threshold can only fire on the
  // crossing.
  setCrimeGuildClock(() => NOW);
  const e = fresh();
  for (let i = 0; i < THIEVES_GUILD_TALLY_TARGET; i++) tallyCrimeGuildRequirements(e, true, 1);
  const stamped = e.timeForThievesGuildLetter;
  setCrimeGuildClock(() => NOW + 999);
  for (let i = 0; i < 20; i++) assert.equal(tallyCrimeGuildRequirements(e, true, 1), false);
  assert.equal(e.thievesGuildRequirementTally, THIEVES_GUILD_TALLY_TARGET, 'the tally is frozen');
  assert.equal(e.timeForThievesGuildLetter, stamped, 'and the clock did not move');
});

test('CG2: InviteSent is permanent - a member never re-arms the letter', () => {
  setCrimeGuildClock(() => NOW);
  // 100 as a LITERAL, for the reason the delay above is: a pin that
  // says `=== INVITE_SENT` against a tally the code set to INVITE_SENT
  // holds for any value at all, and the campaign proved it by moving
  // the constant to 101 unnoticed. PlayerEntity.cs:94 says 100.
  assert.equal(INVITE_SENT, 100);
  const e = { ...fresh(), thievesGuildRequirementTally: 100, timeForThievesGuildLetter: 0 };
  for (let i = 0; i < 50; i++) tallyCrimeGuildRequirements(e, true, 1);
  assert.equal(e.thievesGuildRequirementTally, 100, 'the parked tally never moves');
  assert.equal(e.timeForThievesGuildLetter, 0, 'and no second letter is ever sent');
  // the gate is `!= InviteSent`, NOT `< target` - a tally that
  // overshot the threshold on a weighted crime (5 at a time can land
  // on 17, not 15) is still a live tally, and only the park stops it
  const over = { ...fresh(), darkBrotherhoodRequirementTally: 17, timeForDarkBrotherhoodLetter: 0 };
  tallyCrimeGuildRequirements(over, false, 5);
  assert.equal(over.darkBrotherhoodRequirementTally, 22, 'an overshot tally still accumulates');
});

test('CG2: the letter lands OUTSIDE, when the clock runs down, and starts the quest', () => {
  const started = [];
  const prev = setCrimeGuildQuestHost({ startQuest: (n, f) => started.push([n, f]) });
  try {
    const e = { ...fresh(), thievesGuildRequirementTally: 10, timeForThievesGuildLetter: NOW };
    // not yet: the clock is strictly `<`, so equal is not elapsed
    assert.deepEqual(handleStartingCrimeGuildQuests(e, { nowClassicMinutes: NOW, inside: false }), []);
    assert.equal(e.thievesGuildRequirementTally, 10, 'and nothing was parked');
    // elapsed, but INSIDE - the letter waits at the door
    assert.deepEqual(handleStartingCrimeGuildQuests(e, { nowClassicMinutes: NOW + 1, inside: true }), []);
    assert.equal(e.timeForThievesGuildLetter, NOW, 'the pending clock is untouched underground');
    // elapsed and outside: it fires, ONCE
    assert.deepEqual(handleStartingCrimeGuildQuests(e, { nowClassicMinutes: NOW + 1, inside: false }),
      [THIEVES_GUILD_INITIATION_QUEST]);
    assert.deepEqual(started, [[THIEVES_GUILD_INITIATION_QUEST, THIEVES_GUILD_FACTION_ID]],
      'the quest is started under the faction that sent the letter');
    assert.equal(e.thievesGuildRequirementTally, INVITE_SENT);
    assert.equal(e.timeForThievesGuildLetter, 0);
    assert.deepEqual(handleStartingCrimeGuildQuests(e, { nowClassicMinutes: NOW + 9999, inside: false }), [],
      'and never again');
    // THE DEFAULT ARM, which no other assertion here exercises - the
    // campaign flipped `inside = false` to `inside = true` and every
    // pin passed, because all of them pass `inside` explicitly. DFU's
    // gate is `!IsPlayerInside`, so an OMITTED caller means outside and
    // the letter may land.
    const d0 = { ...fresh(), thievesGuildRequirementTally: 10, timeForThievesGuildLetter: NOW };
    assert.deepEqual(handleStartingCrimeGuildQuests(d0, { nowClassicMinutes: NOW + 1 }),
      [THIEVES_GUILD_INITIATION_QUEST], 'omitting `inside` means OUTSIDE, as !IsPlayerInside does');
    // the Brotherhood's own arm, and its own quest
    const d = { ...fresh(), darkBrotherhoodRequirementTally: 15, timeForDarkBrotherhoodLetter: NOW };
    assert.deepEqual(handleStartingCrimeGuildQuests(d, { nowClassicMinutes: NOW + 1, inside: false }),
      [DARK_BROTHERHOOD_INITIATION_QUEST]);
    // found by NAME rather than by position: an earlier arm in this
    // test starts a second Thieves Guild quest, and an assertion on
    // started[1] silently became one about the wrong guild when it did.
    const db = started.find(([n]) => n === DARK_BROTHERHOOD_INITIATION_QUEST);
    assert.ok(db, 'the Brotherhood quest was started');
    assert.equal(db[1], DARK_BROTHERHOOD_FACTION_ID, 'under the Brotherhood, not the Thieves Guild');
  } finally { setCrimeGuildQuestHost(prev); }
});

test('CG2: with NO quest host the letter stays pending - the three effects are atomic', () => {
  // DFU parks the tally, clears the clock and starts the quest as one
  // act. A port that did the first two with no quest machine mounted
  // would mark the player permanently invited to a guild whose
  // initiation never ran - strictly worse than waiting. So an unwired
  // host changes NOTHING and the letter keeps until one can honour it.
  const prev = setCrimeGuildQuestHost(null);
  try {
    const e = { ...fresh(), thievesGuildRequirementTally: 10, timeForThievesGuildLetter: NOW };
    assert.deepEqual(handleStartingCrimeGuildQuests(e, { nowClassicMinutes: NOW + 5000, inside: false }), []);
    assert.equal(e.thievesGuildRequirementTally, 10, 'NOT parked at InviteSent');
    assert.equal(e.timeForThievesGuildLetter, NOW, 'and the letter is still pending');
  } finally { setCrimeGuildQuestHost(prev); }
});

test('CG2: with no clock the tally is INERT rather than stamping at time zero', () => {
  // A letter stamped from a null clock would land at minute 4320 -
  // three days into the epoch, already elapsed - and fire the instant
  // the player stepped outside. Refusing is the honest answer.
  const prev = setCrimeGuildClock(null);
  try {
    const e = fresh();
    for (let i = 0; i < 20; i++) assert.equal(tallyCrimeGuildRequirements(e, true, 1), false);
    assert.deepEqual(e, {}, 'nothing was written at all');
  } finally { setCrimeGuildClock(prev); }
});

test('CG2: the faction ids have ONE home, and court.js re-exports it', () => {
  // crimeGuilds.js is a LEAF because talk.js needs it for the
  // pickpocket tally and talk.js cannot import court.js (court.js
  // imports talk.js - its own pickpocket comment says so). So the
  // declarations moved here and court.js re-exports them; a second
  // declaration would trip the one-home ratchet and let the two drift.
  assert.equal(THIEVES_GUILD_FACTION_ID, 42);
  assert.equal(DARK_BROTHERHOOD_FACTION_ID, 108);
  assert.equal(COURT_TG, THIEVES_GUILD_FACTION_ID, 'court.js answers the same object');
  const court = readFileSync(join(HERE, '..', 'src', 'systems', 'court.js'), 'utf8');
  assert.equal(/^export const THIEVES_GUILD_FACTION_ID/m.test(court), false,
    'court.js must RE-EXPORT the id, never declare a second one');
});

test('CG2: every live crime site tallies, with DFU\'s own weight', () => {
  // THE SOURCE SWEEP. The law is only real where a crime calls it, and
  // the four sites are in four different files - a fifth crime landing
  // without the call is exactly how this goes half-ported again.
  const read = (rel) => readFileSync(join(HERE, '..', 'src', rel), 'utf8');
  const guards = read('scenes/cityGuards.js');
  assert.match(guards, /tallyCrimeGuildRequirements\(playerEntity, false, 1\)/,
    'a killed watchman is worth ONE to the Dark Brotherhood (EntityBehaviour:267)');
  assert.match(guards, /tallyCrimeGuildRequirements\(playerEntity, false, 5\)/,
    'a murdered civilian is worth FIVE (WeaponManager:510)');
  assert.match(read('systems/talk.js'), /tallyCrimeGuildRequirements\(player, true, 1\)/,
    'a pinched purse counts one theft (PlayerActivate:1641)');
  assert.match(read('scenes/worldModes.js'), /tallyCrimeGuildRequirements\(playerEntity, true, 1\)/,
    'a picked exterior lock counts one break-in (PlayerActivate:552)');
  // ...and the tick runs the delivery, at DFU's own position in it
  const tick = read('systems/worldTick.js');
  assert.match(tick, /handleStartingCrimeGuildQuests\(entity, \{/);
  assert.ok(tick.indexOf('preventNormalizingReputations = false') < tick.indexOf('handleStartingCrimeGuildQuests('),
    'PlayerEntity.Update calls it at :531, below the prevent-flag resets at :528-530');
});

test('CG2: the four fields survive a save - a tally nobody persists never reaches ten', () => {
  // AUDIT 18 F3's lesson, which cost the port its whole legal standing
  // once already: nobody steals ten times in one sitting, so a tally
  // that resets on load makes the guild unreachable by any player who
  // saves. SerializablePlayer.cs:144-147 writes all four in the same
  // player block as crimeCommitted, and so does this port.
  const save = readFileSync(join(HERE, '..', 'src', 'systems', 'save.js'), 'utf8');
  for (const f of ['thievesGuildRequirementTally', 'darkBrotherhoodRequirementTally',
    'timeForThievesGuildLetter', 'timeForDarkBrotherhoodLetter']) {
    assert.match(save, new RegExp(`snap\\.${f} = entity\\.${f} \\?\\? 0`), `${f} is written`);
    assert.match(save, new RegExp(`entity\\.${f} = snap\\.${f} \\?\\? 0`), `${f} is restored`);
  }
});
