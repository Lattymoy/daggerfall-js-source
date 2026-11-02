// FIELD BUGS 2026-10-19f STEED-KEPT (a player's private report: their horse vanished after dying in a dungeon - not in
// the pack, not at the stable; the owner, 2026-10-19, answering this session's questions: "Exclude, and return taken
// ones"). A revenant that kills me takes one piece (RVN8, Feud-Arc.md section 19) - and its law refused letters, quest
// items, summoned pieces, gold, the Materials Bag, pack-only and locked pieces, but not a vehicle or a deed, which the
// open zone's own law already calls pieces that never change hands (wildDropLaw.js WILD_NEVER_GROUPS). A stable's horse
// beside a worn longsword and four spare weapons was drawn 165 times in 1,000. Pinned: it never takes a horse, a cart, a
// deed (a ship's too) or the spellbook, nor draws one - a bound piece stays its own (AUDIT 625 W2); a deserter keeps
// none; and one it took before comes home to my pack at the load - where the game keeps owned transport - from the
// save's own copy, said once, never twice. Every piece here is its producer's: the stable's horses and the wagon yard's
// carts (merchantYards.js yardStock), a prize's deed and a yard's parts (comeSailAwayItems.js), the starting kit's
// spellbook, the Portal Stones.
import '../../modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};

const N = await import('../../../src/systems/revenant/revenant.js');
const RC = await import('../../../src/systems/revenant/revenantCompanions.js');
const S = await import('../../../src/systems/companionSlots.js');
const { setPref, _resetForTests } = await import('../../../src/systems/uiPrefs.js');
const { setPlayerDoor } = await import('../../../src/systems/playerDoor.js');
const { setWorldMinutes } = await import('../../../src/systems/worldTick.js');
const { MOBILE_TYPES: M } = await import('../../../src/characters/mobile/mobileTypes.js');
const { WEAPONS: W } = await import('../../../src/characters/weapons.js');
const { createWeapon } = await import('../../../src/combat/enemyEquipment.js');
const { equipItem } = await import('../../../src/systems/equip.js');
const { yardStock } = await import('../../../src/systems/merchantYards.js');
const { mintDeed, mintParts } = await import('../../../src/systems/comeSailAway/comeSailAwayItems.js');
const { assignStartingGear } = await import('../../../src/systems/startingGear.js');
const { portalStones } = await import('../../../src/systems/gate/gateSpoils.js');
const { isSpellbook } = await import('../../../src/systems/useItem.js');
const { TRANSPORT_HORSE, TRANSPORT_SMALL_CART } = await import('../../../src/systems/item/itemTemplates.js');
const { modSaveRecords, restoreModSaveRecords } = await import('../../../src/systems/modSaveData.js');
const { registerPresenter, _resetNotifyForTests } = await import('../../../src/systems/notify.js');
const { seeded } = await import('../../honestItems.mjs');


const DAY = 1440;
beforeEach(() => {
  _resetForTests(); setPref('lootRarity', true);
  N._resetRevenantForTests(); RC._resetRetinueForTests(); S._resetCompanionSlotsForTests(); _store.clear(); _resetNotifyForTests();
  S.registerCompanionCount('revenant', () => RC.revenantsWithYou().length);
  setPlayerDoor(null); setWorldMinutes(DAY * 10);
});

const blade = (tpl, mat = 1) => createWeapon(tpl, mat, () => 0.5);
/** The stable's first horse and the wagon yard's carts, as their counters mint them. */
const horse = () => yardStock('stable', { mapId: 1234, day: 50 }).find((it) => it.templateIndex === TRANSPORT_HORSE);
const carts = () => yardStock('transport').filter((it) => it.group === 'Transportation');
/** The repro's pack: a steel longsword worn, four spare weapons and the stable's horse. */
function me(id = 'char-fb1019f-steed') {
  const p = { isPlayer: true, name: 'Ayla Stormwind', characterId: id, level: 20, stats: {}, skills: [], career: {}, activeEffects: [], items: [], health: 100, maxHealth: 100 };
  const sword = blade(W.Longsword, 3);
  p.items.push(sword, blade(W.Dagger, 1), blade(W.Shortsword, 2), blade(W.Saber, 3), blade(W.Mace, 3), horse());
  equipItem(p, sword);
  RC.setRetinuePlayer(p);
  return p;
}
const killer = (champion = 'mighty') => ({ mobileType: M.Orc, level: 6, champion, unquiet: true, health: 50, maxHealth: 50, team: 'Monster' });
const slain = (p, e = killer()) => N.revenantDeed(p, e, 'slew', { mobileType: M.Orc, rolls: () => 0 });
const steeds = (list) => (list ?? []).filter((it) => it?.group === 'Transportation');

