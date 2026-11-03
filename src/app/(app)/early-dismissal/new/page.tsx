import type { Metadata } from "next";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { DismissalForm } from "@/components/dismissal/dismissal-form";
import { openClassName, type AssignmentEmbed } from "@/lib/data/students";
import { submitDismissalStaffAction } from "../actions";

export const metadata: Metadata = { title: "Catat Permintaan Pulang Awal" };
export const dynamic = "force-dynamic";

export default async function NewDismissalPage() {
  await requireRole(STAFF_ROLES);
  const supabase = await createClient();
  const { data } = await supabase
    .from("students")
    .select("id, nis, full_name, student_class_assignments(class_id, end_date, classes(name))")
    .eq("status", "active").order("full_name").limit(1000);
  const students = ((data ?? []) as unknown as { id: string; nis: string; full_name: string; student_class_assignments: AssignmentEmbed[] }[]).map((s) => ({
    id: s.id, label: `${s.full_name} (${openClassName(s.student_class_assignments) ?? "tanpa kelas"}, NIS ${s.nis})`,
  }));
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Catat permintaan pulang lebih awal" description="Untuk pemohon yang datang atau menelepon ke sekolah." />
      <DismissalForm action={submitDismissalStaffAction} students={students} cancelHref="/early-dismissal" onBehalf />
    </div>
  );
}
