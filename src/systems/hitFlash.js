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