test('STEED-KEPT THE LAW (revenant.js revenantMayTake): never a horse, a cart of any kind, a ship\'s deed or her parts, the spellbook - what never changes hands; a bound piece stays its own (AUDIT 625 W2 - it never rides to another player), and a sword still is (mutants: the vehicle\'s groups unread; the kept-back list unread; the boat\'s two unread)', () => {
  assert.equal(N.revenantMayTake(horse()), false, 'the stable\'s horse');
  const c = carts();
  assert.deepEqual(c.map((it) => it.templateIndex), [TRANSPORT_SMALL_CART, TRANSPORT_SMALL_CART, TRANSPORT_SMALL_CART], 'the yard\'s three carts');
  for (const it of c) assert.equal(N.revenantMayTake(it), false, `a ${it.wagonKind ?? 'cart'}`);
  assert.equal(N.revenantMayTake(mintDeed(2, 0, 4242, 9000)), false, 'a ship\'s deed - a deed handed on is a second boat');
  assert.equal(N.revenantMayTake(mintParts(0, 0, 4343)), false, 'her parts');
  const kit = { items: [], gender: 'female' };
  assignStartingGear(kit, { classIndex: 16, rolls: seeded(3) });
  const book = kit.items.find(isSpellbook);
  assert.ok(book, 'the starting kit\'s spellbook');
  assert.equal(N.revenantMayTake(book), false, '"Your spellbook never leaves you."');
  assert.equal(N.revenantMayTake(portalStones(3)), true, 'a bound piece stays RVN8\'s own: its body hands it to its owner alone');
  assert.equal(N.revenantMayTake(blade(W.Longsword)), true, 'a sword still is');
});

test('STEED-KEPT THE PICK AND THE TAKE: the repro\'s pack - a worn longsword, four spare weapons and the stable\'s horse - drew the horse 165 times in 1,000; never now, on any id or count; three deaths to it take three pieces and never the horse, nor a cart or a ship\'s deed carried beside it (mutants: the vehicle\'s groups unread; the boat\'s two unread)', () => {
  const p = me();
  const sword = p.items[0];
  let drawn = 0;
  for (let i = 0; i < 1000; i++) if (steeds([N.pickTaken(`rvn-${i}`, i % 3, sword, p.items)]).length) drawn++;
  assert.equal(drawn, 0, 'never the horse');
  p.items.push(carts()[2], mintDeed(4, 1, 5151, 60000));
  const e = killer();
  setPlayerDoor({ foes: () => [{ entity: e, dead: false }], feet: () => null, hurtFoe: () => {}, castOnPlayer: () => {} });
  const r = slain(p, e);
  const took = [];
  for (let k = 0; k < 3; k++) { slain(p, e); const t = N.revenantTakes(p, { online: true }); if (t?.item) took.push(t.item); }
  assert.equal(took.length, 3, 'it took what it may');
  assert.deepEqual([steeds(took), steeds(r.took), steeds(e.items)], [[], [], []], 'no horse, no cart taken, held or carried');
  assert.ok(!took.some((it) => it.templateIndex === 1321), 'no ship\'s deed');
  assert.equal(steeds(p.items).length, 2, 'the horse and the caravan still mine');
});

