// STOREFRONT, AUDIT LANE 5 (2026-10-29, the season in the world audited cold; bible/06-Systems/Battle-Pass.md section 6):
// the Heart Fissure's camp on the REAL exterior foe pool and the world's own camp law (test/scenes/seasonRig.mjs), two and
// three clients telling each other their frames. Every copy and an heir carry the Colossus's three traits; it is never the
// street's one-trait elite; every screen bars it, hears its fall, and keeps the camp's quiet - across a reload; a fall
// is a body; the Maul is the service's yes; the waking is said as something stands; a race lost is no clear; nothing
// stands before the relay's clock is heard. tools/mutants/storefront_seasonaudit.json.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { client, settle, HEART_T, memStorage } from './seasonRig.mjs';
import { COLOSSUS_TRAITS, SEASON_QUIET_MS, SEASON_ORPHAN_MS, SEASON_QUIET_STORE, SEASON_MAUL_ASKS } from '../../src/scenes/seasonHost.js';
import { COLOSSUS_TEXT } from '../../src/systems/pass/seasonWords.js';
import { RESONANT_MAUL } from '../../src/systems/pass/resonantMaul.js';
import { bossStrike, BOSS_TRAITS_MOST, bossTraitsMost, CURB_SHARE, WARD_SHARE } from '../../src/systems/bossTraits.js';
import { isColossusSite, isBrassSite } from '../../src/world/worldOfDaggerfall/wodShared.js';
import { createWeapon, WEAPONS_ENUM } from '../../src/combat/enemyEquipment.js';
import { SESSION_KEY } from '../../src/net/accountClient.js';

let realNow, realRandom;
test.before(() => { realNow = Date.now; realRandom = Math.random; });
test.afterEach(() => { Date.now = realNow; Math.random = realRandom; });
const clocked = (clock) => { Date.now = () => clock.t; return clock; };
const SWORD = createWeapon(WEAPONS_ENUM.Longsword, 4, () => 0.5);
const falls = (c) => c.said.filter((s) => s === COLOSSUS_TEXT.falls()).length;
const wakes = (c) => c.said.filter((s) => s === COLOSSUS_TEXT.wakes(c.f.near)).length;
/** The most blows a foe can take of one that would kill it outright (bossTraits.js): its ward and then its health, each
 *  at CURB_SHARE a blow - a construct may be the street's elite, curbing or warded (CI found four too few). */
const MOST_BLOWS = Math.ceil((1 + WARD_SHARE) / CURB_SHARE) + 1;
/** Every live foe of the camp killed by its owner's blows - the Colossus's ward first, then its health. */
async function clear(c) {
  for (let i = 0; i < MOST_BLOWS && c.own().length; i++) { for (const x of c.own()) c.kill(x); await settle(); }
  assert.equal(c.own().length, 0, 'the camp cleared');
}

test('AUDIT LANE 5 (3): every copy of the Colossus and its heir carry its three traits - a reader\'s blade lands as on the owner\'s; one law caps every reader (mutants: a leader\'s two for the Colossus; the site unread)', async () => {
  const clock = clocked({ t: HEART_T });
  const A = client('aaaa-0001', { clock }), B = client('bbbb-0002', { clock }), C = client('cccc-0003', { clock });
  A.at(30); await A.beat();
  const own = A.colossus();
  assert.deepEqual(own.entity.bossTraits, [...COLOSSUS_TRAITS]);
  B.at(20); await A.tell(B); await B.beat();
  const copy = B.colossus();
  assert.ok(copy?.puppet, 'B sees A\'s Colossus');
  assert.deepEqual(copy.entity.bossTraits, [...COLOSSUS_TRAITS], 'Blade-turning on the reader\'s copy');
  assert.equal(bossStrike(copy.entity, 100, { kind: 'melee', weapon: SWORD }).damage, bossStrike(own.entity, 100, { kind: 'melee', weapon: SWORD }).damage, 'a sword lands as on the owner\'s');
  assert.equal(bossStrike(copy.entity, 100, { kind: 'arrow' }).damage, 50);
  // A goes: B takes it over, and its frames carry the three to a third screen
  const hand = A.pool.handOverFrame((x) => (x.site === A.f.hSite ? B.id : null));
  A.pool.dropOwnLive();
  B.pool.applyFoes(A.id, hand); await settle(); await B.beat();
  const heir = B.colossus();
  assert.ok(heir && !heir.puppet, 'B\'s own now');
  assert.deepEqual(heir.entity.bossTraits, [...COLOSSUS_TRAITS], 'the heir keeps them');
  C.at(25); await B.tell(C); await C.beat();
  assert.deepEqual(C.colossus()?.entity.bossTraits, [...COLOSSUS_TRAITS], 'and every screen after');
  // the law: an elite one, a raid's leader two, the Colossus three - its site the season's `.h`
  assert.deepEqual([bossTraitsMost(false), bossTraitsMost(true), bossTraitsMost(true, true), bossTraitsMost(false, true)], [1, 2, 3, 1]);
  assert.equal(COLOSSUS_TRAITS.length, BOSS_TRAITS_MOST.colossus);
  assert.deepEqual([isColossusSite(A.f.hSite), isColossusSite(A.f.site), isColossusSite('1,2:star.3.0.m'), isBrassSite(A.f.hSite)], [true, false, false, true]);
});

