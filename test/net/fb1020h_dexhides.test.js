// FIELD BUGS 2026-10-20h DEX-HIDES ("the new creatures' hides (bats, wolves and the rest)"): Daggerfall Enemy Expansion's
// animals (#1067, bible/04-Characters/Enemy-Expansion.md) carry ids of their own - its monsters 256-290 - and the knife
// asked its hide of the foe's MobileTypes value alone (net/professionLaw.js hideOfFoe over the ten hides' classic foes),
// so a DEX Bat, Wolf, Boar or Mudcrab felled by the player's own blow was never stamped, never a node, never a Tracker's
// mark - and the account service refused its harvest (`prof-foe`). Every DEX row of Animal affinity gives a hide now: the
// ten's where its family is theirs (the Bat, the Blood Spider, the Mountain Lion, the Land Dreugh), and three hides of
// their own where no family of the ten is theirs (the Wolf Pelt, the Boar Hide, the Mudcrab Chitin, 681-683).
// Every fixture is the real producer's: the mod's rows as the port reads them (dexInstall.js dexRead), the foe stood by
// the street's pool (scenes/exteriorFoes.js spawnFoe) and felled by its damage door, the stamp the world host's kill
// listener makes (scenes/huntHost.js), and the harvest through the real Worker (test/accountDb.mjs).
// bible/01-Overview/bugs/Field-Bugs-2026-10-20h.md DEX-HIDES; bible/06-Systems/Professions-Arc.md 4.4.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { installEnemyExpansion, _resetEnemyExpansion, dexRead } from '../../src/systems/enemyExpansion/dexInstall.js';
import { clearCustomEnemies } from '../../src/characters/enemy/customEnemies.js';
import { _resetMintRowEditors } from '../../src/characters/enemy/enemyEntity.js';
import { _resetExtraQuestRows } from '../../src/systems/quest/tables.js';
import { hideOfFoe, HIDES, HIDE_TEMPLATES, CURE_RECIPES, withdrawable, xpForRank, harvestXp, TIER_RANKS } from '../../src/net/professionLaw.js';
import { PELTS, recipeById } from '../../src/net/recipeLaw.js';
import { producersOf } from '../../src/net/chainLaw.js';
import { marketCatalogue } from '../../src/net/marketLaw.js';
import { HIDE_TEMPLATE_ROWS } from '../../src/systems/professions/profTemplates.js';
import { templateByIndex, inventoryItemImage } from '../../src/systems/item/itemTemplates.js';
import { mintMaterialItem, materialLabel, materialCountLabel } from '../../src/systems/professions/profItems.js';
import { chainPlan } from '../../src/net/chainLaw.js';
import { createBodyStamps, bodiesHere, huntPlan, trackerMarks } from '../../src/scenes/huntHost.js';
import { createExteriorFoes } from '../../src/scenes/exteriorFoes.js';
import { registerPlayerKillListener } from '../../src/systems/playerKills.js';
import { bodyKey } from '../../src/net/nodeLaw.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { standService, T0 } from '../accountDb.mjs';

const silent = () => {};
const quiet = async (fn) => { const w = console.warn, l = console.log, i = console.info, e = console.error; console.warn = () => {}; console.log = () => {}; console.info = () => {}; console.error = () => {}; try { return await fn(); } finally { console.warn = w; console.log = l; console.info = i; console.error = e; } };
const settle = async () => { for (let k = 0; k < 5; k++) await new Promise((r) => setTimeout(r, 0)); };

/** The fifty as the port reads the mod's tables - `[id, name, affinity]`, ascending. */
const dexRows = () => [...dexRead({ log: silent, mudex: false }).enemies].sort((a, b) => a[0] - b[0]).map(([id, e]) => [id, e.props.name, e.row.affinity]);

// ─── THE LAW: every one of the fifty, its hide ───────────────────────────────────────────────────────────────────────

