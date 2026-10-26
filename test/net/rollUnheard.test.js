// THE GUILD STANDING RESET (FIELD BUGS 2026-10-25: "Guild standing dropped from 100 brotherhood and mages 98 because i
// logged into the browser not exe"; "all quests are gone and standings reset"): a page whose Roll never answered earned
// standing that the next page dropped whole, once the Roll had moved past the adoption its save kept.
//
// The real tracker through the real door to the real service (test/accountDb.mjs): one page claims after its last save
// landed, a second page never hears the Roll and earns standing, and a third page joins on that save.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ROLL_CLAIM_MS, rollKeptOf, rollUnheardOf } from '../../src/net/npcChapterLaw.js';
import { createRollTracker, rollStopText, sayRollStop, ROLL_STOPPED_TEXT, ROLL_STOPS } from '../../src/net/npcRollTracker.js';
import { accountRoll, SESSION_KEY, accountRefusalText } from '../../src/net/accountClient.js';
import { standService, sessionStorageOf } from '../accountDb.mjs';
import { seatRealm } from '../realmSeat.mjs';

const MAGES = 40;
const OTHER = 41;

async function stand() {
  const svc = await standService({ CHAPTERS_OPEN: 'on' });
  const who = await svc.registered('Audra');
  const realm = await seatRealm(svc.env, who.secret, 'Audra');
  const raw = svc.env.DB._raw;
  const rollRep = (faction) => raw.prepare('SELECT rep FROM npc_roll WHERE char_id = ? AND faction_id = ?').get(realm.id, faction)?.rep;
  const io = accountRoll({ fetch: svc.fetch, storage: sessionStorageOf(SESSION_KEY, who) });
  return { svc, realm, rollRep, io };
}

/**
 * One page of the character: its standing as the save loaded it, the save's kept record, and the tracker over both.
 * `save()` is the save the page would compose now.
 */
