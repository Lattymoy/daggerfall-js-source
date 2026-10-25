// CARDS10 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 33): THE RELAY DEALS ILIAC HAND. Driven: the relay's
// Iliac table (net/iliac/iliacTable.js) - its two seats of a cloth's chairs, a deck the law refuses refused, the first game
// after the second seat; the deal from the relay's own source, each seat's hand in a frame to that seat ALONE, the room a
// spectator's view (no hand, no deck); a commit hidden (the room hears that, never what); the turn turned over once both
// have, or by the clock (a pass); six turns and the end; the next game after the pause; a stand mid-game conceding; a
// ranked game's result queued only between two vouched-for seats of two accounts - and its receipt (net/iliac/iliacReceipt.js
// i1), the deck order (identityToken.js `deck`), the wire both ways, and the relay itself (server/src/index.js on the
// fake room): two players seated in a tavern's room and a third watching, the alarm's clock, a ranked game's signed
// result to both, a seat refused at a table Hold'em holds, a table kept across a hibernation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  newIliacTable, iliacSit, iliacStand, iliacCommit, iliacTick, iliacNextAt, iliacLook, iliacEmpty, iliacSeatOf, iliacPublicView,
  validIliacIn, validIliacOut, ILIAC_TURN_MS, ILIAC_FIRST_MS, ILIAC_GAP_MS, ILIAC_ORDER_MAX,
} from '../../../src/net/iliac/iliacTable.js';
import { mintIliacReceipt, readIliacReceipt, verifyIliacReceipt, iliacReceiptValid, ILIAC_RECEIPT_V, ILIAC_HOW, ILIAC_GAME_ID_RE } from '../../../src/net/iliac/iliacReceipt.js';
import { mintArenaReceipt, verifyArenaReceipt } from '../../../src/net/arena/arenaReceipt.js';
import { mintDeckOrder, verifyOrder, orderValid, deckDigest, deckDigestText, ORDER_KINDS, TITLES } from '../../../src/net/identityToken.js';
import { importReceiptKey } from '../../../src/net/gate/gateReceipt.js';
import { parseClient, relaySupportsIliac, ILIAC_RELAY_MIN, RELAY_VERSION, ILIAC_FRAME_MAX } from '../../../src/net/wire.js';
import { STARTER_DECK } from '../../../src/net/iliac/iliacCards.js';
import { ILIAC_TURNS } from '../../../src/net/iliac/iliacHand.js';
import { fakeRoom } from '../../fakeRoom.mjs';

const { subtle } = webcrypto;
const seeded = (seed = 99) => { let x = seed >>> 0; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; return x >>>= 0; }; };
const ofRoom = (msgs) => msgs.filter((m) => m.to === null);
const toId = (msgs, id) => msgs.filter((m) => m.to === id);
const DECK = [...STARTER_DECK];
// PIN MOVED (AUDIT CARDS-6 C5/D2): a ranked seat names its order's expiry (a minute from the sit), and two ranked seats'
// first game waits the gap for their fresh orders (ILIAC_GAP_MS, a friendly pair's ILIAC_FIRST_MS)
const ready = (opts = {}) => {
  const t = newIliacTable({ chairs: 4 });
  iliacSit(t, { id: 'a', name: 'Ann', chair: 1, deck: DECK, now: 0, sub: opts.subA ?? null, orderE: 60 });
  iliacSit(t, { id: 'b', name: 'Bob', chair: 3, deck: DECK, now: 0, sub: opts.subB ?? null, orderE: 60 });
  const dealt = iliacTick(t, opts.subA && opts.subB ? ILIAC_GAP_MS : ILIAC_FIRST_MS, seeded(opts.seed ?? 7));
  return { t, dealt };
};

test('CARDS10 the relay\'s Iliac table: two seats of the cloth\'s chairs, a deck the law refuses refused, the first game after the second seat', () => {
  for (const bad of [{ chairs: 1 }, { chairs: 7 }, { chairs: 2.5 }]) assert.equal(newIliacTable(bad), null);
  const t = newIliacTable({ chairs: 4 });
  assert.equal(iliacNextAt(t), null, 'nobody: nothing due');
  assert.equal(iliacSit(t, { id: 'a', name: 'Ann', chair: 4, deck: DECK, now: 0 }), 'no such chair');
  assert.equal(iliacSit(t, { id: 'a', name: 'Ann', chair: 1, deck: DECK.slice(1), now: 0 }), 'bad deck', 'twenty-nine cards are no deck');
  assert.equal(iliacSit(t, { id: 'a', name: 'Ann', chair: 1, deck: [...DECK.slice(1), 'no-such-card'], now: 0 }), 'bad deck');
  const m = iliacSit(t, { id: 'a', name: 'Ann', chair: 1, deck: DECK, now: 0 });
  assert.deepEqual(m[0].frame.events.map((e) => [e.t, e.seat, e.chair]), [['sit', 0, 1]]);
  assert.equal(iliacSit(t, { id: 'b', name: 'Bob', chair: 1, deck: DECK, now: 0 }), 'taken');
  assert.equal(iliacSit(t, { id: 'a', name: 'Ann', chair: 2, deck: DECK, now: 0 }), 'seated');
  assert.equal(iliacNextAt(t), null, 'one seat deals nothing');
  iliacSit(t, { id: 'b', name: 'Bob', chair: 3, deck: DECK, now: 100 });
  assert.equal(iliacSit(t, { id: 'c', name: 'Cat', chair: 0, deck: DECK, now: 100 }), 'full', 'a game of two');
  assert.equal(iliacNextAt(t), 100 + ILIAC_FIRST_MS);
  assert.deepEqual(iliacTick(t, 101, seeded(1)), [], 'not yet');
  assert.equal(iliacSeatOf(t, 'b'), 1);
  assert.ok(!JSON.stringify(iliacPublicView(t)).includes('"deck"'), 'a seat\'s deck never leaves the relay');
});

