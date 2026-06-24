// Curated character trait phrases — gender-aware.
// Each trait is either a plain string (no pronouns) or a function that
// resolves to the correct phrasing for the character's gender.
// The resolved string is what gets stored on the cast row and passed to
// buildPrompt() — so the model always receives grammatically correct copy.

export type CharacterGender = 'man' | 'woman' | 'unspecified'

type TraitEntry = string | ((gender: CharacterGender) => string)

export const TRAIT_ENTRIES: TraitEntry[] = [
  (g) => {
    const pronoun = g === 'woman' ? 'she' : g === 'man' ? 'he' : 'they'
    return `the way ${pronoun} listens before speaking`
  },
  'unbothered, unreadable',
  (g) => {
    const pronoun = g === 'woman' ? 'her' : g === 'man' ? 'his' : 'their'
    return `good with ${pronoun} hands and knows it`
  },
  (g) => {
    if (g === 'woman') return 'says less than she means'
    if (g === 'man')   return 'says less than he means'
    return 'says less than they mean'
  },
  (g) => {
    if (g === 'woman') return 'quietly certain of herself'
    if (g === 'man')   return 'quietly certain of himself'
    return 'quietly self-assured'
  },
  (g) => {
    if (g === 'woman') return 'takes her time'
    if (g === 'man')   return 'takes his time'
    return 'unhurried — takes their time'
  },
  'notices things other people miss',
  (g) => {
    if (g === 'woman') return 'knows exactly what she wants'
    if (g === 'man')   return 'knows exactly what he wants'
    return 'knows exactly what they want'
  },
  'comfortable with silence',
  (g) => {
    if (g === 'woman') return "gentle until she isn't"
    if (g === 'man')   return "gentle until he isn't"
    return "gentle until they aren't"
  },
]

// Resolve a trait entry to a display/prompt string for a given gender.
export function resolveTrait(entry: TraitEntry, gender: CharacterGender): string {
  return typeof entry === 'function' ? entry(gender) : entry
}

// The full resolved list for a given gender — used to render the trait picker.
export function getTraitsForGender(gender: CharacterGender): string[] {
  return TRAIT_ENTRIES.map(e => resolveTrait(e, gender))
}
