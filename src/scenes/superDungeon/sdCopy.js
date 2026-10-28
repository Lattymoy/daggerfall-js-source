// @ts-check
// SD-PARTY (2026-10-28, the owner: "we need to make this a party instance ... to stop griefin on the bosses";
// bible/11-Multiplayer/Super-Dungeons.md SD-PARTY): WHICH PARTY'S HOUR THE RIFT TAKES ME TO. Each party has its own
// Shattered Hour, `sd:<s>.<owner>` (net/superDungeon/sdLaw.js sdRoomKey), the owner its leader's account digest - the
// Ketch's crew law (scenes/ketch/ketchClient.js ketchShipChoice). The copy I went into is kept on the device, so a reload
// or a new leader keeps me in it while its owner is me or still in my party. Alone, the Hour is my own.
import { instanceOwnerOf } from '../../net/instanceRoom.js';

/** Where the device keeps the copy I last went into: `{ s, a, o, p }` - the slot, my account, the owner's digest, my
 *  party's id then (null alone). */
export const SD_COPY_KEY = 'sd.myCopy';
const OWNER_RE = /^[0-9a-f]{16}$/;

/**
 * THE CHOICE, pure: the kept copy where it is this slot's, mine, kept in the party I am in now (`party`, its id), and its
 * owner is me or a member of it (`members`, their digests); else the leader's (alone, mine). Answers `{ owner }` (a
 * digest) or `{ captain }` (an account to digest).
 * @param {number} s @param {string} mine @param {string|null} leader @param {any} kept @param {ReadonlyArray<string>} members
 * @param {string|null} [party]
 */
export function sdCopyChoice(s, mine, leader, kept, members, party = null) {
  if (kept && kept.s === s && kept.a === mine && (kept.p ?? null) === party && typeof kept.o === 'string' && OWNER_RE.test(kept.o) && members.includes(kept.o)) return { owner: kept.o };
  return { captain: leader ?? mine };
}

/**
 * @param {{ social: () => any, store?: { get?: (k: string) => any, set?: (k: string, v: any) => void } | null }} deps
 *   `social` the hub link (its `acct`, its `party`: `{ leader, members: [{ acct }] }`), `store` the device's
 */
export function createSdCopy({ social, store = null }) {
  let mem = null;
  const kept = () => { if (mem) return mem; try { return store?.get?.(SD_COPY_KEY) ?? null; } catch { return null; } };
  const keep = (v) => { mem = v; try { store?.set?.(SD_COPY_KEY, v); } catch { /* memory holds it */ } };
  return {
    /** The owner's digest of the copy slot `s` takes me to, kept - or null with no account. */
    async ownerFor(s) {
      const so = social(), mine = so?.acct ?? null;
      if (!mine) return null;
      const party = so?.party ?? null;
      const accts = [mine, ...(party?.members ?? []).map((m) => m?.acct).filter((a) => typeof a === 'string' && a !== mine)];
      const members = (await Promise.all(accts.map((a) => instanceOwnerOf(a)))).filter((d) => typeof d === 'string');
      const pid = typeof party?.id === 'string' ? party.id : null;
      const pick = sdCopyChoice(s, mine, party?.leader ?? null, kept(), members, pid);
      const owner = pick.owner ?? await instanceOwnerOf(pick.captain);
      if (owner) keep({ s, a: mine, o: owner, p: pid });
      return owner;
    },
  };
}
