// AUDIT DEX A6 (2026-10-20, Mac: "We need to make everything compatible. No if ands or vutts") - THE FIFTY NAMES IN THE
// PLAYER'S LANGUAGE. DFU shows a custom enemy by the mod's own name (BestiaryTextProvider.GetCustomEnemyName, the
// MonsterBase and ClassBase `Name` column), so a Goblin is "Goblin" in every language; the port names it in the
// player's (textManager.js registerCustomEnemyNameText, asked by getLocalizedEnemyName - the HUD's "You see", the death
// line, a quest's foe, a soul's name, the troll's recovery line). A departure: Port-Ledger A, the DEX row.
//
// Each name is the mod's English as its tables write it (the test holds every one to the reading's `Name`), keyed for
// the catalog the translators read (`dex.enemy.*`, read off these t() calls by tools/l10nExtract.mjs). The English the
// game keeps for itself - the quest Foes table's keys, the save, the log - is still the table's (enemyBasics.js
// enemyDisplayName). A LEAF but for the text manager.

import { t } from '../textManager.js';

/** By MobileTypes id: the name in the player's language. */
export const DEX_ENEMY_NAME_TEXT = Object.freeze({
  256: () => t('dex.enemy.goblin', 'Goblin'),
  257: () => t('dex.enemy.homunculus', 'Homunculus'),
  258: () => t('dex.enemy.lizardMan', 'Lizard Man'),
  259: () => t('dex.enemy.lizardWarrior', 'Lizard Warrior'),
  260: () => t('dex.enemy.bat', 'Bat'),
  261: () => t('dex.enemy.medusa', 'Medusa'),
  262: () => t('dex.enemy.wolf', 'Wolf'),
  263: () => t('dex.enemy.snowWolf', 'Snow Wolf'),
  264: () => t('dex.enemy.hellHound', 'Hell Hound'),
  265: () => t('dex.enemy.grotesque', 'Grotesque'),
  266: () => t('dex.enemy.skeletalSoldier', 'Skeletal Soldier'),
  267: () => t('dex.enemy.dog', 'Dog'),
  268: () => t('dex.enemy.nymph', 'Nymph'),
  269: () => t('dex.enemy.minotaur', 'Minotaur'),
  270: () => t('dex.enemy.ironGolem', 'Iron Golem'),
  271: () => t('dex.enemy.bloodSpider', 'Blood Spider'),
  272: () => t('dex.enemy.troll', 'Troll'),
  273: () => t('dex.enemy.gloomWraith', 'Gloom Wraith'),
  274: () => t('dex.enemy.fadedGhost', 'Faded Ghost'),
  275: () => t('dex.enemy.vengefulKingLysandus', 'Vengeful King Lysandus'),
  276: () => t('dex.enemy.fireDaemon', 'Fire Daemon'),
  277: () => t('dex.enemy.ghoul', 'Ghoul'),
  278: () => t('dex.enemy.boar', 'Boar'),
  279: () => t('dex.enemy.landDreugh', 'Land Dreugh'),
  280: () => t('dex.enemy.mountainLion', 'Mountain Lion'),
  281: () => t('dex.enemy.mudcrab', 'Mudcrab'),
  282: () => t('dex.enemy.ogre', 'Ogre'),
  283: () => t('dex.enemy.willOWisp', 'Will-o\'-wisp'),
  284: () => t('dex.enemy.iceGolem', 'Ice Golem'),
  285: () => t('dex.enemy.dremoraChurl', 'Dremora Churl'),
  286: () => t('dex.enemy.stoneGolem', 'Stone Golem'),
  287: () => t('dex.enemy.direGhoul', 'Dire Ghoul'),
  288: () => t('dex.enemy.scamp', 'Scamp'),
  289: () => t('dex.enemy.centurionSphere', 'Centurion Sphere'),
  290: () => t('dex.enemy.steamCenturion', 'Steam Centurion'),
  384: () => t('dex.enemy.druid', 'Druid'),
  385: () => t('dex.enemy.guard', 'Guard'),
  386: () => t('dex.enemy.knightRider', 'Knight Rider'),
  387: () => t('dex.enemy.rogueRider', 'Rogue Rider'),
  388: () => t('dex.enemy.necromancerAcolyte', 'Necromancer Acolyte'),
  389: () => t('dex.enemy.rogueDruid', 'Rogue Druid'),
  390: () => t('dex.enemy.bountyHunter', 'Bounty Hunter'),
  391: () => t('dex.enemy.royalKnight', 'Royal Knight'),
  392: () => t('dex.enemy.thiefRider', 'Thief Rider'),
  393: () => t('dex.enemy.necromancerGlaivier', 'Necromancer Glaivier'),
  394: () => t('dex.enemy.necromancerAssassin', 'Necromancer Assassin'),
  395: () => t('dex.enemy.darkSlayer', 'Dark Slayer'),
  396: () => t('dex.enemy.witchDefender', 'Witch Defender'),
  397: () => t('dex.enemy.spellswordRider', 'Spellsword Rider'),
  398: () => t('dex.enemy.archerRider', 'Archer Rider'),
});

/** The door's answer: the name of `id` in the player's language, or null where the mod names no such enemy. */
export const dexEnemyNameText = (id) => DEX_ENEMY_NAME_TEXT[id]?.() ?? null;
