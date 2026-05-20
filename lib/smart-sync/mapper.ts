import {
  COLUMN_MAPS, ANTIDOTE_SIZE_FIELDS, EXACT_ONLY_COLS,
  KEYWORD_FINGERPRINTS, ABBREV_EXPANSIONS,
} from './column-maps';

export type MappingInfo = {
  field: string;
  matched: boolean;
  method: string | null;
  score?: number;
  autoSkipped?: boolean;
  sampleValues?: string[];
};

export type SizeCol = { header: string; label: string };

function tokenise(str: string): string[] {
  return str.toLowerCase()
    .replace(/[_\-\/\\|.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(t => t.length > 0);
}

function expandAbbrevs(tokens: string[]): string[] {
  return tokens.flatMap(t => {
    const exp = ABBREV_EXPANSIONS[t];
    if (exp === undefined) return [t];
    return exp ? exp.split(' ').filter(Boolean) : [];
  });
}

function jaccardScore(tokensA: string[], tokensB: string[]): number {
  const setA = new Set(tokensA), setB = new Set(tokensB);
  const intersection = [...setA].filter(t => setB.has(t)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

export function headerSizeLabel(h: string): string | null {
  const t = String(h).trim();
  const u = t.toUpperCase();
  if (/^(OS|O\/S|ONE.?SIZE|FREE.?SIZE|ONESIZE|UNIVERSAL)$/i.test(t)) return 'OS';
  if (/^(XXS|XS|S|M|L|XL|XXL|XXXL|[4-8]XL)$/i.test(t)) return u;
  if (/^\d{1,2}X$/i.test(t) && parseInt(t) >= 1 && parseInt(t) <= 9) return u;
  if (/^\d{1,2}T$/i.test(t)) return u;
  if (/^(NB|NEWBORN|PREEMIE|0M)$/i.test(t)) return 'NB';
  if (/^\d{1,2}[-\/]\d{1,2}M$/i.test(t)) return u;
  const regionMatch = t.match(/^(UK|EU|US|JP|FR|IT|DE|AU|NZ|KR)\s*(\d{1,3}(?:\.\d)?)$/i);
  if (regionMatch) return `${regionMatch[1].toUpperCase()} ${regionMatch[2]}`;
  if (/^\d{1,3}$/.test(t)) {
    const n = parseInt(t);
    if (n >= 0 && n <= 200) return String(n);
  }
  if (/^\d{1,2}\.\d$/.test(t)) {
    const n = parseFloat(t);
    if (n >= 0 && n <= 50) return String(n);
  }
  return null;
}

function shouldAutoSkipColumn(header: string, rows: Record<string, string>[]): boolean {
  const h = header.toLowerCase().trim();
  const skipPatterns = ['image', 'photo', 'pic', 'url', 'link', 'thumbnail', 'checksum', 'hash',
    'confirmed', 'approve', 'status', 'flag', 'row', 'line', '#', 'id', 'internal', 'ignore'];
  if (skipPatterns.some(p => h.includes(p))) return true;
  const nonEmpty = rows.map(r => String(r[header] ?? '').trim()).filter(Boolean);
  if (nonEmpty.length === 0) return true;
  // All same value
  if (new Set(nonEmpty).size === 1) return true;
  return false;
}

export function buildMappings(
  rawHeaders: string[],
  rawRows: Record<string, string>[],
): { mappings: Record<string, MappingInfo>; matchedCount: number; columnSamples: Record<string, string[]> } {
  const columnSamples: Record<string, string[]> = {};
  rawHeaders.forEach(h => {
    columnSamples[h] = rawRows
      .map(r => String(r[h] ?? '').trim())
      .filter(v => v !== '')
      .slice(0, 3);
  });

  const mappings: Record<string, MappingInfo> = {};
  let matchedCount = 0;

  rawHeaders.forEach(h => {
    const raw = String(h).toLowerCase().trim();
    const norm = raw.replace(/[_\-\/\\|.]+/g, ' ').replace(/\s+/g, ' ').trim();
    const tokens = tokenise(norm);

    let matched: string | null = null;
    let method: string | null = null;
    let score: number | null = null;

    // Pre-pass: tiered wholesale
    if (/wholesale\s*\d+\s*%/i.test(raw) || /wsp\s*\d+\s*%/i.test(raw)) {
      const pct = parseInt((raw.match(/(\d+)\s*%/) ?? [])[1] ?? '0');
      matched = pct >= 38 ? 'wsp_tier_high' : 'wsp_tier_low';
      method = 'exact';
    }

    // Pass 0: size header
    if (!matched && headerSizeLabel(h)) {
      for (const [key, aliases] of Object.entries(COLUMN_MAPS)) {
        if (EXACT_ONLY_COLS.has(key) && (aliases.includes(norm) || aliases.includes(raw))) {
          matched = key; method = 'exact'; break;
        }
      }
      if (!matched) { matched = 'size_auto'; method = 'size-auto'; }
    }

    // Pass 1: exact alias
    if (!matched) {
      for (const [key, aliases] of Object.entries(COLUMN_MAPS)) {
        if (aliases.includes(norm) || aliases.includes(raw)) { matched = key; method = 'exact'; break; }
      }
    }

    // Pass 2: Jaccard ≥ 0.40
    if (!matched) {
      let best = 0, bestKey: string | null = null;
      for (const [key, aliases] of Object.entries(COLUMN_MAPS)) {
        if (EXACT_ONLY_COLS.has(key)) continue;
        for (const alias of aliases) {
          if (alias.length <= 2) continue;
          const s = jaccardScore(tokens, tokenise(alias));
          if (s > best) { best = s; bestKey = key; }
        }
      }
      if (best >= 0.40) { matched = bestKey; method = 'fuzzy'; score = +best.toFixed(2); }
    }

    // Pass 3: keyword fingerprint
    if (!matched) {
      for (const [field, signals] of Object.entries(KEYWORD_FINGERPRINTS)) {
        if (signals.some(sig => norm.includes(sig) || (norm.length >= 3 && sig.includes(norm)))) {
          if (Object.keys(COLUMN_MAPS).includes(field)) { matched = field; method = 'fingerprint'; break; }
        }
      }
    }

    // Pass 4: abbreviation expansion
    if (!matched) {
      const expTokens = expandAbbrevs(tokens);
      const expanded = expTokens.join(' ');
      for (const [key, aliases] of Object.entries(COLUMN_MAPS)) {
        if (aliases.includes(expanded)) { matched = key; method = 'abbrev-exact'; break; }
      }
      if (!matched) {
        let best = 0, bestKey: string | null = null;
        for (const [key, aliases] of Object.entries(COLUMN_MAPS)) {
          if (EXACT_ONLY_COLS.has(key)) continue;
          for (const alias of aliases) {
            if (alias.length <= 2) continue;
            const s = jaccardScore(expTokens, tokenise(alias));
            if (s > best) { best = s; bestKey = key; }
          }
        }
        if (best >= 0.35) { matched = bestKey; method = 'abbrev-fuzzy'; score = +best.toFixed(2); }
      }
    }

    // Pass 5: substring containment
    if (!matched) {
      for (const [key, aliases] of Object.entries(COLUMN_MAPS)) {
        if (EXACT_ONLY_COLS.has(key)) continue;
        if (aliases.some(a => a.length > 3 && (norm.includes(a) || (norm.length >= 3 && a.includes(norm))))) {
          matched = key; method = 'substring'; break;
        }
      }
    }

    if (matched) {
      mappings[h] = { field: matched, matched: true, method, ...(score ? { score } : {}), sampleValues: columnSamples[h] || [] };
      matchedCount++;
    } else {
      const autoSkip = shouldAutoSkipColumn(h, rawRows);
      mappings[h] = {
        field: autoSkip ? 'skip' : h,
        matched: false,
        method: autoSkip ? 'auto-skip' : 'none',
        ...(autoSkip ? { autoSkipped: true } : {}),
        sampleValues: columnSamples[h] || [],
      };
    }
  });

  // Conflict resolution for high-importance fields
  const HIGH_IMPORTANCE = ['description', 'sku', 'wsp_usd', 'srp', 'color'];
  const METHOD_PRIORITY: Record<string, number> = {
    exact: 5, 'abbrev-exact': 4, fingerprint: 3, 'abbrev-fuzzy': 2, fuzzy: 2, substring: 1,
  };
  HIGH_IMPORTANCE.forEach(field => {
    const competing = Object.entries(mappings).filter(([, v]) => v.matched && v.field === field);
    if (competing.length <= 1) return;
    const scored = competing.map(([h, info]) => ({
      h, info, total: METHOD_PRIORITY[info.method ?? ''] || 0,
    }));
    scored.sort((a, b) => b.total - a.total);
    scored.slice(1).forEach(({ h }) => {
      const autoSkip = shouldAutoSkipColumn(h, rawRows);
      mappings[h] = { ...mappings[h], field: autoSkip ? 'skip' : h, matched: false, method: autoSkip ? 'auto-skip' : 'conflict' };
      matchedCount--;
    });
  });

  // WSP vs SRP price disambiguation
  const priceConflicts = Object.entries(mappings)
    .filter(([, v]) => v.matched && (v.field === 'wsp_usd' || v.field === 'srp'));
  if (priceConflicts.length === 2) {
    const [[hA], [hB]] = priceConflicts;
    const avg = (h: string) => (columnSamples[h] ?? [])
      .map(v => parseFloat(v.replace(/[^0-9.]/g, '')) || 0)
      .filter(v => v > 0)
      .reduce((s, v, _, a) => s + v / a.length, 0);
    const avgA = avg(hA), avgB = avg(hB);
    if (avgA > 0 && avgB > 0 && avgA !== avgB) {
      const [lowH, highH] = avgA < avgB ? [hA, hB] : [hB, hA];
      if (mappings[lowH].field !== 'wsp_usd') mappings[lowH].field = 'wsp_usd';
      if (mappings[highH].field !== 'srp') mappings[highH].field = 'srp';
    }
  }

  return { mappings, matchedCount, columnSamples };
}

export function buildSizeCols(
  rawHeaders: string[],
  rawRows: Record<string, string>[],
  mappings: Record<string, MappingInfo>,
): SizeCol[] {
  const activeSizeCols: SizeCol[] = [];
  const seen = new Set<string>();

  function columnHasSizeValues(header: string): boolean {
    const nonEmpty = rawRows.map(r => r[header]).filter(v => v !== '' && v !== null && v !== undefined);
    if (nonEmpty.length === 0) return false;
    const intLike = nonEmpty.filter(v => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 && Number.isInteger(n) && n <= 9999;
    });
    return intLike.length / nonEmpty.length >= 0.6;
  }

  // Pass A: already recognised
  rawHeaders.forEach(h => {
    const info = mappings[h];
    if (info?.matched && ANTIDOTE_SIZE_FIELDS[info.field]) {
      const label = ANTIDOTE_SIZE_FIELDS[info.field];
      if (!seen.has(h)) { activeSizeCols.push({ header: h, label }); seen.add(h); }
    }
  });

  // Pass B: dynamic detection
  rawHeaders.forEach(h => {
    if (seen.has(h)) return;
    const info = mappings[h];
    if (info?.matched && info.field !== 'size_auto') return;
    const label = headerSizeLabel(h);
    if (!label) return;
    if (!columnHasSizeValues(h)) return;
    mappings[h] = { field: 'size_auto', matched: true, method: 'size-auto' };
    activeSizeCols.push({ header: h, label });
    seen.add(h);
  });

  return activeSizeCols;
}

export function extractProducts(
  rawHeaders: string[],
  rawRows: Record<string, string>[],
  mappings: Record<string, MappingInfo>,
  activeSizeCols: SizeCol[],
  brandCode: string = '',
): Record<string, unknown>[] {
  // Build reverse map
  const reverseMap: Record<string, string[]> = {};
  Object.entries(mappings).forEach(([origH, v]) => {
    if (!reverseMap[v.field]) reverseMap[v.field] = [];
    reverseMap[v.field].push(origH);
  });

  const getField = (row: Record<string, string>, fieldName: string): string | undefined => {
    for (const h of (reverseMap[fieldName] ?? [])) {
      const v = row[h];
      if (v !== undefined && v !== '' && v !== null) return String(v);
    }
    return undefined;
  };

  const NON_PRODUCT_RE = /^(total|subtotal|grand[\s_]?total|page\s*\d+|notes?|ref(?:erence)?|tbc|tbd|n\/a|[\-–—]{2,})$/i;

  const products: Record<string, unknown>[] = [];
  const usedSkus = new Set<string>();
  let seq = 1;

  rawRows.forEach(row => {
    const rawName = (getField(row, 'name') ?? getField(row, 'description') ?? '').trim();
    if (!rawName) return;
    if (NON_PRODUCT_RE.test(rawName)) return;

    // Sizes
    const sizes: Record<string, number> = {};
    activeSizeCols.forEach(({ header, label }) => {
      const v = Math.round(Number(row[header] ?? 0) || 0);
      if (v > 0) sizes[label] = v;
    });

    const rawSku = (getField(row, 'sku') ?? '').trim();
    let sku = rawSku;
    if (!sku) {
      const bc = brandCode || 'SKU';
      sku = `${bc}-${String(seq++).padStart(4, '0')}`;
      while (usedSkus.has(sku)) sku = `${bc}-${String(seq++).padStart(4, '0')}`;
    }
    usedSkus.add(sku);

    const wsp = parseFloat(getField(row, 'wsp_usd') ?? '') || 0;
    const srp = parseFloat(getField(row, 'srp') ?? '') || 0;
    const stockFromSizes = Object.values(sizes).reduce((a, b) => a + b, 0);
    const stockRaw = parseFloat(getField(row, 'stock_total') ?? '') || stockFromSizes;

    // Tier pricing
    const tier_pricing: unknown[] = [];
    const tierHigh = parseFloat(getField(row, 'wsp_tier_high') ?? '') || 0;
    const tierLow  = parseFloat(getField(row, 'wsp_tier_low')  ?? '') || 0;
    if (tierHigh && tierLow) {
      tier_pricing.push({ moq: 1, wsp: tierHigh }, { moq: 6, wsp: tierLow });
    }

    const imageUrls: string[] = [];
    (reverseMap['image_url'] ?? []).forEach(h => {
      const v = row[h];
      if (v && v.startsWith('http')) imageUrls.push(v);
    });

    products.push({
      sku,
      description     : rawName,
      color           : (getField(row, 'color') ?? '').trim(),
      gender          : normaliseGender(getField(row, 'gender') ?? ''),
      season          : (getField(row, 'season') ?? '').trim(),
      brand_name      : (getField(row, 'brand_name') ?? '').trim(),
      category        : normaliseCategory(getField(row, 'category') ?? ''),
      material        : (getField(row, 'material') ?? '').trim() || null,
      delivery_window : (getField(row, 'delivery_window') ?? '').trim() || null,
      product_notes   : (getField(row, 'product_notes') ?? '').trim(),
      wsp_usd         : wsp || (srp > 0 ? +(srp * 0.5).toFixed(2) : 0),
      srp,
      cost            : parseFloat(getField(row, 'cost') ?? '') || null,
      moq             : Math.max(1, Math.floor(parseFloat(getField(row, 'moq') ?? '') || 1)),
      stock_total     : Math.floor(stockRaw),
      sizes,
      tier_pricing,
      image_urls      : imageUrls,
      tags            : [],
      margin          : 0.5,
    });
  });

  return products;
}

function normaliseGender(raw: string): string {
  const v = raw.toLowerCase().trim();
  if (/^(m|men|mens|male|homme|herr)/.test(v)) return 'Men';
  if (/^(w|women|womens|female|ladies|femme|dame)/.test(v)) return 'Women';
  if (/^(boy|garçon|garcon)/.test(v)) return 'Boys';
  if (/^(girl|fille)/.test(v)) return 'Girls';
  if (/^(kid|child|enfant|kinder|junior)/.test(v)) return 'Kids';
  if (/^(unisex|uni|both)/.test(v)) return 'Unisex';
  return 'Unisex';
}

function normaliseCategory(raw: string): string {
  if (!raw) return 'GENERAL';
  return raw.toUpperCase().trim() || 'GENERAL';
}
