-- ============================================================
-- LINEZHEETS — SAMPLE DATA: 20 BRANDS + 50+ PRODUCTS
-- Run in Supabase SQL Editor
-- ============================================================

-- ─── BRAND USERS ────────────────────────────────────────────

INSERT INTO users (id, email, password_hash, role, first_name, last_name, email_verified) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'studio@maison-verdant.com',   '$2b$10$placeholder', 'brand', 'Isabelle',  'Martel',     true),
  ('a1000000-0000-0000-0000-000000000002', 'hello@aurelioatelier.com',     '$2b$10$placeholder', 'brand', 'Aurelio',   'Ferrante',   true),
  ('a1000000-0000-0000-0000-000000000003', 'press@tokyothreads.co',        '$2b$10$placeholder', 'brand', 'Hana',      'Mori',       true),
  ('a1000000-0000-0000-0000-000000000004', 'info@kesslerhaus.de',          '$2b$10$placeholder', 'brand', 'Klaus',     'Kessler',    true),
  ('a1000000-0000-0000-0000-000000000005', 'contact@solariocouture.com',   '$2b$10$placeholder', 'brand', 'Valentina', 'Solario',    true),
  ('a1000000-0000-0000-0000-000000000006', 'team@duskmoderna.com',         '$2b$10$placeholder', 'brand', 'Priya',     'Anand',      true),
  ('a1000000-0000-0000-0000-000000000007', 'studio@lerouxparis.fr',        '$2b$10$placeholder', 'brand', 'Jean-Luc',  'Leroux',     true),
  ('a1000000-0000-0000-0000-000000000008', 'trade@northernloom.no',        '$2b$10$placeholder', 'brand', 'Astrid',    'Lindqvist',  true),
  ('a1000000-0000-0000-0000-000000000009', 'hello@obsidianform.com',       '$2b$10$placeholder', 'brand', 'Marcus',    'Vane',       true),
  ('a1000000-0000-0000-0000-000000000010', 'press@casadelmar.mx',          '$2b$10$placeholder', 'brand', 'Carmen',    'Elizondo',   true),
  ('a1000000-0000-0000-0000-000000000011', 'studio@theivoryarchive.com',   '$2b$10$placeholder', 'brand', 'Rosamund',  'Clare',      true),
  ('a1000000-0000-0000-0000-000000000012', 'info@lumicraftseoul.kr',       '$2b$10$placeholder', 'brand', 'Ji-won',    'Oh',         true),
  ('a1000000-0000-0000-0000-000000000013', 'trade@bergamocraft.it',        '$2b$10$placeholder', 'brand', 'Lorenzo',   'Bergamo',    true),
  ('a1000000-0000-0000-0000-000000000014', 'hello@rawdesertco.com',        '$2b$10$placeholder', 'brand', 'Saoirse',   'Dunne',      true),
  ('a1000000-0000-0000-0000-000000000015', 'studio@velvetchapterny.com',   '$2b$10$placeholder', 'brand', 'Dominique', 'Fontaine',   true),
  ('a1000000-0000-0000-0000-000000000016', 'press@archipelagolabel.com',   '$2b$10$placeholder', 'brand', 'Tariq',     'Al-Rashid',  true),
  ('a1000000-0000-0000-0000-000000000017', 'info@sableclothing.au',        '$2b$10$placeholder', 'brand', 'Matilda',   'Hawke',      true),
  ('a1000000-0000-0000-0000-000000000018', 'hello@nocturnemilano.it',      '$2b$10$placeholder', 'brand', 'Enzo',      'Ricci',      true),
  ('a1000000-0000-0000-0000-000000000019', 'trade@cedarandindigo.ca',      '$2b$10$placeholder', 'brand', 'Lena',      'Beaumont',   true),
  ('a1000000-0000-0000-0000-000000000020', 'studio@strandhaus.dk',         '$2b$10$placeholder', 'brand', 'Nikolai',   'Strand',     true);

-- ─── BRANDS ─────────────────────────────────────────────────

INSERT INTO brands (id, user_id, name, slug, description, story, website, instagram, founded_year, country, currency, status, featured, subscription_tier, subscription_status, commission_rate, min_order_amount) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'Maison Verdant', 'maison-verdant',
   'Parisian botanical luxury — womenswear rooted in biophilic design and sustainable silk.',
   'Founded in a converted greenhouse in the 11th arrondissement, Maison Verdant weaves living-world textures into refined womenswear.',
   'https://maison-verdant.com', '@maisonverdant', 2018, 'FR', 'EUR', 'approved', true, 'studio', 'active', 3.00, 800.00),

  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002',
   'Aurelio Atelier', 'aurelio-atelier',
   'Florentine menswear atelier — bespoke tailoring translated into accessible ready-to-wear.',
   'Three generations of Florentine tailoring converge in Aurelio Atelier, where hand-rolled lapels meet modern silhouettes.',
   'https://aurelioatelier.com', '@aurelioatelier', 2015, 'IT', 'EUR', 'approved', true, 'enterprise', 'active', 2.50, 1200.00),

  ('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003',
   'Tokyo Threads', 'tokyo-threads',
   'Tokyo-based concept label blending minimal Japanese craft with street-influenced silhouettes.',
   'Born out of a Shimokitazawa studio, Tokyo Threads distils Ura-Harajuku culture into clean, wearable architecture.',
   'https://tokyothreads.co', '@tokyothreads', 2020, 'JP', 'USD', 'approved', false, 'studio', 'active', 3.00, 600.00),

  ('b1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000004',
   'Kessler Haus', 'kessler-haus',
   'Berlin-based avant-garde label — deconstructed tailoring for the intellectually dressed.',
   'Klaus Kessler trained under a Frankfurt architect before pivoting to fashion; every seam tells a structural story.',
   'https://kesslerhaus.de', '@kesslerhaus', 2017, 'DE', 'EUR', 'approved', true, 'studio', 'active', 3.00, 700.00),

  ('b1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000005',
   'Solario Couture', 'solario-couture',
   'Milan-based luxury eveningwear — embroidered gowns and sculptural cocktail pieces.',
   'Valentina Solario spent a decade at a Milanese atelier before launching her signature embroidery-heavy line in 2019.',
   'https://solariocouture.com', '@solariocouture', 2019, 'IT', 'EUR', 'approved', true, 'enterprise', 'active', 2.00, 2000.00),

  ('b1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000006',
   'Dusk Moderna', 'dusk-moderna',
   'Mumbai-born contemporary label — resort-wear infused with Rajasthani textile heritage.',
   'Priya Anand bridges Jaipur block-print traditions with globally fluent silhouettes from her Bandra design studio.',
   'https://duskmoderna.com', '@duskmoderna', 2021, 'IN', 'USD', 'approved', false, 'starter', 'active', 3.50, 500.00),

  ('b1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000007',
   'Le Roux Paris', 'le-roux-paris',
   'Parisian heritage brand — classic French tailoring for discerning women.',
   'Jean-Luc Leroux revived his grandmother''s Marais atelier in 2016, marrying postwar French elegance with contemporary ease.',
   'https://lerouxparis.fr', '@lerouxparis', 2016, 'FR', 'EUR', 'approved', false, 'studio', 'active', 3.00, 900.00),

  ('b1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000008',
   'Northern Loom', 'northern-loom',
   'Oslo knitwear and outerwear — heritage Scandinavian craft for the modern wardrobe.',
   'Astrid Lindqvist sources wool from Faroese farms and hand-weaves seasonal collections in a century-old Oslo loom house.',
   'https://northernloom.no', '@northernloom', 2014, 'NO', 'EUR', 'approved', true, 'enterprise', 'active', 2.50, 1000.00),

  ('b1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000009',
   'Obsidian Form', 'obsidian-form',
   'New York-based luxury leather goods and accessories — bold geometry, minimal palette.',
   'Marcus Vane left an architecture firm to craft bags with the same precision he gave to buildings.',
   'https://obsidianform.com', '@obsidianform', 2019, 'US', 'USD', 'approved', false, 'studio', 'active', 3.00, 750.00),

  ('b1000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000010',
   'Casa del Mar', 'casa-del-mar',
   'Oaxacan resort and beach luxury — hand-woven cottons and natural dyes.',
   'Carmen Elizondo works with a cooperative of Zapotec weavers to produce limited seasonal collections celebrating Mexican textile arts.',
   'https://casadelmar.mx', '@casadelmarmx', 2018, 'MX', 'USD', 'approved', true, 'studio', 'active', 3.00, 500.00),

  ('b1000000-0000-0000-0000-000000000011', 'a1000000-0000-0000-0000-000000000011',
   'The Ivory Archive', 'the-ivory-archive',
   'London luxury archival-inspired womenswear — draped silhouettes in natural fibres.',
   'Rosamund Clare''s Central Saint Martins background shows in every asymmetric hem and intentional unfinished edge.',
   'https://theivoryarchive.com', '@theivoryarchive', 2020, 'GB', 'GBP', 'approved', false, 'studio', 'active', 3.00, 800.00),

  ('b1000000-0000-0000-0000-000000000012', 'a1000000-0000-0000-0000-000000000012',
   'Lumicraft Seoul', 'lumicraft-seoul',
   'Seoul contemporary label — gender-fluid silhouettes with Korean craft detailing.',
   'Ji-won Oh studied in London and Seoul, fusing K-fashion energy with the quiet elegance of hanji-inspired textures.',
   'https://lumicraftseoul.kr', '@lumicraftseoul', 2022, 'KR', 'USD', 'approved', false, 'starter', 'active', 3.50, 500.00),

  ('b1000000-0000-0000-0000-000000000013', 'a1000000-0000-0000-0000-000000000013',
   'Bergamo Craft', 'bergamo-craft',
   'Italian artisan leather accessories — handmade belts, wallets, and small leather goods.',
   'The Bergamo family has operated a leather workshop in Tuscany since 1962; the fourth generation now ships globally.',
   'https://bergamocraft.it', '@bergamocraft', 1962, 'IT', 'EUR', 'approved', true, 'enterprise', 'active', 2.00, 1500.00),

  ('b1000000-0000-0000-0000-000000000014', 'a1000000-0000-0000-0000-000000000014',
   'Raw Desert Co.', 'raw-desert-co',
   'Arizona-founded slow-fashion brand — desert-toned basics in organic and recycled materials.',
   'Saoirse Dunne relocated from Dublin to Tucson and found her palette in the Sonoran Desert — muted terracottas, sage, and dust.',
   'https://rawdesertco.com', '@rawdesertco', 2021, 'US', 'USD', 'approved', false, 'starter', 'active', 3.50, 400.00),

  ('b1000000-0000-0000-0000-000000000015', 'a1000000-0000-0000-0000-000000000015',
   'Velvet Chapter NY', 'velvet-chapter-ny',
   'New York luxury womenswear — velvet-focused capsule collections with an editorial edge.',
   'Dominique Fontaine channels old-school NYC glamour through modern velvet-forward silhouettes designed for real living.',
   'https://velvetchapterny.com', '@velvetchapterny', 2017, 'US', 'USD', 'approved', true, 'studio', 'active', 3.00, 900.00),

  ('b1000000-0000-0000-0000-000000000016', 'a1000000-0000-0000-0000-000000000016',
   'Archipelago Label', 'archipelago-label',
   'Dubai-based multi-cultural contemporary brand — global references, desert luxury finish.',
   'Tariq Al-Rashid''s multi-city upbringing — Dubai, London, Beirut — flows into every culturally layered collection.',
   'https://archipelagolabel.com', '@archipelagolabel', 2020, 'AE', 'USD', 'approved', false, 'studio', 'active', 3.00, 700.00),

  ('b1000000-0000-0000-0000-000000000017', 'a1000000-0000-0000-0000-000000000017',
   'Sable Clothing', 'sable-clothing',
   'Sydney contemporary womenswear — relaxed luxury for the coastal-to-city woman.',
   'Matilda Hawke grew up between Sydney''s Northern Beaches and its CBD, crafting pieces that transition effortlessly between both worlds.',
   'https://sableclothing.au', '@sableclothingau', 2019, 'AU', 'AUD', 'approved', false, 'studio', 'active', 3.00, 600.00),

  ('b1000000-0000-0000-0000-000000000018', 'a1000000-0000-0000-0000-000000000018',
   'Notturno Milano', 'notturno-milano',
   'Milan nightwear and lounge — luxury at-home dressing in the Italian tradition.',
   'Enzo Ricci reimagines the Italian dolce far niente through pajama silhouettes elevated with Como silk and fine embroidery.',
   'https://nocturnemilano.it', '@notturno.milano', 2018, 'IT', 'EUR', 'approved', true, 'studio', 'active', 3.00, 800.00),

  ('b1000000-0000-0000-0000-000000000019', 'a1000000-0000-0000-0000-000000000019',
   'Cedar & Indigo', 'cedar-and-indigo',
   'Vancouver sustainable womenswear — plant-dyed naturals and low-impact manufacturing.',
   'Lena Beaumont left a career in environmental science to build Cedar & Indigo, a brand where every dye bath is documented for transparency.',
   'https://cedarandindigo.ca', '@cedarandindigo', 2020, 'CA', 'CAD', 'approved', false, 'starter', 'active', 3.50, 500.00),

  ('b1000000-0000-0000-0000-000000000020', 'a1000000-0000-0000-0000-000000000020',
   'Strand Haus', 'strand-haus',
   'Copenhagen minimalist menswear — clean Scandinavian lines, premium fabrics.',
   'Nikolai Strand designs from a studio overlooking the Øresund strait, where grey water and white sky define the brand''s restrained palette.',
   'https://strandhaus.dk', '@strandhaus', 2016, 'DK', 'EUR', 'approved', true, 'enterprise', 'active', 2.50, 1000.00);

