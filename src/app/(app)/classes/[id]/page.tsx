import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IdCard } from "lucide-react";
import { ADMIN_ROLES, STAFF_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { asUuid, loadClasses, loadYears } from "@/lib/data/lookups";
import { loadProfileNames, loadTeachers } from "@/lib/data/teachers";
import { one } from "@/lib/data/students";
import { ClassFormButton } from "../class-form";
import { formatTanggal } from "@/lib/utils";
import { AddStudentToClass, MoveHomeroom, TransferStudent } from "./class-members";

export const metadata: Metadata = { title: "Rincian Kelas" };
export const dynamic = "force-dynamic";

type Member = { id: string; nis: string; full_name: string; gender: string | null };

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(STAFF_ROLES);
  const id = asUuid((await params).id);
  if (!id) notFound();
  const isAdmin = user.roles.some((r) => ADMIN_ROLES.includes(r));
  const supabase = await createClient();

  const { data: cls } = await supabase.from("classes").select("id, name, grade_level, is_active, academic_year_id, homeroom_teacher_id").eq("id", id).maybeSingle();
  if (!cls) notFound();

  const [years, yearClasses, teachers, membersRes, openRes, activeRes] = await Promise.all([
    loadYears(),
    loadClasses(cls.academic_year_id),
    isAdmin ? loadTeachers() : Promise.resolve([]),
    supabase
      .from("student_class_assignments")
      .select("students!inner(id, nis, full_name, gender, status)")
      .eq("class_id", id)
      .is("end_date", null)
      .eq("students.status", "active"),
    isAdmin ? supabase.from("student_class_assignments").select("student_id").eq("academic_year_id", cls.academic_year_id).is("end_date", null) : Promise.resolve({ data: [] }),
    isAdmin ? supabase.from("students").select("id, nis, full_name").eq("status", "active").order("full_name").limit(1000) : Promise.resolve({ data: [] }),
  ]);

  const members: Member[] = (membersRes.data ?? [])
    .map((r) => one(r.students as Member | Member[] | null))
    .filter((m): m is Member => m !== null)
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "id"));
  const placed = new Set(((openRes.data ?? []) as { student_id: string }[]).map((r) => r.student_id));
  const candidates = ((activeRes.data ?? []) as { id: string; nis: string; full_name: string }[])
    .filter((s) => !placed.has(s.id))
    .map((s) => ({ id: s.id, label: `${s.full_name} (${s.nis})` }));

  const canSeeHistory = isAdmin || user.roles.includes("principal");
  const { data: hist } = canSeeHistory
    ? await supabase.from("class_homeroom_history").select("id, teacher_id, started_at, ended_at, end_reason").eq("class_id", id).order("started_at", { ascending: false }).limit(50)
    : { data: [] };
  const names = await loadProfileNames([
    ...(cls.homeroom_teacher_id ? [cls.homeroom_teacher_id] : []),
    ...(hist ?? []).map((h) => h.teacher_id as string),
    ...yearClasses.map((c) => c.homeroom_teacher_id).filter(Boolean) as string[],
  ]);
  const teacher = cls.homeroom_teacher_id ? names.get(cls.homeroom_teacher_id)?.name ?? "Akun guru" : null;
  const teacherInactive = isAdmin && !!cls.homeroom_teacher_id && !teachers.some((t) => t.id === cls.homeroom_teacher_id);
  const moveTargets = yearClasses.filter((c) => c.is_active && c.id !== id).map((c) => ({ id: c.id, name: c.name, teacher: c.homeroom_teacher_id ? names.get(c.homeroom_teacher_id)?.name ?? "Akun guru" : null }));
  const yearName = years.find((y) => y.id === cls.academic_year_id)?.name ?? "-";

  const columns: Column<Member>[] = [
    { key: "no", header: "No", className: "w-12", cell: (m) => <span className="tabular text-ink-muted">{members.indexOf(m) + 1}</span> },
    { key: "name", header: "Nama", cell: (m) => <Link href={`/students/${m.id}`} className="font-medium hover:text-brand">{m.full_name}</Link> },
    { key: "nis", header: "NIS", cell: (m) => <span className="tabular">{m.nis}</span> },
    { key: "gender", header: "L/P", hideOnMobile: true, cell: (m) => m.gender ?? "-" },
    ...(isAdmin ? [{ key: "move", header: "Pindah kelas", cell: (m: Member) => <TransferStudent studentId={m.id} name={m.full_name} classes={yearClasses.filter((c) => c.is_active).map((c) => ({ id: c.id, name: c.name }))} currentClassId={id} /> }] : []),
  ];

  return (
    <>
      <PageHeader
        title={`Kelas ${cls.name}`}
        description={`Tahun ajaran ${yearName} | Wali kelas: ${teacher ?? "belum ditentukan"} | ${members.length} siswa aktif${cls.is_active ? "" : " | Kelas nonaktif"}`}
        actions={isAdmin ? (
          <>
            <Link href={`/students/qr-cards?class=${cls.id}`} className="inline-flex h-11 items-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-medium hover:bg-canvas"><IdCard className="h-4 w-4" aria-hidden />Kartu QR</Link>
            <ClassFormButton variant="edit" values={{ id: cls.id, name: cls.name, academic_year_id: cls.academic_year_id, grade_level: cls.grade_level, homeroom_teacher_id: cls.homeroom_teacher_id, is_active: cls.is_active }} years={years.filter((y) => !y.is_archived || y.id === cls.academic_year_id).map((y) => ({ id: y.id, name: y.name }))} teachers={teachers} />
          </>
        ) : undefined}
      />
      {isAdmin && cls.is_active && (!cls.homeroom_teacher_id || teacherInactive) && (
        <div role="note" className="mb-4 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-[#8a5a0e]">
          {cls.homeroom_teacher_id ? "Wali kelas ini sudah tidak aktif." : "Kelas ini belum memiliki wali kelas."} Guru tidak dapat mencatat absensi kelas ini. Tetapkan wali lewat tombol Ubah.
        </div>
      )}
      <div className="card">
        <DataTable caption={`Daftar siswa kelas ${cls.name}`} columns={columns} rows={members} rowKey={(m) => m.id} emptyTitle="Belum ada siswa di kelas ini" emptyDescription={isAdmin ? "Tambahkan siswa dari bagian di bawah, atau impor siswa dengan kolom Kelas." : undefined} />
        {isAdmin && <div className="border-t border-line p-4"><AddStudentToClass classId={cls.id} candidates={candidates} /></div>}
      </div>

      {isAdmin && cls.homeroom_teacher_id && moveTargets.length > 0 && (
        <section className="card mt-6 p-5"><MoveHomeroom fromId={cls.id} targets={moveTargets} /></section>
      )}

      {canSeeHistory && (
        <section className="card mt-6 p-5">
          <h2 className="mb-3 text-base font-semibold">Riwayat wali kelas</h2>
          {(hist ?? []).length === 0 ? <p className="text-sm text-ink-muted">Belum ada riwayat wali kelas.</p> : (
            <ul className="divide-y divide-line text-sm">
              {(hist ?? []).map((h) => (
                <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="font-medium">{names.get(h.teacher_id as string)?.name ?? "Akun guru"}</span>
                  <span className="tabular text-ink-muted">
                    {formatTanggal(h.started_at as string, "d MMM yyyy")} - {h.ended_at ? `${formatTanggal(h.ended_at as string, "d MMM yyyy")}${h.end_reason ? ` (${h.end_reason})` : ""}` : "sekarang"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}