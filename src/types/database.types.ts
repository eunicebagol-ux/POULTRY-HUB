export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "ADMIN" | "STAFF" | "CUSTOMER";
export type EggSize = "SMALL" | "MEDIUM" | "LARGE" | "EXTRA_LARGE" | "JUMBO" | "UNGRADED";
export type PackagingType = "PIECE" | "TRAY_30" | "CARTON_12" | "BOX_360";
export type EntryType = "STANDARD" | "CORRECTION_REVERSAL";
export type EggTransactionType = "PRODUCTION" | "SALE" | "ADJUSTMENT" | "CORRECTION";
export type FeedTransactionType = "STOCK_RECEIVED" | "CONSUMPTION" | "ADJUSTMENT" | "CORRECTION";
export type FlockStatus = "ACTIVE" | "RETIRED" | "QUARANTINED";
export type PaymentMethod = "CASH" | "BANK_TRANSFER" | "CHECK" | "E_WALLET";
export type PaymentStatus = "PENDING" | "PARTIAL" | "PAID" | "CANCELLED";
export type CustomerOrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "COMPLETED"
  | "CANCELLED";
export type CustomerPaymentMethod =
  | "GCASH"
  | "BANK_TRANSFER"
  | "CASH_ON_DELIVERY";
export type CustomerPaymentStatus =
  | "PENDING_SUBMISSION"
  | "SUBMITTED"
  | "VERIFIED"
  | "REJECTED"
  | "REFUNDED";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          full_name: string;
          phone: string | null;
          avatar_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: UserRole;
          full_name: string;
          phone?: string | null;
          avatar_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: UserRole;
          full_name?: string;
          phone?: string | null;
          avatar_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      flocks: {
        Row: {
          id: string;
          flock_identifier: string;
          breed: string | null;
          acquisition_date: string;
          initial_bird_count: number;
          current_bird_count: number;
          status: FlockStatus;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          flock_identifier: string;
          breed?: string | null;
          acquisition_date: string;
          initial_bird_count: number;
          current_bird_count: number;
          status?: FlockStatus;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          flock_identifier?: string;
          breed?: string | null;
          acquisition_date?: string;
          initial_bird_count?: number;
          current_bird_count?: number;
          status?: FlockStatus;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "flocks_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      flock_mortality: {
        Row: {
          id: string;
          flock_id: string;
          quantity: number;
          event_date: string;
          reason: string | null;
          entry_record_type: EntryType;
          reference_entry_id: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          flock_id: string;
          quantity: number;
          event_date: string;
          reason?: string | null;
          entry_record_type?: EntryType;
          reference_entry_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          flock_id?: string;
          quantity?: number;
          event_date?: string;
          reason?: string | null;
          entry_record_type?: EntryType;
          reference_entry_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "flock_mortality_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "flock_mortality_flock_id_fkey";
            columns: ["flock_id"];
            isOneToOne: false;
            referencedRelation: "flocks";
            referencedColumns: ["id"];
          }
        ];
      };
      flock_culling: {
        Row: {
          id: string;
          flock_id: string;
          quantity: number;
          event_date: string;
          reason: string | null;
          entry_record_type: EntryType;
          reference_entry_id: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          flock_id: string;
          quantity: number;
          event_date: string;
          reason?: string | null;
          entry_record_type?: EntryType;
          reference_entry_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          flock_id?: string;
          quantity?: number;
          event_date?: string;
          reason?: string | null;
          entry_record_type?: EntryType;
          reference_entry_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "flock_culling_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "flock_culling_flock_id_fkey";
            columns: ["flock_id"];
            isOneToOne: false;
            referencedRelation: "flocks";
            referencedColumns: ["id"];
          }
        ];
      };
      egg_production: {
        Row: {
          id: string;
          flock_id: string;
          production_date: string;
          collection_shift: string | null;
          total_eggs: number;
          good_eggs: number;
          damaged_eggs: number;
          cracked_eggs: number;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          flock_id: string;
          production_date: string;
          collection_shift?: string | null;
          total_eggs: number;
          good_eggs: number;
          damaged_eggs: number;
          cracked_eggs: number;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          flock_id?: string;
          production_date?: string;
          collection_shift?: string | null;
          total_eggs?: number;
          good_eggs?: number;
          damaged_eggs?: number;
          cracked_eggs?: number;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "egg_production_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "egg_production_flock_id_fkey";
            columns: ["flock_id"];
            isOneToOne: false;
            referencedRelation: "flocks";
            referencedColumns: ["id"];
          }
        ];
      };
      egg_production_sizes: {
        Row: {
          id: string;
          production_id: string;
          size: EggSize;
          quantity: number;
        };
        Insert: {
          id?: string;
          production_id: string;
          size: EggSize;
          quantity: number;
        };
        Update: {
          id?: string;
          production_id?: string;
          size?: EggSize;
          quantity?: number;
        };
        Relationships: [
          {
            foreignKeyName: "egg_production_sizes_production_id_fkey";
            columns: ["production_id"];
            isOneToOne: false;
            referencedRelation: "egg_production";
            referencedColumns: ["id"];
          }
        ];
      };
      egg_inventory: {
        Row: {
          id: string;
          size: EggSize;
          stock_pieces: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          size: EggSize;
          stock_pieces?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          size?: EggSize;
          stock_pieces?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      egg_inventory_transactions: {
        Row: {
          id: string;
          size: EggSize;
          quantity: number;
          transaction_type: EggTransactionType;
          reference_id: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          size: EggSize;
          quantity: number;
          transaction_type: EggTransactionType;
          reference_id?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          size?: EggSize;
          quantity?: number;
          transaction_type?: EggTransactionType;
          reference_id?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "egg_inventory_transactions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      feed_inventory: {
        Row: {
          id: string;
          feed_type: string;
          current_stock_kg: number;
          cost_per_kg: number | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          feed_type: string;
          current_stock_kg?: number;
          cost_per_kg?: number | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          feed_type?: string;
          current_stock_kg?: number;
          cost_per_kg?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      feed_inventory_transactions: {
        Row: {
          id: string;
          feed_type: string;
          quantity_kg: number;
          transaction_type: FeedTransactionType;
          reference_id: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          feed_type: string;
          quantity_kg: number;
          transaction_type: FeedTransactionType;
          reference_id?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          feed_type?: string;
          quantity_kg?: number;
          transaction_type?: FeedTransactionType;
          reference_id?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "feed_inventory_transactions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      feed_consumption: {
        Row: {
          id: string;
          flock_id: string;
          feed_type: string;
          quantity_kg: number;
          consumption_date: string;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          flock_id: string;
          feed_type: string;
          quantity_kg: number;
          consumption_date: string;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          flock_id?: string;
          feed_type?: string;
          quantity_kg?: number;
          consumption_date?: string;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "feed_consumption_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "feed_consumption_flock_id_fkey";
            columns: ["flock_id"];
            isOneToOne: false;
            referencedRelation: "flocks";
            referencedColumns: ["id"];
          }
        ];
      };
      customers: {
        Row: {
          id: string;
          name: string;
          contact_person: string | null;
          phone: string | null;
          email: string | null;
          address: string | null;
          is_active: boolean;
          clerk_user_id?: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          contact_person?: string | null;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          is_active?: boolean;
          clerk_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          contact_person?: string | null;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          is_active?: boolean;
          clerk_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      suppliers: {
        Row: {
          id: string;
          name: string;
          contact_person: string | null;
          phone: string | null;
          email: string | null;
          address: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          contact_person?: string | null;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          contact_person?: string | null;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      egg_sales: {
        Row: {
          id: string;
          invoice_number: string | null;
          customer_id: string | null;
          sale_date: string;
          subtotal: number;
          discount: number;
          total_amount: number;
          status: string;
          payment_status: PaymentStatus;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          invoice_number?: string | null;
          customer_id?: string | null;
          sale_date: string;
          subtotal: number;
          discount?: number;
          total_amount: number;
          status?: string;
          payment_status?: PaymentStatus;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          invoice_number?: string | null;
          customer_id?: string | null;
          sale_date?: string;
          subtotal?: number;
          discount?: number;
          total_amount?: number;
          status?: string;
          payment_status?: PaymentStatus;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "egg_sales_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "egg_sales_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          }
        ];
      };
      egg_sale_items: {
        Row: {
          id: string;
          sale_id: string;
          size: EggSize;
          packaging: PackagingType;
          package_quantity: number;
          total_pieces: number;
          unit_price: number;
          line_total: number;
        };
        Insert: {
          id?: string;
          sale_id: string;
          size: EggSize;
          packaging: PackagingType;
          package_quantity: number;
          total_pieces: number;
          unit_price: number;
          line_total: number;
        };
        Update: {
          id?: string;
          sale_id?: string;
          size?: EggSize;
          packaging?: PackagingType;
          package_quantity?: number;
          total_pieces?: number;
          unit_price?: number;
          line_total?: number;
        };
        Relationships: [
          {
            foreignKeyName: "egg_sale_items_sale_id_fkey";
            columns: ["sale_id"];
            isOneToOne: false;
            referencedRelation: "egg_sales";
            referencedColumns: ["id"];
          }
        ];
      };
      payments: {
        Row: {
          id: string;
          sale_id: string;
          amount: number;
          payment_method: PaymentMethod;
          payment_date: string;
          reference_number: string | null;
          notes: string | null;
          recorded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          sale_id: string;
          amount: number;
          payment_method: PaymentMethod;
          payment_date: string;
          reference_number?: string | null;
          notes?: string | null;
          recorded_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          sale_id?: string;
          amount?: number;
          payment_method?: PaymentMethod;
          payment_date?: string;
          reference_number?: string | null;
          notes?: string | null;
          recorded_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_sale_id_fkey";
            columns: ["sale_id"];
            isOneToOne: false;
            referencedRelation: "egg_sales";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      expenses: {
        Row: {
          id: string;
          expense_date: string;
          category: string;
          amount: number;
          description: string | null;
          supplier_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          expense_date: string;
          category: string;
          amount: number;
          description?: string | null;
          supplier_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          expense_date?: string;
          category?: string;
          amount?: number;
          description?: string | null;
          supplier_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          }
        ];
      };
      activity_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          entity_table: string;
          entity_id: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: string;
          entity_table: string;
          entity_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          action?: string;
          entity_table?: string;
          entity_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      system_settings: {
        Row: {
          id: string;
          setting_key: string;
          setting_value: Json;
          description: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          setting_key: string;
          setting_value: Json;
          description?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          setting_key?: string;
          setting_value?: Json;
          description?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      customer_orders: {
        Row: {
          id: string;
          customer_id: string;
          status: CustomerOrderStatus;
          requested_date: string | null;
          sale_id: string | null;
          notes: string | null;
          admin_notes: string | null;
          cancellation_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          status?: CustomerOrderStatus;
          requested_date?: string | null;
          sale_id?: string | null;
          notes?: string | null;
          admin_notes?: string | null;
          cancellation_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          status?: CustomerOrderStatus;
          requested_date?: string | null;
          sale_id?: string | null;
          notes?: string | null;
          admin_notes?: string | null;
          cancellation_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_orders_sale_id_fkey";
            columns: ["sale_id"];
            isOneToOne: false;
            referencedRelation: "egg_sales";
            referencedColumns: ["id"];
          }
        ];
      };
      customer_order_items: {
        Row: {
          id: string;
          order_id: string;
          size: EggSize;
          packaging: PackagingType;
          package_quantity: number;
          requested_pieces: number;
          quoted_unit_price: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          size: EggSize;
          packaging: PackagingType;
          package_quantity: number;
          requested_pieces: number;
          quoted_unit_price: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          size?: EggSize;
          packaging?: PackagingType;
          package_quantity?: number;
          requested_pieces?: number;
          quoted_unit_price?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "customer_orders";
            referencedColumns: ["id"];
          }
        ];
      };
      egg_price_catalog: {
        Row: {
          size: EggSize;
          price_per_piece: number;
          price_tray_30: number;
          price_carton_12: number;
          price_box_360: number;
          is_available: boolean;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          size: EggSize;
          price_per_piece: number;
          price_tray_30?: number;
          price_carton_12?: number;
          price_box_360?: number;
          is_available?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          size?: EggSize;
          price_per_piece?: number;
          price_tray_30?: number;
          price_carton_12?: number;
          price_box_360?: number;
          is_available?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      customer_payment_submissions: {
        Row: {
          id: string;
          order_id: string;
          customer_id: string;
          payment_method: CustomerPaymentMethod;
          status: CustomerPaymentStatus;
          reference_number: string | null;
          customer_notes: string | null;
          declared_amount: number | null;
          verified_by: string | null;
          verified_at: string | null;
          verification_notes: string | null;
          rejection_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          customer_id: string;
          payment_method: CustomerPaymentMethod;
          status?: CustomerPaymentStatus;
          reference_number?: string | null;
          customer_notes?: string | null;
          declared_amount?: number | null;
          verified_by?: string | null;
          verified_at?: string | null;
          verification_notes?: string | null;
          rejection_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          customer_id?: string;
          payment_method?: CustomerPaymentMethod;
          status?: CustomerPaymentStatus;
          reference_number?: string | null;
          customer_notes?: string | null;
          declared_amount?: number | null;
          verified_by?: string | null;
          verified_at?: string | null;
          verification_notes?: string | null;
          rejection_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_payment_submissions_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "customer_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_payment_submissions_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_payment_submissions_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      record_egg_production: {
        Args: {
          p_flock_id: string;
          p_production_date: string;
          p_collection_shift: string;
          p_total_eggs: number;
          p_good_eggs: number;
          p_damaged_eggs: number;
          p_cracked_eggs: number;
          p_notes: string;
          p_sizes: Json;
        };
        Returns: string;
      };
      record_egg_sale: {
        Args: {
          p_customer_id: string;
          p_sale_date: string;
          p_invoice_number: string;
          p_discount: number;
          p_notes: string;
          p_items: Json;
        };
        Returns: string;
      };
      record_feed_consumption: {
        Args: {
          p_flock_id: string;
          p_feed_type: string;
          p_quantity_kg: number;
          p_consumption_date: string;
          p_notes: string;
        };
        Returns: string;
      };
      record_feed_stock_intake: {
        Args: {
          p_feed_type: string;
          p_quantity_kg: number;
          p_cost_per_kg: number;
          p_supplier_id: string;
          p_intake_date: string;
          p_notes: string;
        };
        Returns: string;
      };
      adjust_egg_inventory: {
        Args: {
          p_size: EggSize;
          p_adjustment: number;
          p_reason: string;
        };
        Returns: string;
      };
      record_flock_mortality: {
        Args: {
          p_flock_id: string;
          p_quantity: number;
          p_event_date: string;
          p_reason?: string | null;
        };
        Returns: string;
      };
      record_flock_culling: {
        Args: {
          p_flock_id: string;
          p_quantity: number;
          p_event_date: string;
          p_reason?: string | null;
        };
        Returns: string;
      };
      record_egg_payment: {
        Args: {
          p_sale_id: string;
          p_amount: number;
          p_payment_method: string;
          p_payment_date: string;
          p_reference_number?: string | null;
          p_notes?: string | null;
        };
        Returns: string;
      };
    };
    Enums: {
      user_role: UserRole;
      egg_size: EggSize;
      packaging_type: PackagingType;
      entry_type: EntryType;
      egg_transaction_type: EggTransactionType;
      feed_transaction_type: FeedTransactionType;
      flock_status: FlockStatus;
      payment_method: PaymentMethod;
      payment_status: PaymentStatus;
      customer_order_status: CustomerOrderStatus;
      customer_payment_method: CustomerPaymentMethod;
      customer_payment_status: CustomerPaymentStatus;
    };
  };
}
