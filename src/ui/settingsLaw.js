// MENU: what KIND of control each setting gets, and how its value is
// spoken as a word.
//
// THE LAW HALF. Enum value names and their ORDER are DFU's, verbatim
// and cited - a player choosing "Beautiful" is choosing DFU's own
// QualityLevel 4. Ranges are DFU's where DFU states one.
//
// THE RANGE-EQUALS-CLAMP LAW (ours, pinned): a control must never
// offer travel its consumer ignores. MouseLookSensitivity runs to 4.0
// here, not DFU's 16.0, because lookSettings.js:20 clamps at 4.0 -
// and its help says so rather than letting the last three quarters of
// a slider do nothing. Every getter call passes BOTH min and max:
// settings.js clamps with Math.min(max, ...), so a min without a max
// yields NaN.
//
// THE NO-RAW-VALUES LAW: a row never shows an ini string. `True`
// reads `On`; `4` reads `Beautiful`; `0.5` reads `50%`. The raw
// `[Section] Key` appears in exactly one place - the detail dialog -
// for the player who wants it.
import { DEFAULTS, tierOf, UNAVAILABLE } from '../systems/settings.js';
import { READOUT } from './settingsCopy.js';

/** DFU's own value names, in DFU's order. `encode:'index'` means the
 *  store holds the position; `'token'` means it holds the word. */
export const ENUM_LAW = Object.freeze({
  'Video/RandomDungeonTextures': { values: ['Classic', 'Climate', 'Climate Only', 'Random', 'Random Only'], encode: 'index', cite: 'AdvancedSettings:244-252' },
  'Controls/CameraRecoilStrength': { values: ['Off', 'Low', 'Medium', 'High', 'Very High'], encode: 'index', cite: 'AdvancedSettings:244-252' },
  'MeleeAttacks/MeleeAttackDetection': { values: ['Performance', 'Quality'], encode: 'index', cite: 'AdvancedSettings:277-282' },
  'Video/QualityLevel': { values: ['Fastest', 'Fast', 'Simple', 'Good', 'Beautiful', 'Fantastic'], encode: 'index', cite: 'AdvancedSettings:360-379' },
  'Video/MainFilterMode': { values: ['Point', 'Bilinear', 'Trilinear'], encode: 'index', cite: 'AdvancedSettings:360-379' },
  'GUI/GUIFilterMode': { values: ['Point', 'Bilinear', 'Trilinear'], encode: 'index', cite: 'AdvancedSettings:360-379' },
  'GUI/VideoFilterMode': { values: ['Point', 'Bilinear', 'Trilinear'], encode: 'index', cite: 'AdvancedSettings:360-379' },
  'GUI/HelmAndShieldMaterialDisplay': { values: ['Off', 'No Leather Chain', 'No Leather', 'On'], encode: 'index', cite: 'AdvancedSettings:309-321' },
});

/** {min,max,step,coarse,format,source}. format: pct | mult | a unit. */
export const NUMBER_LAW = Object.freeze({
  // AUDIT 28 SELF-AUDIT (F-A1): the key went LIVE in W1 and the screen
  // still showed a dead readout - a number with no stated range stays
  // text, and this one's range IS stated: GetInt(1, 100).
  'GUI/QuestRumorWeight': { min: 1, max: 100, step: 1, coarse: 10, source: 'DFU GetInt(1,100) (SettingsManager:512)' },
  'GUI/ShopQualityHUDDelay': { min: 1, max: 10, step: 1, coarse: 2, format: 'sec', source: 'DFU GetInt(1,10) (SettingsManager:494)' },
  'Controls/SoundVolume': { min: 0, max: 1, step: 0.05, coarse: 0.2, format: 'pct', source: 'DFU DisplayUnits 100 (:268-271)' },
  'Controls/MusicVolume': { min: 0, max: 1, step: 0.05, coarse: 0.2, format: 'pct', source: 'DFU (:272-274)' },
  'Controls/MouseLookSensitivity': { min: 0.1, max: 4.0, step: 0.1, coarse: 1.0, format: 'mult', source: 'the port clamps at 4.0 (lookSettings.js)' },
  'Controls/MouseLookSmoothingFactor': { min: 0, max: 0.9, step: 0.05, coarse: 0.2, format: 'pct', source: 'DFU GetFloat(0,0.9) + SmoothingMax 0.9 (SettingsManager:523, PlayerMouseLook:45)' },   // AUDIT 28 W7: the range is DFU's now, not ours
  'Enhancements/LoiterLimitInHours': { min: 3, max: 12, step: 1, coarse: 3, format: 'hours', source: 'DFU (:342-354)' },
  'Video/FieldOfView': { min: 60, max: 120, step: 5, coarse: 20, format: 'deg', source: 'DFU GetInt(60,120) (SettingsManager:418)' },
  'GUI/ToolTipDelayInSeconds': { min: 0, max: 10, step: 0.5, coarse: 2, format: 'sec', source: 'DFU (:291-297)' },
  'Enhancements/DungeonAmbientLightScale': { min: 0, max: 1, step: 0.05, coarse: 0.2, format: 'pct', source: 'DFU (:333-341)' },
  'Enhancements/NightAmbientLightScale': { min: 0, max: 1, step: 0.05, coarse: 0.2, format: 'pct', source: 'DFU (:333-341)' },
  'Enhancements/PlayerTorchLightScale': { min: 0, max: 1, step: 0.05, coarse: 0.2, format: 'pct', source: 'DFU (:333-341)' },
});

