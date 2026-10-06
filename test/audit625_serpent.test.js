// AUDIT 625 (2026-10-05, Mac: "Lets do a comprehensive audit on this"), the SERPENT lens: PR #625's SERPENT-SET, audited
// - Sethrakul's Coilscale's powers, the duel's word, and the serpent's claim. bible/01-Overview/Audit-625.md.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  setBlow, setStrike, setStruck, setPowerStates, setSetPowersVoice, coilStacks, coilStacksAt, coiledFoe,
  _setSetPowersClockForTests, _resetSetPowersForTests,
} from '../src/systems/sigilSetPowers.js';
import { setSigilOnline, setSigilRenown, setSigilDueling, sigilDueling, sigilBlow, _resetSigilForTests } from '../src/systems/sigil.js';
import { COIL_STACKS, setsDueling, setSetsDueling, setsSleep, _resetSigilSetsForTests } from '../src/systems/sigilSets.js';
import { _resetPlayerHealForTests } from '../src/systems/playerHeal.js';
import { hurtPlayer, registerPlayerDeathSave, registerPlayerHurtListener } from '../src/characters/playerEntity.js';
import { reportPlayerKill } from '../src/systems/playerKills.js';
import { setPlayerDoor } from '../src/systems/playerDoor.js';
import { equipItem } from '../src/systems/equip.js';
import { mintCondition } from '../src/systems/itemTemplates.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { bossStandIn } from '../src/world/gateBoss.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const player = () => ({
  isPlayer: true, items: [], stats: stats(), skills: new Array(35).fill(30), level: 5, career: {}, activeEffects: [],
  health: 100, maxHealth: 100, magicka: 0, maxMagicka: 1000, armorValues: new Array(7).fill(100),
});
const BODY = [107, 106, 105, 102, 103, 104, 108];
const piece = (templateIndex, set) => {
  const it = mintCondition({ group: 'Armor', templateIndex, material: ARMOR_MATERIAL.Steel, flags: 0 });
  it.rarity = 'rare';
  it.sigil = { set, party: 1, xp: 0 };
  return it;
};
const wearSet = (e, set, n) => { for (const t of BODY.slice(0, n)) { const it = piece(t, set); e.items.push(it); equipItem(e, it); } return e; };
const sword = () => createWeapon(120, 0, () => 0.5);
const RAT = { name: 'rat', health: 10 };
const WOLF = { name: 'wolf', health: 10 };
let T = 0;
_setSetPowersClockForTests(() => T);
function fresh() {
  _resetSigilForTests(); _resetSigilSetsForTests(); _resetSetPowersForTests(); _resetPlayerHealForTests(); setPlayerDoor(null); T = 0;
  const v = { said: [] };
  setSetPowersVoice({ say: (l) => v.said.push(l), sound: () => {} });
  setSigilOnline(true); setSigilRenown(1);
  return v;
}
const blow = (e, n, attacker = RAT) => { setStruck(attacker, e, n); return hurtPlayer(e, n); };
const swing = (e, weapon, target, n = 100) => { const d = setBlow(weapon, n, e, target, {}); setStrike(e, target, d, weapon); return d; };

// ─── P1: A DEATH TURNED ASIDE IS NO SHED ─────────────────────────────

test('AUDIT 625 P1: Shed Skin sheds nothing on a killing blow a death save turned aside (Unbroken, Divine Grace: the door leaves me at 1) - it was a killing blow, the save was the save; the door says so to every hurt listener (`saved`), and a blow that only takes me under the line still sheds (mutants: the save unsaid at the door; Shed Skin deaf to it)', () => {
  const v = fresh();
  const e = wearSet(player(), 'coilscale', 6);
  setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], hurtFoe() {}, castOnPlayer() {}, player: () => e });
  const heard = [];
  registerPlayerHurtListener('audit625-p1', (_e, h) => heard.push(h));
  registerPlayerDeathSave('audit625-p1', () => true);
  try {
    T = 10;
    e.health = 40;
    blow(e, 60);
    assert.equal(e.health, 1, 'the save stood me at 1');
    assert.deepEqual(heard.at(-1), { dmg: 39, before: 40, after: 1, saved: true }, 'the door says it was a death turned aside');
    assert.deepEqual(v.said.filter((l) => l.startsWith('Shed Skin!')), [], 'no shed on top of the save');
    assert.equal(setPowerStates(10).shedRecoverLeft, 0, 'and no recovery spent');
    // a blow that takes me under the line, standing: sheds, as ever - and is no saved one
    e.health = 100;
    blow(e, 70);
    assert.deepEqual(heard.at(-1), { dmg: 70, before: 100, after: 30 });
    assert.deepEqual(v.said.filter((l) => l.startsWith('Shed Skin!')), ['Shed Skin! 10 health returns.']);
  } finally { registerPlayerHurtListener('audit625-p1', null); registerPlayerDeathSave('audit625-p1', null); }
});

