"use client";
import React from "react";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { ShoppingBag, Package, TrendingUp, CheckCircle, Clock, AlertCircle } from "lucide-react";

const orders = [
  {
    id: "LZ-2024-0891",
    brand: "Maison Cléo",
    buyer: "Le Bon Marché — Paris",
    items: 14,
    value: "€ 38,400",
    status: "confirmed",
    date: "02 Jun 2026",
  },
  {
    id: "LZ-2024-0890",
    brand: "Studio Nicholson",
    buyer: "Browns Fashion — London",
    items: 8,
    value: "€ 22,150",
    status: "pending",
    date: "01 Jun 2026",
  },
  {
    id: "LZ-2024-0887",
    brand: "Jacquemus",
    buyer: "Ssense — Montréal",
    items: 22,
    value: "€ 91,200",
    status: "shipped",
    date: "30 May 2026",
  },
  {
    id: "LZ-2024-0882",
    brand: "Auralee",
    buyer: "Matches Fashion — London",
    items: 6,
    value: "€ 14,880",
    status: "confirmed",
    date: "28 May 2026",
  },
];

const statusConfig = {
  confirmed: { label: "Confirmed", color: "#c9a84c", Icon: CheckCircle },
  pending:   { label: "Pending",   color: "#888",    Icon: Clock },
  shipped:   { label: "Shipped",   color: "#4caf7d", Icon: Package },
};

export function OrderScrollSection() {
  return (
    <ContainerScroll
      titleComponent={
        <div className="mb-4">
          <p
            className="text-[8px] uppercase tracking-[0.7em] mb-5 text-center"
            style={{ color: "#c9a84c", fontFamily: "system-ui, sans-serif" }}
          >
            Order Management
          </p>
          <h2
            style={{
              fontFamily: "var(--font-serif), Georgia, serif",
              fontSize: "clamp(2rem, 5vw, 4.5rem)",
              fontWeight: 400,
              lineHeight: 1.0,
              letterSpacing: "-0.02em",
              color: "#0a0a0a",
              marginBottom: "1rem",
            }}
          >
            Every wholesale order,
            <br />
            <em style={{ color: "#bbb", fontStyle: "italic" }}>beautifully managed.</em>
          </h2>
          <p
            className="text-[14px] leading-[1.8] max-w-lg mx-auto"
            style={{ color: "#888", fontFamily: "system-ui, sans-serif" }}
          >
            Track orders from placement to delivery — across every brand, every buyer, in real time.
          </p>
        </div>
      }
    >
      {/* Order UI mock — dark luxury aesthetic */}
      <div className="h-full w-full bg-[#111] rounded-xl overflow-hidden flex flex-col">

        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
          <div className="flex items-center gap-3">
            <span
              style={{
                fontFamily: "var(--font-serif), Georgia, serif",
                fontSize: "13px",
                letterSpacing: "0.4em",
                color: "#fff",
              }}
            >
              LINEZHEETS
            </span>
            <span className="text-[9px] uppercase tracking-[0.3em]" style={{ color: "#555" }}>
              · Orders
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#c9a84c]" />
            <span className="text-[9px] uppercase tracking-[0.3em]" style={{ color: "#555" }}>
              Live
            </span>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-3 divide-x divide-white/5 border-b border-white/5">
          {[
            { label: "Season Revenue", value: "€ 1.24M", Icon: TrendingUp, up: true },
            { label: "Active Orders",  value: "47",       Icon: ShoppingBag, up: true },
            { label: "Pending Review", value: "6",        Icon: AlertCircle, up: false },
          ].map(({ label, value, Icon, up }) => (
            <div key={label} className="px-4 py-3 flex items-center gap-3">
              <Icon size={14} style={{ color: up ? "#c9a84c" : "#666" }} />
              <div>
                <p className="text-[9px] uppercase tracking-[0.3em]" style={{ color: "#555" }}>
                  {label}
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-serif), Georgia, serif",
                    fontSize: "18px",
                    color: "#fff",
                    lineHeight: 1.2,
                  }}
                >
                  {value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Orders table */}
        <div className="flex-1 overflow-auto">
          {/* Header */}
          <div className="grid grid-cols-[1fr_1.4fr_1.4fr_0.6fr_0.8fr_0.9fr] px-5 py-2 border-b border-white/5">
            {["Order ID", "Brand", "Buyer", "Items", "Value", "Status"].map((h) => (
              <p key={h} className="text-[8px] uppercase tracking-[0.35em]" style={{ color: "#444" }}>
                {h}
              </p>
            ))}
          </div>

          {/* Rows */}
          {orders.map((o, i) => {
            const cfg = statusConfig[o.status as keyof typeof statusConfig];
            return (
              <div
                key={o.id}
                className="grid grid-cols-[1fr_1.4fr_1.4fr_0.6fr_0.8fr_0.9fr] items-center px-5 py-3 border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors cursor-pointer"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-mono), 'DM Mono', monospace",
                    fontSize: "10px",
                    color: "#c9a84c",
                  }}
                >
                  {o.id}
                </p>
                <p className="text-[11px]" style={{ color: "#ccc" }}>
                  {o.brand}
                </p>
                <p className="text-[10px]" style={{ color: "#666" }}>
                  {o.buyer}
                </p>
                <p className="text-[11px]" style={{ color: "#888" }}>
                  {o.items} pcs
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-serif), Georgia, serif",
                    fontSize: "12px",
                    color: "#fff",
                  }}
                >
                  {o.value}
                </p>
                <div className="flex items-center gap-1.5">
                  <cfg.Icon size={10} style={{ color: cfg.color }} />
                  <p className="text-[9px] uppercase tracking-[0.25em]" style={{ color: cfg.color }}>
                    {cfg.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer bar */}
        <div className="px-5 py-2.5 border-t border-white/5 flex items-center justify-between">
          <p className="text-[8px] uppercase tracking-[0.3em]" style={{ color: "#333" }}>
            Spring / Summer 2026 · Season Active
          </p>
          <p className="text-[8px] uppercase tracking-[0.3em]" style={{ color: "#333" }}>
            Updated just now
          </p>
        </div>
      </div>
    </ContainerScroll>
  );
}
