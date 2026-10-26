// AUDIT WORLD-EVENTS (2026-10-25, the owner: "Audit this. Ensure perfection", of EVENT-RULES, BOSS-TRAITS and RAID5;
// bible/01-Overview/audits/Audit-World-Events.md) - THE EVENT RULES' FINDINGS, each pinned where it was found:
// L1-3 the three regenerations that healed whole inside a made level's pause; L1-9 one carried fraction for every body;
// L1-10 the pause off a frame's health, not the hurt door.
import '../modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setCourtRules, courtRulesHurt, _resetCourtRulesForTests, regenShare, regenPausedMs, REGEN_HELD_HURT_MS, REGEN_HELD_SHARE } from '../../src/systems/courtRules.js';
import '../../src/systems/courtRulesDoor.js';   // the door, as the world host wires it
import { hurtPlayer, playerEntity } from '../../src/characters/playerEntity.js';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import * as LR from '../../src/systems/loot/lootRarity.js';
import * as LP from '../../src/systems/loot/lootPowers.js';
import * as AP from '../../src/systems/arcanePaths.js';
import * as POW from '../../src/systems/arcanePowers.js';
import { _resetSetPowersForTests } from '../../src/systems/sigil/sigilSetPowers.js';
import { _resetSigilSetsForTests } from '../../src/systems/sigil/sigilSets.js';
import { setSigilDueling } from '../../src/systems/sigil/sigil.js';
import { setPlayerDoor } from '../../src/systems/playerDoor.js';
import { _resetPlayerHealForTests } from '../../src/systems/playerHeal.js';
import { equipItem } from '../../src/systems/equip.js';
import { mintCondition } from '../../src/systems/item/itemTemplates.js';
import { ARMOR_MATERIAL } from '../../src/systems/armorMaterials.js';
import { createCharacter } from '../../src/systems/chargen.js';
import { buildCustomCareer } from '../../src/systems/customClass.js';
import { masterSkill } from '../../src/systems/masterSkills.js';
import { SKILLS } from '../../src/systems/skills.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const T = 1_000_000;
beforeEach(() => { _resetCourtRulesForTests(); });

// loot5_powers' rig: a Legendary minted through the ladder's own door, worn
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
function legendary(id) {
  const rec = LR.legendaryById(id);
  const base = mintCondition({ group: rec.group, templateIndex: rec.templates?.[0] ?? (rec.group === 'Armor' ? 102 : 135), material: rec.group === 'Armor' ? ARMOR_MATERIAL.Steel : undefined, flags: 0 });
  const it = LR.applyRarity(base, 'legendary', lcg(1), [rec]);
  it.isIdentified = true;
  return it;
}
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const wearer = () => ({ isPlayer: true, items: [], stats: stats(), skills: new Array(35).fill(30), level: 5, career: {}, activeEffects: [], health: 60, maxHealth: 100, magicka: 50, maxMagicka: 100, goldPieces: 0 });
// schools_arcane's rig: a Warden, online, its two schools mastered
const career = buildCustomCareer({ name: 'Mage', hp: 8, stats: { ...stats(), intelligence: 80, willpower: 60 },
  skills: [SKILLS.Destruction, SKILLS.Restoration, SKILLS.Alteration, SKILLS.Mysticism, SKILLS.Illusion, SKILLS.Thaumaturgy, SKILLS.ShortBlade, SKILLS.Archery, SKILLS.Medical, SKILLS.Etiquette, SKILLS.Streetwise, SKILLS.Lockpicking] });
function warden() {
  const p = structuredClone(playerEntity);
  createCharacter(p, career, -1, { rolls: () => 0.5 });
  p._online = true; p.level = 20; p.activeEffects = []; p.magicka = 0; p.maxMagicka = 300;
  for (const s of AP.PATH_BY_ID.warden.schools) { p.skills[s] = 100; assert.equal(masterSkill(p, s).ok, true); p.skills[s] = 100; }
  assert.equal(AP.choosePath(p, 'warden').ok, true);
  return p;
}

