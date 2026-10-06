/**
 * POULTRY HUB — Admin Supabase Client (SERVICE ROLE)
 *
 * ⛔ SERVER-SIDE ONLY. NEVER import this file in:
 *    - Client Components ('use client')
 *    - Browser bundles
 *    - Any file with NEXT_PUBLIC_ references intended for the browser
 *
 * This client bypasses Row Level Security (RLS) and has full database access.
 * It must only be used for:
 *   - Administrative server-side operations that cannot be performed via RLS
 *   - User management operations (e.g., deactivating accounts)
 *   - Server Actions that are explicitly admin-gated at the application level
 *
 * All admin operations must still enforce role checks at the application layer.
 * RLS is the security boundary — this client exists as an escape hatch for
 * operations that the anon/publishable key cannot perform.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Returns a Supabase client authenticated with the service-role key.
 * Bypasses RLS. Use with extreme caution.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "[admin] NEXT_PUBLIC_SUPABASE_URL is not set. Check your environment configuration."
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "[admin] SUPABASE_SERVICE_ROLE_KEY is not set. " +
        "This variable must be configured on the server. " +
        "It must NEVER be prefixed with NEXT_PUBLIC_."
    );
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
