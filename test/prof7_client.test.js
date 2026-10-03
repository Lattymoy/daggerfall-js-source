// PROF7 (2026-09-29, Mac: "Do it") - HUNTING AND OUTFITTING AS THE CLIENT MAKES THEM: a body the player's own blow felled,
// stamped at the kill and skinned with the knife where it lies (a loose node in the one gathering host - the trace, DFU's
// Dagger in the hand, the act choice key's search of the body); the knife's checks, template and online shelves; the
// hides, leathers, cloth, parts and butchery as items; the loom's pieces (leather armour at Leather, a garment in its
// dye, the rugs and skins, the Fishing-Net, the knife at the anvil); the Loom on the Stores page with the stitch; Hunting
// and Outfitting practised; a Tracker's marks; and the done-when, driven through the real Worker: A BEAR FELLED BY THE
// PLAYER'S OWN BLOW, SKINNED ONLINE, ITS HIDES CURED AT A CLOTHING STORE'S RACK AND SEWN INTO A LEATHER HELM IN THE PACK,
// AND A SHIRT IN THE DYE ITS SEWER CHOSE. Then the hosts' wiring. bible/06-Systems/Professions-Arc.md 29.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService, T0, sessionStorageOf } from './accountDb.mjs';
import { accountProf, SESSION_KEY, accountRefusalText } from '../src/net/accountClient.js';
import { createProfBook } from '../src/net/profBook.js';
import { bodyKey, parseNodeKey, utcDayOfMs } from '../src/net/nodeLaw.js';
import { xpForRank, SKINNING_KNIFE, TRACE_ACT, KNIFE_REFUSALS, HIDES_PER_DAY, TRACKER_M } from '../src/net/professionLaw.js';
import { TOOL_LIFE, recipeById } from '../src/net/recipeLaw.js';
import { createBodyStamps, bodiesOf, trackerMarks, huntPlan, huntKind, KNIFE_HAND, BODY_REACH, bodyId } from '../src/scenes/huntHost.js';
import { createGatherHost, aimAt, storesWhereLine } from '../src/scenes/gatherHost.js';
import { registerPlayerKillListener, reportPlayerKill } from '../src/systems/playerKills.js';
import { setForagingHost } from '../src/systems/foragingInstall.js';
import { mintPiece, mintPieces, garmentItem, isCraftedFurniture, LOOM_KEPT_TEXT } from '../src/systems/smithItems.js';
import { mintMaterialItem, materialLabel, materialCountLabel, withdrawIntoPack, foodTemplate } from '../src/systems/profItems.js';
import { HIDE_TEMPLATE_ROWS, SKINNING_KNIFE_ROW, knifeCustomItemsForGroup } from '../src/systems/profTemplates.js';
import { templateByIndex, customItemsForGroup, inventoryItemImage } from '../src/systems/itemTemplates.js';
import { itemLongName } from '../src/systems/itemInfo.js';
import { ITEM_FIELDS } from '../src/systems/itemFields.js';
import { createProfHud } from '../src/ui/profHud.js';
import { FT } from '../src/systems/foragingLaw.js';
import { TEMPLATE as CC } from '../src/systems/survival/food.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';
import { sharedClassicMinutes } from '../src/net/wire.js';
import { utcDay } from '../src/net/marksLaw.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const noWait = () => Promise.resolve();
const tick = () => new Promise((r) => setImmediate(r));
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const DAY = 86_400;
const WOODS = 231, GLENUMBRA = 59;
const hourAt = (s) => Math.floor((((Math.floor(sharedClassicMinutes(s * 1000)) % 1440) + 1440) % 1440) / 60);
function secondAt(from, want) {
  for (let s = from; s < from + 2 * 7200; s += 30) if (hourAt(s) === want && hourAt(s - 60) === want && hourAt(s + 60) === want) return s;
  throw new Error('no such hour');
}
const NOON = secondAt(utcDay(T0) * DAY + 3600, 12);
const PROV = '0123456789abcdef';
const WILDS = { inside: false, insideDungeon: false, insideCastle: false, locationType: 0xffff, inLocationRect: false, hour: 2, climate: WOODS, region: GLENUMBRA, enemiesNear: false, carriedWeight: 0, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' };
const knifeOf = (condition = 50) => ({ templateIndex: SKINNING_KNIFE.templateIndex, name: 'Skinning Knife', currentCondition: condition, maxCondition: 50 });
/** The book's harvests answered and said - the service's answer is real I/O (the Worker hashes the session), never a
 *  fixed count of ticks. */
async function answered(book) {
  for (let i = 0; i < 400 && book.pendingHarvests; i++) await new Promise((r) => setTimeout(r, 5));
  for (let i = 0; i < 4; i++) await tick();
}

/**
 * A HUNT IN THE ONE HOST - a foe pool, the kill signal stamping, the gathering host with Hunting's kind, the player's
 * eye and view and the input the frames read. `kill(type, at)` fells a foe with the player's own blow where it stands.
 */
function huntStand(book, { entity = { items: [knifeOf()] }, nowMs = () => NOON * 1000 } = {}) {
  const stamps = createBodyStamps({ nowMs });
  registerPlayerKillListener('prof7-test', (e) => { stamps.stamp(e); });
  const foes = [];
  const said = [];
  const hud = { setPrompt: (p) => { said.prompt = p; }, setMeter: (m, l) => { said.meter = m; said.label = l; }, toast: (x) => said.push(x), banner: (b) => { said.banner = b; }, setChip: (c) => { said.chip = c; }, frame: () => {}, dispose: () => {} };
  const feet = [0, 0, 0];
  const view = { yaw: 0, pitch: 0 };
  let input = { held: false, attack: false, choice: false };
  let lit = null;   // PROF-MENU: the row the plaque has lit over the body
  const eyePos = () => [feet[0], feet[1] + 1.6, feet[2]];
  const host = createGatherHost({
    book, hud, kinds: [huntKind({ book, bodies: () => bodiesOf(foes, stamps, (f) => f.corpseMarker?.pos ?? f.ai?.feet) })],
    renderer: { createBillboardBatch: () => ({}), destroyBatch: () => {} }, getTexture: async () => ({ recordCount: 99 }), uploadRecord: () => {},
    billboardSize: () => ({ w: 1, h: 1 }), flatBatchAabb: () => [0, 0, 0, 1, 1, 1], built: () => new Map(),
    pixelTranslation: (x, y, out) => { out[0] = 0; out[1] = 0; out[2] = 0; return out; }, pixelInfo: () => ({ climate: WOODS, region: GLENUMBRA }), nowMs,
    eye: () => ({ pos: eyePos(), dir: [Math.sin((view.yaw * Math.PI) / 180) * Math.cos((view.pitch * Math.PI) / 180), Math.sin((view.pitch * Math.PI) / 180), Math.cos((view.yaw * Math.PI) / 180) * Math.cos((view.pitch * Math.PI) / 180)] }),
    view: () => view, feet: () => feet, entity: () => entity, keyLabel: (a) => (a === 'ActChoice' ? 'R' : 'E'), input: () => input, active: () => true, lit: () => lit,
  });
  const kill = (mobileType, at) => {
    const f = { entity: { mobileType, name: 'foe' }, dead: false, corpse: false, ai: { feet: [...at] } };
    foes.push(f);
    reportPlayerKill(f.entity, { kind: 'melee' });
    f.dead = true; f.corpse = true; f.corpseMarker = { pos: [...at] };
    return f;
  };
  /** The crosshair on a body's centre from where the player stands. */
  const lookAt = (f) => {
    const p = f.corpseMarker.pos;
    const at = aimAt(eyePos(), [p[0], p[1] + 0.2, p[2]], { yaw: 0, pitch: 0 });
    view.yaw = -at.yaw; view.pitch = -at.pitch;
    return at;
  };
  /** The knife drawn along the act's own line, E held, `steps` frames of `dt`. */
  const trace = (f, { steps = 40, dt = 0.05, off = 0 } = {}) => {
    const at0 = lookAt(f);
    host.tick(0.001);   // the act's first frame draws its meter - its line read off it
    const pts = said.meter.state.points;
    for (let i = 0; i <= steps; i++) {
      const u = (i / steps) * (pts.length - 1);
      const k = Math.min(pts.length - 2, Math.floor(u)), t = u - k;
      view.yaw = -at0.yaw + pts[k][0] + (pts[k + 1][0] - pts[k][0]) * t;
      view.pitch = -at0.pitch + pts[k][1] + (pts[k + 1][1] - pts[k][1]) * t + off;
      input = { held: true, attack: false, choice: false };   // E held: the knife drawn
      host.tick(dt);
    }
    input = { held: false, attack: false, choice: false };
  };
  return {
    host, said, feet, view, foes, stamps, kill, lookAt, trace, entity,
    set input(v) { input = { held: false, attack: false, choice: false, ...v }; },
    set lit(v) { lit = v; },
    done() { registerPlayerKillListener('prof7-test', null); host.dispose(); },
  };
}

// ─── THE DONE-WHEN ───────────────────────────────────────────────────

test('PROF7 DONE WHEN: a bear felled by the player\'s own blow, skinned online with the knife (its line traced, DFU\'s Dagger in the hand), its hides cured at a Clothing Store\'s rack (a Tanner\'s 1:1) and sewn into a Leather Helm in the pack - and a shirt in the dye its sewer chose, of the Weavers\' Linen; the butchery withdrawn as C&C\'s Raw Meat', async (t) => {
  t.mock.method(Date, 'now', () => NOON * 1000);
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const mac = await s.registered('Mac');
  raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, updated_at) VALUES (?, ?, 'hunting', ?, 'tanner', ?)`).run(mac.id, mac.character, xpForRank(50), NOON);
  raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, 'outfitting', ?, ?)`).run(mac.id, mac.character, xpForRank(10), NOON);   // Cured Leather is tier 2's
  raw.prepare('INSERT INTO marks (account, balance) VALUES (?, ?)').run(mac.id, 100);
  const door = accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, mac) });
  const book = createProfBook({ door, storage: memStorage(), character: () => mac.character, now: () => NOON * 1000, sleep: noWait });
  assert.equal((await book.refresh()).ok, true);
  setForagingHost({ world: () => WILDS });   // the night: Hunting keeps no hours
  const h = huntStand(book);
  try {
    for (const [i, at] of [[0, [0, 0, 2.2]], [1, [6, 0, 2.2]]]) {
      h.feet[0] = at[0]; h.feet[2] = 0;
      const bear = h.kill(MOBILE_TYPES.GrizzlyBear, at);
      h.lookAt(bear);
      h.host.tick(0.016);
      assert.equal(h.host.target?.node.key, h.stamps.of(bear.entity).key, `bear ${i}: the body a node where it lies`);
      // PROF-MENU: the body's list - its knife and its search, the knife's word under its name; no plaque, the choice E opens
      assert.deepEqual(h.host.hoverName(`prof:${h.host.target.node.key}`), { title: 'Grizzly Bear', subs: ['Hunting 50'], actions: [{ id: 'hide', label: 'Skin the Grizzly Bear' }, { id: 'search', label: 'Search the Grizzly Bear' }] });
      assert.deepEqual([h.said.prompt.verb, h.said.prompt.rest], ['Choose', 'Skin the Grizzly Bear / Search the Grizzly Bear']);
      assert.equal(h.host.press(), true);
      assert.deepEqual(h.host.handTool(), KNIFE_HAND, 'DFU\'s Dagger');
      h.trace(bear);
      await answered(book);
      assert.equal(h.host.acting(), false);
    }
    assert.ok(book.held('hide:bear') >= 2, `two bears' hides at the least: ${book.held('hide:bear')}`);
    assert.ok(h.said.some((x) => /^\+[12] Bear Hides?(, .+)? and (\d+ )?Raw Meat to your Stores$/.test(x)), h.said.join(' | '));   // GATHER-SAID: the butchery in the hides' line
    assert.ok(h.said.some((x) => / Hunting XP \(a clean pelt\)$/.test(x)), 'a line traced true: a clean pelt');
    assert.ok(h.said.some((x) => / Raw Meat to your Stores$/.test(x)), 'the butchery said');
    assert.equal(h.entity.items[0].currentCondition, 48, 'the knife worn by one a body');
    assert.deepEqual([book.state.hunt.hides, book.state.today.hunting], [book.held('hide:bear'), 2], 'the day in hides (AUDIT 32 L2), the harvests two');
  } finally { h.done(); setForagingHost(null); }
  // at a Clothing Store's rack: a Tanner cures two hides to two leathers
  const cure = await book.smelt('cure:bear', 1);
  assert.equal(cure.ok, true, JSON.stringify(cure));
  assert.equal(book.held('leather:cured'), 2);
  // the helm sewn with a clean stitch, minted into the pack
  const pack = { items: [] };
  const helm = await book.craft('leather-helm:cured', { clean: true, name: 'Silverthorn' }, (data) => { for (const it of mintPieces(data)) pack.items.push(it); });
  assert.equal(helm.ok, true, JSON.stringify(helm));
  const [piece] = pack.items;
  assert.deepEqual([piece.group, piece.templateIndex, piece.material, piece.recipe, piece.provenance], ['Armor', 107, 0, 'leather-helm:cured', helm.data.pieces[0].provenance]);
  assert.match(itemLongName(piece), /Helm/);
  assert.equal(book.held('leather:cured'), 0);
  assert.equal(book.track('outfitting').xp > 0, true, 'Outfitting XP');
  // the Weavers' Linen, and a shirt in Aquamarine
  const linen = await book.stock('cloth:linen', 2);
  assert.equal(linen.ok, true, JSON.stringify(linen));
  const shirt = await book.craft('garment-165:linen', { clean: false, dye: 7 }, (data) => { for (const it of mintPieces(data)) pack.items.push(it); });
  assert.equal(shirt.ok, true, JSON.stringify(shirt));
  assert.deepEqual([pack.items[1].group, pack.items[1].templateIndex, pack.items[1].dye], ['MensClothing', 165, 7]);
  // the butchery to the pack: C&C's Raw Meat
  const meat = await book.withdraw('food:meat', 1, (k, n) => withdrawIntoPack(pack, k, n, true));
  assert.equal(meat.ok, true, JSON.stringify(meat));
  assert.equal(pack.items.at(-1).templateIndex, CC.RawMeat);
});

