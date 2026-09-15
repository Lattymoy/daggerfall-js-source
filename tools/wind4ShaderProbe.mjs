// WIND4 - THE THREE EDITS, COMPILED AND LINKED IN A REAL BROWSER.
//
// Mac's three (too many wisps, a sky that drifted the wrong way, grass
// that never went dark) are a constant, a sign and two missing uniform
// terms. The constant and the sign are pinned in node
// (test/wind4_windweather.test.js); what node cannot answer is whether
// the GLSL still COMPILES and whether the grass's new uniforms survive
// the link - a uniform the optimiser drops reads as null, and a shader
// that fails to compile is a silent black pass in play.
//
// So: a real WebGL2 context, the wisp and grass programs built by their
// own constructors, both cloud marches compiled as themselves, and the
// drift's sign counted in the field both marches include.
//
//     npx vite --port 5199 &
//     node tools/wind4ShaderProbe.mjs
import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:5199';
const out = []; const check = (n, ok, d='') => { out.push(ok); console.log(`${ok?'ok  ':'FAIL'} ${n}${d?` - ${d}`:''}`); };
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(`${BASE}/play/?skin=enhanced`, { waitUntil: 'networkidle' });
const r = await page.evaluate(async () => {
  const cv = document.createElement('canvas'); cv.width = 320; cv.height = 200; document.body.append(cv);
  const gl = cv.getContext('webgl2');
  const log = [];
  const { LabGrass } = await import('/src/render/labGrass.js').then(m => ({ LabGrass: m.LabGrass ?? m.default ?? Object.values(m).find(v => typeof v === 'function' && /Grass/.test(v.name)) }));
  const { WindWispsRenderer } = await import('/src/render/windWisps.js');
  const wisp = new WindWispsRenderer(gl);
  log.push(['wisps', !!wisp]);
  const grass = new LabGrass(gl);
  log.push(['grass', !!grass]);
  // every program must have linked: ask GL, not the constructor
  const progs = [];
  for (const [name, obj] of [['wisps', wisp], ['grass', grass]]) {
    const p = obj.program ?? obj.prog;
    progs.push([name, !!p && gl.getProgramParameter(p, gl.LINK_STATUS) === true, p ? (gl.getProgramInfoLog(p) || '') : 'no program']);
  }
  // the grass's new uniforms must EXIST in the linked program (a
  // uniform the compiler optimised away would be null)
  const gp = grass.program ?? grass.prog;
  const have = {};
  for (const n of ['uSunScale', 'uMoonScale', 'uMoonCol', 'uMoonDir', 'uSunCol', 'uAmb'])
    have[n] = gl.getUniformLocation(gp, n) !== null;
  // the CLOUD stages, compiled as themselves - the drift's sign lives
  // in CLOUD_FIELD_GLSL, which both marches include
  const vcm = await import('/src/render/volumetricClouds.js');
  const clouds = [];
  for (const name of ['MARCH_FS', 'SHADOW_FS']) {
    const sh = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(sh, vcm[name]); gl.compileShader(sh);
    clouds.push([name, gl.getShaderParameter(sh, gl.COMPILE_STATUS) === true, (gl.getShaderInfoLog(sh) || '').slice(0, 200)]);
    gl.deleteShader(sh);
  }
  // every USE of the drift (the declaration line is not one)
  const body = vcm.CLOUD_FIELD_GLSL.replace(/uniform vec2 uDrift;[^\n]*/g, '');
  const driftSigns = (body.match(/uDrift/g) || []).length;
  const minus = (body.match(/- uDrift/g) || []).length;
  return { progs, have, clouds, driftSigns, minus, err: gl.getError() };
});
for (const [name, linked, info] of r.progs) check(`${name}: the program links`, linked, info.slice(0, 200));
for (const [n, ok] of Object.entries(r.have)) check(`grass: ${n} survives the link`, ok);
for (const [name, ok, info] of r.clouds) check(`clouds: ${name} compiles`, ok, info);
check('clouds: every uDrift in the field is SUBTRACTED', r.driftSigns > 0 && r.minus === r.driftSigns, `${r.minus} of ${r.driftSigns}`);
check('no GL error', r.err === 0, String(r.err));
check('no page errors', errs.length === 0, errs.join(' | '));
await browser.close();
console.log(out.every(Boolean) ? '\nALL OK' : '\nFAILURES');
process.exit(out.every(Boolean) ? 0 : 1);
