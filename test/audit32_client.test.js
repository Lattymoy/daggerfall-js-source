// AUDIT 32 (2026-09-30, Mac: "Audit this") - PROF7'S BOOKS AND HOSTS AS THE AUDIT FOUND THEM (src/scenes/huntHost.js,
// gatherHost.js, world.js, worldModes.js, dungeonContext.js, exteriorFoes.js; src/net/profBook.js): a body lapses at the
// UTC day's turn, as the service lets its key (B1/H1); a refusal that says the account's rare hides are spent raises the
// book's count to them (B2; CAP-OFF: the day's thirty, the other refusal it said, is gone); an answer heard after a character switch is its own character's (B5); a dungeon with no identity is
// still one the host stands in, its bodies nodes, and a dungeon body names no ground (H2, H9); at sea the knife never
// works, so E is the loot's (H4); a body is reached as DFU reaches its corpse, and stood over asks a step back (H7); the
// choice key's search opens the body's own loot by its key, never a search of nothing (H8); the trace's end said (P10);
// and the wiring - a flyer's body where its corpse lies (H3), no click through an act (H5), the dungeon's foes to the
// knife's check (H6), no host under the travel view (H10), the counters' balance told to the market (B3), each station
// its busy word (B4), the choice key's label (R1), the Worker's route table (S6).
// bible/06-Systems/Online-Arc.md "AUDIT 32"; bible/06-Systems/Professions-Arc.md 29.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createProfBook } from '../src/net/profBook.js';
import { utcDayOfMs } from '../src/net/nodeLaw.js';
import { xpForRank, SKINNING_KNIFE, TRACE_ACT, HIGH_HIDES_PER_DAY } from '../src/net/professionLaw.js';
import { createBodyStamps, bodiesOf, huntKind, BODY_REACH, BODY_STEEPEST_DEG } from '../src/scenes/huntHost.js';
import { createGatherHost, aimAt } from '../src/scenes/gatherHost.js';
import { registerPlayerKillListener, reportPlayerKill } from '../src/systems/playerKills.js';
import { setForagingHost } from '../src/systems/foragingInstall.js';
import { CORPSE_ACTIVATION_DISTANCE } from '../src/player/activate.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const noWait = () => Promise.resolve();
const tick = () => new Promise((r) => setImmediate(r));
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const DAY_MS = 86_400_000;
const WOODS = 231, OCEAN = 223, GLENUMBRA = 59;
const WILDS = { inside: false, insideDungeon: false, insideCastle: false, locationType: 0xffff, inLocationRect: false, hour: 2, climate: WOODS, region: GLENUMBRA, enemiesNear: false, carriedWeight: 0, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' };
const knifeOf = () => ({ templateIndex: SKINNING_KNIFE.templateIndex, name: 'Skinning Knife', currentCondition: 50, maxCondition: 50 });
const TODAY = 20_833;

/** A door answering as the service would, `harvest` the test's own. */
function doorOf({ harvest, hunt = { hides: 0, high: 0 }, day = TODAY } = {}) {
  return {
    account: () => 'acct-1',
    state: async () => ({ ok: true, data: { day, character: 'c1', tracks: [{ profession: 'hunting', xp: xpForRank(100), rank: 100, specs: { 50: null, 100: null } }], today: {}, taken: [], stores: [], caps: { stores: 5000, withdraw: 200, highHides: HIGH_HIDES_PER_DAY }, hunt } }),
    pixels: async () => ({ ok: true, data: { pixels: [], dungeons: [] } }),
    harvest: harvest ?? (async () => ({ ok: false, error: 'offline' })),
  };
}

/** A hunt in the one host - the Hunting kind over a pool, the kill signal stamping, the eye and view, the input. */
function stand(book, { nowMs, openLoot = null, eyeH = 1.6, dungeon = false } = {}) {
  const stamps = createBodyStamps({ nowMs });
  registerPlayerKillListener('a32', (e) => { stamps.stamp(e); });
  const foes = [];
  const said = [];
  const hud = { setPrompt: (p) => { said.prompt = p; }, setMeter: (m) => { said.meter = m; }, toast: (x) => said.push(x), banner: () => {}, setChip: () => {}, frame: () => {}, dispose: () => {} };
  const feet = [0, 0, 0];
  const view = { yaw: 0, pitch: 0 };
  let input = { held: false, attack: false, choice: false };
  let lit = null;   // PROF-MENU: the row the plaque has lit over the body
  const entity = { items: [knifeOf()] };
  const eyePos = () => [feet[0], feet[1] + eyeH, feet[2]];
  const host = createGatherHost({
    book, hud, kinds: [huntKind({ book, bodies: () => bodiesOf(foes, stamps, (f) => f.corpseMarker?.pos ?? f.ai?.feet, (f) => f.lootKey ?? null), openLoot })],
    renderer: { createBillboardBatch: () => ({}), destroyBatch: () => {} }, getTexture: async () => ({ recordCount: 99 }), uploadRecord: () => {},
    billboardSize: () => ({ w: 1, h: 1 }), flatBatchAabb: () => [0, 0, 0, 1, 1, 1], built: () => new Map(),
    pixelTranslation: (x, y, out) => { out[0] = 0; out[1] = 0; out[2] = 0; return out; }, pixelInfo: () => ({ climate: WOODS, region: GLENUMBRA }), nowMs,
    eye: () => ({ pos: eyePos(), dir: [Math.sin((view.yaw * Math.PI) / 180) * Math.cos((view.pitch * Math.PI) / 180), Math.sin((view.pitch * Math.PI) / 180), Math.cos((view.yaw * Math.PI) / 180) * Math.cos((view.pitch * Math.PI) / 180)] }),
    view: () => view, feet: () => feet, entity: () => entity, keyLabel: (a) => (a === 'ActChoice' ? 'R' : 'E'), input: () => input,
    active: () => !dungeon, activeDungeon: () => dungeon, lit: () => lit,
  });
  const kill = (mobileType, at, extra = {}) => {
    const f = { entity: { mobileType, name: 'foe' }, dead: false, corpse: false, ai: { feet: [...at] }, ...extra };
    foes.push(f);
    reportPlayerKill(f.entity, { kind: 'melee' });
    f.dead = true; f.corpse = true; f.corpseMarker = { pos: [...at] };
    return f;
  };
  const lookAt = (f) => {
    const p = f.corpseMarker.pos;
    const at = aimAt(eyePos(), [p[0], p[1] + 0.2, p[2]], { yaw: 0, pitch: 0 });
    view.yaw = -at.yaw; view.pitch = -at.pitch;
    return at;
  };
  return {
    host, said, feet, view, foes, stamps, kill, lookAt, entity,
    set input(v) { input = { held: false, attack: false, choice: false, ...v }; },
    set lit(v) { lit = v; },
    /** PROF-MENU: the body's list as the plaque would draw it */
    menu() { const t = host.target; return t ? host.hoverName(`prof:${t.node.key}`) : null; },
    done() { registerPlayerKillListener('a32', null); host.dispose(); },
  };
}
const ready = async (door, day = TODAY, character = () => 'c1') => {
  const book = createProfBook({ door, storage: memStorage(), character, now: () => day * DAY_MS + 3_600_000, sleep: noWait });
  await book.refresh();
  return book;
};

// ─── B1 / H1: A BODY LAPSES AT THE DAY'S TURN ────────────────────────

test('AUDIT 32 B1/H1: a body lapses at the UTC day\'s turn - its stamp none, no node, E the loot\'s; a body skinned before midnight never stands ready again', async () => {
  let now = (TODAY + 1) * DAY_MS - 10_000;   // 23:59:50
  const stamps = createBodyStamps({ nowMs: () => now, rand: (b) => b.fill(7) });
  const bear = { mobileType: MOBILE_TYPES.GrizzlyBear };
  const s = stamps.stamp(bear);
  assert.equal(stamps.of(bear), s);
  now += 15_000;   // 00:00:05
  assert.equal(stamps.of(bear), null, 'yesterday\'s body is no node today');
  const pool = [{ entity: bear, dead: true, corpse: true, ai: { feet: [0, 0, 2] } }];
  assert.deepEqual(bodiesOf(pool, stamps, (f) => f.ai.feet), []);
  // through the host: the prompt at 23:59:50, none at 00:00:05, and E passed on to the loot
  setForagingHost({ world: () => WILDS });
  now = (TODAY + 1) * DAY_MS - 10_000;
  const book = await ready(doorOf(), TODAY);
  const h = stand(book, { nowMs: () => now });
  try {
    const b = h.kill(MOBILE_TYPES.GrizzlyBear, [0, 0, 2.2]);
    h.lookAt(b);
    h.host.tick(0.016);
    assert.equal(h.host.target?.node.kind, 'body');
    now += 15_000;
    h.host.tick(0.016);
    assert.deepEqual([h.host.target, h.host.press()], [null, false], 'midnight: DFU\'s corpse alone');
    assert.equal(h.entity.items[0].currentCondition, 50, 'no knife worn on a harvest the service must refuse');
  } finally { h.done(); setForagingHost(null); }
});

// ─── B2: THE ACCOUNT'S RARE HIDES AS A REFUSAL SAYS THEM ─────────────

test('AUDIT 32 B2: a refusal that says the account\'s rare hides are spent raises the book\'s count to them - the plan says so, and the next rare body is no ready node, while a body below the rare is; CAP-OFF: the day\'s thirty, an old service\'s `prof-hunt-cap`, raises nothing and closes no body (mutant: the old refusal learned again)', async () => {
  setForagingHost({ world: () => WILDS });
  try {
    const bodyAt = (foe, tier, id) => ({ foe, tier, hide: 'hide:rat', key: `body:${TODAY}:${id}`, lootKey: () => null });
    const book = await ready(doorOf({ harvest: async () => ({ ok: false, error: 'prof-hunt-high' }) }));
    assert.deepEqual(book.state.hunt, { hides: 0, high: 0 }, 'this device saw none');
    const r = await book.harvest({ node: `body:${TODAY}:0123456789ab`, kind: 'hide', act: { clean: false }, at: TODAY * 86_400 + 3600, foe: MOBILE_TYPES.Harpy });
    assert.equal(r.error, 'prof-hunt-high');
    assert.equal(book.state.hunt.high, HIGH_HIDES_PER_DAY, 'the rare hides as the service says them');
    const kind = huntKind({ book, bodies: () => [] });
    const ctx = { rank: () => 100, keyLabel: () => 'R' };
    assert.equal(kind.plan(bodyAt(MOBILE_TYPES.Harpy, 5, '0123456789ac'), ctx).ready, false, 'the next rare body says the day is full');
    assert.equal(kind.plan(bodyAt(MOBILE_TYPES.Rat, 1, '0123456789ad'), ctx).ready, true, 'a body below the rare: ready');
    // PIN MOVED (CAP-OFF, 2026-10-07 - Mac: "Remove the cap on life skills"): `prof-hunt-cap` raised the hides to the day's
    // thirty and every next body said the day was full; a service not yet redeployed may still say it - it moves nothing
    const old = await ready(doorOf({ harvest: async () => ({ ok: false, error: 'prof-hunt-cap' }) }));
    assert.equal((await old.harvest({ node: `body:${TODAY}:0123456789ae`, kind: 'hide', act: { clean: false }, at: TODAY * 86_400 + 3600, foe: MOBILE_TYPES.Rat })).error, 'prof-hunt-cap');
    assert.deepEqual(old.state.hunt, { hides: 0, high: 0 }, 'nothing raised');
    assert.equal(huntKind({ book: old, bodies: () => [] }).plan(bodyAt(MOBILE_TYPES.Rat, 1, '0123456789af'), ctx).ready, true, 'the next body ready');
  } finally { setForagingHost(null); }
});

// ─── B5: AN ANSWER IS ITS OWN CHARACTER'S ────────────────────────────

test('AUDIT 32 B5: a harvest answered after a character switch is let go - the other character\'s book untouched and nothing said; a kept craft waits for its own character', async () => {
  let who = 'c1';
  let release;
  const door = {
    ...doorOf(),
    harvest: () => new Promise((r) => { release = () => r({ ok: true, data: { node: `body:${TODAY}:0123456789ab`, kind: 'hide', material: 'hide:bear', qty: 2, xp: 30, store: { material: 'hide:bear', own: 2, bought: 0 }, extra: 'food:meat', extraQty: 1, extraStore: { material: 'food:meat', own: 1, bought: 0 }, track: { profession: 'hunting', xp: 99_999, rank: 99 }, today: 1, hunt: { hides: 2, high: 0 } } }); }),
    craft: async () => ({ ok: true, data: { recipe: 'garment-141:linen', pieces: [], stores: [], track: null } }),
  };
  const book = createProfBook({ door, storage: memStorage(), character: () => who, now: () => TODAY * DAY_MS + 3_600_000, sleep: noWait });
  await book.refresh();
  const pending = book.harvest({ node: `body:${TODAY}:0123456789ab`, kind: 'hide', act: { clean: false }, at: TODAY * 86_400 + 3600, foe: MOBILE_TYPES.GrizzlyBear });
  who = 'c2';
  await book.refresh({ force: true });
  release();
  const r = await pending;
  assert.equal(r.elsewhere, true);
  assert.deepEqual([book.held('hide:bear'), book.held('food:meat'), book.state.hunt, book.track('hunting').rank], [0, 0, { hides: 0, high: 0 }, 100], 'c2 as the service said it');
  // a kept craft heard after a switch waits for its own character's settle
  who = 'c1';
  let answer;
  door.craft = () => new Promise((r) => { answer = r; });
  const minted = [];
  const craft = book.craft('garment-141:linen', {}, (d) => minted.push(d));
  await tick();
  who = 'c2';
  answer({ ok: true, data: { recipe: 'garment-141:linen', pieces: [{ provenance: 'p1', record: null }], stores: [], track: null } });
  const c = await craft;
  assert.deepEqual([c.ok, c.kept, minted.length], [false, true, 0], 'never minted into c2\'s pack');
  who = 'c1';
  assert.equal(book.pendingCrafts, 1, 'c1 still keeps it');
});

// ─── H2 + H9: A DUNGEON WITH NO IDENTITY; NO GROUND FOR A BODY ───────

test('AUDIT 32 H2/H9: a dungeon with no identity is one the host stands in - its bodies nodes, no veins stood; a dungeon body\'s harvest names no ground', async () => {
  setForagingHost({ world: () => ({ ...WILDS, inside: true, insideDungeon: true }) });
  const asked = [];
  const book = await ready(doorOf({ harvest: async (b) => { asked.push(b); return { ok: false, error: 'offline' }; } }));
  const h = stand(book, { nowMs: () => TODAY * DAY_MS + 3_600_000, dungeon: true });
  try {
    h.host.enterDungeon({ id: null, climate: null, region: null, wall: () => null, stand: async () => null, drop: () => {} });
    const rat = h.kill(MOBILE_TYPES.Rat, [0, 0, 2]);
    h.lookAt(rat);
    h.host.tick(0.016);
    assert.equal(h.host.target?.node.kind, 'body', 'a spawned dungeon\'s body is a node');
    // a dungeon WITH an identity: the body's harvest names no ground all the same
    h.host.enterDungeon({ id: 1234, climate: WOODS, region: GLENUMBRA, wall: () => null, stand: async () => null, drop: () => {} });
    h.host.tick(0.016);
    assert.equal(h.host.press(), true);
    h.host.tick(0.001);
    h.host.tick(1.3);   // Gentle-free: the trace - drawn along its line below
    const pts = h.said.meter.state.points;
    const at0 = h.lookAt(rat);
    for (let i = 0; i <= 40; i++) {
      const u = (i / 40) * (pts.length - 1), k = Math.min(pts.length - 2, Math.floor(u)), t = u - k;
      h.view.yaw = -at0.yaw + pts[k][0] + (pts[k + 1][0] - pts[k][0]) * t;
      h.view.pitch = -at0.pitch + pts[k][1] + (pts[k + 1][1] - pts[k][1]) * t;
      h.input = { held: true };
      h.host.tick(0.05);
    }
    await tick();
    assert.equal(asked.length, 1);
    assert.deepEqual([asked[0].climate, asked[0].region], [null, null], 'a body names no ground, underground too');
  } finally { h.done(); setForagingHost(null); }
});

// ─── H4: THE SEA ─────────────────────────────────────────────────────

test('AUDIT 32 H4: at sea the knife never works - no ready node, and E goes on to the body\'s loot', async () => {
  setForagingHost({ world: () => ({ ...WILDS, climate: OCEAN }) });
  const book = await ready(doorOf());
  const h = stand(book, { nowMs: () => TODAY * DAY_MS + 3_600_000 });
  try {
    const fish = h.kill(MOBILE_TYPES.Slaughterfish, [0, 0, 2.2]);
    h.lookAt(fish);
    h.host.tick(0.016);
    // PROF-MENU: the knife's row refused with its reason, the search the one row to press - handed on to the ray's loot
    assert.deepEqual(h.menu().actions, [{ id: 'hide', label: 'Skin the Slaughterfish', disabled: true, why: 'not out here' }, { id: 'search', label: 'Search the Slaughterfish' }]);
    assert.deepEqual([h.host.press(), h.host.acting()], [false, false]);
  } finally { h.done(); setForagingHost(null); }
});

// ─── H7: THE REACH OF A BODY ─────────────────────────────────────────

test('AUDIT 32 H7: a body is reached as DFU reaches its corpse (3.75 from the eye) - a metre downhill, and under a rider; stood over it, the plan asks a step back and E goes on', async () => {
  assert.equal(BODY_REACH, CORPSE_ACTIVATION_DISTANCE);
  setForagingHost({ world: () => WILDS });
  const book = await ready(doorOf());
  for (const [eyeH, y, dz, want] of [[1.6, -1.2, 1.5, 'Hunting 100'], [2.51, 0, 1.5, 'Hunting 100'], [1.6, 0, 0.3, 'step back']]) {
    const h = stand(book, { nowMs: () => TODAY * DAY_MS + 3_600_000, eyeH });
    try {
      const b = h.kill(MOBILE_TYPES.Rat, [0, y, dz]);
      h.lookAt(b);
      h.host.tick(0.016);
      assert.equal(h.host.target?.node.kind, 'body', `eye ${eyeH}, body at ${y}, ${dz} m`);
      // PROF-MENU: a ready knife's word the list's sub-line; a refused one its reason on the knife's row
      if (want === 'step back') assert.equal(h.menu().actions[0].why, want);
      else assert.equal(h.menu().subs[0], want);
      if (want === 'step back') assert.equal(h.host.press(), false, 'stood over: E goes on to the loot');
    } finally { h.done(); }
  }
  // a body inside the reach across the ground but past it from the eye is none - DFU's corpse is out of reach there too
  const h = stand(book, { nowMs: () => TODAY * DAY_MS + 3_600_000 });
  try {
    const far = h.kill(MOBILE_TYPES.Rat, [0, 0, 3.6]);
    h.lookAt(far);
    h.host.tick(0.016);
    assert.equal(h.host.target, null, `3.6 m across, ${Math.hypot(3.6, 1.4).toFixed(2)} m from the eye`);
  } finally { h.done(); }
  assert.ok(BODY_STEEPEST_DEG < -70 && BODY_STEEPEST_DEG > -72);
  setForagingHost(null);
});

// ─── H8: THE SEARCH ──────────────────────────────────────────────────

test('AUDIT 32 H8 (PROF-MENU): the list\'s search opens the body\'s own loot by its key - never the ray\'s; a body with nothing to search offers none', async () => {
  setForagingHost({ world: () => WILDS });
  const book = await ready(doorOf());
  const opened = [];
  const h = stand(book, { nowMs: () => TODAY * DAY_MS + 3_600_000, openLoot: (k) => opened.push(k) });
  try {
    const b = h.kill(MOBILE_TYPES.GrizzlyBear, [0, 0, 2.2], { lootKey: 'foeCorpse:7' });
    h.lookAt(b);
    h.host.tick(0.016);
    assert.deepEqual(h.menu().actions.map((a) => a.label), ['Skin the Grizzly Bear', 'Search the Grizzly Bear']);
    h.lit = 'search';   // the plaque's light on the search
    assert.deepEqual([h.host.press(), opened, h.host.acting()], [true, ['foeCorpse:7'], false], 'opened by its key');
    // emptied (its key gone): the search is let go, and none is offered
    b.lootKey = null;
    h.host.tick(0.016);
    assert.deepEqual(h.menu().actions.map((a) => a.label), ['Skin the Grizzly Bear'], 'no search of nothing');
    assert.deepEqual([h.said.prompt.verb, h.said.prompt.rest], ['Skin the Grizzly Bear', 'Hunting 100'], 'no plaque: the one act its prompt');
  } finally { h.done(); setForagingHost(null); }
});

// ─── P10: THE TRACE'S END SAID ───────────────────────────────────────

test('AUDIT 32 P10: the trace\'s end said - a clean pelt, a torn one (its part lost), a true line too quick or too slow', () => {
  const kind = huntKind({ book: { state: {} }, bodies: () => [] });
  assert.equal(kind.actNote({ clean: true, torn: false, score: 0.9, seconds: 2 }), ' (a clean pelt)');
  assert.equal(kind.actNote({ clean: false, torn: true, score: 0.2, seconds: 2 }), ' (a torn pelt - its part lost)');
  assert.equal(kind.actNote({ clean: false, torn: false, score: 0.95, seconds: TRACE_ACT.minS / 2 }), ' (a true line, too quick for a clean pelt)');
  assert.equal(kind.actNote({ clean: false, torn: false, score: 0.95, seconds: TRACE_ACT.maxS * 2 }), ' (a true line, too slow for a clean pelt)');
  assert.equal(kind.actNote({ clean: false, torn: false, score: 0.6, seconds: 2 }), '');
  assert.match(src('src/scenes/gatherHost.js'), /const note = a && k\?\.actNote \? k\.actNote\(a\.report\) : a\?\.clean \? \(k\?\.cleanNote\(a, d\) \?\? ''\) : '';/);
});

// ─── THE WIRING ──────────────────────────────────────────────────────

test('AUDIT 32 wiring: a flyer\'s body where its corpse lies (H3); no click through an act (H5); the dungeon\'s foes to the knife (H6); no host under the travel view (H10); the counters\' balance told (B3); each station its busy word (B4); the choice key\'s label (R1); the route table (S6)', () => {
  const d = src('src/scenes/dungeonContext.js');
  assert.match(d, /const p = floorLanding\(collider, \[f\.ai\.feet\[0\], f\.ai\.feet\[1\] \+ 0\.1, f\.ai\.feet\[2\]\]\);\n\s*f\.corpsePos = p;/, 'H3: the landing kept');
  assert.match(d, /function corpseAt\(f\) \{ return f\?\.corpsePos \?\? f\?\.ai\?\.feet \?\? null; \}/);
  assert.match(d, /if \(!lootableBody\(f\) \|\| !f\.entity\?\.items\?\.length\) return;[^\n]*\n\s*const p = corpseAt\(f\);/, 'H3: the loot\'s box where the body lies');
  assert.match(d, /f\.corpse = false;[^\n]*\n\s*f\.corpsePos = null;/, 'a freed corpse forgets its place');
  assert.match(d, /corpseKeyOf: \(f\) => \{ const i = foes\.indexOf\(f\); return i >= 0 && lootableBody\(f\) && f\.entity\?\.items\?\.length \? `corpse:\$\{i\}` : null; \},/, 'H8');
  const w = src('src/scenes/world.js');
  // PIN MOVED (FIELD BUGS 2026-10-07 INDOOR-SKIN): the dungeon's pool handed whole - huntHost.js bodiesHere reads its
  // corpseAt (H3) and corpseKeyOf (H8)
  assert.match(w, /bodiesHere\(modeNow\(\), \{ street: exteriorFoes, dungeon: modes\?\.dungeonCtx, interior: modes\?\.interiorFoes \}, bodyStamps\)/);
  assert.match(src('src/scenes/huntHost.js'), /return bodiesOf\(pool\.foes, stamps, \(f\) => pool\.corpseAt\?\.\(f\), \(f\) => pool\.corpseKeyOf\?\.\(f\)\);/);
  // PIN MOVED (AUDIT 2026-10-01 part four, CLICK-LIFT): and the click an act took, to its release - test/fb1001_audit.test.js
  assert.match(w, /if \(\(\(_act\.activate && !gatherHost\?\.acting\(\) && !_actClick(?: && !nodeClicked)?\) \|\| \(useEdge && !nodeTook\)\) && !modes\.transitioning(?: && !_holdFire)?\) \{/, 'H5: the street');   // PROF-MENU: and a click a node's lit row took   // PIN MOVED (the merge with AUDIT NAV2 F31): the gate holds fire too
  assert.match(((m) => m.slice(m.indexOf('  function tryExitDungeon(')))(src('src/scenes/worldModes.js')), /if \(interact && !pressCast && host\.profPress\?\.\(\)\) return true;\n(?:\s*\/\/[^\n]*\n|\s*if \(!interact && !pressCast && !actClick && !host\.profActing\?\.\(\) && host\.profClick\?\.\(\)\) return true;\n)*\s*if \(!interact && \(actClick \|\| host\.profActing\?\.\(\)\)\) return true;/, 'H5: the dungeon');   // PROF-MENU: a node's lit row's click between
  assert.match(w, /enemiesNear: exterior \? \(duelEnemyNear\(\) \|\| areEnemiesNearby\(exteriorFoePool\(\), \{ resting: true \}\)\) : areEnemiesNearby\(modes\?\.insideFoes\?\.\(\) \?\? \[\], \{ resting: true \}\),/, 'H6');
  assert.match(w, /active: \(\) => walkMode && modeNow\(\) === 'exterior' && !townTalk\.overlayActive && !modes\?\.deathUp\?\.\(\) && !modes\?\.transitioning && !travelView\?\.active,/, 'H10');
  assert.match(w, /profDungeonEntered: \(ctx\) => \{\n\s*if \(!gatherHost\) return;\n\s*const id = ctx\?\.profIdentity\?\.\(\);\n\s*gatherHost\.enterDungeon\(\{\n\s*id: id\?\.id \?\? null, climate: id\?\.climate \?\? null, region: id\?\.region \?\? null,/, 'H2: every dungeon told');
  // PIN MOVED (FIELD BUGS 2026-10-07 INDOOR-SKIN): a building's body by the building's own door first
  assert.match(w, /const openHuntLoot = \(key\) => \(modeNow\(\) === 'interior' \? modes\?\.openInteriorBody\?\.\(key\)\n\s*: key\.startsWith\('foeCorpse:'\) \? openBodyLoot\(key\) : modes\?\.dungeonCtx\?\.takeLoot\(key, getInteractionMode\(\)\)\);/, 'H8');
  // PIN MOVED (AUDIT PROF-541 R2-C2): B4's own busy words gone - one latch holds every craft and brew, so the book's word
  // names none (test/prof12_client.test.js R2-C2)
  assert.match(w, /xp: 'Carpentry' \}/, 'B4');
  assert.match(w, /xp: 'Smithing' \}\);/);
  assert.match(src('src/systems/inputActions.js'), /\['ActChoice', 'At a profession node: the next of its acts on the list'\]/, 'R1');   // PROF-MENU: the key steps the node's list
  const idx = src('server-account/src/index.js');
  assert.match(idx, /POST \/v1\/prof\/harvest \{ character, node, kind, climate, region, act, at, rid, foe\? \}/, 'S6');
  assert.match(idx, /POST \/v1\/prof\/craft \{ character, recipe, clean, name\?, heartwood\?, dye\?, cracked\?, rid \}/);   // PIN MOVED (PROF10): a Lapidary's `cracked` gem
  assert.match(idx, /POST \/v1\/prof\/state \{ character \}\s+-> \{ tracks, today, taken, stores, writs, caps, hunt \}/);
});
