// WebGL2 renderer for world geometry. Presentation layer - ours, not DFU's
// (Port-Doctrine). Semantics it must honor from the data side:
//   - UVs can be negative or > 1 (DFU relies on REPEAT wrapping).
//   - Textures arrive from TextureFile.getColor32 already bottom-up, which is
//     GL's native texel order; upload as-is with flipY off.
//   - Indexed color means hard pixels: NEAREST filtering.
//   - Alpha 0 texels are palette-index cutouts; the shader discards them.

const VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUV;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
out vec3 vNormal;
out vec2 vUV;
out vec3 vWorldPos;
void main() {
  vNormal = mat3(uModel) * aNormal;
  vUV = aUV;
  vec4 world = uModel * vec4(aPos, 1.0);
  vWorldPos = world.xyz;
  gl_Position = uProj * uView * world;
}`;

const FS = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec2 vUV;
in vec3 vWorldPos;
uniform sampler2D uTex;
uniform sampler2D uEmissionTex;
uniform vec3 uLightDir;
uniform vec3 uAmbient;
uniform float uSunScale;
uniform vec3 uSunColor;
uniform vec3 uEmissionColor;
uniform int uPointCount;
uniform vec4 uPointLights[16]; // xyz scene-space, w range
uniform vec3 uPointColor;
uniform vec3 uFogColor;
uniform int uFogMode; // 0 off, 1 linear, 2 exp
uniform float uFogDensity;
uniform vec2 uFogRange; // start, end
uniform vec3 uCamPos;
out vec4 outColor;
float fogFactorAt(vec3 worldPos) {
  if (uFogMode == 0) return 1.0;
  float d = length(worldPos - uCamPos);
  if (uFogMode == 1) {
    return clamp((uFogRange.y - d) / max(uFogRange.y - uFogRange.x, 1e-4), 0.0, 1.0);
  }
  return exp(-uFogDensity * d);
}
void main() {
  vec4 tex = texture(uTex, vUV);
  if (tex.a < 0.5) discard;
  vec3 n = normalize(vNormal);
  float diff = max(dot(n, uLightDir), 0.0);
  vec3 lit = tex.rgb * (uAmbient + uSunColor * (uSunScale * diff));
  // Point lights (city lanterns): N.L with a squared linear falloff to the
  // range - documented equivalence to the Unity point light this replaces.
  float pointDiff = 0.0;
  for (int i = 0; i < 16; i++) {
    if (i >= uPointCount) break;
    vec3 L = uPointLights[i].xyz - vWorldPos;
    float d = length(L);
    float att = clamp(1.0 - d / uPointLights[i].w, 0.0, 1.0);
    pointDiff += att * att * max(dot(n, L / max(d, 1e-4)), 0.0);
  }
  lit += tex.rgb * pointDiff * uPointColor;
  // Window emission: white mask from getWindowColors32, tinted by the
  // active window style (MaterialReader semantics: emission adds on top).
  vec3 emission = texture(uEmissionTex, vUV).rgb * uEmissionColor;
  outColor = vec4(mix(uFogColor, lit + emission, fogFactorAt(vWorldPos)), 1.0);
}`;

