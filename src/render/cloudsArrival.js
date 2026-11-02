// @ts-check
// CLOUD-COMPILE (2026-10-26; bible/07-Rendering/Performance-Priority.md CLOUD-COMPILE): THE VOLUMETRIC CLOUDS ARRIVE
// WHEN THEIR PROGRAMS ARE DONE. The march program is the boot's longest compile on D3D11 (seconds; a fraction of a
// second on Vulkan), and the sky controller used to wait for it on the page's thread. Nothing the game is played by
// reads the clouds, so the sky draws as it does with the clouds off until the driver says their programs are done.
// If the compile beat the first frame, the clouds are built on that first ask and take the sky over at once. Clouds
// built later keep the dome's decks until their first sweep is marched, so no frame shows a sky with neither.
import { compiledPass, parallelCompile, startPrograms } from './glProgram.js';
import { VolumetricClouds, CLOUD_PROGRAMS } from './volumetricClouds.js';
import { CLOUD_NOISE_PROGRAMS } from './cloudNoise.js';

/** Every program the clouds' constructor builds: the noise's three and the clouds' own four. */
export const CLOUDS_ARRIVAL_PROGRAMS = Object.freeze([...CLOUD_NOISE_PROGRAMS, ...CLOUD_PROGRAMS]);

/** @typedef {object} CloudsArrival
 *  @property {(viewport: number[]) => VolumetricClouds|null} poll  The clouds once their programs are done; null
 *    before, and for good after a failed build. Ask once a frame; it restores `viewport`, the sky's rect.
 *  @property {() => VolumetricClouds|null} shown  The clouds the sky draws and the ground's shadow reads, or null.
 *  @property {(offset: ArrayLike<number>) => void} offsetOrigin  The recenter; kept until the build. */

/** The clouds' door for the sky controller (`quality`: a QUALITY key; `testCellSpec`: `?cloudcell=`; `wholeFirstSweep`: `?cloudsweep=whole`).
 *  @param {WebGL2RenderingContext} gl @param {string} quality @param {string|null} testCellSpec
 *  @param {boolean} [wholeFirstSweep] @returns {CloudsArrival} */
export function createCloudsArrival(gl, quality, testCellSpec, wholeFirstSweep = false) {
  const pendingOffset = [0, 0, 0];
  let offsetPending = false;
  let clouds = /** @type {VolumetricClouds|null} */ (null);
  let buildViewport = /** @type {number[]} */ ([0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight]);
  let shownOnce = false;
  let asks = 0;
  let builtOnFirstAsk = false;

  const build = () => {
    const built = new VolumetricClouds(gl, quality, buildViewport);
    built.testCellSpec = testCellSpec;
    built.wholeFirstSweep = wholeFirstSweep;
    if (offsetPending) built.offsetOrigin(pendingOffset);
    // A probe reads when the clouds arrive on the page's own clock (tools: the boot's first world frame beside it).
    globalThis.performance?.mark?.('clouds-built');
    return built;
  };
  // The clouds are never needed this frame (nothing played reads them), so the door is never forced: get() with no
  // argument waits for the driver however long it takes. Until then each ask polls the seven programs' completion,
  // which waits on nothing (SHADER-STALL measured 0-0.4 ms a poll).
  const door = compiledPass(gl, CLOUDS_ARRIVAL_PROGRAMS, build, (e) =>
    console.warn('[clouds] the volumetric clouds could not be built - the sky stands without them', e),
  );
  // Started at the controller's mount, not at the sky's first draw: the boot started them already (bootPrograms.js), and
  // a sky whose switches the boot read otherwise compiles from here. Where the driver cannot compile beside the page,
  // nothing is started - a link queued ahead would hold the page's next GL read.
  if (parallelCompile(gl)) startPrograms(gl, CLOUDS_ARRIVAL_PROGRAMS);

  return {
    poll(viewport) {
      if (clouds) return clouds;
      asks++;
      buildViewport = viewport;
      clouds = door();
      builtOnFirstAsk = !!clouds && asks === 1;
      return clouds;
    },
    shown() {
      if (!clouds || (!builtOnFirstAsk && clouds.sweeps === 0)) return null;
      if (!shownOnce) {
        shownOnce = true;
        globalThis.performance?.mark?.('clouds-shown');
      }
      return clouds;
    },
    offsetOrigin(offset) {
      if (clouds) {
        clouds.offsetOrigin(offset);
        return;
      }
      pendingOffset[0] += offset[0];
      pendingOffset[2] += offset[2];
      offsetPending = true;
    },
  };
}
