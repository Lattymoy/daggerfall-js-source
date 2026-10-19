// PARTY-SKIN (PR B, test-harness/loot-followups/DESIGN-B.md section 8 - the red-test contract; bible/06-Systems/Professions-Arc.md 5.2,
// bible/06-Systems/Online-Arc.md PARTY-SKIN): ONE SKIN PER BODY, WHOEVER MAY LOOT IT MAY SKIN IT, FIRST COME, JUDGED BY ITS AUTHORITY.
//
// The decisions this file pins (Travis, 2026-10-19):
//   - "bodies can be skinned only once by anyone which I think aligns with your recommendations"
//   - "it should follow whatever loot rules are in main, if anyone means anyone then that should follow skinning too - the important
//     piece is that a body can only be skinned once"
//   - "skinning an empty body should still work, yes but it should also show the 'Skin' pop-up"
//   - "whatever the loot rules are on main should be consistent here"
// TODAY a body is a Hunting node only for the player whose own blow felled it (the private stamp: scenes/huntHost.js createBodyStamps),
// so two players who both felled nothing have no node at all, and a party member sees nothing over the body it stands beside.
//
// MOUNTED, NOT MATCHED (DESIGN-B 8). Each player is the REAL pool (createExteriorFoes - the street's, and a building's as worldModes.js
// wires it) behind the REAL hit queue, joined by the relay stand-in (./bodyLootHarness.mjs); each skinner is the REAL gathering host
// (scenes/gatherHost.js) with Hunting's REAL kind (huntKind over bodiesHere), the real stamps registered as world.js registers them, the
// real act (systems/traceAct.js) drawn along its own line to a harvest, a real profession book over a door that answers as the service does
// (./skinHarness.mjs), and the kill credit is the game's (reportPlayerKill, the strike ledger). The dungeon's twin is
// test/net/partyskin_dungeon.test.js. Nothing under test is stood in for.
//
// The wire these pins read (DESIGN-B 2 and 3): the owner's foes frame carries `bs: [[ref, id, s, cid], ...]` - `ref` the body's number,
// `id` twelve hex digits minted at the death, `s` 0 open / 1 held / 2 skinned / 3 the killer's own (an older striker's), `cid` the claim
// id that holds or skinned it; a claim is a hit `sq: [cid, id, op]` - op 1 HOLD (and its renewals), 2 DONE, 0 RELEASE, 3 UNSKIN.
// The times are the design's: a lease renewed every 2 s, lapsing 12 s after the holder's last word, at most 30 s from its grant.
//
// Run on the tree this file was written against (1fb6256872) every RED pin fails by its assertion, never by an error; the guards (named
// so) are green there or fail at the first line a non-killer's node is needed, and must stay green.
import '../chargenDom.mjs';
import '../modsOff.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { armorOfMaterial } from '../../src/combat/enemyEquipment.js';
import { mintHealingPotion } from '../../src/systems/healingSupply.js';
import { bodyKey } from '../../src/net/nodeLaw.js';
import { KNIFE_REFUSALS } from '../../src/net/professionLaw.js';
import { ACT_STOPPED_LINE } from '../../src/scenes/gatherHost.js';
import { registerPlayerKillListener } from '../../src/systems/playerKills.js';
import {
  PILE, pieceOf, GOLD, restoreRandom, scene, lootWindow, choosing, run, SETTLED_MS, onRay, leave, lcg, offlineOwner, clock, actor, as, FOES_FULL_MS,
} from './bodyLootHarness.mjs';
import {
  hunter, unhunt, go, traceAll, until, strike, bsOf, bsHistory, sqLog, DAY, utc, skinWorld, knifeOf, TOWN, SEA, NIGHT,
} from './skinHarness.mjs';

afterEach(() => { restoreRandom(); unhunt(); registerPlayerKillListener('count', null); });

const BOB = 'bob-0002', MAC = 'mac-0001', EVE = 'eve-0003', ZED = 'zed-0004';
// the design's times (DESIGN-B 3.5) and words
const SKIN_LEASE_MS = 12_000, SKIN_HOLD_MAX_MS = 30_000;
const TAKEN = 'Someone else is skinning that.';
const [HOLD, DONE, RELEASE, UNSKIN] = [1, 2, 0, 3];
const [OPEN, HELD, SKINNED, OWNS] = [0, 1, 2, 3];
const READY = 'Skin the Rat | ready', BEING = 'Skin the Rat | being skinned', SKINNED_LINE = 'The Rat - skinned | ';
const promptOf = (h) => h.row();
const keyOfId = (id) => bodyKey({ day: DAY, id });
const ID_RE = /^[0-9a-f]{12}$/;
const WHERES = ['street', 'building'];
/** Bob's streamed skin entry for the body, with the words a failing line needs. */
const entryOf = (s) => bsOf(s.net, BOB, s.rat.seq);
const said = (e) => (e ? JSON.stringify(e) : 'none (the foes frames carry no `bs` for this body)');
const asks = (...hs) => hs.flatMap((h) => h.asked);
const noNode = (h, why) => { const t = h.aim(); assert.equal(t, null, `${h.p.id} has a node over the body (${why}); prompt ${promptOf(h)}`); };

/** The harvest asked for a body, whoever asked it: at most one, keyed by the id the owner streamed. */
function oneHarvest(s, hs, who) {
  const all = asks(...hs);
  assert.equal(all.length, 1, `exactly one hide is asked for the body across every skinner (asked: ${hs.map((h) => `${h.p.id} ${h.asked.length}`).join(', ')})`);
  assert.equal(all[0].account, who, `and it is ${who}'s`);
  const e = entryOf(s);
  assert.ok(e && ID_RE.test(e[1]), `the owner streamed the body's id: ${said(e)}`);
  assert.equal(all[0].node, keyOfId(e[1]), `the harvest's node is body:<the skinner's day>:<the id in the owner's bs> (${all[0].node})`);
  return e;
}

