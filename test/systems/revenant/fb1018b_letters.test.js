// LETTERS-HOME (FIELD BUGS 2026-10-18b - bible/01-Overview/bugs/Field-Bugs-2026-10-18b.md; shaman, "Letter of Credit
// vanishing from wallet": "I LOST NEARLY 2 million worth of GOLD in letter of credits, they simply VANISHED from my
// wallet"). A revenant that kills me takes one piece - never gold (RVN8, Feud-Arc.md section 19) - but "gold" was the coin
// alone, so a letter of credit (its worth is gold) was takeable, and the pack's most valuable piece by far. Pinned: no
// letter is takeable, drawn or taken, whatever it is worth; a deserter's letter comes back to me; and a letter a revenant
// took before this - living, fallen with a body that never carried it, or a deserter's - comes home at the load, from the
// save's own copy, never twice.
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
const { letterOfCredit, goldStack, LETTER_OF_CREDIT_TEMPLATE } = await import('../../../src/systems/inventory.js');
const { realmLetterOfCredit } = await import('../../../src/net/realm/realmGoldLaw.js');
const { sellProceeds } = await import('../../../src/systems/tradeModes.js');
const { modSaveRecords, restoreModSaveRecords } = await import('../../../src/systems/modSaveData.js');

const DAY = 1440;
beforeEach(() => {
  _resetForTests(); setPref('lootRarity', true);
  N._resetRevenantForTests(); RC._resetRetinueForTests(); S._resetCompanionSlotsForTests(); _store.clear();
  S.registerCompanionCount('revenant', () => RC.revenantsWithYou().length);
  setPlayerDoor(null); setWorldMinutes(DAY * 10);
});

const blade = (tpl = W.Longsword, mat = 1) => createWeapon(tpl, mat, () => 0.5);
/** A letter as a shop pays one (tradeModes.js sellProceeds - the sale too heavy to carry as coin): the producer's own. */
function paid(amount) {
  const r = sellProceeds(amount, { carriedWeightKg: 0, maxEncumbranceKg: 0 });
  assert.equal(r.kind, 'letterOfCredit', 'the counter pays it in paper');
  return letterOfCredit(r.amount);
}
function me(id = 'char-fb1018b') {
  const p = { isPlayer: true, name: 'Ayla Stormwind', characterId: id, level: 30, stats: {}, skills: [], career: {}, activeEffects: [], items: [], health: 100, maxHealth: 100 };
  const w = blade(W.Longsword, 3);
  p.items.push(w, blade(W.Dagger, 0), paid(650_000), paid(700_000), paid(600_000), goldStack(500));
  equipItem(p, w);
  RC.setRetinuePlayer(p);
  return p;
}
const killer = () => ({ mobileType: M.Orc, level: 6, champion: 'mighty', unquiet: true, health: 50, maxHealth: 50, team: 'Monster' });
const slain = (p, e = killer()) => N.revenantDeed(p, e, 'slew', { mobileType: M.Orc, rolls: () => 0 });
const letters = (list) => (list ?? []).filter((it) => it?.templateIndex === LETTER_OF_CREDIT_TEMPLATE);
const worth = (list) => letters(list).reduce((g, it) => g + it.value, 0);

test('LETTERS-HOME THE LAW: a letter of credit is gold - never takeable, whoever minted it and whatever it is worth (mutants: the letter takeable)', () => {
  for (const it of [paid(650_000), letterOfCredit(100), realmLetterOfCredit(2_000_000)]) assert.equal(N.revenantMayTake(it), false, `a letter worth ${it.value}`);
  assert.equal(N.revenantMayTake(blade()), true, 'a sword still is');
});

