// L10N3e (2026-09-27): THE NAMES OF BEINGS, IN THE PLAYER'S LANGUAGE - the beings batch. DFU names an enemy through
// GetLocalizedEnemyName (the enemyNames list: row = its MobileTypes id, a class at 43 + id - 128) and a faction
// through GetLocalizedFactionName (Internal_Factions, by its FACTION.TXT id) - and only where the name is SHOWN.
// Pinned here through the port's own functions: the three enemy lines ("You see a/an %s", whose vowel test reads the
// name the player sees; "%s just died."; the pacification line's %e), a body's name on the corpse plaque and on the
// loot tab in both above-ground pools, the affiliations book both sheets draw, the greeting's four faction names, a
// faction's lord (%fl1/%fl2/%ol1), %dae, and a named NPC's shown name. English is byte for byte what each showed
// before, with no language chosen and with English chosen again; and every key path - the canonical enemy name, the
// career-name lookup, the faction records, the talk partner's name, the prince table - still reads the canonical name.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as tm from '../src/systems/textManager.js';
import { _resetForTests as resetSettings } from '../src/systems/settings.js';
import { ENEMY_NAMES, ENEMY_BASICS, enemyDisplayName } from '../src/characters/enemyBasics.js';
import { activateMobileEnemy } from '../src/player/mobileEnemyActivate.js';
import { sayEnemyDied } from '../src/scenes/corpseMarker.js';
import { tryLanguagePacification } from '../src/scenes/hostCombat.js';
import { enemyLanguageSkill, calculateEnemyPacification } from '../src/combat/formulas.js';
import { SKILLS, SKILL_NAMES } from '../src/systems/skills.js';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { createCityGuards, GUARD_MOBILE_TYPE } from '../src/scenes/cityGuards.js';
import { classMobileType } from '../src/net/remotePlayers.js';
import { affiliations } from '../src/systems/affiliations.js';
import { affiliationRows } from '../src/ui/charsheet.js';
import { GUILDS } from '../src/systems/guilds.js';
import { NPCSession } from '../src/systems/npcSession.js';
import { lordNameForFaction } from '../src/systems/talk.js';
import { summonMacroValues, DAEDRA } from '../src/systems/daedraSummoning.js';
import { staticNpcName, staticNpcShownName } from '../src/characters/staticNpc.js';

beforeEach(() => { tm._resetTextManagerForTests(); resetSettings(); });

/** A made-up French enemyNames list: 62 rows (43 monsters, 19 classes), `over` by MobileTypes id. */
function enemyNames(over = {}) {
  const rows = Array.from({ length: ENEMY_NAMES.length }, (_, i) => `Créature ${i}`);
  for (const [id, name] of Object.entries(over)) rows[Number(id) < 128 ? Number(id) : 43 + Number(id) - 128] = name;
  return rows.join('\n');
}
const fr = (rows, table = 'Internal_Strings') => { tm.patchLocaleTable('fr', table, rows); tm.setLocale('fr'); };
const settle = () => new Promise((r) => setTimeout(r, 0));

test('L10N3e beings: "You see a/an %s" names the foe by GetLocalizedEnemyName (PlayerActivate.cs:811) - and the vowel test (:812) reads the first letter of the name the player sees', () => {
  const seen = [];
  const look = (mobileType) => activateMobileEnemy({ mobileType, entity: {}, dead: false }, 1, 'info', {}, { hud: (l) => seen.push(l) });
  const LOOKS = [7, 0, 128, 9999];   // Orc, Rat, Mage (a class), and a type no list names
  for (const id of LOOKS) assert.equal(look(id), true, 'the activation is consumed either way');
  assert.deepEqual(seen, ['You see an Orc.', 'You see a Rat.', 'You see a Mage.'], 'English: the port\'s own names; no name, no line');
  seen.length = 0;
  fr([['enemyNames', enemyNames({ 7: 'Brute des collines', 0: 'Ombre des caves', 128: 'Arcaniste' })],
    ['youSeeA', 'Vous voyez (a) %s.'], ['youSeeAn', 'Vous voyez (an) %s.']]);
  for (const id of LOOKS) look(id);
  assert.deepEqual(seen, ['Vous voyez (a) Brute des collines.', 'Vous voyez (an) Ombre des caves.', 'Vous voyez (an) Arcaniste.'],
    'each name the list\'s row (a class at 43 + id - 128), and the a/an row picked by ITS first letter');
  seen.length = 0;
  tm.setLocale('en');
  for (const id of LOOKS) look(id);
  assert.deepEqual(seen, ['You see an Orc.', 'You see a Rat.', 'You see a Mage.']);
});

