// Supabase database types — hand-authored from migrations 0001–0004.
// Regenerate from a live DB with: pnpm types:supabase
// Do not edit manually after a migration — run the command above instead.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id:                  string
          email:               string
          age_verified:        boolean
          age_verified_at:     string | null
          age_verified_method: string | null
          subscription_tier:   'free' | 'pro'
          subscription_status: string | null
          monthly_usage:       number
          usage_reset_at:      string
          onboarding_complete: boolean
          session_count:       number
          created_at:          string
          updated_at:          string
        }
        Insert: {
          id:                   string
          email:                string
          age_verified?:        boolean
          age_verified_at?:     string | null
          age_verified_method?: string | null
          subscription_tier?:   'free' | 'pro'
          subscription_status?: string | null
          monthly_usage?:       number
          usage_reset_at?:      string
          onboarding_complete?: boolean
          session_count?:       number
          created_at?:          string
          updated_at?:          string
        }
        Update: {
          id?:                  string
          email?:               string
          age_verified?:        boolean
          age_verified_at?:     string | null
          age_verified_method?: string | null
          subscription_tier?:   'free' | 'pro'
          subscription_status?: string | null
          monthly_usage?:       number
          usage_reset_at?:      string
          onboarding_complete?: boolean
          session_count?:       number
          created_at?:          string
          updated_at?:          string
        }
        Relationships: []
      }

      desire_profiles: {
        Row: {
          id:                   string
          user_id:              string
          display_name:         string | null
          genre_weights:        Json | null
          emotional_register:   string[] | null
          desire_targets:       string | null
          explicitness_default: number | null
          participant_mode:     'participant' | 'voyeur' | null
          hard_limits:          string[] | null
          three_words:          string[] | null
          style_references:     string[] | null
          setting_preference:   Json | null
          language:             string | null
          signal_weights:       Json
          created_at:           string
          updated_at:           string
        }
        Insert: {
          id?:                   string
          user_id:               string
          display_name?:         string | null
          genre_weights?:        Json | null
          emotional_register?:   string[] | null
          desire_targets?:       string | null
          explicitness_default?: number | null
          participant_mode?:     'participant' | 'voyeur' | null
          hard_limits?:          string[] | null
          three_words?:          string[] | null
          style_references?:     string[] | null
          setting_preference?:   Json | null
          language?:             string | null
          signal_weights?:       Json
          created_at?:           string
          updated_at?:           string
        }
        Update: {
          id?:                   string
          user_id?:              string
          display_name?:         string | null
          genre_weights?:        Json | null
          emotional_register?:   string[] | null
          desire_targets?:       string | null
          explicitness_default?: number | null
          participant_mode?:     'participant' | 'voyeur' | null
          hard_limits?:          string[] | null
          three_words?:          string[] | null
          style_references?:     string[] | null
          setting_preference?:   Json | null
          language?:             string | null
          signal_weights?:       Json
          created_at?:           string
          updated_at?:           string
        }
        Relationships: [
          {
            foreignKeyName: 'desire_profiles_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }

      subscriptions: {
        Row: {
          id:                     string
          user_id:                string
          stripe_customer_id:     string | null
          stripe_subscription_id: string | null
          stripe_price_id:        string | null
          ccbill_subscription_id: string | null
          plan:                   'free' | 'pro_monthly' | 'pro_annual'
          status:                 'active' | 'cancelled' | 'past_due' | 'incomplete' | 'trialing' | null
          current_period_start:   string | null
          current_period_end:     string | null
          cancel_at_period_end:   boolean
          created_at:             string
          updated_at:             string
        }
        Insert: {
          id?:                     string
          user_id:                 string
          stripe_customer_id?:     string | null
          stripe_subscription_id?: string | null
          stripe_price_id?:        string | null
          ccbill_subscription_id?: string | null
          plan?:                   'free' | 'pro_monthly' | 'pro_annual'
          status?:                 'active' | 'cancelled' | 'past_due' | 'incomplete' | 'trialing' | null
          current_period_start?:   string | null
          current_period_end?:     string | null
          cancel_at_period_end?:   boolean
          created_at?:             string
          updated_at?:             string
        }
        Update: {
          id?:                     string
          user_id?:                string
          stripe_customer_id?:     string | null
          stripe_subscription_id?: string | null
          stripe_price_id?:        string | null
          ccbill_subscription_id?: string | null
          plan?:                   'free' | 'pro_monthly' | 'pro_annual'
          status?:                 'active' | 'cancelled' | 'past_due' | 'incomplete' | 'trialing' | null
          current_period_start?:   string | null
          current_period_end?:     string | null
          cancel_at_period_end?:   boolean
          created_at?:             string
          updated_at?:             string
        }
        Relationships: [
          {
            foreignKeyName: 'subscriptions_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }

      yearns: {
        Row: {
          id:             string
          user_id:        string
          title:          string | null
          genre:          string | null
          setting:        string | null
          explicitness:   number | null
          length_mins:    number | null
          word_count:     number | null
          language:       string
          prompt_version: string | null
          is_continuable: boolean
          is_saved:       boolean
          rating:         number | null
          created_at:     string
          updated_at:     string
        }
        Insert: {
          id?:             string
          user_id:         string
          title?:          string | null
          genre?:          string | null
          setting?:        string | null
          explicitness?:   number | null
          length_mins?:    number | null
          word_count?:     number | null
          language?:       string
          prompt_version?: string | null
          is_continuable?: boolean
          is_saved?:       boolean
          rating?:         number | null
          created_at?:     string
          updated_at?:     string
        }
        Update: {
          id?:             string
          user_id?:        string
          title?:          string | null
          genre?:          string | null
          setting?:        string | null
          explicitness?:   number | null
          length_mins?:    number | null
          word_count?:     number | null
          language?:       string
          prompt_version?: string | null
          is_continuable?: boolean
          is_saved?:       boolean
          rating?:         number | null
          created_at?:     string
          updated_at?:     string
        }
        Relationships: [
          {
            foreignKeyName: 'yearns_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }

      yearn_tails: {
        Row: {
          id:             string
          user_id:        string
          tail_text:      string
          prompt_version: string | null
          yearn_id:       string | null
          created_at:     string
          expires_at:     string
        }
        Insert: {
          id?:             string
          user_id:         string
          tail_text:       string
          prompt_version?: string | null
          yearn_id?:       string | null
          created_at?:     string
          expires_at?:     string
        }
        Update: {
          id?:             string
          user_id?:        string
          tail_text?:      string
          prompt_version?: string | null
          yearn_id?:       string | null
          created_at?:     string
          expires_at?:     string
        }
        Relationships: [
          {
            foreignKeyName: 'yearn_tails_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'yearn_tails_yearn_id_fkey'
            columns: ['yearn_id']
            isOneToOne: false
            referencedRelation: 'yearns'
            referencedColumns: ['id']
          }
        ]
      }

      generation_logs: {
        Row: {
          id:                   string
          user_id:              string
          prompt_version:       string
          explicitness:         number | null
          setting:              string | null
          language:             string | null
          length_mins:          number | null
          is_continuation:      boolean
          status:               'success' | 'error' | 'input_filtered' | 'output_filtered' | 'cancelled'
          word_count:           number
          model_used:           string | null
          duration_ms:          number | null
          error_code:           string | null
          per_story_overrides:  Json
          created_at:           string
        }
        Insert: {
          id?:                   string
          user_id:               string
          prompt_version:        string
          explicitness?:         number | null
          setting?:              string | null
          language?:             string | null
          length_mins?:          number | null
          is_continuation?:      boolean
          status:                'success' | 'error' | 'input_filtered' | 'output_filtered' | 'cancelled'
          word_count?:           number
          model_used?:           string | null
          duration_ms?:          number | null
          error_code?:           string | null
          per_story_overrides?:  Json
          created_at?:           string
        }
        Update: {
          id?:              string
          user_id?:         string
          prompt_version?:  string
          explicitness?:    number | null
          setting?:         string | null
          language?:        string | null
          length_mins?:     number | null
          is_continuation?: boolean
          status?:          'success' | 'error' | 'input_filtered' | 'output_filtered' | 'cancelled'
          word_count?:      number
          model_used?:      string | null
          duration_ms?:     number | null
          error_code?:      string | null
          created_at?:      string
        }
        Relationships: [
          {
            foreignKeyName: 'generation_logs_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }

      implicit_signals: {
        Row: {
          id:         string
          user_id:    string
          event_type: string
          event_data: Json
          processed:  boolean
          created_at: string
        }
        Insert: {
          id?:         string
          user_id:     string
          event_type:  string
          event_data?: Json
          processed?:  boolean
          created_at?: string
        }
        Update: {
          id?:         string
          user_id?:    string
          event_type?: string
          event_data?: Json
          processed?:  boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'implicit_signals_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }

      prompt_versions: {
        Row: {
          id:           string
          version:      string
          is_active:    boolean
          description:  string | null
          avg_score:    number | null
          sample_count: number
          deployed_at:  string | null
          created_at:   string
        }
        Insert: {
          id?:           string
          version:       string
          is_active?:    boolean
          description?:  string | null
          avg_score?:    number | null
          sample_count?: number
          deployed_at?:  string | null
          created_at?:   string
        }
        Update: {
          id?:           string
          version?:      string
          is_active?:    boolean
          description?:  string | null
          avg_score?:    number | null
          sample_count?: number
          deployed_at?:  string | null
          created_at?:   string
        }
        Relationships: []
      }
    }

    Views: {
      [_ in never]: never
    }

    Functions: {
      increment_monthly_usage: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      increment_session_count: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      get_active_prompt_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      upsert_desire_profile: {
        Args: {
          p_user_id:               string
          p_display_name?:         string | null
          p_genre_weights?:        Json | null
          p_emotional_register?:   string[] | null
          p_desire_targets?:       string | null
          p_explicitness_default?: number | null
          p_participant_mode?:     string | null
          p_hard_limits?:          string[] | null
          p_three_words?:          string[] | null
          p_style_references?:     string[] | null
          p_setting_preference?:   Json | null
          p_language?:             string | null
        }
        Returns: Database['public']['Tables']['desire_profiles']['Row']
      }
      sync_subscription_to_user: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      cleanup_expired_tails: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      reset_monthly_usage: {
        Args: { p_user_id: string }
        Returns: undefined
      }
    }

    Enums: {
      [_ in never]: never
    }

    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Convenience helpers (matches the Supabase codegen output format)

type PublicSchema = Database[Extract<keyof Database, 'public'>]

export type Tables<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Row']

export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update']

export type Functions<T extends keyof PublicSchema['Functions']> =
  PublicSchema['Functions'][T]
