// Services.GuildNpcServices -> GuildServices (DFU's Guilds/Services.cs GetService switch): which guild service a person
// of a faction offers. A LEAF - it imports nothing - so a module the world-data door reads can ask it without the guild
// system's import graph (AUDIT QA2: world/curatedPeople.js, the temples' Daedra summoners, had kept a second literal of
// its eight DaedraSummoning rows; systems/guildServices.js re-exports it for every other reader).

/** Services.GuildNpcServices -> GuildServices, from DFU's GetService
 *  switch. Key is the NPC's FACTION ID. */
export const NPC_SERVICE = Object.freeze({
  60: 'BuySpellsMages',           // MG_BuySpells
  61: 'Training',                 // MG_Training
  62: 'Teleport',                 // MG_Teleportation
  63: 'Quests',                   // MG_Quests
  64: 'MakeSpells',               // MG_MakeSpells
  65: 'BuyMagicItems',            // MG_BuyMagicItems
  66: 'DaedraSummoning',          // MG_DaedraSummoning
  240: 'Quests',                  // T_Quests
  241: 'Training',                // TAr_Training
  243: 'Training',                // TZe_Training
  245: 'Training',                // TMa_Training
  247: 'Training',                // TAk_Training
  249: 'Training',                // TJu_Training
  250: 'Training',                // TDi_Training
  252: 'Training',                // TSt_Training
  254: 'Training',                // TKy_Training
  453: 'BuyPotions',              // TAr_BuyPotions
  454: 'MakePotions',             // TAr_MakePotions
  455: 'BuySoulgems',             // TAr_BuySoulgems
  456: 'DaedraSummoning',         // TAr_DaedraSummoning
  462: 'BuyPotions',              // TZe_BuyPotions
  463: 'MakePotions',             // TZe_MakePotions
  464: 'DaedraSummoning',         // TZe_DaedraSummoning
  468: 'BuyPotions',              // TMa_BuyPotions
  469: 'MakePotions',             // TMa_MakePotions
  470: 'DaedraSummoning',         // TMa_DaedraSummoning
  473: 'BuyPotions',              // TAk_BuyPotions
  474: 'MakePotions',             // TAk_MakePotions
  475: 'DaedraSummoning',         // TAk_DaedraSummoning
  480: 'BuyMagicItems',           // TJu_BuyMagicItems
  481: 'MakeMagicItems',          // TJu_MakeMagicItems
  482: 'DaedraSummoning',         // TJu_DaedraSummoning
  485: 'BuyPotions',              // TDi_BuyPotions
  487: 'MakePotions',             // TDi_MakePotions
  488: 'DaedraSummoning',         // TDi_DaedraSummoning
  490: 'BuyPotions',              // TSt_BuyPotions
  491: 'MakePotions',             // TSt_MakePotions
  492: 'DaedraSummoning',         // TSt_DaedraSummoning
  496: 'BuySpells',               // TKy_BuySpells
  497: 'MakeSpells',              // TKy_MakeSpells
  498: 'DaedraSummoning',         // TKy_DaedraSummoning
  801: 'Identify',                // MG_Identify
  802: 'MakeMagicItems',          // MG_MakeMagicItems
  803: 'Training',                // TG_Training
  804: 'Quests',                  // TG_Quests
  805: 'SellMagicItems',          // TG_SellMagicItems
  806: 'Spymaster',               // TG_Spymaster
  807: 'Quests',                  // DB_Quests
  810: 'Donate',                  // T_MakeDonation
  813: 'CureDisease',             // T_CureDiseases
  839: 'Training',                // DB_Training
  840: 'MakePotions',             // DB_MakePotions
  841: 'BuyPotions',              // DB_BuyPotions
  842: 'Spymaster',               // DB_Spymaster
  843: 'BuySoulgems',             // DB_BuySoulgems
  845: 'ReceiveArmor',            // KO_Smith
  846: 'Quests',                  // KO_Quests
  848: 'ReceiveHouse',            // KO_Seneschal
  849: 'Training',                // FG_Training
  850: 'Repair',                  // FG_Repair
  851: 'Quests',                  // FG_Quests
});
