// GROWTH (bible/10-UI/Growth.md) - THE GROWTH LAB: the pause window on its Growth tab, with a made-up character, a
// made-up Firmament book and a made-up captain - no service and no game data - so the tab can be judged on a real
// screen at real sizes and driven by a probe (tools/growthProbe.mjs). Everything but the character, the book and the
// captain is the SHIPPING code: the window, the tab, the guide, the stage and the three windows drawn on it.
//   ?at=level | specs | specs:arcane | specs:martial | firmament | captain   the landing (default: the tab's first)
//   ?owed=1      a level waiting          ?offline=1   no Firmament book (the page says why)
//   ?nocaptain=1 no ships to captain      ?dress=grimoire   the Grimoire skin
import { mountEnhancedMenu } from '../ui/enhanced/enhancedMenu.js';
import { playerEntity } from '../characters/playerEntity.js';
import { SKILLS } from '../systems/skills.js';
import { setFirmamentBook } from '../net/firmament/firmamentBook.js';
import { setFirmamentOnline, setFirmamentTree } from '../systems/firmamentLive.js';
import { starsFor, craftPointsFor } from '../net/firmament/firmamentLaw.js';
import { setHoldingsProvider } from '../ui/holdingsPages.js';
import { createCaptainLedger } from '../systems/naval/captainLedger.js';
import { levelUpScreenFor } from '../ui/charSheetDoor.js';   // the doors' own level-up screen
import { stageFace } from '../ui/growth/growthStage.js';   // the probe's handle on the face
import { CAPTAIN_STARS } from '../systems/naval/captainTree.js';

const q = new URLSearchParams(globalThis.location?.search ?? '');

// THE CHARACTER - the level-up lab's knight (src/tools/levelUpLab.js labEntity - that module mounts itself, so its
// fields are written here), made a spellsword: Long Blade and Archery mastered past 100 (a martial path open),
// Destruction mastered and Restoration at 100 (an arcane path one mastery away)
const e = {
  name: 'Toshley', race: 'Nord', level: 5, pendingLevel: 6,
  career: { name: 'Spellsword', hitPointsPerLevel: 20, primarySkills: [], majorSkills: [], minorSkills: [] },
  stats: { strength: 62, intelligence: 41, willpower: 48, agility: 55, endurance: 58, personality: 44, speed: 51, luck: 47 },
  skills: new Array(35).fill(0).map((_, i) => 8 + ((i * 7 + 13) % 46)),
  skillsRecentlyRaised: [0, 0],
  health: 96, maxHealth: 118, magicka: 40, maxMagicka: 80, fatigue: 64 * 104,
  startingLevelUpSkillSum: 180, currentLevelUpSkillSum: 254, levelProgress: 38, levelRollUp: 6,
  equipment: {}, items: [],
};
e.readyToLevelUp = q.get('owed') === '1';
e.career.primarySkills = [SKILLS.LongBlade, SKILLS.Destruction, SKILLS.Archery];
e.career.majorSkills = [SKILLS.Restoration, SKILLS.Alteration, SKILLS.Axe];
e.career.minorSkills = [SKILLS.Mysticism, SKILLS.Stealth, SKILLS.Illusion, SKILLS.Running, SKILLS.Mercantile, SKILLS.Medical];
Object.assign(e.skills, { [SKILLS.LongBlade]: 132, [SKILLS.Archery]: 112, [SKILLS.Destruction]: 118, [SKILLS.Restoration]: 100, [SKILLS.Alteration]: 76, [SKILLS.Axe]: 64, [SKILLS.Mysticism]: 41, [SKILLS.Illusion]: 38 });
e.masteredSkills = [SKILLS.LongBlade, SKILLS.Archery, SKILLS.Destruction];
e._online = true;
e.isPlayer = true;
Object.assign(playerEntity, e);

// THE FIRMAMENT'S BOOK - the purses the lab's, a confirm kept in this page alone. The page plays online and an accepted
// tree is put in force, as the world host does, so the window's status line says what the game would.
if (q.get('offline') !== '1') {
  let tree = { start: null, nodes: [] };
  const listeners = new Set([() => setFirmamentTree(tree)]);
  setFirmamentOnline(true);
  setFirmamentBook({
    state: { open: true, stars: starsFor(30), craft: craftPointsFor([30, 30, 30, 30, 30, 30, 30, 30, 30, 30]), renown: 30, refund: { freeBelow: 10, perStar: 10 } },
    current: () => tree,
    read: async () => ({ ok: true }),
    onChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    commit: async (next) => { tree = next; for (const fn of listeners) fn(); return { ok: true }; },
    respec: async () => ({ ok: false, error: 'lab' }),
    canRespec: () => false,
  });
}

// THE CAPTAIN - a ledger that has sailed far enough to set a few stars
if (q.get('nocaptain') !== '1') {
  const ledger = createCaptainLedger();
  for (let i = 0; i < 40; i++) ledger.sailed(90000);
  setHoldingsProvider({
    captain: {
      model: () => ({ crowns: [], refusedAt: 0, marque: null, contracts: [], charts: [], log: [], stars: { ...ledger.captain(), set: ledger.tree().length - 1 } }),
      openStars: () => false,
      stars: () => ({ ledger, changed: () => {} }),
    },
  });
}

globalThis.growthFace = stageFace;   // the probe's handles
globalThis.growthStarIds = CAPTAIN_STARS.map((s) => s.id);
const host = document.getElementById('lab');
globalThis.growthLab = mountEnhancedMenu(host, { mode: 'pause', hooks: { ascendScreen: () => levelUpScreenFor(playerEntity) }, onAction: (a) => console.log('[growth lab]', a), at: q.get('at') ?? 'growth' });
