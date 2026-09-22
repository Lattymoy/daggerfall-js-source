// CRUX1 (2026-09-22, a player through Mac: "the final dungeon mission
// is unbeatable"): THE QUEST VIDEOS PLAY ONE AFTER ANOTHER. DFU's
// PlayVideo pushes a DaggerfallVidPlayerWindow onto the UI stack
// (PlayVideo.cs:78-82 through DaggerfallUI.PushWindow), and a window
// pushed while another stands shows when the first pops - so two
// videos due on one tick play in turn. The port's door started a
// player per call, off the tick's frame, and the ending's `_delay_`
// task (video 3) and the ending task it wakes (video 14, or whichever
// totem-holder's) fire on the SAME tick: two players over one canvas,
// each fighting the other for the frame. A queue on one promise chain
// is the stack's order without the stack: a play waits for the one
// before it, and a play that fails (a missing ANIM - the door never
// traps) releases the next rather than holding the chain.
//
// `play(name)` is the host's own async door; the queue owns nothing
// but the order.

/** @param {(name: string) => Promise<unknown>} play */
export function makeVideoQueue(play) {
  let chain = Promise.resolve();
  let depth = 0;
  const queue = (name) => {
    depth++;
    const turn = chain.then(() => play(name)).catch(() => undefined).finally(() => { depth--; });
    chain = turn;
    return turn;
  };
  /** how many plays are queued or playing - the pins' window in */
  queue.pending = () => depth;
  return queue;
}
