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
import { VEIN_TABLES, dungeonVeinTable, regionSignature, UNCONFIRMED_VEIN_TIER, WITNESS, factConfirmed } from '../net/nodeLaw.js';
import { kingdomOf, KINGDOMS } from '../net/kingdomLaw.js';
import { minedMaterial } from '../net/professionLaw.js';
import { materialLabel } from '../systems/professions/profItems.js';
import { REGION_NAMES } from '../formats/mapsTables.js';

export const ORE_TIP_TITLE = 'Ore here';
/** The rule the state line rests on, said where the ground is not yet witnessed. */
export const ORE_WITNESS_RULE = `Witnessed once ${WITNESS.confirm} players with accounts at least a week old gather here`;

/** An ore as the card names it: DFU's own name, a new ore's without its "Ore" ("Mithril", "Dwarven Scrap"). */
export const oreWord = (key) => materialLabel(key).replace(/ Ore$/, '');
/** "Gold", "Gold or Ebony", "Gold, Platinum or Mithril". */
const orList = (words) => (words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} or ${words[words.length - 1]}`);
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
  const lines = [`Veins: ${table.map(oreWord).join(', ')}`, `Dungeons: ${dungeonVeinTable(climate).map(oreWord).join(', ')}`];
  if (sig) {
    const crown = kingdomOf(region);
    const owner = crown ? KINGDOMS[crown].name : REGION_NAMES[/** @type {number} */ (region)] ?? 'This land';
    lines.push(`${owner}'s own ore: ${oreWord(sig.ore)}`);
  }
  // what the witnesses hold back: the table's veins over the unwitnessed tier, and the signature - MINE-PERKS: from a
  // Surveyor the signature alone (their own word witnesses the rest), so their card says no vein waits, or only it
  const held = [...new Set([...(surveyed ? [] : table.filter((k) => tierOf(k) > UNCONFIRMED_VEIN_TIER)), ...(sig ? [sig.ore] : [])])].map(oreWord);
  if (factConfirmed(fact)) lines.push('Witnessed ground: every vein can appear here');
  else if (!held.length) lines.push('No vein here needs witnesses');
  else lines.push(fact ? `Not yet witnessed: no ${orList(held)} here yet` : `${orList(held)} only on witnessed ground`, ORE_WITNESS_RULE);
  return { title: ORE_TIP_TITLE, lines };
}
