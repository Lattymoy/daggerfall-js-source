// OUTDOOR-LOOT, SLICE 2 (2026-10-17) - THE EDGES THE WRITTEN PINS DO NOT REACH. test/net/containerloot*.test.js pin the design's laws
// against the doors the interior host calls; the implementation (world/interior/interiorRoomLoot.js) also decides a few things the
// design leaves to it, each one a way a player would otherwise meet the bug again or lose something the old law never lost:
//   - OFFLINE the room is inert: the page has no peer id, so the roll is written as it always was, a take is the player's own and
//     the scene cache's list is the player's own cupboard (set aside online alone);
//   - a roll of NOTHING is the room's at once: "If no contents, do nothing" asks no Yes, so without a birth every press would roll
//     the cupboard again and a player could press until it held something;
//   - NO SEAT KNOWN is no other seat: the dungeon's own rule (WORLD2 dungeonAuthority) - a take is never left waiting on a seat that
//     is not there (a socket dead, a welcome not yet heard);
//   - a minter's birth, said again, is ANSWERED by the seat with the base that stands (the seat's one word may have been lost), and a
//     birth that LOSES is answered the same, so a client that missed the winner's word converges on it;
//   - a NEW DAY's stock replaces yesterday's without taking back what was taken yesterday (only a lost tie-break does).
// Mounted as the cupboard files mount (./containerLootHarness.mjs): the host's own doors over a relay stand-in.
import '../modsOff.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetQuickLoot } from '../../src/systems/quickLoot.js';
import { setSharedClock } from '../../src/systems/worldTick.js';
import { baseSignature } from '../../src/systems/roomLoot.js';
import { isStolen } from '../../src/systems/stolenGoods.js';
import { CLAIM_KEEP_MS } from '../../src/systems/loot/claimLedger.js';
import {
  REAL_RANDOM, TODAY, clock, items, names, mk, peekNames, packHas, have, windowOf, frame, elapse, quiesce, rolled, firstOpen, pressYes,
  relay, player, plaque, KEY, ROOM, clone, older,
} from './containerLootHarness.mjs';

afterEach(() => { Math.random = REAL_RANDOM; resetQuickLoot(); setSharedClock(null); });

const STOCK = () => [mk('Dagger'), mk('Mace'), mk('Katana'), mk('Staff')];
/** A building whose cupboard A (the seat) first-opened on `stock`, closed, and everyone has heard. */
function born(n = 3, stock = STOCK(), opts = {}) {
  const s = rolled(n, [stock], opts);
  const wa = firstOpen(s.A);
  wa.close(); frame(s.A); s.net.flush();
  return s;
}
const copies = (s, name) => s.ps.reduce((n, p) => n + packHas(p, name), 0);

test('OFFLINE (no peer id): the room is inert - the roll is written to the cupboard as it always was and listed, a take is the player\'s own at once, nothing is claimed, and the scene cache\'s list is not set aside', () => {
  const net = relay();
  const p = player(net, 'aaaa-0001', { seed: 7, roll: () => [mk('Dagger'), mk('Mace')] });
  p.state.host.selfId = () => null; p.state.host.roomHost = () => null;   // the page is offline: there is no session, no id, no seat
  const room = p.as(() => p.h.bag().room);
  assert.equal(room.live(), false, 'the cupboards\' room is minted with the bag but waits on a peer id');
  const w = windowOf(p);
  assert.ok(pressYes(p, w), 'the press opens the cupboard');
  assert.deepEqual(names(items(p)), ['Dagger', 'Mace'], 'the roll is the cupboard\'s own list');
  assert.equal(p.ctx.containers[0].stockedDate, TODAY, 'dated today');
  w.takeNamed('Mace');
  frame(p);
  assert.equal(packHas(p, 'Mace'), 1, 'a take is the player\'s own - no claim lifts it out of the pack');
  elapse({ ps: [p], net }, 10_000);
  assert.equal(packHas(p, 'Mace'), 1, 'and nothing lapses it back');
  assert.equal(net.words(p).filter((r) => 'q' in r || 'b' in r || 'g' in r).length, 0, 'no word of the room\'s law is said');
  w.close(); frame(p);
  assert.deepEqual(peekNames(p), ['Dagger'], 'the plaque lists the cupboard as it stands');
  p.ctx.containers[0].items = [mk('Flail')];   // what the scene cache laid, offline: the player\'s own cupboard
  p.as(() => room.aside(p.ctx));
  assert.deepEqual(names(items(p)), ['Flail'], 'offline the cache\'s list is kept');
});

