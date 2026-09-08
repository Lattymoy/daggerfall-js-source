// THE SKY LAB (ES1). The enhanced sky pass alone, on a canvas, with
// the hour, the weather, the day (for the moons' phases), the view and
// the fog on sliders - the tuning surface and the eyeball tool, no game
// data needed. `?hour=&weather=&day=&yaw=&pitch=&fog=` pins any of them
// for the probe, and `?still` freezes the clouds' drift.
import { EnhancedSkyRenderer, skyState, retroFor, WEATHER_SKY, WIND_SECONDS_PER_MINUTE } from '../render/enhancedSky.js';
import { cloudsStateUnderMod, dynamicMoonState } from '../render/dynamicSkiesBridge.js';   // DS2: the clouds' state under the mod, as the game builds it
import { MINUTES_PER_DAY, lunarPhaseFractionsFromMinutes } from '../systems/gameDate.js';   // CLK3: the clock's own fraction, as the dome takes it
import { DynamicSkiesRenderer } from '../render/dynamicSkiesRenderer.js';   // DS1: the mod's pass in the lab too - ?sky=dynamic
import { DynamicSkies } from '../systems/dynamicSkiesRuntime.js';
import { dynamicSkiesAssets, loadDynamicSkiesTexture, DYNAMIC_SKIES_TEXTURES } from '../systems/dynamicSkiesAssets.js';
import { weatherSunlightScale } from '../world/weather.js';
import { CloudNoise } from '../render/cloudNoise.js';   // VC2: the noise volumes' slice viewer - ?noise=shape|detail&z=&ch=&tiles=
import { VolumetricClouds, QUALITY as CLOUD_QUALITY } from '../render/volumetricClouds.js';   // VC3: the clouds over the dome - ?clouds=off|lo|hi

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
// VC3: the volumetric clouds over the dome, as the game draws them; built on the first frame
const cloudsDoor = params.get('clouds');
let clouds = null;
if (cloudsDoor !== 'off') sky.cloudsExternal = true;   // DS2: the mod's sheets stand down under the clouds too
const $ = (id) => document.getElementById(id);
const controls = ['hour', 'weather', 'day', 'yaw', 'pitch', 'fog'];
for (const id of controls) if (params.has(id)) $(id).value = params.get(id);
const still = params.has('still');
// VC5: the panel's clouds row is the URL doors made visible - the tier
// select and the shadow-map box rewrite the query and reload, so the
// sky is rebuilt whole (a tier is a set of targets, not a live knob).
$('clouds').value = cloudsDoor === 'off' || Object.hasOwn(CLOUD_QUALITY, cloudsDoor) ? cloudsDoor : 'default';
$('shadowmap').checked = params.has('shadowmap');
const reloadWith = (mutate) => { const p = new URLSearchParams(location.search); mutate(p); location.search = p.toString(); };
$('clouds').addEventListener('change', () => reloadWith((p) => { if ($('clouds').value === 'default') p.delete('clouds'); else p.set('clouds', $('clouds').value); }));
$('shadowmap').addEventListener('change', () => reloadWith((p) => { if ($('shadowmap').checked) p.set('shadowmap', ''); else p.delete('shadowmap'); }));
// VC2: `?noise=shape|detail` shows a z-slice of a cloud noise volume in
// place of the sky - `z=` the slice (0..1), `ch=` r|g|b|a|rgb, `tiles=`
// how many times the volume tiles across the frame (a seam would show).
// The volumes are generated on the first frame, once the canvas is sized.
const noiseView = params.get('noise');
let cloudNoise = null;
if (params.has('nopanel')) document.getElementById('panel').style.display = 'none';   // the probe measures the frame, not the sliders
const t0 = performance.now();
// CLK1: the lab keeps a GAME-MINUTE clock of its own (the world's rate at
// the default TimeScale: a game minute per five real seconds) and its own
// drift integral on the weather row's fixed vector - the shape the
// controller has, without a wind model. `?still` stops both.
let labLast = t0;
const labDrift = [0, 0];

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
  const phases = lunarPhaseFractionsFromMinutes(((405 * 360 + day) * MINUTES_PER_DAY) + minuteOfDay);
  const seconds = still ? 0 : (performance.now() - t0) / 1000;
  const nowReal = performance.now();
  const dtMin = still ? 0 : Math.min(1, (nowReal - labLast) / 1000) / WIND_SECONDS_PER_MINUTE;
  labLast = nowReal;
  const rowWind = (WEATHER_SKY[$('weather').value] ?? WEATHER_SKY.sunny).wind;
  labDrift[0] += rowWind[0] * dtMin * WIND_SECONDS_PER_MINUTE;
  labDrift[1] += rowWind[1] * dtMin * WIND_SECONDS_PER_MINUTE;
  if (noiseView) {
    cloudNoise ??= new CloudNoise(gl, [0, 0, w, h]);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const ch = { r: 0, g: 1, b: 2, a: 3, rgb: 4 }[params.get('ch') ?? 'r'] ?? 0;
    cloudNoise.drawSlice(noiseView, Number(params.get('z') ?? 0.25), ch, Number(params.get('tiles') ?? 1));
    window.__skyReady = true;
    requestAnimationFrame(frame);
    return;
  }
  if (dyn) {
    // DS1: the mod's frame on the lab's clock - year 405, the slider's
    // day, the slider's hour; the sim's word is the weather select
    const labMinutes = ((405 * 360 + day) * MINUTES_PER_DAY) + minuteOfDay;
    sky.setState(dyn.tick({ minuteOfDay, classicMinutes: labMinutes, weather: $('weather').value, seconds, dt: still ? 0 : 1 / 60, weatherScale: weatherSunlightScale($('weather').value, false) }));
  } else {
    sky.setState(skyState({ minuteOfDay, weather: $('weather').value, phases, seconds, drift: labDrift }));
  }
  sky.fogMix = Number($('fog').value);
  sky.fogColor = sky.clearColor;
  gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.CULL_FACE); gl.enable(gl.DEPTH_TEST);
  const yaw = Number($('yaw').value) * Math.PI / 180, pitch = Number($('pitch').value) * Math.PI / 180;
  sky.draw(yaw, pitch, 65 * Math.PI / 180, w / h);
  if (cloudsDoor !== 'off') {
    clouds ??= new VolumetricClouds(gl, Object.hasOwn(CLOUD_QUALITY, cloudsDoor) ? cloudsDoor : 'default', [0, 0, w, h]);
    // DS2: under the mod the clouds take the synthesised state the game
    // gives them - the mod's sun, moons and horizon, the port's colours
    const row = WEATHER_SKY[$('weather').value] ?? WEATHER_SKY.sunny;
    const cst = dynamicOn
      ? cloudsStateUnderMod(sky.state, dynamicMoonState(dyn, minuteOfDay, row.cover), { minuteOfDay, weather: $('weather').value, phases, seconds, drift: labDrift })
      : sky.state;
    clouds.setState(cst, { cover: cst.cloudCover, soft: cst.cloudSoft }, $('weather').value, dtMin, labDrift, 0);   // CLK1: game minutes, the lab's own integral
    clouds.update([0, 0, w, h]);
    if (params.has('shadowmap')) clouds.drawShadowView();   // VC4: the ground's map as a picture
    else clouds.draw(yaw, pitch, 65 * Math.PI / 180, w / h);
  }
  for (const id of ['hour', 'day', 'yaw', 'pitch', 'fog']) $(id + 'V').textContent = $(id).value;
  window.__skyReady = texturesPending === 0 && (!clouds || clouds.sweeps > 0);   // DS1: the mod's frame is ready once its textures are; VC3: and the clouds' map once marched
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
