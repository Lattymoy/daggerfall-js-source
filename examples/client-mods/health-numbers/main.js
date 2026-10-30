// Uses the existing enhanced health bar's font, placement and UI-lock behavior.
export default function initialize(api) {
  return api.hud.formatHealth(({ current, maximum }) => `${Math.ceil(current)}/${Math.ceil(maximum)}`);
}