test('CARDS10 the deal: the relay\'s source, each seat told ITS OWN hand alone, the room a spectator\'s view; a commit hidden; the turn turned over once both have', () => {
  const { t, dealt } = ready();
  assert.equal(t.gameNo, 1);
  const own = (id) => toId(dealt, id).find((x) => x.frame.mine);
  const va = own('a').frame.mine.view, vb = own('b').frame.mine.view;
  assert.equal(va.viewer, 0); assert.equal(vb.viewer, 1);
  assert.equal(va.players[0].hand.length, 4, 'his own four');
  assert.equal(va.players[1].hand, undefined, 'never the other\'s');
  const pub = ofRoom(dealt);
  assert.equal(pub.length, 1);
  assert.equal(pub[0].frame.state.game.viewer, -1);
  assert.ok(pub[0].frame.state.game.players.every((p) => p.hand === undefined), 'no hand in the room\'s view');
  assert.ok(!JSON.stringify(pub).includes('"deck"'));
  for (const c of va.players[0].hand) assert.ok(!JSON.stringify(pub[0].frame.state).includes(`"uid":${c.uid},"id"`), 'nor any card of a hand');
  assert.deepEqual(pub[0].frame.events.map((e) => e.t), ['game']);
  assert.equal(pub[0].frame.state.clockAt, ILIAC_FIRST_MS + ILIAC_TURN_MS);
  // a commit is heard, never seen; a second turns the turn over
  assert.equal(iliacCommit(t, { id: 'zed', plays: [], now: 1 }), 'not seated');
  const one = iliacCommit(t, { id: 'a', plays: [{ card: 0, holding: 0 }], now: 3000 });
  const heard = ofRoom(one)[0].frame;
  assert.deepEqual(heard.events.map((e) => [e.t, e.seat]), [['commit', 0]]);
  assert.ok(!JSON.stringify(heard).includes('"plays":[{'), 'the room hears that he committed, never what');
  assert.deepEqual(toId(one, 'a')[0].frame.mine.view.players[0].plays, [{ card: 0, holding: 0 }], 'he sees his own');
  assert.equal(iliacCommit(t, { id: 'a', plays: [], now: 3001 }), 'committed');
  const two = iliacCommit(t, { id: 'b', plays: [], now: 3500 });
  const ev = ofRoom(two)[0].frame.events.map((e) => e.t);
  assert.deepEqual([ev[0], ev[1]], ['commit', 'order']);
  assert.ok(ev.includes('turn'), 'turn two');
  assert.equal(t.game.turn, 2);
  assert.equal(t.clockAt, 3500 + ILIAC_TURN_MS, 'the clock again');
  assert.equal(toId(two, 'a').length + toId(two, 'b').length, 2, 'each seat its new view');
  // a look: the room's table, and a seat's own view again (a reload)
  assert.deepEqual(iliacLook(t, 'zed').map((x) => [x.to, !!x.frame.state, !!x.frame.mine]), [['zed', true, false]]);
  assert.ok(iliacLook(t, 'a').some((x) => x.frame.mine?.seat === 0));
});

test('CARDS10 the clock passes for a seat that has not committed; six turns and the end; the next game after the pause; a stand concedes; ranked only between two vouched-for accounts', () => {
  const { t } = ready();
  let now = ILIAC_FIRST_MS;
  iliacCommit(t, { id: 'a', plays: [], now });
  assert.deepEqual(iliacTick(t, now + ILIAC_TURN_MS - 1, seeded(2)), [], 'not yet');
  const timed = iliacTick(t, now + ILIAC_TURN_MS, seeded(2));
  assert.deepEqual(ofRoom(timed)[0].frame.events.filter((e) => e.t === 'commit').map((e) => [e.seat, e.timeout]), [[1, true]], 'Bob passes by the clock');
  now += ILIAC_TURN_MS;
  let last;
  for (let turn = 2; turn <= ILIAC_TURNS; turn++) { iliacCommit(t, { id: 'a', plays: [], now }); last = iliacCommit(t, { id: 'b', plays: [], now: now + 1 }); now += 2; }
  const end = ofRoom(last)[0].frame.events.find((e) => e.t === 'end');
  assert.ok(end, 'the end said');
  assert.equal(end.how, 'draw', 'two passing players draw');
  assert.equal(end.winner, null);
  assert.equal(t.game, null);
  assert.equal(t.results.length, 0, 'a friendly game queues nothing');
  assert.equal(toId(last, 'a').length, 1, 'each seat its last board');
  assert.equal(toId(last, 'a')[0].frame.mine.view.over, true);
  assert.equal(iliacNextAt(t), now - 1 + ILIAC_GAP_MS, 'the next game after the pause');
  const again = iliacTick(t, now - 1 + ILIAC_GAP_MS, seeded(3));
  assert.equal(ofRoom(again)[0].frame.events[0].t, 'game');
  assert.equal(t.gameNo, 2);
  // a stand mid-game concedes to the other seat
  const up = iliacStand(t, { id: 'a', now: now + 9000 });
  const evs = ofRoom(up)[0].frame.events;
  assert.deepEqual(evs.map((e) => e.t), ['end', 'leave']);
  assert.deepEqual([evs[0].winner, evs[0].how], [1, 'left']);
  assert.ok(toId(up, 'b')[0].frame.mine, 'the one left sitting sees the board');
  assert.deepEqual(iliacStand(t, { id: 'a', now: now + 9001 }), [], 'nobody to stand twice');
  iliacStand(t, { id: 'b', now: now + 9002 });
  assert.ok(iliacEmpty(t));
  // RANKED: two vouched-for seats of two accounts - the result queued; one account's two seats, or one friendly seat, never
  const r = ready({ subA: 'acct-a', subB: 'acct-b' });
  assert.equal(r.t.ranked, true);
  assert.ok(ofRoom(r.dealt)[0].frame.events[0].ranked);
  assert.match(r.t.id, ILIAC_GAME_ID_RE);
  iliacStand(r.t, { id: 'b', now: 9e3 });
  assert.deepEqual(r.t.results.map((x) => [x.f, x.r, x.h]), [[['acct-a', 'acct-b'], 0, 'left']], 'the one who stood loses, on the board');
  assert.deepEqual(r.t.results[0].to, ['a', 'b']);
  assert.equal(ready({ subA: 'acct-a', subB: 'acct-a' }).t.ranked, false, 'one account is no pair');
  assert.equal(ready({ subA: 'acct-a' }).t.ranked, false, 'a friendly seat makes a friendly game');
});

