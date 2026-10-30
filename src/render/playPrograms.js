// @ts-check
// AUDIT SHADER-STALL (2026-10-20, the owner: "I need you to audit this and ensure this is perfect and fidelity isnt
// lost"; bible/07-Rendering/Performance-Priority.md SHADER-STALL, the audit): THE PASSES PLAY MEETS, STARTED AT THE
// BOOT'S IDLE. SHADER-STALL built a pass in play once the driver said its compile was done - no frame frozen on it -
// and a pass first wanted inside its compile was simply late: a gate's fire, the court's way in, the node's ring by
// the compile's time, and the Elite Breach's telegraphs and crystals for the first seconds of a fight (seconds, on
// D3D11), where before the screen had frozen and every drawn frame showed them. The audit's law: a pass the game is
// played by is never skipped for a compile (render/glProgram.js compiledPass `get(true)` builds it the frame it is
// needed), and none of them should have to wait - so where the driver compiles beside the frames
// (KHR_parallel_shader_compile) every one of them is started here, at the boot's idle, minutes before a player meets
// it, and its door finds it done. Where the driver cannot, nothing is started early (a compile queued on its thread
// would hold the frames that follow it): each pass is built the first time it is asked for, as before the slice.
// AURA-STALL (#1137): the auras' program is started here too. Like a gate's fire, its door is never asked as needed,
// so an aura met inside its compile is late, never a frame frozen. ARMORY: the armory's pieces too, for the same reason.
//
// Loaded by the renderer's idle warm (lazyWarmSteps), off the boot's static graph - the passes' own modules are the
// hosts' already.
import { parallelCompile, startProgramsInTurn } from './glProgram.js';
import { GATE_PASS_PROGRAMS } from './gate/gatePass.js';
import { telegraphPrograms } from './gate/gateTelegraph.js';
import { GATE_FX_PROGRAMS } from './gate/gateFx.js';
import { CRYSTAL_PROGRAMS } from './courtCrystals.js';
import { NODE_GLINT_PROGRAMS } from './nodeGlint.js';
import { AURA_PROGRAMS } from './auraRing.js';
import { ARMORY_PROGRAMS } from './armoryPass.js';
import { FIRE_PROGRAMS } from './redMountainFire.js';
import { GLOW_PROGRAMS } from './ghostfenceGlow.js';
import { NODE_GLOW_PROGRAMS } from './nodeGlow.js';
import { NAVAL_PROGRAMS } from './navalRender.js';
import { AURORA_PROGRAMS } from './auroraPass.js';
import { idleTurn } from './idleTurn.js'; // the queue's wait between turns

/** The programs started early: a gate's fire, the court's and the Spire's telegraphs, his blows' sparks, the crystals,
 *  the nodes' glint, the volcano's fire and the fence's glow (AUDIT RED-MOUNTAIN F5); SHADER-EASE QUEUE-ORDER
 *  (2026-10-29): the nodes' glow and the sea fight's effects, first built at a node or a broadside; then the auras' 16
 *  (AURA-SPLIT, AURA-STALL) and the armory's 8 (ARMORY) last - the longest compiles, each behind a door that waits for
 *  it, so they no longer hold the queue ahead of the cheap ones a first build reads at once. A door that asks for a
 *  pair still brings it to the front (glProgram.js COMPILE-QUEUE `wanted`). SKYRIM-AURORA: the aurora's after all of
 *  them - met only under Skyrim's night sky, and its door never waits (a late one fades in). */
export const playPrograms = () => [
  ...GATE_PASS_PROGRAMS,
  ...telegraphPrograms(false),
  ...telegraphPrograms(true),
  ...GATE_FX_PROGRAMS,
  ...CRYSTAL_PROGRAMS,
  ...NODE_GLINT_PROGRAMS,
  ...FIRE_PROGRAMS,
  ...GLOW_PROGRAMS,
  ...NODE_GLOW_PROGRAMS,
  ...NAVAL_PROGRAMS,
  ...AURA_PROGRAMS,
  ...ARMORY_PROGRAMS,
  ...AURORA_PROGRAMS,
];

/** Start them on `gl` where its driver compiles beside the frames; answers whether it did. COMPILE-QUEUE (FIELD BUGS
 *  2026-10-27b, "hitch 13064 ms" on the desktop app after login): one at a time (glProgram.js startProgramsInTurn). All
 *  at once filled the driver's few compile threads, and the warm's next build that read a link waited for nearly all of
 *  them, in an idle callback no frame sample holds (tools/compileStallProbe.mjs queue measures both). */
export function startPlayPrograms(gl, wait = idleTurn) {
  if (!gl || !parallelCompile(gl)) return false;
  void startProgramsInTurn(gl, playPrograms(), wait);
  return true;
}
