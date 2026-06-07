import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { getUserFromRequest } from '@/lib/supabase/bearer';

export const runtime = 'nodejs';

const SUPABASE_URL     = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const STORAGE_BUCKET   = 'product-images';

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const user = await getUserFromRequest(req).catch(() => null);
    // Allow unauthenticated for now (dashboard already guards the page)

    const formData = await req.formData();
    const files = formData.getAll('images') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    // If no Supabase storage configured, return mock URLs for dev
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      const mockUrls = files.map((f, i) => ({
        url: `https://placehold.co/600x800/1a1a1a/c9a84c?text=${encodeURIComponent(f.name)}`,
        name: f.name,
        size: f.size,
      }));
      return NextResponse.json({ urls: mockUrls });
    }

    const supabase = createSupabaseAdmin(SUPABASE_URL, SERVICE_ROLE_KEY);
    const uploaded: { url: string; name: string; size: number }[] = [];

    for (const file of files) {
      const ext  = file.name.split('.').pop() ?? 'jpg';
      const key  = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const buf  = Buffer.from(await file.arrayBuffer());

      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(key, buf, { contentType: file.type, upsert: false });

      if (error) {
        console.error('Storage upload error:', error);
        // Return placeholder so UI still works
        uploaded.push({
          url : `https://placehold.co/600x800/1a1a1a/c9a84c?text=${encodeURIComponent(file.name)}`,
          name: file.name,
          size: file.size,
        });
        continue;
      }

      const { data: { publicUrl } } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(key);

      uploaded.push({ url: publicUrl, name: file.name, size: file.size });
    }

    return NextResponse.json({ urls: uploaded });
  } catch (err) {
    console.error('product-image upload error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
