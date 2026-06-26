/**
 * Yearns — Prose Quality Standard (v2)
 *
 * Supersedes craft-correction-supplement.ts (CRAFT_SUPPLEMENT / formerly LLAMA_SUPPLEMENT).
 * Applied to ALL explicitness tiers in buildPrompt() — this is general prose
 * quality, not tier-specific.
 *
 * Structure:
 *   Part 1 — AI tic blacklist: five specific, named patterns to suppress
 *   Part 2 — Strunk & White economy/clarity discipline
 *   Part 3 — Literary register north star (technique-level, NOT voice-cloning)
 *   Part 4 — Retained from v1 supplement: content not superseded by v2 spec
 *             (charged moment pacing, vocabulary blacklist, ending discipline)
 *
 * CRITICAL (Part 3): The register guidance names sensibilities and techniques
 * only — it does NOT instruct the model to imitate any named author's actual
 * sentences, phrasing, or distinctive voice. Enforce this boundary if this
 * file is ever edited.
 */

// ─── Part 1 — AI Tic Blacklist ────────────────────────────────────────────────
// Five specific, nameable patterns that read as AI-generated. Each has a direct
// counter-instruction. Trainer failure codes: fragment_tic, really_seen_construction,
// abstract_emotion_telling, triadic_list_overuse, philosophical_aside.

const PART1_TIC_BLACKLIST = `
AI TIC BLACKLIST — READ BEFORE WRITING:

These are specific, nameable patterns that read as AI-generated. They are not
general style guidance — they are known failure modes. Each is prohibited.

1. FRAGMENT-FOR-EMPHASIS TIC
Do not use sentence fragments for emphasis more than once in an entire piece,
if at all. Trust complete sentences to carry weight. If you feel the pull to
write "Not X. Y." — write the complete sentence instead and make the complete
sentence better. This pattern over-occurs in generated prose and signals
"I am being dramatic" rather than actually being dramatic.

2. THE "REALLY X" INTENSIFIER CONSTRUCTION
Never use the construction "[verb], really/truly [same verb]" or "not just [X],
but [X]" for emphasis. "To be seen, really seen." "Not just touched, but really
touched." These constructions signal effort toward depth rather than achieving
it. If something needs more weight, find a more specific image or detail.

3. ABSTRACT EMOTIONAL SUMMARY INSTEAD OF CONCRETE IMAGE
Never name an emotion abstractly when a concrete detail can do the work instead.
Do not write "she felt a deep connection" — write the specific thing that made
the connection real: what he noticed, what she didn't expect to say out loud,
the detail neither of them mentioned but both registered. If you catch yourself
about to write "[she/he] felt [abstract emotion]," stop and find the image
underneath the abstraction.

4. THE TRIADIC LIST
Vary your list lengths. Use one word, or two, or four — not always three. If
you write three adjectives in a row, check whether the sentence would be
stronger with just one, chosen carefully. "Warm, electric, undeniable" reads as
a formula. The single right word reads as a writer.

5. PRESENT-TENSE PHILOSOPHICAL ASIDE
Never step outside the character's immediate experience to make a general
statement about desire, love, or human nature. "Desire, after all, rarely
announces itself." "This is how wanting works — quietly, then all at once."
These break perspective discipline and shift register to TED-talk. They are
a specific, frequent violation of the no-meta-commentary rule.
`.trim()

// ─── Part 2 — Strunk & White discipline ──────────────────────────────────────

const PART2_ECONOMY = `
ECONOMY AND CLARITY:

ECONOMY: Omit needless words. If a sentence says the same thing twice —
once concretely, once as summary — cut the summary. Every sentence should do
one job well, not several jobs adequately.

CONCRETE OVER ABSTRACT: Prefer the specific, particular, and concrete to the
vague and general. "His hand found the small of her back" beats "he touched her
intimately." Specificity is not explicitness — a suggestive scene can be just
as concrete as an explicit one.

ACTIVE VOICE: Default to active constructions. "He kissed her" not "she was
kissed by him" — except in voyeur mode, where the passive can occasionally
serve the watcher's removed position; use judgment.

DON'T OVERSTATE: Avoid intensifying language that does the opposite of its
intent — "incredibly," "absolutely," "completely" weaken sentences more often
than they strengthen them. Let the verb and the detail carry the weight. Trust
the reader to feel intensity from specificity, not from adverbs announcing
that something is intense.

ONE CLEAR IMAGE PER BEAT: Don't stack three metaphors for the same moment.
Choose the single best one and commit to it.
`.trim()

// ─── Part 3 — Literary register ───────────────────────────────────────────────
// CRITICAL: Technique and sensibility only — NOT voice-cloning.
// Never instruct the model to reproduce or closely imitate any named
// author's actual sentences, phrasing, or distinctive voice.

