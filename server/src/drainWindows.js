// @ts-check
// A DRAINED ROOM LEAVES NOTHING ARMED (bible/11-Multiplayer/Scale-Arc.md, COST-1). Cloudflare bills an object's duration
// while it runs or sits in memory unable to hibernate, and a pending timer keeps it from hibernating. A cell arms three
// windows that wait up to ten minutes before they post - the spawn grant's measure (index.js _grantFold,
// _grantRelayTally: GRANT_MEASURE_MS), the staff traffic feed (staffFeeds.js netArm: the end of the NET_FEED_MS window)
// and the staff reaction feed (its tick, REACT_EPISODE_MS, re-armed while rows wait) - and a public line arms the
// reviewer's feed (index.js _feedLine: FEED_WAIT_MS). A player who crossed a cell left it billed for those minutes after
// they walked on. So the room's last leave (index.js _leave, its drain) posts every window that is open now and clears
// its timer; while the room holds a socket, every window posts on its own timer as before.
//
// A post that fails arms itself to go again (staffFeeds.js send). A room still empty when the posts settle lets that go
// too: each feed is a sample (staffFeeds.js keeps it in memory alone), and an evicted room would lose it anyway.

import { staffNetFlush, staffReactFlush, staffFeedsStop } from './staffFeeds.js';

/** Does `room` hold nobody - no socket of its own and no shard's? @param {any} room */
const drained = (room) => room.state.getWebSockets().length === 0 && !room._vsocks?.size;

/**
 * THE DRAIN'S POSTS: every window `room` holds open posted now (a window with nothing in it is only its timer cleared),
 * then, if the room is still empty, every timer a failed post armed cleared. Answers how many windows it posted.
 * @param {any} room the Room (index.js) whose last socket left
 */
export async function flushAtDrain(room) {
  const posts = [];
  const grants = room._grants;   // HIBERNATE: a window armed no timer - its rows alone say it is due
  if (grants && (grants.timer || grants.w?.rows.size || grants.w?.tallies.size)) posts.push(room._grantFlush());
  const staffNet = room._staffNet;
  if (staffNet && (staffNet.timer || staffNet.rows.size || staffNet.foes.size || staffNet.retry)) posts.push(staffNetFlush(room));
  const staffReact = room._staffReact;
  if (staffReact && (staffReact.timer || staffReact.rows.length || staffReact.retry)) posts.push(staffReactFlush(room));
  if (room._feedQ?.lines.length) posts.push(room._feedFlush());
  if (!posts.length) return 0;
  await Promise.allSettled(posts);
  if (drained(room)) {
    staffFeedsStop(room);
    if (room._grants?.timer) {
      clearTimeout(room._grants.timer);
      room._grants.timer = null;
    }
    if (room._feedQ?.timer) {
      clearTimeout(room._feedQ.timer);
      room._feedQ.timer = null;
    }
  }
  return posts.length;
}
