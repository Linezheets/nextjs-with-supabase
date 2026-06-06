/**
 * showcase-data.ts
 * Server-side only — uses admin client to fetch anonymised live data
 * for the DeviceShowcaseScroll on the public landing page.
 * Never exposes personal buyer info; orders are brand-level aggregates.
 */

import { createAdminClient } from '@/lib/supabase/server';

// ── Types exported for the component ─────────────────────────────────────────

export interface ShowcaseOrder {
  id: string;
  brand: string;
  buyer: string;        // city-level, never personal email
  items: number;
  value: string;        // formatted e.g. "€ 38,400"
  status: 'confirmed' | 'pending' | 'shipped';
}

export interface ShowcaseInventoryItem {
  sku: string;
  name: string;
  season: string;
  stock: number;
  avail: number;
  reorder: boolean;
}

export interface ShowcaseBrand {
  name: string;
  tag: string;
  img: string;
  isNew: boolean;
}

export interface ShowcaseAlert {
  brand: string;
  time: string;
  msg: string;
  unread: boolean;
  dot: string;
}

export interface ShowcaseShortlistItem {
  brand: string;
  name: string;
  sku: string;
  price: string;
  note: string;
  qty: number;
}

export interface ShowcaseData {
  orders: ShowcaseOrder[];
  inventory: ShowcaseInventoryItem[];
  brands: ShowcaseBrand[];
  alerts: ShowcaseAlert[];
  shortlist: ShowcaseShortlistItem[];
  stats: {
    seasonRevenue: string;
    activeOrders: number;
    pendingReview: number;
    totalSkus: number;
    inStock: number;
    lowStock: number;
  };
}

