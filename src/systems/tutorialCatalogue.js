// @ts-check
// TUT1 (2026-10-11): THE TUTORIALS' WORDS - every page DFO's tutorial can show, grouped as the menu's Tutorials tab
// lists them. The law that reads them is systems/tutorials.js; the box is ui/tutorialPopup.js; the menu's pane is
// ui/tutorialsPane.js.
//
// THE RULES A PAGE KEEPS (test/ui/tut1_tutorials.test.js holds every page to them):
// - The game is DFO. A page never names the old game it grew from - not the game, not its capital.
// - A key is written `{Action}` (an action of systems/inputActions.js) and filled with the key the player has bound
//   now, never a key's name: a rebound key would make the page lie.
// - A page is short and plain (TUT1 audit, Mac: "Ensure explanations dont sound AI and arent overloaded"): what the
//   player needs to start, in the words a player uses - one or two short paragraphs, at most three points, no
//   asides and no flourish. The detail lives in the game; the page gets the player to it.
// - `trigger` says, in words, when the page pops on its own (the menu shows it under the title); a page with no seam
//   says it is read here. `TUTORIAL_TOUR` pops together as the welcome tour when a new character first stands in the
//   world.
// - Every claim was checked against the system's own bible page and code when the page was written (TUT1). A slice
//   that changes how a system plays changes its page.

import { t } from './textManager.js';   // KG3: a page's words read through the text core when shown
import { isEnhanced } from './uiSkin.js';   // AUDIT SUGGESTIONS-1019 L6-4: a line only the enhanced skin's Stats page bears out
import { ROLL_GAIN_DAY_MAX, ROLL_BOOK_RANK_MAX, SEAT_RANK } from '../net/npcChapterLaw.js';   // SEAT-WORDS: the Chapters page's numbers, the law's own
import { ETHER_WORD } from '../world/ethericSea.js';   // FOE-KEEPS: the open zone's page names the sea by its one home (ELTHERIC)

/** @typedef {{ id: string, group: string, title: string, trigger: string, body: ReadonlyArray<string>, points?: ReadonlyArray<string> }} Tutorial */

/** The menu's sections, in order. */
export const TUTORIAL_GROUPS = Object.freeze([
  Object.freeze({ id: 'basics', title: 'Getting Started' }),
  Object.freeze({ id: 'combat', title: 'Combat & Magic' }),
  Object.freeze({ id: 'character', title: 'Your Character' }),
  Object.freeze({ id: 'world', title: 'Exploring' }),
  Object.freeze({ id: 'travel', title: 'Travel & Mounts' }),
  Object.freeze({ id: 'towns', title: 'Towns, Trade & Guilds' }),
  Object.freeze({ id: 'quests', title: 'Quests & Bounties' }),
  Object.freeze({ id: 'loot', title: 'Loot & Gear' }),
  Object.freeze({ id: 'livelihood', title: 'Professions & Survival' }),
  Object.freeze({ id: 'sea', title: 'Ships & the Sea' }),
  Object.freeze({ id: 'challenges', title: 'Challenges' }),
  Object.freeze({ id: 'legacy', title: 'Family & Legacy' }),
  Object.freeze({ id: 'online', title: 'Playing Online' }),
]);

/** Said for a page no seam pops: it is read in the menu. */
export const MENU_ONLY = 'Menu only.';
const TOUR = 'Part of the welcome tour.';

/** A page, frozen. KG3 (AUDIT KG D21): a page's words may be getters, read through the text core when the page is shown
 *  (`t`, never at this module's load) - so a word stays a getter here, where a spread would read it now, in English;
 *  its body and points are frozen lists either way. @param {Tutorial} p */
const page = (p) => {
  /** @type {any} */ const d = Object.getOwnPropertyDescriptors(p);
  const list = (/** @type {'body'|'points'} */ k) => (d[k]?.get
    ? { get: () => Object.freeze([...(d[k].get.call(p) ?? [])]), enumerable: true }
    : { value: Object.freeze([...(p[k] ?? [])]), enumerable: true });
  return /** @type {Readonly<Tutorial>} */ (Object.freeze(Object.defineProperties({}, { ...d, body: list('body'), points: list('points') })));
};

