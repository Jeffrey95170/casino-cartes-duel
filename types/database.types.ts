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
      achievements: {
        Row: {
          code: string
          created_at: string
          description: string
          icon: string
          id: string
          name: string
          xp_bonus: number
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          icon: string
          id?: string
          name: string
          xp_bonus?: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name?: string
          xp_bonus?: number
        }
        Relationships: []
      }
      game_sessions: {
        Row: {
          created_at: string
          game_state: Json
          id: string
          match_id: string
          metrics: Json
          status: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          game_state: Json
          id?: string
          match_id: string
          metrics?: Json
          status?: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          game_state?: Json
          id?: string
          match_id?: string
          metrics?: Json
          status?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_sessions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_actions: {
        Row: {
          action_id: string
          action_kind: string
          created_at: string
          expected_version: number
          match_id: string
          result_version: number
          user_id: string
        }
        Insert: {
          action_id: string
          action_kind: string
          created_at?: string
          expected_version: number
          match_id: string
          result_version: number
          user_id: string
        }
        Update: {
          action_id?: string
          action_kind?: string
          created_at?: string
          expected_version?: number
          match_id?: string
          result_version?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_actions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_actions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          ai_difficulty: string | null
          cards_captured: number
          created_at: string
          finished_at: string | null
          id: string
          mode: string
          opponent_score: number | null
          opponent_type: string
          player_id: string
          player_score: number | null
          request_id: string
          started_at: string
          status: string
          verified: boolean
          winner: string | null
        }
        Insert: {
          ai_difficulty?: string | null
          cards_captured?: number
          created_at?: string
          finished_at?: string | null
          id?: string
          mode: string
          opponent_score?: number | null
          opponent_type?: string
          player_id: string
          player_score?: number | null
          request_id: string
          started_at?: string
          status?: string
          verified?: boolean
          winner?: string | null
        }
        Update: {
          ai_difficulty?: string | null
          cards_captured?: number
          created_at?: string
          finished_at?: string | null
          id?: string
          mode?: string
          opponent_score?: number | null
          opponent_type?: string
          player_id?: string
          player_score?: number | null
          request_id?: string
          started_at?: string
          status?: string
          verified?: boolean
          winner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_achievements: {
        Row: {
          achievement_id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_stats: {
        Row: {
          best_cards_captured: number
          best_win_streak: number
          created_at: string
          current_win_streak: number
          draws: number
          games_completed: number
          games_started: number
          level: number
          losses: number
          pvp_games: number
          pvp_rating: number
          solo_verified_games: number
          total_cards_captured: number
          updated_at: string
          user_id: string
          wins: number
          xp: number
        }
        Insert: {
          best_cards_captured?: number
          best_win_streak?: number
          created_at?: string
          current_win_streak?: number
          draws?: number
          games_completed?: number
          games_started?: number
          level?: number
          losses?: number
          pvp_games?: number
          pvp_rating?: number
          solo_verified_games?: number
          total_cards_captured?: number
          updated_at?: string
          user_id: string
          wins?: number
          xp?: number
        }
        Update: {
          best_cards_captured?: number
          best_win_streak?: number
          created_at?: string
          current_win_streak?: number
          draws?: number
          games_completed?: number
          games_started?: number
          level?: number
          losses?: number
          pvp_games?: number
          pvp_rating?: number
          solo_verified_games?: number
          total_cards_captured?: number
          updated_at?: string
          user_id?: string
          wins?: number
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          leaderboard_eligible: boolean
          updated_at: string
          username: string
          username_normalized: string | null
        }
        Insert: {
          created_at?: string
          id: string
          leaderboard_eligible?: boolean
          updated_at?: string
          username: string
          username_normalized?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          leaderboard_eligible?: boolean
          updated_at?: string
          username?: string
          username_normalized?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      abandon_solo_match_server: {
        Args: { p_match_id: string; p_user_id: string }
        Returns: boolean
      }
      commit_solo_action_server: {
        Args: {
          p_action_id: string
          p_action_kind: string
          p_action_metrics?: Json
          p_expected_version: number
          p_match_id: string
          p_new_state: Json
          p_user_id: string
        }
        Returns: Json
      }
      get_leaderboard: {
        Args: { p_limit?: number }
        Returns: {
          best_cards_captured: number
          games_completed: number
          is_current: boolean
          level: number
          rank: number
          username: string
          wins: number
          xp: number
        }[]
      }
      get_my_leaderboard_window: {
        Args: { p_radius?: number }
        Returns: {
          best_cards_captured: number
          games_completed: number
          is_current: boolean
          level: number
          rank: number
          username: string
          wins: number
          xp: number
        }[]
      }
      get_public_profile: { Args: { p_username: string }; Returns: Json }
      invalidate_solo_match_server: {
        Args: { p_match_id: string; p_reason: string; p_user_id: string }
        Returns: boolean
      }
      is_username_available: { Args: { candidate: string }; Returns: boolean }
      start_solo_match_server: {
        Args: {
          p_ai_difficulty?: string
          p_game_state: Json
          p_request_id: string
          p_user_id: string
        }
        Returns: Json
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