test('L10N3e beings: "%s just died." (EnemyDeath.cs:81) and the pacification line\'s %e (EnemySenses.cs:519) name the enemy in the player\'s language', () => {
  const said = [];
  const say = (l) => said.push(l);
  const player = () => ({ isPlayer: true, level: 1, skills: new Array(35).fill(80), skillUses: new Array(35).fill(0), stats: { personality: 80 }, fatigue: 1000 });
  const pacify = () => tryLanguagePacification({ justEncountered: true, isHostile: true }, { isClass: false, careerIndex: 7 }, 7, player(), {
    enemyLanguageSkill, calculateEnemyPacification: (pl, lang, sheathed) => calculateEnemyPacification(pl, lang, sheathed, 0), sheathed: true, say,
  });
  const english = () => {
    said.length = 0;
    assert.equal(sayEnemyDied(say, 18), 'Ghost just died.');
    assert.equal(sayEnemyDied(say, 146), 'City Watch just died.');
    assert.equal(pacify()?.pacified, true);
    assert.deepEqual(said, ['Ghost just died.', 'City Watch just died.', `Orc is pacified by your ${SKILL_NAMES[SKILLS.Orcish]} skill.`]);
  };
  english();
  fr([['enemyNames', enemyNames({ 18: 'Esprit errant', 146: 'Veilleur de la cité', 7: 'Brute des collines' })], ['thingJustDied', 'Fin de %s.']]);
  said.length = 0;
  assert.equal(sayEnemyDied(say, 18), 'Fin de Esprit errant.');
  assert.equal(sayEnemyDied(say, 146), 'Fin de Veilleur de la cité.', 'a class: row 43 + 146 - 128');
  assert.equal(sayEnemyDied(say, 9999), null, 'a type no list names says nothing in any language');
  assert.equal(pacify()?.pacified, true);
  assert.equal(said.at(-1), `Brute des collines is pacified by your ${SKILL_NAMES[SKILLS.Orcish]} skill.`,
    'the name is the list\'s; the sentence is still the port\'s own (L10N3d\'s recorded difference)');
  tm.setLocale('en');
  english();
});

/** A pool foe stood by hand (audit26_dungeonfoes' F212 shape): a record with an ai, a texture and an entity is all
 *  the kill and the corpse read. */
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
let _standId = 0;
const standFoe = (mobileType) => ({
  id: _standId++, mobileType, gender: 'male', dead: false,
  entity: { health: 10, maxHealth: 10, items: [{ name: 'Gold', group: 'Currency', stackCount: 5 }], activeEffects: [] },
  ai: { feet: [5, 0, 5], isHostile: true, detected: false, height: 1.8 },
  tex: stubTex, archive: ENEMY_BASICS[mobileType].maleTexture, batch: {}, _mout: null,
});
const poolDeps = (said) => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => 0.5, heightAt: () => 0 },
  fetchBytes: async () => { throw new Error('no ARENA2 in this pin'); },
  getTexture: async () => stubTex, uploadRecordFrame: () => {},
  currentMinute: () => 1000, currentPixelKey: () => '3,4',
  playerEntity: { level: 1, reflexes: 2, skills: 30, items: [], stats: { strength: 50, agility: 50, luck: 50 } },
  audio: null, onPlayerHurt: () => {}, rand: () => 0.5, rolls: () => 0.5, say: (l) => said.push(l),
});

