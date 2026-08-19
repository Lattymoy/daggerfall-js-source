// The faction reputation store against DFU's PersistentFactionData.
// The propagation law needs CONTROLLED trees to pin (the real
// FACTION.TXT has no faction that isolates, say, "root is God but the
// origin is not"), so most of these run on synthetic dicts - and the
// first test pins that a synthetic record carries exactly the field
// set the real reader mints, so a hand-built fixture cannot drift into
// a shape nothing in the game produces.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { FactionFile, GUILD_GROUPS, FACTION_TYPES } from '../src/formats/factionFile.js';
import { changeLegalRep } from '../src/systems/court.js';
import {
  createFactionRep, attachFactionRep, getReputation, setReputation, changeReputation,
  propagateReputationChange, zeroAllReputations, getFlag, setFlag, changePower,
  MIN_REPUTATION, MAX_REPUTATION, MIN_POWER, MAX_POWER, FACTION_FLAGS,
  THE_DARK_BROTHERHOOD, GENERIC_TEMPLE, GENERIC_KNIGHTLY_ORDER, QUESTOR_IDS,
} from '../src/systems/factionRep.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;
const realFactions = () => {
  const ff = new FactionFile();
  ff.load(readFileSync(join(ARENA2, 'FACTION.TXT')));
  return ff.factionDict;
};

// A synthetic faction carrying every field the reader mints.
const FIELDS = ['id', 'parent', 'type', 'name', 'rep', 'summon', 'region', 'power', 'flags',
  'ruler', 'ally1', 'ally2', 'ally3', 'enemy1', 'enemy2', 'enemy3', 'face', 'race',
  'flat1', 'flat2', 'sgroup', 'ggroup', 'minf', 'maxf', 'vam', 'rank',
  'rulerNameSeed', 'rulerPowerBonus', 'children'];
const fac = (o) => {
  const base = {};
  for (const k of FIELDS) base[k] = (k === 'name' ? 'f' + o.id : k === 'children' ? null : 0);
  return Object.assign(base, o);
};
const dictOf = (...list) => new Map(list.map((f) => [f.id, f]));

test('factions: a synthetic record carries the shape the real reader mints', { skip: skipReal }, () => {
  // TEST THE SHAPE THE PRODUCER MINTS. Every pin below builds its tree
  // by hand; this is what stops those trees describing a record the
  // game never makes.
  const real = realFactions().get(THE_DARK_BROTHERHOOD);
  assert.deepEqual(Object.keys(fac({ id: 1 })).sort(), Object.keys(real).sort());
});

test('factions: the store CLONES - a reputation change cannot reach the reader', { skip: skipReal }, () => {
  // DFU can assign the reader's dictionary straight across because
  // FactionData is a C# STRUCT. JS objects are references, so the port
  // clones; without it one character's crimes would follow the next
  // character into a fresh game.
  const dict = realFactions();
  const store = createFactionRep(dict);
  setReputation(store, THE_DARK_BROTHERHOOD, 42);
  assert.equal(getReputation(store, THE_DARK_BROTHERHOOD), 42);
  assert.equal(dict.get(THE_DARK_BROTHERHOOD).rep, 0, 'the reader must be untouched');
});

test('factions: an unknown faction reads 0 and refuses every write', () => {
  const store = createFactionRep(dictOf(fac({ id: 1 })));
  assert.equal(getReputation(store, 9999), 0);
  assert.equal(setReputation(store, 9999, 50), false);
  assert.equal(changeReputation(store, 9999, 50), false);
  assert.equal(changeReputation(store, 9999, 50, true), false);
  assert.equal(getFlag(store, 9999, FACTION_FLAGS.Summoned), false);
  assert.equal(setFlag(store, 9999, FACTION_FLAGS.Summoned), false);
  assert.equal(changePower(store, 9999, 5), false);
});

