// @ts-check
// SD-PARTY (2026-10-28, the owner: "we need to make this a party instance ... to stop griefin on the bosses";
// bible/11-Multiplayer/Super-Dungeons.md SD-PARTY): WHICH PARTY'S HOUR THE RIFT TAKES ME TO. Each party has its own
// Shattered Hour, `sd:<s>.<owner>` (net/superDungeon/sdLaw.js sdRoomKey), the owner its leader's account digest - the
// Ketch's crew law (scenes/ketch/ketchClient.js ketchShipChoice). The copy I went into is kept on the device, so a reload
// or a new leader keeps me in it while its owner is me or still in my party. SD-SOLO: in no party, the relay's walk
// (server/src/sdCopy.js sdOpenDoor) finds the shared Hour that holds me or has a seat; none answering, my own.
import { instanceOwnerOf } from '../../net/instanceRoom.js';
import { sdPubOwner, isSdPubOwner, SD_PUB_SEATS } from '../../net/superDungeon/sdLaw.js';
import { t } from '../../systems/textManager.js';

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

/** The relay's https origin for its `wss://` address, or null. @param {string|null|undefined} url */
export const sdRelayHttp = (url) => (typeof url === 'string' && /^wss?:\/\//.test(url) ? url.replace(/^ws/, 'http').replace(/\/+$/, '') : null);

/** SD-SOLO (the owner: "player are told that only the party or how many player are already in that instance"): the line
 *  said on stepping into the Hour owned by `owner`, with `n` players in it, me counted. Null: no owner. */
export function sdCopyLine(owner, n) {
  if (!owner) return null;
  if (!isSdPubOwner(owner)) return t('sd.copy.party', 'Only your party can enter this Hour.');
  return t('sd.copy.shared', '{n} of {max} players are in this shared Hour.', { n: Math.max(1, Math.min(SD_PUB_SEATS, n | 0)), max: SD_PUB_SEATS });
}

/**
 * @param {{ social: () => any, store?: { get?: (k: string) => any, set?: (k: string, v: any) => void } | null,
 *   relay?: () => string|null|undefined, fetchImpl?: typeof fetch }} deps
 *   `social` the hub link (its `acct`, its `party`: `{ leader, members: [{ acct }] }`), `store` the device's, `relay` its address
 */
export function createSdCopy({ social, store = null, relay = () => null, fetchImpl = (...a) => fetch(...a) }) {
  let mem = null;
  const kept = () => { if (mem) return mem; try { return store?.get?.(SD_COPY_KEY) ?? null; } catch { return null; } };
  const keep = (v) => { mem = v; try { store?.set?.(SD_COPY_KEY, v); } catch { /* memory holds it */ } };
  return {
    /** The owner's digest of the copy slot `s` takes me to, kept - or null with no account. */
    async ownerFor(s) {
      const so = social(), mine = so?.acct ?? null;
      if (!mine) return null;
      const party = so?.party ?? null;
      if (!(party?.members ?? []).some((m) => typeof m?.acct === 'string' && m.acct !== mine)) {
        const me = await instanceOwnerOf(mine), base = sdRelayHttp(relay());
        let n = null;
        try { const res = base && me ? await fetchImpl(`${base}/sd/open?s=${s}&o=${me}`) : null; n = res?.ok ? (await res.json())?.n ?? null : null; } catch { n = null; }
        return sdPubOwner(n) ?? me;   // SD-SOLO: the shared Hour, or alone my own
      }
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
