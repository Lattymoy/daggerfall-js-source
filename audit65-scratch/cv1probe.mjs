import { SKILLS, SKILL_NAMES, skillValue, permanentSkillValue } from '/home/user/daggerfall-js-source/src/systems/skills.js';
import { sheetModel } from '/home/user/daggerfall-js-source/src/ui/enhancedCharSheet.js';
import { LYCANTHROPE_SKILL_MOD } from '/home/user/daggerfall-js-source/src/systems/lycanthropy.js';
const e = {
  name: 'W', level: 3, health: 30, maxHealth: 30, stats: {}, career: { primarySkills: [], majorSkills: [], minorSkills: [] },
  skills: Object.fromEntries(SKILL_NAMES.map((_, id) => [id, 45])),
  activeEffects: [{ kind: 'racialOverride', ended: false, skillMods: { [SKILLS.HandToHand]: LYCANTHROPE_SKILL_MOD } }],
};
console.log('permanent H2H =', permanentSkillValue(e, SKILLS.HandToHand));
console.log('live H2H      =', skillValue(e, SKILLS.HandToHand));
const m = sheetModel(e);
console.log('sheetModel.skill(H2H) =', m.skill(SKILLS.HandToHand), '  (the row the enhanced pane prints)');
console.log('sheetModel.handToHandDamage =', JSON.stringify(m.handToHandDamage), ' (computed off the live 75)');
