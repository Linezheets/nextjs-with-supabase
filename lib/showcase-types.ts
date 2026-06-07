// Client-safe types and empty defaults — no server imports
export interface ShowcaseOrder {
  id: string;
  brand: string;
  buyer: string;
  items: number;
  value: string;
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

export const emptyShowcaseData: ShowcaseData = {
  orders: [], inventory: [], brands: [], alerts: [], shortlist: [],
  stats: { seasonRevenue: '€ 0', activeOrders: 0, pendingReview: 0, totalSkus: 0, inStock: 0, lowStock: 0 },
};
