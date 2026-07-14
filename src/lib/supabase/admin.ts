import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { requirePublicEnv, requireServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

export function createAdminClient() {
  return createSupabaseClient<Database>(
    requirePublicEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}
