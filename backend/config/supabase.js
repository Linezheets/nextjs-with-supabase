// backend/config/supabase.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '../.env'), override: true });

const supabaseUrl = process.env.SUPABASE_URL;
// Use the service-role key for server-side passport operations (bypasses RLS)
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables in backend config.');
}

// Server-side admin client for passport user upsert operations
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});

module.exports = supabase;
