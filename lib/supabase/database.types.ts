export type Database = {
  public: {
    Tables: {
      api_keys: {
        Row: {
          id           : string;
          key_prefix   : string;
          key_hash     : string;
          name         : string | null;
          account_type : 'brand' | 'buyer';
          account_id   : string;
          scopes       : string[];
          environment  : 'live' | 'test';
          last_used_at : string | null;
          created_at   : string;
          revoked_at   : string | null;
        };
        Insert: {
          key_prefix    : string;
          key_hash      : string;
          name?         : string | null;
          account_type  : 'brand' | 'buyer';
          account_id    : string;
          scopes?       : string[];
          environment?  : 'live' | 'test';
          last_used_at? : string | null;
          revoked_at?   : string | null;
        };
        Update: Partial<Database['public']['Tables']['api_keys']['Row']>;
        Relationships: [];
      };
      inventory: {
        Row: {
          id              : number;
          title           : string | null;
          description     : string | null;
          sku             : string | null;
          category        : string | null;
          stock_total     : number | null;
          sizes           : Record<string, number> | null;
          image_urls      : string[] | null;
          created_at      : string;
          updated_at      : string;
          brand_name      : string;
          brand_id        : number;
          wsp_usd         : number | null;
          srp             : number | null;
          product_notes   : string | null;
          moq             : number | null;
          margin          : number | null;
          cost            : number | null;
          delivery_window : string | null;
          material        : string | null;
          color           : string | null;
          gender          : string;
          season          : string | null;
          line            : string | null;
          tags            : string[];
          tier_pricing    : Record<string, unknown>[];
          status          : string;
        };
        Insert: Partial<Database['public']['Tables']['inventory']['Row']>;
        Update: Partial<Database['public']['Tables']['inventory']['Row']>;
        Relationships: [];
      };
      inquiries: {
        Row: {
          id         : number;
          buyer_id   : string;
          brand_name : string;
          subject    : string;
          status     : 'open' | 'replied' | 'closed';
          created_at : string;
          updated_at : string;
        };
        Insert: {
          buyer_id   : string;
          brand_name : string;
          subject    : string;
          status?    : 'open' | 'replied' | 'closed';
        };
        Update: {
          status?     : 'open' | 'replied' | 'closed';
          updated_at? : string;
        };
        Relationships: [];
      };
      integration_configs: {
        Row: {
          id           : number;
          brand_id     : string;
          platform     : string;
          active       : boolean;
          access_token : string | null;
          shop_domain  : string | null;
          external_id  : string | null;
          config       : Record<string, unknown>;
          connected_at : string | null;
          last_sync_at : string | null;
          created_at   : string;
        };
        Insert: {
          brand_id     : string;
          platform     : string;
          active?      : boolean;
          access_token?: string | null;
          shop_domain? : string | null;
          external_id? : string | null;
          config?      : Record<string, unknown>;
          connected_at?: string | null;
        };
        Update: {
          active?      : boolean;
          access_token?: string | null;
          shop_domain? : string | null;
          external_id? : string | null;
          config?      : Record<string, unknown>;
          connected_at?: string | null;
          last_sync_at?: string | null;
        };
        Relationships: [];
      };
      buyer_storefronts: {
        Row: {
          id           : string;
          user_id      : string;
          slug         : string;
          name         : string;
          tagline      : string | null;
          description  : string | null;
          logo_url     : string | null;
          banner_url   : string | null;
          accent_color : string;
          contact_email: string | null;
          instagram    : string | null;
          website      : string | null;
          published      : boolean;
          custom_domain  : string | null;
          domain_verified: boolean;
          theme          : Record<string, unknown> | null;
          created_at     : string;
          updated_at     : string;
        };
        Insert: {
          user_id      : string;
          slug         : string;
          name         : string;
          tagline?     : string | null;
          description? : string | null;
          accent_color?: string;
          contact_email?: string | null;
          instagram?   : string | null;
          website?     : string | null;
          published?     : boolean;
          custom_domain? : string | null;
          theme?         : Record<string, unknown> | null;
        };
        Update: {
          slug?        : string;
          name?        : string;
          tagline?     : string | null;
          description? : string | null;
          accent_color?: string;
          contact_email?: string | null;
          instagram?   : string | null;
          website?     : string | null;
          published?     : boolean;
          custom_domain? : string | null;
          domain_verified?: boolean;
          theme?         : Record<string, unknown> | null;
          updated_at?    : string;
        };
        Relationships: [];
      };
      storefront_products: {
        Row: {
          id             : string;
          storefront_id  : string;
          catalog_item_id: string;
          consumer_price : number | null;
          featured       : boolean;
          sort_order     : number;
          published      : boolean;
          created_at     : string;
        };
        Insert: {
          storefront_id  : string;
          catalog_item_id: string;
          consumer_price?: number | null;
          featured?      : boolean;
          sort_order?    : number;
          published?     : boolean;
        };
        Update: {
          consumer_price?: number | null;
          featured?      : boolean;
          sort_order?    : number;
          published?     : boolean;
        };
        Relationships: [];
      };
      storefront_enquiries: {
        Row: {
          id           : string;
          storefront_id: string;
          product_id   : string | null;
          name         : string;
          email        : string;
          message      : string | null;
          created_at   : string;
        };
        Insert: {
          storefront_id: string;
          product_id?  : string | null;
          name         : string;
          email        : string;
          message?     : string | null;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      buyer_cart: {
        Row: {
          id             : string;
          user_id        : string;
          item_id        : string;
          brand_name     : string | null;
          title          : string | null;
          style_number   : string | null;
          colour         : string | null;
          image_url      : string | null;
          retail_price   : number | null;
          wholesale_price: number | null;
          sizes          : Record<string, number>;
          qty            : number;
          created_at     : string;
          updated_at     : string;
        };
        Insert: {
          user_id        : string;
          item_id        : string;
          brand_name?    : string | null;
          title?         : string | null;
          style_number?  : string | null;
          colour?        : string | null;
          image_url?     : string | null;
          retail_price?  : number | null;
          wholesale_price?: number | null;
          sizes?         : Record<string, number>;
          qty?           : number;
        };
        Update: {
          sizes?          : Record<string, number>;
          qty?            : number;
          updated_at?     : string;
        };
        Relationships: [];
      };
      buyer_orders: {
        Row: {
          id        : string;
          buyer_id  : string | null;
          buyer_name: string | null;
          brand_id  : string | null;
          brand_name: string | null;
          status    : string;
          total_usd : number;
          currency  : string | null;
          terms     : string | null;
          notes     : string | null;
          items     : Record<string, unknown>[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id               : string;
          buyer_id?        : string | null;
          buyer_name?      : string | null;
          brand_id?        : string | null;
          brand_name?      : string | null;
          status?          : string;
          fulfillment_type?: string | null;
          total_usd        : number;
          currency?        : string | null;
          terms?           : string | null;
          notes?           : string | null;
          items            : Record<string, unknown>[];
        };
        Update: {
          status?   : string;
          total_usd?: number;
          currency? : string | null;
          terms?    : string | null;
          notes?    : string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      buyer_favorites: {
        Row: {
          id         : string;
          user_id    : string;
          item_type  : 'product' | 'brand';
          item_id    : string;
          item_label : string | null;
          created_at : string;
        };
        Insert: {
          user_id    : string;
          item_type  : 'product' | 'brand';
          item_id    : string;
          item_label?: string | null;
        };
        Update: { item_label?: string | null };
        Relationships: [];
      };
      buyer_alert_prefs: {
        Row: {
          user_id       : string;
          email_alerts  : boolean;
          in_app_alerts : boolean;
          alert_on      : string[];
          updated_at    : string;
        };
        Insert: {
          user_id        : string;
          email_alerts?  : boolean;
          in_app_alerts? : boolean;
          alert_on?      : string[];
        };
        Update: {
          email_alerts?  : boolean;
          in_app_alerts? : boolean;
          alert_on?      : string[];
          updated_at?    : string;
        };
        Relationships: [];
      };
      buyer_alerts: {
        Row: {
          id         : string;
          user_id    : string;
          item_type  : string;
          item_id    : string;
          item_label : string | null;
          alert_type : string;
          title      : string;
          body       : string | null;
          read       : boolean;
          created_at : string;
        };
        Insert: {
          user_id    : string;
          item_type  : string;
          item_id    : string;
          item_label?: string | null;
          alert_type : string;
          title      : string;
          body?      : string | null;
        };
        Update: { read?: boolean };
        Relationships: [];
      };
      brand_promotions: {
        Row: {
          id              : string;
          brand_user_id   : string;
          brand_name      : string;
          name            : string;
          headline        : string;
          description     : string | null;
          promo_type      : 'volume_discount' | 'spend_threshold' | 'category_deal' | 'loyalty_reward';
          discount_pct    : number;
          min_qty         : number | null;
          min_spend       : number | null;
          target_category : string | null;
          min_tier        : string;
          product_ids     : number[];
          expires_at      : string | null;
          active          : boolean;
          created_at      : string;
          updated_at      : string;
        };
        Insert: {
          brand_user_id   : string;
          brand_name      : string;
          name            : string;
          headline        : string;
          description?    : string | null;
          promo_type      : 'volume_discount' | 'spend_threshold' | 'category_deal' | 'loyalty_reward';
          discount_pct    : number;
          min_qty?        : number | null;
          min_spend?      : number | null;
          target_category?: string | null;
          min_tier?       : string;
          product_ids?    : number[];
          expires_at?     : string | null;
          active?         : boolean;
        };
        Update: Partial<Database['public']['Tables']['brand_promotions']['Insert']>;
        Relationships: [];
      };
      brand_promotion_assignments: {
        Row: {
          id           : string;
          promotion_id : string;
          buyer_id     : string;
          assigned_at  : string;
        };
        Insert: {
          promotion_id : string;
          buyer_id     : string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      brand_recommendation_campaigns: {
        Row: {
          id              : string;
          brand_user_id   : string;
          brand_name      : string;
          name            : string;
          subject         : string;
          message         : string | null;
          product_ids     : number[];
          targeting       : Record<string, unknown>;
          status          : 'draft' | 'sent';
          sent_at         : string | null;
          recipient_count : number;
          created_at      : string;
          updated_at      : string;
        };
        Insert: {
          brand_user_id   : string;
          brand_name      : string;
          name            : string;
          subject         : string;
          message?        : string | null;
          product_ids?    : number[];
          targeting?      : Record<string, unknown>;
          status?         : 'draft' | 'sent';
        };
        Update: Partial<Database['public']['Tables']['brand_recommendation_campaigns']['Row']>;
        Relationships: [];
      };
      brand_recommendation_sends: {
        Row: {
          id          : string;
          campaign_id : string;
          buyer_id    : string;
          email       : string;
          match_score : number;
          sent_at     : string;
        };
        Insert: {
          campaign_id : string;
          buyer_id    : string;
          email       : string;
          match_score?: number;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      buyer_analysis: {
        Row: {
          id                  : string;
          buyer_id            : string;
          style_dna           : Record<string, unknown>;
          price_sensitivity   : string | null;
          category_weights    : Record<string, unknown>;
          trend_alignment     : string | null;
          personalization_tags: string[];
          brand_affinities    : string[];
          total_spend         : number | null;
          total_orders        : number | null;
          avg_order_value     : number | null;
          updated_at          : string;
        };
        Insert: {
          buyer_id : string;
        };
        Update: Partial<Database['public']['Tables']['buyer_analysis']['Row']>;
        Relationships: [];
      };
      buyers: {
        Row: {
          id              : string;
          auth_user_id    : string | null;
          email           : string;
          store_name      : string;
          first_name      : string | null;
          last_name       : string | null;
          phone           : string | null;
          city            : string | null;
          country         : string;
          status          : string;
          categories_sold : string[];
          market_segment  : string | null;
          price_range_max : number | null;
          created_at      : string;
          updated_at      : string;
        };
        Insert: {
          email      : string;
          store_name : string;
          status?    : string;
        };
        Update: Partial<Database['public']['Tables']['buyers']['Row']>;
        Relationships: [];
      };
      buyer_visibility_rules: {
        Row: {
          id        : string;
          buyer_id  : string;
          rule_type : string;
          target    : string;
          note      : string | null;
          active    : boolean;
          created_at: string;
        };
        Insert: {
          buyer_id  : string;
          rule_type : string;
          target    : string;
          note?     : string | null;
          active?   : boolean;
        };
        Update: { active?: boolean; note?: string | null };
        Relationships: [];
      };
      buyer_pricing_rules: {
        Row: {
          id           : string;
          brand_name   : string | null;
          buyer_id     : string;
          rule_type    : string;
          target       : string | null;
          discount_pct : number | null;
          fixed_price  : number | null;
          min_qty      : number | null;
          note         : string | null;
          active       : boolean;
          created_at   : string;
        };
        Insert: {
          brand_name?  : string | null;
          buyer_id     : string;
          rule_type?   : string;
          target?      : string | null;
          discount_pct?: number | null;
          fixed_price? : number | null;
          min_qty?     : number | null;
          note?        : string | null;
          active?      : boolean;
        };
        Update: Partial<Database['public']['Tables']['buyer_pricing_rules']['Insert']>;
        Relationships: [];
      };
      brand_storefronts: {
        Row: {
          id                   : string;
          user_id              : string;
          brand_name           : string;
          slug                 : string;
          display_name         : string;
          tagline              : string | null;
          description          : string | null;
          logo_url             : string | null;
          banner_url           : string | null;
          contact_email        : string | null;
          instagram            : string | null;
          website              : string | null;
          custom_domain        : string | null;
          domain_verified      : boolean;
          published            : boolean;
          theme                : Record<string, unknown>;
          stripe_account_id    : string | null;
          stripe_account_status: string | null;
          pricing_settings     : Record<string, unknown> | null;
          created_at           : string;
          updated_at           : string;
        };
        Insert: {
          user_id               : string;
          brand_name            : string;
          slug                  : string;
          display_name          : string;
          tagline?              : string | null;
          description?          : string | null;
          contact_email?        : string | null;
          instagram?            : string | null;
          website?              : string | null;
          custom_domain?        : string | null;
          published?            : boolean;
          theme?                : Record<string, unknown>;
          stripe_account_id?    : string | null;
          stripe_account_status?: string | null;
          pricing_settings?     : Record<string, unknown> | null;
        };
        Update: Partial<Database['public']['Tables']['brand_storefronts']['Insert']>;
        Relationships: [];
      };
      brand_storefront_products: {
        Row: {
          id            : string;
          storefront_id : string;
          inventory_id  : number;
          consumer_price: number | null;
          featured      : boolean;
          sort_order    : number;
          published     : boolean;
          created_at    : string;
        };
        Insert: {
          storefront_id : string;
          inventory_id  : number;
          consumer_price?: number | null;
          featured?     : boolean;
          sort_order?   : number;
          published?    : boolean;
        };
        Update: Partial<Database['public']['Tables']['brand_storefront_products']['Insert']>;
        Relationships: [];
      };
      brand_storefront_enquiries: {
        Row: {
          id            : string;
          storefront_id : string;
          inventory_id  : number | null;
          name          : string;
          email         : string;
          message       : string | null;
          created_at    : string;
        };
        Insert: {
          storefront_id : string;
          inventory_id? : number | null;
          name          : string;
          email         : string;
          message?      : string | null;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      inquiry_messages: {
        Row: {
          id         : number;
          inquiry_id : number;
          sender_id  : string;
          body       : string;
          created_at : string;
        };
        Insert: {
          inquiry_id : number;
          sender_id  : string;
          body       : string;
        };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: 'inquiry_messages_inquiry_id_fkey';
            columns: ['inquiry_id'];
            isOneToOne: false;
            referencedRelation: 'inquiries';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      buyer_vip_catalog: {
        Row: {
          id               : string;
          title            : string | null;
          description      : string | null;
          brand_name       : string | null;
          category         : string | null;
          season           : string | null;
          style_number     : string | null;
          retail_price     : number | null;
          wholesale_price  : number | null;
          min_order_qty    : number | null;
          image_url        : string | null;
          image_urls       : string[] | null;
          consignment_terms: string | null;
          created_at       : string;
          inventory_status : string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      allocate_order_stock_v2: {
        Args: {
          p_items: Array<{
            sku: string;
            sizes: Record<string, number>;
            total_qty: number;
            delivery_window?: string;
          }>;
        };
        Returns: {
          success: boolean;
          errors?: Array<Record<string, unknown>>;
          allocated?: Array<{
            sku: string;
            fulfillment_type: 'IMMEDIATE' | 'FUTURE_ALLOCATION';
            delivery_window?: string;
            sizes_used: Record<string, number>;
            stock_after: number | null;
          }>;
          order_fulfillment_type?: 'IMMEDIATE' | 'FUTURE_ALLOCATION' | 'MIXED';
        };
      };
    };
    Enums    : Record<string, never>;
  };
};