test('AUDIT WORLD-EVENTS L1-3: Hist-Sap, the Warden\'s Steadfast and the Firmament\'s hpRegen are natural regenerations - held in a made level as the rest are: nothing inside the pause, half past it; whole outside (mutants: the sap unheld; Steadfast unheld; the sky unheld)', () => {
  _resetForTests(); setPref('lootRarity', true); LP._resetLootPowersForTests(); _resetSetPowersForTests(); _resetSigilSetsForTests(); setPlayerDoor(null);
  const me = wearer();
  const it = legendary('mark-of-the-hist'); me.items.push(it); equipItem(me, it);
  LP.lootRound(me);
  assert.equal(me.health, 61, 'outside: 1% a round, whole');
  setCourtRules(true, T); courtRulesHurt({ before: 70, after: 61 });
  LP.lootRound(me);
  assert.equal(me.health, 61, 'just hurt in a made level: nothing (it healed whole)');
  setCourtRules(true, T + REGEN_HELD_HURT_MS);
  LP.lootRound(me); LP.lootRound(me);
  assert.equal(me.health, 61 + 2 * 1 * REGEN_HELD_SHARE, 'past the pause: half, its fraction carried');
  setCourtRules(false);
  POW._resetArcanePowersForTests(); _resetPlayerHealForTests(); setSigilDueling(false);
  const wa = warden();
  wa.health = 100; wa.maxHealth = 1000;
  wa.activeEffects.push({ kind: 'shield', shieldRemaining: 5, startingShield: 5, roundsRemaining: 5 });
  POW.pathRound(wa);
  assert.equal(wa.health, 110, 'outside: 1% a round while the Shield holds');
  setCourtRules(true, T); courtRulesHurt({ before: 120, after: 110 });
  POW.pathRound(wa);
  assert.equal(wa.health, 110, 'just hurt: nothing');
  setCourtRules(true, T + REGEN_HELD_HURT_MS);
  POW.pathRound(wa);
  assert.equal(wa.health, 115, 'past it: half');
  setCourtRules(false);
  assert.match(rd('src/systems/firmamentPowers.js'), /if \(c\.hpRegen && entity\.health > 0 && entity\.health < entity\.maxHealth\) \{ const held = regenShare\(\(entity\.maxHealth \* c\.hpRegen\) \/ 1000, 'firmament', entity\); if \(held > 0\) healMine\(entity, held\); \}/, 'the sky\'s regeneration: through the same share');
});

test('AUDIT WORLD-EVENTS L1-9: each body carries its own fractions - two foes under one Regenerate each heal on their own rounds, and a foe\'s rounds never spend the player\'s (mutants: one carry for every body)', () => {
  setCourtRules(true, T);
  const a = { isPlayer: false }, b = { isPlayer: false };
  const got = { a: 0, b: 0, me: 0 };
  for (let i = 0; i < 10; i++) { got.a += regenShare(1, 'spell', a); got.b += regenShare(1, 'spell', b); }
  assert.deepEqual([got.a, got.b], [5, 5], 'half each, not 0 and 10');
  for (let i = 0; i < 4; i++) { regenShare(1, 'item', a); got.me += regenShare(1, 'item'); }
  assert.equal(got.me, 2, 'the player\'s +1s: half of four, whatever a foe ticked between them');
  setCourtRules(false);
  assert.equal(regenShare(3, 'spell', a), 3, 'off: whole');
});

test('AUDIT WORLD-EVENTS L1-10: the pause starts at the player\'s hurt door - a blow through hurtPlayer starts it, a maximum that falls with its share kept starts none, and a frame of the mode\'s change reading no level ends no pause (mutants: the door unheard; the pause ended off)', () => {
  const me = { isPlayer: true, health: 80, maxHealth: 100, activeEffects: [], items: [], stats: stats(), skills: new Array(35).fill(30), level: 5, career: {} };
  setCourtRules(true, T);
  assert.equal(regenPausedMs(), 0);
  me.maxHealth = 50; me.health = 40;   // the Spire's Stoneskin let go: the share kept
  setCourtRules(true, T + 10);
  assert.equal(regenPausedMs(), 0, 'no hurt, no pause');
  hurtPlayer(me, 10);
  assert.equal(regenPausedMs(), REGEN_HELD_HURT_MS, 'the door: a hurt');
  setCourtRules(false, T + 1000);   // a frame of the mode's change
  setCourtRules(true, T + 2000);
  assert.equal(regenPausedMs(), REGEN_HELD_HURT_MS - 2000 + 10, 'the pause runs on');
  setCourtRules(false);
  // the door is the client's (systems/courtRulesDoor.js, the world host's import): the account Worker bundles courtRules.js
  assert.match(rd('src/scenes/world.js'), /^import '\.\.\/systems\/courtRulesDoor\.js';/m, 'the world host wires the door');
  assert.doesNotMatch(rd('src/systems/courtRules.js'), /from '\.\.\/characters\/playerEntity\.js'/, 'never the player\'s entity in the Worker\'s bundle');
});
