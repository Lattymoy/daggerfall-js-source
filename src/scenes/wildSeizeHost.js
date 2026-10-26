// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.

import { WILD_FALL_GRACE_S } from '../net/wild/wildReceipt.js';

/** @param {any} host */
export function createWildSeizeHost(host) {
  const {
    _wildSeize, campToWire, player, wildAccount, wildDeposit
  } = host;
  /** A FALL I WON whose fallen let the grace go by with no remains in the room: its drop taken by me, a SEIZURE (the
   *  service moves their record where it stands), and deposited where they fell. */
  const wildSeizeFrame = () => {
    const now = Date.now();
    for (const [r, s] of [..._wildSeize]) {
      if (now < s.due) continue;
      _wildSeize.delete(r);
      if (host.wildRemains.has(r)) continue;   // their tab took it: its remains stand (or stood)
      const p = s.p ?? campToWire(player.feetAt());   // AUDIT INT9: where the body fell, in its room's frame
      wildAccount.fall({ receipt: s.rc, room: s.room, ...(host.online?.wildCollectAt?.(s.room) ? { collect: 1 } : {}) }).then((a) => {   // MAC (2026-10-14): my piece in escrow where the room signs my collect
        const d = a?.ok ? a.data : null;
        if (d?.order && Array.isArray(d.items) && d.items.length) { wildDeposit({ r: d.r, items: d.items, o: d.order, p, room: s.room, mine: null }); return; }
        // AUDIT INT9: a word that says nothing of the fall (offline, the service's own error, the rate, a record that moved
        // under the seizure) is asked again, a few times
        if (['offline', 'server', 'rate', 'seq', 'no-session'].includes(a?.error) && s.tries < 3) _wildSeize.set(r, { ...s, due: Date.now() + 5_000 * (s.tries + 1), tries: s.tries + 1 });
        // WILD-REJOIN: a fall signed with its fallen gone is carried at once, and an account service from before that
        // word answers 'grace' - asked again once the grace every service knows has gone by
        else if (a?.error === 'grace' && !s.graceWaited) _wildSeize.set(r, { ...s, due: Date.now() + (WILD_FALL_GRACE_S + 5) * 1000, graceWaited: true });
      }).catch(() => { /* the fallen's own tab, or nobody: the receipt's hour is theirs */ });
    }
  };
  return { wildSeizeFrame };
}