// ─── P2: A BOUT BETWEEN PLAYERS IS A DUEL ────────────────────────────

test('AUDIT 625 P2: the duel\'s word is ONE, kept by SIGIL1\'s door (sigil.js setSigilDueling) - the sets and the loot\'s powers sleep on it (sigilSets.js setsDueling), and the weapon\'s own sigil reads it too, so an arena bout between players (whose opponent is a Daedra Lord\'s stand-in, no player) wakes none of them; the host raises it for a duel and for a live bout between players (mutants: the bout unread; the sigil deaf to the word; the word kept twice)', () => {
  fresh();
  const e = wearSet(player(), 'coilscale', 4);
  setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], hurtFoe() {}, castOnPlayer() {}, player: () => e });
  const rival = bossStandIn({ mobile: 0 }, 'Your opponent');
  assert.ok(!rival.isPlayer, 'the stand-in is no player - the gates that refuse a player never saw one');
  swing(e, sword(), rival); swing(e, sword(), rival);
  assert.equal(coilStacksAt(rival), 2, 'awake: Constrict coiled the stand-in');
  setSetsDueling(true);
  assert.equal(sigilDueling(), true, 'one word: the sets\' setter is the sigil door\'s');
  assert.equal(setsDueling(), true);
  assert.equal(setsSleep(), 'duel');
  assert.equal(swing(e, sword(), rival), 100, 'asleep: no coil\'s per cent');
  setSigilDueling(false);
  assert.equal(setsDueling(), false);
  // the weapon's sigil: a Faint Magic blade in a Renown 1 hand bites a stand-in - and not under the duel's word
  const blade = { group: 'Weapons', templateIndex: 120, material: 0, rarity: 'magic', affixes: [], sigil: { power: 5, party: 1, xp: 0 } };
  const me = { isPlayer: true };
  const awake = Array.from({ length: 50 }, () => sigilBlow(blade, 100, me, rival)).reduce((a, b) => a + b, 0);
  assert.ok(awake > 5000, 'awake: the sigil adds its per cent');
  setSigilDueling(true);
  assert.equal(sigilBlow(blade, 100, me, rival), 100, 'the duel\'s word: nothing');
  setSigilDueling(false);
  // the loot's powers read the same word (lootPowers.js wornPowers - LOOT4's own law: asleep in a duel)
  assert.match(read('src/systems/lootPowers.js'), /if \(!mine\(entity\) \|\| !lootRarityOn\(\) \|\| setsDueling\(\)\) return \[\];/);
  // the host: the duel, or a live bout between players
  const w = read('src/scenes/world.js');
  assert.match(w, /setSetsDueling\(!!duelMgr\.live \|\| arenaPvpLive\(\)\);/);
  assert.match(w, /const arenaPvpLive = \(\) => \{ const b = arenaOnline\?\.bout\(\), r = arenaBouts\.relay\(\); return !!b && b\.kind === 'pvp' && !!r\?\.me; \};/);
  assert.doesNotMatch(read('src/systems/sigilSets.js'), /let _dueling/, 'the word is kept once');
});

// ─── P3: A COIL PER FOE ──────────────────────────────────────────────

test('AUDIT 625 P3 (Mac: "A coil per foe"): every foe holds its own Constrict coil - a sweep that meets two foes in turn builds both, where one coil moved from foe to foe and never built; each its own window and its own end at its death (mutants: one coil again; a death ends every coil; a body\'s coil read)', () => {
  fresh();
  const e = wearSet(player(), 'coilscale', 4);
  setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], hurtFoe() {}, castOnPlayer() {}, player: () => e });
  const s = sword();
  T = 10;
  const sweep = [];
  for (let i = 0; i < 6; i++) { sweep.push(swing(e, s, RAT)); sweep.push(swing(e, s, WOLF)); }
  assert.deepEqual(sweep, [100, 100, 103, 103, 106, 106, 109, 109, 112, 112, 115, 115], 'both built, to the cap');
  assert.deepEqual([coilStacksAt(RAT), coilStacksAt(WOLF)], [COIL_STACKS, COIL_STACKS]);
  assert.equal(coiledFoe(), WOLF, 'the states say the foe struck last');
  reportPlayerKill(RAT);
  assert.deepEqual([coilStacksAt(RAT), coilStacksAt(WOLF)], [0, COIL_STACKS], 'a death ends its own coil alone');
  T = 10.5;
  swing(e, s, WOLF);
  T = 15;
  assert.equal(coilStacksAt(WOLF), COIL_STACKS, 'the wolf\'s window from its own last blow');
  assert.equal(coilStacks(), COIL_STACKS);
  // a foe a peer killed: a body - its coil reads none, and the states say none (the mark's own law: a peer's kill
  // reaches no setKill of mine, so no death ended it)
  const bear = { name: 'bear', health: 10 };
  swing(e, s, bear); swing(e, s, bear);
  assert.equal(coilStacksAt(bear), 2);
  bear.health = 0;
  assert.equal(coilStacksAt(bear), 0, 'a body holds no coil');
  assert.equal(coiledFoe(), null, 'nor do the states say one');
  assert.equal(coilStacksAt(WOLF), COIL_STACKS, 'and the wolf keeps its own');
});