test('DEX-HIDES: every one of the mod\'s fifty its hide by its own row - the ten\'s where its family is theirs, three of their own where none is, and none for a creature that is no animal', () => {
  assert.deepEqual(dexRows().map(([id, name]) => [id, name, hideOfFoe(id)?.key ?? null]), [
    [256, 'Goblin', null], [257, 'Homunculus', null], [258, 'Lizard Man', null], [259, 'Lizard Warrior', null],
    [260, 'Bat', 'hide:bat'], [261, 'Medusa', null], [262, 'Wolf', 'hide:wolf'], [263, 'Snow Wolf', 'hide:wolf'],
    [264, 'Hell Hound', null], [265, 'Grotesque', null], [266, 'Skeletal Soldier', null], [267, 'Dog', 'hide:wolf'],
    [268, 'Nymph', null], [269, 'Minotaur', null], [270, 'Iron Golem', null], [271, 'Blood Spider', 'hide:spider'],
    [272, 'Troll', null], [273, 'Gloom Wraith', null], [274, 'Faded Ghost', null], [275, 'Vengeful King Lysandus', null],
    [276, 'Fire Daemon', null], [277, 'Ghoul', null], [278, 'Boar', 'hide:boar'], [279, 'Land Dreugh', 'hide:dreugh'],
    [280, 'Mountain Lion', 'hide:tiger'], [281, 'Mudcrab', 'hide:mudcrab'], [282, 'Ogre', null], [283, 'Will-o\'-wisp', null],
    [284, 'Ice Golem', null], [285, 'Dremora Churl', null], [286, 'Stone Golem', null], [287, 'Dire Ghoul', null],
    [288, 'Scamp', null], [289, 'Centurion Sphere', null], [290, 'Steam Centurion', null],
    [384, 'Druid', null], [385, 'Guard', null], [386, 'Knight Rider', null], [387, 'Rogue Rider', null],
    [388, 'Necromancer Acolyte', null], [389, 'Rogue Druid', null], [390, 'Bounty Hunter', null], [391, 'Royal Knight', null],
    [392, 'Thief Rider', null], [393, 'Necromancer Glaivier', null], [394, 'Necromancer Assassin', null], [395, 'Dark Slayer', null],
    [396, 'Witch Defender', null], [397, 'Spellsword Rider', null], [398, 'Archer Rider', null],
  ]);
});

test('DEX-HIDES: the rule the classic ten keep - every animal is skinned: the DEX rows that give a hide are exactly the rows of Animal affinity (the Hell Hound a daedra, the Lizard Man and the Troll people), as every classic Animal row gives one', () => {
  const rows = dexRows();
  assert.deepEqual(rows.filter(([id]) => hideOfFoe(id)).map(([id]) => id), rows.filter(([, , a]) => a === 'Animal').map(([id]) => id));
  assert.deepEqual(rows.filter(([, , a]) => a === 'Animal').map(([, n]) => n), ['Bat', 'Wolf', 'Snow Wolf', 'Dog', 'Blood Spider', 'Boar', 'Land Dreugh', 'Mountain Lion', 'Mudcrab']);
});

