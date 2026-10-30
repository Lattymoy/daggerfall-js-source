// @ts-check
// START1 (2026-10-24, bible/06-Systems/Alternate-Starts-Arc.md; Mac: "Each of these quests should tie into the main
// story seamlessly but allow for the main quest to be started on the player's watch", "Keep privateers hold, give it a
// new quest", "A letter they open"): THE STARTS - the quest a new character begins in, and the main quest it hands on to.
// A leaf: the bridge (scenes/quest/questBridge.js gameStartQuests), the machine's protected list (quest/machine.js
// PROTECTED_QUESTS), the main quest's name test (quest/questLists.js isMainQuestName), the questlines' layer
// (questlines/qlLayer.js), the places' rows (starts/startPlaces.js), the start-choice page (ui/startChoice.js) and the
// world's start host (scenes/startsHost.js) read it, and it reads nothing.
//
// DFU's StartGameBehaviour starts _BRISIEN on a new character (StartGameBehaviour.cs:445-447), and its `until
// _exitstarter_ performed:` block starts the main quest's driver (S0000999) and Lady Brisienna's invitation clock on
// its first tick (Task.cs:257-262 - "starting player outside of PH ... will cause main quest to start as normal"): the
// story is on a clock from the first second, and its failure letter comes 51 to 58 days in. A start here is a quest of
// DFO's own in DFU's text form (systems/starts/quests/<QUEST>.txt, read by the same parser and machine), and every start
// keeps one contract, pinned for each name in START_QUESTS (test/systems/starts/start1_bay.test.js):
//   - it ends with THE COMMISSION, a quest letter (`Item _commission_ letter used N`) whose `used do` sets `_opened_`;
//   - opening it is the player's own act, at any time - nothing of the main quest runs before it, so no clock and no
//     failure letter;
//   - opened, it orders the player to the city of Daggerfall (`Place _daggerfall_ permanent DaggerfallCity1`, the
//     place S0000977 watches), and there, `when _opened_ and _incity_`, it starts _BRISIEN and ends. _BRISIEN then runs
//     as DFU wrote it, its remote tavern drawn from the city of Daggerfall's own region as DFU's start draws it from
//     Privateer's Hold's - its letter's "_dirtypit_ in __dirtypit_ of Daggerfall" true wherever the seal was broken.
// _BRISIEN's own start-up popup (1025, "You wake and look around the room ... Once free of the cave, you can begin the
// Emperor's quest") is the classic start's, and no start shows it now: the port's patch takes its `say` out
// (quest/questPatches.js). A departure, Port-Ledger section A.
//
// START2 (2026-10-24, the owner: "Each new region will each have their own unique starting quest/dungeon within that
// region"): THE PROVINCES' STARTS - one a province past the Bay, each in a dungeon of the province's own near its
// capital (TESA8's lairs: the nearest of the kinds its story wants, scenes/startsHost.js), each under the same
// contract. The new character chooses where their story begins on the page character creation ends with
// (ui/startChoice.js), their race's homeland chosen for them first. A character born anywhere else - a family's heir at
// its seat (LEGACY1), the test room's outdoor presets (AUDIT STARTS W7: its others keep `?classic`, and the Bay's start)
// - is handed the commission at once (HAND_START_QUEST).

/** The Iliac Bay's start: Privateer's Hold, the wreck, and the commission the tide carried in (Mac: "Keep privateers
 *  hold, give it a new quest"). */
export const BAY_START_QUEST = '_STARTIB';
/** START2: the start of a character born at no start - the commission in their pack from the first moment. */
export const HAND_START_QUEST = '_STARTHD';

/**
 * START2: THE STARTS THE PAGE OFFERS, in its order - the Bay's first, then the provinces past it in the picker's order
 * (world/tamriel/tamrielLand.js PROVINCE_OF_ID, High Rock and Hammerfell being the Bay's). Each: its key (the page's
 * answer, and its words' keys on the page - ui/startChoice.js), its quest, its province (world/tamriel/tamrielLand.js's
 * key; null for the Bay's), the capital its dungeon is found near (world/tamrielCapitals.js CAPITALS `key`), the races
 * whose homeland it is (systems/races.js keys), the dungeons its story wants in their order of preference ([location
 * type, dungeon type] by MapsFile's names, `*` any type: systems/starts/startSite.js), and its Quests-Places row's name
 * (`site`, starts/startPlaces.js).
 * @type {ReadonlyArray<Readonly<{ key: string, quest: string, province: ?string, capital: ?string,
 *   homeland: ReadonlyArray<string>, lair: ReadonlyArray<ReadonlyArray<string>>, site: ?string }>>}
 */
