const point = (p) => p?.length === 3 && p.every(Number.isFinite);
export const TRAIL_REACH = 120;
export const TRAIL_REFRESH_MS = 500;
export const TRAIL_PATTERN = Object.freeze({ dash: 0.12, gap: 0.65, half: 0.06, lift: 0.16 });
export const distance3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function leaderTrailTarget({ social, members, entrances, mode, feet }) {
  const leader = social?.party?.leader;
  if (!leader || leader === social.acct || !point(feet)) return null;
  const member = social.others().find((m) => m.acct === leader && m.online !== false);
  if (!member) return null;
  // A transition pose wins over a body waiting for the relay to remove it.
  if (mode === 'exterior' && member.p?.in) {
    const doors = entrances?.(leader)?.filter((m) => point(m.at)) ?? [];
    doors.sort((a, b) => distance3(a.at, feet) - distance3(b.at, feet));
    return doors[0] ? { ...doors[0], leader, key: `${leader}:${doors[0].acct}` } : null;
  }
  const body = members.find((m) => m.acct === leader && m.exact && m.id && point(m.at));
  return body ? { ...body, leader, key: `${leader}:body:${body.id}` } : null;
}

// A short local route limits CPU/geometry work and avoids treating distant map pixels as ground truth.
export function leaderTrailGoal(feet, target, outdoors) {
  if (!point(feet) || !point(target?.at)) return null;
  const d = distance3(feet, target.at);
  if (d <= 2) return null;
  const reach = outdoors ? Math.min(TRAIL_REACH, d - (target.entrance ? 1.5 : 0)) : d;
  if (!outdoors && d > 300) return null;
  return feet.map((v, i) => v + (target.at[i] - v) * reach / d);
}

export function validLeaderRoute(path, feet, goal, outdoors) {
  if (!Array.isArray(path) || path.length < 2 || path.length > 2048 || !path.every(point)) return false;
  // A navmesh snapping to another floor or returning a partial route is not a route to this teammate.
  const near = (a, b) => outdoors ? Math.hypot(a[0] - b[0], a[2] - b[2]) <= 2.5 : distance3(a, b) <= 2.5;
  return near(path[0], feet) && near(path.at(-1), goal);
}

export function clipLeaderRoute(path, max = TRAIL_REACH) {
  const out = [[...path[0]]];
  let remaining = max;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], d = distance3(a, b);
    if (d < 0.001) continue;
    if (d > remaining) {
      out.push(a.map((v, j) => v + (b[j] - v) * remaining / d));
       break;
       }
    out.push([...b]);
       remaining -= d;
    if (remaining <= 0) break;
  }
  return out;
}
