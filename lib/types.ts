export interface CatalogItem {
  id               : string;

  // ── Confirmed live column names ───────────────────────────────────────────
  title            : string | null;           // ← confirmed by terminal log
  retail_price     : string | number | null;  // SRP — string or numeric from Postgres

  // ── Image — view may use either column name ───────────────────────────────
  image_url        : string | null;           // single URL (TEXT column)
  image_urls       : string[] | string | null;// array / JSON string (JSONB column)

  // ── Other catalog fields ──────────────────────────────────────────────────
  brand_name       : string | null;
  category         : string | null;
  season           : string | null;
  wholesale_price  : string | number | null;
  inventory_status : string | null;
  min_order_qty    : number | null;
  consignment_terms: string | null;
  style_number     : string | null;
  description      : string | null;

  // ── Alternate naming conventions (kept for safety) ────────────────────────
  name?            : string | null;
  price_usd?       : string | number | null;

  // Allow any extra columns Supabase returns without TypeScript errors
  [key: string]    : unknown;
}