test('a roll of NOTHING is the room\'s at once: no Yes is asked and the empty cupboard stands for the day for everyone - a press never rolls it again, here or in another player\'s hands', () => {
  const s = rolled(3, [[], STOCK(), STOCK()]);
  const wa = windowOf(s.A);
  assert.equal(pressYes(s.A, wa), null, 'A rolled nothing: "If no contents, do nothing" - no question, no window');
  s.net.flush();
  for (const p of s.ps) {
    assert.ok(Array.isArray(items(p)), `${p.id} has heard the room: the cupboard is born, and empty`);
    assert.deepEqual(names(items(p)), [], `${p.id}'s list is empty`);
  }
  assert.equal(plaque(s.B)?.kind, 'items', 'B\'s plaque is a (glance at an) empty list, not a name that invites a press');
  const wb = windowOf(s.B);
  assert.equal(pressYes(s.B, wb), null, 'B\'s press does nothing: B\'s own dice would have rolled a stock, and the room\'s empty one stands');
  assert.equal(items(s.B).length, 0);
  for (let i = 0; i < 3; i++) { pressYes(s.A, wa); pressYes(s.C, windowOf(s.C)); }
  assert.deepEqual(names(items(s.A)), [], 'pressed again and again, A\'s cupboard is still empty (it is never rolled again)');
});

test('NO SEAT KNOWN is no other seat: with the relay\'s seat unheard, a take is judged where it stands and lands at once - never left waiting on a seat that is not there', () => {
  const s = born(3);
  s.net.seatId = null;   // a welcome not yet heard, or a socket dead: the session holds no host
  const wb = windowOf(s.B);
  assert.ok(pressYes(s.B, wb), 'B opens the cupboard');
  wb.takeNamed('Mace');
  wb.close(); frame(s.B);
  assert.equal(packHas(s.B, 'Mace'), 1, 'the take stands in B\'s pack at once - no verdict to wait for');
  assert.equal(s.net.words(s.B).filter((r) => Array.isArray(r.q)).length, 0, 'and no claim was said to a seat that is not there');
  assert.equal(have(items(s.B), 'Mace'), 0, 'B\'s list shows it no more');
  elapse(s, 6000);
  assert.equal(packHas(s.B, 'Mace'), 1, 'and nothing lapses it back');
});

test('a minter\'s birth is said again until the seat answers - and the seat ANSWERS the birth it has already adopted, so the one word that was lost is not the end of it', () => {
  const s = rolled(3, [null, [mk('Dagger'), mk('Mace')]]);
  let lost = 0;
  s.net.drop = (from) => from === s.A.id && lost++ < 1;   // the first word the seat says - its answer to B's birth - is lost on the wire
  const wb = firstOpen(s.B);
  s.net.flush();
  assert.equal(lost, 1, 'the seat\'s answer to the birth was lost (guard)');
  elapse(s, 6000);
  assert.ok(wb.cur, 'B\'s window is still open (guard)');
  const answers = s.net.words(s.A).filter((r) => Array.isArray(r.b));
  assert.ok(answers.length >= 2, `the seat answered B's birth ${answers.length} time(s) - the answer that was lost, and the one B's second birth word drew`);
  const births = s.net.words(s.B).filter((r) => Array.isArray(r.b)).length;
  assert.ok(births >= 2 && births <= 4, `B said its birth ${births} times - again until the seat's word was heard, and no longer`);
  for (const p of [s.A, s.C]) assert.deepEqual(names(items(p)), ['Dagger', 'Mace'], `${p.id} has the cupboard's list`);
});