function page(world, io, loaded) {
  let clock = 1_000_000;
  const held = { ...loaded.held };
  let kept = loaded.kept;
  const stops = [];
  const tracker = createRollTracker({
    io,
    character: () => world.realm.id,
    lease: () => world.realm.lease,
    read: () => ({ ...held }),
    write: (values) => Object.assign(held, values),
    members: () => [],
    kept: () => kept,
    keep: (record) => { kept = record; },
    now: () => clock,
    onStop: (error) => stops.push(error),
  });
  const settle = async () => {
    for (let i = 0; i < 20; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  };
  const tick = async () => {
    tracker.tick();
    await settle();
  };
  const later = async (ms) => {
    clock += ms;
    await tick();
  };
  const save = () => ({ held: { ...held }, kept: rollKeptOf(JSON.parse(JSON.stringify(kept))) });
  return { tracker, held, stops, tick, later, save };
}

/** A Roll door that refuses every ask the way a stopped Roll does. */
const refusingDoor = (error) => ({
  read: async () => ({ ok: false, error }),
  claim: async () => ({ ok: false, error }),
});

test('a page that never heard the Roll keeps what it earned when the Roll moved past its save - and a page that loads the same save again claims it once', async () => {
  const world = await stand();

  // the first page seeds the Roll at 10 and its save lands; then it earns 4, claims them, and closes before its next save
  const first = page(world, world.io, { held: { [MAGES]: 10, [OTHER]: 0 }, kept: null });
  await first.tick();
  const landed = first.save();
  assert.equal(landed.kept.seq, 0);
  first.held[MAGES] += 4;
  await first.later(ROLL_CLAIM_MS);
  assert.equal(world.rollRep(MAGES), 14, 'the claim the save never saw');

  // the second page plays that save with the Roll silent (stopped at its first read), and earns 6
  const silent = page(world, refusingDoor('auth'), landed);
  await silent.tick();
  assert.deepEqual(silent.stops, ['auth']);
  silent.held[MAGES] += 6;
  const silentSave = silent.save();
  assert.deepEqual(silentSave.kept.unheard?.start, { [MAGES]: 10, [OTHER]: 0 }, 'the save says where the silent page began');

  // the third page joins on the silent page's save: the Roll stands past the save's adoption
  const next = page(world, world.io, silentSave);
  await next.tick();
  assert.equal(next.held[MAGES], 20, 'the Roll\'s 14 and the silent page\'s 6');
  await next.tick();
  assert.equal(world.rollRep(MAGES), 20, 'and the 6 claimed');
  assert.equal(next.held[MAGES], 20);
  assert.equal(next.save().kept.unheard, undefined, 'a page that heard the Roll drops the mark');

  // the third page closed before its own save landed: a fourth joins on the silent page's save again
  const again = page(world, world.io, silentSave);
  await again.tick();
  await again.tick();
  assert.equal(world.rollRep(MAGES), 20, 'the same claim, answered as a repeat - never credited twice');
  assert.equal(again.held[MAGES], 20);
});

test('a page that never heard the Roll on a save the Roll still stands at claims what the save holds past the adoption, under the save\'s own claim id', async () => {
  const world = await stand();
  const first = page(world, world.io, { held: { [MAGES]: 10, [OTHER]: 0 }, kept: null });
  await first.tick();
  const landed = first.save();

  const silent = page(world, refusingDoor('no-session'), landed);
  await silent.tick();
  silent.held[MAGES] += 5;
  const silentSave = silent.save();

  const next = page(world, world.io, silentSave);
  await next.tick();
  assert.equal(next.held[MAGES], 15);
  await next.tick();
  assert.equal(world.rollRep(MAGES), 15);

  // the next page closed before its save landed; the Roll moved past the save's adoption by that page's claim alone
  const again = page(world, world.io, silentSave);
  await again.tick();
  await again.tick();
  assert.equal(world.rollRep(MAGES), 15, 'the claim id the save carries makes it the same claim');
  assert.equal(again.held[MAGES], 15);
});

test('a page that hears the Roll keeps no mark, and a later silent page keeps the first silent page\'s start', async () => {
  const world = await stand();
  const first = page(world, world.io, { held: { [MAGES]: 10, [OTHER]: 0 }, kept: null });
  await first.tick();
  assert.equal(first.save().kept.unheard, undefined);

  const silent = page(world, refusingDoor('auth'), first.save());
  await silent.tick();
  silent.held[MAGES] += 2;
  const mark = silent.save().kept.unheard;
  const silentAgain = page(world, refusingDoor('auth'), silent.save());
  await silentAgain.tick();
  assert.deepEqual(silentAgain.save().kept.unheard, mark, 'the earlier start covers both pages');
});

test('the mark\'s shape: a start the Roll could hold and a claim id, or nothing', () => {
  const start = { [MAGES]: 10 };
  assert.deepEqual(rollUnheardOf({ start, rid: 'a'.repeat(24) }), { start, rid: 'a'.repeat(24) });
  for (const bad of [null, {}, { start }, { rid: 'a'.repeat(24) }, { start: { 510: 1 }, rid: 'a'.repeat(24) }, { start, rid: 'x' }]) {
    assert.equal(rollUnheardOf(bad), null);
  }
  assert.deepEqual(rollKeptOf({ unheard: { start, rid: 'a'.repeat(24) } }), { unheard: { start, rid: 'a'.repeat(24) } }, 'a mark with no adoption before it');
  assert.deepEqual(rollKeptOf({ seq: 2, factions: start, unheard: { start, rid: 'a'.repeat(24) } }).unheard.rid, 'a'.repeat(24));
});

test('a stopped Roll is said to the player, but for the switch, a lease and a fallen character', () => {
  for (const quiet of ['chapters-closed', 'lease', 'dead']) assert.equal(rollStopText(quiet), null, quiet);
  for (const stale of ['roll-seed', 'roll-claim']) assert.equal(rollStopText(stale), accountRefusalText(stale));
  for (const error of ROLL_STOPS.filter((e) => !['chapters-closed', 'lease', 'dead', 'roll-seed', 'roll-claim'].includes(e))) {
    assert.equal(rollStopText(error), ROLL_STOPPED_TEXT, error);
  }
});

test('the host says the stop through sayRollStop: the words where there are any, nothing where there are none', () => {
  const said = [];
  const warn = console.warn;
  console.warn = () => {};
  try {
    sayRollStop('auth', (text) => said.push(text));
    sayRollStop('chapters-closed', (text) => said.push(text));
  } finally {
    console.warn = warn;
  }
  assert.deepEqual(said, [ROLL_STOPPED_TEXT]);
});