-- ─── PRODUCTS ───────────────────────────────────────────────
-- ~3 products per brand = 60 total

DO $$
DECLARE
  -- category UUIDs from seeded categories table
  cat_womens   UUID;
  cat_mens     UUID;
  cat_access   UUID;
  cat_footwear UUID;
  cat_luxury   UUID;
  cat_contemp  UUID;
  cat_denim    UUID;
  cat_active   UUID;
  cat_outer    UUID;
  cat_bridal   UUID;
BEGIN
  SELECT id INTO cat_womens   FROM categories WHERE slug='womenswear';
  SELECT id INTO cat_mens     FROM categories WHERE slug='menswear';
  SELECT id INTO cat_access   FROM categories WHERE slug='accessories';
  SELECT id INTO cat_footwear FROM categories WHERE slug='footwear';
  SELECT id INTO cat_luxury   FROM categories WHERE slug='luxury';
  SELECT id INTO cat_contemp  FROM categories WHERE slug='contemporary';
  SELECT id INTO cat_denim    FROM categories WHERE slug='denim';
  SELECT id INTO cat_active   FROM categories WHERE slug='activewear';
  SELECT id INTO cat_outer    FROM categories WHERE slug='outerwear';
  SELECT id INTO cat_bridal   FROM categories WHERE slug='bridal';

-- ── MAISON VERDANT ──────────────────────────────────────────
INSERT INTO products (id, brand_id, category_id, name, slug, description, wholesale_price, retail_price, msrp, sku_prefix, style_number, season, delivery_window, min_order_qty, tags, style_dna, status, featured) VALUES
  ('p1000001-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', cat_womens,
   'Fern Drape Midi Dress', 'fern-drape-midi-dress',
   'Fluid midi dress in sage-green botanical-print silk. Side-seam pockets, self-tie waist, invisible zip.',
   245.00, 610.00, 610.00, 'MVD', 'MV-SS26-001', 'SS26', 'Jan–Mar 2026', 2,
   ARRAY['silk','botanical','midi','sage','dress'], '{"aesthetic":["botanical","romantic"],"mood":["ethereal","garden"],"palette":["sage","ivory"]}', 'active', true),

  ('p1000001-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', cat_womens,
   'Ivy Wrap Blouse', 'ivy-wrap-blouse',
   'Relaxed wrap blouse in ivory habotai silk with hand-painted ivy leaf motif along the hem.',
   140.00, 350.00, 350.00, 'MVB', 'MV-SS26-002', 'SS26', 'Jan–Mar 2026', 3,
   ARRAY['silk','wrap','blouse','ivory','botanical'], '{"aesthetic":["botanical","feminine"],"mood":["fresh","airy"],"palette":["ivory","cream"]}', 'active', false),

  ('p1000001-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000001', cat_womens,
   'Moss Linen Trousers', 'moss-linen-trousers',
   'Wide-leg linen trousers in warm moss. High waist, flat front, cropped at the ankle.',
   165.00, 415.00, 415.00, 'MVT', 'MV-SS26-003', 'SS26', 'Jan–Mar 2026', 2,
   ARRAY['linen','trousers','wide-leg','moss','bottoms'], '{"aesthetic":["minimal","botanical"],"mood":["calm","earthy"],"palette":["moss","olive"]}', 'active', false),

-- ── AURELIO ATELIER ─────────────────────────────────────────
  ('p1000002-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', cat_mens,
   'Venezia Single-Breasted Blazer', 'venezia-single-breasted-blazer',
   'Hand-canvassed single-breasted blazer in petrol-blue pure wool. Surgeon cuffs, pick-stitched lapel.',
   520.00, 1300.00, 1300.00, 'AAB', 'AA-FW25-001', 'FW25', 'Aug–Sep 2025', 1,
   ARRAY['blazer','tailoring','wool','menswear','blue'], '{"aesthetic":["classic","tailored"],"mood":["refined","confident"],"palette":["petrol","navy"]}', 'active', true),

  ('p1000002-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', cat_mens,
   'Cashmere Rollneck Sweater', 'cashmere-rollneck-sweater',
   'Two-ply cashmere rollneck in oatmeal. Relaxed fit, ribbed hem and cuffs.',
   310.00, 775.00, 775.00, 'AAS', 'AA-FW25-002', 'FW25', 'Aug–Sep 2025', 2,
   ARRAY['cashmere','knitwear','rollneck','oatmeal'], '{"aesthetic":["classic","luxe"],"mood":["warm","effortless"],"palette":["oatmeal","cream"]}', 'active', false),

  ('p1000002-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000002', cat_mens,
   'Slim Wool Flannel Trouser', 'slim-wool-flannel-trouser',
   'Slim-cut flannel trousers in mid-grey herringbone. Double-pleat, side adjusters, satin-lined.',
   280.00, 700.00, 700.00, 'AAT', 'AA-FW25-003', 'FW25', 'Aug–Sep 2025', 1,
   ARRAY['flannel','trousers','herringbone','grey','menswear'], '{"aesthetic":["tailored","classic"],"mood":["professional","polished"],"palette":["grey","charcoal"]}', 'active', false),

-- ── TOKYO THREADS ────────────────────────────────────────────
  ('p1000003-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000003', cat_contemp,
   'Origami Cargo Pant', 'origami-cargo-pant',
   'Deconstructed cargo silhouette in washed black technical canvas. Asymmetric pleats, origami pocket detail.',
   195.00, 485.00, 485.00, 'TTP', 'TT-SS26-001', 'SS26', 'Feb–Apr 2026', 2,
   ARRAY['cargo','technical','black','unisex','contemporary'], '{"aesthetic":["streetwear","minimal"],"mood":["urban","edgy"],"palette":["black","anthracite"]}', 'active', true),

  ('p1000003-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000003', cat_contemp,
   'Shibori Indigo Overshirt', 'shibori-indigo-overshirt',
   'Long overshirt in shibori-dyed cotton. Hand-resist-dyed, each piece unique. Boxy cut, dropped shoulder.',
   175.00, 440.00, 440.00, 'TTO', 'TT-SS26-002', 'SS26', 'Feb–Apr 2026', 1,
   ARRAY['shibori','indigo','overshirt','unisex','handmade'], '{"aesthetic":["artisan","minimalist"],"mood":["meditative","cool"],"palette":["indigo","navy","white"]}', 'active', false),

  ('p1000003-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000003', cat_contemp,
   'Haiku Graphic Tee', 'haiku-graphic-tee',
   'Heavyweight 220gsm cotton tee with a hand-printed haiku from a Kyoto poet. Boxy silhouette.',
   75.00, 185.00, 185.00, 'TTT', 'TT-SS26-003', 'SS26', 'Feb–Apr 2026', 4,
   ARRAY['tee','graphic','cotton','unisex','art'], '{"aesthetic":["artisan","streetwear"],"mood":["poetic","urban"],"palette":["white","black"]}', 'active', false),