test('a birth that LOSES is answered by the seat with the base that won - a client that missed the winner\'s word converges on it, and its takes from its own roll are refused', () => {
  const s = rolled(3, [[mk('Dagger'), mk('Mace')], null, [mk('Katana'), mk('Staff')]]);
  s.net.cut.add(`${s.A.id}>${s.C.id}`);   // C hears nothing the seat says while A first-opens
  const wa = firstOpen(s.A);
  s.net.flush();
  wa.close(); frame(s.A); s.net.flush();
  assert.equal(items(s.C), null, 'C has heard nothing of the cupboard (guard)');
  s.net.cut.delete(`${s.A.id}>${s.C.id}`);
  clock.t += 5;
  const wc = firstOpen(s.C);   // C opens the cupboard on its own roll, the later mint
  wc.takeNamed('Katana');
  s.net.flush();
  wc.close(); frame(s.C); s.net.flush();
  quiesce(s);
  for (const p of s.ps) assert.deepEqual(names(items(p)), ['Dagger', 'Mace'], `${p.id} ends on the earlier mint's list`);
  assert.equal(packHas(s.C, 'Katana'), 0, 'C holds nothing of its own, losing roll');
});

for (const who of ['another player', 'the seat itself']) {
  test(`a NEW DAY's stock replaces yesterday's without taking back what was taken yesterday [${who} restocks] - only a lost tie-break lifts a piece out of a pack`, () => {
    const s = rolled(3, [STOCK(), [mk('Flail'), mk('Warhammer')]]);
    const wa = firstOpen(s.A);
    wa.takeNamed('Mace');
    wa.close(); frame(s.A); s.net.flush();
    assert.equal(packHas(s.A, 'Mace'), 1, 'A, the seat, took the Mace of yesterday\'s stock (guard)');
    for (const p of s.ps) p.state.stockedToday = () => TODAY + 1;   // the game day turns over
    const opener = who === 'the seat itself' ? s.A : s.B;
    opener.roll = () => [mk('Flail'), mk('Warhammer')];
    const wo = windowOf(opener);
    assert.ok(pressYes(opener, wo), `${opener.id} presses: the cupboard is due to restock, and its roll is the new day's stock`);
    wo.close(); frame(opener); s.net.flush();
    quiesce(s);
    for (const p of s.ps) assert.deepEqual(names(items(p)), ['Flail', 'Warhammer'], `${p.id} has the new day's list`);
    assert.equal(packHas(s.A, 'Mace'), 1, 'A keeps the Mace it took yesterday - the room moved to a new day, it did not lose a tie-break');
    assert.equal(copies(s, 'Mace'), 1);
    assert.equal(s.A.ctx.containers[0].stockedDate, TODAY + 1, 'and the cupboard is dated the new day');
  });
}

test('a PUT made under a roll that has lost the first-open tie-break comes home: the stash is refused with its mint, goes back to the putter\'s pack once the window is shut, and is in no list - not lost, not copied', () => {
  const winRoll = [mk('Dagger'), mk('Mace')], loseRoll = [mk('Katana'), mk('Staff')];
  const s = rolled(3, [winRoll, loseRoll]);
  const ww = firstOpen(s.A);
  clock.t += 5;
  const Y = mk('Flail');
  s.B.entity.items.push(Y);
  const wl = firstOpen(s.B);   // B's roll is the later mint
  s.net.flush();   // the births cross: B's window still shows its own roll
  wl.put(Y);
  assert.equal(packHas(s.B, 'Flail'), 0, 'the Flail is in B\'s window (guard)');
  ww.close(); wl.close();
  quiesce(s);
  assert.equal(packHas(s.B, 'Flail'), 1, 'the stash of a base that is gone is refused and the piece is B\'s again');
  for (const p of s.ps) assert.equal(have(items(p), 'Flail'), 0, `${p.id}'s list shows no Flail`);
  for (const p of s.ps) assert.deepEqual(names(items(p)), ['Dagger', 'Mace'], `${p.id} ends on the earlier mint's list`);
});