// ═══ AC1 / AC2 - WHOEVER MAY LOOT IT SKINS IT ═════════════════════════════════════════════════════════════════════════════════════════
for (const where of WHERES) {
  test(`S1 PARTY-SKIN AC1 (${where}): Bob's foe falls to Bob's blow and Bob has no knife; Mac, a peer in reach with one, is shown "Skin the Rat" over Bob's body and skins it - ONE harvest, Mac's, keyed body:<Mac's day>:<the id in Bob's bs>`, async () => {
    const s = await scene(where, [MAC]);
    const mac = await hunter(s, s.mac);
    go(s.net, 600);
    const target = mac.aim();
    assert.ok(target, `PARTY-SKIN/AC1: Mac's gather host has no target over the body Bob's blow felled (prompt ${promptOf(mac)}) - a body is a node only for the one whose own blow felled it`);
    const e = entryOf(s);
    assert.ok(e && ID_RE.test(e[1]) && e[2] === OPEN, `PARTY-SKIN/AC1: Bob's foes frame carries the body's skin entry [ref, id, 0]: ${said(e)}`);
    assert.equal(promptOf(mac), READY, 'the Skin row names the act');
    assert.equal(target.node.key, keyOfId(e[1]), 'and the node is keyed by the shared id Bob streamed');
    assert.equal(mac.host.press(), true, 'the press starts the act');
    await mac.trace(s.net);
    const last = oneHarvest(s, [mac], MAC);
    assert.deepEqual([last[2], String(last[3]).startsWith(`${MAC}:`)], [SKINNED, true], `Bob's stream ends SKINNED to Mac's claim: ${said(last)}`);
    const skinnedAt = bsHistory(s.net, BOB, s.rat.seq).find((x) => x.entry[2] === SKINNED)?.at;
    assert.ok(skinnedAt != null && mac.asked[0].at >= skinnedAt, 'no hide was asked before the owner\'s stream said the body is skinned');
    const ops = sqLog(s.net, MAC).map((x) => x.op);
    assert.deepEqual([ops[0], ops.includes(DONE), ops.includes(RELEASE), ops.includes(UNSKIN)], [HOLD, true, false, false], `Mac's words to Bob: a HOLD from the act's start, then DONE (${ops})`);
  });
}

test('S1b PARTY-SKIN AC1 + AC13: Eve\'s blow kills Bob\'s foe through the strike ledger (her kill report lands once) and the body is open; Eve has no knife; Mac skins it - and Eve\'s kill report still lands exactly once', async () => {
  let kills = 0;
  registerPlayerKillListener('count', () => { if (actor.id === EVE) kills++; });
  const s = await scene('street', [MAC, EVE], { kill: false });
  strike(s, s.eve);
  go(s.net, 2000);
  assert.equal(kills, 1, 'Eve\'s killing blow was reported to her once (the owner\'s `slain`, the strike ledger)');
  const mac = await hunter(s, s.mac);
  go(s.net, 600);
  const target = mac.aim();
  assert.ok(target, `PARTY-SKIN/AC1+AC13: Mac has no target over the body Eve's blow felled (prompt ${promptOf(mac)})`);
  const e = entryOf(s);
  assert.equal(e?.[2], OPEN, `the killing blow carried the new build's mark, so the body is open to all, not Eve's own: ${said(e)}`);
  assert.equal(mac.host.press(), true);
  await mac.trace(s.net);
  oneHarvest(s, [mac], MAC);
  go(s.net, 3000);
  assert.equal(kills, 1, 'Eve\'s kill report landed exactly once, whoever skinned');
});

// ═══ AC2 / AC3 - ONE SKIN, FIRST COME, FROM THE ACT'S START ═══════════════════════════════════════════════════════════════════════════
for (const [first, second] of [[EVE, MAC], [MAC, EVE]]) {
  test(`S2 PARTY-SKIN AC2/AC3: Mac and Eve press Skin in the same tick, ${first}'s claim reaching Bob first - ONE harvest, ${first}'s; Bob's stream ends SKINNED to ${first}'s claim; ${second}'s act is stopped and told "${TAKEN}"`, async () => {
    const s = await scene('street', [MAC, EVE]);
    s.net.late.set(`${second}>${BOB}`, 300);
    const [mac, eve] = [await hunter(s, s.mac), await hunter(s, s.eve)];
    go(s.net, 600);
    assert.ok(mac.aim() && eve.aim(), `PARTY-SKIN/AC2: both have a node over Bob's body (Mac: ${promptOf(mac)}, Eve: ${promptOf(eve)})`);
    assert.equal(mac.host.press(), true);
    assert.equal(eve.host.press(), true);
    await traceAll(s.net, [mac, eve]);
    const [w, l] = first === MAC ? [mac, eve] : [eve, mac];
    const e = oneHarvest(s, [mac, eve], first);
    assert.equal(e[2], SKINNED);
    assert.ok(String(e[3]).startsWith(`${first}:`), `the stream is skinned to the first claim Bob received (${said(e)})`);
    assert.ok(l.seen.toasts.includes(ACT_STOPPED_LINE), `the loser's act is stopped (${JSON.stringify(l.seen.toasts)})`);
    assert.ok(l.p.said.includes(TAKEN), `and told "${TAKEN}" (${JSON.stringify(l.p.said)})`);
    assert.equal(l.asked.length, 0, 'and asks nothing');
    assert.equal(w.asked.length, 1);
  });
}

test('S2b PARTY-SKIN AC2/AC3: Bob (the authority, with a knife) and Mac press in the same breath - Bob\'s local judgment is first come with what he has received; one harvest across both books', async () => {
  let bobH = null;
  const s = await scene('street', [MAC], { armed: async (c) => { bobH = await hunter(c, c.bob, { stand: false }); } });
  bobH.stand(); bobH.look();
  const mac = await hunter(s, s.mac);
  go(s.net, 600);
  assert.ok(mac.aim(), `PARTY-SKIN/AC2: Mac has a node over Bob's body (${promptOf(mac)})`);
  assert.ok(bobH.aim(), 'and Bob has one over his own');
  assert.equal(mac.host.press(), true);
  assert.equal(bobH.host.press(), true);
  await traceAll(s.net, [mac, bobH]);
  const e = oneHarvest(s, [mac, bobH], BOB);
  assert.equal(e[2], SKINNED);
  assert.equal(mac.asked.length, 0, 'Mac\'s claim reached Bob after his own, and was refused');
  assert.ok(mac.p.said.includes(TAKEN), 'Mac is told');
});