-- ── KESSLER HAUS ─────────────────────────────────────────────
  ('p1000004-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000004', cat_mens,
   'Deconstructed Wool Coat', 'deconstructed-wool-coat',
   'Unlined deconstructed overcoat in charcoal boiled wool. Raw edges, asymmetric front panel, architect collar.',
   480.00, 1200.00, 1200.00, 'KHC', 'KH-FW25-001', 'FW25', 'Sep–Oct 2025', 1,
   ARRAY['coat','wool','deconstructed','charcoal','outerwear'], '{"aesthetic":["avant-garde","architectural"],"mood":["intellectual","dark"],"palette":["charcoal","grey"]}', 'active', true),

  ('p1000004-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000004', cat_mens,
   'Asymmetric Seam Trousers', 'asymmetric-seam-trousers',
   'Wide-leg trousers with deliberately mis-aligned seams. Concrete-grey heavy cotton twill.',
   265.00, 660.00, 660.00, 'KHT', 'KH-FW25-002', 'FW25', 'Sep–Oct 2025', 1,
   ARRAY['trousers','asymmetric','wide-leg','grey','menswear'], '{"aesthetic":["avant-garde","deconstructed"],"mood":["conceptual","bold"],"palette":["concrete","grey"]}', 'active', false),

  ('p1000004-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000004', cat_mens,
   'Inverse Seam Shirt', 'inverse-seam-shirt',
   'Poplin shirt with all seams pressed outward. Boxy cut, band collar, black tourmaline buttons.',
   185.00, 465.00, 465.00, 'KHS', 'KH-FW25-003', 'FW25', 'Sep–Oct 2025', 2,
   ARRAY['shirt','poplin','deconstructed','white','band collar'], '{"aesthetic":["avant-garde","minimal"],"mood":["intellectual","clean"],"palette":["white","black"]}', 'active', false),

-- ── SOLARIO COUTURE ──────────────────────────────────────────
  ('p1000005-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000005', cat_luxury,
   'Aurora Embroidered Gown', 'aurora-embroidered-gown',
   'Floor-length gown in ivory duchess satin. Hand-stitched aurora borealis bead embroidery across bodice. Made to order.',
   2400.00, 6000.00, 6000.00, 'SCG', 'SC-SS26-001', 'SS26', 'Dec 2025–Feb 2026', 1,
   ARRAY['gown','embroidery','couture','ivory','eveningwear'], '{"aesthetic":["couture","romantic"],"mood":["ethereal","celebratory"],"palette":["ivory","gold","aurora"]}', 'active', true),

  ('p1000005-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000005', cat_luxury,
   'Celestial Beaded Mini', 'celestial-beaded-mini',
   'Crystal-beaded mini dress with layered tulle underlayer. Scattered star motif, keyhole back.',
   1100.00, 2750.00, 2750.00, 'SCM', 'SC-SS26-002', 'SS26', 'Dec 2025–Feb 2026', 1,
   ARRAY['mini','beaded','crystal','eveningwear','luxury'], '{"aesthetic":["couture","glamour"],"mood":["festive","dazzling"],"palette":["silver","crystal","white"]}', 'active', true),

  ('p1000005-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000005', cat_luxury,
   'Garnet Corset Blouse', 'garnet-corset-blouse',
   'Structured corset blouse in garnet silk faille. Boning detail, statement peplum, covered buttons.',
   620.00, 1550.00, 1550.00, 'SCB', 'SC-SS26-003', 'SS26', 'Dec 2025–Feb 2026', 1,
   ARRAY['blouse','corset','silk','garnet','structured'], '{"aesthetic":["couture","dramatic"],"mood":["bold","sensual"],"palette":["garnet","deep red"]}', 'active', false),

-- ── DUSK MODERNA ────────────────────────────────────────────
  ('p1000006-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000006', cat_womens,
   'Jaipur Block-Print Kaftan', 'jaipur-block-print-kaftan',
   'Airy kaftan in hand block-printed cotton muslin. Rajasthani floral motif, gold thread accents, tasselled neckline.',
   185.00, 465.00, 465.00, 'DMK', 'DM-SS26-001', 'SS26', 'Jan–Mar 2026', 2,
   ARRAY['kaftan','block-print','cotton','resort','Indian'], '{"aesthetic":["artisan","resort"],"mood":["joyful","vibrant"],"palette":["terracotta","gold","cobalt"]}', 'active', true),

  ('p1000006-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000006', cat_womens,
   'Indigo Leheriya Midi Skirt', 'indigo-leheriya-midi-skirt',
   'Tiered midi skirt in indigo leheriya-dyed georgette. Elasticated waist, two-toned ripple pattern.',
   145.00, 360.00, 360.00, 'DMS', 'DM-SS26-002', 'SS26', 'Jan–Mar 2026', 2,
   ARRAY['skirt','midi','indigo','georgette','resort'], '{"aesthetic":["artisan","feminine"],"mood":["breezy","cultural"],"palette":["indigo","white"]}', 'active', false),

  ('p1000006-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000006', cat_access,
   'Sanganeri Embroidered Tote', 'sanganeri-embroidered-tote',
   'Canvas tote with Sanganeri hand embroidery panel. Leather handles, zip top closure, interior pocket.',
   110.00, 275.00, 275.00, 'DMA', 'DM-SS26-003', 'SS26', 'Jan–Mar 2026', 3,
   ARRAY['tote','embroidery','canvas','accessories','Indian'], '{"aesthetic":["artisan","colourful"],"mood":["cheerful","cultural"],"palette":["multicolour","natural"]}', 'active', false),

-- ── LE ROUX PARIS ────────────────────────────────────────────
  ('p1000007-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000007', cat_womens,
   'Marais Tailored Blazer', 'marais-tailored-blazer',
   'Single-breasted blazer in warm beige boucle. French seams, notch lapel, satin-lined sleeves.',
   380.00, 950.00, 950.00, 'LRB', 'LR-FW25-001', 'FW25', 'Aug–Oct 2025', 1,
   ARRAY['blazer','boucle','beige','tailored','womenswear'], '{"aesthetic":["classic","Parisian"],"mood":["chic","polished"],"palette":["beige","ivory"]}', 'active', true),

  ('p1000007-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000007', cat_womens,
   'Sabine Silk Midi Skirt', 'sabine-silk-midi-skirt',
   'A-line midi in ivory crêpe de chine. Inverted box pleat, concealed back zip, slight kick flare.',
   220.00, 550.00, 550.00, 'LRS', 'LR-FW25-002', 'FW25', 'Aug–Oct 2025', 2,
   ARRAY['skirt','midi','silk','ivory','feminine'], '{"aesthetic":["feminine","classic"],"mood":["elegant","airy"],"palette":["ivory","blush"]}', 'active', false),

  ('p1000007-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000007', cat_womens,
   'Pont Neuf Trench Coat', 'pont-neuf-trench-coat',
   'Classic double-breasted trench in camel cotton-gabardine. Detachable belt, storm flap, D-ring tabs.',
   490.00, 1225.00, 1225.00, 'LRC', 'LR-FW25-003', 'FW25', 'Aug–Oct 2025', 1,
   ARRAY['trench','coat','camel','classic','outerwear'], '{"aesthetic":["classic","Parisian"],"mood":["timeless","confident"],"palette":["camel","tan"]}', 'active', true),

-- ── NORTHERN LOOM ────────────────────────────────────────────
  ('p1000008-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000008', cat_outer,
   'Faroe Merino Coat', 'faroe-merino-coat',
   'Oversized double-faced merino coat in storm blue. Patch pockets, horn buttons, unlined for drape.',
   680.00, 1700.00, 1700.00, 'NLC', 'NL-FW25-001', 'FW25', 'Jul–Sep 2025', 1,
   ARRAY['coat','merino','oversize','blue','outerwear'], '{"aesthetic":["Scandinavian","luxe"],"mood":["strong","serene"],"palette":["storm blue","slate"]}', 'active', true),

  ('p1000008-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000008', cat_womens,
   'Lofoten Cable Knit Jumper', 'lofoten-cable-knit-jumper',
   'Hand-loomed chunky cable-knit in undyed natural Faroese wool. Relaxed boxy fit, ribbed trims.',
   290.00, 725.00, 725.00, 'NLJ', 'NL-FW25-002', 'FW25', 'Jul–Sep 2025', 1,
   ARRAY['knitwear','cable','merino','natural','jumper'], '{"aesthetic":["heritage","coastal"],"mood":["cosy","artisan"],"palette":["natural","ecru","oatmeal"]}', 'active', true),

  ('p1000008-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000008', cat_access,
   'Wool Woven Throw Scarf', 'wool-woven-throw-scarf',
   'Extra-large woven scarf in charcoal and cream geometric pattern. 100% Faroese wool, fringe ends.',
   185.00, 460.00, 460.00, 'NLS', 'NL-FW25-003', 'FW25', 'Jul–Sep 2025', 2,
   ARRAY['scarf','wool','woven','grey','accessories'], '{"aesthetic":["heritage","Scandinavian"],"mood":["warm","textural"],"palette":["charcoal","cream"]}', 'active', false),

-- ── OBSIDIAN FORM ────────────────────────────────────────────
  ('p1000009-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000009', cat_access,
   'Monolith Structured Tote', 'monolith-structured-tote',
   'Rigid-frame tote in matte black full-grain leather. Geometric brass hardware, suede interior, key hook.',
   595.00, 1490.00, 1490.00, 'OFT', 'OF-SS26-001', 'SS26', 'Jan–Mar 2026', 1,
   ARRAY['tote','leather','black','structured','accessories'], '{"aesthetic":["architectural","minimal"],"mood":["powerful","urban"],"palette":["black","brass"]}', 'active', true),

  ('p1000009-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000009', cat_access,
   'Basalt Card Holder', 'basalt-card-holder',
   'Slim card holder in textured basalt-black calfskin. Six card slots, centre cash compartment.',
   120.00, 300.00, 300.00, 'OFC', 'OF-SS26-002', 'SS26', 'Jan–Mar 2026', 3,
   ARRAY['cardholder','leather','black','accessories','slim'], '{"aesthetic":["minimal","architectural"],"mood":["sleek","functional"],"palette":["black","basalt"]}', 'active', false),

  ('p1000009-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000009', cat_access,
   'Void Belt 35mm', 'void-belt-35mm',
   '35mm harness-leather belt in obsidian black. Hand-burnished edges, matte brass pin buckle.',
   195.00, 490.00, 490.00, 'OFB', 'OF-SS26-003', 'SS26', 'Jan–Mar 2026', 2,
   ARRAY['belt','leather','black','accessories','35mm'], '{"aesthetic":["minimal","architectural"],"mood":["sleek","bold"],"palette":["black","brass"]}', 'active', false),

