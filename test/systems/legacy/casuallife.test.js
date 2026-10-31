// CASUAL-LIFE (2026-10-28, asked: "they need to be able to pick a casual, no death, no lineage character creation";
// "casual needs to replace lineage's wording"): online no lineage is Casual - no house, and a death that takes no gold
// and no piece to a revenant. The Wild's own law (a player's kill takes the zone's share) still stands.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};

const { isCasual } = await import('../../../src/systems/legacy/casual.js');
const { NO_LINEAGE, MODELS } = await import('../../../src/systems/legacy/family.js');
const { legacyModelOptions, legacyModelScreen, LEGACY_MODEL_TAGS } = await import('../../../src/ui/legacy/legacyModelChoice.js');
const { stackedTops } = await import('../../../src/ui/levelingChoice.js');
const CASUAL = NO_LINEAGE;
const { applyDeathPenalty, statedDeathLoss, stateDeathLoss } = await import('../../../src/systems/deathPenalty.js');
const { DeathScreen } = await import('../../../src/ui/deathScreen.js');
const { noFamilyLine } = await import('../../../src/ui/familyPages.js');
const { snapshotPlayer, restorePlayer } = await import('../../../src/systems/save/save.js');
const N = await import('../../../src/systems/revenant/revenant.js');
const { setPref, _resetForTests } = await import('../../../src/systems/uiPrefs.js');
const { setWorldMinutes } = await import('../../../src/systems/worldTick.js');
const { MOBILE_TYPES: M } = await import('../../../src/characters/mobile/mobileTypes.js');
const { createWeapon } = await import('../../../src/combat/enemyEquipment.js');
const { WEAPONS: W } = await import('../../../src/characters/weapons.js');

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const ent = (cid, over = {}) => ({
  name: 'Example Player', gender: 'female', race: 'DarkElf', faceIndex: 3, careerIndex: 5, career: { name: 'Nightblade', primarySkills: [28], majorSkills: [], minorSkills: [] },
  level: 1, characterId: cid, chargenDone: true, health: 40, maxHealth: 40, items: [], wagonItems: [],
  stats: { strength: 60, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
  skills: Array.from({ length: 35 }, (_, i) => (i === 28 ? 80 : 20)), ...over,
});

function withPage(search, fn) {
  const had = globalThis.location;
  globalThis.location = { search };
  try { fn(); } finally { globalThis.location = had; }
}

test('CASUAL-LIFE the answer: online no lineage is Casual, says what it does, and fits the classic face; offline the two as ever', () => {
  const on = legacyModelOptions({ online: true, tollShare: 0.06 });
  assert.deepEqual(on.map((o) => o.id), [NO_LINEAGE, MODELS.enduring, MODELS.bloodline]);   // PIN MOVED (CASUAL-FIRST)
  assert.equal(on[0].title, 'Casual');
  assert.match(on[0].lines.join(' '), /no permadeath.*A death costs no gold, no years and no gear\./);
  assert.equal(LEGACY_MODEL_TAGS[CASUAL], 'No death cost');
  assert.deepEqual(legacyModelOptions({ online: false, tollShare: 0.06 }).map((o) => o.id), [MODELS.enduring, MODELS.bloodline]);
  const tops = stackedTops(on);
  assert.ok(tops[on.length] + 10 <= 200, `the three and the footer fit the classic face: ${tops[on.length]}`);
  for (const o of on) for (const line of o.lines) assert.ok(line.length <= 50, line);
  withPage('?online', () => {
    const got = [];
    legacyModelScreen((m) => got.push(m)).input('Digit1');   // PIN MOVED (CASUAL-FIRST)
    assert.deepEqual(got, [CASUAL]);
  });
});

test('CASUAL-LIFE kept on the character and its save; the Family tab names it', () => {
  assert.match(read('src/systems/chargenSession.js'), /if \(isLegacyChoice\(result\.legacyModel\)\) playerEntity\.legacyChoice = result\.legacyModel;/, 'the chargen door keeps any answer the question takes');
  assert.ok(isCasual({ legacyChoice: CASUAL }) && !isCasual({ legacyChoice: MODELS.enduring }) && !isCasual(null));
  const saved = ent('c-casual', { legacyChoice: CASUAL });
  const back = ent('c-casual');
  restorePlayer(back, JSON.parse(JSON.stringify(snapshotPlayer(saved))));
  assert.equal(back.legacyChoice, CASUAL);
  assert.match(noFamilyLine({ on: () => true, choice: () => CASUAL, online: () => true }), /plays Casual, with no family line/);
});

test('CASUAL-LIFE a Casual death takes no gold - the respawn and the death screen both - and spends the stated loss', () => {
  const casual = { goldPieces: 400, legacyChoice: CASUAL, items: [] };
  stateDeathLoss(40);
  assert.equal(applyDeathPenalty(casual), 0);
  assert.equal(casual.goldPieces, 400);
  assert.equal(statedDeathLoss(), null, 'spent all the same');
  const other = { goldPieces: 400, legacyChoice: MODELS.enduring, items: [] };
  assert.equal(applyDeathPenalty(other), 40, 'an Enduring house still pays its tenth');
  withPage('?online', () => {
    const shown = new DeathScreen({ eyeHeight: 1.6, capsuleHeight: 1.8, entity: { goldPieces: 400, legacyChoice: CASUAL, items: [] }, online: true });
    assert.equal(shown.goldLoss, 0);
    assert.equal(shown.goldLossLine, '');
    const paid = new DeathScreen({ eyeHeight: 1.6, capsuleHeight: 1.8, entity: { goldPieces: 400, items: [] }, online: true });
    assert.equal(paid.goldLoss, 40);
    stateDeathLoss(null);
  });
});

test('CASUAL-LIFE a revenant that kills a Casual character takes no piece, and the kill is still forgotten', () => {
  _resetForTests(); setPref('lootRarity', true); N._resetRevenantForTests(); _store.clear();
  setWorldMinutes(14400);
  const me = { isPlayer: true, name: 'Example Player', characterId: 'char-casual', level: 8, health: 100, maxHealth: 100, items: [], stats: {}, skills: [], career: {}, activeEffects: [] };
  const orc = { mobileType: M.Orc, level: 6, champion: 'mighty', unquiet: true, health: 5, maxHealth: 50, team: 'Monster' };
  const sword = createWeapon(W.Longsword, 1, () => 0.5); sword.value = 500;
  N.revenantDeed(me, orc, 'slew', { mobileType: M.Orc, rolls: () => 0 });
  me.items = [sword]; me.legacyChoice = CASUAL;
  assert.equal(N.revenantTakes(me, { online: true }), null);
  assert.ok(me.items.includes(sword));
  delete me.legacyChoice;
  assert.equal(N.revenantTakes(me, { online: true }), null, 'the kill was spent: a later death names none');
  const r = N.revenantDeed(me, orc, 'slew', { mobileType: M.Orc, rolls: () => 0 });
  assert.ok(r);
  assert.ok(N.revenantTakes(me, { online: true })?.item, 'any other character still loses its piece');
});
