// HITFLASH1 (2026-09-26): A BODY STRUCK FLASHES RED - every foe sprite and every player you can see.
//
// The player: "2d sprites and billboards and maybe even the morrowind assets should flash red when getting hit ...
// there may be a red flash already integrated but maybe it's too short?"
//
// Before: only a PEER struck flashed (PEERFX3), for 0.12 s, fading from full to 40% and then cut - about seven frames,
// easy to miss. And it rode the billboard's concealed phase (`conceal.mode 5`), which the Enhanced Lighting lane's
// billboard shader never had a branch for: under the lane the flash drew nothing at all. Foes never flashed.
//
// Now: one curve, one home. The flash is its own per-batch value (`batch.hitFlash`, 0..1) read by BOTH billboard
// shaders (classic BB_FS and the lane's EL_BB_FS) and by the character-sprite quad (the Morrowind body's picture),
// so it layers over any concealment instead of replacing it, and the batch stays in its own draw phase.
//
// FOES are watched by their HEALTH: a drop since the last drawn frame is a blow landed - my weapon, a peer's weapon
// (applied here or streamed from the foe's owner), a spell, a fall. That one test covers every door without a hook
// in each, and it is exactly what a player sees: the foe lost health, the foe flashes. A foe not drawn for a moment
// (culled, concealed, out of the room) resyncs silently, so an old wound never flashes on its return.

/** How long the flash lasts, seconds - held at full for HOLD, then fading to nothing. */
export const HIT_FLASH_S = 0.3;
export const HIT_FLASH_HOLD_S = 0.08;
/** The strength at the peak (1 = the sprite drawn solid red). Short of 1 so the sprite keeps its shape. */
export const HIT_FLASH_PEAK = 0.85;
/** A foe unseen this long is resynced without a flash. */
const RESYNC_S = 0.5;

/** The flash's strength `age` seconds after the blow (0 before and after). */
export function hitFlashStrength(age) {
  if (!(age >= 0) || age >= HIT_FLASH_S) return 0;
  if (age <= HIT_FLASH_HOLD_S) return HIT_FLASH_PEAK;
  return HIT_FLASH_PEAK * (1 - (age - HIT_FLASH_HOLD_S) / (HIT_FLASH_S - HIT_FLASH_HOLD_S));
}

/** A foe's flash this frame (0..1), off its health - call once per drawn frame, `now` in seconds. */
export function foeHitFlash(f, now) {
  if (!f) return 0;
  const hp = f.entity?.health;
  if (Number.isFinite(hp)) {
    const fresh = f._hfSeen != null && now - f._hfSeen <= RESYNC_S;
    if (fresh && f._hfHp != null && hp < f._hfHp) f._hfAt = now;
    f._hfHp = hp;
    f._hfSeen = now;
  }
  return f._hfAt == null ? 0 : hitFlashStrength(now - f._hfAt);
}

/** Put `k` on a billboard batch (written only when it changes - the draw reads 0 for undefined). */
export function setBatchHitFlash(batch, k) {
  if (!batch) return;
  const v = k > 0 ? k : 0;
  if ((batch.hitFlash || 0) !== v) batch.hitFlash = v;
}

/** The GLSL term both billboard shaders and the sprite quad share: pull the lit colour toward red, keeping the
 *  texel's own light and dark so the silhouette's detail still reads. `lit` and `albedo` in, `lit` out. */
export const HIT_FLASH_GLSL = `
vec3 hitFlashLit(vec3 lit, vec3 albedo, float k) {
  if (k <= 0.0) return lit;
  const vec3 LUM = vec3(0.299, 0.587, 0.114);
  float l = dot(albedo, LUM);
  // as bright as the sprite already is in strong light, never darker than a glow in the dark (a dungeon's foe)
  vec3 red = vec3(1.0, 0.09, 0.06) * max(dot(lit, LUM) * 1.5, 0.45 + 0.8 * l);
  return mix(lit, red, clamp(k, 0.0, 1.0));
}`;

// HITFLASH1 (the same report): "when other players I see hit the enemies they also need to do the getting hit
// animation at times, like I see it when I hit enemies."
//
// A foe another client owns is a PUPPET here, and its hurt came as ONE frame of `hurtKnock` on the streamed health
// drop. The sprite refuses the hurt state mid-attack (DFU's own gate), and a foe trading blows with another player is
// mid-attack most of the time - so the one frame fell on the swing and was gone. At the owner the knockback holds the
// signal for several motor steps, and the hurt plays when the swing ends. The puppet now holds it the same way: up to
// PUPPET_HURT_HOLD_S after the drop, until the sprite enters its hurt state - once, never replayed.
export const PUPPET_HURT_HOLD_S = 0.35;

