// %ltn - MacroHelper.LegalReputation's fourteen bands, the exact C# chain (the > ladder, then the < ladder; "unknown" is
// unreachable and kept as the C# tail). A LEAF, and the ladder's one home: the status box's macro
// (quest/questMacros.js) and REP5's notices of a changed standing (scenes/standingHost.js) read it.
// L10N3d: each band is read through its Internal_Strings key, as LegalReputation's GetLocalizedText does, so it reads
// in the player's language. Its one import is the text core, which imports nothing - still a leaf's reach.
import { localizedText } from './textManager.js';

export function legalStandingWord(rep) {
  if (rep > 80) return localizedText('revered', 'revered');
  if (rep > 60) return localizedText('esteemed', 'esteemed');
  if (rep > 40) return localizedText('honored', 'honored');
  if (rep > 20) return localizedText('admired', 'admired');
  if (rep > 10) return localizedText('respected', 'respected');
  if (rep > 0) return localizedText('dependable', 'dependable');
  if (rep === 0) return localizedText('aCommonCitizen', 'a common citizen');
  if (rep < -80) return localizedText('hated', 'hated');
  if (rep < -60) return localizedText('pondScum', 'pond scum');
  if (rep < -40) return localizedText('aVillain', 'a villain');
  if (rep < -20) return localizedText('aCriminal', 'a criminal');
  if (rep < -10) return localizedText('aScoundrel', 'a scoundrel');
  if (rep < 0) return localizedText('undependable', 'undependable');
  return localizedText('unknown', 'unknown');
}
