// RVN12b - THE PAGE AND THE CARD (bible/12-Enhanced-AI/Feud-Arc.md section 24; Mac, 2026-10-04: "more complex, less
// easy to accomplish and more detailed", then "Go"). The Revenants page, for the living: what it learned as chips, each
// with its effect; what it took; its festering as three pips - beside RVN3-RVN7's weakness, will, last stand,
// signature, band and lair. For the sworn: its loyalty. For the fallen: "escaped unbroken" among its deeds. The card:
// FEUD's edges - a last stand blood with an ember rim, a signature iron red, a theft amber, a betrayal black.
// Pinned: the words from real records; every habit's effect; an unbroken escape kept through the save and said; the
// page drawn; the card's edges.
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};

const N = await import('../src/systems/revenant.js');
const F = await import('../src/systems/revenantFeud.js');
const PG = await import('../src/ui/revenantPage.js');
const { REVENANT_CARD_CSS } = await import('../src/ui/revenantCard.js');
const { setPref, _resetForTests } = await import('../src/systems/uiPrefs.js');
const { MOBILE_TYPES: M } = await import('../src/characters/mobileTypes.js');
const { createWeapon } = await import('../src/combat/enemyEquipment.js');
const { WEAPONS: W } = await import('../src/characters/weapons.js');
const { itemLongName } = await import('../src/systems/itemInfo.js');
const { modSaveRecords, restoreModSaveRecords } = await import('../src/systems/modSaveData.js');

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const me = { isPlayer: true, name: 'Ayla Stormwind', characterId: 'char-rvn12b', level: 8, items: [] };
beforeEach(() => { _resetForTests(); setPref('lootRarity', true); N._resetRevenantForTests(); _store.clear(); });
const made = (deedName = 'fled', opts = {}) => N.revenantDeed(me, { mobileType: M.Orc, level: 6, champion: 'mighty', health: 5, maxHealth: 50, team: 'Monster' }, deedName, { mobileType: M.Orc, rolls: () => 0, ...opts });
function draw() {
  const nodes = [];
  const el = (tag, cls = '', text = '') => {
    const n = { tag, cls, text, title: '', kids: [], append(...k) { this.kids.push(...k); }, insertBefore(k) { this.kids.unshift(k); }, setAttribute(a, v) { this[a] = v; }, get firstChild() { return this.kids[0] ?? null; }, querySelector: () => null, isConnected: true };
    nodes.push(n);
    return n;
  };
  PG.drawRevenantsPage(el('div'), () => {}, { el, divider: (t) => el('h4', '', t), player: me, kindName: () => 'Orc' });
  return nodes;
}

test('RVN12b WHAT IT LEARNED: chips, each its name and what it does, oldest first; an effect for every habit (mutants: an effect lost; the order)', () => {
  assert.deepEqual(Object.keys(PG.ADAPT_EFFECTS).sort(), [...F.ADAPTATIONS].sort());
  assert.deepEqual(PG.learnedChips({ learned: ['arrowWise', 'fireproof'] }), [
    { id: 'arrowWise', name: 'Arrow-wise', effect: 'your arrows bite less; it closes fast', title: 'Arrow-wise - your arrows bite less; it closes fast' },
    { id: 'fireproof', name: 'Fireproof', effect: 'it shrugs off fire', title: 'Fireproof - it shrugs off fire' },
  ]);
  assert.deepEqual(PG.learnedChips({ learned: ['nope'] }), []);
});

test('RVN12b WHAT IT TOOK, ITS FESTERING, A SWORN ONE\'S LOYALTY: in words - each piece by its pack name; three pips, filled by its wrath (none without one); its loyalty and its word (mutants: a piece unnamed; the pips unfilled; the word wrong)', () => {
  const a = createWeapon(W.Longsword, 1, () => 0.5), b = createWeapon(W.Dagger, 1, () => 0.5);
  assert.equal(PG.tookWords({ took: [a] }), `Took: your ${itemLongName(a)} - take it back from it.`);
  assert.equal(PG.tookWords({ took: [a, b] }), `Took: your ${itemLongName(a)} and ${itemLongName(b)} - take them back from it.`);
  assert.equal(PG.tookWords({ took: [] }), '');
  assert.deepEqual(PG.festerPips({ wrath: 2 }), { filled: 2, of: 3, words: 'Festering: 2 of 3 - it grows stronger the longer you leave it.' });
  assert.deepEqual(PG.festerPips({ wrath: 9 }).filled, 3);
  assert.equal(PG.festerPips({}).words, '');
  assert.equal(PG.swornLoyaltyWords({ companion: { loyalty: 92 } }), 'Loyalty: 92 - Devoted.');
  assert.equal(PG.swornLoyaltyWords({ companion: null }), '');
});