test('factions: reputation clamps to -100..100 and power to 1..100', () => {
  // DFU's LITERALS, not the port's constants. Asserting against
  // MIN_POWER would let a one-character mutation of that constant move
  // the expectation with it - a vacuous pin, and this one WAS vacuous
  // until a mutation run caught it surviving MIN_POWER = 0.
  assert.equal(MIN_REPUTATION, -100);
  assert.equal(MAX_REPUTATION, 100);
  assert.equal(MIN_POWER, 1);
  assert.equal(MAX_POWER, 100);

  const store = createFactionRep(dictOf(fac({ id: 1, power: 50 })));
  setReputation(store, 1, 5000);
  assert.equal(getReputation(store, 1), 100);
  setReputation(store, 1, -5000);
  assert.equal(getReputation(store, 1), -100);
  changeReputation(store, 1, 50);
  assert.equal(getReputation(store, 1), -50, 'a change adds to the CLAMPED value');
  changePower(store, 1, -5000);
  assert.equal(store.dict.get(1).power, 1, 'power floors at 1, not 0');
  changePower(store, 1, 5000);
  assert.equal(store.dict.get(1).power, 100);
});

test('factions: allies take +half and enemies -half, and do NOT fan out again', () => {
  const store = createFactionRep(dictOf(
    fac({ id: 1, parent: 0, ally1: 2, enemy1: 3 }),
    fac({ id: 2, parent: 0, ally1: 4 }),   // ally-of-ally must stay untouched
    fac({ id: 3, parent: 0 }),
    fac({ id: 4, parent: 0 }),
  ));
  changeReputation(store, 1, 10, true);
  assert.equal(getReputation(store, 1), 10, 'the faction itself takes the full amount');
  assert.equal(getReputation(store, 2), 5, 'ally takes +half');
  assert.equal(getReputation(store, 3), -5, 'enemy takes -half');
  assert.equal(getReputation(store, 4), 0, 'the ally-of-an-ally is never reached');
});

test('factions: halving truncates TOWARD ZERO, the C# int-division quirk', () => {
  // Math.floor(-5 / 2) is -3; C# gives -2. Every negative half-delta
  // rides on this - a crime penalty, an enemy's share of a reward.
  const mk = () => createFactionRep(dictOf(
    fac({ id: 1, parent: 0, ally1: 2, enemy1: 3 }),
    fac({ id: 2, parent: 0 }),
    fac({ id: 3, parent: 0 }),
  ));
  const neg = mk();
  changeReputation(neg, 1, -5, true);
  assert.equal(getReputation(neg, 2), -2, 'ally of a -5: trunc(-5/2) = -2, not floor -3');
  assert.equal(getReputation(neg, 3), 2, 'enemy of a -5: trunc(5/2) = 2');
  const pos = mk();
  changeReputation(pos, 1, 5, true);
  assert.equal(getReputation(pos, 2), 2);
  assert.equal(getReputation(pos, 3), -2);
});

test('factions: the Dark Brotherhood is its own root although it has a parent', () => {
  // The walk tests the CURRENT node's id before each step up, so 108
  // stops immediately even though parent 356 exists.
  const store = createFactionRep(dictOf(
    fac({ id: 356, parent: 0, children: [THE_DARK_BROTHERHOOD] }),
    fac({ id: THE_DARK_BROTHERHOOD, parent: 356, children: [807] }),
    fac({ id: 807, parent: THE_DARK_BROTHERHOOD }),   // DB_Quests, a questor
  ));
  changeReputation(store, THE_DARK_BROTHERHOOD, 10, true);
  assert.equal(getReputation(store, 356), 0, 'the walk never reached the parent');
  assert.equal(getReputation(store, THE_DARK_BROTHERHOOD), 10);
});

test('factions: a knightly order pays itself flat and Generic Knightly Order propagating', () => {
  const store = createFactionRep(dictOf(
    fac({ id: 1, parent: 0, ggroup: GUILD_GROUPS.KnightlyOrder }),
    fac({ id: GENERIC_KNIGHTLY_ORDER, parent: 0, children: [900] }),
    fac({ id: 900, parent: GENERIC_KNIGHTLY_ORDER }),
  ));
  changeReputation(store, 1, 10, true);
  assert.equal(getReputation(store, 1), 10, 'the order itself, flat');
  assert.equal(getReputation(store, GENERIC_KNIGHTLY_ORDER), 10, 'root parent takes full');
  assert.equal(getReputation(store, 900), 5, 'the generic children DFU adds back take half');
});

