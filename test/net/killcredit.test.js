// OUTDOOR-LOOT follow-ups, PHASE 1 (2026-10-19, Travis: "I heard a report of someone killing a bear and not seeing the skin option even though they had a skinning knife"): THE KILL CREDIT
// MUST NOT DEPEND ON A 3-SECOND ROUND TRIP. RED PINS, written before the fix.
//
// THE BUG (src/scenes/exteriorFoes.js). A blow on a peer's foe is handed to the owner as a hit; the owner's door applies it and, if
// it killed, answers `slain: 1` to the striker. The striker lands that report only for a puppet it STRUCK (`f._struckAt`, latched
// when the blow is handed to the hit queue), inside SLAIN_WINDOW_MS (= TAKE_WINDOW_MS, 3000), once. But each side's hit queue
// (net/hitPend.js makeHitPend) holds a refused frame up to 2000 ms before it gives it up, so in a fight - the rate gate spent,
// ten blows a second - the blow can wait 2 s at the striker, the `slain` 2 s at the owner, and the credit arrives 4 s after the
// blow it answers: refused. The killer gets no skin (Hunting's body stamp, huntHost.js createBodyStamps), no werewolf urge
// (playerWeaponKillReported), no quest or set credit (reportPlayerKill -> playerKills.js's listeners).
//
// MOUNTED, NOT MATCHED: two (three) REAL pools (createExteriorFoes over a crafted MONSTER.BSA, the street's, as
// test/net/bodyLootHarness.mjs stands them), each behind the REAL hit queue (makeHitPend), on a controllable clock, joined by the
// relay stand-in; the kill listener is the REAL registry (systems/playerKills.js registerPlayerKillListener) with the Hunting
// stamp registered exactly as world.js registers it (`registerPlayerKillListener('hunting', ...)` over createBodyStamps), and the
// stamp is read through `createBodyStamps(...).of`. The striker's blow is the pool's own damageFoe door; the owner's reply is
// whatever the owner's applyHit sends.
//
// THE LAW THE FIX KEEPS (anti-forgery, DISC10-E): a `slain` credits only a body I STRUCK, only from its OWNER, once - and now for
// SLAIN_KEEP_MS (60 s) after my last blow on it, with or without the puppet still standing (a swept puppet's kill still credits).
import '../modsOff.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerPlayerKillListener } from '../../src/systems/playerKills.js';
import { createBodyStamps } from '../../src/scenes/huntHost.js';
import { relay, streetPlayer, run, lcg, settle, restoreRandom, clone } from './bodyLootHarness.mjs';

const BOB = 'bob-0002', MAC = 'mac-0001', EVE = 'eve-0003';
const ROOM = 'world:3,12';   // the street cell the harness stands every player in
const SLAIN_KEEP_MS = 60_000;
const dir = (from, to) => `${from}>${to}`;

afterEach(() => { restoreRandom(); for (const n of ['hunting', 'killcredit']) registerPlayerKillListener(n, null); });

/** Bob owns a rat; Mac (and Eve) stand its puppet. The listeners are the game's: the Hunting stamp as world.js registers it, and a
 *  recorder beside it. Answers the cell and what the listeners heard. */
