// @ts-check
// WINDFALL1 (2026-10-08, Mac: "These should be on by default and integrate into our enhanced environments
// seamlessly") - WINDFALL's THREE PARTICLE SYSTEMS: the gust's leaves, the ambient falling leaves and the winter
// boughs' snow (WindEnvironmentEffects.CreateLeaves / CreateSnow / CreateParticleSystem), run on the CPU and drawn as
// one instanced quad each. The flows they run (where the emitter stands, its rate, the wind they ride) are
// systems/windfallEffects.js's, set every outdoor frame.
//
// THE SYSTEMS, AS THE MOD BUILDS THEM: world-space simulation; a box emitter 30 x 10 x 20 about the system's place
// (Unity's Box shape: anywhere in its volume); no start speed; a start lifetime, size and rotation each a random pick
// between two constants (the leaves 4-8 s, 0.16-0.34 m; the ambient leaves 5-10 s, 0.14-0.30 m; the snow 3-7 s,
// 0.05-0.14 m; a spin of -4..4 radians a second, -2..2 the snow); the leaves a random tile of their 8 x 8 sheet held for
// the life (startFrame 0..0.999, frameOverTime 0); velocity over lifetime the flow's (the wind x its horizontal speed,
// and its fall), the same for every live particle and changed live; the noise module at frequency 0.35, scrolling
// 0.25, its strength the flow's. Billboards, cut out at the mod's 0.5 (Windfall/Particles: alpha-tested, Lambert-lit,
// both faces), point-filtered as the mod's textures are imported (64 x 64 sheets of 8-pixel leaves, a 16-pixel flake).
//
// DEPARTURES (Port-Ledger A, WINDFALL1): UNITY'S NOISE MODULE is the engine's own noise; here three smooth channels of
// sines at the module's frequency and scroll, added to the velocity at its strength - turbulence of the same scale and
// pace, not the same field. THE LIGHT is the flats' (render/renderer.js flatLightAt at the player - the light the
// trees they fall from take), not the mod's Lambert off the sun; unfogged, as the wisps are (the systems hug the eye
// inside any fog's near field). The snow is the mod's own flake (its fallback material): the stock snow material it
// prefers is DFU's particle prefab's, which the port's precipitation does not have.

import { buildProgram } from './glProgram.js';
import { WINDFALL_PARTICLE_SYSTEMS, WINDFALL_EMITTER } from '../systems/windfallEffects.js';