// ═══ AC4 - SEEN BY THE OTHERS ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
test('S3 PARTY-SKIN AC4: Mac skins the body while Eve looks at it - Eve\'s prompt is "Skin the Rat" / "being skinned", her press starts nothing and her menu row is refused with its reason; after Mac\'s harvest her prompt reads "The Rat - skinned"', async () => {
  const s = await scene('street', [MAC, EVE]);
  const [mac, eve] = [await hunter(s, s.mac), await hunter(s, s.eve)];
  go(s.net, 600);
  assert.ok(mac.aim(), `Mac has a node (${promptOf(mac)})`);
  assert.equal(mac.host.press(), true);
  go(s.net, 600);
  eve.look();
  go(s.net, 100);
  assert.equal(promptOf(eve), BEING, 'PARTY-SKIN/AC4: Eve\'s Skin row while Mac holds the body: refused with its reason');
  assert.notEqual(eve.seen.prompt, null, 'and the prompt is drawn');
  eve.host.press();
  assert.equal(eve.acting, false, 'her press starts no act');
  await traceAll(s.net, [mac]);
  oneHarvest(s, [mac, eve], MAC);
  go(s.net, 600);
  assert.equal(promptOf(eve), SKINNED_LINE, 'after the harvest Eve\'s Skin row names the body skinned');
});

// ═══ AC5 - THE LEASE ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
for (const how of ['escape', 'walk off']) {
  test(`S4 PARTY-SKIN AC5 (${how}): Mac starts and abandons the act - RELEASE reaches Bob, Eve's prompt is ready within one round trip (never the lease), Eve skins; ONE harvest`, async () => {
    const s = await scene('street', [MAC, EVE]);
    const [mac, eve] = [await hunter(s, s.mac), await hunter(s, s.eve)];
    go(s.net, 600);
    assert.ok(mac.aim(), `PARTY-SKIN/AC5: Mac has a node (${promptOf(mac)})`);
    assert.equal(mac.host.press(), true);
    go(s.net, 600);
    assert.equal(promptOf(eve), BEING, 'Eve sees the body held');
    const at = clock.t;
    if (how === 'escape') mac.cancel(); else mac.p.feet[2] -= 6;
    assert.ok(until(s.net, () => promptOf(eve) === READY, 1000), `Eve's prompt is ready within a round trip of the abandoned act, not a lease later (it reads ${promptOf(eve)} ${clock.t - at} ms on)`);
    assert.ok(sqLog(s.net, MAC).some((x) => x.op === RELEASE), 'Mac told Bob RELEASE');
    mac.p.feet[2] = eve.p.feet[2];
    assert.equal(eve.host.press(), true);
    await traceAll(s.net, [eve]);
    oneHarvest(s, [mac, eve], EVE);
  });
}

test('S5 PARTY-SKIN AC5/AC6: Mac\'s socket goes half-open mid-act - Eve reads "being skinned" until SKIN_LEASE_MS after Mac\'s last HOLD, then ready; Eve skins; Mac\'s act asks no harvest', async () => {
  const s = await scene('street', [MAC, EVE]);
  const [mac, eve] = [await hunter(s, s.mac), await hunter(s, s.eve)];
  go(s.net, 600);
  assert.ok(mac.aim(), `PARTY-SKIN/AC5: Mac has a node (${promptOf(mac)})`);
  assert.equal(mac.host.press(), true);
  go(s.net, 4300);
  assert.equal(promptOf(eve), BEING);
  s.net.dead.add(MAC);
  const last = sqLog(s.net, MAC).filter((x) => x.op === HOLD).at(-1);
  assert.ok(last, 'Mac said HOLD');
  await traceAll(s.net, [mac], { waitMs: 0 });
  until(s.net, () => clock.t >= last.at + SKIN_LEASE_MS - 1000, 20000);
  assert.equal(promptOf(eve), BEING, 'a second short of the lease: still held');
  assert.ok(until(s.net, () => promptOf(eve) === READY, 4000), 'and then free');
  const lapse = clock.t - last.at;
  assert.ok(lapse >= SKIN_LEASE_MS && lapse <= SKIN_LEASE_MS + 1000, `the lease lapsed ${lapse} ms after Mac's last word (SKIN_LEASE_MS ${SKIN_LEASE_MS})`);
  assert.equal(eve.host.press(), true);
  await traceAll(s.net, [eve]);
  go(s.net, 15000);
  oneHarvest(s, [mac, eve], EVE);
  assert.equal(mac.asked.length, 0, 'Mac\'s act, cut off from the authority, asks no hide');
});

test('S5b PARTY-SKIN AC5: an act that slips for ever - Mac holds and renews past SKIN_HOLD_MAX_MS - is refused its renewal and its act stopped; Eve then skins', async () => {
  const s = await scene('street', [MAC, EVE]);
  const [mac, eve] = [await hunter(s, s.mac), await hunter(s, s.eve)];
  go(s.net, 600);
  assert.ok(mac.aim(), `PARTY-SKIN/AC5: Mac has a node (${promptOf(mac)})`);
  const t0 = clock.t;
  assert.equal(mac.host.press(), true);
  go(s.net, SKIN_HOLD_MAX_MS - 1500);
  assert.equal(promptOf(eve), BEING, 'Mac still holds it just short of the cap, renewing');
  assert.ok(sqLog(s.net, MAC).filter((x) => x.op === HOLD).length >= 10, 'Mac renewed every SKIN_RENEW_MS');
  assert.ok(until(s.net, () => promptOf(eve) === READY, 6000), 'past SKIN_HOLD_MAX_MS the body is Eve\'s to claim');
  assert.ok(clock.t - t0 >= SKIN_HOLD_MAX_MS - 500, `and not before the cap (${clock.t - t0} ms)`);
  assert.equal(mac.acting, false, 'Mac\'s act was stopped');
  assert.ok(mac.seen.toasts.includes(ACT_STOPPED_LINE), 'and he was told');
  const grants = bsHistory(s.net, BOB, s.rat.seq).filter((x) => x.entry[2] === HELD && String(x.entry[3]).startsWith(`${MAC}:`));
  const firstOpenAfter = bsHistory(s.net, BOB, s.rat.seq).find((x) => x.entry[2] === OPEN && x.at > grants[0].at)?.at;
  assert.ok(firstOpenAfter && !grants.some((x) => x.at > firstOpenAfter), 'the stream never gave Mac the body again after the cap');
  assert.equal(eve.host.press(), true);
  await traceAll(s.net, [eve]);
  oneHarvest(s, [mac, eve], EVE);
});

