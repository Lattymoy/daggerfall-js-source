// PARTY-SKIN, THE DUNGEON (PR B, test-harness/loot-followups/DESIGN-B.md section 8, D1-D7; bible/06-Systems/Online-Arc.md PARTY-SKIN):
// ONE SKIN PER BODY IN A ROOM, WHOEVER MAY LOOT IT MAY SKIN IT, FIRST COME, JUDGED BY THE ROOM'S HOST - across a change of seat.
//
//   - "bodies can be skinned only once by anyone which I think aligns with your recommendations"
//   - "it should follow whatever loot rules are in main, if anyone means anyone then that should follow skinning too - the important
//     piece is that a body can only be skinned once"
//   - "skinning an empty body should still work, yes but it should also show the 'Skin' pop-up"
//
// MOUNTED, NOT MATCHED. The wire is test/net/partyloot_wire.test.js's, carried to ./partySkinWire.mjs and grown (see its header): the real
// dungeon doors and PARTY-LOOT block sliced from src/scenes/dungeonContext.js and roomLootHost.js, the dungeon's own death and stream path,
// a real OnlineSession each, ONE real relay Room - and now the hit lane (a joiner's claim and blow to the host through the real hit queue and
// the Room, the host's own `applyHit`), the seat (the dungeon's `setAuthority`) and the game's kill credit. Each skinner is the real gathering
// host with Hunting's real kind over `bodiesHere('dungeon', ...)` and the real act drawn to a harvest (./skinHarness.mjs). Nothing under
// test is stood in for. Street and building twins: test/net/partyskin.test.js.
//
// The room's wire (DESIGN-B 2 and 3): the host's foes frame carries `bs: [[ref, id, s, cid], ...]`, `ref` 'corpse:<i>' (a layout foe) or
// 'enc:<id>' (a rest encounter's), `s` 0 open / 1 held / 2 skinned / 3 the killer's own; a claim is a hit `sq: [cid, id, op]`.
import '../chargenDom.mjs';
import '../modsOff.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { bodyKey } from '../../src/net/nodeLaw.js';
import { registerPlayerKillListener } from '../../src/systems/playerKills.js';
import { midScreenText } from '../../src/ui/midScreenText.js';
import { ACT_STOPPED_LINE } from '../../src/scenes/gatherHost.js';
import { FOES_MS } from '../../src/net/online.js';
import { skinParty, drive, fell, clock, HOST, JOINER } from './partySkinWire.mjs';
import { actor } from './bodyLootHarness.mjs';
import { hunter, unhunt, traceAll, untilAsync, hunters, DAY } from './skinHarness.mjs';

afterEach(() => { unhunt(); registerPlayerKillListener('count', null); });

const C = 'join-0003';
const SKIN_LEASE_MS = 12_000;
const TAKEN = 'Someone else is skinning that.';
const [HOLD, DONE] = [1, 2];
const [OPEN, HELD, SKINNED, OWNS] = [0, 1, 2, 3];
const READY = 'Skin the Rat | ready', BEING = 'Skin the Rat | being skinned', SKINNED_LINE = 'The Rat - skinned | ';
const ID_RE = /^[0-9a-f]{12}$/;
const keyOfId = (id) => bodyKey({ day: DAY, id });
const REF = (i) => `corpse:${i}`;
const said = (e) => (e ? JSON.stringify(e) : 'none (the host\'s foes frames carry no `bs` for this body)');
/** The room's last skin entry for the body as player `p` heard it from the host. */
function entryIn(p, ref) {
  for (let i = p.foesIn.length - 1; i >= 0; i--) {
    const hit = (p.foesIn[i].data.bs ?? []).find((x) => Array.isArray(x) && x[0] === ref);
    if (hit) return hit;
  }
  return undefined;
}
const historyIn = (p, ref) => p.foesIn.flatMap((e) => (e.data.bs ?? []).filter((x) => Array.isArray(x) && x[0] === ref).map((x) => ({ at: e.at, entry: x })));
/** The claims `p` sent the host: `{ op, cid, id, at }`. */
const claimsOut = (p) => p.hitsOut.filter((h) => Array.isArray(h.data.sq)).map((h) => ({ cid: h.data.sq[0], id: h.data.sq[1], op: h.data.sq[2], at: h.at, data: h.data }));
/** A skinner at room-foe `i` as player `p`. */
const skinner = (p, i, o = {}) => hunter({ where: 'dungeon' }, p, { bodies: p.bodies, bodyAt: () => p.foes[i].corpsePos ?? p.foes[i].ai.feet, ...o });
/** The room's time passing for `ps`, every skinner offered its frame. */
const driver = (S, ps = S.ps) => (ms) => drive(S.net, ms, ps, hunters());
const asks = (...hs) => hs.flatMap((h) => h.asked);