test('L10N3e beings: a body is named in the player\'s language - the kill notice, the corpse plaque (World Tooltips .cs:526 over GameObjectHelper.cs:701\'s GetLocalizedEnemyName) and the loot tab, in the encounter pool and the watch; read where shown, so a body killed in English reads in French once French is chosen', async () => {
  const said = [];
  const foes = createExteriorFoes(poolDeps(said));
  const guards = createCityGuards(poolDeps(said));
  const killRat = async () => {
    const rat = standFoe(0);
    foes.foes.push(rat);
    foes.damageFoe(rat, 99, [0, 0, 0], null, { fromPlayer: false });
    await settle();
    assert.equal(foes.lootTargets().length > 0, true, 'the body is a target - and the pool\'s identity law has minted its key');
    return `foeCorpse:${rat.uid}`;
  };
  const killWatch = async () => {
    const g = standFoe(GUARD_MOBILE_TYPE);
    guards.guards.push(g);
    guards.hurtGuard(g, 99, [0, 0, 0], null, { fromPlayer: false });
    await settle();
    return `guardCorpse:${g.id}`;
  };
  const rat = await killRat();
  const watch = await killWatch();
  assert.deepEqual(said, ['Rat just died.', 'City Watch just died.']);
  const read = () => [foes.hoverName(rat)?.title, guards.hoverName(watch)?.title, foes.pileBody(rat)?.name, guards.pileBody(watch)?.name];
  assert.deepEqual(read(), ['Rat (dead)', 'City Watch (dead)', 'Rat', 'City Watch']);
  fr([['enemyNames', enemyNames({ 0: 'Ombre des caves', [GUARD_MOBILE_TYPE]: 'Veilleur de la cité' })], ['thingJustDied', 'Fin de %s.']]);
  assert.deepEqual(read(), ['Ombre des caves (dead)', 'Veilleur de la cité (dead)', 'Ombre des caves', 'Veilleur de la cité'],
    'the same bodies, read again: the name is looked up where it is shown, never stored ("(dead)" is the mod\'s own word)');
  said.length = 0;
  await killRat();
  await killWatch();
  assert.deepEqual(said, ['Fin de Ombre des caves.', 'Fin de Veilleur de la cité.']);
  tm.setLocale('en');
  assert.deepEqual(read(), ['Rat (dead)', 'City Watch (dead)', 'Rat', 'City Watch']);
});

test('L10N3e beings: the enemy\'s KEY paths never read a translation - the canonical name, the list it comes from, and the career name a peer\'s class travels by', () => {
  fr([['enemyNames', enemyNames({ 7: 'Brute des collines', 144: 'Guerrier des steppes', 146: 'Veilleur de la cité' })]]);
  assert.equal(tm.getLocalizedEnemyName(7, enemyDisplayName(7)), 'Brute des collines', 'shown: the row');
  assert.equal(enemyDisplayName(7), 'Orc', 'the canonical name is the port\'s own in any language');
  assert.equal(ENEMY_NAMES[43 + 144 - 128], 'Warrior');
  assert.equal(classMobileType('Warrior'), 144, 'a career name still finds its class enemy (the EnemyBasics.GetEnemy(name) shape: a KEY)');
  assert.equal(classMobileType('City Watch'), GUARD_MOBILE_TYPE);
});