// ═══ AC1 - THE AUTHORITY JUDGES ELIGIBILITY (A1/C7), A FORGED WORD IS NOTHING ═════════════════════════════════════════════════════════════
test('S6 PARTY-SKIN AC1 (guard + red): Zed 20 m off has no node (guard); a FORGED claim from Zed\'s socket, and one naming Mac\'s claim id from a peer in reach, leave Bob\'s entry OPEN - Mac then claims and skins', async () => {
  const s = await scene('street', [MAC, ZED], { ghosts: ['forge-0005'] });
  const [mac, zed] = [await hunter(s, s.mac), await hunter(s, s.them[1])];
  zed.p.feet[2] -= 20;
  zed.look();
  go(s.net, 600);
  noNode(zed, 'Zed stands 20 m from the body: beyond the knife\'s reach');
  const e0 = entryOf(s);
  assert.ok(e0 && e0[2] === OPEN, `PARTY-SKIN/AC1: Bob's frame carries bs [seq, id, 0] for the body: ${said(e0)}`);
  assert.equal(s.net.sendHit(ZED, s.frame(BOB, { sq: [`${ZED}:fake:1`, e0[1], HOLD] })), true, 'Zed\'s socket sends a HOLD it has no standing to');
  assert.equal(s.net.sendHit('forge-0005', s.frame(BOB, { sq: [`${MAC}:fake:7`, e0[1], HOLD] })), true, 'and a stranger names Mac\'s claim id');
  go(s.net, 1500);
  assert.equal(entryOf(s)[2], OPEN, `Bob's entry is still open after both forgeries: ${said(entryOf(s))}`);
  assert.equal(mac.aim() !== null, true);
  assert.equal(mac.host.press(), true);
  await mac.trace(s.net);
  oneHarvest(s, [mac, zed], MAC);
});

test('S6b PARTY-SKIN (guard): no knife in Mac\'s main pack - no node, no prompt; a body of a foe no knife takes a hide from - no entry, and no node for a player who holds a knife', async () => {
  const s = await scene('street', [MAC]);
  const mac = await hunter(s, s.mac, { knife: null });
  go(s.net, 600);
  noNode(mac, 'no Skinning Knife in the pack');
  assert.equal(mac.seen.prompt, null, 'no prompt');
  assert.equal(mac.menu(), null, 'no menu');
  unhunt();
  const o = await scene('street', [MAC], { species: 7 });
  const knifed = await hunter(o, o.mac);
  go(o.net, 600);
  assert.equal(bsOf(o.net, BOB, o.rat.seq), undefined, 'an Orc\'s body has no skin entry: no knife takes a hide from it');
  noNode(knifed, 'an Orc has no hide');
});

// ═══ AC7 - THE EMPTIED BODY (THE ADDENDUM) ═════════════════════════════════════════════════════════════════════════════════════════════
const BUCKLER = 'Armor:109', POTION = 'UselessItems1:83';
const BODY = () => [PILE().find((it) => pieceOf(it) === GOLD), armorOfMaterial(109, 0), mintHealingPotion()];
const keyFor = (s, p) => (p === s.bob ? `foeCorpse:${s.rat.uid}` : s.keyOf(p));
async function emptied(where, takers) {
  const s = await scene(where, takers, { pile: BODY });
  const take = (p, piece) => {
    const w = lootWindow(p);
    p.press(keyFor(s, p), w);
    assert.ok(w.take(choosing(piece)), `${p.id}'s window lists ${piece} and the click moved it`);
    w.close();
    run(s.net, 400);
  };
  take(s.mac, GOLD); take(s.eve, BUCKLER); take(s.mac, POTION);
  run(s.net, SETTLED_MS);
  assert.equal(s.rat.entity.items.length, 0, 'the owner\'s body is empty - every claim was granted (guard)');
  return s;
}
for (const where of WHERES) {
  test(`S7 PARTY-SKIN AC7 (${where}, the addendum): Mac and Eve empty Bob's body through granted loot claims; Eve (not the killer) is shown the Skin pop-up - prompt "Skin the Rat", menu ['hide'], no Search, no loot plaque on the ray - and skins it`, async () => {
    const s = await emptied(where, [MAC, EVE]);
    const eve = await hunter(s, s.eve);
    go(s.net, 600);
    const target = eve.aim();
    assert.ok(target, `PARTY-SKIN/AC7: Eve has no node over the emptied body (${promptOf(eve)}) - the body's skin entry must ride although its takes digest does not`);
    const e = entryOf(s);
    assert.ok(e && e[2] === OPEN, `the owner's stream still carries the entry for a body holding nothing: ${said(e)}`);
    assert.deepEqual(eve.menu(), ['hide'], 'the menu holds the Skin row alone');
    assert.deepEqual([eve.seen.prompt?.verb, eve.seen.prompt?.rest], ['Skin the Rat', 'Hunting 10'], 'the prompt is drawn');
    assert.equal(onRay(s.eve, keyFor(s, s.eve)), null, 'and the emptied body draws no loot plaque');
    assert.equal(eve.host.press(), true);
    await eve.trace(s.net);
    oneHarvest(s, [eve], EVE);
    assert.deepEqual(eve.lists, [], 'and no loot window was opened for the empty body');
  });
}