// ─── P4, P5: THE CLAIM'S EMBERS, AND THE SHAPE THE PRODUCER MINTS ────

test('AUDIT 625 P4 (the client\'s half): the serpent\'s claim says the embers this build\'s hoard mints - SERPENT_EMBERS, the very stack serpentEmbers mints - so the row counts what the pack was given (the service\'s half: test/serpentset_service.test.js AUDIT 625 P4) (mutants: the claim silent)', async () => {
  const { claimSerpentReceipt } = await import('../src/net/accountClient.js');
  const { SERPENT_EMBERS } = await import('../src/net/serpentHoardLaw.js');
  const { serpentEmbers } = await import('../src/systems/serpentSpoils.js');
  const sent = [];
  const io = { fetch: async (url, init) => { sent.push([url, JSON.parse(init.body)]); return new Response('{"recorded":true}', { status: 200, headers: { 'content-type': 'application/json' } }); }, base: 'https://acct.invalid', secret: 's' };
  await claimSerpentReceipt(io, 'R', 'char-1', 'Ann', 'a'.repeat(16));
  assert.deepEqual(sent[0][1], { receipt: 'R', character: 'char-1', name: 'Ann', cid: 'a'.repeat(16), stones: SERPENT_EMBERS });
  assert.equal(serpentEmbers().stackCount, SERPENT_EMBERS, 'what the hoard mints, the claim says');
});

test('AUDIT 625 P5: the Coilscale\'s powers driven by the pieces its PRODUCER mints (aetheric.js mintAetheric - Aetheric Ebony, the set\'s own records), not a hand-made Rare: Sea-Scale, Constrict and Shed Skin wake on the nine, and Constrict bites (mutants: a tier unread on the minted shape)', async () => {
  const { SERPENT_SET_PIECES, mintAetheric } = await import('../src/systems/aetheric.js');
  const { awakeTiersOf } = await import('../src/systems/sigilSetPowers.js');
  fresh();
  const e = player();
  for (const r of SERPENT_SET_PIECES) { const it = mintAetheric(r); e.items.push(it); equipItem(e, it); }
  setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], hurtFoe() {}, castOnPlayer() {}, player: () => e });
  assert.deepEqual(awakeTiersOf(e).get('coilscale').map((t) => t !== null), [true, true, true]);
  const fang = e.items.find((it) => it.group === 'Weapons');
  T = 10;
  const first = swing(e, fang, RAT), second = swing(e, fang, RAT);
  assert.ok(second > first, `the second blow bites deeper (${first} then ${second})`);
  const v = fresh();   // the powers' memory anew, the minted nine still worn
  setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], hurtFoe() {}, castOnPlayer() {}, player: () => e });
  e.health = 100;
  T = 20;
  blow(e, 70);
  assert.ok(v.said.some((l) => l.startsWith('Shed Skin!')), 'Shed Skin on the minted nine');
});

// ─── D2: THE SERPENT'S WORDS AND ITS EMBERS' GLOW ────────────────────

test('AUDIT 625 D2: a serpent\'s silver is carded under its own source - "Serpent slain", never a breach\'s - and its hoard\'s embers wear the GATE\'s glow tier (scenes/spoilsPool.js SIGIL_TIER), the one the breach\'s ember wears (mutants: the source a breach\'s; the embers another tier)', async () => {
  const { claimHauls, CLAIM_SOURCE } = await import('../src/ui/haulCards.js');
  const { serpentSpoilsList } = await import('../src/systems/serpentSpoils.js');
  const { SIGIL_TIER } = await import('../src/scenes/spoilsPool.js');
  const { SERPENT_EMBERS } = await import('../src/net/serpentHoardLaw.js');
  assert.equal(CLAIM_SOURCE.serpent, 'Serpent slain');
  const [card] = claimHauls({ marks: { struck: 40, balance: 40, combat: { earned: 40, max: 150 } } }, 'serpent');
  assert.deepEqual([card.source, card.count, card.earned], ['Serpent slain', 40, 40]);
  assert.notEqual(card.source, CLAIM_SOURCE.gate);
  const list = serpentSpoilsList(7, 20, 'dealt');
  const embers = list.find((e) => e.kind === 'item' && e.item?.stackCount === SERPENT_EMBERS && /Ember/.test(e.item?.name ?? ''));
  assert.ok(embers, 'the hoard carries its embers');
  assert.equal(embers.tier, SIGIL_TIER, 'the gate\'s own glow');
  assert.equal(SIGIL_TIER, 'artifact');
});