test('a stack laid ONTO one of the room\'s stacks is a put of what was added: the others see both rows, the putter holds none, and the room\'s own stack is as it was', () => {
  const s = rolled(3, [[mk('Dagger'), mk('Arrow', 'Weapons', { stackCount: 10 }), mk('Mace')]]);
  const wa = firstOpen(s.A); wa.close(); frame(s.A); s.net.flush();
  const arrows = mk('Arrow', 'Weapons', { stackCount: 5 });
  s.B.entity.items.push(arrows);
  const wb = windowOf(s.B);
  assert.ok(pressYes(s.B, wb), 'B opens the cupboard');
  wb.put(arrows);
  assert.equal(have(items(s.B), 'Arrow'), 15, 'B\'s window shows the stack grown to fifteen (guard)');
  wb.close(); frame(s.B); s.net.flush(); quiesce(s);
  assert.equal(packHas(s.B, 'Arrow'), 0, 'B holds none of the five');
  for (const p of s.ps) assert.equal(have(items(p), 'Arrow'), 15, `${p.id}'s list holds the ten and the five`);
  const wc = windowOf(s.C);
  assert.ok(pressYes(s.C, wc), 'C opens it');
  wc.takeAmount('Arrow', 4); wc.close(); frame(s.C); s.net.flush(); quiesce(s);
  assert.equal(packHas(s.C, 'Arrow'), 4, 'C takes four off the room\'s own stack');
  for (const p of s.ps) assert.equal(have(items(p), 'Arrow'), 11, `${p.id}'s list holds the eleven that are left: six and the five`);
});

test('a birth no seat ever answers (an older build holds the seat, or its socket is dead) is said again a BOUNDED number of times - the minter is not left flooding the room for as long as it stands in the building', () => {
  const s = rolled(3, [null, [mk('Dagger'), mk('Mace')]]);
  s.net.dead.add(s.A.id);   // the seat answers nothing
  const wb = firstOpen(s.B);
  elapse(s, 120_000, { step: 500 });
  assert.ok(wb.cur, 'B\'s window is still open (guard)');
  const births = s.net.words(s.B).filter((r) => Array.isArray(r.b)).length;
  assert.ok(births >= 10 && births <= 41, `B said its birth ${births} times in two minutes - again every ${1500} ms, and then no more`);
  assert.deepEqual(names(items(s.B)), ['Dagger', 'Mace'], 'and B\'s own window shows its roll');
});

// ═══ AUDIT OUTDOOR-LOOT (2026-10-18, PR #1019's audit) - WHAT A LOST TIE-BREAK AND A LEAVE MAY TOUCH ════════════════════════════
// C1: a lost tie-break lifted back out of the seat's pack every piece it had taken from the cupboard that visit - and a same-day birth
// with an earlier `tm` is a lost tie-break whenever it comes, so one forged word, minutes later, took a seat's Katana (and, after a
// take put back, the seat's own honest arrows that stack with it). What a lost roll gives back is bounded to the window an honest
// earlier birth can still arrive in (its minter's BIRTH_SAYS_MAX re-says). C3: a put the seat stored on its own roll was in no list
// once that roll lost - it goes home now, as a claimer's refused put does. C2: under a seat that judges nothing (an older build),
// a put was in its putter's list alone and went with him at his leave - it goes home now.
const forgedBirth = (base) => ({ k: KEY, g: TODAY, lv: 1, n: 1, tm: 0, h: baseSignature(base), b: clone(base), s: [], si: [], d: TODAY });

