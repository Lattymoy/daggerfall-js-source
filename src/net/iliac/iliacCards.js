// @ts-check
// CARDS8 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md sections 6.2 and 8; Mac: "Iliac Hand as proposed"): THE
// CATALOG OF ILIAC HAND - the first set of cards, pure data, one home for the rules engine (`net/iliac/iliacHand.js`, which
// reads every card through `cardById`), the face painter (each card names one of CARD_EMBLEMS, the pictures it draws)
// and the binder and deckbuilder windows. It imports nothing, so the relay's bundle can carry it beside the engine.
//
// DRAWN FROM DAGGERFALL ITSELF (6.2): its creatures, its guilds and temples, its knightly orders, the Daedric Princes
// and the artifacts they give. Every card names the thing it pictures, and its power and text follow from what that
// thing is in the game - the rat costs one and stands one, a Lich outranks an Orc, the Ancient Lich outranks the Lich,
// a Prince rules the board. The curve the plain units sit on (MEASURE, CARDS10's patrons play it): cost 1 stands 1-2,
// 2 stands 2-3, 3 stands 3-5, 4 stands 4-6, 5 stands 5-7, 6 stands 7-10; a card's text costs it power.
//
// A CARD: `{id, name, kind, cost, power, tier, tags, fx, emblem}`. `kind` 'unit', 'spell', 'prince' or 'location';
// `power` 0 for a spell or a holding; `tier` one of ILIAC_TIERS (a Prince legendary or higher, an artifact the artifact
// tier); `fx` the effect records in the engine's language (iliacHand.js's header). ILIAC_CARDS are the cards a deck
// holds; ILIAC_LOCATIONS the holdings the game lays between the players (`cardById` finds either). A summoned or
// transformed-into card (`fx.card`) is a unit of ILIAC_CARDS - the token is that card, drawn as it.
//
// A CARD'S WORDS ARE THE DISPLAY'S (KG-SET, 2026-10-13): its rules and its flavor are said in the player's language by
// `systems/iliac/iliacCardWords.js` (cardRules, cardFlavor), never written here - the relay shows no word, and L10N4's ratchet
// holds this file's English from growing. A card's rules there are EXACTLY what `fxText(fx, kind)` says of its effects
// (test/systems/loot/cards8_catalog.test.js), so a card's words are still its rules. Its `name` stays here: Daggerfall's own, the
// canonical name fxText's summons say.
//
// THE ART IS OURS (6.2): an emblem is a picture the painter draws in code, never an ARENA2 sprite or a render of one
// (Port-Doctrine, "A RENDER OF GAME DATA IS GAME DATA").
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).

/** The tiers, lowest first - the loot's (`systems/loot/lootRarity.js` RARITY_ORDER, equal by pin: that module reads the
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
  // KG-SET: the nine The King's Gambit's roster brought into the set - the bear, the great cat, the spider, the fish, the
  // wrapped dead, the bow (the Archer's and the Ranger's)
  'bear', 'cat', 'spider', 'fish', 'mummy', 'bow',
  // WITCH1 (2026-10-20, bible/06-Systems/Witches-Festival.md): the Witches' Festival's - the Wyrd's cauldron, a tallow
  // candle
  'witch', 'candle',
]);

/** A card, frozen to its effect records. */
const deepFreeze = (c) => Object.freeze({ ...c, tags: Object.freeze(c.tags.slice()), fx: Object.freeze(c.fx.map((f) => Object.freeze({ ...f, ...(f.cost ? { cost: Object.freeze(f.cost.slice()) } : {}) }))) });

