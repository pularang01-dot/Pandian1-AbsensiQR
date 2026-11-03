import "server-only";
import { createClient } from "@/lib/supabase/server";
import { openClassName, type AssignmentEmbed } from "@/lib/data/students";

export type Child = { id: string; nis: string; full_name: string; status: string; className: string | null };

/** Anak yang terhubung ke akun orang tua yang sedang masuk. Pembatasan dijamin RLS (is_parent_of), bukan filter aplikasi. */
export async function loadChildren(): Promise<Child[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("students")
    .select("id, nis, full_name, status, student_class_assignments(class_id, end_date, classes(name))")
    .order("full_name");
  return ((data ?? []) as unknown as (Omit<Child, "className"> & { student_class_assignments: AssignmentEmbed[] })[]).map((s) => ({
    id: s.id, nis: s.nis, full_name: s.full_name, status: s.status, className: openClassName(s.student_class_assignments),
  }));
}
