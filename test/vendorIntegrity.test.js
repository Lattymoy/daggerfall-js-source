// MODS AUDIT (2026-09-08): THE VENDORED MODS, BYTE FOR BYTE. Three mods
// ship files that are the authors' own, carried verbatim with their
// permission - Hazelnut's four path arrays, Kamer's five Collada
// exports, and Dynamic Skies' shader, includes, presets, settings and
// manifest. Every earlier pin checked a LENGTH (ledger.test.js: 500,000
// bytes) or a derived count (roads.test.js: 21,554 road pixels) or that
// a bake reproduces itself (windmillmesh.test.js) - none could tell a
// re-exported, re-saved or hand-edited file from the author's. These
// are the sha256 of each file as verified against upstream this audit:
// the roads and the Dynamic Skies files against their public repos
// (github.com/ajrb/dfunity-mods master; drcarademono/dynamic-skies
// 04506e2), the windmill DAEs against the archive Mac supplied. A
// change here is either a deliberate re-vendoring, in which case the
// hash and the README move together, or a corruption.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const sha256 = (rel) => createHash('sha256').update(readFileSync(new URL(`../vendor/${rel}`, import.meta.url))).digest('hex');

const ROADS = {
  'roads-hazelnut/roadData.bytes': '249ee50c54c564b9f89e3cf0cb28f87e0ab1c5603cdd4f794afc4e96a6b6af8a',
  'roads-hazelnut/trackData.bytes': 'dce018b03bee20f846bfca0854ae38cf737b8a684e92bf95cd7468df403385a6',
  'roads-hazelnut/riverData.bytes': '6b867c189be672874334557573d8c40598beb050277dd18f81a2c33b9b9ac8ab',
  'roads-hazelnut/streamData.bytes': '567ebda53a121435f5c26c12c6141d2d596c54af82fe3a08109f25544cef349f',
};
const WINDMILLS = {
  'windmills-kamer/Blade.dae': 'c373edf569f43334f5e17ab9f65409705bca62c597f529022bcbbcb427eebae9',
  'windmills-kamer/Windmill.dae': 'c932193ae0afce9806360272b7b548e24f174e1bdaa3f310430121550155f889',
  'windmills-kamer/41601.dae': 'ca044d7111c7c7f67b195cba1f1021bc4c653623c9f36b45ee8a5e9492eeff76',
  'windmills-kamer/Plank_Gear.dae': '9ed29fbe93ca80e13b14e79d497e042d5eb8db55c19461663fe103ad210c4ed9',
  'windmills-kamer/Roller.dae': '4276f87b29eb603466ba1528fc45fe57c38a2f4eb54ec5b4d376de04e006c430',
};
const DYNAMIC_SKIES = {
  'dynamic-skies/Shaders/BLBProceduralSkybox.shader': '37dc1292f94cca01fedbe93df9e8706436b01e8d942a13e6a57a64a46962f400',
  'dynamic-skies/Shaders/Includes/MoonFunctions.cginc': '62e4635150f39ac1e347b9a356a97e9e18cda386b3129e67315537e9559d5a7f',
  'dynamic-skies/Shaders/Includes/Scattering.cginc': '40a56508fd42ca3d51d4108f78ff3c0b6b95c41e74db8192ad2914aad8d0c7e3',
  'dynamic-skies/dynamic-skies.dfmod.json': 'e910f5b88d460b33e7ce728cfe1a4088ed269361c6db45af0009ad08f980f7a3',
  'dynamic-skies/modsettings.json': '382edcfad659ccc09603b2ab89535cc6d8282f900ca7230d57a8bdadb97653aa',
  'dynamic-skies/LightCurveSettings/LightCurve.json': 'f6f0f50e97da9ead33b8390116ce1dcf23d3f3c75857ad22af2cd52ea718e673',
  'dynamic-skies/SkyboxSettings/SkyboxSunny.json': 'e89db31cfe14d827e2209c7436d66bcf5b5105899fedddd437a129e0c9335d11',
  'dynamic-skies/SkyboxSettings/SkyboxCloudy.json': 'c6cd82964540303edb9a17e2ac133be19558edf99e7b8bab0fc3e2bd7570dd70',
  'dynamic-skies/SkyboxSettings/SkyboxOvercast.json': '66ef3beb0d606e604574b4fd5ab5a9770c12deca61b8ffef3bf91f6277e5a0a7',
  'dynamic-skies/SkyboxSettings/SkyboxFog.json': '97530ccd0687ad859b68f042f0fb227bdd4cd20f7e8f75e1551947ac15e1edbe',
  'dynamic-skies/SkyboxSettings/SkyboxRain.json': '31dc455b48ba1e2d9cc0f0b1921c6bd735ca00b500510b9fe57888f58d9eadd4',
  'dynamic-skies/SkyboxSettings/SkyboxThunder.json': 'ad07e1cb84a4845b5d7797d0491f2e1a6075b4a04b984d13a5f58117c8ee17b3',
  'dynamic-skies/SkyboxSettings/SkyboxSnow.json': '44112e4d8fa489274c7482e522009d30e32332b5c6a29e9c55af6316008b8eac',
  'dynamic-skies/FogSettings/FogSunny.json': '4457a11268fb93857e9313b5bebab6d92fc5f7db241db69a03b698269bf282a5',
  'dynamic-skies/FogSettings/FogOvercast.json': '40a2863e11246885d8248dfef4a64a0311c6e83819e5b117b741d410fae04979',
  'dynamic-skies/FogSettings/FogHeavyFog.json': 'bebb00b053dab122b01a013432edd2eff2352159e740a8970a9ad6a9664be333',
  'dynamic-skies/FogSettings/FogRainy.json': '40a2863e11246885d8248dfef4a64a0311c6e83819e5b117b741d410fae04979',
  'dynamic-skies/FogSettings/FogSnowy.json': '40a2863e11246885d8248dfef4a64a0311c6e83819e5b117b741d410fae04979',
};

const check = (table) => { for (const [rel, want] of Object.entries(table)) assert.equal(sha256(rel), want, `${rel} is not the author's file`); };

test('MODS AUDIT: Basic Roads - the four path arrays are Hazelnut’s, sha256 against ajrb/dfunity-mods master', () => {
  check(ROADS);
  assert.equal(Object.keys(ROADS).length, 4);
});

test('MODS AUDIT: Windmills of Daggerfall - the five Collada exports are Kamer’s, sha256 against the archive', () => {
  check(WINDMILLS);
  assert.equal(Object.keys(WINDMILLS).length, 5);
});

test('MODS AUDIT: Dynamic Skies - shader, includes, presets, settings and manifest are the authors’, sha256 against 04506e2', () => {
  check(DYNAMIC_SKIES);
  assert.equal(Object.keys(DYNAMIC_SKIES).length, 18, 'seven skybox presets, five fog presets, the light curve, the shader and its two includes, the settings and the manifest');
  // Overcast, Rainy and Snowy fog presets are one file three times over
  // in the mod itself - the same bytes under three names.
  assert.equal(DYNAMIC_SKIES['dynamic-skies/FogSettings/FogOvercast.json'], DYNAMIC_SKIES['dynamic-skies/FogSettings/FogRainy.json']);
  assert.equal(DYNAMIC_SKIES['dynamic-skies/FogSettings/FogRainy.json'], DYNAMIC_SKIES['dynamic-skies/FogSettings/FogSnowy.json']);
});
