import crypto from 'crypto';

function getEncryptKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPT_KEY;
  if (!key || key.length !== 64) throw new Error('TOKEN_ENCRYPT_KEY must be a 32-byte hex string (64 hex chars)');
  return Buffer.from(key, 'hex');
}

export function encryptToken(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', getEncryptKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decryptToken(enc: string): string {
  const [ivHex, dataHex] = enc.split(':');
  if (!ivHex || !dataHex) throw new Error('Invalid encrypted token format');
  const decipher = crypto.createDecipheriv('aes-256-cbc', getEncryptKey(), Buffer.from(ivHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
}

export function buildShopifyAuthUrl(shop: string, state: string): string {
  const scopes = 'read_products,write_products,read_inventory,write_inventory,read_orders';
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/shopify/callback`;
  return (
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${process.env.SHOPIFY_CLIENT_ID}` +
    `&scope=${scopes}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}`
  );
}

export async function exchangeShopifyCode(shop: string, code: string): Promise<string> {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
      code,
    }),
  });
  const data = await res.json() as { access_token?: string };
  if (!data.access_token) throw new Error('Shopify token exchange failed');
  return data.access_token;
}

export async function getShopifyShopInfo(shop: string, token: string) {
  const res = await fetch(`https://${shop}/admin/api/2024-01/shop.json`, {
    headers: { 'X-Shopify-Access-Token': token },
  });
  if (!res.ok) throw new Error(`Shopify shop info failed: ${res.status}`);
  const { shop: info } = await res.json() as { shop: { id: number; name: string; email: string; currency: string } };
  return info;
}

export function normalizeShopDomain(raw: string): string {
  return raw.replace(/https?:\/\//i, '').replace(/\/$/, '').toLowerCase();
}
