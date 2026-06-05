-- #6: Tax Data Capture
-- Platform captures VAT/tax registration info for cross-border compliance.
-- No automated calculation — each party handles their own VAT obligations.
-- Data is captured for use in invoices and manual compliance audits.

-- Brand: their VAT/tax registration details
ALTER TABLE brand_storefronts
  ADD COLUMN IF NOT EXISTS vat_number              TEXT,  -- e.g. FR12345678901, GB123456789
  ADD COLUMN IF NOT EXISTS tax_country             TEXT,  -- ISO 2-letter: FR, GB, HK, US...
  ADD COLUMN IF NOT EXISTS company_reg_number      TEXT;  -- company registration / SIRET / CR number

COMMENT ON COLUMN brand_storefronts.vat_number         IS 'Brand VAT registration number in their territory';
COMMENT ON COLUMN brand_storefronts.tax_country        IS 'ISO 2-letter country of tax registration';
COMMENT ON COLUMN brand_storefronts.company_reg_number IS 'Company registration number (SIRET, Companies House, CR, etc.)';

-- Buyer: their business VAT registration
ALTER TABLE buyers
  ADD COLUMN IF NOT EXISTS vat_number      TEXT,  -- buyer business VAT number (for B2B cross-border)
  ADD COLUMN IF NOT EXISTS tax_country     TEXT;  -- ISO country of buyer tax registration

COMMENT ON COLUMN buyers.vat_number  IS 'Buyer business VAT registration number for cross-border B2B';
COMMENT ON COLUMN buyers.tax_country IS 'ISO 2-letter country of buyer VAT registration';

-- Orders: snapshot tax data at time of order (immutable audit trail)
ALTER TABLE buyer_orders
  ADD COLUMN IF NOT EXISTS buyer_vat_number   TEXT,  -- captured from buyers.vat_number at order time
  ADD COLUMN IF NOT EXISTS buyer_country      TEXT,  -- captured from buyers.country at order time
  ADD COLUMN IF NOT EXISTS seller_vat_number  TEXT,  -- captured from brand_storefronts.vat_number
  ADD COLUMN IF NOT EXISTS seller_tax_country TEXT;  -- captured from brand_storefronts.tax_country

COMMENT ON COLUMN buyer_orders.buyer_vat_number   IS 'Buyer VAT number at time of order — immutable snapshot';
COMMENT ON COLUMN buyer_orders.buyer_country      IS 'Buyer country at time of order — for VAT jurisdiction';
COMMENT ON COLUMN buyer_orders.seller_vat_number  IS 'Seller VAT number at time of order — immutable snapshot';
COMMENT ON COLUMN buyer_orders.seller_tax_country IS 'Seller tax country at time of order';