async function fight({ eve = false } = {}) {
  const net = relay();
  const bob = streetPlayer(net, BOB, [30, 0, 30]);
  const mac = streetPlayer(net, MAC, [11, 0, 11]);
  const eveP = eve ? streetPlayer(net, EVE, [13, 0, 13]) : null;
  const stamps = createBodyStamps({ nowMs: () => Date.UTC(2026, 9, 19, 12, 0, 0) });
  const kills = [];
  registerPlayerKillListener('hunting', (entity) => { stamps.stamp(entity); });   // world.js: "registerPlayerKillListener('hunting', (entity) => { bodyStamps.stamp(entity); });"
  registerPlayerKillListener('killcredit', (entity, info) => { kills.push({ entity, kind: info.kind }); });
  Math.random = lcg(7);
  const rat = await bob.pool().spawnFoe(0, [12, 0, 12], { feetGiven: true });
  assert.ok(rat, 'the owner\'s foe stands');
  run(net, 400);
  const standing = (p) => p.pool().foes.find((x) => x.puppet === BOB && x.seq === rat.seq);
  for (let i = 0; i < 40 && !(standing(mac) && (!eveP || standing(eveP))); i++) { await settle(); run(net, 50); }
  assert.ok(standing(mac), 'Mac stands Bob\'s foe as a puppet');
  const s = { net, bob, mac, eve: eveP, rat, stamps, kills, pup: standing(mac), pupOf: standing };
  /** A lethal (or, with `dmg`, a lesser) blow of `p`'s on the puppet of Bob's foe, through the pool's own damage door. */
  s.strike = (p, dmg = 9999) => p.pool().damageFoe(standing(p), dmg, [...p.feet], null, { kind: 'melee' });
  /** What the listeners heard about a puppet's body: the kill reports for its entity, and the Hunting stamp. */
  s.credit = (p) => { const e = standing(p)?.entity ?? s.entities.get(p.id); return { reports: kills.filter((k) => k.entity === e), stamp: stamps.of(e), entity: e }; };
  s.entities = new Map([[MAC, s.pup.entity], ...(eveP ? [[EVE, standing(eveP).entity]] : [])]);
  return s;
}
const slainFrames = (s, to = MAC) => s.net.log.filter((e) => e.from === BOB && e.to === to && e.data.slain === 1);
const credited = (s, why) => {
  const { reports, stamp } = s.credit(s.mac);
  assert.equal(reports.length, 1, `${why}: the owner's \`slain\` for Mac's killing blow reached ${reports.length === 0 ? 'NO kill report' : `${reports.length} kill reports`} (playerKills.js: reportPlayerKill; the werewolf urge and quests ride the same arm) - ${slainFrames(s).length ? 'the owner DID say it' : 'the owner never said it (guard)'}`);
  assert.equal(reports[0].kind, 'remote', `${why}: told as the owner's word`);
  assert.ok(stamp, `${why}: and the body is stamped for Hunting (createBodyStamps.of) - the killer cannot skin what it killed`);
  return stamp;
};

// ═══ THE OWNER'S `slain`, LATE ═══════════════════════════════════════════════════════════════════════════════════════════
// A held link: the relay carries the owner's word to the striker late. 3.5 s is the common fight (a queue's 2 s at each end
// minus what the clock spent); 10 s and 30 s are a stalled link or relay, still well inside a minute.
for (const lateMs of [3500, 10_000, 30_000]) {
  test(`KILL CREDIT: the owner's \`slain\` ${lateMs / 1000} s after the blow still credits the killer ONCE - the kill reported and the body stamped for Hunting`, async () => {
    const s = await fight();
    s.net.late.set(dir(BOB, MAC), lateMs);
    s.strike(s.mac);
    run(s.net, lateMs + 1500);
    assert.equal(s.rat.dead, true, 'the owner\'s foe died of the blow (guard)');
    assert.equal(slainFrames(s).length, 1, 'and the owner said `slain` once (guard)');
    credited(s, `${lateMs / 1000} s late`);
  });
}

test('KILL CREDIT: the same through the HIT QUEUES alone - the blow waits 1.9 s in the striker\'s real queue and the `slain` 1.9 s in the owner\'s (each under the queue\'s own 2 s age), no relay lateness anywhere: 3.85 s after the blow, and credited', async () => {
  const s = await fight();
  s.net.shut.add(MAC); s.net.shut.add(BOB);   // the rate gate is spent at both ends: a refused frame waits in makeHitPend
  s.strike(s.mac);
  assert.equal(s.mac.pend.held, 1, 'the blow waits in the striker\'s hit queue (guard)');
  run(s.net, 1900);
  s.net.shut.delete(MAC);
  run(s.net, 100);
  assert.equal(s.rat.dead, true, 'the blow reached the owner and killed (guard)');
  assert.equal(s.bob.pend.held, 1, 'the owner\'s `slain` waits in the OWNER\'s hit queue (guard)');
  run(s.net, 1700);
  s.net.shut.delete(BOB);
  run(s.net, 500);
  assert.equal(slainFrames(s).length, 1, 'and went out once the owner\'s gate opened (guard)');
  credited(s, '3.85 s through two real hit queues');
});

