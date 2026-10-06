// @ts-check
// LEGACY-NAME (2026-10-06, bible/06-Systems/Legacy-Arc.md section 8): THE HOUSE'S NAME IN A SENTENCE - one word for every
// "the house of ..." the port says. A founder with no surname of their own founds a house named for its seat ("of
// Sentinel", systems/legacy/family.js nameAtSeat), and every sentence that put the surname after "the house of" said
// "the house of of Sentinel". A leaf: the family law, the windows, the towns' talk and the hosts read it, and the relay's
// bundle never carries it (net/houseLaw.js, which draws a seat's house under a name in its own words, is the relay's).

/** A house's name where a sentence says "the house of ..." - its surname, or a seat's house by its seat ("of Sentinel"
 *  says "Sentinel"); empty while the house has no name yet. */
export const houseWord = (surname) => String(surname ?? '').trim().replace(/^of\s+/i, '');