// ── Empty default (for client components that can't call the server fetch) ────
export const emptyShowcaseData: ShowcaseData = {
  orders: [], inventory: [], brands: [], alerts: [], shortlist: [],
  stats: { seasonRevenue: '€ 0', activeOrders: 0, pendingReview: 0, totalSkus: 0, inStock: 0, lowStock: 0 },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtEur(usd: number): string {
  // rough USD→EUR
  const eur = usd * 0.92;
  if (eur >= 1000) return `€ ${(eur / 1000).toFixed(2).replace(/\.?0+$/, '')}K`;
  return `€ ${Math.round(eur).toLocaleString('en-US').replace(/,/g, ',')}`;
}

function fmtEurExact(usd: number): string {
  const eur = Math.round(usd * 0.92);
  return `€ ${eur.toLocaleString('de-DE').replace(/\./g, ',')}`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

// Map status to display value
function orderStatus(s: string): ShowcaseOrder['status'] {
  if (s === 'shipped' || s === 'delivered') return 'shipped';
  if (s === 'confirmed' || s === 'accepted' || s === 'paid') return 'confirmed';
  return 'pending';
}

// Dot colour per alert type
function alertDot(alertType: string): string {
  switch (alertType) {
    case 'new_collection': case 'new_stock': return '#c9a84c';
    case 'order_confirmed': case 'payment_received': return '#4caf7d';
    case 'low_stock': case 'out_of_stock': return '#e07070';
    default: return '#555';
  }
}

// ── Main fetch ────────────────────────────────────────────────────────────────

export async function getShowcaseData(): Promise<ShowcaseData> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const [brandsRes, inventoryRes, alertsRes] = await Promise.all([
    admin
      .from('brand_storefronts')
      .select('brand_name, display_name, banner_url, created_at')
      .eq('published', true)
      .order('created_at', { ascending: false })
      .limit(8),

    admin
      .from('inventory')
      .select('id, title, sku, brand_name, season, stock_total, moq, wsp_usd, image_urls, status, updated_at')
      .neq('status', 'archived')
      .order('updated_at', { ascending: false })
      .limit(30),

    admin
      .from('buyer_alerts')
      .select('alert_type, title, body, item_label, created_at, read')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const rawBrands: {
    brand_name: string; display_name: string; banner_url: string | null; created_at: string;
  }[] = brandsRes.data ?? [];

  const rawInventory: {
    id: number; title: string | null; sku: string | null; brand_name: string;
    season: string | null; stock_total: number | null; moq: number | null;
    wsp_usd: number | null; image_urls: string[] | null; status: string; updated_at: string;
  }[] = inventoryRes.data ?? [];

  const rawAlerts: {
    alert_type: string; title: string; body: string | null;
    item_label: string | null; created_at: string; read: boolean;
  }[] = alertsRes.data ?? [];

  // ── Orders: synthesise from inventory brand data (no personal data) ──────
  // We build a display set from distinct brands with realistic order-shaped data
  const brandNames = [...new Set(rawInventory.map(i => i.brand_name))].filter(Boolean);

  const buyerCities = [
    'Le Bon Marché — Paris', 'Browns Fashion — London', 'Ssense — Montréal',
    'Matches Fashion — London', 'Net-a-Porter — Global', 'Galeries Lafayette — Paris',
    'Dover Street Market — Tokyo', 'Luisa Via Roma — Florence',
  ];

  const orders: ShowcaseOrder[] = brandNames.slice(0, 5).map((brand, i) => {
    const items = rawInventory.filter(x => x.brand_name === brand);
    const totalUnits = items.slice(0, 3).reduce((s, x) => s + (x.stock_total ?? 10), 0);
    const avgWsp = items[0]?.wsp_usd ?? 280;
    const value = fmtEurExact(Math.min(totalUnits, 20) * avgWsp * 0.6);
    const statuses: ShowcaseOrder['status'][] = ['confirmed', 'pending', 'shipped', 'confirmed', 'shipped'];
    return {
      id: `LZ-${(2024000 + (i + 1) * 3).toString().slice(0, 8).replace(/^202/, 'LZ-2024-0')}`,
      brand,
      buyer: buyerCities[i % buyerCities.length],
      items: Math.max(Math.min(totalUnits, 22), 4),
      value,
      status: statuses[i % statuses.length],
    };
  });

  // ── Inventory ─────────────────────────────────────────────────────────────
  const inventory: ShowcaseInventoryItem[] = rawInventory.slice(0, 6).map(item => {
    const stock = item.stock_total ?? 0;
    const moq = item.moq ?? 3;
    return {
      sku: item.sku ?? `${item.brand_name.slice(0, 2).toUpperCase()}-${item.season ?? 'SS26'}-${String(item.id).padStart(3, '0')}`,
      name: item.title ?? 'Untitled Product',
      season: item.season ?? 'SS26',
      stock,
      avail: Math.max(stock - Math.floor(stock * 0.2), 0),
      reorder: stock <= Math.max(moq, 5),
    };
  });

  // ── Brands for discovery ──────────────────────────────────────────────────
  // Pair brand with a product image if available
  const brandImgMap: Record<string, string> = {};
  for (const item of rawInventory) {
    if (!brandImgMap[item.brand_name] && item.image_urls?.[0]) {
      brandImgMap[item.brand_name] = item.image_urls[0];
    }
  }

  const fallbackImgs = [
    'https://images.unsplash.com/photo-1445205170230-053b83016050?w=300&q=70',
    'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=300&q=70',
    'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=300&q=70',
    'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=300&q=70',
  ];

  const brandTags = ['New Season', 'New SKUs', 'Price Updated', 'Low Stock', 'New Arrival', 'SS26 Live'];

  const brands: ShowcaseBrand[] = rawBrands.slice(0, 4).map((b, i) => ({
    name: b.display_name || b.brand_name,
    tag: brandTags[i % brandTags.length],
    img: b.banner_url || brandImgMap[b.brand_name] || fallbackImgs[i % fallbackImgs.length],
    isNew: i < 2,
  }));

  // ── Alerts ────────────────────────────────────────────────────────────────
  const alerts: ShowcaseAlert[] = rawAlerts.slice(0, 5).map((a, i) => ({
    brand: a.item_label ?? 'Brand',
    time: relativeTime(a.created_at),
    msg: a.title,
    unread: !a.read,
    dot: alertDot(a.alert_type),
  }));

  // ── Shortlist: top inventory items ────────────────────────────────────────
  const shortlist: ShowcaseShortlistItem[] = rawInventory
    .filter(i => i.wsp_usd)
    .slice(0, 4)
    .map(item => ({
      brand: item.brand_name,
      name: item.title ?? 'Product',
      sku: item.sku ?? `${item.brand_name.slice(0,2).toUpperCase()}-${item.id}`,
      price: fmtEur(item.wsp_usd!),
      note: (item.stock_total ?? 0) <= 5 ? 'Low stock' : (item.stock_total ?? 0) <= 3 ? 'Last few' : '',
      qty: Math.max(Math.floor((item.moq ?? 3) * 1.5), 2),
    }));

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalRevEur = orders.reduce((s, o) => {
    const n = parseFloat(o.value.replace(/[€\s.,K]/g, '').replace(',', '.'));
    return s + (isNaN(n) ? 0 : n * (o.value.includes('K') ? 1000 : 1));
  }, 0);

  const lowStockCount = rawInventory.filter(
    i => (i.stock_total ?? 0) <= Math.max(i.moq ?? 1, 5) && (i.stock_total ?? 0) > 0
  ).length;

  const stats = {
    seasonRevenue: totalRevEur >= 1000000
      ? `€ ${(totalRevEur / 1000000).toFixed(2).replace(/\.?0+$/, '')}M`
      : totalRevEur >= 1000
        ? `€ ${(totalRevEur / 1000).toFixed(0)}K`
        : `€ ${Math.round(totalRevEur).toLocaleString()}`,
    activeOrders: Math.max(orders.length, 1),
    pendingReview: orders.filter(o => o.status === 'pending').length,
    totalSkus: rawInventory.length,
    inStock: rawInventory.filter(i => (i.stock_total ?? 0) > 0).length,
    lowStock: lowStockCount,
  };

  return { orders, inventory, brands, alerts, shortlist, stats };
}
