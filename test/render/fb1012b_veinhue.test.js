// FIELD BUGS 2026-10-12b VEIN-HUE - "Boulder/lodestone/moonstone still identical": "Moonstone might be a slight shade
// darker but thats about it"; "Just found an ebony vein ... a dark enough shade to where you can at least kinda tell".
// VEIN-WASH (10-11d) gave the ores on a shared picture washes of their own, multiplied into a lump near grey - so a
// wash's colour is its own spread, and they spread a fifth to a half (a grey a shade off grey); Lodestone kept DFU's own
// colours, and a boulder's loose stone IS Lodestone's lump. Every wash is its hue at full spread now, and Lodestone wears
// its own. bible/01-Overview/bugs/Field-Bugs-2026-10-12b.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ORE_WASH, ORE_DYE, mineWash, mineRecord, mineKind, LODESTONE_RECORD } from '../../src/scenes/mineHost.js';
import { METALS, ORES } from '../../src/net/professionLaw.js';
import { Renderer, WORLD_FRAME } from '../../src/render/renderer.js';
import { EL_LANE, EL_BB_FS } from '../../src/render/enhancedLighting.js';
import { classicShadowLane } from '../../src/render/classicShadowLane.js';
import { perspective, lookAt, mirrorProjectionX } from '../../src/world/mat4.js';

const MINED = [...METALS.filter((m) => m.key !== 'metal:brass'), ...ORES].map((m) => m.key);
const node = (what, material) => ({ what, material, slot: 0, local: [0, 0, 0] });
/** The classic lane's lit flat (render/renderer.js `lit *= uBatchTint`) over a lump of this grey, clamped as it shows. */
const GREY = 0.35;
const shown = (w) => (w ?? [1, 1, 1]).map((c) => Math.min(1, GREY * c));
const apart = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

test('VEIN-HUE every node on one picture stands apart from every other on it, the boulder\'s loose stone among them - over a grey lump no two closer than 0.15, where Lodestone and the boulder were one and Moonstone a shade off them (mutants: Lodestone unwashed; a wash pulled back toward grey)', () => {
  const byRecord = new Map();
  const add = (label, n) => { const r = mineRecord(n); if (!byRecord.has(r)) byRecord.set(r, []); byRecord.get(r).push([label, shown(mineWash(n))]); };
  for (const key of MINED) add(key, node('vein', key));
  add('boulder', node('boulder', 'stone:rough'));
  assert.equal(mineRecord(node('boulder', 'stone:rough')), LODESTONE_RECORD, 'the boulder\'s stone is Lodestone\'s lump');
  for (const [record, looks] of byRecord) {
    for (let i = 0; i < looks.length; i++) {
      for (let j = i + 1; j < looks.length; j++) {
        const d = apart(looks[i][1], looks[j][1]);
        assert.ok(d >= 0.15, `record ${record}: ${looks[i][0]} and ${looks[j][0]} ${d.toFixed(3)} apart`);
      }
    }
  }
});

test('VEIN-HUE a washed ore\'s hue is its own: Moonstone\'s blue, Lodestone\'s rust, Ebony\'s near-black - each a full step off grey (mutants: a hue turned; Ebony lightened)', () => {
  const [r, g, b] = ORE_WASH['ore:moonstone'];
  assert.ok(b > g && g > r && b / r >= 1.8, 'Moonstone: blue, its spread at least 1.8');
  const [lr, lg, lb] = ORE_WASH['metal:lodestone'];
  assert.ok(lr > lg && lr > lb && lr / lb >= 2, 'Lodestone: rust red');
  assert.ok(ORE_WASH['ore:ebony'].every((c) => c <= 0.45), 'Ebony: near black');
  for (const [k, w] of Object.entries(ORE_WASH)) assert.ok(apart(shown(w), shown(null)) >= 0.2, `${k}: a full step off the grey lump (${apart(shown(w), shown(null)).toFixed(3)})`);
  assert.equal(mineWash(node('boulder', 'stone:rough')), null, 'the boulder\'s stone stays as it is');
});

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
/** The code of a shader's main(), its comments gone (arena5_banners.test.js's). */
const mainOf = (src) => src.slice(src.indexOf('void main() {')).replace(/\/\/[^\n]*/g, '');
function recordingGl() {
  const calls = [];
  let ids = 0;
  const consts = { TEXTURE0: 33984, TEXTURE_2D: 3553, TEXTURE_2D_ARRAY: 35866 };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return (...args) => { calls.push([k, ...args.map((a) => (ArrayBuffer.isView(a) ? Array.from(a) : a))]); };
    },
  });
  return { gl, calls, canvas: { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 } };
}