test('AUDIT LANE 5 (4): the Colossus is never the street\'s elite roll - an elite drawn at its stand still stands with the season\'s three (mutants: the Colossus rolled as the street\'s)', async () => {
  const clock = clocked({ t: HEART_T });
  Math.random = () => 0.001;   // every stand rolls the overworld's elite (one in twenty)
  const A = client('aaaa-0001', { clock });
  A.at(30); await A.beat();
  assert.deepEqual(A.colossus().entity.bossTraits, [...COLOSSUS_TRAITS]);
  assert.equal(A.colossus().entity.raidLeader.name, COLOSSUS_TEXT.name());
  assert.ok(A.own().filter((x) => x !== A.colossus()).every((x) => x.entity.bossTraits?.length === 1), 'its escort the street\'s elites');
});

test('AUDIT LANE 5 (5, 9): every screen near bars the Colossus and hears its fall; the striker alone asks for the Maul, and takes it on the service\'s yes (mutants: the bar the owner\'s alone; the fall said to a striker alone)', async () => {
  const clock = clocked({ t: HEART_T });
  const service = { days: new Set(), asks: [], down: false };
  const A = client('aaaa-0001', { clock, service }), B = client('bbbb-0002', { clock, service: { days: new Set(), asks: [], down: false } });
  A.at(30); await A.beat();
  B.at(20); await A.tell(B); await B.beat();
  assert.equal(B.state().colossus, true, 'the reader\'s bar');
  await clear(A); await A.beat();
  await A.tell(B); await B.beat();
  assert.deepEqual([falls(A), falls(B)], [1, 1], 'its fall said on both screens, once');
  assert.deepEqual([A.service.asks.length, B.service.asks.length], [1, 0], 'B never struck it: nothing asked');
  assert.equal(A.taken.length, 1);
  assert.equal(A.taken[0].legendary, RESONANT_MAUL.id);
});

test('AUDIT LANE 5 (6): a Colossus taken down without a body - a race lost - is no fall: no line, no ask (mutants: a fall without a body)', async () => {
  const clock = clocked({ t: HEART_T });
  const A = client('aaaa-0001', { clock });
  A.at(30); await A.beat();
  A.strike(A.colossus());   // struck: the ward takes it
  assert.ok(!A.colossus().dead);
  A.pool.removeSiteFoes(A.f.hSite);
  A.host.frame(); await settle();
  assert.deepEqual([falls(A), A.service.asks.length, A.taken.length], [0, 0, 0]);
});

test('AUDIT LANE 5 (2): the Maul is the service\'s word - a refusal mints none, an answer lost is asked again with the same id, no answer at all none (mutants: minted without asking; asked again with a new id)', async () => {
  const clock = clocked({ t: HEART_T });
  const service = { days: new Set([Math.floor(HEART_T / 86_400_000)]), asks: [], down: false };
  const A = client('aaaa-0001', { clock, service });
  A.at(30); await A.beat(); await clear(A); await A.beat(); await settle();
  assert.deepEqual([service.asks.length, A.taken.length], [1, 0], 'today\'s taken: asked once, none minted');
  const down = { days: new Set(), asks: [], down: true };
  const B = client('bbbb-0002', { clock, service: down });
  B.at(30); await B.beat(); await clear(B); await B.beat(); await settle();
  assert.equal(B.taken.length, 0, 'offline: no Maul');
  assert.equal(down.asks.length, SEASON_MAUL_ASKS, 'asked again while no answer came');
  assert.equal(new Set(down.asks).size, 1, 'with the one ask\'s id');
  assert.match(down.asks[0], /^[0-9a-f]{16}$/);
});

