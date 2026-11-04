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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      agent_profiles: {
        Row: {
          address: string
          admin_notified?: boolean
          agency_name: string
          created_at: string | null
          district: string
          email: string
          email_verified: boolean
          full_name: string
          id: string
          mobile: string
          otp_verified_at?: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          state: string
          status: "unverified" | "pending" | "approved" | "rejected" | "suspended"
          suspension_reason: string | null
          updated_at: string | null
        }
        Insert: {
          address: string
          admin_notified?: boolean
          agency_name: string
          created_at?: string | null
          district: string
          email: string
          email_verified?: boolean
          full_name: string
          id: string
          mobile: string
          otp_verified_at?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state: string
          status?: "unverified" | "pending" | "approved" | "rejected" | "suspended"
          suspension_reason?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string
          admin_notified?: boolean
          agency_name?: string
          created_at?: string | null
          district?: string
          email?: string
          email_verified?: boolean
          full_name?: string
          id?: string
          mobile?: string
          otp_verified_at?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: string
          status?: "unverified" | "pending" | "approved" | "rejected" | "suspended"
          suspension_reason?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      managed_users: {
        Row: {
          age: number | null
          agent_id: string
          annual_income: number | null
          area: string | null
          category: string | null
          created_at: string | null
          disability_percentage: number | null
          district: string
          dob: string | null
          education: string | null
          email: string | null
          extra_criteria: Json | null
          family_size: number | null
          full_name: string
          gender: string
          has_disability: boolean | null
          id: string
          is_farmer: boolean | null
          is_student: boolean | null
          marital_status: string | null
          mobile: string | null
          occupation: string | null
          state: string
          updated_at: string | null
        }
        Insert: {
          age?: number | null
          agent_id: string
          annual_income?: number | null
          area?: string | null
          category?: string | null
          created_at?: string | null
          disability_percentage?: number | null
          district: string
          dob?: string | null
          education?: string | null
          email?: string | null
          extra_criteria?: Json | null
          family_size?: number | null
          full_name: string
          gender: string
          has_disability?: boolean | null
          id?: string
          is_farmer?: boolean | null
          is_student?: boolean | null
          marital_status?: string | null
          mobile?: string | null
          occupation?: string | null
          state: string
          updated_at?: string | null
        }
        Update: {
          age?: number | null
          agent_id?: string
          annual_income?: number | null
          area?: string | null
          category?: string | null
          created_at?: string | null
          disability_percentage?: number | null
          district?: string
          dob?: string | null
          education?: string | null
          email?: string | null
          extra_criteria?: Json | null
          family_size?: number | null
          full_name?: string
          gender?: string
          has_disability?: boolean | null
          id?: string
          is_farmer?: boolean | null
          is_student?: boolean | null
          marital_status?: string | null
          mobile?: string | null
          occupation?: string | null
          state?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      eligibility_check_history: {
        Row: {
          agent_id: string
          batch_id: string | null
          check_type: string
          created_at: string | null
          id: string
          status: string
          total_eligible_matches: number
          total_schemes_checked: number
          total_users: number
        }
        Insert: {
          agent_id: string
          batch_id?: string | null
          check_type?: string
          created_at?: string | null
          id?: string
          status?: string
          total_eligible_matches?: number
          total_schemes_checked?: number
          total_users?: number
        }
        Update: {
          agent_id?: string
          batch_id?: string | null
          check_type?: string
          created_at?: string | null
          id?: string
          status?: string
          total_eligible_matches?: number
          total_schemes_checked?: number
          total_users?: number
        }
        Relationships: []
      }
      user_scheme_matches: {
        Row: {
          agent_id: string
          check_id: string | null
          created_at: string | null
          id: string
          match_percentage: number
          missing_criteria: string[]
          missing_documents: string[]
          reasons: string[]
          scheme_id: string
          status: "eligible" | "ineligible" | "needs_verification"
          updated_at: string | null
          user_id: string
        }
        Insert: {
          agent_id: string
          check_id?: string | null
          created_at?: string | null
          id?: string
          match_percentage?: number
          missing_criteria?: string[]
          missing_documents?: string[]
          reasons?: string[]
          scheme_id: string
          status: "eligible" | "ineligible" | "needs_verification"
          updated_at?: string | null
          user_id: string
        }
        Update: {
          agent_id?: string
          check_id?: string | null
          created_at?: string | null
          id?: string
          match_percentage?: number
          missing_criteria?: string[]
          missing_documents?: string[]
          reasons?: string[]
          scheme_id?: string
          status?: "eligible" | "ineligible" | "needs_verification"
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      applications: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          scheme_id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          scheme_id: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          scheme_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_scheme_id_fkey"
            columns: ["scheme_id"]
            isOneToOne: false
            referencedRelation: "schemes"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          agent_id: string | null
          created_at: string | null
          doc_type: string
          file_name: string
          file_path: string
          id: string
          managed_user_id: string | null
          mime_type: string | null
          scheme_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string | null
          doc_type: string
          file_name: string
          file_path: string
          id?: string
          managed_user_id?: string | null
          mime_type?: string | null
          scheme_id?: string | null
          status?: string
          user_id?: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string | null
          doc_type?: string
          file_name?: string
          file_path?: string
          id?: string
          managed_user_id?: string | null
          mime_type?: string | null
          scheme_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          annual_income: number | null
          area: string | null
          avatar_url?: string | null
          category: string | null
          created_at: string | null
          district: string | null
          dob: string | null
          email: string | null
          family_size: number | null
          full_name: string | null
          gender: string | null
          has_disability: boolean | null
          id: string
          is_farmer: boolean | null
          is_student: boolean | null
          mobile: string | null
          occupation: string | null
          state: string | null
          updated_at: string | null
        }
        Insert: {
          annual_income?: number | null
          area?: string | null
          avatar_url?: string | null
          category?: string | null
          created_at?: string | null
          district?: string | null
          dob?: string | null
          email?: string | null
          family_size?: number | null
          full_name?: string | null
          gender?: string | null
          has_disability?: boolean | null
          id: string
          is_farmer?: boolean | null
          is_student?: boolean | null
          mobile?: string | null
          occupation?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          annual_income?: number | null
          area?: string | null
          avatar_url?: string | null
          category?: string | null
          created_at?: string | null
          district?: string | null
          dob?: string | null
          email?: string | null
          family_size?: number | null
          full_name?: string | null
          gender?: string | null
          has_disability?: boolean | null
          id?: string
          is_farmer?: boolean | null
          is_student?: boolean | null
          mobile?: string | null
          occupation?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      schemes: {
        Row: {
          application_video_url: string | null
          apply_url: string
          benefits: string
          category: string
          created_at: string | null
          description: string
          eligibility: Json
          eligibility_text: string
          id: string
          level: string
          ministry: string
          name: string
          required_documents: string[]
          state: string | null
          video_type: string | null
        }
        Insert: {
          application_video_url?: string | null
          apply_url?: string
          benefits?: string
          category?: string
          created_at?: string | null
          description?: string
          eligibility?: Json
          eligibility_text?: string
          id?: string
          level?: string
          ministry?: string
          name: string
          required_documents?: string[]
          state?: string | null
          video_type?: string | null
        }
        Update: {
          application_video_url?: string | null
          apply_url?: string
          benefits?: string
          category?: string
          created_at?: string | null
          description?: string
          eligibility?: Json
          eligibility_text?: string
          id?: string
          level?: string
          ministry?: string
          name?: string
          required_documents?: string[]
          state?: string | null
          video_type?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      complete_agent_email_verification: {
        Args: {
          _user_id: string
        }
        Returns: Database["public"]["Tables"]["agent_profiles"]["Row"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "agent"
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
      app_role: ["admin", "user"],
    },
  },
} as const
