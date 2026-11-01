// @ts-check
// The Pipe's and Nirnroot's rows, a leaf: the item law runs on the account service, which loads none of the game, so it
// reads these rows beside the registry (itemLaw.js lawTemplate). pipeItem.js lays the names and pictures over them and
// registers them. It imports nothing.

/** Template 585, the Pipe: free beside the Lockpick's 584, below the professions' reserved 600. */
export const PIPE_TEMPLATE = 585;
/** Template 586, Nirnroot: what the Pipe is packed with. */
export const NIRNROOT_TEMPLATE = 586;
/** A clay pipe: light, cheap, one to a slot, never worn out by smoking. Rarity 20: only the counter shelves it. */
export const PIPE_LAW_ROW = Object.freeze({
  index: PIPE_TEMPLATE,
  baseWeight: 0.1,
  hitPoints: 100,
  basePrice: 15,
  rarity: 20,
  stackable: false,
});
/** A sprig of nirnroot: a rare herb, so dearer than the common plants; it stacks with its own kind alone. */
export const NIRNROOT_LAW_ROW = Object.freeze({
  index: NIRNROOT_TEMPLATE,
  baseWeight: 0.1,
  hitPoints: 100,
  basePrice: 25,
  rarity: 20,
  stackable: true,
});
