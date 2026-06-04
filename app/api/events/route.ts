import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

const AGENCY_EMAILS = ['hello@linezheets.com'];

// ── GET /api/events — public list ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type    = searchParams.get('type');
  const city    = searchParams.get('city');
  const season  = searchParams.get('season');
  const from    = searchParams.get('from');   // date ISO
  const to      = searchParams.get('to');
  const featured = searchParams.get('featured');
  const limit   = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const offset  = parseInt(searchParams.get('offset') || '0');

  try {
    const supabase = await createClient();
    let q = (supabase as any)
      .from('showroom_events')
      .select(`
        id, title, type, city, country, venue_name, lat, lng,
        date_start, date_end, time_start, cover_image_url,
        is_public, status, host_name, brand_id, event_tag,
        season, featured, created_by, capacity
      `, { count: 'exact' })
      .in('status', ['approved', 'live', 'past'])
      .order('date_start', { ascending: true })
      .range(offset, offset + limit - 1);

    if (type)    q = q.eq('type', type);
    if (city)    q = q.ilike('city', `%${city}%`);
    if (season)  q = q.ilike('season', `%${season}%`);
    if (from)    q = q.gte('date_start', from);
    if (to)      q = q.lte('date_start', to);
    if (featured === '1') q = q.eq('featured', true);

    const { data, error, count } = await q;
    if (error) throw error;

    // Attach interest counts via a single grouped query
    const ids = (data || []).map((e: any) => e.id);
    let interestMap: Record<string, number> = {};
    if (ids.length) {
      const { data: counts } = await (supabase as any)
        .from('event_interests')
        .select('event_id, count:event_id.count()')
        .in('event_id', ids);
      (counts || []).forEach((r: any) => {
        interestMap[r.event_id] = Number(r.count);
      });
    }

    const events = (data || []).map((e: any) => ({
      ...e,
      interest_count: interestMap[e.id] || 0,
    }));

    return NextResponse.json({ events, total: count ?? 0 });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to load events' }, { status: 500 });
  }
}

// ── POST /api/events — create event ───────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const body = await req.json();
    const {
      title, type, description, city, country, venue_name, address,
      lat, lng, date_start, date_end, time_start, time_end, timezone,
      cover_image_url, website_url, capacity, is_public,
      host_name, host_contact, event_tag, season,
    } = body;

    if (!title || !type || !city || !date_start) {
      return NextResponse.json({ error: 'title, type, city, date_start are required' }, { status: 400 });
    }

    const isAgency = AGENCY_EMAILS.includes(user.email || '');
    const status   = isAgency ? 'approved' : 'pending';

    const { data, error } = await (supabase as any)
      .from('showroom_events')
      .insert({
        title, type, description, city, country, venue_name, address,
        lat: lat ? parseFloat(lat) : null,
        lng: lng ? parseFloat(lng) : null,
        date_start, date_end, time_start, time_end,
        timezone: timezone || 'UTC',
        cover_image_url, website_url,
        capacity: capacity ? parseInt(capacity) : null,
        is_public: is_public !== false,
        status,
        created_by: user.id,
        brand_id: user.id,
        host_name: host_name || user.user_metadata?.full_name || '',
        host_contact: host_contact || user.email,
        event_tag, season,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ event: data, status }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}