test('AUDIT OUTDOOR-LOOT C1: a forged early birth ten minutes after the cupboard was born lifts NOTHING out of the seat\'s pack - the Katana it took stays', () => {
  const s = rolled(3, [[mk('Dagger'), mk('Mace'), mk('Katana')]]);
  const wa = firstOpen(s.A);
  wa.takeNamed('Katana'); frame(s.A);
  wa.close(); frame(s.A); s.net.flush(); quiesce(s);
  assert.equal(packHas(s.A, 'Katana'), 1, 'the seat took the Katana (guard)');
  clock.t += 600_000;
  s.net.say('hostile-0099', { k: ROOM, l: [forgedBirth([mk('Staff')])] });
  s.net.flush(); quiesce(s);
  assert.equal(packHas(s.A, 'Katana'), 1, 'C1: the seat keeps the Katana it took ten minutes ago');
});

test('AUDIT OUTDOOR-LOOT C1: a take put back, then a forged early birth - the seat\'s OWN honest arrows stay in its pack', () => {
  const s = rolled(3, [[mk('Dagger'), mk('Arrow', 'Weapons', { stackCount: 10 })]]);
  s.A.entity.items.push(mk('Arrow', 'Weapons', { stackCount: 5 }));
  const wa = firstOpen(s.A);
  wa.takeNamed('Arrow'); frame(s.A);
  wa.put(s.A.entity.items.find((it) => it.name === 'Arrow' && isStolen(it))); frame(s.A);
  wa.close(); frame(s.A); s.net.flush(); quiesce(s);
  clock.t += 600_000;
  s.net.say('hostile-0099', { k: ROOM, l: [forgedBirth([mk('Staff')])] });
  s.net.flush(); quiesce(s);
  assert.deepEqual(s.A.entity.items.filter((it) => it.name === 'Arrow').map((it) => [it.stackCount, isStolen(it)]), [[5, false]], 'C1: the five honest arrows the seat brought in');
});

test('AUDIT OUTDOOR-LOOT C3: the SEAT\'s put on its own roll, made before it heard the earlier mint, comes home when its roll loses - one Flail, in the seat\'s pack', () => {
  const s = rolled(3, [[mk('Katana'), mk('Staff')], [mk('Dagger'), mk('Mace')]]);   // A (the seat) rolls the loser, B the winner
  const wb = firstOpen(s.B);   // B mints first by the shared clock
  clock.t += 5;
  s.A.entity.items.push(mk('Flail'));
  const wa = firstOpen(s.A);   // A mints later, before it hears B's birth
  wa.put(s.A.entity.items.find((it) => it.name === 'Flail'));
  frame(s.A);   // the seat lands its own put on its own roll
  s.net.flush();   // the births cross
  wa.close(); wb.close();
  quiesce(s);
  assert.equal(packHas(s.A, 'Flail'), 1, 'C3: the Flail is back in the seat\'s pack');
  for (const p of s.ps) assert.equal(have(items(p), 'Flail'), 0, `${p.id}'s list holds no Flail - the roll that won never had it`);
});

test('AUDIT OUTDOOR-LOOT C2: under an OLDER seat a new build\'s put never lands - it goes home with its putter at his leave, not with him into nothing', () => {
  const net = relay();
  const O = older(net, 'oooo-0001', { list: [mk('Dagger'), mk('Mace')] });   // the seat: the longest socket, an older build
  const B = player(net, 'bbbb-0002', { seed: 28 });
  const s = { net, ps: [O, B] };
  O.say(); net.flush();
  B.entity.items.push(mk('Flail'));
  const wb = windowOf(B);
  assert.ok(pressYes(B, wb), 'B opens the cupboard (guard)');
  wb.put(B.entity.items.find((it) => it.name === 'Flail')); frame(B); wb.close(); frame(B); net.flush();
  elapse(s, 10_000);
  assert.equal(have(O.ctx.containers[0].items, 'Flail'), 0, 'the older seat never landed it (guard)');
  B.as(() => B.h.leave()); B.here = false; net.flush();
  assert.equal(packHas(B, 'Flail'), 1, 'C2: the Flail is back in B\'s pack');
});

