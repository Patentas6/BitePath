export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      meal_plans: {
        Row: {
          created_at: string | null
          desired_servings: number | null
          id: string
          meal_id: string
          meal_type: string | null
          plan_date: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          desired_servings?: number | null
          id?: string
          meal_id: string
          meal_type?: string | null
          plan_date: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          desired_servings?: number | null
          id?: string
          meal_id?: string
          meal_type?: string | null
          plan_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plans_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_templates: {
        Row: {
          category: string | null
          created_at: string
          id: string
          image_url: string | null
          ingredients: string | null
          instructions: string | null
          meal_tags: string[] | null
          name: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          ingredients?: string | null
          instructions?: string | null
          meal_tags?: string[] | null
          name: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          ingredients?: string | null
          instructions?: string | null
          meal_tags?: string[] | null
          name?: string
        }
        Relationships: []
      }
      meals: {
        Row: {
          created_at: string | null
          estimated_calories: string | null
          id: string
          image_url: string | null
          ingredients: string | null
          instructions: string | null
          meal_tags: string[] | null
          name: string
          servings: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          estimated_calories?: string | null
          id?: string
          image_url?: string | null
          ingredients?: string | null
          instructions?: string | null
          meal_tags?: string[] | null
          name: string
          servings?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          estimated_calories?: string | null
          id?: string
          image_url?: string | null
          ingredients?: string | null
          instructions?: string | null
          meal_tags?: string[] | null
          name?: string
          servings?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ai_preferences: string | null
          first_name: string | null
          has_completed_tour: boolean | null
          id: string
          image_generation_count: number | null
          is_admin: boolean | null
          last_image_generation_reset: string | null
          last_name: string | null
          last_recipe_generation_reset: string | null
          preferred_unit_system: string | null
          recipe_generation_count: number | null
          track_calories: boolean | null
        }
        Insert: {
          ai_preferences?: string | null
          first_name?: string | null
          has_completed_tour?: boolean | null
          id: string
          image_generation_count?: number | null
          is_admin?: boolean | null
          last_image_generation_reset?: string | null
          last_name?: string | null
          last_recipe_generation_reset?: string | null
          preferred_unit_system?: string | null
          recipe_generation_count?: number | null
          track_calories?: boolean | null
        }
        Update: {
          ai_preferences?: string | null
          first_name?: string | null
          has_completed_tour?: boolean | null
          id?: string
          image_generation_count?: number | null
          is_admin?: boolean | null
          last_image_generation_reset?: string | null
          last_name?: string | null
          last_recipe_generation_reset?: string | null
          preferred_unit_system?: string | null
          recipe_generation_count?: number | null
          track_calories?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_unique_meal_tags: {
        Args: {
          p_user_id: string
        }
        Returns: string[]
      }
      handle_new_user: {
        Args: Record<PropertyKey, never>
        Returns: unknown
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

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database["public"]["Tables"] & Database["public"]["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"] &
        Database["public"]["Views"])
    ? (Database["public"]["Tables"] &
        Database["public"]["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof Database["public"]["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof Database["public"]["Enums"]
    ? Database["public"]["Enums"][PublicEnumNameOrOptions]
    : never