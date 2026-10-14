import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Creates a Supabase client for use in browser / Client Components
 * using Clerk's native Third-Party Authentication integration.
 *
 * Obtains the active Clerk session token through the native accessToken option.
 */
export function createClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      accessToken: async () => {
        if (typeof window === "undefined") return null;

        const clerkSession = (
          window as unknown as {
            Clerk?: {
              session?: {
                getToken: () => Promise<string | null>;
              };
            };
          }
        ).Clerk?.session;

        return (await clerkSession?.getToken()) ?? null;
      },
    }
  );
}