-- ── CASA DEL MAR ────────────────────────────────────────────
  ('p1000010-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000010', cat_womens,
   'Oaxaca Hand-Woven Dress', 'oaxaca-hand-woven-dress',
   'Loose shift dress in hand-woven zapotec cotton. Rust and cream geometric motif, hand-hemmed, each unique.',
   275.00, 690.00, 690.00, 'CDM', 'CD-SS26-001', 'SS26', 'Jan–Mar 2026', 1,
   ARRAY['dress','woven','cotton','Mexican','artisan'], '{"aesthetic":["artisan","cultural"],"mood":["joyful","authentic"],"palette":["rust","cream","terracotta"]}', 'active', true),

  ('p1000010-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000010', cat_access,
   'Indigo Naturally Dyed Tote', 'indigo-naturally-dyed-tote',
   'Market tote in zapotec-woven cotton with añil natural-indigo dye. Leather-tipped straps.',
   140.00, 350.00, 350.00, 'CDA', 'CD-SS26-002', 'SS26', 'Jan–Mar 2026', 2,
   ARRAY['tote','indigo','woven','natural','accessories'], '{"aesthetic":["artisan","coastal"],"mood":["relaxed","earthy"],"palette":["indigo","natural"]}', 'active', false),

  ('p1000010-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000010', cat_womens,
   'Sierra Linen Jumpsuit', 'sierra-linen-jumpsuit',
   'Relaxed linen jumpsuit in warm sierra clay. Drawstring waist, wide-leg, deep patch pockets.',
   210.00, 525.00, 525.00, 'CDJ', 'CD-SS26-003', 'SS26', 'Jan–Mar 2026', 2,
   ARRAY['jumpsuit','linen','terracotta','resort','women'], '{"aesthetic":["resort","minimal"],"mood":["relaxed","natural"],"palette":["sierra","terracotta"]}', 'active', false),

-- ── THE IVORY ARCHIVE ───────────────────────────────────────
  ('p1000011-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000011', cat_womens,
   'Asymmetric Draped Column Dress', 'asymmetric-draped-column-dress',
   'Sculptural column dress in ecru viscose-modal. Single-shoulder drape, exposed seams, invisible back zip.',
   320.00, 800.00, 800.00, 'IAD', 'IA-SS26-001', 'SS26', 'Feb–Apr 2026', 1,
   ARRAY['dress','draped','ecru','column','sculptural'], '{"aesthetic":["avant-garde","minimal"],"mood":["artistic","airy"],"palette":["ecru","white"]}', 'active', true),

  ('p1000011-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000011', cat_womens,
   'Archive Linen Overshirt Dress', 'archive-linen-overshirt-dress',
   'Longline overshirt dress in vintage-washed flax linen. Oversized, raw hem, shell buttons, belt optional.',
   255.00, 640.00, 640.00, 'IAO', 'IA-SS26-002', 'SS26', 'Feb–Apr 2026', 2,
   ARRAY['dress','linen','overshirt','flax','longline'], '{"aesthetic":["artisan","minimal"],"mood":["understated","effortless"],"palette":["flax","linen","natural"]}', 'active', false),

  ('p1000011-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000011', cat_womens,
   'Ghost Cotton Maxi Skirt', 'ghost-cotton-maxi-skirt',
   'Maxi skirt in ivory crinkled cotton. Elasticated waist, tiered hem, whisper-light. Pairs back as a strapless.',
   175.00, 440.00, 440.00, 'IAS', 'IA-SS26-003', 'SS26', 'Feb–Apr 2026', 2,
   ARRAY['skirt','maxi','ivory','cotton','crinkle'], '{"aesthetic":["romantic","minimal"],"mood":["dreamy","light"],"palette":["ivory","white"]}', 'active', false),

-- ── LUMICRAFT SEOUL ─────────────────────────────────────────
  ('p1000012-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000012', cat_contemp,
   'Hanji Texture Bomber', 'hanji-texture-bomber',
   'Oversized bomber jacket in hanji-paper-texture nylon. Reversible cream/black, contrast taping.',
   290.00, 725.00, 725.00, 'LCB', 'LC-SS26-001', 'SS26', 'Feb–Apr 2026', 1,
   ARRAY['bomber','nylon','reversible','unisex','Korean'], '{"aesthetic":["Korean","streetwear"],"mood":["bold","playful"],"palette":["cream","black"]}', 'active', true),

  ('p1000012-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000012', cat_contemp,
   'Sculpture Seam Midi Skirt', 'sculpture-seam-midi-skirt',
   'Pencil midi skirt in nude beige ponte. Exaggerated ridge seams sculpt the hip; back slit.',
   180.00, 450.00, 450.00, 'LCS', 'LC-SS26-002', 'SS26', 'Feb–Apr 2026', 2,
   ARRAY['skirt','midi','ponte','nude','sculptural'], '{"aesthetic":["architectural","contemporary"],"mood":["sleek","feminine"],"palette":["nude","beige"]}', 'active', false),

  ('p1000012-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000012', cat_access,
   'Moonstone Resin Earrings', 'moonstone-resin-earrings',
   'Oversized drop earrings in hand-poured moonstone-white resin. Sterling silver posts.',
   65.00, 162.00, 162.00, 'LCE', 'LC-SS26-003', 'SS26', 'Feb–Apr 2026', 4,
   ARRAY['earrings','resin','moonstone','accessories','handmade'], '{"aesthetic":["artisan","sculptural"],"mood":["ethereal","bold"],"palette":["moonstone","white","silver"]}', 'active', false),

-- ── BERGAMO CRAFT ────────────────────────────────────────────
  ('p1000013-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000013', cat_access,
   'Cortona Leather Briefcase', 'cortona-leather-briefcase',
   'Hand-stitched vegetable-tanned briefcase in cognac. Brass hardware, removable shoulder strap, suede-lined.',
   890.00, 2225.00, 2225.00, 'BCB', 'BC-FW25-001', 'FW25', 'Aug–Sep 2025', 1,
   ARRAY['briefcase','leather','cognac','accessories','Italian'], '{"aesthetic":["heritage","crafted"],"mood":["professional","timeless"],"palette":["cognac","tan"]}', 'active', true),

  ('p1000013-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000013', cat_access,
   'Siena Double-Tour Watch Strap', 'siena-double-tour-watch-strap',
   'Double-tour strap in Tuscan tan calf. Handmade in Bergamo, fits 18–20mm lug width.',
   145.00, 360.00, 360.00, 'BCW', 'BC-FW25-002', 'FW25', 'Aug–Sep 2025', 3,
   ARRAY['watch strap','leather','tan','accessories','handmade'], '{"aesthetic":["heritage","classic"],"mood":["refined","handcrafted"],"palette":["tan","cognac"]}', 'active', false),

  ('p1000013-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000013', cat_access,
   'Volterra Billfold Wallet', 'volterra-billfold-wallet',
   'Classic billfold in dark chocolate calf. Eight card slots, bill compartment, coin zip. Hand-edge-finished.',
   185.00, 465.00, 465.00, 'BCW2', 'BC-FW25-003', 'FW25', 'Aug–Sep 2025', 2,
   ARRAY['wallet','leather','chocolate','accessories','billfold'], '{"aesthetic":["classic","heritage"],"mood":["refined","functional"],"palette":["chocolate","brown"]}', 'active', false),

-- ── RAW DESERT CO. ───────────────────────────────────────────
  ('p1000014-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000014', cat_womens,
   'Desert Rust Organic Tee', 'desert-rust-organic-tee',
   'Heavyweight organic cotton tee in desert rust. Boxy, crew neck, pre-washed for softness.',
   65.00, 165.00, 165.00, 'RDT', 'RD-SS26-001', 'SS26', 'Jan–Apr 2026', 4,
   ARRAY['tee','organic','rust','basics','slow-fashion'], '{"aesthetic":["minimal","earthy"],"mood":["grounded","natural"],"palette":["rust","terracotta"]}', 'active', false),

  ('p1000014-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000014', cat_womens,
   'Sage Linen Wide-Leg Pant', 'sage-linen-wide-leg-pant',
   'Wide-leg trousers in stonewashed sage linen. Elastic back waist, front crease, ankle length.',
   120.00, 300.00, 300.00, 'RDP', 'RD-SS26-002', 'SS26', 'Jan–Apr 2026', 3,
   ARRAY['trousers','linen','sage','wide-leg','basics'], '{"aesthetic":["minimal","earthy"],"mood":["calm","effortless"],"palette":["sage","green"]}', 'active', true),

  ('p1000014-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000014', cat_womens,
   'Dune Recycled Fleece Pullover', 'dune-recycled-fleece-pullover',
   'Pullover in 100% recycled-polyester fleece in dune beige. Dropped shoulder, quarter zip, kangaroo pocket.',
   135.00, 335.00, 335.00, 'RDF', 'RD-FW25-001', 'FW25', 'Sep–Nov 2025', 3,
   ARRAY['fleece','recycled','pullover','beige','sustainable'], '{"aesthetic":["sporty","earthy"],"mood":["casual","natural"],"palette":["dune","beige"]}', 'active', false),

