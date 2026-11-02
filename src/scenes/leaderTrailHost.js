import { PartyPingDraw } from '../render/partyPingDraw.js';
import { leaderTrailGoal, validLeaderRoute, clipLeaderRoute, distance3, TRAIL_REFRESH_MS, TRAIL_PATTERN } from '../systems/party/leaderTrail.js';

export function createLeaderTrailHost({ route, now = () => performance.now(), makeDraw = (gl) => new PartyPingDraw(gl) }) {
  let pass = null, path = null, key = '', at = -Infinity, previous = null, failed = false;
  const clear = () => { path = null; key = ''; at = -Infinity; previous = null; };
  return {
    clear,
    lost() { pass = null; failed = false; clear(); },
    frame(renderer, target, feet, scene, origin, outdoors, options) {
      if (!options.leaderTrail || !target) { clear(); return; }
      const nextKey = `${scene}|${origin?.join(',') ?? ''}|${target.key}`;
      if (key !== nextKey || (previous && distance3(previous, target.at) > 20)) { clear(); key = nextKey; }
      const goal = leaderTrailGoal(feet, target, outdoors);
      if (!goal) { clear(); return; }
      const time = now();
      if (time < at || time - at >= TRAIL_REFRESH_MS) {
        at = time; previous = [...target.at]; path = null;
        try {
          const pts = route?.(goal);
          if (validLeaderRoute(pts, feet, goal, outdoors)) path = clipLeaderRoute(pts);
        } catch { /* Missing terrain/navmesh: retain the direction marker, never guess a line. */ }
      }
      if (!path || failed) return;
      try {
        if (renderer.gl.isContextLost()) { this.lost(); return; }
        pass ??= makeDraw(renderer.gl);
        pass.draw(renderer, [], [{ pts: path, color: [0.4, 0.9, 0.65], alpha: options.trailAlpha, pattern: TRAIL_PATTERN }]);
      } catch (error) { failed = true; console.warn('[leader trail] Drawing unavailable:', error); }
    },
    dispose() { clear(); pass?.dispose(); pass = null; failed = false; },
  };
}
