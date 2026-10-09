// @ts-check
// CARDS8 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md sections 6.2 and 8; Mac: "Iliac Hand as proposed"): THE
// CATALOG OF ILIAC HAND - the first set of cards, pure data, one home for the rules engine (`net/iliacHand.js`, which
// reads every card through `cardById`), the face painter (each card names one of CARD_EMBLEMS, the pictures it draws)
// and the binder and deckbuilder windows. It imports nothing, so the relay's bundle can carry it beside the engine.
//
// DRAWN FROM DAGGERFALL ITSELF (6.2): its creatures, its guilds and temples, its knightly orders, the Daedric Princes
// and the artifacts they give. Every card names the thing it pictures, and its power and text follow from what that
// thing is in the game - the rat costs one and stands one, a Lich outranks an Orc, the Ancient Lich outranks the Lich,
// a Prince rules the board. The curve the plain units sit on (MEASURE, CARDS10's patrons play it): cost 1 stands 1-2,
// 2 stands 2-3, 3 stands 3-5, 4 stands 4-6, 5 stands 5-7, 6 stands 7-10; a card's text costs it power.
//
// A CARD: `{id, name, kind, cost, power, tier, tags, text, fx, emblem, flavor}`. `kind` 'unit', 'spell', 'prince' or
// 'location'; `power` 0 for a spell or a holding; `tier` one of ILIAC_TIERS (a Prince legendary or higher, an artifact
// the artifact tier); `fx` the effect records in the engine's language (iliacHand.js's header) and `text` EXACTLY
// what `fxText(fx, kind)` says of them - test/cards8_catalog.test.js holds every card to it, so a card's words are
// its rules. ILIAC_CARDS are the cards a deck holds; ILIAC_LOCATIONS the holdings the game lays between the players
// (`cardById` finds either). A summoned or transformed-into card (`fx.card`) is a unit of ILIAC_CARDS - the token is
// that card, drawn as it.
//
// THE ART IS OURS (6.2): an emblem is a picture the painter draws in code, never an ARENA2 sprite or a render of one
// (Port-Doctrine, "A RENDER OF GAME DATA IS GAME DATA").
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).

/** The tiers, lowest first - the loot's (`systems/lootRarity.js` RARITY_ORDER, equal by pin: that module reads the
 *  player's prefs, and the relay's bundle carries neither). */
export const ILIAC_TIERS = Object.freeze(['common', 'magic', 'rare', 'legendary', 'aetheric', 'artifact', 'gilded']);   // the loot's ladder whole (lootRarity.js RARITY_ORDER) - GILDED1's rung joined at the merge of main; no card of the first set wears it

/** The words a card's tags are drawn from - what an effect's `tag` filter can name. */
export const ILIAC_TAGS = Object.freeze([
  'beast', 'undead', 'vampire', 'were', 'daedra', 'atronach', 'dragon', 'giant', 'centaur', 'fey', 'sea',
  'orc', 'human', 'guild', 'temple', 'knight', 'noble', 'mage', 'thief', 'assassin', 'priest', 'warrior', 'prince',
  'artifact', 'city', 'fortress', 'dungeon',
]);

/** The pictures the face painter draws - each card names one. */
export const CARD_EMBLEMS = Object.freeze([
  'beast', 'undead', 'ghost', 'vampire', 'lich', 'were', 'orc', 'giant', 'centaur', 'harpy', 'nymph', 'dreugh',
  'daedra', 'atronach', 'dragon', 'knight', 'mage', 'thief', 'assassin', 'priest', 'warrior', 'noble', 'prince',
  'artifact', 'fire', 'frost', 'shock', 'heal', 'shadow', 'city', 'desert', 'fortress', 'dungeon', 'sea',
  // AUDIT CARDS-5 B: a picture of its own for each artifact, a Prince without one, and the creatures and spells the first
  // set drew with a neighbour's (render/iliacCardFaces.js EMBLEM_KEYS - the beetle went, the scorpion its own and no card an insect)
  'razor', 'staff', 'book', 'claymore', 'rose', 'daedric', 'scorpion', 'bat', 'boar', 'tree', 'gargoyle', 'banish', 'recall', 'sun',
  // CARDS9: the bosses' own - the Burning Gate, the Old Coil, the Brass Remnant's turning gear
  'gate', 'serpent', 'gear',
]);

/** A card, frozen to its effect records. */
const deepFreeze = (c) => Object.freeze({ ...c, tags: Object.freeze(c.tags.slice()), fx: Object.freeze(c.fx.map((f) => Object.freeze({ ...f, ...(f.cost ? { cost: Object.freeze(f.cost.slice()) } : {}) }))) });