test('DEX-HIDES: the three new hides - the Wolf Pelt and the Boar Hide tier 2, a Big Tooth one body in four and Raw Meat, cured to Cured Leather and cut to skins; the Mudcrab Chitin tier 1, Raw Meat, cured to Cured Leather - templates 681-683, each a good of the Stores the pack takes', () => {
  const rows = HIDES.slice(10).map((h) => [h.key, h.templateIndex, h.name, h.tier, h.part, h.meat, h.cures]);
  assert.deepEqual(rows, [
    ['hide:wolf', 681, 'Wolf Pelt', 2, 'part:tooth', 'food:meat', 'leather:cured'],
    ['hide:boar', 682, 'Boar Hide', 2, 'part:tooth', 'food:meat', 'leather:cured'],
    ['hide:mudcrab', 683, 'Mudcrab Chitin', 1, null, 'food:meat', 'leather:cured'],
  ]);
  for (const k of ['hide:wolf', 'hide:boar', 'hide:mudcrab']) assert.equal(withdrawable(k), true, k);
  assert.deepEqual(marketCatalogue().filter((m) => /^hide:(wolf|boar|mudcrab)$/.test(m.key)).map((m) => [m.key, m.tier, m.value]).sort(),
    [['hide:boar', 2, 2], ['hide:mudcrab', 1, 1], ['hide:wolf', 2, 2]], 'the market lists each at its tier\'s Marks value');
  assert.deepEqual([681, 682, 683].map((i) => [templateByIndex(i)?.name, templateByIndex(i)?.basePrice, templateByIndex(i)?.baseWeight]),
    [['Wolf Pelt', 16, 1], ['Boar Hide', 16, 1], ['Mudcrab Chitin', 8, 1]]);
  assert.deepEqual(HIDE_TEMPLATE_ROWS.filter((r) => r.index >= 681 && r.index <= 683).map((r) => [r.index, r.stackable, r.rarity]), [[681, true, 10], [682, true, 10], [683, true, 10]]);
  assert.deepEqual(HIDE_TEMPLATES.slice(10, 13).map((m) => m.templateIndex), [681, 682, 683]);
  // withdrawn to the pack as their templates, on the pictures the ten borrow (a pelt Nymph Hair's lock, a chitin Fairy Dragon's Scales')
  assert.deepEqual(['hide:wolf', 'hide:boar', 'hide:mudcrab'].map((k) => { const it = mintMaterialItem(k, false); const pic = inventoryItemImage(it); return [it.group, it.templateIndex, materialLabel(k), pic.archive, pic.record]; }),
    [['UselessItems2', 681, 'Wolf Pelt', 254, 55], ['UselessItems2', 682, 'Boar Hide', 254, 55], ['UselessItems2', 683, 'Mudcrab Chitin', 254, 37]]);
  assert.deepEqual(CURE_RECIPES.filter((r) => /^cure:(wolf|boar|mudcrab)$/.test(r.id)).map((r) => [r.id, r.out, r.inputs.map((i) => `${i.n} ${i.key}`).join(' + ')]),
    [['cure:mudcrab', 'leather:cured', '2 hide:mudcrab'], ['cure:wolf', 'leather:cured', '2 hide:wolf'], ['cure:boar', 'leather:cured', '2 hide:boar']]);
  // a leather's cures stand cheapest first, as a chain plans them - the tier-1 chitin beside the Rat Pelt, the tier-2 furs
  // beside the Bat's and the Bear's
  assert.deepEqual(producersOf('leather:cured').map((r) => r.id), ['cure:rat', 'cure:mudcrab', 'cure:bat', 'cure:wolf', 'cure:boar', 'cure:bear']);   // PIN MOVED (AUDIT FB1021 L2-1): the Ram Kit's Bear Hide last of its tier
  assert.deepEqual([...PELTS], ['hide:rat', 'hide:bat', 'hide:bear', 'hide:tiger', 'hide:wolf', 'hide:boar'], 'a fur\'s hide cuts skins; chitin never');
  assert.deepEqual(['skins-244:wolf', 'skins-245:boar'].map((id) => [recipeById(id)?.name, recipeById(id)?.tier]), [['Large Skins (Wolf Pelt)', 2], ['Small Skins (Boar Hide)', 2]]);
});

// ─── THE CLIENT: the kill stamps the body, the body is a node, the Tracker marks the living ─────────────────────────

