"use client";

import React, { useRef } from "react";
import { useScroll, motion, AnimatePresence } from "framer-motion";
import type {
  ShowcaseData,
  ShowcaseOrder,
  ShowcaseInventoryItem,
  ShowcaseBrand,
  ShowcaseAlert,
  ShowcaseShortlistItem,
} from "@/lib/showcase-data";
import {
  CheckCircle,
  Clock,
  Package,
  TrendingUp,
  ShoppingBag,
  AlertCircle,
  Layers,
  UploadCloud,
  Bell,
  Search,
  Heart,
  Star,
} from "lucide-react";

// ─── Slide data ────────────────────────────────────────────────────────────

type DeviceType = "ipad" | "laptop" | "mac" | "mobile";

interface Slide {
  device: DeviceType;
  label: string;
  italic: string;
  sub: string;
  UI: React.FC<{ data: ShowcaseData }>;
}

// ── Static fallbacks (shown when DB has no data yet) ───────────────────────
const FALLBACK_ORDERS: ShowcaseOrder[] = [
  { id: "LZ-2024-0891", brand: "Maison Cléo",      buyer: "Le Bon Marché — Paris",    items: 14, value: "€ 38,400", status: "confirmed" },
  { id: "LZ-2024-0890", brand: "Studio Nicholson", buyer: "Browns Fashion — London",  items: 8,  value: "€ 22,150", status: "pending"   },
  { id: "LZ-2024-0887", brand: "Jacquemus",         buyer: "Ssense — Montréal",        items: 22, value: "€ 91,200", status: "shipped"    },
  { id: "LZ-2024-0882", brand: "Auralee",           buyer: "Matches Fashion — London", items: 6,  value: "€ 14,880", status: "confirmed" },
  { id: "LZ-2024-0879", brand: "Totême",            buyer: "Net-a-Porter — Global",    items: 18, value: "€ 54,600", status: "shipped"    },
];
const FALLBACK_INVENTORY: ShowcaseInventoryItem[] = [
  { sku: "MC-SS26-001", name: "Silk Bias Dress",   season: "SS26", stock: 24, avail: 18, reorder: false },
  { sku: "SN-SS26-014", name: "Tailored Overshirt",season: "SS26", stock: 8,  avail: 8,  reorder: true  },
  { sku: "JQ-SS26-007", name: "Le Chiquito Bag",   season: "SS26", stock: 42, avail: 31, reorder: false },
  { sku: "AU-SS26-022", name: "Wool Rib Knit",      season: "SS26", stock: 15, avail: 15, reorder: false },
  { sku: "TM-SS26-003", name: "Relaxed Trousers",  season: "SS26", stock: 3,  avail: 3,  reorder: true  },
  { sku: "MC-SS26-002", name: "Linen Maxi Skirt",  season: "SS26", stock: 19, avail: 12, reorder: false },
];
const FALLBACK_BRANDS: ShowcaseBrand[] = [
  { name: "Totême",      tag: "New Season",   img: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=300&q=70", isNew: true  },
  { name: "Maison Cléo",tag: "48 New SKUs",  img: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=300&q=70", isNew: true  },
  { name: "Studio N.",   tag: "Price Updated",img: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=300&q=70", isNew: false },
  { name: "Auralee",     tag: "Low Stock",    img: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=300&q=70", isNew: false },
];
const FALLBACK_ALERTS: ShowcaseAlert[] = [
  { brand: "Jacquemus",   time: "2m ago",    msg: "SS26 lookbook is now live. 22 new styles added.",    unread: true,  dot: "#c9a84c" },
  { brand: "Maison Cléo", time: "14m ago",   msg: "Your order #LZ-2024-0891 has been confirmed.",       unread: true,  dot: "#4caf7d" },
  { brand: "Totême",      time: "1h ago",    msg: "Price list updated for SS26 season.",                unread: false, dot: "#555"    },
  { brand: "Auralee",     time: "3h ago",    msg: "Low stock alert: Wool Rib Knit — 3 units left.",    unread: false, dot: "#e07070" },
  { brand: "Studio N.",   time: "Yesterday", msg: "Payment reminder: Invoice #INV-0334 due Friday.",   unread: false, dot: "#555"    },
];
const FALLBACK_SHORTLIST: ShowcaseShortlistItem[] = [
  { brand: "Jacquemus",  name: "Le Chiquito Bag",  sku: "JQ-SS26-007", price: "€ 890", note: "Priority", qty: 3 },
  { brand: "Maison Cléo",name: "Silk Bias Dress",   sku: "MC-SS26-001", price: "€ 320", note: "",         qty: 6 },
  { brand: "Auralee",    name: "Wool Rib Knit",      sku: "AU-SS26-022", price: "€ 480", note: "Low stock",qty: 4 },
  { brand: "Totême",     name: "Relaxed Trousers",  sku: "TM-SS26-003", price: "€ 540", note: "Last 3",   qty: 2 },
];

const statusCfg: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  confirmed: { label: "Confirmed", color: "#c9a84c", Icon: CheckCircle },
  pending:   { label: "Pending",   color: "#888",    Icon: Clock       },
  shipped:   { label: "Shipped",   color: "#4caf7d", Icon: Package     },
};

function OrderUI({ data }: { data: ShowcaseData }) {
  const orders = data.orders.length ? data.orders : FALLBACK_ORDERS;
  const stats  = data.stats;
  return (
    <div className="h-full w-full bg-[#111] rounded-xl overflow-hidden flex flex-col text-white">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span style={{ fontFamily: "var(--font-serif),Georgia,serif", fontSize: 11, letterSpacing: "0.4em" }}>LINEZHEETS</span>
          <span className="text-[8px] uppercase tracking-[0.3em] text-[#555]">· Orders</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#c9a84c]" />
          <span className="text-[8px] uppercase tracking-[0.3em] text-[#555]">Live</span>
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-white/5 border-b border-white/5">
        {[
          { label: "Season Revenue", value: stats.seasonRevenue || "€ 1.24M", Icon: TrendingUp },
          { label: "Active Orders",  value: String(stats.activeOrders || 47),  Icon: ShoppingBag },
          { label: "Pending Review", value: String(stats.pendingReview || 6),  Icon: AlertCircle },
        ].map(({ label, value, Icon }) => (
          <div key={label} className="px-3 py-2 flex items-center gap-2">
            <Icon size={11} style={{ color: "#c9a84c" }} />
            <div>
              <p className="text-[7px] uppercase tracking-[0.3em] text-[#555]">{label}</p>
              <p style={{ fontFamily: "var(--font-serif),Georgia,serif", fontSize: 14, lineHeight: 1.2 }}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-[1fr_1.4fr_1.4fr_0.5fr_0.8fr_0.9fr] px-4 py-1.5 border-b border-white/5">
          {["Order ID", "Brand", "Buyer", "Items", "Value", "Status"].map((h) => (
            <p key={h} className="text-[7px] uppercase tracking-[0.35em] text-[#444]">{h}</p>
          ))}
        </div>
        {orders.map((o, i) => {
          const cfg = statusCfg[o.status];
          return (
            <motion.div
              key={o.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07 }}
              className="grid grid-cols-[1fr_1.4fr_1.4fr_0.5fr_0.8fr_0.9fr] items-center px-4 py-2 border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors"
            >
              <p style={{ fontFamily: "var(--font-mono),'DM Mono',monospace", fontSize: 9, color: "#c9a84c" }}>{o.id}</p>
              <p className="text-[10px] text-[#ccc]">{o.brand}</p>
              <p className="text-[9px] text-[#666]">{o.buyer}</p>
              <p className="text-[10px] text-[#888]">{o.items} pcs</p>
              <p style={{ fontFamily: "var(--font-serif),Georgia,serif", fontSize: 11, color: "#fff" }}>{o.value}</p>
              <div className="flex items-center gap-1">
                <cfg.Icon size={9} style={{ color: cfg.color }} />
                <p className="text-[8px] uppercase tracking-[0.2em]" style={{ color: cfg.color }}>{cfg.label}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="px-4 py-2 border-t border-white/5 flex items-center justify-between">
        <p className="text-[7px] uppercase tracking-[0.3em] text-[#333]">Spring / Summer 2026 · Season Active</p>
        <p className="text-[7px] uppercase tracking-[0.3em] text-[#333]">Updated just now</p>
      </div>
    </div>
  );
}

// ── 2. Laptop — Inventory Dashboard ────────────────────────────────────────
function InventoryUI({ data }: { data: ShowcaseData }) {
  const inventory = data.inventory.length ? data.inventory : FALLBACK_INVENTORY;
  const stats     = data.stats;
  return (
    <div className="h-full w-full bg-[#111] rounded-xl overflow-hidden flex flex-col text-white">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span style={{ fontFamily: "var(--font-serif),Georgia,serif", fontSize: 11, letterSpacing: "0.4em" }}>LINEZHEETS</span>
          <span className="text-[8px] uppercase tracking-[0.3em] text-[#555]">· Inventory</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[8px] uppercase tracking-[0.25em] text-[#555] border border-white/10 px-2 py-0.5 rounded">SS26</div>
        </div>
      </div>

      <div className="grid grid-cols-4 divide-x divide-white/5 border-b border-white/5">
        {[
          { label: "Total SKUs", value: String(stats.totalSkus || 247),  Icon: Layers },
          { label: "In Stock",   value: String(stats.inStock || 184),    Icon: Package },
          { label: "Low Stock",  value: String(stats.lowStock || 12),    Icon: AlertCircle },
          { label: "Sold Out",   value: String((stats.totalSkus || 247) - (stats.inStock || 184) > 0 ? (stats.totalSkus || 247) - (stats.inStock || 184) : 3), Icon: Clock },
        ].map(({ label, value, Icon }, i) => (
          <div key={label} className="px-3 py-2 flex items-center gap-2">
            <Icon size={10} style={{ color: i === 0 ? "#c9a84c" : i === 1 ? "#4caf7d" : "#888" }} />
            <div>
              <p className="text-[7px] uppercase tracking-[0.3em] text-[#555]">{label}</p>
              <p style={{ fontFamily: "var(--font-serif),Georgia,serif", fontSize: 14, lineHeight: 1.2 }}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-[1fr_1.6fr_0.6fr_0.5fr_0.5fr_0.6fr] px-4 py-1.5 border-b border-white/5">
          {["SKU", "Product", "Season", "Stock", "Avail", ""].map((h) => (
            <p key={h} className="text-[7px] uppercase tracking-[0.35em] text-[#444]">{h}</p>
          ))}
        </div>
        {inventory.map((item, i) => (
          <motion.div
            key={item.sku}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="grid grid-cols-[1fr_1.6fr_0.6fr_0.5fr_0.5fr_0.6fr] items-center px-4 py-2 border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors"
          >
            <p style={{ fontFamily: "var(--font-mono),'DM Mono',monospace", fontSize: 8, color: "#c9a84c" }}>{item.sku}</p>
            <p className="text-[10px] text-[#ccc]">{item.name}</p>
            <p className="text-[9px] text-[#666]">{item.season}</p>
            <div className="flex items-center gap-1">
              <div className="h-1 w-10 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-[#c9a84c]" style={{ width: `${(item.avail / item.stock) * 100}%` }} />
              </div>
            </div>
            <p className="text-[10px]" style={{ color: item.avail < 5 ? "#e07070" : "#aaa" }}>{item.avail}</p>
            {item.reorder ? (
              <span className="text-[7px] uppercase tracking-[0.2em] text-[#e07070] border border-[#e07070]/30 px-1 py-0.5 rounded w-fit">Reorder</span>
            ) : (
              <span />
            )}
          </motion.div>
        ))}
      </div>

      <div className="px-4 py-2 border-t border-white/5 flex items-center justify-between">
        <p className="text-[7px] uppercase tracking-[0.3em] text-[#333]">247 products across 8 brands</p>
        <p className="text-[7px] uppercase tracking-[0.3em] text-[#333]">Synced just now</p>
      </div>
    </div>
  );
}

// ── 3. Mac — Drag-and-Drop PDF Linesheet Upload ─────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function PDFUploadUI({ data: _data }: { data: ShowcaseData }) {
  return (
    <div className="h-full w-full bg-[#0f0f0f] rounded-xl overflow-hidden flex flex-col text-white">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span style={{ fontFamily: "var(--font-serif),Georgia,serif", fontSize: 11, letterSpacing: "0.4em" }}>LINEZHEETS</span>
          <span className="text-[8px] uppercase tracking-[0.3em] text-[#555]">· AI Import</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#c9a84c] animate-pulse" />
          <span className="text-[8px] uppercase tracking-[0.3em] text-[#555]">Processing</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
        {/* Drop zone */}
        <motion.div
          animate={{ borderColor: ["#c9a84c33", "#c9a84c88", "#c9a84c33"] }}
          transition={{ duration: 2.5, repeat: Infinity }}
          className="w-full max-w-sm border-2 border-dashed rounded-xl flex flex-col items-center justify-center py-8 gap-3"
          style={{ background: "rgba(201,168,76,0.03)" }}
        >
          <UploadCloud size={28} style={{ color: "#c9a84c" }} />
          <div className="text-center">
            <p className="text-[11px] text-[#ccc] mb-1">Drop your linesheet PDFs here</p>
            <p className="text-[9px] text-[#555]">Supports PDF, Excel, Word — any format</p>
          </div>
        </motion.div>

        {/* Files being processed */}
        <div className="w-full max-w-sm space-y-2">
          {[
            { name: "SS26_Maison_Cleo_Linesheet.pdf",  status: "done",       pages: 24, skus: 48 },
            { name: "SS26_Jacquemus_Collection.pdf",   status: "processing", pages: 38, skus: 0  },
            { name: "SS26_Auralee_Lookbook.pdf",       status: "queued",     pages: 0,  skus: 0  },
          ].map((f, i) => (
            <motion.div
              key={f.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.15 }}
              className="flex items-center gap-3 border border-white/[0.06] rounded-lg px-3 py-2"
              style={{ background: "#161616" }}
            >
              <div className="w-7 h-7 rounded bg-[#c9a84c]/10 flex items-center justify-center flex-shrink-0">
                <span className="text-[8px] uppercase tracking-[0.1em] text-[#c9a84c]">PDF</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] text-[#ccc] truncate">{f.name}</p>
                {f.status === "done" && (
                  <p className="text-[8px] text-[#4caf7d]">{f.pages} pages · {f.skus} SKUs extracted</p>
                )}
                {f.status === "processing" && (
                  <div className="mt-1 h-0.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-[#c9a84c] rounded-full"
                      animate={{ width: ["15%", "72%"] }}
                      transition={{ duration: 2, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" }}
                    />
                  </div>
                )}
                {f.status === "queued" && (
                  <p className="text-[8px] text-[#555]">Queued</p>
                )}
              </div>
              {f.status === "done" && <CheckCircle size={12} style={{ color: "#4caf7d", flexShrink: 0 }} />}
              {f.status === "processing" && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                  className="w-3 h-3 border border-[#c9a84c] border-t-transparent rounded-full flex-shrink-0"
                />
              )}
            </motion.div>
          ))}
        </div>
      </div>

      <div className="px-4 py-2 border-t border-white/5 flex items-center justify-between">
        <p className="text-[7px] uppercase tracking-[0.3em] text-[#333]">AI parses pricing, SKUs, and availability automatically</p>
      </div>
    </div>
  );
}

// ── 4. Mobile — Brand Discovery Feed ───────────────────────────────────────
function DiscoveryUI() {
  const brands = [
    { name: "Totême",           tag: "New Season",    img: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=200&q=60", new: true  },
    { name: "Maison Cléo",      tag: "48 New SKUs",   img: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=200&q=60", new: true  },
    { name: "Studio Nicholson", tag: "Price Updated", img: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=200&q=60", new: false },
    { name: "Auralee",          tag: "Low Stock",     img: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=200&q=60", new: false },
  ];
  return (
    <div className="h-full w-full bg-[#111] rounded-[28px] overflow-hidden flex flex-col text-white">
      <div className="px-4 pt-4 pb-2 border-b border-white/5">
        <div className="flex items-center justify-between mb-3">
          <span style={{ fontFamily: "var(--font-serif),Georgia,serif", fontSize: 10, letterSpacing: "0.4em" }}>LINEZHEETS</span>
          <Bell size={13} style={{ color: "#c9a84c" }} />
        </div>
        <div className="flex items-center gap-2 bg-white/5 rounded-full px-3 py-1.5">
          <Search size={10} style={{ color: "#555" }} />
          <span className="text-[9px] text-[#444]">Search brands, collections…</span>
        </div>
      </div>

      <div className="flex gap-2 px-4 py-2 border-b border-white/5 overflow-hidden">
        {["All", "New In", "SS26", "Shortlisted"].map((t, i) => (
          <div key={t} className="flex-shrink-0 text-[8px] uppercase tracking-[0.2em] px-2.5 py-1 rounded-full border"
            style={{ borderColor: i === 0 ? "#c9a84c" : "#333", color: i === 0 ? "#c9a84c" : "#555", background: i === 0 ? "rgba(201,168,76,0.08)" : "transparent" }}>
            {t}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-hidden px-4 py-3 grid grid-cols-2 gap-2 content-start">
        {brands.map((b, i) => (
          <motion.div
            key={b.name}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="relative rounded-xl overflow-hidden aspect-[3/4]"
            style={{ background: "#1a1a1a" }}
          >
            <img src={b.img} alt={b.name} className="w-full h-full object-cover opacity-70" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            {b.new && (
              <div className="absolute top-1.5 right-1.5 text-[7px] uppercase tracking-[0.2em] px-1.5 py-0.5 rounded-full bg-[#c9a84c] text-black">New</div>
            )}
            <div className="absolute bottom-0 left-0 right-0 p-2">
              <p style={{ fontFamily: "var(--font-serif),Georgia,serif", fontSize: 10 }}>{b.name}</p>
              <p className="text-[8px] text-[#888]">{b.tag}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── 5. Mobile — Buyer Notifications & Messaging ─────────────────────────────
function MessagingUI() {
  const msgs = [
    { brand: "Jacquemus",    time: "2m ago",   msg: "SS26 lookbook is now live. 22 new styles added.", unread: true,  dot: "#c9a84c" },
    { brand: "Maison Cléo", time: "14m ago",  msg: "Your order #LZ-2024-0891 has been confirmed.",    unread: true,  dot: "#4caf7d" },
    { brand: "Totême",       time: "1h ago",   msg: "Price list updated for SS26 season.",             unread: false, dot: "#555"    },
    { brand: "Auralee",      time: "3h ago",   msg: "Low stock alert: Wool Rib Knit — 3 units left.", unread: false, dot: "#e07070" },
    { brand: "Studio N.",    time: "Yesterday",msg: "Payment reminder: Invoice #INV-0334 due Friday.", unread: false, dot: "#555"    },
  ];
  return (
    <div className="h-full w-full bg-[#111] rounded-[28px] overflow-hidden flex flex-col text-white">
      <div className="px-4 pt-4 pb-3 border-b border-white/5 flex items-center justify-between">
        <span style={{ fontFamily: "var(--font-serif),Georgia,serif", fontSize: 10, letterSpacing: "0.4em" }}>Notifications</span>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-[#c9a84c]/20 flex items-center justify-center">
            <span className="text-[7px] text-[#c9a84c]">2</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden divide-y divide-white/[0.04]">
        {msgs.map((m, i) => (
          <motion.div
            key={m.brand + i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.07 }}
            className="flex items-start gap-3 px-4 py-3"
            style={{ background: m.unread ? "rgba(201,168,76,0.03)" : "transparent" }}
          >
            <div className="w-7 h-7 rounded-full border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: "#1a1a1a" }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: m.dot }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-[#ccc]">{m.brand}</p>
                <p className="text-[8px] text-[#444]">{m.time}</p>
              </div>
              <p className="text-[9px] text-[#666] mt-0.5 leading-relaxed">{m.msg}</p>
            </div>
            {m.unread && <div className="w-1.5 h-1.5 rounded-full bg-[#c9a84c] flex-shrink-0 mt-1.5" />}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── 6. Mobile — Shortlist / Wishlist ────────────────────────────────────────
function ShortlistUI() {
  const items = [
    { brand: "Jacquemus",   name: "Le Chiquito Bag",    sku: "JQ-SS26-007", price: "€ 890",  note: "Priority",  qty: 3 },
    { brand: "Maison Cléo", name: "Silk Bias Dress",     sku: "MC-SS26-001", price: "€ 320",  note: "",          qty: 6 },
    { brand: "Auralee",     name: "Wool Rib Knit",        sku: "AU-SS26-022", price: "€ 480",  note: "Low stock", qty: 4 },
    { brand: "Totême",      name: "Relaxed Trousers",    sku: "TM-SS26-003", price: "€ 540",  note: "Last 3",    qty: 2 },
  ];
  return (
    <div className="h-full w-full bg-[#111] rounded-[28px] overflow-hidden flex flex-col text-white">
      <div className="px-4 pt-4 pb-3 border-b border-white/5 flex items-center justify-between">
        <span style={{ fontFamily: "var(--font-serif),Georgia,serif", fontSize: 10, letterSpacing: "0.4em" }}>My Shortlist</span>
        <div className="flex items-center gap-1.5">
          <Heart size={12} style={{ color: "#c9a84c" }} />
          <span className="text-[8px] text-[#c9a84c]">4 items</span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden divide-y divide-white/[0.04]">
        {items.map((item, i) => (
          <motion.div
            key={item.sku}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="flex items-center gap-3 px-4 py-3"
          >
            <div className="w-8 h-10 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center flex-shrink-0">
              <Star size={10} style={{ color: "#c9a84c" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-[#ccc]">{item.name}</p>
              <p className="text-[8px] text-[#555]">{item.brand} · {item.sku}</p>
              {item.note && (
                <span className="text-[7px] uppercase tracking-[0.15em] text-[#e07070]">{item.note}</span>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p style={{ fontFamily: "var(--font-serif),Georgia,serif", fontSize: 11, color: "#fff" }}>{item.price}</p>
              <p className="text-[8px] text-[#555]">× {item.qty}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-white/5">
        <div className="bg-[#c9a84c] rounded-full py-2 flex items-center justify-center gap-2">
          <ShoppingBag size={11} style={{ color: "#000" }} />
          <span className="text-[9px] uppercase tracking-[0.3em] text-black font-medium">Send to Brand</span>
        </div>
      </div>
    </div>
  );
}

// ─── Slides config ──────────────────────────────────────────────────────────

const SLIDES: Slide[] = [
  {
    device: "ipad",
    label: "Every wholesale order,",
    italic: "beautifully managed.",
    sub: "Track orders from placement to delivery — across every brand, every buyer, in real time.",
    UI: OrderUI,
  },
  {
    device: "laptop",
    label: "Every SKU and season,",
    italic: "neatly organised.",
    sub: "Live inventory levels, reorder alerts, and availability — always current, always visible.",
    UI: InventoryUI,
  },
  {
    device: "mac",
    label: "Every linesheet uploaded,",
    italic: "effortlessly parsed.",
    sub: "Drop any PDF, Excel, or Word linesheet. Our AI extracts SKUs, pricing, and availability automatically.",
    UI: PDFUploadUI,
  },
  {
    device: "mobile",
    label: "Every new collection,",
    italic: "instantly discovered.",
    sub: "Browse new arrivals, updated lookbooks, and price changes from all your brands — in one feed.",
    UI: DiscoveryUI,
  },
  {
    device: "mobile",
    label: "Every brand update,",
    italic: "always connected.",
    sub: "Real-time notifications for order confirmations, stock alerts, and payment reminders — never miss a beat.",
    UI: MessagingUI,
  },
  {
    device: "mobile",
    label: "Every season's picks,",
    italic: "precisely shortlisted.",
    sub: "Save, annotate, and send shortlists to brands in one tap — from discovery to order in seconds.",
    UI: ShortlistUI,
  },
];

// ─── Device frame wrappers ──────────────────────────────────────────────────

function IPadFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto" style={{ width: 520, height: 380 }}>
      <div className="absolute inset-0 rounded-[20px] border-[8px] border-[#2a2a2a] bg-[#1a1a1a] shadow-[0_40px_100px_rgba(0,0,0,0.8)] overflow-hidden">
        {children}
      </div>
      {/* Home bar */}
      <div className="absolute bottom-[-16px] left-1/2 -translate-x-1/2 w-16 h-1 rounded-full bg-[#333]" />
    </div>
  );
}

function LaptopFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto" style={{ width: 560 }}>
      {/* Screen */}
      <div className="relative rounded-t-[12px] border-[10px] border-[#2a2a2a] bg-[#1a1a1a] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.8)]"
        style={{ height: 340 }}>
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#333]" />
        {children}
      </div>
      {/* Base */}
      <div className="h-4 rounded-b-[6px] bg-[#222] relative overflow-hidden">
        <div className="absolute inset-x-1/4 top-1 bottom-1 rounded-sm bg-[#1a1a1a]" />
      </div>
      <div className="h-1.5 mx-[-20px] rounded-b-[4px] bg-[#1f1f1f]" />
    </div>
  );
}

function MacFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto" style={{ width: 540 }}>
      <div className="rounded-[14px] border-[10px] border-[#2a2a2a] bg-[#1a1a1a] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.8)]"
        style={{ height: 340 }}>
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/5 bg-[#161616]">
          {["#e07070","#e0b070","#4caf7d"].map((c) => (
            <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
          ))}
        </div>
        <div className="h-[calc(100%-28px)]">{children}</div>
      </div>
      <div className="h-2 mx-4 rounded-b-[2px] bg-[#222]" />
      <div className="h-4 mx-[-8px] bg-[#1a1a1a] rounded-b-[8px] shadow-[0_4px_12px_rgba(0,0,0,0.5)]" />
    </div>
  );
}

function MobileFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto" style={{ width: 220, height: 420 }}>
      <div className="absolute inset-0 rounded-[36px] border-[8px] border-[#2a2a2a] bg-[#1a1a1a] shadow-[0_40px_100px_rgba(0,0,0,0.8)] overflow-hidden">
        {/* Notch */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-4 bg-[#111] rounded-full z-10 flex items-center justify-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#222]" />
          <div className="w-5 h-1.5 rounded-full bg-[#222]" />
        </div>
        <div className="h-full pt-6">{children}</div>
      </div>
    </div>
  );
}

function DeviceWrapper({ device, children }: { device: DeviceType; children: React.ReactNode }) {
  if (device === "ipad")   return <IPadFrame>{children}</IPadFrame>;
  if (device === "laptop") return <LaptopFrame>{children}</LaptopFrame>;
  if (device === "mac")    return <MacFrame>{children}</MacFrame>;
  return <MobileFrame>{children}</MobileFrame>;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function DeviceShowcaseScroll({ data }: { data: ShowcaseData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeSlide, setActiveSlide] = React.useState(0);

  const { scrollYProgress } = useScroll({ target: containerRef });

  React.useEffect(() => {
    return scrollYProgress.on("change", (v: number) => {
      const idx = Math.min(Math.floor(v * SLIDES.length), SLIDES.length - 1);
      setActiveSlide(idx);
    });
  }, [scrollYProgress]);

  const slide = SLIDES[activeSlide];
  const SlideUI = slide.UI;

  return (
    <section
      ref={containerRef}
      style={{
        height: `${SLIDES.length * 100}vh`,
        background: "#000",
        borderTop: "1px solid rgba(201,168,76,0.12)",
      }}
    >
      <div className="sticky top-0 h-screen overflow-hidden flex items-center">
        <div className="w-full max-w-[1300px] mx-auto px-8 md:px-14 grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center">

          {/* Left — text */}
          <div>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSlide}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.45, ease: [0.25, 0, 0, 1] }}
              >
                <h2
                  style={{
                    fontFamily: "var(--font-serif),Georgia,serif",
                    fontSize: "clamp(1.8rem,3.5vw,3.2rem)",
                    fontWeight: 400,
                    lineHeight: 1.1,
                    letterSpacing: "-0.02em",
                    color: "#fff",
                    marginBottom: "0.5rem",
                  }}
                >
                  {slide.label}
                  <br />
                  <em style={{ color: "#bbb", fontStyle: "italic" }}>{slide.italic}</em>
                </h2>
                <p
                  style={{
                    fontFamily: "system-ui,sans-serif",
                    fontSize: "clamp(0.8rem,1.2vw,0.95rem)",
                    color: "#666",
                    lineHeight: 1.8,
                    marginTop: "1.5rem",
                    maxWidth: "30ch",
                  }}
                >
                  {slide.sub}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Slide dots */}
            <div className="flex items-center gap-2 mt-10">
              {SLIDES.map((_, i) => (
                <div
                  key={i}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: i === activeSlide ? 20 : 4,
                    height: 4,
                    background: i === activeSlide ? "#c9a84c" : "#2a2a2a",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Right — device mockup */}
          <div className="flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSlide}
                initial={{ opacity: 0, scale: 0.94, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -16 }}
                transition={{ duration: 0.45, ease: [0.25, 0, 0, 1] }}
              >
                <DeviceWrapper device={slide.device}>
                  <SlideUI data={data} />
                </DeviceWrapper>
              </motion.div>
            </AnimatePresence>
          </div>

        </div>
      </div>
    </section>
  );
}
