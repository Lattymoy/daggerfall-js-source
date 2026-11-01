export function partyDistanceText(metres, exact = true) {
  if (!Number.isFinite(metres) || metres < 0) return '';
  return `${exact ? '' : '~'}${metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${Math.round(metres)} m`}`;
}
// Compact elevation hint; unknown/same-level targets have no direction.
export function partyElevationArrow(dy, enabled = true) {
  return enabled && Number.isFinite(dy) && Math.abs(dy) > 3 ? (dy > 0 ? '\u2191' : '\u2193') : '';
}