-- ── VELVET CHAPTER NY ───────────────────────────────────────
  ('p1000015-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000015', cat_womens,
   'Midnight Velvet Blazer', 'midnight-velvet-blazer',
   'Tailored velvet blazer in midnight navy. Peaked lapel, single button, fully lined in champagne satin.',
   420.00, 1050.00, 1050.00, 'VCB', 'VC-FW25-001', 'FW25', 'Sep–Oct 2025', 1,
   ARRAY['blazer','velvet','navy','luxury','eveningwear'], '{"aesthetic":["glamour","editorial"],"mood":["dramatic","rich"],"palette":["midnight","navy","gold"]}', 'active', true),

  ('p1000015-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000015', cat_womens,
   'Merlot Velvet Wide-Leg Trouser', 'merlot-velvet-wide-leg-trouser',
   'High-waisted wide-leg trousers in merlot crushed velvet. Concealed zip fly, front crease.',
   295.00, 735.00, 735.00, 'VCT', 'VC-FW25-002', 'FW25', 'Sep–Oct 2025', 1,
   ARRAY['trousers','velvet','merlot','wide-leg','evening'], '{"aesthetic":["glamour","luxe"],"mood":["sensual","bold"],"palette":["merlot","burgundy"]}', 'active', false),

  ('p1000015-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000015', cat_womens,
   'Champagne Column Gown', 'champagne-column-gown',
   'Column gown in champagne velvet. Spaghetti straps, low back, brushed floor hem. Classic NY evening.',
   580.00, 1450.00, 1450.00, 'VCG', 'VC-FW25-003', 'FW25', 'Sep–Oct 2025', 1,
   ARRAY['gown','velvet','champagne','eveningwear','column'], '{"aesthetic":["glamour","classic"],"mood":["elegant","timeless"],"palette":["champagne","gold"]}', 'active', true),

-- ── ARCHIPELAGO LABEL ───────────────────────────────────────
  ('p1000016-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000016', cat_contemp,
   'Oud Embroidered Shirt', 'oud-embroidered-shirt',
   'Relaxed linen shirt in desert sand. Oud-wood-inspired embroidered collar and placket. Boxy cut.',
   195.00, 490.00, 490.00, 'ALS', 'AL-SS26-001', 'SS26', 'Jan–Mar 2026', 2,
   ARRAY['shirt','linen','embroidery','sand','contemporary'], '{"aesthetic":["cultural","resort"],"mood":["warm","confident"],"palette":["sand","ivory","gold"]}', 'active', true),

  ('p1000016-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000016', cat_contemp,
   'Levant Wide-Leg Trousers', 'levant-wide-leg-trousers',
   'Ultra-wide-leg trousers in sable linen. High waist, belt loops, cropped ankle.',
   175.00, 440.00, 440.00, 'ALT', 'AL-SS26-002', 'SS26', 'Jan–Mar 2026', 2,
   ARRAY['trousers','linen','sable','wide-leg','contemporary'], '{"aesthetic":["modern","cultural"],"mood":["relaxed","effortless"],"palette":["sable","brown","tan"]}', 'active', false),

  ('p1000016-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000016', cat_access,
   'Desert Kohl Clutch', 'desert-kohl-clutch',
   'Hand-beaded clutch in jet black with kohl-liner bead motif. Satin lining, magnetic snap.',
   245.00, 612.00, 612.00, 'ALA', 'AL-SS26-003', 'SS26', 'Jan–Mar 2026', 2,
   ARRAY['clutch','beaded','black','accessories','evening'], '{"aesthetic":["cultural","glam"],"mood":["dramatic","festive"],"palette":["black","gold"]}', 'active', false),

-- ── SABLE CLOTHING ──────────────────────────────────────────
  ('p1000017-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000017', cat_womens,
   'Bondi Linen Shirt Dress', 'bondi-linen-shirt-dress',
   'Midi shirt dress in white linen. Cuffed sleeves, waist belt, split hem. Coastal Aus summer staple.',
   190.00, 475.00, 475.00, 'SBD', 'SB-SS26-001', 'SS26', 'Oct 2025–Jan 2026', 2,
   ARRAY['dress','linen','shirt dress','white','coastal'], '{"aesthetic":["coastal","minimal"],"mood":["relaxed","fresh"],"palette":["white","ivory"]}', 'active', true),

  ('p1000017-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000017', cat_womens,
   'Byron Knit Co-Ord Set', 'byron-knit-cord-set',
   'Matching knit top and wide-leg trouser in wheat rib jersey. Crop top, full-length pant.',
   245.00, 612.00, 612.00, 'SBK', 'SB-SS26-002', 'SS26', 'Oct 2025–Jan 2026', 2,
   ARRAY['co-ord','knit','wheat','set','contemporary'], '{"aesthetic":["coastal","contemporary"],"mood":["casual chic","relaxed"],"palette":["wheat","caramel"]}', 'active', false),

  ('p1000017-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000017', cat_womens,
   'Harbor Denim Maxi Skirt', 'harbor-denim-maxi-skirt',
   'High-rise maxi skirt in mid-wash denim. Front slit, raw hem, belt loops.',
   165.00, 412.00, 412.00, 'SBS', 'SB-SS26-003', 'SS26', 'Oct 2025–Jan 2026', 2,
   ARRAY['skirt','denim','maxi','mid-wash','Australian'], '{"aesthetic":["coastal","contemporary"],"mood":["effortless","casual"],"palette":["mid-wash","blue","denim"]}', 'active', false),

-- ── NOTTURNO MILANO ─────────────────────────────────────────
  ('p1000018-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000018', cat_luxury,
   'Como Silk Pyjama Set', 'como-silk-pyjama-set',
   'Two-piece pyjama in Como-sourced ivory silk charmeuse. Piped in champagne, monogram pocket option.',
   480.00, 1200.00, 1200.00, 'NMP', 'NM-FW25-001', 'FW25', 'Aug–Sep 2025', 1,
   ARRAY['pyjama','silk','ivory','luxury','lounge'], '{"aesthetic":["luxe","Italian"],"mood":["sensual","intimate"],"palette":["ivory","champagne"]}', 'active', true),

  ('p1000018-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000018', cat_luxury,
   'Midnight Satin Robe', 'midnight-satin-robe',
   'Floor-length robe in midnight-blue duchesse satin. Wide lapel, belt tie, cuffed sleeves, satin-lined.',
   520.00, 1300.00, 1300.00, 'NMR', 'NM-FW25-002', 'FW25', 'Aug–Sep 2025', 1,
   ARRAY['robe','satin','midnight blue','luxury','lounge'], '{"aesthetic":["glamour","Italian"],"mood":["decadent","regal"],"palette":["midnight blue","silver"]}', 'active', true),

  ('p1000018-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000018', cat_luxury,
   'Cashmere Sleep Mask', 'cashmere-sleep-mask',
   'Double-layer cashmere sleep mask. Silk inner lining, adjustable elastic, embroidered "dolce notte".',
   95.00, 238.00, 238.00, 'NMA', 'NM-FW25-003', 'FW25', 'Aug–Sep 2025', 4,
   ARRAY['sleep mask','cashmere','accessories','luxury','lounge'], '{"aesthetic":["luxe","gifting"],"mood":["intimate","playful"],"palette":["ivory","camel"]}', 'active', false),

-- ── CEDAR & INDIGO ───────────────────────────────────────────
  ('p1000019-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000019', cat_womens,
   'Lichen Tencel Midi Dress', 'lichen-tencel-midi-dress',
   'Relaxed midi in TENCEL™ lyocell with plant-based lichen-green dye. Side pockets, adjustable straps.',
   195.00, 490.00, 490.00, 'CID', 'CI-SS26-001', 'SS26', 'Feb–Apr 2026', 2,
   ARRAY['dress','tencel','lichen','sustainable','midi'], '{"aesthetic":["sustainable","minimal"],"mood":["calm","earthy"],"palette":["lichen","green","sage"]}', 'active', true),

  ('p1000019-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000019', cat_womens,
   'Cedar Bark Linen Blazer', 'cedar-bark-linen-blazer',
   'Single-breasted linen blazer in cedar-bark brown. Unlined, natural button, raw hem option.',
   265.00, 665.00, 665.00, 'CIB', 'CI-SS26-002', 'SS26', 'Feb–Apr 2026', 1,
   ARRAY['blazer','linen','cedar','sustainable','women'], '{"aesthetic":["sustainable","minimal"],"mood":["grounded","confident"],"palette":["cedar","brown","earth"]}', 'active', false),

  ('p1000019-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000019', cat_womens,
   'Woad Blue Plant-Dyed Blouse', 'woad-blue-plant-dyed-blouse',
   'Loose blouse in woad-plant-dyed cotton. Each piece carries a unique dye variation certificate.',
   145.00, 365.00, 365.00, 'CIL', 'CI-SS26-003', 'SS26', 'Feb–Apr 2026', 2,
   ARRAY['blouse','cotton','woad','natural dye','sustainable'], '{"aesthetic":["artisan","sustainable"],"mood":["unique","calm"],"palette":["woad blue","natural white"]}', 'active', false),

-- ── STRAND HAUS ─────────────────────────────────────────────
  ('p1000020-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000020', cat_mens,
   'Øresund Merino Turtleneck', 'oresund-merino-turtleneck',
   'Fine merino turtleneck in glacier white. Slim fit, 18.5 micron merino, anti-pill finish.',
   195.00, 490.00, 490.00, 'SHT', 'SH-FW25-001', 'FW25', 'Aug–Oct 2025', 2,
   ARRAY['turtleneck','merino','white','Scandinavian','menswear'], '{"aesthetic":["Scandinavian","minimal"],"mood":["clean","refined"],"palette":["glacier white","ivory"]}', 'active', true),

  ('p1000020-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000020', cat_mens,
   'Nordic Wool Overcoat', 'nordic-wool-overcoat',
   'Longline overcoat in double-faced ash-grey wool. Raglan sleeve, concealed buttons, single back vent.',
   720.00, 1800.00, 1800.00, 'SHC', 'SH-FW25-002', 'FW25', 'Aug–Oct 2025', 1,
   ARRAY['coat','wool','grey','overcoat','Scandinavian'], '{"aesthetic":["Scandinavian","minimal"],"mood":["composed","quiet"],"palette":["ash grey","charcoal"]}', 'active', true),

  ('p1000020-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000020', cat_mens,
   'Lund Straight Chino', 'lund-straight-chino',
   'Straight-fit chino in stone-washed pebble grey. Subtle taper, no break, horn-effect button.',
   185.00, 465.00, 465.00, 'SHP', 'SH-FW25-003', 'FW25', 'Aug–Oct 2025', 2,
   ARRAY['chino','grey','trousers','straight','Scandinavian'], '{"aesthetic":["Scandinavian","minimal"],"mood":["clean","functional"],"palette":["pebble","grey"]}', 'active', false);

