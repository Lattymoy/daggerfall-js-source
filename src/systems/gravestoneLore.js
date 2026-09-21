// GRAVESTONE LORE — an original flavour addition, not a DFU port. There
// is no classic "read the gravestone" feature and no per-stone game
// data to read it from (graveyards carry a LOCATION TYPE for the
// ambient sound layer alone - systems/ambience.js's cemetery drone -
// and no individual headstone is a distinct clickable object anywhere
// in the block data this port already parses). Rather than guess at a
// texture archive/record range for "which flat is a headstone" and
// risk a feature that silently finds nothing, this reads the ONE thing
// that already is real and load-bearing here: standing inside a
// Graveyard-type location (LOCATION_TYPES.Graveyard, the same test the
// cemetery ambience already runs) with Info mode selected. An
// activation that hits nothing else there is read as "you kneel and
// read the nearest stone", and one of these lines answers - through
// the ordinary HUD/popup-text line (townTalk.say), which is already
// the enhanced skin's own small text (ui/enhancedHudText.js) rather
// than a new window.

/** Sixteen short, in-world phrases - no real name is invented for any
 *  of them (a graveyard's stones this port has no census for should
 *  not start naming villagers), so every line reads as weathered,
 *  anonymous or riddling rather than a citizen's own epitaph. */
export const GRAVESTONE_PHRASES = Object.freeze([
  'Here lies one the plague did not ask twice.',
  'The stone is worn smooth. Only "beloved" still reads.',
  'Born in one age, buried in another.',
  'A merchant, honest by the end.',
  'Taken by the road, brought home by it too.',
  'No name. The moss took it first.',
  'They said the wolves would not come this far.',
  'Rest well - the vault beneath answers no knock.',
  'A soldier who never once drew steel in anger.',
  'The dates are close together. The winter, they say.',
  'Carved by a hand that loved them, and could not spell.',
  'Do not linger past dusk to read the rest.',
  'A debt is owed here, and no one living remembers whose.',
  'This one, they buried facing east. No one recalls why.',
  'Once a name here. Now only a shape in the stone.',
  'The ground is soft. Something was dug, and something was put back.',
]);

/** DaggerfallUnity-style: pure over its own roll, so a test can pin the
 *  index without needing a live RNG. */
export function randomEpitaph(rolls = Math.random) {
  const i = Math.floor(rolls() * GRAVESTONE_PHRASES.length);
  return GRAVESTONE_PHRASES[Math.min(i, GRAVESTONE_PHRASES.length - 1)];
}
