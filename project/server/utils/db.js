const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const hasSupabaseConfig = Boolean(SUPABASE_URL && SUPABASE_KEY);

function createUnavailableClient() {
  const fail = async () => ({ data: null, error: { message: 'Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.' } });
  const builder = {
    select: fail,
    insert: fail,
    update: fail,
    delete: fail,
    upsert: fail,
    eq() { return this; },
    in() { return this; },
    or() { return this; },
    ilike() { return this; },
    order() { return this; },
    limit() { return this; },
    maybeSingle: fail,
    single: fail
  };
  return {
    from() { return builder; },
    auth: { getUser: fail }
  };
}

// Default client (anon key) for public reads. Keep the server bootable in preview
// environments where Supabase variables have not been added yet.
const supabase = hasSupabaseConfig ? createClient(SUPABASE_URL, SUPABASE_KEY) : createUnavailableClient();

// Create an authenticated client from a user's access token
function createAuthedClient(accessToken) {
  if (!hasSupabaseConfig) return createUnavailableClient();
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });
}

module.exports = { supabase, createAuthedClient, hasSupabaseConfig };