// ─── THE BODY ────────────────────────────────────────────────────────

test('PROF7 bodies: the player\'s own kill stamps a foe 4.4 skins - today\'s key and twelve drawn hex digits, the foe and its tier; a foe no knife takes a hide from none; a kill told again stamps anew; a pool\'s bodies are its dead with a body and a stamp, where they lie now; a Tracker marks the living animals within 100 m', () => {
  let day = 20833;
  const draws = [];
  const stamps = createBodyStamps({ nowMs: () => day * 86_400_000 + 5, rand: (b) => { draws.push(b.length); b.fill(0xab); } });
  const bear = { mobileType: MOBILE_TYPES.GrizzlyBear };
  const s1 = stamps.stamp(bear);
  assert.deepEqual({ ...s1 }, { key: 'body:20833:abababababab', foe: 4, tier: 2, hide: 'hide:bear' });
  assert.deepEqual(parseNodeKey(s1.key), { kind: 'body', day: 20833, id: 'abababababab' });
  assert.deepEqual(draws, [6]);
  assert.equal(stamps.of(bear), s1);
  assert.equal(stamps.stamp({ mobileType: MOBILE_TYPES.Orc }), null);
  assert.equal(stamps.stamp(null), null);
  day++;
  assert.equal(stamps.stamp(bear).key, 'body:20834:abababababab', 'felled anew: stamped anew');
  stamps.clear();
  assert.equal(stamps.of(bear), null);
  assert.equal(bodyId((b) => { for (let i = 0; i < b.length; i++) b[i] = i * 40; }), '00285078a0c8');
  assert.deepEqual({ ...KNIFE_HAND }, { group: 'Weapons', templateIndex: 113, material: 0 }, 'DFU\'s Dagger in the hand');
  // the pool's bodies
  const st = createBodyStamps({ nowMs: () => 0, rand: (b) => b.fill(1) });
  const dead = { entity: { mobileType: MOBILE_TYPES.Spider }, dead: true, corpse: true, corpseMarker: { pos: [1, 0, 2] }, ai: { feet: [9, 9, 9] } };
  const alive = { entity: { mobileType: MOBILE_TYPES.Rat }, dead: false, corpse: false, ai: { feet: [3, 0, 3] } };
  const other = { entity: { mobileType: MOBILE_TYPES.Rat }, dead: true, corpse: true, ai: { feet: [4, 0, 4] } };   // another's kill: no stamp
  st.stamp(dead.entity); st.stamp(alive.entity);
  const bodies = bodiesOf([dead, alive, other, null], st, (f) => f.corpseMarker?.pos ?? f.ai?.feet);
  assert.deepEqual(bodies.map((b) => [b.key, b.foe, b.tier, b.hide, b.at(), b.lift, b.reach]), [[st.of(dead.entity).key, 6, 3, 'hide:spider', [1, 0, 2], 0.2, BODY_REACH]]);
  dead.corpseMarker.pos = [5, 0, 6];   // the floating origin moves it
  assert.deepEqual(bodies[0].at(), [5, 0, 6], 'where it lies now');
  // a Tracker's marks: the living animals within 100 m
  const pool = [
    { entity: { mobileType: MOBILE_TYPES.GrizzlyBear }, dead: false, ai: { feet: [10, 0, 10] } },
    { entity: { mobileType: MOBILE_TYPES.Orc }, dead: false, ai: { feet: [5, 0, 5] } },
    { entity: { mobileType: MOBILE_TYPES.Rat }, dead: true, ai: { feet: [1, 0, 1] } },
    { entity: { mobileType: MOBILE_TYPES.SabertoothTiger }, dead: false, ai: { feet: [0, 0, TRACKER_M + 1] } },
    { mobileType: MOBILE_TYPES.Spider, dead: false, ai: { feet: [0, 0, TRACKER_M] } },
  ];
  assert.deepEqual(trackerMarks(pool, [0, 0, 0]), [[10, 10], [0, TRACKER_M]]);
});

