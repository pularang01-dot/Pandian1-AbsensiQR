import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { DispensationForm } from "@/components/dispensations/dispensation-form";
import { loadTeachers } from "@/lib/data/teachers";
import { openClassName, type AssignmentEmbed } from "@/lib/data/students";
import { createDispensationAction } from "../actions";

export const metadata: Metadata = { title: "Ajukan Dispensasi" };
export const dynamic = "force-dynamic";

export default async function NewDispensationPage() {
  const user = await requireRole(["super_admin", "school_admin", "principal", "teacher"]);
  const supabase = await createClient();
  // RLS membatasi guru pada siswa kelasnya; basis data memvalidasi ulang saat pengajuan disimpan.
  const { data } = await supabase
    .from("students")
    .select("id, nis, full_name, student_class_assignments(class_id, end_date, classes(name))")
    .eq("status", "active")
    .order("full_name")
    .limit(1000);
  const students = ((data ?? []) as unknown as { id: string; nis: string; full_name: string; student_class_assignments: AssignmentEmbed[] }[]).map((s) => ({
    id: s.id, label: `${s.full_name} (${openClassName(s.student_class_assignments) ?? "tanpa kelas"}, NIS ${s.nis})`,
  }));
  const teachers = await loadTeachers();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Ajukan dispensasi" description="Untuk kegiatan resmi sekolah seperti lomba atau delegasi. Bukan untuk sakit atau izin." />
      <DispensationForm action={createDispensationAction} students={students} teachers={teachers} defaultSupervisor={teachers.find((t) => t.id === user.id)?.id} />
    </div>
  );
}