/** One puppet frame's hurt input. `p` the puppet's stream record (its `hurt` flag set by a health drop), `mobile`
 *  the sprite unit (its `state`), `now` seconds. Answers the `hurtKnock` for this frame. */
export function puppetHurtStep(p, mobile, now) {
  if (!p) return false;
  if (p.hurt) { p.hurtUntil = now + PUPPET_HURT_HOLD_S; p.hurt = false; }
  if (p.hurtUntil && mobile?.state === 'hurt') p.hurtUntil = 0;   // it is hurting: spent
  return !!p.hurtUntil && now < p.hurtUntil;
}

// ELITE FOES (2026-10-01, Mac: "make those enemies also bigger by 25% and make em glow"): THE GLOW - a per-batch value
// (`batch.eliteGlow`, 0 off, else the pulse 0.55..1 that systems/eliteFoes.js eliteGlow answers) read by both billboard
// shaders beside the hit flash. Two parts: the sprite itself warmed toward a molten gold, and a RIM - the transparent
// texels touching the silhouette (one pixel) drawn as a bright blue edge, so the foe reads as haloed from across a room
// (and, on the Enhanced Lighting lane, the bloom catches it). The rim and the embers above it are drawn in the sprite's own
// quad, which an elite's batch widens (`batch.elitePad`, BB_VS's uElitePad) so a sprite cropped to its frame still has
// room around it: no second draw.
export const ELITE_GLOW_GLSL = `
const vec3 ELITE_GOLD = vec3(1.0, 0.68, 0.16);
const vec3 ELITE_RIM = vec3(0.35, 0.75, 1.0);   // the outline: a bright blue
// EXACT TEXELS (Mac's screenshot, 2026-10-01: thin lines over an elite's corpse): the sprites are MIPMAPPED and wrap
// REPEAT, so a filtered texture() read just past the top edge blended in the opaque BOTTOM row (a body lying on the
// floor is opaque all along it) and drew a line the corpse's width. The outline and the embers now read the base
// level's own texels with texelFetch - no filtering, no mip, no wrap; outside the sprite is empty.
float eliteAlphaAt(sampler2D t, ivec2 p) {
  ivec2 ts = textureSize(t, 0);
  if (p.x < 0 || p.y < 0 || p.x >= ts.x || p.y >= ts.y) return 0.0;
  return texelFetch(t, p, 0).a;
}
// THE OUTLINE'S WIDTH (Mac: "make it like it was before without lines"): every texel within 2 of the silhouette
// (dx*dx + dy*dy <= 4) - the eight round it plus a second texel straight out on each axis, the ~1.5-texel weight
// the filtered reads used to give it, now from exact texels.
float eliteRim(sampler2D t, vec2 uv) {
  ivec2 p = ivec2(floor(uv * vec2(textureSize(t, 0))));
  for (int dy = -2; dy <= 2; dy++) {
    for (int dx = -2; dx <= 2; dx++) {
      if ((dx == 0 && dy == 0) || dx * dx + dy * dy > 4) continue;
      if (eliteAlphaAt(t, p + ivec2(dx, dy)) >= 0.5) return 1.0;
    }
  }
  return 0.0;
}
// THE OUTLINE'S PULSE (Mac: "the outline to have the same effect as yellow just more visible and the max brightness it
// should reach is what we have right now"): it breathes with the body's warmth, on the same pulse (k 0.55..1) but
// deeper - from a dim blue at the pulse's low to the outline's full brightness at its peak, and never past it.
// A corpse's batch is static - nothing writes its pulse each frame - so a NEGATIVE glow carries its phase instead
// (-0.05..-1) and the shader runs the same pulse off the clock (Mac: "corpses need to pulse too").
float eliteRimK(float g, float secs) { return g > 0.0 ? g : 0.775 + 0.225 * sin(secs * 3.2 + (-g) * 6.2831853); }
vec3 eliteRimColor(float k) {
  vec3 full = min(ELITE_RIM * 2.0, vec3(1.0));   // the brightest it reaches: the outline as it was
  float s = clamp((k - 0.55) / 0.45, 0.0, 1.0);
  return full * mix(0.4, 1.0, s);
}
// THE EMBERS (Mac: "make the outline flow into the air a bit ... pixels that fly in the air"): single pixels of the
// outline's colour rising off the top of the silhouette. Each texel column holds at most one ember a cycle; whether it
// burns, how fast it climbs and when it starts are hashes of the column and the cycle, so nothing is stored and nothing
// is sent online. A fragment finds the body under it by scanning down its own column (a transparent elite fragment only).
const float ELITE_RISE = 18.0;   // how high an ember climbs, texels
float eliteHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float eliteEmber(sampler2D t, vec2 uv, float secs) {
  vec2 ts = vec2(textureSize(t, 0));
  vec2 tp = floor(uv * ts);
  // straight up its own column: a sideways sway mapped two columns onto one ember and drew short dashes
  float c = tp.x;
  float d = -1.0;
  for (int i = 1; i <= 18; i++) {
    float y = tp.y - float(i);
    if (y < 0.0) break;
    if (eliteAlphaAt(t, ivec2(int(c), int(y))) >= 0.5) { d = float(i); break; }   // exact texels (see eliteAlphaAt)
  }
  if (d < 3.0) return 0.0;   // nothing below in reach, or this texel is the rim's (2 wide)
  float speed = 5.0 + 7.0 * eliteHash(vec2(c, 1.7));   // texels a second
  float cyc = secs * speed / ELITE_RISE + eliteHash(vec2(c, 9.1));
  float n = floor(cyc);
  if (eliteHash(vec2(c, n + 3.0)) > 0.3) return 0.0;   // most columns rest this cycle
  float h = 3.0 + floor(fract(cyc) * ELITE_RISE);
  if (d != h) return 0.0;
  return 1.0 - fract(cyc);   // fades as it climbs
}
// A NEGATIVE glow is an elite's corpse: the rim alone at |k| - no embers, no gold (systems/eliteFoes.js).
// The body (Mac: "the yellow glow is too much make the enemy glow from normal to a bit yellow"): the pulse runs from
// the sprite's own colours (k at its low, 0.55) to a light yellow warmth (k at 1) - a tint, never a wash.
vec3 eliteGlowLit(vec3 lit, vec3 albedo, float k) {
  if (k <= 0.0) return lit;
  const vec3 LUM = vec3(0.299, 0.587, 0.114);
  float l = dot(albedo, LUM);
  float s = clamp((k - 0.55) / 0.45, 0.0, 1.0);
  return lit * mix(vec3(1.0), vec3(1.10, 1.04, 0.82), s) + ELITE_GOLD * (0.035 * s * l);
}`;

