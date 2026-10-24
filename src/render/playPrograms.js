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
// so an aura met inside its compile is late, never a frame frozen.
//
// Loaded by the renderer's idle warm (lazyWarmSteps), off the boot's static graph - the passes' own modules are the
// hosts' already.
import { parallelCompile, startPrograms } from './glProgram.js';
import { GATE_PASS_PROGRAMS } from './gate/gatePass.js';
import { telegraphPrograms } from './gate/gateTelegraph.js';
import { GATE_FX_PROGRAMS } from './gate/gateFx.js';
import { CRYSTAL_PROGRAMS } from './courtCrystals.js';
import { NODE_GLINT_PROGRAMS } from './nodeGlint.js';
import { AURA_PROGRAMS } from './auraRing.js';

/** The programs started early: a gate's fire (the world's gates, the Elite arches, the court's way in and way home),
 *  the court's and the Spire's telegraphs, his blows' sparks, the crystals, the nodes' glint (NODE-GLINT's, the outline's
 *  before it), and the auras' - one program a look (AURA-SPLIT), the first wearer in range having waited 8.5-11 s on
 *  D3D11 for the one program they had been (AURA-STALL). */
export const playPrograms = () => [...GATE_PASS_PROGRAMS, ...telegraphPrograms(false), ...telegraphPrograms(true), ...GATE_FX_PROGRAMS, ...CRYSTAL_PROGRAMS, ...NODE_GLINT_PROGRAMS, ...AURA_PROGRAMS];

/** Start them on `gl` where its driver compiles beside the frames; answers whether it did. */
export function startPlayPrograms(gl) {
  if (!gl || !parallelCompile(gl)) return false;
  startPrograms(gl, playPrograms());
  return true;
}
