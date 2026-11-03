import "server-only";
import { createClient } from "@/lib/supabase/server";

export type YearOption = { id: string; name: string; is_active: boolean; is_archived: boolean };
export type ClassOption = { id: string; name: string; academic_year_id: string; homeroom_teacher_id: string | null; is_active: boolean };

export async function loadYears(): Promise<YearOption[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("academic_years").select("id, name, is_active, is_archived").order("start_date", { ascending: false });
  return (data ?? []) as YearOption[];
}

export async function loadClasses(yearId?: string | null): Promise<ClassOption[]> {
  const supabase = await createClient();
  let q = supabase.from("classes").select("id, name, academic_year_id, homeroom_teacher_id, is_active").order("name");
  if (yearId) q = q.eq("academic_year_id", yearId);
  const { data } = await q;
  return ((data ?? []) as ClassOption[]).sort((a, b) => a.name.localeCompare(b.name, "id", { numeric: true }));
}

/** Tahun ajaran terpilih: parameter URL, lalu yang aktif, lalu yang terbaru. */
export function pickYear(years: YearOption[], requested?: string | null) {
  return years.find((y) => y.id === requested) ?? years.find((y) => y.is_active) ?? years[0] ?? null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function asUuid(v: string | undefined | null): string | null {
  return v && UUID_RE.test(v) ? v : null;
}
export function asDate(v: string | undefined | null): string | null {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null;
}
