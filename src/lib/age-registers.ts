/**
 * Yearns — Age register guidance
 * Injected into the system prompt when profile.age_band is set.
 * Calibrates vernacular, scenario plausibility, and erotic register
 * to the reader's life stage — similar in spirit to language-registers.ts.
 *
 * TONE REQUIREMENT (non-negotiable):
 * Every band must avoid condescension, novelty-framing, or any implication
 * that desire at any age is surprising, remarkable, or requires justification.
 * If trainer feedback indicates any band reads as patronising or treats
 * desire as unusual for that age group, that is a priority fix.
 *
 * Applied at ALL explicitness tiers — this is a life-stage register
 * consideration, not an explicitness one.
 */

export type AgeBand =
  | '18_24'
  | '25_34'
  | '35_44'
  | '45_54'
  | '55_64'
  | '65_plus'

export const AGE_REGISTERS: Record<AgeBand, string> = {
  '18_24': `
LIFE STAGE: Write with the energy and discovery of early adulthood —
desire that is often still being mapped and understood, novelty that
feels genuinely new rather than familiar, confidence that may be present
but is still being tested. Avoid presuming extensive past experience
unless the story's other context implies it.
  `.trim(),

  '25_34': `
LIFE STAGE: Write with the confidence of an adult who knows more of what
she wants than she did a decade ago, but is often still actively
discovering and refining her desires. Comfortable with her own wanting,
without it needing extensive justification.
  `.trim(),

  '35_44': `
LIFE STAGE: Write with the groundedness of a woman who generally knows
herself well. Desire here can carry the specific charge of being chosen
or wanted IN ADDITION to other established identities (career, family,
history) rather than instead of them — confidence is assumed, not earned
within the story.
  `.trim(),

  '45_54': `
LIFE STAGE: Write with an assured, unapologetic relationship to desire.
This is not a register of rediscovery or hesitation — it is a register
of clarity about what she wants and comfort asking for it. Avoid any
implication that desire at this age is surprising, remarkable, or needs
explaining.
  `.trim(),

  '55_64': `
LIFE STAGE: Write with full, unselfconscious comfort in desire — neither
performing youthfulness nor writing around age. Confidence and self-
knowledge are simply the baseline, not something the story remarks on.
The eroticism is in the specific scenario and connection, not in any
narrative around defying expectation.
  `.trim(),

  '65_plus': `
LIFE STAGE: Write with the same full presence and unselfconscious desire
as any other life stage — avoid any narrative framing that treats desire
at this age as exceptional, surprising, or requiring justification. The
story should simply be a good story about wanting and being wanted,
exactly as it would be at any other age.
  `.trim(),
}

export function getAgeRegister(band: AgeBand): string {
  return AGE_REGISTERS[band] ?? ''
}
