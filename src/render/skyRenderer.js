// Sky backdrop renderer. The data logic follows DaggerfallSky.cs (MIT,
// Daggerfall Workshop): record 0 is the east half, record 1 the west half;
// frames 0-31 sweep sunrise to noon; afternoon frames 32-63 reuse frame
// 63 - n MIRRORED; the fill color above the strip is west pixel 0; at night
// the NITE0?I0.IMG matching the sky group replaces both halves (0-7 -> 3,
// 8-15 -> 1, 16-23 -> 2, else 0).
// The presentation is ours (Port-Doctrine): DFU scrolls two screen-space
// quads by camera angles; we render one fullscreen pass that maps the view
// ray to a cylinder - each 512-wide half spans 180 degrees of azimuth
// (anglePerPixel = PI/512, so the 220-row strip covers ~77.3 degrees of
// elevation above the horizon), the same angular size DFU's layout implies.
// Azimuth 0 (+X, map east) starts the east half. Documented equivalence.

export const SKY_ANGLE_PER_PIXEL = Math.PI / 512;

/** NITE??I0.IMG index for a sky archive, verbatim LoadVanillaNightSky. */
export function nightSkyIndexForSky(skyIndex) {
  if (skyIndex >= 0 && skyIndex <= 7) return 3;
  if (skyIndex >= 8 && skyIndex <= 15) return 1;
  if (skyIndex >= 16 && skyIndex <= 23) return 2;
  return 0;
}

export function nightSkyImageName(skyIndex) {
  return `NITE${String(nightSkyIndexForSky(skyIndex)).padStart(2, '0')}I0.IMG`;
}

/**
 * Build the 1024-wide combined panorama for a day frame 0-63.
 * Morning (n < 32): [east | west] of frame n.
 * Afternoon (n >= 32): [mirror(west) | mirror(east)] of frame 63 - n, so the
 * sun side migrates east to west across the day, exactly as DFU's flip.
 * Also returns the fill color above the strip (west pixel 0, verbatim).
 * @param {SkyFile} skyFile
 * @param {number} frame 0-63
 */
export function buildDaySkyPanorama(skyFile, frame) {
  const target = frame < 32 ? frame : 63 - frame;
  const mirror = frame >= 32;
  const east = skyFile.getColor32(0, target);
  const west = skyFile.getColor32(1, target);
  const w = east.width;
  const h = east.height;
  const out = new Uint8ClampedArray(w * 2 * h * 4);
  const halves = mirror ? [west, east] : [east, west];
  for (let half = 0; half < 2; half++) {
    const src = halves[half].colors;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const sx = mirror ? w - 1 - x : x;
        const s = (y * w + sx) * 4;
        const d = (y * w * 2 + half * w + x) * 4;
        out[d] = src[s];
        out[d + 1] = src[s + 1];
        out[d + 2] = src[s + 2];
        out[d + 3] = 255;
      }
    }
  }
  // Fill color: west pixel 0 of DFU's (top-down) array = first pixel of the
  // LAST row in our bottom-up buffer.
  const top = ((h - 1) * w) * 4;
  const clearColor = [west.colors[top] / 255, west.colors[top + 1] / 255, west.colors[top + 2] / 255];
  return { colors: out, width: w * 2, height: h, clearColor };
}

/** Duplicate a night IMG (512x219) across both halves. */
export function buildNightSkyPanorama(color32) {
  const { width: w, height: h, colors: src } = color32;
  const out = new Uint8ClampedArray(w * 2 * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w * 2; x++) {
      const s = (y * w + (x % w)) * 4;
      const d = (y * w * 2 + x) * 4;
      out[d] = src[s];
      out[d + 1] = src[s + 1];
      out[d + 2] = src[s + 2];
      out[d + 3] = 255;
    }
  }
  const top = ((h - 1) * w) * 4;
  const clearColor = [src[top] / 255, src[top + 1] / 255, src[top + 2] / 255];
  return { colors: out, width: w * 2, height: h, clearColor };
}

