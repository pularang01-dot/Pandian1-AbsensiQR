import { createBrowserClient } from "@supabase/ssr";

/** Klien Supabase untuk browser. Hanya memakai kunci anon (publik); keamanan data dijaga oleh RLS. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