test('factions: the God test reads the ROOT type, not the faction the change started at', () => {
  // The subtle one. A knight of a god's order is not itself type God;
  // the temple hop fires anyway, because the walk reassigns the local
  // before the test.
  const store = createFactionRep(dictOf(
    fac({ id: 21, parent: 0, type: FACTION_TYPES.God, children: [82] }),
    fac({ id: 82, parent: 21, type: 2 }),           // an order OF that god
    fac({ id: GENERIC_TEMPLE, parent: 0, type: 9 }),
  ));
  changeReputation(store, 82, 10, true);
  assert.ok(getReputation(store, GENERIC_TEMPLE) !== 0,
    'a non-God faction under a God root still reaches Generic Temple');

  const noGod = createFactionRep(dictOf(
    fac({ id: 21, parent: 0, type: 2, children: [82] }),
    fac({ id: 82, parent: 21, type: 2 }),
    fac({ id: GENERIC_TEMPLE, parent: 0, type: 9 }),
  ));
  changeReputation(noGod, 82, 10, true);
  assert.equal(getReputation(noGod, GENERIC_TEMPLE), 0, 'and does not when the root is not God');
});

test('factions: inside a hierarchy the origin, a root parent and a QUESTOR take full, siblings half', () => {
  const store = createFactionRep(dictOf(
    fac({ id: 500, parent: 0, children: [63, 501, 502] }),
    fac({ id: 63, parent: 500 }),    // MG_Quests - a questor
    fac({ id: 501, parent: 500 }),   // a plain sibling
    fac({ id: 502, parent: 500 }),   // the origin
  ));
  propagateReputationChange(store, store.dict.get(500), 502, 10);
  assert.equal(getReputation(store, 500), 10, 'a root parent (parent === 0) takes full');
  assert.equal(getReputation(store, 63), 10, 'the questor takes full');
  assert.equal(getReputation(store, 502), 10, 'the faction the change started at takes full');
  assert.equal(getReputation(store, 501), 5, 'every other node takes half');
  assert.ok(QUESTOR_IDS.has(63) && QUESTOR_IDS.size === 6, 'the six guild questors');
});

test('factions: zeroing restores FACTION.TXT values, it does not blank them', { skip: skipReal }, () => {
  // ZeroAllReputations calls Reset(), so a faction whose FILE value is
  // non-zero comes back to that value rather than to 0.
  const dict = realFactions();
  const seeded = [...dict.values()].find((f) => f.rep !== 0);
  const store = createFactionRep(dict);
  setReputation(store, THE_DARK_BROTHERHOOD, 77);
  // TEST THE SHAPE THE PRODUCER MINTS - and this pin did not, at
  // first. It hand-built { regionData: [{legalRep}] }, DFU's field
  // name, which nothing in the port produces; it passed against an
  // implementation reading the same wrong field, and a live probe
  // caught the pair. The shape is whatever court.js MINTS, so let
  // court.js mint it.
  const player = {};
  changeLegalRep(player, 17, -30);
  changeLegalRep(player, 3, 5);
  zeroAllReputations(store, dict, player);
  assert.equal(getReputation(store, THE_DARK_BROTHERHOOD), 0);
  assert.deepEqual(player.legalRep, { 17: 0, 3: 0 });
  if (seeded) {
    assert.equal(getReputation(store, seeded.id), seeded.rep,
      'a faction seeded non-zero in FACTION.TXT returns to its FILE value');
  }
});

test('factions: flags OR on and read back; DFU never clears one', () => {
  const store = createFactionRep(dictOf(fac({ id: 1, flags: 0 })));
  assert.equal(getFlag(store, 1, FACTION_FLAGS.Summoned), false);
  assert.equal(setFlag(store, 1, FACTION_FLAGS.Summoned), true);
  assert.equal(getFlag(store, 1, FACTION_FLAGS.Summoned), true);
  assert.equal(getFlag(store, 1, FACTION_FLAGS.RulerImmune), false, 'OR touched only its own bit');
  setFlag(store, 1, FACTION_FLAGS.RulerImmune);
  assert.equal(store.dict.get(1).flags, FACTION_FLAGS.Summoned | FACTION_FLAGS.RulerImmune);
});

