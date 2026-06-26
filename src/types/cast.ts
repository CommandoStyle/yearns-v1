// Types for the persistent cast_characters system (prompt-10).
// CastCharacterRow mirrors the DB row shape.
// CastCharacter is the runtime representation (richer typing).

export interface CastCharacterRow {
  id:                string
  user_id:           string
  is_self:           boolean
  name:              string | null
  gender:            'man' | 'woman' | 'unspecified' | null
  role:              string | null
  traits:            string[] | null
  hair_colour:       string | null
  eye_colour:        string | null
  build:             string | null
  height:            string | null
  additional_detail: string | null
  ethnicity?:        string | null
  erogenous_notes?:  string | null  // schema-only — no UI or prompt wiring until UX is designed
  created_at:        string
  updated_at:        string
}

// Subset used by buildPrompt() for self-description injection.
export type SelfDescriptionFields = Pick<
  CastCharacterRow,
  'hair_colour' | 'eye_colour' | 'build' | 'height' | 'additional_detail' | 'ethnicity'
>
