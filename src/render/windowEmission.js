// Window emission styles. Verbatim constants from Daggerfall Unity's
// MaterialReader (MIT, Daggerfall Workshop): per-style Color32 and intensity;
// the applied emission is color * intensity, exactly
// ChangeWindowEmissionColor. Which (archive, record) pairs are windows comes
// from climateSwaps.isExteriorWindow; the white mask comes from
// BaseImageFile.getWindowColors32 (palette index 0xff marks glass).

export const WINDOW_STYLES = Object.freeze({
  day: { color: [89, 154, 178], intensity: 0.5 },
  night: { color: [255, 182, 56], intensity: 0.8 },
  fog: { color: [117, 117, 117], intensity: 0.5 },
  custom: { color: [200, 0, 200], intensity: 1.0 },
  // AUDIT 26 F001: WindowStyle.Disabled is Color.black OUTRIGHT
  // (MaterialReader.cs:933-935) - not a colour times an intensity, so
  // the zeros here are the literal law rather than a dimming. Every
  // interior mesh is laid out with it (DaggerfallInterior.cs:473 for
  // individual models, :517 for the combined batch, :1270 for action
  // doors), which is why an interior's glass is unlit in DFU and in
  // classic while the port's day/night glow followed the player in.
  disabled: { color: [0, 0, 0], intensity: 0 },
});

/** Style name -> normalized RGB emission (color/255 * intensity). */
export function windowEmissionRGB(style) {
  const s = WINDOW_STYLES[style] || WINDOW_STYLES.day;
  return new Float32Array([
    (s.color[0] / 255) * s.intensity,
    (s.color[1] / 255) * s.intensity,
    (s.color[2] / 255) * s.intensity,
  ]);
}
