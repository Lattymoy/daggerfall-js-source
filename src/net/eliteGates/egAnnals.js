// @ts-check
// EG-FULL, LAYER THREE (2026-10-11, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 3 and
// 11.10): THE ANNALS OF 3E 398 - thirty pages the Battlemages left in the torn halls, each two sentences, the port's own
// and never against the canon of section 3. The first seventeen wait behind the halls' false walls and past their hard
// jumps (an alcove holding a page - net/eliteGates/egFragLaw.js); the last thirteen are the lords', each added at that lord's first
// fall. A breach keeps the pages its members find (net/eliteGates/egBrain.js - `egot` 'page'); a Redoubt's panel reads them.
//
// Pure data. Not a DFU member. Ledger A (ELITE-GATES).

/** The pages, in their order: `[title, text]`. */
export const EG_ANNALS = Object.freeze([
  Object.freeze(['The Apprentice\'s Ledger', 'Third watch, and the slipstream hums wrong. The masters say it is the Weir settling; I have never heard a gate settle like a held breath.']),
  Object.freeze(['A Battlemage at the Barricade', 'We stacked the lecterns across the Galleries and held them for an hour. If you read this, the hour was worth it, and you are standing where I fell.']),
  Object.freeze(['The Secretary\'s Surrender', 'I gave them the portal keys because they promised the novices would live. They lied, and the keys are still out there, every one of them a door I opened.']),
  Object.freeze(['Orrery Notes', 'The stones answer the true hours and nothing else. When the frays come, slow down and turn surer.']),
  Object.freeze(['The Quartermaster\'s Count', 'Seventy staves, forty wands, nine rings of warding, and none of it enough. Leave the empty racks; let the Kyn wonder what we carried away.']),
  Object.freeze(['On the Falling Halls', 'The links are breaking and the wings go with them, whole rooms tearing loose into the void. Whatever falls, falls back along their road.']),
  Object.freeze(['A Note Pinned in the Stacks', 'The shelves fall in order, east to west, every time. Count three after the first and run.']),
  Object.freeze(['The Warden of the Caverns', 'Fire falls where the old tubes run, two breaths burning and three breaths out. The Deadlands keep better time than our bell-tower ever did.']),
  Object.freeze(['From the Soul Cairn', 'The wisps here drink from anyone who stands still. Keep moving, and they lose interest, like the masters at lecture.']),
  Object.freeze(['The Mist Stair', 'The mist hides the drop, never the step. Trust the gold at your feet and not the dark below it.']),
  Object.freeze(['A Shadow\'s Lesson', 'In the Shade the branches hold only under the moon. We learned to walk with the light, and the ones who ran ahead of it are not writing notes.']),
  Object.freeze(['The Eclipse', 'When the moon goes out in the Vault, stand in what light is left. The shafts walk slowly; walk with them.']),
  Object.freeze(['Forge-Talk', 'Every hammer in the Wellhead tells you where it will fall before it falls. The Kyn call this honor; I call it a timetable.']),
  Object.freeze(['The Clan Pit', 'They called me into the ring alone and I went alone. The crowd threw silver; had another stepped in, they would have thrown fire.']),
  Object.freeze(['A Redoubt Taken Back', 'We lit the lamps again in the north Redoubt, if only for a night. Anyone who comes after will find a little of us there.']),
  Object.freeze(['The Last Lesson', 'If the Spire falls, the lessons stay in the stone. Take what we left; it was always meant for whoever stood up next.']),
  Object.freeze(['An Apprentice Again', 'They say one of us drove them out. I hope it was the quiet one from the back row, who always finished the Orrery first.']),
  // the lords' own, at each one's first fall
  Object.freeze(['Grath, the Hound', 'The Hound was loosed from the Wellhead\'s arena to hold the Galleries, and it never learned to stop hunting. Lead it across cracking stone and it burns its own feet.']),
  Object.freeze(['The Last Spellmaster', 'Our Spellmaster taught the Examination for forty years. The Kyn raised him, and he still marks every answer.']),
  Object.freeze(['The Last Armsmaster', 'He would duel anyone, any hour, and laugh when he lost. Dead, he still answers a challenge before it is spoken.']),
  Object.freeze(['Valkynaz Ilthys', 'Ilthys held the Galleries for Dagon and called it a kindness to the dead. The keys she carries were ours.']),
  Object.freeze(['The Cairn-Keeper', 'The Keeper takes a tithe of every soul that passes the Cairn. Lay yours in the gems, or it will lay you there.']),
  Object.freeze(['The Twin Lords', 'Two Kyn who shared a Court and a grudge. Fell one, and the other remembers for fifteen breaths.']),
  Object.freeze(['Valkynaz Morvayn', 'Morvayn bound the Soul Cairn\'s gates with his own chains. They are still warm.']),
  Object.freeze(['The Dusk-Warden', 'Nocturnal\'s pocket of night took a warden from the Kyn, and kept her. She guards the dark as if it were hers.']),
  Object.freeze(['The Night-Stalker', 'It vanishes and returns where you are not looking. Stand together, and there is nowhere left to return to.']),
  Object.freeze(['Valkynaz Seyth', 'Seyth hunted the Shade Perilous for anyone who fled the Spire. Few did; none of them got far.']),
  Object.freeze(['The Colossus', 'The forges of the Wellhead built it to carry Dagon\'s banners into the Spire. Its rails still run the old route.']),
  Object.freeze(['The Wyrm', 'It perches on the burning pillars and watches the Kyn fight below. Drag it down, and it fights like one of them.']),
  Object.freeze(['Valkynaz Garoth', 'Garoth holds the Wellhead for the Prince who sent him, and has never once looked back at the door. The road ends where he stands, and goes on beneath him.']),
]);
/** How many pages wait behind the false walls (the first `EG_ANNALS_FOUND`), and the lords' (the rest, by lord). */
export const EG_ANNALS_FOUND = 17;
/** The lords whose first fall adds a page, in the Annals' order (net/eliteGates/egLords.js EG_BOSS_KEYS' thirteen lords). */
export const EG_ANNALS_LORDS = Object.freeze(['hound', 'spellmaster', 'armsmaster', 'ilthys', 'cairnkeeper', 'twins', 'morvayn', 'dusk', 'stalker', 'seyth', 'colossus', 'wyrm', 'garoth']);
/** A lord's page (its index in EG_ANNALS), or -1. */
export const egAnnalsLordPage = (key) => { const i = EG_ANNALS_LORDS.indexOf(key); return i < 0 ? -1 : EG_ANNALS_FOUND + i; };
/** The next found page a member's bits lack (bit `p` set for page `p`), from `from` on, round; -1 when all are held. */
export function egAnnalsNext(bits, from = 0) {
  for (let k = 0; k < EG_ANNALS_FOUND; k++) { const p = (from + k) % EG_ANNALS_FOUND; if (!(bits & (1 << p))) return p; }
  return -1;
}