const SKY_VS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vNdc;
void main() {
  vNdc = aPos;
  gl_Position = vec4(aPos, 0.9999, 1.0);
}`;

const SKY_FS = `#version 300 es
precision highp float;
in vec2 vNdc;
uniform sampler2D uSky;
uniform vec3 uClear;
uniform float uYaw;
uniform float uPitch;
uniform float uTanHalfFov;
uniform float uAspect;
uniform float uVSpan; // elevation covered by the strip, radians
out vec4 outColor;
void main() {
  // View ray from the fragment, rotated by pitch (about X) then yaw (about Y)
  // to match the scene camera (fwd = (sin yaw * cos pitch, sin pitch,
  // cos yaw * cos pitch)).
  vec3 ray = normalize(vec3(vNdc.x * uTanHalfFov * uAspect, vNdc.y * uTanHalfFov, 1.0));
  float cp = cos(uPitch), sp = sin(uPitch);
  vec3 r1 = vec3(ray.x, ray.y * cp + ray.z * sp, -ray.y * sp + ray.z * cp);
  float cy = cos(uYaw), sy = sin(uYaw);
  vec3 dir = vec3(r1.x * cy + r1.z * sy, r1.y, -r1.x * sy + r1.z * cy);

  float azimuth = atan(dir.x, dir.z); // 0 at +Z, wraps
  float elevation = asin(clamp(dir.y, -1.0, 1.0));
  float u = fract(azimuth / 6.28318530718);
  float v = elevation / uVSpan;
  vec3 color = v > 1.0 ? uClear : texture(uSky, vec2(u, clamp(v, 0.0, 1.0))).rgb;
  outColor = vec4(color, 1.0);
}`;

export class SkyRenderer {
  constructor(gl) {
    this.gl = gl;
    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(sh));
      }
      return sh;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, SKY_VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, SKY_FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog));
    }
    this.program = prog;
    this.uSky = gl.getUniformLocation(prog, 'uSky');
    this.uClear = gl.getUniformLocation(prog, 'uClear');
    this.uYaw = gl.getUniformLocation(prog, 'uYaw');
    this.uPitch = gl.getUniformLocation(prog, 'uPitch');
    this.uTanHalfFov = gl.getUniformLocation(prog, 'uTanHalfFov');
    this.uAspect = gl.getUniformLocation(prog, 'uAspect');
    this.uVSpan = gl.getUniformLocation(prog, 'uVSpan');

    // Fullscreen triangle pair.
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.texture = null;
    this.clearColor = new Float32Array([0.53, 0.7, 0.92]);
    this.vSpan = 220 * SKY_ANGLE_PER_PIXEL;
  }

  /** Upload a built panorama ({colors, width, height, clearColor}). */
  setPanorama(pano) {
    const gl = this.gl;
    if (!this.texture) this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, pano.width, pano.height, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(pano.colors.buffer)
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    this.clearColor = new Float32Array(pano.clearColor);
    this.vSpan = pano.height * SKY_ANGLE_PER_PIXEL;
  }

  /** Draw the backdrop. Call right after beginFrame, before world geometry. */
  draw(yaw, pitch, fovY, aspect) {
    if (!this.texture) return;
    const gl = this.gl;
    const previousProgram = gl.getParameter(gl.CURRENT_PROGRAM);
    gl.useProgram(this.program);
    gl.depthMask(false);
    gl.disable(gl.DEPTH_TEST);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.uSky, 0);
    gl.uniform3fv(this.uClear, this.clearColor);
    gl.uniform1f(this.uYaw, yaw);
    gl.uniform1f(this.uPitch, pitch);
    gl.uniform1f(this.uTanHalfFov, Math.tan(fovY / 2));
    gl.uniform1f(this.uAspect, aspect);
    gl.uniform1f(this.uVSpan, this.vSpan);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.useProgram(previousProgram);
    gl.activeTexture(gl.TEXTURE0);
  }
}
