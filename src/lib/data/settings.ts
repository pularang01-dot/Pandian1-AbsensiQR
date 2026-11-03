import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function loadSettings(): Promise<Record<string, unknown>> {
  const supabase = await createClient();
  const { data } = await supabase.from("system_settings").select("key, value");
  return Object.fromEntries((data ?? []).map((r) => [r.key as string, r.value as unknown]));
}

export const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
export const num = (v: unknown, d: number) => (typeof v === "number" ? v : d);
export const nums = (v: unknown, d: number[]) => (Array.isArray(v) ? v.map(Number).filter((n) => Number.isInteger(n)) : d);
