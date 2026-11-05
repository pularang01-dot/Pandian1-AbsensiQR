import type { Metadata } from "next";
import Link from "next/link";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { Select } from "@/components/ui/field";
import { asUuid, loadClasses, loadYears, pickYear } from "@/lib/data/lookups";
import { one } from "@/lib/data/students";
import { FINAL_GRADE, incrementClassName, parseGrade } from "@/lib/classes/grade";
import { PromotionPlanner } from "./planner";

export const metadata: Metadata = { title: "Kenaikan Kelas" };
export const dynamic = "force-dynamic";

export default async function PromotionPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requireRole(ADMIN_ROLES);
  const sp = await searchParams;
  const years = await loadYears();
  const supabase = await createClient();

  const from = pickYear(years.filter((y) => !y.is_archived || y.id === asUuid(sp.from)), asUuid(sp.from));
  const later = from ? years.filter((y) => !y.is_archived && y.id !== from.id && y.start_date > from.start_date).sort((a, b) => a.start_date.localeCompare(b.start_date)) : [];
  const to = later.find((y) => y.id === asUuid(sp.to)) ?? later[0] ?? null;

  const header = <PageHeader title="Kenaikan kelas" description="Pindahkan siswa ke kelas tahun ajaran berikutnya. Atur pengecualian bagi siswa yang tidak naik kelas atau pindah sekolah. Tidak ada data yang dihapus." />;

  if (!from || !to) {
    return (
      <>
        {header}
        <div className="card"><EmptyState title="Tahun ajaran tujuan belum ada" description="Buat tahun ajaran baru (yang lebih baru dari tahun asal) di Pengaturan > Tahun ajaran, lalu kembali ke halaman ini." /></div>
        <p className="mt-4 text-sm"><Link href="/settings/academic-year" className="font-medium text-brand hover:underline">Buka pengaturan tahun ajaran</Link></p>
      </>
    );
  }

  const [srcClasses, tgtClasses, asg] = await Promise.all([
    loadClasses(from.id),
    loadClasses(to.id),
    supabase.from("student_class_assignments").select("class_id, students!inner(id, nis, full_name, status)").eq("academic_year_id", from.id).is("end_date", null).eq("students.status", "active").limit(5000),
  ]);

  type S = { id: string; nis: string; full_name: string };
  const byClass = new Map<string, S[]>();
  for (const r of (asg.data ?? []) as unknown as { class_id: string; students: S | S[] | null }[]) {
    const s = one(r.students);
    if (s) byClass.set(r.class_id, [...(byClass.get(r.class_id) ?? []), s]);
  }

  const targets = tgtClasses.filter((c) => c.is_active).map((c) => ({ id: c.id, name: c.name, grade: c.grade_level ?? parseGrade(c.name) }));
  const sources = srcClasses
    .filter((c) => (byClass.get(c.id) ?? []).length > 0)
    .map((c) => {
      const grade = c.grade_level ?? parseGrade(c.name);
      const students = (byClass.get(c.id) ?? []).sort((a, b) => a.full_name.localeCompare(b.full_name, "id"));
      let suggestion = "";
      if (grade !== null && grade >= FINAL_GRADE) suggestion = "graduate";
      else {
        const next = incrementClassName(c.name);
        const hit = next ? targets.find((t) => t.name.toLowerCase() === next.toLowerCase()) : null;
        if (hit) suggestion = hit.id;
      }
      return { id: c.id, name: c.name, grade, students: students.map((s) => ({ id: s.id, nis: s.nis, name: s.full_name })), suggestion };
    })
    .sort((a, b) => (a.grade ?? 99) - (b.grade ?? 99) || a.name.localeCompare(b.name, "id", { numeric: true }));
  return (
    <>
      {header}
      <div className="card mb-6">
        <FilterBar action="/classes/promotion" resetHref="/classes/promotion">
          <FilterField label="Tahun ajaran asal" htmlFor="from">
            <Select id="from" name="from" defaultValue={from.id}>{years.filter((y) => !y.is_archived || y.id === from.id).map((y) => <option key={y.id} value={y.id}>{y.name}{y.is_active ? " (aktif)" : ""}</option>)}</Select>
          </FilterField>
          <FilterField label="Tahun ajaran tujuan" htmlFor="to">
            <Select id="to" name="to" defaultValue={to.id}>{later.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}</Select>
          </FilterField>
        </FilterBar>
      </div>
      {sources.length === 0
        ? <div className="card"><EmptyState title="Tidak ada siswa aktif di tahun ajaran asal" description="Semua kelas pada tahun ajaran ini kosong, atau kenaikan sudah diproses." /></div>
        : <PromotionPlanner fromYear={{ id: from.id, name: from.name }} toYear={{ id: to.id, name: to.name }} sources={sources} targets={targets} />}
    </>
  );
}