test('PROF7 plan: what E does at a body - the knife skins; the act choice key searches the body instead (its loot DFU\'s, untouched); skinned, being counted, the account\'s day and its rare hides, the rank and the Stores\' room each said', () => {
  const body = { foe: MOBILE_TYPES.GrizzlyBear, tier: 2, hide: 'hide:bear' };
  const plan = (o = {}) => huntPlan({ body, taken: false, counting: false, rank: 10, storesFull: () => false, hides: 0, high: 0, ...o });
  assert.deepEqual(plan(), { harvest: 'hide', verb: 'Skin the Grizzly Bear', rest: 'Hunting 10', ready: true });
  assert.deepEqual(plan({ loot: true }), { harvest: 'hide', verb: 'Search the Grizzly Bear', rest: '', ready: false, loot: true });
  assert.deepEqual([plan({ taken: true }).verb, plan({ taken: true }).rest], ['The Grizzly Bear - skinned', '']);
  assert.equal(plan({ counting: true }).rest, 'being counted');
  assert.deepEqual([plan({ hides: HIDES_PER_DAY }).rest, plan({ hides: HIDES_PER_DAY }).full], [`Hunting 10 - ${HIDES_PER_DAY} of ${HIDES_PER_DAY} hides today`, true]);
  assert.equal(plan({ high: 3 }).ready, true, 'a bear is no rare hide');
  const harpy = { foe: MOBILE_TYPES.Harpy, tier: 5, hide: 'hide:harpy' };
  assert.equal(huntPlan({ body: harpy, taken: false, counting: false, rank: 60, storesFull: () => false, hides: 3, high: 3 }).rest, '3 of 3 rare hides today');
  assert.deepEqual([plan({ rank: 9 }).rest, plan({ rank: 9 }).needsRank], ['needs Hunting 10', 10]);
  assert.match(plan({ storesFull: (k) => k === 'hide:bear' }).rest, /^Stores full - /);
});

