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
          promo_code: string | null
          receipt_path: string | null
          shipping_address: Json
          shipping_fee: number
          status: string
          sticker_bundle_discount: number
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          subtotal: number
          total_amount: number
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
          promo_code?: string | null
          receipt_path?: string | null
          shipping_address?: Json
          shipping_fee: number
          status?: string
          sticker_bundle_discount?: number
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal: number
          total_amount: number
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
          promo_code?: string | null
          receipt_path?: string | null
          shipping_address?: Json
          shipping_fee?: number
          status?: string
          sticker_bundle_discount?: number
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal?: number
          total_amount?: number
          tracking_number?: string | null
          user_id?: string | null
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
          sale_price: number | null
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
          sale_price?: number | null
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
          sale_price?: number | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      redeem_promo_code: { Args: { _code: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
      promo_discount_type: ["percentage", "fixed_amount"],
    },
  },
} as const
