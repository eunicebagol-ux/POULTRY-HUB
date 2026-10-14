import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import type { Database } from "@/types/database.types";

/**
 * Creates a Supabase client for use in Server Components, Server Actions,
 * and Route Handlers using Clerk's native Third-Party Authentication.
 *
 * Obtains the Clerk session token on the server and passes it via the
 * accessToken option. The client sends (auth.jwt() ->> 'sub') to PostgreSQL
 * without invoking any Supabase GoTrue cookie or onAuthStateChange handlers.
 */
export async function createClient() {
  const { getToken } = await auth();

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      accessToken: async () => {
        return (await getToken()) ?? null;
      },
    }
  );
}
