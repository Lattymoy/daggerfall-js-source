// TP1 - THE FAST-TRAVEL GUILD DISCOUNT + RAISESKILLS ON ARRIVAL
// (2026-08-29).
//
// travelPopUp.js flagged four things as "idling loudly". Two of them
// were not idling on anything any more:
//
//   GuildManager.FastTravel (:284) - "no guild perk seam". The seam is
//     activeMemberships, which G2 shipped, and the perk is one guild's:
//     Temple.FastTravel (Temple.cs:430-436) returns
//     `(int)(((95f - rank) / 100) * duration)` for AKATOSH, god of
//     time, and Guild.FastTravel is the identity for everyone else
//     (:241-244). GuildManager folds every membership through it.
//   RaiseSkills on arrival (:380). AUDIT 23 established that
//     PlayerEntity.Update runs NO advancement and that DFU calls
//     RaiseSkills from exactly two window-closings - rest, which
//     shipped, and this one. shared.js's own doc named this site as
//     "the other site, unported".
//
// The discount lands BETWEEN CalculateTravelTime and CalculateTripCost
// (:281-296), so Akatosh's blessing cuts the FARE as well as the days.
// That ordering is the whole reason the port's flag sat on the line it
// did, and it is the first pin below.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { guildFastTravel, templeOf, AKATOSH_DIVINE } from '../src/systems/guildVariants.js';

const HERE = dirname(fileURLToPath(import.meta.url));
/** The membership book shape activeMemberships answers: keyed by
 *  guildGroup, each `{ guild: <name>, rank }`. */
const book = (guild, rank) => ({ HolyOrder: { guild, rank } });

test('TP1: only AKATOSH shortens a journey - every other guild is the identity', () => {
  const akatosh = templeOf(AKATOSH_DIVINE).name;
  assert.equal(akatosh, 'Temple:Akatosh', 'the name comes from the Temple, not a literal here');
  // Guild.FastTravel is `return duration` (:241-244), so a member of
  // anything else travels at full length - pinned on a temple, because
  // the wrong fix is "any HolyOrder membership discounts".
  assert.equal(guildFastTravel(null, 1000, { memberships: book('Temple:Arkay', 9) }), 1000);
  assert.equal(guildFastTravel(null, 1000, { memberships: book('Temple:Julianos', 9) }), 1000);
  assert.equal(guildFastTravel(null, 1000, { memberships: {} }), 1000, 'and a guildless traveller too');
  assert.equal(guildFastTravel(null, 1000, { memberships: book(akatosh, 0) }), 950);
});

test('TP1: the discount is (95 - rank)% and TRUNCATES, per rank', () => {
  const akatosh = templeOf(AKATOSH_DIVINE).name;
  // rank 0 travels in 95%, rank 9 in 86% - the literals, not a
  // re-derivation of the formula the code runs.
  assert.equal(guildFastTravel(null, 1000, { memberships: book(akatosh, 0) }), 950);
  assert.equal(guildFastTravel(null, 1000, { memberships: book(akatosh, 5) }), 900);
  assert.equal(guildFastTravel(null, 1000, { memberships: book(akatosh, 9) }), 860);
  // C#'s (int) cast truncates toward zero and the divide is a FLOAT
  // divide (`95f`), so 7 minutes at rank 0 is 6.65 -> 6, not 7.
  assert.equal(guildFastTravel(null, 7, { memberships: book(akatosh, 0) }), 6,
    '6.65 minutes truncates to 6 - rounding would give 7');
  assert.equal(guildFastTravel(null, 3, { memberships: book(akatosh, 0) }), 2, '2.85 -> 2');
  // a missing rank is rank 0, not NaN
  assert.equal(guildFastTravel(null, 1000, { memberships: { HolyOrder: { guild: akatosh } } }), 950);
});

