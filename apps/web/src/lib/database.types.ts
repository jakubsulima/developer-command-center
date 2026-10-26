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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      actions: {
        Row: {
          archived_at: string | null
          area_id: string | null
          blocker: string | null
          cancelled_at: string | null
          checklist: Json
          completed_at: string | null
          created_at: string
          detail: string
          goal_id: string | null
          id: string
          is_next: boolean
          legacy_source_id: string | null
          occurrence_date: string | null
          pinned_to_today: boolean
          position: number
          recurring_template_id: string | null
          review_on: string | null
          scheduled_for: string | null
          skipped_at: string | null
          status: string
          title: string
          trashed_at: string | null
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          area_id?: string | null
          blocker?: string | null
          cancelled_at?: string | null
          checklist?: Json
          completed_at?: string | null
          created_at?: string
          detail?: string
          goal_id?: string | null
          id?: string
          is_next?: boolean
          legacy_source_id?: string | null
          occurrence_date?: string | null
          pinned_to_today?: boolean
          position?: number
          recurring_template_id?: string | null
          review_on?: string | null
          scheduled_for?: string | null
          skipped_at?: string | null
          status?: string
          title: string
          trashed_at?: string | null
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          area_id?: string | null
          blocker?: string | null
          cancelled_at?: string | null
          checklist?: Json
          completed_at?: string | null
          created_at?: string
          detail?: string
          goal_id?: string | null
          id?: string
          is_next?: boolean
          legacy_source_id?: string | null
          occurrence_date?: string | null
          pinned_to_today?: boolean
          position?: number
          recurring_template_id?: string | null
          review_on?: string | null
          scheduled_for?: string | null
          skipped_at?: string | null
          status?: string
          title?: string
          trashed_at?: string | null
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "actions_area_id_workspace_id_fkey"
            columns: ["area_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "actions_goal_id_workspace_id_fkey"
            columns: ["goal_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "actions_recurring_template_id_workspace_id_fkey"
            columns: ["recurring_template_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "recurring_action_templates"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "actions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_events: {
        Row: {
          actor_user_id: string | null
          command_name: string
          correlation_id: string
          entity_ids: string[]
          id: string
          occurred_at: string
          source: string
          summary_diff: Json
          workspace_id: string
        }
        Insert: {
          actor_user_id?: string | null
          command_name: string
          correlation_id: string
          entity_ids?: string[]
          id?: string
          occurred_at?: string
          source: string
          summary_diff?: Json
          workspace_id: string
        }
        Update: {
          actor_user_id?: string | null
          command_name?: string
          correlation_id?: string
          entity_ids?: string[]
          id?: string
          occurred_at?: string
          source?: string
          summary_diff?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_executions: {
        Row: {
          created_at: string
          error_code: string | null
          finished_at: string | null
          id: string
          idempotency_key: string
          proposal_id: string
          requested_by: string
          status: Database["public"]["Enums"]["ai_execution_status"]
          workspace_id: string
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key: string
          proposal_id: string
          requested_by: string
          status?: Database["public"]["Enums"]["ai_execution_status"]
          workspace_id: string
        }
        Update: {
          created_at?: string
          error_code?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string
          proposal_id?: string
          requested_by?: string
          status?: Database["public"]["Enums"]["ai_execution_status"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_executions_proposal_workspace_fkey"
            columns: ["proposal_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "ai_proposals"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "ai_executions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_goal_review_feedback: {
        Row: {
          created_at: string
          id: string
          rating: string
          recommendation_id: string | null
          review_id: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rating: string
          recommendation_id?: string | null
          review_id: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rating?: string
          recommendation_id?: string | null
          review_id?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_goal_review_feedback_review_id_workspace_id_fkey"
            columns: ["review_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "ai_goal_reviews"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "ai_goal_review_feedback_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_goal_reviews: {
        Row: {
          analyzed_goal_ids: string[]
          cache_expires_at: string
          context_hash: string
          created_at: string
          created_by: string
          id: string
          model: string
          omitted_goal_ids: string[]
          period_end: string
          period_start: string
          prompt_version: number
          provider: string
          review_json: Json
          run_id: string | null
          schema_version: number
          source_snapshot_at: string
          window_days: number
          workspace_id: string
        }
        Insert: {
          analyzed_goal_ids?: string[]
          cache_expires_at: string
          context_hash: string
          created_at?: string
          created_by: string
          id?: string
          model: string
          omitted_goal_ids?: string[]
          period_end: string
          period_start: string
          prompt_version: number
          provider: string
          review_json: Json
          run_id?: string | null
          schema_version: number
          source_snapshot_at: string
          window_days?: number
          workspace_id: string
        }
        Update: {
          analyzed_goal_ids?: string[]
          cache_expires_at?: string
          context_hash?: string
          created_at?: string
          created_by?: string
          id?: string
          model?: string
          omitted_goal_ids?: string[]
          period_end?: string
          period_start?: string
          prompt_version?: number
          provider?: string
          review_json?: Json
          run_id?: string | null
          schema_version?: number
          source_snapshot_at?: string
          window_days?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_goal_reviews_run_id_workspace_id_fkey"
            columns: ["run_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "ai_runs"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "ai_goal_reviews_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_inbox_triage_feedback: {
        Row: {
          created_at: string
          id: string
          proposal_id: string
          rating: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          proposal_id: string
          rating: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          proposal_id?: string
          rating?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_inbox_triage_feedback_proposal_id_workspace_id_fkey"
            columns: ["proposal_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "ai_inbox_triage_proposals"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "ai_inbox_triage_feedback_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_inbox_triage_proposals: {
        Row: {
          cache_expires_at: string
          context_hash: string
          created_at: string
          created_by: string
          id: string
          inbox_item_id: string
          model: string
          prompt_version: number
          proposal_json: Json
          provider: string
          run_id: string | null
          schema_version: number
          source_snapshot_at: string
          workspace_id: string
        }
        Insert: {
          cache_expires_at: string
          context_hash: string
          created_at?: string
          created_by: string
          id?: string
          inbox_item_id: string
          model: string
          prompt_version: number
          proposal_json: Json
          provider: string
          run_id?: string | null
          schema_version: number
          source_snapshot_at: string
          workspace_id: string
        }
        Update: {
          cache_expires_at?: string
          context_hash?: string
          created_at?: string
          created_by?: string
          id?: string
          inbox_item_id?: string
          model?: string
          prompt_version?: number
          proposal_json?: Json
          provider?: string
          run_id?: string | null
          schema_version?: number
          source_snapshot_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_inbox_triage_proposals_inbox_item_id_fkey"
            columns: ["inbox_item_id"]
            isOneToOne: false
            referencedRelation: "inbox_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_inbox_triage_proposals_inbox_item_id_workspace_id_fkey"
            columns: ["inbox_item_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "inbox_items"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "ai_inbox_triage_proposals_run_id_workspace_id_fkey"
            columns: ["run_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "ai_runs"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "ai_inbox_triage_proposals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_proposals: {
        Row: {
          command_args: Json
          command_name: string
          created_at: string
          decided_at: string | null
          expected_versions: Json
          expires_at: string
          id: string
          preview_diff: Json
          risk: string
          source_entity_ids: string[]
          status: Database["public"]["Enums"]["ai_proposal_status"]
          supersedes_id: string | null
          workspace_id: string
        }
        Insert: {
          command_args: Json
          command_name: string
          created_at?: string
          decided_at?: string | null
          expected_versions?: Json
          expires_at: string
          id?: string
          preview_diff: Json
          risk: string
          source_entity_ids?: string[]
          status?: Database["public"]["Enums"]["ai_proposal_status"]
          supersedes_id?: string | null
          workspace_id: string
        }
        Update: {
          command_args?: Json
          command_name?: string
          created_at?: string
          decided_at?: string | null
          expected_versions?: Json
          expires_at?: string
          id?: string
          preview_diff?: Json
          risk?: string
          source_entity_ids?: string[]
          status?: Database["public"]["Enums"]["ai_proposal_status"]
          supersedes_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_proposals_supersedes_workspace_fkey"
            columns: ["supersedes_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "ai_proposals"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "ai_proposals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_runs: {
        Row: {
          accounted_nano_usd: number
          attempts: number
          capability: string
          cost_is_estimate: boolean
          created_at: string
          error_code: string | null
          finished_at: string | null
          id: string
          input_chars: number
          input_price_nano_per_token: number
          input_tokens: number | null
          latency_ms: number | null
          model: string
          output_price_nano_per_token: number
          output_tokens: number | null
          prompt_version: number
          provider: string
          provider_request_id: string | null
          reserved_nano_usd: number
          schema_version: number
          status: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          accounted_nano_usd?: number
          attempts?: number
          capability: string
          cost_is_estimate?: boolean
          created_at?: string
          error_code?: string | null
          finished_at?: string | null
          id?: string
          input_chars?: number
          input_price_nano_per_token?: number
          input_tokens?: number | null
          latency_ms?: number | null
          model: string
          output_price_nano_per_token?: number
          output_tokens?: number | null
          prompt_version: number
          provider: string
          provider_request_id?: string | null
          reserved_nano_usd?: number
          schema_version: number
          status: string
          user_id: string
          workspace_id: string
        }
        Update: {
          accounted_nano_usd?: number
          attempts?: number
          capability?: string
          cost_is_estimate?: boolean
          created_at?: string
          error_code?: string | null
          finished_at?: string | null
          id?: string
          input_chars?: number
          input_price_nano_per_token?: number
          input_tokens?: number | null
          latency_ms?: number | null
          model?: string
          output_price_nano_per_token?: number
          output_tokens?: number | null
          prompt_version?: number
          provider?: string
          provider_request_id?: string | null
          reserved_nano_usd?: number
          schema_version?: number
          status?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      areas: {
        Row: {
          archived_at: string | null
          category_ids: string[]
          color: string | null
          created_at: string
          description: string
          id: string
          name: string
          parent_project_id: string | null
          preset: string
          trashed_at: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          category_ids?: string[]
          color?: string | null
          created_at?: string
          description?: string
          id?: string
          name: string
          parent_project_id?: string | null
          preset?: string
          trashed_at?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          category_ids?: string[]
          color?: string | null
          created_at?: string
          description?: string
          id?: string
          name?: string
          parent_project_id?: string | null
          preset?: string
          trashed_at?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "areas_parent_same_workspace"
            columns: ["workspace_id", "parent_project_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "areas_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      commitments: {
        Row: {
          effort_budget_minutes: number | null
          effort_budget_sessions: number | null
          ended_at: string | null
          id: string
          is_primary: boolean
          override_reason: string | null
          started_at: string
          status: Database["public"]["Enums"]["commitment_status"]
          target_entity_id: string
          workspace_id: string
        }
        Insert: {
          effort_budget_minutes?: number | null
          effort_budget_sessions?: number | null
          ended_at?: string | null
          id?: string
          is_primary?: boolean
          override_reason?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["commitment_status"]
          target_entity_id: string
          workspace_id: string
        }
        Update: {
          effort_budget_minutes?: number | null
          effort_budget_sessions?: number | null
          ended_at?: string | null
          id?: string
          is_primary?: boolean
          override_reason?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["commitment_status"]
          target_entity_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commitments_target_entity_id_fkey"
            columns: ["target_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_target_workspace_fk"
            columns: ["target_entity_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "commitments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      context_checkpoints: {
        Row: {
          artifact_entity_id: string | null
          blocker: string | null
          branch: string | null
          created_at: string
          current_state: string
          file_path: string | null
          focus_session_id: string
          id: string
          locked_at: string | null
          next_action: string
          note: string | null
          source_url: string | null
          updated_at: string
          work_item_id: string
          workspace_id: string
        }
        Insert: {
          artifact_entity_id?: string | null
          blocker?: string | null
          branch?: string | null
          created_at?: string
          current_state: string
          file_path?: string | null
          focus_session_id: string
          id?: string
          locked_at?: string | null
          next_action: string
          note?: string | null
          source_url?: string | null
          updated_at?: string
          work_item_id: string
          workspace_id: string
        }
        Update: {
          artifact_entity_id?: string | null
          blocker?: string | null
          branch?: string | null
          created_at?: string
          current_state?: string
          file_path?: string | null
          focus_session_id?: string
          id?: string
          locked_at?: string | null
          next_action?: string
          note?: string | null
          source_url?: string | null
          updated_at?: string
          work_item_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkpoints_item_workspace_fk"
            columns: ["work_item_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["entity_id", "workspace_id"]
          },
          {
            foreignKeyName: "checkpoints_session_workspace_fk"
            columns: ["focus_session_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "focus_sessions"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "context_checkpoints_artifact_entity_id_fkey"
            columns: ["artifact_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "context_checkpoints_focus_session_id_fkey"
            columns: ["focus_session_id"]
            isOneToOne: true
            referencedRelation: "focus_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "context_checkpoints_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "context_checkpoints_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      entities: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          title: string
          trashed_at: string | null
          type: Database["public"]["Enums"]["entity_type"]
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          title: string
          trashed_at?: string | null
          type: Database["public"]["Enums"]["entity_type"]
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          title?: string
          trashed_at?: string | null
          type?: Database["public"]["Enums"]["entity_type"]
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_links: {
        Row: {
          created_at: string
          id: string
          relation: string
          source_entity_id: string
          target_entity_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          relation: string
          source_entity_id: string
          target_entity_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          relation?: string
          source_entity_id?: string
          target_entity_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_links_source_entity_id_fkey"
            columns: ["source_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_links_target_entity_id_fkey"
            columns: ["target_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "links_source_workspace_fk"
            columns: ["source_entity_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "links_target_workspace_fk"
            columns: ["target_entity_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      focus_sessions: {
        Row: {
          end_reason: Database["public"]["Enums"]["session_end_reason"] | null
          ended_at: string | null
          id: string
          idempotency_key: string
          invalidated_at: string | null
          scratchpad: string
          started_at: string
          user_id: string
          work_item_id: string
          workspace_id: string
        }
        Insert: {
          end_reason?: Database["public"]["Enums"]["session_end_reason"] | null
          ended_at?: string | null
          id?: string
          idempotency_key: string
          invalidated_at?: string | null
          scratchpad?: string
          started_at?: string
          user_id: string
          work_item_id: string
          workspace_id: string
        }
        Update: {
          end_reason?: Database["public"]["Enums"]["session_end_reason"] | null
          ended_at?: string | null
          id?: string
          idempotency_key?: string
          invalidated_at?: string | null
          scratchpad?: string
          started_at?: string
          user_id?: string
          work_item_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "focus_sessions_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "focus_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_item_workspace_fk"
            columns: ["work_item_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["entity_id", "workspace_id"]
          },
        ]
      }
      goal_criteria: {
        Row: {
          completed: boolean
          goal_id: string
          id: string
          legacy_source_id: string | null
          position: number
          title: string
          workspace_id: string
        }
        Insert: {
          completed?: boolean
          goal_id: string
          id?: string
          legacy_source_id?: string | null
          position?: number
          title: string
          workspace_id: string
        }
        Update: {
          completed?: boolean
          goal_id?: string
          id?: string
          legacy_source_id?: string | null
          position?: number
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_criteria_goal_id_workspace_id_fkey"
            columns: ["goal_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "goal_criteria_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_templates: {
        Row: {
          archived_at: string | null
          created_at: string
          criterion_prompt: string | null
          default_actions: Json
          id: string
          is_system: boolean
          kind: string
          name: string
          outcome_prompt: string
          trashed_at: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          criterion_prompt?: string | null
          default_actions?: Json
          id?: string
          is_system?: boolean
          kind: string
          name: string
          outcome_prompt?: string
          trashed_at?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          criterion_prompt?: string | null
          default_actions?: Json
          id?: string
          is_system?: boolean
          kind?: string
          name?: string
          outcome_prompt?: string
          trashed_at?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goal_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          archived_at: string | null
          area_id: string | null
          created_at: string
          id: string
          kind: string
          legacy_source: string | null
          outcome: string
          priority: string
          status: string
          target_date: string | null
          template_id: string | null
          title: string
          trashed_at: string | null
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          area_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          legacy_source?: string | null
          outcome: string
          priority?: string
          status?: string
          target_date?: string | null
          template_id?: string | null
          title: string
          trashed_at?: string | null
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          area_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          legacy_source?: string | null
          outcome?: string
          priority?: string
          status?: string
          target_date?: string | null
          template_id?: string | null
          title?: string
          trashed_at?: string | null
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_area_id_workspace_id_fkey"
            columns: ["area_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "goals_template_id_workspace_id_fkey"
            columns: ["template_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "goal_templates"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "goals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_items: {
        Row: {
          created_at: string
          created_by: string
          discarded_at: string | null
          id: string
          idempotency_key: string
          kind: Database["public"]["Enums"]["capture_kind"]
          raw_content: string
          resolved_at: string | null
          resolved_to_ids: string[]
          snoozed_until: string | null
          source_url: string | null
          status: Database["public"]["Enums"]["inbox_status"]
          sync_state: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          discarded_at?: string | null
          id?: string
          idempotency_key: string
          kind?: Database["public"]["Enums"]["capture_kind"]
          raw_content: string
          resolved_at?: string | null
          resolved_to_ids?: string[]
          snoozed_until?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["inbox_status"]
          sync_state?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          discarded_at?: string | null
          id?: string
          idempotency_key?: string
          kind?: Database["public"]["Enums"]["capture_kind"]
          raw_content?: string
          resolved_at?: string | null
          resolved_to_ids?: string[]
          snoozed_until?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["inbox_status"]
          sync_state?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_items: {
        Row: {
          created_at: string
          current_page: number | null
          detail: string
          entity_id: string
          reading_location: string | null
          reading_status: string | null
          resource_author: string | null
          resource_format: string | null
          revisit_on: string | null
          source_inbox_item_id: string | null
          source_url: string | null
          total_pages: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          current_page?: number | null
          detail?: string
          entity_id: string
          reading_location?: string | null
          reading_status?: string | null
          resource_author?: string | null
          resource_format?: string | null
          revisit_on?: string | null
          source_inbox_item_id?: string | null
          source_url?: string | null
          total_pages?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          current_page?: number | null
          detail?: string
          entity_id?: string
          reading_location?: string | null
          reading_status?: string | null
          resource_author?: string | null
          resource_format?: string | null
          revisit_on?: string | null
          source_inbox_item_id?: string | null
          source_url?: string | null
          total_pages?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_items_entity_id_workspace_id_fkey"
            columns: ["entity_id", "workspace_id"]
            isOneToOne: true
            referencedRelation: "entities"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "knowledge_items_source_inbox_item_id_fkey"
            columns: ["source_inbox_item_id"]
            isOneToOne: false
            referencedRelation: "inbox_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_links: {
        Row: {
          action_id: string | null
          area_id: string | null
          created_at: string
          goal_id: string | null
          id: string
          knowledge_entity_id: string
          meaning: string
          recurring_template_id: string | null
          target_knowledge_entity_id: string | null
          workspace_id: string
        }
        Insert: {
          action_id?: string | null
          area_id?: string | null
          created_at?: string
          goal_id?: string | null
          id?: string
          knowledge_entity_id: string
          meaning?: string
          recurring_template_id?: string | null
          target_knowledge_entity_id?: string | null
          workspace_id: string
        }
        Update: {
          action_id?: string | null
          area_id?: string | null
          created_at?: string
          goal_id?: string | null
          id?: string
          knowledge_entity_id?: string
          meaning?: string
          recurring_template_id?: string | null
          target_knowledge_entity_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_links_action_id_workspace_id_fkey"
            columns: ["action_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "knowledge_links_area_workspace_fkey"
            columns: ["area_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "knowledge_links_goal_id_workspace_id_fkey"
            columns: ["goal_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "knowledge_links_knowledge_entity_id_workspace_id_fkey"
            columns: ["knowledge_entity_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "knowledge_links_recurring_template_id_workspace_id_fkey"
            columns: ["recurring_template_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "recurring_action_templates"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "knowledge_links_target_knowledge_workspace_fkey"
            columns: ["target_knowledge_entity_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "knowledge_items"
            referencedColumns: ["entity_id", "workspace_id"]
          },
          {
            foreignKeyName: "knowledge_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_evidence: {
        Row: {
          artifact_entity_id: string | null
          assessment_method: string
          created_at: string
          criterion: string
          entity_id: string
          feedback: string
          focus_session_id: string | null
          learning_goal_id: string
          result: Database["public"]["Enums"]["learning_result"]
          user_accepted: boolean
          workspace_id: string
        }
        Insert: {
          artifact_entity_id?: string | null
          assessment_method: string
          created_at?: string
          criterion: string
          entity_id: string
          feedback?: string
          focus_session_id?: string | null
          learning_goal_id: string
          result: Database["public"]["Enums"]["learning_result"]
          user_accepted?: boolean
          workspace_id: string
        }
        Update: {
          artifact_entity_id?: string | null
          assessment_method?: string
          created_at?: string
          criterion?: string
          entity_id?: string
          feedback?: string
          focus_session_id?: string | null
          learning_goal_id?: string
          result?: Database["public"]["Enums"]["learning_result"]
          user_accepted?: boolean
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_entity_workspace_fk"
            columns: ["entity_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "evidence_goal_workspace_fk"
            columns: ["learning_goal_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "learning_goals"
            referencedColumns: ["entity_id", "workspace_id"]
          },
          {
            foreignKeyName: "learning_evidence_artifact_entity_id_fkey"
            columns: ["artifact_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_evidence_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: true
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_evidence_focus_session_id_fkey"
            columns: ["focus_session_id"]
            isOneToOne: false
            referencedRelation: "focus_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_evidence_learning_goal_id_fkey"
            columns: ["learning_goal_id"]
            isOneToOne: false
            referencedRelation: "learning_goals"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "learning_evidence_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_goal_skills: {
        Row: {
          learning_goal_id: string
          skill_id: string
          workspace_id: string
        }
        Insert: {
          learning_goal_id: string
          skill_id: string
          workspace_id: string
        }
        Update: {
          learning_goal_id?: string
          skill_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_skills_goal_workspace_fk"
            columns: ["learning_goal_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "learning_goals"
            referencedColumns: ["entity_id", "workspace_id"]
          },
          {
            foreignKeyName: "goal_skills_skill_workspace_fk"
            columns: ["skill_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["entity_id", "workspace_id"]
          },
          {
            foreignKeyName: "learning_goal_skills_learning_goal_id_fkey"
            columns: ["learning_goal_id"]
            isOneToOne: false
            referencedRelation: "learning_goals"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "learning_goal_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "learning_goal_skills_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_goals: {
        Row: {
          achieved_at: string | null
          demonstration_criterion: string
          entity_id: string
          status: string
          workspace_id: string
        }
        Insert: {
          achieved_at?: string | null
          demonstration_criterion: string
          entity_id: string
          status?: string
          workspace_id: string
        }
        Update: {
          achieved_at?: string | null
          demonstration_criterion?: string
          entity_id?: string
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_entity_workspace_fk"
            columns: ["entity_id", "workspace_id"]
            isOneToOne: true
            referencedRelation: "entities"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "learning_goals_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: true
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_goals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_entries: {
        Row: {
          action_id: string | null
          content: string
          created_at: string
          goal_id: string
          id: string
          kind: string
          knowledge_entity_id: string | null
          legacy_source: string | null
          legacy_source_id: string | null
          workspace_id: string
        }
        Insert: {
          action_id?: string | null
          content: string
          created_at?: string
          goal_id: string
          id?: string
          kind: string
          knowledge_entity_id?: string | null
          legacy_source?: string | null
          legacy_source_id?: string | null
          workspace_id: string
        }
        Update: {
          action_id?: string | null
          content?: string
          created_at?: string
          goal_id?: string
          id?: string
          kind?: string
          knowledge_entity_id?: string | null
          legacy_source?: string | null
          legacy_source_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_entries_action_id_workspace_id_fkey"
            columns: ["action_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "progress_entries_goal_id_workspace_id_fkey"
            columns: ["goal_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "progress_entries_knowledge_entity_id_workspace_id_fkey"
            columns: ["knowledge_entity_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "progress_entries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_categories: {
        Row: {
          color: string
          default_preset: string | null
          id: string
          name: string
          workspace_id: string
        }
        Insert: {
          color?: string
          default_preset?: string | null
          id?: string
          name: string
          workspace_id: string
        }
        Update: {
          color?: string
          default_preset?: string | null
          id?: string
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_categories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          area_id: string | null
          completed_at: string | null
          constraints_md: string
          entity_id: string
          outcome: string
          status: Database["public"]["Enums"]["project_status"]
          workspace_id: string
        }
        Insert: {
          area_id?: string | null
          completed_at?: string | null
          constraints_md?: string
          entity_id: string
          outcome: string
          status?: Database["public"]["Enums"]["project_status"]
          workspace_id: string
        }
        Update: {
          area_id?: string | null
          completed_at?: string | null
          constraints_md?: string
          entity_id?: string
          outcome?: string
          status?: Database["public"]["Enums"]["project_status"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: true
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_entity_workspace_fk"
            columns: ["entity_id", "workspace_id"]
            isOneToOne: true
            referencedRelation: "entities"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_action_templates: {
        Row: {
          archived_at: string | null
          area_id: string | null
          checklist: Json
          created_at: string
          detail: string
          goal_id: string | null
          id: string
          last_materialized_on: string | null
          missed_policy: string
          recurrence_rule: Json
          skipped_occurrence_count: number
          starts_on: string
          status: string
          timezone: string
          title: string
          trashed_at: string | null
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          area_id?: string | null
          checklist?: Json
          created_at?: string
          detail?: string
          goal_id?: string | null
          id?: string
          last_materialized_on?: string | null
          missed_policy?: string
          recurrence_rule: Json
          skipped_occurrence_count?: number
          starts_on: string
          status?: string
          timezone?: string
          title: string
          trashed_at?: string | null
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          area_id?: string | null
          checklist?: Json
          created_at?: string
          detail?: string
          goal_id?: string | null
          id?: string
          last_materialized_on?: string | null
          missed_policy?: string
          recurrence_rule?: Json
          skipped_occurrence_count?: number
          starts_on?: string
          status?: string
          timezone?: string
          title?: string
          trashed_at?: string | null
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_action_templates_area_id_workspace_id_fkey"
            columns: ["area_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "recurring_action_templates_goal_id_workspace_id_fkey"
            columns: ["goal_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "recurring_action_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      requirements: {
        Row: {
          description: string
          entity_id: string
          project_id: string
          status: Database["public"]["Enums"]["requirement_status"]
          validation_evidence_entity_id: string | null
          workspace_id: string
        }
        Insert: {
          description: string
          entity_id: string
          project_id: string
          status?: Database["public"]["Enums"]["requirement_status"]
          validation_evidence_entity_id?: string | null
          workspace_id: string
        }
        Update: {
          description?: string
          entity_id?: string
          project_id?: string
          status?: Database["public"]["Enums"]["requirement_status"]
          validation_evidence_entity_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "requirements_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: true
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirements_entity_workspace_fk"
            columns: ["entity_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "requirements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "requirements_project_workspace_fk"
            columns: ["project_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["entity_id", "workspace_id"]
          },
          {
            foreignKeyName: "requirements_validation_evidence_entity_id_fkey"
            columns: ["validation_evidence_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      return_reminder_deliveries: {
        Row: {
          attempts: number
          lease_until: string
          local_date: string
          status: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          attempts?: number
          lease_until: string
          local_date: string
          status?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          attempts?: number
          lease_until?: string
          local_date?: string
          status?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_reminder_deliveries_workspace_id_user_id_fkey"
            columns: ["workspace_id", "user_id"]
            isOneToOne: false
            referencedRelation: "return_reminders"
            referencedColumns: ["workspace_id", "user_id"]
          },
        ]
      }
      return_reminders: {
        Row: {
          destination: string
          device_id: string
          enabled: boolean
          local_time: string
          subscription: Json
          timezone: string
          updated_at: string
          user_id: string
          weekdays: number[]
          workspace_id: string
        }
        Insert: {
          destination: string
          device_id: string
          enabled?: boolean
          local_time: string
          subscription: Json
          timezone: string
          updated_at?: string
          user_id?: string
          weekdays: number[]
          workspace_id: string
        }
        Update: {
          destination?: string
          device_id?: string
          enabled?: boolean
          local_time?: string
          subscription?: Json
          timezone?: string
          updated_at?: string
          user_id?: string
          weekdays?: number[]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_reminders_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          answers: Json
          command_ids: string[]
          completed_at: string
          completed_by: string
          id: string
          idempotency_key: string | null
          period_end_exclusive: string | null
          period_start: string | null
          revision: number
          snapshot: Json | null
          summary: string
          template_version: number
          type: Database["public"]["Enums"]["review_type"]
          workspace_id: string
          workspace_timezone: string | null
        }
        Insert: {
          answers?: Json
          command_ids?: string[]
          completed_at?: string
          completed_by: string
          id?: string
          idempotency_key?: string | null
          period_end_exclusive?: string | null
          period_start?: string | null
          revision?: number
          snapshot?: Json | null
          summary?: string
          template_version?: number
          type: Database["public"]["Enums"]["review_type"]
          workspace_id: string
          workspace_timezone?: string | null
        }
        Update: {
          answers?: Json
          command_ids?: string[]
          completed_at?: string
          completed_by?: string
          id?: string
          idempotency_key?: string | null
          period_end_exclusive?: string | null
          period_start?: string | null
          revision?: number
          snapshot?: Json | null
          summary?: string
          template_version?: number
          type?: Database["public"]["Enums"]["review_type"]
          workspace_id?: string
          workspace_timezone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_action_views: {
        Row: {
          created_at: string
          filter_version: number
          filters: Json
          id: string
          name: string
          position: number
          updated_at: string
          user_id: string
          version: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          filter_version?: number
          filters: Json
          id: string
          name: string
          position?: number
          updated_at?: string
          user_id?: string
          version?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          filter_version?: number
          filters?: Json
          id?: string
          name?: string
          position?: number
          updated_at?: string
          user_id?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_action_views_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          description: string
          entity_id: string
          workspace_id: string
        }
        Insert: {
          description?: string
          entity_id: string
          workspace_id: string
        }
        Update: {
          description?: string
          entity_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skills_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: true
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skills_entity_workspace_fk"
            columns: ["entity_id", "workspace_id"]
            isOneToOne: true
            referencedRelation: "entities"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "skills_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      wardrobe_garments: {
        Row: {
          category: string
          color: string
          created_at: string
          description: string | null
          favorite: boolean
          id: string
          image_path: string | null
          material: string | null
          name: string
          occasions: string[]
          season: string[]
          user_id: string
        }
        Insert: {
          category: string
          color: string
          created_at?: string
          description?: string | null
          favorite?: boolean
          id?: string
          image_path?: string | null
          material?: string | null
          name: string
          occasions?: string[]
          season?: string[]
          user_id: string
        }
        Update: {
          category?: string
          color?: string
          created_at?: string
          description?: string | null
          favorite?: boolean
          id?: string
          image_path?: string | null
          material?: string | null
          name?: string
          occasions?: string[]
          season?: string[]
          user_id?: string
        }
        Relationships: []
      }
      wardrobe_outfit_items: {
        Row: {
          garment_id: string
          outfit_id: string
          position: number
        }
        Insert: {
          garment_id: string
          outfit_id: string
          position?: number
        }
        Update: {
          garment_id?: string
          outfit_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "wardrobe_outfit_items_garment_id_fkey"
            columns: ["garment_id"]
            isOneToOne: false
            referencedRelation: "wardrobe_garments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wardrobe_outfit_items_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "wardrobe_outfits"
            referencedColumns: ["id"]
          },
        ]
      }
      wardrobe_outfits: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          occasion: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          occasion?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          occasion?: string | null
          user_id?: string
        }
        Relationships: []
      }
      wardrobe_planner_entries: {
        Row: {
          created_at: string
          id: string
          outfit_id: string
          plan_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          outfit_id: string
          plan_date: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          outfit_id?: string
          plan_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wardrobe_planner_entries_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "wardrobe_outfits"
            referencedColumns: ["id"]
          },
        ]
      }
      work_items: {
        Row: {
          blocker: string | null
          completed_at: string | null
          description: string
          entity_id: string
          primary_context_entity_id: string
          status: Database["public"]["Enums"]["work_item_status"]
          workspace_id: string
        }
        Insert: {
          blocker?: string | null
          completed_at?: string | null
          description?: string
          entity_id: string
          primary_context_entity_id: string
          status?: Database["public"]["Enums"]["work_item_status"]
          workspace_id: string
        }
        Update: {
          blocker?: string | null
          completed_at?: string | null
          description?: string
          entity_id?: string
          primary_context_entity_id?: string
          status?: Database["public"]["Enums"]["work_item_status"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_items_context_workspace_fk"
            columns: ["primary_context_entity_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "work_items_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: true
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_entity_workspace_fk"
            columns: ["entity_id", "workspace_id"]
            isOneToOne: true
            referencedRelation: "entities"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "work_items_primary_context_entity_id_fkey"
            columns: ["primary_context_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          role?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          ai_review_cache_hours: number
          ai_review_window_days: number
          archived_at: string | null
          created_at: string
          id: string
          name: string
          pending_deletion_at: string | null
          timezone: string
          wip_limit: number
        }
        Insert: {
          ai_review_cache_hours?: number
          ai_review_window_days?: number
          archived_at?: string | null
          created_at?: string
          id?: string
          name: string
          pending_deletion_at?: string | null
          timezone?: string
          wip_limit?: number
        }
        Update: {
          ai_review_cache_hours?: number
          ai_review_window_days?: number
          archived_at?: string | null
          created_at?: string
          id?: string
          name?: string
          pending_deletion_at?: string | null
          timezone?: string
          wip_limit?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_progress_checked: {
        Args: {
          command_idempotency_key: string
          progress_content: string
          progress_kind: string
          target_action_id: string
          target_goal_id: string
          target_knowledge_id: string
          target_progress_id: string
          target_workspace_id: string
        }
        Returns: {
          action_id: string | null
          content: string
          created_at: string
          goal_id: string
          id: string
          kind: string
          knowledge_entity_id: string | null
          legacy_source: string | null
          legacy_source_id: string | null
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "progress_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approve_ai_proposal: {
        Args: { command_idempotency_key: string; target_proposal_id: string }
        Returns: {
          created_at: string
          error_code: string | null
          finished_at: string | null
          id: string
          idempotency_key: string
          proposal_id: string
          requested_by: string
          status: Database["public"]["Enums"]["ai_execution_status"]
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "ai_executions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      capture_item: {
        Args: {
          capture_content: string
          capture_kind: Database["public"]["Enums"]["capture_kind"]
          command_idempotency_key: string
          target_workspace_id: string
        }
        Returns: {
          created_at: string
          created_by: string
          discarded_at: string | null
          id: string
          idempotency_key: string
          kind: Database["public"]["Enums"]["capture_kind"]
          raw_content: string
          resolved_at: string | null
          resolved_to_ids: string[]
          snoozed_until: string | null
          source_url: string | null
          status: Database["public"]["Enums"]["inbox_status"]
          sync_state: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "inbox_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_return_reminders: { Args: never; Returns: Json[] }
      complete_weekly_review: {
        Args: {
          command_idempotency_key: string
          review_summary: string
          target_workspace_id: string
        }
        Returns: {
          answers: Json
          command_ids: string[]
          completed_at: string
          completed_by: string
          id: string
          idempotency_key: string | null
          period_end_exclusive: string | null
          period_start: string | null
          revision: number
          snapshot: Json | null
          summary: string
          template_version: number
          type: Database["public"]["Enums"]["review_type"]
          workspace_id: string
          workspace_timezone: string | null
        }
        SetofOptions: {
          from: "*"
          to: "reviews"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_weekly_review_v2: {
        Args: {
          command_idempotency_key: string
          review_answers: Json
          review_summary: string
          selected_goal_ids: string[]
          target_workspace_id: string
        }
        Returns: {
          answers: Json
          command_ids: string[]
          completed_at: string
          completed_by: string
          id: string
          idempotency_key: string | null
          period_end_exclusive: string | null
          period_start: string | null
          revision: number
          snapshot: Json | null
          summary: string
          template_version: number
          type: Database["public"]["Enums"]["review_type"]
          workspace_id: string
          workspace_timezone: string | null
        }
        SetofOptions: {
          from: "*"
          to: "reviews"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_weekly_review_v3: {
        Args: {
          command_idempotency_key: string
          period_end_exclusive: string
          period_start: string
          review_answers: Json
          review_snapshot: Json
          review_summary: string
          review_timezone: string
          selected_goal_ids: string[]
          target_review_id: string
          target_workspace_id: string
        }
        Returns: {
          answers: Json
          command_ids: string[]
          completed_at: string
          completed_by: string
          id: string
          idempotency_key: string | null
          period_end_exclusive: string | null
          period_start: string | null
          revision: number
          snapshot: Json | null
          summary: string
          template_version: number
          type: Database["public"]["Enums"]["review_type"]
          workspace_id: string
          workspace_timezone: string | null
        }
        SetofOptions: {
          from: "*"
          to: "reviews"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_action_item: {
        Args: {
          action_detail: string
          action_material_links?: Json
          action_pinned_to_today: boolean
          action_scheduled_for: string
          action_title: string
          command_idempotency_key: string
          target_action_id: string
          target_area_id: string
          target_goal_id: string
          target_workspace_id: string
        }
        Returns: {
          archived_at: string | null
          area_id: string | null
          blocker: string | null
          cancelled_at: string | null
          checklist: Json
          completed_at: string | null
          created_at: string
          detail: string
          goal_id: string | null
          id: string
          is_next: boolean
          legacy_source_id: string | null
          occurrence_date: string | null
          pinned_to_today: boolean
          position: number
          recurring_template_id: string | null
          review_on: string | null
          scheduled_for: string | null
          skipped_at: string | null
          status: string
          title: string
          trashed_at: string | null
          updated_at: string
          version: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "actions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_goal_with_action: {
        Args: {
          command_idempotency_key: string
          first_action_detail: string
          first_action_title: string
          goal_kind: string
          goal_outcome: string
          goal_title: string
          target_action_id: string
          target_area_id: string
          target_goal_id: string
          target_workspace_id: string
        }
        Returns: {
          archived_at: string | null
          area_id: string | null
          created_at: string
          id: string
          kind: string
          legacy_source: string | null
          outcome: string
          priority: string
          status: string
          target_date: string | null
          template_id: string | null
          title: string
          trashed_at: string | null
          updated_at: string
          version: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "goals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_goal_with_action_v2: {
        Args: {
          command_idempotency_key: string
          first_action_detail: string
          first_action_title: string
          goal_criteria: Json
          goal_kind: string
          goal_material_links?: Json
          goal_outcome: string
          goal_title: string
          target_action_id: string
          target_area_id: string
          target_goal_id: string
          target_workspace_id: string
        }
        Returns: {
          archived_at: string | null
          area_id: string | null
          created_at: string
          id: string
          kind: string
          legacy_source: string | null
          outcome: string
          priority: string
          status: string
          target_date: string | null
          template_id: string | null
          title: string
          trashed_at: string | null
          updated_at: string
          version: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "goals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_knowledge_item: {
        Args: {
          command_idempotency_key: string
          knowledge_detail: string
          knowledge_kind: string
          knowledge_source_url: string
          knowledge_title: string
          target_knowledge_id: string
          target_workspace_id: string
        }
        Returns: string
      }
      create_knowledge_with_goal_links: {
        Args: {
          command_idempotency_key: string
          goal_links: Json
          knowledge_detail: string
          knowledge_kind: string
          knowledge_source_url: string
          knowledge_title: string
          link_meaning: string
          target_knowledge_id: string
          target_workspace_id: string
        }
        Returns: string
      }
      create_knowledge_with_relations: {
        Args: {
          command_idempotency_key: string
          knowledge_detail: string
          knowledge_kind: string
          knowledge_project_id: string
          knowledge_reading_status?: string
          knowledge_resource_author?: string
          knowledge_resource_format?: string
          knowledge_source_inbox_id: string
          knowledge_source_url: string
          knowledge_title: string
          relations: Json
          target_knowledge_id: string
          target_workspace_id: string
        }
        Returns: string
      }
      create_learning_goal: {
        Args: {
          command_idempotency_key: string
          goal_criterion: string
          goal_title: string
          skill_title: string
          target_workspace_id: string
        }
        Returns: string
      }
      create_recurring_action_template: {
        Args: {
          command_idempotency_key: string
          target_template_id: string
          target_workspace_id: string
          template_data: Json
        }
        Returns: {
          archived_at: string | null
          area_id: string | null
          checklist: Json
          created_at: string
          detail: string
          goal_id: string | null
          id: string
          last_materialized_on: string | null
          missed_policy: string
          recurrence_rule: Json
          skipped_occurrence_count: number
          starts_on: string
          status: string
          timezone: string
          title: string
          trashed_at: string | null
          updated_at: string
          version: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "recurring_action_templates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_shaped_project: {
        Args: {
          command_idempotency_key: string
          effort_budget_minutes: number
          first_work_item_description: string
          first_work_item_title: string
          project_outcome: string
          project_technology: string
          project_title: string
          target_workspace_id: string
        }
        Returns: string
      }
      delete_action_view: {
        Args: { expected_version: number; target_id: string }
        Returns: undefined
      }
      detach_reminder_device: {
        Args: { target_device_id: string }
        Returns: undefined
      }
      end_focus_session: {
        Args: {
          checkpoint_current_state?: string
          checkpoint_next_action?: string
          reason: Database["public"]["Enums"]["session_end_reason"]
          target_session_id: string
        }
        Returns: {
          end_reason: Database["public"]["Enums"]["session_end_reason"] | null
          ended_at: string | null
          id: string
          idempotency_key: string
          invalidated_at: string | null
          scratchpad: string
          started_at: string
          user_id: string
          work_item_id: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "focus_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finish_ai_run: {
        Args: {
          target_accounted_nano_usd: number
          target_attempts: number
          target_cost_is_estimate: boolean
          target_error_code: string
          target_input_tokens: number
          target_latency_ms: number
          target_output_tokens: number
          target_provider_request_id: string
          target_run_id: string
          target_status: string
        }
        Returns: undefined
      }
      get_action_item: { Args: { target_action_id: string }; Returns: Json }
      get_actions_filtered_page: {
        Args: {
          cursor_id?: string
          cursor_sort_value?: string
          page_size?: number
          target_goal_id?: string
          target_project_id?: string
          target_schedule?: string
          target_today?: string
          target_view?: string
          target_workspace_id: string
        }
        Returns: Json
      }
      get_actions_page: {
        Args: {
          cursor_id?: string
          cursor_sort_value?: string
          page_size?: number
          target_goal_id?: string
          target_project_id?: string
          target_today?: string
          target_view?: string
          target_workspace_id: string
        }
        Returns: Json
      }
      get_ai_context_data: {
        Args: {
          excluded_source_ids?: string[]
          extra_knowledge_ids?: string[]
          include_goal?: boolean
          include_knowledge?: boolean
          include_progress?: boolean
          include_project?: boolean
          target_id: string
          target_type: string
          target_workspace_id: string
        }
        Returns: Json
      }
      get_ai_goal_review_context: {
        Args: { target_workspace_id: string; window_days?: number }
        Returns: Json
      }
      get_ai_inbox_triage_context: {
        Args: { target_inbox_item_id: string; target_workspace_id: string }
        Returns: Json
      }
      get_completed_actions_page: {
        Args: {
          cursor_id?: string
          cursor_sort_value?: string
          page_size?: number
          target_workspace_id: string
        }
        Returns: Json
      }
      get_goal_progress_page: {
        Args: {
          cursor_id?: string
          cursor_sort_value?: string
          page_size?: number
          target_goal_id?: string
          target_workspace_id: string
        }
        Returns: Json
      }
      get_inbox_filtered_page: {
        Args: {
          cursor_id?: string
          cursor_sort_value?: string
          page_size?: number
          target_item_id?: string
          target_status?: string
          target_workspace_id: string
        }
        Returns: Json
      }
      get_inbox_page: {
        Args: {
          cursor_id?: string
          cursor_sort_value?: string
          page_size?: number
          target_workspace_id: string
        }
        Returns: Json
      }
      get_inbox_page_before_existing_knowledge: {
        Args: {
          cursor_id?: string
          cursor_sort_value?: string
          page_size?: number
          target_workspace_id: string
        }
        Returns: Json
      }
      get_knowledge_item: { Args: { target_item_id: string }; Returns: Json }
      get_knowledge_item_before_reading: {
        Args: { target_item_id: string }
        Returns: Json
      }
      get_knowledge_items: {
        Args: { target_item_ids: string[] }
        Returns: Json
      }
      get_knowledge_page: {
        Args: {
          cursor_id?: string
          cursor_sort_value?: string
          page_size?: number
          target_goal_id?: string
          target_knowledge_kind?: string
          target_project_id?: string
          target_reading_status?: string
          target_resource_format?: string
          target_revisit_on?: string
          target_search_text?: string
          target_visibility?: string
          target_workspace_id: string
        }
        Returns: Json
      }
      get_knowledge_suggestions: {
        Args: {
          excluded_item_ids?: string[]
          target_project_id?: string
          target_source_url?: string
          target_workspace_id: string
        }
        Returns: Json
      }
      get_legacy_focus_session: {
        Args: { target_session_id: string }
        Returns: Json
      }
      get_reviews_page: {
        Args: {
          cursor_id?: string
          cursor_sort_value?: string
          page_size?: number
          target_workspace_id: string
        }
        Returns: Json
      }
      get_waiting_actions_page: {
        Args: {
          cursor_id?: string
          cursor_sort_value?: string
          page_size?: number
          target_goal_id?: string
          target_project_id?: string
          target_today?: string
          target_view?: string
          target_workspace_id: string
        }
        Returns: Json
      }
      get_weekly_activity_page: {
        Args: {
          cursor_id?: string
          cursor_sort_value?: string
          page_size?: number
          period_end_exclusive: string
          period_start: string
          period_timezone: string
          target_activity_kind: string
          target_goal_id?: string
          target_project_id?: string
          target_workspace_id: string
        }
        Returns: Json
      }
      get_workspace_core: { Args: { target_user_id: string }; Returns: Json }
      get_workspace_weekly_summary: {
        Args: { target_workspace_id: string }
        Returns: Json
      }
      goal_backfill_counts: {
        Args: { target_workspace_id: string }
        Returns: Json
      }
      materialize_recurring_occurrence: {
        Args: {
          command_idempotency_key: string
          target_action_id: string
          target_occurrence_date: string
          target_template_id: string
          target_workspace_id: string
        }
        Returns: {
          archived_at: string | null
          area_id: string | null
          blocker: string | null
          cancelled_at: string | null
          checklist: Json
          completed_at: string | null
          created_at: string
          detail: string
          goal_id: string | null
          id: string
          is_next: boolean
          legacy_source_id: string | null
          occurrence_date: string | null
          pinned_to_today: boolean
          position: number
          recurring_template_id: string | null
          review_on: string | null
          scheduled_for: string | null
          skipped_at: string | null
          status: string
          title: string
          trashed_at: string | null
          updated_at: string
          version: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "actions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_action_result: {
        Args: {
          command_idempotency_key: string
          result_input: Json
          target_action_id: string
          target_knowledge_id: string
          target_link_id: string
          target_progress_id: string
          target_workspace_id: string
        }
        Returns: string
      }
      record_learning_evidence: {
        Args: {
          command_idempotency_key: string
          evidence_feedback: string
          evidence_result: Database["public"]["Enums"]["learning_result"]
          evidence_title: string
          target_focus_session_id: string
          target_learning_goal_id: string
          target_workspace_id: string
        }
        Returns: string
      }
      reject_ai_proposal: {
        Args: { command_idempotency_key: string; target_proposal_id: string }
        Returns: {
          command_args: Json
          command_name: string
          created_at: string
          decided_at: string | null
          expected_versions: Json
          expires_at: string
          id: string
          preview_diff: Json
          risk: string
          source_entity_ids: string[]
          status: Database["public"]["Enums"]["ai_proposal_status"]
          supersedes_id: string | null
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "ai_proposals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      release_ai_goal_review_claim: {
        Args: {
          target_context_hash: string
          target_model: string
          target_owner_token: string
          target_prompt_version: number
          target_provider: string
          target_schema_version: number
          target_window_days: number
          target_workspace_id: string
        }
        Returns: boolean
      }
      release_due_inbox_items: {
        Args: { command_idempotency_key: string; target_workspace_id: string }
        Returns: number
      }
      reserve_ai_run: {
        Args: {
          target_capability: string
          target_daily_budget_nano_usd: number
          target_daily_limit: number
          target_force_refresh: boolean
          target_input_chars: number
          target_input_price_nano_per_token: number
          target_model: string
          target_monthly_budget_nano_usd: number
          target_output_price_nano_per_token: number
          target_prompt_version: number
          target_provider: string
          target_reserved_nano_usd: number
          target_schema_version: number
          target_user_id: string
          target_workspace_id: string
        }
        Returns: string
      }
      resolve_inbox_item: {
        Args: { command_idempotency_key: string; target_inbox_item_id: string }
        Returns: {
          created_at: string
          created_by: string
          discarded_at: string | null
          id: string
          idempotency_key: string
          kind: Database["public"]["Enums"]["capture_kind"]
          raw_content: string
          resolved_at: string | null
          resolved_to_ids: string[]
          snoozed_until: string | null
          source_url: string | null
          status: Database["public"]["Enums"]["inbox_status"]
          sync_state: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "inbox_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_action_view: {
        Args: {
          expected_version: number
          target_filters: Json
          target_id: string
          target_name: string
          target_position: number
          target_workspace_id: string
        }
        Returns: undefined
      }
      search_workspace: {
        Args: { result_limit?: number; search_query: string }
        Returns: Json
      }
      set_action_status_checked:
        | {
            Args: {
              command_idempotency_key: string
              expected_version: number
              target_action_id: string
              target_blocker: string
              target_status: string
            }
            Returns: {
              archived_at: string | null
              area_id: string | null
              blocker: string | null
              cancelled_at: string | null
              checklist: Json
              completed_at: string | null
              created_at: string
              detail: string
              goal_id: string | null
              id: string
              is_next: boolean
              legacy_source_id: string | null
              occurrence_date: string | null
              pinned_to_today: boolean
              position: number
              recurring_template_id: string | null
              review_on: string | null
              scheduled_for: string | null
              skipped_at: string | null
              status: string
              title: string
              trashed_at: string | null
              updated_at: string
              version: number
              workspace_id: string
            }
            SetofOptions: {
              from: "*"
              to: "actions"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              command_idempotency_key: string
              target_action_id: string
              target_blocker: string
              target_status: string
            }
            Returns: {
              archived_at: string | null
              area_id: string | null
              blocker: string | null
              cancelled_at: string | null
              checklist: Json
              completed_at: string | null
              created_at: string
              detail: string
              goal_id: string | null
              id: string
              is_next: boolean
              legacy_source_id: string | null
              occurrence_date: string | null
              pinned_to_today: boolean
              position: number
              recurring_template_id: string | null
              review_on: string | null
              scheduled_for: string | null
              skipped_at: string | null
              status: string
              title: string
              trashed_at: string | null
              updated_at: string
              version: number
              workspace_id: string
            }
            SetofOptions: {
              from: "*"
              to: "actions"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      set_action_status_review_checked: {
        Args: {
          command_idempotency_key: string
          expected_version: number
          target_action_id: string
          target_blocker: string
          target_review_on: string
          target_status: string
        }
        Returns: {
          archived_at: string | null
          area_id: string | null
          blocker: string | null
          cancelled_at: string | null
          checklist: Json
          completed_at: string | null
          created_at: string
          detail: string
          goal_id: string | null
          id: string
          is_next: boolean
          legacy_source_id: string | null
          occurrence_date: string | null
          pinned_to_today: boolean
          position: number
          recurring_template_id: string | null
          review_on: string | null
          scheduled_for: string | null
          skipped_at: string | null
          status: string
          title: string
          trashed_at: string | null
          updated_at: string
          version: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "actions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_ai_goal_review_feedback: {
        Args: {
          target_rating: string
          target_recommendation_id: string
          target_review_id: string
          target_workspace_id: string
        }
        Returns: undefined
      }
      set_ai_inbox_triage_feedback: {
        Args: {
          target_proposal_id: string
          target_rating: string
          target_workspace_id: string
        }
        Returns: undefined
      }
      set_commitment_status: {
        Args: {
          command_idempotency_key: string
          target_project_id: string
          target_status: Database["public"]["Enums"]["commitment_status"]
        }
        Returns: {
          effort_budget_minutes: number | null
          effort_budget_sessions: number | null
          ended_at: string | null
          id: string
          is_primary: boolean
          override_reason: string | null
          started_at: string
          status: Database["public"]["Enums"]["commitment_status"]
          target_entity_id: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "commitments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_entity_visibility: {
        Args: {
          command_idempotency_key: string
          target_entity_id: string
          target_visibility: string
        }
        Returns: {
          archived_at: string | null
          created_at: string
          id: string
          title: string
          trashed_at: string | null
          type: Database["public"]["Enums"]["entity_type"]
          updated_at: string
          version: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "entities"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_goal_outcome_status: {
        Args: {
          change_reason: string
          command_idempotency_key: string
          target_goal_id: string
          target_progress_content: string
          target_progress_id: string
          target_status: string
        }
        Returns: {
          archived_at: string | null
          area_id: string | null
          created_at: string
          id: string
          kind: string
          legacy_source: string | null
          outcome: string
          priority: string
          status: string
          target_date: string | null
          template_id: string | null
          title: string
          trashed_at: string | null
          updated_at: string
          version: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "goals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_goal_visibility_checked: {
        Args: {
          command_idempotency_key: string
          target_goal_id: string
          target_visibility: string
        }
        Returns: {
          archived_at: string | null
          area_id: string | null
          created_at: string
          id: string
          kind: string
          legacy_source: string | null
          outcome: string
          priority: string
          status: string
          target_date: string | null
          template_id: string | null
          title: string
          trashed_at: string | null
          updated_at: string
          version: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "goals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_inbox_item_status: {
        Args: {
          command_idempotency_key: string
          target_inbox_item_id: string
          target_snoozed_until: string
          target_status: Database["public"]["Enums"]["inbox_status"]
        }
        Returns: {
          created_at: string
          created_by: string
          discarded_at: string | null
          id: string
          idempotency_key: string
          kind: Database["public"]["Enums"]["capture_kind"]
          raw_content: string
          resolved_at: string | null
          resolved_to_ids: string[]
          snoozed_until: string | null
          source_url: string | null
          status: Database["public"]["Enums"]["inbox_status"]
          sync_state: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "inbox_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_learning_goal_status: {
        Args: {
          change_reason: string
          command_idempotency_key: string
          target_goal_id: string
          target_status: string
        }
        Returns: {
          achieved_at: string | null
          demonstration_criterion: string
          entity_id: string
          status: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "learning_goals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_next_action_checked: {
        Args: {
          command_idempotency_key: string
          target_action_id: string
          target_goal_id: string
        }
        Returns: {
          archived_at: string | null
          area_id: string | null
          blocker: string | null
          cancelled_at: string | null
          checklist: Json
          completed_at: string | null
          created_at: string
          detail: string
          goal_id: string | null
          id: string
          is_next: boolean
          legacy_source_id: string | null
          occurrence_date: string | null
          pinned_to_today: boolean
          position: number
          recurring_template_id: string | null
          review_on: string | null
          scheduled_for: string | null
          skipped_at: string | null
          status: string
          title: string
          trashed_at: string | null
          updated_at: string
          version: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "actions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_recurring_action_template_status: {
        Args: {
          command_idempotency_key: string
          target_status: string
          target_template_id: string
        }
        Returns: {
          archived_at: string | null
          area_id: string | null
          checklist: Json
          created_at: string
          detail: string
          goal_id: string | null
          id: string
          last_materialized_on: string | null
          missed_policy: string
          recurrence_rule: Json
          skipped_occurrence_count: number
          starts_on: string
          status: string
          timezone: string
          title: string
          trashed_at: string | null
          updated_at: string
          version: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "recurring_action_templates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_focus_session: {
        Args: {
          command_idempotency_key: string
          target_work_item_id: string
          target_workspace_id: string
        }
        Returns: {
          end_reason: Database["public"]["Enums"]["session_end_reason"] | null
          ended_at: string | null
          id: string
          idempotency_key: string
          invalidated_at: string | null
          scratchpad: string
          started_at: string
          user_id: string
          work_item_id: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "focus_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      triage_existing_knowledge: {
        Args: {
          target_goal_id?: string
          target_inbox_id: string
          target_knowledge_id: string
          target_link_id?: string
          target_project_id?: string
        }
        Returns: undefined
      }
      triage_inbox_intent: {
        Args: {
          command_idempotency_key: string
          target_inbox_item_id: string
          target_intent: Json
          target_workspace_id: string
        }
        Returns: string
      }
      try_claim_ai_goal_review: {
        Args: {
          target_context_hash: string
          target_model: string
          target_owner_token: string
          target_prompt_version: number
          target_provider: string
          target_schema_version: number
          target_window_days: number
          target_workspace_id: string
        }
        Returns: boolean
      }
      undo_action_completion_checked: {
        Args: {
          command_idempotency_key: string
          expected_version: number
          restore_blocker: string
          restore_is_next: boolean
          restore_review_on: string
          restore_status: string
          target_action_id: string
          target_goal_id: string
        }
        Returns: {
          archived_at: string | null
          area_id: string | null
          blocker: string | null
          cancelled_at: string | null
          checklist: Json
          completed_at: string | null
          created_at: string
          detail: string
          goal_id: string | null
          id: string
          is_next: boolean
          legacy_source_id: string | null
          occurrence_date: string | null
          pinned_to_today: boolean
          position: number
          recurring_template_id: string | null
          review_on: string | null
          scheduled_for: string | null
          skipped_at: string | null
          status: string
          title: string
          trashed_at: string | null
          updated_at: string
          version: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "actions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      undo_capture: { Args: { target_id: string }; Returns: undefined }
      update_action_checked: {
        Args: {
          action_changes: Json
          command_idempotency_key: string
          expected_version: number
          target_action_id: string
        }
        Returns: {
          archived_at: string | null
          area_id: string | null
          blocker: string | null
          cancelled_at: string | null
          checklist: Json
          completed_at: string | null
          created_at: string
          detail: string
          goal_id: string | null
          id: string
          is_next: boolean
          legacy_source_id: string | null
          occurrence_date: string | null
          pinned_to_today: boolean
          position: number
          recurring_template_id: string | null
          review_on: string | null
          scheduled_for: string | null
          skipped_at: string | null
          status: string
          title: string
          trashed_at: string | null
          updated_at: string
          version: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "actions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_goal_details: {
        Args: {
          command_idempotency_key: string
          goal_changes: Json
          target_goal_id: string
        }
        Returns: {
          archived_at: string | null
          area_id: string | null
          created_at: string
          id: string
          kind: string
          legacy_source: string | null
          outcome: string
          priority: string
          status: string
          target_date: string | null
          template_id: string | null
          title: string
          trashed_at: string | null
          updated_at: string
          version: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "goals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_goal_details_checked: {
        Args: {
          command_idempotency_key: string
          expected_version: number
          goal_changes: Json
          target_goal_id: string
        }
        Returns: {
          archived_at: string | null
          area_id: string | null
          created_at: string
          id: string
          kind: string
          legacy_source: string | null
          outcome: string
          priority: string
          status: string
          target_date: string | null
          template_id: string | null
          title: string
          trashed_at: string | null
          updated_at: string
          version: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "goals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_knowledge_item: {
        Args: {
          command_idempotency_key: string
          goal_links: Json
          knowledge_changes: Json
          target_knowledge_id: string
        }
        Returns: string
      }
      update_knowledge_item_before_reading: {
        Args: {
          command_idempotency_key: string
          goal_links: Json
          knowledge_changes: Json
          target_knowledge_id: string
        }
        Returns: string
      }
      update_knowledge_item_checked: {
        Args: {
          command_idempotency_key: string
          expected_version: number
          goal_links: Json
          knowledge_changes: Json
          target_knowledge_id: string
        }
        Returns: string
      }
      update_recurring_action_template: {
        Args: {
          command_idempotency_key: string
          effective_from: string
          target_template_id: string
          template_changes: Json
          update_future_actions: boolean
        }
        Returns: {
          archived_at: string | null
          area_id: string | null
          checklist: Json
          created_at: string
          detail: string
          goal_id: string | null
          id: string
          last_materialized_on: string | null
          missed_policy: string
          recurrence_rule: Json
          skipped_occurrence_count: number
          starts_on: string
          status: string
          timezone: string
          title: string
          trashed_at: string | null
          updated_at: string
          version: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "recurring_action_templates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      ai_execution_status:
        | "queued"
        | "running"
        | "succeeded"
        | "failed"
        | "cancelled"
      ai_proposal_status:
        | "pending"
        | "approved"
        | "rejected"
        | "expired"
        | "superseded"
      capture_kind: "text" | "voice" | "link" | "file"
      commitment_status: "active" | "paused" | "released" | "fulfilled"
      entity_type:
        | "area"
        | "project"
        | "requirement"
        | "work_item"
        | "investigation"
        | "skill"
        | "learning_goal"
        | "learning_evidence"
        | "note"
        | "resource"
        | "decision"
        | "artifact"
      inbox_status: "unprocessed" | "snoozed" | "resolved" | "discarded"
      learning_result: "supports" | "reveals_gap" | "inconclusive"
      project_status:
        | "draft"
        | "shaped"
        | "validating"
        | "completed"
        | "abandoned"
      requirement_status:
        | "proposed"
        | "accepted"
        | "validated"
        | "rejected"
        | "superseded"
      review_type: "daily" | "weekly"
      session_end_reason:
        | "paused"
        | "work_item_completed"
        | "stopped"
        | "interrupted"
      work_item_status:
        | "open"
        | "in_progress"
        | "blocked"
        | "completed"
        | "cancelled"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ai_execution_status: [
        "queued",
        "running",
        "succeeded",
        "failed",
        "cancelled",
      ],
      ai_proposal_status: [
        "pending",
        "approved",
        "rejected",
        "expired",
        "superseded",
      ],
      capture_kind: ["text", "voice", "link", "file"],
      commitment_status: ["active", "paused", "released", "fulfilled"],
      entity_type: [
        "area",
        "project",
        "requirement",
        "work_item",
        "investigation",
        "skill",
        "learning_goal",
        "learning_evidence",
        "note",
        "resource",
        "decision",
        "artifact",
      ],
      inbox_status: ["unprocessed", "snoozed", "resolved", "discarded"],
      learning_result: ["supports", "reveals_gap", "inconclusive"],
      project_status: [
        "draft",
        "shaped",
        "validating",
        "completed",
        "abandoned",
      ],
      requirement_status: [
        "proposed",
        "accepted",
        "validated",
        "rejected",
        "superseded",
      ],
      review_type: ["daily", "weekly"],
      session_end_reason: [
        "paused",
        "work_item_completed",
        "stopped",
        "interrupted",
      ],
      work_item_status: [
        "open",
        "in_progress",
        "blocked",
        "completed",
        "cancelled",
      ],
    },
  },
} as const