test('LETTERS-HOME THE PICK AND THE TAKE: three deaths to it take three pieces and never a letter - every one is still in my pack, at its worth (mutants: the letter takeable)', () => {
  const p = me();
  const before = worth(p.items);
  assert.equal(letters(p.items).length, 3);
  // the pick, on every id and count: never a letter, though each outweighs every blade in the pack ten thousand times
  for (let i = 0; i < 200; i++) assert.notEqual(N.pickTaken(`fb1018b-${i}`, i % 3, null, p.items)?.templateIndex, LETTER_OF_CREDIT_TEMPLATE);
  // the take, through its real door: a pack of letters and two blades
  const e = killer();
  setPlayerDoor({ foes: () => [{ entity: e, dead: false }], feet: () => null, hurtFoe: () => {}, castOnPlayer: () => {} });
  const r = slain(p, e);
  const took = [];
  for (let k = 0; k < 3; k++) { slain(p, e); const t = N.revenantTakes(p, { online: true }); if (t?.item) took.push(t.item); }
  assert.ok(took.length >= 1, 'it took what it may');
  assert.equal(letters(took).length, 0, 'no letter taken');
  assert.equal(letters(r.took).length, 0, 'none on its record');
  assert.equal(letters(e.items).length, 0, 'none in its body');
  assert.equal(worth(p.items), before, 'every letter in my pack, at its worth');
});

test('LETTERS-HOME THE DESERTER: a sworn one leaving keeps no letter its pack held - the letter comes back to me with its gold (mutants: the letter takeable)', () => {
  const p = me();
  const r = N.revenantDeed(p, killer(), 'fled', { mobileType: M.Orc, rolls: () => 0 });
  const s = N.revenantSpared(p, { revenant: { id: r.id } }, { state: 'away' });
  s.companion.loyalty = 3; s.personality = 'honourable';
  const letter = paid(900_000), sword = blade(W.Mace, 2);
  N.revenantCompanionUpdate(p, s.id, (c) => { c.items = [letter, sword]; });
  N.revenantDeserts(p, N.revenantById(s.id), { now: DAY * 11 });
  assert.ok(!N.revenantById(s.id).took.includes(letter), 'it keeps no letter');
  assert.ok(p.items.includes(letter), 'the letter is mine');
});

test('LETTERS-HOME THE LOAD: a letter a revenant took before the law - living, fallen with a body that never carried it, a deserter\'s - comes home from the save\'s copy; its other pieces stay its own; a second load brings none twice (mutants: the hand-back dropped; the hand-back keeps the letter on the record)', () => {
  const p = me('char-fb1018b-load');
  const living = N.revenantDeed(p, killer(), 'slew', { mobileType: M.Orc, rolls: () => 0 });
  const fallen = N.revenantDeed(p, { ...killer(), champion: 'swift' }, 'slew', { mobileType: M.Orc, rolls: () => 0 });
  // what a save made before LETTERS-HOME holds: each record's `took` with a letter it drew out of my pack
  const [a, b] = letters(p.items);
  const sword = p.items.find((it) => it.templateIndex === W.Dagger);
  p.items = p.items.filter((it) => it !== a && it !== b && it !== sword);
  N.revenantById(living.id).took = [a, sword];
  N.revenantById(fallen.id).took = [b];
  N.revenantById(fallen.id).defeated = true;
  const save = JSON.parse(JSON.stringify(modSaveRecords()[N.REVENANT_SAVE]));
  const pack = JSON.parse(JSON.stringify(p.items));
  const load = () => {
    N._resetRevenantForTests(); _store.clear();
    const q = { ...p, items: JSON.parse(JSON.stringify(pack)) };
    restoreModSaveRecords({ [N.REVENANT_SAVE]: JSON.parse(JSON.stringify(save)) });
    N.revenantToReturn(q, { now: 0 });   // any ask reads the mirror in
    return q;
  };
  const q = load();
  assert.equal(worth(q.items), worth(pack) + a.value + b.value, 'both letters home, at their worth');
  assert.equal(letters(N.revenantById(living.id).took).length, 0, 'none left on the living one');
  assert.equal(letters(N.revenantById(fallen.id).took).length, 0, 'none left on the fallen one');
  assert.equal(N.revenantById(living.id).took.length, 1, 'the sword it took is still its own');
  // the record without them is what the next save writes: a load of it brings none again
  const saved = JSON.parse(JSON.stringify(modSaveRecords()[N.REVENANT_SAVE]));
  N._resetRevenantForTests(); _store.clear();
  restoreModSaveRecords({ [N.REVENANT_SAVE]: saved });
  N.revenantToReturn(q, { now: 0 });
  assert.equal(worth(q.items), worth(pack) + a.value + b.value, 'never twice');
});
