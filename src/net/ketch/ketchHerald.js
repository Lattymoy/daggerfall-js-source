// @ts-check
// KETCH (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 14): THE SKY-KETCH'S HERALD - what the relay's hub posts to the
// world events' Discord channel for the Ketch, and when: the serpent's law (net/serpent/serpentHerald.js) with no site to
// agree on - the voyage is the clock's (net/ketch/ketchLaw.js), so the hub keeps nothing but the last moment it posted.
//
//   SIGHTED  at the voyage's sighting (KT_SIGHT_MS before she keeps station), pinging the opt-in role: where she will keep
//            station and when her anchor-lift comes down. Posted late while she has not arrived, never after.
//   ARRIVED  at her arrival: the anchor-lift down, and until when crews may board. Quiet. Posted late while she keeps
//            station, never after.
//   DEPARTING at her weighing anchor: the lift drawn up, the crews aboard's last minutes. Quiet. Posted late while she is
//            still in the sky.
//
// THE DOOR: the gate's channel (GATE_DISCORD_WEBHOOK), its card in her family (net/herald/heraldCard.js HERALD_FAMILIES.ketch);
// the role the sighting pings is KT_DISCORD_ROLE when the operator names one, else the gate's own.
//
// PURE, and the relay's: it imports ketchLaw.js and heraldCard.js, both the relay's already. Nothing here fetches. Its
// words are the channel's English, written here (the relay sets no locale; a Discord card is the community's, as the
// serpent's and the Hour's are) - the page's own lines of the voyage are systems/ketch/ketchWords.js.
//
// Not a DFU member: Daggerfall has no other players and no Discord. Ledger A (KETCH).
import { ketchVoyageAt, ketchVoyageOf, KT_CREW_MAX } from './ketchLaw.js';
import { heraldCard, heraldStamp, heraldWhen, heraldRole } from '../herald/heraldCard.js';

/** The moments, in a voyage's order - each posted once a voyage. */
export const KT_HERALD_MOMENTS = Object.freeze(['sighted', 'arrived', 'departing']);
/** The role the sighting pings: her own, when the operator names one, else the gate's - or null, none pinged. */
export const ketchHeraldRole = (own, gate) => heraldRole(own) ?? heraldRole(gate);

/** THE SIGHTING'S POST: she is coming, where she will keep station and when - the role pinged. */
export function ketchSightedPost({ n, role = null }) {
  const v = ketchVoyageOf(n);
  return heraldCard({
    family: 'ketch', moment: 'Sighted', role,
    title: 'The Sky-Ketch has been sighted',
    ping: `The Sky-Ketch arrives over Daggerfall ${heraldStamp(v.at, 'R')}.`,
    text: `The Sky-Ketch has been sighted east of Daggerfall. When it arrives, its anchor-lift comes down in the fields east of the city. Take your party up, ${KT_CREW_MAX} players at most.`,
    fields: [['Arrives', heraldWhen(v.at)], ['Weighs anchor', heraldStamp(v.departAt, 'f')], ['Where', 'Over the fields east of Daggerfall']],
  });
}
/** THE ARRIVAL'S POST: the anchor-lift down, and until when crews may board. Pings nobody. */
export function ketchArrivedPost({ n }) {
  const v = ketchVoyageOf(n);
  return heraldCard({
    family: 'ketch', moment: 'Arrived',
    title: 'The Sky-Ketch is over Daggerfall',
    text: 'The Sky-Ketch has arrived over Daggerfall. Its anchor-lift is down in the fields east of the city.',
    fields: [['Boarding until', heraldWhen(v.departAt)], ['Crew', `Up to ${KT_CREW_MAX} a ship - your party`], ['Where', 'The fields east of Daggerfall']],
  });
}
/** THE WEIGHING ANCHOR'S POST: the lift drawn up, the crews aboard's last minutes. Pings nobody. */
export function ketchDepartingPost({ n }) {
  const v = ketchVoyageOf(n);
  return heraldCard({
    family: 'ketch', moment: 'Weighing anchor',
    title: 'The Sky-Ketch weighs anchor',
    text: 'The Sky-Ketch is weighing anchor. Boarding is closed. Crews already aboard can finish until it leaves.',
    fields: [['Turns west', heraldWhen(v.endAt)], ['Next voyage', heraldStamp(ketchVoyageOf(n + 1).at, 'F')]],
  });
}
/** A moment's post. */
export const ketchHeraldPost = (n, k, role = null) => (k === 'sighted' ? ketchSightedPost({ n, role }) : k === 'arrived' ? ketchArrivedPost({ n }) : ketchDepartingPost({ n }));

/** A posted moment as the hub keeps it (`{ n, k }` - the voyage and the moment's index), read back: `{ n: -1, k: -1 }` for none. */
export function readKetchHeraldState(v) {
  const n = Number.isSafeInteger(v?.n) ? v.n : -1, k = Number.isSafeInteger(v?.k) && v.k >= 0 && v.k < KT_HERALD_MOMENTS.length ? v.k : -1;
  return { n: n >= 0 && k >= 0 ? n : -1, k: n >= 0 ? k : -1 };
}
/**
 * THE POST THE HERALD OWES NEXT at `now` (relay ms) past the last posted (`posted` - readKetchHeraldState's): `{ n, k, at }` -
 * the voyage, the moment's name, when it is due (now, once its instant has come) - or null for none owed. A moment whose
 * window has passed unposted (a hub asleep through it, a deploy) is let go: the next moment, or the next voyage's.
 * @param {number} now @param {{ n: number, k: number }} posted
 */
export function ketchHeraldDue(now, posted) {
  const v = ketchVoyageAt(now);
  const P = readKetchHeraldState(posted);
  /** @type {Array<[string, number, number]>} */
  const moments = [['sighted', v.sightAt, v.at], ['arrived', v.at, v.departAt], ['departing', v.departAt, v.endAt]];
  for (let k = 0; k < moments.length; k++) {
    const [name, at, until] = moments[k];
    if (v.n < P.n || (v.n === P.n && k <= P.k)) continue;   // posted, or before what was
    if (now >= until) continue;   // its window gone - let go
    return { n: v.n, k: name, i: k, at: Math.max(now, at) };
  }
  // this voyage's all posted or gone: the next voyage's sighting
  const next = ketchVoyageOf(v.phase === 'away' ? v.n : v.n + 1);
  if (next.n < P.n || (next.n === P.n && P.k >= 0)) return null;
  return { n: next.n, k: 'sighted', i: 0, at: Math.max(now, next.sightAt) };
}
