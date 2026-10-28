// SD-PARTY (bible/11-Multiplayer/Super-Dungeons.md SD-PARTY): the rig's one party. A realm is a party's own Hour,
// `sd:<s>.<owner>` (net/superDungeon/sdLaw.js sdRoomKey), and its door admits the owner's party alone - the hub's word
// (server/src/index.js _instanceKinOf). The pins written before SD-PARTY play many fighters in one Hour; they stand them
// all in the one party here. The door itself is pinned against a real hub in sdparty_relay.test.js.
import { Room } from '../../../server/src/index.js';
import { sdRoomKey } from '../../../src/net/superDungeon/sdLaw.js';

/** The rig's party owner's digest. */
export const SD_TEST_OWNER = '0123456789abcdef';
/** Slot `s`'s Hour for the rig's party. @param {number} s */
export const sdTestKey = (s) => /** @type {string} */ (sdRoomKey(s, SD_TEST_OWNER));
/** Every account in this file's rooms is of one party: the hub's kin word is yes. */
export function sdOneParty() { Room.prototype._instanceKinOf = async function () { return true; }; }