test('PROF7 host: a body is a node only while the pack holds a knife; targeted where it lies, E starts the trace (the knife\'s checks first, in Foraging\'s voice - a settlement\'s and the sea\'s the plan\'s, E the loot\'s there, AUDIT 32 H4); the choice key hands the press on to the loot; the act follows the body as the scene moves and ends when its pool lets it go; the harvest names the foe and no ground; a body skinned is no target', async () => {
  const asked = [];
  let taken = [];
  const door = {
    account: () => 'acct-1',
    state: async () => ({ ok: true, data: { day: utcDayOfMs(NOON * 1000), character: 'c1', tracks: [{ profession: 'hunting', xp: xpForRank(10), rank: 10, specs: { 50: null, 100: null } }], today: {}, taken, stores: [], caps: { harvests: 60, stores: 5000, hides: 30, highHides: 3 }, hunt: { hides: 4, high: 0 } } }),
    pixels: async () => ({ ok: true, data: { pixels: [], dungeons: [] } }),
    harvest: async (b) => {
      asked.push(b); taken = [`${b.node}|hide`];
      return { ok: true, data: { node: b.node, kind: b.kind, material: 'hide:bear', qty: 1, xp: 30, gem: 'part:tooth', gemStore: { material: 'part:tooth', own: 1, bought: 0 }, extra: 'food:meat', extraQty: 2, extraStore: { material: 'food:meat', own: 2, bought: 0 }, track: { profession: 'hunting', xp: xpForRank(10) + 30, rank: 10 }, today: 1, hunt: { hides: 5, high: 0 } } };
    },
  };
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c1', now: () => NOON * 1000, sleep: noWait });
  await book.refresh();
  let world = { ...WILDS, inLocationRect: true, locationType: 0 };
  setForagingHost({ world: () => world });
  const h = huntStand(book, { entity: { items: [] } });
  try {
    const bear = h.kill(MOBILE_TYPES.GrizzlyBear, [0, 0, 2.2]);
    h.lookAt(bear);
    h.host.tick(0.016);
    assert.equal(h.host.target, null, 'no knife: DFU\'s corpse alone, no prompt in the way');
    h.entity.items.push(knifeOf());
    h.host.tick(0.016);
    assert.equal(h.host.target?.node.kind, 'body');
    assert.equal(h.said.chip, 'Hunting 10 - 4 / 30 today', 'the account\'s day on the chip');
    // PROF-MENU: the list's search lit - the press passes on to the body's loot, and says nothing of its own
    h.lit = 'search';
    assert.deepEqual([h.host.press(), h.host.sayNeed()], [false, false]);
    h.lit = null;
    // AUDIT 32 H4: a settlement is ground the knife never works - its row refused, and E goes on to the body's loot
    // (AUDIT 29 C1); what it needs said only when nothing else opened (VEIN-NEED)
    assert.deepEqual(h.host.hoverName(`prof:${h.host.target.node.key}`).actions[0], { id: 'hide', label: 'Skin the Grizzly Bear', disabled: true, why: 'not in a settlement' });
    assert.deepEqual([h.said.prompt.verb, h.said.prompt.rest], ['Search the Grizzly Bear', ''], 'no plaque: the one act left its prompt');
    assert.deepEqual([h.host.press(), h.host.acting()], [false, false]);
    assert.equal(h.host.sayNeed(), true);
    assert.equal(h.said.at(-1), 'Skin the Grizzly Bear: not in a settlement');
    // the knife's own checks in Foraging's voice: a foe near refuses - the press the body's, its refusal said
    world = { ...WILDS, enemiesNear: true };
    h.host.tick(0.016);
    assert.equal(h.host.press(), true);
    assert.deepEqual([h.said.at(-1), h.host.acting()], [KNIFE_REFUSALS.enemies, false]);
    world = WILDS;
    assert.equal(h.host.press(), true);
    h.host.tick(0.001);
    assert.equal(h.said.meter.state.kind, 'trace');
    assert.equal(h.said.meter.state.points.length, 6, 'a tier 2 body: six points');
    // the scene moves under the act (a floating-origin recentre): the act follows its body
    bear.corpseMarker.pos = [0, 0, 2.3];
    h.host.tick(0.016);
    assert.equal(h.host.acting(), true);
    h.trace(bear);
    await answered(book);
    assert.equal(asked.length, 1);
    assert.deepEqual([asked[0].node, asked[0].kind, asked[0].foe, asked[0].climate, asked[0].region, asked[0].act.clean], [h.stamps.of(bear.entity).key, 'hide', 4, null, null, true]);
    assert.deepEqual(h.said.slice(-3), ['+1 Bear Hide, a Big Tooth and 2 Raw Meat to your Stores', storesWhereLine('E'), '+30 Hunting XP (a clean pelt)']);   // GATHER-SAID: one line of goods, and the session's first says where they went
    assert.deepEqual([book.state.hunt, book.held('food:meat'), book.held('part:tooth')], [{ hides: 5, high: 0 }, 2, 1], 'the book applies the butchery\'s Stores and the day');
    h.host.tick(0.016);
    assert.equal(h.host.target, null, 'skinned: DFU\'s corpse again');
    // a second body: its pool lets it go under the act - the act ends, nothing asked
    const rat = h.kill(MOBILE_TYPES.Rat, [0, 0, 2.2]);
    h.lookAt(rat);
    h.host.tick(0.016);
    assert.equal(h.host.press(), true);
    h.foes.splice(h.foes.indexOf(rat), 1);
    h.host.tick(0.016);
    assert.deepEqual([h.host.acting(), asked.length], [false, 1]);
  } finally { h.done(); setForagingHost(null); }
});