test('CARDS10 the words both ways: a sit carries thirty card ids and an order; a commit its plays; the relay\'s frames checked on the client', () => {
  assert.deepEqual(validIliacIn({ op: 'sit', table: 2, chair: 1, chairs: 4, deck: DECK }), { op: 'sit', table: 2, chair: 1, chairs: 4, deck: DECK });
  assert.equal(validIliacIn({ op: 'sit', table: 2, chair: 4, chairs: 4, deck: DECK }), null, 'no such chair');
  assert.equal(validIliacIn({ op: 'sit', table: 2, chair: 1, chairs: 4, deck: DECK.slice(1) }), null, 'thirty cards');
  assert.equal(validIliacIn({ op: 'sit', table: 2, chair: 1, chairs: 4, deck: DECK, order: 'x'.repeat(ILIAC_ORDER_MAX + 1) }), null);
  assert.equal(validIliacIn({ op: 'sit', table: 16, chair: 1, chairs: 4, deck: DECK }), null, 'the room\'s tables');
  // PIN MOVED (AUDIT CARDS-6 C3): a commit names the game and the turn it is for
  assert.deepEqual(validIliacIn({ op: 'commit', table: 0, gameNo: 1, turn: 1, plays: [{ card: 1, holding: 2, junk: 1 }] }), { op: 'commit', table: 0, gameNo: 1, turn: 1, plays: [{ card: 1, holding: 2 }] }, 'projected');
  assert.equal(validIliacIn({ op: 'commit', table: 0, gameNo: 1, turn: 1, plays: [{ card: 1, holding: 3 }] }), null);
  assert.equal(validIliacIn({ op: 'deal', table: 0 }), null, 'the relay deals, never a client');
  const { t, dealt } = ready();
  for (const m of dealt) assert.ok(validIliacOut({ table: 0, now: 1, ...m.frame }), JSON.stringify(m.frame).slice(0, 80));
  assert.ok(validIliacOut({ table: 0, error: 'taken' }));
  assert.equal(validIliacOut({ table: 0, mine: { gameNo: 1, seat: 0, clockAt: 1, view: { ...iliacLook(t, 'a')[1].frame.mine.view, viewer: 1 } } }), false, 'a view for another seat');
  assert.equal(validIliacOut({ table: 0, events: [], state: { ...iliacPublicView(t), seats: [null] } }), false);
  // the wire's arm, its bound, the relay that first deals it
  const sit = JSON.stringify({ t: 'iliac', op: 'sit', table: 0, chair: 0, chairs: 2, deck: DECK });
  assert.deepEqual(parseClient(sit, { hasHello: true }), { t: 'iliac', op: 'sit', table: 0, chair: 0, chairs: 2, deck: DECK });
  assert.deepEqual(parseClient(sit), { error: 'iliac before hello' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'iliac', op: 'sit', table: 0, chair: 0, chairs: 2, deck: DECK, order: 'x'.repeat(ILIAC_FRAME_MAX) }), { hasHello: true }), { error: 'frame too large' });
  // PIN MOVED (at the merges of main): world179 on its branch - main's HOURS-FIRST took world179, TAVERN-TABLES world180
  // and TV-BEYOND world181, none of which deals Iliac Hand, so the relay that first does is world182
  assert.equal(RELAY_VERSION, 'world259');   // PIN MOVED: world259, ASK-LONGER (the word of the company open 30 s, net/eliteGates/egRun.js EG_ASK_MS; world257 on its branch, renumbered past STAFF-EVENT BOSS and KETCH-LONGER at the merge; NOT YET DEPLOYED); PIN MOVED: world258, KETCH-LONGER (the raid retuned: five Watch waves, the wire takes a wave to five; world257 on its branch, renumbered past STAFF-EVENT BOSS at the merge; NOT YET DEPLOYED); PIN MOVED: world257, STAFF-EVENT BOSS (the mini boss stood again when lost, called each time the meter fills, an exact health hp; NOT YET DEPLOYED); PIN MOVED: world256, STAFF-EVENT (staff events: the hub book, a place kill meter, the mini boss; world255 on its branch, renumbered past KETCH at the merge; NOT YET DEPLOYED); PIN MOVED: world255, KETCH (the sky-ketch frame kt in the room of a crew ship, validKetchIn and validKetchOut; world253 on its branch, renumbered past ROCKET1's world253 and AUDIT FOE-KEEPS' world254 at the merge; NOT YET DEPLOYED); PIN MOVED: world254, AUDIT FOE-KEEPS (the open zone kill credit: the word of a fighter that left the zone dying, dd; NOT YET DEPLOYED); PIN MOVED: world253, ROCKET1 (the live event word `rocket`; NOT YET DEPLOYED); PIN MOVED: world252, DECK-POSE (a pose carries its place aboard a boat, validPose `ab`; NOT YET DEPLOYED); PIN MOVED: world251, AUDIT MIXED-PAIR / SPELL-HAND (world249 on its branch, renumbered past STAFF-PANEL5-MONSTERS and HERALD-CARDS at the merge - validPose carries `ah`, the left hand of a pair struck last, so the peers draw a pair in both hands); PIN MOVED: world250, HERALD-CARDS (world243 on its branch, renumbered past PARTY-PING, SPAWN-THIN, AUDIT PISTOLET, SEA VENTURES, STAFF-PANEL5, AUDIT EG-FALL and STAFF-PANEL5-MONSTERS at the merge - every herald post one card of its family - its title, its facts as fields, its colour - and each family a thread of its own in the world events channel, the relay settings gateThread, serpentThread, sdThread and egThread; net/herald/heraldCard.js joins the bundle); PIN MOVED: world249, STAFF-PANEL5-MONSTERS (the staff panel Monster watch counts monsters whatever grantStrip says, and its batch says measured; NOT YET DEPLOYED; world248 on its branch, renumbered past AUDIT EG-FALL at the merge); PIN MOVED: world248, AUDIT EG-FALL (world240 on its branch, renumbered past GUILD-CAP, SD-THROUGH, LEASE1, PARTY-PING, SPAWN-THIN, AUDIT PISTOLET, SEA VENTURES and STAFF-PANEL5 at the merge - a felled Elite Breach lord lies where it fell - net/eliteGates/egLords.js egLordHit stops its walk at its fall, egStop; no word changed); PIN MOVED: world247, STAFF-PANEL5 (the staff panel relay release: follow, Message on screen, the feeds, the staff cut, hidden staff, freeze and the staff chat; NOT YET DEPLOYED); PIN MOVED: world246, SEA VENTURES (world241 on its branch, then world242 and world245, renumbered past SD-THROUGH, LEASE1, PARTY-PING, SPAWN-THIN and AUDIT PISTOLET at the merges - the Eltheric Ocean ventures, one relay: the hub reads a vault of the deep by its cell, a fall signs its room, the referee judges a broadside); PIN MOVED: world245, AUDIT PISTOLET (the siege referee knows the top of the Dwarven Pistolet - SIEGE_PISTOLET - and a duel shot from the off hand of a pair carries the DUAL terms, `off` on a shot as on a swing; world242 on its branch, renumbered past LEASE1, PARTY-PING and SPAWN-THIN at the merge); PIN MOVED: world244, SPAWN-THIN (the overworld keep drops a quarter of the spawn band; world242 on its branch, renumbered past PARTY-PING world243 at the merge); PIN MOVED: world243, PARTY-PING (validPartyPose carries pg); PIN MOVED: world242, LEASE1 (the hub hands each socket a signed lease, its mute and freeze, and the game hands it to every other room it holds; a lease room takes the hub word from one newer than its own); PIN MOVED: world241, SD-THROUGH (a Hollow realm tells the hub its first soul through the Rift, the record keeps `inAt` - the Way Through; world239 then world240 on its branch, renumbered past FOES-FIRST and GUILD-CAP at the merges); PIN MOVED: world240, GUILD-CAP (a guild holds 75 - net/guild/guildLaw.js GUILD_MEMBERS_MAX - and the who-of-my-guild list of the hub 100, net/hubShards.js HUB_GUILD_WHO_MAX, both in the bundle of the relay); PIN MOVED: world239, FIELD BUGS 2026-10-21c FOES-FIRST (a foes room spends its budget on full frames first - a delta keeps a reserve, a full frame may borrow a bounded debt, each sender one first a second and its next frame first once unheard four seconds - and counts the blows its hit funnels drop, HIT-DROPS); PIN MOVED: world237, FIELD BUGS 2026-10-20f (an Elite Breach room tells a striker what each blow landed, eland, and a member at the door why it will not take them, efair; the fair trail sees a member standing still - egStillGap; a held lord answers what it lost; world236 on its branch, renumbered past the LONE-HERALD world236 at the merge); PIN MOVED: world236, FIELD BUGS 2026-10-20d LONE-HERALD (the herald news of a Valkynaz Redoubt carries the size of its company and an entrant to lead it, so a company of one is posted alone; world235 on its branch, renumbered past the Witches Festival and the Starfall world235 at the merge); PIN MOVED: world235, WITCH1 (the Witches Festival words in the token - two titles, an aura, a profile icon pi, the festival cards) and STAR3 (the Starfall: a word at a fallen star, the ledger and receipts its cell keeps, the held stars the hub keeps; world233 on its branch, renumbered past world233 (SD-SEA) and world234 (DEX1) at the merge), one release; PIN MOVED: world234, DEX1 (a foe kind on the wire is a u16, FOE_TYPE_MAX, so the enemy mod 256-398 cross; the enemy table in the relay graph takes a mod rows, customEnemies.js joining it; world225 on its branch, renumbered past the world225-world233 of main at the merges); PIN MOVED: world233, SD-SEA (the Abyss Dungeon census never chooses a region with no town to rise by - the sea above all; world226 on its branch); PIN MOVED: world232, FIELD BUGS 2026-10-19f GAUNTLET-PLATES (each Gauntlet plate said one by one; world224 on its branch, renumbered past world224 to world231 on main at the merges); PIN MOVED: world231, NAME-WORDS (net/nameFilter.js reads `prostitute` and `strangler` anywhere in a word); PIN MOVED: world230, OW-CHASE-RANGE (the chase words beside a traveller mark, bd and sr; world224, then world225, on its branch, renumbered past world224 to world229 of main at the merges); PIN MOVED: world229, WB14 (the Breach portents - the portents of a night on the fight and in its state, `pt`; its crossings by walkway, `xa`; GATE_BRAIN_V 6; the new arsenal, the Vanguard and the Sundering; world223, world224, world225, world226, world227, then world228, on its branch, renumbered past FOE-BOUNDS and GRANT-DOOR, LAYERED-GEAR and VOICE2, GAUNTLET-SLAIN, LORD-SHARES, PLAIN-SWEEP, and QL12 at the merges); PIN MOVED: world228, QL12 (the five questline titles join the vocabulary, net/identityToken.js TITLES; world222 on its branch, renumbered past GATE-DOOR, FOE-BOUNDS, LAYERED-GEAR and VOICE2, GAUNTLET-SLAIN, LORD-SHARES and PLAIN-SWEEP, world222 to world227, at the merges); PIN MOVED: world227, PLAIN-SWEEP (words only - the player-facing lines in the relay's bundle said plainly; world224 on its branch, renumbered past LAYERED-GEAR's world224, GAUNTLET-SLAIN's world225 and LORD-SHARES' world226 at the merges); PIN MOVED: world226, FIELD BUGS 2026-10-19e LORD-SHARES (a Spire lord is stood for the company on the plate of its hall and keeps what the fallen leave; world225 on its branch, renumbered past the world225 of GAUNTLET-SLAIN at the merge; no word on the wire changed); PIN MOVED: world225, GAUNTLET-SLAIN (a slain Gauntlet Caster silences its pillar); PIN MOVED: world224, LAYERED-GEAR and VOICE2 (validLook keeps a look's `lg`, the On foot Layered Gearing Skin; the voice pass's words in the relay's own text; world218 in the package, renumbered past world218-world223 at the merge); PIN MOVED: world223, FOE-BOUNDS and GRANT-DOOR (world219 on its branch, renumbered past the world219 to world222 of main at the merges; a tally says stats, the relay counts what no builder could give, a hello says its spawn grants, and a door asks for them); PIN MOVED: world222, GATE-DOOR and COURT-WATCH (a gate court and its copies admit GATE_HELLO_HZ_MAX hellos a second, a full court keeps its watchers; world218 on its branch, renumbered past GRANT2, EG-PERFECT and FIELD BUGS 2026-10-18d and 2026-10-18f at the merge); PIN MOVED: world221, FIELD BUGS 2026-10-18f (the strike rule one law on both ends, a woken lord said at once, each body with its radius beside its row; world219 on its branch, renumbered past EG-PERFECT and FIELD BUGS 2026-10-18d at the merge); PIN MOVED: world220, FIELD BUGS 2026-10-18d (TWIN-REKINDLE: a Sapper never feeds a fallen lord; BANNER-SHAFT: a shaft or a spell lands on a body of another storey through open air; DUEL-RING: a Challenge in the open said as one); PIN MOVED: world219, EG-PERFECT (the lords' blows fair and whole, spec law 10 THE BROKEN WAY, a fight hall's clocks awaiting its company, the closing's walk, the tube's clock, the voids, the toll's rooms); PIN MOVED: world218, GRANT2 (the spawn grant asked of a cell, minted and measured); PIN MOVED: world217, GROUND-GATE (a hello on an older ground refused in a ground room while groundGate is on); PIN MOVED: world215, SAFE (the chat safety arc and its audit - every chat line stamped, a new voice paced, the reviewer feed, the ban order that closes and refuses, the law door; world214 on its branch, renumbered past WIKIMAID at the merge); PIN MOVED: world214, WIKIMAID (the WikiMaid title, its glyph and the Lilac Warren join the token vocabulary); PIN MOVED: world213, EG-PLAY (the room of an Elite Breach - the hub opening it and calling its company, its halls and their director, its own fight, its receipts; world195 on its branch, renumbered past COATS1, CHAT-LANG, BAL8, SPAWN-REBIRTH, AUDIT ETHER-OW, PEER-ACTS, CHAT-TRADE, FIVE-ASKS, KG-SET, KG5, PVP-LOOT + QUEST-HOME, SERPENT5, ONE-BODY, INSTANCES, WEAPON-GLOW1, HUB-PULL + DO-ASK, TIDY2 and REZ-BLOODLINE + GRAVE-PARTY at the merges); PIN MOVED: world212, REZ-BLOODLINE + GRAVE-PARTY (FIELD BUGS 2026-10-16b; world211 on its branch, renumbered past the TIDY2 world211 of main at the merge - a party pose says a body fallen for good, `fg`, and a Resurrect at it is refused before the caster spends; a cell keeps the graves searched in it, the overworld ledger kind gr, so a party shares a headstone search; world208 on each branch, then world210 on this one, renumbered past main's INSTANCES world208, WEAPON-GLOW1 world209 and HUB-PULL + DO-ASK world210 at the merges); PIN MOVED: world211, TIDY2 (the relay files into feature folders - no behaviour moved; bible/01-Overview/Code-Map.md; world209 on its branch, renumbered past the WEAPON-GLOW1 world209 and the HUB-PULL + DO-ASK world210 of main at the merge); PIN MOVED: world210, HUB-PULL + DO-ASK (the bus never calls a shard - each shard polls its bus; the Worker asks a room reset before it ran once more; world208 then world209 on its branch, renumbered past the INSTANCES world208 and the WEAPON-GLOW1 world209 of main at the merges); PIN MOVED: world209, WEAPON-GLOW1 (a weapon in a hand carries its glow on the look, a word; world208 on its branch, renumbered past the INSTANCES world208 of main at the merge); PIN MOVED: world208, INSTANCES (an instance is a world room of its own - a dungeon whole or a building, its owner and epoch after it, admitted to its owner, staff and the party of its owner alone; world206 then world207 on its branch, renumbered past SERPENT5 and ONE-BODY at the merges); PIN MOVED: world207, ONE-BODY (FIELD BUGS 2026-10-15c - one body an account in a cell or a dungeon, the older socket closed as replaced; world206 on its branch, renumbered past the SERPENT5 world206 of main at the merge); PIN MOVED: world206, SERPENT5 (Coilbreaker and The Maelstrom join the token vocabulary; world205 on its branch, renumbered past PVP-LOOT + QUEST-HOME world205 of main at the merge); PIN MOVED: world205, PVP-LOOT + QUEST-HOME (the friend law is the law of the drop alone - the worn piece a killer picks is theirs whoever the guild or party of the fallen counts them; the hub fans a home the service signed as moved to every page online and holds its word for a page that joins after; bible/01-Overview/bugs/Field-Bugs-2026-10-14.md QUEST-HOME; world201 on each branch, one bump past FIVE-ASKS at the merge, world203 on the integration, renumbered past KG-SET world203 and KG5 world204 at the merge of main); PIN MOVED: world204, KG5 (the relay runs The King's Gambit - a gambit frame, four files more in the bundle; KG6: the gold table's stakes and a rated game's signed result; world203 on its branch, renumbered past FIVE-ASKS's world202 at the merge); PIN MOVED: world203, KG-SET (the Iliac catalog without its words, and nine cards more - Kings-Gambit.md section 10.3; world201 then world202 on its branch, renumbered past CHAT-TRADE's world201 and FIVE-ASKS's world202 at the merges); PIN MOVED: world202, FIVE-ASKS (the dungeon respawn half an hour, I Love Lamp a title the relay knows; world201 on its branch, renumbered past the CHAT-TRADE world201 of main at the merge); PIN MOVED: world201, CHAT-TRADE (the Trade and LFG channels, `chat:trade` and `chat:lfg`, joined CHAT_ROOMS); PIN MOVED: world200, PEER-ACTS (the pose carries a gathering act - the act, its beats and the throw of the net; world199 on its branch, renumbered past the AUDIT ETHER-OW world199 of main at the merge); PIN MOVED: world199, AUDIT ETHER-OW C2-1 (one home for the ground the Watch mints on - watchPixelOk, its answers as they were); PIN MOVED: world198, SPAWN-REBIRTH (a cell keeps the row of a spawned dungeon until it stands again, never sixty real days); PIN MOVED: world197, BAL8 (the PvP referee and its one harm ceiling - every fighter, blows and casts together at most 180 in any 5 s); PIN MOVED: world196, CHAT-LANG (the language channels joined the whitelist) over world195, COATS1 (the horse look: rc on a mounted pose, hc on a parked word; world194 on its branch, renumbered past SLIM-FRAME at the merge); PIN MOVED: world194, SLIM-FRAME (the place on the second wire in its own units - every height in meters to the centimetre, the x and z of a dungeon, a town and a building too, those of a cell in whole world units); PIN MOVED: world193, SERPENT4 (the sea serpent reworked - its waters open until it dives, hands strike it with their own weapons, a party shares the kill, its girth; its law version 3 - world192 on its branch, renumbered past SCALE5c at the merge); PIN MOVED: world192 (past WARDEN1, world191 on main, at the merge), SCALE5c (the hub split sixteen ways - the shards hold the sockets, the bus runs every law over a virtual socket for each; a search of everyone online by name, and the guild online on every shard); PIN MOVED: world191, SCALE5b (the second wire - batched slim poses, a channel roster and a beat in one frame - the relay hygiene, its metrics and run-time settings, the halo referee word); PIN MOVED: world190, AUDIT MW-NPC II (the foe look on the wire - world188, then world189, on its branch, renumbered past INT11-INT14 and SCALE5a at the merges); PIN MOVED: world189, SCALE5a (the hub's hello and leave without a walk of every socket; a busy refusal's token unread); PIN MOVED: world188, INT11-INT14 (the INTEGRITY arc's lane 3 - world186 on its branch, renumbered past SD-HERALD's world186 and WAGONS1's world187 at the merge); PIN MOVED (the Chapters' merge of main): CHAP4c and CHAP6e's titles moved it on past CARDS10's world182
  assert.equal(ILIAC_RELAY_MIN, 182);
  assert.ok(relaySupportsIliac('world182'));
  assert.ok(!relaySupportsIliac('world181'), 'an older relay closes the socket on the frame - TV-BEYOND\'s');
  assert.ok(!relaySupportsIliac('world180'), 'and TAVERN-TABLES\'');
  assert.ok(!relaySupportsIliac('world179'), 'and HOURS-FIRST\'s, the number this slice had on its branch');
});

