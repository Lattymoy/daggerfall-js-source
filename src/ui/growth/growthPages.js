// @ts-check
// GROWTH1 (bible/10-UI/Growth.md section 3) - THE GROWTH TAB'S PAGES, a leaf: the boot doors (ui/pauseDoor.js) ask
// whether a landing is one of them without loading the tab (ui/growth/growthTab.js, the pause window's lazy chunk's),
// whose guide reads the spellbook's own words.

/** The rail's pages, in order, by id - their words are the tab's own, through the text core (growthTab.js LABEL). A
 *  landing may name any of them (or 'growth' for the first). */
export const GROWTH_PAGE_SECTIONS = Object.freeze(['level', 'specs', 'firmament', 'captain'].map((id) => Object.freeze([id])));
/** A family's guide by name - the classic sheet's S row lands on the arcane, its W row on the martial (GROWTH4). */
export const SPEC_LANDINGS = Object.freeze({ 'specs:arcane': 'arcane', 'specs:martial': 'martial' });
/** Whether a door's landing is the Growth tab or one of its pages. */
export const growthPageAt = (at) => at === 'growth' || GROWTH_PAGE_SECTIONS.some(([id]) => id === at) || Object.hasOwn(SPEC_LANDINGS, at ?? '');