/** RRGGBBAA - the alpha is load-bearing (ToolTipBackgroundColor ships 404040D2). */
export const COLOUR_KEYS = Object.freeze([
  'GUI/ToolTipTextColor', 'GUI/ToolTipBackgroundColor',
  'Map/AutomapTempleColor', 'Map/AutomapShopColor', 'Map/AutomapTavernColor', 'Map/AutomapHouseColor',
  'Map/DunMicMapInnerColor', 'Map/DunMicMapBorderColor',
]);

const isBoolDefault = (v) => v === 'True' || v === 'False';
const isHex8 = (v) => /^[0-9A-F]{8}$/i.test(String(v ?? ''));

/** Total and decidable over all 171 keys - no implementer judgement.
 *  Returns one of: switch | enum | number | colour | text | blocked. */
export function widgetFor(key) {
  if (tierOf(key) === 'unavailable') return 'blocked';
  const [sec, k] = key.split('/');
  const def = DEFAULTS[sec]?.[k];
  if (ENUM_LAW[key]) return 'enum';
  if (NUMBER_LAW[key]) return 'number';
  if (COLOUR_KEYS.includes(key)) return 'colour';
  if (isBoolDefault(def)) return 'switch';
  if (isHex8(def)) return 'colour';
  // A number with no stated range would be a slider whose ends we
  // invented, so it stays a readout rather than a lie.
  return 'text';
}

/** Why an operable-looking control is not operable. */
export function blockedReason(key) {
  return UNAVAILABLE[key] ?? 'not available in this port';
}

const fmtNumber = (n, law) => {
  if (law.format === 'pct') return `${Math.round(n * 100)}%`;
  if (law.format === 'mult') return `x${n.toFixed(1)}`;
  const unit = law.format;
  const shown = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  // F-A1's own find: a law with NO unit (QuestRumorWeight is a bare
  // weight) printed "50 undefined". A bare number reads as itself.
  return unit ? `${shown} ${unit}` : shown;
};

/** The WORD a player reads. Never the raw ini string. */
export function formatValue(key, raw) {
  const w = widgetFor(key);
  if (w === 'switch') return raw === 'True' ? 'On' : 'Off';
  if (w === 'enum') {
    const law = ENUM_LAW[key];
    if (law.encode === 'index') {
      const i = parseInt(raw, 10);
      return Number.isInteger(i) && law.values[i] !== undefined ? law.values[i] : String(raw ?? '');
    }
    return law.values.includes(raw) ? raw : String(raw ?? '');
  }
  if (w === 'number') {
    const law = NUMBER_LAW[key];
    const n = Number(raw);
    // MERGE AUDIT (the launcher's own finding, carried into the screen
    // that replaced it): show the value IN EFFECT, not the stored one.
    // The consumer's getFloat/getInt clamps to this same range, so a
    // store holding 2 for SoundVolume is a bus running 1 - printing
    // "200%" would be a row describing a volume nobody can hear. The
    // launcher could MINT such a value by stepping; stepValue cannot,
    // but an older build's store or a hand-edited delta still can.
    const eff = Math.min(law.max, Math.max(law.min, n));
    return Number.isFinite(n) ? fmtNumber(eff, law) : String(raw ?? '');
  }
  if (w === 'blocked') return READOUT[key] ?? 'not here';   // never the stored value: EnhancedCombatAI holds True while the port runs the classic path
  if (w === 'colour') return String(raw ?? '').toUpperCase();
  const s = String(raw ?? '');
  return s === '' ? 'default' : s;   // DFU's own substitution for an empty SoundFont (:264-267)
}

/** The next value in a direction. Returns the STRING the store holds,
 *  or null when the control cannot move. */
export function stepValue(key, raw, dir, coarse = false) {
  const w = widgetFor(key);
  if (w === 'switch') return raw === 'True' ? 'False' : 'True';
  if (w === 'enum') {
    const law = ENUM_LAW[key];
    const n = law.values.length;
    if (law.encode === 'index') {
      const i = parseInt(raw, 10);
      const cur = Number.isInteger(i) && i >= 0 && i < n ? i : 0;
      return String((cur + dir + n) % n);
    }
    const cur = Math.max(0, law.values.indexOf(raw));
    return law.values[(cur + dir + n) % n];
  }
  if (w === 'number') {
    const law = NUMBER_LAW[key];
    const stepBy = coarse ? law.coarse : law.step;
    const cur = Number.isFinite(Number(raw)) ? Number(raw) : law.min;
    let next = cur + dir * stepBy;
    next = Math.min(law.max, Math.max(law.min, next));
    // keep the stored string clean: 0.05 steps must not print 0.15000000000000002
    const dp = String(law.step).includes('.') ? String(law.step).split('.')[1].length : 0;
    return dp ? String(Number(next.toFixed(dp))) : String(Math.round(next));
  }
  return null;   // colour and text are edited in a dialog, not stepped
}