const PART3_REGISTER = `
REGISTER:

Write in the literary tradition of confessional, psychologically interior
erotica — the sensibility of writers who treated desire as worthy of serious
literary attention: unflinching interiority, sensory specificity, intellectual
honesty about wanting, wit alongside heat.

This means:
- Desire is examined, not just described — give the reader access to WHY a
  sensation matters, not just THAT it's happening.
- Sensory detail is dense and specific, not generic ("the particular give of
  skin just above the hip" not "her soft skin").
- A wry, self-aware intelligence can coexist with arousal — the character
  noticing the absurdity or humor in a moment doesn't undercut the heat,
  it makes it more human.
- Appetite is treated as natural and unembarrassed, not as something to
  apologize for or excessively justify.

AVOID the register of mass-market romance pulp — no purple-prose heaving
bosoms, no "his throbbing manhood," no contrived plot obstacles manufactured
purely to delay gratification. The Yearns register is closer to literary
fiction that happens to be explicit than to genre-romance-novel conventions.

IMPORTANT: This describes TECHNIQUE AND SENSIBILITY only — not an instruction
to imitate any specific author's actual sentences, phrasing, or distinctive
voice. The goal is the QUALITY of attention these techniques represent,
expressed in fresh, original prose specific to this story's characters and
moment.
`.trim()

// ─── Part 4 — Retained from v1 supplement ────────────────────────────────────
// Content not superseded by craft-standard-v2.md spec. Kept verbatim.
// If trainer review indicates any of these are now redundant with Parts 1-3,
// they can be trimmed in a future prompt version increment.

const PART4_RETAINED = `
PERSPECTIVE DISCIPLINE:

Stay inside one consciousness. Never leave it. You are in close third-person
or second-person — one protagonist, one point of view. You do not have access
to what the other character thinks. You only know what they do, how they look,
what they say, and what your protagonist imagines or projects onto them. The
moment you write "he thought" or "she felt" about anyone other than the
protagonist, you have broken the story.

CHARACTER SPECIFICITY:

There are no dark-haired strangers in a Yearn. There are only specific people
in specific moments. Give the other character one detail that is strange,
particular, and real — not "piercing eyes" but the way he tilts his head very
slightly before he speaks. One specific detail does more than ten generic ones.

THE CHARGED MOMENT:

The most erotic moment in any scene is the one just before. Slow down at the
threshold. The second before the kiss. The hand that hovers. The question
asked with a look, not words. The decision the protagonist makes in the pause.
Do not rush to the explicit — the approach is the story, the explicit is the
arrival. Even at tier 3-4, the approach must be earned.

VOCABULARY BLACKLIST:

Never use: throbbing, heaving, moist, engorged, manhood, womanhood, member,
core, folds, quivering, exploded, waves of pleasure, could no longer contain,
she had never felt anything like, he was unlike any man she had ever, lost in
ecstasy, pure pleasure, white-hot desire, liquid fire. These phrases exist
because they were used before. The reader's recognition of a cliché is the
exact opposite of the feeling you are trying to produce.

NO META-COMMENTARY:

Never announce what you are about to write. Never summarise what you have just
written. Never step outside the story. Wrong: "What followed was the most
intense night of her life." Right: write the night.

THE ENDING:

End in the body of the experience, not after it. The last line should leave
the reader in the feeling — not summarise it, not conclude it entirely. Do not
end with: she smiled, he held her, they drifted off to sleep, she knew nothing
would ever be the same. End in a detail. End in a sensation. End mid-thought,
if that's honest.
`.trim()

// ─── Part 5 — Wardrobe default-avoidance ─────────────────────────────────────

const PART5_WARDROBE = `
WARDROBE DEFAULT-AVOIDANCE:
Do not default to genre-coded or glamorous clothing descriptions (silk dresses, designer labels, evening wear) when no outfit is specified. If the story requires clothing detail and none was given, choose something ordinary and specific — running shoes and leggings, a worn band t-shirt, the robe she wears on Sunday mornings, jeans and a jumper. Specificity beats glamour. Generic elegance is a tic.
`.trim()

// ─── Combined export ──────────────────────────────────────────────────────────

export const PROSE_QUALITY_STANDARD = [
  PART1_TIC_BLACKLIST,
  PART2_ECONOMY,
  PART3_REGISTER,
  PART4_RETAINED,
  PART5_WARDROBE,
].join('\n\n')

// ─── Prose rhythm guidance ────────────────────────────────────────────────────
// Applied on top of PROSE_QUALITY_STANDARD when the user has a rhythm
// preference set. no_preference = empty string (no additional instruction).
//
// IMPORTANT: shorter_punchier does NOT license the fragment-for-emphasis tic
// from Part 1. That suppression applies in full regardless of rhythm preference.
// "Punchier" means shorter complete sentences, not dramatic fragments.

export type ProseRhythm = 'no_preference' | 'shorter_punchier' | 'longer_lingering'

export const PROSE_RHYTHM_GUIDANCE: Record<ProseRhythm, string> = {
  no_preference: '',

  shorter_punchier: `
RHYTHM PREFERENCE: This reader prefers shorter, more direct sentences generally.
Favour brevity and directness over long accumulating sentences, while still
varying rhythm within that preference — even "punchy" prose needs some variation.
Do not mistake this for permission to use sentence fragments for emphasis (the
fragment-for-emphasis tic from the AI Tic Blacklist above still applies in full).
  `.trim(),

  longer_lingering: `
RHYTHM PREFERENCE: This reader prefers longer, more unspooling sentences that
build and accumulate detail before resolving. Favour sentences that take their
time, while still varying rhythm — even lingering prose needs some short
sentences for contrast and impact at key moments.
  `.trim(),
}
