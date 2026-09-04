// THE SKY LAB (ES1). The enhanced sky pass alone, on a canvas, with
// the hour, the weather, the day (for the moons' phases), the view and
// the fog on sliders - the tuning surface and the eyeball tool, no game
// data needed. `?hour=&weather=&day=&yaw=&pitch=&fog=` pins any of them
// for the probe, and `?still` freezes the clouds' drift.
import { EnhancedSkyRenderer, skyState, retroFor } from '../render/enhancedSky.js';
import { MINUTES_PER_DAY, lunarPhasesFromMinutes } from '../systems/gameDate.js';
import { DynamicSkiesRenderer } from '../render/dynamicSkiesRenderer.js';   // DS1: the mod's pass in the lab too - ?sky=dynamic
import { DynamicSkies } from '../systems/dynamicSkiesRuntime.js';
import { dynamicSkiesAssets, loadDynamicSkiesTexture, DYNAMIC_SKIES_TEXTURES } from '../systems/dynamicSkiesAssets.js';
import { weatherSunlightScale } from '../world/weather.js';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('c');
const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });   // the probe reads pixels after the frame
if (!gl) throw new Error('webgl2 unavailable');
// DS1: `?sky=dynamic` puts Dynamic Skies on the lab's canvas - the same
// pass, presets and textures the game draws, with the lab's clock and
// weather, so the mod can be looked at and screenshotted with no data.
const dynamicOn = params.get('sky') === 'dynamic';
const sky = dynamicOn ? new DynamicSkiesRenderer(gl) : new EnhancedSkyRenderer(gl);
const dyn = dynamicOn ? new DynamicSkies(dynamicSkiesAssets(), { densitySetting: Number(params.get('density')) || 1 }) : null;
let texturesPending = 0;
if (dynamicOn) {
  for (const name of DYNAMIC_SKIES_TEXTURES) {
    if (name === 'PixelSnow') continue;
    texturesPending++;
    loadDynamicSkiesTexture(name).then((img) => sky.setTexture(name, img)).catch((e) => console.warn(e?.message ?? e)).finally(() => { texturesPending--; });
  }
}
if (!dynamicOn) sky.retro = retroFor(location.search);   // ES1e: the lab shows what the game shows
const $ = (id) => document.getElementById(id);
const controls = ['hour', 'weather', 'day', 'yaw', 'pitch', 'fog'];
for (const id of controls) if (params.has(id)) $(id).value = params.get(id);
const still = params.has('still');
if (params.has('nopanel')) document.getElementById('panel').style.display = 'none';   // the probe measures the frame, not the sliders
const t0 = performance.now();

function frame() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.floor(canvas.clientWidth * dpr), h = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  gl.viewport(0, 0, w, h);
  const hour = Number($('hour').value), day = Number($('day').value);
  const minuteOfDay = Math.round((hour % 24) * 60);
  // The DAY slider is a moon control: it reads the two phases off the
  // game's own ladder for that day of year 405 and hands them over. The
  // lab holds no minute clock of its own - it has no world to read one
  // from, and AUDIT 21 F2's rule is that exactly one module accumulates
  // minutes - so the phases go in directly, which is what the slider
  // means anyway.
  const phases = lunarPhasesFromMinutes(((405 * 360 + day) * MINUTES_PER_DAY) + minuteOfDay);
  const seconds = still ? 0 : (performance.now() - t0) / 1000;
  if (dyn) {
    // DS1: the mod's frame on the lab's clock - year 405, the slider's
    // day, the slider's hour; the sim's word is the weather select
    const labMinutes = ((405 * 360 + day) * MINUTES_PER_DAY) + minuteOfDay;
    sky.setState(dyn.tick({ minuteOfDay, classicMinutes: labMinutes, weather: $('weather').value, seconds, dt: still ? 0 : 1 / 60, weatherScale: weatherSunlightScale($('weather').value, false) }));
  } else {
    sky.setState(skyState({ minuteOfDay, weather: $('weather').value, phases, seconds }));
  }
  sky.fogMix = Number($('fog').value);
  sky.fogColor = sky.clearColor;
  gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.CULL_FACE); gl.enable(gl.DEPTH_TEST);
  sky.draw(Number($('yaw').value) * Math.PI / 180, Number($('pitch').value) * Math.PI / 180, 65 * Math.PI / 180, w / h);
  for (const id of ['hour', 'day', 'yaw', 'pitch', 'fog']) $(id + 'V').textContent = $(id).value;
  window.__skyReady = texturesPending === 0;   // DS1: the mod's frame is ready once its textures are
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