test('STEED-KEPT THE DESERTER: a sworn one leaving keeps no ship\'s deed its pack held - it comes back to me (mutants: the boat\'s two unread)', () => {
  const p = me('char-fb1019f-desert');
  const r = N.revenantDeed(p, killer(), 'fled', { mobileType: M.Orc, rolls: () => 0 });
  const s = N.revenantSpared(p, { revenant: { id: r.id } }, { state: 'away' });
  const deed = mintDeed(3, 0, 7171, 30000), mace = blade(W.Mace, 2);   // a Galleon's deed, worth more than anything else it holds
  N.revenantCompanionUpdate(p, s.id, (c) => { c.items = [deed, mace]; });
  N.revenantDeserts(p, N.revenantById(s.id), { now: DAY * 11 });
  assert.ok(!N.revenantById(s.id).took.includes(deed), 'it keeps no ship\'s deed');
  assert.ok(p.items.includes(deed), 'the deed is mine');
});

test('STEED-KEPT THE LOAD (revenant.js ensureMirror): a horse, a cart, a ship\'s deed and the spellbook a revenant took before the law - living, or fallen with a body that never carried it - come home to my pack from the save\'s copy, each said once; what it may take stays its own; the next save\'s load brings none and says nothing (mutants: the hand-back dropped; the hand-back keeps them on the record; the words unsaid; every piece handed back)', () => {
  const p = me('char-fb1019f-load');
  const living = slain(p, killer('mighty'));
  const fallen = slain(p, killer('swift'));
  // what a save made before STEED-KEPT holds: each record's `took` with what it drew out of my pack
  const steed = p.items.find((it) => it.templateIndex === TRANSPORT_HORSE), saber = p.items.find((it) => it.templateIndex === W.Saber);
  const kit = { items: [], gender: 'female' };
  assignStartingGear(kit, { classIndex: 16, rolls: seeded(3) });
  const cart = carts()[0], deed = mintDeed(2, 0, 6262, 9000), book = kit.items.find(isSpellbook);
  p.items = p.items.filter((it) => it !== steed && it !== saber);
  N.revenantById(living.id).took = [steed, saber, cart];
  N.revenantById(fallen.id).took = [deed, book];
  N.revenantById(fallen.id).defeated = true;
  const save = JSON.parse(JSON.stringify(modSaveRecords()[N.REVENANT_SAVE]));
  const pack = JSON.parse(JSON.stringify(p.items));
  const said = [];
  const load = (rec) => {
    N._resetRevenantForTests(); _store.clear(); _resetNotifyForTests(); said.length = 0;
    registerPresenter({ hudText: (t) => { said.push(t); return true; } });
    const q = { ...p, items: JSON.parse(JSON.stringify(pack)) };
    restoreModSaveRecords({ [N.REVENANT_SAVE]: JSON.parse(JSON.stringify(rec)) });
    N.revenantToReturn(q, { now: 0 });   // any ask reads the mirror in
    return q;
  };
  const q = load(save);
  const home = q.items.slice(pack.length);
  assert.deepEqual(home.map((it) => it.templateIndex), [TRANSPORT_HORSE, TRANSPORT_SMALL_CART, 1321, book.templateIndex], 'home in my pack, each');
  assert.equal(home[0].horseSeed, steed.horseSeed, 'the very horse the stable sold');
  assert.deepEqual(N.revenantById(living.id).took.map((it) => it.templateIndex), [W.Saber], 'the saber it took is still its own');
  assert.deepEqual(N.revenantById(fallen.id).took, [], 'none left on the fallen one');
  const rv = (id) => N.revenantById(id);
  assert.deepEqual(said, [
    N.tookHomeLine(rv(living.id), steed), N.tookHomeLine(rv(living.id), cart),
    N.tookHomeLine(rv(fallen.id), deed), N.tookHomeLine(rv(fallen.id), book),
  ], 'each said once');
  assert.equal(said[0], `${rv(living.id).name} could not keep your Horse. It is back in your pack.`);
  // the record without them is what the next save writes: its load brings none again, and says nothing
  const next = JSON.parse(JSON.stringify(modSaveRecords()[N.REVENANT_SAVE]));
  const r2 = load(next);
  assert.equal(r2.items.length, pack.length, 'never twice');
  assert.deepEqual(said, [], 'nothing said');
});
