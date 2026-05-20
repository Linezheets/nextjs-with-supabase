// Vercel Serverless Function — serves public env vars as a JS snippet.
// This is safe: SUPABASE_ANON_KEY is designed to be public.
// Add to vercel.json headers or call as <script src="/api/config"></script>

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(`
window.__SUPABASE_URL      = ${JSON.stringify(process.env.SUPABASE_URL      ?? '')};
window.__SUPABASE_ANON_KEY = ${JSON.stringify(process.env.SUPABASE_ANON_KEY ?? '')};
  `.trim());
}
