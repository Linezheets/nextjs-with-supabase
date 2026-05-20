/**
 * LuxuryGallery
 * Renders a horizontal-scroll product gallery from a Supabase view.
 *
 * Usage:
 *   <div id="gallery-root"></div>
 *   <script type="module">
 *     import { LuxuryGallery } from '/components/luxury-gallery.js';
 *     LuxuryGallery({
 *       containerId : 'gallery-root',
 *       supabase,               // already-initialised Supabase client
 *       brandSlug   : 'mxlla',
 *       season      : 'SS27',   // optional — omit to show all seasons
 *       verified    : false,    // true = show wholesale pricing
 *       onCardClick : (item) => openModal(item),  // optional
 *     });
 *   </script>
 */

// ── Inventory status ──────────────────────────────────────────────────────────

const INV_STATUS = {
  ready:    { label: 'Ready to Ship', color: '#52b788' },
  limited:  { label: 'Limited',       color: '#C9A84C' },
  low:      { label: 'Low Stock',     color: '#f97316' },
  preorder: { label: 'Pre-Order',     color: '#38bdf8' },
  sold_out: { label: 'Sold Out',      color: '#52525b' },
};

function inventoryKey(item) {
  const qty = parseInt(item.available_units) || 0;
  if (qty === 0 && item.delivery_window) return 'preorder';
  if (qty === 0)                          return 'sold_out';
  if (qty <= parseInt(item.reorder_point || 5)) return 'low';
  if (qty <= 20)                          return 'limited';
  return 'ready';
}

// ── Card template ─────────────────────────────────────────────────────────────

function cardHTML(item, verified) {
  const img       = item.image_urls?.[0] ?? item.images?.[0] ?? '';
  const wholesale = parseFloat(item.wholesale_price ?? item.calculated_wholesale_price ?? 0);
  const msrp      = parseFloat(item.retail_price ?? item.msrp ?? 0);
  const payout    = (wholesale * 0.7).toFixed(2);
  const key       = inventoryKey(item);
  const inv       = INV_STATUS[key];

  const wsDisplay   = verified ? `€${wholesale.toFixed(2)}` : '<span class="blur-sm select-none">€——.——</span>';
  const poDisplay   = verified ? `€${payout}` : '<span class="blur-sm select-none">€——.——</span>';

  return `
  <article class="lz-card min-w-[300px] md:min-w-[400px] shrink-0 group cursor-pointer border-b border-zinc-900 pb-8"
    data-id="${item.id}" data-title="${(item.title ?? item.name ?? '').replace(/"/g, '&quot;')}">

    <div class="aspect-[2/3] bg-zinc-900 mb-5 overflow-hidden relative">
      ${img
        ? `<img src="${img}" alt="${item.title ?? item.name ?? ''}"
               class="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-[1.04] transition-all duration-700"
               loading="lazy" />`
        : ''}

      <!-- Inventory badge -->
      <div class="absolute top-2 left-2">
        <span style="color:${inv.color};border:1px solid ${inv.color}40;background:${inv.color}12"
          class="text-[8px] uppercase tracking-[0.2em] px-2 py-1 font-mono">
          ${inv.label}
        </span>
      </div>
    </div>

    <!-- Identity -->
    <div class="flex justify-between items-start mb-1 gap-3">
      <div class="min-w-0">
        <p class="text-zinc-500 text-[9px] uppercase tracking-[0.2em] mb-1">${item.season ?? 'New Arrival'}</p>
        <h3 class="text-white font-light text-lg leading-tight">${item.title ?? item.name ?? ''}</h3>
        ${item.category ? `<p class="text-zinc-600 text-[10px] uppercase tracking-widest mt-0.5">${item.category}</p>` : ''}
      </div>
      <div class="text-right shrink-0">
        <p class="text-zinc-400 text-sm font-light">€${msrp.toFixed(2)}</p>
        <p class="text-zinc-600 text-[9px] uppercase tracking-widest">SRP</p>
      </div>
    </div>

    <p class="text-zinc-700 text-[9px] uppercase tracking-[0.18em] mb-4">Consignment Term: 70/30</p>

    <!-- Pricing blocks -->
    <div class="grid grid-cols-2 gap-3">
      <div class="bg-zinc-900/60 p-3">
        <span class="block text-[9px] text-zinc-500 uppercase tracking-widest mb-1">Wholesale (2.5×)</span>
        <span class="text-[#C9A84C] font-mono text-sm">${wsDisplay}</span>
      </div>
      <div class="bg-zinc-900/60 p-3">
        <span class="block text-[9px] text-zinc-500 uppercase tracking-widest mb-1">Brand Payout (70%)</span>
        <span class="text-white/60 font-mono text-sm">${poDisplay}</span>
      </div>
    </div>

    ${item.min_order_qty ? `<p class="text-[9px] text-zinc-700 uppercase tracking-widest mt-3">MOQ ${item.min_order_qty} units</p>` : ''}
  </article>`;
}

