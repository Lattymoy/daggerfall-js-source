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
import { ROLL_GAIN_DAY_MAX, ROLL_BOOK_RANK_MAX, SEAT_RANK } from '../net/npcChapterLaw.js';   // SEAT-WORDS: the Chapters page's numbers, the law's own

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
      'You start in a small cave. Gear up from your pack, find the exit and head for the nearest town.',
      'The first time you run into something new, a short note like this explains it. You can read them all again under Menu > Tutorials.',
    ],
  }),
  page({
    id: 'movement', group: 'basics', title: 'Moving Around', trigger: TOUR,
    body: [
      '{MoveForwards} {MoveLeft} {MoveBackwards} {MoveRight} to move and the mouse to look. Hold {Run} to run. {Jump} jumps and {Crouch} crouches.',
    ],
    points: [
      'Jump at a ledge to climb up, or hold forward against a wall to climb it.',
      '{FreeMouse} frees the cursor. Press it again to go back to looking around.',
      '{TogglePerspective} switches between first and third person.',
    ],
  }),
  page({
    id: 'interacting', group: 'basics', title: 'Using Things', trigger: TOUR,
    body: [
      'Look at a door, chest, lever or person and press {ActivateCenterObject} or {Interact}. The text under your crosshair says what will happen.',
      'Hold {ModeWheel} to switch between Steal, Grab, Info and Talk. Info tells you what a building is from a distance.',
    ],
  }),
  page({
    id: 'hud', group: 'basics', title: 'The HUD', trigger: TOUR,
    body: [
      'The three bars are health, fatigue and magicka. The compass points to the quest you are tracking. The hotbar at the bottom holds items and spells.',
    ],
    points: [
      '{Inventory} inventory, {CharacterSheet} character, {LogBook} quests, {AutoMap} map.',
      '{Status} shows where you are and the date.',
    ],
  }),
  page({
    id: 'menu', group: 'basics', title: 'The Menu and Saving', trigger: TOUR,
    body: [
      '{Escape} opens the menu. Saving, loading and settings are on the System tab.',
      '{QuickSave} quicksaves and {QuickLoad} loads it. Save often.',
    ],
    points: [
      'Any of DFO\'s added features can be turned off in Settings > Features.',
      'Online, the game keeps running while the menu is open.',
    ],
  }),

  // ── COMBAT & MAGIC ───────────────────────────────────────────
  page({
    id: 'combat', group: 'combat', title: 'Fighting', trigger: 'When you first draw a weapon.',
    body: [
      '{ReadyWeapon} draws your weapon and {SwingWeapon} attacks; how you move the mouse sets the swing.',
      'Missing a lot means low skill or a weapon too weak for the target. You can always run.',
    ],
    points: [
      '{SwitchHand} swaps hands, or picks the lead when both hands fight.',
      'Some weapons have a technique on {WeaponTechnique}, at a cost in fatigue and a cooldown.',
    ],
  }),
  page({
    id: 'death', group: 'combat', title: 'Dying', trigger: 'When you first die.',
    body: [
      'Online, you wake at the nearest temple, town or graveyard and lose a tenth of the gold you carry. Banked gold is safe.',
      'Offline, it depends on your family. In an Enduring family you get back up, a little older. In a Bloodline family death is permanent and your heir takes over. With Project Legacy off, load a save.',
    ],
  }),
  page({
    id: 'spellbook', group: 'combat', title: 'Casting Spells', trigger: 'When you first open your spellbook.',
    body: [
      '{CastSpell} opens your spellbook. Pick a spell, then aim and cast it with {SwingWeapon}.',
      '{RecastSpell} casts your last spell again. {AbortSpell} cancels it. The Mages Guild sells spells and lets you make your own.',
    ],
  }),
  page({
    id: 'spellmaker', group: 'combat', title: 'Making Spells', trigger: 'When you first open the spellmaker.',
    body: [
      'Pick up to three effects, set their duration, chance and magnitude, then choose a target and an element.',
      'Stronger spells cost more gold to make and more magicka to cast.',
    ],
  }),
  page({
    id: 'magic-items', group: 'combat', title: 'Magic Items', trigger: 'When you first use a magic item.',
    body: [
      'Some enchanted items work while you wear them. Others have to be used: press {UseMagicItem} and pick one.',
      'Using a power wears the item down, so keep it repaired.',
    ],
  }),
  page({
    id: 'daedra-summoning', group: 'combat', title: 'Summoning Daedra', trigger: 'When you first ask to summon a Daedra Prince.',
    body: [
      'Summoners at the Mages Guild, some temples and the witch covens can call a Daedra Prince for a fee, but only on certain days.',
      'Do what the Prince asks and you get one of their artifacts.',
    ],
  }),
  page({
    id: 'quickslots', group: 'combat', title: 'The Hotbar', trigger: 'When you first use the hotbar.',
    body: [
      '{QuickUse1} and {QuickUse2} use your consumables, {QuickSpell} casts your hotbar spell and {QuickOffHand} uses your off hand. {Hotbar5} to {Hotbar10} use the rest.',
      'To fill a slot, point at an item in your inventory and choose a slot.',
    ],
  }),

  // ── YOUR CHARACTER ───────────────────────────────────────────
  page({
    id: 'inventory', group: 'character', title: 'Inventory', trigger: 'When you first open your inventory.',
    body: [
      '{Inventory} opens your inventory. Put items on your character to equip them. Wear armour everywhere you can and use a weapon you are skilled with.',
      'Carrying too much slows you down. Sell what you don\'t need.',
    ],
  }),
  page({
    id: 'wallet', group: 'character', title: 'Your Wallet', trigger: 'When you first open your wallet.',
    body: [
      'Your wallet counts your gold and holds letters of credit, Deadlands Embers and Welkynd Shards. Online, it also shows your account\'s silver.',
    ],
  }),
  page({
    id: 'character-sheet', group: 'character', title: 'Your Character', trigger: 'When you first open your character sheet.',
    body: [
      'This shows your attributes, skills and standing with each faction. Skills improve as you use them, and when your main skills have gone up enough, you level up.',
    ],
  }),
  page({
    id: 'level-up', group: 'character', title: 'Level Up', trigger: 'When you first level up.',
    body: [
      'You levelled up. Open your character sheet to spend your new points on attributes.',
    ],
  }),
  page({
    id: 'rest', group: 'character', title: 'Resting', trigger: 'When you first rest.',
    body: [
      '{Rest} lets you rest to recover, or wait until a set time, like when a shop opens. You can\'t rest with enemies nearby.',
      'Sleeping outdoors is risky. An inn room is safer.',
    ],
  }),
  page({
    id: 'reputation', group: 'character', title: 'Reputation', trigger: MENU_ONLY,
    body: [
      'Guilds, temples, knightly orders and regions remember what you do. Quests raise your standing and crimes lower it. Bad standing slowly recovers.',
      'Better standing gets you better prices and higher ranks.',
    ],
  }),
  page({
    id: 'afflictions', group: 'character', title: 'Disease and Curses', trigger: 'When you first get sick.',
    body: [
      'Bites and filthy places can make you sick, and diseases get worse over time. Temples, potions and spells cure them.',
      'Vampirism and lycanthropy are curses. Vampires don\'t burn in sunlight here, but they are weaker by day and stronger at night.',
    ],
  }),

  // ── EXPLORING ────────────────────────────────────────────────
  page({
    id: 'automap', group: 'world', title: 'The Map', trigger: 'When you first open the map.',
    body: [
      '{AutoMap} shows a map of where you are: the parts of a dungeon you have explored, or a town\'s streets and buildings.',
      'Drag to move it and scroll to zoom. Right-click to add a waypoint.',
    ],
  }),
  page({
    id: 'dungeons', group: 'world', title: 'Dungeons', trigger: 'When you first enter a dungeon.',
    body: [
      'Dungeons are big and easy to get lost in. Check your map often and look for levers and hidden doors. You leave the way you came in.',
    ],
  }),
  page({
    id: 'searchables', group: 'world', title: 'Searching', trigger: 'When you first search something.',
    body: [
      'You can search coffins, shelves, gravestones, chests and crates. You might find gold, find nothing, or wake something up.',
    ],
  }),
  page({
    id: 'torches', group: 'world', title: 'Torches', trigger: 'When you first light a torch.',
    body: [
      'Hold a torch or lantern in your off hand to see in the dark. {TorchToggleLight} lights it or puts it out, {TorchDrop} drops it and {TorchThrow} throws a torch.',
      'Drawing a two-handed weapon puts your torch out.',
    ],
  }),
  page({
    id: 'crime', group: 'world', title: 'Crime', trigger: 'When the law first catches up with you.',
    body: [
      'Stealing, trespassing and attacking innocents are crimes. When a guard stops you, you can pay the fine, go to court or resist.',
      'Murder and treason get you banished from the region for 30 days. The region\'s temple sells pardons.',
    ],
  }),

  // ── TRAVEL & MOUNTS ──────────────────────────────────────────
  page({
    id: 'travel-map', group: 'travel', title: 'The Travel Map', trigger: 'When you first open the travel map.',
    body: [
      '{TravelMap} opens the map of the whole land. Pick a place to travel there. The trip takes days of game time but only a moment for you.',
      'You choose how fast to go, how to travel and whether to camp or stay at inns. Online, trips over land are walked on the roads instead.',
    ],
  }),
  page({
    id: 'travel-view', group: 'travel', title: 'The Overworld', trigger: 'When you first open the Overworld.',
    body: [
      'Open it with the Overworld button at the bottom of the map. Click a town to travel there by road, or click open ground to go straight there. You can stop and get out anywhere.',
      '{FollowPaths} follows the road ahead.',
    ],
  }),
  page({
    id: 'carriages', group: 'travel', title: 'Carriages', trigger: 'When you first hire a carriage.',
    body: [
      'Carriage drivers wait outside the gates of walled cities. Talk to one to ride to another town for a daily fare, plus inns along the way.',
    ],
  }),
  page({
    id: 'horse', group: 'travel', title: 'Horses', trigger: 'When you first choose how to travel.',
    body: [
      'Every town has a stable that sells horses. {Transport} picks how you travel: on foot, on horseback or by cart.',
      '{HorseMount} gets on and off. Your horse walks; hold {Run} to gallop. Don\'t gallop into people in town: trampling them is a crime. {HorseSummon} calls your horse and wagon to you.',
    ],
  }),
  page({
    id: 'wagon', group: 'travel', title: 'Wagons', trigger: 'When you first use a wagon.',
    body: [
      'Wagon yards sell carts and wagons for carrying cargo. The Open Wagon and the Caravan need two horses.',
      'Don\'t leave a wagon on a town road. After ten minutes the watch drags it out of town, cargo and all.',
    ],
  }),
  page({
    id: 'portal-stone', group: 'travel', title: 'Portal Stones', trigger: 'When you first use a portal stone.',
    body: [
      'Use a portal stone and pick any place on the map. A portal opens for 30 seconds, and online anyone nearby can follow you. Each stone works once.',
      'They don\'t work indoors, in dungeons or near enemies.',
    ],
  }),

  // ── TOWNS, TRADE & GUILDS ────────────────────────────────────
  page({
    id: 'talk', group: 'towns', title: 'Talking', trigger: 'When you first talk to someone.',
    body: [
      'Ask people for directions, news or work. Your tone, their mood and your reputation change what they tell you.',
      'Ask about a building more than once and they may mark it on your map.',
    ],
  }),
  page({
    id: 'shops', group: 'towns', title: 'Shops', trigger: 'When you first trade with a shopkeeper.',
    body: [
      'Each shop buys certain goods. Pawnbrokers take almost anything. Smiths buy weapons and armour and do repairs.',
      'Prices depend on your Mercantile skill. Most shops close at night.',
    ],
  }),
  page({
    id: 'bank', group: 'towns', title: 'Banks', trigger: 'When you first visit a bank.',
    body: [
      'Banks keep your gold safe and write letters of credit, which weigh nothing. They also give loans and sell houses and ships. Each region\'s bank has its own accounts.',
    ],
  }),
  page({
    id: 'guilds', group: 'towns',
    // AUDIT GUILD-WORDS II F-7: the whole page in the player's language, as its online point is - not English around it
    get title() { return t('tutorials.guilds.title', 'Guilds'); },
    get trigger() { return t('tutorials.guilds.trigger', 'When you first visit a guild.'); },
    get body() {
      return [
        t('tutorials.guilds.body1', 'Join a guild for its services and its quests. To rank up, raise the skills it cares about and keep working for it.'),
        t('tutorials.guilds.body2', 'You can join one temple and one knightly order, and as many guilds as will take you.'),
      ];
    },
    // SEAT-WORDS (Field-Bugs-2026-10-15g): online a review stops at 7 - the page said "to rank up, keep working for it";
    // AUDIT GUILD-WORDS II C-2: ranks 8 and 9 are chairs - a seat is a town's (GUILD3, ONE WORD ONE THING)
    get points() { return [t('tutorials.guilds.online', 'Online, a review stops at rank {cap}: ranks {officer} and {master} are chapter chairs. See Guild Chapters.', { cap: ROLL_BOOK_RANK_MAX, officer: SEAT_RANK.officer, master: SEAT_RANK.master })]; },
  }),
  page({
    id: 'tavern', group: 'towns', title: 'Taverns', trigger: 'When you first visit a tavern.',
    body: [
      'Taverns sell food, drink and rooms. A rented room is the safest place to sleep, and the regulars are good for news and work.',
    ],
  }),
  page({
    id: 'tavern-cards', group: 'towns', title: 'Card Games', trigger: 'When you first sit at a card table.',
    body: [
      'Play Texas Hold\'em, Iliac Hand or The King\'s Gambit against the locals - the first two against other players too. Online, one table plays for real gold.',
      'Cards you collect go in your Card Binder. See them under Menu > Holdings > Collections.',
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
        t('tutorials.kingsGambit.body1', 'A battle of armies and kings on a board laid across a tavern card table. Choose a regular to play against, put down your stake and build your army.'),
        t('tutorials.kingsGambit.body2', 'Each turn, move your pieces, strike and drink potions. Fell the other king to win - and guard your own.'),
      ];
    },
  }),
  page({
    id: 'holdings', group: 'towns', title: 'Houses', trigger: 'When you first look at buying or renting a house.',
    body: [
      'Offline, banks sell houses. Online, you can buy up to three empty houses at their front doors and choose who can come in.',
      'A house is a safe place to sleep, store your things and decorate.',
    ],
  }),
  page({
    id: 'notice-board', group: 'towns', title: 'Notice Boards', trigger: 'When you first read a notice board.',
    body: [
      'Online, a town\'s notice board has player notices, work orders, the market, player stalls and guild news.',
    ],
  }),

  // ── QUESTS & BOUNTIES ────────────────────────────────────────
  page({
    id: 'quests', group: 'quests', title: 'Quests', trigger: 'When you first get quest news or open your log.',
    body: [
      '{LogBook} and the menu\'s Quests tab keep track of your quests. Read them closely. They tell you who to find and where.',
      'Many quests have a time limit. Turning down work costs nothing, except in the main story.',
    ],
  }),
  page({
    id: 'quest-guide', group: 'quests', title: 'Tracking Quests', trigger: 'When you first track a quest.',
    body: [
      'A tracked quest shows in the top right, with its goal marked on your compass and map. Settings > Features sets how exact the markers are.',
    ],
  }),
  page({
    id: 'bounties', group: 'quests', title: 'Bounties', trigger: 'When you first read a bounty board.',
    body: [
      'Bounty boards list four hunts. Take one, kill the targets and come back for gold and an item. It also raises your standing in the region.',
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
      '{QuickLootAll} takes everything from a body or pile. {QuickLootOpen} opens the full loot window.',
      'An item\'s colour shows how rare it is: Common, Magic, Rare or Legendary. Rarer items have more and better bonuses.',
    ],
  }),
  page({
    id: 'materials', group: 'loot', title: 'Materials Bag', trigger: 'When you first gather a crafting material.',
    body: [
      'Online, a Materials Bag carries up to 300 kg of crafting materials without weighing you down. General stores sell them, one per player.',
    ],
  }),
  page({
    id: 'reforge', group: 'loot', title: 'Reforging', trigger: 'When you first visit the Reforge.',
    body: [
      'The Reforge at the Mages Guild rerolls one bonus on a Magic or Rare item for Welkynd Shards and gold. It can also take a gem out of a socket.',
      'Salvage turns gear you don\'t want into Welkynd Shards.',
    ],
  }),
  page({
    id: 'gem-sockets', group: 'loot', title: 'Gems', trigger: 'When you first set a gem.',
    body: [
      'Weapons have one to three sockets, depending on size. Armour has one. Setting a gem is free and adds its bonus to the item.',
    ],
  }),
  page({
    id: 'sigil-sets', group: 'loot', title: 'Sigil Sets', trigger: 'When you first look at a set item.',
    body: [
      'Items with the same sigil form a set. Wear 2, 4 or 6 pieces for set bonuses, which grow with your Renown and your weakest piece.',
      'Sets only work online and never in duels. The Sigil Broker sells set pieces for Deadlands Embers.',
    ],
  }),

  // ── PROFESSIONS & SURVIVAL ───────────────────────────────────
  page({
    id: 'foraging', group: 'livelihood', title: 'Gathering', trigger: 'When you first gather something.',
    body: [
      'With the right tool you can gather herbs, ore, wood, fish and game. Look at something you can gather and pick an action. {ActChoice} cycles through them.',
    ],
  }),
  page({
    id: 'professions', group: 'livelihood', title: 'Professions', trigger: 'When you first gather something.',
    body: [
      'Online, gathering, crafting and selling level up your professions. {Professions} opens them and your Stores, where your stored goods are kept.',
    ],
  }),
  page({
    // AUDIT C&C S13: the words true - the page opens on the first need's tile of any kind (enhancedHud.js: the wet, the
    // warm, the drink and the stiff morning too), and the tiles stand at the screen's left edge, not beside the bars
    id: 'survival', group: 'livelihood', title: 'Hunger and Cold', trigger: 'When a need first shows on your screen.',
    body: [
      'You need food, water, warmth and sleep. Icons at the screen\'s left edge show what you are short on, and on Boons what you have earned.',
      'Survival can be Off, Boons (the default), Casual or Hard. On Boons, needs met give bonuses; on Hard, needs can hurt you and make you sick. Change it in Settings > Features.',
    ],
  }),

  // ── SHIPS & THE SEA ──────────────────────────────────────────
  page({
    id: 'ships', group: 'sea', title: 'Sailing', trigger: 'When you first board a boat.',
    body: [
      'Shipyards in port towns sell ships. A rowboat comes as parts: use them by any water. A bigger ship is laid up where you bought it: bring it round from the shipyard\'s Your fleet page.',
      'At the helm, {BoatToggleSail} raises or lowers the sail and {BoatSailUp} and {BoatSailDown} set how much. {BoatDisembark} leaves the helm.',
    ],
  }),
  page({
    id: 'shipyard', group: 'sea', title: 'Shipyards', trigger: 'When you first visit a shipyard or a shipwright.',
    body: [
      'Port towns have a shipyard by the water. The shipmaster sells ships and buys yours, and repairs and refits any ship of yours in port.',
      'Its crew hall has new sailors to hire each day. You can also reach the shipwright from the helm in a port\'s harbour.',
    ],
  }),
  page({
    id: 'lighthouse', group: 'sea', title: 'Lighthouses', trigger: 'When you first climb a lighthouse.',
    body: [
      'Port towns have a lighthouse, lit from dusk to dawn. Talk to the keeper or use the tower\'s door to climb to the gallery.',
      'Use the hatch on the gallery to climb back down.',
    ],
  }),
  page({
    id: 'naval-combat', group: 'sea', title: 'Fighting at Sea', trigger: 'When you first take a ship\'s cargo.',
    body: [
      'Turn side-on to a ship, hold {SwingWeapon} to aim a broadside and let go to fire. Damage a ship until it surrenders, then board it and take its cargo.',
      'Piracy is a crime.',
    ],
  }),

  // ── CHALLENGES ───────────────────────────────────────────────
  page({
    id: 'arena', group: 'challenges', title: 'The Arena', trigger: 'When you first visit the arena.',
    body: [
      'The arena is in the province\'s capital. Talk to the Herald at the gate to fight. The recruiters let you join a team, and the bookmaker takes bets.',
      'The ladder has ten tiers and pays up to 10,000 gold. One loss ends your run, and potions aren\'t allowed.',
    ],
  }),
  page({
    id: 'oblivion-gate', group: 'challenges', title: 'Dagon\'s Breach', trigger: 'When you first go through Dagon\'s Breach.',
    body: [
      'Online, Dagon\'s Breach opens every two hours for ten minutes. The sky turns red and the map marks it about fifteen minutes before. Walk through to fight the boss with everyone else.',
      'Everyone gets their own loot: gold, gear, a Deadlands Ember and maybe a piece of Ruhn\'s Regalia.',
    ],
  }),
  page({
    id: 'abyss', group: 'challenges', title: 'The Abyss Dungeon', trigger: 'When you first enter the Abyss Dungeon.',
    body: [
      'Online, there is one Abyss Dungeon at a time, near a city in the busiest region. Look for the column of light, or listen to the city\'s tavern talk.',
      'The Rift at the end leads to the Shattered Hour and the Brass Remnant. You only get one life in there.',
    ],
  }),
  page({
    id: 'ocean-holes', group: 'challenges', title: 'Ocean Holes', trigger: 'When you first dive into an Ocean Hole.',
    body: [
      'Black holes in the seabed, under purple mist, lead down to flooded dungeons. Watch your breath.',
    ],
  }),

  // ── FAMILY & LEGACY ──────────────────────────────────────────
  page({
    id: 'legacy', group: 'legacy', title: 'Family', trigger: 'When your heir first takes over.',
    body: [
      'Become friends with someone, court them in conversation and marry at their town\'s temple. You may have children.',
      'In an Enduring family you get back up after death. In a Bloodline family death is permanent and your heir takes over. {LegacyFamily} opens your family tree.',
    ],
  }),
  page({
    id: 'revenants', group: 'legacy', title: 'Revenants', trigger: 'When you first meet a revenant.',
    body: [
      'When an elite enemy kills you or gets away, it can come back as a revenant: named, stronger and better armed.',
      'Beat it and it kneels. Then you choose whether to kill it or spare it.',
    ],
  }),
  page({
    id: 'companions', group: 'legacy', title: 'Companions', trigger: 'When a revenant first kneels to you.',
    body: [
      'Spare a revenant and it swears to follow you. You can have six, with three at your side. Manage them under Menu > Holdings.',
    ],
  }),

  // ── PLAYING ONLINE ───────────────────────────────────────────
  page({
    id: 'online', group: 'online', title: 'Playing Online', trigger: 'When you first play online.',
    body: [
      'Online, everyone shares the same world, time, weather and events. The game doesn\'t pause when you open the menu.',
    ],
  }),
  page({
    id: 'chat', group: 'online', title: 'Chat', trigger: 'When you first open chat.',
    body: [
      '{ActivateCursor} opens chat. The tabs pick who hears you: World, Region, Local, and Party or Guild if you are in one.',
    ],
  }),
  page({
    id: 'party', group: 'online', title: 'Other Players', trigger: 'When you first interact with another player.',
    body: [
      'Look at a player and press {SocialInteract} to add them as a friend, invite them to your party, trade or inspect them. With nobody in front of you, it opens your friends list.',
    ],
  }),
  page({
    id: 'player-trade', group: 'online', title: 'Trading', trigger: 'When you first trade with a player.',
    body: [
      'You each put up what you are offering. Nothing changes hands until you both accept.',
    ],
  }),
  page({
    id: 'duel', group: 'online', title: 'Duels', trigger: 'When you are first challenged to a duel.',
    body: [
      'Challenge a player from their Inspect card. A duel doesn\'t touch your real health. Nobody dies and nobody breaks the law.',
    ],
  }),
  page({
    id: 'wild-zone', group: 'online', title: 'The Open Zone', trigger: 'When you first enter the open zone.',
    body: [
      'Players can fight each other in the Wrothgarian Mountains. Monsters are tougher and loot is better.',
      'If you die there, you drop what is in your bag and cart, and your killer can take one item you were wearing.',
    ],
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
        t('tutorials.chapters.body1', 'Online the realm keeps your guild standing. Quests raise it at most {max} a real day each (days turn at midnight UTC), the rest following later.', { max: ROLL_GAIN_DAY_MAX }),
        t('tutorials.chapters.body2', 'Reviews promote you up to rank {cap}; ranks {officer} and {master} are chapter chairs, won by Merit at each Sunday\'s Turning. A notice board explains chapters.', { cap: ROLL_BOOK_RANK_MAX, officer: SEAT_RANK.officer, master: SEAT_RANK.master }),
      ];
    },
  }),
  page({
    id: 'player-guilds', group: 'online', title: 'Player Guilds', trigger: MENU_ONLY,
    body: [
      'Players can start guilds with a shared vault and guild chat. A guild can claim a palace town as its seat, but has to hold it against sieges.',
    ],
  }),
  page({
    id: 'world-events', group: 'online', title: 'Raids and Caravans', trigger: MENU_ONLY,
    body: [
      'Every day, raiders attack a town somewhere. Drive them off to raise your standing. Caravans travel the roads, and you can attack, guard or trade with them.',
    ],
  }),
]);

/** The welcome tour: the pages a new character reads first, in order, in one box. */
export const TUTORIAL_TOUR = Object.freeze(['welcome', 'movement', 'interacting', 'hud', 'menu']);
