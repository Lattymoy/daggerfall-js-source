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

const F = Object.freeze;

export const ARENA_TEXT = F({
  /** The Herald at the gate, before ARENA2 (kept: the classic skin's parchment still reads a box of lines). */
  heraldNotice: F([
    'The Arena of Daggerfall',
    '',
    'Hear me! The sand is raked and the gates stand open.',
    'Bouts begin soon - the Red Banner and the Blue are',
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
    'By order of the Court, the block where your house stood',
    'is cleared for the Arena of Daggerfall.',
    'Your deed now names a house of the same kind in the city.',
    'The furniture you placed is back among your furnishings,',
    'and everything in your chests and on your floors',
    'waits for you in a chest in the new house.',
  ]),
  /** The notebook's line for the same move (`%s` the new house's name). */
  deedMovedNote: 'The Daggerfall Bank moved my deed to %s - the arena stands where my old house was.',
  /** ARENA4b: AN ONLINE HOME THE ARENA DISPLACED (server-account/src/homes.js arenaMoveHome, systems/onlineHomes.js
   *  moveArenaHomes) - its owner hears the bank's letter above and the notebook's line; these are the rest: the pieces
   *  bought from the catalogue paid back whole, a guild hall's letter (its keepers'), a room whose tenant the move
   *  carried, and the service's refusals (net/accountClient.js REFUSALS reads them). */
  homeMove: F({
    refund: (gold) => `Your catalogue pieces went with the old house: ${gold} gold to the Daggerfall Bank.`,
    hallMoved: F([
      'A letter from the Daggerfall Bank:',
      '',
      'By order of the Court, the block where your guild\'s hall stood',
      'is cleared for the Arena of Daggerfall.',
      'The hall now stands in another house of the city.',
      'What the treasury paid for its pieces is back in the treasury.',
    ]),
    hallNote: 'The Daggerfall Bank moved our guild\'s hall to %s - the arena stands where the old one was.',
    /** The notebook's `%s` for a house whose name the city does not give. */
    aHouse: 'a house in Daggerfall',
    tenants: (n) => (n === 1 ? 'A tenant\'s room moved with it - its days run on, then it is offered to nobody.'
      : `${n} tenants' rooms moved with it - their days run on, then they are offered to nobody.`),
    roomMoved: (n) => `Room ${n} (moved with the house - offered to nobody once its days run out)`,
    arena: 'The Arena of Daggerfall stands where that house was. It is nobody\'s to buy.',
    unmoved: 'That home stands outside the arena\'s block, so it does not need moving.',
    changed: 'Your home changed while it was moved. It is moved the next time you come online.',
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
      'Step closer - the crowd is hungry tonight.',
    ]),
    onNow: (a, b) => `On the sand now: ${a} against ${b}.`,
    nextAt: (hh) => `The next exhibition is at ${hh}.`,
    ladderNext: (tier, label) => `Your next bout: ${tier} - ${label}.`,
    ladderDone: 'You are the Grand Champion. The sand has nothing left to teach you.',
    title: (t) => `They call you ${t} here.`,
    /** The choices, as ChoiceWindow labels ("W - Watch the exhibition"). */
    watch: 'W - Watch the exhibition',
    fight: 'F - Fight on the ladder',
    hall: "H - Go down to the fighters' hall",
    leave: 'L - Leave',
    window: 'A - The Arena window',   // ARENA3
    /** The refusals said in his box, beside the choice that cannot be taken. */
    noWatch: 'No bout on the sand right now - come back on the hour.',
    noFight: 'You are in no state to fight. Rest first, then come back.',
    /** A player struck an exhibition fighter: the first time a warning, after it the watch. */
    intrude: 'Hold! That fighter is in a bout. Strike again and the watch will have you.',
    intrudeCrime: 'Guards! Seize that brawler!',
    waitWord: 'Wait for the word!',
    gateOpen: 'The gate is open - the Herald waits for you outside.',
  }),

  // ── THE BOUT ─────────────────────────────────────────────────────────────────────────────────────────────
  /** The Herald's call (the bout's first phase): the bout's kind, then each fighter as the Herald cries them. */
  call: F({
    exhibition: 'An exhibition bout!',
    ladder: (tier, label) => `${tier} - ${label}!`,
    champion: (tier) => `For the title of ${tier} Champion!`,
    grand: 'For the title of Grand Champion of the Arena of Daggerfall!',
    melee: 'A Grand Melee - every fighter for themselves!',
    players: 'A rated bout between fighters of the realm!',   // ARENA4: a bout between players, refereed
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
    ringout: (w, l) => `${l} is carried off the sand! ${w} wins by ring-out.`,
    judges: (w) => `Time! The judges give it to ${w}.`,
    draw: 'Time! The judges cannot part them - a draw.',
    grand: (w) => `${w} is the Grand Champion of the Arena of Daggerfall!`,
    tier: (w, t) => `${w} is the ${t} Champion!`,
    forfeit: (w, l) => `${l} has left the sand! ${w} wins by forfeit.`,   // ARENA4: a fighter gone from a refereed bout
  }),
  /** The purse, said after the verdict. */
  purse: F({
    won: (gold) => `The purse - ${gold} gold.`,
    favoured: (gold) => `The crowd loves you - the purse is ${gold} gold.`,
    hated: (gold) => `The crowd jeers you - the purse is cut to ${gold} gold.`,
    lost: 'No purse for the beaten.',
  }),
  /** The ladder's progress, said after a win. */
  ladder: F({
    boutWon: (n) => `${n} of 3 won in this tier.`,
    champOpen: (tier) => `The ${tier} Champion will see you now.`,
    tierUp: (tier) => `You climb to ${tier}.`,
    /** ARENA3: the team points a win gave the banner worn. */
    points: (n, b) => `${n} point${n === 1 ? '' : 's'} for ${b}.`,
  }),
  /** The healers: the duel's own heal, said. */
  healed: 'The arena\'s healers see to your wounds.',
  /** What a bout in play will not allow (the duel's law). */
  refuse: F({
    rest: 'You cannot rest with a bout on.',
    travel: 'Not now - you have a bout to finish.',
    door: 'The gates are shut until the bout is done.',
    save: 'You cannot save on the sand.',
    map: 'Nothing to map here but sand.',
    yieldEarly: 'Not yet - you can yield once you are badly hurt.',
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
    yieldHint: 'Badly hurt - sheathe your weapon to yield.',
    timeLeft: (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`,
    darling: 'Darling',
    villain: 'Villain',
    you: 'You',
    out: F({ yield: 'Yielded', fall: 'Down', ringout: 'Out' }),
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
      'Spar with one of my fighters and learn what the next tier will ask of you.',
    ]),
    pitFight: 'S - Spar in the pit',
    pitLeave: 'L - Leave',
    pitHurt: 'You are in no state to spar. See a healer first.',
    pitBusy: 'The pit is in use - finish the bout you are in.',
    /** The practice bout: its call, its sparring partner's billing, its end. */
    practiceCall: 'A practice bout - to the first fall or yield!',
    practiceLabel: 'Practice',
    practiceWon: 'Good. The next tier will not be so kind.',
    practiceLost: 'On your feet. Again, when you are ready.',
    practiceDraw: 'Time. Neither of you learned much from that.',
    /** A chained beast struck: the keepers' warning. */
    chained: 'Leave the beasts be - they are saved for the sand.',
    /** The Hall of Champions, as its keeper reads the names cut in the stone. */
    hallTitle: 'The Hall of Champions',
    hallIntro: 'The names cut in this wall are the arena\'s own.',
    hallGrand: (name) => `Grand Champion of the Arena of Daggerfall - ${name}`,
    hallTierName: (n, tier) => `Tier ${n}, ${tier}`,
    hallTier: (tier, title, name) => `${tier} - ${name}, ${title}`,
    hallNone: 'No name is cut here yet. The stone waits for one.',
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
    plaqueLine: (name, banner, season) => `${name} - Grand Champion of the Arena of Daggerfall${banner ? `, for ${banner}` : ''}, ${season}.`,
  }),

  // ── YOUR LADDER REPLAY (ARENA5; systems/arenaReplay.js) ─────────────────────────────────────────────────────
  replay: F({
    /** The Herald's call over a replay - the bout's own, from the records. */
    call: (tier, label) => `From the records - ${tier}, ${label}!`,
    callBare: 'From the records - a bout fought again!',
    /** His choice and his line before it (the last bout kept). */
    herald: 'R - Watch your last bout again',
    heraldLine: 'The records keep your last bout - it can be fought again, for your eyes only.',
    /** The Records page's press on a bout the records keep; its refusals. */
    press: 'Watch the replay',
    gone: 'That bout is no longer in the records.',
    offline: 'Replays are kept offline - online the realm keeps its own records.',
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
      red: 'The oldest company on the sand - crimson and gold, loud in the stands and louder on it.',
      blue: 'A company of drilled fighters - azure and silver, patient, hard to break.',
    }),
    season: (year) => `the season of 3E ${year}`,
    seasonDay: (day) => `day ${day} of 360`,
    standing: (red, blue) => `Red Banner ${red} - Blue Banner ${blue}`,
    leads: (b) => `${b} leads the season.`,
    level: 'The banners stand level.',
    laurel: (b) => `${b} won last season - its fighters wear the laurel.`,
    laurelYou: 'You wear the laurel - the crowd is with you from the first bell.',
    none: 'You fight under no banner.',
    under: (b) => `You fight under ${b}.`,
    given: (n) => `You have won ${n} point${n === 1 ? '' : 's'} for it this season.`,
  }),
  /** The Red and Blue Banners' recruiters at the gate (systems/arenaHerald.js recruiterChoice). `b` the banner's name. */
  recruiter: F({
    greet: F({
      red: F(['The Red Banner! Oldest company on this sand.', 'We were fighting the Bay\'s tourneys before the Blue had a flag.']),
      blue: F(['The Blue Banner takes fighters, not braggarts.', 'Discipline wins seasons. Ask anyone who has faced our line.']),
    }),
    pitch: 'Join us and every ladder bout you win counts for the banner.',
    rule: 'Joining is free. Change banners and you sit out the season first.',
    yours: (b) => `You fight under our colours - ${b}.`,
    theirs: (b) => `You wear ${b}. Quit it at its own recruiter first.`,
    wait: (b) => `You quit ${b} this season. Come back to us when the new season opens.`,
    join: (b) => `J - Join ${b}`,
    quit: (b) => `Q - Quit ${b}`,
    window: 'A - The Arena window',
    leave: 'L - Leave',
    askQuit: (b) => `Quit ${b}? Your points stay with it, and the other banner must wait a season.`,
    yes: 'Y - Yes, strike my name',
    no: 'N - No, I stay',
    joined: (b) => `Welcome to ${b}! Your wins on the ladder now count for us.`,
    quitDone: (b) => `Your name is struck from ${b}'s roll. You may join the other banner next season.`,
  }),

  // ── THE BOOKMAKER (ARENA3; systems/arenaBook.js) ──────────────────────────────────────────────────────────────
  book: F({
    greet: F(['Odds! Fair odds on the hour\'s bout!', 'Every fighter has a record, friend, and every record has a price.']),
    shut: 'The gates are shut for the night - my book opens with the first bout at 08:00.',
    bout: (a, b) => `The hour's bout: ${a} against ${b}.`,
    priced: (name, price, record) => `${name} - ${price}, ${record} on this sand.`,
    edge: 'The house keeps a tenth of every price. The rest is yours to win.',
    standing: (line) => `You have ${line}.`,
    owes: (gold) => `I owe you ${gold} gold - collect it while I am in a giving mood.`,
    collect: (gold) => `C - Collect your ${gold} gold`,
    back: (key, name, price) => `${key} - Back ${name} at ${price}`,
    window: 'W - The Arena window',
    leave: 'L - Leave',
    howMuch: (name, price) => `How much on ${name} at ${price}?`,
    stake: (n, gold) => `${n} - ${gold} gold`,
    never: 'N - Never mind',
    taken: (gold, name, price) => `Taken - ${gold} gold on ${name} at ${price}. Good luck to you.`,
    paid: (gold) => `The bookmaker counts out ${gold} gold.`,
    evens: 'evens',
    price: (num, den) => `${num} to ${den}`,
    wagerOn: (gold, name, price) => `${gold} gold on ${name} at ${price}`,
    open: 'waiting on the bout',
    wonLine: (gold) => `won, ${gold} gold to collect`,
    drawLine: 'a draw, the stake returned',
    lostLine: 'lost',
    whyClosed: 'The book on this bout is closed.',
    whyPlaced: 'Your wager on this bout is placed.',
    whyGold: 'You need 10 gold to wager.',
    whyRefused: F({ none: 'No bout this hour.', closed: 'The book on this bout is closed.', placed: 'Your wager on this bout is placed.', stake: 'Wagers run from 10 to 1000 gold.', gold: 'You do not have that much gold.' }),
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
    seasonLine: (year, day) => `The season of 3E ${year} - day ${day} of 360`,
    seasonShort: (year) => `3E ${year}`,
    recordLine: (w, l) => `${w} won, ${l} lost`,
    wl: (w, l) => `${w}-${l}`,
    gold: (n) => `${n} gold`,
    days: (n) => `${n} day${n === 1 ? '' : 's'}`,
    cleared: (n, tier) => `Tier ${n}, ${tier}`,
    allTen: 'All ten tiers taken',
    leading: (b) => `${b} leads`,
    won: (b) => `${b} won`,
    levelShort: 'Level',
    owed: (gold) => `The bookmaker owes you ${gold} gold`,
    // Bouts
    exhibitionTitle: (hh) => `The exhibition at ${hh}`,
    onSand: 'On the sand now',
    openNow: 'The book is open',
    opensAt: (hh) => `The call at ${hh}`,
    playersTitle: 'Bouts between players',
    playersLine: 'Fighters of the realm meet here in bouts fought online. Offline, none are called.',
    onlineOnly: 'Online',
    ladderTitle: (tier, label) => `${tier} - ${label}`,
    ladderBout: 'Your next ladder bout',
    champBout: 'The Tier Champion waits',
    grandBout: 'For the title of Grand Champion',
    ladderDoneTitle: 'The ladder is yours',
    purseLine: (gold) => `The purse - ${gold} gold, more if the crowd loves you.`,
    watch: 'Watch',
    wager: 'Wager',
    fight: 'Fight',
    back: (name) => `Back ${name}`,
    vs: 'vs',
    favourite: 'Favourite',
    whyGate: 'At the arena gate',
    whyHurt: 'Rest first - you are in no state to fight',
    whyNotYet: (hh) => `Not until ${hh}`,
    // Ladder
    ladderHead: 'The ten tiers',
    tierState: F({ cleared: 'Cleared', current: 'You are here', locked: 'Ahead' }),
    beaten: 'Beaten',
    nextFight: 'Next',
    tierPurse: (bout, champ) => `Purse ${bout} gold a bout, ${champ} gold for its champion`,
    titleGiven: (t) => `Its champion beaten, you are called ${t}.`,
    yourTitles: 'Your titles',
    noTitles: 'No champion beaten yet.',
    beastTier: 'Beasts - the crowd thinks it unfair.',
    meleeTier: 'Grand Melees - every fighter for themselves.',
    // Team
    standingHead: 'The season',
    rosterHead: (b) => `${b} - the top ten`,
    pointsCol: 'Points',
    yourPoints: 'Your points',
    yourWins: 'Ladder bouts won for it',
    joinWhere: 'Join the Red or the Blue at their recruiters by the gate.',
    laurelMark: 'Laurel',
    // Leaderboards
    boards: F({
      pve: 'Highest tier', pveSub: 'This season\'s field, and you - the Grand Champions first.',
      fast: 'Fastest Grand Champion', fastSub: 'Days from the first bout to the title, every season this save has seen.',
      fastNone: 'Nobody has taken the title yet. The stone waits.',
      pvp: 'Season rating', pvpSub: 'Refereed bouts between players.',
      pvpNone: 'Bouts between players are fought online. Offline this board stands empty.',
      team: 'The banners', teamSub: 'Each season\'s points - the banner with more wears the laurel the next.',
    }),
    cols: F({
      pve: F(['Title', 'Fights in', 'Record']), fast: F(['Days', 'Season']), pvp: F(['Rating', 'Record']),
      team: F(['Red', 'Blue', 'Result', 'You']),
    }),
    rank: 'Rank',
    name: 'Fighter',
    // Records
    stat: F({
      wins: 'Won', losses: 'Lost', share: 'Win share', yields: 'Yielded', falls: 'Fell', ringouts: 'Ring-outs', streak: 'Streak',
      best: 'Best streak', purses: 'Purses', champions: 'Champions beaten',
    }),
    lastBouts: 'The last twenty bouts',
    noBouts: 'You have not fought on this sand yet.',
    wagersHead: 'Your wagers',
    noWagers: 'No wager placed with the bookmaker.',
    wonWord: 'Won',
    lostWord: 'Lost',
    drew: 'Draw',
    how: F({ yield: 'by a yield', fall: 'by a fall', ringout: 'by ring-out', judges: 'on the judges\' word', draw: 'the judges could not part them' }),
    pointsWord: (n) => `+${n} for the banner`,
    // Rules
    rules: F([
      F({ head: 'The bouts', lines: F([
        'Every bout is fought on the colosseum\'s sand, the crowd in the tiers.',
        'Nobody dies on the sand. A fighter beaten to the ground stays at a breath of life.',
        'A bout ends when a fighter yields, falls, or is carried out of the ring.',
        'Badly hurt? Sheathe your weapon to yield. Above the line, the Herald refuses it.',
        'After three minutes the judges decide - damage, then blows landed, then fewer misses.',
        'No doors, no rest and no travel while your bout stands. The healers come after.',
      ]) }),
      F({ head: 'The ladder', lines: F([
        'Ten tiers, three bouts each. Win all three and the Tier Champion will see you.',
        'Beat the champion to climb and take the tier\'s title. A loss costs only the purse.',
        'The ninth tier pits you against two at once; the tenth is the Grand Melee.',
        'Beat the tenth tier\'s champion and you are the Grand Champion of the Arena.',
        'The Pit Master in the undercroft spars with you - no purse, no shame.',
        // ARENA5: your ladder replay
        'Your last three ladder bouts are kept: the Herald or the Records page replays one.',
        'A replay pays nothing and counts nothing. Leave by the gates whenever you like.',
      ]) }),
      F({ head: 'The banners', lines: F([
        'Join the Red Banner or the Blue at their recruiters by the gate. Joining is free.',
        'A ladder bout won is a point for your banner, a tier champion 3, the Grand Champion 10.',
        'Quit when you like - but you may not join the other banner until the next season.',
        'A season is a year. The banner with more points when it ends wears the laurel.',
        'The crowd favours a fighter in the laurel from the first bell, all the next season.',
      ]) }),
      F({ head: 'Purses and the crowd', lines: F([
        'A win pays the tier\'s purse - 50 gold in the Pit, 10,000 for the Grand Champion.',
        'The crowd\'s darling is paid up to half again; its villain loses up to a quarter.',
        'The crowd loves blood and a comeback. It hates stalling, running and an early yield.',
      ]) }),
      F({ head: 'Exhibitions and wagers', lines: F([
        'An exhibition is fought every hour from 08:00 to 21:00 - the Red\'s against the Blue\'s.',
        'Watch it from the street or from the stands. Do not strike a fighter in a bout.',
        'The bookmaker by the gate takes wagers until the fight begins - 10 to 1000 gold.',
        'A winning wager pays the price he gave. A draw returns the stake.',
        'Collect what you won at his stall. He pays in person, never by letter.',
      ]) }),
    ]),
  }),

  // ── THE ARENA ONLINE (ARENA4; net/arenaLaw.js, systems/arenaBoard.js, scenes/arenaOnline.js) ────────────────────
  online: F({
    seasonLine: (n, day) => `Season ${n} of the realm - day ${day} of 56`,
    seasonShort: (n) => `Season ${n}`,
    ratingChip: (r) => `Rating ${r}`,
    championTitle: 'Arena Champion',
    rankChip: (n) => `#${n} this season`,
    // the Bouts page: the players' bouts to watch, and the challenge
    liveTitle: 'Bouts on the sand now',
    liveLine: (n) => `${n} bout${n === 1 ? '' : 's'} on the sand now. Take a seat in the stands.`,
    noLive: 'No fighters of the realm are on the sand right now.',
    liveLadder: (tier) => `A ladder bout - ${tier}`,
    livePlayers: 'A rated bout',
    liveExhibition: (tier) => `The hour's exhibition - ${tier}`,   // ARENA4b: the relay's exhibition on the list
    watching: (n) => `${n} watching`,
    challengeTitle: 'Challenge a fighter',
    queueState: F({ idle: 'Rated', queued: 'Seeking', offer: 'A match!', going: 'To the sand', off: 'Offline' }),
    findMatch: 'Find a match',
    leaveQueue: 'Leave the queue',
    accept: 'Accept',
    decline: 'Decline',
    challengeLine: 'A real fighter of the realm, matched to your season rating.',
    queuedLine: (band, n) => `Seeking a fighter within ${band} of your rating - ${n} in the hall.`,
    offerLine: (name, rating) => `${name} (rating ${rating}) will meet you on the sand.`,
    offerClock: (s) => `Accept within ${s} seconds.`,
    goingLine: (name) => `To the sand! ${name} is on the way.`,
    ratingLine: (r, w, l) => `Your season rating is ${r} - ${w} won, ${l} lost.`,
    whyOffline: 'Online only',
    whyGuest: 'Registered accounts only',
    whyBusy: 'You are in a bout',
    whyQueued: 'You are seeking a match',
    // ARENA4b: THE CASUAL BOUT (Arena.md 7: "A casual bout (unranked) may run") - refereed all the same, counted nowhere
    casualMatch: 'Casual bout',
    casualLine: 'Or a casual bout: refereed all the same, but no rating, no points and nothing kept.',
    casualQueued: (n) => `Seeking a casual bout - ${n} in the hall.`,
    casualOffer: 'A casual bout - nothing on it is counted.',
    casualEnd: 'A casual bout - nothing is counted.',
    liveCasual: 'A casual bout',
    ladderOnline: 'Your climb is the realm\'s - every bout refereed.',
    // the boards
    pveSub: 'The realm\'s climb - every bout refereed, the Grand Champions first.',
    fastSub: 'Days from the first bout to the title, across the realm.',
    pvpSub: 'This season - refereed bouts between players.',
    pvpNone: 'No rated bout has been fought this season.',
    teamSub: 'This season and the last - the winner wears the laurel.',
    champion: (name) => `${name} wears the laurel - the season's #1.`,
    noChampion: 'Nobody wears the laurel yet - three rated bouts and the top are needed.',
    pvpCells: (w, l, d) => `${w}-${l}${d ? `-${d}` : ''}`,
    reached: (n) => `Bout ${n} of 40`,
    // what a bout's result says, once the service has kept it
    pvpWon: (d, r) => `Victory! Your rating rises by ${d}, to ${r}.`,
    pvpLost: (d, r) => `Defeat. Your rating falls by ${d}, to ${r}.`,
    pvpDraw: (r) => `A draw. Your rating stands at ${r}.`,
    unrated: 'This bout is kept but not rated - you have met this fighter enough today.',
    ladderKept: 'The bout is on the realm\'s record.',
    grand: 'The realm names you Grand Champion of the Arena!',
    order: 'This win is not your next bout on the ladder, so the realm does not count it.',
    guest: 'Your bouts count once your account has a name. Register to keep them.',
    points: (n, b) => `+${n} for ${b}.`,
    // the stands
    watchingLine: (a, b) => `You watch ${a} against ${b} from the stands.`,
    cheer: 'Cheer',
    boo: 'Boo',
    /** ARENA4b: the keys the stands' two presses answer (ui/arenaHud.js STANDS_KEYS), shown on them. */
    cheerKey: '+',
    booKey: '-',
    seatsFull: 'The stands are full.',
    boutOver: 'That bout is over.',
    // the Hall of Champions, online
    hallTheirs: 'The realm\'s Grand Champions, the newest first:',
    hallTheir: (name) => `${name}, Grand Champion of the Arena.`,
    /** ARENA4b: a name on the realm's wall with the season it was cut in (the Keeper's roll, the Leaderboards' Hall). */
    hallTheirAt: (name, season) => `Season ${season} - ${name}, Grand Champion of the Arena.`,
    // ARENA4b: the account's climb, roll and record, before and after the realm's records are in
    climbWait: 'The realm\'s record of your climb is on its way - ask again in a moment.',
    rollWait: 'The realm\'s roll is on its way - ask me again in a moment.',
    guestBanner: 'A banner takes registered fighters. Give your account a name first.',
    recordsOnline: 'Your record is the realm\'s - every bout refereed, kept by your account.',
    noBouts: 'No bout of yours is on the realm\'s record yet.',
    noRecent: 'The realm has not sent your last bouts yet.',
    boutWhen: (season, day) => `Season ${season}, day ${day}`,
    ratingMove: (r, d) => `rating ${r} (${d > 0 ? '+' : ''}${d})`,
    unratedShort: 'not rated',
    stat: F({ pveWins: 'Ladder won', pveLosses: 'Ladder lost', pvpWins: 'Rated won', pvpLosses: 'Rated lost', pvpDraws: 'Rated drawn', rating: 'Season rating' }),
    how: F({ forfeit: 'by forfeit' }),
    rules: F({ head: 'The realm', lines: F([
      'Online, your climb is the realm\'s - the relay referees every bout.',
      'Find a match to meet a real fighter, paired to your season rating.',
      'A rated win or loss moves your rating. A season runs eight weeks.',
      'The season\'s #1 wears the laurel and the title Arena Champion while they hold it.',
      'The Grand Champion\'s title is the realm\'s for good.',
      'Anyone may watch a bout on the sand from the stands - up to sixty at once.',
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
