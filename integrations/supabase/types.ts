export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      brand_assets: {
        Row: {
          asset_type: string
          brand_id: string
          created_at: string
          description: string | null
          file_name: string
          file_url: string
          id: string
          user_id: string
        }
        Insert: {
          asset_type: string
          brand_id: string
          created_at?: string
          description?: string | null
          file_name: string
          file_url: string
          id?: string
          user_id: string
        }
        Update: {
          asset_type?: string
          brand_id?: string
          created_at?: string
          description?: string | null
          file_name?: string
          file_url?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_assets_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          additional_colors: string[]
          age_range: string | null
          allowed_topics: string[]
          audience: string | null
          audience_difficulties: string | null
          audience_language: string | null
          audience_needs: string | null
          audience_values: string | null
          avoided_topics: string[]
          calls_to_action: string[]
          created_at: string
          description: string | null
          differentiators: string | null
          fonts: string | null
          forbidden_inventions: string | null
          frequently_asked_questions: string | null
          graphic_elements: string | null
          id: string
          important_dates: string | null
          instagram: string | null
          is_active: boolean
          legal_information: string | null
          logo_url: string | null
          name: string
          personality: string | null
          primary_color: string | null
          priority_services: string[]
          products_services: string | null
          prohibited_words: string[]
          publication_preferences: Json
          recommended_words: string[]
          secondary_color: string | null
          segment: string | null
          service_region: string | null
          social_goal: string | null
          tone_of_voice: string | null
          updated_at: string
          user_id: string
          visual_references: string | null
          visual_style: string | null
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          additional_colors?: string[]
          age_range?: string | null
          allowed_topics?: string[]
          audience?: string | null
          audience_difficulties?: string | null
          audience_language?: string | null
          audience_needs?: string | null
          audience_values?: string | null
          avoided_topics?: string[]
          calls_to_action?: string[]
          created_at?: string
          description?: string | null
          differentiators?: string | null
          fonts?: string | null
          forbidden_inventions?: string | null
          frequently_asked_questions?: string | null
          graphic_elements?: string | null
          id?: string
          important_dates?: string | null
          instagram?: string | null
          is_active?: boolean
          legal_information?: string | null
          logo_url?: string | null
          name: string
          personality?: string | null
          primary_color?: string | null
          priority_services?: string[]
          products_services?: string | null
          prohibited_words?: string[]
          publication_preferences?: Json
          recommended_words?: string[]
          secondary_color?: string | null
          segment?: string | null
          service_region?: string | null
          social_goal?: string | null
          tone_of_voice?: string | null
          updated_at?: string
          user_id: string
          visual_references?: string | null
          visual_style?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          additional_colors?: string[]
          age_range?: string | null
          allowed_topics?: string[]
          audience?: string | null
          audience_difficulties?: string | null
          audience_language?: string | null
          audience_needs?: string | null
          audience_values?: string | null
          avoided_topics?: string[]
          calls_to_action?: string[]
          created_at?: string
          description?: string | null
          differentiators?: string | null
          fonts?: string | null
          forbidden_inventions?: string | null
          frequently_asked_questions?: string | null
          graphic_elements?: string | null
          id?: string
          important_dates?: string | null
          instagram?: string | null
          is_active?: boolean
          legal_information?: string | null
          logo_url?: string | null
          name?: string
          personality?: string | null
          primary_color?: string | null
          priority_services?: string[]
          products_services?: string | null
          prohibited_words?: string[]
          publication_preferences?: Json
          recommended_words?: string[]
          secondary_color?: string | null
          segment?: string | null
          service_region?: string | null
          social_goal?: string | null
          tone_of_voice?: string | null
          updated_at?: string
          user_id?: string
          visual_references?: string | null
          visual_style?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      client_approval_events: {
        Row: {
          approval_id: string
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          approval_id: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          approval_id?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_approval_events_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "client_approvals"
            referencedColumns: ["id"]
          },
        ]
      }
      client_approval_items: {
        Row: {
          approval_id: string
          comment: string | null
          created_at: string
          decision: string
          display_order: number
          id: string
          output_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approval_id: string
          comment?: string | null
          created_at?: string
          decision?: string
          display_order?: number
          id?: string
          output_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approval_id?: string
          comment?: string | null
          created_at?: string
          decision?: string
          display_order?: number
          id?: string
          output_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_approval_items_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "client_approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_approval_items_output_id_fkey"
            columns: ["output_id"]
            isOneToOne: false
            referencedRelation: "content_outputs"
            referencedColumns: ["id"]
          },
        ]
      }
      client_approvals: {
        Row: {
          allow_multiple_responses: boolean
          allow_piece_approval: boolean
          allow_piece_comments: boolean
          allow_schedule_changes: boolean
          brand_id: string | null
          client_company: string | null
          client_email: string | null
          client_name: string | null
          client_role: string | null
          created_at: string
          decision: string | null
          expires_at: string | null
          failed_attempts: number
          first_viewed_at: string | null
          general_comment: string | null
          id: string
          include_caption: boolean
          include_hashtags: boolean
          include_schedule: boolean
          introduction_message: string | null
          last_viewed_at: string | null
          locked_until: string | null
          password_hash: string | null
          project_id: string
          requested_date: string | null
          requested_time: string | null
          revoked_at: string | null
          schedule_decision: string | null
          status: string
          submitted_at: string | null
          title: string
          token_hash: string
          updated_at: string
          user_id: string
          view_count: number
        }
        Insert: {
          allow_multiple_responses?: boolean
          allow_piece_approval?: boolean
          allow_piece_comments?: boolean
          allow_schedule_changes?: boolean
          brand_id?: string | null
          client_company?: string | null
          client_email?: string | null
          client_name?: string | null
          client_role?: string | null
          created_at?: string
          decision?: string | null
          expires_at?: string | null
          failed_attempts?: number
          first_viewed_at?: string | null
          general_comment?: string | null
          id?: string
          include_caption?: boolean
          include_hashtags?: boolean
          include_schedule?: boolean
          introduction_message?: string | null
          last_viewed_at?: string | null
          locked_until?: string | null
          password_hash?: string | null
          project_id: string
          requested_date?: string | null
          requested_time?: string | null
          revoked_at?: string | null
          schedule_decision?: string | null
          status?: string
          submitted_at?: string | null
          title: string
          token_hash: string
          updated_at?: string
          user_id: string
          view_count?: number
        }
        Update: {
          allow_multiple_responses?: boolean
          allow_piece_approval?: boolean
          allow_piece_comments?: boolean
          allow_schedule_changes?: boolean
          brand_id?: string | null
          client_company?: string | null
          client_email?: string | null
          client_name?: string | null
          client_role?: string | null
          created_at?: string
          decision?: string | null
          expires_at?: string | null
          failed_attempts?: number
          first_viewed_at?: string | null
          general_comment?: string | null
          id?: string
          include_caption?: boolean
          include_hashtags?: boolean
          include_schedule?: boolean
          introduction_message?: string | null
          last_viewed_at?: string | null
          locked_until?: string | null
          password_hash?: string | null
          project_id?: string
          requested_date?: string | null
          requested_time?: string | null
          revoked_at?: string | null
          schedule_decision?: string | null
          status?: string
          submitted_at?: string | null
          title?: string
          token_hash?: string
          updated_at?: string
          user_id?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_approvals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "content_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      content_ideas: {
        Row: {
          angle: string | null
          applied_fallback_level: number
          approach: string | null
          audience_problem: string | null
          brand_id: string | null
          central_message: string | null
          compatibility_level: string | null
          compatibility_reason: string | null
          content_pillar: string | null
          converted_project_id: string | null
          created_at: string
          hook: string | null
          id: string
          novelty_badge: string | null
          novelty_score: number
          objective: string | null
          reason_to_publish: string | null
          recommended_format: string | null
          required_information: string[]
          source_elements: string[]
          source_type: string
          status: string
          suggested_cta: string | null
          target_audience: string | null
          template_key: string | null
          theme: string | null
          title: string
          updated_at: string
          user_id: string
          visual_direction: string | null
        }
        Insert: {
          angle?: string | null
          applied_fallback_level?: number
          approach?: string | null
          audience_problem?: string | null
          brand_id?: string | null
          central_message?: string | null
          compatibility_level?: string | null
          compatibility_reason?: string | null
          content_pillar?: string | null
          converted_project_id?: string | null
          created_at?: string
          hook?: string | null
          id?: string
          novelty_badge?: string | null
          novelty_score?: number
          objective?: string | null
          reason_to_publish?: string | null
          recommended_format?: string | null
          required_information?: string[]
          source_elements?: string[]
          source_type?: string
          status?: string
          suggested_cta?: string | null
          target_audience?: string | null
          template_key?: string | null
          theme?: string | null
          title: string
          updated_at?: string
          user_id: string
          visual_direction?: string | null
        }
        Update: {
          angle?: string | null
          applied_fallback_level?: number
          approach?: string | null
          audience_problem?: string | null
          brand_id?: string | null
          central_message?: string | null
          compatibility_level?: string | null
          compatibility_reason?: string | null
          content_pillar?: string | null
          converted_project_id?: string | null
          created_at?: string
          hook?: string | null
          id?: string
          novelty_badge?: string | null
          novelty_score?: number
          objective?: string | null
          reason_to_publish?: string | null
          recommended_format?: string | null
          required_information?: string[]
          source_elements?: string[]
          source_type?: string
          status?: string
          suggested_cta?: string | null
          target_audience?: string | null
          template_key?: string | null
          theme?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          visual_direction?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_ideas_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_ideas_converted_project_id_fkey"
            columns: ["converted_project_id"]
            isOneToOne: false
            referencedRelation: "content_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      content_outputs: {
        Row: {
          copy_status: string
          created_at: string
          display_order: number
          edited_content: string | null
          id: string
          imported_content: Json | null
          is_favorite: boolean
          original_content: string
          output_type: string
          project_id: string
          source: string
          title: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          copy_status?: string
          created_at?: string
          display_order?: number
          edited_content?: string | null
          id?: string
          imported_content?: Json | null
          is_favorite?: boolean
          original_content: string
          output_type: string
          project_id: string
          source?: string
          title: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          copy_status?: string
          created_at?: string
          display_order?: number
          edited_content?: string | null
          id?: string
          imported_content?: Json | null
          is_favorite?: boolean
          original_content?: string
          output_type?: string
          project_id?: string
          source?: string
          title?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_outputs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "content_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      content_piece_assets: {
        Row: {
          created_at: string
          display_order: number
          file_name: string
          file_size: number
          file_type: string
          id: string
          image_height: number | null
          image_width: number | null
          include_in_client_pdf: boolean
          is_approved: boolean
          output_id: string
          project_id: string
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          file_name: string
          file_size?: number
          file_type: string
          id?: string
          image_height?: number | null
          image_width?: number | null
          include_in_client_pdf?: boolean
          is_approved?: boolean
          output_id: string
          project_id: string
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          file_name?: string
          file_size?: number
          file_type?: string
          id?: string
          image_height?: number | null
          image_width?: number | null
          include_in_client_pdf?: boolean
          is_approved?: boolean
          output_id?: string
          project_id?: string
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_piece_assets_output_id_fkey"
            columns: ["output_id"]
            isOneToOne: false
            referencedRelation: "content_outputs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_piece_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "content_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      content_projects: {
        Row: {
          audience_problem: string | null
          avoid_terms: string[]
          brand_id: string | null
          call_to_action: string | null
          campaign_content_json: Json | null
          client_pdf_settings: Json | null
          contact_information: string | null
          content_development_status: string
          content_source: string
          created_at: string
          desired_style: string | null
          display_title: string | null
          event_date: string | null
          event_time: string | null
          formality_level: string | null
          generation_mode: string
          id: string
          imported_at: string | null
          internal_title: string | null
          is_favorite: boolean
          location: string | null
          main_message: string | null
          mandatory_information: string | null
          notes: string | null
          objective: string | null
          price_information: string | null
          publication_date: string | null
          restrictions: string | null
          selected_differentiators: string[]
          selected_formats: string[]
          selected_outputs: string[]
          specific_audience: string | null
          status: string
          theme: string | null
          title_source: string | null
          title_updated_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          audience_problem?: string | null
          avoid_terms?: string[]
          brand_id?: string | null
          call_to_action?: string | null
          campaign_content_json?: Json | null
          client_pdf_settings?: Json | null
          contact_information?: string | null
          content_development_status?: string
          content_source?: string
          created_at?: string
          desired_style?: string | null
          display_title?: string | null
          event_date?: string | null
          event_time?: string | null
          formality_level?: string | null
          generation_mode?: string
          id?: string
          imported_at?: string | null
          internal_title?: string | null
          is_favorite?: boolean
          location?: string | null
          main_message?: string | null
          mandatory_information?: string | null
          notes?: string | null
          objective?: string | null
          price_information?: string | null
          publication_date?: string | null
          restrictions?: string | null
          selected_differentiators?: string[]
          selected_formats?: string[]
          selected_outputs?: string[]
          specific_audience?: string | null
          status?: string
          theme?: string | null
          title_source?: string | null
          title_updated_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          audience_problem?: string | null
          avoid_terms?: string[]
          brand_id?: string | null
          call_to_action?: string | null
          campaign_content_json?: Json | null
          client_pdf_settings?: Json | null
          contact_information?: string | null
          content_development_status?: string
          content_source?: string
          created_at?: string
          desired_style?: string | null
          display_title?: string | null
          event_date?: string | null
          event_time?: string | null
          formality_level?: string | null
          generation_mode?: string
          id?: string
          imported_at?: string | null
          internal_title?: string | null
          is_favorite?: boolean
          location?: string | null
          main_message?: string | null
          mandatory_information?: string | null
          notes?: string | null
          objective?: string | null
          price_information?: string | null
          publication_date?: string | null
          restrictions?: string | null
          selected_differentiators?: string[]
          selected_formats?: string[]
          selected_outputs?: string[]
          specific_audience?: string | null
          status?: string
          theme?: string | null
          title_source?: string | null
          title_updated_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_projects_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prompt_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_system_template: boolean
          name: string
          objective: string | null
          recommended_formats: string[]
          suggested_fields: string[]
          template_content: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system_template?: boolean
          name: string
          objective?: string | null
          recommended_formats?: string[]
          suggested_fields?: string[]
          template_content: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system_template?: boolean
          name?: string
          objective?: string | null
          recommended_formats?: string[]
          suggested_fields?: string[]
          template_content?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      publication_schedule_history: {
        Row: {
          action_type: string
          created_at: string
          id: string
          new_date: string | null
          new_status: string | null
          new_time: string | null
          notes: string | null
          old_date: string | null
          old_status: string | null
          old_time: string | null
          schedule_item_id: string
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          new_date?: string | null
          new_status?: string | null
          new_time?: string | null
          notes?: string | null
          old_date?: string | null
          old_status?: string | null
          old_time?: string | null
          schedule_item_id: string
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          new_date?: string | null
          new_status?: string | null
          new_time?: string | null
          notes?: string | null
          old_date?: string | null
          old_status?: string | null
          old_time?: string | null
          schedule_item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publication_schedule_history_schedule_item_id_fkey"
            columns: ["schedule_item_id"]
            isOneToOne: false
            referencedRelation: "publication_schedule_items"
            referencedColumns: ["id"]
          },
        ]
      }
      publication_schedule_items: {
        Row: {
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          assigned_to: string | null
          brand_id: string | null
          cancelled_at: string | null
          channel: string | null
          checklist: Json
          client_notes: string | null
          confirmed_date: string | null
          confirmed_time: string | null
          created_at: string
          description: string | null
          format: string | null
          id: string
          internal_notes: string | null
          project_id: string
          publication_notes: string | null
          publication_unit: string
          publication_url: string | null
          published_at: string | null
          schedule_status: string
          suggested_date: string | null
          suggested_time: string | null
          timezone: string | null
          title: string | null
          title_override: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          assigned_to?: string | null
          brand_id?: string | null
          cancelled_at?: string | null
          channel?: string | null
          checklist?: Json
          client_notes?: string | null
          confirmed_date?: string | null
          confirmed_time?: string | null
          created_at?: string
          description?: string | null
          format?: string | null
          id?: string
          internal_notes?: string | null
          project_id: string
          publication_notes?: string | null
          publication_unit: string
          publication_url?: string | null
          published_at?: string | null
          schedule_status?: string
          suggested_date?: string | null
          suggested_time?: string | null
          timezone?: string | null
          title?: string | null
          title_override?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          assigned_to?: string | null
          brand_id?: string | null
          cancelled_at?: string | null
          channel?: string | null
          checklist?: Json
          client_notes?: string | null
          confirmed_date?: string | null
          confirmed_time?: string | null
          created_at?: string
          description?: string | null
          format?: string | null
          id?: string
          internal_notes?: string | null
          project_id?: string
          publication_notes?: string | null
          publication_unit?: string
          publication_url?: string | null
          published_at?: string | null
          schedule_status?: string
          suggested_date?: string | null
          suggested_time?: string | null
          timezone?: string | null
          title?: string | null
          title_override?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publication_schedule_items_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_schedule_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "content_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      publication_schedule_outputs: {
        Row: {
          created_at: string
          display_order: number
          id: string
          output_id: string
          schedule_item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          output_id: string
          schedule_item_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          output_id?: string
          schedule_item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publication_schedule_outputs_output_id_fkey"
            columns: ["output_id"]
            isOneToOne: false
            referencedRelation: "content_outputs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_schedule_outputs_schedule_item_id_fkey"
            columns: ["schedule_item_id"]
            isOneToOne: false
            referencedRelation: "publication_schedule_items"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      prompt_templates_catalog: {
        Row: {
          created_at: string | null
          description: string | null
          id: string | null
          is_system_template: boolean | null
          name: string | null
          objective: string | null
          recommended_formats: string[] | null
          suggested_fields: string[] | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_system_template?: boolean | null
          name?: string | null
          objective?: string | null
          recommended_formats?: string[] | null
          suggested_fields?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_system_template?: boolean | null
          name?: string | null
          objective?: string | null
          recommended_formats?: string[] | null
          suggested_fields?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
