// LA-AUDIT F1 (2026-09-27, the audit before LA's merge; lens F measured it): THE FLICKER PROBE'S VERDICT, WHERE A
// TEST CAN RUN IT. tools/lightFlickerProbe.mjs said OK over a black, frozen scene - world.js clearing the frame black
// and the pose door a no-op, the probe stood at the spawn, never before a tavern, and every pass read 0 - because it
// judged only the still passes' 12-level share, and black and frozen IS still. Its boot wait fell through after 300 s,
// a plan's exception went into a field nothing read, and "street" was reached wherever the boot left the camera. The
// probe's summary and verdict are pure now (pinned in test/la_audit.test.js), and a pass must show what a real one
// does:
//   - every frame it asked for, in its scene's own mode, and no exception from its plan;
//   - a picture: no pass whose brightest frame is black (mean luma under LUM_BLACK);
//   - a walk that moved the eye, a turn that turned it, and a picture that changed with them;
//   - a still camera that moved no more than `stillMax` of the screen by 12 levels in any frame (DISC15's measure);
//   - LA-AUDIT D: no frame the HUD flashed in (a blow's red or BLOOD2e's bleed - lens D traced the LA runs' one-frame
//     blips to the bleed's 0.05 red, a character the night street had mauled) and no health lost: what such a pass
//     moved was not the lighting.
// The walks and turns are otherwise recorded, not judged: honest parallax moves most of a screen, and they are for
// comparing a change against its base.

/** Mean luma (of 255) under which a frame is black - a night street's darkest honest frame reads well above it. */
export const LUM_BLACK = 3;
/** The mode each scene must be in (window.__mode) on every frame of its passes. */
export const SCENE_MODE = Object.freeze({ street: 'exterior', tavern: 'interior', dungeon: 'dungeon' });
/** How far a walk must carry the eye (units) and a turn must turn it (radians) to count as one. */
export const WALK_MIN = 0.1, TURN_MIN = 0.1;

/**
 * One pass's rows (the page's per-frame records, the first frame already dropped) as its summary.
 * @param {string} scene the pass's name, `<scene>-still|walk|turn`
 * @param {Array<any>} rows
 * @param {?string} [err] the plan's exception, if it threw
 */
export function summarize(scene, rows, err = null) {
  const avg = (f) => rows.reduce((a, r) => a + f(r), 0) / Math.max(1, rows.length);
  const max = (f) => rows.reduce((a, r) => Math.max(a, f(r)), 0);
  const c0 = rows[0]?.cam, y0 = rows[0]?.yaw;
  return {
    scene, frames: rows.length,
    msAvg: +avg((r) => r.ms).toFixed(1), msMax: +max((r) => r.ms).toFixed(1),
    c12Avg: +(avg((r) => r.c12) * 100).toFixed(2), c12Max: +(max((r) => r.c12) * 100).toFixed(2),
    c4Avg: +(avg((r) => r.c4) * 100).toFixed(2), c4Max: +(max((r) => r.c4) * 100).toFixed(2),
    flipAvg: +(avg((r) => r.flip) * 100).toFixed(3), flipMax: +(max((r) => r.flip) * 100).toFixed(3),
    lumMax: +max((r) => r.lum ?? 0).toFixed(1),
    drawsAvg: Math.round(avg((r) => r.draws ?? 0)), glAvg: Math.round(avg((r) => r.gl ?? 0)),
    lights: max((r) => r.lights ?? 0),
    churn: rows.reduce((a, r) => a + (r.lIn ?? 0) + (r.lOut ?? 0), 0),
    churnW: +rows.reduce((a, r) => a + (r.lInW ?? 0) + (r.lOutW ?? 0), 0).toFixed(2),   // weighted by each light's share: a faded join is no switch
    lFar: max((r) => r.lFar ?? 0),
    moved: +(c0 ? max((r) => (r.cam ? Math.hypot(r.cam[0] - c0[0], r.cam[1] - c0[1], r.cam[2] - c0[2]) : 0)) : 0).toFixed(2),
    turned: +(y0 != null ? max((r) => (r.yaw != null ? Math.abs(r.yaw - y0) : 0)) : 0).toFixed(2),
    modes: [...new Set(rows.map((r) => r.mode))],
    flashMax: max((r) => r.flash ?? 0),   // LA-AUDIT D
    hpLost: rows.length && rows[0].hp != null ? +Math.max(0, rows[0].hp - Math.min(...rows.map((r) => r.hp ?? rows[0].hp))).toFixed(2) : 0,
    err: err ?? null,
    spikes: rows.filter((r) => r.c12 >= 0.02).map((r) => `${r.k}:${(r.c12 * 100).toFixed(1)}%`),
  };
}

/**
 * THE VERDICT: what failed, one line each - empty when the run stands.
 * @param {{ scenes: string[], all: Array<ReturnType<typeof summarize>>, errors: string[], frames: number, stillMax: number, booted: boolean, streetTavern?: boolean }} run
 */
export function judge({ scenes, all, errors, frames, stillMax, booted, streetTavern = true }) {
  const bad = [];
  if (!booted) bad.push('the world never booted');
  if (scenes.includes('street') && !streetTavern) bad.push('street: no tavern in reach to stand before');
  for (const sc of scenes) if (!all.some((x) => x.scene === `${sc}-still`)) bad.push(`${sc}: never reached`);
  for (const x of all) {
    const kind = x.scene.slice(x.scene.lastIndexOf('-') + 1), sc = x.scene.slice(0, x.scene.lastIndexOf('-'));
    const want = kind === 'still' ? frames - 1 : frames * 2 - 1;
    if (x.frames < want) bad.push(`${x.scene}: ${x.frames} of ${want} frames`);
    if (x.err) bad.push(`${x.scene}: the plan threw - ${x.err}`);
    const mode = SCENE_MODE[sc];
    if (mode && x.modes.some((m) => m !== mode)) bad.push(`${x.scene}: in ${x.modes.join('/')}, not ${mode}`);
    if (x.frames && x.lumMax < LUM_BLACK) bad.push(`${x.scene}: black (brightest frame's mean luma ${x.lumMax})`);
    if (kind === 'still' && x.c12Max > stillMax) bad.push(`${x.scene}: ${x.c12Max}% of the screen moved 12+ levels standing still`);
    if (kind === 'walk' && !(x.moved >= WALK_MIN && x.c4Max > 0)) bad.push(`${x.scene}: the eye did not walk (moved ${x.moved}, the picture ${x.c4Max}%)`);
    if (kind === 'turn' && !(x.turned >= TURN_MIN && x.c4Max > 0)) bad.push(`${x.scene}: the eye did not turn (turned ${x.turned}, the picture ${x.c4Max}%)`);
    if (x.flashMax > 0) bad.push(`${x.scene}: the HUD flashed red (${x.flashMax}) - a blow or a bleed, not the lighting`);
    if (x.hpLost > 0) bad.push(`${x.scene}: the player lost ${x.hpLost} health during the pass`);
  }
  if (errors.length) bad.push(`page errors (${errors.length}): ${errors.slice(0, 3).join(' | ')}`);
  return bad;
}