// ═══ AC2 - THE KILLER HAS ONE NODE, NOT TWO ═══════════════════════════════════════════════════════════════════════════════════════════
test('S8 PARTY-SKIN AC2: Bob kills with his own blow and holds a knife - Bob has exactly ONE node, keyed by the id his own stream carries (his private stamp is not a second node); Bob skins; Mac then reads "The Rat - skinned"', async () => {
  let bobH = null;
  const s = await scene('street', [MAC], { armed: async (c) => { bobH = await hunter(c, c.bob, { stand: false }); } });
  bobH.stand(); bobH.look();
  const mac = await hunter(s, s.mac);
  go(s.net, 600);
  const stamp = bobH.stamps.of(s.rat.entity);
  assert.ok(stamp, 'Bob\'s kill report still stamped the entity privately (guard: the kill credit is untouched)');
  const e = entryOf(s);
  assert.ok(e && ID_RE.test(e[1]), `PARTY-SKIN/AC2: Bob's stream carries the body's id: ${said(e)}`);
  const nodes = bobH.nodes();
  assert.deepEqual(nodes.map((n) => n.key), [keyOfId(e[1])], `Bob has exactly one node, keyed by the shared id (not by his private stamp ${stamp.key})`);
  assert.ok(bobH.aim());
  assert.equal(bobH.host.press(), true);
  await bobH.trace(s.net);
  oneHarvest(s, [bobH, mac], BOB);
  go(s.net, 800);
  assert.equal(promptOf(mac), SKINNED_LINE, 'Mac reads the body skinned');
});

// ═══ AC5 / AC6 - THE LEASE ENDS WHEN THE CLAIMER OR THE AUTHORITY GOES ═════════════════════════════════════════════════════════════════
test('S9 PARTY-SKIN AC5: Mac claims, then leaves the cell - Mac\'s act stops and asks no harvest; Bob\'s lease lapses; Eve skins; ONE harvest', async () => {
  const s = await scene('street', [MAC, EVE]);
  const [mac, eve] = [await hunter(s, s.mac), await hunter(s, s.eve)];
  go(s.net, 600);
  assert.ok(mac.aim(), `PARTY-SKIN/AC5: Mac has a node (${promptOf(mac)})`);
  assert.equal(mac.host.press(), true);
  go(s.net, 2300);
  assert.equal(promptOf(eve), BEING);
  const last = sqLog(s.net, MAC).filter((x) => x.op === HOLD).at(-1);
  leave(s.mac);
  go(s.net, 300);
  assert.equal(mac.acting, false, 'Mac\'s act stopped with its cell');
  assert.ok(until(s.net, () => promptOf(eve) === READY, 15000), 'Bob\'s lease lapses');
  assert.ok(clock.t - last.at >= SKIN_LEASE_MS, 'and not before the lease (nothing reached him: Mac had left)');
  assert.equal(eve.host.press(), true);
  await traceAll(s.net, [eve]);
  oneHarvest(s, [mac, eve], EVE);
});

test('S10 PARTY-SKIN AC6 (the authority leaves): Bob leaves mid Mac\'s act - Mac\'s act stops ("The gathering stopped before its end - nothing was taken."), no harvest is asked; the body is gone for Eve', async () => {
  const s = await scene('street', [MAC, EVE]);
  const [mac, eve] = [await hunter(s, s.mac), await hunter(s, s.eve)];
  go(s.net, 600);
  assert.ok(mac.aim(), `PARTY-SKIN/AC6: Mac has a node (${promptOf(mac)})`);
  assert.equal(mac.host.press(), true);
  go(s.net, 600);
  leave(s.bob);
  await traceAll(s.net, [mac], { waitMs: 2000 });
  go(s.net, FOES_FULL_MS * 4);
  assert.ok(mac.seen.toasts.includes(ACT_STOPPED_LINE), 'Mac\'s act stopped');
  assert.equal(asks(mac, eve).length, 0, 'no hide was asked');
  noNode(eve, 'the body went with its owner');
});

// ═══ AC9 - MIXED BUILDS ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
test('S11a PARTY-SKIN AC9 (guard): an OLDER owner (Bob\'s frames carry no bs) - Mac, the killer, skins through his private stamp and sends no claim; Eve has no node', async () => {
  let macH = null;
  const s = await scene('street', [MAC, EVE], { kill: false, foesFilter: (from, frame) => { delete frame.bs; return frame; }, armed: async (c) => { macH = await hunter(c, c.them[0], { stand: false }); } });
  strike(s, s.mac);
  go(s.net, 2000);
  macH.stand(); macH.look();
  const eve = await hunter(s, s.eve);
  go(s.net, 600);
  const target = macH.aim();
  assert.ok(target, `an older owner's body is Mac's by his own blow (${promptOf(macH)})`);
  const pup = s.mac.pool().foes.find((x) => x.puppet === BOB && x.corpse);
  assert.equal(target.node.key, macH.stamps.of(pup.entity).key, 'the node is the private stamp');
  noNode(eve, 'an older owner streams no skin law: the body is its killer\'s alone');
  assert.equal(macH.host.press(), true);
  await macH.trace(s.net);
  assert.equal(macH.asked.length, 1, 'Mac skinned');
  assert.equal(macH.asked[0].node, target.node.key);
  assert.deepEqual(sqLog(s.net), [], 'and no skin claim crossed the relay');
});

test('S11b PARTY-SKIN AC9: an OLDER killer - Mac\'s blow hits arrive without `sk` - Bob streams s 3 for the body; Mac skins with his private key (no streamed id); Eve has no node; ONE harvest', async () => {
  let macH = null;
  const s = await scene('street', [MAC, EVE], { kill: false, tamper: (from, to, data) => { if (from === MAC) delete data.sk; return data; }, armed: async (c) => { macH = await hunter(c, c.them[0], { stand: false }); } });
  strike(s, s.mac);
  go(s.net, 2000);
  macH.stand(); macH.look();
  const eve = await hunter(s, s.eve);
  go(s.net, 600);
  const e = entryOf(s);
  assert.equal(e?.[2], OWNS, `PARTY-SKIN/AC9: Bob streams the body as the killer's own (s 3) for a blow that carried no new-build mark: ${said(e)}`);
  const target = macH.aim();
  assert.ok(target, `Mac keeps his body (${promptOf(macH)})`);
  const pup = s.mac.pool().foes.find((x) => x.puppet === BOB && x.corpse);
  assert.equal(target.node.key, macH.stamps.of(pup.entity).key, 'by his private key');
  noNode(eve, 'the killer\'s own');
  assert.equal(macH.host.press(), true);
  await macH.trace(s.net);
  assert.equal(asks(macH, eve).length, 1);
  assert.equal(macH.asked[0].node, target.node.key);
});