const VS = `#version 300 es
layout(location=0) in vec2 aCorner;   // 0..1
layout(location=1) in vec4 aPlace;    // x, y, z, size
layout(location=2) in vec2 aTurn;     // rotation, the sheet's tile (-1 none)
uniform mat4 uProj;
uniform mat4 uView;
uniform vec3 uRight;
uniform vec3 uUp;
out vec2 vUV;
void main() {
  vec2 c = aCorner - 0.5;
  float s = sin(aTurn.x), k = cos(aTurn.x);
  vec2 r = vec2(c.x * k - c.y * s, c.x * s + c.y * k) * aPlace.w;
  vec3 world = aPlace.xyz + uRight * r.x + uUp * r.y;
  if (aTurn.y < 0.0) vUV = vec2(aCorner.x, 1.0 - aCorner.y);
  else {
    float col = mod(aTurn.y, 8.0), row = floor(aTurn.y / 8.0);
    vUV = vec2((col + aCorner.x) / 8.0, (row + 1.0 - aCorner.y) / 8.0);   // the sheet's tile from the top (Unity's frame 0 is the top left)
  }
  gl_Position = uProj * uView * vec4(world, 1.0);
}`;
const FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
uniform vec3 uLight;
out vec4 outColor;
void main() {
  vec4 t = texture(uTex, vUV);
  if (t.a < 0.5) discard;   // _Cutoff 0.5 x _TintColor.a 1
  outColor = vec4(t.rgb * uLight, 1.0);
}`;

/** Floats an instance carries: x, y, z, size, rotation, tile. */
const INSTANCE_FLOATS = 6;
const TAU = Math.PI * 2;
const [BOX_X, BOX_Y, BOX_Z] = WINDFALL_EMITTER.box;   // AUDIT ENVIRONS W7: the emitter's box, read once (not a destructure a particle)

/** One system's live particles, in flat arrays (EVERY ALLOCATION HAS AN OWNER: made once at its cap). */
class ParticleSystemSim {
  /** @param {{ maxParticles: number, lifetime: number[], size: number[], spin: number[], sheet: number[]|null }} shape @param {() => number} random */
  constructor(shape, random) {
    this.shape = shape; this.random = random;
    const n = shape.maxParticles;
    this.pos = new Float32Array(n * 3); this.age = new Float32Array(n); this.life = new Float32Array(n);
    this.size = new Float32Array(n); this.rot = new Float32Array(n); this.spin = new Float32Array(n); this.tile = new Float32Array(n);
    this.count = 0; this.owed = 0;
  }
  clear() { this.count = 0; this.owed = 0; }
  /** Emit one at an emitter (a box about `at`, the flow's place). */
  emitOne(at) {
    if (this.count >= this.shape.maxParticles) return;
    const i = this.count++, R = this.random, s = this.shape;
    this.pos[i * 3] = at[0] + (R() - 0.5) * BOX_X;
    this.pos[i * 3 + 1] = at[1] + (R() - 0.5) * BOX_Y;
    this.pos[i * 3 + 2] = at[2] + (R() - 0.5) * BOX_Z;
    this.age[i] = 0;
    this.life[i] = s.lifetime[0] + (s.lifetime[1] - s.lifetime[0]) * R();
    this.size[i] = s.size[0] + (s.size[1] - s.size[0]) * R();
    this.rot[i] = R() * TAU;
    this.spin[i] = s.spin[0] + (s.spin[1] - s.spin[0]) * R();
    this.tile[i] = s.sheet ? Math.floor(R() * 0.999 * s.sheet[0] * s.sheet[1]) : -1;
  }
  /** A frame: the clear or the burst owed, the rate's emission, every particle aged and moved by the flow's velocity
   *  and the noise. `t` the systems' clock (the noise's scroll). */
  step(flow, dt, t) {
    if (flow.clear) { this.clear(); flow.clear = false; }
    if (flow.emit > 0) {   // AUDIT ENVIRONS W5: a burst (Emit), where it was asked for
      const at = flow.emitAt ?? flow.position;
      for (; flow.emit > 0; flow.emit--) this.emitOne(at);
      flow.emitAt = null;
    }
    this.owed += flow.rate * dt;
    while (this.owed >= 1) { this.emitOne(flow.position); this.owed -= 1; }
    if (flow.rate <= 0) this.owed = 0;
    const [vx, vy, vz] = flow.velocity, ns = flow.noiseStrength, f = WINDFALL_EMITTER.noiseFrequency, sc = t * WINDFALL_EMITTER.noiseScroll;
    let w = 0;
    for (let i = 0; i < this.count; i++) {
      const age = this.age[i] + dt;
      if (age >= this.life[i]) continue;   // gone: the survivors close up behind it
      const x = this.pos[i * 3], y = this.pos[i * 3 + 1], z = this.pos[i * 3 + 2];
      const px = x * f, py = y * f, pz = z * f;
      const nx = Math.sin(py * 1.7 + pz * 2.3 + sc * TAU) * 0.6 + Math.sin(px * 0.9 - pz * 1.3 + sc * 3.1) * 0.4;
      const ny = Math.sin(pz * 1.9 + px * 1.1 + sc * 4.3) * 0.6 + Math.sin(py * 1.4 - px * 0.7 + sc * 2.2) * 0.4;
      const nz = Math.sin(px * 2.1 + py * 1.5 + sc * 3.7) * 0.6 + Math.sin(pz * 0.8 - py * 1.6 + sc * 2.9) * 0.4;
      this.pos[w * 3] = x + (vx + nx * ns) * dt;
      this.pos[w * 3 + 1] = y + (vy + ny * ns) * dt;
      this.pos[w * 3 + 2] = z + (vz + nz * ns) * dt;
      this.age[w] = age; this.life[w] = this.life[i]; this.size[w] = this.size[i];
      this.rot[w] = this.rot[i] + this.spin[i] * dt; this.spin[w] = this.spin[i]; this.tile[w] = this.tile[i];
      w++;
    }
    this.count = w;
  }
  /** Shift every particle with the floating origin. */
  offset(o) { for (let i = 0; i < this.count; i++) { this.pos[i * 3] += o[0]; this.pos[i * 3 + 1] += o[1]; this.pos[i * 3 + 2] += o[2]; } }
  /** Write the live particles as instances at `at` in `out`; answers how many. */
  write(out, at) {
    for (let i = 0; i < this.count; i++) {
      const o = (at + i) * INSTANCE_FLOATS;
      out[o] = this.pos[i * 3]; out[o + 1] = this.pos[i * 3 + 1]; out[o + 2] = this.pos[i * 3 + 2];
      out[o + 3] = this.size[i]; out[o + 4] = this.rot[i]; out[o + 5] = this.tile[i];
    }
    return this.count;
  }
}

/**
 * The three systems and their draw. `images` { springSummer, fall, snow } - decoded top-down RGBA ({ width, height,
 * data }), any of them null until it loads (a system with no picture runs and draws nothing).
 */
export class WindfallParticles {
  /** @param {WebGL2RenderingContext|null} gl @param {{ random?: () => number }} [opts] */
  constructor(gl, { random = Math.random } = {}) {
    this.gl = gl;
    this.systems = {
      leaves: new ParticleSystemSim(WINDFALL_PARTICLE_SYSTEMS.leaves, random),
      ambientLeaves: new ParticleSystemSim(WINDFALL_PARTICLE_SYSTEMS.ambientLeaves, random),
      snow: new ParticleSystemSim(WINDFALL_PARTICLE_SYSTEMS.snow, random),
    };
    this.clock = 0;
    const cap = WINDFALL_PARTICLE_SYSTEMS.leaves.maxParticles + WINDFALL_PARTICLE_SYSTEMS.ambientLeaves.maxParticles + WINDFALL_PARTICLE_SYSTEMS.snow.maxParticles;
    this.instances = new Float32Array(cap * INSTANCE_FLOATS);
    /** @type {Record<string, WebGLTexture|null>} */
    this.tex = { springSummer: null, fall: null, snow: null };
    if (!gl) return;
    this.prog = buildProgram(gl, VS, FS, 'windfall particles');
    const u = (n) => gl.getUniformLocation(this.prog, n);
    this.loc = { proj: u('uProj'), view: u('uView'), right: u('uRight'), up: u('uUp'), tex: u('uTex'), light: u('uLight') };
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    this.buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, this.instances.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, INSTANCE_FLOATS * 4, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, INSTANCE_FLOATS * 4, 16);
    gl.vertexAttribDivisor(2, 1);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  /** A picture, uploaded as the mod imports it: point-filtered, clamped, one level. */
  setImage(key, img) {
    const gl = this.gl;
    if (!gl || !img) return;
    if (this.tex[key]) gl.deleteTexture(this.tex[key]);
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, img.width, img.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, img.data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.tex[key] = t;
  }

  /** The frame's simulation, off the effects' flows (windfallEffects.js `flows`). */
  step(flows, dt) {
    const d = Math.min(0.1, Math.max(0, dt));   // a hitch is not a tenth of a second of leaves at once
    this.clock += d;
    this.systems.leaves.step(flows.leaves, d, this.clock);
    this.systems.ambientLeaves.step(flows.ambientLeaves, d, this.clock);
    this.systems.snow.step(flows.snow, d, this.clock);
  }

  /** Every system, cleared (a new world, the mod switched off). */
  clear() { for (const s of Object.values(this.systems)) s.clear(); }

  /** The floating origin moved the scene by `offset`: the particles stand where they were on the land. */
  offsetOrigin(offset) { for (const s of Object.values(this.systems)) s.offset(offset); }

  /** How many stand now. */
  get live() { return this.systems.leaves.count + this.systems.ambientLeaves.count + this.systems.snow.count; }

  /**
   * Draw: the two leaf systems in `sheet`'s picture ('springSummer' | 'fall'), then the snow. Depth-tested and written
   * (a cutout), both faces. Answers whether it drew (the host marks the foreign pass).
   * @param {'springSummer'|'fall'} sheet @param {Float32Array|number[]} proj @param {Float32Array|number[]} view
   * @param {ArrayLike<number>} right @param {ArrayLike<number>} up @param {ArrayLike<number>} light
   */
  draw(sheet, proj, view, right, up, light) {
    const gl = this.gl;
    const leafTex = this.tex[sheet], snowTex = this.tex.snow;
    const nLeaves = leafTex ? this.systems.leaves.write(this.instances, 0) : 0;
    const nAmbient = leafTex ? this.systems.ambientLeaves.write(this.instances, nLeaves) : 0;
    const leafCount = nLeaves + nAmbient;
    const snowCount = snowTex ? this.systems.snow.write(this.instances, leafCount) : 0;
    if (!gl || leafCount + snowCount === 0) return false;
    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(this.loc.proj, false, proj);
    gl.uniformMatrix4fv(this.loc.view, false, view);
    gl.uniform3f(this.loc.right, right[0], right[1], right[2]);
    gl.uniform3f(this.loc.up, up[0], up[1], up[2]);
    gl.uniform3f(this.loc.light, light[0], light[1], light[2]);
    gl.uniform1i(this.loc.tex, 0);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.instances, 0, (leafCount + snowCount) * INSTANCE_FLOATS);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.activeTexture(gl.TEXTURE0);
    if (leafCount) {
      gl.bindTexture(gl.TEXTURE_2D, leafTex);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, leafCount);
    }
    if (snowCount) {
      // the snow's instances start where the leaves' end: the attributes' offset moved to them
      gl.vertexAttribPointer(1, 4, gl.FLOAT, false, INSTANCE_FLOATS * 4, leafCount * INSTANCE_FLOATS * 4);
      gl.vertexAttribPointer(2, 2, gl.FLOAT, false, INSTANCE_FLOATS * 4, leafCount * INSTANCE_FLOATS * 4 + 16);
      gl.bindTexture(gl.TEXTURE_2D, snowTex);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, snowCount);
      gl.vertexAttribPointer(1, 4, gl.FLOAT, false, INSTANCE_FLOATS * 4, 0);
      gl.vertexAttribPointer(2, 2, gl.FLOAT, false, INSTANCE_FLOATS * 4, 16);
    }
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.enable(gl.CULL_FACE);
    return true;
  }

  /** EVERY ALLOCATION HAS AN OWNER: the program, the buffers, the vertex array, the pictures. */
  dispose() {
    const gl = this.gl;
    if (!gl) return;
    for (const t of Object.values(this.tex)) if (t) gl.deleteTexture(t);
    gl.deleteBuffer(this.quad); gl.deleteBuffer(this.buf);
    gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.prog);
    this.tex = { springSummer: null, fall: null, snow: null };
  }
}

// ---- the pictures ----------------------------------------------------------------------------------------------------
/** The mod's three pictures by key, as their files are named (WindMod's asset names; vendor/windfall/Textures/ - served
 *  by scenes/windfallHost.js, which carries the bundler's glob this checked module cannot). */
export const WINDFALL_PICTURES = Object.freeze({ springSummer: 'spring_summer_leaves', fall: 'fall_leaves', snow: 'snowflake' });
