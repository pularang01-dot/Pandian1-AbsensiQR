import type { Metadata } from "next";
import Link from "next/link";
import { History, ScanLine } from "lucide-react";
import { ADMIN_ROLES, APPROVER_ROLES, STAFF_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination, PAGE_SIZE, parsePage } from "@/components/ui/pagination";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { Input, Select } from "@/components/ui/field";
import { StatusBadge, ATTENDANCE_STATUS } from "@/components/ui/status-badge";
import { ErrorState } from "@/components/ui/states";
import { asDate, asUuid, loadClasses, loadYears, pickYear } from "@/lib/data/lookups";
import { one } from "@/lib/data/students";
import { STATUS_KEYS } from "@/lib/attendance-calc";
import { sanitizeSearch } from "@/lib/validation/common";
import { formatTanggal, formatWaktu, todayISO } from "@/lib/utils";
import { CorrectButton, ReconcileButton } from "./correction-controls";

export const metadata: Metadata = { title: "Data Absensi" };
export const dynamic = "force-dynamic";

type Row = {
  id: string; status: string; source: string; checked_in_at: string | null; note: string | null;
  students: { id: string; full_name: string; nis: string } | { id: string; full_name: string; nis: string }[] | null;
  classes: { name: string } | { name: string }[] | null;
};

const SOURCE_LABEL: Record<string, string> = { qr: "QR", manual: "Manual", permission: "Izin disetujui", dispensation: "Dispensasi", system: "Sistem" };

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ date?: string; class?: string; status?: string; q?: string; page?: string }> }) {
  const user = await requireRole(STAFF_ROLES);
  const sp = await searchParams;
  const supabase = await createClient();

  const date = asDate(sp.date) ?? todayISO();
  const q = sanitizeSearch(sp.q);
  const page = parsePage(sp.page);
  const status = (STATUS_KEYS as readonly string[]).includes(sp.status ?? "") ? sp.status! : "";
  const classes = await loadClasses(pickYear(await loadYears())?.id);
  const classId = classes.some((c) => c.id === asUuid(sp.class)) ? asUuid(sp.class) : null;
  const canCorrect = user.roles.some((r) => [...APPROVER_ROLES, "teacher"].includes(r));
  const isAdmin = user.roles.some((r) => ADMIN_ROLES.includes(r));
  const canScan = user.roles.some((r) => ["super_admin", "school_admin", "teacher", "operator"].includes(r));

  let query = supabase
    .from("attendance_records")
    .select("id, status, source, checked_in_at, note, students!inner(id, full_name, nis), classes(name), attendance_sessions!inner(session_date)", { count: "exact" })
    .eq("attendance_sessions.session_date", date)
    .order("checked_in_at", { ascending: false, nullsFirst: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) query = query.eq("status", status);
  if (classId) query = query.eq("class_id", classId);
  if (q) query = query.or(`full_name.ilike.%${q}%,nis.ilike.%${q}%`, { referencedTable: "students" });

  const { data, count, error } = await query;
  const rows = (data ?? []) as unknown as Row[];

  const columns: Column<Row>[] = [
    { key: "name", header: "Siswa", cell: (r) => { const s = one(r.students); return s ? <Link href={`/students/${s.id}`} className="font-medium hover:text-brand">{s.full_name}</Link> : "-"; } },
    { key: "nis", header: "NIS", hideOnMobile: true, cell: (r) => <span className="tabular">{one(r.students)?.nis ?? "-"}</span> },
    { key: "class", header: "Kelas", cell: (r) => one(r.classes)?.name ?? "-" },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    { key: "time", header: "Waktu", hideOnMobile: true, cell: (r) => <span className="tabular">{r.checked_in_at ? formatWaktu(r.checked_in_at) : "-"}</span> },
    { key: "source", header: "Sumber", hideOnMobile: true, cell: (r) => SOURCE_LABEL[r.source] ?? r.source },
    {
      key: "actions", header: "Tindakan", className: "text-right",
      cell: (r) => (
        <div className="flex justify-end gap-2">
          <Link href={`/attendance/history?record=${r.id}`} className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-brand hover:bg-brand-light">Riwayat</Link>
          {canCorrect && <CorrectButton recordId={r.id} studentName={one(r.students)?.full_name ?? "siswa"} currentStatus={r.status} />}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Data absensi"
        description={`Catatan kehadiran ${formatTanggal(date)}`}
        actions={
          <>
            {canScan && <Link href="/attendance/scanner" className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-[#2b68bd]"><ScanLine className="h-4 w-4" aria-hidden />Buka pemindai</Link>}
            <Link href="/attendance/history" className="inline-flex h-11 items-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-medium hover:bg-canvas"><History className="h-4 w-4" aria-hidden />Riwayat koreksi</Link>
            {isAdmin && <ReconcileButton date={date} />}
          </>
        }
      />
      <div className="card">
        <FilterBar action="/attendance" resetHref="/attendance">
          <FilterField label="Tanggal" htmlFor="date"><Input id="date" name="date" type="date" defaultValue={date} /></FilterField>
          <FilterField label="Kelas" htmlFor="class">
            <Select id="class" name="class" defaultValue={classId ?? ""}>
              <option value="">Semua kelas</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Status" htmlFor="status">
            <Select id="status" name="status" defaultValue={status}>
              <option value="">Semua status</option>
              {STATUS_KEYS.map((k) => <option key={k} value={k}>{ATTENDANCE_STATUS[k].label}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Cari nama atau NIS" htmlFor="q" grow><Input id="q" name="q" defaultValue={q} placeholder="Ketik nama atau NIS" /></FilterField>
        </FilterBar>
        {error ? (
          <ErrorState message="Data absensi tidak dapat dimuat. Coba muat ulang halaman." />
        ) : (
          <>
            <DataTable
              caption="Catatan absensi"
              columns={columns}
              rows={rows}
              rowKey={(r) => r.id}
              emptyTitle="Tidak ada catatan absensi"
              emptyDescription="Belum ada catatan pada tanggal dan filter ini. Siswa tanpa catatan tidak otomatis dianggap alpa sebelum rekonsiliasi."
            />
            <Pagination page={page} total={count ?? 0} basePath="/attendance" params={{ date, class: classId ?? undefined, status, q }} />
          </>
        )}
      </div>
    </>
  );
}