test('CARDS10 a ranked game\'s receipt (i1): minted, read and verified; the arena\'s refused by it and it by the arena\'s; a draw said one way; the deck order a kind of its own', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const nowS = 1_800_000_000;
  const what = { j: '0123456789abcdef', f: ['acct-a', 'acct-b'], r: 1, h: 'holdings' };
  const rc = await mintIliacReceipt(what, kp.privateKey, { subtle, nowS });
  assert.ok(rc.startsWith(`${ILIAC_RECEIPT_V}.`));
  assert.deepEqual({ ...readIliacReceipt(rc), i: 0, e: 0 }, { ...what, i: 0, e: 0, signed: true });
  assert.equal((await verifyIliacReceipt(rc, kp.publicKey, { subtle, nowS })).ok, true);
  // a signature character changed, well inside it: the last two carry the signature's last byte - the top of
  // Ed25519's S, always under 0x10 - which a fresh key leaves 0, 'AA' already, about one run in 16 (a deploy's
  // shard did), and that receipt was never tampered
  const at = rc.length - 10;
  const tampered = rc.slice(0, at) + (rc[at] === 'A' ? 'B' : 'A') + rc.slice(at + 1);
  assert.equal((await verifyIliacReceipt(tampered, kp.publicKey, { subtle, nowS })).why, 'signature');
  assert.equal((await verifyIliacReceipt(rc, kp.publicKey, { subtle, nowS: nowS + 8 * 86400 })).why, 'expired');
  const unsigned = await mintIliacReceipt(what, null, { subtle, nowS });
  assert.equal((await verifyIliacReceipt(unsigned, kp.publicKey, { subtle, nowS })).why, 'unsigned');
  const arena = await mintArenaReceipt({ a: 'p', j: what.j, f: what.f, r: 1, h: 'fall' }, kp.privateKey, { subtle, nowS });
  assert.equal((await verifyIliacReceipt(arena, kp.publicKey, { subtle, nowS })).why, 'version');
  assert.equal((await verifyArenaReceipt(rc, kp.publicKey, { subtle, nowS })).why, 'version');
  assert.deepEqual(ILIAC_HOW, ['holdings', 'power', 'draw', 'left']);
  assert.equal(iliacReceiptValid({ ...what, r: 2, i: 1, e: 2 }), false, 'a draw is how: draw');
  assert.equal(iliacReceiptValid({ ...what, h: 'draw', i: 1, e: 2 }), false, 'and how: draw is a draw');
  assert.equal(iliacReceiptValid({ ...what, f: ['acct-a', 'acct-a'], i: 1, e: 2 }), false, 'two accounts');
  assert.equal(iliacReceiptValid({ ...what, a: 'p', i: 1, e: 2 }), false, 'no arena field');
  await assert.rejects(mintIliacReceipt({ ...what, j: 'nope' }, null, { subtle, nowS }));
  // the deck order: its digest the deck's set, sorted
  assert.ok(ORDER_KINDS.includes('deck'));
  assert.equal(deckDigestText(['b', 'a', 'a']), 'a,a,b');
  const dh = await deckDigest(DECK, { subtle });
  assert.equal(dh, await deckDigest([...DECK].reverse(), { subtle }), 'an order of the same thirty is the same deck');
  assert.match(dh, /^[0-9a-f]{64}$/);
  const order = await mintDeckOrder({ s: 'acct-a', dh }, kp.privateKey, { subtle, nowS });
  const v = await verifyOrder(order, kp.publicKey, { subtle, nowS, kind: 'deck' });
  assert.deepEqual([v.ok, v.claims.s, v.claims.dh], [true, 'acct-a', dh]);
  assert.equal((await verifyOrder(order, kp.publicKey, { subtle, nowS, kind: 'stake' })).ok, false, 'a deck order is no stake');
  assert.equal(orderValid({ o: 'mute', s: 'acct-a', mu: 0, dh, i: 1, e: 2 }), false, 'no other kind carries a digest');
  assert.equal(orderValid({ o: 'deck', s: 'acct-a', dh: 'xyz', i: 1, e: 2 }), false);
  assert.ok(TITLES.includes('iliacchampion'), 'the title in the vocabulary');
});