/** The room: A the host and the joiners; foe 0 (a Rat) felled by `by` (default the host); the stream run so every joiner holds the body. */
async function room({ ids = [HOST, JOINER, C], by = 0, i = 0, ...o } = {}) {
  const S = await skinParty({ foes: 4, species: 0, ids, ...o });
  S.go = driver(S);
  fell(S.ps[by], i);
  for (let k = 0; k < 4; k++) await S.go(FOES_MS);
  for (const p of S.ps) assert.equal(p.foes[i].dead && p.foes[i].corpse, true, `${p.id} holds the body (the host's frame laid it)`);
  return S;
}
function oneHarvest(hs, who, e) {
  const all = asks(...hs);
  assert.equal(all.length, 1, `exactly one hide is asked for the body across every skinner (asked: ${hs.map((h) => `${h.p.id} ${h.asked.length}`).join(', ')})`);
  assert.equal(all[0].account, who, `and it is ${who}'s`);
  assert.ok(e && ID_RE.test(e[1]), `the host streamed the body's id: ${said(e)}`);
  assert.equal(all[0].node, keyOfId(e[1]), `the harvest's node is body:<the skinner's day>:<the id in the host's bs> (${all[0].node})`);
}

test('D1 PARTY-SKIN AC8: A (the host) fells a Rat in the room, A has no knife; B, a joiner with a knife, is shown "Skin the Rat" and skins it - ONE harvest, keyed by the id A\'s foes frame streams for corpse:<i>', async () => {
  const S = await room();
  const b = await skinner(S.J, 0);
  await S.go(600);
  const target = b.aim();
  assert.ok(target, `PARTY-SKIN/AC8: B's gather host has no target over the body the host felled (${b.row()})`);
  const e = entryIn(S.J, REF(0));
  assert.ok(e && ID_RE.test(e[1]) && e[2] === OPEN, `A's foes frame carries the body's skin entry [ref, id, 0]: ${said(e)}`);
  assert.equal(b.row(), READY);
  assert.equal(target.node.key, keyOfId(e[1]), 'the node is keyed by the shared id');
  assert.equal(b.host.press(), true);
  await traceAll(S.net, [b], { drive: S.go });
  const last = entryIn(S.J, REF(0));
  oneHarvest([b], JOINER, last);
  assert.deepEqual([last[2], String(last[3]).startsWith(`${JOINER}:`)], [SKINNED, true], `the host's stream ends SKINNED to B's claim: ${said(last)}`);
  const ops = claimsOut(S.J).map((c) => c.op);
  assert.deepEqual([ops[0], ops.includes(DONE)], [HOLD, true], `B's words to the host: HOLD from the act's start, then DONE (${ops})`);
});

for (const first of [1, 2]) {
  test(`D2 PARTY-SKIN AC8/AC2: B and C race, ${first === 1 ? 'B' : 'C'} pressing first - ONE harvest, the first claim the host received; the loser is stopped and told`, async () => {
    const S = await room();
    const [b, c] = [await skinner(S.ps[1], 0), await skinner(S.ps[2], 0)];
    await S.go(600);
    assert.ok(b.aim() && c.aim(), `PARTY-SKIN/AC2: both joiners have a node (${b.row()}, ${c.row()})`);
    const [w, l] = first === 1 ? [b, c] : [c, b];
    midScreenText.text = '';
    assert.equal(w.host.press(), true);
    assert.equal(l.host.press(), true);
    await traceAll(S.net, [b, c], { drive: S.go });
    const e = entryIn(S.ps[1], REF(0));
    oneHarvest([b, c], w.p.id, e);
    assert.ok(String(e[3]).startsWith(`${w.p.id}:`), `the stream is skinned to the first claim (${said(e)})`);
    assert.ok(l.seen.toasts.includes(ACT_STOPPED_LINE), 'the loser\'s act is stopped');
    assert.equal(midScreenText.text, TAKEN, 'and the loser is told');
    assert.equal(l.asked.length, 0);
  });
}