test('S11c PARTY-SKIN AC9 (guard + red): an OLDER reader (Eve hears no bs) - Eve has no node; Mac skins', async () => {
  const s = await scene('street', [MAC, EVE], { foesFilter: (from, frame, to) => { if (to === EVE) delete frame.bs; return frame; } });
  const [mac, eve] = [await hunter(s, s.mac), await hunter(s, s.eve)];
  go(s.net, 600);
  noNode(eve, 'an older reader parses no bs and holds no stamp');
  assert.ok(mac.aim(), `PARTY-SKIN/AC9: Mac, a new reader, has the node (${promptOf(mac)})`);
  assert.equal(mac.host.press(), true);
  await mac.trace(s.net);
  oneHarvest(s, [mac, eve], MAC);
});

// ═══ AC10 - OFFLINE IS TODAY'S RULE ════════════════════════════════════════════════════════════════════════════════════════════════════
test('S12 PARTY-SKIN AC10 (guard): offline (the pool with no net) - the player\'s own kill is a node by the private stamp and skins; a kill no blow of his made is no node; no bs is built, no claim sent', async () => {
  const off = await offlineOwner();
  const solo = { id: 'solo-0009', feet: [0, 0, 0], pool: () => off.pool };
  const s = { where: 'street', bob: solo, rat: null };
  const h = await hunter(s, solo, { stand: false });
  const settleTicks = async () => { for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 0)); clock.t += 200; off.tick(); } };
  s.rat = await off.pool.spawnFoe(0, [14, 0, 12], { feetGiven: true });
  const third = await off.pool.spawnFoe(0, [16, 0, 12], { feetGiven: true });
  as(solo, () => off.pool.damageFoe(s.rat, 9999, [14, 0, 11]));
  off.pool.damageFoe(third, 9999, null, null, { fromPlayer: false });   // a kill no blow of his made
  await settleTicks();
  assert.ok(s.rat.corpse && third.corpse, 'both foes fell');
  h.stand();
  const nodes = h.nodes();
  assert.deepEqual(nodes.map((n) => n.key), [h.stamps.of(s.rat.entity).key], 'only the body his own blow felled is a node, by the private stamp');
  assert.equal(off.pool.foesFrame(true), null, 'no foes frame is built offline: no bs');
  const net0 = { due() {}, players: new Map(), deliver() {} };
  h.look();
  assert.ok(h.aim(), 'the node is targeted');
  assert.equal(h.host.press(), true);
  await traceAll(net0, [h]);
  assert.equal(h.asked.length, 1, 'he skinned it');
  assert.equal(h.asked[0].node, nodes[0].key, 'under the private stamp\'s key');
});

// ═══ AC11 - THE RARE-HIDE CAP IS THE SKINNER'S ACCOUNT'S ═════════════════════════════════════════════════════════════════════════════════
test('S13 PARTY-SKIN AC11: Mac\'s account is at 3 of 3 rare hides - over Bob\'s Harpy body Mac reads "3 of 3 rare hides today" and starts nothing; Eve (0 of 3) skins it; the harvest Eve\'s book asks is made under Eve\'s account; Bob\'s and Mac\'s tallies are unchanged', async () => {
  const s = await scene('street', [MAC, EVE], { species: 13 });
  const [mac, eve] = [await hunter(s, s.mac, { rank: 70, high: 3 }), await hunter(s, s.eve, { rank: 70, high: 0 })];
  go(s.net, 600);
  assert.ok(eve.aim(), `PARTY-SKIN/AC11: Eve has a node over Bob's Harpy (${promptOf(eve)})`);
  mac.aim();
  assert.equal(promptOf(mac), 'Skin the Harpy | 3 of 3 rare hides today', 'Mac reads his own account\'s tally');
  mac.host.press();
  assert.equal(mac.acting, false, 'and starts nothing');
  assert.equal(eve.host.press(), true);
  await eve.trace(s.net);
  oneHarvest(s, [mac, eve], EVE);
  assert.deepEqual([mac.book.state.hunt?.high, eve.book.state.hunt?.hides], [3, 1], 'Mac\'s tally is unchanged and Eve\'s book counted the hide');
});

// ═══ AC12 - A DEFINITE REFUSAL REOPENS THE BODY ═════════════════════════════════════════════════════════════════════════════════════════
test('S14 PARTY-SKIN AC12: Mac\'s harvest is answered stores-full - Mac\'s UNSKIN reaches Bob, the entry returns to OPEN, Eve skins; across both books one hide is GRANTED', async () => {
  const granted = [];
  const ok = (who) => (b) => { granted.push(who); return { ok: true, data: { node: b.node, kind: b.kind, material: 'hide:rat', qty: 1, xp: 10, track: { profession: 'hunting', xp: 100, rank: 10 }, today: 1, hunt: { hides: 1, high: 0 } } }; };
  const s = await scene('street', [MAC, EVE]);
  const [mac, eve] = [await hunter(s, s.mac, { respond: () => ({ ok: false, error: 'stores-full' }) }), await hunter(s, s.eve, { respond: ok(EVE) })];
  go(s.net, 600);
  assert.ok(mac.aim(), `PARTY-SKIN/AC12: Mac has a node (${promptOf(mac)})`);
  assert.equal(mac.host.press(), true);
  await mac.trace(s.net);
  assert.equal(mac.asked.length, 1, 'Mac\'s harvest was asked and refused');
  assert.ok(until(s.net, () => entryOf(s)?.[2] === OPEN, 2000), `the body is open again: ${said(entryOf(s))}`);
  assert.ok(sqLog(s.net, MAC).some((x) => x.op === UNSKIN), 'Mac told Bob UNSKIN');
  go(s.net, 600);
  eve.look();
  assert.equal(eve.aim() !== null, true);
  assert.equal(eve.host.press(), true);
  await eve.trace(s.net);
  assert.deepEqual(granted, [EVE], 'across both books exactly one hide was granted');
});

