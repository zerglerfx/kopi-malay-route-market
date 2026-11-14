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
      cart_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          selected_variant: string
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          selected_variant?: string
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          selected_variant?: string
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          selected_variant: string
          unit_price: number
        }
        Insert: {
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          selected_variant?: string
          unit_price: number
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          selected_variant?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_pos_operations: {
        Row: {
          completed_at: string | null
          confirmed_by: string | null
          created_at: string
          cycle: number
          error: string | null
          id: string
          kind: string
          order_id: string
          original_receipt_number: string | null
          payload: Json
          promo_thb: number | null
          receipt_number: string | null
          return_to_stock: boolean | null
          state: string
          total_thb: number | null
          writeoff_state: string
          writeoff_targets: Json | null
        }
        Insert: {
          completed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          cycle: number
          error?: string | null
          id?: string
          kind: string
          order_id: string
          original_receipt_number?: string | null
          payload?: Json
          promo_thb?: number | null
          receipt_number?: string | null
          return_to_stock?: boolean | null
          state?: string
          total_thb?: number | null
          writeoff_state?: string
          writeoff_targets?: Json | null
        }
        Update: {
          completed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          cycle?: number
          error?: string | null
          id?: string
          kind?: string
          order_id?: string
          original_receipt_number?: string | null
          payload?: Json
          promo_thb?: number | null
          receipt_number?: string | null
          return_to_stock?: boolean | null
          state?: string
          total_thb?: number | null
          writeoff_state?: string
          writeoff_targets?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "order_pos_operations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          changed_by_email: string
          from_status: string | null
          id: string
          notes: string | null
          old_tracking_number: string | null
          order_id: string
          order_number: string
          pos_receipt_number: string | null
          to_status: string
          tracking_number: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          changed_by_email?: string
          from_status?: string | null
          id?: string
          notes?: string | null
          old_tracking_number?: string | null
          order_id: string
          order_number: string
          pos_receipt_number?: string | null
          to_status: string
          tracking_number?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          changed_by_email?: string
          from_status?: string | null
          id?: string
          notes?: string | null
          old_tracking_number?: string | null
          order_id?: string
          order_number?: string
          pos_receipt_number?: string | null
          to_status?: string
          tracking_number?: string | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          access_token: string | null
          created_at: string
          currency: string
          discount_amount: number
          guest_email: string | null
          id: string
          order_number: string
          parcel_weight_complete: boolean | null
          parcel_weight_kg: number | null
          payment_method: string
          pos_claim_id: string | null
          pos_claim_until: string | null
          pos_receipt_snapshot: Json | null
          pre_claim_status: string | null
          pre_claim_stock_status: string | null
          promo_code: string | null
          promo_snapshot: Json | null
          receipt_path: string | null
          sale_discount: number
          shipping_address: Json
          shipping_fee: number
          status: string
          sticker_bundle_discount: number
          stock_deducted_at: string | null
          stock_deductions: Json
          stock_restored_at: string | null
          stock_status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          subtotal: number
          total_amount: number
          tracking_label_path: string | null
          tracking_number: string | null
          user_id: string | null
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          currency?: string
          discount_amount?: number
          guest_email?: string | null
          id?: string
          order_number: string
          parcel_weight_complete?: boolean | null
          parcel_weight_kg?: number | null
          payment_method?: string
          pos_claim_id?: string | null
          pos_claim_until?: string | null
          pos_receipt_snapshot?: Json | null
          pre_claim_status?: string | null
          pre_claim_stock_status?: string | null
          promo_code?: string | null
          promo_snapshot?: Json | null
          receipt_path?: string | null
          sale_discount?: number
          shipping_address?: Json
          shipping_fee: number
          status?: string
          sticker_bundle_discount?: number
          stock_deducted_at?: string | null
          stock_deductions?: Json
          stock_restored_at?: string | null
          stock_status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal: number
          total_amount: number
          tracking_label_path?: string | null
          tracking_number?: string | null
          user_id?: string | null
        }
        Update: {
          access_token?: string | null
          created_at?: string
          currency?: string
          discount_amount?: number
          guest_email?: string | null
          id?: string
          order_number?: string
          parcel_weight_complete?: boolean | null
          parcel_weight_kg?: number | null
          payment_method?: string
          pos_claim_id?: string | null
          pos_claim_until?: string | null
          pos_receipt_snapshot?: Json | null
          pre_claim_status?: string | null
          pre_claim_stock_status?: string | null
          promo_code?: string | null
          promo_snapshot?: Json | null
          receipt_path?: string | null
          sale_discount?: number
          shipping_address?: Json
          shipping_fee?: number
          status?: string
          sticker_bundle_discount?: number
          stock_deducted_at?: string | null
          stock_deductions?: Json
          stock_restored_at?: string | null
          stock_status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal?: number
          total_amount?: number
          tracking_label_path?: string | null
          tracking_number?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      owner_pin_codes: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          expires_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          expires_at: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          expires_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      owner_pins: {
        Row: {
          failed_attempts: number
          locked_until: string | null
          pin_hash: string
          salt: string
          updated_at: string
          user_id: string
        }
        Insert: {
          failed_attempts?: number
          locked_until?: string | null
          pin_hash: string
          salt: string
          updated_at?: string
          user_id: string
        }
        Update: {
          failed_attempts?: number
          locked_until?: string | null
          pin_hash?: string
          salt?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_stock: {
        Row: {
          id: string
          in_stock: number
          loyverse_variant_id: string
          product_id: string
          size: string
          synced_at: string | null
        }
        Insert: {
          id?: string
          in_stock?: number
          loyverse_variant_id: string
          product_id: string
          size?: string
          synced_at?: string | null
        }
        Update: {
          id?: string
          in_stock?: number
          loyverse_variant_id?: string
          product_id?: string
          size?: string
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string
          created_at: string
          description: string
          id: string
          images: string[]
          is_active: boolean
          is_featured: boolean
          is_new_arrival: boolean
          name: string
          price: number
          price_thb: number | null
          receipt_thb_rm_sale: number | null
          sale_price: number | null
          sale_price_thb: number | null
          slug: string
          stock_qty: number
          variants: Json
          weight_kg: number | null
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string
          id?: string
          images?: string[]
          is_active?: boolean
          is_featured?: boolean
          is_new_arrival?: boolean
          name: string
          price: number
          price_thb?: number | null
          receipt_thb_rm_sale?: number | null
          sale_price?: number | null
          sale_price_thb?: number | null
          slug: string
          stock_qty?: number
          variants?: Json
          weight_kg?: number | null
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string
          id?: string
          images?: string[]
          is_active?: boolean
          is_featured?: boolean
          is_new_arrival?: boolean
          name?: string
          price?: number
          price_thb?: number | null
          receipt_thb_rm_sale?: number | null
          sale_price?: number | null
          sale_price_thb?: number | null
          slug?: string
          stock_qty?: number
          variants?: Json
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string
          city: string
          contact_handle: string
          country: string
          created_at: string
          full_name: string
          id: string
          motorcycle_make: string
          motorcycle_model: string
          motorcycle_plate: string
          phone: string
          postcode: string
          preferred_contact: string
          state: string
          updated_at: string
        }
        Insert: {
          address?: string
          city?: string
          contact_handle?: string
          country?: string
          created_at?: string
          full_name?: string
          id: string
          motorcycle_make?: string
          motorcycle_model?: string
          motorcycle_plate?: string
          phone?: string
          postcode?: string
          preferred_contact?: string
          state?: string
          updated_at?: string
        }
        Update: {
          address?: string
          city?: string
          contact_handle?: string
          country?: string
          created_at?: string
          full_name?: string
          id?: string
          motorcycle_make?: string
          motorcycle_model?: string
          motorcycle_plate?: string
          phone?: string
          postcode?: string
          preferred_contact?: string
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string
          current_uses: number
          discount_myr: number | null
          discount_thb: number | null
          discount_type: Database["public"]["Enums"]["promo_discount_type"]
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          min_order_myr: number | null
          min_order_thb: number | null
          receipt_discount_thb: number | null
        }
        Insert: {
          code: string
          created_at?: string
          current_uses?: number
          discount_myr?: number | null
          discount_thb?: number | null
          discount_type: Database["public"]["Enums"]["promo_discount_type"]
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_order_myr?: number | null
          min_order_thb?: number | null
          receipt_discount_thb?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          current_uses?: number
          discount_myr?: number | null
          discount_thb?: number | null
          discount_type?: Database["public"]["Enums"]["promo_discount_type"]
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_order_myr?: number | null
          min_order_thb?: number | null
          receipt_discount_thb?: number | null
        }
        Relationships: []
      }
      shared_stock_links: {
        Row: {
          loyverse_variant_id: string
          product_id: string
        }
        Insert: {
          loyverse_variant_id: string
          product_id: string
        }
        Update: {
          loyverse_variant_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_stock_links_loyverse_variant_id_fkey"
            columns: ["loyverse_variant_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["loyverse_variant_id"]
          },
          {
            foreignKeyName: "shared_stock_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      towing_requests: {
        Row: {
          breakdown_location: string
          created_at: string
          destination: string
          id: string
          motorcycle_model: string
          name: string
          phone: string
          pickup_lat: number | null
          pickup_lng: number | null
          plate_number: string
          reference: string
          status: string
          user_id: string | null
        }
        Insert: {
          breakdown_location: string
          created_at?: string
          destination: string
          id?: string
          motorcycle_model: string
          name: string
          phone: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          plate_number: string
          reference: string
          status?: string
          user_id?: string | null
        }
        Update: {
          breakdown_location?: string
          created_at?: string
          destination?: string
          id?: string
          motorcycle_model?: string
          name?: string
          phone?: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          plate_number?: string
          reference?: string
          status?: string
          user_id?: string | null
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
      wishlist_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_owner_pin_code: {
        Args: { _hash: string; _user: string }
        Returns: string
      }
      claim_order_pos: {
        Args: { _busy: string; _claim: string; _id: string; _prev: string }
        Returns: boolean
      }
      claim_order_reverse: {
        Args: { _allowed: string[]; _claim: string; _id: string }
        Returns: string
      }
      claim_order_verify: {
        Args: { _claim: string; _id: string }
        Returns: string
      }
      designated_google_admin_matches: {
        Args: {
          _confirmed_at: string
          _email: string
          _email_verified: boolean
          _identity_email: string
          _provider: string
        }
        Returns: boolean
      }
      finish_order_reverse: {
        Args: {
          _actor: string
          _actor_email: string
          _claim: string
          _id: string
          _notes: string
          _pos_receipt: string
          _stock: string
          _to: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      issue_owner_pin_code: {
        Args: { _hash: string; _user: string }
        Returns: string
      }
      redeem_promo_code: { Args: { _code: string }; Returns: boolean }
      register_owner_pin_failure: { Args: { _user: string }; Returns: string }
      release_order_reverse: {
        Args: { _claim: string; _id: string }
        Returns: boolean
      }
      transition_order_status: {
        Args: {
          _actor: string
          _actor_email: string
          _claim?: string
          _deltas?: Json
          _from: string
          _id: string
          _notes?: string
          _pos_receipt?: string
          _to: string
          _tracking?: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "owner"
      promo_discount_type: "percentage" | "fixed_amount"
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
      app_role: ["admin", "user", "owner"],
      promo_discount_type: ["percentage", "fixed_amount"],
    },
  },
} as const
