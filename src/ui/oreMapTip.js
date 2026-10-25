// @ts-check
// ORE-MAP (2026-10-11, from play - "Arbitrary mining conditions to 'unlock' higher nodes. Why is this a thing? Also how
// are we supposed to tell if higher tier veins have been unlocked in an area?", then "If at all possible can you please
// add something to the overworld map like 'this area is known for X ore' so its easier to know which locations have
// which ore"): THE HELD MAP'S CARD FOR A PIXEL'S ORE - what its ground's veins can be (its climate's table,
// net/nodeLaw.js VEIN_TABLES), what its dungeons' deep veins can be (dungeonVeinTable), the ore its kingdom holds as its
// own (regionSignature), and whether the witnesses have vouched for this ground: on ground fewer than WITNESS.confirm
// accounts have worked, a vein is held to UNCONFIRMED_VEIN_TIER and no signature stands (UNWITNESSED-ORE), and nothing
// said so anywhere but the Professions page's one paragraph. Every word here is read off the law that stands the veins,
// so the card cannot promise an ore the ground would not give. The host hands it the pixel's witnessed state as the
// account answers it (net/profBook.js pixel) - null where it has not been asked today.
//
// DEEP-OPEN (bible/06-Systems/Professions-Arc.md section 53; the owner: "FULL ORE TABLE"): a dungeon's deep veins draw
// their whole table on anyone's word now (nodeLaw.js dungeonVein - DUNGEON_VEINS), so the Dungeons line names that table,
// and the one deep ore that still waits on a dungeon's own witnesses - its climate's (deepClimateOres: a woodland
// dungeon's Moonstone) - is said on the state line, which had read the surface table alone: a HauntedWoodlands card
// said "No vein here needs witnesses" over dungeons whose Moonstone did. Its words through the text core (L10N4), the
// ores' and the lands' names DFU's own.
import { VEIN_TABLES, DUNGEON_VEINS, deepClimateOres, regionSignature, UNCONFIRMED_VEIN_TIER, WITNESS, factConfirmed } from '../net/nodeLaw.js';
import { kingdomOf, KINGDOMS } from '../net/kingdomLaw.js';
import { minedMaterial } from '../net/professionLaw.js';
import { materialLabel } from '../systems/professions/profItems.js';
import { REGION_NAMES } from '../formats/mapsTables.js';
import { t, formatMessage, intlLocale } from '../systems/textManager.js';

export const ORE_TIP_TITLE = 'Ore here';
/** The rule the state line rests on, said where the ground is not yet witnessed - its English (`{n}` WITNESS.confirm). */
const WITNESS_RULE = 'Witnessed once {n} players with accounts at least a week old gather here';
export const ORE_WITNESS_RULE = formatMessage(WITNESS_RULE, { n: WITNESS.confirm });
/** The state line's words, each its English. */
const WITNESSED = 'Witnessed ground: every vein can appear here';
const NONE_HELD = 'No vein here needs witnesses';
const NOT_YET = 'Not yet witnessed: no {ores} here yet';
const ONLY_WITNESSED = '{ores} only on witnessed ground';
/** DEEP-OPEN: a climate's deep ore, which waits on the dungeon's own witnesses - beside the ground's word, or alone. */
const DEEP_WITNESSED = '{ores} in witnessed dungeons';
const DEEP_ONLY = '{ores} only in witnessed dungeons';

/** An ore as the card names it: DFU's own name, a new ore's without its "Ore" ("Mithril", "Dwarven Scrap"). */
export const oreWord = (key) => materialLabel(key).replace(/ Ore$/, '');
/** "Gold", "Gold or Ebony", "Gold, Platinum or Mithril" - in another language, its own (Intl.ListFormat's disjunction). */
const orList = (words) => {
  if (words.length < 2) return words.join('');
  const loc = intlLocale();
  if (!String(loc).startsWith('en')) { try { return new Intl.ListFormat(loc, { type: 'disjunction' }).format(words); } catch { /* the English below */ } }
  return `${words.slice(0, -1).join(', ')} or ${words[words.length - 1]}`;
};
const tierOf = (key) => minedMaterial(key)?.tier ?? 0;

/**
 * The card for one pixel, `{ title, lines }` (ui/eventMapMarks.js readTip's shape), or null where no vein stands (the
 * sea, and every climate without a table).
 * @param {{ climate: number, region?: number|null, fact?: { state: string }|null, surveyed?: boolean }} p `fact` the pixel's witnessed
 *   state (net/nodeLaw.js witnessedFact's `state`), null not known; `surveyed` (MINE-PERKS) the reader a Surveyor, whose
 *   veins on such ground are the climate's whole table and only the signature waits (net/nodeLaw.js vein)
 */
export function oreMapTip({ climate, region = null, fact = null, surveyed = false }) {
  const table = VEIN_TABLES[climate];
  if (!table) return null;
  const sig = Number.isInteger(region) ? regionSignature(region) : null;
  const words = (keys) => keys.map(oreWord).join(', ');
  // DEEP-OPEN: the deep veins' table every dungeon draws on anyone's word - its climate's own ore apart (below)
  const lines = [t('ore.tip.veins', 'Veins: {ores}', { ores: words(table) }), t('ore.tip.dungeons', 'Dungeons: {ores}', { ores: words(DUNGEON_VEINS) })];
  if (sig) {
    const crown = kingdomOf(region);
    const owner = crown ? KINGDOMS[crown].name : REGION_NAMES[/** @type {number} */ (region)] ?? t('ore.tip.thisLand', 'This land');
    lines.push(t('ore.tip.own', '{owner}\'s own ore: {ore}', { owner, ore: oreWord(sig.ore) }));
  }
  // what the witnesses hold back: the table's veins over the unwitnessed tier, and the signature - MINE-PERKS: from a
  // Surveyor the signature alone (their own word witnesses the rest), so their card says no vein waits, or only it
  const held = [...new Set([...(surveyed ? [] : table.filter((k) => tierOf(k) > UNCONFIRMED_VEIN_TIER)), ...(sig ? [sig.ore] : [])])].map(oreWord);
  // DEEP-OPEN: and a dungeon's climate ore, which waits on that dungeon's witnesses whatever this ground's state (a
  // Surveyor's word witnesses their surface veins alone - nodeLaw.js vein `surveyed`)
  const deep = deepClimateOres(climate).map(oreWord);
  const deepWord = deep.length ? t('ore.tip.deepWitnessed', DEEP_WITNESSED, { ores: orList(deep) }) : null;
  const withDeep = (ground) => (deepWord ? t('ore.tip.both', '{ground}; {deep}', { ground, deep: deepWord }) : ground);
  const rule = t('ore.tip.rule', WITNESS_RULE, { n: WITNESS.confirm });
  if (factConfirmed(fact)) lines.push(withDeep(t('ore.tip.witnessed', WITNESSED)));
  else if (!held.length) lines.push(...(deep.length ? [t('ore.tip.deepOnly', DEEP_ONLY, { ores: orList(deep) }), rule] : [t('ore.tip.none', NONE_HELD)]));
  else lines.push(withDeep(fact ? t('ore.tip.notYet', NOT_YET, { ores: orList(held) }) : t('ore.tip.onlyWitnessed', ONLY_WITNESSED, { ores: orList(held) })), rule);
  return { title: t('ore.tip.title', ORE_TIP_TITLE), lines };
}
