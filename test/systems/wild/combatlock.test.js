// AUDIT PVP-EASE L2-1 (2026-10-26, the owner: "Can we audit this"; asked how storage should work inside the open zone, the
// owner chose "Combat lock" - bible/01-Overview/audits/Audit-PvP-Ease.md, bible/11-Multiplayer/Wild-Zone.md STORE-KEEPS):
// STORE-KEEPS made the cart, a companion's pack, a ship's hold, a chest and a sworn one's kit storage no death in the zone
// takes - and a fighter at 1 HP moved its whole bag and purse into them, so a player's kill cost it one worn piece at most.
// For WILD_STORE_LOCK_MS after a player's blow - given or taken, a sword's or a ship's gun's - nothing may be stored; taking
// out is never locked. Pinned: the lock's law (systems/wild/wildZone.js), the window's question (systems/inventorySession.js
// storeRefusalOf), the two transfer laws (systems/item/itemTransfer.js planStore, planDropGold), and every door that asks.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { noteWildBlow, wildStoreRefusal, wildDeathAtHand, setWildDeath, WILD_STORE_LOCK_MS, WILD_TEXT } from '../../../src/systems/wild/wildZone.js';
import { storeRefusalOf } from '../../../src/systems/inventorySession.js';
import { planStore, planDropGold, planTake } from '../../../src/systems/item/itemTransfer.js';
import { createSeaBroadsides } from '../../../src/scenes/naval/seaBroadsides.js';
import { createWeapon } from '../../../src/combat/enemyEquipment.js';
import { hostText } from '../../hostText.mjs';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const sword = () => createWeapon(120, 3, () => 0.5);
/** A clock far past any blow these tests noted before it. */
let base = 10_000_000_000;
const fresh = () => (base += 10 * WILD_STORE_LOCK_MS);

test('AUDIT PVP-EASE L2-1 THE LOCK (systems/wild/wildZone.js): a player\'s blow locks storing WILD_STORE_LOCK_MS - a minute - said with the seconds left; a fall at another\'s hand locks it a minute past the pick, so a Resurrect stores nothing before the take (mutants: the blow unnoted; the length; the fall unlocked)', () => {
  assert.equal(WILD_STORE_LOCK_MS, 60_000);
  const t0 = fresh();
  assert.equal(wildStoreRefusal(t0), null, 'no fight: stored');
  noteWildBlow(t0);
  assert.equal(wildStoreRefusal(t0), WILD_TEXT.storeLocked(60));
  assert.equal(wildStoreRefusal(t0), 'You cannot store anything for 60 more seconds after fighting another player.');
  assert.equal(wildStoreRefusal(t0 + WILD_STORE_LOCK_MS - 1), WILD_TEXT.storeLocked(1));
  assert.equal(wildStoreRefusal(t0 + WILD_STORE_LOCK_MS), null, 'a minute on: stored');
  noteWildBlow(t0 - 5_000);
  assert.equal(wildStoreRefusal(t0 + WILD_STORE_LOCK_MS), null, 'an older blow never pulls the lock back');
  // my fall at another player's hand: the take is the pick's minute behind it
  const realNow = Date.now;
  const t1 = fresh();
  Date.now = () => t1;
  try { wildDeathAtHand({ r: '0123456789ab', by: 'peer-0002', room: 'world:1,1', at: t1 }, 'Borin'); } finally { Date.now = realNow; setWildDeath(null); }
  assert.notEqual(wildStoreRefusal(t1 + 90_000), null, 'raised at ninety seconds: still locked');
  assert.equal(wildStoreRefusal(t1 + 2 * WILD_STORE_LOCK_MS), null);
});

test('AUDIT PVP-EASE L2-1 THE WINDOW\'S QUESTION (systems/inventorySession.js storeRefusalOf): asked only when the destination is storage - the wagon, or a list the host marks `storage` (a companion\'s pack, a hold, a chest) - never the ground, a corpse, a merchant or a choose-one list; the host\'s own word first (mutants: the ground locked; a corpse locked; the wagon unasked; the storage flag unread)', () => {
  const t0 = fresh();
  const realNow = Date.now;
  Date.now = () => t0;
  try {
    noteWildBlow(t0);
    const lock = WILD_TEXT.storeLocked(60);
    assert.equal(storeRefusalOf({}, { usingWagon: true }), lock, 'the wagon');
    assert.equal(storeRefusalOf({ loot: { storage: true, playerOwned: true } }, {}), lock, 'a companion\'s pack, a hold, a chest');
    assert.equal(storeRefusalOf({}, {}), null, 'the ground');
    assert.equal(storeRefusalOf({ loot: { playerOwned: false } }, {}), null, 'a corpse, a pile');
    assert.equal(storeRefusalOf({ loot: { storage: true } }, { chooseOne: true }), null, 'a choose-one list');
    assert.equal(storeRefusalOf({ storeRefusal: () => 'the host says no', loot: { storage: true } }, {}), 'the host says no');
    Date.now = () => t0 + WILD_STORE_LOCK_MS;
    assert.equal(storeRefusalOf({}, { usingWagon: true }), null, 'past it');
  } finally { Date.now = realNow; }
});

