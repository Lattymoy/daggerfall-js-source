// Sky backdrop renderer. The data logic follows DaggerfallSky.cs (MIT,
// Daggerfall Workshop): record 0 is the east half, record 1 the west half;
// frames 0-31 sweep sunrise to noon; afternoon frames 32-63 reuse frame
// 63 - n with the two halves SWAPPED (DFU's flip is a hemisphere swap, not
// a pixel mirror - PromoteToTexture:266-286 only crosses west/east over);
// at night the NITE0?I0.IMG matching the sky group replaces both halves
// (0-7 -> 3, 8-15 -> 1, 16-23 -> 2, else 0), with the right-edge seam fix
// of LoadVanillaNightSky:606-611.
// Two DISTINCT colors come out of a panorama and must not be confused:
//   - clearColor: verbatim DaggerfallSky.cs:554/:617 `colors.west[0]`.
//     GetColor32 emits bottom-up (BaseImageFile.cs:246-250), so element 0
//     is the source image's BOTTOM row = the HORIZON. This is DFU's
//     cameraClearColor and, via SetSkyFogColor:325/:329, its fogColor.
//     The exterior hosts read it for the distance haze.
//   - fillColor: the zenith texel, used for the region of OUR cylinder
//     ABOVE the 220-row strip. DFU's screen-space layout has no such
//     region (its clear colour fills BELOW the strip), so this is a
//     presentation value, not a parity one.
// The presentation is ours (Port-Doctrine): DFU scrolls two screen-space
// quads by camera angles; we render one fullscreen pass that maps the view
// ray to a cylinder. The afternoon half is additionally REFLECTED here,
// which DFU never does - under our azimuth convention (azimuth 0 = +Z, map
// north, starts the east half) reflecting the swapped halves is what keeps
// the sun travelling east-to-west, the same thing DFU's screen-space rects
// achieve by re-centring. Documented equivalence, not a verbatim step.
// Each 512-wide half spans 180 degrees of azimuth
// (anglePerPixel = PI/512, so the 220-row strip covers ~77.3 degrees of
// elevation above the horizon), the same angular size DFU's layout implies.
// Azimuth 0 (+Z, map north) starts the east half - the shader's azimuth is
// atan(dir.x, dir.z), which is 0 at +Z - so that half runs north -> east ->
// south and is CENTRED on map east at u = 0.25. Documented equivalence.

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
 * sun side migrates east to west across the day - DFU's hemisphere swap
 * plus our azimuth-convention reflection (see the header).
 * Returns clearColor (verbatim west element 0 = the horizon, DFU's
 * cameraClearColor/fogColor) and fillColor (our above-strip zenith fill).
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
  // Verbatim DaggerfallSky.cs:554 `colors.clearColor = colors.west[0]`.
  const wc = west.colors;
  const clearColor = [wc[0] / 255, wc[1] / 255, wc[2] / 255];
  // Ours: the zenith texel fills the cylinder above the strip.
  const top = ((h - 1) * w) * 4;
  const fillColor = [wc[top] / 255, wc[top + 1] / 255, wc[top + 2] / 255];
  return { colors: out, width: w * 2, height: h, clearColor, fillColor };
}

/**
 * Duplicate a night IMG (512x219) across both halves, with the right-edge
 * seam fix of LoadVanillaNightSky (DaggerfallSky.cs:606-611):
 *   for (y...) { pos = y*width + width-2; colors[pos+1] = colors[pos]; }
 * i.e. the last column is overwritten by its neighbour. Sourcing column
 * w-2 for x == w-1 is the same output without mutating the caller's array
 * (DFU applies it BEFORE reading clearColor, but element 0 is column 0 and
 * so is untouched either way).
 */
export function buildNightSkyPanorama(color32) {
  const { width: w, height: h, colors: src } = color32;
  const out = new Uint8ClampedArray(w * 2 * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w * 2; x++) {
      const col = x % w;
      const s = (y * w + (col === w - 1 ? w - 2 : col)) * 4;
      const d = (y * w * 2 + x) * 4;
      out[d] = src[s];
      out[d + 1] = src[s + 1];
      out[d + 2] = src[s + 2];
      out[d + 3] = 255;
    }
  }
  // Verbatim DaggerfallSky.cs:617 `skyColors.clearColor = skyColors.west[0]`.
  const clearColor = [src[0] / 255, src[1] / 255, src[2] / 255];
  const top = ((h - 1) * w) * 4;
  const fillColor = [src[top] / 255, src[top + 1] / 255, src[top + 2] / 255];
  return { colors: out, width: w * 2, height: h, clearColor, fillColor };
}

