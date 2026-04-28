#!/usr/bin/env npx tsx
/**
 * Debug script: Check what trips exist for the current logged-in user.
 * Run: npx tsx scripts/debug-user-trips.ts
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('=== AfterStay Trip Debugger ===\n');

  // Ask for credentials to sign in and check
  const email = 'peterkgumapac@gmail.com';
  const password = process.argv[2];

  if (!password) {
    console.log('Usage: npx tsx scripts/debug-user-trips.ts <password>');
    console.log('This will sign in as peterkgumapac@gmail.com and list all trips.\n');
    
    // Try checking without auth — see all trips
    console.log('Checking all trips in database (no auth filter):\n');
    const { data: allTrips, error } = await supabase
      .from('trips')
      .select('id, name, destination, status, user_id, deleted_at, archived_at, is_draft, start_date, end_date, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Query error:', error.message);
      return;
    }

    console.log(`Found ${allTrips?.length ?? 0} total trips:\n`);
    for (const t of allTrips ?? []) {
      const state = t.deleted_at ? 'DELETED' : t.archived_at ? 'ARCHIVED' : t.is_draft ? 'DRAFT' : t.status;
      console.log(`  [${state}] ${t.name || t.destination || '(unnamed)'} (${t.id})`);
      console.log(`       user_id: ${t.user_id}`);
      console.log(`       dates: ${t.start_date} → ${t.end_date}`);
      console.log('');
    }
    return;
  }

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError || !authData.user) {
    console.error('Sign in failed:', authError?.message);
    process.exit(1);
  }

  const userId = authData.user.id;
  console.log(`Signed in as: ${email}`);
  console.log(`User ID: ${userId}\n`);

  // Check owned trips
  const { data: owned, error: ownedErr } = await supabase
    .from('trips')
    .select('id, name, destination, status, user_id, deleted_at, archived_at, is_draft, start_date, end_date')
    .eq('user_id', userId)
    .order('start_date', { ascending: false });

  if (ownedErr) console.error('Owned query error:', ownedErr.message);

  // Check member trips
  const { data: memberTrips, error: memberErr } = await supabase
    .from('trips')
    .select('id, name, destination, status, user_id, deleted_at, archived_at, is_draft, start_date, end_date, group_members!inner(user_id)')
    .eq('group_members.user_id', userId)
    .order('start_date', { ascending: false });

  if (memberErr) console.error('Member query error:', memberErr.message);

  const all = [...(owned ?? []), ...(memberTrips ?? [])];
  const seen = new Set();
  const unique = all.filter((t: any) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });

  console.log(`=== Found ${unique.length} trip(s) ===\n`);

  for (const t of unique) {
    const state = t.deleted_at ? 'DELETED' : t.archived_at ? 'ARCHIVED' : t.is_draft ? 'DRAFT' : t.status;
    console.log(`  [${state}] ${t.name || t.destination || '(unnamed)'} (${t.id})`);
    console.log(`       user_id: ${t.user_id} | dates: ${t.start_date} → ${t.end_date}`);
    console.log('');
  }

  // Also check if there are deleted/archived trips
  const { data: allUserTrips } = await supabase
    .from('trips')
    .select('id, name, destination, status, deleted_at, archived_at, is_draft')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  const deleted = allUserTrips?.filter((t: any) => t.deleted_at) ?? [];
  const archived = allUserTrips?.filter((t: any) => t.archived_at && !t.deleted_at) ?? [];

  if (deleted.length > 0) {
    console.log(`⚠️  ${deleted.length} soft-deleted trip(s) found`);
  }
  if (archived.length > 0) {
    console.log(`⚠️  ${archived.length} archived trip(s) found`);
  }

  if (unique.length === 0) {
    console.log('\n❌ No accessible trips found for this user.\n');
    console.log('Possible causes:');
    console.log('  1. Trips were created with a different login method (different user_id)');
    console.log('  2. Trips were soft-deleted');
    console.log('  3. RLS policy is blocking access');
    console.log('  4. Not a member of any group trips');
  }
}

main().catch(console.error);
