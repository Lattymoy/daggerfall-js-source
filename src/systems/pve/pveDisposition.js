// @ts-check
// FIXED-PVE (bible/05-Combat/Fixed-PvE.md): HOW A CREATURE MEETS A PLAYER, apart from what it is and how it fights. A
// template sets a starting state; what moves it (a blow, a crime, a faction's standing, an event) is a later stage's,
// on the faction and crime systems the game has. `protected` is a legal mark beside a state, never a state.
// Ledger A (FIXED-PVE).

export const DISPOSITIONS = Object.freeze(['friendly', 'neutral', 'wary', 'territorial', 'hostile', 'fleeing', 'submissive']);

/** Wildlife ways: the state each starts in and the state a blow on it moves it to. */
export const WILDLIFE = Object.freeze({
  passive: Object.freeze({ start: 'neutral', struck: 'hostile' }),
  skittish: Object.freeze({ start: 'wary', struck: 'fleeing' }),
  territorial: Object.freeze({ start: 'territorial', struck: 'hostile' }),
  predatory: Object.freeze({ start: 'hostile', struck: 'hostile' }),
  domesticated: Object.freeze({ start: 'friendly', struck: 'fleeing' }),
});

/** What a peaceful creature can offer, each an existing service. */
export const INTERACTIONS = Object.freeze(['talk', 'trade', 'train', 'quest', 'faction', 'hire', 'rumour']);

/** Does a creature in `state` start a fight? Only a hostile one does; a territorial one warns first. */
export const startsFights = (state) => state === 'hostile';
