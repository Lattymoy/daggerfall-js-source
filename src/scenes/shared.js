// Helpers shared across scenes: data fetch, texture archive names,
// season parsing, and the time-aware sky controller (R4/R5).

import { DFPalette } from '../formats/dfPalette.js';
import { ImgFile } from '../formats/imgFile.js';
import { SkyFile } from '../formats/skyFile.js';
import { SkyRenderer, buildDaySkyPanorama, buildNightSkyPanorama, nightSkyImageName } from '../render/skyRenderer.js';
import { SEASON } from '../world/climateSwaps.js';
import { skyFrameForTime } from '../world/worldClock.js';

export async function fetchBytes(name) {
  const res = await fetch(`./arena2/${name}`);
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

export function parseSeason(params) {
  const s = (params.get('season') || 'summer').toLowerCase();
  if (s === 'winter') return SEASON.Winter;
  if (s === 'rain') return SEASON.Rain;
  return SEASON.Summer;
}

export function texName(archive) {
  return `TEXTURE.${String(archive).padStart(3, '0')}`;
}

// Time-aware sky controller: swaps the panorama when the (skyIndex, frame or
// night) key changes. Explicit ?skyframe / ?window override the clock
// (R2/R4 demo compatibility); otherwise the world clock decides.
export function createSkyController(gl, params) {
  const sky = new SkyRenderer(gl);
  const panoramas = new Map(); // "index:frame" | "index:night" -> panorama
  const skyFiles = new Map();
  let activeKey = '';
  let pending = null;

  async function buildPanorama(skyIndex, frame) {
    if (frame === null) {
      const name = nightSkyImageName(skyIndex);
      const img = new ImgFile();
      img.load(await fetchBytes(name), name);
      const pal = new DFPalette();
      pal.load(await fetchBytes(img.paletteName), img.paletteName);
      img.palette = pal;
      return buildNightSkyPanorama(img.getColor32(img.getDFBitmap(0, 0), -1));
    }
    if (!skyFiles.has(skyIndex)) {
      const name = SkyFile.indexToFileName(skyIndex);
      const f = new SkyFile();
      f.load(await fetchBytes(name), name);
      skyFiles.set(skyIndex, f);
    }
    return buildDaySkyPanorama(skyFiles.get(skyIndex), frame);
  }

  return {
    renderer: sky,
    /** Ensure the panorama for (skyIndex, minuteOfDay); async, frame-late. */
    use(skyIndex, minuteOfDay) {
      let frame = params.has('window')
        ? (params.get('window') === 'night' ? null : Number(params.get('skyframe') ?? 31))
        : skyFrameForTime(minuteOfDay);
      if (params.has('skyframe')) frame = Number(params.get('skyframe'));
      const key = `${skyIndex}:${frame === null ? 'night' : frame}`;
      if (key === activeKey || key === pending) return;
      pending = key;
      const cached = panoramas.get(key);
      const apply = (pano) => {
        if (pending !== key) return;
        panoramas.set(key, pano);
        sky.setPanorama(pano);
        activeKey = key;
        pending = null;
      };
      if (cached) apply(cached);
      else buildPanorama(skyIndex, frame).then(apply);
    },
    draw(yaw, pitch, fovY, aspect) {
      sky.draw(yaw, pitch, fovY, aspect);
    },
  };
}