test('RVN12b AN ESCAPE UNBROKEN: the deed remembers it (through the save), the page says it; only an escape (mutants: unsaved; unsaid; any deed unbroken)', () => {
  const r = made('fled', { unbroken: true, now: 50 });
  assert.deepEqual(r.history.at(-1), { deed: 'fled', at: 50, unbroken: true });
  r.history.push({ deed: 'slew', at: 60, unbroken: true });
  restoreModSaveRecords(modSaveRecords());
  const back = N.revenantsFor(me).find((x) => x.id === r.id);
  assert.deepEqual(back.history.slice(-2), [{ deed: 'fled', at: 50, unbroken: true }, { deed: 'slew', at: 60 }]);
  assert.equal(PG.historyWords({ deed: 'fled', at: 1, unbroken: true }), 'escaped unbroken');
  assert.equal(PG.historyWords({ deed: 'fled', at: 1 }), 'escaped');
  assert.equal(made('fled', { now: 70 }).history.at(-1).unbroken, undefined);
  for (const [file, arch] of [['src/scenes/exteriorFoes.js', 'f.archive'], ['src/scenes/dungeonContext.js', 'f.mobileArchive']]) {
    assert.ok(read(file).includes(`revenantDeed(playerEntity, f.entity, 'fled', { mobileType: f.mobileType, gender: f.gender, rec: f, archive: ${arch}, unbroken });`), file);
  }
});

test('RVN12b THE PAGE, DRAWN: a living one\'s chips and their effects, what it took, its pips; a sworn one\'s loyalty; a fallen one\'s unbroken escape (mutants: each row dropped)', () => {
  const live = made('slew', { now: 10 });
  Object.assign(live, { learned: ['mailed'], took: [createWeapon(W.Longsword, 1, () => 0.5)], wrath: 1 });
  const sworn = made('fled', { now: 11 });
  N.revenantSpared(me, { revenant: { id: sworn.id } }, { state: 'away' });
  N.revenantById(sworn.id).companion.loyalty = 15;
  const gone = made('fled', { now: 12, unbroken: true });
  Object.assign(gone, { defeated: true, defeatedAt: 13, fate: 'executed' });
  const nodes = draw();
  assert.ok(nodes.some((n) => n.cls === 'rvn-chip' && n.text === 'Mailed' && n.title === 'Mailed - your blades bite less'));
  assert.ok(nodes.some((n) => n.cls === 'rvn-effects' && n.text === 'Mailed - your blades bite less.'));
  assert.ok(nodes.some((n) => n.text?.startsWith('Took: your ')));
  const pips = nodes.find((n) => n.cls === 'rvn-pips');
  assert.ok(pips);
  assert.deepEqual(pips.kids.map((k) => k.cls), ['rvn-pip is-on', 'rvn-pip', 'rvn-pip']);
  assert.ok(nodes.some((n) => n.text === 'Loyalty: 15 - Restless.'), 'the sworn: its loyalty');
  assert.ok(nodes.some((n) => n.tag === 'li' && /^escaped unbroken, /.test(n.text)), 'the fallen: escaped unbroken');
});

test('RVN12b THE CARD\'S EDGES: a last stand blood with an ember rim, a signature iron red, a theft amber, a betrayal black - and every FEUD kind an edge (mutants: an edge lost; the rim)', () => {
  const css = REVENANT_CARD_CSS;
  assert.match(css, /\.rvncard\.is-laststand \{ border-left-color: #8c3a32; box-shadow: inset 0 0 0 1px #e0602a; \}/);
  assert.match(css, /\.rvncard\.is-signature \{ border-left-color: #a8332a; \}/);
  assert.match(css, /\.rvncard\.is-stole \{ border-left-color: #c9822e; \}/);
  assert.match(css, /\.rvncard\.is-betrayed \{ border-left-color: #0b0b0b; \}/);
  for (const k of ['felled', 'festered', 'lair', 'weakness', 'routed', 'unbroken', 'deserted', 'warn']) assert.match(css, new RegExp(`\\.rvncard\\.is-${k}[,\\s][^{]*\\{ border-left-color`), k);
});
