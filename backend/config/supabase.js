// backend/config/supabase.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '../.env'), override: true });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
// Service-role key ONLY — publishable/anon key must never be used server-side (bypasses RLS)
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in backend config.');
}

// Server-side admin client for passport user upsert operations
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});

module.exports = supabase;