function craftCfg() { const b = new Uint8Array(74); const v = new DataView(b.buffer); b[10] = 0x08; v.setUint16(52, 40, true); const at = [40, 50, 50, 85, 50, 50, 90, 55]; for (let k = 0; k < 8; k++) v.setUint16(58 + k * 2, at[k], true); return b; }
function craftMonsterBsa(records) {
  const NAME_FIELD = 14, ENTRY = 18; const dataLen = records.reduce((a, [, b]) => a + b.length, 0);
  const out = new Uint8Array(4 + dataLen + ENTRY * records.length); const v = new DataView(out.buffer);
  v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true); let pos = 4;
  for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; }
  for (const [name, bytes] of records) { for (let k = 0; k < name.length; k++) out[pos + k] = name.charCodeAt(k); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; }
  return out;
}
const bsa = craftMonsterBsa([['ENEMY003.CFG', craftCfg()]]);   // the Giant Bat's career, which the mod's Bat is built on
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const pe = () => ({ level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) });
const pool = () => createExteriorFoes({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
  fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n} in this pin`); },
  getTexture: async () => stubTex, uploadRecordFrame: () => {}, currentMinute: () => 0,
  playerEntity: pe(), audio: null, onPlayerHurt: () => {}, rolls: () => 0.01, rand: () => 0.01,
});
const TODAY = 20_833, DAY_MS = 86_400_000;
const NOW = TODAY * DAY_MS + 3_600_000;

test('DEX-HIDES: the mod\'s Wolf, Bat and Mudcrab stood by the street\'s pool and felled by the player\'s own blow are stamped at the kill and lie as bodies, each its hide and tier; the knife\'s plan names the foe and its rank; the Tracker marks a living Boar', async (t) => {
  t.after(() => { _resetEnemyExpansion(); clearCustomEnemies(); _resetMintRowEditors(); _resetExtraQuestRows(); registerPlayerKillListener('dexhides', null); });
  installEnemyExpansion({ on: true, meaner: false, log: silent });
  const stamps = createBodyStamps({ nowMs: () => NOW });
  registerPlayerKillListener('dexhides', (e) => { stamps.stamp(e); });
  const street = pool();
  const fell = async (id, at) => {
    const f = await quiet(() => street.spawnFoe(id, at, { yaw: 0, feetGiven: true }));
    assert.ok(f, `the pool stood ${id}`);
    assert.equal(f.entity.mobileType, id, 'the entity carries the mod\'s own id');
    await quiet(() => street.damageFoe(f, 10_000, [0, 0, 0], null, { fromPlayer: true, kind: 'melee' }));
    assert.equal(f.dead, true, 'felled');
    return f;
  };
  await fell(262, [3, 0, 4]);
  await fell(260, [5, 0, 1]);
  await fell(281, [6, 0, 2]);
  await settle();
  const here = bodiesHere('exterior', { street }, stamps);
  assert.deepEqual(here.map((b) => [b.foe, b.hide, b.tier]), [[262, 'hide:wolf', 2], [260, 'hide:bat', 2], [281, 'hide:mudcrab', 1]], 'three bodies, each its hide');
  const plan = (body, rank) => huntPlan({ body, taken: false, counting: false, rank, storesFull: () => false, high: 0 });
  assert.deepEqual([plan(here[0], 0), plan(here[0], 10)].map((p) => [p.verb, p.rest, p.ready]),
    [['Skin the Wolf', `needs Hunting ${TIER_RANKS[1]}`, false], ['Skin the Wolf', 'Hunting 10', true]]);
  assert.deepEqual([plan(here[2], 0)].map((p) => [p.verb, p.ready]), [['Skin the Mudcrab', true]], 'a tier-1 chitin, open to a Novice');
  const boar = await quiet(() => street.spawnFoe(278, [10, 0, 0], { yaw: 0, feetGiven: true }));
  assert.deepEqual(trackerMarks([boar], [0, 0, 0]), [[boar.ai.feet[0], boar.ai.feet[2]]], 'a living Boar within the Tracker\'s reach is marked');
});

// ─── THE SERVICE: the harvest the knife asks ─────────────────────────────────────────────────────────────────────────

const DAY = 86_400;
let _rid = 0, _body = 0;
const realNow = Date.now;
test.after(() => { Date.now = realNow; });
const realRandom = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
async function steered(b, fn) {
  globalThis.crypto.getRandomValues = (arr) => (arr.byteLength === 4 ? (new Uint8Array(arr.buffer, arr.byteOffset, 4).fill(b), arr) : realRandom(arr));
  try { return await fn(); } finally { globalThis.crypto.getRandomValues = realRandom; }
}

test('DEX-HIDES: the account service skins the mod\'s animals - a Wolf\'s Wolf Pelt with its Big Tooth and Raw Meat, a Bat\'s Bat Leather, a Land Dreugh\'s Dreugh Shell counted among the day\'s rare hides - and refuses a Hell Hound\'s body as it refuses any no knife skins', async () => {
  const now = utcDay(T0) * DAY + 12 * 3600;
  Date.now = () => now * 1000;
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on', DEVELOPER_HANDLES: 'Mac' });
  const raw = s.env.DB._raw;
  const mac = await s.seated('Mac');
  raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, spec100, updated_at) VALUES (?, ?, 'hunting', ?, NULL, NULL, ?)`).run(mac.id, mac.character, xpForRank(55), now);
  const skin = (foe) => ({ character: mac.character, node: bodyKey({ day: utcDay(now), id: (++_body).toString(16).padStart(12, '0') }), kind: 'hide', foe, act: { clean: false, torn: false }, at: now - 2, rid: `dexh-${String(++_rid).padStart(6, '0')}` });
  const wolf = await steered(0, () => s.call('/v1/prof/harvest', skin(262), mac.secret));
  assert.equal(wolf.status, 200, JSON.stringify(wolf.body));
  assert.deepEqual([wolf.body.material, wolf.body.qty, wolf.body.xp, wolf.body.gem, wolf.body.extra, wolf.body.extraQty], ['hide:wolf', 1, harvestXp(2, 55, false), 'part:tooth', 'food:meat', 1]);
  const bat = await s.call('/v1/prof/harvest', skin(260), mac.secret);
  assert.deepEqual([bat.status, bat.body.material, bat.body.extra], [200, 'hide:bat', 'food:meat']);
  const dreugh = await s.call('/v1/prof/harvest', skin(279), mac.secret);
  assert.deepEqual([dreugh.status, dreugh.body.material, dreugh.body.hunt], [200, 'hide:dreugh', { hides: 3, high: 1 }], 'a tier-5 shell, one of the day\'s three rare');
  assert.deepEqual((await s.call('/v1/prof/harvest', skin(264), mac.secret)).body, { error: 'prof-foe' }, 'a Hell Hound is a daedra');
});

