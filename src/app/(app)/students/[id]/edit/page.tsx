import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { asUuid, loadClasses, loadYears, pickYear } from "@/lib/data/lookups";
import { StudentForm } from "../../student-form";

export const metadata: Metadata = { title: "Ubah Siswa" };
export const dynamic = "force-dynamic";

export default async function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(ADMIN_ROLES);
  const id = asUuid((await params).id);
  if (!id) notFound();

  const supabase = await createClient();
  const { data: s } = await supabase
    .from("students")
    .select("id, nis, nisn, full_name, gender, status, student_class_assignments(class_id, end_date)")
    .eq("id", id)
    .maybeSingle();
  if (!s) notFound();

  const year = pickYear(await loadYears());
  const classes = await loadClasses(year?.id);
  const open = (s.student_class_assignments as { class_id: string; end_date: string | null }[]).find((a) => a.end_date === null);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Ubah data siswa" description={s.full_name} />
      <StudentForm
        values={{ id: s.id, nis: s.nis, nisn: s.nisn, full_name: s.full_name, gender: s.gender, status: s.status, class_id: open?.class_id ?? null }}
        classes={classes.filter((c) => c.is_active)}
        cancelHref={`/students/${s.id}`}
      />
    </div>
  );
}