// TELL2 (bible/12-Enhanced-AI/Feud-Arc.md section 4.2; Mac, 2026-10-04: "breath more depth into it"): A WIND-UP'S GLINT
// - a per-batch value (`batch.glint`, [r, g, b, strength] or none) read by both billboard shaders beside the elite glow:
// the sprite's OUTLINE (the elite rim's own texel test, `eliteRim` above) in the blow's colour, and the body lifted
// toward it. A flare as the wind-up begins, a steady rim through it, a rise to full in its last 0.2 s (ai/tells.js
// glintStrength). The batch's quad widens for it as an elite's does (TELL_GLINT_PAD, the vertex shader's floor of two
// texels a side), so the outline has room.
export const GLINT_GLSL = `
vec3 glintRimColor(vec4 g) { return min(g.rgb * (0.55 + 0.75 * g.a), vec3(1.0)); }
vec3 glintLit(vec3 lit, vec3 albedo, vec4 g) {
  if (g.a <= 0.0) return lit;
  const vec3 LUM = vec3(0.299, 0.587, 0.114);
  float l = dot(albedo, LUM);
  vec3 c = g.rgb * max(dot(lit, LUM) * 1.4, 0.35 + 0.8 * l);
  return mix(lit, c, clamp(g.a, 0.0, 1.0) * 0.45);
}`;
/** The pad a glinting batch's quad takes (left, bottom, right, top): any positive pad, and the vertex shader floors it at
 *  two texels a side - the outline's room, never the embers' (a top under 0.1). */
export const TELL_GLINT_PAD = Object.freeze([0.001, 0.001, 0.001, 0.001]);
/** Put a glint on a billboard batch: `g` [r, g, b, strength] or null (written only when it changes). */
export function setBatchGlint(batch, g) {
  if (!batch) return;
  const cur = batch.glint;
  if (!g || !(g[3] > 0)) { if (cur) batch.glint = undefined; return; }
  if (cur && cur[0] === g[0] && cur[1] === g[1] && cur[2] === g[2] && cur[3] === g[3]) return;
  if (cur) { cur[0] = g[0]; cur[1] = g[1]; cur[2] = g[2]; cur[3] = g[3]; return; }   // AUDIT TELL U9: a glint that changes every frame is rewritten in place - no array a frame
  batch.glint = [g[0], g[1], g[2], g[3]];
}
let _reducedAt = -Infinity, _reduced = false;
/** The viewer's reduced motion (`prefers-reduced-motion`), read at most once a second; false where there is no window. */
export function prefersReducedMotion(nowMs = Date.now()) {
  if (nowMs - _reducedAt < 1000) return _reduced;
  _reducedAt = nowMs;
  try { _reduced = !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches; } catch { _reduced = false; }
  return _reduced;
}