test('TP1: it is a FOLD over memberships, as GuildManager.FastTravel is', () => {
  // GuildManager walks Memberships.Values and threads the duration
  // through each (:380-386). Written as the fold rather than a lookup
  // for Akatosh, so the day a second guild gains the perk it slots in
  // - and so a player in two guilds gets both, which a lookup cannot.
  const akatosh = templeOf(AKATOSH_DIVINE).name;
  const two = { HolyOrder: { guild: akatosh, rank: 0 }, FightersGuild: { guild: 'Fighters Guild', rank: 9 } };
  assert.equal(guildFastTravel(null, 1000, { memberships: two }), 950,
    'the non-perk guild threads the value through unchanged');
  const src = readFileSync(join(HERE, '..', 'src', 'systems', 'guildVariants.js'), 'utf8');
  const body = src.slice(src.indexOf('export function guildFastTravel'));
  const fn = body.slice(0, body.indexOf('\n}'));
  assert.match(fn, /for \(const m of Object\.values\(book \?\? \{\}\)\)/,
    'the shape is a walk over every membership, not a single lookup');
  // ...and it may not stop early. THE CAMPAIGN FOUND THIS ONE and it
  // is worth being exact about: adding `break` after the discount
  // SURVIVED every behavioural arm, and it always will, because only
  // one guild in the game has the perk and all eight temples share the
  // HolyOrder slot - so no reachable membership book has two. The
  // mutant is behaviourally EQUIVALENT under real data. What it breaks
  // is the contract GuildManager.FastTravel states (:380-386: thread
  // the duration through EVERY membership), which is what the second
  // guild would need on the day one gains a perk. So the pin guards
  // the contract explicitly rather than pretending an observable
  // exists.
  assert.equal(/\bbreak\b/.test(fn), false,
    'the fold threads through every membership - it must not stop at the first perk');
  assert.equal(/\breturn\b/.test(fn.slice(0, fn.lastIndexOf('return'))), false,
    'and there is exactly one return, at the end');
});

test('TP1: the discount is applied BEFORE the trip cost - it cuts the fare too', () => {
  // DaggerfallTravelPopUp.cs:281-296 orders CalculateTravelTime,
  // FastTravel, CalculateTripCost. Applying the discount after the
  // cost would leave a member of Akatosh's temple paying the full fare
  // for a shorter trip, which is the plausible wrong wiring and the
  // reason the flag sat exactly where it did.
  const src = readFileSync(join(HERE, '..', 'src', 'ui', 'travelPopUp.js'), 'utf8');
  const discount = src.indexOf('guildFastTravel(');
  const cost = src.indexOf('calculateTripCost(');
  assert.ok(discount > 0 && cost > 0, 'both calls are present');
  assert.ok(discount < cost,
    'the guild discount must land between CalculateTravelTime and CalculateTripCost');
});

test('TP1: RaiseSkills has ONE home and fast travel calls it after the clamp', () => {
  const shared = readFileSync(join(HERE, '..', 'src', 'scenes', 'shared.js'), 'utf8');
  assert.match(shared, /export function raisePlayerSkills\(/,
    'named for DFU\'s member, since rest and travel both call it');
  assert.equal(/export function raiseAtRestEnd\(/.test(shared), false,
    'the rest-only name is gone - it became a small lie the moment travel used it');
  const world = readFileSync(join(HERE, '..', 'src', 'scenes', 'world.js'), 'utf8');
  const clamp = world.indexOf('if (clamp > 0) playerTicker.advance(clamp)');
  // matched with its LINE START and indentation, not as a bare
  // substring: the campaign wrapped the call in `if (false)` and a
  // substring test still found the text, which is PY1's lesson in
  // another costume - a pin that greps for a call does not test that
  // the call runs.
  assert.match(world, /\n      raisePlayerSkills\(playerEntity, \{/,
    'the raise is an unconditional statement, not a call sitting inside a disabled branch');
  const raise = world.indexOf('\n      raisePlayerSkills(playerEntity, {');
  assert.ok(clamp > 0 && raise > clamp,
    'RaiseSkills fires AFTER the arrival clamp (:380 is performFastTravel\'s tail), so a trip\n'
    + 'landing at 7:10am raises against the arrival minute rather than the departure one');
});

test('TP1: the two closed flags are gone from the popup header', () => {
  const src = readFileSync(join(HERE, '..', 'src', 'ui', 'travelPopUp.js'), 'utf8');
  // EF1c's rule: ban the claim as an assertion, not as a quotation.
  const unquoted = src.replace(/"[^"]*"/g, '""');
  for (const dead of [/no guild perk seam/, /RaiseSkills on arrival \(:380\), and/]) {
    assert.equal(dead.test(unquoted), false, `a retired blocker still reads as current: ${dead}`);
  }
  // ...and the two that genuinely DO still idle are still named, so
  // this slice cannot be read as having closed the whole row.
  assert.match(src, /smash-to-black\/fade/, 'the fade layer really is absent');
  assert.match(src, /key-UP deferral/, 'and the overlay seam really has no key-up edge');
});
