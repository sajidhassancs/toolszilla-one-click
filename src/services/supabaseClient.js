/**
 * Supabase Client Configuration
 */
import { createClient } from '@supabase/supabase-js';

// ✅ Get from process.env
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

console.log('🔍 [SUPABASE CLIENT] Checking credentials...');
console.log('   SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
console.log('   SUPABASE_KEY:', supabaseKey ? `✅ Set (${supabaseKey.substring(0, 20)}...)` : '❌ Missing');

// ✅ Create client or null
let supabaseClient = null;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials!');
    console.error('   Make sure SUPABASE_URL and SUPABASE_KEY are in your .env file');
    console.error('   Current .env path:', process.cwd() + '/.env');
    console.warn('⚠️ Supabase client will be NULL - queue will not work!');
} else {
    supabaseClient = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase client initialized successfully');
}

export const supabase = supabaseClient;