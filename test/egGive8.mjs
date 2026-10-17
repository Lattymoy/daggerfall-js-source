// THE ASCENT - THE ROOMS (LAW 9, 2026-10-16; bible/11-Multiplayer/Elite-Gates-Ascent.md): A LAW 8 CIRCLE GIVEN. The pins written
// against spec law 8's ground - a fight on a court laid along +z from the plate, a span's course from the plate, a lord on his
// ground at the hall's end - read law 8's halls by name now spec law 9 is the build's: a breach opened under law 8 is drawn so
// for its seven days (net/eliteGates/egDurable.js EG_LAWS), its halls handed to a client in the relay's own bytes (net/eliteGates/egLaw.js
// egSpecGive) - and so here. Every reader (the director, the legion, the lords, the client, the circle's mesh and collider)
// then stands on law 8's ground; a pin's PIN MOVED note says so where it is used. LAW 9's own ground is test/net/eliteGates/law9_rooms.test.js's
// and test/net/eliteGates/law9_height.test.js's. Forget them after (egSpecForget).
import { egHallOf, egSpecGive, egFirstHallOf, egCircleOfHall } from '../src/net/eliteGates/egLaw.js';

/** Seed `seed`'s circles `cs` (ground `geo`) of spec law 8, every hall given. Answers the halls given. */
export function egGive8(seed, cs = [1], geo = 0) {
  const out = [];
  for (const c of cs) for (let s = 1; s <= 5; s++) { const spec = egHallOf(seed, egFirstHallOf(c) + s - 1, geo, 8); egSpecGive(spec); out.push(spec); }
  return out;
}
/** The circle of hall `h` of seed `seed` given (egGive8), and hall `h` itself answered (as given). */
export function egGive8Hall(seed, h, geo = 0) {
  egGive8(seed, [egCircleOfHall(h)], geo);
  return egHallOf(seed, h, geo);
}
/** Halls `list` (`[seed, hall, ground]` each) of spec law 8 given - where a pin's halls stand in more circles than the relay's
 *  given halls hold (net/eliteGates/egLaw.js egSpecGive keeps 32). */
export function egGive8Halls(list) {
  for (const [seed, h, geo] of list) egSpecGive(egHallOf(seed, h, geo ?? 0, 8));
}