/** @type {ReadonlyArray<Readonly<Tutorial>>} */
export const TUTORIALS = Object.freeze([
  // ── GETTING STARTED ──────────────────────────────────────────
  page({
    id: 'welcome', group: 'basics', title: 'Welcome to DFO', trigger: TOUR,
    body: [
      'You awaken in a small cave. Take what you need from your pack, find the way out and make for the nearest town.',
      'When you meet something new, a short note like this one explains it. All of them can be read again under Menu > Tutorials.',
    ],
  }),
  page({
    id: 'movement', group: 'basics', title: 'Moving Around', trigger: TOUR,
    body: [
      '{MoveForwards} {MoveLeft} {MoveBackwards} {MoveRight} move you and the mouse turns your head. Hold {Run} to run. {Jump} jumps and {Crouch} crouches.',
    ],
    points: [
      'Jump at a ledge to pull yourself up, or walk into a wall to climb it.',
      '{FreeMouse} frees the cursor. Press it again to look around once more.',
      '{TogglePerspective} changes between first and third person.',
    ],
  }),
  page({
    id: 'interacting', group: 'basics', title: 'Using Things', trigger: TOUR,
    body: [
      'Look at a door, chest, lever or person and press {ActivateCenterObject} or {Interact}. The words beneath your crosshair tell you what will happen.',
      'Hold {ModeWheel} to choose Steal, Grab, Info or Talk. Info names a building from a distance.',
    ],
  }),
  page({
    id: 'hud', group: 'basics', title: 'The Bars and the Compass', trigger: TOUR,
    body: [
      'The three bars are your health, fatigue and magicka. The compass points toward the quest you are following, and the hotbar at the bottom holds items and spells.',
    ],
    points: [
      '{Inventory} inventory, {CharacterSheet} character, {LogBook} quest log, {AutoMap} map.',
      '{Status} tells you where you are and the date.',
    ],
  }),
  page({
    id: 'menu', group: 'basics', title: 'The Menu and Saving', trigger: TOUR,
    body: [
      '{Escape} opens the menu. Saving, loading and settings are under the System tab.',
      '{QuickSave} saves your game at once and {QuickLoad} loads that save. Save often.',
    ],
    points: [
      'Every feature DFO adds can be turned off under Settings > Features.',
      'Online, the world goes on while the menu is open.',
    ],
  }),

  // ── COMBAT & MAGIC ───────────────────────────────────────────
  page({
    id: 'combat', group: 'combat', title: 'Fighting', trigger: 'When you first draw a weapon.',
    body: [
      '{ReadyWeapon} draws your weapon and {SwingWeapon} attacks. How you move the mouse decides the swing.',
      'Missing often means low skill or a weapon too poor for the foe. You can always run.',
    ],
    points: [
      '{SwitchHand} changes hands, or which hand leads when both are armed.',
      'Some weapons have a technique on {WeaponTechnique}, which costs fatigue and takes time to recover.',
    ],
  }),
  page({
    id: 'death', group: 'combat', title: 'Dying', trigger: 'When you first die.',
    body: [
      'Online, you wake at the nearest temple, town or graveyard, short a tenth of the gold you carried. Gold in the bank is safe.',
      'Offline, it depends on your family. In an Enduring family you rise again, a little older. In a Bloodline family death is final and your heir carries on. With Project Legacy off, load a save.',
    ],
  }),
  page({
    id: 'spellbook', group: 'combat', title: 'Casting Spells', trigger: 'When you first open your spellbook.',
    body: [
      '{CastSpell} opens your spellbook. Choose a spell, then aim and cast it with {ActivateCenterObject}. With a one-handed weapon drawn and your other hand empty, the spell waits in that hand and {SwingWeapon} still swings the weapon.',
      '{RecastSpell} casts your last spell again and {AbortSpell} lets it go. The Mages Guild sells spells and lets you make your own.',
    ],
  }),
  page({
    id: 'spellmaker', group: 'combat', title: 'Making Spells', trigger: 'When you first open the spellmaker.',
    body: [
      'Choose up to three effects and set their duration, chance and magnitude. Then choose whom the spell strikes and its element.',
      'The stronger the spell, the more gold it costs to make and the more magicka to cast.',
    ],
  }),
  page({
    id: 'magic-items', group: 'combat', title: 'Magic Items', trigger: 'When you first use a magic item.',
    body: [
      'Some enchanted items work while you wear them. Others must be used: press {UseMagicItem} and choose one.',
      'Every use wears the item down, so have it repaired.',
    ],
  }),
  page({
    id: 'daedra-summoning', group: 'combat', title: 'Summoning Daedra', trigger: 'When you first ask to summon a Daedra Prince.',
    body: [
      'For a fee, summoners at the Mages Guild, certain temples and the witch covens will call a Daedra Prince, but only on the right days.',
      'Do the Prince\'s bidding and you will be given one of their artifacts.',
    ],
  }),
  page({
    id: 'quickslots', group: 'combat', title: 'The Hotbar', trigger: 'When you first use the hotbar.',
    body: [
      '{QuickUse1}, {QuickUse2}, {QuickSpell}, {QuickOffHand} and {Hotbar5} to {Hotbar10} use the items and spells on your hotbar.',
      'To fill a slot, drag an item from your inventory or a spell from your spellbook onto it.',
    ],
  }),

  // ── YOUR CHARACTER ───────────────────────────────────────────
  page({
    id: 'inventory', group: 'character', title: 'Inventory', trigger: 'When you first open your inventory.',
    body: [
      '{Inventory} opens your inventory. Place items on your figure to equip them. Wear armor wherever you can and carry a weapon you are skilled with.',
      'Carrying too much slows you down. Sell what you don\'t need.',
    ],
  }),
  page({
    id: 'wallet', group: 'character', title: 'Your Wallet', trigger: 'When you first open your wallet.',
    body: [
      'Your wallet holds your gold, letters of credit, Deadlands Embers and Welkynd Shards. Online, it also shows your account\'s silver.',
    ],
  }),
  page({
    id: 'character-sheet', group: 'character', title: 'Your Character', trigger: 'When you first open your character sheet.',
    get body() {
      return [
        'Here are your attributes, your skills and your standing with each faction. Skills improve with use, and when your class skills have risen far enough you gain a level.',
        // SKILL-TICK (systems/advancement.js skillAdvanceProgress): when a used skill goes up, and where to see how close -
        // AUDIT SUGGESTIONS-1019 L6-4: the Stats page's line is the enhanced skin's alone, so the classic skin is not sent to it
        isEnhanced()
          ? t('tutorials.characterSheet.skillRaiseStats', 'A used skill goes up when you rest or travel, at most once every 6 hours. Your Stats page shows how close each skill is.')
          : t('tutorials.characterSheet.skillRaise', 'A used skill goes up when you rest or travel, at most once every 6 hours.'),
      ];
    },
  }),
  page({
    id: 'level-up', group: 'character', title: 'Gaining a Level', trigger: 'When you first level up.',
    body: [
      'You have gained a level. Open your character sheet to spend your bonus points on your attributes.',
    ],
  }),
  page({
    id: 'rest', group: 'character', title: 'Resting', trigger: 'When you first rest.',
    body: [
      '{Rest} lets you rest to recover, or wait until a set hour, such as when a shop opens. You cannot rest with enemies nearby.',
      'Sleeping in the open is dangerous. A room at an inn is safer.',
    ],
  }),
  page({
    id: 'reputation', group: 'character', title: 'Reputation', trigger: MENU_ONLY,
    body: [
      'Guilds, temples, knightly orders and the people of each region remember your deeds. Quests raise your standing and crimes lower it. Poor standing mends slowly.',
      'Good standing brings better prices and higher rank.',
    ],
  }),
  page({
    id: 'afflictions', group: 'character', title: 'Disease and Curses', trigger: 'When you first get sick.',
    body: [
      'Bites and filth can bring disease, and a disease grows worse with time. Temples, potions and spells can cure it.',
      'Vampirism and lycanthropy are curses. Here a vampire does not burn in sunlight, but is weaker by day and stronger by night.',
    ],
  }),

  // ── EXPLORING ────────────────────────────────────────────────
  page({
    id: 'automap', group: 'world', title: 'The Map', trigger: 'When you first open the map.',
    body: [
      '{AutoMap} shows a map of your surroundings: the parts of a dungeon you have explored, or the streets and buildings of a town.',
      'Drag to move it and scroll to zoom. Right-click to set a marker.',
    ],
  }),
  page({
    id: 'dungeons', group: 'world', title: 'Dungeons', trigger: 'When you first enter a dungeon.',
    body: [
      'Dungeons are large and it is easy to lose your way. Look at your map often and watch for levers and secret doors. The way out is the way you came in.',
    ],
  }),
  page({
    id: 'searchables', group: 'world', title: 'Searching', trigger: 'When you first search something.',
    body: [
      'Coffins, shelves, gravestones, chests and crates can be searched. You may find gold, find nothing, or wake something.',
    ],
  }),
  page({
    id: 'torches', group: 'world', title: 'Torches', trigger: 'When you first light a torch.',
    body: [
      'Carry a torch or lantern in your off hand to see in the dark. {TorchToggleLight} lights it or puts it out, {TorchDrop} drops it and {TorchThrow} throws a torch.',
      'Drawing a two-handed weapon puts out your torch.',
    ],
  }),
  page({
    id: 'crime', group: 'world', title: 'Crime', trigger: 'When the law first catches up with you.',
    body: [
      'Theft, trespass and attacks on innocent folk are crimes. When a guard stops you, you may pay the fine, stand trial or resist.',
      'Murder and treason see you banished from the region for 30 days. The region\'s temple sells pardons.',
    ],
  }),

  // ── TRAVEL & MOUNTS ──────────────────────────────────────────
  page({
    id: 'travel-map', group: 'travel', title: 'The Travel Map', trigger: 'When you first open the travel map.',
    body: [
      '{TravelMap} opens the map of the whole land. Choose a place to travel there. The journey takes days in the game but only a moment for you.',
      'You decide how fast to go, how to travel and whether to camp or stop at inns. Online, journeys over land are made along the roads instead.',
    ],
  }),
  page({
    id: 'travel-view', group: 'travel', title: 'The Overworld', trigger: 'When you first open the Overworld.',
    body: [
      'Open it with the Overworld button at the foot of the map. Click a town to travel there by road, or open ground to go straight there. You can stop and step out anywhere.',
      '{FollowPaths} follows the road ahead.',
    ],
  }),
  page({
    id: 'carriages', group: 'travel', title: 'Carriages', trigger: 'When you first hire a carriage.',
    body: [
      'Carriage drivers wait outside the gates of walled cities. Speak with one to ride to another town, for a daily fare and the inns along the way.',
    ],
  }),
  page({
    id: 'horse', group: 'travel', title: 'Horses', trigger: 'When you first choose how to travel.',
    body: [
      'Every town has a stable that sells horses. {Transport} chooses how you travel: on foot, on horseback or by cart.',
      '{HorseMount} mounts and dismounts. Your horse walks; hold {Run} to gallop. Do not gallop into people in town: trampling them is a crime. {HorseSummon} calls your horse and wagon to you.',
    ],
  }),
  page({
    id: 'wagon', group: 'travel', title: 'Wagons', trigger: 'When you first use a wagon.',
    body: [
      'Wagon yards sell carts and wagons for hauling goods. The Open Wagon and the Caravan need two horses.',
      'Never leave a wagon standing on a town road. After ten minutes the watch hauls it out of town, cargo and all.',
    ],
  }),
  page({
    id: 'portal-stone', group: 'travel', title: 'Portal Stones', trigger: 'When you first use a portal stone.',
    body: [
      'Use a portal stone and choose any place on the map. A portal stays open for 30 seconds, and online anyone near you may follow. Each stone works only once.',
      'They do not work indoors, in dungeons or with enemies near.',
    ],
  }),

  // ── TOWNS, TRADE & GUILDS ────────────────────────────────────
  page({
    id: 'talk', group: 'towns', title: 'Talking', trigger: 'When you first talk to someone.',
    body: [
      'Ask people for directions, news or work. Your manner, their mood and your reputation decide what they will tell you.',
      'Ask about a building more than once and they may mark it on your map.',
    ],
  }),
  page({
    id: 'shops', group: 'towns', title: 'Shops', trigger: 'When you first trade with a shopkeeper.',
    body: [
      'Each shop buys certain goods. Pawnbrokers take nearly anything. Smiths buy weapons and armor and make repairs.',
      'Prices depend on your Mercantile skill. Most shops close at night.',
    ],
  }),
  page({
    id: 'bank', group: 'towns', title: 'Banks', trigger: 'When you first visit a bank.',
    body: [
      'Banks keep your gold safe and write letters of credit, which weigh nothing. They also lend money and sell houses and ships. Each region\'s bank keeps its own accounts.',
    ],
  }),
  page({
    id: 'guilds', group: 'towns',
    // AUDIT GUILD-WORDS II F-7: the whole page in the player's language, as its online point is - not English around it
    get title() { return t('tutorials.guilds.title', 'Guilds'); },
    get trigger() { return t('tutorials.guilds.trigger', 'When you first visit a guild.'); },
    get body() {
      return [
        t('tutorials.guilds.body1', 'Join a guild for its services and its work. Do that work and practice the skills it teaches to rise in rank.'),
        t('tutorials.guilds.body2', 'You may join one temple, one knightly order, and as many guilds as will have you.'),
      ];
    },
    // SEAT-WORDS (Field-Bugs-2026-10-15g): online a review stops at 7 - the page said "to rank up, keep working for it";
    // AUDIT GUILD-WORDS II C-2: ranks 8 and 9 are chairs - a seat is a town's (GUILD3, ONE WORD ONE THING)
    get points() { return [t('tutorials.guilds.online', 'Online, reviews promote you no further than rank {cap}. Ranks {officer} and {master} are chapter chairs; see Guild Chapters.', { cap: ROLL_BOOK_RANK_MAX, officer: SEAT_RANK.officer, master: SEAT_RANK.master })]; },
  }),
  page({
    id: 'tavern', group: 'towns', title: 'Taverns', trigger: 'When you first visit a tavern.',
    body: [
      'Taverns sell food, drink and rooms. A rented room is the safest place to sleep, and the regulars are a good source of news and work.',
    ],
  }),
  page({
    id: 'tavern-cards', group: 'towns', title: 'Card Games', trigger: 'When you first sit at a card table.',
    body: [
      'Play Texas Hold\'em, Iliac Hand or The King\'s Gambit against the locals, and the first two against other players too. Online, one table plays for real gold.',
      'Cards you collect go into your Card Binder, kept under Menu > Holdings > Collections.',
    ],
  }),
  // KG3 (bible/11-Multiplayer/Kings-Gambit.md section 14.5): the third game at the card table - its words through the
  // text core, read when the page is shown; no number (the panel's guide carries them) and no crown (a page names no
  // old game, and the game's own crown is its capital's)
  page({
    id: 'kings-gambit', group: 'towns',
    get title() { return t('tutorials.kingsGambit.title', 'The King\'s Gambit'); },
    get trigger() { return t('tutorials.kingsGambit.trigger', 'When you first sit down to The King\'s Gambit.'); },
    get body() {
      return [
        t('tutorials.kingsGambit.body1', 'A game of armies and kings, played on a board laid across a tavern\'s card table. Choose a regular to play, set down your stake and raise your army.'),
        t('tutorials.kingsGambit.body2', 'Each turn, move your pieces, strike and drink potions. Bring down the enemy king to win, and guard your own.'),
      ];
    },
  }),
  page({
    id: 'holdings', group: 'towns', title: 'Houses', trigger: 'When you first look at buying or renting a house.',
    body: [
      'Offline, banks sell houses. Online, you may buy up to three empty houses at their front doors and choose who may enter.',
      'A house is a safe place to sleep, to keep your belongings and to furnish as you like.',
    ],
  }),
  page({
    id: 'notice-board', group: 'towns', title: 'Notice Boards', trigger: 'When you first read a notice board.',
    body: [
      'Online, a town\'s notice board carries notices from other players, work orders, the market, player stalls and guild news.',
    ],
  }),

  // ── QUESTS & BOUNTIES ────────────────────────────────────────
  page({
    id: 'quests', group: 'quests', title: 'Quests', trigger: 'When you first get quest news or open your log.',
    body: [
      '{LogBook} and the Quests tab of the menu keep track of your quests. Read them carefully: they tell you whom to find and where.',
      'Many quests must be finished in time. Turning work down costs you nothing, except in the main story.',
    ],
  }),
  // QL2 (bible/06-Systems/Questlines-Arc.md section 6): what the questlines changed, the first time a quest carries them
  page({
    id: 'questlines', group: 'quests',
    get title() { return t('tutorials.questlines.title', 'Questlines'); },
    get trigger() { return t('tutorials.questlines.trigger', 'When you first take a quest with objectives.'); },
    get body() {
      return [
        t('tutorials.questlines.body1', 'The Quests tab lists what each quest asks of you and ticks off each step. Some quests make you choose, and end differently for each choice.'),
        // AUDIT QUESTLINES UI-4 (REWARD-6): not every quest pays gear - 24 sheets' outcomes pay none - so the page promises it
        // only where the quest's own page does (ui/questlines/qlJournal.js qlObjectivesBlock, its row's `gear`). AUDIT
        // QUESTLINES VOICE-QL: "longer stories, quest after quest, listed in the same tab" said plainly (Voice.md rule 4),
        // in the questline page's own words (qlJournal.js ql.journal.lineWhat)
        t('tutorials.questlines.gearBody', 'Some quests, once finished, let you pick one of three pieces of gear: the quest\u2019s page says so. Questlines are longer stories told in several quests, one after another. The same tab lists them.'),
      ];
    },
  }),
  page({
    id: 'quest-guide', group: 'quests', title: 'Tracking Quests', trigger: 'When you first track a quest.',
    body: [
      'A quest you follow is shown at the top right, and its goal is marked on your compass and map. Settings > Features sets how exact the marks are.',
    ],
  }),
  page({
    id: 'bounties', group: 'quests', title: 'Bounties', trigger: 'When you first read a bounty board.',
    body: [
      'Bounty boards list four hunts. Take one, slay the quarry and return for gold and an item. It also raises your standing in the region.',
    ],
  }),
  page({
    id: 'notebook', group: 'quests', title: 'Notebook', trigger: 'When you first open your notebook.',
    body: [
      '{NoteBook} opens your notebook. It holds your own notes and a record of the quests you have finished.',
    ],
  }),

  // ── LOOT & GEAR ──────────────────────────────────────────────
  page({
    id: 'loot', group: 'loot', title: 'Loot', trigger: 'When you first loot something.',
    body: [
      '{QuickLootAll} takes everything from a body or pile. {QuickLootOpen} opens the full window.',
      'The color of an item\'s name shows its rarity: Common, Magic, Rare or Legendary. The rarer the item, the more and the better its powers.',
    ],
  }),
  page({
    id: 'materials', group: 'loot', title: 'Materials Bag', trigger: 'When you first gather a crafting material.',
    body: [
      'Online, a Materials Bag holds up to 300 kg of crafting materials without adding to your burden. General stores sell them, one to each player.',
    ],
  }),
  page({
    id: 'reforge', group: 'loot', title: 'Reforging', trigger: 'When you first visit the Reforge.',
    body: [
      'The Reforge at the Mages Guild remakes one power on a Magic or Rare item for Welkynd Shards and gold. It can also take a gem out of its socket.',
      'Salvage breaks down gear you have no use for into Welkynd Shards.',
    ],
  }),
  page({
    id: 'gem-sockets', group: 'loot', title: 'Gems', trigger: 'When you first set a gem.',
    body: [
      'Weapons have one to three sockets, depending on their size. Armor has one. Setting a gem costs nothing and lends its power to the item.',
    ],
  }),
  page({
    id: 'sigil-sets', group: 'loot', title: 'Sigil Sets', trigger: 'When you first look at a set item.',
    body: [
      'Items that bear the same sigil form a set. Wear 2, 4 or 6 pieces to gain the set\'s powers, which grow with your Renown and with your weakest piece.',
      'Sets work only online and never in duels. The Sigil Broker sells set pieces for Deadlands Embers.',
    ],
  }),

  // ── PROFESSIONS & SURVIVAL ───────────────────────────────────
  page({
    id: 'foraging', group: 'livelihood', title: 'Gathering', trigger: 'When you first gather something.',
    body: [
      'With the right tool you can gather herbs, ore, wood, fish and game. Look at something that can be gathered and choose what to do. {ActChoice} changes the choice.',
    ],
  }),
  page({
    // FB1018D CRAFT-HOWTO: the key opens the Professions page alone - the Stores page is the Holdings tab's since HOLDINGS
    // (input.js's Professions lands `at: 'professions'`; AUDIT HOLDINGS C7 said so for the first harvest's line, not here).
    // AUDIT FB1018D L1-6: and the Stores are reached from the window the key opens - "Menu > Holdings" is the Enhanced
    // menu's alone: Escape on the Classic skin is DFU's pause, which has no tabs (ui/pauseDoor.js CLASSIC-PAGES)
    id: 'professions', group: 'livelihood', title: 'Professions', trigger: 'When you first gather something.',
    body: [
      'Online, gathering, crafting and selling improve your professions. {Professions} opens them, and your stored goods are under Holdings > Stores in the same window.',
    ],
  }),
  page({
    // FB1018D CRAFT-HOWTO (FIELD BUGS 2026-10-18d, MoonGeneral: "Write a bit more detailed piece about crafting in the
    // tutorial (doesn't have to be step for step, but something that helps new players know where to look)"): where the
    // stations stand - the shops the interior host's station questions answer (scenes/worldModes.js forgeHere ..
    // enchantHere), a joinery's bench (scenes/world.js workbenchHere), any fire (net/professionLaw.js COOK_FIRE) - and
    // that a station is worked on the Stores page - by the Professions key, the one door to it on either skin (AUDIT FB1018D
    // L1-6). Each crafting profession's own page says the rest
    // (ui/professions/profPages.js CRAFT_HOW). Pops with the first gather, after the two pages it follows.
    id: 'crafting', group: 'livelihood',
    get title() { return t('tutorials.crafting.title', 'Crafting'); },
    get trigger() { return t('tutorials.crafting.trigger', 'When you first gather something.'); },
    get body() { return [t('tutorials.crafting.body', 'Online, you craft at a station: stand at one, press {Professions} and open Holdings > Stores. Cook at any fire.')]; },
    get points() {
      return [
        t('tutorials.crafting.shops1', 'Forge: Weaponsmiths, Armorers. Loom: Clothing Stores. Workbench: Furniture Stores, joineries.'),
        t('tutorials.crafting.shops2', 'Jeweler\'s bench: Pawn Shops, Gem Stores. Mason\'s bench: General Stores. Alchemy: Alchemists. Enchanting: Mages Guild halls.'),
        t('tutorials.crafting.more', 'Your home can hold stations too. Each crafting profession under {Professions} says more.'),
      ];
    },
  }),
  page({
    // AUDIT C&C S13: the words true - the page opens on the first need's tile of any kind (enhancedHud.js: the wet, the
    // warm, the drink and the stiff morning too), and the tiles stand at the screen's left edge, not beside the bars
    id: 'survival', group: 'livelihood', title: 'Hunger and Cold', trigger: 'When a need first shows on your screen.',
    body: [
      'You need food, water, warmth and sleep. Signs at the left edge of the screen show what you lack, and on Boons what you have earned.',
      'Survival can be Off, Boons (the default), Casual or Hard, set under Settings > Features. On Boons, needs that are met give bonuses. On Hard, neglected needs hurt you and can make you ill.',
    ],
  }),

  // ── SHIPS & THE SEA ──────────────────────────────────────────
  page({
    id: 'ships', group: 'sea', title: 'Sailing', trigger: 'When you first board a boat.',
    body: [
      'Shipyards in port towns sell ships. A rowboat comes in parts, to be put together by any water. A larger ship is laid up where you bought it; bring it round from the shipyard\'s Your fleet page.',
      'At the helm, {BoatToggleSail} raises or lowers the sail and {BoatSailUp} and {BoatSailDown} trim it. {BoatDisembark} leaves the helm.',
    ],
  }),
  page({
    id: 'shipyard', group: 'sea', title: 'Shipyards', trigger: 'When you first visit a shipyard or a shipwright.',
    body: [
      'Port towns have a shipyard by the water. The shipmaster sells ships and buys yours, and repairs and refits any ship of yours in port.',
      'Its crew hall has new sailors for hire each day. You can also hail the shipwright from the helm in a port\'s harbor.',
    ],
  }),
  page({
    id: 'lighthouse', group: 'sea', title: 'Lighthouses', trigger: 'When you first climb a lighthouse.',
    body: [
      'Port towns have a lighthouse, lit from dusk till dawn. Speak with the keeper or use the tower door to climb to the gallery.',
      'The hatch on the gallery takes you back down.',
    ],
  }),
  page({
    id: 'naval-combat', group: 'sea', title: 'Fighting at Sea', trigger: 'When you first take a ship\'s cargo.',
    body: [
      'Turn broadside to a ship, hold {SwingWeapon} to aim and let go to fire. Batter a ship until it strikes its colors, then board it and take its cargo.',
      'Piracy is a crime.',
    ],
  }),

  // ── CHALLENGES ───────────────────────────────────────────────
  page({
    id: 'arena', group: 'challenges', title: 'The Arena', trigger: 'When you first visit the arena.',
    body: [
      'The arena stands in the province\'s capital. Speak with the Herald at the gate to fight. The recruiters will take you onto a team, and the bookmaker takes wagers.',
      'There are ten ranks to climb, and the purse reaches 10,000 gold. One defeat ends your run, and potions are forbidden.',
    ],
  }),
  page({
    id: 'oblivion-gate', group: 'challenges', title: 'Dagon\'s Breach', trigger: 'When you first go through Dagon\'s Breach.',
    body: [
      'Online, Dagon\'s Breach opens every two hours for ten minutes. About fifteen minutes before, the sky turns red and the map marks the place. Go through to face its master alongside everyone else.',
      'Each fighter wins their own spoils: gold, gear, a Deadlands Ember and perhaps a piece of Ruhn\'s Regalia.',
    ],
  }),
  page({
    id: 'abyss', group: 'challenges', title: 'The Abyss Dungeon', trigger: 'When you first enter the Abyss Dungeon.',
    body: [
      'Online, there is one Abyss Dungeon at a time, near a city in the busiest region. Look for the pillar of light, or listen to the talk in that city\'s taverns.',
      'The Rift at its end leads to the Shattered Hour and the Brass Remnant. You have only one life in there.',
    ],
  }),
  page({
    id: 'ocean-holes', group: 'challenges', title: 'Ocean Holes', trigger: 'When you first dive into an Ocean Hole.',
    body: [
      'Black holes in the seabed beneath purple mist lead down to flooded dungeons. Mind your breath.',
    ],
  }),

  // ── FAMILY & LEGACY ──────────────────────────────────────────
  page({
    id: 'legacy', group: 'legacy', title: 'Family', trigger: 'When your heir first takes over.',
    body: [
      'Befriend someone, court them in conversation and marry at their town\'s temple. Children may follow.',
      'In an Enduring family you rise again after death. In a Bloodline family death is final and your heir carries on. {LegacyFamily} opens your family tree.',
    ],
  }),
  page({
    id: 'revenants', group: 'legacy', title: 'Revenants', trigger: 'When you first meet a revenant.',
    body: [
      'An elite foe that kills you or escapes may return as a revenant: named, stronger and better armed.',
      'Defeat it and it kneels. Then you decide whether to kill it or spare it.',
    ],
  }),
  page({
    id: 'companions', group: 'legacy', title: 'Companions', trigger: 'When a revenant first kneels to you.',
    body: [
      'Spare a revenant and it swears to follow you. You may keep six, with three at your side. Manage them under Menu > Holdings.',
    ],
  }),

  // ── PLAYING ONLINE ───────────────────────────────────────────
  page({
    id: 'online', group: 'online', title: 'Playing Online', trigger: 'When you first play online.',
    body: [
      'Online, everyone shares one world, with the same time, weather and events. The game does not pause while the menu is open.',
    ],
  }),
  page({
    id: 'chat', group: 'online', title: 'Chat', trigger: 'When you first open chat.',
    body: [
      '{ActivateCursor} opens chat. The tabs choose who hears you: World, Region, Local, and Party or Guild if you belong to one.',
    ],
  }),
  page({
    id: 'party', group: 'online', title: 'Other Players', trigger: 'When you first interact with another player.',
    body: [
      'Look at a player and press {SocialInteract} to befriend them, invite them to your party, trade with them or inspect them. With no one before you, it opens your list of friends.',
    ],
  }),
  page({
    id: 'player-trade', group: 'online', title: 'Trading', trigger: 'When you first trade with a player.',
    body: [
      'Each of you puts up what you offer. Nothing changes hands until you both accept.',
    ],
  }),
  page({
    id: 'duel', group: 'online', title: 'Duels', trigger: 'When you are first challenged to a duel.',
    body: [
      'Challenge a player from their Inspect card. A duel does not touch your true health: no one dies and no law is broken.',
    ],
  }),
  page({
    id: 'wild-zone', group: 'online', title: 'The Open Zone', trigger: 'When you first enter the open zone.',
    // FOE-KEEPS; AUDIT FOE-KEEPS O4: the page pops in either zone, the sea's too, and said the bag and cart lost whole at
    // a kill - the cart only goes while it is with them (CART-AWAY), a tenth of the gold with them, and any other death
    // there costs the usual tenth; through the text core (L10N4), read when shown
    get body() {
      return [
        t('tutorials.wildZone.body1', 'Players may fight one another in the Wrothgarian Mountains and on the open {word} Ocean, where monsters are tougher and spoils richer.', { word: ETHER_WORD }),
        t('tutorials.wildZone.body2', 'If another player kills you there, your bag drops (your cart too, if with you) with a tenth of your gold, and they may take one worn item. Any other death costs the usual tenth.'),
      ];
    },
  }),
  // SEAT-WORDS / STANDING-WORDS (Field-Bugs-2026-10-15g): the guilds online - the Roll's pace and the seats - popped at
  // the first word for a member and at the book's hold (scenes/rollNoticeHost.js)
  page({
    id: 'chapters', group: 'online',
    get title() { return t('tutorials.chapters.title', 'Guild Chapters'); },
    get trigger() { return t('tutorials.chapters.trigger', 'When you first come online as a member of a guild, temple or order.'); },
    get body() {
      return [
        // AUDIT GUILD-WORDS L3-2, L3-4: the pace a quest's reward keeps (writs and receipts add beyond it - the guide says
        // so), the real day it counts by - II C-8: a UTC day, said; II C-3: no quest is free of its own guild's losses
        // (REPUTE-GATE gates the two that cost the most instead), so the page no longer says one is; II C-2: chairs
        t('tutorials.chapters.body1', 'Online, quests raise your standing with each guild by at most {max} a real day (days start at midnight UTC). Any more is added on later days.', { max: ROLL_GAIN_DAY_MAX }),
        t('tutorials.chapters.body2', 'Reviews promote you up to rank {cap}. Ranks {officer} and {master} are chapter chairs, won by Merit at each Sunday\'s Turning. A notice board explains chapters.', { cap: ROLL_BOOK_RANK_MAX, officer: SEAT_RANK.officer, master: SEAT_RANK.master }),
      ];
    },
  }),
  page({
    id: 'player-guilds', group: 'online', title: 'Player Guilds', trigger: MENU_ONLY,
    body: [
      'Players may found guilds with a shared vault and guild chat. A guild can claim a palace town as its seat, but must hold it against sieges.',
    ],
  }),
  page({
    id: 'world-events', group: 'online', title: 'Raids and Caravans', trigger: MENU_ONLY,
    body: [
      'Every day raiders fall on a town somewhere. Drive them off to raise your standing. Caravans travel the roads; you may attack them, guard them or trade with them.',
    ],
  }),
]);

/** The welcome tour: the pages a new character reads first, in order, in one box. */
export const TUTORIAL_TOUR = Object.freeze(['welcome', 'movement', 'interacting', 'hud', 'menu']);
