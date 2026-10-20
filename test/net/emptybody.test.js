// EMPTY-BODY (OUTDOOR-LOOT follow-ups, PR A phase 1b, 2026-10-19; test-harness/loot-followups/DESIGN-1b.md D9, section 8 and 9, and the
// COORDINATOR ADDENDUM are the contract): AN EMPTIED BODY STOPS BEING A LOOT TARGET - for its owner as for his party - and the Skin
// pop-up still shows over it.
//
// TODAY. The owner's emptied body is the one outlier: a party member's emptied kill is no target (bodyLootHost.js isTarget), the dungeon's
// emptied body is no target for host or party alike (dungeonContext.js lootTargets, AUDIT 68 S19), but a street or a building body whose
// owner's list is empty is still a target - invisible geometry that wins the ray and draws "Empty" - until the owner presses it, and
// corpsePrelude says "The body has no treasure." and disables it. DECIDED (Travis, 2026-10-19): an emptied body shows NO plaque, for the
// owner and the party alike; and (the addendum) "skinning an empty body should still work, yes but it should also show the 'Skin' pop-up".
// The rule is a live predicate, never a latch: a body whose list (as this reader holds it) is empty is no target, so a refill - a piece the
// owner lays back into his open window - makes it one again; `corpseDisabled` is not written.
//
// MOUNTED, NOT MATCHED. The pools are the real createExteriorFoes (the street's, and a building's as worldModes.js wires it) behind the real
// hit queue, on the harness's relay (./bodyLootHarness.mjs); the plaque is READ THROUGH THE PICK (`onRay`: player/activate.js
// pickActivatableHit over the pool's own lootTargets, then resolveHover), never through a hit the test made itself. The Skin pop-up is read
// through the REAL gathering host (scenes/gatherHost.js, with scenes/huntHost.js huntKind over the street's pool and the real stamps): its
// prompt, its menu (hoverName) and its act, run to a harvest the account is asked for. The T-B3 guard (the dungeon) lives in
// test/systems/partyloot.test.js, whose three-peer mount is private to that file; T-B7 is the end of test/net/bodyloot_party.test.js.
//
// Run on the tree at 07c5299a1c every red pin fails by its assertion; the guards (named so) pass and must stay green.
import '../chargenDom.mjs';
import '../modsOff.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { armorOfMaterial } from '../../src/combat/enemyEquipment.js';
import { mintHealingPotion } from '../../src/systems/healingSupply.js';
import { createProfBook } from '../../src/net/profBook.js';
import { utcDayOfMs } from '../../src/net/nodeLaw.js';
import { xpForRank, SKINNING_KNIFE } from '../../src/net/professionLaw.js';
import { createBodyStamps, bodiesHere, huntKind } from '../../src/scenes/huntHost.js';
import { createGatherHost, aimAt } from '../../src/scenes/gatherHost.js';
import { registerPlayerKillListener, reportPlayerKill } from '../../src/systems/playerKills.js';
import { setForagingHost } from '../../src/systems/foraging/foragingInstall.js';
import {
  PILE, pieceOf, GOLD, restoreRandom, scene, lootWindow, choosing, run, SETTLED_MS, onRay,
} from './bodyLootHarness.mjs';

afterEach(() => { restoreRandom(); registerPlayerKillListener('emptybody', null); setForagingHost(null); });

const BOB = 'bob-0002', MAC = 'mac-0001', EVE = 'eve-0003';
const BUCKLER = 'Armor:109', POTION = 'UselessItems1:83';
const BODY = () => [PILE().find((it) => pieceOf(it) === GOLD), armorOfMaterial(109, 0), mintHealingPotion()];
const keyFor = (s, p) => (p === s.bob ? `foeCorpse:${s.rat.uid}` : s.keyOf(p));
const everyone = (s) => [s.bob, s.mac, s.eve];
/** The plaque on the ray, as a message can say it. */
const said = (f) => (f ? `${f.kind}: ${f.title}${f.empty ? ' - "Empty"' : ` - ${JSON.stringify(f.rows?.map((r) => pieceOf(r.item)))}`}` : 'nothing');

/** Bob's foe fell with a purse, a Buckler and a Potion; Mac and Eve took all three through their windows (the owner granted each claim); Bob never pressed his body. */
async function emptied(where) {
  const s = await scene(where, [MAC, EVE], { pile: BODY });
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
  assert.notEqual(s.rat.corpseDisabled, true, 'and Bob never pressed it: it is not disabled (guard)');
  return s;
}

