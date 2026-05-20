import { NextRequest, NextResponse } from 'next/server';
import { readFileSync }              from 'fs';
import { join }                      from 'path';
import { Client }                    from 'pg';

// POST /api/migrate
// Runs the consolidated schema migration against the Postgres database.
// Protected by MIGRATE_SECRET — pass as: Authorization: Bearer <secret>
//
// Required env vars:
//   DATABASE_URL    — Supabase direct Postgres connection string
//   MIGRATE_SECRET  — shared secret to gate this endpoint

export async function POST(req: NextRequest) {
  const secret = process.env.MIGRATE_SECRET;

  if (!secret) {
    return NextResponse.json({ error: 'MIGRATE_SECRET not configured' }, { status: 500 });
  }

  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 500 });
  }

  let sql: string;
  try {
    const sqlPath = join(process.cwd(), 'supabase', 'migrations', '000_consolidated_schema.sql');
    sql = readFileSync(sqlPath, 'utf-8');
  } catch {
    return NextResponse.json({ error: 'Migration file not found' }, { status: 500 });
  }

  const client = new Client({ connectionString });

  try {
    await client.connect();
    const started = Date.now();

    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');

    const elapsed = Date.now() - started;

    return NextResponse.json({
      ok:      true,
      message: 'Migration completed successfully',
      elapsed: `${elapsed}ms`,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  } finally {
    await client.end().catch(() => {});
  }
}

// GET /api/migrate — health check, returns migration file metadata
export async function GET(req: NextRequest) {
  const secret = process.env.MIGRATE_SECRET;
  const auth   = req.headers.get('authorization') ?? '';

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sqlPath = join(process.cwd(), 'supabase', 'migrations', '000_consolidated_schema.sql');
    const sql     = readFileSync(sqlPath, 'utf-8');
    const lines   = sql.split('\n').length;

    return NextResponse.json({
      ok:      true,
      file:    'supabase/migrations/000_consolidated_schema.sql',
      lines,
      sections: [
        '0. set_updated_at utility function',
        '1. inventory (full canonical schema)',
        '2. buyers + buyer_analysis',
        '3. buyer_orders (with fulfillment_type)',
        '4. integration_configs',
        '5. inquiries + inquiry_messages',
        '6. buyer_favorites, buyer_alert_prefs, buyer_alerts',
        '7. buyer_cart',
        '8. buyer_storefronts + storefront_products + storefront_enquiries',
        '9. brand_storefronts + brand_storefront_products + brand_storefront_enquiries',
        '10. brand_recommendation_campaigns + brand_recommendation_sends',
        '11. brand_promotions + brand_promotion_assignments',
        '12. buyer_pricing_rules + buyer_visibility_rules',
        '13. session_store',
        '14. storage — product-images bucket + policies',
        '15. buyer_vip_catalog view',
        '16. get_buyer_catalog RPC',
        '16. get_brand_sell_through RPC',
        '16. allocate_order_stock_v2 RPC',
      ],
    });
  } catch {
    return NextResponse.json({ error: 'Migration file not found' }, { status: 500 });
  }
}