test('AUDIT OUTDOOR-LOOT C2 (the bound): a put whose putter walks out the same instant is NOT handed back as well - the seat lands it, and the Flail is the cupboard\'s once', () => {
  const s = born(3);
  s.B.entity.items.push(mk('Flail'));
  const wb = windowOf(s.B);
  assert.ok(pressYes(s.B, wb), 'B opens the cupboard (guard)');
  wb.put(s.B.entity.items.find((it) => it.name === 'Flail')); frame(s.B);   // the settle says the put
  wb.close(); s.B.as(() => s.B.h.leave()); s.B.here = false;   // and B walks out before any verdict comes
  s.net.flush(); quiesce(s);
  assert.equal(packHas(s.B, 'Flail'), 0, 'C2: the Flail did not come home as well');
  assert.equal(have(items(s.C), 'Flail'), 1, 'the seat landed it: the cupboard holds it once');
});

test('AUDIT OUTDOOR-LOOT D5 (cupboards): a claim its claimer GAVE UP is not granted by a third client that heard it and takes the seat later - the Katana stays in the cupboard, in nobody\'s pack', () => {
  const s = born(3);
  const wb = windowOf(s.B);
  assert.ok(pressYes(s.B, wb), 'B opens the cupboard (guard)');
  s.net.dead.add(s.A.id);   // the seat's socket is gone, and the relay has not said so
  wb.takeNamed('Katana'); frame(s.B); s.net.flush(); wb.close(); frame(s.B); s.net.flush();
  elapse(s, CLAIM_KEEP_MS + 10_000, { step: 1000, skip: [s.A] });   // B says it again and again, then lets it go; C heard it
  assert.equal(packHas(s.B, 'Katana'), 0, 'B gave the claim up (guard)');
  s.net.seatId = s.C.id;   // C - who heard B's claim - takes the seat (the relay's handover)
  quiesce(s, { skip: [s.A] });
  assert.equal(have(items(s.C), 'Katana'), 1, 'D5: C, the seat now, still lists the Katana - it granted nobody a claim its claimer had let go');
  for (const p of [s.B, s.C]) assert.equal(packHas(p, 'Katana'), 0, `${p.id} holds no Katana`);
});

test('AUDIT OUTDOOR-LOOT C3 (what still stood): the seat\'s put on a roll that later loses, TAKEN by another player in the meantime, is that taker\'s - it does not come home to the seat as well', () => {
  const s = rolled(3, [[mk('Katana'), mk('Staff')], [mk('Dagger')], [mk('Mace'), mk('Saber')]]);   // A (the seat) rolls the loser; C the winner
  s.net.hold(`${s.C.id}>${s.A.id}`); s.net.hold(`${s.C.id}>${s.B.id}`);   // C's earlier birth is slow to reach the others
  const wc = firstOpen(s.C);   // C mints first by the shared clock
  clock.t += 5;
  s.A.entity.items.push(mk('Flail'));
  const wa = firstOpen(s.A);   // A, the seat, mints later - before it hears C
  wa.put(s.A.entity.items.find((it) => it.name === 'Flail')); frame(s.A);   // the seat lands its own put on its own roll
  wa.close(); frame(s.A); s.net.flush();
  const wb = windowOf(s.B);
  assert.ok(pressYes(s.B, wb), 'B opens the cupboard on the seat\'s roll (guard)');
  wb.takeNamed('Flail'); frame(s.B); s.net.flush(); wb.close(); frame(s.B); s.net.flush();
  assert.equal(packHas(s.B, 'Flail'), 1, 'the seat granted B the Flail (guard)');
  s.net.release(`${s.C.id}>${s.A.id}`); s.net.release(`${s.C.id}>${s.B.id}`);   // now C's earlier birth lands: the seat's roll loses
  s.net.flush(); wc.close(); quiesce(s);
  assert.equal(packHas(s.A, 'Flail') + packHas(s.B, 'Flail') + packHas(s.C, 'Flail'), 1, `C3: one Flail in all (A ${packHas(s.A, 'Flail')}, B ${packHas(s.B, 'Flail')})`);
});