// ═══ AC6 - NO HIDE BEFORE THE AUTHORITY'S WORD ═══════════════════════════════════════════════════════════════════════════════════════════
test('S15 PARTY-SKIN AC6: no hide before the authority\'s word - Mac\'s act reaches its end while Bob\'s frames to Mac are lost; Mac asks NO harvest (the meter full, waiting); once they flow, the stream says skinned to Mac and Mac asks exactly one', async () => {
  let drop = false;
  const s = await scene('street', [MAC], { foesFilter: (from, frame, to) => (drop && to === MAC ? null : frame) });
  const mac = await hunter(s, s.mac);
  go(s.net, 600);
  assert.ok(mac.aim(), `PARTY-SKIN/AC6: Mac has a node (${promptOf(mac)})`);
  assert.equal(mac.host.press(), true);
  go(s.net, 600);
  drop = true;
  await traceAll(s.net, [mac], { waitMs: 3000 });
  assert.equal(mac.asked.length, 0, 'the line is drawn to its end, and no hide is asked before the authority has said the body is skinned');
  assert.equal(mac.acting, true, 'the act holds at its end');
  assert.equal(mac.seen.meter?.state?.waiting, true, 'the meter is full and waiting');
  drop = false;
  await traceAll(s.net, [mac], { waitMs: FOES_FULL_MS * 3 });
  oneHarvest(s, [mac], MAC);
});

// ═══ AC2 - THE INVARIANT, EVERY DOOR AT ONCE ═══════════════════════════════════════════════════════════════════════════════════════════
test('S16 PARTY-SKIN AC2 (the invariant): Bob, Mac and Eve, all with knives, all press within one frame; Mac\'s lane lossy (every other claim dropped); the relay held and released at random under a seeded lcg for 60 rounds - at most ONE harvest is asked per body, every round, and the body is skinned in some rounds', async () => {
  const rounds = 60;
  let ones = 0;
  for (let round = 0; round < rounds; round++) {
    const rnd = lcg(1000 + round);
    let bobH = null, cut = null;
    let n = 0;
    const s = await scene('street', [MAC, EVE], {
      foesFilter: (from, frame, to) => (cut && cut === to ? null : frame),
      tamper: (from, to, data) => (from === MAC && Array.isArray(data.sq) && n++ % 2 ? null : data),
      armed: async (c) => { bobH = await hunter(c, c.bob, { stand: false }); },
    });
    bobH.stand(); bobH.look();
    const [mac, eve] = [await hunter(s, s.mac), await hunter(s, s.eve)];
    go(s.net, 600);
    const all = [bobH, mac, eve];
    for (const h of all) assert.ok(h.aim(), `PARTY-SKIN/AC2: round ${round}: ${h.p.id} has a node (${promptOf(h)})`);
    for (const h of all) h.host.press();
    const dirs = [`${MAC}>${BOB}`, `${EVE}>${BOB}`];
    const shake = () => { for (const d of dirs) { if (rnd() < 0.3) s.net.hold(d); else s.net.release(d); } cut = rnd() < 0.3 ? [MAC, EVE][rnd() < 0.5 ? 0 : 1] : null; };
    for (let i = 0; i <= 40; i++) { shake(); await traceAll(s.net, all, { steps: 1, waitMs: 0 }); }
    for (const d of dirs) s.net.release(d);
    cut = null;
    await traceAll(s.net, all, { steps: 1, waitMs: 30_000 });
    go(s.net, 20_000);
    const asked = asks(...all);
    assert.ok(asked.length <= 1, `round ${round}: at most one hide is asked for a body (asked ${asked.map((a) => a.account).join(', ')})`);
    ones += asked.length;
    unhunt();
  }
  assert.ok(ones > 0, `PARTY-SKIN/AC2: the body is skinned in some rounds - one skin per body is not "no skins": ${ones} of ${rounds} rounds ended in a hide (the invariant is held vacuously by the old rule, under which two of the three have no node at all)`);
});

// ═══ GUARDS: EVERY EXISTING HUNTING RULE STANDS, FOR A NON-KILLER WHO SKINS A PEER'S KILL ═══════════════════════════════════════════════
const guard = 'guard: an existing Hunting rule';
test(`PARTY-SKIN (${guard}): skinning adds, never replaces - after Mac's skin the body's loot is exactly what it was, piece for piece, for everyone, and the Search row still opens it`, async () => {
  const s = await scene('street', [MAC, EVE]);
  const [mac, eve] = [await hunter(s, s.mac), await hunter(s, s.eve)];
  go(s.net, 600);
  const before = JSON.stringify(s.rat.entity.items.map(pieceOf));
  const holds = (p) => JSON.stringify((p.holds(keyFor(s, p)) ?? []).map((r) => pieceOf(r.item ?? r)));
  const seenBefore = [holds(s.bob), holds(s.mac), holds(s.eve)];   // (reading a puppet's list is what lists its Search row)
  assert.ok(mac.aim(), `Mac has a node over a peer's kill (${promptOf(mac)})`);
  assert.deepEqual(mac.menu(), ['hide', 'search'], 'a body with loot: Skin and Search');
  assert.equal(mac.host.press(), true);
  await mac.trace(s.net);
  oneHarvest(s, [mac, eve], MAC);
  go(s.net, 800);
  assert.equal(JSON.stringify(s.rat.entity.items.map(pieceOf)), before, 'the owner\'s body holds exactly what it did');
  assert.deepEqual([holds(s.bob), holds(s.mac), holds(s.eve)], seenBefore, 'and the plaque lists the same for all three');
  assert.ok(eve.aim(), 'Eve still has the body as a target');
  assert.deepEqual(eve.menu(), ['hide', 'search'], 'the Skin row is refused (skinned) and the Search row stays');
  eve.lit = 'search';
  assert.equal(eve.host.press(), true, 'the Search row opens the loot');
  assert.deepEqual(eve.lists, [keyFor(s, s.eve)], 'by the body\'s own key');
});