END $$;

-- ─── PRODUCT VARIANTS ───────────────────────────────────────
-- Representative variants for every product

INSERT INTO product_variants (product_id, size, color, color_hex, sku, quantity, reorder_point) VALUES
-- Fern Drape Midi Dress (MV)
('p1000001-0000-0000-0000-000000000001','XS','Sage','#8B9E77','MVD-SS26-001-XS-SAGE',18,4),
('p1000001-0000-0000-0000-000000000001','S', 'Sage','#8B9E77','MVD-SS26-001-S-SAGE', 24,4),
('p1000001-0000-0000-0000-000000000001','M', 'Sage','#8B9E77','MVD-SS26-001-M-SAGE', 22,4),
('p1000001-0000-0000-0000-000000000001','L', 'Sage','#8B9E77','MVD-SS26-001-L-SAGE', 16,3),
-- Ivy Wrap Blouse
('p1000001-0000-0000-0000-000000000002','XS','Ivory','#FFFFF0','MVB-SS26-002-XS-IVY',20,4),
('p1000001-0000-0000-0000-000000000002','S', 'Ivory','#FFFFF0','MVB-SS26-002-S-IVY', 25,4),
('p1000001-0000-0000-0000-000000000002','M', 'Ivory','#FFFFF0','MVB-SS26-002-M-IVY', 20,4),
('p1000001-0000-0000-0000-000000000002','L', 'Ivory','#FFFFF0','MVB-SS26-002-L-IVY', 15,3),
-- Moss Linen Trousers
('p1000001-0000-0000-0000-000000000003','XS','Moss','#8A9A5B','MVT-SS26-003-XS-MOSS',15,3),
('p1000001-0000-0000-0000-000000000003','S', 'Moss','#8A9A5B','MVT-SS26-003-S-MOSS', 20,3),
('p1000001-0000-0000-0000-000000000003','M', 'Moss','#8A9A5B','MVT-SS26-003-M-MOSS', 22,3),
('p1000001-0000-0000-0000-000000000003','L', 'Moss','#8A9A5B','MVT-SS26-003-L-MOSS', 18,3),
-- Venezia Blazer (AA)
('p1000002-0000-0000-0000-000000000001','36','Petrol Blue','#336699','AAB-FW25-001-36-PTR',8,2),
('p1000002-0000-0000-0000-000000000001','38','Petrol Blue','#336699','AAB-FW25-001-38-PTR',12,2),
('p1000002-0000-0000-0000-000000000001','40','Petrol Blue','#336699','AAB-FW25-001-40-PTR',14,2),
('p1000002-0000-0000-0000-000000000001','42','Petrol Blue','#336699','AAB-FW25-001-42-PTR',10,2),
-- Cashmere Rollneck
('p1000002-0000-0000-0000-000000000002','S','Oatmeal','#D4C5A9','AAS-FW25-002-S-OAT',20,3),
('p1000002-0000-0000-0000-000000000002','M','Oatmeal','#D4C5A9','AAS-FW25-002-M-OAT',22,3),
('p1000002-0000-0000-0000-000000000002','L','Oatmeal','#D4C5A9','AAS-FW25-002-L-OAT',18,3),
('p1000002-0000-0000-0000-000000000002','XL','Oatmeal','#D4C5A9','AAS-FW25-002-XL-OAT',12,2),
-- Slim Flannel Trouser
('p1000002-0000-0000-0000-000000000003','30x32','Mid Grey','#808080','AAT-FW25-003-30-GRY',10,2),
('p1000002-0000-0000-0000-000000000003','32x32','Mid Grey','#808080','AAT-FW25-003-32-GRY',14,2),
('p1000002-0000-0000-0000-000000000003','34x32','Mid Grey','#808080','AAT-FW25-003-34-GRY',12,2),
-- Origami Cargo Pant (TT)
('p1000003-0000-0000-0000-000000000001','S','Washed Black','#1C1C1C','TTP-SS26-001-S-BLK',18,3),
('p1000003-0000-0000-0000-000000000001','M','Washed Black','#1C1C1C','TTP-SS26-001-M-BLK',24,4),
('p1000003-0000-0000-0000-000000000001','L','Washed Black','#1C1C1C','TTP-SS26-001-L-BLK',20,3),
-- Shibori Indigo Overshirt (hand-dyed, one-of-a-kind sizing)
('p1000003-0000-0000-0000-000000000002','S/M','Indigo','#3F51B5','TTO-SS26-002-SM-IND',6,2),
('p1000003-0000-0000-0000-000000000002','L/XL','Indigo','#3F51B5','TTO-SS26-002-LXL-IND',6,2),
-- Haiku Graphic Tee
('p1000003-0000-0000-0000-000000000003','S','White','#FFFFFF','TTT-SS26-003-S-WHT',30,5),
('p1000003-0000-0000-0000-000000000003','M','White','#FFFFFF','TTT-SS26-003-M-WHT',35,5),
('p1000003-0000-0000-0000-000000000003','L','White','#FFFFFF','TTT-SS26-003-L-WHT',28,4),
('p1000003-0000-0000-0000-000000000003','XL','White','#FFFFFF','TTT-SS26-003-XL-WHT',20,3),
-- Deconstructed Wool Coat (KH)
('p1000004-0000-0000-0000-000000000001','S','Charcoal','#36454F','KHC-FW25-001-S-CHR',6,1),
('p1000004-0000-0000-0000-000000000001','M','Charcoal','#36454F','KHC-FW25-001-M-CHR',8,1),
('p1000004-0000-0000-0000-000000000001','L','Charcoal','#36454F','KHC-FW25-001-L-CHR',7,1),
-- Asymmetric Seam Trousers
('p1000004-0000-0000-0000-000000000002','S','Concrete','#93939B','KHT-FW25-002-S-CON',10,2),
('p1000004-0000-0000-0000-000000000002','M','Concrete','#93939B','KHT-FW25-002-M-CON',12,2),
('p1000004-0000-0000-0000-000000000002','L','Concrete','#93939B','KHT-FW25-002-L-CON',10,2),
-- Inverse Seam Shirt
('p1000004-0000-0000-0000-000000000003','S','White','#FFFFFF','KHS-FW25-003-S-WHT',12,2),
('p1000004-0000-0000-0000-000000000003','M','White','#FFFFFF','KHS-FW25-003-M-WHT',16,2),
('p1000004-0000-0000-0000-000000000003','L','White','#FFFFFF','KHS-FW25-003-L-WHT',14,2),
-- Aurora Embroidered Gown (SC) - make-to-order
('p1000005-0000-0000-0000-000000000001','4','Ivory','#FFFFF0','SCG-SS26-001-4-IVY',2,1),
('p1000005-0000-0000-0000-000000000001','6','Ivory','#FFFFF0','SCG-SS26-001-6-IVY',2,1),
('p1000005-0000-0000-0000-000000000001','8','Ivory','#FFFFF0','SCG-SS26-001-8-IVY',2,1),
('p1000005-0000-0000-0000-000000000001','10','Ivory','#FFFFF0','SCG-SS26-001-10-IVY',2,1),
-- Celestial Beaded Mini
('p1000005-0000-0000-0000-000000000002','XS','Crystal Silver','#C0C0C0','SCM-SS26-002-XS-CST',4,1),
('p1000005-0000-0000-0000-000000000002','S','Crystal Silver','#C0C0C0','SCM-SS26-002-S-CST',6,1),
('p1000005-0000-0000-0000-000000000002','M','Crystal Silver','#C0C0C0','SCM-SS26-002-M-CST',6,1),
-- Garnet Corset Blouse
('p1000005-0000-0000-0000-000000000003','XS','Garnet','#733635','SCB-SS26-003-XS-GAR',5,1),
('p1000005-0000-0000-0000-000000000003','S','Garnet','#733635','SCB-SS26-003-S-GAR',8,1),
('p1000005-0000-0000-0000-000000000003','M','Garnet','#733635','SCB-SS26-003-M-GAR',8,1),
('p1000005-0000-0000-0000-000000000003','L','Garnet','#733635','SCB-SS26-003-L-GAR',5,1),
-- Jaipur Block-Print Kaftan (DM)
('p1000006-0000-0000-0000-000000000001','S/M','Terracotta','#C1552A','DMK-SS26-001-SM-TC',20,3),
('p1000006-0000-0000-0000-000000000001','L/XL','Terracotta','#C1552A','DMK-SS26-001-LXL-TC',18,3),
('p1000006-0000-0000-0000-000000000001','XXL','Terracotta','#C1552A','DMK-SS26-001-XXL-TC',10,2),
-- Leheriya Midi Skirt
('p1000006-0000-0000-0000-000000000002','XS','Indigo','#3F51B5','DMS-SS26-002-XS-IND',15,3),
('p1000006-0000-0000-0000-000000000002','S','Indigo','#3F51B5','DMS-SS26-002-S-IND',20,3),
('p1000006-0000-0000-0000-000000000002','M','Indigo','#3F51B5','DMS-SS26-002-M-IND',18,3),
('p1000006-0000-0000-0000-000000000002','L','Indigo','#3F51B5','DMS-SS26-002-L-IND',15,3),
-- Sanganeri Tote (one size)
('p1000006-0000-0000-0000-000000000003','OS','Multicolour','#CC6633','DMA-SS26-003-OS-MULTI',30,5),
-- Marais Tailored Blazer (LR)
('p1000007-0000-0000-0000-000000000001','34','Beige','#C8A882','LRB-FW25-001-34-BEI',8,2),
('p1000007-0000-0000-0000-000000000001','36','Beige','#C8A882','LRB-FW25-001-36-BEI',10,2),
('p1000007-0000-0000-0000-000000000001','38','Beige','#C8A882','LRB-FW25-001-38-BEI',12,2),
('p1000007-0000-0000-0000-000000000001','40','Beige','#C8A882','LRB-FW25-001-40-BEI',8,2),
-- Sabine Silk Midi Skirt
('p1000007-0000-0000-0000-000000000002','XS','Ivory','#FFFFF0','LRS-FW25-002-XS-IVY',12,2),
('p1000007-0000-0000-0000-000000000002','S','Ivory','#FFFFF0','LRS-FW25-002-S-IVY',16,2),
('p1000007-0000-0000-0000-000000000002','M','Ivory','#FFFFF0','LRS-FW25-002-M-IVY',14,2),
('p1000007-0000-0000-0000-000000000002','L','Ivory','#FFFFF0','LRS-FW25-002-L-IVY',10,2),
-- Pont Neuf Trench Coat
('p1000007-0000-0000-0000-000000000003','XS','Camel','#C19A6B','LRC-FW25-003-XS-CAM',5,1),
('p1000007-0000-0000-0000-000000000003','S','Camel','#C19A6B','LRC-FW25-003-S-CAM',8,1),
('p1000007-0000-0000-0000-000000000003','M','Camel','#C19A6B','LRC-FW25-003-M-CAM',9,1),
('p1000007-0000-0000-0000-000000000003','L','Camel','#C19A6B','LRC-FW25-003-L-CAM',7,1),
-- Faroe Merino Coat (NL)
('p1000008-0000-0000-0000-000000000001','XS','Storm Blue','#4682B4','NLC-FW25-001-XS-STO',4,1),
('p1000008-0000-0000-0000-000000000001','S','Storm Blue','#4682B4','NLC-FW25-001-S-STO',6,1),
('p1000008-0000-0000-0000-000000000001','M','Storm Blue','#4682B4','NLC-FW25-001-M-STO',8,1),
('p1000008-0000-0000-0000-000000000001','L','Storm Blue','#4682B4','NLC-FW25-001-L-STO',6,1),
-- Lofoten Cable Knit Jumper
('p1000008-0000-0000-0000-000000000002','XS','Natural','#D4C5A9','NLJ-FW25-002-XS-NAT',8,2),
('p1000008-0000-0000-0000-000000000002','S','Natural','#D4C5A9','NLJ-FW25-002-S-NAT',10,2),
('p1000008-0000-0000-0000-000000000002','M','Natural','#D4C5A9','NLJ-FW25-002-M-NAT',12,2),
('p1000008-0000-0000-0000-000000000002','L','Natural','#D4C5A9','NLJ-FW25-002-L-NAT',8,2),
-- Wool Woven Throw Scarf (one size)
('p1000008-0000-0000-0000-000000000003','OS','Charcoal/Cream','#36454F','NLS-FW25-003-OS-CC',25,4),
-- Monolith Tote (OF)
('p1000009-0000-0000-0000-000000000001','OS','Black','#000000','OFT-SS26-001-OS-BLK',12,2),
-- Basalt Card Holder
('p1000009-0000-0000-0000-000000000002','OS','Basalt Black','#1A1A1A','OFC-SS26-002-OS-BAS',30,5),
-- Void Belt 35mm
('p1000009-0000-0000-0000-000000000003','85cm','Black','#000000','OFB-SS26-003-85-BLK',15,3),
('p1000009-0000-0000-0000-000000000003','90cm','Black','#000000','OFB-SS26-003-90-BLK',15,3),
('p1000009-0000-0000-0000-000000000003','95cm','Black','#000000','OFB-SS26-003-95-BLK',12,2),
('p1000009-0000-0000-0000-000000000003','100cm','Black','#000000','OFB-SS26-003-100-BLK',8,2),
-- Oaxaca Hand-Woven Dress (CD)
('p1000010-0000-0000-0000-000000000001','S/M','Rust/Cream','#B7410E','CDM-SS26-001-SM-RUST',5,1),
('p1000010-0000-0000-0000-000000000001','L/XL','Rust/Cream','#B7410E','CDM-SS26-001-LXL-RUST',5,1),
-- Indigo Tote (one size)
('p1000010-0000-0000-0000-000000000002','OS','Indigo','#3F51B5','CDA-SS26-002-OS-IND',24,4),
-- Sierra Linen Jumpsuit
('p1000010-0000-0000-0000-000000000003','XS','Sierra Clay','#C1552A','CDJ-SS26-003-XS-SIE',8,2),
('p1000010-0000-0000-0000-000000000003','S','Sierra Clay','#C1552A','CDJ-SS26-003-S-SIE',12,2),
('p1000010-0000-0000-0000-000000000003','M','Sierra Clay','#C1552A','CDJ-SS26-003-M-SIE',14,2),
('p1000010-0000-0000-0000-000000000003','L','Sierra Clay','#C1552A','CDJ-SS26-003-L-SIE',10,2),
-- Asymmetric Draped Column Dress (IA)
('p1000011-0000-0000-0000-000000000001','XS','Ecru','#F5F0E8','IAD-SS26-001-XS-ECR',6,1),
('p1000011-0000-0000-0000-000000000001','S','Ecru','#F5F0E8','IAD-SS26-001-S-ECR',8,1),
('p1000011-0000-0000-0000-000000000001','M','Ecru','#F5F0E8','IAD-SS26-001-M-ECR',8,1),
('p1000011-0000-0000-0000-000000000001','L','Ecru','#F5F0E8','IAD-SS26-001-L-ECR',5,1),
-- Archive Linen Overshirt Dress
('p1000011-0000-0000-0000-000000000002','XS','Flax','#F0E68C','IAO-SS26-002-XS-FLX',10,2),
('p1000011-0000-0000-0000-000000000002','S','Flax','#F0E68C','IAO-SS26-002-S-FLX',14,2),
('p1000011-0000-0000-0000-000000000002','M','Flax','#F0E68C','IAO-SS26-002-M-FLX',14,2),
('p1000011-0000-0000-0000-000000000002','L','Flax','#F0E68C','IAO-SS26-002-L-FLX',10,2),
-- Ghost Maxi Skirt
('p1000011-0000-0000-0000-000000000003','XS','Ivory','#FFFFF0','IAS-SS26-003-XS-IVY',12,2),
('p1000011-0000-0000-0000-000000000003','S','Ivory','#FFFFF0','IAS-SS26-003-S-IVY',16,2),
('p1000011-0000-0000-0000-000000000003','M','Ivory','#FFFFF0','IAS-SS26-003-M-IVY',14,2),
('p1000011-0000-0000-0000-000000000003','L','Ivory','#FFFFF0','IAS-SS26-003-L-IVY',10,2),
-- Hanji Bomber (LC)
('p1000012-0000-0000-0000-000000000001','S','Cream','#FFFDD0','LCB-SS26-001-S-CRM',10,2),
('p1000012-0000-0000-0000-000000000001','M','Cream','#FFFDD0','LCB-SS26-001-M-CRM',12,2),
('p1000012-0000-0000-0000-000000000001','L','Cream','#FFFDD0','LCB-SS26-001-L-CRM',10,2),
('p1000012-0000-0000-0000-000000000001','XL','Cream','#FFFDD0','LCB-SS26-001-XL-CRM',6,1),
-- Sculpture Seam Midi Skirt
('p1000012-0000-0000-0000-000000000002','XS','Nude','#E8D5C4','LCS-SS26-002-XS-NDE',10,2),
('p1000012-0000-0000-0000-000000000002','S','Nude','#E8D5C4','LCS-SS26-002-S-NDE',14,2),
('p1000012-0000-0000-0000-000000000002','M','Nude','#E8D5C4','LCS-SS26-002-M-NDE',14,2),
('p1000012-0000-0000-0000-000000000002','L','Nude','#E8D5C4','LCS-SS26-002-L-NDE',10,2),
-- Moonstone Resin Earrings (one size)
('p1000012-0000-0000-0000-000000000003','OS','Moonstone White','#F0F0F0','LCE-SS26-003-OS-MON',40,6),
-- Cortona Briefcase (BC) - one size
('p1000013-0000-0000-0000-000000000001','OS','Cognac','#9A4B2E','BCB-FW25-001-OS-COG',8,1),
-- Siena Watch Strap
('p1000013-0000-0000-0000-000000000002','18mm','Tan','#D2691E','BCW-FW25-002-18-TAN',20,3),
('p1000013-0000-0000-0000-000000000002','20mm','Tan','#D2691E','BCW-FW25-002-20-TAN',20,3),
-- Volterra Wallet
('p1000013-0000-0000-0000-000000000003','OS','Dark Chocolate','#3D1C02','BCW2-FW25-003-OS-CHO',25,4),
-- Desert Rust Organic Tee (RD)
('p1000014-0000-0000-0000-000000000001','XS','Desert Rust','#B7410E','RDT-SS26-001-XS-RST',24,4),
('p1000014-0000-0000-0000-000000000001','S','Desert Rust','#B7410E','RDT-SS26-001-S-RST',30,5),
('p1000014-0000-0000-0000-000000000001','M','Desert Rust','#B7410E','RDT-SS26-001-M-RST',28,4),
('p1000014-0000-0000-0000-000000000001','L','Desert Rust','#B7410E','RDT-SS26-001-L-RST',20,3),
('p1000014-0000-0000-0000-000000000001','XL','Desert Rust','#B7410E','RDT-SS26-001-XL-RST',14,2),
-- Sage Linen Wide-Leg Pant
('p1000014-0000-0000-0000-000000000002','XS','Sage','#8A9A5B','RDP-SS26-002-XS-SGE',18,3),
('p1000014-0000-0000-0000-000000000002','S','Sage','#8A9A5B','RDP-SS26-002-S-SGE',22,3),
('p1000014-0000-0000-0000-000000000002','M','Sage','#8A9A5B','RDP-SS26-002-M-SGE',20,3),
('p1000014-0000-0000-0000-000000000002','L','Sage','#8A9A5B','RDP-SS26-002-L-SGE',16,3),
-- Dune Fleece Pullover
('p1000014-0000-0000-0000-000000000003','XS','Dune','#DDD5C8','RDF-FW25-001-XS-DUN',16,3),
('p1000014-0000-0000-0000-000000000003','S','Dune','#DDD5C8','RDF-FW25-001-S-DUN',20,3),
('p1000014-0000-0000-0000-000000000003','M','Dune','#DDD5C8','RDF-FW25-001-M-DUN',20,3),
('p1000014-0000-0000-0000-000000000003','L','Dune','#DDD5C8','RDF-FW25-001-L-DUN',14,2),
-- Midnight Velvet Blazer (VC)
('p1000015-0000-0000-0000-000000000001','XS','Midnight Navy','#1C2951','VCB-FW25-001-XS-MID',5,1),
('p1000015-0000-0000-0000-000000000001','S','Midnight Navy','#1C2951','VCB-FW25-001-S-MID',8,1),
('p1000015-0000-0000-0000-000000000001','M','Midnight Navy','#1C2951','VCB-FW25-001-M-MID',8,1),
('p1000015-0000-0000-0000-000000000001','L','Midnight Navy','#1C2951','VCB-FW25-001-L-MID',5,1),
-- Merlot Velvet Wide-Leg
('p1000015-0000-0000-0000-000000000002','XS','Merlot','#73223A','VCT-FW25-002-XS-MRL',6,1),
('p1000015-0000-0000-0000-000000000002','S','Merlot','#73223A','VCT-FW25-002-S-MRL',8,1),
('p1000015-0000-0000-0000-000000000002','M','Merlot','#73223A','VCT-FW25-002-M-MRL',8,1),
('p1000015-0000-0000-0000-000000000002','L','Merlot','#73223A','VCT-FW25-002-L-MRL',5,1),
-- Champagne Column Gown
('p1000015-0000-0000-0000-000000000003','XS','Champagne','#F7E7CE','VCG-FW25-003-XS-CHP',3,1),
('p1000015-0000-0000-0000-000000000003','S','Champagne','#F7E7CE','VCG-FW25-003-S-CHP',5,1),
('p1000015-0000-0000-0000-000000000003','M','Champagne','#F7E7CE','VCG-FW25-003-M-CHP',5,1),
('p1000015-0000-0000-0000-000000000003','L','Champagne','#F7E7CE','VCG-FW25-003-L-CHP',3,1),
-- Oud Embroidered Shirt (AL)
('p1000016-0000-0000-0000-000000000001','S','Sand','#C2B280','ALS-SS26-001-S-SND',14,2),
('p1000016-0000-0000-0000-000000000001','M','Sand','#C2B280','ALS-SS26-001-M-SND',18,3),
('p1000016-0000-0000-0000-000000000001','L','Sand','#C2B280','ALS-SS26-001-L-SND',16,2),
('p1000016-0000-0000-0000-000000000001','XL','Sand','#C2B280','ALS-SS26-001-XL-SND',10,2),
-- Levant Wide-Leg Trousers
('p1000016-0000-0000-0000-000000000002','S','Sable','#736B5E','ALT-SS26-002-S-SAB',12,2),
('p1000016-0000-0000-0000-000000000002','M','Sable','#736B5E','ALT-SS26-002-M-SAB',14,2),
('p1000016-0000-0000-0000-000000000002','L','Sable','#736B5E','ALT-SS26-002-L-SAB',12,2),
-- Desert Kohl Clutch (one size)
('p1000016-0000-0000-0000-000000000003','OS','Jet Black','#0A0A0A','ALA-SS26-003-OS-JET',18,3),
-- Bondi Linen Shirt Dress (SB)
('p1000017-0000-0000-0000-000000000001','XS','White','#FFFFFF','SBD-SS26-001-XS-WHT',10,2),
('p1000017-0000-0000-0000-000000000001','S','White','#FFFFFF','SBD-SS26-001-S-WHT',14,2),
('p1000017-0000-0000-0000-000000000001','M','White','#FFFFFF','SBD-SS26-001-M-WHT',14,2),
('p1000017-0000-0000-0000-000000000001','L','White','#FFFFFF','SBD-SS26-001-L-WHT',10,2),
-- Byron Knit Co-Ord
('p1000017-0000-0000-0000-000000000002','XS','Wheat','#F5DEB3','SBK-SS26-002-XS-WHT',8,2),
('p1000017-0000-0000-0000-000000000002','S','Wheat','#F5DEB3','SBK-SS26-002-S-WHT',10,2),
('p1000017-0000-0000-0000-000000000002','M','Wheat','#F5DEB3','SBK-SS26-002-M-WHT',10,2),
('p1000017-0000-0000-0000-000000000002','L','Wheat','#F5DEB3','SBK-SS26-002-L-WHT',8,2),
-- Harbor Denim Maxi Skirt
('p1000017-0000-0000-0000-000000000003','XS','Mid-Wash Blue','#5E8AB4','SBS-SS26-003-XS-MWB',12,2),
('p1000017-0000-0000-0000-000000000003','S','Mid-Wash Blue','#5E8AB4','SBS-SS26-003-S-MWB',16,2),
('p1000017-0000-0000-0000-000000000003','M','Mid-Wash Blue','#5E8AB4','SBS-SS26-003-M-MWB',14,2),
('p1000017-0000-0000-0000-000000000003','L','Mid-Wash Blue','#5E8AB4','SBS-SS26-003-L-MWB',10,2),
-- Como Silk Pyjama Set (NM)
('p1000018-0000-0000-0000-000000000001','XS','Ivory','#FFFFF0','NMP-FW25-001-XS-IVY',4,1),
('p1000018-0000-0000-0000-000000000001','S','Ivory','#FFFFF0','NMP-FW25-001-S-IVY',6,1),
('p1000018-0000-0000-0000-000000000001','M','Ivory','#FFFFF0','NMP-FW25-001-M-IVY',6,1),
('p1000018-0000-0000-0000-000000000001','L','Ivory','#FFFFF0','NMP-FW25-001-L-IVY',4,1),
-- Midnight Satin Robe
('p1000018-0000-0000-0000-000000000002','XS','Midnight Blue','#1C2951','NMR-FW25-002-XS-MID',3,1),
('p1000018-0000-0000-0000-000000000002','S','Midnight Blue','#1C2951','NMR-FW25-002-S-MID',5,1),
('p1000018-0000-0000-0000-000000000002','M','Midnight Blue','#1C2951','NMR-FW25-002-M-MID',5,1),
('p1000018-0000-0000-0000-000000000002','L','Midnight Blue','#1C2951','NMR-FW25-002-L-MID',3,1),
-- Cashmere Sleep Mask (one size)
('p1000018-0000-0000-0000-000000000003','OS','Ivory','#FFFFF0','NMA-FW25-003-OS-IVY',35,5),
-- Lichen Tencel Midi Dress (CI)
('p1000019-0000-0000-0000-000000000001','XS','Lichen Green','#7A9E5E','CID-SS26-001-XS-LIC',12,2),
('p1000019-0000-0000-0000-000000000001','S','Lichen Green','#7A9E5E','CID-SS26-001-S-LIC',16,2),
('p1000019-0000-0000-0000-000000000001','M','Lichen Green','#7A9E5E','CID-SS26-001-M-LIC',16,2),
('p1000019-0000-0000-0000-000000000001','L','Lichen Green','#7A9E5E','CID-SS26-001-L-LIC',10,2),
-- Cedar Bark Linen Blazer
('p1000019-0000-0000-0000-000000000002','XS','Cedar Brown','#8B4513','CIB-SS26-002-XS-CED',6,1),
('p1000019-0000-0000-0000-000000000002','S','Cedar Brown','#8B4513','CIB-SS26-002-S-CED',8,1),
('p1000019-0000-0000-0000-000000000002','M','Cedar Brown','#8B4513','CIB-SS26-002-M-CED',8,1),
('p1000019-0000-0000-0000-000000000002','L','Cedar Brown','#8B4513','CIB-SS26-002-L-CED',5,1),
-- Woad Blue Plant-Dyed Blouse
('p1000019-0000-0000-0000-000000000003','XS','Woad Blue','#5B7FA6','CIL-SS26-003-XS-WOD',8,2),
('p1000019-0000-0000-0000-000000000003','S','Woad Blue','#5B7FA6','CIL-SS26-003-S-WOD',12,2),
('p1000019-0000-0000-0000-000000000003','M','Woad Blue','#5B7FA6','CIL-SS26-003-M-WOD',12,2),
('p1000019-0000-0000-0000-000000000003','L','Woad Blue','#5B7FA6','CIL-SS26-003-L-WOD',8,2),
-- Øresund Merino Turtleneck (SH)
('p1000020-0000-0000-0000-000000000001','S','Glacier White','#F8F8F8','SHT-FW25-001-S-GLA',20,3),
('p1000020-0000-0000-0000-000000000001','M','Glacier White','#F8F8F8','SHT-FW25-001-M-GLA',22,3),
('p1000020-0000-0000-0000-000000000001','L','Glacier White','#F8F8F8','SHT-FW25-001-L-GLA',18,3),
('p1000020-0000-0000-0000-000000000001','XL','Glacier White','#F8F8F8','SHT-FW25-001-XL-GLA',12,2),
-- Nordic Wool Overcoat
('p1000020-0000-0000-0000-000000000002','S','Ash Grey','#B2BEB5','SHC-FW25-002-S-ASH',5,1),
('p1000020-0000-0000-0000-000000000002','M','Ash Grey','#B2BEB5','SHC-FW25-002-M-ASH',7,1),
('p1000020-0000-0000-0000-000000000002','L','Ash Grey','#B2BEB5','SHC-FW25-002-L-ASH',6,1),
('p1000020-0000-0000-0000-000000000002','XL','Ash Grey','#B2BEB5','SHC-FW25-002-XL-ASH',4,1),
-- Lund Straight Chino
('p1000020-0000-0000-0000-000000000003','30','Pebble Grey','#9E9E9E','SHP-FW25-003-30-PEB',12,2),
('p1000020-0000-0000-0000-000000000003','32','Pebble Grey','#9E9E9E','SHP-FW25-003-32-PEB',16,2),
('p1000020-0000-0000-0000-000000000003','34','Pebble Grey','#9E9E9E','SHP-FW25-003-34-PEB',14,2),
('p1000020-0000-0000-0000-000000000003','36','Pebble Grey','#9E9E9E','SHP-FW25-003-36-PEB',10,2);

-- ─── UPDATE BRAND PRODUCT COUNTS ────────────────────────────

UPDATE brands b
SET total_products = (
  SELECT COUNT(*) FROM products p
  WHERE p.brand_id = b.id AND p.status = 'active'
);
