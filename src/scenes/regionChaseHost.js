// @ts-check
// OW-CHASE-RANGE (2026-10-19, the owner: "4. Fix it"; bible/06-Systems/Travel-View.md OW-CHASE-RANGE): THE REGION'S CHASE
// WORDS HEARD - the streaming host's half of systems/travel/regionChase.js. A traveller's chases ride beside their region
// mark (`bd` the bands', `sr` the raiders'); each is heard through the host's own hearing (`bandHear`, `seaRaidHear` - the
// cell's word's, a fresh cell word for the same id preferred), standing TRAV_BAND_HOLD_MS, and (AUDIT OW-REVISITED):
//   - what the mark no longer names is WITHDRAWN - their next mark, a clear, a leave, a welcome that no longer lists them
//     (L4-2: a far chase stood drawn twenty-five seconds after it ended);
//   - a welcome's row is heard with its age gone from its word, one older than the word stands never heard (L4-2);
//   - nothing is heard of a traveller my map hides (`hidden` - L4-3: WILD1's open zone, where a stranger's mark is drawn
//     to no one, and a chase word beside it drew where they rode).
// HOST-SPLIT (bible/01-Overview/Host-Split.md): the hearing grew past three lines with the audit's fixes, so it lives here
// and `bootWorld` wires it. The streaming host constructs it (scenes/world.js) - the one host with the region's
// travellers; scenes/exterior.js, scenes/worldModes.js and scenes/dungeonContext.js hear no region.
import { regionChaseHeard, regionChaseWithdraw, TRAV_BAND_HOLD_MS } from '../systems/travel/regionChase.js';
import { travellerWorldOf } from '../systems/travellerMarks.js';
import { travellerKin } from '../systems/travel/travelViewFilters.js';

/** The ids a word names chasing (flag 1) - what a withdrawal keeps. */
const chasing = (word) => new Set(word.filter((e) => e[3] === 1).map((e) => e[0]));

/**
 * @param {{ bandHear: (from: string, raw: any[], hold?: number, aged?: number) => void,
 *   seaRaidHear: (from: string, raw: any[], hold?: number, aged?: number) => void,
 *   bands: () => Map<string, any>, raids: () => Map<string, any>, me: () => ({ x: number, y: number }),
 *   wildHides: (who: { kin?: any, wire?: number[], party?: boolean }) => boolean, social: () => any, guildTag: () => any }} host -
 *   the hearings; `bands` and `raids` their peer books (id -> { from, hold, ... }); `me` my map pixel; `wildHides` WILD1's
 *   test (the open zone hides a stranger), `social` the social link (friends, party), `guildTag` mine
 */
export function createRegionChaseHearing(host) {
  const { bandHear, seaRaidHear, bands, raids, me, wildHides, social, guildTag } = host;
  /** Whether my map hides the traveller `f`, standing at `w` (world) - their kin as the Overworld's filters read it. */
  const hidden = (f, w) => {
    const s = social();
    return wildHides({ kin: travellerKin({ friend: !!s?.isFriendPeer(f.id), gt: f.gt }, guildTag()), wire: [w.x, 0, w.z], party: !!s?.isPartyPeer(f.id) });
  };
  /** A traveller's frame (`f`: its id, its mark `p` or null for a clear, its words), `aged` ms of its word gone. */
  function hear(f, aged = 0) {
    const w = f.p ? travellerWorldOf(f.p) : null;
    const words = w && hidden(f, w) ? null : regionChaseHeard(f, me());
    regionChaseWithdraw(bands(), f.id, words && chasing(words.bd));
    regionChaseWithdraw(raids(), f.id, words && chasing(words.sr));
    if (words) { bandHear(f.id, words.bd, TRAV_BAND_HOLD_MS, aged); seaRaidHear(f.id, words.sr, TRAV_BAND_HOLD_MS, aged); }
  }
  /** A region's welcome (its rows, each `ag` seconds old): heard as they stand, the chases of any it no longer lists withdrawn. */
  function room(list) {
    const here = new Set((list ?? []).map((f) => f.id));
    for (const peers of [bands(), raids()]) for (const [, p] of peers) if (!here.has(p.from)) regionChaseWithdraw(peers, p.from);
    for (const f of list ?? []) if (f.ag * 1000 < TRAV_BAND_HOLD_MS) hear(f, f.ag * 1000); else hear({ id: f.id, p: null });
  }
  return { hear, room };
}
