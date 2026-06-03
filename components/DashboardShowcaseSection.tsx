'use client';

import React from 'react';
import Link from 'next/link';
import SectionWithMockup from '@/components/ui/section-with-mockup';

// Unsplash images — dark editorial / fashion workspace aesthetic
const PRIMARY_IMG =
  'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=900&q=80';   // dark analytics dashboard
const SECONDARY_IMG =
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=900&q=80'; // data / business

const PRIMARY_IMG_2 =
  'https://images.unsplash.com/photo-1445205170230-053b83016050?w=900&q=80'; // fashion week runway
const SECONDARY_IMG_2 =
  'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=900&q=80'; // luxury fashion editorial

export function DashboardShowcaseSection() {
  return (
    <div className="bg-black">

      {/* ── Section 1: Buyer Dashboard ─────────────────────────────────── */}
      <SectionWithMockup
        title={
          <>
            Your entire wholesale
            <br />
            operation, in one view.
          </>
        }
        description={
          <>
            The Linezheets buyer dashboard gives you live visibility across every
            brand you carry — active orders, outstanding payments, stock levels,
            and new arrivals, all without opening a single email or PDF.
            <br /><br />
            <Link
              href="/join"
              className="inline-block text-[11px] uppercase tracking-[0.4em] border-b pb-px
                         hover:opacity-60 transition-opacity"
              style={{ color: '#c9a84c', borderColor: '#c9a84c', fontFamily: 'system-ui, sans-serif' }}
            >
              Apply for Buyer Access →
            </Link>
          </>
        }
        primaryImageSrc={PRIMARY_IMG}
        secondaryImageSrc={SECONDARY_IMG}
      />

      {/* Thin gold divider */}
      <div className="max-w-[1220px] mx-auto px-6 md:px-10">
        <div className="h-px w-full" style={{ background: 'linear-gradient(to right, transparent, #c9a84c44, transparent)' }} />
      </div>

      {/* ── Section 2: Brand Linesheet ─────────────────────────────────── */}
      <SectionWithMockup
        title={
          <>
            Your collection,
            <br />
            always buyer-ready.
          </>
        }
        description={
          <>
            Brand partners on Linezheets replace static PDFs with a live digital
            showroom — updated pricing, real-time availability, and lookbooks that
            buyers can browse, shortlist, and order from directly.
            <br /><br />
            <Link
              href="/join"
              className="inline-block text-[11px] uppercase tracking-[0.4em] border-b pb-px
                         hover:opacity-60 transition-opacity"
              style={{ color: '#c9a84c', borderColor: '#c9a84c', fontFamily: 'system-ui, sans-serif' }}
            >
              List Your Brand →
            </Link>
          </>
        }
        primaryImageSrc={PRIMARY_IMG_2}
        secondaryImageSrc={SECONDARY_IMG_2}
        reverseLayout
      />

    </div>
  );
}