test('D3 PARTY-SKIN AC8/AC4/AC6: A (the host, with a knife) skins while B looks - B reads "being skinned", then "The Rat - skinned"; A\'s own harvest waits until a frame of A\'s carrying s 2 has been built', async () => {
  const S = await room({ by: 1 });   // B's blow felled it: the host has no private stamp for it
  const [a, b] = [await skinner(S.H, 0), await skinner(S.J, 0)];
  await S.go(600);
  assert.ok(a.aim(), `PARTY-SKIN/AC8: A has a node over the body (${a.row()})`);
  assert.equal(a.host.press(), true);
  await S.go(600);
  assert.equal(b.row(), BEING, 'PARTY-SKIN/AC4: B reads the body held');
  await traceAll(S.net, [a], { drive: S.go });
  await S.go(600);
  const e = entryIn(S.J, REF(0));
  oneHarvest([a, b], HOST, e);
  assert.equal(b.row(), SKINNED_LINE, 'and then skinned');
  const carrying = S.H.built.find((f) => (f.bs ?? []).some((x) => x[0] === REF(0) && x[2] === SKINNED));
  assert.ok(carrying, 'A built a frame carrying the body as skinned');
  assert.ok(a.asked[0].order > carrying.order, 'and A\'s hide was asked only after that frame was built');
});

test('D4a PARTY-SKIN AC8 (the seat): B holds, A leaves the room, C takes the seat - B\'s renewals reach C, B finishes, C marks it skinned, B harvests ONCE', async () => {
  const S = await room({ ids: [HOST, C, JOINER] });   // C joined before B: the seat's next
  const [c, b] = [S.ps[1], S.ps[2]];
  const bh = await skinner(b, 0);
  await S.go(600);
  assert.ok(bh.aim(), `PARTY-SKIN/AC8: B has a node (${bh.row()})`);
  assert.equal(bh.host.press(), true);
  await S.go(1500);
  S.H.online.leave();
  await S.net.settle();
  assert.equal(c.online.isHost(), true, 'C holds the seat now (the Room said so)');
  c.reseat(); b.reseat();
  const rest = driver(S, [c, b]);
  await rest(800);
  await traceAll(S.net, [bh], { drive: rest });
  await rest(1200);
  const e = entryIn(b, REF(0));
  oneHarvest([bh], JOINER, e);
  assert.ok(String(e[3]).startsWith(`${JOINER}:`) && e[2] === SKINNED, `C marked it skinned to B's claim: ${said(e)}`);
  assert.ok(claimsOut(b).some((x) => x.at > clock.t - 8000 || x.op === DONE), 'B\'s words reached the new host');
});

test('D4b PARTY-SKIN AC8 (the seat): a lease A held lapses at C after SKIN_LEASE_MS and B can then claim; B skins ONCE', async () => {
  const S = await room({ ids: [HOST, C, JOINER], by: 2 });
  const [c, b] = [S.ps[1], S.ps[2]];
  const [ah, bh] = [await skinner(S.H, 0), await skinner(b, 0)];
  await S.go(600);
  assert.ok(ah.aim(), `PARTY-SKIN/AC8: A has a node (${ah.row()})`);
  assert.equal(ah.host.press(), true);
  await S.go(1500);
  assert.equal(bh.row(), BEING, 'B reads the body held by A');
  S.H.online.leave();
  await S.net.settle();
  c.reseat(); b.reseat();
  const rest = driver(S, [c, b]);
  const seated = clock.t;
  await untilAsync(rest, () => bh.row() === 'Skin the Rat | ready', SKIN_LEASE_MS - 3000);
  assert.notEqual(bh.row(), 'Skin the Rat | ready', 'the lease A held is not free the moment the seat moves');
  assert.equal(await untilAsync(rest, () => bh.row() === 'Skin the Rat | ready', 8000), true, 'and it lapses');
  const waited = clock.t - seated;
  assert.ok(waited >= SKIN_LEASE_MS - 500 && waited <= SKIN_LEASE_MS + 2000, `after SKIN_LEASE_MS at the new seat (${waited} ms)`);
  assert.equal(bh.host.press(), true);
  await traceAll(S.net, [bh], { drive: rest });
  oneHarvest([ah, bh], JOINER, entryIn(b, REF(0)));
});