test('KILL CREDIT: a duplicate `slain` credits ONCE - the same word delivered again (and again) adds no report and does not re-stamp the body', async () => {
  const s = await fight();
  s.net.late.set(dir(BOB, MAC), 3500);
  s.strike(s.mac);
  run(s.net, 5000);
  const stamp = credited(s, 'the first');
  const word = clone(slainFrames(s)[0].data);
  assert.equal(s.mac.hit(BOB, clone(word)), false, 'a second `slain` for the same blow is refused');
  assert.equal(s.mac.hit(BOB, clone(word)), false, 'and a third');
  run(s.net, 500);
  const { reports, stamp: again } = s.credit(s.mac);
  assert.equal(reports.length, 1, 'one kill report, however many times the word comes');
  assert.equal(again.key, stamp.key, 'and the body keeps the one stamp it got');
});

// ═══ THE LAW THE FIX KEEPS: ONLY A BODY I STRUCK, ONLY FROM ITS OWNER ═════════════════════════════════════════════════════
test('KILL CREDIT (guard): a `slain` for a foe Mac NEVER struck is refused - no report, no stamp (any socket in the cell could otherwise feed the urge)', async () => {
  const s = await fight({ eve: true });
  s.strike(s.eve, 1);   // Eve struck it; Mac did not
  run(s.net, 300);
  const word = { to: MAC, k: ROOM, i: s.rat.seq, slain: 1 };
  assert.equal(s.mac.hit(BOB, clone(word)), false, 'Mac never struck Bob\'s foe: the owner\'s word about it is no credit of Mac\'s');
  const { reports, stamp } = s.credit(s.mac);
  assert.equal(reports.length, 0, 'no kill report');
  assert.equal(stamp, null, 'no stamp');
});

test('KILL CREDIT (guard): a `slain` names a body by its number - a foe Mac struck, and another of the same owner it did not, are two bodies', async () => {
  const s = await fight();
  const second = await s.bob.pool().spawnFoe(0, [14, 0, 14], { feetGiven: true });
  run(s.net, 400);
  for (let i = 0; i < 40 && !s.mac.pool().foes.some((x) => x.puppet === BOB && x.seq === second.seq); i++) { await settle(); run(s.net, 50); }
  s.strike(s.mac, 1);   // the first foe struck, short of death
  run(s.net, 300);
  assert.equal(s.mac.hit(BOB, { to: MAC, k: ROOM, i: second.seq, slain: 1 }), false, 'the word about the foe Mac never struck is refused');
  assert.equal(s.credit(s.mac).reports.length, 0, 'no kill report');
});

test('KILL CREDIT: a `slain` from anyone but the foe\'s OWNER is refused, and does not spend the real one - Eve\'s forged word about Bob\'s foe (a foe of her own stands under the same number) credits nothing; Bob\'s genuine word, 3.5 s late, still credits once', async () => {
  const s = await fight({ eve: true });
  const hers = await s.eve.pool().spawnFoe(0, [15, 0, 15], { feetGiven: true });
  assert.equal(hers.seq, s.rat.seq, 'Eve\'s own foe wears the same number as Bob\'s (guard: the word must be told apart by its owner)');
  s.net.late.set(dir(BOB, MAC), 3500);
  s.strike(s.mac);
  run(s.net, 200);
  assert.equal(s.mac.hit(EVE, { to: MAC, k: ROOM, i: s.rat.seq, slain: 1 }), false, 'Eve is not the owner of Bob\'s foe: her word is refused');
  assert.equal(s.credit(s.mac).reports.length, 0, 'no credit from the forgery');
  run(s.net, 5000);
  credited(s, 'Bob\'s genuine word after the forgery');
});