// ═══ AC-B1 - AN EMPTIED BODY IS NO TARGET, FOR ANYONE ═══════════════════════════════════════════════════════════════════════════════
for (const where of ['street', 'building']) {
  test(`T-B${where === 'street' ? 1 : 2} EMPTY-BODY AC-B1 (${where}): Bob's body, emptied by Mac's and Eve's granted claims and never pressed by Bob, is no target in any of the three pools' lootTargets - the plaque on the ray is nothing for Bob, Mac and Eve alike`, async () => {
    const s = await emptied(where);
    for (const p of everyone(s)) {
      const key = keyFor(s, p);
      const f = onRay(p, key);
      assert.equal(f, null, `EMPTY-BODY/AC-B1: ${p.id}'s plaque on the ray over the emptied ${where} body is ${said(f)} - an emptied body stays a target for its owner (invisible geometry that wins the ray and draws "Empty") until he presses it; a party member's emptied kill, and the dungeon's body for host and party, are none`);
      assert.deepEqual(p.pool().lootTargets().map((t) => t.key).filter((k) => k === key), [], `${p.id}'s pool stands no loot target for the emptied body`);
    }
  });
}

// ═══ AC-B2 - SKINNING AN EMPTY BODY STILL WORKS, AND SHOWS THE 'SKIN' POP-UP (THE ADDENDUM) ═══════════════════════════════════════════
const NOW = 20_833 * 86_400_000 + 3_600_000;
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const noWait = () => Promise.resolve();
const tick = () => new Promise((r) => setImmediate(r));
const knifeOf = () => ({ templateIndex: SKINNING_KNIFE.templateIndex, name: 'Skinning Knife', currentCondition: 50, maxCondition: 50 });
const NIGHT = { inside: false, insideDungeon: false, insideCastle: false, locationType: 0xffff, inLocationRect: false, hour: 2, climate: 231, region: 59, enemiesNear: false, carriedWeight: 0, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' };

/** The account's book, answering a harvest the way the service does (one hide), and recording what it was asked. */
async function bookOf(asked) {
  const door = {
    account: () => 'acct-1',
    state: async () => ({ ok: true, data: { day: utcDayOfMs(NOW), character: 'c1', tracks: [{ profession: 'hunting', xp: xpForRank(10), rank: 10, specs: { 50: null, 100: null } }], today: {}, taken: [], stores: [], caps: { stores: 5000, withdraw: 200, highHides: 3 }, hunt: { hides: 0, high: 0 } } }),
    pixels: async () => ({ ok: true, data: { pixels: [], dungeons: [] } }),
    harvest: async (b) => { asked.push(b); return { ok: true, data: { node: b.node, kind: b.kind, material: 'hide:rat', qty: 1, xp: 10, track: { profession: 'hunting', xp: xpForRank(10) + 10, rank: 10 }, today: 1, hunt: { hides: 1, high: 0 } } }; },
  };
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c1', now: () => NOW, sleep: noWait });
  await book.refresh();
  return book;
}
/** The REAL gathering host, with Hunting's kind over Bob's street pool and the real stamps: the knife in the pack or not, the kill stamped or not. */
function huntOver(s, book, { knife = true, stamped = true, dungeonless = true } = {}) {
  const stamps = createBodyStamps({ nowMs: () => NOW });
  registerPlayerKillListener('emptybody', (e) => { stamps.stamp(e); });
  if (stamped) reportPlayerKill(s.rat.entity, { kind: 'melee' });
  const entity = { items: knife ? [knifeOf()] : [] };
  const seen = { prompt: null, meter: null, toasts: [] };
  const hud = { setPrompt: (p) => { seen.prompt = p; }, setMeter: (m) => { seen.meter = m; }, toast: (x) => seen.toasts.push(x), banner: () => {}, setChip: () => {}, frame: () => {}, dispose: () => {} };
  const body = s.rat.corpseMarker.pos;
  const feet = [body[0], body[1], body[2] - 2.2];
  const view = { yaw: 0, pitch: 0 };
  let input = { held: false, attack: false, choice: false };
  const eyePos = () => [feet[0], feet[1] + 1.6, feet[2]];
  const opened = [];
  const host = createGatherHost({
    book, hud, kinds: [huntKind({ book, bodies: () => bodiesHere('exterior', { street: s.bob.pool() }, stamps), openLoot: (key) => opened.push(key) })],
    renderer: { createBillboardBatch: () => ({}), destroyBatch: () => {} }, getTexture: async () => ({ recordCount: 99 }), uploadRecord: () => {},
    billboardSize: () => ({ w: 1, h: 1 }), flatBatchAabb: () => [0, 0, 0, 1, 1, 1], built: () => new Map(),
    pixelTranslation: (x, y, out) => { out[0] = 0; out[1] = 0; out[2] = 0; return out; }, pixelInfo: () => ({ climate: 231, region: 59 }), nowMs: () => NOW,
    eye: () => ({ pos: eyePos(), dir: [Math.sin((view.yaw * Math.PI) / 180) * Math.cos((view.pitch * Math.PI) / 180), Math.sin((view.pitch * Math.PI) / 180), Math.cos((view.yaw * Math.PI) / 180) * Math.cos((view.pitch * Math.PI) / 180)] }),
    view: () => view, feet: () => feet, entity: () => entity, keyLabel: (a) => (a === 'ActChoice' ? 'R' : 'E'), input: () => input, active: () => true, lit: () => null,
  });
  const lookAtBody = () => { const at = aimAt(eyePos(), [body[0], body[1] + 0.2, body[2]], { yaw: 0, pitch: 0 }); view.yaw = -at.yaw; view.pitch = -at.pitch; return at; };
  /** The knife drawn along the act's own line, E held. */
  const trace = (steps = 40, dt = 0.05) => {
    const at0 = lookAtBody();
    host.tick(0.001);
    const pts = seen.meter.state.points;
    for (let i = 0; i <= steps; i++) {
      const u = (i / steps) * (pts.length - 1);
      const k = Math.min(pts.length - 2, Math.floor(u)), t = u - k;
      view.yaw = -at0.yaw + pts[k][0] + (pts[k + 1][0] - pts[k][0]) * t;
      view.pitch = -at0.pitch + pts[k][1] + (pts[k + 1][1] - pts[k][1]) * t;
      input = { held: true, attack: false, choice: false };
      host.tick(dt);
    }
    input = { held: false, attack: false, choice: false };
    // PIN MOVED (PARTY-SKIN): online the act holds at its end for the body's authority - Bob's own pool - to mark the body skinned and say so in a
    // foes frame it has built; the cell runs on under the held end (DESIGN-B 8: the trace keeps the cell going until the harvest is asked)
    for (let i = 0; i < 200 && host.acting(); i++) { run(s.net, 50); host.tick(0.05); }
  };
  return { host, seen, stamps, opened, lookAtBody, trace, done() { host.dispose(); } };
}
const answered = async (book) => { for (let i = 0; i < 400 && book.pendingHarvests; i++) await new Promise((r) => setTimeout(r, 5)); for (let i = 0; i < 4; i++) await tick(); };

test('T-B4 EMPTY-BODY AC-B2 (Hunting, the addendum): Bob holding a Skinning Knife over his emptied, stamped street body is shown the Skin pop-up - the prompt "Skin the Rat", a menu with the Skin row and no Search row - and the act runs to a harvest; over a body with loot the menu holds Skin and Search', async () => {
  setForagingHost({ world: () => NIGHT });   // Hunting keeps no hours: the night (the knife works neither inside nor by day)
  const s = await scene('street', [MAC, EVE], { pile: BODY });
  const asked = [];
  const book = await bookOf(asked);
  const h = huntOver(s, book);
  try {
    // a body with loot: Skin and Search (guard)
    h.lookAtBody();
    h.host.tick(0.016);
    const key = `prof:${h.host.target?.node.key}`;
    assert.ok(h.host.target, 'the stamped body is a node while the pack holds a knife (guard)');
    assert.deepEqual(h.host.hoverName(key)?.actions.map((a) => a.id), ['hide', 'search'], 'a body with loot: the menu holds Skin and Search (guard)');
    assert.deepEqual([h.seen.prompt?.verb, h.seen.prompt?.rest], ['Choose', 'Skin the Rat / Search the Rat'], 'and the prompt is the choice (guard)');
    // emptied by the party's granted claims
    for (const [p, piece] of [[s.mac, GOLD], [s.eve, BUCKLER], [s.mac, POTION]]) {
      const w = lootWindow(p); p.press(keyFor(s, p), w); assert.ok(w.take(choosing(piece)), `${p.id} takes ${piece}`); w.close(); run(s.net, 400);
    }
    run(s.net, SETTLED_MS);
    assert.equal(s.rat.entity.items.length, 0, 'Bob\'s body is empty (guard)');
    h.lookAtBody();
    h.host.tick(0.016);
    assert.ok(h.host.target, 'the emptied body is still a node for the knife: skinning is the knife\'s act, not loot (guard)');
    const menu = h.host.hoverName(`prof:${h.host.target.node.key}`);
    assert.deepEqual(menu?.actions.map((a) => a.id), ['hide'], `EMPTY-BODY/AC-B2: the menu over the emptied body holds ${JSON.stringify(menu?.actions.map((a) => a.id))} - the Skin row alone: the Search row goes with the loot, as the dungeon's already does`);
    assert.deepEqual([h.seen.prompt?.verb, h.seen.prompt?.rest.includes('Search')], ['Skin the Rat', false], `EMPTY-BODY/AC-B2: the prompt over the emptied body is ${JSON.stringify(h.seen.prompt)} - "Skin the Rat" is drawn, and no Search`);
    assert.equal(h.host.press(), true, 'the press starts the act');
    h.trace();
    await answered(book);
    assert.equal(asked.length, 1, 'the act ran to a harvest the account was asked for');
    assert.equal(asked[0].kind, 'hide', 'a hide');
    assert.deepEqual(h.opened, [], 'and no loot window was opened for the empty body');
  } finally { h.done(); }
});

test('T-B4 EMPTY-BODY AC-B2 (guard, the addendum): an emptied body the player cannot skin - no knife in the pack - shows nothing at all: no node, no prompt, no menu, no plaque on the ray', async () => {
  setForagingHost({ world: () => NIGHT });
  // PIN MOVED (PARTY-SKIN, Travis 2026-10-19: "bodies can be skinned only once by anyone"): the 'no stamp' half is retired - online a body is the knife's
  // whoever's blow felled it (test/net/partyskin.test.js), the kill's stamp is no longer what makes a node; offline it still is (S12 there)
  for (const [what, opts] of [['no knife', { knife: false }]]) {
    const s = await scene('street', [MAC, EVE], { pile: BODY });
    for (const [p, piece] of [[s.mac, GOLD], [s.eve, BUCKLER], [s.mac, POTION]]) {
      const w = lootWindow(p); p.press(keyFor(s, p), w); assert.ok(w.take(choosing(piece)), `${p.id} takes ${piece}`); w.close(); run(s.net, 400);
    }
    run(s.net, SETTLED_MS);
    assert.equal(s.rat.entity.items.length, 0, `${what}: Bob's body is empty (guard)`);
    const book = await bookOf([]);
    const h = huntOver(s, book, opts);
    try {
      h.lookAtBody();
      h.host.tick(0.016);
      assert.equal(h.host.target, null, `${what}: the emptied body is no node`);
      assert.equal(h.seen.prompt, null, `${what}: no prompt`);
      assert.equal(h.host.hoverName(`prof:body:x`), null, `${what}: no menu`);
      const f = onRay(s.bob, keyFor(s, s.bob));
      assert.equal(f, null, `EMPTY-BODY/AC-B2: ${what}: the plaque on the ray over the emptied body is ${said(f)} - it shows nothing at all`);
    } finally { h.done(); registerPlayerKillListener('emptybody', null); }
  }
});

for (const where of ['street', 'building']) {
  test(`T-B8 EMPTY-BODY AC-B1 (${where}, guard - puppets): a body with loot is a target for its owner and for both party members at once - before any plaque has read a puppet's list (a born puppet's entity.items is the view only once its contents have been read)`, async () => {
    const s = await scene(where, [MAC, EVE], { pile: BODY });
    for (const p of [s.mac, s.eve, s.bob]) {
      const key = keyFor(s, p);
      assert.ok(p.pool().lootTargets().some((t) => t.key === key), `${p.id}'s pool stands a loot target for the body with its three pieces - read before any plaque or window has asked for its list`);
      const f = onRay(p, key);
      assert.ok(f && f.kind === 'items' && !f.empty && f.rows.length === 3, `${p.id}'s plaque on the ray is ${said(f)}, not the body's three pieces`);
    }
  });
}

test('T-B8b EMPTY-BODY AC-B1 (guard - puppets, an older owner): the body of an OLDER owner (no takes digest on its frames) is a target for its party member while the reader\'s own view of it is empty - the pool\'s list gate is never read of a puppet', async () => {
  const s = await scene('street', [MAC], { pile: BODY, stripBw: true });
  const key = keyFor(s, s.mac);
  const pup = s.mac.pool().foes.find((f) => f.puppet === BOB && f.corpse);
  assert.ok(pup, 'Mac stands Bob\'s body as a puppet (guard)');
  assert.equal(pup.entity.items?.length ?? 0, 0, 'and its list is empty here: an older owner\'s pile is asked of the owner at the press, never read (guard)');
  assert.ok(s.mac.pool().lootTargets().some((t) => t.key === key), 'the older owner\'s body is a loot target for Mac - its press asks the owner');
  const f = onRay(s.mac, key);
  assert.ok(f, 'and Mac\'s plaque on the ray names it');
  assert.equal(f.empty === true, false, `and never says "Empty" of a list it has not read (${said(f)})`);
});

// ═══ AC-B3 - THE RULE IS A LIVE PREDICATE, NOT A LATCH ═══════════════════════════════════════════════════════════════════════════════
test('T-B5 EMPTY-BODY AC-B3 (guard - no latch): Bob takes all and lays one piece back in his still-open window - after his close the body is a target again and its plaque lists that piece for all three', async () => {
  const s = await scene('street', [MAC, EVE], { pile: BODY });
  const w = lootWindow(s.bob);
  s.bob.press(keyFor(s, s.bob), w);
  assert.equal(w.opened.length, 1, 'Bob\'s press opened his window (guard)');
  w.takeAll();
  assert.equal(s.rat.entity.items.length, 0, 'Bob took all: his list is empty under his open window (guard)');
  run(s.net, SETTLED_MS / 4, [w]);   // frames pass with the list empty: the world reads every pool's targets each frame, as a latch would fire on
  for (const p of everyone(s)) p.pool().lootTargets();   // asked of every pool while the list is empty - and nothing is said of it here: a fix that DISABLES the body at its emptying would show below
  const back = s.bob.entity.items.find((it) => pieceOf(it) === BUCKLER);
  assert.ok(back, 'the Buckler is in Bob\'s pack (guard)');
  assert.ok(w.store(back), 'Bob lays the Buckler back in the window');
  w.close();
  run(s.net, SETTLED_MS);
  for (const p of everyone(s)) {
    const f = onRay(p, keyFor(s, p));
    assert.ok(f && f.kind === 'items' && !f.empty, `EMPTY-BODY/AC-B3: ${p.id}'s plaque on the ray is ${said(f)} - a refilled body is a target again, with no latch left by its emptying`);
    assert.deepEqual(f.rows.map((r) => pieceOf(r.item)), [BUCKLER], `${p.id}'s plaque lists the piece Bob laid back`);
  }
});

test('T-B6 EMPTY-BODY AC-B3 (guard): an emptied body has no LOOT-STACK tab (pileBody), no line of light (lootFinds) and no Physical Items proxies; a body with loot has all three', async () => {
  const s = await scene('street', [MAC, EVE], { pile: BODY });
  const key = keyFor(s, s.bob);
  const doors = () => ({ tab: s.bob.pool().pileBody(key), light: s.bob.pool().lootFinds().length, physical: s.bob.pool().physicalCorpses().filter((c) => c.key === key && c.entity.items.length > 0).length });   // the layer stands a proxy for each item a source lists: a source with an empty list stands none
  const full = doors();
  assert.ok(full.tab && full.tab.count === 3, `a body with loot has its LOOT-STACK tab (guard): ${JSON.stringify(full)}`);
  assert.equal(full.light, 1, 'and its line of light (guard)');
  assert.equal(full.physical, 1, 'and its Physical Items source, with the items to stand round it (guard)');
  for (const [p, piece] of [[s.mac, GOLD], [s.eve, BUCKLER], [s.mac, POTION]]) {
    const w = lootWindow(p); p.press(keyFor(s, p), w); assert.ok(w.take(choosing(piece)), `${p.id} takes ${piece}`); w.close(); run(s.net, 400);
  }
  run(s.net, SETTLED_MS);
  assert.deepEqual(doors(), { tab: null, light: 0, physical: 0 }, 'an emptied body has none of the three');
});