/** Fallback panorama when SKY??.DAT is unavailable (the mobile lean
 *  data diet excludes the 247MB sky set - 2026-08-14). A classic-ish
 *  vertical gradient, horizon-light to zenith-blue; not parity, and
 *  never used when the real sky data is present. */
export function buildFallbackSkyPanorama() {
  const w = 512, h = 220;
  const out = new Uint8ClampedArray(w * h * 4);
  const top = [86, 116, 170], bot = [196, 205, 224];
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1);   // bottom-up buffer: y=0 is the horizon
    const r = bot[0] + (top[0] - bot[0]) * t;
    const g = bot[1] + (top[1] - bot[1]) * t;
    const b = bot[2] + (top[2] - bot[2]) * t;
    for (let x = 0; x < w; x++) {
      const d = (y * w + x) * 4;
      out[d] = r; out[d + 1] = g; out[d + 2] = b; out[d + 3] = 255;
    }
  }
  return {
    colors: out, width: w, height: h,
    // clearColor is the horizon end of the gradient (DFU's west[0] role);
    // fillColor is the zenith end, above the strip.
    clearColor: [bot[0] / 255, bot[1] / 255, bot[2] / 255],
    fillColor: [top[0] / 255, top[1] / 255, top[2] / 255],
  };
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
uniform float uFogMix; // 0 = clear sky, 1 = fully fogged (heavy fog)
uniform vec3 uFogColor;
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
  vec3 color = v > 1.0 ? uClear : texture(uSky, vec2(u, clamp(v, 0.0, 1.0))).rgb;  // uClear = fillColor
  outColor = vec4(mix(color, uFogColor, uFogMix), 1.0);
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
    this.uFogMix = gl.getUniformLocation(prog, 'uFogMix');
    this.uFogColor = gl.getUniformLocation(prog, 'uFogColor');
    this.fogMix = 0;
    this.fogColor = new Float32Array([0.5, 0.5, 0.5]);

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
    // clearColor = DFU's cameraClearColor/fogColor (horizon); fillColor
    // paints our cylinder above the strip (zenith). See the header.
    this.clearColor = new Float32Array([0.53, 0.7, 0.92]);
    this.fillColor = new Float32Array([0.53, 0.7, 0.92]);
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
    this.fillColor = new Float32Array(pano.fillColor ?? pano.clearColor);
    this.vSpan = pano.height * SKY_ANGLE_PER_PIXEL;
  }

  /** Draw the backdrop. Call right after beginFrame, before world geometry. */
  draw(yaw, pitch, fovY, aspect) {
    if (!this.texture) return;
    const gl = this.gl;
    // EV6: no program save/restore, and no gl.getParameter round-trip
    // to learn what to restore - the R9 law (renderer.js drawMesh) is
    // that every draw entry point owns its binding, and the hosts mark
    // this pass as a foreign seam (renderer.markForeignPass) so the
    // renderer's state shadows rebind after it.
    gl.useProgram(this.program);
    gl.depthMask(false);
    gl.disable(gl.DEPTH_TEST);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.uSky, 0);
    gl.uniform3fv(this.uClear, this.fillColor);
    gl.uniform1f(this.uYaw, yaw);
    gl.uniform1f(this.uPitch, pitch);
    gl.uniform1f(this.uTanHalfFov, Math.tan(fovY / 2));
    gl.uniform1f(this.uAspect, aspect);
    gl.uniform1f(this.uVSpan, this.vSpan);
    gl.uniform1f(this.uFogMix, this.fogMix);
    gl.uniform3fv(this.uFogColor, this.fogColor);
    // HANDEDNESS: the fullscreen triangle winds CCW and the renderer
    // runs frontFace(CW) - without culling off, the whole sky culls
    // away and the clear color shows through (the sky-blue-screen
    // regression, 2026-08-23).
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.activeTexture(gl.TEXTURE0);
  }
}