const CHAR_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aColor;
layout(location=2) in vec3 aNormal;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
out vec3 vColor;
out vec3 vNormal;
out vec3 vWorldPos;
void main() {
  vColor = aColor;
  vNormal = mat3(uModel) * aNormal;
  vec4 world = uModel * vec4(aPos, 1.0);
  vWorldPos = world.xyz;
  gl_Position = uProj * uView * world;
}`;

// Character fragment: the mesh path's lighting + fog verbatim, sampling
// the rig's vertex color instead of a texture (C4b - no emission, no
// alpha cutout: rig faces are opaque solids).
const CHAR_FS = `#version 300 es
precision highp float;
in vec3 vColor;
in vec3 vNormal;
in vec3 vWorldPos;
uniform vec3 uLightDir;
uniform vec3 uAmbient;
uniform float uSunScale;
uniform vec3 uSunColor;
uniform int uPointCount;
uniform vec4 uPointLights[16];
uniform vec3 uPointColor;
uniform vec3 uFogColor;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 outColor;
float fogFactorAt(vec3 worldPos) {
  if (uFogMode == 0) return 1.0;
  float d = length(worldPos - uCamPos);
  if (uFogMode == 1) {
    return clamp((uFogRange.y - d) / max(uFogRange.y - uFogRange.x, 1e-4), 0.0, 1.0);
  }
  return exp(-uFogDensity * d);
}
void main() {
  vec3 n = normalize(vNormal);
  float diff = max(dot(n, uLightDir), 0.0);
  vec3 lit = vColor * (uAmbient + uSunColor * (uSunScale * diff));
  float pointDiff = 0.0;
  for (int i = 0; i < 16; i++) {
    if (i >= uPointCount) break;
    vec3 L = uPointLights[i].xyz - vWorldPos;
    float d = length(L);
    float att = clamp(1.0 - d / uPointLights[i].w, 0.0, 1.0);
    pointDiff += att * att * max(dot(n, L / max(d, 1e-4)), 0.0);
  }
  lit += vColor * pointDiff * uPointColor;
  outColor = vec4(mix(uFogColor, lit, fogFactorAt(vWorldPos)), 1.0);
}`;

const BB_VS = `#version 300 es
layout(location=0) in vec3 aCenter;
layout(location=1) in vec2 aCorner;
uniform mat4 uProj;
uniform mat4 uView;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec3 uOrigin;
uniform vec2 uSize;
out vec2 vUV;
out vec3 vBBWorld;
void main() {
  // Bottom-anchored: centre sits half a height above the placement base.
  vec3 world = aCenter + uOrigin
    + uRight * (aCorner.x * uSize.x)
    + uUp * ((aCorner.y + 0.5) * uSize.y);
  vBBWorld = world;
  // Textures are bottom-up (v=0 = image bottom), so the quad top
  // (aCorner.y = +0.5) samples v = 1 - matching the mesh path's negated-V
  // convention. The previous 0.5 - aCorner.y flipped every billboard.
  vUV = vec2(aCorner.x + 0.5, aCorner.y + 0.5);
  gl_Position = uProj * uView * vec4(world, 1.0);
}`;

const BB_FS = `#version 300 es
precision highp float;
in vec2 vUV;
in vec3 vBBWorld;
uniform sampler2D uTex;
uniform vec3 uTint; // time-of-day: ambient + sunColor * sunScale * 0.5
uniform int uPointCount;
uniform vec4 uPointLights[16]; // xyz scene-space, w range
uniform vec3 uPointColor;
uniform vec3 uFogColor;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 outColor;
float fogFactorAt(vec3 worldPos) {
  if (uFogMode == 0) return 1.0;
  float d = length(worldPos - uCamPos);
  if (uFogMode == 1) {
    return clamp((uFogRange.y - d) / max(uFogRange.y - uFogRange.x, 1e-4), 0.0, 1.0);
  }
  return exp(-uFogDensity * d);
}
void main() {
  vec4 tex = texture(uTex, vUV);
  if (tex.a < 0.5) discard;
  // Point lights on flats: billboards have no normal, so the term is
  // attenuation-only (squared linear falloff) - documented equivalence
  // to Unity's vertex-lit billboards.
  float pointDiff = 0.0;
  for (int i = 0; i < 16; i++) {
    if (i >= uPointCount) break;
    float d = length(uPointLights[i].xyz - vBBWorld);
    float att = clamp(1.0 - d / uPointLights[i].w, 0.0, 1.0);
    pointDiff += att * att;
  }
  outColor = vec4(mix(uFogColor, tex.rgb * (uTint + pointDiff * uPointColor), fogFactorAt(vBBWorld)), 1.0);
}`;

// Dungeon water: one horizontal quad per watered RDB block, drawn after
// opaque geometry with alpha blending and no depth writes. The surface
// color is a presentation choice (DFU uses a modern water prefab; classic
// used a palette-animated surface) - a classic-texture upgrade is queued.
const WATER_VS = `#version 300 es
layout(location=0) in vec2 aXZ; // unit quad 0..1
uniform mat4 uProj;
uniform mat4 uView;
uniform vec4 uRect; // x0, z0, size, y
out vec2 vWaterXZ;
out vec3 vWaterWorld;
void main() {
  vec3 world = vec3(uRect.x + aXZ.x * uRect.z, uRect.w, uRect.y + aXZ.y * uRect.z);
  vWaterXZ = world.xz;
  vWaterWorld = world;
  gl_Position = uProj * uView * vec4(world, 1.0);
}`;

const WATER_FS = `#version 300 es
precision highp float;
in vec2 vWaterXZ;
in vec3 vWaterWorld;
uniform vec4 uWaterColor; // rgb tint (1,1,1 for plain classic), a = blend
uniform sampler2D uWaterTex; // classic water tile (ground record 0)
uniform float uWaterScroll; // slow classic flow, in tiles
uniform vec3 uFogColor;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 outColor;
float fogFactorAt(vec3 worldPos) {
  if (uFogMode == 0) return 1.0;
  float d = length(worldPos - uCamPos);
  if (uFogMode == 1) {
    return clamp((uFogRange.y - d) / max(uFogRange.y - uFogRange.x, 1e-4), 0.0, 1.0);
  }
  return exp(-uFogDensity * d);
}
void main() {
  // World xz -> classic tile UVs: 6.4 units per 64px tile, REPEAT wrap,
  // scrolled diagonally.
  vec2 uv = vWaterXZ / 6.4 + vec2(uWaterScroll);
  vec3 tex = texture(uWaterTex, uv).rgb;
  outColor = vec4(mix(uFogColor, tex * uWaterColor.rgb, fogFactorAt(vWaterWorld)), uWaterColor.a);
}`;

// Terrain tilemap pass (R9): verbatim Daggerfall/TilemapTextureArray
// decode - tileIndex = data >> 2, transform = data & 3 with the shader's
// rotation/translation tables (flip rides as 180 degrees, as shipped).
// Sampling is NEAREST without mips (repo texel convention; DFU's mip
// bias is presentation-side). Lighting matches the solid program minus
// window emission.
const TERRAIN_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
out vec3 vNormal;
out vec3 vWorldPos;
out vec2 vLocalXZ;
void main() {
  vNormal = mat3(uModel) * aNormal;
  vec4 world = uModel * vec4(aPos, 1.0);
  vWorldPos = world.xyz;
  vLocalXZ = aPos.xz;
  gl_Position = uProj * uView * world;
}`;