// ── the relay itself ─────────────────────────────────────────────────────────────────────────────────────────────
const ROOM = 'interior:m100.200';
const gateKey = subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']).then(async (kp) => ({ b64: Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64'), pub: kp.publicKey }));
async function withRoom(fn, key = ROOM) {
  const r = fakeRoom(key);
  const g = await gateKey;
  r.env.GATE_SIGNING_KEY = g.b64;
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  _tick = (ms) => { clock += ms; };
  try { await fn({ r, tick: (ms) => { clock += ms; }, nowS: () => Math.floor(clock / 1000), gatePub: g.pub }); } finally { Date.now = realNow; _tick = () => {}; }
}
let _tick = () => {};
const iliac = (ws) => ws.sent.filter((m) => m.t === 'iliac');
const word = (r, ws, o) => { _tick(300); return r.raw(ws, JSON.stringify({ t: 'iliac', ...o })); };
const join = async (r, id) => { const w = r.connect(); await r.hello(w, id, null, { name: id }); return w; };
const sit = (r, ws, chair, extra = {}) => word(r, ws, { op: 'sit', table: 0, chair, chairs: 4, deck: DECK, ...extra });

test('CARDS10 the relay: two seated in a tavern\'s room and a third watching, each told only his own hand; the alarm deals and keeps the clock; a socket gone concedes; the table kept across a hibernation; nothing outside an interior', () => withRoom(async ({ r, tick }) => {
  const a = await join(r, 'peer-a'), b = await join(r, 'peer-b'), c = await join(r, 'peer-c');
  await sit(r, a, 0);
  await sit(r, b, 2);
  assert.deepEqual(iliac(c).at(-1).state.seats.map((s) => s?.chair ?? null), [0, 2], 'the watcher told the seats');
  assert.equal(r.room._iliac.get(0).seats.length, 2);
  r.wake();   // hibernated between the sits and the deal: the table is kept
  tick(ILIAC_FIRST_MS); await r.fire();
  const mineA = iliac(a).filter((m) => m.mine), mineB = iliac(b).filter((m) => m.mine);
  assert.equal(mineA.length, 1); assert.equal(mineB.length, 1);
  assert.equal(iliac(c).filter((m) => m.mine).length, 0, 'the watcher sees no hand');
  assert.equal(mineA[0].mine.view.players[0].hand.length, 4);
  for (const m of iliac(c)) assert.ok(validIliacOut(m), 'every frame the client\'s law takes');
  // a commit, and the other seat's clock runs out on the alarm
  await word(r, a, { op: 'commit', table: 0, gameNo: 1, turn: 1, plays: [] });   // PIN MOVED (AUDIT CARDS-6 C3): its game and turn named
  assert.ok(iliac(c).at(-1).events.some((e) => e.t === 'commit' && e.seat === 0));
  tick(ILIAC_TURN_MS); await r.fire();
  assert.ok(iliac(c).at(-1).events.some((e) => e.t === 'turn' && e.turn === 2), 'the clock turned it over');
  await word(r, c, { op: 'commit', table: 0, gameNo: 1, turn: 2, plays: [] });
  assert.equal(iliac(c).at(-1).error, 'not seated');
  // the third cannot sit at a full table; one gone concedes
  await sit(r, c, 1);
  assert.equal(iliac(c).at(-1).error, 'full');
  await r.drop(b);
  const end = iliac(a).flatMap((m) => m.events ?? []).find((e) => e.t === 'end');
  assert.deepEqual([end.winner, end.how], [0, 'left'], 'a socket gone concedes');
  await word(r, a, { op: 'stand', table: 0 });
  assert.equal(r.store.get('iliac'), undefined, 'the table forgotten');
  // a hallway keeps no table
  await withRoom(async ({ r: h }) => {
    const x = await join(h, 'peer-x');
    await word(h, x, { op: 'sit', table: 0, chair: 0, chairs: 4, deck: DECK });
    assert.equal(iliac(x).length, 0);
    assert.ok(!h.room._iliac?.size, 'no table kept');
    assert.equal(h.store.get('iliac'), undefined);
  }, 'world');
}));

