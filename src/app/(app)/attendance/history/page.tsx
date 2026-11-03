import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination, PAGE_SIZE, parsePage } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState } from "@/components/ui/states";
import { asUuid } from "@/lib/data/lookups";
import { one } from "@/lib/data/students";
import { formatTanggal } from "@/lib/utils";

export const metadata: Metadata = { title: "Riwayat Perubahan Absensi" };
export const dynamic = "force-dynamic";

type Row = {
  id: string; previous_status: string; new_status: string; reason: string; corrected_at: string; corrected_by: string;
  attendance_records: {
    student_id: string;
    students: { full_name: string; nis: string } | { full_name: string; nis: string }[] | null;
    attendance_sessions: { session_date: string } | { session_date: string }[] | null;
  } | { student_id: string; students: unknown; attendance_sessions: unknown }[] | null;
};

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ record?: string; student?: string; page?: string }> }) {
  await requireRole(STAFF_ROLES);
  const sp = await searchParams;
  const supabase = await createClient();
  const page = parsePage(sp.page);
  const record = asUuid(sp.record);
  const student = asUuid(sp.student);

  let query = supabase
    .from("attendance_corrections")
    .select("id, previous_status, new_status, reason, corrected_at, corrected_by, attendance_records!inner(student_id, students(full_name, nis), attendance_sessions(session_date))", { count: "exact" })
    .order("corrected_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (record) query = query.eq("record_id", record);
  if (student) query = query.eq("attendance_records.student_id", student);

  const { data, count, error } = await query;
  const rows = (data ?? []) as unknown as Row[];

  const ids = [...new Set(rows.map((r) => r.corrected_by))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
    for (const p of profs ?? []) names.set(p.id, p.full_name);
  }

  const columns: Column<Row>[] = [
    { key: "when", header: "Waktu koreksi", cell: (r) => <span className="tabular whitespace-nowrap">{formatTanggal(r.corrected_at, "d MMM yyyy, HH:mm")}</span> },
    {
      key: "student", header: "Siswa",
      cell: (r) => {
        const rec = one(r.attendance_records as unknown as { student_id: string; students: { full_name: string; nis: string } | { full_name: string; nis: string }[] | null; attendance_sessions: { session_date: string } | { session_date: string }[] | null } | null);
        const s = one(rec?.students ?? null);
        const sess = one(rec?.attendance_sessions ?? null);
        return <div><p className="font-medium">{s?.full_name ?? "-"}</p><p className="text-xs text-ink-muted">{sess ? formatTanggal(sess.session_date, "d MMM yyyy") : ""}</p></div>;
      },
    },
    { key: "change", header: "Perubahan", cell: (r) => <div className="flex flex-wrap items-center gap-2"><StatusBadge status={r.previous_status} /><ArrowRight className="h-4 w-4 text-ink-muted" aria-label="menjadi" /><StatusBadge status={r.new_status} /></div> },
    { key: "reason", header: "Alasan", cell: (r) => <span className="text-sm">{r.reason}</span> },
    { key: "by", header: "Dikoreksi oleh", hideOnMobile: true, cell: (r) => names.get(r.corrected_by) ?? "-" },
  ];

  return (
    <>
      <PageHeader
        title="Riwayat perubahan absensi"
        description="Setiap koreksi menyimpan status lama, status baru, alasan, pelaku, dan waktu. Catatan ini tidak dapat diubah."
        actions={(record || student) ? <Link href="/attendance/history" className="inline-flex h-11 items-center rounded-lg border border-line bg-surface px-4 text-sm font-medium hover:bg-canvas">Hapus filter</Link> : undefined}
      />
      <div className="card">
        {error ? <ErrorState message="Riwayat tidak dapat dimuat." /> : (
          <>
            <DataTable caption="Riwayat koreksi absensi" columns={columns} rows={rows} rowKey={(r) => r.id} emptyTitle="Belum ada koreksi" emptyDescription="Koreksi absensi akan tercatat di sini." />
            <Pagination page={page} total={count ?? 0} basePath="/attendance/history" params={{ record: record ?? undefined, student: student ?? undefined }} />
          </>
        )}
      </div>
    </>
  );
}