/** THE FIRST SET: what a deck holds. */
export const ILIAC_CARDS = Object.freeze([
  // ── the beasts of the Bay ──
  { id: 'rat', name: 'Rat', kind: 'unit', cost: 1, power: 1, tier: 'common', tags: ['beast'], emblem: 'beast',
    fx: [{ on: 'reveal', do: 'summon', card: 'rat' }], text: 'Reveal: summon a Rat here.', flavor: 'Where there is one, the cellar has a hundred.' },
  { id: 'giant-bat', name: 'Giant Bat', kind: 'unit', cost: 1, power: 2, tier: 'common', tags: ['beast'], emblem: 'bat',
    fx: [{ on: 'end', do: 'move', to: 'self' }], text: 'End of turn: move this to the next holding round the table with room.', flavor: 'It never stays where your torch is.' },
  { id: 'giant-scorpion', name: 'Giant Scorpion', kind: 'unit', cost: 2, power: 2, tier: 'common', tags: ['beast'], emblem: 'scorpion',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', pick: 'strongest', n: 1 }], text: 'Reveal: the strongest enemy unit here loses 1 power.', flavor: 'The Alik\'r sends its regards on eight legs.' },
  { id: 'spriggan', name: 'Spriggan', kind: 'unit', cost: 2, power: 2, tier: 'common', tags: ['fey'], emblem: 'tree',
    fx: [{ on: 'reveal', do: 'buff', to: 'here.mine', n: 1 }], text: 'Reveal: your units here gain +1 power.', flavor: 'The wood mends what stands beside it.' },
  { id: 'harpy', name: 'Harpy', kind: 'unit', cost: 2, power: 1, tier: 'common', tags: ['beast'], emblem: 'harpy',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', n: 1 }], text: 'Reveal: enemy units here lose 1 power.', flavor: 'Its shriek reaches every man in the hall.' },
  { id: 'nymph', name: 'Nymph', kind: 'unit', cost: 2, power: 2, tier: 'magic', tags: ['fey'], emblem: 'nymph',
    fx: [{ on: 'reveal', do: 'draw', n: 1 }], text: 'Reveal: draw a card.', flavor: 'She tells you a secret, and you forget your sword.' },
  { id: 'centaur', name: 'Centaur', kind: 'unit', cost: 3, power: 4, tier: 'magic', tags: ['centaur'], emblem: 'centaur',
    fx: [{ on: 'ongoing', do: 'buff', to: 'here.mine', tag: 'beast', n: 1 }], text: 'Ongoing: your beast units here have +1 power.', flavor: 'The herds of the hills answer its horn.' },
  { id: 'dreugh', name: 'Dreugh', kind: 'unit', cost: 3, power: 4, tier: 'common', tags: ['sea'], emblem: 'dreugh',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', pick: 'weakest', n: 1 }], text: 'Reveal: the weakest enemy unit here loses 1 power.', flavor: 'The Bay\'s floor walks up onto the strand.' },
  { id: 'lamia', name: 'Lamia', kind: 'unit', cost: 4, power: 5, tier: 'magic', tags: ['sea'], emblem: 'sea',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', pick: 'strongest', n: 2 }], text: 'Reveal: the strongest enemy unit here loses 2 power.', flavor: 'She sings the bravest down first.' },
  { id: 'gargoyle', name: 'Gargoyle', kind: 'unit', cost: 3, power: 5, tier: 'magic', tags: [], emblem: 'gargoyle',
    fx: [{ on: 'reveal', do: 'buff', to: 'here.mine', pick: 'weakest', n: 2 }], text: 'Reveal: your weakest unit here gains +2 power.', flavor: 'Stone keeps watch over the soft.' },
  { id: 'werewolf', name: 'Werewolf', kind: 'unit', cost: 3, power: 3, tier: 'magic', tags: ['were', 'beast'], emblem: 'were',
    fx: [{ on: 'end', do: 'buff', to: 'self', n: 1 }], text: 'End of turn: this gains +1 power.', flavor: 'Every night a little less of the man.' },
  { id: 'wereboar', name: 'Wereboar', kind: 'unit', cost: 4, power: 5, tier: 'rare', tags: ['were', 'beast'], emblem: 'boar',
    fx: [{ on: 'reveal', do: 'buff', to: 'here.mine', tag: 'beast', n: 1 }], text: 'Reveal: your beast units here gain +1 power.', flavor: 'Hircine\'s other children run with it.' },
  { id: 'dragonling', name: 'Dragonling', kind: 'unit', cost: 5, power: 5, tier: 'rare', tags: ['dragon'], emblem: 'dragon',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', n: 2 }], text: 'Reveal: enemy units here lose 2 power.', flavor: 'Small, for a dragon. Not small for a hall.' },
  { id: 'giant', name: 'Giant', kind: 'unit', cost: 6, power: 10, tier: 'rare', tags: ['giant'], emblem: 'giant',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.all', n: 1 }], text: 'Reveal: units here lose 1 power.', flavor: 'Where it steps, friend and foe alike are trodden.' },
  // ── the dead that walk ──
  { id: 'skeletal-warrior', name: 'Skeletal Warrior', kind: 'unit', cost: 2, power: 2, tier: 'common', tags: ['undead'], emblem: 'undead',
    fx: [{ on: 'ongoing', do: 'buff', to: 'here.mine', tag: 'undead', n: 1 }], text: 'Ongoing: your undead units here have +1 power.', flavor: 'They rise in ranks, as they fell.' },
  { id: 'zombie', name: 'Zombie', kind: 'unit', cost: 2, power: 4, tier: 'common', tags: ['undead'], emblem: 'undead',
    fx: [{ on: 'end', do: 'weaken', to: 'self', n: 1 }], text: 'End of turn: this loses 1 power.', flavor: 'Strong, for now. It is coming apart.' },
  { id: 'ghost', name: 'Ghost', kind: 'unit', cost: 3, power: 3, tier: 'magic', tags: ['undead'], emblem: 'ghost',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', pick: 'strongest', n: 2 }], text: 'Reveal: the strongest enemy unit here loses 2 power.', flavor: 'The bravest feel the cold first.' },
  { id: 'wraith', name: 'Wraith', kind: 'unit', cost: 4, power: 4, tier: 'magic', tags: ['undead'], emblem: 'ghost',
    fx: [{ on: 'ongoing', do: 'weaken', to: 'here.theirs', n: 1 }], text: 'Ongoing: enemy units here have -1 power.', flavor: 'While it lingers, no fire burns warm.' },
  { id: 'vampire', name: 'Vampire', kind: 'unit', cost: 4, power: 4, tier: 'rare', tags: ['undead', 'vampire'], emblem: 'vampire',
    fx: [{ on: 'end', do: 'buff', to: 'self', n: 1 }], text: 'End of turn: this gains +1 power.', flavor: 'It has all night, and every night after.' },
  { id: 'ancient-vampire', name: 'Ancient Vampire', kind: 'unit', cost: 6, power: 7, tier: 'legendary', tags: ['undead', 'vampire'], emblem: 'vampire',
    fx: [{ on: 'end', do: 'weaken', to: 'here.theirs', pick: 'weakest', n: 1 }, { on: 'end', do: 'buff', to: 'self', n: 1 }], text: 'End of turn: the weakest enemy unit here loses 1 power and this gains +1 power.',
    flavor: 'The bloodlines of the Bay all lead back to one cellar.' },
  { id: 'lich', name: 'Lich', kind: 'unit', cost: 5, power: 6, tier: 'rare', tags: ['undead', 'mage'], emblem: 'lich',
    fx: [{ on: 'ongoing', do: 'buff', to: 'here.mine', tag: 'undead', n: 1 }], text: 'Ongoing: your undead units here have +1 power.', flavor: 'It traded its death for a library.' },
  { id: 'ancient-lich', name: 'Ancient Lich', kind: 'unit', cost: 6, power: 8, tier: 'legendary', tags: ['undead', 'mage'], emblem: 'lich',
    fx: [{ on: 'reveal', do: 'destroy', to: 'here.theirs', pick: 'weakest' }, { on: 'ongoing', do: 'buff', to: 'all.mine', tag: 'undead', n: 1 }], text: 'Reveal: destroy the weakest enemy unit here. Ongoing: your undead units have +1 power.',
    flavor: 'It remembers the First Era as you remember breakfast.' },
  // ── the daedra and their atronachs ──
  { id: 'imp', name: 'Imp', kind: 'unit', cost: 1, power: 1, tier: 'common', tags: [], emblem: 'daedra',
    fx: [{ on: 'reveal', do: 'magicka', n: 1 }], text: 'Reveal: gain +1 magicka next turn.', flavor: 'A small spite with a full purse of magicka.' },
  { id: 'daedra-seducer', name: 'Daedra Seducer', kind: 'unit', cost: 3, power: 3, tier: 'magic', tags: ['daedra'], emblem: 'daedra',
    fx: [{ on: 'reveal', do: 'transform', to: 'here.theirs', pick: 'weakest', card: 'rat' }], text: 'Reveal: turn the weakest enemy unit here into a Rat.', flavor: 'Look her in the eye and see what you were.' },
  { id: 'daedroth', name: 'Daedroth', kind: 'unit', cost: 5, power: 7, tier: 'rare', tags: ['daedra'], emblem: 'daedra',
    fx: [{ on: 'end', do: 'weaken', to: 'here.theirs', pick: 'weakest', n: 1 }], text: 'End of turn: the weakest enemy unit here loses 1 power.', flavor: 'Its jaws close on the slowest.' },
  { id: 'daedra-lord', name: 'Daedra Lord', kind: 'unit', cost: 6, power: 8, tier: 'rare', tags: ['daedra'], emblem: 'daedra',
    fx: [{ on: 'reveal', do: 'summon', card: 'imp' }], text: 'Reveal: summon an Imp here.', flavor: 'It never comes through the gate alone.' },
  { id: 'fire-atronach', name: 'Fire Atronach', kind: 'unit', cost: 3, power: 3, tier: 'magic', tags: ['atronach'], emblem: 'fire',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', n: 1 }], text: 'Reveal: enemy units here lose 1 power.', flavor: 'The room is warm. Then it is ash.' },
  { id: 'ice-atronach', name: 'Ice Atronach', kind: 'unit', cost: 3, power: 4, tier: 'magic', tags: ['atronach'], emblem: 'frost',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', pick: 'weakest', n: 2 }], text: 'Reveal: the weakest enemy unit here loses 2 power.', flavor: 'The weak freeze where they stand.' },
  { id: 'flesh-atronach', name: 'Flesh Atronach', kind: 'unit', cost: 3, power: 4, tier: 'common', tags: ['atronach'], emblem: 'atronach',
    fx: [{ on: 'ongoing', do: 'buff', to: 'here.mine', tag: 'atronach', n: 1 }], text: 'Ongoing: your atronach units here have +1 power.', flavor: 'Stitched from what the summoner had to hand.' },
  { id: 'iron-atronach', name: 'Iron Atronach', kind: 'unit', cost: 5, power: 7, tier: 'rare', tags: ['atronach'], emblem: 'atronach',
    fx: [{ on: 'ongoing', do: 'buff', to: 'all.mine', tag: 'atronach', n: 1 }], text: 'Ongoing: your atronach units have +1 power.', flavor: 'Iron given a will by a mage\'s binding, and it does not tire.' },
  // ── the orcs of Orsinium ──
  { id: 'orc', name: 'Orc', kind: 'unit', cost: 2, power: 2, tier: 'common', tags: ['orc'], emblem: 'orc',
    fx: [{ on: 'ongoing', do: 'buff', to: 'here.mine', tag: 'orc', n: 1 }], text: 'Ongoing: your orc units here have +1 power.', flavor: 'Never the only one in the pass.' },
  { id: 'orc-sergeant', name: 'Orc Sergeant', kind: 'unit', cost: 3, power: 4, tier: 'common', tags: ['orc', 'warrior'], emblem: 'orc',
    fx: [{ on: 'reveal', do: 'buff', to: 'here.mine', tag: 'orc', n: 1 }], text: 'Reveal: your orc units here gain +1 power.', flavor: 'It shouts, and the line stands.' },
  { id: 'orc-shaman', name: 'Orc Shaman', kind: 'unit', cost: 3, power: 3, tier: 'magic', tags: ['orc', 'mage'], emblem: 'orc',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', pick: 'weakest', n: 2 }], text: 'Reveal: the weakest enemy unit here loses 2 power.', flavor: 'Malacath\'s curses carry well in cold air.' },
  { id: 'orc-warlord', name: 'Orc Warlord', kind: 'unit', cost: 5, power: 7, tier: 'rare', tags: ['orc', 'warrior'], emblem: 'orc',
    fx: [{ on: 'ongoing', do: 'buff', to: 'all.mine', tag: 'orc', n: 1 }], text: 'Ongoing: your orc units have +1 power.', flavor: 'Gortwog dreams of a city. This one dreams of a war.' },
  // ── the guilds ──
  { id: 'mages-guild-apprentice', name: 'Mages Guild Apprentice', kind: 'unit', cost: 1, power: 1, tier: 'common', tags: ['human', 'guild', 'mage'], emblem: 'mage',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', pick: 'weakest', n: 1 }], text: 'Reveal: the weakest enemy unit here loses 1 power.', flavor: 'Her first spark, and she aimed it well.' },
  { id: 'mages-guild-battlemage', name: 'Mages Guild Battlemage', kind: 'unit', cost: 3, power: 3, tier: 'magic', tags: ['human', 'guild', 'mage'], emblem: 'shock',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', n: 1 }], text: 'Reveal: enemy units here lose 1 power.', flavor: 'The guild teaches lightning to the dues-paid.' },
  { id: 'mages-guild-archmage', name: 'Mages Guild Archmage', kind: 'unit', cost: 5, power: 5, tier: 'rare', tags: ['human', 'guild', 'mage'], emblem: 'mage',
    fx: [{ on: 'reveal', do: 'draw', n: 2 }], text: 'Reveal: draw 2 cards.', flavor: 'Every book in the hall, and the ones not on the shelves.' },
  { id: 'fighters-guild-swordsman', name: 'Fighters Guild Swordsman', kind: 'unit', cost: 2, power: 2, tier: 'common', tags: ['human', 'guild', 'warrior'], emblem: 'warrior',
    fx: [{ on: 'ongoing', do: 'buff', to: 'here.mine', tag: 'warrior', n: 1 }], text: 'Ongoing: your warrior units here have +1 power.', flavor: 'Paid by the contract, loyal to the man beside him.' },
  { id: 'fighters-guild-champion', name: 'Fighters Guild Champion', kind: 'unit', cost: 4, power: 5, tier: 'rare', tags: ['human', 'guild', 'warrior'], emblem: 'warrior',
    fx: [{ on: 'reveal', do: 'buff', to: 'here.mine', tag: 'warrior', n: 2 }], text: 'Reveal: your warrior units here gain +2 power.', flavor: 'The guildhall\'s best blade, and its loudest voice.' },
  { id: 'thieves-guild-filcher', name: 'Thieves Guild Filcher', kind: 'unit', cost: 1, power: 1, tier: 'common', tags: ['human', 'guild', 'thief'], emblem: 'thief',
    fx: [{ on: 'reveal', do: 'draw', n: 1 }], text: 'Reveal: draw a card.', flavor: 'Your purse was lighter than you thought.' },
  { id: 'thieves-guild-crook', name: 'Thieves Guild Crook', kind: 'unit', cost: 2, power: 2, tier: 'magic', tags: ['human', 'guild', 'thief'], emblem: 'thief',
    fx: [{ on: 'reveal', do: 'magicka', n: 2 }], text: 'Reveal: gain +2 magicka next turn.', flavor: 'No questions, half the price.' },
  { id: 'dark-brotherhood-assassin', name: 'Dark Brotherhood Assassin', kind: 'unit', cost: 3, power: 2, tier: 'rare', tags: ['human', 'guild', 'assassin'], emblem: 'assassin',
    fx: [{ on: 'reveal', do: 'destroy', to: 'here.theirs', pick: 'weakest' }], text: 'Reveal: destroy the weakest enemy unit here.', flavor: 'The contract was signed before you sat down.' },
  { id: 'nightblade', name: 'Nightblade', kind: 'unit', cost: 2, power: 2, tier: 'magic', tags: ['human', 'assassin'], emblem: 'shadow',
    fx: [{ on: 'end', do: 'weaken', to: 'here.theirs', pick: 'weakest', n: 1 }], text: 'End of turn: the weakest enemy unit here loses 1 power.', flavor: 'A blade you only see in the morning.' },
  // ── the temples of the Divines ──
  { id: 'priest-of-arkay', name: 'Priest of Arkay', kind: 'unit', cost: 2, power: 2, tier: 'common', tags: ['human', 'temple', 'priest'], emblem: 'priest',
    fx: [{ on: 'reveal', do: 'destroy', to: 'here.theirs', tag: 'undead', pick: 'weakest' }], text: 'Reveal: destroy the weakest enemy undead unit here.', flavor: 'Arkay keeps the cycle. The dead go back.' },
  { id: 'priest-of-stendarr', name: 'Priest of Stendarr', kind: 'unit', cost: 3, power: 3, tier: 'common', tags: ['human', 'temple', 'priest'], emblem: 'heal',
    fx: [{ on: 'reveal', do: 'buff', to: 'here.mine', n: 1 }], text: 'Reveal: your units here gain +1 power.', flavor: 'Mercy, laid on with both hands.' },
  { id: 'priest-of-dibella', name: 'Priest of Dibella', kind: 'unit', cost: 2, power: 2, tier: 'common', tags: ['human', 'temple', 'priest'], emblem: 'priest',
    fx: [{ on: 'reveal', do: 'draw', n: 1 }], text: 'Reveal: draw a card.', flavor: 'Beauty opens doors a key will not.' },
  { id: 'priest-of-julianos', name: 'Priest of Julianos', kind: 'unit', cost: 2, power: 2, tier: 'common', tags: ['human', 'temple', 'priest'], emblem: 'priest',
    fx: [{ on: 'reveal', do: 'magicka', n: 1 }], text: 'Reveal: gain +1 magicka next turn.', flavor: 'Logic, applied, is a kind of magicka.' },
  { id: 'priest-of-kynareth', name: 'Priest of Kynareth', kind: 'unit', cost: 2, power: 3, tier: 'common', tags: ['human', 'temple', 'priest'], emblem: 'priest',
    fx: [{ on: 'reveal', do: 'move', to: 'here.mine', pick: 'weakest' }], text: 'Reveal: move your weakest unit here to the next holding round the table with room.', flavor: 'The wind carries the faithful where they are needed.' },
  { id: 'priest-of-mara', name: 'Priest of Mara', kind: 'unit', cost: 3, power: 3, tier: 'magic', tags: ['human', 'temple', 'priest'], emblem: 'heal',
    fx: [{ on: 'ongoing', do: 'buff', to: 'here.mine', n: 1 }], text: 'Ongoing: your units here have +1 power.', flavor: 'While she prays, no one here stands alone.' },
  { id: 'priest-of-zenithar', name: 'Priest of Zenithar', kind: 'unit', cost: 3, power: 3, tier: 'common', tags: ['human', 'temple', 'priest'], emblem: 'priest',
    fx: [{ on: 'reveal', do: 'magicka', n: 2 }], text: 'Reveal: gain +2 magicka next turn.', flavor: 'Work honestly, and the god of trade pays honestly.' },
  { id: 'priest-of-akatosh', name: 'Priest of Akatosh', kind: 'unit', cost: 4, power: 4, tier: 'magic', tags: ['human', 'temple', 'priest'], emblem: 'priest',
    fx: [{ on: 'end', do: 'buff', to: 'here.mine', pick: 'weakest', n: 1 }], text: 'End of turn: your weakest unit here gains +1 power.', flavor: 'Time favours the patient.' },
  // ── the knightly orders ──
  { id: 'knight-of-the-dragon', name: 'Knight of the Dragon', kind: 'unit', cost: 3, power: 3, tier: 'magic', tags: ['human', 'knight'], emblem: 'knight',
    fx: [{ on: 'ongoing', do: 'buff', to: 'here.mine', tag: 'knight', n: 1 }], text: 'Ongoing: your knight units here have +1 power.', flavor: 'Daggerfall\'s order rides together or not at all.' },
  { id: 'knight-of-the-wheel', name: 'Knight of the Wheel', kind: 'unit', cost: 2, power: 2, tier: 'common', tags: ['human', 'knight'], emblem: 'knight',
    fx: [{ on: 'end', do: 'buff', to: 'self', n: 1 }], text: 'End of turn: this gains +1 power.', flavor: 'The Order of the Wheel turns, and its knights grow with every turning.' },
  { id: 'host-of-the-horn', name: 'Host of the Horn', kind: 'unit', cost: 4, power: 5, tier: 'magic', tags: ['human', 'knight'], emblem: 'knight',
    fx: [{ on: 'reveal', do: 'buff', to: 'here.mine', n: 1 }], text: 'Reveal: your units here gain +1 power.', flavor: 'One blast, and the whole line takes heart.' },
  { id: 'knight-of-the-rose', name: 'Knight of the Rose', kind: 'unit', cost: 3, power: 4, tier: 'magic', tags: ['human', 'knight'], emblem: 'knight',
    fx: [{ on: 'reveal', do: 'draw', n: 1 }], text: 'Reveal: draw a card.', flavor: 'Wayrest\'s knights carry letters as well as lances.' },
  { id: 'knight-of-the-flame', name: 'Knight of the Flame', kind: 'unit', cost: 4, power: 4, tier: 'rare', tags: ['human', 'knight'], emblem: 'fire',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', pick: 'strongest', n: 2 }], text: 'Reveal: the strongest enemy unit here loses 2 power.', flavor: 'They ride at the biggest thing on the field.' },
  { id: 'king-gothryd', name: 'King Gothryd', kind: 'unit', cost: 5, power: 6, tier: 'legendary', tags: ['human', 'noble', 'knight'], emblem: 'noble',
    fx: [{ on: 'ongoing', do: 'buff', to: 'all.mine', tag: 'knight', n: 1 }], text: 'Ongoing: your knight units have +1 power.', flavor: 'Daggerfall\'s young king, and every knight in it is his.' },
  // ── spells ──
  { id: 'frostbite', name: 'Frostbite', kind: 'spell', cost: 1, power: 0, tier: 'common', tags: [], emblem: 'frost',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', pick: 'weakest', n: 2 }], text: 'The weakest enemy unit here loses 2 power.', flavor: 'The weak go numb first.' },
  { id: 'shock', name: 'Shock', kind: 'spell', cost: 2, power: 0, tier: 'common', tags: [], emblem: 'shock',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', n: 1 }], text: 'Enemy units here lose 1 power.', flavor: 'It jumps from man to man.' },
  { id: 'fireball', name: 'Fireball', kind: 'spell', cost: 2, power: 0, tier: 'magic', tags: [], emblem: 'fire',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', pick: 'strongest', n: 3 }], text: 'The strongest enemy unit here loses 3 power.', flavor: 'Aim at the biggest. You will not miss.' },
  { id: 'heal', name: 'Heal', kind: 'spell', cost: 1, power: 0, tier: 'common', tags: [], emblem: 'heal',
    fx: [{ on: 'reveal', do: 'buff', to: 'here.mine', pick: 'weakest', n: 2 }], text: 'Your weakest unit here gains +2 power.', flavor: 'Up, soldier. Not yet.' },
  { id: 'recall', name: 'Recall', kind: 'spell', cost: 1, power: 0, tier: 'magic', tags: [], emblem: 'recall',
    fx: [{ on: 'reveal', do: 'move', to: 'here.mine', pick: 'strongest' }], text: 'Move your strongest unit here to the next holding round the table with room.', flavor: 'Here a moment ago. Needed elsewhere.' },
  { id: 'turn-undead', name: 'Turn Undead', kind: 'spell', cost: 2, power: 0, tier: 'common', tags: [], emblem: 'sun',
    fx: [{ on: 'reveal', do: 'destroy', to: 'here.theirs', tag: 'undead', pick: 'weakest' }], text: 'Destroy the weakest enemy undead unit here.', flavor: 'Back into the earth, by Arkay\'s leave.' },
  { id: 'banish-daedra', name: 'Banish Daedra', kind: 'spell', cost: 2, power: 0, tier: 'magic', tags: [], emblem: 'banish',
    fx: [{ on: 'reveal', do: 'destroy', to: 'here.theirs', tag: 'daedra', pick: 'weakest' }], text: 'Destroy the weakest enemy daedra unit here.', flavor: 'Back through the gate that let it in, and the gate shut behind it.' },
  { id: 'animate-dead', name: 'Animate Dead', kind: 'spell', cost: 2, power: 0, tier: 'magic', tags: [], emblem: 'undead',
    fx: [{ on: 'reveal', do: 'summon', card: 'zombie' }], text: 'Summon a Zombie here.', flavor: 'The graveyard is a barracks, if you know the words.' },
  // ── the artifacts ──
  { id: 'mehrunes-razor', name: 'Mehrunes\' Razor', kind: 'spell', cost: 4, power: 0, tier: 'artifact', tags: ['artifact'], emblem: 'razor',
    fx: [{ on: 'reveal', do: 'destroy', to: 'here.theirs', pick: 'strongest' }], text: 'Destroy the strongest enemy unit here.', flavor: 'One cut, and the greatest falls.' },
  { id: 'wabbajack', name: 'Wabbajack', kind: 'spell', cost: 3, power: 0, tier: 'artifact', tags: ['artifact'], emblem: 'staff',
    fx: [{ on: 'reveal', do: 'transform', to: 'here.theirs', pick: 'strongest', card: 'rat' }], text: 'Turn the strongest enemy unit here into a Rat.', flavor: 'Sheogorath thinks this is very funny.' },
  { id: 'azuras-star', name: 'Azura\'s Star', kind: 'spell', cost: 2, power: 0, tier: 'artifact', tags: ['artifact'], emblem: 'artifact',
    fx: [{ on: 'reveal', do: 'draw', n: 2 }, { on: 'reveal', do: 'magicka', n: 2 }], text: 'Draw 2 cards and gain +2 magicka next turn.', flavor: 'A soul gem that never empties.' },
  { id: 'oghma-infinium', name: 'Oghma Infinium', kind: 'spell', cost: 3, power: 0, tier: 'artifact', tags: ['artifact'], emblem: 'book',
    fx: [{ on: 'reveal', do: 'draw', n: 3 }], text: 'Draw 3 cards.', flavor: 'Hermaeus Mora lends it. He never forgets the loan.' },
  { id: 'chrysamere', name: 'Chrysamere', kind: 'spell', cost: 3, power: 0, tier: 'artifact', tags: ['artifact'], emblem: 'claymore',
    fx: [{ on: 'reveal', do: 'buff', to: 'here.mine', pick: 'strongest', n: 4 }], text: 'Your strongest unit here gains +4 power.', flavor: 'The Paladin\'s Blade chooses the worthy.' },
  { id: 'sanguine-rose', name: 'Sanguine Rose', kind: 'spell', cost: 4, power: 0, tier: 'artifact', tags: ['artifact'], emblem: 'rose',
    fx: [{ on: 'reveal', do: 'summon', card: 'daedroth' }], text: 'Summon a Daedroth here.', flavor: 'Each thorn a door, and something comes through.' },
  // ── the Daedric Princes ──
  { id: 'mehrunes-dagon', name: 'Mehrunes Dagon', kind: 'prince', cost: 6, power: 6, tier: 'aetheric', tags: ['daedra', 'prince'], emblem: 'daedric',
    fx: [{ on: 'ongoing', do: 'weaken', to: 'all.theirs', n: 1 }], text: 'Ongoing: enemy units have -1 power.', flavor: 'The Prince of Destruction asks nothing. He takes.' },
  { id: 'molag-bal', name: 'Molag Bal', kind: 'prince', cost: 6, power: 5, tier: 'aetheric', tags: ['daedra', 'prince'], emblem: 'daedric',
    fx: [{ on: 'ongoing', do: 'buff', to: 'all.mine', tag: 'undead', n: 2 }], text: 'Ongoing: your undead units have +2 power.', flavor: 'The Lord of Domination asks no bargain. He takes the bound and keeps them.' },
  { id: 'sanguine', name: 'Sanguine', kind: 'prince', cost: 5, power: 4, tier: 'legendary', tags: ['daedra', 'prince'], emblem: 'daedric',
    fx: [{ on: 'ongoing', do: 'buff', to: 'all.mine', cost: [1, 2], n: 1 }], text: 'Ongoing: your units that cost 1 or 2 have +1 power.', flavor: 'Every tavern is his temple, and the small folk drink free.' },
  { id: 'hircine', name: 'Hircine', kind: 'prince', cost: 5, power: 5, tier: 'legendary', tags: ['daedra', 'prince'], emblem: 'daedric',
    fx: [{ on: 'ongoing', do: 'buff', to: 'all.mine', tag: 'beast', n: 2 }], text: 'Ongoing: your beast units have +2 power.', flavor: 'The Huntsman runs with his pack.' },
  { id: 'nocturnal', name: 'Nocturnal', kind: 'prince', cost: 5, power: 4, tier: 'legendary', tags: ['daedra', 'prince'], emblem: 'daedric',
    fx: [{ on: 'reveal', do: 'draw', n: 1 }, { on: 'ongoing', do: 'buff', to: 'all.mine', tag: 'thief', n: 2 }], text: 'Reveal: draw a card. Ongoing: your thief units have +2 power.', flavor: 'The Night Mistress keeps her own in shadow.' },
  { id: 'clavicus-vile', name: 'Clavicus Vile', kind: 'prince', cost: 4, power: 3, tier: 'legendary', tags: ['daedra', 'prince'], emblem: 'daedric',
    fx: [{ on: 'ongoing', do: 'discount', kind: 'spell', n: 1 }], text: 'Ongoing: your spells cost 1 less.', flavor: 'A bargain. Read the small print later.' },
  { id: 'namira', name: 'Namira', kind: 'prince', cost: 5, power: 4, tier: 'legendary', tags: ['daedra', 'prince'], emblem: 'daedric',
    fx: [{ on: 'ongoing', do: 'weaken', to: 'all.theirs', cost: [4, 10], n: 2 }], text: 'Ongoing: enemy units that cost 4 or more have -2 power.', flavor: 'The Spurned pull down the proud.' },
  { id: 'boethiah', name: 'Boethiah', kind: 'prince', cost: 5, power: 5, tier: 'legendary', tags: ['daedra', 'prince'], emblem: 'daedric',
    fx: [{ on: 'ongoing', do: 'buff', to: 'all.mine', tag: 'warrior', n: 2 }], text: 'Ongoing: your warrior units have +2 power.', flavor: 'The Prince of Plots favours whoever is still standing.' },
  { id: 'azura', name: 'Azura', kind: 'prince', cost: 6, power: 5, tier: 'legendary', tags: ['daedra', 'prince'], emblem: 'prince',
    fx: [{ on: 'ongoing', do: 'buff', to: 'all.mine', n: 1 }], text: 'Ongoing: your units have +1 power.', flavor: 'Dusk and dawn, and every one of hers between.' },
  { id: 'malacath', name: 'Malacath', kind: 'prince', cost: 5, power: 5, tier: 'legendary', tags: ['daedra', 'prince'], emblem: 'daedric',
    fx: [{ on: 'ongoing', do: 'buff', to: 'all.mine', tag: 'orc', n: 2 }], text: 'Ongoing: your orc units have +2 power.', flavor: 'The god of curses remembers every orc by name.' },
  { id: 'meridia', name: 'Meridia', kind: 'prince', cost: 5, power: 5, tier: 'legendary', tags: ['daedra', 'prince'], emblem: 'daedric',
    fx: [{ on: 'ongoing', do: 'weaken', to: 'all.theirs', tag: 'undead', n: 2 }], text: 'Ongoing: enemy undead units have -2 power.', flavor: 'Her light finds the dead wherever they hide.' },
  // ── the bosses' own (CARDS9, section 32: "the Oblivion Gate's boss and the Sea Serpent can drop their own, at the
  //    aetheric tier" - and the Abyss Dungeon's, Mac: "Dont forget about a card needing to come from the abyss dungeon
  //    also"). Found only in their spoils (systems/cardSources.js BOSS_CARDS): no pack, no regular, no foe deals them. ──
  { id: 'valkynaz-ruhn', name: 'Valkynaz Ruhn', kind: 'unit', cost: 6, power: 8, tier: 'aetheric', tags: ['daedra'], emblem: 'gate',
    fx: [{ on: 'reveal', do: 'destroy', to: 'here.theirs', pick: 'weakest' }], text: 'Reveal: destroy the weakest enemy unit here.', flavor: 'Warden of the Burning Gate. He was set to hold it, and he holds it.' },
  { id: 'sethrakul', name: 'Sethrakul', kind: 'unit', cost: 6, power: 9, tier: 'aetheric', tags: ['sea', 'beast'], emblem: 'serpent',
    fx: [{ on: 'end', do: 'weaken', to: 'here.theirs', n: 1 }], text: 'End of turn: enemy units here lose 1 power.', flavor: 'The Old Coil rises where the packet lanes run deep.' },
  { id: 'brass-remnant', name: 'Brass Remnant', kind: 'unit', cost: 6, power: 7, tier: 'aetheric', tags: [], emblem: 'gear',
    fx: [{ on: 'end', do: 'buff', to: 'self', n: 1 }], text: 'End of turn: this gains +1 power.', flavor: 'It keeps the Hour in the Abyss. Every turn of the Hour turns it harder.' },
].map(deepFreeze));

/** THE HOLDINGS: the places of the Iliac Bay the game lays between the players, each bending its own ground. */
export const ILIAC_LOCATIONS = Object.freeze([
  { id: 'daggerfall', name: 'Daggerfall', kind: 'location', cost: 0, power: 0, tier: 'common', tags: ['city'], emblem: 'city',
    fx: [{ on: 'ongoing', do: 'buff', to: 'here', tag: 'knight', n: 2 }], text: 'Knight units here have +2 power.', flavor: 'The crown city, and its knights ride for it.' },
  { id: 'sentinel', name: 'Sentinel', kind: 'location', cost: 0, power: 0, tier: 'common', tags: ['city'], emblem: 'desert',
    fx: [{ on: 'ongoing', do: 'buff', to: 'here', cost: [1, 2], n: 1 }], text: 'Units here that cost 1 or 2 have +1 power.', flavor: 'Under the Alik\'r sun, even the small burn bright.' },
  { id: 'wayrest', name: 'Wayrest', kind: 'location', cost: 0, power: 0, tier: 'common', tags: ['city', 'fortress'], emblem: 'fortress',
    fx: [{ on: 'ongoing', do: 'room', n: 3 }], text: 'Each side holds only 3 cards here.', flavor: 'Its walls let in only so many.' },
  { id: 'shornhelm', name: 'Shornhelm', kind: 'location', cost: 0, power: 0, tier: 'common', tags: ['city'], emblem: 'city',
    fx: [{ on: 'end', do: 'weaken', to: 'here', pick: 'weakest', n: 1 }], text: 'End of turn: the weakest unit on each side here loses 1 power.', flavor: 'The Wrothgarian wind takes the weakest first.' },
  { id: 'orsinium', name: 'Orsinium', kind: 'location', cost: 0, power: 0, tier: 'common', tags: ['fortress'], emblem: 'fortress',
    fx: [{ on: 'ongoing', do: 'buff', to: 'here', tag: 'orc', n: 2 }], text: 'Orc units here have +2 power.', flavor: 'Gortwog\'s city, built again in the mountains.' },
  { id: 'betony', name: 'Betony', kind: 'location', cost: 0, power: 0, tier: 'common', tags: ['city'], emblem: 'sea',
    fx: [{ on: 'reveal', do: 'draw', n: 1 }], text: 'After a card is revealed here, its owner draws a card.', flavor: 'An island two crowns claim, and both send spies.' },
  { id: 'evermor', name: 'Evermor', kind: 'location', cost: 0, power: 0, tier: 'common', tags: ['city'], emblem: 'city',
    fx: [{ on: 'reveal', do: 'magicka', n: 1 }], text: 'After a card is revealed here, its owner gains +1 magicka next turn.', flavor: 'A rich town pays its friends quickly.' },
  { id: 'castle-daggerfall', name: 'Castle Daggerfall', kind: 'location', cost: 0, power: 0, tier: 'common', tags: ['fortress'], emblem: 'fortress',
    fx: [{ on: 'ongoing', do: 'nospell' }], text: 'Spells cannot be played here.', flavor: 'The court\'s wards hold every spell at the gate.' },
  { id: 'privateers-hold', name: 'Privateer\'s Hold', kind: 'location', cost: 0, power: 0, tier: 'common', tags: ['dungeon'], emblem: 'dungeon',
    fx: [{ on: 'ongoing', do: 'veil' }, { on: 'ongoing', do: 'nospell' }], text: 'Cards here are played face down and unveiled when the game ends. Spells cannot be played here.', flavor: 'In the dark, nobody knows who holds the cave.' },
  { id: 'mages-guild-hall', name: 'Mages Guild Hall', kind: 'location', cost: 0, power: 0, tier: 'common', tags: ['city'], emblem: 'mage',
    fx: [{ on: 'ongoing', do: 'discount', kind: 'spell', n: 1 }], text: 'Spells played here cost 1 less.', flavor: 'Members pay less for the lesson.' },
  { id: 'vampire-crypt', name: 'Vampire\'s Crypt', kind: 'location', cost: 0, power: 0, tier: 'common', tags: ['dungeon'], emblem: 'dungeon',
    fx: [{ on: 'ongoing', do: 'buff', to: 'here', tag: 'undead', n: 2 }], text: 'Undead units here have +2 power.', flavor: 'The dead are at home here. You are not.' },
].map(deepFreeze));

const BY_ID = new Map([...ILIAC_CARDS, ...ILIAC_LOCATIONS].map((c) => [c.id, c]));

/** The card (or holding) an id names, or null. @param {string} id */
export const cardById = (id) => BY_ID.get(id) ?? null;

/** THE STARTER DECK (6.3: it comes with the first binder, so a new player sits down at once) - Daggerfall's levy,
 *  knights and temples with the beasts of the road, common and magic only. */
export const STARTER_DECK = Object.freeze([
  'rat', 'rat', 'giant-bat', 'giant-bat', 'mages-guild-apprentice', 'mages-guild-apprentice', 'thieves-guild-filcher',
  'frostbite', 'heal',
  'knight-of-the-wheel', 'knight-of-the-wheel', 'fighters-guild-swordsman', 'fighters-guild-swordsman', 'priest-of-arkay',
  'priest-of-dibella', 'priest-of-dibella', 'spriggan', 'shock', 'fireball',
  'knight-of-the-dragon', 'knight-of-the-dragon', 'priest-of-stendarr', 'priest-of-stendarr', 'centaur', 'dreugh',
  'knight-of-the-rose',
  'host-of-the-horn', 'host-of-the-horn', 'lamia', 'priest-of-akatosh',
]);
