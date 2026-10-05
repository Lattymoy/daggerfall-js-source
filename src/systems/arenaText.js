// ARENA1 (2026-10-02): THE ARENA'S WORDS, in one frozen table so a test can pin them (the gate chart's
// GATE_CHART_TEXT is the precedent). Mac, 2026-10-02: "All aspects ... All UI elements and text must be enhanced UI
// plus" - the lines here are said through the port's one box (ui/actionText.js ActionTextBox), which the enhanced
// skin draws as its notice panel (ui/enhancedNotice.js) and the classic skin as Daggerfall's parchment.
//
// ARENA2 (2026-10-02): THE BOUTS' WORDS - the Herald's choice at the gate, his calls and verdicts on the sand, the
// countdown, the crowd's barks, the HUD's labels and the refusals of a bout in play (bible/11-Multiplayer/Arena.md
// "2. The fights", "4. The crowd"). The house tone (bible/10-UI/UI-Arc.md SITE2, the Plainer Menus pass): plain player
// English, short lines, " - " between clauses and never a long dash, no engine words. The crowd talks as an Iliac Bay
// crowd would - rough, partisan, a little funny. Lines that take a name are functions; everything is frozen.

import { goldSum } from './homeWords.js';   // AUDIT HOME-PRICE C4: a home's sums with their thousands

const F = Object.freeze;