test('AUDIT PVP-EASE L2-1 THE TRANSFER LAWS (systems/item/itemTransfer.js): planStore and planDropGold refuse a store the window says is locked, its words its own (`store`); taking out of storage is never asked (mutants: the store word unread in either; a take refused)', () => {
  const s = sword();
  const no = planStore(s, { usingWagon: true, storeRefusal: 'locked' });
  assert.deepEqual(no, { ok: false, refusal: { reason: 'store', text: 'locked' } });
  assert.equal(planStore(s, { usingWagon: true }).ok, true, 'unlocked: stored');
  const gold = planDropGold('100', { carried: 500, usingWagon: true, storeRefusal: 'locked' });
  assert.deepEqual([gold.ok, gold.refusal], [false, { reason: 'store', text: 'locked' }]);
  assert.equal(planDropGold('100', { carried: 500, usingWagon: true }).ok, true);
  assert.equal(planTake(s, { usingWagon: true }).ok, true, 'out of the wagon: never locked');
  assert.ok(!/storeRefusal/.test(rd('src/systems/item/itemTransfer.js').slice(rd('src/systems/item/itemTransfer.js').indexOf('export function planTake('))), 'planTake reads no lock');
});

test('AUDIT PVP-EASE L2-1 THE DOORS: both inventories ask at every store and gold drop, and say the lock; a sworn one\'s kit asks; the world host notes a landed blow, and the sea\'s guns note theirs (mutants: a door unasked; the gold\'s refusal unsaid; the blow unnoted; the gunfight unnoted)', () => {
  const t0 = fresh();
  let clock = t0;
  const b = createSeaBroadsides({ live: () => true, naval: () => null, send: () => true, me: () => 'peer-me', stranger: () => true, now: () => clock, say: () => {}, mid: () => {} });
  assert.equal(wildStoreRefusal(t0), null);
  b.hear({ k: 'hull', by: 'peer-x', to: 'peer-me', d: 10, s: 0, f: 0, h: 900 });
  assert.notEqual(wildStoreRefusal(t0), null, 'my ship struck: locked');
  clock = fresh();
  b.hear({ k: 'hull', by: 'peer-me', to: 'peer-x', d: 10, s: 0, f: 0, h: 900 });
  assert.notEqual(wildStoreRefusal(clock), null, 'my broadside landed: locked');
  const enh = rd('src/ui/enhanced/enhancedInventory.js');
  assert.equal(enh.split('groundRefusal: groundRefusalOf(deps, session), storeRefusal: storeRefusalOf(deps, session)').length - 1, 6, 'every store, dry run and gold drop of the Enhanced pack');
  assert.ok(enh.includes("else if (!plan.ok && (plan.refusal?.reason === 'ground' || plan.refusal?.reason === 'store')) notice = plan.refusal.text;"), 'its gold drop says it');
  const nat = rd('src/ui/native/nativeInventory.js');
  assert.equal(nat.split('storeRefusal: storeRefusalOf(this.hooks, { usingWagon: this.usingWagon, chooseOne: this.chooseOne })').length - 1, 2, 'the classic pack\'s store and gold drop');
  assert.ok(nat.includes("if (plan.refusal?.reason === 'ground' || plan.refusal?.reason === 'store') this._refuse(plan.refusal);"));
  assert.ok(rd('src/systems/revenant/revenantCompanions.js').includes('const why = gearRefusal(r, item, { kindName }) ?? wildStoreRefusal();'), 'a sworn one\'s kit');
  const w = hostText('src/scenes/world.js');
  assert.ok(/if \(\(g\.by !== me && g\.to !== me\) \|\| \(g\.ev && pvpEvadeHeard\(g\.by === me\)\)\) return;[^\n]*\n {4}noteWildBlow\(\);/.test(w), 'a landed blow, mine or on me');   // PIN MOVED (PVP-EVADE): 'if (g.by !== me && g.to !== me) return;' - an evaded blow is said and notes nothing
});