test('AUDIT LANE 5 (7): every screen that saw the camp fall keeps its quiet, through a reload - a reader stands no fresh camp for twenty minutes (mutants: the quiet the stander\'s alone; the quiet forgotten at a reload)', async () => {
  const clock = clocked({ t: HEART_T });
  const store = memStorage();
  const A = client('aaaa-0001', { clock }), B = client('bbbb-0002', { clock, storage: store });
  A.at(30); await A.beat();
  B.at(20); await A.tell(B); await B.beat();
  await clear(A); await A.beat();
  await A.tell(B); await B.beat();
  assert.ok(JSON.parse(store.getItem(SEASON_QUIET_STORE))[`bbbb-0002|char|${B.f.key}`] > 0, 'B kept its quiet');
  // A's bodies go with A; its word ages past the orphan's
  B.pool.pruneOwners(new Set());
  clock.t += SEASON_ORPHAN_MS + 6000; await B.beat();
  assert.equal(B.own().length, 0, 'B stands no fresh camp');
  const B2 = client('bbbb-0002', { clock, storage: store });   // a reload: a new page on the same store
  B2.at(20); await B2.beat();
  assert.equal(B2.own().length, 0, 'nor after a reload');
  clock.t += SEASON_QUIET_MS; await B2.beat();
  assert.ok(B2.own().length > 0, 'the quiet over: it stands');
});

test('AUDIT LANE 5 (12): a race lost and the winner walked off is no clear - the loser may stand the camp again (mutants: a race loser quiet)', async () => {
  const clock = clocked({ t: HEART_T });
  const A = client('aaaa-0001', { clock }), B = client('bbbb-0002', { clock });
  A.at(30); B.at(-30);
  A.host.frame(); B.host.frame(); await settle();
  await A.tell(B); await B.tell(A); await A.tell(B); await B.tell(A);
  await A.beat(); await B.beat();
  assert.ok(A.own().length > 0 && B.own().length === 0 && B.copies().length > 0, 'the smaller id kept it');
  A.at(5000); await A.beat();   // A walks off: its camp given up
  await A.tell(B); await B.beat();
  assert.equal(B.live().length, 0, 'nothing of it left on B');
  assert.equal(B.storage.getItem(SEASON_QUIET_STORE), null, 'no quiet: B saw no fall');
  B.pool.pruneOwners(new Set());
  clock.t += SEASON_ORPHAN_MS + 6000; await B.beat(); await B.beat();
  assert.ok(B.own().length > 0, 'B stands it');
});

test('AUDIT LANE 5 (11): the waking is said and seen as the first stands, never for a stand that stood nothing (mutants: the line before anything stands)', async () => {
  const clock = clocked({ t: HEART_T });
  const A = client('aaaa-0001', { clock });
  const spawn = A.pool.spawnFoe;
  A.pool.spawnFoe = async () => null;   // the grant law refuses every stand
  A.at(30);
  for (let i = 0; i < 4; i++) { await A.beat(); clock.t += 5000; }
  assert.deepEqual([wakes(A), A.bursts.filter((b) => b === 'fissure-wake').length], [0, 0]);
  A.pool.spawnFoe = spawn;
  await A.beat();
  assert.deepEqual([wakes(A), A.bursts.filter((b) => b === 'fissure-wake').length], [1, 1], 'said once as it stands');
});

test('AUDIT LANE 5 (2, 8): nothing of the season stands before the relay\'s clock is heard; the quiet is kept under the signed-in account (mutants: the device clock trusted; the account never read)', async () => {
  const clock = clocked({ t: HEART_T });
  const A = client('aaaa-0001', { clock });
  A.heard = false;
  A.at(30); await A.beat();
  assert.deepEqual([A.own().length, A.host.mapMarks().length, A.host.fissureClears().length], [0, 0, 0], 'unheard: nothing');
  A.heard = true; await A.beat();
  assert.ok(A.own().length > 0);
  const store = memStorage();
  store.setItem(SESSION_KEY, JSON.stringify({ id: 'acct-7', secret: 's', kind: 'registered' }));
  const B = client('bbbb-0002', { clock, storage: store, who: null });
  B.at(30); await B.beat(); await clear(B); await B.beat();
  assert.deepEqual(Object.keys(JSON.parse(store.getItem(SEASON_QUIET_STORE))).map((k) => k.split('|')[0]), ['acct-7']);
});