export const ARENA_TEXT = F({
  /** The Herald at the gate, before ARENA2 (kept: the classic skin's parchment still reads a box of lines). */
  heraldNotice: F([
    'The Arena of Daggerfall',
    '',
    'Hear me! The gates of the arena stand open.',
    'Bouts begin soon. The Red and Blue Banners are',
    'taking names, and the bookmaker is taking bets.',
    '',
    'Come back when the drums sound.',
  ]),
  /** The Daggerfall Bank's letter, when a house that stood where the arena stands is moved (systems/arenaMove.js).
   *  ARENA2: the old house's furniture does not fit the new one - what the owner placed goes back to the owner's
   *  furnishings, and what the chests and the floor held waits in the new house's first chest (or a crate). */
  deedMoved: F([
    'A letter from the Daggerfall Bank:',
    '',
    'By order of the Court, your house was cleared',
    'to make way for the Arena of Daggerfall.',
    'Your deed now names a similar house in the city.',
    'Your placed furniture is back in your furnishings.',
    'Everything from your chests and floors',
    'waits in a chest in the new house.',
  ]),
  /** The notebook's line for the same move (`%s` the new house's name). */
  deedMovedNote: 'The Daggerfall Bank moved my deed to %s. The arena took my old house.',
  /** ARENA4b: AN ONLINE HOME THE ARENA DISPLACED (server-account/src/homes.js arenaMoveHome, systems/onlineHomes.js
   *  moveArenaHomes) - its owner hears the bank's letter above and the notebook's line; these are the rest: the pieces
   *  bought from the catalogue paid back whole, a guild hall's letter (its keepers'), a room whose tenant the move
   *  carried, and the service's refusals (net/accountClient.js REFUSALS reads them). */
  homeMove: F({
    refund: (gold) => `${goldSum(gold)} gold for your catalogue pieces was refunded to your bank account.`,
    hallMoved: F([
      'A letter from the Daggerfall Bank:',
      '',
      'By order of the Court, your guild hall was cleared',
      'to make way for the Arena of Daggerfall.',
      'The hall now stands in another house in the city.',
      'The treasury was refunded for its pieces.',
    ]),
    hallNote: 'The Daggerfall Bank moved our guild hall to %s. The arena took the old one.',
    /** The notebook's `%s` for a house whose name the city does not give. */
    aHouse: 'a house in Daggerfall',
    tenants: (n) => (n === 1 ? 'A tenant\'s room moved too. It closes when its rent runs out.'
      : `${n} tenants' rooms moved too. They close when their rent runs out.`),
    roomMoved: (n) => `Room ${n} (moved, closes when its rent runs out)`,
    arena: 'The arena stands where that house was. It is not for sale.',
    unmoved: 'That home is outside the arena. It does not need to move.',
    changed: 'Your home changed during the move. It will move next time you play online.',
  }),

  /** ARENA-FIX 2: THE GATE'S PEOPLE BY THEIR OFFICE (world/arenaCity.js ARENA_GATE_PEOPLE `role`) - the name on the
   *  hover plaque, in "You see ..." and in the talk window, never a name drawn from the city's bank: a crier, a
   *  banner's recruiter and a bookmaker are known at the gate by what they do. */
  gateNames: F({
    herald: 'The Herald of the Arena',
    redRecruiter: 'Red Banner Recruiter',
    blueRecruiter: 'Blue Banner Recruiter',
    bookmaker: 'The Bookmaker',
    warden: 'Arena Warden',
  }),

  // ── THE HERALD AT THE GATE (ARENA2: a choice; the Arena window is ARENA3's) ──────────────────────────────────
  herald: F({
    /** His greeting, by the hour's state (a bout on the sand, one coming, none). */
    greet: F([
      'Hear me! Steel and sand, blood and glory!',
      'The Arena of Daggerfall welcomes you, friend.',
      'Step closer. The crowd is hungry tonight.',
    ]),
    onNow: (a, b) => `On the sand now: ${a} against ${b}.`,
    nextAt: (hh) => `Next exhibition at ${hh}.`,
    ladderNext: (tier, label) => `Your next bout: ${tier} - ${label}.`,
    ladderDone: 'You are the Grand Champion. Nobody is left to beat.',
    title: (t) => `They call you ${t} here.`,
    /** The choices, as ChoiceWindow labels ("W - Watch the exhibition"). */
    watch: 'W - Watch the bout',
    fight: 'F - Fight',
    hall: "H - Fighters' hall",
    leave: 'L - Leave',
    window: 'A - Arena window',   // ARENA3
    /** The refusals said in his box, beside the choice that cannot be taken. */
    noWatch: 'No bout right now. Come back on the hour.',
    noFight: 'You are too hurt to fight. Rest first.',
    // AUDIT PRE-MERGE 1003 B3: the hour's bout has had its word here - it is not fought again from its call
    underWay: 'It has already begun. Watch from here.',
    watchSeen: 'You saw this bout begin. The next is on the hour.',
    /** A player struck an exhibition fighter: the first time a warning, after it the watch. */
    intrude: 'Hold! That fighter is in a bout. Strike again and the watch will have you.',
    intrudeCrime: 'Guards! Seize that brawler!',
    waitWord: 'Wait for the word!',
    gateOpen: 'The gate is open. The Herald waits outside.',
  }),

  // ── THE BOUT ─────────────────────────────────────────────────────────────────────────────────────────────
  /** The Herald's call (the bout's first phase): the bout's kind, then each fighter as the Herald cries them. */
  call: F({
    exhibition: 'An exhibition bout!',
    ladder: (tier, label) => `${tier} - ${label}!`,
    champion: (tier) => `For the title of ${tier} Champion!`,
    grand: 'For the title of Grand Champion!',
    melee: 'A Grand Melee! Every fighter for themselves!',
    players: 'A rated bout!',   // ARENA4: a bout between players, refereed
    casual: 'A friendly bout! Nothing counts!',   // AUDIT PRE-MERGE 1003b S6: a casual one
    fighter: (name, home) => (home ? `From ${home} - ${name}!` : `${name}!`),
    versus: 'Against...',
    marks: 'Fighters, to your marks!',
  }),
  /** The countdown over the screen (ui/midScreenText.js), one word a second. */
  count: F(['3', '2', '1', 'Fight!']),
  /** The verdicts. `w` the winner's name (or names joined), `l` the loser's. */
  verdict: F({
    yield: (w, l) => `${l} yields! The bout goes to ${w}.`,
    fall: (w, l) => `${l} is down! ${w} takes the bout.`,
    ringout: (w, l) => `${l} is out of the ring! ${w} wins by ring-out.`,
    judges: (w) => `Time! The judges give it to ${w}.`,
    draw: 'Time! The judges call it a draw.',
    grand: (w) => `${w} is the Grand Champion of the Arena!`,
    tier: (w, t) => `${w} is the ${t} Champion!`,
    forfeit: (w, l) => `${l} has left the sand! ${w} wins by forfeit.`,   // ARENA4: a fighter gone from a refereed bout
    void: 'The bout is void.',   // AUDIT ARENA-LADDER A2: a fighter gone from the sand without falling - nothing is won or lost
  }),
  /** The purse, said after the verdict. */
  purse: F({
    won: (gold) => `Purse: ${gold} gold.`,
    favoured: (gold) => `The crowd loves you! Purse: ${gold} gold.`,
    hated: (gold) => `The crowd hates you. Purse cut to ${gold} gold.`,
    lost: 'No purse for the beaten.',
    repeat: 'You have won this bout before, so it pays no purse this time.',   // AUDIT ARENA-LADDER 2: a step won again after a lost run
  }),
  /** The ladder's progress, said after a win. */
  ladder: F({
    boutWon: (n) => `${n} of 3 won in this tier.`,
    champOpen: (tier) => `The ${tier} Champion will see you now.`,
    tierUp: (tier) => `You climb to ${tier}.`,
    runLost: (tier) => `Your run in ${tier} is over. Win three in a row to face its champion.`,   // AUDIT ARENA-LADDER: a loss breaks the tier's run
    /** ARENA3: the team points a win gave the banner worn. */
    points: (n, b) => `${n} point${n === 1 ? '' : 's'} for ${b}.`,
  }),
  /** The healers: the duel's own heal, said. */
  healed: 'The arena\'s healers see to your wounds.',
  /** ARENA-ARROWS: what the keepers gather off the sand and hand back (systems/arenaQuiver.js). */
  ammoBack: (n) => (n === 1 ? 'The keepers hand back the shot you loosed.' : `The keepers hand back the ${n} shots you loosed.`),
  /** What a bout in play will not allow (the duel's law). */
  refuse: F({
    rest: 'You cannot rest during a bout.',
    travel: 'Finish your bout first.',
    door: 'The gates stay shut until the bout ends.',
    save: 'You cannot save during a bout.',
    map: 'Nothing to map here but sand.',
    yieldEarly: 'You can only yield when badly hurt.',
    potion: 'No potions on the sand.',   // AUDIT ARENA-LADDER: the kit law (systems/arenaKit.js)
    magic: 'That magic is not allowed on the sand.',
  }),
  /** The way out of the floor, on the plaque. */
  wayOut: 'The gate to the city',

  // ── THE CROWD ──────────────────────────────────────────────────────────────────────────────────────────
  /** Barks by what just happened (systems/arenaCrowd.js crowdBark picks one, never the same twice running). */
  barks: F({
    hit: F(['Again!', 'Hit him!', 'Yes!', 'That\'s the way!', 'Harder!', 'Give it to them!']),
    hitHated: F(['Boo!', 'Cheat!', 'Get off the sand!', 'Dirty fighter!']),
    crit: F(['Blood! Blood on the sand!', 'Oh, that one hurt!', 'Did you see that?', 'Right in the guts!']),
    knockdown: F(['Get up, you dog!', 'Down he goes!', 'Stay down!', 'He felt that one in Sentinel!']),
    stall: F(['Is that a sword or a spoon?', 'Fight, you cowards!', 'My gran hits harder!', 'Are you dancing or fighting?', 'Wake up!']),
    flee: F(['Coward!', 'Stand and fight!', 'Run home to your mother!', 'Where are you going?']),
    comeback: F(['Not done yet!', 'On your feet!', 'Look at that!', 'Here we go!']),
    yield: F(['Shame!', 'Soft!', 'Give us our money back!']),
    fall: F(['That\'s it!', 'Finished!', 'Carry him out!']),
    ringout: F(['Out! Out!', 'Off the sand!', 'Over the line!']),
    timeout: F(['Booo!', 'Call that a fight?', 'Judges, are you blind?']),
    roar: F(['Arena! Arena!', 'More! More!', 'Blood and sand!']),
    beast: F(['Not fair!', 'Feed him to it!', 'Let the beast go!']),
  }),
  /** A home town's chant, roared for its own fighter ("Wayrest! Wayrest!"). */
  chant: (town) => `${town}! ${town}!`,
  /** The crowd's mood, by its band (ui/arenaHud.js). */
  mood: F({ boo: 'Booing', jeer: 'Jeering', murmur: 'Murmuring', cheer: 'Cheering', roar: 'Roaring' }),

  // ── THE HUD ────────────────────────────────────────────────────────────────────────────────────────────
  hud: F({
    crowd: 'Crowd',
    stamina: 'Stamina',
    yieldHint: 'Sheathe your weapon to yield.',
    timeLeft: (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`,
    darling: 'Darling',
    villain: 'Villain',
    you: 'You',
    out: F({ yield: 'Yielded', fall: 'Down', ringout: 'Out' }),
    vs: 'vs',
    eachAlone: 'each alone',   // ARENA-TEAMS: a Grand Melee's middle word - the right column is no team
  }),

  // ── THE LADDER (ARENA2 offline; the Arena window is ARENA3's) ──────────────────────────────────────────
  /** The ten tiers' names (the design table) and the title each tier's champion beaten gives. */
  tiers: F(['The Pit', 'Bloodied', 'Sworn', 'Gladiator', 'Myrmidon', 'Bloodsworn', 'Hero', 'Champion', 'Paragon', 'The Grand Melee']),
  titles: F(['Pit Fighter', 'Bloodied', 'Sworn', 'Gladiator', 'Myrmidon', 'Bloodsworn', 'Hero', 'Champion', 'Paragon', 'Grand Champion']),
  /** A bout's label on the ladder. */
  boutLabel: (n) => `bout ${n} of 3`,
  champLabel: 'the Tier Champion',
  grandLabel: 'the Grand Champion',
  /** The epithets a fighter is given (by the bout's seed): "Gorlak gro-Mazgul of Wayrest, the Unbroken". */
  epithets: F([
    'the Unbroken', 'the Butcher', 'the Lion of the Bay', 'Iron-Hand', 'the Grinning', 'Bonecrusher', 'the Quick',
    'the Red', 'the Patient', 'the Wolf', 'Half-Ear', 'the Hammer', 'Dawnblade', 'the Scarred', 'the Mountain',
    'Ironjaw', 'the Viper', 'the Unlucky', 'Stormfist', 'the Grey', 'the Smiling', 'Kingsbane', 'the Bear', 'the Last',
  ]),
  /** A beast's billing ("The Grizzly Bear of the Wrothgarian Mountains"). */
  beast: (kind, from) => `The ${kind} of ${from}`,

  // ── THE UNDERCROFT - THE FIGHTERS' HALL (ARENA-FIX 4; world/arenaUndercroft.js) ─────────────────────────────
  undercroft: F({
    /** Its name - over the stair down ("To The Arena Undercroft") and wherever the place is named. */
    name: 'The Arena Undercroft',
    /** The hall's people with an office, by it (the fighters at rest keep their own names). */
    names: F({ pitMaster: 'The Pit Master', hallKeeper: 'Keeper of the Hall', armourer: 'Arena Armourer', keeper: 'Arena Keeper' }),
    /** The Pit Master's word and his choice (a ChoiceWindow). */
    pitGreet: F([
      'The training pit. No purse, no crowd, no shame.',
      'Spar with one of my fighters to train for the next tier.',
    ]),
    pitFight: 'S - Spar',
    pitLeave: 'L - Leave',
    pitHurt: 'You are too hurt to spar. See a healer first.',
    pitBusy: 'Finish your current bout first.',
    /** The practice bout: its call, its sparring partner's billing, its end. */
    practiceCall: 'A practice bout! To the first fall or yield!',
    practiceLabel: 'Practice',
    practiceWon: 'Good. The next tier will not be so kind.',
    practiceLost: 'On your feet. Again, when you are ready.',
    practiceDraw: 'Time. Neither of you learned much from that.',
    /** A chained beast struck: the keepers' warning. */
    chained: 'Leave the beasts alone. They are for the arena.',
    /** The Hall of Champions, as its keeper reads the names cut in the stone. */
    hallTitle: 'The Hall of Champions',
    hallIntro: 'The names on this wall are the arena\'s champions.',
    hallGrand: (name) => `Grand Champion - ${name}`,
    hallTierName: (n, tier) => `Tier ${n}, ${tier}`,
    hallTier: (tier, title, name) => `${tier} - ${name}, ${title}`,
    hallNone: 'No name is cut here yet.',
    hallYours: (n) => `Your name is cut here ${n === 1 ? 'once' : `${n} times`}.`,
    /** ARENA3: the banners' Grand Champions this save has seen, under the player's own. */
    hallNotYou: 'Your name is not cut here yet.',
    hallTheirs: 'The Grand Champions of the Arena:',
    hallTheir: (year, who, banner) => `3E ${year} - ${who}, for ${banner}`,
    /** ARENA5: the plaque wall (world/arenaPlaques.js) - a plaque's name on the hover plaque, and what its press reads
     *  (`banner` the banner's name inside a sentence, or empty; `season` its words); a plaque with no name cut in it says
     *  the stone's own `hallNone`. */
    plaqueTitle: (name) => `${name}, Grand Champion`,
    plaqueBare: 'An empty plaque',
    plaqueLine: (name, banner, season) => `${name} - Grand Champion of the Arena${banner ? `, for ${banner}` : ''}, ${season}.`,
  }),

  // ── YOUR LADDER REPLAY (ARENA5; systems/arenaReplay.js) ─────────────────────────────────────────────────────
  replay: F({
    /** The Herald's call over a replay - the bout's own, from the records. */
    call: (tier, label) => `From the records: ${tier}, ${label}!`,
    callBare: 'A bout from the records!',
    /** His choice and his line before it (the last bout kept). */
    herald: 'R - Replay last bout',
    heraldLine: 'You can replay your last bout.',
    /** The Records page's press on a bout the records keep; its refusals. */
    press: 'Replay',
    gone: 'That bout is no longer on record.',
    offline: 'Replays are offline only.',
  }),

  // ── THE BANNERS (ARENA3; systems/arenaLeague.js) ────────────────────────────────────────────────────────────
  teams: F({
    /** The banners' names, their short names and their mottoes, as the recruiters and the window say them. */
    name: F({ red: 'The Red Banner', blue: 'The Blue Banner' }),
    short: F({ red: 'Red', blue: 'Blue' }),
    /** The banners named inside a sentence ("You fight under the Red Banner."). */
    the: F({ red: 'the Red Banner', blue: 'the Blue Banner' }),
    motto: F({ red: 'Blood before bread.', blue: 'Steel before silver.' }),
    /** What each company is, in a line - the Team page's and the recruiter's. */
    lore: F({
      red: 'The oldest company in the arena. Crimson and gold, and loud.',
      blue: 'Drilled fighters in azure and silver. Patient and hard to break.',
    }),
    season: (year) => `the season of 3E ${year}`,
    seasonDay: (day) => `day ${day} of 360`,
    standing: (red, blue) => `Red Banner ${red} - Blue Banner ${blue}`,
    leads: (b) => `${b} leads the season.`,
    level: 'The banners are tied.',
    laurel: (b) => `${b} won last season and wears the laurel.`,
    laurelYou: 'You wear the laurel. The crowd starts on your side.',
    none: 'You have not joined a banner.',
    under: (b) => `You fight for ${b}.`,
    given: (n) => `You have ${n} point${n === 1 ? '' : 's'} this season.`,
  }),
  /** The Red and Blue Banners' recruiters at the gate (systems/arenaHerald.js recruiterChoice). `b` the banner's name. */
  recruiter: F({
    greet: F({
      red: F(['The Red Banner! Oldest company on this sand.', 'We were fighting the Bay\'s tourneys before the Blue had a flag.']),
      blue: F(['The Blue Banner takes fighters, not braggarts.', 'Discipline wins seasons. Ask anyone who has faced our line.']),
    }),
    pitch: 'Join us and your ladder wins score for the banner.',
    rule: 'Joining is free. Switch banners and you wait a season.',
    yours: (b) => `You already fight for ${b}.`,
    theirs: (b) => `You fight for ${b}. Quit with their recruiter first.`,
    wait: (b) => `You quit ${b} this season. Come back next season.`,
    join: (b) => `J - Join ${b}`,
    quit: (b) => `Q - Quit ${b}`,
    window: 'A - Arena window',
    leave: 'L - Leave',
    askQuit: (b) => `Quit ${b}? Your points stay with them, and you wait a season to switch.`,
    yes: 'Y - Yes, quit',
    no: 'N - No, stay',
    joined: (b) => `Welcome to ${b}! Your ladder wins now count for us.`,
    quitDone: (b) => `You quit ${b}. You can join the other banner next season.`,
  }),

  // ── THE BOOKMAKER (ARENA3; systems/arenaBook.js) ──────────────────────────────────────────────────────────────
  book: F({
    greet: F(['Odds! Fair odds on the hour\'s bout!', 'Every fighter has a price, friend.']),
    shut: 'Closed for the night. Betting opens at 08:00.',
    bout: (a, b) => `This hour: ${a} against ${b}.`,
    priced: (name, price, record) => `${name}: ${price} (${record}).`,
    edge: 'The house keeps a tenth of every price.',
    standing: (line) => `You have ${line}.`,
    owes: (gold) => `I owe you ${gold} gold.`,
    collect: (gold) => `C - Collect ${gold} gold`,
    back: (key, name, price) => `${key} - Bet on ${name} at ${price}`,
    window: 'W - Arena window',
    leave: 'L - Leave',
    howMuch: (name, price) => `How much on ${name} at ${price}?`,
    stake: (n, gold) => `${n} - ${gold} gold`,
    never: 'N - Never mind',
    taken: (gold, name, price) => `${gold} gold on ${name} at ${price}. Good luck!`,
    paid: (gold) => `The bookmaker pays you ${gold} gold.`,
    evens: 'evens',
    price: (num, den) => `${num} to ${den}`,
    wagerOn: (gold, name, price) => `${gold} gold on ${name} at ${price}`,
    open: 'pending',
    wonLine: (gold) => `won ${gold} gold`,
    drawLine: 'draw, stake returned',
    lostLine: 'lost',
    whyClosed: 'Betting is closed.',
    whyPlaced: 'You already bet on this bout.',
    whyGold: 'You need 10 gold to bet.',
    // AUDIT PRE-MERGE 1003 B4: a favourite shorter than his shortest price (1 to 5) is not laid
    noPrice: 'no price',
    notLaid: (name) => `No bets on ${name}. Too big a favourite.`,
    whyRefused: F({ none: 'No bout this hour.', closed: 'Betting is closed.', placed: 'You already bet on this bout.', stake: 'Bets are 10 to 1000 gold.', gold: 'Not enough gold.', price: 'No bets on that fighter.' }),
  }),

  // ── THE ARENA WINDOW (ARENA3; ui/arenaWindow.js, systems/arenaBoard.js) ───────────────────────────────────────
  window: F({
    title: 'The Arena of Daggerfall',
    tabs: F({ bouts: 'Bouts', ladder: 'Ladder', team: 'Team', boards: 'Leaderboards', records: 'Records', rules: 'Rules' }),
    close: 'Close',
    you: 'You',
    fighter: 'A fighter',
    and: ' and ',
    none: 'None',
    noTitle: 'No title',
    opponent: (kind, level) => `${kind}, level ${level}`,
    seasonLine: (year, day) => `Season of 3E ${year}, day ${day} of 360`,
    seasonShort: (year) => `3E ${year}`,
    recordLine: (w, l) => `${w} won, ${l} lost`,
    wl: (w, l) => `${w}-${l}`,
    gold: (n) => `${n} gold`,
    pursesWon: (n) => `Purses won: ${n} gold`,   // AUDIT PRE-MERGE 1003 U12: the header's chip says what it counts
    days: (n) => `${n} day${n === 1 ? '' : 's'}`,
    cleared: (n, tier) => `Tier ${n}, ${tier}`,
    allTen: 'All tiers cleared',
    leading: (b) => `${b} leads`,
    won: (b) => `${b} won`,
    levelShort: 'Tied',
    owed: (gold) => `The bookmaker owes you ${gold} gold`,
    // Bouts
    exhibitionTitle: (hh) => `Exhibition at ${hh}`,
    onSand: 'On now',
    openNow: 'Betting open',
    opensAt: (hh) => `Starts at ${hh}`,
    playersTitle: 'Player bouts',
    playersLine: 'Player bouts are online only.',
    onlineOnly: 'Online',
    ladderTitle: (tier, label) => `${tier} - ${label}`,
    ladderBout: 'Next ladder bout',
    champBout: 'Champion bout',
    grandBout: 'Grand Champion bout',
    ladderDoneTitle: 'Ladder complete',
    purseLine: (gold) => `Purse: ${gold} gold, more if the crowd loves you.`,
    watch: 'Watch',
    wager: 'Bet',
    placeWager: 'Place bet',   // AUDIT PRE-MERGE 1003 U14: the wager's own press, never a second "Wager"
    fight: 'Fight',
    back: (name) => `Bet on ${name}`,
    vs: 'vs',
    favourite: 'Favourite',
    whyGate: 'Go to the arena gate',
    whyHurt: 'Too hurt to fight',
    whyNotYet: (hh) => `Not until ${hh}`,
    // Ladder
    ladderHead: 'The ten tiers',
    tierState: F({ cleared: 'Cleared', current: 'You are here', locked: 'Locked' }),
    beaten: 'Beaten',
    nextFight: 'Next',
    tierPurse: (bout, champ) => `Purse: ${bout} gold a bout, ${champ} for the champion`,
    titleGiven: (t) => `Beat the champion to earn the title ${t}.`,
    yourTitles: 'Your titles',
    noTitles: 'No titles yet.',
    beastTier: 'Beast fights. The crowd thinks them unfair.',
    meleeTier: 'Grand Melees. Every fighter for themselves.',
    // Team
    standingHead: 'This season',
    rosterHead: (b) => `${b}: top ten`,
    pointsCol: 'Points',
    yourPoints: 'Your points',
    yourWins: 'Ladder wins',
    joinWhere: 'Join a banner at its recruiter by the gate.',
    laurelMark: 'Laurel',
    // Leaderboards
    boards: F({
      pve: 'Highest tier', pveSub: 'Furthest up the ladder this season.',
      fast: 'Fastest Grand Champion', fastSub: 'Fewest days from first bout to the title.',
      fastNone: 'No Grand Champion yet.',
      pvp: 'Season rating', pvpSub: 'Rated bouts between players.',
      pvpNone: 'Player bouts are online only.',
      team: 'Banners', teamSub: 'Points by season. The winner wears the laurel.',
    }),
    cols: F({
      pve: F(['Title', 'Tier', 'Record']), fast: F(['Days', 'Season']), pvp: F(['Rating', 'Record']),
      team: F(['Red', 'Blue', 'Result', 'You']),
    }),
    rank: 'Rank',
    name: 'Fighter',
    season: 'Season',   // AUDIT PRE-MERGE 1003 U11: the banners' board's first column - its rows are seasons, not fighters
    // Records
    stat: F({
      wins: 'Won', losses: 'Lost', share: 'Win rate', yields: 'Yielded', falls: 'Fell', ringouts: 'Ring-outs', streak: 'Streak',
      best: 'Best streak', purses: 'Purses', champions: 'Champions beaten',
    }),
    lastBouts: 'Last 20 bouts',
    noBouts: 'No bouts yet.',
    wagersHead: 'Your bets',
    noWagers: 'No bets placed.',
    wonWord: 'Won',
    lostWord: 'Lost',
    drew: 'Draw',
    how: F({ yield: 'by yield', fall: 'by knockdown', ringout: 'by ring-out', judges: 'by decision', draw: 'time ran out' }),
    pointsWord: (n) => `+${n} for the banner`,
    // Rules
    rules: F([
      F({ head: 'The bouts', lines: F([
        'Bouts are fought in the colosseum before the crowd.',
        'Nobody dies here. A beaten fighter is left barely alive.',
        'A bout ends when a fighter yields, falls or leaves the ring.',
        'Badly hurt? Sheathe your weapon to yield.',
        'After three minutes, the judges decide by damage dealt.',
        'No doors, rest or travel during a bout. Healers come after.',
      ]) }),
      F({ head: 'The ladder', lines: F([
        'Ten tiers of three bouts. Win all three to face the Tier Champion.',
        'Beat the champion to move up and earn a title. Lose and you start the tier again.',
        'Tier champions fight as elites. Watch for the marks of their heavy blows.',
        'No potions on the sand, and no Levitate, Invisibility, Chameleon, Shadow or Calm.',
        'In tier nine you fight two at once. Tier ten is the Grand Melee.',
        'Beat the tier ten champion to become Grand Champion.',
        'The Pit Master in the undercroft will spar with you for practice.',
        // ARENA5: your ladder replay
        'Your last three ladder bouts are saved. Replay them from the Herald or Records.',
        'Replays pay nothing and count for nothing. Leave by the gates any time.',
      ]) }),
      F({ head: 'The banners', lines: F([
        'Join the Red or Blue Banner at its recruiter by the gate. It is free.',
        'Ladder wins score points: 1 a bout, 3 a tier champion, 10 for Grand Champion.',
        'You can quit any time, but must wait a season to join the other banner.',
        'A season lasts a year. The banner with the most points wears the laurel.',
        'The crowd favours laurel wearers all next season.',
      ]) }),
      F({ head: 'Purses and the crowd', lines: F([
        'A win pays 50 gold in the Pit, up to 10,000 for Grand Champion.',
        'The crowd\'s darling earns up to 50% more. Its villain loses up to 25%.',
        'The crowd loves blood and comebacks. It hates stalling, running and early yields.',
      ]) }),
      F({ head: 'Exhibitions and bets', lines: F([
        'An exhibition runs every hour from 08:00 to 21:00, Red against Blue.',
        'Watch from the street or the stands. Do not strike the fighters.',
        'The bookmaker by the gate takes bets of 10 to 1000 gold until the fight starts.',
        'A win pays his odds. A draw returns your stake.',
        // AUDIT PRE-MERGE 1003 B3/B4: a bout walked away from is the house's; a favourite too short is not laid
        'Leave after the bout starts and he keeps your stake. No bets on heavy favourites.',
        'Collect your winnings at his stall. He only pays in person.',
      ]) }),
    ]),
  }),

  // ── THE ARENA ONLINE (ARENA4; net/arenaLaw.js, systems/arenaBoard.js, scenes/arenaOnline.js) ────────────────────
  online: F({
    seasonLine: (n, day) => `Season ${n}, day ${day} of 56`,
    seasonShort: (n) => `Season ${n}`,
    ratingChip: (r) => `Rating ${r}`,
    championTitle: 'Arena Champion',
    rankChip: (n) => `#${n} this season`,
    // the Bouts page: the players' bouts to watch, and the challenge
    liveTitle: 'Live bouts',
    liveLine: (n) => `${n} bout${n === 1 ? '' : 's'} on now.`,
    noLive: 'No bouts on right now.',
    liveLadder: (tier) => `Ladder bout: ${tier}`,
    livePlayers: 'Rated bout',
    liveExhibition: (tier) => `Exhibition: ${tier}`,   // ARENA4b: the relay's exhibition on the list
    watching: (n) => `${n} watching`,
    challengeTitle: 'Challenge',
    queueState: F({ idle: 'Rated', queued: 'Searching', offer: 'Match found', going: 'Starting', off: 'Offline' }),
    findMatch: 'Find match',
    leaveQueue: 'Leave queue',
    accept: 'Accept',
    decline: 'Decline',
    challengeLine: 'Fight a player near your rating.',
    queuedLine: (band, n) => `Searching within ${band} of your rating. ${n} in queue.`,
    offerLine: (name, rating) => `Match found: ${name} (rating ${rating}).`,
    // AUDIT PRE-MERGE 1003 U10: "1 second"; and at 0 the offer is gone - the hall lapses it on its next beat (server
    // _hallTick), so the window says so and offers no Accept that could not land
    offerClock: (s) => (s > 0 ? `Accept within ${s} second${s === 1 ? '' : 's'}.` : 'The offer expired.'),
    goingLine: (name) => `Get ready! ${name} is on the way.`,
    ratingLine: (r, w, l) => `Your rating: ${r} (${w} won, ${l} lost).`,
    whyOffline: 'Online only',
    hallWait: 'Not ready yet. Try again.',   // AUDIT PRE-MERGE 1003 O4: online, the hall's socket still opening
    whyGuest: 'Registered accounts only',
    whyBusy: 'You are in a bout',
    whyQueued: 'You are in the queue',
    // ARENA4b: THE CASUAL BOUT (Arena.md 7: "A casual bout (unranked) may run") - refereed all the same, counted nowhere
    casualMatch: 'Casual bout',
    casualLine: 'Casual bouts are for fun. Nothing counts.',
    casualQueued: (n) => `Searching for a casual bout. ${n} in queue.`,
    casualOffer: 'A casual bout. Nothing counts.',
    casualEnd: 'Casual bout over. Nothing was counted.',
    liveCasual: 'Casual bout',
    // ARENA6: A PRIVATE SESSION - its host opens it and shares its code; whoever joins watches from the stands, and the
    // host calls who fights (the casual bout's law, every fighter equally whole)
    privTitle: 'Private session',
    privTitleIn: (code) => `Private session ${code}`,
    privState: F({ none: 'Host or join', host: 'Hosting', member: 'Watching', fighter: 'Fighting' }),   // AUDIT PRE-MERGE 1003b U7: a fighter is on the sand
    privLine: 'Host a session and pick who fights. Nothing counts.',
    privHost: 'Host',
    privJoin: 'Join',
    privCodeLabel: 'Session code',
    privCodeHint: '6-letter code',
    privBadCode: 'Enter the 6-letter code.',
    privHostGuest: 'Registered accounts only',
    privIn: 'In a private session',
    privShare: (code) => `Share this code: ${code}`,
    privWaitHost: 'Waiting for the host.',
    privPicks: (red, blue) => `Next: ${red || 'not picked'} (Red) vs ${blue || 'not picked'} (Blue).`,   // AUDIT PRE-MERGE 1003b U9: never a bare dash
    privOn: (red, blue) => `Now fighting: ${red} (Red) vs ${blue} (Blue).`,
    privMembers: (n) => `${n} in session`,
    privRole: F({ host: 'Host', red: 'Red', blue: 'Blue', guest: 'Guest', away: 'Away', you: 'You' }),   // AUDIT PRE-MERGE 1003b U10: your own row in words
    privMakeRed: 'Make Red',   // AUDIT PRE-MERGE 1003b U9: the press, never the chip's own word
    privMakeBlue: 'Make Blue',
    privIsRed: 'Already Red',
    privIsBlue: 'Already Blue',
    privAwayWhy: 'Not here',
    privGuestWhy: 'Guests cannot fight',
    privHasResult: 'Bout already decided',   // AUDIT PRE-MERGE 1003b R8/S1
    privLock: 'Lock session',   // AUDIT PRE-MERGE 1003b S4: the host's lock
    privUnlock: 'Unlock session',
    privLocked: 'Locked. Nobody new can join.',
    privRejoin: (code) => `Rejoin ${code}`,   // AUDIT PRE-MERGE 1003b C8
    privQueued: 'Leave the queue first',   // AUDIT PRE-MERGE 1003b U7
    privRemove: 'Remove',
    privStart: 'Start bout',
    privVoid: 'Cancel bout',
    privClose: 'Close session',
    privLeave: 'Leave',
    privNoPicks: 'Pick Red and Blue first',
    privBoutOn: 'Bout in progress',
    privNoBout: 'No bout running',
    privResults: 'Recent results',
    // AUDIT PRE-MERGE 1003b U9/S7: how in words (the Records page's own), and a judges' draw a draw - never "no result", the
    // words of a bout the host ended (which the results never keep)
    privResult: (red, blue, winner, how) => {
      const by = ({ yield: 'by yield', fall: 'by knockdown', ringout: 'by ring-out', judges: 'by decision', forfeit: 'by forfeit' })[how] ?? '';
      return winner === 0 ? `${red} (Red) beat ${blue} (Blue)${by ? ` ${by}` : ''}` : winner === 1 ? `${blue} (Blue) beat ${red} (Red)${by ? ` ${by}` : ''}` : `${red} (Red) and ${blue} (Blue) drew`;
    },
    privEntering: (code) => `Joining session ${code}.`,
    privOutdoors: 'Go outside first, then try again.',   // the floor's door refused
    privToSand: 'The host picked you to fight!',
    privToStands: 'Back to the stands.', privHereHost: (code) => `Session ${code} is open. Share the code to invite players.`, privHereJoined: (code, n) => `Joined session ${code}${n > 0 ? ` with ${n} other${n === 1 ? '' : 's'}` : ''}. The host picks who fights.`,   // HOTFIX 1003e (live: "it puts them in an empty arena by themself"): the session says it is there; HOTFIX 1003f: and its stands are drawn, so nothing is said of them
    privSignIn: 'Sign in and go online to host or join.',   // HOTFIX 1003f: a press with no account held, or no open socket to an arena's relay - the floor would stand empty
    ladderOnline: 'Your ladder is saved to your account.',
    // the boards
    pveSub: 'Furthest up the ladder.',
    fastSub: 'Fewest days from first bout to the title.',
    pvpSub: 'Rated bouts between players this season.',
    pvpNone: 'No rated bouts yet this season.',
    teamSub: 'This season and last. The winner wears the laurel.',
    champion: (name) => `${name} is this season's #1 and wears the laurel.`,
    noChampion: 'No champion yet. It takes 3 rated bouts and the top spot.',
    pvpCells: (w, l, d) => `${w}-${l}${d ? `-${d}` : ''}`,
    reached: (n) => `Bout ${n} of 40`,
    // what a bout's result says, once the service has kept it
    pvpWon: (d, r) => `Victory! Your rating is now ${r} (+${d}).`,
    pvpLost: (d, r) => `Defeat. Your rating is now ${r} (-${d}).`,
    pvpDraw: (r) => `Draw. Your rating stays at ${r}.`,
    unrated: 'Not rated. You have fought this player too often.',   // AUDIT ARENA-LADDER O2: a day's bound, and now a season's
    ladderKept: 'Bout saved to your record.',
    grand: 'You are the Grand Champion of the Arena!',
    order: 'This win was not your next ladder bout, so it does not count.',
    /** AUDIT PRE-MERGE 1003 S4: the service's `reused` - the bout's id is already on the record as another bout. */
    reused: 'This bout was already recorded, so it does not count.',
    forfeit: 'You started another ladder bout before this one was recorded, so it counts as a loss.',   // AUDIT ARENA-LADDER: an attempt left open is forfeit
    ticketFail: 'The Herald could not enter your bout. Try again in a moment.',   // AUDIT ARENA-LADDER: no attempt's ticket from the service
    stillRecording: 'Your last ladder bout is still being recorded. Try again in a moment.',   // AUDIT ARENA-LADDER 2: a ticketed receipt still kept
    guestLadder: 'Register this account to climb the ladder online.',   // AUDIT ARENA-LADDER 2
    guest: 'Register your account to keep your bouts.',
    points: (n, b) => `+${n} for ${b}.`,
    // the stands
    watchingLine: (a, b) => `Watching ${a} vs ${b}.`,
    cheer: 'Cheer',
    boo: 'Boo',
    /** ARENA4b: the keys the stands' two presses answer (ui/arenaHud.js STANDS_KEYS), shown on them. */
    cheerKey: '+',
    booKey: '-',
    seatsFull: 'The stands are full.',
    boutOver: 'That bout is over.',
    // the Hall of Champions, online
    hallTheirs: 'Grand Champions, newest first:',
    hallTheir: (name) => `${name}, Grand Champion of the Arena.`,
    /** ARENA4b: a name on the realm's wall with the season it was cut in (the Keeper's roll, the Leaderboards' Hall). */
    hallTheirAt: (name, season) => `Season ${season} - ${name}, Grand Champion of the Arena.`,
    // ARENA4b: the account's climb, roll and record, before and after the realm's records are in
    climbWait: 'Still loading. Try again in a moment.',
    rollWait: 'The names are not in yet. Ask me again soon.',
    guestBanner: 'Only registered accounts can join a banner.',
    recordsOnline: 'Your record is saved to your account.',
    noBouts: 'No bouts on record yet.',
    noRecent: 'Your recent bouts are still loading.',
    boutWhen: (season, day) => `Season ${season}, day ${day}`,
    ratingMove: (r, d) => `rating ${r} (${d > 0 ? '+' : ''}${d})`,
    unratedShort: 'not rated',
    stat: F({ pveWins: 'Ladder wins', pveLosses: 'Ladder losses', pvpWins: 'Rated wins', pvpLosses: 'Rated losses', pvpDraws: 'Rated draws', rating: 'Season rating' }),
    how: F({ forfeit: 'by forfeit' }),
    rules: F({ head: 'Online', lines: F([
      'Online, your ladder is saved to your account.',
      'Find match pairs you with a player near your rating.',
      'Rated bouts change your rating. A season lasts eight weeks.',
      'The season\'s #1 wears the laurel and is called Arena Champion.',
      'Once you are Grand Champion, the title is yours for good.',
      'Up to sixty players can watch a bout from the stands.',
    ]) }),
  }),
});

/** Every string in ARENA_TEXT (functions called with sample names) - the tone pins walk it. */
export function allArenaLines(t = ARENA_TEXT) {
  const out = [];
  const walk = (v) => {
    if (typeof v === 'string') out.push(v);
    else if (typeof v === 'function') { const s = v('Aldo', 'Bran', 'Cyr'); if (typeof s === 'string') out.push(s); }
    else if (v && typeof v === 'object') for (const x of Object.values(v)) walk(x);
  };
  walk(t);
  return out;
}
