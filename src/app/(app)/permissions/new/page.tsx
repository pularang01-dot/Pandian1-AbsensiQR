import type { Metadata } from "next";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { PermissionForm } from "@/components/permissions/permission-form";
import { openClassName, type AssignmentEmbed } from "@/lib/data/students";
import { recordPermissionManuallyAction } from "../actions";
import { todayISO } from "@/lib/utils";

export const metadata: Metadata = { title: "Catat Izin Manual" };
export const dynamic = "force-dynamic";

export default async function NewManualPermissionPage() {
  await requireRole(ADMIN_ROLES);
  const supabase = await createClient();
  const { data } = await supabase
    .from("students")
    .select("id, nis, full_name, student_class_assignments(class_id, end_date, classes(name))")
    .eq("status", "active")
    .order("full_name")
    .limit(1000);
  const students = ((data ?? []) as unknown as { id: string; nis: string; full_name: string; student_class_assignments: AssignmentEmbed[] }[]).map((s) => ({
    id: s.id, label: `${s.full_name} (${openClassName(s.student_class_assignments) ?? "tanpa kelas"}, NIS ${s.nis})`,
  }));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Catat izin atau sakit secara manual" description="Untuk orang tua yang tidak dapat memakai portal (tanpa internet, lewat telepon, atau datang langsung)." />
      <PermissionForm action={recordPermissionManuallyAction} students={students} cancelHref="/permissions" today={todayISO()} manual docDays={3} />
    </div>
  );
}