test('VEIN-HUE a washed vein\'s wash is its colour, not a multiply: the flats carry ORE_DYE, the gathering host sets it on the batch beside the wash (the open ground\'s and the dungeon\'s), and both lanes take the lit flat\'s brightness in the wash\'s hue - Lodestone\'s lump is no grey, and a brown lump times a blue wash stayed brown (mutants: the dye unset; the dye unsent; the multiply kept)', () => {
  assert.equal(ORE_DYE, 1);
  const kind = mineKind({ book: { taken: () => false } });
  assert.equal(kind.flatsOf({ ...node('vein', 'ore:moonstone'), local: [1, 2, 3] })[0].dye, ORE_DYE, 'a washed vein\'s flats are dyed');
  assert.equal(kind.flatsOf({ ...node('vein', 'metal:iron'), local: [1, 2, 3] })[0].dye, 0, 'a picture of its own is as DFU drew it');
  assert.equal(kind.flatsOf({ ...node('boulder', 'stone:rough'), local: [1, 2, 3] })[0].dye, 0, 'the boulder\'s stone too');
  const host = read('src/scenes/gatherHost.js');
  assert.match(host, /if \(tint && dye\) batch\.dye = dye;/);
  assert.match(host, /if \(b && f\.tint && f\.dye\) b\.dye = f\.dye;/);
  assert.match(host, /const gk = `\$\{f\.record\}:\$\{f\.scale\}:\$\{f\.tint \?\? ''\}:\$\{f\.dye \?\? 0\}\$\{lone \? `#\$\{n\.key\}` : ''\}`;/);   // PIN MOVED (VEIN-CRACKS, GATHER-FEEL II, 2026-10-13): a worked node's flats stand apart - the dye still in the key
  const classic = mainOf(read('src/render/renderer.js').split('const BB_FS = `')[1].split('`;')[0]);
  const el = mainOf(EL_BB_FS), cs = mainOf(classicShadowLane().bbFs);
  for (const [name, m, luma, wash] of [['BB_FS', classic, 'vec3(0.299, 0.587, 0.114)', 'uBatchTint'], ['EL_BB_FS', el, 'vec3(0.2126, 0.7152, 0.0722)', 'elDecode(uBatchTint)'], ['classic shadows', cs, 'vec3(0.2126, 0.7152, 0.0722)', 'elDecode(uBatchTint)']]) {
    const before = m.indexOf(`float undyed = dot(lit, ${luma});`), mul = m.indexOf(`lit *= ${wash};`), dyed = m.indexOf(`if (uBatchDye > 0.0) lit = mix(lit, undyed * ${wash}, uBatchDye);`);
    assert.ok(before > 0 && before < mul && mul < dyed, `${name}: the brightness taken before the wash, the dye after it`);
  }
  assert.match(read('src/render/renderer.js'), /uniform float uBatchDye;/);
  assert.match(EL_BB_FS, /uniform float uBatchDye;/);
});

test('VEIN-HUE the dye rides with the wash on the billboard pass: a dyed batch sends its dye, an undyed washed one 0, the frame starts undyed - on both lanes (mutants: the dye unsent; the dye left on for the next batch)', () => {
  const R = new Float32Array([1, 0, 0]), UP = new Float32Array([0, 1, 0]);
  const PROJ = mirrorProjectionX(perspective(Math.PI / 3, 1.6, 0.1, 400)), VIEW = lookAt([0, 1.7, 9], [0, 1.2, -4], [0, 1, 0]);
  for (const lane of [null, EL_LANE]) {
    const { calls, canvas } = recordingGl();
    const r = new Renderer(canvas);
    if (lane) r.setLightingLane(lane);
    r.textures.set('254_66', { id: 't0' }); r.textures.set('254_65', { id: 't1' });
    const moon = r.createBillboardBatch(254, 66, { w: 1, h: 1 }, [[0, 0, -3]]);
    const banner = r.createBillboardBatch(254, 65, { w: 1, h: 1 }, [[1, 0, -4]]);
    moon.tint = ORE_WASH['ore:moonstone']; moon.dye = ORE_DYE;
    banner.tint = [1.4, 0.4, 0.4];   // a washed batch with no dye (ARENA5's): a multiply, as ever
    r.beginFrame(PROJ, VIEW, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
    calls.length = 0;
    r.drawBillboards([moon, banner], R, UP);
    const dyes = calls.filter((c) => c[0] === 'uniform1f' && c[1] === 'uBatchDye').map((c) => c[2]);
    assert.equal(dyes[0], 0, `${lane ? 'EL' : 'classic'}: the frame starts undyed`);
    const seq = calls.filter((c) => (c[0] === 'uniform1f' && c[1] === 'uBatchDye') || c[0] === 'drawElements').map((c) => (c[0] === 'drawElements' ? 'draw' : c[2]));
    const under = [];   // the dye in force at each draw
    let cur;
    for (const x of seq) if (x === 'draw') under.push(cur); else cur = x;
    assert.deepEqual(under.sort(), [0, ORE_DYE], 'the vein drawn dyed, the banner undyed');
  }
});