test('PROF7 HUD: the trace\'s meter - the carcass\'s face, its dotted line, the points the knife has passed lit, the crosshair on it; a hold\'s bar for Gentle acts', async () => {
  const { createTraceAct } = await import('../src/systems/traceAct.js');
  const hud = createProfHud({ doc: document });
  const act = createTraceAct({ tier: 1, rng: () => 0.5 });
  act.tick(0.05, { held: true, aim: { yaw: -7, pitch: 0 } });
  act.tick(0.05, { held: true, aim: { yaw: -3.5, pitch: 0 } });
  hud.setMeter(act);
  const meter = document.body.querySelector('.prof-meter');
  const face = meter.querySelector('.prof-face');
  assert.equal(face.querySelectorAll('.prof-glint').length + face.querySelectorAll('.prof-point').length, 5);
  assert.equal(face.querySelectorAll('.prof-glint').length, 2, 'the first point and the second passed');
  assert.ok(face.querySelector('.prof-aim'));
  assert.match(meter.textContent, /draw the knife along the line/);
  hud.setMeter(createTraceAct({ tier: 1 }));
  assert.match(meter.textContent, /hold the use key on the first point/);
  hud.setMeter(createTraceAct({ tier: 1 }), 'E');
  assert.match(meter.textContent, /hold E on the first point/, 'the key the kind names');
  const gentle = createTraceAct({ tier: 1, gentle: true });
  for (let i = 0; i < 3; i++) gentle.tick(0.2, { held: true });
  hud.setMeter(gentle);
  assert.equal(meter.querySelector('.arc-fill').getAttribute('stroke-dasharray'), '50 100');   // PROF-RETICLE: the hold an arc round the crosshair
  assert.match(meter.textContent, /hold the use key/);
  hud.dispose();
});

// ─── THE KNIFE AND THE ITEMS ─────────────────────────────────────────

test('PROF7 items: the Skinning Knife is 603 (0.5 kg, 50 uses, 100 gold, DFU\'s Dagger\'s picture), shelved by a General Store or Pawn Shop online only; the hides, leathers and cloth are registered and withdraw as their templates, a part as DFU\'s own ingredient, the butchery as C&C\'s Raw Meat (a Butcher\'s spoiling half as fast) and a Slaughterfish\'s Raw Fish as a fish of the Basket\'s law', () => {
  const knife = templateByIndex(603);
  assert.deepEqual([knife.name, knife.baseWeight, knife.hitPoints, knife.basePrice, knife.rarity, knife.worldTextureArchive, knife.worldTextureRecord, SKINNING_KNIFE_ROW.stackable], ['Skinning Knife', 0.5, 50, 100, 10, 207, 5, false]);
  const where = globalThis.location;
  try {
    globalThis.location = { search: '' };
    assert.deepEqual(knifeCustomItemsForGroup('UselessItems2'), [], 'offline nothing uses it');
    globalThis.location = { search: '?online' };
    assert.deepEqual([knifeCustomItemsForGroup('UselessItems2'), knifeCustomItemsForGroup('Weapons')], [[603], []]);
    assert.ok(customItemsForGroup('UselessItems2').includes(603), 'on DFU\'s own custom-item loop');
  } finally { globalThis.location = where; }
  assert.deepEqual(HIDE_TEMPLATE_ROWS.map((r) => r.index), [655, 656, 657, 658, 659, 660, 661, 662, 663, 664, 665, 666, 668, 669, 670, 671]);
  assert.ok(HIDE_TEMPLATE_ROWS.every((r) => r.stackable === true && r.rarity === 10));
  assert.deepEqual([657, 659, 662, 665, 666, 670].map((t) => [templateByIndex(t).name, templateByIndex(t).baseWeight, templateByIndex(t).basePrice]),
    [['Bear Hide', 1, 16], ['Spider Silk', 0.25, 32], ['Harpy Feathers', 0.25, 72], ['Cured Leather', 1, 24], ['Hardened Leather', 1, 108], ['Silk Bolt', 0.5, 72]]);
  const pic = inventoryItemImage(mintMaterialItem('hide:bear', false));
  assert.deepEqual([pic.archive, pic.record], [254, 55], 'Nymph Hair\'s lock');
  assert.deepEqual(['hide:bear', 'leather:hardened', 'cloth:wool'].map((k) => { const it = mintMaterialItem(k, false); return [it.group, it.templateIndex]; }), [['UselessItems2', 657], ['UselessItems2', 666], ['UselessItems2', 669]]);
  const tooth = mintMaterialItem('part:tooth', false);
  assert.deepEqual([tooth.group, tooth.templateIndex, materialLabel('part:tooth')], ['MiscellaneousIngredients1', 56, 'Big Tooth']);
  assert.deepEqual([foodTemplate('food:meat', true), foodTemplate('food:meat', false), foodTemplate('food:fish', true), foodTemplate('food:fish', false)], [CC.RawMeat, CC.RawMeat, CC.RawFish, FT.Fish]);
  assert.deepEqual([mintMaterialItem('food:meat', false).templateIndex, mintMaterialItem('food:fish', true).templateIndex], [538, 535]);
  const pack = { items: [] };
  assert.equal(withdrawIntoPack(pack, 'food:meat', 2, true, { slowRot: true }), 2);
  assert.deepEqual(pack.items.map((i) => [i.templateIndex, i.slowRot]), [[538, true], [538, true]]);
  assert.equal(withdrawIntoPack(pack, 'food:meat', 1, true).valueOf(), 1);
  assert.equal(pack.items[2].slowRot, undefined, 'only a Butcher\'s');
  assert.equal(ITEM_FIELDS.slowRot.kind, 'bool', 'it rides the save');
  assert.deepEqual(['hide:harpy', 'food:meat', 'part:tooth', 'hide:bear', 'leather:cured'].map((k) => materialCountLabel(k, 2, true)), ['Harpy Feathers', 'Raw Meat', 'Big Teeth', 'Bear Hides', 'Cured Leather']);
});