test(`PARTY-SKIN (${guard}): the knife - one in the MAIN pack, not a broken one; the knife wears by one after the act`, async () => {
  const s = await scene('street', [MAC, EVE]);
  const broken = await hunter(s, s.eve, { knife: knifeOf(0) });
  const knife = knifeOf(50);
  const mac = await hunter(s, s.mac, { knife });
  go(s.net, 600);
  noNode(broken, 'its only knife is broken (currentCondition 0)');
  assert.ok(mac.aim(), `Mac's whole knife gives the node (${promptOf(mac)})`);
  assert.equal(mac.host.press(), true);
  await mac.trace(s.net);
  oneHarvest(s, [mac, broken], MAC);
  assert.equal(knife.currentCondition, 49, 'the knife wore by one');
});

test(`PARTY-SKIN (${guard}): KNIFE_CHECKS and KNIFE_WHERE - a settlement or the sea refuses with its own line, enemies nearby refuse the act`, async () => {
  const s = await scene('street', [MAC]);
  const mac = await hunter(s, s.mac);
  go(s.net, 600);
  assert.ok(mac.aim(), `Mac has a node (${promptOf(mac)})`);
  skinWorld.w = TOWN;
  mac.aim();
  assert.equal(promptOf(mac), 'Skin the Rat | not in a settlement', 'a settlement');
  mac.host.press();
  assert.equal(mac.acting, false);
  skinWorld.w = SEA;
  mac.aim();
  assert.equal(promptOf(mac), 'Skin the Rat | not out here', 'the sea');
  skinWorld.w = { ...NIGHT, enemiesNear: true };
  mac.aim();
  assert.equal(mac.host.press(), true);
  assert.deepEqual([mac.seen.toasts.at(-1), mac.acting], [KNIFE_REFUSALS.enemies, false], 'enemies nearby: the act\'s own refusal');
  assert.equal(mac.asked.length, 0);
});

test(`PARTY-SKIN (${guard}): standing over the body reads "step back"`, async () => {
  const s = await scene('street', [MAC]);
  const mac = await hunter(s, s.mac, { standAt: 0.3 });
  go(s.net, 600);
  assert.ok(mac.aim(), `Mac has a node (${promptOf(mac)})`);
  assert.equal(promptOf(mac), 'Skin the Rat | step back');
  mac.host.press();
  assert.equal(mac.acting, false);
});

test(`PARTY-SKIN (${guard}): a hide tier above the skinner's Hunting rank reads "needs Hunting N" and starts nothing; a rank that reaches it skins`, async () => {
  const s = await scene('street', [MAC, EVE], { species: 13 });
  const [mac, eve] = [await hunter(s, s.mac, { rank: 10 }), await hunter(s, s.eve, { rank: 70 })];
  go(s.net, 600);
  assert.ok(eve.aim(), `Eve (rank 70) has a node over the Harpy (${promptOf(eve)})`);
  mac.aim();
  assert.equal(promptOf(mac), 'Skin the Harpy | needs Hunting 55');
  mac.host.press();
  assert.equal(mac.acting, false);
  assert.equal(eve.host.press(), true);
  await eve.trace(s.net);
  oneHarvest(s, [mac, eve], EVE);
});

test(`PARTY-SKIN (${guard}): the Stores full read their line and start nothing`, async () => {
  const s = await scene('street', [MAC]);
  const mac = await hunter(s, s.mac, { stores: 0 });
  go(s.net, 600);
  assert.ok(mac.aim(), `Mac has a node (${promptOf(mac)})`);
  assert.equal(promptOf(mac), 'Skin the Rat | Stores full - Rat Pelt');
  mac.host.press();
  assert.equal(mac.acting, false);
});

test(`PARTY-SKIN (${guard}): the UTC-day lapse - a body killed before midnight UTC cannot be skinned after it, by anyone`, async () => {
  let bobH = null;
  const s = await scene('street', [MAC, EVE], { armed: async (c) => { bobH = await hunter(c, c.bob, { stand: false }); } });
  bobH.stand(); bobH.look();
  const [mac, eve] = [await hunter(s, s.mac), await hunter(s, s.eve)];
  go(s.net, 600);
  utc.t = (DAY + 1) * 86_400_000 - 1000;   // a second to midnight
  for (const h of [bobH, mac, eve]) assert.ok(h.aim(), `PARTY-SKIN: before midnight ${h.p.id} has a node (${promptOf(h)})`);
  go(s.net, 100);
  utc.t = (DAY + 1) * 86_400_000 + 1000;   // past it
  go(s.net, 1200);
  for (const h of [bobH, mac, eve]) noNode(h, 'the body\'s UTC day has ended');
});

for (const [what, pitchOff, note] of [['a clean pelt', 0, ' (a clean pelt)'], ['a torn pelt', 2.3, ' (a torn pelt - its part lost)']]) {
  test(`PARTY-SKIN (${guard}): XP and the ${what} note go to the skinner`, async () => {
    const s = await scene('street', [MAC, EVE]);
    const [mac, eve] = [await hunter(s, s.mac), await hunter(s, s.eve)];
    go(s.net, 600);
    assert.ok(mac.aim(), `Mac has a node (${promptOf(mac)})`);
    assert.equal(mac.host.press(), true);
    await traceAll(s.net, [mac], { pitchOff });
    oneHarvest(s, [mac, eve], MAC);
    assert.ok(mac.seen.toasts.includes(`+10 Hunting XP${note}`), `Mac's lines: ${JSON.stringify(mac.seen.toasts)}`);
    assert.ok(!eve.seen.toasts.some((t) => /XP/.test(t)), 'and Eve, who skinned nothing, hears no XP');
    assert.deepEqual([mac.book.state.hunt?.hides, eve.book.state.hunt?.hides], [1, 0], 'the day\'s hides are the skinner\'s');
  });
}
