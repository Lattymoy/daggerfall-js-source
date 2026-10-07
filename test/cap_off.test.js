// CAP-OFF (2026-10-07, Mac: "Remove the cap on life skills"; asked which - the daily harvest cap - and whether the two
// bounds a modified client's claim needs go with it - "Keep both"). A gathering profession gave a character 60 harvests a
// UTC day (the Basket's among Herbalism's) and an account 120 in a craft (AUDIT 29 A3); Fishing 40 hauls an account;
// Hunting 30 hides. Past them the service refused (`prof-cap`, `prof-account-cap`, `prof-fish-cap`, `prof-hunt-cap`), the
// node's prompt said "60 of 60 today", the book closed the craft for the day, and the chip under the compass read
// "/ 60 today". Now no count bounds a day: the law exports no day's cap (src/net/professionLaw.js), the service credits
// past each (server-account/src/professions.js harvestNode), the plans offer the act, and the chip and the Professions
// page say the count alone. Kept, Mac's word: four veins a day in dungeons nobody has vouched for (AUDIT 29 A5) and three
// hides of tiers 5-6 (PROF0 6) - each refused at its count still, past every old day. The real Worker over node:sqlite
// (test/accountDb.mjs), the real gathering host with Mining's kind over a stood pixel (test/fb1001_anyhour.test.js's) and
// the real Professions page.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as law from '../src/net/professionLaw.js';
import { DEEP_UNCONFIRMED_PER_DAY, HIGH_HIDES_PER_DAY, HIGH_HIDE_TIER, STORES_MAX, FISH_KEY, xpForRank } from '../src/net/professionLaw.js';
import { veins, boulders, trees, nodeKey, dveinKey, bodyKey, haulKey, utcDayOfMs } from '../src/net/nodeLaw.js';
import { accountRefusalText } from '../src/net/accountClient.js';
import { eventTimerRows } from '../src/systems/eventTimers.js';
import { setForagingHost, createForagingItem } from '../src/systems/foragingInstall.js';
import { FT } from '../src/systems/foragingLaw.js';
import { CLIMATES, LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { createGatherHost, aimAt } from '../src/scenes/gatherHost.js';
import { mineKind } from '../src/scenes/mineHost.js';
import { groundAt } from '../src/world/terrainNature.js';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../src/world/terrainSampler.js';
import { sharedClassicMinutes } from '../src/net/wire.js';
import { utcDay } from '../src/net/marksLaw.js';
import { standService, T0 } from './accountDb.mjs';

const DAY = 86_400;
const WOODS = CLIMATES.Woodlands, MOUNTAIN = 226, GLENUMBRA = 59, WAYREST = 23, DAGGERFALL = 17;
const MOB = { Rat: 0, Harpy: 13 };

// ─── THE LAW ─────────────────────────────────────────────────────────

test('CAP-OFF the law: no day\'s cap is exported - HARVESTS_PER_DAY, HARVESTS_PER_ACCOUNT_DAY, HIDES_PER_DAY, HAULS_PER_DAY gone, and REFUSALS-LEARNED\'s NODE_PROFESSIONS with them (the account\'s day in a craft was its one reader); the two bounds kept - 4 unvouched dungeon veins, 3 hides of tiers 5-6 (mutants: a day\'s cap exported again)', () => {
  for (const name of ['HARVESTS_PER_DAY', 'HARVESTS_PER_ACCOUNT_DAY', 'HIDES_PER_DAY', 'HAULS_PER_DAY', 'NODE_PROFESSIONS']) assert.equal(name in law, false, `${name} exported`);
  assert.deepEqual([DEEP_UNCONFIRMED_PER_DAY, HIGH_HIDES_PER_DAY, HIGH_HIDE_TIER], [4, 3, 5]);
});

// ─── THE SERVICE ─────────────────────────────────────────────────────

const hourAt = (s) => Math.floor((((Math.floor(sharedClassicMinutes(s * 1000)) % 1440) + 1440) % 1440) / 60);
function secondAt(from, want) {
  for (let s = from; s < from + 2 * 7200; s += 30) if (hourAt(s) === want && hourAt(s - 60) === want && hourAt(s + 60) === want) return s;
  throw new Error('no such hour');
}
const NOON = secondAt(utcDay(T0) * DAY + 3600, 12);
let _rid = 0, _id = 0;
const rid = () => `capoff-${String(++_rid).padStart(6, '0')}`;
const hex = () => (++_id).toString(16).padStart(12, '0');

test('CAP-OFF the service: past every old day at once - a character\'s sixty in Mining and its account\'s 120, Fishing\'s forty hauls, Hunting\'s thirty hides - each harvest credited and the day counted on; the state\'s caps carry none of them; the two bounds kept refuse at their counts all the same, and a full Stores past the old forty says so (mutants: each old bound asked again; the old refusals said again)', async () => {
  const realNow = Date.now;
  Date.now = () => NOON * 1000;
  try {
    const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', DEVELOPER_HANDLES: 'Mac' });
    const raw = s.env.DB._raw;
    const mac = await s.registered('Mac');
    const day = utcDay(NOON);
    const at = NOON - 2;
    /** `n` rows of `profession` today on the account's character `char`, as a harvest writes them. */
    const seed = (profession, kind, n, char, tier = 1) => {
      const ins = raw.prepare(`INSERT INTO node_harvests (day, node, kind, player, char_id, profession, material, qty, xp, at, rid, n, tier)
        VALUES (?, ?, ?, ?, ?, ?, 'metal:iron', 1, 1, ?, ?, 'x', ?)`);
      for (let i = 0; i < n; i++) ins.run(day, `${profession}:seed:${char}:${tier}:${i}`, kind, mac.id, char, profession, NOON, `seed-${profession}-${char}-${tier}-${String(i).padStart(4, '0')}`, tier);
    };
    const setXp = (profession, xp) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp`).run(mac.id, mac.character, profession, xp, NOON);
    const harvest = (body) => s.call('/v1/prof/harvest', { character: mac.character, at, rid: rid(), ...body }, mac.secret);
    const veinAt = (x) => {
      for (; x < 900; x++) {
        const v = veins({ x, y: 200, day, climate: WOODS, region: GLENUMBRA }).find((q) => q.tier === 1);
        if (v) return { x, node: nodeKey({ kind: 'vein', x, y: 200, day, slot: v.slot }) };
      }
      throw new Error('no vein');
    };

    // Mining: the character's sixty and, with a second character's, the account's 120 - the next credited, counted on
    seed('mining', 'ore', 60, mac.character);
    seed('mining', 'ore', 60, 'char-mac-alt');
    const v = veinAt(300);
    const ore = await harvest({ node: v.node, kind: 'ore', climate: WOODS, region: GLENUMBRA, act: { glints: 0, clean: false } });
    assert.deepEqual([ore.status, ore.body.today], [200, 61], JSON.stringify(ore.body));
    const ore2 = await harvest({ node: veinAt(v.x + 1).node, kind: 'ore', climate: WOODS, region: GLENUMBRA, act: { glints: 0, clean: false } });
    assert.deepEqual([ore2.status, ore2.body.today], [200, 62], 'and the one after');

    // Fishing: the account's forty hauls - the next credited, the account's count said
    seed('fishing', 'fish', 40, 'char-mac-alt');
    const haul = (extra = {}) => harvest({ node: haulKey({ x: 300, y: 200, day, id: hex() }), kind: 'fish', climate: WOODS, region: DAGGERFALL, act: { clean: false }, ...extra });
    const fish = await haul();
    assert.deepEqual([fish.status, fish.body.hauls], [200, 41], JSON.stringify(fish.body));

    // Hunting: the account's thirty hides of any tier - the next credited
    seed('hunting', 'hide', 30, 'char-mac-alt');
    const skin = (foe) => harvest({ node: bodyKey({ day, id: hex() }), kind: 'hide', foe, act: { clean: false, torn: false } });
    const rat = await skin(MOB.Rat);
    assert.deepEqual([rat.status, rat.body.hunt], [200, { hides: 31, high: 0 }], JSON.stringify(rat.body));

    // the state: the day's counts, and no cap beside them
    const st = (await s.call('/v1/prof/state', { character: mac.character }, mac.secret)).body;
    assert.deepEqual(st.caps, { stores: STORES_MAX, withdraw: 200, highHides: HIGH_HIDES_PER_DAY });
    assert.deepEqual([st.today.mining, st.hauls, st.hunt], [62, 41, { hides: 31, high: 0 }]);

    // KEPT: the rare hides - three of tiers 5-6 taken, a fourth refused, a hide below them still credited
    setXp('hunting', xpForRank(100));
    seed('hunting', 'hide', HIGH_HIDES_PER_DAY, 'char-mac-alt', HIGH_HIDE_TIER);
    const harpy = await skin(MOB.Harpy);
    assert.deepEqual([harpy.status, harpy.body], [409, { error: 'prof-hunt-high' }]);
    assert.equal((await skin(MOB.Rat)).status, 200, 'a hide below the rare');

    // KEPT: the veins in dungeons nobody has vouched for - four, the fifth refused, past every old day of Mining
    setXp('mining', xpForRank(25));
    for (let i = 0; i < DEEP_UNCONFIRMED_PER_DAY; i++) {
      const r = await harvest({ node: dveinKey({ dungeon: 888000 + i, day, slot: 0 }), kind: 'ore', climate: MOUNTAIN, region: WAYREST, act: {} });
      assert.equal(r.status, 200, JSON.stringify(r.body));
    }
    const fifth = await harvest({ node: dveinKey({ dungeon: 888999, day, slot: 0 }), kind: 'ore', climate: MOUNTAIN, region: WAYREST, act: {} });
    assert.deepEqual([fifth.status, fifth.body], [409, { error: 'prof-deep-cap' }]);

    // past the old forty with the Stores full of fish: the Stores' word, never the day's
    raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, 'own', ?)
      ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(mac.id, mac.character, FISH_KEY, STORES_MAX);
    const full = await haul();
    assert.deepEqual([full.status, full.body.error], [409, 'stores-full']);
  } finally { Date.now = realNow; }
});

// ─── THE CLIENT: THE HOST, THE CHIP ──────────────────────────────────

const PX = 405, PY = 150;
const NOON_MS = (20500 * 86_400 + 43_200) * 1000;
const CDAY = utcDayOfMs(NOON_MS);
const tick = () => new Promise((r) => setImmediate(r));
const WILD = Object.freeze({ inside: false, insideDungeon: false, insideCastle: false, locationType: LOCATION_TYPES.None, inLocationRect: false,
  hour: 12, climate: WOODS, region: GLENUMBRA, enemiesNear: false, carriedWeight: 10, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' });

/** A Woodlands pixel on flat grass: a rock piece north of every vein, every boulder its own piece, the forest's flats a
 *  metre off the law's trees (test/fb1001_anyhour.test.js's). */
function pixelEntry() {
  const law2 = veins({ x: PX, y: PY, day: CDAY, climate: WOODS, region: GLENUMBRA });
  const rocks = law2.map((v) => [v.u * TERRAIN_SIZE - 2, 0, v.v * TERRAIN_SIZE + 4, v.u * TERRAIN_SIZE + 2, 6, v.v * TERRAIN_SIZE + 8]);
  const samples = new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.5);
  for (const b of boulders({ x: PX, y: PY, day: CDAY, climate: WOODS })) {
    const x = b.u * TERRAIN_SIZE, z = b.v * TERRAIN_SIZE, g = groundAt(samples, x, z);
    rocks.push([x - 1.5, g - 1, z + 1, x + 1.5, g + 4, z + 4]);
  }
  const flats = trees({ x: PX, y: PY, day: CDAY, climate: WOODS }).map((t, i) => ({ id: i, group: '504_12', i, x: t.u * TERRAIN_SIZE + 1, y: 0, z: t.v * TERRAIN_SIZE }));
  const batch = { archive: 504, record: 12, size: { w: 4, h: 8 } };
  const forest = { base: 504, archive: 504, trees: flats, groups: new Map([['504_12', { batch, centers: flats.map((f) => [f.x, f.y, f.z]), size: batch.size }]]) };
  return { px: PX, py: PY, samples, tilemap: new Uint8Array(128 * 128).fill(2), locationRect: null, batches: [], rocks, forest };
}

test('CAP-OFF the host: five hundred Mining harvests today, the vein is ready - its prompt the rank\'s, E starts the act - and a book that says the account\'s day in the craft is closed (the word the day\'s cap left) closes nothing; the chip says the day\'s count alone (mutants: the host asks the account\'s day again; the chip\'s "/ 60")', async () => {
  const S = { prompt: null, chip: null, meter: null };
  const entity = { stats: { intelligence: 60, agility: 60, strength: 55, endurance: 50, luck: 50 }, items: [createForagingItem(FT.PickAxe)], wagonItems: [] };
  const book = {
    state: { open: true, today: { mining: 500 }, caps: { stores: STORES_MAX, withdraw: 200, highHides: HIGH_HIDES_PER_DAY } },
    stale: () => false, refresh: async () => ({ ok: true }), pixel: () => ({ state: 'none' }), askPixels: async () => [], pump: () => {},
    dungeon: () => null, askDungeon: async () => false, held: () => 0, taken: () => false, counting: () => false, closed: () => false,
    track: () => ({ rank: 100, specs: { 50: null, 100: null } }), harvest: () => new Promise(() => {}),
  };
  const feet = [400, 0, 400];
  const view = { yaw: 0, pitch: 0 };
  const rad = Math.PI / 180;
  const eye = () => ({ pos: [feet[0], feet[1] + 1.6, feet[2]], dir: [Math.sin(view.yaw * rad) * Math.cos(view.pitch * rad), Math.sin(view.pitch * rad), Math.cos(view.yaw * rad) * Math.cos(view.pitch * rad)] });
  const entry = pixelEntry();
  const built = new Map([[`${PX},${PY}`, entry]]);
  const host = createGatherHost({
    book, kinds: [mineKind({ book })],
    hud: { setPrompt: (p) => { S.prompt = p; }, setMeter: (a) => { S.meter = a ? a.state.kind : null; }, toast: () => {}, banner: () => {}, setChip: (t) => { S.chip = t; }, frame: () => {}, dispose: () => {} },
    renderer: { createBillboardBatch: () => ({}), destroyBatch: () => {}, moveBillboardBatch: () => true },
    getTexture: async () => ({ recordCount: 999 }), uploadRecord: () => {}, billboardSize: () => ({ w: 0.3, h: 0.3 }), flatBatchAabb: () => [0, 0, 0, 0, 0, 0],
    built: () => built, pixelTranslation: (x, y, out) => { out[0] = 0; out[1] = 0; out[2] = 0; return out; },
    pixelInfo: () => ({ climate: WOODS, region: GLENUMBRA }), nowMs: () => NOON_MS,
    eye, view: () => view, feet: () => feet, entity: () => entity,
    keyLabel: () => 'E', input: () => ({ held: false, attack: false, choice: false }),
    active: () => true, activeDungeon: () => false,
  });
  setForagingHost({ world: () => WILD, monthValue: () => 5, entity: () => null, startQuest: () => true, professionsOpen: () => true, keyLabel: () => 'E', professionUse: () => false });
  try {
    host.onBuilt(entry);
    await tick(); await tick();
    const vein = host.nodesOf(PX, PY).find((n) => n.kind === 'mine' && n.what === 'vein');
    assert.ok(vein, 'a vein stands');
    const face = () => {
      const [x, y, z] = vein.local;
      feet[0] = x; feet[1] = y; feet[2] = z - 1.5;
      const a = aimAt([x, y + 1.6, z - 1.5], [x, y + (vein.lift ?? 0.3), z], { yaw: 0, pitch: 0 });
      view.yaw = -a.yaw; view.pitch = -a.pitch;
      host.tick(0.016);
    };
    face();
    assert.equal(host.target?.node.key, vein.key);
    assert.match(S.prompt?.rest ?? '', /^Mining 100$/, 'ready at five hundred today: ' + JSON.stringify(S.prompt));
    assert.equal(S.chip, 'Mining 100 - 500 today', 'the day\'s count, no cap after it');
    // the word the day's cap left in a book: the account's Mining day closed - it closes nothing now
    book.closed = (k) => k === 'account:mining';
    host.tick(0.016);
    assert.match(S.prompt?.rest ?? '', /^Mining 100$/, 'still ready');
    assert.equal(host.press(), true, 'E is the vein\'s');
    host.tick(0.016);
    assert.equal(host.acting(), true, 'the act starts');
    assert.equal(S.meter, 'mine');
    host.cancel();
  } finally { host.dispose(); setForagingHost(null); }
});

// ─── THE PAGE AND THE WORDS ──────────────────────────────────────────

test('CAP-OFF the Professions page: a gathering profession\'s day is its count - "Today: 61 harvests", "Today: 1 harvest" - Fishing\'s its hauls and Hunting\'s its hides, the rare hides still against their three (mutants: the old "of 60", "of 40", "of 30"; the plural lost)', async () => {
  const { setProfessionsPages, drawProfessionsPage } = await import('../src/ui/profPages.js');
  const tracks = new Map();
  const book = {
    state: { open: true, day: 1, character: 'c', account: 'a', readAt: Date.now(), stores: new Map(), tracks, today: { mining: 61, herbalism: 1 },
      caps: { stores: STORES_MAX, withdraw: 200, highHides: HIGH_HIDES_PER_DAY }, hunt: { hides: 31, high: 3 }, hauls: 1 },
    stale: () => false, refresh: async () => ({ ok: true }), held: () => 0, store: (k) => ({ material: k, own: 0, bought: 0 }),
    track: (p) => tracks.get(p) ?? { profession: p, xp: 0, rank: 0, specs: { 50: null, 100: null } }, materials: () => [], pendingWithdrawals: 0, pendingCrafts: 0,
    choose: async () => ({ ok: true }),
  };
  setProfessionsPages({ book, name: (k) => k, withdraw: async () => ({ ok: true, text: '' }), forge: () => null, workbench: () => null, loom: () => null });
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const kit = { el, divider: (w) => el('h3', null, w), meter: () => el('div') };
  let root = el('div');
  document.body.append(root);
  const page = (sel) => {
    root.remove(); root = el('div'); document.body.append(root);
    drawProfessionsPage(root, () => {}, kit);
    [...root.querySelectorAll('button')].find((b) => b.textContent.startsWith(sel)).onclick();
    root.remove(); root = el('div'); document.body.append(root);
    drawProfessionsPage(root, () => {}, kit);
    return root.textContent;
  };
  try {
    const mining = page('Mining');
    assert.match(mining, /Today: 61 harvests/);
    assert.doesNotMatch(mining, /of 60/);
    assert.match(page('Herbalism'), /Today: 1 harvest(?!s)/);
    const fishing = page('Fishing');
    assert.match(fishing, /Today: 1 haul - your account's, across your characters/);
    assert.doesNotMatch(fishing, /of 40/);
    book.state.hauls = 41;
    assert.match(page('Fishing'), /Today: 41 hauls - your account's/);
    const hunting = page('Hunting');
    assert.match(hunting, /Today: 31 hides, 3 of 3 of tiers 5-6 - your account's, across your characters/);
    assert.doesNotMatch(hunting, /of 30/);
  } finally { root.remove(); }
});

test('CAP-OFF the words: the four refusals the service says no more keep their words for one not yet redeployed, without the numbers they no longer hold; the rare hides\' keeps its three; the daily reset names no gathering limit (mutants: a number said again; the reset\'s old words)', () => {
  assert.equal(accountRefusalText('prof-cap'), 'You have gathered all a day allows.');
  assert.equal(accountRefusalText('prof-account-cap'), 'Your account has gathered all a day allows in this craft, across your characters.');
  assert.equal(accountRefusalText('prof-hunt-cap'), 'Your account has taken all the hides a day allows, across your characters.');
  assert.equal(accountRefusalText('prof-fish-cap'), 'Your account has hauled all the nets a day allows, across your characters. The water rests until midnight UTC.');
  assert.equal(accountRefusalText('prof-hunt-high'), `Your account has taken all the rare hides a day allows (${HIGH_HIDES_PER_DAY}, across your characters).`);
  const daily = eventTimerRows({ now: Date.UTC(2026, 9, 7, 12) }).find((r) => r.id === 'daily');
  assert.equal(daily.detail, 'The day\'s nodes stand anew; rare hides, Marks and Court writs: their daily limits start again');
  assert.match(eventTimerRows({ now: Date.UTC(2026, 9, 7, 12), seatsOpen: true }).find((r) => r.id === 'daily').detail, /Court writs, and the Watch: their daily limits/);
});