export const STARTS = Object.freeze(
  /** @type {Array<[string, string, ?string, ?string, string[], string[][]]>} */ ([
    ['IliacBay', BAY_START_QUEST, null, null, ['Breton', 'Redguard'], []],
    [
      'Skyrim',
      '_STARTSK',
      'Skyrim',
      'solitude',
      ['Nord'],
      [
        ['DungeonLabyrinth', 'VampireHaunt'],
        ['DungeonLabyrinth', 'Crypt'],
        ['DungeonKeep', 'VampireHaunt'],
        ['DungeonRuin', 'DesecratedTemple'],
      ],
    ],
    [
      'Morrowind',
      '_STARTMW',
      'Morrowind',
      'mournhold',
      ['DarkElf'],
      [
        ['DungeonLabyrinth', 'Mine'],
        ['DungeonKeep', 'Mine'],
        ['DungeonLabyrinth', 'NaturalCave'],
      ],
    ],
    [
      'Imperial',
      '_STARTIC',
      'Imperial',
      'imperial-city',
      [],
      [
        ['DungeonLabyrinth', 'Prison'],
        ['DungeonKeep', 'Prison'],
      ],
    ],
    ['BlackMarsh', '_STARTBM', 'BlackMarsh', 'helstrom', ['Argonian'], [['DungeonRuin', '*']]],
    [
      'Elsweyr',
      '_STARTEL',
      'Elsweyr',
      'torval',
      ['Khajiit'],
      [
        ['DungeonLabyrinth', 'HumanStronghold'],
        ['DungeonKeep', 'HumanStronghold'],
        ['DungeonLabyrinth', 'RuinedCastle'],
      ],
    ],
    [
      'Valenwood',
      '_STARTVW',
      'Valenwood',
      'falinesti',
      ['WoodElf'],
      [
        ['DungeonLabyrinth', 'NaturalCave'],
        ['DungeonKeep', 'NaturalCave'],
      ],
    ],
    [
      'Sumurset',
      '_STARTSU',
      'Sumurset',
      'alinor',
      ['HighElf'],
      [
        ['DungeonLabyrinth', 'Laboratory'],
        ['DungeonKeep', 'Laboratory'],
        ['DungeonRuin', 'Laboratory'],
        ['DungeonLabyrinth', 'Coven'],
      ],
    ],
  ]).map(([key, quest, province, capital, homeland, lair]) =>
    Object.freeze({
      key,
      quest,
      province,
      capital,
      homeland: Object.freeze(homeland),
      lair: Object.freeze(lair.map((w) => Object.freeze(w))),
      site: province ? `StartSite${key}` : null,
    }),
  ),
);

/** START2: the Bay's start - the page's first, and every path's that names no other. */
export const BAY_START = STARTS[0];

/** Every start's quest, by name: the page's, then the one handed to a character born at no start. */
export const START_QUESTS = Object.freeze([...STARTS.map((s) => s.quest), HAND_START_QUEST]);

/** The main quest's opener, as DFU ships it - the quest a start's commission starts in the city of Daggerfall. */
export const MAIN_QUEST_OPENER = '_BRISIEN';

/** Is `questName` a start's quest? By the quest's own name, as the machine's protected list and the main quest's test
 *  read one (case-insensitive, as C#'s IsProtectedQuest). */
export const isStartQuestName = (questName) => {
  const n = String(questName ?? '').toUpperCase();
  return START_QUESTS.some((s) => s.toUpperCase() === n);
};
/** THE WRIT (bible/03-World/Passage.md "The writ"): does this start's commission carry the Crown's writ of passage? A
 *  province's does and the commission in hand does (their letters, 1030: "This letter is Our writ of passage"); the Bay's
 *  carries none (its 1030: "to be opened in the Iliac Bay and nowhere else") - AUDIT STARTS V3. */
export const carriesWrit = (questName) =>
  isStartQuestName(questName) && String(questName).toUpperCase() !== BAY_START_QUEST.toUpperCase();

/** START2: a start by its key, or null. */
export const startByKey = (key) => STARTS.find((s) => s.key === key) ?? null;

/** START2: THE START A RACE CALLS HOME - the first whose homeland the race's is (the Bay's for High Rock's and
 *  Hammerfell's peoples, and for a race no start names). The page's first choice. */
export const homelandStart = (raceKey) => STARTS.find((s) => s.homeland.includes(raceKey)) ?? BAY_START;

/** START2: THE STARTS' OWN SITES' IDS - a province's start dungeon is no MAPS.BSA place, so its Quests-Places row names
 *  it by an id past every MAPS.BSA LocationId (16 bits) and below every map id lane the port's own places take (0xa7
 *  and up in the top twelve bits): this base and the start's place in STARTS. quest/place.js asks the world for the
 *  site such an id names (`startSiteOfId`). */
export const START_SITE_ID_BASE = 0x5a7000;
/** A start's site id. */
export const startSiteId = (start) => START_SITE_ID_BASE + STARTS.indexOf(start);
/** The start whose site an id names (a Place's p1), or null. */
export const startOfSiteId = (id) => {
  const i = Number(id) - START_SITE_ID_BASE;
  const s = Number.isInteger(i) ? (STARTS[i] ?? null) : null;
  return s?.site ? s : null; // the Bay's start has no site of its own
};