test('CARDS10 the relay: a ranked seat\'s deck order checked (its account, its digest); a ranked game\'s result signed and handed to both; one cloth one game - Hold\'em refused at an Iliac table and Iliac at a Hold\'em one', () => withRoom(async ({ r, tick, nowS, gatePub }) => {
  const a = await join(r, 'peer-a'), b = await join(r, 'peer-b');
  const kp = await r.signer();
  const dh = await deckDigest(DECK, { subtle });
  const orderOf = (s, digest = dh) => mintDeckOrder({ s, dh: digest }, kp.privateKey, { subtle, nowS: nowS() });
  await sit(r, a, 0, { order: await orderOf('acct-peer-b') });
  assert.equal(iliac(a).at(-1).error, 'deck refused', 'another account\'s order');
  const other = await deckDigest(['x'], { subtle });
  await sit(r, a, 0, { order: await orderOf('acct-peer-a', other) });
  assert.equal(iliac(a).at(-1).error, 'deck refused', 'another deck\'s order');
  await sit(r, a, 0, { order: await orderOf('acct-peer-a') });
  await sit(r, b, 1, { order: await orderOf('acct-peer-b') });
  assert.equal(r.room._iliac.get(0).seats.every((s) => s.sub), true, 'both ranked');
  // Hold'em at this cloth is refused while the game sits
  _tick(300); await r.raw(a, JSON.stringify({ t: 'holdem', op: 'sit', table: 0, chair: 3, chairs: 4, bb: 10 }));
  const c = await join(r, 'peer-c');
  _tick(300); await r.raw(c, JSON.stringify({ t: 'holdem', op: 'sit', table: 0, chair: 3, chairs: 4, bb: 10 }));
  assert.equal(c.sent.filter((m) => m.t === 'holdem').at(-1).error, 'other game');
  tick(ILIAC_GAP_MS); await r.fire();   // PIN MOVED (AUDIT CARDS-6 C5/D2): two ranked seats' first game waits the gap
  assert.ok(iliac(a).some((m) => m.events?.some((e) => e.t === 'game' && e.ranked)), 'a ranked game');
  await word(r, b, { op: 'stand', table: 0 });
  const ra = iliac(a).filter((m) => m.receipt).map((m) => m.receipt), rb = iliac(b).filter((m) => m.receipt).map((m) => m.receipt);
  assert.equal(ra.length, 1, 'the winner holds the result');
  assert.deepEqual(rb, ra, 'and the loser the same bytes');
  const v = await verifyIliacReceipt(ra[0], gatePub, { subtle, nowS: nowS() });
  assert.ok(v.ok, v.why);
  assert.deepEqual([v.claims.f, v.claims.r, v.claims.h], [['acct-peer-a', 'acct-peer-b'], 0, 'left']);
  assert.equal(r.room._iliac.get(0).results.length, 0, 'signed, let go');
  // and Iliac refused at a cloth Hold'em holds - PIN MOVED (TAVERN-TABLES, at the merge): table 1 is the room's gold table
  // (net/holdemTable.js HOLDEM_GOLD_TABLE), which seats no chips sit, so the chips cloth is table 2, Iliac's next table 3
  await word(r, a, { op: 'stand', table: 0 });
  _tick(300); await r.raw(c, JSON.stringify({ t: 'holdem', op: 'sit', table: 2, chair: 0, chairs: 4, bb: 10 }));
  await word(r, a, { op: 'sit', table: 2, chair: 1, chairs: 4, deck: DECK });
  assert.equal(iliac(a).at(-1).error, 'other game');
  // sitting at Iliac stands a player up from Hold'em
  await word(r, c, { op: 'sit', table: 3, chair: 0, chairs: 4, deck: DECK });
  assert.ok(!r.room._holdem.get(2)?.seats.some((s) => s?.id === 'peer-c'), 'one seat in a room at a time');
}));
