// ES1 (2026-09-16, Mac: "lump this in as a new enhanced toggle. Enhanced
// Sounds, add the wind noise to it"): ONE SWITCH FOR THE PORT'S OWN
// SOUNDS - the ones Daggerfall never played and the enhanced skin adds.
//
// What rides it:
//   - the wind loop (systems/wind/windAudio.js, WIND3): a soft, steady wind
//     under the enhanced outdoors, rising and falling with the wind's
//     strength, silent indoors - a bed the port makes (FIELD-WIND1:
//     Daggerfall's own wind clips, replayed end to end, were a moan every
//     two seconds). It had its own row and pref (`windSound`) from WIND3
//     to here; that row IS this row now.
//   - the enhanced inventory's transfer cues (ui/enhanced/enhancedInventory.js,
//     MAC-O6): DoTransferItem's own gold clink and button click, which
//     the classic window always played and the enhanced one never did.
//   - the climb's sounds (player/climb/climbSounds.js, CLIMB4): hands on stone,
//     boots on the wall, the haul over a sill, a leap's rush and the grit
//     a failing grip lets go - eleven clips of the port's own
//     (tools/climbSfx.mjs); Daggerfall's climber climbs in silence.
//   - the horse's voices and its hooves (systems/horse/horseVoice.js, HORSE-VOICE): DFU's neigh clock saying a voice of
//     the horse's mood (a mount's whinny, snorts, blows, the gallop's breath in its stride, a spook at foes), and the
//     hooves on the ground under them - grass, snow, water (tools/horseSfx.mjs); a road keeps DFU's own clop.
//   - the soundscape (scenes/soundscapeHost.js, SOUNDSCAPE): a deck's air at sea - the swell, the wash, the rigging, a
//     hull's slaps, the timbers and the ropes, the canvas luffing, spray, gulls near land, the watch bells - and the
//     sea's own songs at a helm (systems/soundscape/seaAir.js, seaScore.js); on land the surf on a shore, the wild's
//     voices by climate and hour, a town's murmur, its smithies and its taverns (systems/soundscape/worldAir.js).
//
// The switch is the row `enhanced-sounds` on the Features home
// (systems/features.js), its pref `soundEnhancements` (RF4: the shelf
// derives the default from the row), the player's own online. The key
// does not begin with `enhanced` on purpose: the online lane's law (OL1)
// forces every `enhanced*` pref on for everyone, and a sound is the
// player's own - a look and a sound the room has no stake in, WIND3's
// own reading - so the key is named outside that family. The
// enhanced skin is the outer gate as it is for every enhanced row - the
// classic skin plays exactly what DFU plays and nothing more.
import { getPref } from './uiPrefs.js';
import { isEnhanced } from './uiSkin.js';

/** The pref's key - one spelling, read here and declared on the row. */
export const ENHANCED_SOUNDS_KEY = 'soundEnhancements';

/** Are the port's own sounds on: the enhanced skin and the pref. */
export function enhancedSoundsOn() {
  return isEnhanced() && !!getPref(ENHANCED_SOUNDS_KEY);
}