const TERRAIN_FS = `#version 300 es
precision highp float;
precision highp usampler2D;
precision highp sampler2DArray;
in vec3 vNormal;
in vec3 vWorldPos;
in vec2 vLocalXZ;
uniform sampler2DArray uTileArr;
uniform usampler2D uTilemap;
uniform float uTileSize; // world units per tile (6.4)
uniform vec3 uLightDir;
uniform vec3 uAmbient;
uniform float uSunScale;
uniform vec3 uSunColor;
uniform int uPointCount;
uniform vec4 uPointLights[16];
uniform vec3 uPointColor;
uniform vec3 uFogColor;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 outColor;
float fogFactorAt(vec3 worldPos) {
  if (uFogMode == 0) return 1.0;
  float d = length(worldPos - uCamPos);
  if (uFogMode == 1) {
    return clamp((uFogRange.y - d) / max(uFogRange.y - uFogRange.x, 1e-4), 0.0, 1.0);
  }
  return exp(-uFogDensity * d);
}
// DFU's HLSL float2x2 initializers are row-major; GLSL mat2 is
// column-major, so these are the TRANSPOSES of the shader source
// (caught in R9 build: rotated tiles sampled the wrong direction).
const mat2 ROT[4] = mat2[4](
  mat2(1.0, 0.0, 0.0, 1.0),
  mat2(0.0, -1.0, 1.0, 0.0),
  mat2(-1.0, 0.0, 0.0, -1.0),
  mat2(0.0, 1.0, -1.0, 0.0));
const vec2 TRANS[4] = vec2[4](
  vec2(0.0, 0.0), vec2(0.0, 1.0), vec2(1.0, 1.0), vec2(1.0, 0.0));
void main() {
  vec2 unwrapped = vLocalXZ / uTileSize;
  ivec2 cell = clamp(ivec2(floor(unwrapped)), ivec2(0), ivec2(127));
  uint data = texelFetch(uTilemap, cell, 0).r;
  int layer = int(data >> 2u);
  int t = int(data & 3u);
  vec2 tileUV = fract(unwrapped);
  vec2 tuv = ROT[t] * tileUV + TRANS[t];
  vec3 tex = texture(uTileArr, vec3(tuv, float(layer))).rgb;
  vec3 n = normalize(vNormal);
  float diff = max(dot(n, uLightDir), 0.0);
  vec3 lit = tex * (uAmbient + uSunColor * (uSunScale * diff));
  float pointDiff = 0.0;
  for (int i = 0; i < 16; i++) {
    if (i >= uPointCount) break;
    vec3 L = uPointLights[i].xyz - vWorldPos;
    float d = length(L);
    float att = clamp(1.0 - d / uPointLights[i].w, 0.0, 1.0);
    pointDiff += att * att * max(dot(n, L / max(d, 1e-4)), 0.0);
  }
  lit += tex * pointDiff * uPointColor;
  outColor = vec4(mix(uFogColor, lit, fogFactorAt(vWorldPos)), 1.0);
}`;

const ZERO_ORIGIN = [0, 0, 0];

/** THE CHARACTER PIXELIZE STANDARD (Mac): characters and everything
 *  character-side render at this pixel size; the WORLD is excluded.
 *  9 -> 7 per Mac (2026-07-06). Single source - the engine character
 *  pass and the viewer default both read this value. */