test('D5 PARTY-SKIN AC1/AC13: B\'s blow kills (the record\'s v credits B once); C skins; B\'s private stamp is no second node for B', async () => {
  let kills = 0;
  registerPlayerKillListener('count', () => { if (actor.id === JOINER) kills++; });
  const S = await skinParty({ foes: 4, species: 0 });
  S.go = driver(S);
  const [b, c] = [await skinner(S.J, 0, { stand: false }), await skinner(S.K, 0)];
  fell(S.J, 0);
  for (let k = 0; k < 6; k++) await S.go(FOES_MS);
  assert.equal(S.J.foes[0].dead && S.J.foes[0].corpse, true, 'the host felled it for B and its frame laid the body');
  assert.equal(kills, 1, 'B\'s kill was credited once (the record\'s `v`)');
  b.stand(); b.look();
  await S.go(600);
  const e = entryIn(S.K, REF(0));
  assert.ok(e && ID_RE.test(e[1]), `PARTY-SKIN/AC1: the host streams the body's id: ${said(e)}`);
  assert.equal(e[2], OPEN, 'the blow carried the new build\'s mark: open to the room');
  const stamp = b.stamps.of(S.J.foes[0].entity);
  assert.ok(stamp, 'B\'s kill report stamped the entity privately (guard: the kill credit is untouched)');
  assert.deepEqual(b.nodes().map((n) => n.key), [keyOfId(e[1])], `B has exactly one node, the shared one (not his private ${stamp.key})`);
  assert.ok(c.aim(), `C has a node over B's kill (${c.row()})`);
  assert.equal(c.host.press(), true);
  await traceAll(S.net, [c], { drive: S.go });
  oneHarvest([b, c], C, entryIn(S.K, REF(0)));
  assert.equal(kills, 1, 'and B\'s kill report is still one');
});

test('D6 PARTY-SKIN AC9 (guard + red): a body outside PARTY-LOOT\'s base (a _deepFoeCleared foe) streams s 3 - its killer skins privately, nobody else sees a node; an older host (bs stripped) - killer-only', async () => {
  for (const older of [false, true]) {
    const S = await skinParty({ foes: 4, species: 0 });
    S.go = driver(S);
    for (const p of S.ps) p.state._deepFoeCleared.add('undefined:undefined');   // roomCanonOfFoe answers null for every foe: no shared base
    if (older) for (const p of S.ps.slice(1)) p.hear.stripBs = true;
    const [h, j, k] = [await skinner(S.H, 0, { stand: false }), await skinner(S.J, 1, { stand: false }), await skinner(S.K, 0, { stand: false })];
    fell(S.H, 0);
    for (let n = 0; n < 6; n++) await S.go(FOES_MS);
    h.stand(); h.look(); k.stand(); k.look();
    await S.go(300);
    if (!older) {
      const e = entryIn(S.J, REF(0));
      assert.equal(e?.[2], OWNS, `PARTY-SKIN/AC9: the host streams a body with no shared base as the killer's own (s 3): ${said(e)}`);
    }
    const t = h.aim();
    assert.ok(t, `the killer keeps the body (${h.row()})`);
    assert.equal(t.node.key, h.stamps.of(S.H.foes[0].entity).key, 'by his private stamp');
    assert.equal(k.aim(), null, 'nobody else sees a node');
    assert.equal(j.aim(), null, 'nor the other joiner');
    unhunt();
  }
});

test('D7 PARTY-SKIN AC7 (the addendum): a dungeon body that holds nothing still shows B the Skin pop-up - the Skin row alone, no Search - and B skins it', async () => {
  const S = await room();
  const b = await skinner(S.J, 0);
  await S.go(600);
  const t = b.aim();
  assert.ok(t, `PARTY-SKIN/AC7: B has a node over the host's felled Rat (${b.row()})`);
  assert.equal(S.J.foes[0].entity.items.length, 0, 'the joiner\'s list of the body holds nothing to search (an unborn or emptied list: corpseKeyOf answers null)');
  assert.deepEqual(b.menu(), ['hide'], 'the menu holds the Skin row alone');
  assert.equal(b.host.press(), true);
  await traceAll(S.net, [b], { drive: S.go });
  oneHarvest([b], JOINER, entryIn(S.J, REF(0)));
});