test('L10N3e beings: the affiliations book (Guild.GetAffiliation over GetFactionData, PersistentFactionData.cs:176) shows a translation\'s name for the faction id - in the classic box and the model the enhanced page draws - while the faction record keeps FACTION.TXT\'s', () => {
  const mages = GUILDS.MagesGuild;
  const record = { id: mages.factionId, name: 'The Mages Guild', rep: 12 };
  const hero = {
    name: 'Aldric Vane', stats: {}, level: 10,
    guildMemberships: { [mages.guildGroup]: { guild: mages.name, rank: 0, lastRankChange: 0 } },
    factionRep: { dict: new Map([[mages.factionId, record]]) },
  };
  const shown = () => [affiliations(hero)[0].affiliation, affiliationRows(hero)[1].cells[0].text];
  assert.deepEqual(shown(), ['The Mages Guild', 'The Mages Guild']);
  fr([[String(mages.factionId), 'La Guilde des Arcanes']], 'Internal_Factions');
  assert.deepEqual(shown(), ['La Guilde des Arcanes', 'La Guilde des Arcanes']);
  assert.equal(affiliations(hero)[0].factionId, mages.factionId);
  assert.equal(affiliations(hero)[0].rep, 12);
  assert.equal(record.name, 'The Mages Guild', 'the record is FACTION.TXT\'s - a key, never rewritten');
  const storeless = { ...hero, factionRep: undefined };
  assert.equal(affiliations(storeless)[0].affiliation, mages.name, 'no faction store: the guild record\'s own name, as before (GetFactionData found nothing to localize)');
  tm.setLocale('en');
  assert.deepEqual(shown(), ['The Mages Guild', 'The Mages Guild']);
});

test('L10N3e beings: the greeting\'s four faction names (TalkManager.cs:1016-1123) - GetFactionData\'s (PersistentFactionData.cs:176) and GetFactionName\'s (:313) - in the player\'s language; the ladder itself reads ids and relations, and answers the same in any language', () => {
  const faction = (over) => ({ id: 0, parent: 0, type: 0, rep: 0, sgroup: 0, ggroup: 0, name: '', ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0, ...over });
  const greet = (guild, npcF, table) => {
    const s = new NPCSession({ factionData: (id) => table[id] ?? null, factionName: (id) => table[id]?.name ?? '', guildMemberships: () => [{ factionId: 40 }] });
    const r = s.getGreetingIndex(0, npcF);
    const d = s.npcData;
    return [r.greetingIndex, r.reputation, d.npcFactionName, d.pcFactionName, d.enemyFactionName, d.allyFactionName];
  };
  // an enemy in common (index 4): the enemy named by GetFactionName
  const guild4 = faction({ id: 40, name: 'The Mages Guild', enemy1: 99 });
  const npc4 = faction({ id: 41, name: 'The Scribes', enemy2: 99 });
  const table4 = { 40: guild4, 99: faction({ id: 99, name: 'The Common Enemy' }) };
  // a guild's enemy is the NPC's ally (index 7): the ally named off its record, GetFactionData's
  const guild7 = faction({ id: 40, name: 'The Mages Guild', enemy1: 88 });
  const npc7 = faction({ id: 41, name: 'The Scribes', ally1: 88 });
  const table7 = { 40: guild7, 88: faction({ id: 88, name: 'Their Friend' }) };
  const english = () => {
    assert.deepEqual(greet(guild4, npc4, table4), [4, 5, 'The Scribes', 'The Mages Guild', 'The Common Enemy', '']);
    assert.deepEqual(greet(guild7, npc7, table7), [7, -5, 'The Scribes', 'The Mages Guild', '', 'Their Friend']);
  };
  english();
  fr([['40', 'La Guilde des Arcanes'], ['41', 'Les Copistes'], ['99', 'L\'Ennemi commun'], ['88', 'Leurs Amis']], 'Internal_Factions');
  assert.deepEqual(greet(guild4, npc4, table4), [4, 5, 'Les Copistes', 'La Guilde des Arcanes', 'L\'Ennemi commun', '']);
  assert.deepEqual(greet(guild7, npc7, table7), [7, -5, 'Les Copistes', 'La Guilde des Arcanes', '', 'Leurs Amis']);
  assert.deepEqual([guild4.name, npc4.name, table4[99].name, table7[88].name], ['The Mages Guild', 'The Scribes', 'The Common Enemy', 'Their Friend'],
    'the records keep FACTION.TXT\'s names');
  tm.setLocale('en');
  english();
});