function skeletonHTML() {
  return `
  <div class="min-w-[300px] md:min-w-[400px] shrink-0 animate-pulse">
    <div class="aspect-[2/3] bg-zinc-900 mb-5"></div>
    <div class="h-4 bg-zinc-900 rounded mb-2 w-3/4"></div>
    <div class="h-3 bg-zinc-900 rounded w-1/2"></div>
  </div>`.repeat(4);
}

// ── Drag-to-scroll ────────────────────────────────────────────────────────────

function enableDragScroll(el) {
  let down = false, startX = 0, scrollLeft = 0;
  el.addEventListener('mousedown',  e => { down = true; startX = e.pageX - el.offsetLeft; scrollLeft = el.scrollLeft; el.style.cursor = 'grabbing'; });
  el.addEventListener('mouseup',    () => { down = false; el.style.cursor = 'grab'; });
  el.addEventListener('mouseleave', () => { down = false; el.style.cursor = 'grab'; });
  el.addEventListener('mousemove',  e => { if (!down) return; e.preventDefault(); el.scrollLeft = scrollLeft - (e.pageX - el.offsetLeft - startX) * 1.5; });
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function LuxuryGallery({
  containerId,
  supabase,
  brandSlug,
  season,
  title,
  view = 'public_catalog',   // Supabase view or table name
  verified = false,
  onCardClick,
}) {
  const root = document.getElementById(containerId);
  if (!root) { console.error(`LuxuryGallery: #${containerId} not found`); return; }

  // ── Inject structure ──────────────────────────────────────────────────────
  root.innerHTML = `
    <section class="bg-black py-20 px-8 md:px-14">
      <div class="flex items-end justify-between mb-10 gap-6 flex-wrap">
        <div>
          <p class="text-zinc-600 text-[10px] uppercase tracking-[0.25em] mb-2" id="${containerId}-season">
            ${season ?? 'Current Season'}
          </p>
          <h2 class="text-white font-serif text-4xl md:text-5xl tracking-[0.08em] uppercase leading-tight" id="${containerId}-title">
            ${title ?? '&nbsp;'}
          </h2>
        </div>
        <div id="${containerId}-gate" class="hidden">
          <a href="/login" class="text-[10px] uppercase tracking-widest text-[#C9A84C] border border-[#C9A84C]/30 px-4 py-2 hover:bg-[#C9A84C]/10 transition-colors">
            Verify for Pricing →
          </a>
        </div>
      </div>
      <div id="${containerId}-track"
        class="flex gap-8 overflow-x-auto pb-10"
        style="scrollbar-width:none;-ms-overflow-style:none;cursor:grab">
        <style>#${containerId}-track::-webkit-scrollbar{display:none}</style>
        ${skeletonHTML()}
      </div>
      <p id="${containerId}-hint" class="hidden text-zinc-700 text-[9px] uppercase tracking-[0.25em] mt-2">← drag to explore →</p>
    </section>`;

  const track = document.getElementById(`${containerId}-track`);
  enableDragScroll(track);

  // ── Query Supabase ────────────────────────────────────────────────────────
  let query = supabase.from(view).select('*');
  if (brandSlug) query = query.eq('brand_slug', brandSlug);
  if (season)    query = query.eq('season', season);

  const { data, error } = await query;

  if (error || !data) {
    track.innerHTML = `<p class="text-zinc-600 italic text-sm py-12">${error?.message ?? 'Could not load collection.'}</p>`;
    return;
  }

  if (!data.length) {
    track.innerHTML = `<p class="text-zinc-600 italic text-sm py-12">No products available${season ? ` for ${season}` : ''}.</p>`;
    return;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const brandLabel = data[0]?.brand_name ?? brandSlug?.toUpperCase() ?? '';
  const headline   = title ?? `${brandLabel}${season ? ` ${season}` : ''} Collection`;
  document.getElementById(`${containerId}-title`).textContent = headline;

  if (!verified) document.getElementById(`${containerId}-gate`).classList.remove('hidden');

  track.innerHTML = data.map(item => cardHTML(item, verified)).join('');
  document.getElementById(`${containerId}-hint`).classList.remove('hidden');

  // ── Card click handler ────────────────────────────────────────────────────
  if (typeof onCardClick === 'function') {
    track.querySelectorAll('.lz-card').forEach(card => {
      card.addEventListener('click', () => {
        const item = data.find(d => d.id == card.dataset.id);
        if (item) onCardClick(item);
      });
    });
  }
}
