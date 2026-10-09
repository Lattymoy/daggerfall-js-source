// @ts-check
// LEGACY2 (2026-10-05, bible/06-Systems/Legacy-Arc.md section 6): THE SPAN AND ARKAY'S TOLL - the Enduring model,
// Mac's "an option that isn't permadeath (not sure how to handle this)".
//
// A death in an Enduring family is not final, and it is not free: it costs YEARS. Every member has an age and a span
// by their race; they are born at a quarter of it, they age as they live (their own clock, LIVED1 - a Daggerfall year
// is twelve months of thirty days), and each death adds a toll - a share of the span (its Features tile: 4%, 6%, 10%). At
// three quarters of the span they are an ELDER; when the span is spent, the next death is their last, and the mantle
// passes as it does in a Bloodline. Roughly a dozen deaths a generation at the Standard toll - so an Enduring line
// still turns, at its own pace.
//
// PURE. The ages are whole years; a person's record keeps `startAge`, `toll` (years taken by deaths), `bornOwn` (the
// character's own clock at their birth or founding) and `lived` (own minutes lived as of their last save).

/** A Daggerfall year in minutes: 12 months x 30 days x 1440 (DaggerfallDateTime's calendar). */
export const YEAR_MINUTES = 12 * 30 * 1440;

/** THE SPAN by race, in years - the lore's long-lived elves, the humans and the beast folk between. */
export const SPANS = Object.freeze({
  Breton: 90, Nord: 90, Redguard: 80, Khajiit: 85, Argonian: 85, WoodElf: 150, DarkElf: 180, HighElf: 200,
});
export const spanOf = (race) => SPANS[race] ?? SPANS.Breton;

/** Born at a quarter of the span (a Redguard of 20, a Breton or a Nord of 23, a high elf of 50 - AUDIT LEGACY III F22) - the age an adult takes the road. */
export const START_SHARE = 0.25;
/** An ELDER from three quarters of the span. */
export const ELDER_SHARE = 0.75;

export const startAgeOf = (race) => Math.round(spanOf(race) * START_SHARE);

/** The years one death takes: a share of the span, never less than one. */
export const tollYears = (race, share) => Math.max(1, Math.round(spanOf(race) * share));

/** A person's age in whole years, given the own minutes they have lived since birth. */
export function ageOf(person, livedMinutes = person?.lived ?? 0) {
  const start = Number.isFinite(person?.startAge) ? person.startAge : startAgeOf(person?.race);
  return start + Math.max(0, person?.toll | 0) + Math.floor(Math.max(0, Number(livedMinutes) || 0) / YEAR_MINUTES);
}

export const isElder = (person, lived) => ageOf(person, lived) >= Math.round(spanOf(person?.race) * ELDER_SHARE);
/** The span is spent: the next death is the last. */
export const isSpent = (person, lived) => ageOf(person, lived) >= spanOf(person?.race);

/**
 * AN ENDURING DEATH. Answers `{ final, years, age }`: a person whose span is already spent dies of their years
 * (`final`); otherwise the toll is taken (mutating `person.toll`) and they rise - and if the toll spends the span, they
 * still rise this once (Arkay grants the last breath; the NEXT death is final), with `final` false and `spent` true.
 */
export function payToll(person, share, lived, { ageless = false } = {}) {
  // AGELESS-CURSE (2026-10-09, the owner: "can you exclude vampires and werewolves of this please?"): the curse in the
  // blood - a vampire's, a werewolf's or a wereboar's - holds Arkay's hand: no years are taken and no span is spent; the
  // cursed always rise. Cured, the toll is theirs again from the next death.
  if (ageless) return { final: false, years: 0, age: ageOf(person, lived), spent: false, ageless: true };
  if (isSpent(person, lived)) return { final: true, years: 0, age: ageOf(person, lived), spent: true };
  const years = tollYears(person?.race, share);
  person.toll = (person.toll | 0) + years;
  return { final: false, years, age: ageOf(person, lived), spent: isSpent(person, lived) };
}

/** The line the rise says about the toll. */
export function tollLine(name, { years, age, spent, ageless = false }) {
  if (ageless) return `The curse in ${name}'s blood keeps Arkay at bay. No years are taken.`;
  const y = `${years} ${years === 1 ? 'year' : 'years'}`;
  if (spent) return `Arkay takes ${y} for the road back. ${name} is ${age}, and Arkay will not grant another.`;
  return `Arkay takes ${y} for the road back. ${name} is ${age}.`;
}
