// T3b: the mobile-NPC talk session (DFU TalkManager.TalkToNpc /
// GetNPCGreetingRecord / TalkManagerMCP.Oath + MacroHelper, MIT
// Daggerfall Workshop). Mobile townsfolk all talk as the region's
// People faction, whose parent is a Province - so the guild-greeting
// branch (GetGreetingIndex) NEVER runs for them and the greeting is
// purely the reaction thresholds. Verbatim:
//   reaction < -20            -> no response (TEXT.RSC 7205, a box)
//   reaction >= 30            -> 7209 (very like)
//   reaction >= 10            -> 7208 (like)
//   reaction >= 0             -> 7207 (neutral)
//   else                      -> 7206 (dislike)
// The greeting record expands one random variant (DFU rides
// UnityEngine.Random for the pick - a uniform roll here, Ledger A)
// with the macros these records actually carry: %pcf/%pcn (the player
// name), %cn (MacroHelper.CityName - the current location) and %oth
// (an oath - TEXT.RSC 201 + FactionRace, DFU's fix of the classic
// region-race oath bug, one random variant). expandAnswerRecord adds
// the Where-is answer set's %hnt/%key/%hnr/%ra. Unknown macros pass
// through verbatim (LOUD - the full MacroHelper pends).
//
// FLAGGED: the guild greeting indexes (records 8550..8571) pend the
// guilds arc with static NPCs; quest greetings pend quests; the
// tone buttons (Polite/Normal/Blunt) pend T3c topics.

export const NO_RESPONSE_TEXT_ID = 7205;
export const MIN_NEUTRAL_REACTION = 0;
export const MIN_LIKE_REACTION = 10;
export const MIN_VERY_LIKE_REACTION = 30;
export const REFUSE_TALK_REACTION = -20;   // TalkToNpc: reaction < -20 -> 7205
export const OATH_BASE_TEXT_ID = 201;

// FactionRaces (FACTION.TXT race column) - the oath index space.
export const OATH_RACE_INDEX = Object.freeze({ Nord: 0, Khajiit: 1, Redguard: 2, Breton: 3 });

/** GetNPCGreetingRecord's reaction tail (the Province-parent path). */
export function greetingTextId(reactionToPlayer) {
  if (reactionToPlayer >= MIN_VERY_LIKE_REACTION) return 7209;
  if (reactionToPlayer >= MIN_LIKE_REACTION) return 7208;
  if (reactionToPlayer >= MIN_NEUTRAL_REACTION) return 7207;
  return 7206;
}

/** MacroHelper.GetFirstname: the first space-separated token. */
export const firstName = (name) => (name ?? '').split(' ')[0];

/** %hnr - TalkManager.GetHonoric (:1826-1832): by player gender,
 *  localization keys "Sir" / "Ma'am" (Internal_Strings 414/415). */
export const honorificOf = (gender) => (gender === 'male' ? 'Sir' : "Ma'am");

/** %ra - MacroHelper.PlayerRace (:942-945): the BIRTH race template's
 *  display Name (a transformed vampire/werewolf keeps it). The names
 *  are DFU's Internal_Strings values - the elves are TWO words. */
export const RACE_DISPLAY_NAME = Object.freeze({
  Breton: 'Breton', Redguard: 'Redguard', Nord: 'Nord', DarkElf: 'Dark Elf',
  HighElf: 'High Elf', WoodElf: 'Wood Elf', Khajiit: 'Khajiit', Argonian: 'Argonian',
});
export const raceDisplayName = (race) => RACE_DISPLAY_NAME[race] ?? race ?? '';

/** %oth: TEXT.RSC 201 + FactionRace (DFU's oath fix - classic used
 *  the region race INDEX and gave High Rock Nord oaths). */
export const oathTextId = (race) => OATH_BASE_TEXT_ID + (OATH_RACE_INDEX[race] ?? OATH_RACE_INDEX.Breton);

/** Expand the greeting-set macros; unknown %codes stay verbatim.
 *  %cn is MacroHelper.CityName (MacroHelper.cs:566-573): the current
 *  LOCATION name, falling back to the region name off-location. */
export function expandMacros(text, { playerName = '', oath = '', cityName = '' } = {}) {
  return text
    .replaceAll('%pcf', firstName(playerName))
    .replaceAll('%pcn', playerName)
    .replaceAll('%cn', cityName)
    .replaceAll('%oth', oath);
}

/** The Where-is ANSWER record's macro chain. TalkManager's
 *  ExpandRandomTextRecord (:3580-3587) runs the WHOLE MacroHelper over
 *  every answer record, so %oth (MacroHelper.cs:150 -> TalkManagerMCP
 *  Oath, TEXT.RSC 201 + the NPC's faction race) and %cn resolve there
 *  exactly as they do in a greeting. AUDIT 18 F1: the port expanded
 *  only %pcf/%pcn/%hnt/%key, so 7251 variant 13 printed a bare leading
 *  comma (", as if I know...") and 7251 variant 10 printed "I'm new to
 *  %cn too." with the macro raw on screen. */
export function expandAnswerRecord(raw, {
  playerName = '', oath = '', cityName = '', hint = '', key = '',
  // T4: the live path passes honorificOf(gender) / raceDisplayName(race)
  // off the entity; these are the pre-chargen entity's values, for
  // callers with no identity in hand.
  honorific = honorificOf('male'), race = raceDisplayName('Breton'),
} = {}) {
  return expandMacros(raw, { playerName, oath, cityName })
    .replaceAll('%hnt', hint)
    .replaceAll('%key', key)
    .replaceAll('%hnr', honorific)
    .replaceAll('%ra', race);
}

/**
 * TalkToNpc for a mobile townsperson.
 * @param reaction getReactionToPlayer output
 * @param textVariants (id) -> string[] (TextRsc plainText)
 * @param npcRace 'Breton'|'Redguard'|'Nord'|'Khajiit' (region race)
 * @param rolls Math.random-compatible (variant picks)
 * @returns { refused, textId, text }
 */
export function startMobileTalk({ reaction, textVariants, playerName = '', npcRace = 'Breton', cityName = '', rolls = Math.random }) {
  const pick = (id) => {
    const variants = textVariants(id) ?? [''];
    return variants[Math.floor(rolls() * variants.length)] ?? '';
  };
  if (reaction < REFUSE_TALK_REACTION) {
    return { refused: true, textId: NO_RESPONSE_TEXT_ID, text: pick(NO_RESPONSE_TEXT_ID) };
  }
  const textId = greetingTextId(reaction);
  const raw = pick(textId);
  const oath = raw.includes('%oth') ? pick(oathTextId(npcRace)) : '';
  return { refused: false, textId, text: expandMacros(raw, { playerName, oath, cityName }) };
}
