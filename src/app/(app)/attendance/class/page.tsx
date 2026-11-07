import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, ScanLine } from "lucide-react";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Input, Select } from "@/components/ui/field";
import { asUuid, loadClasses, loadYears, pickYear } from "@/lib/data/lookups";
import { one } from "@/lib/data/students";
import { formatTanggal, todayISO } from "@/lib/utils";
import { ClassRoster, type RosterStudent } from "./class-roster";

export const metadata: Metadata = { title: "Absen Kelas" };
export const dynamic = "force-dynamic";

function shiftDay(iso: string, delta: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export default async function ClassAttendancePage({ searchParams }: { searchParams: Promise<{ class?: string; tanggal?: string }> }) {
  const user = await requireRole(["super_admin", "school_admin", "teacher", "operator"]);
  const sp = await searchParams;
  const supabase = await createClient();
  const today = todayISO();
  const isAdmin = user.roles.some((r) => ADMIN_ROLES.includes(r));
  const isAdminLike = user.roles.some((r) => ADMIN_ROLES.includes(r)) || user.roles.includes("operator");

  const classes = (await loadClasses(pickYear(await loadYears())?.id)).filter((c) => c.is_active);
  // Guru hanya mendapat kelasnya sendiri; admin dan operator memilih kelas.
  const mine = classes.filter((c) => c.homeroom_teacher_id === user.id);
  const selectable = isAdminLike ? classes : mine;
  const wanted = asUuid(sp.class);
  const cls = selectable.find((c) => c.id === wanted) ?? selectable[0];

  // Absensi susulan: hanya admin, hanya tanggal lampau (maksimal 30 hari ke belakang).
  const minDate = shiftDay(today, -30);
  const maxDate = shiftDay(today, -1);
  const askedDate = /^\d{4}-\d{2}-\d{2}$/.test(sp.tanggal ?? "") ? (sp.tanggal as string) : "";
  const backdate = isAdmin && askedDate >= minDate && askedDate <= maxDate ? askedDate : "";
  const day = backdate || today;

  const header = (
    <PageHeader
      title="Absen kelas"
      description={`Pilih status kehadiran tiap siswa, lalu simpan sekaligus. ${formatTanggal(day)}`}
      actions={
        <>
          <Link href="/attendance/scanner" className="inline-flex h-11 items-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-medium hover:bg-canvas"><ScanLine className="h-4 w-4" aria-hidden />Pemindai QR</Link>
          <Link href="/attendance" className="inline-flex h-11 items-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-medium hover:bg-canvas"><ClipboardList className="h-4 w-4" aria-hidden />Data absensi</Link>
        </>
      }
    />
  );

  if (!cls) {
    return (
      <>
        {header}
        <div className="card">
          <EmptyState
            title={isAdminLike ? "Belum ada kelas aktif" : "Anda belum ditetapkan sebagai wali kelas"}
            description={isAdminLike ? "Buat kelas terlebih dahulu di menu Kelas." : "Minta administrator menetapkan Anda sebagai wali kelas di menu Kelas. Setelah itu daftar siswa kelas Anda muncul di sini."}
          />
        </div>
      </>
    );
  }

  // Hari ini: anggota aktif sekarang. Tanggal lampau: anggota kelas PADA tanggal itu.
  let aq = supabase
    .from("student_class_assignments")
    .select("student_id, students!inner(id, nis, full_name, status)")
    .eq("class_id", cls.id);
  aq = backdate
    ? aq.lte("start_date", backdate).or(`end_date.is.null,end_date.gte.${backdate}`)
    : aq.is("end_date", null);
  const { data: assigns, error } = await aq;
  if (error) return <>{header}<div className="card"><ErrorState message="Daftar siswa tidak dapat dimuat. Muat ulang halaman." /></div></>;

  const students = (assigns ?? [])
    .map((a) => one(a.students as unknown as { id: string; nis: string; full_name: string; status: string } | { id: string; nis: string; full_name: string; status: string }[]))
    .filter((s): s is { id: string; nis: string; full_name: string; status: string } => !!s && (backdate ? true : s.status === "active"))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "id"));

  const ids = students.map((s) => s.id);
  const { data: recs } = ids.length
    ? await supabase.from("attendance_records")
        .select("student_id, status, source, checked_in_at, attendance_sessions!inner(session_date)")
        .eq("attendance_sessions.session_date", day).in("student_id", ids)
    : { data: [] };
  const byStudent = new Map((recs ?? []).map((r) => [r.student_id as string, r]));

  const roster: RosterStudent[] = students.map((s) => {
    const r = byStudent.get(s.id);
    return { id: s.id, name: s.full_name, nis: s.nis, existing: r ? { status: r.status as string, source: r.source as string, at: (r.checked_in_at as string | null) ?? null } : null };
  });

  return (
    <>
      {header}
      {isAdminLike && (selectable.length > 1 || isAdmin) && (
        <form className="card mb-4 flex flex-wrap items-end gap-3 p-4" action="/attendance/class">
          {selectable.length > 1 && (
            <div>
              <label htmlFor="class" className="field-label">Kelas</label>
              <Select id="class" name="class" defaultValue={cls.id}>
                {selectable.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
          )}
          {isAdmin && (
            <div>
              <label htmlFor="tanggal" className="field-label">Tanggal susulan (opsional)</label>
              <Input id="tanggal" name="tanggal" type="date" min={minDate} max={maxDate} defaultValue={backdate} />
            </div>
          )}
          <button type="submit" className="inline-flex h-11 items-center rounded-lg border border-line px-4 text-sm font-medium hover:bg-canvas">Tampilkan</button>
          {backdate && <Link href={`/attendance/class?class=${cls.id}`} className="inline-flex h-11 items-center px-2 text-sm text-brand underline">Kembali ke hari ini</Link>}
        </form>
      )}
      {backdate && (
        <div role="status" className="mb-4 rounded-lg border border-warning bg-warning/10 p-4 text-sm">
          <span className="font-semibold">Mengisi absensi susulan untuk {formatTanggal(backdate)}.</span> Alasan wajib diisi saat menyimpan dan tercatat di Aktivitas. Catatan yang sudah ada tidak diubah, dan siswa yang tidak dipilih tidak dianggap Alpa.
        </div>
      )}
      <ClassRoster key={`${cls.id}-${day}`} classId={cls.id} date={backdate || undefined} className={cls.name} students={roster} />
    </>
  );
}