test('PROF7 pieces: the loom\'s - leather armour DFU\'s at Leather with the quality laid on; a garment DFU\'s clothing in its group, its variant the record\'s seed\'s and its dye the record\'s (an unchangeable shirt\'s too - AUDIT 32 L3); rugs and skins among the home\'s things; the Fishing-Net Foraging\'s and the Skinning Knife the port\'s, each its life its quality', () => {
  const helm = mintPiece({ recipe: 'leather-helm:hardened', quality: 2, seed: 7, maker: 'Silverthorn' }, PROV);
  assert.deepEqual([helm.group, helm.templateIndex, helm.material, helm.quality, helm.recipe, helm.maker], ['Armor', 107, 0, 2, 'leather-helm:hardened', 'Silverthorn']);
  const gown = mintPiece({ recipe: 'garment-195:silk', quality: 1, seed: 5, dye: 4 }, PROV);
  assert.deepEqual([gown.group, gown.templateIndex, gown.variant, gown.dye, gown.name], ['WomensClothing', 195, 5 % templateByIndex(195).variants, 4, 'Evening Gown']);
  assert.deepEqual(mintPiece({ recipe: 'garment-195:silk', quality: 1, seed: 5, dye: 4 }, PROV), gown, 'the record\'s, on every client');
  assert.equal(mintPiece({ recipe: 'garment-178:linen', quality: 1, seed: 1, dye: 4 }, PROV).dye, 4, 'AUDIT 32 L3: an unchangeable shirt is dyed, as DFU\'s shelf dyes it');
  assert.equal(garmentItem(recipeById('garment-141:linen'), 3, null).dye, undefined, 'undyed');
  const skins = mintPiece({ recipe: 'skins-244:bear', quality: 1, seed: 0 }, PROV);
  assert.deepEqual([skins.group, skins.templateIndex, skins.name, isCraftedFurniture(skins)], ['Furniture', 244, 'Large Skins', true]);
  assert.equal(isCraftedFurniture(mintPiece({ recipe: 'tapestry-241:wool', quality: 4, seed: 0 }, PROV)), true);
  const net = mintPiece({ recipe: 'fishingnet:linen', quality: 3, seed: 0 }, PROV);
  const knife = mintPiece({ recipe: 'knife:iron', quality: 0, seed: 0 }, PROV);
  assert.deepEqual([net.templateIndex, net.maxCondition, knife.group, knife.templateIndex, knife.name, knife.maxCondition], [1603, TOOL_LIFE[3], 'UselessItems2', 603, 'Skinning Knife', TOOL_LIFE[0]]);
  assert.match(LOOM_KEPT_TEXT, /last stitch/);
  assert.match(accountRefusalText('prof-hunt-cap'), /hides a day allows \(30, across your characters\)/);
  assert.match(accountRefusalText('prof-hunt-high'), /rare hides/);
  assert.match(accountRefusalText('prof-dye'), /cannot be dyed/);
  assert.match(accountRefusalText('prof-foe'), /No knife/);
});

// ─── THE PAGES ───────────────────────────────────────────────────────

