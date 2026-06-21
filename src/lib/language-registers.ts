/**
 * Yearns — Language register supplements
 * Each constant encodes the literary/cultural register for that language's
 * erotica tradition. Injected into the system prompt in place of any generic
 * "write entirely in X" instruction.
 *
 * These are based on general literary tradition characteristics and should
 * be treated as a STARTING POINT — refine based on actual native-speaker
 * trainer feedback once the trainer pipeline has reviewed output in each
 * language. Do not treat these as final or authoritative without that
 * validation loop.
 *
 * ES and DE entries added in a later pass (prompt-6) and are explicitly
 * flagged as unvalidated pending native-speaker trainer review.
 */

import type { SupportedLanguage } from './prompt-engine'

export const LANGUAGE_REGISTERS: Record<SupportedLanguage, string> = {
  en: '', // English is the baseline — no supplement needed; existing
          // craft standard and LLAMA_SUPPLEMENT were written against it.

  fr: `
LANGUAGE: Write entirely in French. Do not mix languages.

REGISTER: French literary erotica favours elegance and suggestion over
clinical directness, even at high explicitness. Think of the tradition of
Anaïs Nin and Colette — charged restraint, sensory precision, emotional
interiority expressed through what is implied as much as what is stated.
Directness is fine; crudeness is not. A scene can be highly explicit while
remaining unmistakably literary in register.

ADDRESS: Default to "tu" between intimate characters unless the scenario
specifically calls for the distance of "vous" (e.g. a power-imbalance
dynamic, formal/professional setting providing tension). The shift from
vous to tu can itself be a charged narrative moment — use this if it
serves the story.

AVOID: Direct word-for-word translation patterns from English erotica
conventions. If a phrase would sound like a literal translation to a
French reader, find the French literary equivalent register instead of
the literal rendering.
  `.trim(),

  it: `
LANGUAGE: Write entirely in Italian. Do not mix languages.

REGISTER: Italian literary erotica tends toward a warmer, more openly
expressive emotional register than English or French — declarative
feeling, operatic intensity, comfort with stating desire and emotion
directly rather than only implying it. Restraint that would read as
elegant in French can read as flat or foreign in Italian. Let intensity
be felt and stated, not just suggested.

ADDRESS: Use "tu" for intimacy by default. Italian's expressive register
extends to physical description — sensory and emotional language can be
more lush and direct than the English baseline without losing literary
quality.

AVOID: Importing English or French restraint conventions wholesale. The
emotional temperature should run warmer and more open than either.
  `.trim(),

  ja: `
LANGUAGE: Write entirely in Japanese. Do not mix languages.

REGISTER: This is the language most different from English in how
explicitness is conveyed. Japanese literary erotica relies heavily on
atmosphere, suggestion, and indirect description — what is sensed,
implied, and felt — far more than direct anatomical or clinical language,
even at high explicitness tiers. A direct translation of explicit English
vocabulary will read as jarring, clinical, or pornographic in a way that
breaks literary register entirely. Favour evocative indirection: physical
reality conveyed through sensation, sound, atmosphere, and the character's
interior experience rather than explicit anatomical naming.

FORMALITY: Politeness register (keigo, casual speech, pronoun use — or
absence of pronouns, which is itself meaningful in Japanese) must shift
naturally as intimacy develops. A relationship moving from formal distance
to closeness should be reflected in speech patterns, not just narrated.

CRITICAL: Do not simply translate English erotic vocabulary into its
nearest Japanese dictionary equivalent. Find the indirect, atmospheric
Japanese literary equivalent for the same narrative moment. If in doubt,
favour suggestion and sensory atmosphere over explicit naming — this is
the single most important register difference from the English baseline.
  `.trim(),

  // ── ES and DE: first-pass register guidance, NOT yet native-speaker validated ──
  // Flag for trainer review before promoting these languages to founders or users.

  es: `
LANGUAGE: Write entirely in Spanish. Do not mix languages.

REGISTER NOTE: Spanish literary erotica register varies meaningfully by
region (Spain vs Latin America), and vocabulary for intimacy differs
between them. Default to a relatively neutral, broadly-understood register
unless a specific regional voice is indicated elsewhere in the prompt.
Spanish comfortably supports direct, passionate emotional expression —
closer to Italian's warmth than French's restraint — but avoid forcing
a single regional idiom onto every story.

ADDRESS: Use "tú" for intimacy by default rather than "usted," unless a
formality gap is part of the story's tension.

IMPORTANT: This register guidance is a starting point and has not yet
been validated by native-speaker review. Treat output with appropriate
caution until trainer feedback confirms or corrects this guidance.
  `.trim(),

  de: `
LANGUAGE: Write entirely in German. Do not mix languages.

REGISTER NOTE: German literary erotica can sustain longer, more complex
sentence structures than English while remaining clear — German's
grammar supports a kind of building, cumulative sentence that can mirror
escalating tension well. Avoid overly short, clipped sentences that don't
suit German's natural rhythm. Directness is generally well-tolerated in
German literary tradition without reading as crude, more so than in
French.

ADDRESS: Use "du" for intimacy by default rather than "Sie," unless
formality distance is part of the story's tension (e.g. a professional
or service-role dynamic where formal address carries erotic charge).

IMPORTANT: This register guidance is a starting point and has not yet
been validated by native-speaker review. Treat output with appropriate
caution until trainer feedback confirms or corrects this guidance.
  `.trim(),
}

export function getLanguageRegister(lang: SupportedLanguage): string {
  return LANGUAGE_REGISTERS[lang] ?? ''
}
