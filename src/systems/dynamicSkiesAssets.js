// DYNAMIC SKIES - THE FILES (DS1). The vendored mod's presets and
// textures reach the game through Vite's glob doors, as the quests and
// the roads do: text baked in, images as URLs emitted with the build.
// import.meta.glob is Vite's compile-time macro: in the browser every
// call below is an object literal by the time it runs; in node it is
// undefined. scenes/shared.js imports this module statically (the sky
// controller is built at every exterior boot), and the node suite
// imports shared.js, so the globs are taken only where a window is -
// node sees empty tables, and the pure port (systems/dynamicSkies.js)
// is fed the same files off the disk by the tests.

const IN_BROWSER = typeof window !== 'undefined';
const PRESETS = IN_BROWSER ? import.meta.glob('../../vendor/dynamic-skies/SkyboxSettings/*.json', { eager: true, query: '?raw', import: 'default' }) : {};
const FOGS = IN_BROWSER ? import.meta.glob('../../vendor/dynamic-skies/FogSettings/*.json', { eager: true, query: '?raw', import: 'default' }) : {};
const CURVES = IN_BROWSER ? import.meta.glob('../../vendor/dynamic-skies/LightCurveSettings/*.json', { eager: true, query: '?raw', import: 'default' }) : {};
const TEXTURES = IN_BROWSER ? import.meta.glob('../../vendor/dynamic-skies/Textures/*.png', { eager: true, query: '?url', import: 'default' }) : {};

const byName = (map) => Object.fromEntries(Object.entries(map).map(([p, v]) => [p.split('/').pop().replace(/\.(json|png)$/, ''), v]));
const presets = byName(PRESETS);
const fogPresets = byName(FOGS);
const curves = byName(CURVES);
const textureUrls = byName(TEXTURES);

/** Every texture file the vendored tree carries, by the name the
 *  presets use (CloudsTextureFile etc.). */
export const DYNAMIC_SKIES_TEXTURES = Object.freeze(Object.keys(textureUrls).sort());

/** The mod's text assets, in the shape DynamicSkies' constructor takes. */
export function dynamicSkiesAssets() {
  return { presets, fogPresets, lightCurve: curves.LightCurve };
}

export function dynamicSkiesTextureUrl(name) {
  return textureUrls[name] ?? null;
}

/** Decode one vendored texture; resolves with the image for
 *  texImage2D. Rejects on a missing or unreadable file, and the caller
 *  warns - a slot keeps the shader's own default meanwhile. */
export function loadDynamicSkiesTexture(name) {
  const url = dynamicSkiesTextureUrl(name);
  return new Promise((resolve, reject) => {
    if (!url) { reject(new Error(`Dynamic Skies: no texture named ${name}`)); return; }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Dynamic Skies: ${name} failed to load from ${url}`));
    img.src = url;
  });
}