test('KILL CREDIT: with TWO strikers only the one the owner NAMES is credited - Eve struck first, Mac\'s blow killed; the word goes to Mac (3.5 s late) and Eve, whose own blow is still on the books, gets nothing', async () => {
  const s = await fight({ eve: true });
  s.net.late.set(dir(BOB, MAC), 3500);
  s.strike(s.eve, 1);
  run(s.net, 300);
  assert.equal(s.rat.dead, false, 'Eve\'s blow did not kill (guard)');
  s.strike(s.mac);
  run(s.net, 5000);
  assert.equal(s.rat.dead, true, 'Mac\'s did (guard)');
  assert.deepEqual(slainFrames(s, EVE), [], 'the owner told Eve nothing (guard)');
  credited(s, 'Mac, the killer');
  const e = s.credit(s.eve);
  assert.equal(e.reports.length, 0, 'Eve is credited with no kill');
  assert.equal(e.stamp, null, 'and her puppet of the body is not stamped');
});

// ═══ A SWEPT PUPPET STILL CREDITS ═════════════════════════════════════════════════════════════════════════════════════════
// The credit must not live and die with the puppet object: the owner's stream gap, a room change that is no seam, the owner gone
// quiet (pruneOwners) all take the puppet down while the owner's `slain` is still on its way.
for (const how of ['clearPuppets', 'pruneOwners']) {
  test(`KILL CREDIT: a \`slain\` that arrives after the puppet was swept (${how}) still credits the kill - once, the ledger's entity stamped`, async () => {
    const s = await fight();
    const entity = s.pup.entity;
    s.net.late.set(dir(BOB, MAC), 3500);
    s.net.foesFilter = (from, frame) => (from === BOB ? null : frame);   // the owner's stream is gone: the puppet is not stood again
    s.strike(s.mac);
    run(s.net, 200);
    if (how === 'clearPuppets') s.mac.clear(); else s.mac.prune(new Set());
    assert.equal(s.pupOf(s.mac), undefined, 'the puppet is swept (guard)');
    run(s.net, 5000);
    assert.equal(s.rat.dead, true, 'the owner\'s foe died of the blow (guard)');
    const reports = s.kills.filter((k) => k.entity === entity);
    assert.equal(reports.length, 1, `the swept puppet's kill reached ${reports.length === 0 ? 'NO kill report' : `${reports.length} reports`} - the credit lived on the puppet object (f._struckAt) and died with it`);
    assert.ok(s.stamps.of(entity), 'and the body is stamped');
  });
}

test('KILL CREDIT (guard): the credit goes with the pool - a `slain` for a blow of the OLD world (the pool destroyed, a room torn down) credits nothing in the next', async () => {
  const s = await fight();
  s.net.late.set(dir(BOB, MAC), 3500);
  s.strike(s.mac);
  run(s.net, 200);
  s.mac.pool().destroy();
  run(s.net, 5000);
  assert.equal(s.rat.dead, true, 'the owner\'s foe died of the blow (guard)');
  assert.equal(s.kills.length, 0, 'a destroyed pool credits no kill - the ledger is the pool\'s, and goes with it');
});

// ═══ THE CREDIT LAPSES ═════════════════════════════════════════════════════════════════════════════════════════════════
test(`KILL CREDIT: the credit is kept ${SLAIN_KEEP_MS / 1000} s from the last blow - a \`slain\` at 59 s still credits the killer once`, async () => {
  const s = await fight();
  s.net.late.set(dir(BOB, MAC), 59_000);
  s.strike(s.mac);
  run(s.net, 60_500);
  assert.equal(s.rat.dead, true, 'the owner\'s foe died of the blow (guard)');
  credited(s, '59 s late');
});

test(`KILL CREDIT (guard): the credit LAPSES - a \`slain\` at 61 s is refused and stamps nothing (the long window is ${SLAIN_KEEP_MS / 1000} s, not for ever)`, async () => {
  const s = await fight();
  s.net.late.set(dir(BOB, MAC), 61_000);
  s.strike(s.mac);
  run(s.net, 62_500);
  assert.equal(s.rat.dead, true, 'the owner\'s foe died (guard)');
  assert.equal(slainFrames(s).length, 1, 'and the owner said `slain` (guard)');
  const { reports, stamp } = s.credit(s.mac);
  assert.equal(reports.length, 0, 'a word 61 s after the blow credits nothing');
  assert.equal(stamp, null, 'no stamp');
});