export const CHAR_PIXEL = 7;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false });
    if (!gl) throw new Error('WebGL2 required');
    this.gl = gl;

    this.program = this._buildProgram(VS, FS);
    this.uProj = gl.getUniformLocation(this.program, 'uProj');
    this.uView = gl.getUniformLocation(this.program, 'uView');
    this.uModel = gl.getUniformLocation(this.program, 'uModel');
    this.uLightDir = gl.getUniformLocation(this.program, 'uLightDir');
    this.uAmbient = gl.getUniformLocation(this.program, 'uAmbient');
    this.uSunScale = gl.getUniformLocation(this.program, 'uSunScale');
    this.uSunColor = gl.getUniformLocation(this.program, 'uSunColor');
    this.uTex = gl.getUniformLocation(this.program, 'uTex');
    this.uEmissionTex = gl.getUniformLocation(this.program, 'uEmissionTex');
    this.uEmissionColor = gl.getUniformLocation(this.program, 'uEmissionColor');
    this.uPointCount = gl.getUniformLocation(this.program, 'uPointCount');
    this.uPointLights = gl.getUniformLocation(this.program, 'uPointLights');
    this.uPointColor = gl.getUniformLocation(this.program, 'uPointColor');

    this.textures = new Map(); // "archive_record" -> WebGLTexture
    this.emissionTextures = new Map(); // "archive_record" -> window mask
    this._windowEmission = new Float32Array([0, 0, 0]);
    this._pointLights = new Float32Array(0); // vec4 per light [x,y,z,range]
    this._pointColor = new Float32Array([1, 1, 1]);
    this._fogMode = 0;
    this._fogDensity = 0;
    this._fogRange = new Float32Array([0, 1]);
    this._fogColor = new Float32Array([0, 0, 0]);
    this._camPos = new Float32Array(3);
    const fogLocs = (program) => ({
      fogColor: gl.getUniformLocation(program, 'uFogColor'),
      fogMode: gl.getUniformLocation(program, 'uFogMode'),
      fogDensity: gl.getUniformLocation(program, 'uFogDensity'),
      fogRange: gl.getUniformLocation(program, 'uFogRange'),
      camPos: gl.getUniformLocation(program, 'uCamPos'),
    });
    this._solidFog = fogLocs(this.program);
    // Character program (C4b): rig vertex-color path, same scene
    // lighting/fog model as the mesh program.
    this.charProgram = this._buildProgram(CHAR_VS, CHAR_FS);
    const cp = this.charProgram;
    this._char = {
      proj: gl.getUniformLocation(cp, 'uProj'),
      view: gl.getUniformLocation(cp, 'uView'),
      model: gl.getUniformLocation(cp, 'uModel'),
      lightDir: gl.getUniformLocation(cp, 'uLightDir'),
      ambient: gl.getUniformLocation(cp, 'uAmbient'),
      sunScale: gl.getUniformLocation(cp, 'uSunScale'),
      sunColor: gl.getUniformLocation(cp, 'uSunColor'),
      pointCount: gl.getUniformLocation(cp, 'uPointCount'),
      pointLights: gl.getUniformLocation(cp, 'uPointLights'),
      pointColor: gl.getUniformLocation(cp, 'uPointColor'),
    };
    this._charFog = fogLocs(cp);
    // Defaults reproduce the pre-R5 fixed lighting (0.45 + 0.55 * diff).
    this._ambient = new Float32Array([0.45, 0.45, 0.45]);
    this._sunScale = 0.55;
    this._sunColor = new Float32Array([1, 1, 1]);
    // Billboards stay full-bright until a scene installs the clock via
    // setLighting - the solid defaults above reproduce the pre-R5 solid
    // shading, but 0.45 + 0.55 * 0.5 would silently dim flats to 72.5%
    // in the clockless scenes (caught in the R5 audit: dungeon vine).
    this._clockLit = false;
    // 1x1 black bound for every non-window submesh (branchless shader).
    this._blackTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._blackTex);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 255])
    );

    this.bbProgram = this._buildProgram(BB_VS, BB_FS);
    this.terrainProgram = this._buildProgram(TERRAIN_VS, TERRAIN_FS);
    this.tUProj = gl.getUniformLocation(this.terrainProgram, 'uProj');
    this.tUView = gl.getUniformLocation(this.terrainProgram, 'uView');
    this.tUModel = gl.getUniformLocation(this.terrainProgram, 'uModel');
    this.tUTileArr = gl.getUniformLocation(this.terrainProgram, 'uTileArr');
    this.tUTilemap = gl.getUniformLocation(this.terrainProgram, 'uTilemap');
    this.tUTileSize = gl.getUniformLocation(this.terrainProgram, 'uTileSize');
    this.tULightDir = gl.getUniformLocation(this.terrainProgram, 'uLightDir');
    this.tUAmbient = gl.getUniformLocation(this.terrainProgram, 'uAmbient');
    this.tUSunScale = gl.getUniformLocation(this.terrainProgram, 'uSunScale');
    this.tUSunColor = gl.getUniformLocation(this.terrainProgram, 'uSunColor');
    this.tUPointCount = gl.getUniformLocation(this.terrainProgram, 'uPointCount');
    this.tUPointLights = gl.getUniformLocation(this.terrainProgram, 'uPointLights');
    this.tUPointColor = gl.getUniformLocation(this.terrainProgram, 'uPointColor');
    this.tileArrays = new Map(); // archive -> TEXTURE_2D_ARRAY
    this._terrainIndexBuffer = null;
    this._terrainIndexCount = 0;

    this.waterProgram = this._buildProgram(WATER_VS, WATER_FS);
    this._bbFog = {
      fogColor: gl.getUniformLocation(this.bbProgram, 'uFogColor'),
      fogMode: gl.getUniformLocation(this.bbProgram, 'uFogMode'),
      fogDensity: gl.getUniformLocation(this.bbProgram, 'uFogDensity'),
      fogRange: gl.getUniformLocation(this.bbProgram, 'uFogRange'),
      camPos: gl.getUniformLocation(this.bbProgram, 'uCamPos'),
    };
    this._terrainFog = {
      fogColor: gl.getUniformLocation(this.terrainProgram, 'uFogColor'),
      fogMode: gl.getUniformLocation(this.terrainProgram, 'uFogMode'),
      fogDensity: gl.getUniformLocation(this.terrainProgram, 'uFogDensity'),
      fogRange: gl.getUniformLocation(this.terrainProgram, 'uFogRange'),
      camPos: gl.getUniformLocation(this.terrainProgram, 'uCamPos'),
    };
    this._waterFog = {
      fogColor: gl.getUniformLocation(this.waterProgram, 'uFogColor'),
      fogMode: gl.getUniformLocation(this.waterProgram, 'uFogMode'),
      fogDensity: gl.getUniformLocation(this.waterProgram, 'uFogDensity'),
      fogRange: gl.getUniformLocation(this.waterProgram, 'uFogRange'),
      camPos: gl.getUniformLocation(this.waterProgram, 'uCamPos'),
    };
    this.waterUProj = gl.getUniformLocation(this.waterProgram, 'uProj');
    this.waterUView = gl.getUniformLocation(this.waterProgram, 'uView');
    this.waterURect = gl.getUniformLocation(this.waterProgram, 'uRect');
    this.waterUTex = gl.getUniformLocation(this.waterProgram, 'uWaterTex');
    this.waterUScroll = gl.getUniformLocation(this.waterProgram, 'uWaterScroll');
    this.waterUColor = gl.getUniformLocation(this.waterProgram, 'uWaterColor');
    {
      // Shared unit XZ quad for water planes.
      this.waterVao = gl.createVertexArray();
      gl.bindVertexArray(this.waterVao);
      const vb = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.bufferData(gl.ARRAY_BUFFER,
        new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
      gl.bindVertexArray(null);
    }
    this.bbUProj = gl.getUniformLocation(this.bbProgram, 'uProj');
    this.bbUView = gl.getUniformLocation(this.bbProgram, 'uView');
    this.bbURight = gl.getUniformLocation(this.bbProgram, 'uRight');
    this.bbUUp = gl.getUniformLocation(this.bbProgram, 'uUp');
    this.bbUSize = gl.getUniformLocation(this.bbProgram, 'uSize');
    this.bbUOrigin = gl.getUniformLocation(this.bbProgram, 'uOrigin');
    this.bbUTex = gl.getUniformLocation(this.bbProgram, 'uTex');
    this.bbUTint = gl.getUniformLocation(this.bbProgram, 'uTint');
    this.bbUPointCount = gl.getUniformLocation(this.bbProgram, 'uPointCount');
    this.bbUPointLights = gl.getUniformLocation(this.bbProgram, 'uPointLights');
    this.bbUPointColor = gl.getUniformLocation(this.bbProgram, 'uPointColor');
    this._proj = null;
    this._view = null;

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.clearColor(0.53, 0.7, 0.92, 1.0); // pale Iliac Bay sky
  }

  _buildProgram(vsSrc, fsSrc) {
    const gl = this.gl;
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
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog));
    }
    return prog;
  }

  /** VAO from packCharacterFaces output (interleaved 9 floats/vertex). */
  createCharacterMesh(packed) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, packed, gl.STATIC_DRAW);
    const stride = 9 * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, stride, 24);
    gl.bindVertexArray(null);
    return { vao, count: packed.length / 9, buffers: [vbo], vbo };
  }

  /** Re-upload a character mesh's vertex stream in place (per-frame
   *  animation). `packed` must match the original layout/length. */
  updateCharacterMesh(mesh, packed) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, packed);
  }

  /**
   * Draw a character mesh (C4b). Owns its program binding (the R9
   * rule) AND the cull state: rig faces carry authored normals but
   * inconsistent triangle winding (built for a non-culling painter),
   * so back-face culling is disabled for the draw and restored after.
   * Frame uniforms re-upload from the beginFrame caches, mirroring
   * the water/billboard paths.
   */
  drawCharacter(mesh, modelMatrix) {
    const gl = this.gl;
    const c = this._char;
    gl.useProgram(this.charProgram);
    gl.uniformMatrix4fv(c.proj, false, this._proj);
    gl.uniformMatrix4fv(c.view, false, this._view);
    gl.uniformMatrix4fv(c.model, false, modelMatrix);
    gl.uniform3fv(c.lightDir, this._lightDir);
    gl.uniform3fv(c.ambient, this._ambient);
    gl.uniform1f(c.sunScale, this._sunScale);
    gl.uniform3fv(c.sunColor, this._sunColor);
    const count = this._pointLights.length / 4;
    gl.uniform1i(c.pointCount, count);
    if (count > 0) gl.uniform4fv(c.pointLights, this._pointLights);
    gl.uniform3fv(c.pointColor, this._pointColor);
    this._uploadFog(this._charFog);
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(mesh.vao);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
  }

  /**
   * THE CHARACTER PIXELIZE PASS (slice 4). Characters render into a
   * low-res offscreen target (screen size / CHAR_PIXEL, NEAREST) and
   * composite into the world as a camera-facing textured quad - a
   * live sprite, chunky by construction, depth-tested like every
   * classic billboard. The world pass is untouched (the standard
   * excludes it). Lazy FBO, reallocated only when the pixel size steps.
   */
  _charSpriteRT(pw, ph) {
    const gl = this.gl;
    let cs = this._csRT;
    if (!cs || cs.w !== pw || cs.h !== ph) {
      if (cs) { gl.deleteFramebuffer(cs.fbo); gl.deleteTexture(cs.tex); gl.deleteRenderbuffer(cs.rb); }
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, pw, ph, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const rb = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, pw, ph);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      cs = this._csRT = { fbo, tex, rb, w: pw, h: ph };
    }
    return cs;
  }

  /** Render a character mesh into the sprite target under a fitted
   *  ortho camera (frame lighting; the frame camera caches are
   *  swapped and restored - drawCharacter reads them). */
  renderCharacterSprite(mesh, modelMatrix, proj, view, pw, ph) {
    const gl = this.gl;
    const cs = this._charSpriteRT(pw, ph);
    gl.bindFramebuffer(gl.FRAMEBUFFER, cs.fbo);
    gl.viewport(0, 0, pw, ph);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const sp = this._proj, sv = this._view;
    this._proj = proj; this._view = view;
    this.drawCharacter(mesh, modelMatrix);
    this._proj = sp; this._view = sv;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    return cs.tex;
  }

  /** Composite the sprite into the world: camera-facing quad at the
   *  character's position, alpha-cut, fogged, depth-tested. */
  drawCharacterSpriteQuad(tex, center, halfW, halfH, right) {
    const gl = this.gl;
    if (!this.charQuadProgram) {
      const vs = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec2 aUV;
uniform mat4 uProj, uView;
out vec2 vUV; out vec3 vWorld;
void main() { vUV = aUV; vWorld = aPos; gl_Position = uProj * uView * vec4(aPos, 1.0); }`;
      const fs = `#version 300 es
precision highp float;
in vec2 vUV; in vec3 vWorld;
uniform sampler2D uTex;
uniform vec3 uFogColor;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 outColor;
float fogFactorAt(vec3 worldPos) {
  if (uFogMode == 0) return 1.0;
  float d = length(worldPos - uCamPos);
  if (uFogMode == 1) {
    return clamp((uFogRange.y - d) / max(uFogRange.y - uFogRange.x, 1e-4), 0.0, 1.0);
  }
  return exp(-uFogDensity * d);
}
void main() {
  vec4 t = texture(uTex, vUV);
  if (t.a < 0.5) discard;
  outColor = vec4(mix(uFogColor, t.rgb, fogFactorAt(vWorld)), 1.0);
}`;
      this.charQuadProgram = this._buildProgram(vs, fs);
      const P = this.charQuadProgram;
      this._charQuad = {
        proj: gl.getUniformLocation(P, 'uProj'),
        view: gl.getUniformLocation(P, 'uView'),
        tex: gl.getUniformLocation(P, 'uTex'),
        fogColor: gl.getUniformLocation(P, 'uFogColor'),
        fogMode: gl.getUniformLocation(P, 'uFogMode'),
        fogDensity: gl.getUniformLocation(P, 'uFogDensity'),
        fogRange: gl.getUniformLocation(P, 'uFogRange'),
        camPos: gl.getUniformLocation(P, 'uCamPos'),
      };
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, 4 * 5 * 4, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
      gl.bindVertexArray(null);
      this._charQuadVAO = vao; this._charQuadVBO = vbo;
    }
    const [cx, cy, cz] = center, [rx, , rz] = right;
    const v = new Float32Array([
      cx - rx*halfW, cy - halfH, cz - rz*halfW, 0, 0,
      cx - rx*halfW, cy + halfH, cz - rz*halfW, 0, 1,
      cx + rx*halfW, cy + halfH, cz + rz*halfW, 1, 1,
      cx + rx*halfW, cy - halfH, cz + rz*halfW, 1, 0,
    ]);
    gl.useProgram(this.charQuadProgram);
    const c = this._charQuad;
    gl.uniformMatrix4fv(c.proj, false, this._proj);
    gl.uniformMatrix4fv(c.view, false, this._view);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(c.tex, 0);
    this._uploadFog(this._charQuad);
    gl.bindVertexArray(this._charQuadVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._charQuadVBO);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, v);
    gl.disable(gl.CULL_FACE);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    gl.enable(gl.CULL_FACE);
    gl.bindVertexArray(null);
  }

  /** Upload a getColor32 result as a REPEAT/NEAREST texture, keyed and cached. */
  uploadTexture(archive, record, color32) {
    const key = `${archive}_${record}`;
    if (this.textures.has(key)) return this.textures.get(key);
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, color32.width, color32.height, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(color32.colors.buffer)
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    this.textures.set(key, tex);
    return tex;
  }

  /** Build a VAO bundle from meshReader output. */
  createMesh(model) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const buffers = [];
    const buf = (target, data) => {
      const b = gl.createBuffer();
      gl.bindBuffer(target, b);
      gl.bufferData(target, data, gl.STATIC_DRAW);
      buffers.push(b);
      return b;
    };
    buf(gl.ARRAY_BUFFER, model.positions);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    buf(gl.ARRAY_BUFFER, model.normals);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    buf(gl.ARRAY_BUFFER, model.uvs);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
    buf(gl.ELEMENT_ARRAY_BUFFER, model.indices);

    gl.bindVertexArray(null);
    return { vao, subMeshes: model.subMeshes, buffers };
  }

  beginFrame(proj, view, lightDir) {
    const gl = this.gl;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.uProj, false, proj);
    gl.uniformMatrix4fv(this.uView, false, view);
    gl.uniform3fv(this.uLightDir, lightDir);
    this._lightDir = lightDir;
    gl.uniform3fv(this.uAmbient, this._ambient);
    gl.uniform1f(this.uSunScale, this._sunScale);
    gl.uniform3fv(this.uSunColor, this._sunColor);
    gl.uniform1i(this.uTex, 0);
    gl.uniform1i(this.uEmissionTex, 1);
    gl.uniform3fv(this.uEmissionColor, this._windowEmission);
    const count = this._pointLights.length / 4;
    gl.uniform1i(this.uPointCount, count);
    if (count > 0) gl.uniform4fv(this.uPointLights, this._pointLights);
    gl.uniform3fv(this.uPointColor, this._pointColor);
    // Camera position from the view matrix (view = R^T * T(-eye)).
    const v = view;
    this._camPos[0] = -(v[0] * v[12] + v[1] * v[13] + v[2] * v[14]);
    this._camPos[1] = -(v[4] * v[12] + v[5] * v[13] + v[6] * v[14]);
    this._camPos[2] = -(v[8] * v[12] + v[9] * v[13] + v[10] * v[14]);
    this._uploadFog(this._solidFog);
    gl.activeTexture(gl.TEXTURE0);
    this._proj = proj;
    this._view = view;
  }

  /** Active window style emission (windowEmissionRGB output). */
  setWindowEmission(rgb) {
    this._windowEmission = rgb;
  }

  /** Time-of-day lighting: ambient color, sun scale, sun color. */
  setLighting(ambient, sunScale, sunColor) {
    this._ambient = ambient;
    this._sunScale = sunScale;
    if (sunColor) this._sunColor = sunColor;
    this._clockLit = true;
  }

  /** Distance fog for every world pass. mode 'off'|'linear'|'exp'. */
  setFog(mode, density, start, end, color) {
    this._fogMode = mode === 'linear' ? 1 : mode === 'exp' ? 2 : 0;
    this._fogDensity = density;
    this._fogRange[0] = start;
    this._fogRange[1] = end;
    if (color) this._fogColor = color;
  }

  _uploadFog(prog) {
    const gl = this.gl;
    gl.uniform3fv(prog.fogColor, this._fogColor);
    gl.uniform1i(prog.fogMode, this._fogMode);
    gl.uniform1f(prog.fogDensity, this._fogDensity);
    gl.uniform2fv(prog.fogRange, this._fogRange);
    gl.uniform3fv(prog.camPos, this._camPos);
  }

  /** Scene-space point lights as flat vec4s [x,y,z,range], max 16. */
  setPointLights(data, color) {
    this._pointLights = data.subarray ? data.subarray(0, 16 * 4) : data;
    if (color) this._pointColor = color;
  }

  /** Upload a getWindowColors32 mask for a window (archive, record). */
  uploadEmissionTexture(archive, record, color32) {
    const key = `${archive}_${record}`;
    if (this.emissionTextures.has(key)) return this.emissionTextures.get(key);
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, color32.width, color32.height, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(color32.colors.buffer)
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.activeTexture(gl.TEXTURE0);
    this.emissionTextures.set(key, tex);
    return tex;
  }

  /**
   * One batch = all billboards of one (archive, record): 4 verts per flat
   * (center xyz + corner offsets in -0.5..0.5), indexed quads. Positions are
   * the billboard BASE; the shader lifts by half height (AlignToBase).
   */
  createBillboardBatch(archive, record, size, centers) {
    const gl = this.gl;
    const count = centers.length;
    const verts = new Float32Array(count * 4 * 5);
    const indices = new Uint32Array(count * 6);
    const corners = [
      [-0.5, -0.5],
      [-0.5, 0.5],
      [0.5, 0.5],
      [0.5, -0.5],
    ];
    for (let f = 0; f < count; f++) {
      const [cx, cy, cz] = centers[f];
      for (let c = 0; c < 4; c++) {
        const o = (f * 4 + c) * 5;
        verts[o] = cx;
        verts[o + 1] = cy;
        verts[o + 2] = cz;
        verts[o + 3] = corners[c][0];
        verts[o + 4] = corners[c][1];
      }
      const b = f * 4;
      const io = f * 6;
      indices[io] = b;
      indices[io + 1] = b + 2;
      indices[io + 2] = b + 1;
      indices[io + 3] = b;
      indices[io + 4] = b + 3;
      indices[io + 5] = b + 2;
    }

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);

    return { vao, indexCount: count * 6, archive, record, size, buffers: [vb, ib], origin: null };
  }

  /** Release a createMesh bundle's GPU resources. */
  destroyMesh(mesh) {
    const gl = this.gl;
    for (const b of mesh.buffers) gl.deleteBuffer(b);
    gl.deleteVertexArray(mesh.vao);
  }

  /** Release a billboard batch's GPU resources. */
  destroyBatch(batch) {
    const gl = this.gl;
    for (const b of batch.buffers) gl.deleteBuffer(b);
    gl.deleteVertexArray(batch.vao);
  }

  /** Lazily create the shared 129x129 terrain index buffer. */
  _terrainIndices(indices) {
    if (this._terrainIndexBuffer) return;
    const gl = this.gl;
    this._terrainIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._terrainIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    this._terrainIndexCount = indices.length;
  }

  /** Create one pixel's terrain surface (positions + normals grid). */
  createTerrainSurface(positions, normals, indices) {
    const gl = this.gl;
    this._terrainIndices(indices);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buffers = [];
    const buf = (data, loc) => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 12, 0);
      buffers.push(b);
      return b;
    };
    buf(positions, 0);
    buf(normals, 1);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._terrainIndexBuffer);
    gl.bindVertexArray(null);
    return { vao, buffers, indexCount: this._terrainIndexCount };
  }

  /** Upload a 128x128 tilemap byte texture (R8UI, NEAREST). */
  uploadTilemapTexture(bytes, dim) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, dim, dim, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, bytes);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    return tex;
  }

  /** Upload/cache a ground archive as a 64x64 TEXTURE_2D_ARRAY. */
  uploadTileArray(archive, layers) {
    if (this.tileArrays.has(archive)) return this.tileArrays.get(archive);
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
    const w = layers[0].width;
    const h = layers[0].height;
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA, w, h, layers.length, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    for (let i = 0; i < layers.length; i++) {
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, w, h, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(layers[i].colors.buffer, layers[i].colors.byteOffset, w * h * 4));
    }
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    // DFU's terrain texture array wraps Clamp (TextureReader) - keeps
    // the far edge texel at transformed-uv 1.0 boundary ties.
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.tileArrays.set(archive, tex);
    return tex;
  }

  /** Draw one terrain surface with its tilemap + tile array. */
  drawTerrain(surface, modelMatrix, arrayTex, tilemapTex, tileSize) {
    const gl = this.gl;
    gl.useProgram(this.terrainProgram);
    gl.uniformMatrix4fv(this.tUProj, false, this._proj);
    gl.uniformMatrix4fv(this.tUView, false, this._view);
    gl.uniformMatrix4fv(this.tUModel, false, modelMatrix);
    gl.uniform1f(this.tUTileSize, tileSize);
    this._uploadFog(this._terrainFog);
    gl.uniform3fv(this.tULightDir, this._lightDir);
    gl.uniform3fv(this.tUAmbient, this._ambient);
    gl.uniform1f(this.tUSunScale, this._sunScale);
    gl.uniform3fv(this.tUSunColor, this._sunColor);
    const count = this._pointLights.length / 4;
    gl.uniform1i(this.tUPointCount, count);
    if (count > 0) gl.uniform4fv(this.tUPointLights, this._pointLights);
    gl.uniform3fv(this.tUPointColor, this._pointColor);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, arrayTex);
    gl.uniform1i(this.tUTileArr, 0);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, tilemapTex);
    gl.uniform1i(this.tUTilemap, 2);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(surface.vao);
    gl.drawElements(gl.TRIANGLES, surface.indexCount, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
  }

  /**
   * Draw dungeon water planes. Call after all opaque geometry: alpha
   * blended, depth tested against the world but not written.
   * @param {Array<{x:number,z:number,size:number,y:number}>} quads
   * @param {number[]} color - rgba
   */
  drawWater(quads, color, waterTex, scrollTiles = 0) {
    if (!quads.length) return;
    const gl = this.gl;
    gl.useProgram(this.waterProgram);
    gl.uniformMatrix4fv(this.waterUProj, false, this._proj);
    gl.uniformMatrix4fv(this.waterUView, false, this._view);
    gl.uniform4fv(this.waterUColor, color);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, waterTex);
    gl.uniform1i(this.waterUTex, 0);
    gl.uniform1f(this.waterUScroll, scrollTiles);
    this._uploadFog(this._waterFog);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(this.waterVao);
    for (const q of quads) {
      gl.uniform4f(this.waterURect, q.x, q.z, q.size, q.y);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    gl.bindVertexArray(null);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
  }

  /** Draw billboard batches facing the camera. Call after solid geometry. */
  drawBillboards(batches, camRight, camUp) {
    const gl = this.gl;
    gl.useProgram(this.bbProgram);
    gl.uniformMatrix4fv(this.bbUProj, false, this._proj);
    gl.uniformMatrix4fv(this.bbUView, false, this._view);
    gl.uniform3fv(this.bbURight, camRight);
    gl.uniform3fv(this.bbUUp, camUp);
    gl.uniform1i(this.bbUTex, 0);
    this._uploadFog(this._bbFog);
    // Billboards take the scene's time-of-day light (DFU's ambient-lit
    // billboards): ambient plus the Lambert-average half of the sun term.
    // Clockless scenes keep the pre-R5 full-bright flats.
    if (this._clockLit) {
      gl.uniform3f(
        this.bbUTint,
        this._ambient[0] + this._sunColor[0] * this._sunScale * 0.5,
        this._ambient[1] + this._sunColor[1] * this._sunScale * 0.5,
        this._ambient[2] + this._sunColor[2] * this._sunScale * 0.5
      );
    } else {
      gl.uniform3f(this.bbUTint, 1, 1, 1);
    }
    const bbCount = this._pointLights.length >> 2;
    gl.uniform1i(this.bbUPointCount, bbCount);
    if (bbCount > 0) gl.uniform4fv(this.bbUPointLights, this._pointLights);
    gl.uniform3fv(this.bbUPointColor, this._pointColor);
    gl.activeTexture(gl.TEXTURE0);
    gl.disable(gl.CULL_FACE);
    for (const b of batches) {
      const tex = this.textures.get(`${b.archive}_${b.record}`);
      if (!tex) continue;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform2f(this.bbUSize, b.size.w, b.size.h);
      const o = b.origin || ZERO_ORIGIN;
      gl.uniform3f(this.bbUOrigin, o[0], o[1], o[2]);
      gl.bindVertexArray(b.vao);
      gl.drawElements(gl.TRIANGLES, b.indexCount, gl.UNSIGNED_INT, 0);
    }
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.useProgram(this.program);
  }

  /** Draw one placed mesh: bind per-submesh texture, indexed draw per range. */
  /**
   * @param {Map<string,string>|null} texRemap - optional
   *   "archive_record" -> "archive_record" texture substitution (climate
   *   swaps; UVs stay original-archive, the SetDungeonTextures pattern).
   */
  drawMesh(mesh, modelMatrix, texRemap = null) {
    const gl = this.gl;
    // Every draw entry point owns its program binding (drawTerrain /
    // drawBillboards / drawWater already do) - R9 interleaved terrain
    // draws before the model loop, which silently ran meshes on the
    // terrain program and vanished every building (caught by Mac).
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.uModel, false, modelMatrix);
    gl.bindVertexArray(mesh.vao);
    for (const sm of mesh.subMeshes) {
      const key = `${sm.textureArchive}_${sm.textureRecord}`;
      const resolved = texRemap && texRemap.has(key) ? texRemap.get(key) : key;
      const tex = this.textures.get(resolved);
      if (!tex) continue;
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.emissionTextures.get(resolved) || this._blackTex);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.drawElements(gl.TRIANGLES, sm.primitiveCount * 3, gl.UNSIGNED_INT, sm.startIndex * 4);
    }
    gl.bindVertexArray(null);
  }
}
