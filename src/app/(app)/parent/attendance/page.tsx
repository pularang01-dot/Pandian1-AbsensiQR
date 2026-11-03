import type { Metadata } from "next";
import { format, parseISO, endOfMonth } from "date-fns";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { Input, Select } from "@/components/ui/field";
import { loadChildren } from "@/lib/data/children";
import { asUuid } from "@/lib/data/lookups";
import { one } from "@/lib/data/students";
import { emptyCounts, addCount, formatRate, attendanceRate } from "@/lib/attendance-calc";
import { formatTanggal, formatWaktu, todayISO } from "@/lib/utils";

export const metadata: Metadata = { title: "Riwayat Kehadiran" };
export const dynamic = "force-dynamic";

type Row = { id: string; status: string; checked_in_at: string | null; note: string | null; attendance_sessions: { session_date: string } | { session_date: string }[] | null };

export default async function ParentAttendancePage({ searchParams }: { searchParams: Promise<{ student?: string; month?: string }> }) {
  await requireRole(["parent"]);
  const sp = await searchParams;
  const children = await loadChildren();
  const studentId = children.find((c) => c.id === asUuid(sp.student))?.id ?? children[0]?.id ?? null;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : todayISO().slice(0, 7);
  const from = `${month}-01`;
  const to = format(endOfMonth(parseISO(from)), "yyyy-MM-dd");

  let rows: Row[] = [];
  if (studentId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("attendance_records")
      .select("id, status, checked_in_at, note, attendance_sessions!inner(session_date)")
      .eq("student_id", studentId)
      .gte("attendance_sessions.session_date", from)
      .lte("attendance_sessions.session_date", to)
      .order("created_at", { ascending: false })
      .limit(100);
    rows = (data ?? []) as unknown as Row[];
  }
  rows.sort((a, b) => (one(b.attendance_sessions)?.session_date ?? "").localeCompare(one(a.attendance_sessions)?.session_date ?? ""));

  const counts = emptyCounts();
  for (const r of rows) addCount(counts, r.status, 1);
  const days = rows.length;

  const columns: Column<Row>[] = [
    { key: "date", header: "Tanggal", cell: (r) => { const s = one(r.attendance_sessions); return s ? formatTanggal(s.session_date) : "-"; } },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    { key: "time", header: "Jam", hideOnMobile: true, cell: (r) => <span className="tabular">{r.checked_in_at ? formatWaktu(r.checked_in_at) : "-"}</span> },
  ];

  return (
    <>
      <PageHeader title="Riwayat kehadiran" description="Hanya catatan anak yang terhubung dengan akun Anda." />
      <div className="card">
        <FilterBar action="/parent/attendance" resetHref="/parent/attendance">
          <FilterField label="Anak" htmlFor="student">
            <Select id="student" name="student" defaultValue={studentId ?? ""}>
              {children.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Bulan" htmlFor="month"><Input id="month" name="month" type="month" defaultValue={month} /></FilterField>
        </FilterBar>
        {studentId && (
          <p className="tabular border-b border-line px-4 py-3 text-sm text-ink-muted">
            {days} hari tercatat | Hadir {counts.present} | Terlambat {counts.late} | Sakit {counts.sick} | Izin {counts.permission} | Kegiatan resmi {counts.official_activity} | Alpa {counts.unexcused} | Kehadiran fisik {formatRate(attendanceRate(counts, days))}
          </p>
        )}
        <DataTable caption="Riwayat kehadiran anak" columns={columns} rows={rows} rowKey={(r) => r.id} emptyTitle={studentId ? "Belum ada catatan pada bulan ini" : "Belum ada anak terhubung"} />
      </div>
    </>
  );
}