// AUDIT FB1021 (bible/01-Overview/audits/Audit-Field-Bugs-2026-10-21.md), carried onto this slice at the merge: the
// branch for 2026-10-21 had built DEX-HIDES too, and its audit's two findings that held here.
test('AUDIT FB1021 L2-1 THE RAM KIT\'S HIDE SPENT LAST: a chain for Cured Leather with Bear Hides, Wolf Pelts and Boar Hides held cures the Wolf\'s first and keeps the Bear Hide, the Ram Kit\'s too, to the last of its tier; the Stores count Mudcrab Chitin as a mass, as the Scorpion\'s (mutants: the Bear Hide in the table\'s place; the chitin counted)', () => {
  const held = new Map([['hide:bear', 8], ['hide:wolf', 8], ['hide:boar', 8]]);
  const p = chainPlan([{ key: 'leather:cured', n: 4 }], (k) => held.get(k) ?? 0, {});
  assert.deepEqual([p.works, p.spent], [[{ id: 'cure:wolf', count: 4 }], [{ key: 'hide:wolf', n: 8 }]], 'it was every Bear Hide');
  assert.deepEqual([materialCountLabel('hide:mudcrab', 3, false), materialCountLabel('hide:scorpion', 3, false), materialCountLabel('hide:wolf', 3, false)], ['Mudcrab Chitin', 'Scorpion Chitin', 'Wolf Pelts']);
});
