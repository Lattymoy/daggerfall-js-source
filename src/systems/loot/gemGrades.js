// @ts-check
// ═══════════════════════════════════════════════════════════════════
// GEM-GRADES (2026-10-25, CLOTH-GEMS; the player SaberGGaming's "Profession
// oversights", the owner: "No band aids") - A GEM'S KIND AND GRADE, THE
// ONE HOME. DFU's eight gems are the plain grade; the port's four others
// of each - Chipped, Flawed, Flawless, Perfect - are its rows 1900-1931
// (bible/06-Systems/Gem-Sockets.md section 4, GEM2). These lived in
// systems/loot/lootRarity.js (the ids, the grades, the templates) and
// systems/gems.js (the grade's price), and the jeweller's bench now reads
// them too: a graded gem is set at it, its points the grade's own
// (net/recipeLaw.js), and the account service decides that craft by the
// same law. lootRarity.js and gems.js re-export every name here, so no
// reader of them moved. A leaf: no imports, nothing at import but data,
// so the pure laws both ends read (net/professionLaw.js) may read it.
// ═══════════════════════════════════════════════════════════════════

/** DFU's eight gems - the KINDS - in their templates' order (the Gems group, 0..7). */
export const GEM_IDS = Object.freeze(['ruby', 'emerald', 'sapphire', 'diamond', 'jade', 'turquoise', 'malachite', 'amber']);
/** Each kind's name, DFU's own (its template's). */
export const GEM_KIND_NAMES = Object.freeze({ ruby: 'Ruby', emerald: 'Emerald', sapphire: 'Sapphire', diamond: 'Diamond', jade: 'Jade', turquoise: 'Turquoise', malachite: 'Malachite', amber: 'Amber' });
/** GEM2 (bible/06-Systems/Gem-Sockets.md section 4): A GEM'S GRADE, poorest first. 'plain' is DFU's own gem; the four
 *  others are the port's rows (GEM_GRADE_TEMPLATE_BASE). */
export const GEM_GRADES = Object.freeze(['chipped', 'flawed', 'plain', 'flawless', 'perfect']);
export const GEM_GRADE_WORDS = Object.freeze({ chipped: 'Chipped', flawed: 'Flawed', plain: '', flawless: 'Flawless', perfect: 'Perfect' });
/** The grades the port's rows carry, in their rows' order. */
export const GEM_ROW_GRADES = Object.freeze(['chipped', 'flawed', 'flawless', 'perfect']);
/** GEM2: the port's first graded row - kind `k` (GEM_IDS' order) at row grade `g` (GEM_ROW_GRADES' order) is
 *  GEM_GRADE_TEMPLATE_BASE + g * 8 + k: 1900 a Chipped Ruby, 1931 a Perfect Amber (systems/gems.js registers them). */
export const GEM_GRADE_TEMPLATE_BASE = 1900;
export const GEM_GRADE_TEMPLATES = Object.freeze(GEM_ROW_GRADES.flatMap((_, g) => GEM_IDS.map((__, k) => GEM_GRADE_TEMPLATE_BASE + g * GEM_IDS.length + k)));
/** A gem's id: its kind alone for DFU's own (LOOT20's ids - 'ruby'), else grade-kind ('flawless-ruby'). */
export const gemId = (kind, grade = 'plain') => (grade === 'plain' ? kind : `${grade}-${kind}`);
/** Every gem's id - DFU's eight, then the port's thirty-two in their rows' order. */
export const ALL_GEM_IDS = Object.freeze([...GEM_IDS, ...GEM_ROW_GRADES.flatMap((g) => GEM_IDS.map((k) => gemId(k, g)))]);
export const isGemId = (id) => typeof id === 'string' && ALL_GEM_IDS.includes(id);
/** A gem id's kind ('ruby') and grade ('flawless'); null for anything else. */
export const gemKind = (id) => (isGemId(id) ? id.slice(id.indexOf('-') + 1) : null);
export const gemGrade = (id) => (!isGemId(id) ? null : id.includes('-') ? id.slice(0, id.indexOf('-')) : 'plain');
/** Every gem's name: "Ruby", "Flawless Ruby". */
export const GEM_NAMES = Object.freeze(Object.fromEntries(ALL_GEM_IDS.map((id) => [id, `${GEM_GRADE_WORDS[gemGrade(id)]} ${GEM_KIND_NAMES[gemKind(id)]}`.trim()])));
/** GEM2: the template a gem id is minted on - DFU's own for a plain gem, the port's row for a graded one; null for none. */
export const gemTemplateOf = (id) => (!isGemId(id) ? null : id.includes('-') ? GEM_GRADE_TEMPLATES[ALL_GEM_IDS.indexOf(id) - GEM_IDS.length] : GEM_IDS.indexOf(id));

/** A graded row's price and rarity against its kind's DFU row: a Chipped stone a quarter of a Ruby's price, a Perfect
 *  one four times. The item maker's points stay the kind's own (a grade is a socket's line, never an enchanting base) -
 *  CLOTH-GEMS: and the jeweller's share a set gem adds is this ladder over the plain gem's (net/recipeLaw.js
 *  gemPointsPct): chipped and flawed below it, flawless and perfect above. */
export const GEM_GRADE_PRICE = Object.freeze({ chipped: 0.25, flawed: 0.5, plain: 1, flawless: 2, perfect: 4 });
/** A graded row's price off its kind's DFU price (gems.js GEM_GRADE_ROWS' column; net/professionLaw.js's tier band of it):
 *  the ladder's share, rounded, never under one gold. */
export const gradedGemPrice = (basePrice, grade) => Math.max(1, Math.round(basePrice * (GEM_GRADE_PRICE[grade] ?? 1)));