test('factions: propagation TERMINATES on the real FACTION.TXT, bounded', { skip: skipReal }, () => {
  // DFU has no cycle guard, and the propagate branch re-enters itself
  // with propagate=true twice (Generic Temple, Generic Knightly
  // Order). It terminates only because 450's type is 9 rather than God
  // and 844's ggroup is 17 rather than KnightlyOrder. That is a fact
  // about the DATA, so it is pinned against the data - and bounded, so
  // a mutation that breaks it fails the assert instead of hanging the
  // suite.
  const dict = realFactions();
  assert.equal(dict.get(GENERIC_TEMPLE).type, 9,
    'Generic Temple is NOT type God - if it were, the temple hop would recurse forever');
  assert.notEqual(dict.get(GENERIC_KNIGHTLY_ORDER).ggroup, GUILD_GROUPS.KnightlyOrder,
    'Generic Knightly Order is NOT ggroup KnightlyOrder - if it were, that branch would recurse forever');

  // Every faction, propagating, in one run. 366 walks that each touch
  // a bounded slice of the tree; if any recursed the process would not
  // return at all, so arriving here at all is half the pin.
  const store = createFactionRep(dict);
  for (const id of dict.keys()) changeReputation(store, id, 4, true);
  let moved = 0;
  for (const f of store.dict.values()) if (f.rep !== 0) moved++;
  assert.ok(moved > 200, `a full propagating sweep moves most of the tree (moved ${moved})`);
  for (const f of store.dict.values()) {
    assert.ok(f.rep >= MIN_REPUTATION && f.rep <= MAX_REPUTATION,
      `${f.id} ${f.name} stayed inside the clamp`);
  }
});


test('factions: attaching drains the biography deltas, PROPAGATING, exactly once', () => {
  // BiogFile.cs:339 is ChangeReputation(id, amount, TRUE) - a backstory
  // that makes you a friend of a guild makes you a friend of its
  // allies too. biography.js parks these because it runs before
  // FACTION.TXT is in hand; this is the only place they land.
  const dict = dictOf(
    fac({ id: 1, parent: 0, ally1: 2, enemy1: 3 }),
    fac({ id: 2, parent: 0 }),
    fac({ id: 3, parent: 0 }),
  );
  const entity = { pendingFactionRep: [{ id: 1, amount: 20 }] };
  const store = attachFactionRep(entity, dict);
  assert.equal(entity.factionRep, store, 'the store lands on the entity');
  assert.equal(getReputation(store, 1), 20);
  assert.equal(getReputation(store, 2), 10, 'the ally moved - the drain PROPAGATES');
  assert.equal(getReputation(store, 3), -10, 'and the enemy moved the other way');
  assert.deepEqual(entity.pendingFactionRep, [], 'the parked list is cleared');

  // idempotent: attaching again cannot re-apply a backstory
  const again = attachFactionRep(entity, dict);
  assert.equal(getReputation(again, 1), 0, 'a fresh store, and nothing left to drain');
});

test('factions: attaching without a faction file leaves the deltas parked', () => {
  // FACTION.TXT is loaded tolerantly at the chargen seam. A missing
  // file must degrade - the backstory stays pending - not throw
  // halfway through building a character.
  const entity = { pendingFactionRep: [{ id: 1, amount: 20 }] };
  assert.equal(attachFactionRep(entity, null), null);
  assert.equal(entity.factionRep, undefined);
  assert.deepEqual(entity.pendingFactionRep, [{ id: 1, amount: 20 }], 'still parked, not lost');
});


test('factions: AUDIT 20 - the clone detaches the CHILDREN array too', { skip: skipReal }, () => {
  // The spread detaches the record; children is an array and stayed
  // shared, so the store could mutate the reader's own hierarchy - the
  // header promised a clone that was only one level deep.
  const dict = realFactions();
  const store = createFactionRep(dict);
  const a = store.dict.get(THE_DARK_BROTHERHOOD), b = dict.get(THE_DARK_BROTHERHOOD);
  assert.notEqual(a.children, b.children, 'a different array');
  assert.deepEqual(a.children, b.children, 'with the same contents');
  a.children.push(999999);
  assert.equal(b.children.includes(999999), false, 'the reader is untouched');
});

test('factions: AUDIT 20 - zeroing REFILLS the map, it does not rebind it', { skip: skipReal }, () => {
  // court.js reads store.dict on every crime. Rebinding strands any
  // caller that captured it.
  const dict = realFactions();
  const store = createFactionRep(dict);
  const captured = store.dict;
  setReputation(store, THE_DARK_BROTHERHOOD, 50);
  zeroAllReputations(store, dict, {});
  assert.equal(captured, store.dict, 'the same Map object');
  assert.equal(getReputation(store, THE_DARK_BROTHERHOOD), 0);
  assert.equal(captured.get(THE_DARK_BROTHERHOOD).rep, 0, 'and the captured reference sees it');
});