/** THE FIRST SET: what a deck holds. */
export const ILIAC_CARDS = Object.freeze([
  // ── the beasts of the Bay ──
  { id: 'rat', name: 'Rat', kind: 'unit', cost: 1, power: 1, tier: 'common', tags: ['beast'], emblem: 'beast',
    fx: [{ on: 'reveal', do: 'summon', card: 'rat' }] },
  { id: 'giant-bat', name: 'Giant Bat', kind: 'unit', cost: 1, power: 2, tier: 'common', tags: ['beast'], emblem: 'bat',
    fx: [{ on: 'end', do: 'move', to: 'self' }] },
  { id: 'giant-scorpion', name: 'Giant Scorpion', kind: 'unit', cost: 2, power: 2, tier: 'common', tags: ['beast'], emblem: 'scorpion',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', pick: 'strongest', n: 1 }] },
  { id: 'spriggan', name: 'Spriggan', kind: 'unit', cost: 2, power: 2, tier: 'common', tags: ['fey'], emblem: 'tree',
    fx: [{ on: 'reveal', do: 'buff', to: 'here.mine', n: 1 }] },
  { id: 'harpy', name: 'Harpy', kind: 'unit', cost: 2, power: 1, tier: 'common', tags: ['beast'], emblem: 'harpy',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', n: 1 }] },
  { id: 'nymph', name: 'Nymph', kind: 'unit', cost: 2, power: 2, tier: 'magic', tags: ['fey'], emblem: 'nymph',
    fx: [{ on: 'reveal', do: 'draw', n: 1 }] },
  { id: 'centaur', name: 'Centaur', kind: 'unit', cost: 3, power: 4, tier: 'magic', tags: ['centaur'], emblem: 'centaur',
    fx: [{ on: 'ongoing', do: 'buff', to: 'here.mine', tag: 'beast', n: 1 }] },
  { id: 'dreugh', name: 'Dreugh', kind: 'unit', cost: 3, power: 4, tier: 'common', tags: ['sea'], emblem: 'dreugh',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', pick: 'weakest', n: 1 }] },
  { id: 'lamia', name: 'Lamia', kind: 'unit', cost: 4, power: 5, tier: 'magic', tags: ['sea'], emblem: 'sea',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', pick: 'strongest', n: 2 }] },
  { id: 'gargoyle', name: 'Gargoyle', kind: 'unit', cost: 3, power: 5, tier: 'magic', tags: [], emblem: 'gargoyle',
    fx: [{ on: 'reveal', do: 'buff', to: 'here.mine', pick: 'weakest', n: 2 }] },
  { id: 'werewolf', name: 'Werewolf', kind: 'unit', cost: 3, power: 3, tier: 'magic', tags: ['were', 'beast'], emblem: 'were',
    fx: [{ on: 'end', do: 'buff', to: 'self', n: 1 }] },
  { id: 'wereboar', name: 'Wereboar', kind: 'unit', cost: 4, power: 5, tier: 'rare', tags: ['were', 'beast'], emblem: 'boar',
    fx: [{ on: 'reveal', do: 'buff', to: 'here.mine', tag: 'beast', n: 1 }] },
  { id: 'dragonling', name: 'Dragonling', kind: 'unit', cost: 5, power: 5, tier: 'rare', tags: ['dragon'], emblem: 'dragon',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', n: 2 }] },
  { id: 'giant', name: 'Giant', kind: 'unit', cost: 6, power: 10, tier: 'rare', tags: ['giant'], emblem: 'giant',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.all', n: 1 }] },
  // KG-SET (2026-10-13, bible/11-Multiplayer/Kings-Gambit.md section 10.3): the King's Gambit's roster whole - every
  // textured creature of the game wears a card, and its foe drops it (systems/card/cardSources.js FOE_CARDS)
  { id: 'grizzly-bear', name: 'Grizzly Bear', kind: 'unit', cost: 3, power: 5, tier: 'common', tags: ['beast'], emblem: 'bear',
    fx: [{ on: 'end', do: 'weaken', to: 'self', n: 1 }] },
  { id: 'sabretooth-tiger', name: 'Sabretooth Tiger', kind: 'unit', cost: 3, power: 4, tier: 'common', tags: ['beast'], emblem: 'cat',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', pick: 'strongest', n: 1 }] },
  { id: 'spider', name: 'Spider', kind: 'unit', cost: 2, power: 2, tier: 'common', tags: ['beast'], emblem: 'spider',
    fx: [{ on: 'ongoing', do: 'weaken', to: 'here.theirs', cost: [1, 2], n: 1 }] },
  { id: 'slaughterfish', name: 'Slaughterfish', kind: 'unit', cost: 1, power: 3, tier: 'common', tags: ['beast', 'sea'], emblem: 'fish',
    fx: [{ on: 'end', do: 'weaken', to: 'self', n: 1 }] },
  // ── the dead that walk ──
  { id: 'skeletal-warrior', name: 'Skeletal Warrior', kind: 'unit', cost: 2, power: 2, tier: 'common', tags: ['undead'], emblem: 'undead',
    fx: [{ on: 'ongoing', do: 'buff', to: 'here.mine', tag: 'undead', n: 1 }] },
  { id: 'zombie', name: 'Zombie', kind: 'unit', cost: 2, power: 4, tier: 'common', tags: ['undead'], emblem: 'undead',
    fx: [{ on: 'end', do: 'weaken', to: 'self', n: 1 }] },
  { id: 'ghost', name: 'Ghost', kind: 'unit', cost: 3, power: 3, tier: 'magic', tags: ['undead'], emblem: 'ghost',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', pick: 'strongest', n: 2 }] },
  { id: 'wraith', name: 'Wraith', kind: 'unit', cost: 4, power: 4, tier: 'magic', tags: ['undead'], emblem: 'ghost',
    fx: [{ on: 'ongoing', do: 'weaken', to: 'here.theirs', n: 1 }] },
  { id: 'vampire', name: 'Vampire', kind: 'unit', cost: 4, power: 4, tier: 'rare', tags: ['undead', 'vampire'], emblem: 'vampire',
    fx: [{ on: 'end', do: 'buff', to: 'self', n: 1 }] },
  { id: 'ancient-vampire', name: 'Ancient Vampire', kind: 'unit', cost: 6, power: 7, tier: 'legendary', tags: ['undead', 'vampire'], emblem: 'vampire',
    fx: [{ on: 'end', do: 'weaken', to: 'here.theirs', pick: 'weakest', n: 1 }, { on: 'end', do: 'buff', to: 'self', n: 1 }] },
  { id: 'lich', name: 'Lich', kind: 'unit', cost: 5, power: 6, tier: 'rare', tags: ['undead', 'mage'], emblem: 'lich',
    fx: [{ on: 'ongoing', do: 'buff', to: 'here.mine', tag: 'undead', n: 1 }] },
  { id: 'ancient-lich', name: 'Ancient Lich', kind: 'unit', cost: 6, power: 8, tier: 'legendary', tags: ['undead', 'mage'], emblem: 'lich',
    fx: [{ on: 'reveal', do: 'destroy', to: 'here.theirs', pick: 'weakest' }, { on: 'ongoing', do: 'buff', to: 'all.mine', tag: 'undead', n: 1 }] },
  { id: 'mummy', name: 'Mummy', kind: 'unit', cost: 4, power: 4, tier: 'magic', tags: ['undead'], emblem: 'mummy',   // KG-SET
    fx: [{ on: 'end', do: 'buff', to: 'here.mine', pick: 'weakest', tag: 'undead', n: 1 }] },
  // ── the daedra and their atronachs ──
  { id: 'imp', name: 'Imp', kind: 'unit', cost: 1, power: 1, tier: 'common', tags: [], emblem: 'daedra',
    fx: [{ on: 'reveal', do: 'magicka', n: 1 }] },
  { id: 'daedra-seducer', name: 'Daedra Seducer', kind: 'unit', cost: 3, power: 3, tier: 'magic', tags: ['daedra'], emblem: 'daedra',
    fx: [{ on: 'reveal', do: 'transform', to: 'here.theirs', pick: 'weakest', card: 'rat' }] },
  { id: 'daedroth', name: 'Daedroth', kind: 'unit', cost: 5, power: 7, tier: 'rare', tags: ['daedra'], emblem: 'daedra',
    fx: [{ on: 'end', do: 'weaken', to: 'here.theirs', pick: 'weakest', n: 1 }] },
  { id: 'daedra-lord', name: 'Daedra Lord', kind: 'unit', cost: 6, power: 8, tier: 'rare', tags: ['daedra'], emblem: 'daedra',
    fx: [{ on: 'reveal', do: 'summon', card: 'imp' }] },
  { id: 'fire-atronach', name: 'Fire Atronach', kind: 'unit', cost: 3, power: 3, tier: 'magic', tags: ['atronach'], emblem: 'fire',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', n: 1 }] },
  { id: 'ice-atronach', name: 'Ice Atronach', kind: 'unit', cost: 3, power: 4, tier: 'magic', tags: ['atronach'], emblem: 'frost',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', pick: 'weakest', n: 2 }] },
  { id: 'flesh-atronach', name: 'Flesh Atronach', kind: 'unit', cost: 3, power: 4, tier: 'common', tags: ['atronach'], emblem: 'atronach',
    fx: [{ on: 'ongoing', do: 'buff', to: 'here.mine', tag: 'atronach', n: 1 }] },
  { id: 'iron-atronach', name: 'Iron Atronach', kind: 'unit', cost: 5, power: 7, tier: 'rare', tags: ['atronach'], emblem: 'atronach',
    fx: [{ on: 'ongoing', do: 'buff', to: 'all.mine', tag: 'atronach', n: 1 }] },
  { id: 'frost-daedra', name: 'Frost Daedra', kind: 'unit', cost: 5, power: 6, tier: 'rare', tags: ['daedra'], emblem: 'frost',   // KG-SET
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', n: 1 }] },
  { id: 'fire-daedra', name: 'Fire Daedra', kind: 'unit', cost: 5, power: 6, tier: 'rare', tags: ['daedra'], emblem: 'fire',   // KG-SET
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', pick: 'strongest', n: 2 }] },
  // ── the orcs of Orsinium ──
  { id: 'orc', name: 'Orc', kind: 'unit', cost: 2, power: 2, tier: 'common', tags: ['orc'], emblem: 'orc',
    fx: [{ on: 'ongoing', do: 'buff', to: 'here.mine', tag: 'orc', n: 1 }] },
  { id: 'orc-sergeant', name: 'Orc Sergeant', kind: 'unit', cost: 3, power: 4, tier: 'common', tags: ['orc', 'warrior'], emblem: 'orc',
    fx: [{ on: 'reveal', do: 'buff', to: 'here.mine', tag: 'orc', n: 1 }] },
  { id: 'orc-shaman', name: 'Orc Shaman', kind: 'unit', cost: 3, power: 3, tier: 'magic', tags: ['orc', 'mage'], emblem: 'orc',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', pick: 'weakest', n: 2 }] },
  { id: 'orc-warlord', name: 'Orc Warlord', kind: 'unit', cost: 5, power: 7, tier: 'rare', tags: ['orc', 'warrior'], emblem: 'orc',
    fx: [{ on: 'ongoing', do: 'buff', to: 'all.mine', tag: 'orc', n: 1 }] },
  // ── the guilds ──
  { id: 'mages-guild-apprentice', name: 'Mages Guild Apprentice', kind: 'unit', cost: 1, power: 1, tier: 'common', tags: ['human', 'guild', 'mage'], emblem: 'mage',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', pick: 'weakest', n: 1 }] },
  { id: 'mages-guild-battlemage', name: 'Mages Guild Battlemage', kind: 'unit', cost: 3, power: 3, tier: 'magic', tags: ['human', 'guild', 'mage'], emblem: 'shock',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', n: 1 }] },
  { id: 'mages-guild-archmage', name: 'Mages Guild Archmage', kind: 'unit', cost: 5, power: 5, tier: 'rare', tags: ['human', 'guild', 'mage'], emblem: 'mage',
    fx: [{ on: 'reveal', do: 'draw', n: 2 }] },
  { id: 'fighters-guild-swordsman', name: 'Fighters Guild Swordsman', kind: 'unit', cost: 2, power: 2, tier: 'common', tags: ['human', 'guild', 'warrior'], emblem: 'warrior',
    fx: [{ on: 'ongoing', do: 'buff', to: 'here.mine', tag: 'warrior', n: 1 }] },
  { id: 'fighters-guild-champion', name: 'Fighters Guild Champion', kind: 'unit', cost: 4, power: 5, tier: 'rare', tags: ['human', 'guild', 'warrior'], emblem: 'warrior',
    fx: [{ on: 'reveal', do: 'buff', to: 'here.mine', tag: 'warrior', n: 2 }] },
  { id: 'thieves-guild-filcher', name: 'Thieves Guild Filcher', kind: 'unit', cost: 1, power: 1, tier: 'common', tags: ['human', 'guild', 'thief'], emblem: 'thief',
    fx: [{ on: 'reveal', do: 'draw', n: 1 }] },
  { id: 'thieves-guild-crook', name: 'Thieves Guild Crook', kind: 'unit', cost: 2, power: 2, tier: 'magic', tags: ['human', 'guild', 'thief'], emblem: 'thief',
    fx: [{ on: 'reveal', do: 'magicka', n: 2 }] },
  { id: 'dark-brotherhood-assassin', name: 'Dark Brotherhood Assassin', kind: 'unit', cost: 3, power: 2, tier: 'rare', tags: ['human', 'guild', 'assassin'], emblem: 'assassin',
    fx: [{ on: 'reveal', do: 'destroy', to: 'here.theirs', pick: 'weakest' }] },
  { id: 'nightblade', name: 'Nightblade', kind: 'unit', cost: 2, power: 2, tier: 'magic', tags: ['human', 'assassin'], emblem: 'shadow',
    fx: [{ on: 'end', do: 'weaken', to: 'here.theirs', pick: 'weakest', n: 1 }] },
  // ── the temples of the Divines ──
  { id: 'priest-of-arkay', name: 'Priest of Arkay', kind: 'unit', cost: 2, power: 2, tier: 'common', tags: ['human', 'temple', 'priest'], emblem: 'priest',
    fx: [{ on: 'reveal', do: 'destroy', to: 'here.theirs', tag: 'undead', pick: 'weakest' }] },
  { id: 'priest-of-stendarr', name: 'Priest of Stendarr', kind: 'unit', cost: 3, power: 3, tier: 'common', tags: ['human', 'temple', 'priest'], emblem: 'heal',
    fx: [{ on: 'reveal', do: 'buff', to: 'here.mine', n: 1 }] },
  { id: 'priest-of-dibella', name: 'Priest of Dibella', kind: 'unit', cost: 2, power: 2, tier: 'common', tags: ['human', 'temple', 'priest'], emblem: 'priest',
    fx: [{ on: 'reveal', do: 'draw', n: 1 }] },
  { id: 'priest-of-julianos', name: 'Priest of Julianos', kind: 'unit', cost: 2, power: 2, tier: 'common', tags: ['human', 'temple', 'priest'], emblem: 'priest',
    fx: [{ on: 'reveal', do: 'magicka', n: 1 }] },
  { id: 'priest-of-kynareth', name: 'Priest of Kynareth', kind: 'unit', cost: 2, power: 3, tier: 'common', tags: ['human', 'temple', 'priest'], emblem: 'priest',
    fx: [{ on: 'reveal', do: 'move', to: 'here.mine', pick: 'weakest' }] },
  { id: 'priest-of-mara', name: 'Priest of Mara', kind: 'unit', cost: 3, power: 3, tier: 'magic', tags: ['human', 'temple', 'priest'], emblem: 'heal',
    fx: [{ on: 'ongoing', do: 'buff', to: 'here.mine', n: 1 }] },
  { id: 'priest-of-zenithar', name: 'Priest of Zenithar', kind: 'unit', cost: 3, power: 3, tier: 'common', tags: ['human', 'temple', 'priest'], emblem: 'priest',
    fx: [{ on: 'reveal', do: 'magicka', n: 2 }] },
  { id: 'priest-of-akatosh', name: 'Priest of Akatosh', kind: 'unit', cost: 4, power: 4, tier: 'magic', tags: ['human', 'temple', 'priest'], emblem: 'priest',
    fx: [{ on: 'end', do: 'buff', to: 'here.mine', pick: 'weakest', n: 1 }] },
  // ── the knightly orders ──
  { id: 'knight-of-the-dragon', name: 'Knight of the Dragon', kind: 'unit', cost: 3, power: 3, tier: 'magic', tags: ['human', 'knight'], emblem: 'knight',
    fx: [{ on: 'ongoing', do: 'buff', to: 'here.mine', tag: 'knight', n: 1 }] },
  { id: 'knight-of-the-wheel', name: 'Knight of the Wheel', kind: 'unit', cost: 2, power: 2, tier: 'common', tags: ['human', 'knight'], emblem: 'knight',
    fx: [{ on: 'end', do: 'buff', to: 'self', n: 1 }] },
  { id: 'host-of-the-horn', name: 'Host of the Horn', kind: 'unit', cost: 4, power: 5, tier: 'magic', tags: ['human', 'knight'], emblem: 'knight',
    fx: [{ on: 'reveal', do: 'buff', to: 'here.mine', n: 1 }] },
  { id: 'knight-of-the-rose', name: 'Knight of the Rose', kind: 'unit', cost: 3, power: 4, tier: 'magic', tags: ['human', 'knight'], emblem: 'knight',
    fx: [{ on: 'reveal', do: 'draw', n: 1 }] },
  { id: 'knight-of-the-flame', name: 'Knight of the Flame', kind: 'unit', cost: 4, power: 4, tier: 'rare', tags: ['human', 'knight'], emblem: 'fire',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', pick: 'strongest', n: 2 }] },
  { id: 'king-gothryd', name: 'King Gothryd', kind: 'unit', cost: 5, power: 6, tier: 'legendary', tags: ['human', 'noble', 'knight'], emblem: 'noble',
    fx: [{ on: 'ongoing', do: 'buff', to: 'all.mine', tag: 'knight', n: 1 }] },
  // ── the callings (KG-SET): the Bay's archers and rangers, two of the classes its foes are drawn from ──
  { id: 'archer', name: 'Archer', kind: 'unit', cost: 2, power: 2, tier: 'common', tags: ['human', 'warrior'], emblem: 'bow',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', pick: 'weakest', n: 1 }] },
  { id: 'ranger', name: 'Ranger', kind: 'unit', cost: 3, power: 3, tier: 'magic', tags: ['human', 'warrior'], emblem: 'bow',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', pick: 'strongest', tag: 'beast', n: 2 }] },
  // ── spells ──
  { id: 'frostbite', name: 'Frostbite', kind: 'spell', cost: 1, power: 0, tier: 'common', tags: [], emblem: 'frost',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', pick: 'weakest', n: 2 }] },
  { id: 'shock', name: 'Shock', kind: 'spell', cost: 2, power: 0, tier: 'common', tags: [], emblem: 'shock',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', n: 1 }] },
  { id: 'fireball', name: 'Fireball', kind: 'spell', cost: 2, power: 0, tier: 'magic', tags: [], emblem: 'fire',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', pick: 'strongest', n: 3 }] },
  { id: 'heal', name: 'Heal', kind: 'spell', cost: 1, power: 0, tier: 'common', tags: [], emblem: 'heal',
    fx: [{ on: 'reveal', do: 'buff', to: 'here.mine', pick: 'weakest', n: 2 }] },
  { id: 'recall', name: 'Recall', kind: 'spell', cost: 1, power: 0, tier: 'magic', tags: [], emblem: 'recall',
    fx: [{ on: 'reveal', do: 'move', to: 'here.mine', pick: 'strongest' }] },
  { id: 'turn-undead', name: 'Turn Undead', kind: 'spell', cost: 2, power: 0, tier: 'common', tags: [], emblem: 'sun',
    fx: [{ on: 'reveal', do: 'destroy', to: 'here.theirs', tag: 'undead', pick: 'weakest' }] },
  { id: 'banish-daedra', name: 'Banish Daedra', kind: 'spell', cost: 2, power: 0, tier: 'magic', tags: [], emblem: 'banish',
    fx: [{ on: 'reveal', do: 'destroy', to: 'here.theirs', tag: 'daedra', pick: 'weakest' }] },
  { id: 'animate-dead', name: 'Animate Dead', kind: 'spell', cost: 2, power: 0, tier: 'magic', tags: [], emblem: 'undead',
    fx: [{ on: 'reveal', do: 'summon', card: 'zombie' }] },
  // ── the artifacts ──
  { id: 'mehrunes-razor', name: 'Mehrunes\' Razor', kind: 'spell', cost: 4, power: 0, tier: 'artifact', tags: ['artifact'], emblem: 'razor',
    fx: [{ on: 'reveal', do: 'destroy', to: 'here.theirs', pick: 'strongest' }] },
  { id: 'wabbajack', name: 'Wabbajack', kind: 'spell', cost: 3, power: 0, tier: 'artifact', tags: ['artifact'], emblem: 'staff',
    fx: [{ on: 'reveal', do: 'transform', to: 'here.theirs', pick: 'strongest', card: 'rat' }] },
  { id: 'azuras-star', name: 'Azura\'s Star', kind: 'spell', cost: 2, power: 0, tier: 'artifact', tags: ['artifact'], emblem: 'artifact',
    fx: [{ on: 'reveal', do: 'draw', n: 2 }, { on: 'reveal', do: 'magicka', n: 2 }] },
  { id: 'oghma-infinium', name: 'Oghma Infinium', kind: 'spell', cost: 3, power: 0, tier: 'artifact', tags: ['artifact'], emblem: 'book',
    fx: [{ on: 'reveal', do: 'draw', n: 3 }] },
  { id: 'chrysamere', name: 'Chrysamere', kind: 'spell', cost: 3, power: 0, tier: 'artifact', tags: ['artifact'], emblem: 'claymore',
    fx: [{ on: 'reveal', do: 'buff', to: 'here.mine', pick: 'strongest', n: 4 }] },
  { id: 'sanguine-rose', name: 'Sanguine Rose', kind: 'spell', cost: 4, power: 0, tier: 'artifact', tags: ['artifact'], emblem: 'rose',
    fx: [{ on: 'reveal', do: 'summon', card: 'daedroth' }] },
  // ── the Daedric Princes ──
  { id: 'mehrunes-dagon', name: 'Mehrunes Dagon', kind: 'prince', cost: 6, power: 6, tier: 'aetheric', tags: ['daedra', 'prince'], emblem: 'daedric',
    fx: [{ on: 'ongoing', do: 'weaken', to: 'all.theirs', n: 1 }] },
  { id: 'molag-bal', name: 'Molag Bal', kind: 'prince', cost: 6, power: 5, tier: 'aetheric', tags: ['daedra', 'prince'], emblem: 'daedric',
    fx: [{ on: 'ongoing', do: 'buff', to: 'all.mine', tag: 'undead', n: 2 }] },
  { id: 'sanguine', name: 'Sanguine', kind: 'prince', cost: 5, power: 4, tier: 'legendary', tags: ['daedra', 'prince'], emblem: 'daedric',
    fx: [{ on: 'ongoing', do: 'buff', to: 'all.mine', cost: [1, 2], n: 1 }] },
  { id: 'hircine', name: 'Hircine', kind: 'prince', cost: 5, power: 5, tier: 'legendary', tags: ['daedra', 'prince'], emblem: 'daedric',
    fx: [{ on: 'ongoing', do: 'buff', to: 'all.mine', tag: 'beast', n: 2 }] },
  { id: 'nocturnal', name: 'Nocturnal', kind: 'prince', cost: 5, power: 4, tier: 'legendary', tags: ['daedra', 'prince'], emblem: 'daedric',
    fx: [{ on: 'reveal', do: 'draw', n: 1 }, { on: 'ongoing', do: 'buff', to: 'all.mine', tag: 'thief', n: 2 }] },
  { id: 'clavicus-vile', name: 'Clavicus Vile', kind: 'prince', cost: 4, power: 3, tier: 'legendary', tags: ['daedra', 'prince'], emblem: 'daedric',
    fx: [{ on: 'ongoing', do: 'discount', kind: 'spell', n: 1 }] },
  { id: 'namira', name: 'Namira', kind: 'prince', cost: 5, power: 4, tier: 'legendary', tags: ['daedra', 'prince'], emblem: 'daedric',
    fx: [{ on: 'ongoing', do: 'weaken', to: 'all.theirs', cost: [4, 10], n: 2 }] },
  { id: 'boethiah', name: 'Boethiah', kind: 'prince', cost: 5, power: 5, tier: 'legendary', tags: ['daedra', 'prince'], emblem: 'daedric',
    fx: [{ on: 'ongoing', do: 'buff', to: 'all.mine', tag: 'warrior', n: 2 }] },
  { id: 'azura', name: 'Azura', kind: 'prince', cost: 6, power: 5, tier: 'legendary', tags: ['daedra', 'prince'], emblem: 'prince',
    fx: [{ on: 'ongoing', do: 'buff', to: 'all.mine', n: 1 }] },
  { id: 'malacath', name: 'Malacath', kind: 'prince', cost: 5, power: 5, tier: 'legendary', tags: ['daedra', 'prince'], emblem: 'daedric',
    fx: [{ on: 'ongoing', do: 'buff', to: 'all.mine', tag: 'orc', n: 2 }] },
  { id: 'meridia', name: 'Meridia', kind: 'prince', cost: 5, power: 5, tier: 'legendary', tags: ['daedra', 'prince'], emblem: 'daedric',
    fx: [{ on: 'ongoing', do: 'weaken', to: 'all.theirs', tag: 'undead', n: 2 }] },
  // ── the bosses' own (CARDS9, section 32: "the Oblivion Gate's boss and the Sea Serpent can drop their own, at the
  //    aetheric tier" - and the Abyss Dungeon's, Mac: "Dont forget about a card needing to come from the abyss dungeon
  //    also"). Found only in their spoils (systems/card/cardSources.js BOSS_CARDS): no pack, no regular, no foe deals them. ──
  { id: 'valkynaz-ruhn', name: 'Valkynaz Ruhn', kind: 'unit', cost: 6, power: 8, tier: 'aetheric', tags: ['daedra'], emblem: 'gate',
    fx: [{ on: 'reveal', do: 'destroy', to: 'here.theirs', pick: 'weakest' }] },
  { id: 'sethrakul', name: 'Sethrakul', kind: 'unit', cost: 6, power: 9, tier: 'aetheric', tags: ['sea', 'beast'], emblem: 'serpent',
    fx: [{ on: 'end', do: 'weaken', to: 'here.theirs', n: 1 }] },
  { id: 'brass-remnant', name: 'Brass Remnant', kind: 'unit', cost: 6, power: 7, tier: 'aetheric', tags: [], emblem: 'gear',
    fx: [{ on: 'end', do: 'buff', to: 'self', n: 1 }] },
  // ── EG-E (2026-10-12, bible/11-Multiplayer/Elite-Gates.md section 19: "the lord's card: bossCardRoll(bossKey, rolls),
  //    each lord its own key in BOSS_CARDS"): THE BATTLESPIRE'S LORDS, each its own card at the aetheric tier, found
  //    only in its Redoubt's spoils (systems/eliteGates/egSpoils.js) - the Galleries', the Cairn's, the Shade's and the Wellhead's. ──
  { id: 'eg-grath', name: 'Grath, the Hound', kind: 'unit', cost: 5, power: 7, tier: 'aetheric', tags: ['daedra', 'beast'], emblem: 'beast',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', pick: 'strongest', n: 3 }] },
  { id: 'eg-spellmaster', name: 'The Last Spellmaster', kind: 'unit', cost: 5, power: 6, tier: 'aetheric', tags: ['undead', 'mage'], emblem: 'mage',
    fx: [{ on: 'reveal', do: 'draw', n: 2 }] },
  { id: 'eg-armsmaster', name: 'The Last Armsmaster', kind: 'unit', cost: 5, power: 6, tier: 'aetheric', tags: ['undead', 'warrior'], emblem: 'warrior',
    fx: [{ on: 'ongoing', do: 'buff', to: 'here.mine', tag: 'warrior', n: 2 }] },
  { id: 'eg-ilthys', name: 'Valkynaz Ilthys', kind: 'unit', cost: 6, power: 8, tier: 'aetheric', tags: ['daedra'], emblem: 'daedric',
    fx: [{ on: 'reveal', do: 'buff', to: 'all.mine', tag: 'daedra', n: 1 }] },
  { id: 'eg-cairnkeeper', name: 'The Cairn-Keeper', kind: 'unit', cost: 6, power: 7, tier: 'aetheric', tags: ['undead'], emblem: 'undead',
    fx: [{ on: 'reveal', do: 'magicka', n: 2 }] },
  { id: 'eg-twins', name: 'The Twin Lords', kind: 'unit', cost: 6, power: 8, tier: 'aetheric', tags: ['daedra'], emblem: 'knight',
    fx: [{ on: 'reveal', do: 'buff', to: 'here.mine', n: 1 }] },
  { id: 'eg-morvayn', name: 'Valkynaz Morvayn', kind: 'unit', cost: 6, power: 8, tier: 'aetheric', tags: ['daedra'], emblem: 'ghost',
    fx: [{ on: 'end', do: 'weaken', to: 'here.theirs', pick: 'strongest', n: 1 }] },
  { id: 'eg-dusk', name: 'The Mother of Dusk', kind: 'unit', cost: 5, power: 7, tier: 'aetheric', tags: ['daedra'], emblem: 'harpy',
    fx: [{ on: 'end', do: 'weaken', to: 'here.theirs', pick: 'weakest', n: 1 }] },
  { id: 'eg-stalker', name: 'The Night-Stalker', kind: 'unit', cost: 5, power: 7, tier: 'aetheric', tags: ['vampire'], emblem: 'vampire',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', pick: 'weakest', n: 3 }] },
  { id: 'eg-seyth', name: 'Valkynaz Seyth', kind: 'unit', cost: 6, power: 8, tier: 'aetheric', tags: ['daedra'], emblem: 'shadow',
    fx: [{ on: 'reveal', do: 'weaken', to: 'all.theirs', pick: 'strongest', n: 2 }] },
  { id: 'eg-colossus', name: 'The Bound Colossus', kind: 'unit', cost: 6, power: 10, tier: 'aetheric', tags: ['atronach'], emblem: 'gear',
    fx: [{ on: 'end', do: 'weaken', to: 'self', n: 1 }] },
  { id: 'eg-wyrm', name: 'The Wellhead Wyrm', kind: 'unit', cost: 6, power: 9, tier: 'aetheric', tags: ['dragon'], emblem: 'dragon',
    fx: [{ on: 'reveal', do: 'weaken', to: 'here.theirs', n: 1 }] },
  { id: 'eg-garoth', name: 'Valkynaz Garoth', kind: 'unit', cost: 6, power: 9, tier: 'aetheric', tags: ['daedra'], emblem: 'fire',
    fx: [{ on: 'ongoing', do: 'buff', to: 'here.mine', n: 1 }] },
  // ── WITCH1 (2026-10-20, bible/06-Systems/Witches-Festival.md; the owner: "new cards"): THE WITCHES' FESTIVAL'S - "Demonologists,
  //    conjurors, lamias, warlocks, and thaumaturgists meet in the wilderness" (TEXT.RSC 8392), and "the dead do walk
  //    tonight" (8387); King Lysandus' spectre "began its haunting on the Day of the Dead" (8367). Sold by the Wyrd Sisters
  //    alone (net/festivalLaw.js FESTIVAL_CARD_IDS): no pack, no regular, no foe deals them (systems/card/cardSources.js). ──
  { id: 'warlock', name: 'Warlock', kind: 'unit', cost: 2, power: 2, tier: 'magic', tags: ['mage'], emblem: 'witch',
    fx: [{ on: 'reveal', do: 'magicka', n: 1 }] },
  { id: 'thaumaturge', name: 'Thaumaturge', kind: 'unit', cost: 3, power: 3, tier: 'magic', tags: ['mage'], emblem: 'mage',
    fx: [{ on: 'ongoing', do: 'buff', to: 'here.mine', tag: 'mage', n: 1 }] },
  { id: 'glenmoril-witch', name: 'Glenmoril Witch', kind: 'unit', cost: 4, power: 4, tier: 'rare', tags: ['mage'], emblem: 'witch',
    fx: [{ on: 'reveal', do: 'transform', to: 'here.theirs', pick: 'weakest', card: 'rat' }] },
  { id: 'demonologist', name: 'Demonologist', kind: 'unit', cost: 4, power: 3, tier: 'rare', tags: ['mage'], emblem: 'daedric',
    fx: [{ on: 'reveal', do: 'summon', card: 'imp', n: 2 }] },
  { id: 'tales-and-tallows', name: 'Tales and Tallows', kind: 'spell', cost: 3, power: 0, tier: 'magic', tags: [], emblem: 'candle',
    fx: [{ on: 'reveal', do: 'summon', card: 'ghost' }] },
  { id: 'spectre-of-lysandus', name: 'King Lysandus\' Spectre', kind: 'unit', cost: 6, power: 7, tier: 'legendary', tags: ['undead', 'noble'], emblem: 'ghost',
    fx: [{ on: 'reveal', do: 'weaken', to: 'all.theirs', n: 1 }] },
].map(deepFreeze));

/** THE HOLDINGS: the places of the Iliac Bay the game lays between the players, each bending its own ground. */
export const ILIAC_LOCATIONS = Object.freeze([
  { id: 'daggerfall', name: 'Daggerfall', kind: 'location', cost: 0, power: 0, tier: 'common', tags: ['city'], emblem: 'city',
    fx: [{ on: 'ongoing', do: 'buff', to: 'here', tag: 'knight', n: 2 }] },
  { id: 'sentinel', name: 'Sentinel', kind: 'location', cost: 0, power: 0, tier: 'common', tags: ['city'], emblem: 'desert',
    fx: [{ on: 'ongoing', do: 'buff', to: 'here', cost: [1, 2], n: 1 }] },
  { id: 'wayrest', name: 'Wayrest', kind: 'location', cost: 0, power: 0, tier: 'common', tags: ['city', 'fortress'], emblem: 'fortress',
    fx: [{ on: 'ongoing', do: 'room', n: 3 }] },
  { id: 'shornhelm', name: 'Shornhelm', kind: 'location', cost: 0, power: 0, tier: 'common', tags: ['city'], emblem: 'city',
    fx: [{ on: 'end', do: 'weaken', to: 'here', pick: 'weakest', n: 1 }] },
  { id: 'orsinium', name: 'Orsinium', kind: 'location', cost: 0, power: 0, tier: 'common', tags: ['fortress'], emblem: 'fortress',
    fx: [{ on: 'ongoing', do: 'buff', to: 'here', tag: 'orc', n: 2 }] },
  { id: 'betony', name: 'Betony', kind: 'location', cost: 0, power: 0, tier: 'common', tags: ['city'], emblem: 'sea',
    fx: [{ on: 'reveal', do: 'draw', n: 1 }] },
  { id: 'evermor', name: 'Evermor', kind: 'location', cost: 0, power: 0, tier: 'common', tags: ['city'], emblem: 'city',
    fx: [{ on: 'reveal', do: 'magicka', n: 1 }] },
  { id: 'castle-daggerfall', name: 'Castle Daggerfall', kind: 'location', cost: 0, power: 0, tier: 'common', tags: ['fortress'], emblem: 'fortress',
    fx: [{ on: 'ongoing', do: 'nospell' }] },
  { id: 'privateers-hold', name: 'Privateer\'s Hold', kind: 'location', cost: 0, power: 0, tier: 'common', tags: ['dungeon'], emblem: 'dungeon',
    fx: [{ on: 'ongoing', do: 'veil' }, { on: 'ongoing', do: 'nospell' }] },
  { id: 'mages-guild-hall', name: 'Mages Guild Hall', kind: 'location', cost: 0, power: 0, tier: 'common', tags: ['city'], emblem: 'mage',
    fx: [{ on: 'ongoing', do: 'discount', kind: 'spell', n: 1 }] },
  { id: 'vampire-crypt', name: 'Vampire\'s Crypt', kind: 'location', cost: 0, power: 0, tier: 'common', tags: ['dungeon'], emblem: 'dungeon',
    fx: [{ on: 'ongoing', do: 'buff', to: 'here', tag: 'undead', n: 2 }] },
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