test('L10N3e beings: a faction\'s lord (MacroHelper.GetLordNameForFaction, %fl1/%fl2/%ol1) is its first Individual child by a translation\'s name; a generated ruler is the same in any language', () => {
  const dict = new Map([
    [201, { id: 201, type: 7, children: [406], ruler: 0, race: 0, rulerNameSeed: 0 }],
    [406, { id: 406, type: 4, name: 'Lord Kain' }],
    [202, { id: 202, type: 7, children: [], ruler: 1, race: 3, rulerNameSeed: 0x12345678 }],
  ]);
  const generated = lordNameForFaction(dict, 202);
  assert.equal(lordNameForFaction(dict, 201), 'Lord Kain');
  fr([['406', 'Messire Kain le Hardi'], ['202', 'Un nom qui ne sert pas']], 'Internal_Factions');
  assert.equal(lordNameForFaction(dict, 201), 'Messire Kain le Hardi');
  assert.equal(lordNameForFaction(dict, 201, true), 'Messire Kain le Hardi', 'the old ruler too, when the child is an Individual');
  assert.equal(lordNameForFaction(dict, 202), generated, 'no Individual child: the seeded name, never the faction\'s');
  assert.equal(dict.get(406).name, 'Lord Kain', 'the dict keeps FACTION.TXT\'s');
  tm.setLocale('en');
  assert.equal(lordNameForFaction(dict, 201), 'Lord Kain');
});

test('L10N3e beings: %dae - the prince\'s name through GetFactionData (the guild and coven popups\' Daedra()), by its faction id; the prince table keeps FACTION.TXT\'s', () => {
  const clavicus = DAEDRA.find((d) => d.factionId === 1);
  assert.equal(summonMacroValues(clavicus).dae, 'Clavicus Vile');
  fr([['1', 'Clavicus le Marchandeur']], 'Internal_Factions');
  assert.equal(summonMacroValues(clavicus).dae, 'Clavicus le Marchandeur');
  assert.equal(summonMacroValues(null).dae, null, 'no prince, no value - the token stays');
  assert.equal(clavicus.name, 'Clavicus Vile');
  assert.equal(DAEDRA.find((d) => d.name === 'Clavicus Vile'), clavicus, 'the table is still found by its own names');
  tm.setLocale('en');
  assert.equal(summonMacroValues(clavicus).dae, 'Clavicus Vile');
});

test('L10N3e beings: a named NPC (an Individual faction) is SHOWN by a translation\'s name (StaticNPC.GetDisplayName over GetFactionData), while staticNpcName - the talk partner\'s nameNPC, which the topic tree compares with a quest Person\'s name - stays FACTION.TXT\'s; everybody else is the seeded name in any language', () => {
  const dict = new Map([[406, { id: 406, type: 4, name: 'Lord Kain' }], [22, { id: 22, type: 2, name: 'Zen' }]]);
  const deps = { getFaction: (id) => dict.get(id) ?? null, nameBank: 0 };
  const lord = { factionID: 406, nameSeed: 77, gender: 0 };
  const clerk = { factionID: 22, nameSeed: 77, gender: 1 };
  const clerkName = staticNpcName(clerk, deps);
  assert.deepEqual([staticNpcShownName(lord, deps), staticNpcName(lord, deps)], ['Lord Kain', 'Lord Kain']);
  assert.equal(staticNpcShownName(clerk, deps), clerkName);
  fr([['406', 'Messire Kain le Hardi'], ['22', 'Un groupe qui ne nomme personne']], 'Internal_Factions');
  assert.equal(staticNpcShownName(lord, deps), 'Messire Kain le Hardi');
  assert.equal(staticNpcName(lord, deps), 'Lord Kain', 'the key never reads a translation');
  assert.equal(staticNpcShownName(clerk, deps), clerkName, 'a Group\'s member is generated - its faction\'s name is never his');
  tm.setLocale('en');
  assert.equal(staticNpcShownName(lord, deps), 'Lord Kain');
});
