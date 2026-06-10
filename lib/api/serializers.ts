/**
 * Shared row→API serializers + the column sets each endpoint selects.
 * Keeping these together stops the list and detail routes from drifting.
 */

export const PRODUCT_COLUMNS =
  'id, sku, title, description, category, gender, season, color, material, sizes, image_urls, wsp_usd, srp, moq, stock_total, status, created_at, updated_at';

export interface ProductRow {
  id          : number;
  sku         : string | null;
  title       : string | null;
  description : string | null;
  category    : string | null;
  gender      : string;
  season      : string | null;
  color       : string | null;
  material    : string | null;
  sizes       : Record<string, number> | null;
  image_urls  : string[] | null;
  wsp_usd     : number | null;
  srp         : number | null;
  moq         : number | null;
  stock_total : number | null;
  status      : string;
  created_at  : string;
  updated_at  : string;
}

export function serializeProduct(r: ProductRow) {
  return {
    id                 : String(r.id),
    sku                : r.sku,
    name               : r.title,
    description        : r.description,
    category           : r.category,
    gender             : r.gender,
    season             : r.season,
    color              : r.color,
    material           : r.material,
    sizes              : r.sizes,
    images             : r.image_urls ?? [],
    wholesale_price_usd: r.wsp_usd,
    retail_price_usd   : r.srp,
    min_order_qty      : r.moq,
    stock              : r.stock_total,
    status             : r.status,
    created_at         : r.created_at,
    updated_at         : r.updated_at,
  };
}

export const ORDER_COLUMNS =
  'id, status, total_usd, currency, brand_name, buyer_name, items, terms, notes, created_at, updated_at';

export interface OrderRow {
  id         : string;
  status     : string;
  total_usd  : number;
  currency   : string | null;
  brand_name : string | null;
  buyer_name : string | null;
  items      : Record<string, unknown>[];
  terms      : string | null;
  notes      : string | null;
  created_at : string;
  updated_at : string;
}

export function serializeOrder(r: OrderRow) {
  return {
    id         : r.id,
    status     : r.status,
    total_usd  : r.total_usd,
    currency   : r.currency,
    brand_name : r.brand_name,
    buyer_name : r.buyer_name,
    items      : r.items ?? [],
    terms      : r.terms,
    notes      : r.notes,
    created_at : r.created_at,
    updated_at : r.updated_at,
  };
}

/**
 * Map a public product payload (API field names) to inventory columns.
 * Only keys present in the body are emitted, so it serves both create and
 * partial update. brand_name/brand_id are set by the route, never the client.
 */
export function productInputToColumns(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const str = (v: unknown) => (v == null ? null : String(v));
  const map: Array<[string, string, (v: unknown) => unknown]> = [
    ['name',                'title',       v => String(v)],
    ['sku',                 'sku',         str],
    ['category',            'category',    v => String(v).toUpperCase()],
    ['gender',              'gender',      v => String(v).toUpperCase()],
    ['season',              'season',      str],
    ['color',               'color',       str],
    ['material',            'material',    str],
    ['sizes',               'sizes',       v => (v && typeof v === 'object') ? v : {}],
    ['images',              'image_urls',  v => Array.isArray(v) ? v : []],
    ['wholesale_price_usd', 'wsp_usd',     v => Number(v)],
    ['retail_price_usd',    'srp',         v => Number(v)],
    ['min_order_qty',       'moq',         v => Number(v)],
    ['stock',               'stock_total', v => Number(v)],
    ['description',         'description', str],
    ['status',              'status',      v => String(v)],
  ];
  for (const [apiKey, col, conv] of map) {
    if (body[apiKey] !== undefined) out[col] = conv(body[apiKey]);
  }
  return out;
}