test('PROF7 pages: the Loom at a Clothing Store - the cures for the hides held and the weave, the families, the clothing\'s groups and cloths, the Weavers\' Linen, a garment\'s dye, Craft drawn with the stitch (eight on the beat ask it clean, in the dye it began in), Quick craft; a home\'s sells nothing; away, the word; Hunting and Outfitting practised, Hunting\'s day the account\'s; Smithing\'s unlocks whole again', async () => {
  const { setProfessionsPages, drawStoresPage, drawProfessionsPage, LOOM_FAMILIES, loomRecipes, dyeWord, PROF_STATIONS, stationColdLine } = await import('../src/ui/profPages.js');
  const { setPref } = await import('../src/systems/uiPrefs.js');
  setPref('gentleActs', false);
  const held = new Map([['hide:bear', 4], ['hide:spider', 3], ['leather:cured', 1]]);
  const tracks = new Map([['outfitting', { profession: 'outfitting', xp: xpForRank(10), rank: 10, specs: { 50: null, 100: null } }], ['hunting', { profession: 'hunting', xp: xpForRank(60), rank: 60, specs: { 50: 'tanner', 100: null } }], ['smithing', { profession: 'smithing', xp: 0, rank: 0, specs: { 50: null, 100: null } }]]);
  const book = {
    state: { open: true, day: 1, character: 'c', account: 'a', readAt: Date.now(), stores: new Map(), tracks, today: {}, caps: { hides: 30, highHides: 3 }, hunt: { hides: 7, high: 1 } }, stale: () => false, refresh: async () => ({ ok: true }),
    held: (k) => held.get(k) ?? 0, store: (k) => ({ material: k, own: held.get(k) ?? 0, bought: 0 }),
    track: (p) => tracks.get(p) ?? { profession: p, xp: 0, rank: 0, specs: { 50: null, 100: null } }, materials: () => [], pendingWithdrawals: 0, pendingCrafts: 0,
    choose: async () => ({ ok: true }),
  };
  const crafted = [], bought = [], works = [];
  let loom = { kind: 'shop', fee: 50 };
  setProfessionsPages({
    book, name: (k) => k, withdraw: async () => ({ ok: true, text: '' }), forge: () => null, workbench: () => null, loom: () => loom,
    smelt: async (r, n) => { works.push([r, n]); return { ok: true, text: 'worked' }; },
    craft: async (recipe, o) => { crafted.push([recipe, o.clean, o.dye]); return { ok: true, text: 'made' }; },
    stock: async (m, n, counter) => { bought.push([m, n, counter]); held.set(m, (held.get(m) ?? 0) + n); return { ok: true, text: 'bought' }; },
    stitchBand: () => 1, clothing: () => 'WomensClothing',
  });
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const kit = { el, divider: (w) => el('h3', null, w), meter: () => el('div') };
  let root = null;
  const draw = () => { root?.remove?.(); root = el('div'); document.body.append(root); drawStoresPage(root, draw, kit); };
  draw();
  const text = () => root.textContent;
  const buttons = () => [...root.querySelectorAll('button')];
  const press = (label) => buttons().find((b) => b.textContent.startsWith(label)).onclick();
  assert.deepEqual([...PROF_STATIONS], ['forge', 'workbench', 'loom', 'mason', 'jeweller']);   // PIN MOVED (PROF11): the mason's bench; PIN MOVED (PROF10): the jeweller's bench
  assert.match(stationColdLine('loom'), /The loom is still/);
  assert.match(text(), /The Loom/);
  assert.match(text(), /The tailor's loom and tanning rack - 50 gold a craft, a cure or a weave/);
  assert.match(text(), /leather:cured x2/, 'a Tanner\'s cure said');
  await buttons().find((b) => b.textContent === 'Cure').onclick();
  assert.deepEqual(works.at(-1), ['cure:bear', 1]);
  await buttons().find((b) => b.textContent === 'Weave').onclick();
  assert.deepEqual(works.at(-1), ['weave:silk', 1]);
  assert.deepEqual(LOOM_FAMILIES.map(([id]) => id), ['leather', 'clothing', 'furnishings', 'tools']);
  assert.equal(loomRecipes('clothing', 'cloth:wool', 'MensClothing').length, 41);
  assert.equal(loomRecipes('clothing', 'cloth:wool', 'WomensClothing').length, 35);
  assert.deepEqual(loomRecipes('tools').map((r) => r.id), ['fishingnet:linen']);
  press('Clothing');
  assert.ok(buttons().some((b) => b.textContent === 'Women\'s' && b.className.includes(' on')), 'the player\'s own clothing first');
  press('Men\'s');
  press('Linen');
  const shirt = buttons().find((b) => b.textContent.startsWith('Linen Short Shirt') && !b.textContent.includes(','));
  assert.match(shirt.textContent, /wants its inputs/);
  shirt.onclick();
  await press('Buy 2 from the Weavers - 4 silver');
  assert.deepEqual(bought, [['cloth:linen', 2, 'weavers']]);
  assert.deepEqual(GARMENT_WORDS(buttons()), ['Undyed', 'Blue', 'Grey', 'Red', 'Dark Brown', 'Purple', 'Light Brown', 'White', 'Aquamarine', 'Yellow', 'Green']);
  assert.equal(dyeWord(3), 'Dark Brown');
  press('Aquamarine');
  press('Craft');
  const bar = root.querySelector('.prof-heatbar');
  assert.ok(bar, 'the stitch\'s bar');
  assert.match(text(), /The stitch - press on the beat, 8 in a row/);
  // eight stitches on the beat: the page's act ticked by hand, each stitch on it
  const { _loomForTests } = await import('../src/ui/profPages.js');
  const act = _loomForTests().act;
  for (let i = 0; i < 8; i++) { act.tick(0.75); buttons().find((b) => b.textContent === 'Stitch').onclick(); }
  await tick(); await tick();
  assert.deepEqual(crafted.at(-1), ['garment-165:linen', true, 7], 'eight on the beat: a clean stitch, in Aquamarine');
  await press('Quick craft');
  assert.deepEqual(crafted.at(-1), ['garment-165:linen', false, 7]);
  press('Undyed');
  await press('Quick craft');
  assert.deepEqual(crafted.at(-1), ['garment-165:linen', false, null]);
  held.set('cloth:linen', 2);
  draw();
  press('Clothing'); press('Men\'s'); press('Linen');
  buttons().find((b) => b.textContent.startsWith('Linen Short Shirt, unchangeable')).onclick();
  assert.equal(buttons().some((b) => b.textContent === 'Aquamarine'), true, 'AUDIT 32 L3: an unchangeable shirt offers the ten');
  assert.doesNotMatch(text(), /takes no dye/);
  press('Undyed');
  await press('Quick craft');
  assert.deepEqual(crafted.at(-1), ['garment-178:linen', false, null]);
  loom = { kind: 'home', fee: 0 };
  held.delete('cloth:linen');
  draw();
  press('Clothing'); press('Men\'s'); press('Linen');
  buttons().find((b) => b.textContent.startsWith('Linen Short Shirt')).onclick();
  assert.equal(buttons().some((b) => /Weavers/.test(b.textContent)), false, 'a home sells nothing');
  assert.match(text(), /Your loom/);
  loom = null;
  draw();
  assert.match(text(), /Outfitting, and the tanning of hides, is done at a loom: a Clothing Store's \(50 gold a craft, a cure or a weave\)/);
  // the Professions page: Hunting practised, its day the account's; Outfitting's cards; Smithing's unlocks whole
  const page = (sel) => {
    root.remove(); root = el('div'); document.body.append(root);
    drawProfessionsPage(root, () => {}, kit);
    [...root.querySelectorAll('button')].find((b) => b.textContent.startsWith(sel)).onclick();
    root.remove(); root = el('div'); document.body.append(root);
    drawProfessionsPage(root, () => {}, kit);
    return root.textContent;
  };
  const hunting = page('Hunting');
  assert.doesNotMatch(hunting, /not practised/);
  assert.match(hunting, /Today: 7 of 30 hides, 1 of 3 of tiers 5-6 - your account's, across your characters/);
  assert.match(hunting, /Waits on a trophy to stand as/);
  assert.match(hunting, /Harpy Feathers, Dreugh Shell/);
  const outfitting = page('Outfitting');
  assert.doesNotMatch(outfitting, /not practised/);
  assert.match(outfitting, /Waits on a second dye Daggerfall's cloth can take/);
  assert.match(outfitting, /Waits on a wagon upgrade to hold/);
  const smithing = page('Smithing');
  assert.match(smithing, /Silver.*rank 25.*Elven, Dwarven.*rank 40.*Mithril.*rank 55/s, 'PROF7 (FOUND): the three AUDIT 30\'s note swallowed');
  assert.match(smithing, /Skinning Knife/);
  setProfessionsPages(null);
  root.remove();
});
const GARMENT_WORDS = (buttons) => {
  const i = buttons.findIndex((b) => b.textContent === 'Undyed');
  return buttons.slice(i, i + 11).map((b) => b.textContent);
};

// ─── THE WIRING ──────────────────────────────────────────────────────

test('PROF7 wiring: the street and the dungeon stamp and list their bodies for Hunting\'s kind, the knife drawn while E is held; the loom a Clothing Store\'s or a home\'s station, its crafts and works at it, the Weavers\' counter by name, the stitch\'s band off AGI and SPD, the player\'s own clothing first; a Butcher\'s meat withdrawn slow to rot; a Tracker\'s animals on the compass; the service\'s routes, statuses, refusals and deploy', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /registerPlayerKillListener\('hunting', \(entity\) => \{ bodyStamps\.stamp\(entity\); \}\);/);
  assert.match(w, /\? bodiesOf\(modes\?\.dungeonCtx\?\.foes, bodyStamps, \(f\) => modes\?\.dungeonCtx\?\.corpseAt\?\.\(f\), \(f\) => modes\?\.dungeonCtx\?\.corpseKeyOf\?\.\(f\)\)[^\n]*\n\s*: bodiesOf\(exteriorFoes\.foes, bodyStamps, exteriorFoes\.corpseAt, exteriorFoes\.corpseKeyOf\)\);/);
  assert.match(src('src/scenes/exteriorFoes.js'), /corpseAt: corpseLens\.feetOf,/, 'where a body lies has one home (DT1)');
  assert.doesNotMatch(w, /held\(keys, 'SwingWeapon'\)/, 'the knife is drawn with E held - attack is the weapon\'s, and its swing modes hold the look');
  // PIN MOVED (2026-10-01 part four, TOUCH-HOLD): the key named unless the knife's Use holds it
  assert.match(src('src/scenes/huntHost.js'), /profession: 'hunting', label: used \? '' : keyLabel\('Interact'\),/);
  assert.match(w, /loom: \(\) => modes\?\.loomHere\?\.\(\) \?\? null,/);
  assert.match(w, /stitchBand: \(\) => stitchBand\(\{ agility: liveStat\(playerEntity, 'agility'\), speed: liveStat\(playerEntity, 'speed'\) \}\),/);
  assert.match(w, /clothing: \(\) => \(playerEntity\?\.gender === 'female' \? 'WomensClothing' : 'MensClothing'\),/);
  assert.match(w, /: profession === 'outfitting'\n\s*\? \{ here: \(\) => modes\?\.loomHere\?\.\(\) \?\? null, a: 'a loom', who: 'tailor', noun: 'loom', kept: LOOM_KEPT_TEXT, xp: 'Outfitting' \}/);   // PIN MOVED (AUDIT PROF-541 R2-C2): no station's own busy word
  // PIN MOVED (PROF11): a work at the mason's bench asks it first
  assert.match(w, /const f = \(alch \? modes\?\.alchemyHere\?\.\(\) : mason \? modes\?\.masonHere\?\.\(\) : loom \? modes\?\.loomHere\?\.\(\) : bench \? modes\?\.workbenchHere\?\.\(\) : modes\?\.forgeHere\?\.\(\)\) \?\? null;/);   // PIN MOVED (PROF12): the alchemy station's transmutations first
  assert.match(w, /const who = counter === 'furnisher' \? 'furnisher' : counter === 'weavers' \? 'Weavers' : counter === 'apothecaries' \? 'Apothecaries' : 'smith';/);   // PIN MOVED (PROF12): the Apothecaries'
  assert.match(w, /withdrawIntoPack\(playerEntity, key, n, undefined, \{ slowRot: key === 'food:meat' && profBook\?\.track\('hunting'\)\?\.specs\?\.\[100\] === 'butcher', noRot: /);   // PIN MOVED (PROF9): a Provisioner's provisions beside the Butcher's meat
  assert.match(w, /profBook\.track\('hunting'\)\.specs\?\.\[50\] !== 'tracker' \|\| _mode\(\) !== 'exterior'\) return null;\n\s*return trackerMarks\(exteriorFoes\.foes, enchantFeet\(\)\);/);
  const m = src('src/scenes/worldModes.js');
  assert.match(m, /if \(interiorBuilding\.buildingType === BUILDING_TYPES\.ClothingStore\) return interiorBuilding\.insideOpenShop === false \? null : \{ kind: 'shop', fee: LOOM_FEE \};/);
  assert.match(m, /if \(decorOwnerHere\(\) && interiorDecor\.list\(\)\.some\(\(p\) => p\?\.station === 'loom'\)\) return \{ kind: 'home', fee: 0 \};/);
  const g = src('src/scenes/gatherHost.js');
  assert.match(g, /const gone = act\.loose \? !w : !act\.dungeon && !stood\.has\(pixelKey\(act\.px, act\.py\)\);/);
  assert.match(g, /climate: a\.info\?\.climate \?\? null, region: a\.info\?\.region \?\? null, act: report,/);
  assert.match(g, /at: Math\.floor\(deps\.nowMs\(\) \/ 1000\), \.\.\.\(\(typeof a\.ask === 'function' \? a\.ask\(\) : a\.ask\) \?\? \{\}\),/);   // AUDIT SILVER-WAYS D5 (PIN MOVED): an ask may be asked at the act's end
  const b = src('src/net/profBook.js');
  assert.match(b, /\.\.\.\(h\.foe === undefined \? \{\} : \{ foe: h\.foe \}\),/);
  assert.match(b, /applyStore\(r\.data\?\.extraStore\);/);
  const idx = src('server-account/src/index.js');
  assert.match(idx, /'prof-hunt-cap': 409, 'prof-hunt-high': 409, 'prof-foe': 400, 'prof-dye': 400,/);
  const c = src('src/net/accountClient.js');
  // SEAT2b part two (PIN MOVED): and the held town the station stands in (`seat`, its crafting halls' steps)
  assert.match(c, /craft: \(character, recipe, clean, name, rid, heartwood = false, dye = null, seat = null, cracked = false\) => post\('\/v1\/prof\/craft', \{ character, recipe, clean, name, rid, heartwood, \.\.\.\(dye == null \? \{\} : \{ dye \}\), \.\.\.\(seat == null \? \{\} : \{ seat \}\), \.\.\.\(cracked === true \? \{ cracked: true \} : \{\}\) \}\),/);   // PIN MOVED (PROF10): a Lapidary's `cracked` gem
  for (const word of ['prof-hunt-cap', 'prof-hunt-high', 'prof-foe', 'prof-dye']) assert.doesNotMatch(accountRefusalText(word), /problem|could not be read/, word);
  assert.match(src('.github/workflows/account-deploy.yml'), /- "src\/characters\/dyes\.js"/);
  assert.match(src('src/systems/foragingInstall.js'), /hudText\(brokeMessage\(item\.templateIndex, item\.name\)\);/);
  assert.equal(recipeById('knife:iron').templateIndex, SKINNING_KNIFE.templateIndex);
  assert.equal(TRACE_ACT.startDeg < TRACE_ACT.spanYawDeg, true);
  void bodyKey;
});
