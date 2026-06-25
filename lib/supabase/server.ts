import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getPublicEnv, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

export async function createSupabaseServerClient() {
  const env = getPublicEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies; Route Handlers can.
        }
      },
    },
  });
}

export function createSupabaseServiceRoleClient() {
  const env = getServerEnv();

  return createServerClient<Database>(
    env.supabaseUrl,
    env.supabaseServiceRoleKey,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          return undefined;
        },
      },
    },
  );
}
